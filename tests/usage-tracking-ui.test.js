const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(html, /id="usageTrackingDialog"/);
assert.match(html, /id="usageExpectedDays"/);
assert.match(html, /id="usageSuggestionsMuted"/);
assert.match(html, /id="usagePurchaseHistory"/);
assert.match(html, /usage-tracking[.]js/);
assert.match(app, /function recordRegularPurchase/);
assert.match(app, /if\(e[.]target[.]checked&&!item[.]checked\)recordRegularPurchase\(item\)/);
assert.match(app, /function usagePurchasesFor/);
assert.match(app, /`lot:\$\{lot[.]id\}`/);
assert.match(app, /function syncPantryLotPurchase/);
assert.match(app, /purchases:\[\.\.\.lotHistory,\.\.\.existingTracking[.]purchases\]/);
assert.match(app, /function openUsageTracking/);
assert.match(app, /Keep \$\{analysis[.]tracking[.]expectedIntervalDays\} days and stop suggestions/);
assert.match(app, /SKUsageTracking[.]normalizeTracking\(item[.]usageTracking/);
assert.match(serviceWorker, /usage-tracking[.]js/);

console.log('Usage tracking UI regression passed: pantry lots, regular purchases, interval controls, history safeguards, and recommendation choices are wired.');
