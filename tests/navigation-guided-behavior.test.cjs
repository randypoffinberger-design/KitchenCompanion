const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFunctions } = require('./helpers/app-functions.cjs');

test('Home clears recipe navigation and filters and opens the home screen', () => {
  let opened = 0;
  const els = Object.fromEntries(['searchInput','moduleFilter','categoryFilter','ratingFilter','ratingSort'].map(key => [key,{value:'old'}]));
  const h = loadFunctions(['goHome'], { els, currentView:'shopping', selectedCategory:'Soup', recipeNavigationStack:['r1'], recipeReturnView:'meal-planner',
    closeShoppingMoreActions(){}, document:{querySelectorAll:() => []}, closeProfileQuickMenu(){}, toggleSidebar(){}, syncFavoriteFilterButton(){}, showHome(){opened++;} });
  h.goHome(); assert.equal(h.currentView, 'home'); assert.equal(h.selectedCategory, null);
  assert.equal(h.recipeNavigationStack.length, 0); assert.equal(els.searchInput.value, '');
  assert.equal(els.moduleFilter.value, 'all'); assert.equal(els.ratingSort.value, 'name'); assert.equal(opened, 1);
});

test('Back restores recipe-list scroll again after asynchronous cards finish rendering', () => {
  let rendered, scrolls = [], frames = [];
  const els = Object.fromEntries(['homePane','listPane','detailPane','modulesPane','shoppingPane','pantryPane','mealPlannerPane'].map(key => [key, {hidden:false}]));
  const h = loadFunctions(['showList'], { els, recipeNavigationStack:[], recipeReturnView:'list', selectedRecipeKey:'r1', recipeListScrollPosition:730,
    setHomeScreen(){}, updateWakeLock(){}, renderRecipeList:options => { rendered = options; },
    window:{scrollTo:options => scrolls.push(options.top), requestAnimationFrame:fn => frames.push(fn)} });
  h.showList({restoreScroll:true}); assert.equal(els.listPane.hidden, false); assert.equal(els.detailPane.hidden, true);
  frames[0](); assert.deepEqual(scrolls, [730]); rendered.onComplete(); assert.deepEqual(scrolls, [730,730]);
  assert.equal(h.recipeListScrollPosition, 730);
});

test('Guided cooking skips section headings, preserves timer step identity and saves progress', () => {
  const fields = new Map(), timerCalls = []; let saved = 0;
  const field = id => { if (!fields.has(id)) fields.set(id,{querySelectorAll:() => []}); return fields.get(id); };
  const recipe = {key:'r1', name:'Soup', instructions:['[Sauce]','Simmer 10 minutes.','Serve.']};
  const h = loadFunctions(['renderGuidedCooking'], { guidedRecipe:recipe, guidedStepIndex:1, state:{guidedCookingProgress:{}},
    document:{querySelector:field}, instructionEntries:() => [{type:'heading',text:'Sauce'}, {type:'step',number:1,section:'Sauce',text:'Simmer 10 minutes.'}, {type:'step',number:2,section:'Sauce',text:'Serve.'}],
    renderInstructionWithTimers:(text, value, index) => {timerCalls.push({text,index}); return text;}, persistGuidedProgress:() => {saved++;} });
  h.renderGuidedCooking(); assert.deepEqual(timerCalls,[{text:'Serve.',index:1}]);
  assert.equal(field('#guidedStepProgress').textContent,'Step 2 of 2'); assert.equal(field('#guidedNext').textContent,'Finish ✓');
  assert.equal(h.state.guidedCookingProgress.r1.stepIndex,1); assert.equal(saved,1);
});

test('Guided cooking stays usable when saving progress fails', () => {
  const status = {textContent:''};
  const h = loadFunctions(['persistGuidedProgress'], { document:{querySelector:() => status},
    saveState:() => {throw new Error('Quota exceeded');}, console:{warn(){}} });
  assert.equal(h.persistGuidedProgress(),false); assert.match(status.textContent,/working, but this step could not be saved/);
});
