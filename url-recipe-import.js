(() => {
  'use strict';

  function text(value) {
    if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
    if (value && typeof value === 'object') return text(value.name || value.text || value['@value']);
    return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function types(node) {
    return (Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']])
      .map(value => String(value || '').toLowerCase());
  }

  function findRecipes(value, found = []) {
    if (!value || typeof value !== 'object') return found;
    if (types(value).includes('recipe')) found.push(value);
    if (Array.isArray(value)) value.forEach(item => findRecipes(item, found));
    else Object.values(value).forEach(item => findRecipes(item, found));
    return found;
  }

  function instructionLines(value, lines = [], section = '') {
    if (!value) return lines;
    if (typeof value === 'string') {
      value.split(/\r?\n+/).map(text).filter(Boolean).forEach(line => lines.push(line));
      return lines;
    }
    if (Array.isArray(value)) {
      value.forEach(item => instructionLines(item, lines, section));
      return lines;
    }
    const kind = types(value);
    if (kind.includes('howtosection')) {
      const name = text(value.name);
      if (name) lines.push(`[${name}]`);
      instructionLines(value.itemListElement || value.steps, lines, name);
      return lines;
    }
    const line = text(value.text || value.name);
    if (line) lines.push(line);
    else instructionLines(value.itemListElement || value.steps, lines, section);
    return lines;
  }

  function duration(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
    if (!match) return text(raw);
    const parts = [];
    if (+match[1]) parts.push(`${+match[1]} day${+match[1] === 1 ? '' : 's'}`);
    if (+match[2]) parts.push(`${+match[2]} hour${+match[2] === 1 ? '' : 's'}`);
    if (+match[3]) parts.push(`${+match[3]} minute${+match[3] === 1 ? '' : 's'}`);
    if (+match[4]) parts.push(`${+match[4]} second${+match[4] === 1 ? '' : 's'}`);
    return parts.join(' ');
  }

  function normalizeRecipe(recipe, sourceUrl = '') {
    const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [recipe.recipeIngredient])
      .map(text).filter(Boolean);
    const instructions = instructionLines(recipe.recipeInstructions);
    if (!text(recipe.name) || !ingredients.length || !instructions.length) {
      throw new Error('The page’s recipe data is incomplete. A title, ingredients, and instructions are required.');
    }
    const keywords = Array.isArray(recipe.keywords)
      ? recipe.keywords.map(text)
      : String(recipe.keywords || '').split(',');
    return {
      name: text(recipe.name),
      description: text(recipe.description),
      notes: sourceUrl ? `Imported from ${sourceUrl}` : '',
      prepTime: duration(recipe.prepTime),
      cookTime: duration(recipe.cookTime),
      yieldText: text(recipe.recipeYield),
      category: text(recipe.recipeCategory),
      tags: keywords.map(text).filter(Boolean),
      ingredients,
      instructions
    };
  }

  function parseHtml(html, sourceUrl = '') {
    if (typeof DOMParser === 'undefined') throw new Error('This browser cannot read recipe page data.');
    const document = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const recipes = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try { findRecipes(JSON.parse(script.textContent), recipes); }
      catch { /* Ignore unrelated or malformed metadata blocks. */ }
    });
    if (!recipes.length) throw new Error('This page does not contain supported Recipe data.');
    const ranked = recipes.sort((a, b) =>
      ((b.recipeIngredient?.length || 0) + (b.recipeInstructions?.length || 0))
      - ((a.recipeIngredient?.length || 0) + (a.recipeInstructions?.length || 0)));
    let lastError;
    for (const recipe of ranked) {
      try { return normalizeRecipe(recipe, sourceUrl); }
      catch (error) { lastError = error; }
    }
    throw lastError || new Error('No complete recipe was found on this page.');
  }

  globalThis.KCUrlRecipeImport = { parseHtml, normalizeRecipe, duration, findRecipes };
})();
