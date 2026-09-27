const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../sync-client.js'), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
function harness() {
  const values = new Map(), applied = [], timers = new Map(); let timerId = 0;
  const context = { window:{}, URL, console,
    localStorage:{ getItem:key => values.get(key) || null, setItem:(key, value) => values.set(key, value) },
    fetch:async () => { throw new Error('Unexpected network request'); },
    setTimeout:(fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout:id => timers.delete(id), setInterval:() => ++timerId, clearInterval:() => {} };
  vm.runInNewContext(source, context);
  const client = new context.window.SKHouseholdSync({ profileId:'profile-1', onRemoteState:(data, options) => applied.push({ data:copy(data), options }) });
  Object.assign(client.config, { token:'fixture-token', expiresAt:new Date(Date.now() + 60000).toISOString(),
    user:{ id:'user-1' }, households:[{ id:'house-1', role:'owner' }], activeHouseholdId:'house-1', profileId:'profile-1', recipeOwnershipMigrationComplete:true });
  client.ownershipMigrationPending = false; client.start = () => {};
  return { client, applied, timers };
}
const snapshot = { 'shopping-list':{ shoppingList:[{ id:'milk', name:'Milk' }] }, pantry:{ pantryItems:[] },
  recipes:{ personalRecipes:[{ id:'r1', name:'Soup' }] }, 'meal-plans':{ mealPlans:{} } };
function ready(client) { client.config.initializedHouseholds[client.initializationKey()] = true; }

test('stale recipe edits keep a conflict copy without force-retrying the newer revision', async () => {
  const { client, applied } = harness(); const writes = [];
  client.request = async (url, options) => {
    if (options.method === 'GET') return {events:[],cursor:0};
    const operation = JSON.parse(options.body).changes[0]; writes.push(operation);
    throw Object.assign(new Error('Conflict'), {status:409,body:{conflicts:[{id:operation.id,mutationId:operation.mutationId,current:{version:'a'.repeat(64),payload:{id:'r1',name:'New soup'}}}]}});
  };
  await client.pushCollection('recipes', snapshot.recipes);
  assert.equal(writes.length, 1); assert.equal(writes[0].baseVersion, null);
  const recipes = applied[0].data.recipes.ownerRecords[0].personalRecipes;
  assert.equal(recipes.find(r=>r.id==='r1').name, 'New soup');
  assert.equal(recipes.find(r=>r.conflictOf==='r1').name, 'Soup (conflict copy)');
});

test('ownership migration keeps local personal recipes and separates other members', () => {
  const {loadFunctions} = require('./helpers/app-functions.cjs');
  const personal = {recipes:[{id:'sheree-local',name:'Local recipe'}]}, state={householdRecipes:{}};
  const app = loadFunctions(['applyHouseholdSnapshot'], {
    state,applyingRemoteSync:false,currentView:'home',
    profileStore:{createSafetyBackup(){},createAutomaticRecoverySnapshot:()=>Promise.resolve(),saveCombinedState(){}},
    householdSync:{summary:()=>({user:{id:'sheree'}})},ensurePersonalModule:()=>personal,
    migrateState(){},refreshAll(){},console
  });
  app.applyHouseholdSnapshot({recipes:{ownerRecords:[
    {ownerUserId:'randy',personalRecipes:[{id:'randy-recipe'}]},
    {ownerUserId:'sheree',personalRecipes:[]}
  ]}},{ownershipMigration:true});
  assert.deepEqual(personal.recipes,[{id:'sheree-local',name:'Local recipe'}]);
  assert.deepEqual(copy(state.householdRecipes.randy.recipes),[{id:'randy-recipe'}]);
});
test('first download applies the household copy before marking the profile ready', async () => {
  const { client, applied } = harness();
  const remote = { ...snapshot, recipes:{ ownerRecords:[{ id:'owner:user-1', personalRecipes:snapshot.recipes.personalRecipes }] } };
  client.remoteSnapshot = async () => ({ snapshot:remote, hasData:true });
  await client.initialize('download', snapshot);
  assert.deepEqual(applied[0].data, remote); assert.equal(applied[0].options.initial, true); assert.equal(client.isReady(), true);
});
test('first upload cannot replace an existing household; empty download stays uninitialized', async () => {
  const { client } = harness(); let pushes = 0;
  client.pushCollection = async () => { pushes++; };
  client.remoteSnapshot = async () => ({ snapshot, hasData:true });
  await assert.rejects(client.initialize('upload', snapshot), /already contains data/);
  assert.equal(pushes, 0); assert.equal(client.isReady(), false);
  client.remoteSnapshot = async () => ({ snapshot:{}, hasData:false });
  await assert.rejects(client.initialize('download', snapshot), /does not contain/);
  assert.equal(client.isReady(), false);
});
test('first upload writes all four collections and only then enables sync', async () => {
  const { client } = harness(), pushed = [];
  client.remoteSnapshot = async () => ({ snapshot:{}, hasData:false });
  client.pushCollection = async (collection, payload) => {
    assert.equal(client.isReady(), false); pushed.push({ collection, payload:copy(payload) });
  };
  await client.initialize('upload', snapshot);
  assert.deepEqual(pushed.map(item => item.collection), Object.keys(snapshot));
  assert.deepEqual(pushed.map(item => item.payload), Object.values(snapshot)); assert.equal(client.isReady(), true);
});
test('uninitialized and unrelated profiles cannot queue writes', () => {
  const { client, timers } = harness(); client.markDirty(); assert.equal(client.dirty, false);
  ready(client); client.profileId = 'another-profile'; client.markDirty();
  assert.equal(client.dirty, false); assert.equal(timers.size, 0);
});
test('edits during upload remain queued and are not overwritten by a pull', async () => {
  const { client, timers } = harness(); ready(client); client.markDirty();
  let pushes = 0, pulls = 0; client.recipeSync.sync = async () => true;
  client.pushCollection = async () => { if (++pushes === 1) client.markDirty(); };
  client.pullUpdates = async () => { pulls++; };
  await client.syncNow(() => snapshot);
  assert.equal(client.dirty, true); assert.equal(pulls, 0);
  assert.ok([...timers.values()].some(timer => timer.delay >= 100));
  await client.syncNow(() => snapshot);
  assert.equal(client.dirty, false); assert.equal(pulls, 1); assert.equal(pushes, 6);
});
test('local edits during download defer remote apply and cursor advancement', async () => {
  const { client, applied } = harness(); ready(client);
  client.config.cursors[client.key('shopping-list')] = 4; let requests = 0;
  client.fetchCollection = async () => {
    if (++requests === 1) client.markDirty();
    return { cursor:9, events:[{ id:'shared-state', revision:2, payload:{ shoppingList:[{ name:'Old milk' }] } }] };
  };
  await client.pullUpdates();
  assert.equal(applied.length, 0); assert.equal(client.config.cursors[client.key('shopping-list')], 4); assert.equal(client.dirty, true);
});
test('failed remote application does not consume downloaded changes', async () => {
  const { client } = harness(); ready(client);
  client.fetchCollection = async () => ({ cursor:9, events:[{ id:'shared-state', revision:2, payload:{} }] });
  client.onRemoteState = () => { throw new Error('Storage full'); };
  await assert.rejects(client.pullUpdates(), /Storage full/);
  assert.equal(client.config.cursors[client.key('shopping-list')], undefined);
});
test('recipe writes carry per-recipe revisions and never advance a read cursor from an acknowledgement', async () => {
  const { client } = harness(); let sent;
  client.request = async (url, options) => {
    if(options.method==='GET')return {events:[],cursor:0};
    sent=JSON.parse(options.body).changes[0]; return {applied:[{id:sent.id,mutationId:sent.mutationId,version:'b'.repeat(64)}]};
  };
  await client.pushCollection('recipes', snapshot.recipes);
  assert.equal(sent.id, 'r1'); assert.equal(sent.baseVersion, null);
  assert.equal(sent.ownerUserId, undefined); // Ownership comes from authentication.
  assert.equal(client.recipeSync.data.versions.r1, 'b'.repeat(64));
  assert.equal(client.recipeSync.data.cursor, 0);
});

test('network failure retains queued changes without a rapid retry loop', async () => {
  const { client, timers } = harness(); ready(client); client.markDirty(); timers.clear();
  client.pushCollection = async () => { throw new Error('Offline'); };
  await assert.rejects(client.syncNow(() => snapshot), /Offline/);
  assert.equal(client.dirty, true); assert.equal(client.syncing, false);
  assert.ok([...timers.values()].every(timer => timer.delay >= 5000));
});
