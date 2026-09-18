const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function section(start,end){return source.slice(source.indexOf('  function '+start),source.indexOf('  function '+end));}
function harness(){
 let time=0,frames=[],cards=[],opened=0,pantryChecks=0;
 const element=()=>({hidden:false,value:'all',textContent:'',innerHTML:'',listeners:{},classList:{toggle(){}},setAttribute(){},insertAdjacentHTML(){},append(){},addEventListener(k,fn){this.listeners[k]=fn;}});
 const els=Object.fromEntries(['listPane','searchInput','moduleFilter','categoryFilter','ratingSort','ratingFilter','viewTitle','viewSubtitle','clearFiltersBtn','emptyState'].map(k=>[k,element()]));
 els.searchInput.value='';els.ratingSort.value='name';
 els.recipeGrid={setAttribute(){},set innerHTML(v){cards=[];},append(batch){cards.push(...batch.children);}};
 const document={querySelectorAll:()=>[],documentElement:{scrollTop:0},createElement:element,
   createDocumentFragment:()=>({children:[],append(fragment){this.children.push(fragment);}}),
   querySelector:()=>({content:{cloneNode(){const fields={};return {querySelector(key){return fields[key]??=element();}};}}})};
 const context={els,document,performance:{now:()=>time,timeOrigin:1000000000000},
  window:{requestAnimationFrame:fn=>frames.push(fn),scrollY:0},currentView:'all',selectedCategory:null,selectedRecipeKey:null,
  recipeListRenderVersion:0,recipeNavigationStack:[],recipeReturnView:'list',recipeListScrollPosition:0,activeScale:1,
  state:{favorites:[],pantryItems:[]},getAllRecipes:()=>Array.from({length:1000},(_,i)=>({key:'r'+i,name:String(i).padStart(4,'0')})),
  engine:{filterRecipes:(recipes,{query})=>recipes.filter(r=>r.name.includes(query))},
  buildPantryReadinessIndex:()=>new Map(),recipePantryReadiness:()=>{pantryChecks++;return 'red';},pantryReadinessMarker:()=>'',
  recipeRatingValue:()=>0,recipeRatingRecord:()=>null,uiIcon:()=>'',ratingStars:()=>'',
  toggleFavoriteFromList:()=>{context.state.favorites.push('changed');},showDetail:()=>{opened++;}};
 vm.createContext(context);vm.runInContext(section('renderRecipeList(', 'recipeSearchText('),context);
 return {context,els,get cards(){return cards;},get opened(){return opened;},get checks(){return pantryChecks;},
  frame(){time+=16;const batch=frames;frames=[];batch.forEach(fn=>fn());},
  finish(){for(let i=0;i<100&&frames.length;i++)this.frame();assert.equal(frames.length,0);}};
}
test('large libraries yield before building cards and bound each frame',()=>{
 const h=harness();h.context.renderRecipeList();assert.equal(h.cards.length,0);assert.equal(h.checks,0);
 h.frame();assert.equal(h.cards.length,24);assert.equal(h.checks,24);
 h.finish();assert.equal(h.cards.length,1000);assert.equal(h.checks,1000);
});
test('obsolete batches cannot append after filters change or navigation hides the list',()=>{
 const h=harness();h.context.renderRecipeList();h.frame();
 h.els.searchInput.value='0999';h.context.renderRecipeList();h.finish();assert.equal(h.cards.length,1);
 assert.equal(h.cards[0].querySelector('.recipe-name').textContent,'0999');
 h.els.searchInput.value='';h.context.renderRecipeList();h.els.listPane.hidden=true;h.finish();assert.equal(h.cards.length,0);
});
test('queued taps and early pointer gestures are rejected; fresh taps and keyboard still work',()=>{
 const h=harness();h.context.renderRecipeList();h.frame();const card=h.cards[0].querySelector('.recipe-card');
 card.listeners.click({timeStamp:1});assert.equal(h.opened,0);h.finish();
 const favorite=h.cards[0].querySelector('.recipe-favorite');favorite.listeners.click({timeStamp:1,stopPropagation(){}});assert.equal(h.context.state.favorites.length,0);
 card.listeners.pointerdown({timeStamp:1});card.listeners.click({timeStamp:99999});assert.equal(h.opened,0);
 card.listeners.click({timeStamp:99999});assert.equal(h.opened,1);
 card.listeners.keydown({key:'Enter',timeStamp:99999,preventDefault(){}});assert.equal(h.opened,2);
});
test('completion callback runs only for the current render',()=>{
 const h=harness();let old=0,current=0;h.context.renderRecipeList({onComplete:()=>old++});
 h.context.renderRecipeList({onComplete:()=>current++});h.finish();assert.equal(old,0);assert.equal(current,1);
});
