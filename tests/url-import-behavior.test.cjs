const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../url-recipe-import.js'),'utf8');
function harness(t) {
  const dom = new JSDOM('', {url:'https://example.test/',runScripts:'outside-only'});
  dom.window.eval(source); t.after(() => dom.window.close());
  return dom.window.KCUrlRecipeImport;
}
const jsonPage = value => '<script type="application/ld+json">'+JSON.stringify(value)+'</script>';
const recipe = { '@type':'https://schema.org/Recipe', name:'Bread &amp; Butter', recipeIngredient:['&frac12; cup milk','2 cups flour'],
  recipeInstructions:'<p>Mix ingredients.</p><p>Bake for 20 minutes.</p>', nutrition:{calories:'240 kcal',proteinContent:'6 g'} };

test('structured import preserves fractions, HTML step boundaries, source nutrition and attribution', t => {
  const importer = harness(t), parsed = importer.parseHtml(jsonPage(recipe),'https://example.test/bread');
  assert.equal(parsed.name,'Bread & Butter'); assert.equal(parsed.ingredients[0],'½ cup milk');
  assert.deepEqual([...parsed.instructions],['Mix ingredients.','Bake for 20 minutes.']);
  assert.equal(parsed.nutrition,'Calories: 240 kcal\nProtein: 6 g'); assert.equal(parsed.nutritionMeta.source,'source');
  assert.match(parsed.notes,/Imported from https:\/\/example.test\/bread/);
});

test('complete JSON-LD is preferred over a less detailed visible card', t => {
  const importer=harness(t);
  const parsed=importer.parseHtml(jsonPage(recipe)+'<div class="tasty-recipes"><h2 class="tasty-recipes-title">Other title</h2><div class="tasty-recipes-ingredients"><ul><li>milk</li><li>flour</li><li>water</li></ul></div><div class="tasty-recipes-instructions"><p>Mix.</p></div></div>');
  assert.equal(parsed.name,'Bread & Butter'); assert.equal(parsed.ingredients[0],'½ cup milk');
});

test('microdata fallback excludes author names and does not repeat nested instruction properties', t => {
  const importer=harness(t);
  const html=`<div itemscope itemtype="https://schema.org/Recipe">
    <span itemprop="author" itemscope itemtype="https://schema.org/Person"><span itemprop="name">A Cook</span></span>
    <h1 itemprop="name">Soup</h1><meta itemprop="prepTime" content="PT10M">
    <div itemprop="recipeIngredient">1 <span>cup</span> peas</div>
    <div itemprop="recipeInstructions"><ol><li><span itemprop="text">Simmer.</span></li><li>Serve.</li></ol></div>
    <div itemprop="nutrition" itemscope><span itemprop="calories">100 kcal</span></div></div>`;
  const parsed=importer.parseHtml(jsonPage({'@type':'Recipe',name:'Incomplete'})+html);
  assert.equal(parsed.name,'Soup'); assert.equal(parsed.prepTime,'10 minutes'); assert.equal(parsed.ingredients[0],'1 cup peas');
  assert.deepEqual([...parsed.instructions],['Simmer.','Serve.']); assert.equal(parsed.nutrition,'Calories: 100 kcal');
});

test('WordPress Recipe Maker cards import without structured JSON and ignore surrounding advertising', t => {
  const importer=harness(t);
  const parsed=importer.parseHtml(`<aside>Buy our pans!</aside><div class="wprm-recipe-container"><h2 class="wprm-recipe-name">Pancakes</h2>
    <div class="wprm-recipe-ingredient"><span>1½</span><span>cups</span><span>flour</span></div>
    <div class="wprm-recipe-instruction-text">Mix gently.</div><div class="wprm-recipe-instruction-text">Cook until golden.</div>
    <div class="wprm-recipe-notes">Do not overmix.</div></div>`);
  assert.equal(parsed.ingredients[0],'1½ cups flour'); assert.deepEqual([...parsed.instructions],['Mix gently.','Cook until golden.']);
  assert.match(parsed.notes,/Do not overmix/); assert.doesNotMatch(JSON.stringify(parsed),/Buy our pans/);
});

test('Tasty Recipes cards import with separate steps; unsupported or incomplete pages do not fabricate recipes', t => {
  const importer=harness(t);
  const parsed=importer.parseHtml('<div class="tasty-recipes"><h2 class="tasty-recipes-title">Toast</h2><div class="tasty-recipes-ingredients"><ul><li>1 slice bread</li></ul></div><div class="tasty-recipes-instructions"><p>Toast the bread.</p><p>Serve warm.</p></div></div>');
  assert.deepEqual([...parsed.instructions],['Toast the bread.','Serve warm.']);
  assert.throws(()=>importer.parseHtml('<h1>Recipe ideas</h1><p>Subscribe to read more.</p>'),/does not contain supported Recipe data/);
  assert.throws(()=>importer.parseHtml('<div class="wprm-recipe-container"><h2 class="wprm-recipe-name">Incomplete</h2></div>'),/does not contain supported Recipe data/);
});

test('signed-in URL imports use the server first and never contact the recipe site from the browser', async t => {
  const importer=harness(t); let calls=0;
  const result=await importer.fetchPage('https://example.test/original',{sync:{isSignedIn:()=>true,importRecipePage:async url=>{calls++;assert.equal(url,'https://example.test/original');return {html:'recipe',finalUrl:'https://example.test/final'};}},
    fetcher:async()=>{throw new Error('Browser fetch must not run');}});
  assert.equal(calls,1); assert.equal(result.finalUrl,'https://example.test/final');
});

test('server errors stay actionable without retrying a blocked page from the browser', async t => {
  const importer=harness(t);
  for(const [status,message] of [[401,/Sign in again/],[429,/Wait a moment/],[404,/unavailable/]]) {
    await assert.rejects(importer.fetchPage('https://example.test/',{sync:{isSignedIn:()=>true,importRecipePage:async()=>{throw Object.assign(new Error('failure'),{status});}},fetcher:async()=>{throw new Error('unexpected fallback');}}),message);
  }
  await assert.rejects(importer.fetchPage('https://example.test/',{sync:{isSignedIn:()=>true,importRecipePage:async()=>({html:''})}}),/empty page/);
});

test('signed-out direct import sends no credentials and explains how to use the server when blocked', async t => {
  const importer=harness(t);
  const result=await importer.fetchPage('https://example.test/',{fetcher:async(url,options)=>{assert.equal(options.credentials,'omit');assert.ok(options.signal);return {ok:true,text:async()=>'<html>recipe</html>',url};}});
  assert.equal(result.html,'<html>recipe</html>');
  await assert.rejects(importer.fetchPage('https://example.test/',{fetcher:async()=>{throw new TypeError('CORS');}}),/Sign in to use server recipe importing/);
});
