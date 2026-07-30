const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

const standardDialogs = [...html.matchAll(/<dialog id="([^"]+)"(?![^>]*guided-cooking-dialog)[^>]*>/g)]
  .map(match => match[1]);

assert.ok(standardDialogs.includes('recipeCreateDialog'));
assert.ok(standardDialogs.includes('recipeEditorDialog'));
assert.ok(standardDialogs.includes('pasteRecipeDialog'));
assert.ok(standardDialogs.includes('urlRecipeDialog'));
assert.ok(standardDialogs.includes('imageRecipeDialog'));
assert.match(css, /dialog:not\([.]guided-cooking-dialog\)\{[^}]*max-width:calc\(100vw - 1rem\)/s);
assert.match(css, /dialog:not\([.]guided-cooking-dialog\)>[.]dialog-card\{[^}]*overflow-x:hidden/s);
assert.match(css, /dialog:not\([.]guided-cooking-dialog\)>[.]dialog-card\{[^}]*touch-action:pan-y/s);
assert.match(css, /dialog input,dialog select,dialog textarea\{font-size:16px\}/);
assert.match(css, /button, input, select, textarea \{ font: inherit; \}/);

console.log(`Dialog mobile UI regression passed: ${standardDialogs.length} standard dialogs stay centered and avoid iOS focus zoom.`);
