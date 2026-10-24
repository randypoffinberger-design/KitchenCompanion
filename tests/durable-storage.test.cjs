const {test} = require('node:test');
const assert = require('node:assert/strict');
const {IDBFactory} = require('fake-indexeddb');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../durable-storage.js'),'utf8');
const legacy = entries => {const data=new Map(Object.entries(entries));return {get length(){return data.size;},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem(){throw new Error('Legacy storage must remain untouched');},data};};
function api() {const context={window:{},queueMicrotask,console};vm.runInNewContext(source,context);return context.window.SKDurableStorage;}
const key='kitchenCompanion.profile.v1.p', pending='serenityKitchen.sync.v1';

test('migration commits a preserved original without changing legacy localStorage',async()=>{
 const Store=api(),idb=new IDBFactory(),old=legacy({[key]:'{"shoppingList":[{"name":"Milk"}]}'});
 const db=await Store.open(old,idb);
 assert.equal(db.storage.getItem(key),old.data.get(key));
 assert.equal((await db.history())[0].pinned,true);
 assert.equal(old.data.size,1); db.close();
});
test('profile contents and pending sync state survive together across a reload',async()=>{
 const Store=api(),idb=new IDBFactory(),old=legacy({[key]:'{"shoppingList":[]}'});
 const first=await Store.open(old,idb);first.storage.onchange=null;
 first.storage.setItem(key,'{"shoppingList":[{"name":"Strawberry cream cheese"}]}');
 first.storage.setItem(pending,'{"pendingProfiles":{"p":true}}');
 await first.flush();first.close();
 const second=await Store.open(old,idb);
 assert.equal(JSON.parse(second.storage.getItem(key)).shoppingList[0].name,'Strawberry cream cheese');
 assert.equal(JSON.parse(second.storage.getItem(pending)).pendingProfiles.p,true);
 assert.equal(old.data.get(key),'{"shoppingList":[]}');second.close();
});
test('an aborted transaction changes neither profile contents nor its pending marker',async()=>{
 const Store=api(),idb=new IDBFactory(),old=legacy({[key]:'old',[pending]:'old-pending'});
 const db=await Store.open(old,idb);db.storage.onchange=null;
 const transaction=db.db.transaction.bind(db.db);
 db.db.transaction=(...args)=>{const tx=transaction(...args);if(args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;};
 db.storage.setItem(key,'new');db.storage.setItem(pending,'new-pending');
 await assert.rejects(db.flush());db.db.transaction=transaction;db.close();
 const reopened=await Store.open(old,idb);
 assert.equal(reopened.storage.getItem(key),'old');assert.equal(reopened.storage.getItem(pending),'old-pending');reopened.close();
});
test('a stale second window cannot overwrite the newer committed kitchen',async()=>{
 const Store=api(),idb=new IDBFactory(),old=legacy({[key]:'original'});
 const a=await Store.open(old,idb),b=await Store.open(old,idb);
 a.storage.onchange=null;b.storage.onchange=null;
 a.storage.setItem(key,'newer');await a.flush();
 b.storage.setItem(key,'stale');await assert.rejects(b.flush(),/another SK window/i);
 assert.equal((await a.readCurrent()).entries[key],'newer');
 assert.equal(b.storage.getItem(key),'stale');a.close();b.close();
});
test('reading recovery history does not save or compact active data',async()=>{
 const Store=api(),idb=new IDBFactory(),db=await Store.open(legacy({[key]:'original'}),idb);
 const before=JSON.stringify(await db.readCurrent()),revision=db.revision;
 await db.history();await db.history();
 assert.equal(JSON.stringify(await db.readCurrent()),before);assert.equal(db.revision,revision);db.close();
});
test('automatic saves coalesce state and sync markers from the same event turn',async()=>{
 const Store=api(),idb=new IDBFactory(),db=await Store.open(legacy({[key]:'original'}),idb);
 db.storage.setItem(key,'edited');db.storage.setItem(pending,'pending');
 await new Promise(resolve=>setTimeout(resolve,20));
 const current=await db.readCurrent();
 assert.equal(current.entries[key],'edited');assert.equal(current.entries[pending],'pending');db.close();
});
test('an iPhone-style closing connection is reopened without losing the pending save',async()=>{
 const Store=api(),idb=new IDBFactory(),db=await Store.open(legacy({[key]:'original',[pending]:'original-pending'}),idb);
 db.storage.onchange=null;
 db.db.close();
 db.storage.setItem(key,'edited after resume');
 db.storage.setItem(pending,'pending after resume');
 await db.flush();
 const reopened=await Store.open(legacy({[key]:'original',[pending]:'original-pending'}),idb);
 const current=await reopened.readCurrent();
 assert.equal(current.entries[key],'edited after resume');
 assert.equal(current.entries[pending],'pending after resume');
 assert.ok(current.revision>1);reopened.close();db.close();
});
test('a version-change close reconnects after the upgrade and keeps revision protection',async()=>{
 const Store=api(),idb=new IDBFactory(),db=await Store.open(legacy({[key]:'original'}),idb);db.storage.onchange=null;
 const upgraded=await new Promise((resolve,reject)=>{const request=idb.open('serenity-kitchen-durable',2);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 upgraded.close();
 db.storage.setItem(key,'saved after version change');
 await db.flush();
 assert.equal((await db.readCurrent()).entries[key],'saved after version change');db.close();
});
test('older cached app edits are preserved as a separate copy after migration',async()=>{
 const Store=api(),idb=new IDBFactory(),old=legacy({[key]:'{"shoppingList":[{"id":"one","name":"Original"}]}'});
 const first=await Store.open(old,idb);first.storage.onchange=null;
 first.storage.setItem(key,'{"shoppingList":[{"id":"new","name":"New version"}]}');await first.flush();first.close();
 old.data.set(key,'{"shoppingList":[{"id":"old","name":"Older cached app edit"}]}');
 const second=await Store.open(old,idb);
 assert.equal(JSON.parse(second.storage.getItem(key)).shoppingList[0].name,'New version');
 const preserved=(await second.history()).find(item=>item.reason==='older-version-changes');
 assert.ok(preserved);assert.equal(JSON.parse(preserved.entries[key]).shoppingList[0].name,'Older cached app edit');second.close();
});
test('unchanged polling cannot consume history after the snapshot interval',async()=>{
 let stamp=Date.parse('2026-10-01T00:00:00Z');
 class Clock extends Date {constructor(...args){super(...(args.length?args:[stamp]));}static now(){return stamp;}}
 const context={window:{},queueMicrotask,console,Date:Clock};vm.runInNewContext(source,context);
 const Store=context.window.SKDurableStorage,idb=new IDBFactory(),db=await Store.open(legacy({[key]:'{"shoppingList":[]}'}),idb);db.storage.onchange=null;
 stamp+=24*60*60*1000;db.storage.setItem(pending,'{"lastSyncAt":"later"}');await db.flush();
 assert.equal((await db.history()).length,1);
 db.storage.setItem(key,'{"shoppingList":[{"id":"milk","name":"Milk"}]}');await db.flush();
 assert.equal((await db.history()).length,2);db.close();
});

test('routine sync metadata saves reuse the fingerprint of unchanged kitchen data',async()=>{
 let profileParses=0;
 const context={window:{},queueMicrotask,console,Date,JSON:{stringify:JSON.stringify,parse:text=>{if(text.includes('large-recipe-payload'))profileParses++;return JSON.parse(text);}}};
 vm.runInNewContext(source,context);
 const Store=context.window.SKDurableStorage,idb=new IDBFactory();
 const original=JSON.stringify({shoppingList:[],notes:'large-recipe-payload'.repeat(10000)});
 const db=await Store.open(legacy({[key]:original}),idb);db.storage.onchange=null;
 const before=profileParses;
 for(let i=0;i<5;i++){db.storage.setItem(pending,JSON.stringify({cursor:i}));await db.flush();}
 assert.equal(profileParses,before,'background sync must not reparse the full unchanged kitchen');
 assert.equal(db.storage.getItem(key),original);db.close();
});
