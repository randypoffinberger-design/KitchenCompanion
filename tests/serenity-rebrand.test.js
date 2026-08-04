const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const app = read('app.js');
const profile = read('profile-storage.js');
const manifest = JSON.parse(read('app.webmanifest'));
const worker = read('service-worker.js');

assert.equal(manifest.name, 'Serenity Kitchen');
assert.equal(manifest.version, '0.20.6');
assert.match(html, /Serenity Kitchen by Serenity Valley Works|<strong>Serenity Kitchen<\/strong>[\s\S]*by Serenity Valley Works/);
assert.match(app, /Serenity-Kitchen-Backup-/);
assert.match(app, /[.]skbackup/);
assert.match(app, /format:'kitchen-companion-backup'/);
assert.match(app, /payload[.]format !== 'kitchen-companion-backup'/);
assert.match(profile, /kitchenCompanion[.]/);
assert.match(worker, /serenity-kitchen-home[.]jpeg/);
assert.match(worker, /serenity-kitchen-icon-1024[.]png/);
assert.match(app, /if \(els[.]moduleCount\) els[.]moduleCount[.]textContent/);
assert.match(app, /starterModule[.]publisher === 'Kitchen Companion'/);
assert.match(app, /starterModule[.]publisher = 'Serenity Kitchen'/);
for (const asset of ['serenity-kitchen-home.jpeg', 'serenity-kitchen-icon-1024.png', 'icon-180.png', 'icon-192.png', 'icon-512.png']) {
  assert.ok(fs.statSync(path.join(root, asset)).size > 1000, `${asset} should be packaged`);
}

console.log('Serenity Kitchen rebrand regression passed: visible identity changed while legacy formats and storage compatibility remain intact.');
