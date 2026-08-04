const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const watermarkPath = path.join(root, 'sk-watermark.png');

assert.match(styles, /--tiffany:#167b75/);
assert.match(styles, /--tiffany:#81d8d0/);
assert.match(styles, /--header-height:60px/);
assert.match(styles, /body:not\([.]home-view\)::before/);
assert.match(styles, /opacity:[.]055/);
assert.match(styles, /--watermark-color:#81d8d0;opacity:[.]08/);
assert.match(styles, /env\(safe-area-inset-top\)/);
assert.match(styles, /prefers-reduced-motion:reduce/);
assert.match(styles, /[.]page-heading-icon/);
assert.match(styles, /[.]filter-chip[.]active/);
assert.match(html, /id="shoppingPageSummary"/);
assert.match(html, /id="pantryPageSummary"/);
assert.match(html, /class="more-actions"/);
assert.match(html, /class="line-icon"/);
assert.match(html, /id="timersBtn"[^>]*hidden/);
assert.doesNotMatch(html, /⏱/);
assert.doesNotMatch(app, /🔒|🔓/);
assert.match(app, /function uiIcon/);
assert.match(app, /meal-locked/);
assert.match(app, /activeFilterCount/);
assert.match(app, /els[.]timersBtn[.]hidden=state[.]timers[.]length===0/);
assert.ok(
  app.indexOf("const ratingSort = els.ratingSort?.value || 'name'") < app.indexOf('const activeFilterCount='),
  'Recipe sort must be initialized before the active-filter summary reads it.'
);
assert.match(worker, /sk-watermark[.]png/);
assert.ok(fs.existsSync(watermarkPath));
assert.ok(fs.statSync(watermarkPath).size > 10000);
assert.match(styles, /[.]sidebar\{position:fixed;inset:/);
assert.match(styles, /[.]profile-quick-menu\s*\{\s*position:fixed;\s*left:max\(10px, env\(safe-area-inset-left\)\);\s*right:max\(10px, env\(safe-area-inset-right\)\)/);
assert.doesNotMatch(styles, /[.]app-shell,[.]main,[.]sidebar,[.]topbar\{position:relative\}/);

console.log('Interior design-system regression passed: shared themes, watermark, headings, compact filters/actions, safe areas, line icons, and planner lock styling are wired.');
