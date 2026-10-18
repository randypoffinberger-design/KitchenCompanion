const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const {IDBFactory}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
async function waitFor(fn){const until=Date.now()+3000;while(Date.now()<until){if(await fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out waiting for durable app state');}
test('installed-app startup uses durable storage and a signed-out form edit survives reopening',async()=>{
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));vc.on('error',(...args)=>errors.push(args.map(String).join(' ')));
 const dom=new JSDOM(read('index.html'),{url:'https://example.test/KitchenCompanion/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});
 w.CSS={escape:value=>String(value).replace(/[^a-zA-Z0-9_-]/g,char=>'\\'+char)};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.Audio=class{load(){}pause(){}play(){return Promise.resolve();}addEventListener(){}};
 w.alert=message=>{throw new Error(message);};w.confirm=()=>false;w.fetch=async()=>{throw new Error('Offline fixture');};
 for(const file of ['kitchen-engine.js','recipe-scaling.js','profile-storage.js','url-recipe-import.js','meal-planner.js','durable-storage.js','shared-model.js','item-sync.js','sync-client.js','password-ui.js'])w.eval(read(file));
 const old=new w.KCProfileStore();old.initializeFreshBrowserStorage();const original=w.localStorage.getItem('kitchenCompanion.profile.v1.'+old.activeProfile.profileId);
 Object.defineProperty(w,'indexedDB',{value:new IDBFactory()});
 try{
  w.eval(read('app.js'));
  await waitFor(()=>w.document.querySelector('#localSaveStatus')?.textContent.includes('Saved on this device'));
  assert.equal(w.document.querySelector('#localSaveStatus').closest('#sidebar')?.id,'sidebar');
  assert.equal(w.document.querySelector('#homeMenuBtn').closest('.home-artwork')?.className,'home-artwork');
  w.document.querySelector('#homeMenuBtn').click();
  assert.equal(w.document.querySelector('#sidebar').classList.contains('open'),true);
  assert.equal(w.document.querySelector('#homeMenuBtn').getAttribute('aria-expanded'),'true');
  w.document.querySelector('#scrim').click();
  assert.equal(w.document.querySelector('#sidebar').classList.contains('open'),false);
  w.document.querySelector('#addShoppingItemBtn').click();
  w.document.querySelector('#shoppingItemName').value='Strawberry cream cheese';
  const submitted=new w.Event('submit',{bubbles:true,cancelable:true});
  w.document.querySelector('#shoppingItemForm').dispatchEvent(submitted);
  assert.equal(submitted.defaultPrevented,true);
  await waitFor(()=>w.document.querySelector('#localSaveStatus')?.textContent.includes('Saved on this device'));
  assert.deepEqual(errors,[]);
  const loaded=await w.KCProfileStore.open();
  assert.equal(loaded.loadActiveState().shoppingList[0].name,'Strawberry cream cheese');
  const config=JSON.parse(loaded.storage.getItem('serenityKitchen.sync.v1'));
  assert.equal(Object.keys(config.pendingProfiles).length,1);
  assert.equal(w.localStorage.getItem('kitchenCompanion.profile.v1.'+old.activeProfile.profileId),original);
  assert.deepEqual(errors,[]);loaded.durable.close();
 }finally{w.close();}
});
