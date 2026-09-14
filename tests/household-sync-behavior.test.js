const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const values = new Map();
const localStorage = {
  getItem:key => values.has(key) ? values.get(key) : null,
  setItem:(key, value) => values.set(key, String(value)),
  removeItem:key => values.delete(key)
};
const context = { window:{}, location:{ origin:'http://127.0.0.1:8789' }, localStorage, fetch:async () => { throw new Error('Unexpected network request'); }, URL, setInterval, clearInterval, setTimeout, clearTimeout, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', 'sync-client.js'), 'utf8'), context);

(async () => {
  let applied = null;
  const client = new context.window.SKHouseholdSync({ profileId:'profile-randy', onRemoteState:snapshot => { applied = snapshot; } });
  client.config.token = 'token';
  client.config.expiresAt = new Date(Date.now() + 60_000).toISOString();
  client.config.households = [{ id:'household-1', name:'Test', role:'owner' }];
  client.config.activeHouseholdId = 'household-1';
  client.config.profileId = 'profile-randy';
  const snapshot = { recipes:{ ownerRecords:[{ id:'owner:user-1', ownerUserId:'user-1', personalRecipes:[{ id:'recipe-1' }] }] }, 'shopping-list':{ shoppingList:[] }, pantry:{ pantryItems:[] }, 'meal-plans':{ mealPlans:{} } };
  client.remoteSnapshot = async () => ({ snapshot, hasData:true });
  client.start = () => {};

  await client.initialize('download', {});
  assert.equal(applied.recipes.ownerRecords[0].personalRecipes[0].id, 'recipe-1');
  assert.equal(client.summary().initialized, true);

  client.syncing = true;
  client.markDirty();
  assert.equal(client.dirty, true);
  assert.equal(client.changeGeneration, 1);
  client.stop();
  console.log('Household sync behavior passed: guarded download initializes the profile and edits remain queued during active requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
