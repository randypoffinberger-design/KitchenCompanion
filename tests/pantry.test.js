const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const storage = fs.readFileSync(path.join(root, 'profile-storage.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.match(html, /data-view="pantry"/);
assert.match(html, /id="addManyPantryItemsBtn"/);
assert.match(html, /id="pantryBulkDelete"/);
assert.match(html, /id="movePurchasedToPantryBtn"/);
assert.match(app, /id="usePantryIngredientsBtn"/);
assert.match(app, /function movePurchasedToPantry/);
assert.match(app, /function addBulkPantryItems/);
assert.match(app, /function deleteSelectedPantryItems/);
assert.match(app, /function checkPantryRestock/);
assert.match(app, /source:'Pantry restock'/);
assert.match(app, /function confirmUsePantryIngredients/);
assert.match(app, /state[.]pantryItems=state[.]pantryItems[.]filter/);
assert.match(storage, /pantryItems: \[\]/);
assert.match(storage, /pantryItems: clone\(this[.]activeProfile[.]pantryItems/);
assert.match(styles, /[.]pantry-row\{/);

console.log('Pantry regression passed: local inventory, bulk entry/removal, shopping transfer, recipe use, restocking, and profile persistence are wired.');
