const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const model=require('../shared-model.js');
const copy=x=>JSON.parse(JSON.stringify(x));
function server(){
 const rows={},events=[],mutations={};
 return {rows,events,async request(url,options={}){
  if(options.method!=='POST'){const since=Number(new URL(url,'https://test').searchParams.get('since'));const page=events.filter(e=>e.eventId>since).slice(0,1000);return {events:copy(page),cursor:page.at(-1)?.eventId||since,hasMore:page.length===1000};}
  const changes=JSON.parse(options.body).changes,conflicts=[];
  for(const op of changes){const key=model.identifier([op.collection,op.id]),current=rows[key];if(!mutations[op.mutationId]&&(current?.version||0)!==op.baseVersion)conflicts.push({...op,current});}
  if(conflicts.length)throw Object.assign(new Error('conflict'),{status:409,body:{conflicts}});
  const applied=[];
  for(const op of changes){if(mutations[op.mutationId]){applied.push(mutations[op.mutationId]);continue;}
   const key=model.identifier([op.collection,op.id]),current=rows[key];
   const ack={collection:op.collection,id:op.id,mutationId:op.mutationId,version:(current?.version||0)+1,deleted:op.operation==='remove'};
   const event={...ack,eventId:events.length+1,payload:op.payload||current.payload};rows[key]=event;events.push(event);mutations[op.mutationId]=ack;applied.push(ack);
  }
  return {applied,conflicts:[]};
 }};
}
function device(server,storage=new Map()){
 const context={window:{SKSharedModel:model},console};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../item-sync.js'),'utf8'),context);
 let state={'shopping-list':{shoppingList:[]},pantry:{pantryItems:[]},'meal-plans':{}};
 const client={storage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},scopeKey:()=> 'same-household',context:()=> 'context',assertContext(){},beforeSync:async()=>{},changeGeneration:0,config:{activeHouseholdId:'h'},request:server.request.bind(server),onRemoteState:s=>{state=copy(s);}};
 const sync=new context.window.SKItemSync(client),provider=()=>state;
 return {sync,client,storage,provider,get state(){return state;},set state(s){state=s;},async run(){return sync.sync(provider);}};
}
test('two devices retain independent items and reconcile explicit removal',async()=>{
 const s=server(),a=device(s),b=device(s);
 a.state['shopping-list'].shoppingList.push({id:'milk',name:'Milk'});b.state['shopping-list'].shoppingList.push({id:'coffee',name:'Coffee creamer'});
 await a.run();await b.run();await a.run();
 assert.equal(a.state['shopping-list'].shoppingList.length,2);
 a.state['shopping-list'].shoppingList=a.state['shopping-list'].shoppingList.filter(i=>i.id!=='milk');await a.run();await b.run();
 assert.deepEqual(b.state['shopping-list'].shoppingList.map(i=>i.id),['coffee']);
});
test('offline edits and operation identities survive reload and a lost response',async()=>{
 const s=server(),a=device(s);a.state['shopping-list'].shoppingList.push({id:'milk',name:'Milk'});
 const request=a.client.request;let lost=true;
 a.client.request=async(url,options)=>{const r=await request(url,options);if(options.method==='POST'&&lost){lost=false;throw new Error('response lost');}return r;};
 await assert.rejects(a.run(),/lost/);const key=Object.keys(a.sync.data.pending)[0],mutation=a.sync.data.pending[key].mutationId;
 const b=device(s,a.storage);b.state=copy(a.state);
 assert.equal(b.sync.load().pending[key].mutationId,mutation);await b.run();assert.equal(s.events.length,1);assert.equal(b.sync.data.pending[key],undefined);
});
test('same-item conflicts preserve local contents and require an explicit version choice',async()=>{
 const s=server(),a=device(s),b=device(s);a.state['shopping-list'].shoppingList=[{id:'milk',name:'Milk'}];await a.run();await b.run();
 a.state['shopping-list'].shoppingList[0].name='Milk from A';b.state['shopping-list'].shoppingList[0].name='Milk from B';
 await a.run();await b.run();
 assert.equal(b.sync.data.conflicts.length,1);assert.equal(b.state['shopping-list'].shoppingList[0].name,'Milk from B');
 await b.sync.resolve(b.sync.data.conflicts[0].id,'shared',b.provider);
 assert.equal(b.state['shopping-list'].shoppingList[0].name,'Milk from A');assert.equal(b.sync.data.conflicts.length,0);
});
test('local conflict choice uses a fresh operation and current revision',async()=>{
 const s=server(),a=device(s),b=device(s);a.state['shopping-list'].shoppingList=[{id:'milk',name:'Milk'}];await a.run();await b.run();
 a.state['shopping-list'].shoppingList[0].name='A';b.state['shopping-list'].shoppingList[0].name='B';await a.run();await b.run();
 await b.sync.resolve(b.sync.data.conflicts[0].id,'local',b.provider);await b.run();await a.run();
 assert.equal(a.state['shopping-list'].shoppingList[0].name,'B');
});
test('removing a newly added item during its upload is not silently resurrected',async()=>{
 const s=server(),a=device(s);a.state['shopping-list'].shoppingList=[{id:'milk',name:'Milk'}];
 const request=a.client.request;let removed=false;
 a.client.request=async(url,options)=>{const result=await request(url,options);if(options.method==='POST'&&!removed){removed=true;a.state['shopping-list'].shoppingList=[];a.client.changeGeneration++;a.sync.stage(a.provider());}return result;};
 await a.run();await a.run();
 assert.equal(a.state['shopping-list'].shoppingList.length,0);
 assert.equal(Object.values(s.rows).find(item=>item.payload.value.id==='milk').deleted,true);
});
test('legacy duplicate IDs and missing history IDs normalize without dropping records',()=>{
 const source={pantry:{pantryItems:[{id:'duplicate',name:'Rice',quantity:1},{id:'duplicate',name:'Rice',quantity:2}]},'meal-plans':{mealPlanHistory:[{recipeKey:'soup',plannedAt:'2026-10-18'},{recipeKey:'soup',plannedAt:'2026-10-18'}]}};
 const normalized=model.normalize(source);
 assert.equal(normalized.pantry.pantryItems.length,2);
 assert.equal(new Set(normalized.pantry.pantryItems.map(item=>item.id)).size,2);
 assert.equal(new Set(normalized['meal-plans'].mealPlanHistory.map(item=>item.id)).size,2);
 assert.deepEqual(model.normalize(normalized),normalized);
 assert.equal(source.pantry.pantryItems[0].id,'duplicate');
});

test('moving a conflicted purchase to Pantry cannot resurrect it from the parked conflict',async()=>{
 const s=server(),a=device(s),b=device(s);
 a.state['shopping-list'].shoppingList=[{id:'milk',name:'Milk'}];await a.run();await b.run();
 a.state['shopping-list'].shoppingList=[];await a.run();
 b.state['shopping-list'].shoppingList[0].checked=true;await b.run();
 assert.equal(b.sync.data.conflicts.length,1);
 b.state['shopping-list'].shoppingList=[];
 b.state.pantry.pantryItems=[{id:'pantry-milk',name:'Milk',quantity:1}];
 await b.run();await b.run();
 assert.equal(b.state['shopping-list'].shoppingList.length,0);
 assert.equal(b.state.pantry.pantryItems[0].quantity,1);
 const reopened=device(s,b.storage);reopened.state=copy(b.state);await reopened.run();
 assert.equal(reopened.state['shopping-list'].shoppingList.length,0);
 assert.equal(reopened.state.pantry.pantryItems[0].quantity,1);
 assert.equal(reopened.sync.data.conflicts.length,0,'matching removals converge automatically');
 assert.equal(reopened.sync.data.archivedConflicts.length,1,'the earlier alternative remains preserved');
 await reopened.run();await a.run();await reopened.run();
 assert.equal(a.state['shopping-list'].shoppingList.length,0);
 assert.equal(a.state.pantry.pantryItems[0].quantity,1);
 assert.equal(a.state.pantry.pantryItems.length,1);
});

test('removing a local-only item in a rejected batch keeps its newer removal intent',async()=>{
 const s=server(),a=device(s),b=device(s);
 a.state['shopping-list'].shoppingList=[{id:'shared',name:'Shared'}];await a.run();await b.run();
 a.state['shopping-list'].shoppingList[0].name='New household version';await a.run();
 b.state['shopping-list'].shoppingList[0].name='Local version';
 b.state['shopping-list'].shoppingList.push({id:'new-purchase',name:'Creamer',checked:true});await b.run();
 assert.equal(b.sync.data.conflicts.length,1);
 b.state['shopping-list'].shoppingList=b.state['shopping-list'].shoppingList.filter(item=>item.id!=='new-purchase');
 b.state.pantry.pantryItems=[{id:'pantry-creamer',name:'Creamer',quantity:1}];await b.run();
 assert.equal(b.state['shopping-list'].shoppingList.some(item=>item.id==='new-purchase'),false);
 assert.equal(b.state.pantry.pantryItems[0].name,'Creamer');
});

test('a genuine conflict does not stop unrelated offline additions',async()=>{
 const s=server(),a=device(s),b=device(s);
 a.state['shopping-list'].shoppingList=[{id:'one',name:'Original'}];await a.run();await b.run();
 a.state['shopping-list'].shoppingList[0].name='Household';await a.run();
 b.state['shopping-list'].shoppingList[0].name='Local';b.state['shopping-list'].shoppingList.push({id:'coffee',name:'Coffee'});await b.run();
 assert.equal(b.sync.data.conflicts.length,1);
 await a.run();assert.ok(a.state['shopping-list'].shoppingList.some(item=>item.id==='coffee'));
 b.state['shopping-list'].shoppingList.push({id:'salmon',name:'Salmon'});await b.run();await a.run();
 assert.ok(a.state['shopping-list'].shoppingList.some(item=>item.id==='salmon'));
 assert.equal(b.state['shopping-list'].shoppingList.find(item=>item.id==='one').name,'Local');
});

test('independent fields on the same shopping item merge without approval',async()=>{
 const s=server(),a=device(s),b=device(s);
 a.state['shopping-list'].shoppingList=[{id:'one',name:'Milk',checked:false,store:'Store'}];await a.run();await b.run();
 a.state['shopping-list'].shoppingList[0].checked=true;await a.run();
 b.state['shopping-list'].shoppingList[0].store='Other store';await b.run();await a.run();
 const item=a.state['shopping-list'].shoppingList[0];assert.equal(item.checked,true);assert.equal(item.store,'Other store');assert.equal(b.sync.data.conflicts.length,0);
});

test('timestamp-only updates do not queue an upload or require review',async()=>{
 const s=server(),a=device(s);
 a.state['shopping-list'].shoppingList=[{id:'one',name:'Milk',updatedAt:'2026-10-17'}];await a.run();const count=s.events.length;
 a.state['shopping-list'].shoppingList[0].updatedAt='2026-10-18';await a.run();
 assert.equal(s.events.length,count);assert.equal(a.sync.data.conflicts.length,0);
});

test('a conflicted transfer remains atomic while a separate purchase syncs',async()=>{
 const s=server(),a=device(s),b=device(s);
 a.state['shopping-list'].shoppingList=[{id:'one',name:'Milk',checked:true}];await a.run();await b.run();
 a.state['shopping-list'].shoppingList[0].name='New name';await a.run();
 b.state['shopping-list'].shoppingList=[];b.state.pantry.pantryItems=[{id:'stock',name:'Milk',quantity:1}];b.sync.stage(b.provider());
 b.state['shopping-list'].shoppingList.push({id:'coffee',name:'Coffee'});await b.run();await a.run();
 assert.equal(a.state.pantry.pantryItems.length,0);assert.ok(a.state['shopping-list'].shoppingList.some(item=>item.id==='coffee'));
 assert.equal(b.state['shopping-list'].shoppingList.some(item=>item.id==='one'),false);assert.equal(b.state.pantry.pantryItems[0].quantity,1);
 await b.sync.resolve(b.sync.data.conflicts[0].id,'local',b.provider);await b.run();await a.run();
 assert.equal(a.state.pantry.pantryItems[0].quantity,1);assert.equal(a.state['shopping-list'].shoppingList.some(item=>item.id==='one'),false);
});

test('an edit after a lost acknowledgement replays the frozen operation before its successor',async()=>{
 const s=server(),a=device(s);
 a.state['shopping-list'].shoppingList=[{id:'one',name:'Original'}];await a.run();
 const request=a.client.request;let lose=true;
 a.client.request=async(url,options)=>{const result=await request(url,options);if(options.method==='POST'&&lose){lose=false;throw new Error('lost acknowledgement');}return result;};
 a.state['shopping-list'].shoppingList[0].name='First edit';await assert.rejects(a.run(),/lost acknowledgement/);
 a.state['shopping-list'].shoppingList[0].name='Second edit';a.sync.stage(a.provider());
 const reloaded=device(s,a.storage);reloaded.state=copy(a.state);await reloaded.run();
 assert.equal(reloaded.state['shopping-list'].shoppingList[0].name,'Second edit');assert.equal(reloaded.sync.data.conflicts.length,0);assert.equal(s.events.length,3);
});

test('independent purchases into existing Pantry stock merge purchase lots exactly once',async()=>{
 const s=server(),a=device(s),b=device(s);
 a.state.pantry.pantryItems=[{id:'milk',name:'Milk',quantity:1,lots:[{id:'original',quantity:1}]}];await a.run();await b.run();
 a.state.pantry.pantryItems[0].lots.push({id:'purchase-a',quantity:2});a.state.pantry.pantryItems[0].quantity=3;await a.run();
 b.state.pantry.pantryItems[0].lots.push({id:'purchase-b',quantity:3});b.state.pantry.pantryItems[0].quantity=4;await b.run();await a.run();await b.run();
 assert.equal(a.state.pantry.pantryItems[0].quantity,6);assert.equal(a.state.pantry.pantryItems[0].lots.length,3);assert.equal(b.sync.data.conflicts.length,0);
});

test('the same checked purchase moved on two offline devices is recorded once',async()=>{
 const s=server(),a=device(s),b=device(s);
 a.state['shopping-list'].shoppingList=[{id:'milk',name:'Milk',checked:true}];await a.run();await b.run();
 for(const device of [a,b]){device.state['shopping-list'].shoppingList=[];device.state.pantry.pantryItems=[{id:'purchase-milk',name:'Milk',quantity:1,lots:[{id:'purchase-milk-entry',quantity:1,createdAt:'2026-10-18T01:00:00Z'}]}];device.sync.stage(device.provider());}
 await a.run();await b.run();await a.run();
 assert.equal(a.state.pantry.pantryItems.length,1);assert.equal(a.state.pantry.pantryItems[0].quantity,1);assert.equal(a.state['shopping-list'].shoppingList.length,0);assert.equal(b.sync.data.conflicts.length,0);
});

test('old saved batch conflicts migrate without blocking an unrelated local addition',async()=>{
 const s=server(),a=device(s),b=device(s);
 a.state['shopping-list'].shoppingList=[{id:'one',name:'Original'}];await a.run();await b.run();
 a.state['shopping-list'].shoppingList[0].name='Household';await a.run();
 b.state['shopping-list'].shoppingList[0].name='Offline';await b.run();
 const data=b.sync.data,extra={collection:'shopping-list',id:JSON.stringify(['shoppingList','extra']),operation:'put',payload:{collection:'shopping-list',id:JSON.stringify(['shoppingList','extra']),path:['shoppingList','extra'],value:{id:'extra',name:'Coffee'}},mutationId:'old-extra',baseVersion:0};
 data.conflicts[0].changes.push(extra);for(const op of data.conflicts[0].changes){delete op.transactionId;delete op.basePayload;}b.sync.save();
 const reloaded=device(s,b.storage);reloaded.state=copy(b.state);reloaded.state['shopping-list'].shoppingList.push({id:'extra',name:'Coffee'});await reloaded.run();await a.run();
 assert.ok(a.state['shopping-list'].shoppingList.some(item=>item.id==='extra'));assert.equal(reloaded.sync.data.conflicts.length,1);assert.ok(reloaded.sync.data.archivedConflicts.length);
});

test('a failed durable outbox save prevents sending its mutation',async()=>{
 const s=server(),a=device(s);a.state['shopping-list'].shoppingList=[{id:'one',name:'Milk'}];
 a.client.beforeSync=async()=>{if(a.sync.data.inflight)throw new Error('quota blocked');};
 await assert.rejects(a.run(),/quota blocked/);assert.equal(s.events.length,0);assert.equal(Object.keys(a.sync.data.pending).length,1);
});
