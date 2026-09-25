(() => {
  'use strict';

  function text(value) {
    if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
    if (value && typeof value === 'object') return text(value.name || value.text || value['@value']);
    let raw = String(value ?? '');
    if (typeof document !== 'undefined' && document.createElement) {
      const decoder = document.createElement('textarea');
      decoder.innerHTML = raw.replace(/<[^>]*>/g, ' ');
      raw = decoder.value;
    }
    return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function types(node) {
    return (Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']])
      .map(value => String(value || '').toLowerCase().replace(/^https?:\/\/schema.org\//, ''));
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
      value.replace(/<br\s*\/?\s*>|<\/(?:p|li|div)>/gi, '\n').split(/\r?\n+/).map(text).filter(Boolean).forEach(line => lines.push(line));
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
    if (line) instructionLines(value.text || value.name, lines, section);
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
      instructions,
      nutrition: nutritionText(recipe.nutrition),
      nutritionMeta: recipe.nutrition ? { source:'source' } : undefined
    };
  }

  function nutritionText(value) {
    if (!value || typeof value !== 'object') return text(value);
    const fields = { servingSize:'Serving size', calories:'Calories', fatContent:'Fat', saturatedFatContent:'Saturated fat',
      unsaturatedFatContent:'Unsaturated fat', transFatContent:'Trans fat', cholesterolContent:'Cholesterol', sodiumContent:'Sodium',
      carbohydrateContent:'Carbohydrates', fiberContent:'Fiber', sugarContent:'Sugar', proteinContent:'Protein' };
    return Object.entries(fields).filter(([key]) => text(value[key])).map(([key, label]) => `${label}: ${text(value[key])}`).join('\n');
  }

  function readRecipeCards(page) {
    const roots = page.querySelectorAll('[itemtype~="https://schema.org/Recipe"], [itemtype~="http://schema.org/Recipe"], .wprm-recipe-container, .tasty-recipes');
    const value = node => node ? text(node.getAttribute('content') || node.getAttribute('datetime') || node.innerHTML || node.textContent) : '';
    const result = [];
    for (const root of roots) {
      const one = selectors => value(root.querySelector(selectors));
      const title = root.querySelector('.wprm-recipe-name, .tasty-recipes-title') ||
        [...root.querySelectorAll('[itemprop~="name"]')].find(node => !node.closest('[itemscope]') || node.closest('[itemscope]') === root);
      const many = selectors => [...root.querySelectorAll(selectors)].map(value).filter(Boolean);
      const recipe = {
        '@type':'Recipe',
        name:value(title),
        description:one('[itemprop~="description"], .wprm-recipe-summary, .tasty-recipes-description'),
        recipeIngredient:many('[itemprop~="recipeIngredient"], .wprm-recipe-ingredient, .tasty-recipes-ingredients li'),
        recipeInstructions:[],
        recipeYield:one('[itemprop~="recipeYield"], .wprm-recipe-servings-container, .tasty-recipes-yield'),
        prepTime:one('[itemprop~="prepTime"], .wprm-recipe-prep_time-container, .tasty-recipes-prep-time'),
        cookTime:one('[itemprop~="cookTime"], .wprm-recipe-cook_time-container, .tasty-recipes-cook-time'),
        totalTime:one('[itemprop~="totalTime"]'),
        author:one('[itemprop~="author"], .wprm-recipe-author, .tasty-recipes-author-name'),
        cookNote:one('.wprm-recipe-notes, .tasty-recipes-notes'),
        nutrition:{}
      };
      const steps = root.querySelectorAll('[itemprop~="recipeInstructions"], .wprm-recipe-instruction-text, .tasty-recipes-instructions');
      for (const step of steps) {
        // Some microdata wraps every step in one property; others repeat the
        // property per step. Do not add nested properties twice.
        if ([...steps].some(other => other !== step && other.contains(step))) continue;
        const children = step.querySelectorAll('li, [itemprop~="text"]');
        if (children.length) {
          for (const child of children) {
            if ([...children].some(other => other !== child && other.contains(child))) continue;
            if (value(child)) recipe.recipeInstructions.push(value(child));
          }
        } else recipe.recipeInstructions.push(...instructionLines(step.innerHTML || step.textContent));
      }
      const nutrition = root.querySelector('[itemprop~="nutrition"]');
      if (nutrition) for (const field of nutrition.querySelectorAll('[itemprop]')) recipe.nutrition[field.getAttribute('itemprop')] = value(field);
      if (!Object.keys(recipe.nutrition).length) recipe.nutrition = one('.wprm-nutrition-label-container, .tasty-recipes-nutrition');
      if (recipe.name && recipe.recipeIngredient.length && recipe.recipeInstructions.length) result.push(recipe);
    }
    return result;
  }

  function parseHtml(html, sourceUrl = '') {
    if (typeof DOMParser === 'undefined') throw new Error('This browser cannot read recipe page data.');
    const document = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const recipes = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try { findRecipes(JSON.parse(script.textContent), recipes); }
      catch { /* Ignore unrelated or malformed metadata blocks. */ }
    });
    const ranked = recipes.sort((a, b) =>
      ((b.recipeIngredient?.length || 0) + (b.recipeInstructions?.length || 0))
      - ((a.recipeIngredient?.length || 0) + (a.recipeInstructions?.length || 0)));
    ranked.push(...readRecipeCards(document));
    if (!ranked.length) throw new Error('This page does not contain supported Recipe data. Try the direct recipe page, or use Paste recipe or Import from images.');
    let lastError;
    const cookNote = extractCookNote(document);
    for (const recipe of ranked) {
      try { return normalizeRecipe(recipe, sourceUrl, recipe.cookNote || cookNote); }
      catch (error) { lastError = error; }
    }
    throw lastError || new Error('No complete recipe was found on this page.');
  }

  async function fetchPage(url, { sync, endpoint = '', fetcher = globalThis.fetch } = {}) {
    if (sync?.isSignedIn?.()) {
      try {
        const result = await sync.importRecipePage(url);
        if (!result?.html) throw new Error('The recipe server returned an empty page. Try another recipe link.');
        return { html:result.html, finalUrl:result.finalUrl || url };
      } catch (error) {
        if (error.status === 401) throw new Error('Your session expired. Sign in again to import this recipe.');
        if (error.status === 429) throw new Error('Too many recipe imports. Wait a moment, then try again.');
        if (error.status === 404) throw new Error('The recipe import service is unavailable. Try again later or use Paste recipe.');
        throw error;
      }
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      if (endpoint) {
        const response = await fetcher(endpoint, { method:'POST', signal:controller.signal,
          headers:{ 'Content-Type':'application/json', Accept:'application/json' }, body:JSON.stringify({ url }) });
        const result = await response.json();
        if (!response.ok || !result?.html) throw new Error(result.error || 'The recipe import service could not read this page.');
        return { html:result.html, finalUrl:result.finalUrl || url };
      }
      const response = await fetcher(url, { signal:controller.signal, credentials:'omit', headers:{ Accept:'text/html,application/xhtml+xml' } });
      if (!response.ok) throw new Error(`The recipe website returned ${response.status}.`);
      return { html:await response.text(), finalUrl:response.url || url };
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The recipe page took too long to load. Try again or use Paste recipe.');
      if (endpoint) throw error;
      throw new Error('Sign in to use server recipe importing. This website could not be read directly; Paste recipe and Import from images are also available.');
    } finally { clearTimeout(timeout); }
  }

  globalThis.KCUrlRecipeImport = { parseHtml, normalizeRecipe, duration, category, extractCookNote, findRecipes, fetchPage };
})();
