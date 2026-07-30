const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const profiles = fs.readFileSync(path.join(root, 'profile-storage.js'), 'utf8');

assert.match(html, /data-view="meal-planner"/);
assert.match(html, /id="mealPlannerPane"/);
assert.match(html, /id="mealSlotDialog"/);
assert.match(html, /id="mealPlannerPreferencesDialog"/);
assert.match(html, /id="mealShoppingDialog"/);
assert.match(app, /KCMealPlanner\.MEAL_PARTS\[meal\]/);
assert.match(app, /data-meal-open-recipe/);
assert.match(app, /data-meal-change/);
assert.match(app, /function openPlannedRecipe/);
assert.match(app, /recipeReturnView === 'meal-planner'/);
assert.match(app, /function pruneUnusedMealPlans/);
assert.match(app, /offset < -4 \|\| offset > 12/);
assert.match(app, /if \(plan\.slots\[key\]\?\.locked\) return/);
assert.match(app, /slotKeys:eligibleKeys/);
assert.match(app, /Locked choices were preserved/);
assert.match(html, /Side dishes are included with their meal/);
assert.match(worker, /meal-planner[.]js[?]v=0[.]17[.]4[.]1/);
assert.match(profiles, /mealPlans/);
assert.match(profiles, /mealPlannerPreferences/);
assert.match(profiles, /mealPlanHistory/);
assert.match(styles, /@media\(max-width:600px\)\{[\s\S]*[.]meal-part\{grid-template-columns:minmax\(0,1fr\)/);
assert.match(styles, /[.]meal-part-actions\{display:grid;grid-template-columns:2[.]25rem minmax\(4[.]4rem,1fr\) repeat\(3,2[.]25rem\)/);

console.log('Meal planner UI regression passed: navigation, mobile control stacking, side-aware shopping, offline shell, and profile storage are wired.');
