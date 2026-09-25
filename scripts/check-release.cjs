const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const version = JSON.parse(read('package.json')).version;
assert.equal(read('app.js').match(/const ENGINE_VERSION = '([^']+)'/)[1], version, 'App version');
assert.equal(JSON.parse(read('app.webmanifest')).version, version, 'Manifest version');
assert.equal(read('profile-storage.js').match(/const APP_VERSION = '([^']+)'/)[1], version, 'Checkpoint version');
assert.equal(read('service-worker.js').match(/const CACHE_NAME = 'serenity-kitchen-v([^']+)'/)[1], version, 'Offline cache version');
for (const file of ['index.html', 'service-worker.js', 'app.js']) {
  for (const match of read(file).matchAll(/\?v=([\d.]+)/g)) assert.equal(match[1], version, `${file} asset version`);
}
for (const match of read('index.html').matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)) {
  if (/^(?:https?:|#|mailto:|data:)/.test(match[1])) continue;
  assert.ok(fs.existsSync(path.join(root, match[1])), `Missing app asset: ${match[1]}`);
}
for (const file of fs.readdirSync(root).filter(name => name.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding:'utf8' });
  assert.equal(result.status, 0, `${file}: ${result.stderr}`);
}
console.log(`Release ${version}: versions, asset references and JavaScript syntax pass.`);
