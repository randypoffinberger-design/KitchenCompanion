const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadFunctions } = require('./helpers/app-functions.cjs');
const root = path.join(__dirname, '..');
const copy = value => JSON.parse(JSON.stringify(value));
const backupKey = 'kitchenCompanion.safetyBackups.v1';

function storeHarness() {
  const values = new Map();
  let limit = Infinity;
  const localStorage = {
    get length() { return values.size; }, key: i => [...values.keys()][i],
    getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key),
    setItem(key, value) {
      if (key === backupKey && value.length > limit) throw Object.assign(new Error('Storage quota exceeded'), { name:'QuotaExceededError' });
      values.set(key, value);
    }
  };
  const context = {window:{}, localStorage, console:{warn(){}}, sessionStorage:{getItem(){return null;}}};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'profile-storage.js'), 'utf8'), context);
  const store = Object.create(context.window.KCProfileStore.prototype);
  return {store, values, localStorage, setLimit: n => {limit = n;}};
}
const checkpoint = (id, data) => ({id, createdAt:'2026-10-13T23:59:34Z', kind:'automatic', reason:'startup', snapshotMode:'compact', fingerprint:id, snapshot:{'kitchenCompanion.profile.v1.p':JSON.stringify({shoppingList:[{name:data}]})}});

test('quota pressure cannot trade an existing recovery point for a new checkpoint', () => {
  const h = storeHarness();
  const old = checkpoint('before-loss', 'Strawberry cream cheese'), next = checkpoint('after-loss', 'Bananas');
  const original = JSON.stringify([old]);
  h.values.set(backupKey, original);
  h.setLimit(Math.max(original.length, JSON.stringify([next]).length) + 10);
  assert.throws(() => h.store.saveSafetyBackups([next, old]), /quota|checkpoint|storage/i);
  assert.equal(h.values.get(backupKey), original);
});

test('a quota-blocked restore leaves its selected checkpoint and live list untouched', () => {
  const h = storeHarness(), old = checkpoint('before-loss', 'Strawberry cream cheese');
  const profileKey = 'kitchenCompanion.profile.v1.p';
  h.values.set(profileKey, JSON.stringify({shoppingList:[{name:'Bananas'}]}));
  h.values.set(backupKey, JSON.stringify([old]));
  h.setLimit(JSON.stringify([old]).length + 20);
  const current = h.values.get(profileKey), original = h.values.get(backupKey);
  assert.throws(() => h.store.restoreSafetyBackup(old.id), /quota|checkpoint|storage/i);
  assert.equal(h.values.get(profileKey), current);
  assert.equal(h.values.get(backupKey), original);
});

function syncHarness() {
  const values = new Map(), applied = [], timers = [];
  const context = {window:{}, URL, console,
    localStorage:{getItem:k => values.get(k) || null, setItem:(k,v) => values.set(k,v)},
    setTimeout:(fn,delay) => {timers.push({fn,delay}); return timers.length;},clearTimeout(){},setInterval(){},clearInterval(){}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'sync-client.js'),'utf8'),context);
  const client = new context.window.SKHouseholdSync({profileId:'p', onRemoteState:s => applied.push(copy(s))});
  Object.assign(client.config,{token:'test',expiresAt:new Date(Date.now()+60000).toISOString(),user:{id:'u'},households:[{id:'h'}],activeHouseholdId:'h',profileId:'p',recipeOwnershipMigrationComplete:true});
  client.config.initializedHouseholds[client.initializationKey()] = true;
  client.recipeSync.sync = async () => true;
  return {client, applied, values};
}

for (const collection of ['shopping-list','pantry','meal-plans']) {
  test(`${collection} conflict never force-retries over the newer household copy`, async () => {
    const {client} = syncHarness(); let writes = 0;
    client.request = async () => {
      writes++;
      throw Object.assign(new Error('Conflict'),{status:409,body:{conflicts:[{id:'shared-state',current:{revision:42,payload:{}}}]}});
    };
    await assert.rejects(client.pushCollection(collection,{local:'unsent'},1), /conflict/i);
    assert.equal(writes,1);
    assert.equal(client.config.revisions[client.key(collection,'shared-state')],undefined);
  });
}

test('incoming replacement stops before modifying state when its safety checkpoint fails', () => {
  const state = {shoppingList:[{name:'Strawberry cream cheese'}]};
  let saves = 0;
  const app = loadFunctions(['applyHouseholdSnapshot'],{
    state,applyingRemoteSync:false,currentView:'home',console,
    profileStore:{createSafetyBackup(){return null;},createAutomaticRecoverySnapshot:()=>Promise.resolve(),saveCombinedState(){saves++;}},
    householdSync:{summary:()=>({user:{id:'u'}})},migrateState(){},refreshAll(){}
  });
  assert.throws(() => app.applyHouseholdSnapshot({'shopping-list':{shoppingList:[]}}), /checkpoint|protect|backup/i);
  assert.equal(state.shoppingList[0].name,'Strawberry cream cheese');
  assert.equal(saves,0);
});

test('a failed shared-list upload leaves its pending scope and local contents available', async () => {
  const {client,applied} = syncHarness();
  client.markDirty();
  const scope = client.scopeKey();
  client.request = async () => {throw Object.assign(new Error('Conflict'),{status:409,body:{conflicts:[{id:'shared-state',current:{revision:42}}]}});};
  await assert.rejects(client.syncNow(() => ({'shopping-list':{shoppingList:[{name:'Local milk'}]},pantry:{pantryItems:[]},'meal-plans':{},recipes:{personalRecipes:[]}})),/conflict/i);
  assert.equal(client.config.pendingScopes[scope],true);
  assert.equal(client.dirty,true);
  assert.equal(applied.length,0);
});

test('required checkpoint failure propagates before any incoming profile save', () => {
  const state = {shoppingList:[{name:'Local milk'}]};
  let saves = 0;
  const app = loadFunctions(['applyHouseholdSnapshot'],{
    state,applyingRemoteSync:false,currentView:'home',console,
    profileStore:{createSafetyBackup(reason,options){assert.equal(options.required,true);throw new Error('Storage quota exceeded');},saveCombinedState(){saves++;}}
  });
  assert.throws(() => app.applyHouseholdSnapshot({'shopping-list':{shoppingList:[]}}),/quota/i);
  assert.equal(state.shoppingList[0].name,'Local milk');
  assert.equal(saves,0);
});

test('expired-session edits are queued and uploaded before a reconnect download', async () => {
  const {client,applied} = syncHarness();
  client.config.expiresAt = '2000-01-01T00:00:00Z';
  client.markDirty();
  assert.equal(client.dirty,true);
  assert.equal(Object.keys(client.config.pendingScopes).length,1);
  client.config.expiresAt = new Date(Date.now()+60000).toISOString();
  let serverList = [{name:'Old server list'}];
  client.fetchCollection = async name => ({cursor:9,events:name==='shopping-list'?[{id:'shared-state',revision:9,payload:{shoppingList:serverList}}]:[]});
  let writes=0; client.pushCollection=async (name,payload) => {writes++;if(name==='shopping-list')serverList=copy(payload.shoppingList);};
  await client.syncNow(() => ({recipes:{personalRecipes:[]},'shopping-list':{shoppingList:[{name:'Strawberry cream cheese'}]}}));
  assert.equal(writes,3);
  assert.equal(applied[0]['shopping-list'].shoppingList[0].name,'Strawberry cream cheese');
});
test('a profile bound to a household cannot mix its pending changes into another household',()=>{
 const {client}=syncHarness();
 client.config.households.push({id:'other'});
 client.config.profileHouseholds[client.bindingKey()]='h';
 assert.throws(()=>client.selectHousehold('other'),/separate local profile/i);
 assert.equal(client.config.activeHouseholdId,'h');
});
