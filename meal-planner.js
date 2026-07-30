(() => {
  'use strict';

  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const MEALS = ['breakfast','lunch','dinner','snack'];
  const MEAL_PARTS = Object.freeze({
    breakfast:['main','side1'],
    lunch:['main','side1'],
    dinner:['main','side1','side2'],
    snack:['main']
  });
  const PLACEMENTS = [...MEALS, 'side'];
  const FREQUENCIES = ['often','weekly','occasionally','rarely','never'];
  const FREQUENCY_WEIGHTS = { often:9, weekly:6, occasionally:2.5, rarely:0.55, never:0 };
  const SPECIAL_KINDS = ['skip','eat-out','leftovers'];

  const clone = value => JSON.parse(JSON.stringify(value));
  const dateIso = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  function startOfWeek(value = new Date()) {
    const date = new Date(value);
    date.setHours(12, 0, 0, 0);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return dateIso(date);
  }

  function shiftWeek(weekStart, amount) {
    const date = new Date(`${weekStart}T12:00:00`);
    date.setDate(date.getDate() + (Number(amount) || 0) * 7);
    return dateIso(date);
  }

  function weekOffset(weekStart, baseWeek = startOfWeek()) {
    const target = new Date(`${startOfWeek(`${weekStart}T12:00:00`)}T12:00:00`);
    const base = new Date(`${startOfWeek(`${baseWeek}T12:00:00`)}T12:00:00`);
    return Math.round((target.getTime() - base.getTime()) / 604800000);
  }

  function slotKey(dayIndex, meal, part = 'main') {
    return `${Number(dayIndex)}-${meal}-${part}`;
  }

  function templateKey(dayIndex, meal) {
    return `${Number(dayIndex)}-${meal}`;
  }

  function emptySlot() {
    return { kind:'empty', locked:false, source:'', scale:1 };
  }

  function normalizeTemplate(template) {
    const result = {};
    for (let day = 0; day < 7; day += 1) {
      MEALS.forEach(meal => {
        const key = templateKey(day, meal);
        const kind = SPECIAL_KINDS.includes(template?.[key]) ? template[key] : 'plan';
        result[key] = kind;
      });
    }
    return result;
  }

  function createPlan(weekStart, template = {}) {
    const normalizedTemplate = normalizeTemplate(template);
    const slots = {};
    for (let day = 0; day < 7; day += 1) {
      MEALS.forEach(meal => {
        const kind = normalizedTemplate[templateKey(day, meal)];
        MEAL_PARTS[meal].forEach(part => {
          const key = slotKey(day, meal, part);
          slots[key] = kind === 'plan' ? emptySlot() : { kind, locked:true, source:'template', scale:1 };
        });
      });
    }
    return { weekStart:startOfWeek(`${weekStart}T12:00:00`), slots, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
  }

  function normalizeSlot(slot) {
    if (!slot || typeof slot !== 'object') return emptySlot();
    const kind = ['empty','recipe','custom',...SPECIAL_KINDS].includes(slot.kind) ? slot.kind : 'empty';
    if (kind === 'recipe' && !slot.recipeKey) return emptySlot();
    if (kind === 'custom' && !String(slot.text || '').trim()) return emptySlot();
    return {
      kind,
      ...(kind === 'recipe' ? { recipeKey:String(slot.recipeKey), source:slot.source === 'random' ? 'random' : 'manual' } : {}),
      ...(kind === 'custom' ? { text:String(slot.text).trim(), source:'manual' } : {}),
      ...(SPECIAL_KINDS.includes(kind) ? { source:slot.source === 'template' ? 'template' : 'manual' } : {}),
      locked:kind === 'empty' ? false : slot.locked !== false,
      scale:[0.5,1,1.5,2,3].includes(Number(slot.scale)) ? Number(slot.scale) : 1
    };
  }

  function normalizePlan(plan, weekStart, template = {}) {
    const base = createPlan(weekStart, template);
    if (!plan || typeof plan !== 'object') return base;
    Object.keys(base.slots).forEach(key => {
      if (plan.slots?.[key]) base.slots[key] = normalizeSlot(plan.slots[key]);
    });
    base.createdAt = plan.createdAt || base.createdAt;
    base.updatedAt = plan.updatedAt || base.updatedAt;
    return base;
  }

  function inferredMealTypes(recipe) {
    const name = String(recipe?.name || '').toLowerCase();
    const category = String(recipe?.category || '').toLowerCase();
    const tags = (recipe?.tags || []).join(' ').toLowerCase();
    const text = `${name} ${category} ${tags}`;
    const types = new Set();

    // Standalone components remain available for manual planning, but should
    // never become a generated meal merely because their name contains words
    // such as "pizza" or "chicken."
    const componentOnly = /\b(sauce|gravy|glaze|marinade|rub|seasoning|dressing|vinaigrette|syrup|jam|jelly|stock|broth|dough|crust|batter)\b/.test(name)
      && !/\b(with|in|over)\b.+\b(sauce|gravy|glaze|marinade|dressing)\b/.test(name);
    if (componentOnly) return [];

    if (/(breakfast|brunch|pancake|waffle|oatmeal|cereal|egg|biscuit|muffin|french toast)/.test(text)) types.add('breakfast');
    if (/(snack|dessert|cookie|cake|brownie|bar|candy|popcorn|dip|appetizer|smoothie)/.test(text)) types.add('snack');
    const mainDish = /(main course|main dish|entree|entrée|dinner)/.test(category)
      || /\b(stuffed (pepper|peppers|shell|shells)|chili|stew|meatloaf|casserole|lasagna|enchilada|enchiladas|taco|tacos|burger|burgers|chicken|beef|pork|turkey|ham|lamb|seafood|fish|shrimp|meatball|meatballs|pot roast)\b/.test(name);
    if (!mainDish && /(side dish|sides|vegetable|vegetables|potato|potatoes|rice|polenta|bread|roll|biscuit|salad|zucchini|squash)/.test(text)) types.add('side');
    if (mainDish || /(lunch|sandwich|wrap|salad|soup|burger|pizza|pasta)/.test(text)) types.add('lunch');
    if (mainDish || /(dinner|main course|entree|entrée|chicken|beef|pork|turkey|pasta|casserole|pot roast|seafood|fish)/.test(text)) types.add('dinner');
    if (!types.size) { types.add('lunch'); types.add('dinner'); }
    return [...types];
  }

  function recipePreference(recipe, preferences = {}) {
    const saved = preferences?.[recipe.key] || {};
    const frequency = FREQUENCIES.includes(saved.frequency) ? saved.frequency : 'occasionally';
    const mealTypes = Array.isArray(saved.mealTypes)
      ? [...new Set(saved.mealTypes.filter(type => PLACEMENTS.includes(type)))]
      : inferredMealTypes(recipe);
    return { frequency, mealTypes };
  }

  function daysSince(value, now = Date.now()) {
    const time = Date.parse(value);
    return Number.isFinite(time) ? Math.max(0, (now - time) / 86400000) : Infinity;
  }

  function recipeWeight(recipe, meal, context = {}) {
    const preference = recipePreference(recipe, context.preferences);
    if (!preference.mealTypes.includes(meal)) return 0;
    let weight = FREQUENCY_WEIGHTS[preference.frequency] || 0;
    if (!weight) return 0;
    const rating = Math.max(0, Math.min(5, Number(context.ratings?.[recipe.key]?.value ?? context.ratings?.[recipe.key]) || 0));
    if (rating) weight *= 0.7 + rating * 0.18;
    if ((context.favorites || []).includes(recipe.key)) weight *= 1.45;
    const recent = (context.history || []).filter(item => item.recipeKey === recipe.key).sort((a, b) => Date.parse(b.plannedAt) - Date.parse(a.plannedAt))[0];
    const age = daysSince(recent?.plannedAt, context.now);
    if (age < 7) weight *= 0.18;
    else if (age < 14) weight *= 0.4;
    else if (age < 30) weight *= 0.75;
    const usedCount = context.used?.get(recipe.key) || 0;
    if (usedCount) weight *= preference.frequency === 'often' ? Math.pow(0.42, usedCount) : 0;
    return weight;
  }

  function weightedChoice(recipes, meal, context = {}, rng = Math.random) {
    const weighted = recipes.map(recipe => ({ recipe, weight:recipeWeight(recipe, meal, context) })).filter(item => item.weight > 0);
    if (!weighted.length) return null;
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let target = Math.max(0, Math.min(0.999999999, Number(rng()) || 0)) * total;
    for (const item of weighted) {
      target -= item.weight;
      if (target <= 0) return item.recipe;
    }
    return weighted[weighted.length - 1].recipe;
  }

  function generate(plan, recipes, context = {}, options = {}) {
    const result = normalizePlan(plan, plan.weekStart, context.template);
    const onlyEmpty = !!options.onlyEmpty;
    const allowedKeys = options.slotKeys ? new Set(options.slotKeys) : null;
    const used = new Map();
    Object.values(result.slots).forEach(slot => {
      if (slot.kind === 'recipe' && slot.recipeKey && (slot.locked || slot.source === 'manual')) used.set(slot.recipeKey, (used.get(slot.recipeKey) || 0) + 1);
    });
    for (let day = 0; day < 7; day += 1) {
      MEALS.forEach(meal => {
        MEAL_PARTS[meal].forEach(part => {
          const key = slotKey(day, meal, part);
          if (allowedKeys && !allowedKeys.has(key)) return;
          const current = result.slots[key];
          const replaceable = current.kind === 'empty' || (!onlyEmpty && current.kind === 'recipe' && current.source === 'random' && !current.locked);
          if (!replaceable) return;
          const placement = part === 'main' ? meal : 'side';
          const choice = weightedChoice(recipes, placement, { ...context, used }, options.rng);
          result.slots[key] = choice
            ? { kind:'recipe', recipeKey:choice.key, source:'random', locked:false, scale:current.scale || 1 }
            : emptySlot();
          if (choice) used.set(choice.key, (used.get(choice.key) || 0) + 1);
        });
      });
    }
    result.updatedAt = new Date().toISOString();
    return result;
  }

  globalThis.KCMealPlanner = {
    DAYS, MEALS, MEAL_PARTS, PLACEMENTS, FREQUENCIES, SPECIAL_KINDS, startOfWeek, shiftWeek, weekOffset, slotKey, templateKey,
    emptySlot, normalizeTemplate, createPlan, normalizeSlot, normalizePlan,
    inferredMealTypes, recipePreference, recipeWeight, weightedChoice, generate
  };
})();
