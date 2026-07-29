const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadEngine() {
  const context = { globalThis: {} };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'kitchen-engine.js'), 'utf8'), context);
  return new context.KitchenCompanionEngine();
}

function loadOcrTextTools() {
  const element = () => ({
    addEventListener() {},
    remove() {},
    files: [],
    dataset: {},
    value: '',
    textContent: '',
    hidden: false
  });
  const context = {
    console,
    globalThis: {},
    document: {
      querySelector: () => element(),
      createElement: () => element(),
      head: { append() {} }
    },
    window: { addEventListener() {}, setTimeout, clearTimeout },
    navigator: { clipboard: { writeText: async () => {} } },
    alert() {},
    prompt() {}
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'ocr-service.js'), 'utf8'), context);
  return context.__KitchenCompanionOcrTest;
}

const engine = loadEngine();
const ocr = loadOcrTextTools();

const noisySouthernBiscuits = `RECIPE COURTESY OF ALTON
BROWN
Southern Biscuits
Rate
Yield: 1 dozen Prep: 20 min Cook: 15 min
Ingredients
Deselect All
2 cups flour
4 teaspoons baking powder
1/4 cup shortening
3/4 cup milk
Directions
1.
Preheat oven to 450°F.
2. Cut the shortening into dry ingredients until mixture
(about the size of peas).
3. Add milk and stir until combined. 4. Turn dough onto a floured surface and knead briefly.
5. Cut biscuits and place on a baking sheet.
6. Bake until golden brown.`;

const cleaned = ocr.cleanRecipeText(noisySouthernBiscuits);
assert.doesNotMatch(cleaned, /courtesy|^BROWN$|deselect all|^1[.]?$/im);
assert.match(cleaned, /^Southern Biscuits$/m);
assert.match(cleaned, /^Prep: 20 min$/m);
assert.match(cleaned, /^Cook: 15 min$/m);

const parsed = engine.parseRecipeText(cleaned);
assert.equal(parsed.name, 'Southern Biscuits');
assert.equal(parsed.yieldText, '1 dozen');
assert.equal(parsed.prepTime, '20 min');
assert.equal(parsed.cookTime, '15 min');
assert.doesNotMatch(parsed.description, /\bBROWN\b/);
assert.ok(parsed.ingredients.includes('2 cups flour'));
assert.ok(!parsed.ingredients.some(line => /deselect/i.test(line)));
assert.ok(parsed.instructions.some(step => /shortening into dry ingredients until mixture \(about the size of peas\)/i.test(step)));
assert.ok(parsed.instructions.some(step => /^Add milk/i.test(step)));
assert.ok(parsed.instructions.some(step => /^Turn dough/i.test(step)));
assert.ok(parsed.instructions.some(step => /^Bake until golden brown/i.test(step)));
assert.ok(parsed.instructions.every(step => !/^\d+[.)]\s*/.test(step)));

const merged = ocr.combinePages([
  `Directions\nCut the shortening into dry ingredients until mixture`,
  `Directions\nCut the shortening into dry ingredients until mixture resembles coarse crumbs.`
]);
assert.match(merged, /mixture resembles coarse crumbs/);
assert.doesNotMatch(merged, /mixture\n/);

const clutterVariants = [
  'Deselect All', 'Select All', 'Copy Ingredients', 'Add to Shopping List',
  'ADVERTISEMENT', 'Open in App', 'View Comments', 'Photo by Example Studio'
];
const metadataVariants = [
  'Yield: 1 dozen Prep: 20 min Cook: 15 min',
  'Makes: 1 dozen Preparation: 20 min Cooking: 15 min',
  'Servings: 12 Active time: 20 min Cook time: 15 min'
];
let simulatedScans = 0;
for (let index = 0; index < 240; index++) {
  const clutter = clutterVariants[index % clutterVariants.length];
  const metadata = metadataVariants[index % metadataVariants.length];
  const detached = index % 2 ? '1.\nPreheat oven to 450°F.' : '1) Preheat oven to 450°F.';
  const sample = `Recipe courtesy of Test Kitchen\nAUTHOR\nSouthern Biscuits\n${clutter}\n${metadata}\nIngredients\n2 cups flour\n4 teaspoons baking powder\n1/4 cup shortening\n3/4 cup milk\nDirections\n${detached}\n2. Cut the shortening into dry ingredients until mixture.\n3. Add milk and stir. 4. Turn dough onto a floured surface.\n5. Bake until golden brown.`;
  const candidate = engine.parseRecipeText(ocr.cleanRecipeText(sample));
  assert.equal(candidate.name, 'Southern Biscuits');
  assert.ok(candidate.prepTime);
  assert.ok(candidate.cookTime);
  assert.ok(!candidate.ingredients.some(line => /select|copy|shopping|advertisement|comments|photo/i.test(line)));
  assert.ok(candidate.instructions.some(step => /^Turn dough/i.test(step)));
  simulatedScans++;
}

console.log(`OCR regression passed: Southern Biscuits known answer plus ${simulatedScans} simulated webpage scans.`);
