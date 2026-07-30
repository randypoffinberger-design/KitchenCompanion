const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const profiles = fs.readFileSync(path.join(root, 'profile-storage.js'), 'utf8');

assert.match(html, /data-view="meal-planner"/);
assert.match(html, /id="mealPlannerPane"/);
assert.match(html, /id="mealSlotDialog"/);
assert.match(html, /id="mealPlannerPreferencesDialog"/);
assert.match(html, /id="mealShoppingDialog"/);
assert.match(app, /KCMealPlanner\.MEAL_PARTS\[meal\]/);
assert.match(html, /Side dishes are included with their meal/);
assert.match(worker, /meal-planner[.]js[?]v=0[.]17[.]2/);
assert.match(profiles, /mealPlans/);
assert.match(profiles, /mealPlannerPreferences/);
assert.match(profiles, /mealPlanHistory/);

console.log('Meal planner UI regression passed: navigation, dialogs, side-aware shopping, offline shell, and profile storage are wired.');
