const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const errors = [];
const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {url:'https://example.test/KitchenCompanion/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w = dom.window;
w.scrollTo = () => {}; w.matchMedia = () => ({matches:false,addEventListener(){}});
w.HTMLDialogElement.prototype.showModal = function(){this.open=true;};
w.HTMLDialogElement.prototype.close = function(){this.open=false;};
w.Audio = class { load(){} pause(){} play(){return Promise.resolve();} addEventListener(){} };
w.alert = message => {throw new Error('Unexpected alert: '+message);}; w.confirm = () => false;
w.fetch = async () => {throw new Error('Unexpected external request');};
for (const file of ['kitchen-engine.js','recipe-scaling.js','profile-storage.js','url-recipe-import.js','meal-planner.js','sync-client.js','password-ui.js']) w.eval(fs.readFileSync(path.join(root,file),'utf8'));
// Seed a disposable kitchen through the real storage API, not a production account.
const store = new w.KCProfileStore();
if(store.needsStorageRecovery()) store.initializeFreshBrowserStorage();
w.eval(fs.readFileSync(path.join(root,'app.js'),'utf8'));
setTimeout(async () => {
  try {
    assert.equal(w.document.querySelector('#storageRecoveryBlocker'), null);
    assert.equal(w.document.querySelector('#homePane').hidden, false);
    assert.equal(w.document.querySelector('#engineVersionLabel').textContent, JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version);
    assert.equal(w.document.querySelector('.startup-recovery-notice'), null);
    assert.deepEqual(errors, []);
    let imported=0;
    w.SKHouseholdSync.prototype.isSignedIn=()=>true;
    w.SKHouseholdSync.prototype.importRecipePage=async()=>{imported++;return {html:'<script type="application/ld+json">'+JSON.stringify({'@type':'Recipe',name:'Fixture soup',recipeIngredient:['½ cup peas'],recipeInstructions:['Simmer.'],nutrition:{calories:'100 kcal'}})+'</script>',finalUrl:'https://recipe.example/soup'};};
    w.document.querySelector('#recipeUrl').value='https://recipe.example/soup';
    w.document.querySelector('#recipeUrl').closest('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal(imported,1);assert.equal(w.document.querySelector('#recipeEditorDialog').open,true);
    assert.equal(w.document.querySelector('#editName').value,'Fixture soup');
    assert.match(w.document.querySelector('#editIngredients').value,/½ cup peas/);
    assert.match(w.document.querySelector('#editNutrition').value,/100 kcal/);
    assert.match(w.document.querySelector('#editNotes').value,/https:\/\/recipe.example\/soup/);
    const stored = new w.KCProfileStore().loadActiveState();
    assert.equal(stored.modules.flatMap(m=>m.recipes||[]).some(r=>r.name==='Fixture soup'),false);
    assert.deepEqual(errors, []);
    console.log('Full app startup and server-import review passed; imported recipe is not saved before confirmation.');
  } finally {w.close();}
},100);
