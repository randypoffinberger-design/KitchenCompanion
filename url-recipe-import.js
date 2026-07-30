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
    const match = raw.match(/^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
    if (!match) return text(raw);
    const parts = [];
    const add = (amount, unit) => {
      const number = +amount;
      if (number) parts.push(`${number} ${unit}${number === 1 ? '' : 's'}`);
    };
    add(match[1], 'year');
    add(match[2], 'month');
    add(match[3], 'day');
    add(match[4], 'hour');
    add(match[5], 'minute');
    add(match[6], 'second');
    return parts.join(' ');
  }

  function category(value) {
    const raw = text(value);
    if (!raw) return '';
    const spaced = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const key = spaced.toLowerCase();
    const canonical = {
      appetizer: 'Appetizers',
      appetizers: 'Appetizers',
      bread: 'Breads',
      breads: 'Breads',
      breakfast: 'Breakfast',
      dessert: 'Desserts',
      desserts: 'Desserts',
      drink: 'Drinks',
      drinks: 'Drinks',
      entree: 'Main Course',
      entrees: 'Main Course',
      'main course': 'Main Course',
      salad: 'Salads',
      salads: 'Salads',
      'side dish': 'Side Dishes',
      'side dishes': 'Side Dishes',
      soup: 'Soups',
      soups: 'Soups'
    };
    return canonical[key] || spaced.replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function extractCookNote(document) {
    const headingPattern = /^cook(?:'|’)?s?\s+notes?[:\s]*$/i;
    const headings = document?.querySelectorAll?.('h1,h2,h3,h4,h5,h6') || [];
    for (const heading of headings) {
      if (!headingPattern.test(text(heading.textContent))) continue;
      let candidate = heading.nextElementSibling || heading.parentElement?.nextElementSibling;
      const collected = [];
      while (candidate && collected.join(' ').length < 2000) {
        if (/^H[1-6]$/i.test(candidate.tagName || '')) break;
        const value = text(candidate.textContent);
        if (value) collected.push(value);
        candidate = candidate.nextElementSibling;
      }
      if (collected.length) return collected.join('\n');
    }
    return '';
  }

  function normalizeRecipe(recipe, sourceUrl = '', supplementalCookNote = '') {
    const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [recipe.recipeIngredient])
      .map(text).filter(Boolean);
    const instructions = instructionLines(recipe.recipeInstructions);
    if (!text(recipe.name) || !ingredients.length || !instructions.length) {
      throw new Error('The page’s recipe data is incomplete. A title, ingredients, and instructions are required.');
    }
    const keywords = Array.isArray(recipe.keywords)
      ? recipe.keywords.map(text)
      : String(recipe.keywords || '').split(',');
    const difficulty = text(recipe.recipeDifficulty);
    const tags = keywords.map(text).filter(Boolean);
    if (difficulty && !tags.some(tag => tag.toLowerCase() === difficulty.toLowerCase())) tags.push(difficulty);
    const noteParts = [];
    const author = text(recipe.author);
    if (author) noteParts.push(`Recipe by ${author}.`);
    const totalTime = duration(recipe.totalTime);
    if (totalTime) noteParts.push(`Total time: ${totalTime}.`);
    const cookNote = text(supplementalCookNote || recipe.cookNote);
    if (cookNote) noteParts.push(`Cook's Note: ${cookNote}`);
    if (sourceUrl) noteParts.push(`Imported from ${sourceUrl}`);
    return {
      name: text(recipe.name),
      description: text(recipe.description),
      notes: noteParts.join('\n\n'),
      prepTime: duration(recipe.prepTime),
      cookTime: duration(recipe.cookTime),
      yieldText: text(recipe.recipeYield),
      category: category(recipe.recipeCategory),
      tags,
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
    const cookNote = extractCookNote(document);
    for (const recipe of ranked) {
      try { return normalizeRecipe(recipe, sourceUrl, cookNote); }
      catch (error) { lastError = error; }
    }
    throw lastError || new Error('No complete recipe was found on this page.');
  }

  globalThis.KCUrlRecipeImport = { parseHtml, normalizeRecipe, duration, category, extractCookNote, findRecipes };
})();
