const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console, Date, Math };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'meal-planner.js'), 'utf8'), context);
const planner = context.KCMealPlanner;

assert.deepEqual(Array.from(planner.MEAL_PARTS.breakfast), ['main','side1']);
assert.deepEqual(Array.from(planner.MEAL_PARTS.lunch), ['main','side1']);
assert.deepEqual(Array.from(planner.MEAL_PARTS.dinner), ['main','side1','side2']);
assert.deepEqual(Array.from(planner.MEAL_PARTS.snack), ['main']);

const template = {};
for (let day = 0; day < 7; day += 1) template[planner.templateKey(day, 'lunch')] = 'eat-out';
const plan = planner.createPlan('2026-07-27', template);
assert.equal(Object.keys(plan.slots).length, 56, 'a full week should contain every main and side slot');
for (let day = 0; day < 7; day += 1) {
  assert.equal(plan.slots[planner.slotKey(day, 'lunch', 'main')].kind, 'eat-out');
  assert.equal(plan.slots[planner.slotKey(day, 'lunch', 'side1')].kind, 'eat-out');
}

const recipes = [
  { key:'test:breakfast', name:'Breakfast Eggs', category:'Breakfast' },
  { key:'test:dinner', name:'Roast Chicken', category:'Dinner' },
  { key:'test:side', name:'Roasted Potatoes', category:'Side Dish' },
  { key:'test:never', name:'Dinner Never', category:'Dinner' }
];
const preferences = {
  'test:breakfast':{ frequency:'often', mealTypes:['breakfast'] },
  'test:dinner':{ frequency:'often', mealTypes:['dinner'] },
  'test:side':{ frequency:'often', mealTypes:['side'] },
  'test:never':{ frequency:'never', mealTypes:['dinner'] }
};
const empty = planner.createPlan('2026-07-27');
empty.slots[planner.slotKey(0, 'breakfast', 'main')] = {
  kind:'recipe', recipeKey:'test:breakfast', source:'manual', locked:true, scale:1
};
const generated = planner.generate(empty, recipes, { preferences }, { rng:() => 0 });
assert.equal(generated.slots[planner.slotKey(0, 'breakfast', 'main')].recipeKey, 'test:breakfast', 'manual choices must be preserved');
assert.equal(generated.slots[planner.slotKey(0, 'dinner', 'main')].recipeKey, 'test:dinner');
assert.equal(generated.slots[planner.slotKey(0, 'dinner', 'side1')].recipeKey, 'test:side');
assert.equal(generated.slots[planner.slotKey(0, 'dinner', 'side2')].recipeKey, 'test:side');
assert.ok(!Object.values(generated.slots).some(slot => slot.recipeKey === 'test:never'), 'never recipes must not be randomly selected');

assert.deepEqual(
  Array.from(planner.recipePreference(recipes[0], { 'test:breakfast':{ frequency:'weekly', mealTypes:[] } }).mealTypes),
  [],
  'clearing every placement must keep a recipe out of random generation'
);

console.log('Meal planner regression passed: seven-day mains, side slots, defaults, manual locks, and weighted exclusions work.');
