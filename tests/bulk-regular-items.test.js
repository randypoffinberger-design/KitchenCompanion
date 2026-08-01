const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.match(html, /id="shoppingBulkRegular"/);
assert.match(html, /id="shoppingActionStatus"/);
assert.match(app, /shoppingBulkRegular'\)\?\.addEventListener\('click', saveSelectedShoppingAsRegular\)/);
assert.match(app, /function saveSelectedShoppingAsRegular/);
assert.match(app, /state[.]shoppingList[.]filter\(item => shoppingSelectedIds[.]has\(item[.]id\)\)/);
assert.match(app, /upsertRegularItem\(\{/);
assert.match(app, /quantity:quantities[.]join\(' \+ '\)/);
assert.match(app, /They remain on this shopping list/);
assert.match(styles, /#shoppingBulkMove,#shoppingBulkRegular,#shoppingBulkDelete\{grid-column:span 2/);
assert.match(html, /class="regular-items-sticky-header"/);
assert.match(html, /id="closeRegularItems"[^>]+aria-label="Close regular items"/);
assert.match(app, /closeRegularItems'\)\?\.addEventListener\('click', \(\) => els[.]regularItemsDialog[.]close\(\)\)/);
assert.match(styles, /[.]regular-items-sticky-header\{[\s\S]*?position:sticky/);

console.log('Bulk regular-items regression passed: selected shopping items become reusable staples and the regular-items close control remains visible.');
