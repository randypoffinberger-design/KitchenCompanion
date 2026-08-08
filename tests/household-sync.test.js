const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sync = fs.readFileSync(path.join(root, 'sync-client.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const profiles = fs.readFileSync(path.join(root, 'profile-storage.js'), 'utf8');

for (const id of ['cloudAccountDialog','cloudServerUrl','cloudEmail','cloudPassword','cloudHouseholdSelect','cloudUploadFirstBtn','cloudDownloadFirstBtn','cloudSyncNowBtn','cloudRefreshBtn']) {
  assert.match(html, new RegExp(`id="${id}"`));
}
assert.match(html, /sync-client[.]js[?]v=0[.]21[.]3/);
assert.match(worker, /sync-client[.]js[?]v=0[.]21[.]3/);
assert.match(sync, /shopping-list/);
assert.match(sync, /pantry/);
assert.match(sync, /recipes/);
assert.match(sync, /meal-plans/);
assert.match(sync, /mutationId/);
assert.match(sync, /baseRevision/);
assert.match(sync, /setInterval\(run, 5000\)/);
assert.match(sync, /async downloadLatest\(\)/);
assert.match(sync, /this[.]changeSequence \+= 1/);
assert.match(sync, /if \(this[.]changeSequence === pushingSequence\) this[.]dirty = false/);
assert.match(app, /createSafetyBackup\('before-household-download'/);
assert.match(app, /Downloaded \$\{recipes\} personal recipes/);
assert.match(styles, /#cloudFirstSync\[hidden\].*display:none!important/);
assert.match(profiles, /active profile record is missing; recovery is required/);
assert.match(profiles, /recoverOrphanedProfileMetadata/);
assert.match(app, /if \(householdSyncChangesEnabled && !applyingRemoteSync\) householdSync[?][.]markDirty\(\)/);
assert.match(app, /householdSync[.]start\(buildHouseholdSnapshot\);\s*householdSyncChangesEnabled = true/);
assert.doesNotMatch(app, /state[.]modules\s*=\s*snapshot/);

console.log('Household sync regression passed: authenticated setup, guarded first copy, four collections, live polling, and offline caching are wired.');
