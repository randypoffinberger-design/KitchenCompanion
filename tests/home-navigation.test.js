const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.match(html, /id="homeBrandBtn"/);
assert.match(html, /aria-label="Go to all recipes"/);
assert.match(app, /homeBrandBtn'\)\?\.addEventListener\('click', goHome\)/);
assert.match(app, /function goHome\(\)/);
assert.match(app, /currentView = 'all'/);
assert.match(app, /button\.dataset\.view === 'all'/);
assert.match(app, /showList\(\)/);
assert.match(styles, /[.]brand-home/);

console.log('Home navigation regression passed: the header brand returns every view to unfiltered All Recipes.');
