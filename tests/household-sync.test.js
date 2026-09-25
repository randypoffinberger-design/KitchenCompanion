const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const html = read('index.html'), app = read('app.js'), profiles = read('profile-storage.js');
for (const id of ['cloudAccountDialog','cloudServerUrl','cloudEmail','cloudPassword','cloudHouseholdSelect',
  'cloudUploadFirstBtn','cloudDownloadFirstBtn','cloudSyncNowBtn']) assert.ok(html.includes('id="'+id+'"'), id);
for (const mode of ['upload', 'download']) assert.ok(app.includes("initializeCloudHousehold('"+mode+"')"));
assert.ok(app.includes('householdSync.initialize(mode,buildHouseholdSnapshot())'));
assert.ok(app.includes("createSafetyBackup(options.initial ? 'before-household-download'"));
assert.ok(profiles.includes('Startup was stopped before a blank profile could replace it.'));
assert.ok(profiles.includes('recoverLatestValidCheckpoint'));
assert.ok(app.includes('if (householdSyncChangesEnabled && !applyingRemoteSync) householdSync?.markDirty()'));
assert.match(app, /householdSync[.]start\(buildHouseholdSnapshot\);\s*householdSyncChangesEnabled = true/);
assert.doesNotMatch(app, /state[.]modules\s*=\s*snapshot/);
console.log('Household UI: explicit first-copy controls, safety checkpoint and guarded local writes are wired.');
