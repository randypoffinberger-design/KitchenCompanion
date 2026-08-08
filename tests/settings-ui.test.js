const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.equal((html.match(/class="settings-section"/g) || []).length, 9);
assert.match(html, /class="settings-section" open>\s*<summary>App and updates/);
assert.match(html, /aria-label="Close settings"/);
assert.match(html, /id="guidedVoiceSelect"/);
assert.match(html, /id="guidedSpeechRate"/);
assert.match(html, /id="guidedSpeechPitch"/);
assert.match(html, /id="previewGuidedVoiceBtn"/);
assert.match(html, /Account and household sharing/);
assert.match(html, /id="manageCloudAccountBtn"/);
assert.match(app, /function populateSpeechVoices\(\)/);
assert.match(app, /function configuredSpeechUtterance\(text\)/);
assert.match(app, /utterance[.]voice = voice/);
assert.match(css, /touch-action:pan-y/);
assert.match(css, /overflow-x:hidden/);
assert.match(css, /[.]settings-sticky-header\{position:sticky/);

console.log('Settings UI regression passed: collapsible sections, sticky close, vertical scroll lock, and voice controls are present.');
