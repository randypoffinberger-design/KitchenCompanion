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
