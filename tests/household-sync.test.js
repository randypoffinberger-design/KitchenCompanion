const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sync = fs.readFileSync(path.join(root, 'sync-client.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

for (const id of ['cloudAccountDialog','cloudServerUrl','cloudEmail','cloudPassword','cloudHouseholdSelect','cloudUploadFirstBtn','cloudDownloadFirstBtn','cloudSyncNowBtn']) {
  assert.match(html, new RegExp(`id="${id}"`));
}
assert.match(html, /sync-client[.]js[?]v=0[.]21[.]1/);
assert.match(worker, /sync-client[.]js[?]v=0[.]21[.]1/);
assert.match(sync, /shopping-list/);
assert.match(sync, /pantry/);
assert.match(sync, /recipes/);
assert.match(sync, /meal-plans/);
assert.match(sync, /mutationId/);
assert.match(sync, /baseRevision/);
assert.match(sync, /setInterval\(run, 5000\)/);
assert.match(app, /createSafetyBackup\('before-household-download'/);
assert.match(app, /if \(!applyingRemoteSync\) householdSync[?][.]markDirty\(\)/);
assert.doesNotMatch(app, /state[.]modules\s*=\s*snapshot/);

console.log('Household sync regression passed: authenticated setup, guarded first copy, four collections, live polling, and offline caching are wired.');
