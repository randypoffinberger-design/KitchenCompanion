const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const watermark = fs.readFileSync(path.join(root, 'sk-watermark.svg'), 'utf8');

assert.match(styles, /--tiffany:#167b75/);
assert.match(styles, /--tiffany:#81d8d0/);
assert.match(styles, /--header-height:60px/);
assert.match(styles, /body:not\([.]home-view\)::before/);
assert.match(styles, /env\(safe-area-inset-top\)/);
assert.match(styles, /prefers-reduced-motion:reduce/);
assert.match(styles, /[.]page-heading-icon/);
assert.match(styles, /[.]filter-chip[.]active/);
assert.match(html, /id="shoppingPageSummary"/);
assert.match(html, /id="pantryPageSummary"/);
assert.match(html, /class="more-actions"/);
assert.match(html, /class="line-icon"/);
assert.doesNotMatch(html, /⏱/);
assert.doesNotMatch(app, /🔒|🔓/);
assert.match(app, /function uiIcon/);
assert.match(app, /meal-locked/);
assert.match(app, /activeFilterCount/);
assert.ok(
  app.indexOf("const ratingSort = els.ratingSort?.value || 'name'") < app.indexOf('const activeFilterCount='),
  'Recipe sort must be initialized before the active-filter summary reads it.'
);
assert.match(worker, /sk-watermark[.]svg/);
assert.match(watermark, /<svg/);
assert.match(watermark, /serenity-kitchen-icon-1024[.]png/);
assert.match(watermark, /approved-sk-symbol/);
assert.doesNotMatch(watermark, /circle|M95 295/);

console.log('Interior design-system regression passed: shared themes, watermark, headings, compact filters/actions, safe areas, line icons, and planner lock styling are wired.');
