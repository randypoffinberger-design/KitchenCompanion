const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FixtureDOMParser {
  parseFromString(html) {
    const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .map(match => ({ textContent:match[1] }));
    const headings = [...html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>\s*<([a-z0-9]+)[^>]*>([\s\S]*?)<\/\3>/gi)]
      .map(match => ({
        textContent:match[2],
        nextElementSibling:{ tagName:match[3].toUpperCase(), textContent:match[4], nextElementSibling:null }
      }));
    return {
      querySelectorAll:selector => selector === 'script[type="application/ld+json"]'
        ? scripts
        : selector === 'h1,h2,h3,h4,h5,h6' ? headings : []
    };
  }
}

const context = { DOMParser:FixtureDOMParser };
context.globalThis = context;
vm.runInNewContext(
  fs.readFileSync(path.resolve(__dirname, '..', 'url-recipe-import.js'), 'utf8'),
  context
);

const html = `<!doctype html><script type="application/ld+json">${JSON.stringify({
  '@context':'https://schema.org',
  '@graph':[
    { '@type':'WebPage', name:'Example' },
    {
      '@type':['Recipe', 'NewsArticle'],
      name:'Sunday Biscuits',
      description:'Tender biscuits.',
      prepTime:'P0Y0M0DT0H15M0.000S',
      cookTime:'PT20M',
      totalTime:'P0Y0M0DT0H35M0.000S',
      recipeYield:['8 biscuits'],
      recipeCategory:'side-dish',
      recipeDifficulty:'Easy',
      author:{ '@type':'Person', name:'Example Cook' },
      keywords:'breakfast, southern',
      recipeIngredient:['2 cups flour', '1 cup buttermilk'],
      recipeInstructions:[
        { '@type':'HowToSection', name:'Mix', itemListElement:[
          { '@type':'HowToStep', text:'Whisk the dry ingredients.' },
          { '@type':'HowToStep', text:'Fold in the buttermilk.' }
        ]},
        { '@type':'HowToStep', text:'Bake until golden.' }
      ]
    }
  ]
})}</script><h2>Cook’s Note</h2><p>Keep the butter cold for flaky biscuits.</p>`;

const parsed = context.KCUrlRecipeImport.parseHtml(html, 'https://example.test/biscuits');
assert.equal(parsed.name, 'Sunday Biscuits');
assert.equal(parsed.prepTime, '15 minutes');
assert.equal(parsed.cookTime, '20 minutes');
assert.equal(parsed.yieldText, '8 biscuits');
assert.equal(parsed.category, 'Side Dishes');
assert.deepEqual([...parsed.ingredients], ['2 cups flour', '1 cup buttermilk']);
assert.deepEqual([...parsed.instructions], ['[Mix]', 'Whisk the dry ingredients.', 'Fold in the buttermilk.', 'Bake until golden.']);
assert.deepEqual([...parsed.tags], ['breakfast', 'southern', 'Easy']);
assert.match(parsed.notes, /Recipe by Example Cook[.]/);
assert.match(parsed.notes, /Total time: 35 minutes[.]/);
assert.match(parsed.notes, /Cook's Note: Keep the butter cold/);
assert.match(parsed.notes, /https:\/\/example[.]test\/biscuits/);
assert.equal(context.KCUrlRecipeImport.duration('P0Y0M0DT0H20M0.000S'), '20 minutes');
assert.equal(context.KCUrlRecipeImport.duration('P1DT2H3M4.5S'), '1 day 2 hours 3 minutes 4.5 seconds');

assert.throws(
  () => context.KCUrlRecipeImport.parseHtml('<html><title>No recipe</title></html>'),
  /does not contain supported Recipe data/
);

console.log('URL recipe import regression passed: nested JSON-LD normalized for review.');
