const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.match(html, /id="guidedCookingDialog"/);
assert.match(html, /id="guidedPrevious"/);
assert.match(html, /id="guidedSpeak"/);
assert.match(html, /id="guidedNext"/);
assert.match(html, /id="guidedSpeechEnabled"/);
assert.match(app, /SpeechSynthesisUtterance/);
assert.match(app, /guidedCookingProgress/);
assert.match(app, /renderInstructionWithTimers\(step, guidedRecipe, guidedStepIndex\)/);
assert.match(app, /delete state[.]guidedCookingProgress\[guidedRecipe[.]key\]/);
assert.match(app, /function persistGuidedProgress\(\)/);
assert.match(app, /Guided cooking is working, but this step could not be saved for later/);
assert.match(app, /dialog[.]showModal\(\);\s*try \{/);
assert.match(css, /height:100dvh/);

console.log('Guided cooking regression passed: navigation, speech, timers, resume state, and mobile layout are present.');
