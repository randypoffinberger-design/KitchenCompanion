(() => {
  'use strict';

  const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  class KitchenCompanionEngine {
    constructor({ schemaVersion = 1, personalModuleId = 'my-recipes' } = {}) {
      this.schemaVersion = schemaVersion;
      this.personalModuleId = personalModuleId;
    }

    validateModule(module) {
      const errors = [];
      const warnings = [];
      if (!module || typeof module !== 'object' || Array.isArray(module)) throw new Error('Module must be a JSON object.');
      for (const field of ['schemaVersion', 'moduleId', 'name', 'version', 'recipes']) {
        if (module[field] === undefined || module[field] === null || module[field] === '') errors.push(`Missing required field: ${field}`);
      }
      if (module.schemaVersion !== this.schemaVersion) errors.push(`Unsupported schema version: ${module.schemaVersion}. Expected ${this.schemaVersion}.`);
      if (typeof module.moduleId !== 'string' || !ID_PATTERN.test(module.moduleId || '')) errors.push('moduleId must use lowercase letters, numbers, and hyphens only.');
      if (!Array.isArray(module.recipes)) errors.push('recipes must be an array.');
      if (errors.length) throw new Error(errors.join('\n'));

      const ids = new Map();
      module.recipes.forEach((recipe, index) => {
        const label = `Recipe ${index + 1}${recipe?.name ? ` (${recipe.name})` : ''}`;
        if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) { errors.push(`${label} must be an object.`); return; }
        if (typeof recipe.id !== 'string' || !recipe.id.trim()) errors.push(`${label} needs an id.`);
        else if (!ID_PATTERN.test(recipe.id)) errors.push(`${label} has invalid id “${recipe.id}”.`);
        if (typeof recipe.name !== 'string' || !recipe.name.trim()) errors.push(`${label} needs a name.`);
        if (recipe.id) {
          if (ids.has(recipe.id)) errors.push(`Duplicate recipe id “${recipe.id}” at recipes ${ids.get(recipe.id) + 1} and ${index + 1}.`);
          else ids.set(recipe.id, index);
        }
        if (!Array.isArray(recipe.ingredientGroups)) errors.push(`${label}: ingredientGroups must be an array.`);
        else recipe.ingredientGroups.forEach((group, groupIndex) => {
          if (!group || typeof group !== 'object' || !Array.isArray(group.ingredients)) errors.push(`${label}: ingredient group ${groupIndex + 1} must contain an ingredients array.`);
          else group.ingredients.forEach((ingredient, ingredientIndex) => {
            if (!ingredient || typeof ingredient !== 'object' || typeof ingredient.item !== 'string' || !ingredient.item.trim()) errors.push(`${label}: ingredient ${groupIndex + 1}.${ingredientIndex + 1} needs an item.`);
            if (ingredient?.quantity !== null && ingredient?.quantity !== undefined && typeof ingredient.quantity !== 'number') errors.push(`${label}: ingredient ${groupIndex + 1}.${ingredientIndex + 1} quantity must be numeric or null.`);
          });
        });
        if (!Array.isArray(recipe.instructions)) errors.push(`${label}: instructions must be an array.`);
        else if (!recipe.instructions.length) warnings.push(`${label} has no instructions.`);
      });
      if (errors.length) throw new Error(`${errors.length} validation problem${errors.length === 1 ? '' : 's'}:\n\n${errors.join('\n\n')}`);
      return { warnings };
    }

    normalizeModule(module) {
      this.validateModule(module);
      return {
        ...module,
        enabled: module.enabled !== false,
        recipes: module.recipes.map(recipe => ({ ...recipe }))
      };
    }

    ensurePersonalModule(modules) {
      let personal = modules.find(module => module.moduleId === this.personalModuleId);
      if (!personal) {
        personal = { schemaVersion: this.schemaVersion, moduleId: this.personalModuleId, name: 'My Recipes', publisher: 'You', version: '1.0.0', description: 'Recipes created or customized in Kitchen Companion.', license: 'Private', enabled: true, recipes: [] };
        modules.push(personal);
      }
      return personal;
    }

    getRecipes(modules, { enabledOnly = true, includeOverridden = false } = {}) {
      const all = modules
        .filter(module => !enabledOnly || module.enabled !== false)
        .flatMap(module => module.recipes.map(recipe => ({ ...recipe, moduleId: module.moduleId, moduleName: module.name, publisher: module.publisher, key: `${module.moduleId}:${recipe.id}` })));
      if (includeOverridden) return all;
      const overridden = new Set(all.filter(recipe => recipe.moduleId === this.personalModuleId && recipe.copiedFrom).map(recipe => recipe.copiedFrom));
      return all.filter(recipe => !overridden.has(recipe.key));
    }

    searchText(recipe) {
      const ingredients = (recipe.ingredientGroups || []).flatMap(group => group.ingredients || []).map(item => item.item).join(' ');
      return [recipe.name, recipe.category, recipe.description, ...(recipe.tags || []), ingredients, recipe.moduleName, recipe.publisher].filter(Boolean).join(' ').toLowerCase();
    }

    filterRecipes(recipes, { query = '', moduleId = 'all', category = 'all', favorites = null } = {}) {
      const normalizedQuery = query.trim().toLowerCase();
      return recipes.filter(recipe => {
        if (moduleId !== 'all' && recipe.moduleId !== moduleId) return false;
        if (category !== 'all' && (recipe.category || 'Uncategorized') !== category) return false;
        if (favorites && !favorites.includes(recipe.key)) return false;
        return !normalizedQuery || this.searchText(recipe).includes(normalizedQuery);
      });
    }

    installModule(modules, incoming) {
      const module = this.normalizeModule(incoming);
      const index = modules.findIndex(item => item.moduleId === module.moduleId);
      if (index >= 0) modules[index] = module;
      else modules.push(module);
      return { module, replaced: index >= 0 };
    }

    slugify(text) {
      return String(text || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recipe';
    }

    uniqueRecipeId(base, recipes) {
      let id = base; let number = 2;
      while (recipes.some(recipe => recipe.id === id)) id = `${base}-${number++}`;
      return id;
    }
  }

  globalThis.KitchenCompanionEngine = KitchenCompanionEngine;
})();
