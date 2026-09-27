const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs'), vm = require('node:vm'), crypto = require('node:crypto');
const {loadFunctions} = require('./helpers/app-functions.cjs');
const source = fs.readFileSync(require('node:path').join(__dirname,'../sync-client.js'),'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const recipe = (name='Soup') => ({id:'soup',name});

function server() {
  const events=[], owners=new Map(), mutations=new Map(); let writes=0;
  const version = payload => crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return {events,owners,get writes(){return writes;},async request(user,route,options={}) {
    if (!route.includes('/recipe-sync')) return {events:[],cursor:0,applied:[]};
    if (options.method!=='POST') {
      const since=Number(new URL(route,'https://example.test').searchParams.get('since'));
      const page=events.filter(x=>x.eventId>since).slice(0,1000);
      return copy({events:page,cursor:page.at(-1)?.eventId||since,hasMore:page.length===1000});
    }
    writes++; const applied=[],conflicts=[];
    for (const op of JSON.parse(options.body).changes) {
      const mutationKey=user+':'+op.mutationId;
      if(mutations.has(mutationKey)){applied.push(mutations.get(mutationKey));continue;}
      const recipes=owners.get(user)||new Map();owners.set(user,recipes);
      const current=recipes.get(op.id),currentVersion=current?version(current):null;
      if(currentVersion!==op.baseVersion&&currentVersion!==version(op.payload)) {conflicts.push({id:op.id,mutationId:op.mutationId,current:current?{payload:current,version:currentVersion}:null});continue;}
      recipes.set(op.id,op.payload);
      const result={id:op.id,mutationId:op.mutationId,version:version(op.payload)};
      mutations.set(mutationKey,result);applied.push(result);
      events.push({eventId:events.length+1,id:'owner:'+user,payload:{ownerUserId:user,ownerDisplayName:user,personalRecipes:[...recipes.values()]},versions:Object.fromEntries([...recipes].map(([id,r])=>[id,version(r)]))});
    }
    if(conflicts.length)throw Object.assign(new Error('Conflict'),{status:409,body:copy({applied,conflicts})});
    return copy({applied,conflicts});
  }};
}
function device(backend,{user='A',values=new Map(),recipes=[]}={}) {
  let local=copy(recipes),shared={},applies=0;
  const context={window:{},URL,console,crypto,
    localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},
    setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
  vm.runInNewContext(source,context);
  const client=new context.window.SKHouseholdSync({profileId:'local-profile',onRemoteState:(data)=>{
    applies++;
    if(data.recipes)for(const owner of data.recipes.ownerRecords){if(owner.ownerUserId===user)local=copy(owner.personalRecipes);else shared[owner.ownerUserId]=copy(owner.personalRecipes);}
  }});
  Object.assign(client.config,{token:'token-'+user,expiresAt:new Date(Date.now()+600000).toISOString(),user:{id:user,displayName:user},households:[{id:'family',role:'adult'}],activeHouseholdId:'family',profileId:'local-profile'});
  client.config.profileAccounts[client.bindingKey()]=user;
  client.config.initializedHouseholds[client.initializationKey()]=true;
  client.request=(route,options)=>backend.request(client.config.user.id,route,options);
  client.localSnapshotProvider=()=>({recipes:{personalRecipes:local},'shopping-list':{},pantry:{},'meal-plans':{}});
  client.save();
  return {client,values,get local(){return local;},set local(value){local=copy(value);},get shared(){return shared;},get applies(){return applies;},sync:()=>client.recipeSync.sync(local)};
}

test('two accounts share recipes but never upload each other’s contents',async()=>{
  const backend=server(),a=device(backend,{recipes:[recipe()]}),b=device(backend,{user:'B',recipes:[{id:'cake',name:'Cake'}]});
  await a.sync();await b.sync();await a.sync();
  assert.deepEqual(a.local,[recipe()]);assert.deepEqual(b.local,[{id:'cake',name:'Cake'}]);
  assert.deepEqual(a.shared.B,b.local);assert.deepEqual(b.shared.A,a.local);
  assert.equal(backend.owners.get('B').has('soup'),false);
});

test('same-account downloads reconcile additions and edits without replacing local-only recipes',async()=>{
  const backend=server(),a=device(backend,{recipes:[recipe()]}),b=device(backend);
  await a.sync();await b.sync();assert.deepEqual(b.local,a.local);
  b.local=[recipe('Better soup'),{id:'bread',name:'Bread'}];await b.sync();await a.sync();
  assert.deepEqual(a.local,b.local);assert.equal(a.local.length,2);
});

test('simultaneous edits preserve both versions and sync the conflict copy',async()=>{
  const backend=server(),a=device(backend,{recipes:[recipe()]}),b=device(backend);
  await a.sync();await b.sync();
  a.local=[recipe('A version')];b.local=[recipe('B version')];b.client.markDirty();
  await a.sync();await b.sync();
  assert.equal(b.local.find(x=>x.id==='soup').name,'A version');
  assert.equal(b.local.find(x=>x.conflictOf==='soup').name,'B version (conflict copy)');
  await b.sync();await a.sync();assert.deepEqual(a.local,b.local);
});

test('missing recipe in a stale list never deletes the shared copy',async()=>{
  const backend=server(),a=device(backend,{recipes:[recipe(),{id:'cake',name:'Cake'}]}),b=device(backend);
  await a.sync();await b.sync();b.local=[recipe()];await b.sync();
  assert.equal(b.local.length,2);assert.equal(backend.owners.get('A').size,2);
});

test('device removal leaves payload and references intact; both people remove independently; restore is local',async()=>{
  const backend=server(),a=device(backend,{recipes:[recipe()]}),b=device(backend,{user:'B'});
  await a.sync();await b.sync();
  function localApp(key,recipes) {
    const state={hiddenRecipes:[],modules:[{moduleId:'my-recipes',recipes:copy(recipes)}],favorites:[key],recipeNotes:{[key]:'Keep my note'}};
    const app=loadFunctions(['removeRecipeFromDevice','deletePersonalRecipe','hideModuleRecipe'],{state,profileStore:{saveCombinedState(){}},confirm:()=>true,refreshAll(){},showList(){},selectedRecipeKey:key,alert:assert.fail});
    return {app,state};
  }
  const aa=localApp('my-recipes:soup',a.local),bb=localApp('household-A:soup',b.shared.A);
  aa.app.deletePersonalRecipe({...recipe(),moduleId:'my-recipes',key:'my-recipes:soup'});
  assert.deepEqual([...aa.state.hiddenRecipes],['my-recipes:soup']);assert.deepEqual(bb.state.hiddenRecipes,[]);
  assert.equal(aa.state.modules[0].recipes.length,1);assert.equal(aa.state.recipeNotes['my-recipes:soup'],'Keep my note');
  bb.app.hideModuleRecipe({...recipe(),moduleId:'household-A',key:'household-A:soup'});
  assert.deepEqual([...bb.state.hiddenRecipes],['household-A:soup']);
  await a.sync();await b.sync();assert.equal(backend.owners.get('A').size,1);
  aa.state.hiddenRecipes=[];assert.deepEqual([...bb.state.hiddenRecipes],['household-A:soup']);
});

test('device removal rolls back its visibility when persistence fails',()=>{
  const state={hiddenRecipes:[]};let message;
  const app=loadFunctions(['removeRecipeFromDevice'],{state,confirm:()=>true,profileStore:{saveCombinedState(){throw new Error('Storage full');}},alert:x=>message=x});
  app.removeRecipeFromDevice({key:'my-recipes:soup',name:'Soup'});
  assert.equal(state.hiddenRecipes.length,0);assert.match(message,/not removed: Storage full/);
});

test('pending offline edits and mutation identities survive reload and a lost write response',async()=>{
  const backend=server(),a=device(backend,{recipes:[recipe()]});
  const original=a.client.request;let loseResponse=true;
  a.client.request=async(route,options)=>{const result=await original(route,options);if(options.method==='POST'&&loseResponse){loseResponse=false;throw new Error('Offline');}return result;};
  await assert.rejects(a.sync(),/Offline/);
  const pendingId=Object.values(a.client.recipeSync.data.pending)[0].mutationId;
  const reloaded=device(backend,{values:a.values,recipes:a.local});
  assert.equal(Object.values(reloaded.client.recipeSync.load().pending)[0].mutationId,pendingId);
  await reloaded.sync();assert.equal(backend.owners.get('A').size,1);assert.equal(Object.keys(reloaded.client.recipeSync.data.pending).length,0);
});

test('a failed local write does not commit the recipe history cursor',async()=>{
  const backend=server(),a=device(backend,{recipes:[recipe()]}),b=device(backend);
  await a.sync();b.client.onRemoteState=()=>{throw new Error('Storage full');};
  await assert.rejects(b.sync(),/Storage full/);assert.equal(b.client.recipeSync.data.cursor,0);
});

test('recipe history beyond 1,000 events reaches the latest version',async()=>{
  const backend=server();
  for(let i=0;i<1005;i++)backend.events.push({eventId:i+1,id:'owner:A',payload:{ownerUserId:'A',personalRecipes:[recipe(String(i))]},versions:{soup:'a'.repeat(64)}});
  const a=device(backend);await a.sync();assert.equal(a.local[0].name,'1004');assert.equal(a.client.recipeSync.data.cursor,1005);
});

test('account switching during a request cannot apply its response to the new account',async()=>{
  const backend=server(),a=device(backend,{recipes:[recipe()]});let release;
  a.client.request=()=>new Promise(resolve=>release=resolve);
  const pending=a.sync();a.client.config.user={id:'B'};a.client.sessionEpoch++;
  release({events:[],cursor:0});await assert.rejects(pending,/changed/);assert.equal(a.applies,0);assert.equal(backend.writes,0);
});

test('edits during recipe download are kept and the response is not applied',async()=>{
  const backend=server(),a=device(backend,{recipes:[recipe()]});await a.sync();
  const request=a.client.request;let changed=false;
  a.client.request=async(route,options)=>{const result=await request(route,options);if(!changed){changed=true;a.local=[recipe('During request')];a.client.markDirty();}return result;};
  const before=a.applies;await a.sync();assert.equal(a.applies,before);assert.equal(a.local[0].name,'During request');
  await a.sync();assert.equal(a.local[0].name,'During request');
});

test('recipe failure does not prevent other collections from uploading',async()=>{
  const backend=server(),a=device(backend,{recipes:[recipe()]});a.client.markDirty();
  const pushed=[];a.client.pushCollection=async collection=>pushed.push(collection);
  a.client.recipeSync.sync=async()=>{throw new Error('Recipe error');};
  await assert.rejects(a.client.syncNow(a.client.localSnapshotProvider),/Recipe error/);
  assert.deepEqual(pushed,['shopping-list','pantry','meal-plans']);
});

test('unchanged polling does not create repeated profile writes or safety checkpoints',async()=>{
  const backend=server(),a=device(backend,{recipes:[recipe()]});
  await a.sync();await a.sync();const before=a.applies;
  await a.sync();await a.sync();assert.equal(a.applies,before);
});

test('local removal survives a real profile-storage reload and restores without losing contents',()=>{
  const {JSDOM}=require('jsdom');
  const dom=new JSDOM('',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;
  try {
    w.eval(fs.readFileSync(require('node:path').join(__dirname,'../profile-storage.js'),'utf8'));
    const store=new w.KCProfileStore();if(store.needsStorageRecovery())store.initializeFreshBrowserStorage();
    const state=store.loadActiveState();state.modules.push({moduleId:'my-recipes',recipes:[recipe()]});
    store.saveCombinedState(state);
    const app=loadFunctions(['removeRecipeFromDevice','restoreAllHiddenRecipes'],{state,profileStore:store,confirm:()=>true,selectedRecipeKey:null,refreshAll(){},showList(){},renderHiddenRecipes(){},alert:assert.fail,saveState:()=>store.saveCombinedState(state)});
    app.removeRecipeFromDevice({key:'my-recipes:soup',name:'Soup'});
    const reloaded=new w.KCProfileStore().loadActiveState();
    assert.deepEqual(copy(reloaded.hiddenRecipes),['my-recipes:soup']);
    assert.equal(reloaded.modules.find(x=>x.moduleId==='my-recipes').recipes[0].name,'Soup');
    app.restoreAllHiddenRecipes();assert.equal(new w.KCProfileStore().loadActiveState().hiddenRecipes.length,0);
  } finally {w.close();}
});

test('profile-account binding persists through logout and reload',async()=>{
  const backend=server(),a=device(backend);await a.client.logout();
  const reloaded=new a.client.constructor({profileId:'local-profile'});
  reloaded.request=async()=>({token:'token-B',expiresAt:new Date(Date.now()+600000).toISOString(),user:{id:'B'}});
  await assert.rejects(reloaded.login({email:'b@example.test',password:'test'}),/another account/);
  assert.equal(reloaded.config.user,null);
});

test('duplicate local identities stop recipe reconciliation without losing either local copy',async()=>{
  const backend=server(),a=device(backend,{recipes:[recipe('First'),recipe('Second')]});
  await assert.rejects(a.sync(),/same identity/);assert.equal(a.local.length,2);assert.equal(backend.writes,0);
});
