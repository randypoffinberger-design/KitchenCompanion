const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const profiles = fs.readFileSync(path.join(root, 'profile-storage.js'), 'utf8');

assert.match(html, /id="alarmToneSelect"/);
for (const tone of ['bell', 'digital', 'chime', 'gentle', 'urgent']) {
  assert.match(html, new RegExp(`<option value="${tone}">`));
  assert.match(app, new RegExp(`${tone}: \\{`));
}
assert.match(html, /Preview plays three alarm cycles/);
assert.match(app, /startAlarmPlayback\('preview', 3\)/);
assert.match(app, /startAlarmPlayback\('timer', Infinity\)/);
assert.match(app, /alarmPlaybackMode === 'preview'/);
assert.match(app, /Dismiss the active timer alarm before previewing another tone/);
assert.match(profiles, /alarmTone:'bell'/);

console.log('Alarm tone regression passed: five profile-saved tones, three-cycle preview, and continuous real alarms are wired.');
