(() => {
  'use strict';

  const STORAGE_KEY = 'recipeEngineState.v1';
  const builtInModule = {
    schemaVersion: 1,
    moduleId: 'starter-kitchen',
    name: 'Starter Kitchen',
    publisher: 'Kitchen Companion',
    version: '1.0.0',
    description: 'A small starter collection demonstrating the module format.',
    license: 'Demo content',
    enabled: true,
    recipes: [
      {
        id: 'classic-tomato-bruschetta',
        name: 'Classic Tomato Bruschetta',
        category: 'Appetizers',
        description: 'Fresh tomatoes, basil, garlic, and olive oil on crisp toasted bread.',
        yield: { amount: 8, unit: 'servings' },
        prepTime: '20 minutes',
        cookTime: '10 minutes',
        tags: ['Italian', 'Vegetarian', 'Quick'],
        ingredientGroups: [{
          name: 'Main',
          ingredients: [
            { quantity: 4.5, displayQuantity: '4–5', unit: '', item: 'ripe tomatoes, diced', scalable: false },
            { quantity: 0.25, unit: 'cup', item: 'fresh basil leaves, chopped' },
            { quantity: 2, unit: 'cloves', item: 'garlic, minced' },
            { quantity: 2, unit: 'tablespoons', item: 'extra-virgin olive oil' },
            { quantity: 1, unit: 'tablespoon', item: 'balsamic vinegar', optional: true },
            { quantity: null, unit: '', item: 'Salt and pepper, to taste', scalable: false },
            { quantity: 1, unit: '', item: 'baguette or Italian bread, sliced', scalable: false }
          ]
        }],
        instructions: [
          'Combine tomatoes, basil, garlic, olive oil, and balsamic vinegar. Season and rest 15–20 minutes.',
          'Preheat the oven to 375°F (190°C).',
          'Brush the bread with olive oil and toast 8–10 minutes, flipping halfway through.',
          'Spoon the tomato mixture over the toasted bread and serve immediately.'
        ]
      },
      {
        id: 'balsamic-chicken',
        name: 'Balsamic Chicken',
        category: 'Main Course',
        description: 'Oven-roasted chicken with a sweet garlic-balsamic glaze.',
        yield: { amount: 4, unit: 'servings' },
        prepTime: '10 minutes',
        cookTime: '25 minutes',
        tags: ['Chicken', 'Italian', 'Oven'],
        ingredientGroups: [{
          name: 'Main',
          ingredients: [
            { quantity: 4, unit: '', item: 'boneless, skinless chicken breasts' },
            { quantity: null, unit: '', item: 'Salt and freshly ground black pepper', scalable: false },
            { quantity: 3, unit: 'tablespoons', item: 'olive oil, divided' },
            { quantity: 0.25, unit: 'cup', item: 'balsamic vinegar' },
            { quantity: 2, unit: 'tablespoons', item: 'honey' },
            { quantity: 2, unit: 'cloves', item: 'garlic, minced' },
            { quantity: 1, unit: 'teaspoon', item: 'dried basil' },
            { quantity: 1, unit: 'teaspoon', item: 'dried oregano' }
          ]
        }],
        instructions: [
          'Preheat the oven to 425°F (220°C).',
          'Whisk 2 tablespoons olive oil with balsamic vinegar, honey, garlic, basil, and oregano.',
          'Season the chicken. Sear in the remaining oil for 2–3 minutes per side in an oven-safe skillet.',
          'Pour the glaze over the chicken and roast 20–25 minutes, until it reaches 165°F (74°C).',
          'Rest briefly before serving.'
        ]
      }
    ]
  };

  const state = loadState();
  state.favorites ||= []; state.recipeNotes ||= {}; state.settings ||= {}; state.settings.accentColor ||= '#7b3f00';
  let currentView = 'all';
  let selectedCategory = null;
  let selectedRecipeKey = null;
  let activeScale = 1;

  const els = {
    sidebar: document.querySelector('#sidebar'), scrim: document.querySelector('#scrim'), menuBtn: document.querySelector('#menuBtn'),
    searchInput: document.querySelector('#searchInput'), recipeGrid: document.querySelector('#recipeGrid'), emptyState: document.querySelector('#emptyState'),
    categoryList: document.querySelector('#categoryList'), moduleFilter: document.querySelector('#moduleFilter'),
    viewTitle: document.querySelector('#viewTitle'), viewSubtitle: document.querySelector('#viewSubtitle'),
    listPane: document.querySelector('#listPane'), detailPane: document.querySelector('#detailPane'), modulesPane: document.querySelector('#modulesPane'),
    recipeDetail: document.querySelector('#recipeDetail'), backBtn: document.querySelector('#backBtn'), moduleCards: document.querySelector('#moduleCards'),
    moduleFile: document.querySelector('#moduleFile'), importBtn: document.querySelector('#importBtn'), moduleImportBtn: document.querySelector('#moduleImportBtn'),
    moduleCount: document.querySelector('#moduleCount'), navModuleCount: document.querySelector('#navModuleCount'), allCount: document.querySelector('#allCount'), favoriteCount: document.querySelector('#favoriteCount'),
    settingsBtn: document.querySelector('#settingsBtn'), settingsDialog: document.querySelector('#settingsDialog'), darkModeToggle: document.querySelector('#darkModeToggle'), metricToggle: document.querySelector('#metricToggle'),
    createRecipeBtn: document.querySelector('#createRecipeBtn'), recipeEditorDialog: document.querySelector('#recipeEditorDialog'), recipeEditorForm: document.querySelector('#recipeEditorForm'), closeRecipeEditor: document.querySelector('#closeRecipeEditor'), cancelRecipeEditor: document.querySelector('#cancelRecipeEditor'), accentColorInput: document.querySelector('#accentColorInput'), themeColorMeta: document.querySelector('#themeColorMeta')
  };

  init();

  function init() {
    if (!state.modules.length) state.modules.push(builtInModule);
    ensurePersonalModule();
    applySettings();
    bindEvents();
    refreshAll();
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && Array.isArray(parsed.modules)) return parsed;
    } catch (error) { console.warn('Unable to load saved state', error); }
    return { modules: [], favorites: [], recipeNotes: {}, settings: { darkMode: false, metricHelpers: false, accentColor: '#7b3f00' } };
  }

  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  function bindEvents() {
    els.menuBtn.addEventListener('click', () => toggleSidebar(true));
    els.scrim.addEventListener('click', () => toggleSidebar(false));
    els.searchInput.addEventListener('input', renderRecipeList);
    els.moduleFilter.addEventListener('change', renderRecipeList);
    els.backBtn.addEventListener('click', showList);
    els.importBtn.addEventListener('click', () => els.moduleFile.click());
    els.moduleImportBtn.addEventListener('click', () => els.moduleFile.click());
    els.moduleFile.addEventListener('change', importModules);
    els.settingsBtn.addEventListener('click', () => els.settingsDialog.showModal());
    els.darkModeToggle.addEventListener('change', () => { state.settings.darkMode = els.darkModeToggle.checked; applySettings(); saveState(); });
    els.metricToggle.addEventListener('change', () => { state.settings.metricHelpers = els.metricToggle.checked; saveState(); if (selectedRecipeKey) renderRecipeDetail(); });
    els.createRecipeBtn.addEventListener('click', () => openRecipeEditor());
    els.closeRecipeEditor.addEventListener('click', closeRecipeEditor);
    els.cancelRecipeEditor.addEventListener('click', closeRecipeEditor);
    els.recipeEditorForm.addEventListener('submit', saveRecipeFromEditor);
    els.accentColorInput.addEventListener('input', () => setAccentColor(els.accentColorInput.value));
    document.querySelectorAll('.color-swatch').forEach(button => button.addEventListener('click', () => setAccentColor(button.dataset.color)));

    document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => {
      currentView = button.dataset.view;
      selectedCategory = null;
      document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x === button));
      document.querySelectorAll('.category-button').forEach(x => x.classList.remove('active'));
      toggleSidebar(false);
      if (currentView === 'modules') showModules(); else showList();
    }));
  }

  function toggleSidebar(open) { els.sidebar.classList.toggle('open', open); els.scrim.classList.toggle('show', open); }

  function applySettings() {
    document.documentElement.dataset.theme = state.settings.darkMode ? 'dark' : 'light';
    els.darkModeToggle.checked = !!state.settings.darkMode;
    els.metricToggle.checked = !!state.settings.metricHelpers;
    const accent = state.settings.accentColor || '#7b3f00';
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--accent-2', adjustColor(accent, state.settings.darkMode ? 22 : -14));
    els.accentColorInput.value = accent;
    if (els.themeColorMeta) els.themeColorMeta.content = accent;
    document.querySelectorAll('.color-swatch').forEach(x => x.classList.toggle('active', x.dataset.color.toLowerCase() === accent.toLowerCase()));
  }

  function setAccentColor(color) { state.settings.accentColor = color; applySettings(); saveState(); }
  function adjustColor(hex, amount) {
    const value = hex.replace('#',''); const num = parseInt(value,16);
    const clamp = n => Math.max(0, Math.min(255,n));
    const r=clamp((num>>16)+amount), g=clamp(((num>>8)&255)+amount), b=clamp((num&255)+amount);
    return `#${[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}`;
  }

  function refreshAll() {
    renderCounts();
    renderModuleFilter();
    renderCategories();
    renderRecipeList();
    renderModules();
    saveState();
  }

  function getAllRecipes({ enabledOnly = true } = {}) {
    return state.modules
      .filter(module => !enabledOnly || module.enabled !== false)
      .flatMap(module => module.recipes.map(recipe => ({ ...recipe, moduleId: module.moduleId, moduleName: module.name, publisher: module.publisher, key: `${module.moduleId}:${recipe.id}` })));
  }

  function renderCounts() {
    const recipes = getAllRecipes();
    els.moduleCount.textContent = `${state.modules.length} module${state.modules.length === 1 ? '' : 's'}`;
    els.navModuleCount.textContent = state.modules.length;
    els.allCount.textContent = recipes.length;
    els.favoriteCount.textContent = state.favorites.length;
  }

  function renderModuleFilter() {
    const current = els.moduleFilter.value || 'all';
    els.moduleFilter.innerHTML = '<option value="all">All modules</option>';
    state.modules.filter(m => m.enabled !== false).forEach(module => {
      const option = document.createElement('option');
      option.value = module.moduleId;
      option.textContent = module.name;
      els.moduleFilter.append(option);
    });
    els.moduleFilter.value = [...els.moduleFilter.options].some(o => o.value === current) ? current : 'all';
  }

  function renderCategories() {
    const counts = new Map();
    getAllRecipes().forEach(recipe => counts.set(recipe.category || 'Uncategorized', (counts.get(recipe.category || 'Uncategorized') || 0) + 1));
    els.categoryList.innerHTML = '';
    [...counts.entries()].sort((a,b) => a[0].localeCompare(b[0])).forEach(([category, count]) => {
      const button = document.createElement('button');
      button.className = 'category-button';
      button.innerHTML = `<span>${escapeHtml(category)}</span><span>${count}</span>`;
      button.addEventListener('click', () => {
        currentView = 'category'; selectedCategory = category;
        document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.category-button').forEach(x => x.classList.toggle('active', x === button));
        toggleSidebar(false); showList();
      });
      els.categoryList.append(button);
    });
  }

  function renderRecipeList() {
    if (currentView === 'modules') return;
    const query = els.searchInput.value.trim().toLowerCase();
    const moduleId = els.moduleFilter.value;
    let recipes = getAllRecipes();

    if (currentView === 'favorites') recipes = recipes.filter(recipe => state.favorites.includes(recipe.key));
    if (currentView === 'category') recipes = recipes.filter(recipe => (recipe.category || 'Uncategorized') === selectedCategory);
    if (moduleId !== 'all') recipes = recipes.filter(recipe => recipe.moduleId === moduleId);
    if (query) recipes = recipes.filter(recipe => recipeSearchText(recipe).includes(query));

    els.viewTitle.textContent = currentView === 'favorites' ? 'Favorites' : currentView === 'category' ? selectedCategory : 'All recipes';
    els.viewSubtitle.textContent = `${recipes.length} recipe${recipes.length === 1 ? '' : 's'} shown.`;
    els.recipeGrid.innerHTML = '';
    els.emptyState.hidden = recipes.length > 0;

    recipes.sort((a,b) => a.name.localeCompare(b.name)).forEach(recipe => {
      const fragment = document.querySelector('#recipeCardTemplate').content.cloneNode(true);
      const card = fragment.querySelector('.recipe-card');
      fragment.querySelector('.recipe-category').textContent = recipe.category || 'Uncategorized';
      fragment.querySelector('.recipe-favorite').textContent = state.favorites.includes(recipe.key) ? '★' : '☆';
      fragment.querySelector('.recipe-name').textContent = recipe.name;
      fragment.querySelector('.recipe-description').textContent = recipe.description || 'No description yet.';
      const meta = fragment.querySelector('.recipe-meta');
      [recipe.prepTime && `Prep ${recipe.prepTime}`, recipe.cookTime && `Cook ${recipe.cookTime}`, recipe.yield && `${recipe.yield.amount} ${recipe.yield.unit}`].filter(Boolean).forEach(text => {
        const span = document.createElement('span'); span.textContent = text; meta.append(span);
      });
      fragment.querySelector('.recipe-source').textContent = recipe.moduleName;
      card.addEventListener('click', () => { selectedRecipeKey = recipe.key; activeScale = 1; showDetail(); });
      els.recipeGrid.append(fragment);
    });
  }

  function recipeSearchText(recipe) {
    const ingredients = (recipe.ingredientGroups || []).flatMap(group => group.ingredients || []).map(i => i.item).join(' ');
    return [recipe.name, recipe.category, recipe.description, ...(recipe.tags || []), ingredients, recipe.moduleName, recipe.publisher].filter(Boolean).join(' ').toLowerCase();
  }

  function showList() {
    els.listPane.hidden = false; els.detailPane.hidden = true; els.modulesPane.hidden = true;
    renderRecipeList(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showDetail() {
    els.listPane.hidden = true; els.detailPane.hidden = false; els.modulesPane.hidden = true;
    renderRecipeDetail(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showModules() {
    els.listPane.hidden = true; els.detailPane.hidden = true; els.modulesPane.hidden = false;
    renderModules(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderRecipeDetail() {
    const recipe = getAllRecipes({ enabledOnly: false }).find(r => r.key === selectedRecipeKey);
    if (!recipe) return showList();
    const favorite = state.favorites.includes(recipe.key);
    const yieldText = recipe.yield ? `${formatNumber(recipe.yield.amount * activeScale)} ${recipe.yield.unit}` : '';

    els.recipeDetail.innerHTML = `
      <section class="recipe-hero">
        <div class="recipe-hero-top">
          <div><div class="recipe-kicker">${escapeHtml(recipe.category || 'Uncategorized')}</div><h1>${escapeHtml(recipe.name)}</h1></div>
          <div class="recipe-action-row"><button id="favoriteRecipeBtn" class="favorite-button">${favorite ? '★ Favorited' : '☆ Add favorite'}</button><button id="editRecipeBtn" class="button secondary">✎ Edit</button></div>
        </div>
        <p class="recipe-summary">${escapeHtml(recipe.description || '')}</p>
        <div class="recipe-stats">
          ${recipe.prepTime ? `<span class="stat"><strong>Prep:</strong> ${escapeHtml(recipe.prepTime)}</span>` : ''}
          ${recipe.cookTime ? `<span class="stat"><strong>Cook:</strong> ${escapeHtml(recipe.cookTime)}</span>` : ''}
          ${yieldText ? `<span class="stat"><strong>Yield:</strong> ${escapeHtml(yieldText)}</span>` : ''}
        </div>
        <span class="module-badge">${escapeHtml(recipe.moduleName)} · ${escapeHtml(recipe.publisher || 'Unknown publisher')}</span>
      </section>
      <div class="scale-bar"><strong>Scale recipe:</strong>${[0.5,1,1.5,2,3].map(scale => `<button class="scale-button ${scale === activeScale ? 'active' : ''}" data-scale="${scale}">${scale}×</button>`).join('')}</div>
      <div class="recipe-layout">
        <section class="recipe-section"><h2>Ingredients</h2>${renderIngredientGroups(recipe)}</section>
        <section class="recipe-section"><h2>Instructions</h2><ol class="instruction-list">${(recipe.instructions || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol></section>
      </div>
      <section class="recipe-section recipe-notes"><h2>My notes</h2><textarea id="recipeNotesInput" placeholder="Add changes, reminders, results, or ideas for next time…">${escapeHtml(state.recipeNotes[recipe.key] || '')}</textarea><div id="saveNoteStatus" class="save-note-status"></div></section>`;

    document.querySelector('#favoriteRecipeBtn').addEventListener('click', () => toggleFavorite(recipe.key));
    document.querySelector('#editRecipeBtn').addEventListener('click', () => openRecipeEditor(recipe));
    const notesInput = document.querySelector('#recipeNotesInput'); let noteTimer;
    notesInput.addEventListener('input', () => { clearTimeout(noteTimer); document.querySelector('#saveNoteStatus').textContent = 'Saving…'; noteTimer=setTimeout(() => { state.recipeNotes[recipe.key]=notesInput.value; saveState(); document.querySelector('#saveNoteStatus').textContent='Saved on this device'; }, 350); });
    document.querySelectorAll('.scale-button').forEach(button => button.addEventListener('click', () => { activeScale = Number(button.dataset.scale); renderRecipeDetail(); }));
  }

  function renderIngredientGroups(recipe) {
    return (recipe.ingredientGroups || []).map(group => `
      <div class="ingredient-group">
        ${group.name && group.name !== 'Main' ? `<h3>${escapeHtml(group.name)}</h3>` : ''}
        <ul class="ingredient-list">${(group.ingredients || []).map(ingredient => `<li><label><input type="checkbox"><span>${formatIngredient(ingredient)}</span></label></li>`).join('')}</ul>
      </div>`).join('');
  }

  function formatIngredient(ingredient) {
    let amount = '';
    if (ingredient.displayQuantity && ingredient.scalable === false) amount = ingredient.displayQuantity;
    else if (typeof ingredient.quantity === 'number') amount = formatFraction(ingredient.scalable === false ? ingredient.quantity : ingredient.quantity * activeScale);
    const optional = ingredient.optional ? ' (optional)' : '';
    const metric = state.settings.metricHelpers ? metricHelper(ingredient, activeScale) : '';
    return escapeHtml([amount, ingredient.unit, ingredient.item].filter(Boolean).join(' ') + optional + metric);
  }

  function metricHelper(ingredient, scale) {
    if (typeof ingredient.quantity !== 'number') return '';
    const q = ingredient.quantity * (ingredient.scalable === false ? 1 : scale);
    const unit = (ingredient.unit || '').toLowerCase();
    if (['tablespoon','tablespoons','tbsp'].includes(unit)) return ` · ≈ ${formatNumber(q * 15)} mL`;
    if (['teaspoon','teaspoons','tsp'].includes(unit)) return ` · ≈ ${formatNumber(q * 5)} mL`;
    if (unit === 'cup' || unit === 'cups') return ` · ≈ ${formatNumber(q * 237)} mL`;
    return '';
  }

  function formatFraction(value) {
    const whole = Math.floor(value + 1e-8);
    const fraction = value - whole;
    const options = [[0.125,'⅛'],[0.25,'¼'],[0.333,'⅓'],[0.375,'⅜'],[0.5,'½'],[0.625,'⅝'],[0.667,'⅔'],[0.75,'¾'],[0.875,'⅞']];
    let best = null;
    options.forEach(([decimal, glyph]) => { if (!best || Math.abs(fraction - decimal) < best.diff) best = { diff: Math.abs(fraction - decimal), glyph }; });
    if (best && best.diff < 0.035) return `${whole || ''}${best.glyph}`;
    return formatNumber(value);
  }

  function formatNumber(value) { return Number(value.toFixed(2)).toString(); }

  function toggleFavorite(key) {
    const index = state.favorites.indexOf(key);
    if (index >= 0) state.favorites.splice(index, 1); else state.favorites.push(key);
    saveState(); renderCounts(); renderRecipeDetail();
  }

  function ensurePersonalModule() {
    let module = state.modules.find(m => m.moduleId === 'my-recipes');
    if (!module) {
      module = { schemaVersion: 1, moduleId: 'my-recipes', name: 'My Recipes', publisher: 'Kitchen Companion user', version: '1.0.0', description: 'Recipes created or edited in Kitchen Companion.', license: 'Personal', enabled: true, recipes: [] };
      state.modules.push(module);
    }
    return module;
  }

  function closeRecipeEditor() { els.recipeEditorDialog.close(); els.recipeEditorForm.reset(); document.querySelector('#editRecipeKey').value = ''; }

  function openRecipeEditor(recipe = null) {
    els.recipeEditorForm.reset();
    document.querySelector('#recipeEditorTitle').textContent = recipe ? (recipe.moduleId === 'my-recipes' ? 'Edit recipe' : 'Edit as personal copy') : 'Create recipe';
    document.querySelector('#editRecipeKey').value = recipe?.key || '';
    document.querySelector('#editName').value = recipe?.name || '';
    document.querySelector('#editCategory').value = recipe?.category || '';
    document.querySelector('#editDescription').value = recipe?.description || '';
    document.querySelector('#editPrepTime').value = recipe?.prepTime || '';
    document.querySelector('#editCookTime').value = recipe?.cookTime || '';
    document.querySelector('#editYield').value = recipe?.yield ? `${recipe.yield.amount} ${recipe.yield.unit || ''}`.trim() : '';
    document.querySelector('#editTags').value = (recipe?.tags || []).join(', ');
    document.querySelector('#editIngredients').value = (recipe?.ingredientGroups || []).flatMap(group => (group.ingredients || []).map(formatIngredientForEditor)).join('\n');
    document.querySelector('#editInstructions').value = (recipe?.instructions || []).join('\n');
    els.recipeEditorDialog.showModal();
  }

  function formatIngredientForEditor(i) { return [i.displayQuantity ?? i.quantity ?? '', i.unit || '', i.item || ''].filter(x => x !== '').join(' '); }

  function saveRecipeFromEditor(event) {
    event.preventDefault();
    const personal = ensurePersonalModule();
    const sourceKey = document.querySelector('#editRecipeKey').value;
    const source = sourceKey ? getAllRecipes({enabledOnly:false}).find(r => r.key === sourceKey) : null;
    const name = document.querySelector('#editName').value.trim();
    let id = source?.moduleId === 'my-recipes' ? source.id : uniqueRecipeId(slugify(name), personal.recipes);
    const yieldParts = document.querySelector('#editYield').value.trim().match(/^([0-9.]+)\s*(.*)$/);
    const recipe = {
      id, name,
      category: document.querySelector('#editCategory').value.trim() || 'Uncategorized',
      description: document.querySelector('#editDescription').value.trim(),
      prepTime: document.querySelector('#editPrepTime').value.trim(), cookTime: document.querySelector('#editCookTime').value.trim(),
      yield: yieldParts ? { amount: Number(yieldParts[1]), unit: yieldParts[2] || 'servings' } : null,
      tags: document.querySelector('#editTags').value.split(',').map(x=>x.trim()).filter(Boolean),
      ingredientGroups: [{ name:'Main', ingredients: document.querySelector('#editIngredients').value.split('\n').map(x=>x.trim()).filter(Boolean).map(parseIngredientLine) }],
      instructions: document.querySelector('#editInstructions').value.split('\n').map(x=>x.trim()).filter(Boolean),
      createdInApp: true, copiedFrom: source && source.moduleId !== 'my-recipes' ? source.key : undefined
    };
    const index = personal.recipes.findIndex(r => r.id === id);
    if (index >= 0) personal.recipes[index] = recipe; else personal.recipes.push(recipe);
    selectedRecipeKey = `my-recipes:${id}`;
    closeRecipeEditor(); refreshAll(); showDetail();
  }

  function parseIngredientLine(line) {
    const normalized = line.replace(/^[-•]\s*/, '');
    const match = normalized.match(/^(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+|[⅛¼⅓⅜½⅝⅔¾⅞])\s+([^\s]+)?\s*(.*)$/);
    if (!match) return { quantity:null, unit:'', item:normalized, scalable:false };
    const quantity = parseQuantity(match[1]); const unit = match[2] || ''; const item = match[3] || unit;
    return { quantity, unit: item === unit ? '' : unit, item, scalable: Number.isFinite(quantity) };
  }
  function parseQuantity(text) { const glyphs={'⅛':.125,'¼':.25,'⅓':1/3,'⅜':.375,'½':.5,'⅝':.625,'⅔':2/3,'¾':.75,'⅞':.875}; if(glyphs[text]) return glyphs[text]; if(text.includes(' ')){const [a,b]=text.split(' '); return Number(a)+parseQuantity(b);} if(text.includes('/')){const [a,b]=text.split('/').map(Number); return a/b;} return Number(text); }
  function slugify(text) { return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'recipe'; }
  function uniqueRecipeId(base, recipes) { let id=base, n=2; while(recipes.some(r=>r.id===id)) id=`${base}-${n++}`; return id; }

  async function importModules(event) {
    const files = [...event.target.files];
    for (const file of files) {
      try {
        const module = JSON.parse(await file.text());
        const report = validateModule(module);
        if (report.warnings.length) console.warn(`Imported ${file.name} with warnings:`, report.warnings);
        module.enabled = module.enabled !== false;
        const existingIndex = state.modules.findIndex(m => m.moduleId === module.moduleId);
        if (existingIndex >= 0) {
          const replace = confirm(`${module.name} is already installed. Replace version ${state.modules[existingIndex].version} with ${module.version}?`);
          if (!replace) continue;
          state.modules[existingIndex] = module;
        } else state.modules.push(module);
      } catch (error) {
        alert(`Could not import ${file.name}: ${error.message}`);
      }
    }
    event.target.value = '';
    refreshAll();
    currentView = 'modules'; showModules();
  }

  function validateModule(module) {
    const errors = [];
    const warnings = [];
    if (!module || typeof module !== 'object' || Array.isArray(module)) throw new Error('Module must be a JSON object.');
    for (const field of ['schemaVersion','moduleId','name','version','recipes']) {
      if (module[field] === undefined || module[field] === null || module[field] === '') errors.push(`Missing required field: ${field}`);
    }
    if (module.schemaVersion !== 1) errors.push(`Unsupported schema version: ${module.schemaVersion}. Expected 1.`);
    if (typeof module.moduleId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(module.moduleId || '')) errors.push('moduleId must use lowercase letters, numbers, and hyphens only.');
    if (!Array.isArray(module.recipes)) errors.push('recipes must be an array.');
    if (errors.length) throw new Error(errors.join('\n'));

    const ids = new Map();
    module.recipes.forEach((recipe, index) => {
      const label = `Recipe ${index + 1}${recipe && recipe.name ? ` (${recipe.name})` : ''}`;
      if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) { errors.push(`${label} must be an object.`); return; }
      if (typeof recipe.id !== 'string' || !recipe.id.trim()) errors.push(`${label} needs an id.`);
      else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.id)) errors.push(`${label} has invalid id “${recipe.id}”. Use lowercase letters, numbers, and hyphens only.`);
      if (typeof recipe.name !== 'string' || !recipe.name.trim()) errors.push(`${label} needs a name.`);
      if (recipe.id) {
        if (ids.has(recipe.id)) errors.push(`Duplicate recipe id “${recipe.id}”:\n• Recipe ${ids.get(recipe.id) + 1}: ${module.recipes[ids.get(recipe.id)].name || 'Unnamed'}\n• Recipe ${index + 1}: ${recipe.name || 'Unnamed'}`);
        else ids.set(recipe.id, index);
      }
      if (!Array.isArray(recipe.ingredientGroups)) errors.push(`${label}: ingredientGroups must be an array.`);
      else recipe.ingredientGroups.forEach((group, groupIndex) => {
        if (!group || typeof group !== 'object' || !Array.isArray(group.ingredients)) errors.push(`${label}: ingredient group ${groupIndex + 1} must contain an ingredients array.`);
        else group.ingredients.forEach((ingredient, ingredientIndex) => {
          if (!ingredient || typeof ingredient !== 'object' || typeof ingredient.item !== 'string' || !ingredient.item.trim()) errors.push(`${label}: ingredient ${groupIndex + 1}.${ingredientIndex + 1} needs an item.`);
          if (ingredient && ingredient.quantity !== null && ingredient.quantity !== undefined && typeof ingredient.quantity !== 'number') errors.push(`${label}: ingredient ${groupIndex + 1}.${ingredientIndex + 1} quantity must be numeric or null.`);
        });
      });
      if (!Array.isArray(recipe.instructions)) errors.push(`${label}: instructions must be an array.`);
      else if (!recipe.instructions.length) warnings.push(`${label} has no instructions.`);
    });
    if (errors.length) throw new Error(`${errors.length} validation problem${errors.length === 1 ? '' : 's'}:\n\n${errors.join('\n\n')}`);
    return { warnings };
  }

  function renderModules() {
    els.moduleCards.innerHTML = '';
    state.modules.forEach(module => {
      const card = document.createElement('section');
      card.className = 'module-card';
      card.innerHTML = `
        <div><h2>${escapeHtml(module.name)}</h2><div class="module-meta">${escapeHtml(module.publisher || 'Unknown publisher')} · Version ${escapeHtml(module.version)} · ${module.recipes.length} recipes</div><p>${escapeHtml(module.description || '')}</p></div>
        <div class="module-actions">
          <button class="button secondary toggle-module">${module.enabled === false ? 'Enable' : 'Disable'}</button>
          <button class="button secondary export-module">Export</button>
          ${module.moduleId === 'my-recipes' ? '' : '<button class="button danger remove-module">Uninstall</button>'}
        </div>`;
      card.querySelector('.toggle-module').addEventListener('click', () => { module.enabled = module.enabled === false; refreshAll(); renderModules(); });
      card.querySelector('.export-module').addEventListener('click', () => exportModule(module));
      card.querySelector('.remove-module')?.addEventListener('click', () => {
        if (!confirm(`Uninstall ${module.name}?\n\nThis removes all ${module.recipes.length} imported recipes from this device. User-created recipes and copied personal variations are not part of the module and will remain. Favorites that point to this module will be cleaned up.`)) return;
        state.modules = state.modules.filter(m => m.moduleId !== module.moduleId);
        state.favorites = state.favorites.filter(key => !key.startsWith(`${module.moduleId}:`));
        refreshAll(); renderModules();
      });
      els.moduleCards.append(card);
    });
  }

  function exportModule(module) {
    const blob = new Blob([JSON.stringify(module, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${module.moduleId}.recipepack`; a.click();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }
})();
