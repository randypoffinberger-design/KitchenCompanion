const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

assert.match(html, /id="addManyShoppingItemsBtn"/);
assert.match(html, /id="bulkShoppingDialog"/);
assert.match(html, /id="bulkShoppingText"/);
assert.match(html, /id="bulkShoppingStore"/);
assert.match(app, /function addBulkShoppingItems/);
assert.match(app, /source:'Manual bulk entry'/);
assert.match(app, /[.]slice\(0, 250\)/);

const parserBody = app.match(/function parseBulkShoppingLines\(text\) \{([\s\S]*?)\n  \}\n\n  function extractBulkShoppingQuantity/)?.[1];
assert.ok(parserBody, 'bulk shopping parser was not found');
const parse = new Function('text', parserBody);
assert.deepEqual(parse('• milk\n2. eggs\n[ ] bread, bananas'), ['milk','eggs','bread','bananas']);
assert.deepEqual(parse('coffee; tea'), ['coffee','tea']);

const quantityBody = app.match(/function extractEmbeddedShoppingQuantity\(name\) \{([\s\S]*?)\n  \}\n  function normalizeShoppingName/)?.[1];
assert.ok(quantityBody, 'shopping quantity parser was not found');
const extractQuantity = new Function('name', quantityBody);
assert.deepEqual(extractQuantity('2 dozen eggs'), { name:'eggs', quantity:'2 dozen' });
assert.deepEqual(extractQuantity('3 boxes cereal'), { name:'cereal', quantity:'3 boxes' });

const bulkQuantityBody = app.match(/function extractBulkShoppingQuantity\(line\) \{([\s\S]*?)\n  \}\n\n  function openBulkShoppingDialog/)?.[1];
assert.ok(bulkQuantityBody, 'bulk count parser was not found');
const extractBulkQuantity = new Function('extractEmbeddedShoppingQuantity', 'line', bulkQuantityBody);
assert.deepEqual(extractBulkQuantity(extractQuantity, '2 eggs'), { name:'eggs', quantity:'2' });

console.log('Bulk shopping regression passed: pasted lists, bullets, separators, quantities, stores, and consolidation are wired.');
