(() => {
  'use strict';

  const STORAGE_KEY = 'recipeEngineState.v1';
  const ENGINE_VERSION = '0.10.3';
  const engine = new KitchenCompanionEngine();
  const MODULE_CATALOG_URL = './catalog.json';
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

  const profileStore = new KCProfileStore();
  const state = profileStore.loadActiveState();
  state.favorites ||= []; state.recipeNotes ||= {}; state.hiddenRecipes ||= []; state.settings ||= {}; state.settings.accentColor ||= '#7b3f00'; state.settings.wakeLockMode ||= 'recipes-and-timers'; state.settings.alarmVolume ??= 0.85; state.settings.alarmSoundEnabled ??= true; state.customCategories ||= []; state.timers ||= []; state.shoppingList ||= []; state.regularItems ||= []; state.stores ||= ['Unassigned','Costco','Walmart']; state.moduleSources ||= {}; state.backupMeta ||= {};
  let currentView = 'all';
  let selectedCategory = null;
  let selectedRecipeKey = null;
  let activeScale = 1;
  let timerTicker = null;
  let bellAudio = null;
  let wakeLockSentinel = null;
  let wakeLockRequestPending = false;

  const els = {
    sidebar: document.querySelector('#sidebar'), scrim: document.querySelector('#scrim'), menuBtn: document.querySelector('#menuBtn'),
    searchInput: document.querySelector('#searchInput'), recipeGrid: document.querySelector('#recipeGrid'), emptyState: document.querySelector('#emptyState'),
    categoryList: document.querySelector('#categoryList'), moduleFilter: document.querySelector('#moduleFilter'), categoryFilter: document.querySelector('#categoryFilter'), clearSearchBtn: document.querySelector('#clearSearchBtn'), favoritesFilterBtn: document.querySelector('#favoritesFilterBtn'), clearFiltersBtn: document.querySelector('#clearFiltersBtn'),
    viewTitle: document.querySelector('#viewTitle'), viewSubtitle: document.querySelector('#viewSubtitle'),
    listPane: document.querySelector('#listPane'), detailPane: document.querySelector('#detailPane'), modulesPane: document.querySelector('#modulesPane'), shoppingPane: document.querySelector('#shoppingPane'),
    recipeDetail: document.querySelector('#recipeDetail'), backBtn: document.querySelector('#backBtn'), moduleCards: document.querySelector('#moduleCards'),
    moduleFile: document.querySelector('#moduleFile'), importBtn: document.querySelector('#importBtn'), moduleImportBtn: document.querySelector('#moduleImportBtn'),
    moduleCount: document.querySelector('#moduleCount'), navModuleCount: document.querySelector('#navModuleCount'), allCount: document.querySelector('#allCount'), favoriteCount: document.querySelector('#favoriteCount'),
    settingsBtn: document.querySelector('#menuSettings'), settingsDialog: document.querySelector('#settingsDialog'), darkModeToggle: document.querySelector('#darkModeToggle'), metricToggle: document.querySelector('#metricToggle'),
    createRecipeBtn: document.querySelector('#menuCreateRecipe'), recipeEditorDialog: document.querySelector('#recipeEditorDialog'), recipeEditorForm: document.querySelector('#recipeEditorForm'), closeRecipeEditor: document.querySelector('#closeRecipeEditor'), cancelRecipeEditor: document.querySelector('#cancelRecipeEditor'), accentColorInput: document.querySelector('#accentColorInput'), themeColorMeta: document.querySelector('#themeColorMeta'),
    timersBtn: document.querySelector('#timersBtn'), timerCount: document.querySelector('#timerCount'), timerDock: document.querySelector('#timerDock'), timerList: document.querySelector('#timerList'), closeTimerDock: document.querySelector('#closeTimerDock'),
    editCategory: document.querySelector('#editCategory'), addCustomCategory: document.querySelector('#addCustomCategory'), customCategoryInput: document.querySelector('#customCategoryInput'),
    rangeTimerDialog: document.querySelector('#rangeTimerDialog'), rangeTimerLabel: document.querySelector('#rangeTimerLabel'), rangeTimerChoices: document.querySelector('#rangeTimerChoices'),
    menuImportModule: document.querySelector('#menuImportModule'), shoppingCount: document.querySelector('#shoppingCount'), shoppingGroups: document.querySelector('#shoppingGroups'), shoppingStoreFilter: document.querySelector('#shoppingStoreFilter'), addShoppingItemBtn: document.querySelector('#addShoppingItemBtn'), shareShoppingBtn: document.querySelector('#shareShoppingBtn'), clearCheckedBtn: document.querySelector('#clearCheckedBtn'), regularItemsBtn: document.querySelector('#regularItemsBtn'), manageStoresBtn: document.querySelector('#manageStoresBtn'), ingredientShoppingDialog: document.querySelector('#ingredientShoppingDialog'), ingredientShoppingChoices: document.querySelector('#ingredientShoppingChoices'), ingredientStoreSelect: document.querySelector('#ingredientStoreSelect'), confirmIngredientAdd: document.querySelector('#confirmIngredientAdd'), shoppingItemDialog: document.querySelector('#shoppingItemDialog'), shoppingItemForm: document.querySelector('#shoppingItemForm'), shoppingItemStore: document.querySelector('#shoppingItemStore'), regularItemsDialog: document.querySelector('#regularItemsDialog'), regularItemsList: document.querySelector('#regularItemsList'), catalogRefreshBtn: document.querySelector('#catalogRefreshBtn'), importOptionsDialog: document.querySelector('#importOptionsDialog'), browseGithubBtn: document.querySelector('#browseGithubBtn'), importFileBtn: document.querySelector('#importFileBtn'), forceUpdateBtn: document.querySelector('#forceUpdateBtn'), recipeCreateDialog: document.querySelector('#recipeCreateDialog'), manualRecipeBtn: document.querySelector('#manualRecipeBtn'), pasteRecipeBtn: document.querySelector('#pasteRecipeBtn'), imageRecipeBtn: document.querySelector('#imageRecipeBtn'), pasteRecipeDialog: document.querySelector('#pasteRecipeDialog'), pasteRecipeForm: document.querySelector('#pasteRecipeForm'), pastedRecipeText: document.querySelector('#pastedRecipeText'), imageRecipeDialog: document.querySelector('#imageRecipeDialog'), imageRecipeForm: document.querySelector('#imageRecipeForm'), recipeImageFiles: document.querySelector('#recipeImageFiles'), recipeImagePreviews: document.querySelector('#recipeImagePreviews'), recognizedRecipeText: document.querySelector('#recognizedRecipeText'), recognizeRecipeImages: document.querySelector('#recognizeRecipeImages'), ocrStatus: document.querySelector('#ocrStatus'), recipeImportFile: document.querySelector('#recipeImportFile'), backupRestoreFile: document.querySelector('#backupRestoreFile'), createBackupBtn: document.querySelector('#createBackupBtn'), restoreBackupBtn: document.querySelector('#restoreBackupBtn'), exportPersonalRecipesBtn: document.querySelector('#exportPersonalRecipesBtn'), importRecipeBtn: document.querySelector('#importRecipeBtn'), shareRecipeDialog: document.querySelector('#shareRecipeDialog'), shareRecipeName: document.querySelector('#shareRecipeName'), shareIncludeNotes: document.querySelector('#shareIncludeNotes'), shareRecipeJsonBtn: document.querySelector('#shareRecipeJsonBtn'), shareRecipeTextBtn: document.querySelector('#shareRecipeTextBtn'), restoreBackupDialog: document.querySelector('#restoreBackupDialog'), restoreBackupForm: document.querySelector('#restoreBackupForm'), backupSummary: document.querySelector('#backupSummary'), cancelRestoreBackup: document.querySelector('#cancelRestoreBackup'), hiddenRecipesBtn: document.querySelector('#hiddenRecipesBtn'), hiddenRecipesDialog: document.querySelector('#hiddenRecipesDialog'), hiddenRecipesList: document.querySelector('#hiddenRecipesList'), restoreAllHiddenBtn: document.querySelector('#restoreAllHiddenBtn'), wakeLockMode: document.querySelector('#wakeLockMode'), wakeLockStatus: document.querySelector('#wakeLockStatus'), alarmSoundToggle: document.querySelector('#alarmSoundToggle'), alarmVolume: document.querySelector('#alarmVolume'), testBellBtn: document.querySelector('#testBellBtn'), activeProfileName: document.querySelector('#activeProfileName'), manageProfilesBtn: document.querySelector('#manageProfilesBtn'), profilesDialog: document.querySelector('#profilesDialog'), profilesList: document.querySelector('#profilesList'), addProfileBtn: document.querySelector('#addProfileBtn'), addKitchenProfileBtn: document.querySelector('#addKitchenProfileBtn'), profileSetupDialog: document.querySelector('#profileSetupDialog'), profileSetupForm: document.querySelector('#profileSetupForm'), profileSetupName: document.querySelector('#profileSetupName'), importProfileBtn: document.querySelector('#importProfileBtn'), profileImportFile: document.querySelector('#profileImportFile'), profileStorageSummary: document.querySelector('#profileStorageSummary'), headerProfileBtn: document.querySelector('#headerProfileBtn'), headerProfileAvatar: document.querySelector('#headerProfileAvatar'), headerProfileName: document.querySelector('#headerProfileName'), profileQuickMenu: document.querySelector('#profileQuickMenu')
  };

  init();

  function init() {
    if (!state.modules.length) state.modules.push(builtInModule);
    migrateState();
    ensurePersonalModule();
    saveState();
    applySettings();
    const versionLabel=document.querySelector('#engineVersionLabel'); if(versionLabel) versionLabel.textContent=ENGINE_VERSION;
    renderActiveProfile();
    showProfileSetupIfNeeded();
    bindEvents();
    refreshAll();
    startTimerTicker();
    registerServiceWorker();
    initBellAudio();
    updateWakeLock();
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && Array.isArray(parsed.modules)) return parsed;
    } catch (error) { console.warn('Unable to load saved state', error); }
    return { modules: [], favorites: [], recipeNotes: {}, hiddenRecipes: [], customCategories: [], timers: [], shoppingList: [], regularItems: [], stores: ['Unassigned','Costco','Walmart'], moduleSources: {}, settings: { darkMode: false, metricHelpers: false, accentColor: '#7b3f00', wakeLockMode: 'recipes-and-timers', alarmVolume: 0.85, alarmSoundEnabled: true } };
  }

  function saveState() { profileStore.saveCombinedState(state); }

  function bindEvents() {
    els.headerProfileBtn?.addEventListener('click', event => {
      event.stopPropagation();
      toggleProfileQuickMenu();
    });
    els.profileQuickMenu?.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', event => {
      if (!event.target.closest('.profile-more')) closeProfileMoreMenus();
      if (!event.target.closest('.header-profile-wrap')) closeProfileQuickMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      closeProfileMoreMenus();
      closeProfileQuickMenu();
    });
    els.profilesDialog?.addEventListener('close', () => { closeProfileMoreMenus(); closeProfileQuickMenu(); });
    els.menuBtn.addEventListener('click', () => toggleSidebar(true));
    els.scrim.addEventListener('click', () => toggleSidebar(false));
    els.searchInput.addEventListener('input', renderRecipeList);
    els.clearSearchBtn.addEventListener('click', () => { els.searchInput.value = ''; renderRecipeList(); els.searchInput.focus(); });
    els.moduleFilter.addEventListener('change', renderRecipeList);
    els.categoryFilter.addEventListener('change', renderRecipeList);
    els.favoritesFilterBtn.addEventListener('click', () => { currentView = currentView === 'favorites' ? 'all' : 'favorites'; selectedCategory = null; syncFavoriteFilterButton(); renderRecipeList(); });
    els.clearFiltersBtn.addEventListener('click', clearRecipeFilters);
    els.backBtn.addEventListener('click', showList);
    
    els.moduleImportBtn.addEventListener('click', openImportOptions);
    els.menuImportModule.addEventListener('click', () => { toggleSidebar(false); openImportOptions(); });
    els.browseGithubBtn.addEventListener('click', () => { els.importOptionsDialog.close(); currentView='modules'; showModules(); loadModuleCatalog(); });
    els.importFileBtn.addEventListener('click', () => { els.importOptionsDialog.close(); els.moduleFile.click(); });
    els.moduleFile.addEventListener('change', importModules);
    els.settingsBtn.addEventListener('click', () => { toggleSidebar(false); renderHiddenRecipes(); renderActiveProfile(); els.settingsDialog.showModal(); });
    els.hiddenRecipesBtn?.addEventListener('click', () => { renderHiddenRecipes(); els.settingsDialog.close(); els.hiddenRecipesDialog.showModal(); });
    els.restoreAllHiddenBtn?.addEventListener('click', restoreAllHiddenRecipes);
    els.darkModeToggle.addEventListener('change', () => { state.settings.darkMode = els.darkModeToggle.checked; applySettings(); saveState(); });
    els.metricToggle.addEventListener('change', () => { state.settings.metricHelpers = els.metricToggle.checked; saveState(); if (selectedRecipeKey) renderRecipeDetail(); });
    els.wakeLockMode?.addEventListener('change', () => { state.settings.wakeLockMode = els.wakeLockMode.value; saveState(); updateWakeLock(); });
    els.alarmSoundToggle?.addEventListener('change', () => { state.settings.alarmSoundEnabled = els.alarmSoundToggle.checked; saveState(); if (!state.settings.alarmSoundEnabled) stopBell(); });
    els.alarmVolume?.addEventListener('input', () => { state.settings.alarmVolume = Number(els.alarmVolume.value); if (bellAudio) bellAudio.volume = state.settings.alarmVolume; saveState(); });
    els.testBellBtn?.addEventListener('click', testBell);
    els.manageProfilesBtn?.addEventListener('click', () => { renderProfiles(); els.settingsDialog.close(); els.profilesDialog.showModal(); });
    els.addProfileBtn?.addEventListener('click', createProfile);
    els.importProfileBtn?.addEventListener('click', () => els.profileImportFile?.click());
    els.profileImportFile?.addEventListener('change', importProfileFile);
    els.addKitchenProfileBtn?.addEventListener('click', createKitchenProfile);
    els.profileSetupForm?.addEventListener('submit', completeInitialProfileSetup);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updateWakeLock(); else releaseWakeLock(); });
    window.addEventListener('pageshow', updateWakeLock);
    window.addEventListener('pagehide', releaseWakeLock);
    els.createRecipeBtn.addEventListener('click', () => { toggleSidebar(false); els.recipeCreateDialog.showModal(); });
    els.manualRecipeBtn.addEventListener('click', () => { els.recipeCreateDialog.close(); openRecipeEditor(); });
    els.pasteRecipeBtn.addEventListener('click', () => { els.recipeCreateDialog.close(); els.pasteRecipeForm.reset(); els.pasteRecipeDialog.showModal(); });
    els.imageRecipeBtn.addEventListener('click', () => { els.recipeCreateDialog.close(); els.imageRecipeForm.reset(); els.recipeImagePreviews.innerHTML = ''; els.ocrStatus.textContent = ''; els.imageRecipeDialog.showModal(); });
    document.querySelector('#closePasteRecipe').addEventListener('click', () => els.pasteRecipeDialog.close());
    document.querySelector('#cancelPasteRecipe').addEventListener('click', () => els.pasteRecipeDialog.close());
    document.querySelector('#closeImageRecipe').addEventListener('click', () => els.imageRecipeDialog.close());
    document.querySelector('#cancelImageRecipe').addEventListener('click', () => els.imageRecipeDialog.close());
    els.pasteRecipeForm.addEventListener('submit', parsePastedRecipe);
    els.imageRecipeForm.addEventListener('submit', parseRecognizedRecipe);
    els.recipeImageFiles.addEventListener('change', previewRecipeImages);
    els.closeRecipeEditor.addEventListener('click', closeRecipeEditor);
    els.cancelRecipeEditor.addEventListener('click', closeRecipeEditor);
    els.recipeEditorForm.addEventListener('submit', saveRecipeFromEditor);
    els.accentColorInput.addEventListener('input', () => setAccentColor(els.accentColorInput.value));
    els.timersBtn.addEventListener('click', () => { els.timerDock.hidden = !els.timerDock.hidden; renderTimers(); });
    els.closeTimerDock.addEventListener('click', () => { els.timerDock.hidden = true; });
    els.addCustomCategory.addEventListener('click', () => { els.customCategoryInput.hidden = !els.customCategoryInput.hidden; if (!els.customCategoryInput.hidden) els.customCategoryInput.focus(); });
    document.querySelectorAll('.color-swatch').forEach(button => button.addEventListener('click', () => setAccentColor(button.dataset.color)));
    els.shoppingStoreFilter.addEventListener('change', renderShoppingList);
    els.addShoppingItemBtn.addEventListener('click', openShoppingItemDialog);
    document.querySelector('#cancelShoppingItem').addEventListener('click', () => els.shoppingItemDialog.close());
    els.shoppingItemForm.addEventListener('submit', addManualShoppingItem);
    els.regularItemsBtn.addEventListener('click', showRegularItems);
    els.shareShoppingBtn.addEventListener('click', shareShoppingList);
    els.clearCheckedBtn.addEventListener('click', () => { state.shoppingList = state.shoppingList.filter(x => !x.checked); saveState(); renderShoppingList(); renderCounts(); });
    els.confirmIngredientAdd.addEventListener('click', confirmAddIngredients);
    els.catalogRefreshBtn.addEventListener('click', loadModuleCatalog);
    els.manageStoresBtn.addEventListener('click', manageStores);
    els.forceUpdateBtn?.addEventListener('click', forceAppUpdate);
    els.createBackupBtn?.addEventListener('click', createFullBackup);
    els.restoreBackupBtn?.addEventListener('click', () => els.backupRestoreFile.click());
    els.exportPersonalRecipesBtn?.addEventListener('click', exportPersonalRecipes);
    els.importRecipeBtn?.addEventListener('click', () => els.recipeImportFile.click());
    els.recipeImportFile?.addEventListener('change', importSharedRecipe);
    els.backupRestoreFile?.addEventListener('change', prepareBackupRestore);
    els.restoreBackupForm?.addEventListener('submit', restoreSelectedBackup);
    els.cancelRestoreBackup?.addEventListener('click', () => els.restoreBackupDialog.close());
    els.shareRecipeJsonBtn?.addEventListener('click', () => shareSelectedRecipe('json'));
    els.shareRecipeTextBtn?.addEventListener('click', () => shareSelectedRecipe('text'));


    document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => {
      if (!button.dataset.view) return;
      currentView = button.dataset.view;
      selectedCategory = null;
      document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x === button));
      document.querySelectorAll('.category-button').forEach(x => x.classList.remove('active'));
      toggleSidebar(false);
      syncFavoriteFilterButton();
      if (currentView === 'modules') showModules(); else if (currentView === 'shopping') showShopping(); else showList();
    }));
  }


  function profileInitials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase() || '').join('') || '?';
  }

  function renderActiveProfile() {
    const profile = profileStore.getActiveProfileMeta();
    const displayName = profile?.kind === 'household' ? 'Shared Kitchen' : (profile?.displayName || 'My Profile');
    if (els.activeProfileName) els.activeProfileName.textContent = displayName;
    const menuLabel = document.querySelector('#menuProfileName');
    if (menuLabel) menuLabel.textContent = displayName;
    if (els.headerProfileName) els.headerProfileName.textContent = displayName;
    if (els.headerProfileAvatar) {
      els.headerProfileAvatar.textContent = profile?.kind === 'household' ? '⌂' : profileInitials(displayName);
      els.headerProfileAvatar.style.setProperty('--profile-color', profile?.color || '#7b3f00');
    }
    renderProfileQuickMenu();
  }

  function renderProfileQuickMenu() {
    if (!els.profileQuickMenu) return;
    const activeId = profileStore.getActiveProfileMeta()?.profileId;
    els.profileQuickMenu.innerHTML = '';
    profileStore.listProfiles().forEach(profile => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `profile-quick-item${profile.profileId === activeId ? ' active' : ''}`;
      button.setAttribute('role', 'menuitem');
      const name = profile.kind === 'household' ? 'Shared Kitchen' : profile.displayName;
      button.innerHTML = `<span class="profile-quick-avatar" style="--profile-color:${escapeHtml(profile.color || '#7b3f00')}">${profile.kind === 'household' ? '⌂' : escapeHtml(profileInitials(name))}</span><span>${escapeHtml(name)}</span>${profile.profileId === activeId ? '<span class="profile-quick-check">✓</span>' : ''}`;
      button.addEventListener('click', () => {
        closeProfileQuickMenu();
        if (profile.profileId === activeId) return;
        saveState();
        profileStore.switchProfile(profile.profileId);
        location.reload();
      });
      els.profileQuickMenu.appendChild(button);
    });
    const divider = document.createElement('div');
    divider.className = 'profile-quick-divider';
    els.profileQuickMenu.appendChild(divider);
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.className = 'profile-quick-manage';
    manage.setAttribute('role', 'menuitem');
    manage.textContent = 'Manage profiles…';
    manage.addEventListener('click', () => {
      closeProfileQuickMenu();
      renderProfiles();
      els.profilesDialog?.showModal();
    });
    els.profileQuickMenu.appendChild(manage);
  }

  function toggleProfileQuickMenu() {
    if (!els.profileQuickMenu) return;
    const willOpen = els.profileQuickMenu.hidden;
    closeProfileMoreMenus();
    els.profileQuickMenu.hidden = !willOpen;
    els.headerProfileBtn?.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) renderProfileQuickMenu();
  }

  function closeProfileQuickMenu() {
    if (els.profileQuickMenu) els.profileQuickMenu.hidden = true;
    els.headerProfileBtn?.setAttribute('aria-expanded', 'false');
  }

  function closeProfileMoreMenus(except = null) {
    document.querySelectorAll('details.profile-more[open]').forEach(details => {
      if (details !== except) details.open = false;
    });
  }

  function showProfileSetupIfNeeded() {
    const profile = profileStore.getActiveProfileMeta();
    if (!profile || profile.setupComplete !== false || !els.profileSetupDialog) return;
    els.profileSetupName.value = profile.displayName === 'My Profile' ? '' : profile.displayName;
    els.profileSetupDialog.showModal();
    setTimeout(() => els.profileSetupName.focus(), 50);
  }

  function completeInitialProfileSetup(event) {
    event.preventDefault();
    const profile = profileStore.getActiveProfileMeta();
    const name = els.profileSetupName.value.trim() || 'My Profile';
    try { profileStore.completeProfileSetup(profile.profileId, name); els.profileSetupDialog.close(); renderActiveProfile(); }
    catch (error) { alert(error.message); }
  }

  function renderProfiles() {
    if (!els.profilesList) return;
    const activeId = profileStore.getActiveProfileMeta()?.profileId;
    const profiles = profileStore.listProfiles();
    els.profilesList.innerHTML = '';
    profiles.forEach(profile => {
      const summary = profileStore.profileSummary(profile.profileId);
      const row = document.createElement('section');
      row.className = `profile-row${profile.profileId===activeId?' active-profile':''}${profile.kind==='household'?' household-profile':''}`;
      const lastUsed = profile.lastUsedAt ? formatProfileDate(profile.lastUsedAt) : 'Not yet';
      row.innerHTML = `<div class="profile-avatar" style="--profile-color:${escapeHtml(profile.color || '#7b3f00')}">${profile.kind==='household'?'⌂':escapeHtml(profileInitials(profile.displayName))}</div><div class="profile-row-main"><div class="profile-name-line"><strong>${escapeHtml(profile.kind==='household'?'Shared Kitchen':profile.displayName)}</strong>${profile.kind==='household'?'<span class="profile-kind">Household</span>':''}${profile.profileId===activeId?'<span class="profile-current">Current</span>':''}</div><div class="profile-metrics"><span><b>${summary.personalRecipes}</b> recipes</span><span><b>${summary.favorites}</b> favorites</span><span><b>${summary.notes}</b> notes</span><span><b>${summary.shoppingItems}</b> shopping</span><span><b>${summary.hidden}</b> hidden</span><span><b>${summary.ratings}</b> ratings</span></div><div class="profile-last-used">Last used: ${escapeHtml(lastUsed)}</div></div><div class="profile-row-actions"></div>`;
      const actions = row.querySelector('.profile-row-actions');
      if (profile.profileId !== activeId) {
        const switchBtn=document.createElement('button'); switchBtn.type='button'; switchBtn.className='button'; switchBtn.textContent='Use profile';
        switchBtn.addEventListener('click',()=>{ saveState(); profileStore.switchProfile(profile.profileId); location.reload(); }); actions.appendChild(switchBtn);
      }
      const exportBtn=document.createElement('button'); exportBtn.type='button'; exportBtn.className='button secondary'; exportBtn.textContent='Export profile'; exportBtn.addEventListener('click',()=>exportProfile(profile)); actions.appendChild(exportBtn);
      const more=document.createElement('details'); more.className='profile-more'; more.innerHTML='<summary class="button secondary">More</summary><div class="profile-more-menu"></div>';
      more.addEventListener('toggle', () => { if (more.open) { closeProfileMoreMenus(more); closeProfileQuickMenu(); } });
      const menu=more.querySelector('.profile-more-menu');
      const renameBtn=document.createElement('button'); renameBtn.type='button'; renameBtn.className='button secondary'; renameBtn.textContent='Rename'; renameBtn.addEventListener('click',()=>renameProfile(profile)); menu.appendChild(renameBtn);
      const duplicateBtn=document.createElement('button'); duplicateBtn.type='button'; duplicateBtn.className='button secondary'; duplicateBtn.textContent='Duplicate'; duplicateBtn.addEventListener('click',()=>duplicateProfile(profile)); menu.appendChild(duplicateBtn);
      if (profile.profileId !== activeId) { const deleteBtn=document.createElement('button'); deleteBtn.type='button'; deleteBtn.className='button danger'; deleteBtn.textContent='Delete'; deleteBtn.addEventListener('click',()=>deleteProfile(profile)); menu.appendChild(deleteBtn); }
      actions.appendChild(more);
      els.profilesList.appendChild(row);
    });
    if (els.addKitchenProfileBtn) els.addKitchenProfileBtn.hidden = profiles.some(profile => profile.kind === 'household');
    if (els.profileStorageSummary) {
      const totals = profiles.reduce((acc, profile) => { const x=profileStore.profileSummary(profile.profileId); acc.recipes+=x.personalRecipes; acc.shopping+=x.shoppingItems; return acc; }, {recipes:0,shopping:0});
      const backupDate = state.backupMeta?.lastBackupAt || state.backupMeta?.createdAt;
      els.profileStorageSummary.innerHTML = `<strong>Local profile storage</strong><span>${profiles.length} profile${profiles.length===1?'':'s'} · ${totals.recipes} personal recipe${totals.recipes===1?'':'s'} · ${totals.shopping} shopping item${totals.shopping===1?'':'s'}</span><span>Last full backup: ${backupDate ? escapeHtml(formatProfileDate(backupDate)) : 'Never'}</span><span>Cloud backup: Not connected</span>`;
    }
  }

  function formatProfileDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return sameDay ? `Today at ${date.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}` : date.toLocaleString([], { dateStyle:'medium', timeStyle:'short' });
  }

  function createProfile() {
    const name = prompt('Name the new profile:'); if (!name) return;
    try { profileStore.createProfile(name); renderProfiles(); } catch (error) { alert(error.message); }
  }

  function createKitchenProfile() {
    if (profileStore.listProfiles().some(profile => profile.kind === 'household')) { alert('A household Kitchen profile already exists on this device.'); return; }
    const name = prompt('Name the household profile:', 'Kitchen'); if (!name) return;
    try { profileStore.createProfile(name, { kind:'household', color:'#0f766e' }); renderProfiles(); } catch (error) { alert(error.message); }
  }

  function renameProfile(profile) {
    const name = prompt('Rename profile:', profile.displayName); if (!name || name.trim() === profile.displayName) return;
    try { profileStore.renameProfile(profile.profileId, name); renderProfiles(); renderActiveProfile(); } catch (error) { alert(error.message); }
  }

  function duplicateProfile(profile) {
    const name = prompt('Name the duplicate profile:', `${profile.displayName} Copy`); if (!name) return;
    try { profileStore.duplicateProfile(profile.profileId, name); renderProfiles(); } catch (error) { alert(error.message); }
  }

  async function exportProfile(profile) {
    const summary = profileStore.profileSummary(profile.profileId);
    const proceed = confirm(`Export ${profile.displayName}?\n\nIncludes:\n• ${summary.personalRecipes} personal recipes\n• ${summary.favorites} favorites\n• ${summary.notes} notes\n• ${summary.shoppingItems} shopping items\n• hidden recipes, ratings, stores, and profile settings\n\nShared public modules are not included.`);
    if (!proceed) return;
    try {
      const payload = profileStore.exportProfile(profile.profileId);
      payload.environment = { engineMinimumVersion:'0.10.0', installedModules:(state.modules || []).filter(module => module.moduleId !== 'my-recipes').map(module => ({ moduleId:module.moduleId, name:module.name, version:module.version, source:state.moduleSources?.[module.moduleId] || null })) };
      const filename = `${profile.displayName.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'') || 'Profile'}-${new Date().toISOString().slice(0,10)}.kcprofile`;
      await deliverFile(filename, JSON.stringify(payload, null, 2));
    } catch (error) { alert(`Profile export failed: ${error.message}`); }
  }

  async function importProfileFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const existing = profileStore.listProfiles().find(profile => profile.profileId === payload?.profile?.profileId);
      let mode = 'add-copy';
      if (existing) {
        const replace = confirm(`A profile with the same account ID already exists on this device:\n\n${existing.displayName}\n\nChoose OK to replace its local data with the imported copy. Choose Cancel to import it as a separate copy.`);
        mode = replace ? 'replace' : 'add-copy';
      }
      const imported = profileStore.importProfile(payload, mode);
      renderProfiles();
      alert(`${imported.displayName} was imported successfully.${mode === 'replace' ? '' : '\n\nIt was added as a separate local profile.'}`);
    } catch (error) { alert(`Profile import failed: ${error.message}`); }
  }

  function deleteProfile(profile) {
    const summary = profileStore.profileSummary(profile.profileId);
    const confirmation = prompt(`Delete ${profile.displayName}?\n\nThis permanently removes from this device:\n• ${summary.personalRecipes} personal recipes\n• ${summary.favorites} favorites\n• ${summary.notes} notes\n• ${summary.shoppingItems} shopping items\n• ${summary.hidden} hidden recipe settings\n• ${summary.ratings} ratings\n\nExport the profile first if you may need it later.\n\nType the profile name exactly to confirm:`);
    if (confirmation !== profile.displayName) return;
    try { profileStore.deleteProfile(profile.profileId); renderProfiles(); } catch (error) { alert(error.message); }
  }

  function toggleSidebar(open) { els.sidebar.classList.toggle('open', open); els.scrim.classList.toggle('show', open); document.body.classList.toggle('menu-open', open); }

  function migrateState() {
    let changed = false;
    state.shoppingList = (state.shoppingList || []).map(item => {
      const next = { ...item, store: normalizeStore(item.store) };
      const cleanName = String(next.name || '').replace(/^of\s+/i, '').trim();
      if (cleanName !== next.name) { next.name = cleanName; changed = true; }
      if (next.quantity && next.name) {
        const escaped = next.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(`\\s+(?:of\\s+)?${escaped}(?:[, ].*)?$`, 'i');
        const shortened = String(next.quantity).replace(rx, '').trim();
        if (shortened && shortened !== next.quantity) { next.quantity = shortened; changed = true; }
      }
      return next;
    });
    if (changed) saveState();
  }

  function openImportOptions() { els.importOptionsDialog.showModal(); }

  async function forceAppUpdate() {
    try {
      localStorage.setItem(`${STORAGE_KEY}.preUpdate`, JSON.stringify({ createdAt:new Date().toISOString(), engineVersion:ENGINE_VERSION, state }));
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update()));
      }
      location.href = `${location.pathname}?app=${Date.now()}`;
    } catch { location.reload(); }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./service-worker.js?v=0.10.3').then(reg => reg.update()).catch(console.warn);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!sessionStorage.getItem('kc-reloaded')) {
        sessionStorage.setItem('kc-reloaded','1');
        location.reload();
      }
    });
  }

  function applySettings() {
    document.documentElement.dataset.theme = state.settings.darkMode ? 'dark' : 'light';
    els.darkModeToggle.checked = !!state.settings.darkMode;
    els.metricToggle.checked = !!state.settings.metricHelpers;
    if (els.wakeLockMode) els.wakeLockMode.value = state.settings.wakeLockMode || 'recipes-and-timers';
    if (els.alarmSoundToggle) els.alarmSoundToggle.checked = state.settings.alarmSoundEnabled !== false;
    if (els.alarmVolume) els.alarmVolume.value = String(state.settings.alarmVolume ?? 0.85);
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
    renderCategoryFilter();
    renderCategories();
    syncFavoriteFilterButton();
    renderRecipeList();
    renderModules();
    saveState();
  }

  function getAllRecipes(options = {}) {
    const recipes = engine.getRecipes(state.modules, options);
    return options.includeHidden ? recipes : recipes.filter(recipe => !state.hiddenRecipes.includes(recipe.key));
  }

  function renderCounts() {
    const recipes = getAllRecipes();
    els.moduleCount.textContent = `${state.modules.length} module${state.modules.length === 1 ? '' : 's'}`;
    els.navModuleCount.textContent = state.modules.length;
    els.allCount.textContent = recipes.length;
    els.favoriteCount.textContent = state.favorites.length;
    els.shoppingCount.textContent = state.shoppingList.filter(x=>!x.checked).length;
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

  function renderCategoryFilter() {
    const current = els.categoryFilter.value || 'all';
    const categories = [...new Set(getAllRecipes().map(recipe => recipe.category || 'Uncategorized'))].sort((a,b) => a.localeCompare(b));
    els.categoryFilter.innerHTML = '<option value="all">All categories</option>';
    categories.forEach(category => { const option=document.createElement('option'); option.value=category; option.textContent=category; els.categoryFilter.append(option); });
    els.categoryFilter.value = categories.includes(current) ? current : 'all';
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

  function syncFavoriteFilterButton() {
    const active = currentView === 'favorites';
    els.favoritesFilterBtn?.classList.toggle('active', active);
    els.favoritesFilterBtn?.setAttribute('aria-pressed', String(active));
    if (els.favoritesFilterBtn) els.favoritesFilterBtn.textContent = active ? '★ Favorites' : '☆ Favorites';
  }

  function clearRecipeFilters() {
    els.moduleFilter.value = 'all';
    els.categoryFilter.value = 'all';
    selectedCategory = null;
    if (currentView === 'category') currentView = 'all';
    document.querySelectorAll('.category-button').forEach(x => x.classList.remove('active'));
    renderRecipeList();
  }

  function renderRecipeList() {
    if (currentView === 'modules') return;
    const query = els.searchInput.value.trim().toLowerCase();
    const moduleId = els.moduleFilter.value;
    const selectedFilterCategory = currentView === 'category' ? selectedCategory : els.categoryFilter.value;
    let recipes = engine.filterRecipes(getAllRecipes(), { query, moduleId, category: selectedFilterCategory, favorites: currentView === 'favorites' ? state.favorites : null });

    els.viewTitle.textContent = currentView === 'favorites' ? 'Favorites' : currentView === 'category' ? selectedCategory : 'All recipes';
    els.viewSubtitle.textContent = `${recipes.length} recipe${recipes.length === 1 ? '' : 's'} shown.`;
    els.recipeGrid.innerHTML = '';
    els.emptyState.hidden = recipes.length > 0;

    recipes.sort((a,b) => a.name.localeCompare(b.name)).forEach(recipe => {
      const fragment = document.querySelector('#recipeCardTemplate').content.cloneNode(true);
      const card = fragment.querySelector('.recipe-card');
      fragment.querySelector('.recipe-category').textContent = recipe.category || 'Uncategorized';
      const favoriteButton = fragment.querySelector('.recipe-favorite');
      const isFavorite = state.favorites.includes(recipe.key);
      favoriteButton.textContent = isFavorite ? '★' : '☆';
      favoriteButton.setAttribute('aria-pressed', String(isFavorite));
      favoriteButton.setAttribute('aria-label', isFavorite ? `Remove ${recipe.name} from favorites` : `Add ${recipe.name} to favorites`);
      favoriteButton.addEventListener('click', event => { event.stopPropagation(); toggleFavoriteFromList(recipe.key); });
      fragment.querySelector('.recipe-name').textContent = recipe.name;
      fragment.querySelector('.recipe-description').textContent = recipe.description || 'No description yet.';
      const meta = fragment.querySelector('.recipe-meta');
      [recipe.prepTime && `Prep ${recipe.prepTime}`, recipe.cookTime && `Cook ${recipe.cookTime}`, recipe.yield && `${recipe.yield.amount} ${recipe.yield.unit}`].filter(Boolean).forEach(text => {
        const span = document.createElement('span'); span.textContent = text; meta.append(span);
      });
      fragment.querySelector('.recipe-source').textContent = recipe.moduleName;
      const openCard = () => { selectedRecipeKey = recipe.key; activeScale = 1; showDetail(); };
      card.addEventListener('click', openCard);
      card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCard(); } });
      els.recipeGrid.append(fragment);
    });
  }

  function recipeSearchText(recipe) { return engine.searchText(recipe); }

  function showList() {
    selectedRecipeKey = null;
    els.listPane.hidden = false; els.detailPane.hidden = true; els.modulesPane.hidden = true; els.shoppingPane.hidden = true;
    renderRecipeList(); updateWakeLock(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showDetail() {
    els.listPane.hidden = true; els.detailPane.hidden = false; els.modulesPane.hidden = true; els.shoppingPane.hidden = true;
    renderRecipeDetail(); updateWakeLock(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showModules() {
    selectedRecipeKey = null;
    els.listPane.hidden = true; els.detailPane.hidden = true; els.modulesPane.hidden = false; els.shoppingPane.hidden = true;
    renderModules(); updateWakeLock(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderRecipeDetail() {
    const recipe = getAllRecipes({ enabledOnly: false, includeOverridden: true }).find(r => r.key === selectedRecipeKey);
    if (!recipe) return showList();
    const favorite = state.favorites.includes(recipe.key);
    const yieldText = recipe.yield ? `${formatNumber(recipe.yield.amount * activeScale)} ${recipe.yield.unit}` : '';

    els.recipeDetail.innerHTML = `
      <section class="recipe-hero">
        <div class="recipe-hero-top">
          <div><div class="recipe-kicker">${escapeHtml(recipe.category || 'Uncategorized')}</div><h1>${escapeHtml(recipe.name)}</h1>${recipe.copiedFrom ? '<span class="modified-badge">Modified personal version</span>' : ''}</div>
        </div>
        <p class="recipe-summary">${escapeHtml(recipe.description || '')}</p>
        <div class="recipe-stats">
          ${recipe.prepTime ? `<span class="stat"><strong>Prep:</strong> ${escapeHtml(recipe.prepTime)}</span>` : ''}
          ${recipe.cookTime ? `<span class="stat"><strong>Cook:</strong> ${escapeHtml(recipe.cookTime)}</span>` : ''}
          ${yieldText ? `<span class="stat"><strong>Yield:</strong> ${escapeHtml(yieldText)}</span>` : ''}
        </div>
        <span class="module-badge">${escapeHtml(recipe.moduleName)} · ${escapeHtml(recipe.publisher || 'Unknown publisher')}</span>
        <div class="recipe-action-row"><button id="favoriteRecipeBtn" class="favorite-button">${favorite ? '★ Saved' : '☆ Favorite'}</button><button id="editRecipeBtn" class="button secondary">✎ Edit</button><button id="shareRecipeBtn" class="button secondary">Share recipe</button>${recipe.copiedFrom ? '<button id="viewOriginalBtn" class="button secondary">View original</button>' : ''}${recipe.moduleId === 'my-recipes' ? '<button id="deleteRecipeBtn" class="button danger">Delete recipe</button>' : '<button id="hideRecipeBtn" class="button danger">Hide recipe</button>'}</div>
      </section>
      <div class="scale-bar"><strong>Scale recipe:</strong>${[0.5,1,1.5,2,3].map(scale => `<button class="scale-button ${scale === activeScale ? 'active' : ''}" data-scale="${scale}">${scale}×</button>`).join('')}</div>
      <div class="recipe-layout">
        <section class="recipe-section"><div class="section-title-row"><h2>Ingredients</h2><button id="addIngredientsBtn" class="button secondary">Add to shopping list</button></div>${renderIngredientGroups(recipe)}</section>
        <section class="recipe-section"><h2>Instructions</h2><ol class="instruction-list">${(recipe.instructions || []).map((step,index) => `<li>${renderInstructionWithTimers(step, recipe, index)}</li>`).join('')}</ol></section>
      </div>
      <section class="recipe-section recipe-notes"><h2>My notes</h2><textarea id="recipeNotesInput" placeholder="Add changes, reminders, results, or ideas for next time…">${escapeHtml(state.recipeNotes[recipe.key] || '')}</textarea><div id="saveNoteStatus" class="save-note-status"></div></section>`;

    document.querySelector('#favoriteRecipeBtn').addEventListener('click', () => toggleFavorite(recipe.key));
    document.querySelector('#editRecipeBtn').addEventListener('click', () => openRecipeEditor(recipe));
    document.querySelector('#shareRecipeBtn').addEventListener('click', () => openShareRecipe(recipe));
    document.querySelector('#addIngredientsBtn').addEventListener('click', () => openIngredientShopping(recipe));
    document.querySelector('#viewOriginalBtn')?.addEventListener('click', () => { selectedRecipeKey = recipe.copiedFrom; renderRecipeDetail(); });
    document.querySelector('#deleteRecipeBtn')?.addEventListener('click', () => deletePersonalRecipe(recipe));
    document.querySelector('#hideRecipeBtn')?.addEventListener('click', () => hideModuleRecipe(recipe));
    document.querySelectorAll('.timer-link').forEach(button => button.addEventListener('click', () => offerTimer(button, recipe)));
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
    else if (typeof ingredient.quantity === 'number') amount = formatPracticalMeasurement(ingredient.scalable === false ? ingredient.quantity : ingredient.quantity * activeScale, ingredient.unit);
    const optional = ingredient.optional ? ' (optional)' : '';
    const metric = state.settings.metricHelpers ? metricHelper(ingredient, activeScale) : '';
    const unit = amount.includes('tablespoon') || amount.includes('teaspoon') || amount.includes(' cup') ? '' : ingredient.unit;
    return escapeHtml([amount, unit, ingredient.item].filter(Boolean).join(' ') + optional + metric);
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

  function formatPracticalMeasurement(value, unit = '') {
    const normalized = String(unit).toLowerCase().replace(/\./g, '');
    if (!['cup','cups'].includes(normalized)) return formatFraction(value);
    const eighths = Math.round(value * 8);
    if (Math.abs(value - eighths / 8) > 0.02) return formatFraction(value);
    const whole = Math.floor(eighths / 8);
    const rem = eighths % 8;
    const parts = [];
    if (whole) parts.push(String(whole));
    const cupMap = {1:'⅛',2:'¼',3:'¼ cup + 2 tablespoons',4:'½',5:'½ cup + 2 tablespoons',6:'¾',7:'¾ cup + 2 tablespoons'};
    if (rem === 3 || rem === 5 || rem === 7) {
      const prefix = whole ? `${whole} cup${whole === 1 ? '' : 's'} + ` : '';
      return prefix + cupMap[rem];
    }
    if (rem) parts.push(cupMap[rem]);
    return parts.join(' ') || '0';
  }

  function formatNumber(value) { return Number(value.toFixed(2)).toString(); }

  function toggleFavorite(key) {
    const index = state.favorites.indexOf(key);
    if (index >= 0) state.favorites.splice(index, 1); else state.favorites.push(key);
    saveState(); renderCounts(); renderRecipeDetail();
  }

  function toggleFavoriteFromList(key) {
    const index = state.favorites.indexOf(key);
    if (index >= 0) state.favorites.splice(index, 1); else state.favorites.push(key);
    saveState();
    renderCounts();
    renderRecipeList();
  }

  function cleanupRecipeReferences(key) {
    state.favorites = state.favorites.filter(item => item !== key);
    delete state.recipeNotes[key];
    state.timers = state.timers.filter(timer => timer.recipeKey !== key);
    state.shoppingList = state.shoppingList.filter(item => item.recipeKey !== key);
  }

  function deletePersonalRecipe(recipe) {
    if (recipe.moduleId !== 'my-recipes') return;
    if (!confirm(`Permanently delete “${recipe.name}”?

This removes the recipe, its favorite status, notes, and related personal metadata from this device.`)) return;
    const personal = ensurePersonalModule();
    personal.recipes = personal.recipes.filter(item => item.id !== recipe.id);
    cleanupRecipeReferences(recipe.key);
    state.hiddenRecipes = state.hiddenRecipes.filter(key => key !== recipe.key);
    selectedRecipeKey = null;
    saveState(); refreshAll(); showList();
  }

  function hideModuleRecipe(recipe) {
    if (recipe.moduleId === 'my-recipes') return;
    if (!confirm(`Hide “${recipe.name}”?

The recipe remains installed and can be restored from Settings → Hidden Recipes.`)) return;
    if (!state.hiddenRecipes.includes(recipe.key)) state.hiddenRecipes.push(recipe.key);
    selectedRecipeKey = null;
    saveState(); refreshAll(); showList();
  }

  function renderHiddenRecipes() {
    if (!els.hiddenRecipesList) return;
    const all = engine.getRecipes(state.modules, { enabledOnly: false, includeOverridden: true });
    const hidden = state.hiddenRecipes.map(key => all.find(recipe => recipe.key === key)).filter(Boolean);
    els.hiddenRecipesList.innerHTML = '';
    els.restoreAllHiddenBtn.disabled = hidden.length === 0;
    if (!hidden.length) { els.hiddenRecipesList.innerHTML = '<p class="module-meta">No hidden recipes.</p>'; return; }
    hidden.sort((a,b) => a.name.localeCompare(b.name)).forEach(recipe => {
      const row = document.createElement('div'); row.className = 'hidden-recipe-row';
      row.innerHTML = `<div><strong>${escapeHtml(recipe.name)}</strong><div class="module-meta">${escapeHtml(recipe.moduleName)}</div></div><button type="button" class="button secondary">Restore</button>`;
      row.querySelector('button').addEventListener('click', () => { state.hiddenRecipes = state.hiddenRecipes.filter(key => key !== recipe.key); saveState(); renderHiddenRecipes(); refreshAll(); });
      els.hiddenRecipesList.append(row);
    });
  }

  function restoreAllHiddenRecipes() {
    if (!state.hiddenRecipes.length) return;
    state.hiddenRecipes = []; saveState(); renderHiddenRecipes(); refreshAll();
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
    populateCategorySelect(recipe?.category || '');
    els.customCategoryInput.hidden = true; els.customCategoryInput.value = '';
    document.querySelector('#editDescription').value = recipe?.description || '';
    document.querySelector('#editNotes').value = recipe?.notes || '';
    document.querySelector('#editPrepTime').value = recipe?.prepTime || '';
    document.querySelector('#editCookTime').value = recipe?.cookTime || '';
    document.querySelector('#editYield').value = recipe?.yield ? `${recipe.yield.amount} ${recipe.yield.unit || ''}`.trim() : '';
    document.querySelector('#editTags').value = (recipe?.tags || []).join(', ');
    document.querySelector('#editIngredients').value = (recipe?.ingredientGroups || []).flatMap(group => [group.name && group.name !== 'Main' ? `[${group.name}]` : '', ...(group.ingredients || []).map(formatIngredientForEditor)]).filter(Boolean).join('\n');
    document.querySelector('#editInstructions').value = (recipe?.instructions || []).join('\n');
    els.recipeEditorDialog.showModal();
  }

  function fillRecipeEditorFromParsed(parsed) {
    openRecipeEditor();
    document.querySelector('#editName').value = parsed.name || '';
    if (parsed.category) populateCategorySelect(parsed.category);
    document.querySelector('#editDescription').value = parsed.description || '';
    document.querySelector('#editNotes').value = parsed.notes || '';
    document.querySelector('#editPrepTime').value = parsed.prepTime || '';
    document.querySelector('#editCookTime').value = parsed.cookTime || '';
    document.querySelector('#editYield').value = parsed.yieldText || '';
    document.querySelector('#editTags').value = (parsed.tags || []).join(', ');
    document.querySelector('#editIngredients').value = (parsed.ingredientGroups || []).length ? parsed.ingredientGroups.flatMap(group => [group.name !== 'Main' ? `[${group.name}]` : '', ...group.ingredients]).filter(Boolean).join('\n') : (parsed.ingredients || []).join('\n');
    document.querySelector('#editInstructions').value = (parsed.instructions || []).join('\n');
  }

  function parsePastedRecipe(event) {
    event.preventDefault();
    try {
      const parsed = engine.parseRecipeText(els.pastedRecipeText.value);
      els.pasteRecipeDialog.close();
      fillRecipeEditorFromParsed(parsed);
    } catch (error) { alert(error.message); }
  }

  function parseRecognizedRecipe(event) {
    event.preventDefault();
    try {
      const parsed = engine.parseRecipeText(els.recognizedRecipeText.value);
      els.imageRecipeDialog.close();
      fillRecipeEditorFromParsed(parsed);
    } catch (error) { alert(error.message); }
  }

  function previewRecipeImages() {
    els.recipeImagePreviews.innerHTML = '';
    [...els.recipeImageFiles.files].forEach(file => {
      const image = document.createElement('img');
      image.alt = file.name;
      image.src = URL.createObjectURL(file);
      image.addEventListener('load', () => URL.revokeObjectURL(image.src), { once: true });
      els.recipeImagePreviews.append(image);
    });
    els.ocrStatus.textContent = els.recipeImageFiles.files.length ? `${els.recipeImageFiles.files.length} image${els.recipeImageFiles.files.length === 1 ? '' : 's'} selected.` : '';
  }

  // OCR is owned by ocr-service.js. Keeping it outside app.js prevents duplicate
  // click handlers and lets the OCR worker lifecycle remain isolated.

  function formatIngredientForEditor(i) { return [i.displayQuantity ?? i.quantity ?? '', i.unit || '', i.item || ''].filter(x => x !== '').join(' '); }

  function saveRecipeFromEditor(event) {
    event.preventDefault();
    const personal = ensurePersonalModule();
    const sourceKey = document.querySelector('#editRecipeKey').value;
    const source = sourceKey ? getAllRecipes({enabledOnly:false, includeOverridden:true}).find(r => r.key === sourceKey) : null;
    const name = document.querySelector('#editName').value.trim();
    let id = source?.moduleId === 'my-recipes' ? source.id : uniqueRecipeId(slugify(name), personal.recipes);
    const yieldParts = document.querySelector('#editYield').value.trim().match(/^([0-9.]+)\s*(.*)$/);
    const recipe = {
      id, name,
      category: getEditorCategory(),
      description: document.querySelector('#editDescription').value.trim(), notes: document.querySelector('#editNotes').value.trim(),
      prepTime: document.querySelector('#editPrepTime').value.trim(), cookTime: document.querySelector('#editCookTime').value.trim(),
      yield: yieldParts ? { amount: Number(yieldParts[1]), unit: yieldParts[2] || 'servings' } : null,
      tags: document.querySelector('#editTags').value.split(',').map(x=>x.trim()).filter(Boolean),
      ingredientGroups: parseIngredientGroups(document.querySelector('#editIngredients').value),
      instructions: document.querySelector('#editInstructions').value.split('\n').map(x=>x.trim()).filter(Boolean),
      createdInApp: true, copiedFrom: source?.moduleId === 'my-recipes' ? source.copiedFrom : (source ? source.key : undefined)
    };
    const index = personal.recipes.findIndex(r => r.id === id);
    if (index >= 0) personal.recipes[index] = recipe; else personal.recipes.push(recipe);
    selectedRecipeKey = `my-recipes:${id}`;
    closeRecipeEditor(); refreshAll(); showDetail();
  }

  function allCategoryNames() {
    return [...new Set([...getAllRecipes({enabledOnly:false, includeOverridden:true}).map(r => r.category || 'Uncategorized'), ...(state.customCategories || [])])].sort((a,b)=>a.localeCompare(b));
  }

  function populateCategorySelect(selected='') {
    els.editCategory.innerHTML = '';
    allCategoryNames().forEach(category => { const option=document.createElement('option'); option.value=category; option.textContent=category; els.editCategory.append(option); });
    if (selected && !allCategoryNames().includes(selected)) { const option=document.createElement('option'); option.value=selected; option.textContent=selected; els.editCategory.append(option); }
    els.editCategory.value = selected || els.editCategory.options[0]?.value || 'Uncategorized';
  }

  function getEditorCategory() {
    const custom = els.customCategoryInput.value.trim();
    if (custom) {
      if (!state.customCategories.includes(custom)) state.customCategories.push(custom);
      return custom;
    }
    return els.editCategory.value || 'Uncategorized';
  }

  function renderInstructionWithTimers(step, recipe, stepIndex) {
    const escaped = escapeHtml(step);
    const pattern = /\b(?:(\d+)\s*(?:hours?|hrs?|hr)\s*(?:and\s*)?)?(\d+(?:\s*[–-]\s*\d+)?)\s*(minutes?|mins?|min)\b|\b(\d+)\s*(hours?|hrs?|hr)\b/gi;
    return escaped.replace(pattern, (match, hours, minutePart, _minuteUnit, hourOnly) => {
      let values=[];
      if (hourOnly) values=[Number(hourOnly)*60];
      else {
        const base=(Number(hours)||0)*60;
        const nums=String(minutePart).split(/[–-]/).map(x=>Number(x.trim()));
        values=nums.map(n=>base+n);
      }
      return `<button type="button" class="timer-link" data-minutes="${values.join(',')}" data-step="${stepIndex+1}" data-label="${escapeHtml(match)}">⏱ ${escapeHtml(match)}</button>`;
    });
  }

  function offerTimer(button, recipe) {
    const values=button.dataset.minutes.split(',').map(Number).filter(Number.isFinite);
    const label=button.dataset.label;
    const step=Number(button.dataset.step);
    if (values.length===1) return startTimer(values[0], recipe, step, label);
    els.rangeTimerLabel.textContent = `${recipe.name}, step ${step}: ${label}`;
    els.rangeTimerChoices.innerHTML='';
    values.forEach((minutes,index)=>{ const b=document.createElement('button'); b.type='button'; b.className='button'; b.textContent=index===0?`Check at ${minutes} minutes`:`Set ${minutes} minutes`; b.addEventListener('click',()=>{ els.rangeTimerDialog.close(); startTimer(minutes,recipe,step,label); }); els.rangeTimerChoices.append(b); });
    els.rangeTimerDialog.showModal();
  }

  function startTimer(minutes, recipe, step, label) {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    const timer={ id:`timer-${Date.now()}-${Math.random().toString(16).slice(2)}`, recipeKey:recipe.key, recipeName:recipe.name, step, label, durationMs:minutes*60000, endAt:Date.now()+minutes*60000, paused:false, remainingMs:minutes*60000, done:false };
    state.timers.push(timer); unlockBellAudio(); saveState(); els.timerDock.hidden=false; renderTimers(); updateWakeLock();
  }

  function startTimerTicker() {
    if (timerTicker) clearInterval(timerTicker);
    timerTicker=setInterval(()=>renderTimers(),1000);
    renderTimers();
  }

  function timerRemaining(timer) { return timer.paused ? timer.remainingMs : Math.max(0,timer.endAt-Date.now()); }
  function formatClock(ms) { const total=Math.ceil(ms/1000), h=Math.floor(total/3600), m=Math.floor((total%3600)/60), s=total%60; return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`; }

  function initBellAudio() {
    bellAudio = new Audio('./alarm-bell.wav?v=0.10.3');
    bellAudio.loop = true;
    bellAudio.preload = 'auto';
    bellAudio.volume = Number(state.settings.alarmVolume ?? 0.85);
  }

  async function unlockBellAudio() {
    if (!bellAudio) initBellAudio();
    if (!state.settings.alarmSoundEnabled) return;
    const previousVolume = bellAudio.volume;
    try {
      bellAudio.volume = 0.001;
      await bellAudio.play();
      bellAudio.pause();
      bellAudio.currentTime = 0;
    } catch (error) {
      console.warn('Timer bell needs a user tap before iOS will allow playback.', error);
    } finally {
      bellAudio.volume = previousVolume;
    }
  }

  async function startBell() {
    if (!state.settings.alarmSoundEnabled || document.visibilityState !== 'visible') return;
    if (!bellAudio) initBellAudio();
    bellAudio.volume = Number(state.settings.alarmVolume ?? 0.85);
    try { await bellAudio.play(); }
    catch (error) { console.warn('Unable to start timer bell. Use Test Bell in Settings once to enable sound.', error); }
  }

  function stopBell() {
    if (!bellAudio) return;
    bellAudio.pause();
    bellAudio.currentTime = 0;
  }

  async function testBell() {
    if (!bellAudio) initBellAudio();
    state.settings.alarmSoundEnabled = true;
    if (els.alarmSoundToggle) els.alarmSoundToggle.checked = true;
    saveState();
    bellAudio.volume = Number(state.settings.alarmVolume ?? 0.85);
    try {
      await bellAudio.play();
      els.testBellBtn.textContent = 'Bell enabled ✓';
      setTimeout(() => { if (!state.timers.some(timer => timer.done && !timer.dismissed)) stopBell(); els.testBellBtn.textContent = 'Test bell'; }, 2200);
    } catch (error) {
      alert('The bell could not start. Make sure media volume is turned up, then tap Test bell again.');
    }
  }

  function updateAlarmLoop() {
    const ringing = state.timers.some(timer => timer.done && !timer.dismissed);
    if (ringing) startBell(); else stopBell();
  }

  function shouldHoldWakeLock() {
    const mode = state.settings.wakeLockMode || 'recipes-and-timers';
    if (mode === 'never') return false;
    const viewingRecipe = !els.detailPane.hidden && !!selectedRecipeKey;
    const hasTimer = state.timers.some(timer => !timer.done || !timer.dismissed);
    return mode === 'recipes' ? viewingRecipe : viewingRecipe || hasTimer;
  }

  async function updateWakeLock() {
    if (!('wakeLock' in navigator)) {
      if (els.wakeLockStatus) els.wakeLockStatus.textContent = 'Screen wake lock is not supported on this device.';
      return;
    }
    if (document.visibilityState !== 'visible' || !shouldHoldWakeLock()) { await releaseWakeLock(); return; }
    if (wakeLockSentinel || wakeLockRequestPending) return;
    wakeLockRequestPending = true;
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      if (els.wakeLockStatus) els.wakeLockStatus.textContent = 'Screen will stay awake while cooking.';
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
        if (els.wakeLockStatus) els.wakeLockStatus.textContent = 'Wake lock released. It will reconnect when Kitchen Companion is active.';
        if (document.visibilityState === 'visible' && shouldHoldWakeLock()) setTimeout(updateWakeLock, 250);
      });
    } catch (error) {
      if (els.wakeLockStatus) els.wakeLockStatus.textContent = 'Could not keep the screen awake. Low Power Mode or an iOS restriction may be active.';
    } finally { wakeLockRequestPending = false; }
  }

  async function releaseWakeLock() {
    if (!wakeLockSentinel) return;
    const lock = wakeLockSentinel;
    wakeLockSentinel = null;
    try { await lock.release(); } catch (error) { console.warn('Unable to release wake lock', error); }
  }

  function announceFinishedTimer(timer) {
    startBell();
    if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 700]);
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Kitchen timer finished', { body: `${timer.recipeName}: ${timer.label}`, tag: timer.id, requireInteraction: true });
  }

  function renderTimers() {
    state.timers ||= [];
    let changed=false; const newlyFinished=[];
    state.timers.forEach(t=>{ if(!t.paused && !t.done && timerRemaining(t)<=0){t.done=true;t.dismissed=false;changed=true;newlyFinished.push(t);} });
    if(changed) saveState();
    newlyFinished.forEach(announceFinishedTimer); updateAlarmLoop();
    els.timerCount.textContent=state.timers.length; els.timerCount.hidden=state.timers.length===0;
    els.timerList.innerHTML='';
    if(!state.timers.length){ els.timerList.innerHTML='<p class="module-meta">No active timers.</p>'; return; }
    state.timers.forEach(timer=>{
      const card=document.createElement('div'); card.className=`timer-card ${timer.done?'done':''}`;
      const finished = timer.done && !timer.dismissed;
      card.innerHTML=`<div class="timer-name">${escapeHtml(timer.recipeName)}</div><div class="timer-step">Step ${timer.step} · ${escapeHtml(timer.label)}</div><div class="timer-time">${finished?'⏰ Finished':timer.done?'Alarm dismissed':formatClock(timerRemaining(timer))}</div><div class="timer-actions">${finished?'<button class="dismiss-timer button danger">Dismiss alarm</button>':`<button class="pause-timer">${timer.paused?'Resume':'Pause'}</button><button class="add-timer">+1 min</button>`}<button class="cancel-timer">${timer.done?'Remove':'Cancel'}</button></div>`;
      card.querySelector('.pause-timer')?.addEventListener('click',()=>{ if(timer.done)return; if(timer.paused){timer.endAt=Date.now()+timer.remainingMs;timer.paused=false;}else{timer.remainingMs=timerRemaining(timer);timer.paused=true;} saveState();renderTimers(); });
      card.querySelector('.add-timer')?.addEventListener('click',()=>{ timer.done=false; timer.dismissed=false; if(timer.paused) timer.remainingMs+=60000; else timer.endAt=Math.max(Date.now(),timer.endAt)+60000; saveState();renderTimers(); });
      card.querySelector('.dismiss-timer')?.addEventListener('click',()=>{ timer.dismissed=true; saveState(); updateAlarmLoop(); renderTimers(); updateWakeLock(); });
      card.querySelector('.cancel-timer').addEventListener('click',()=>{ state.timers=state.timers.filter(t=>t.id!==timer.id); saveState();updateAlarmLoop();renderTimers();updateWakeLock(); });
      els.timerList.append(card);
    });
  }

  function parseIngredientGroups(text) {
    const groups = []; let current = { name: 'Main', ingredients: [] }; groups.push(current);
    String(text || '').split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
      const heading = line.match(/^\[(.+)]$/) || line.match(/^(?:for|to make)\s+(.+):$/i);
      if (heading) { current = { name: heading[1].trim(), ingredients: [] }; groups.push(current); }
      else current.ingredients.push(parseIngredientLine(line));
    });
    return groups.filter(group => group.ingredients.length);
  }

  function parseIngredientLine(line) {
    const normalized = line.replace(/^[-•]\s*/, '');
    const match = normalized.match(/^(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+|[⅛¼⅓⅜½⅝⅔¾⅞])\s+([^\s]+)?\s*(.*)$/);
    if (!match) return { quantity:null, unit:'', item:normalized, scalable:false };
    const quantity = parseQuantity(match[1]); const unit = match[2] || ''; const item = match[3] || unit;
    return { quantity, unit: item === unit ? '' : unit, item, scalable: Number.isFinite(quantity) };
  }
  function parseQuantity(text) { const glyphs={'⅛':.125,'¼':.25,'⅓':1/3,'⅜':.375,'½':.5,'⅝':.625,'⅔':2/3,'¾':.75,'⅞':.875}; if(glyphs[text]) return glyphs[text]; if(text.includes(' ')){const [a,b]=text.split(' '); return Number(a)+parseQuantity(b);} if(text.includes('/')){const [a,b]=text.split('/').map(Number); return a/b;} return Number(text); }
  function slugify(text) { return engine.slugify(text); }
  function uniqueRecipeId(base, recipes) { return engine.uniqueRecipeId(base, recipes); }

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
    saveState(); refreshAll();
    currentView = 'modules'; showModules();
  }

  function validateModule(module) { return engine.validateModule(module); }

  function renderModules() {
    els.moduleCards.innerHTML = '';
    state.modules.forEach(module => {
      const card = document.createElement('section');
      card.className = 'module-card';
      card.innerHTML = `
        <div><h2>${escapeHtml(module.name)}</h2><div class="module-meta">${escapeHtml(module.publisher || 'Unknown publisher')} · Module version ${escapeHtml(module.version)} · ${module.recipes.length} recipes</div><p>${escapeHtml(module.description || '')}</p></div>
        <div class="module-actions">
          <button class="button secondary toggle-module">${module.enabled === false ? 'Enable' : 'Disable'}</button>
          <button class="button secondary export-module">Export</button>${state.moduleSources[module.moduleId] ? '<button class="button secondary update-module">Check update</button>' : ''}
          ${module.moduleId === 'my-recipes' ? '' : '<button class="button danger remove-module">Uninstall</button>'}
        </div>`;
      card.querySelector('.toggle-module').addEventListener('click', () => { module.enabled = module.enabled === false; saveState(); refreshAll(); renderModules(); });
      card.querySelector('.export-module').addEventListener('click', () => exportModule(module));
      card.querySelector('.update-module')?.addEventListener('click', () => updateModuleFromSource(module));
      card.querySelector('.remove-module')?.addEventListener('click', () => {
        if (!confirm(`Uninstall ${module.name}?\n\nThis removes all ${module.recipes.length} imported recipes from this device. User-created recipes and copied personal variations are not part of the module and will remain. Favorites that point to this module will be cleaned up.`)) return;
        state.modules = state.modules.filter(m => m.moduleId !== module.moduleId); delete state.moduleSources[module.moduleId];
        state.favorites = state.favorites.filter(key => !key.startsWith(`${module.moduleId}:`));
        state.hiddenRecipes = state.hiddenRecipes.filter(key => !key.startsWith(`${module.moduleId}:`));
        saveState(); refreshAll(); renderModules();
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


  function showShopping() {
    selectedRecipeKey = null;
    els.listPane.hidden = true; els.detailPane.hidden = true; els.modulesPane.hidden = true; els.shoppingPane.hidden = false;
    populateStoreSelects(); renderShoppingList(); updateWakeLock(); window.scrollTo({top:0,behavior:'smooth'});
  }

  function normalizeStore(store) { return store && store.trim() ? store.trim() : 'Unassigned'; }
  function populateStoreSelects() {
    const stores=[...new Set(['Unassigned',...(state.stores||[]),...state.shoppingList.map(x=>normalizeStore(x.store))])];
    state.stores=stores;
    const fill=(select,all=false)=>{ const current=select.value; select.innerHTML=all?'<option value="all">All stores</option>':''; stores.forEach(st=>{const o=document.createElement('option');o.value=st;o.textContent=st;select.append(o)}); if([...select.options].some(o=>o.value===current))select.value=current; };
    fill(els.shoppingStoreFilter,true); fill(els.shoppingItemStore); fill(els.ingredientStoreSelect);
  }

  function renderShoppingList() {
    populateStoreSelects();
    const filter=els.shoppingStoreFilter.value||'all';
    const items=state.shoppingList.filter(x=>filter==='all'||normalizeStore(x.store)===filter);
    els.shoppingGroups.innerHTML='';
    if(!items.length){els.shoppingGroups.innerHTML='<div class="empty-state"><h2>Your list is empty</h2><p>Add items manually, from regular items, or from a recipe.</p></div>';return;}
    const groups={}; items.forEach(x=>(groups[normalizeStore(x.store)]??=[]).push(x));
    Object.entries(groups).forEach(([store,list])=>{
      const section=document.createElement('section');section.className='shopping-store-card';
      section.innerHTML=`<h2>${escapeHtml(store)}</h2><div class="shopping-items"></div>`;
      const box=section.querySelector('.shopping-items');
      list.forEach(item=>{
        const row=document.createElement('div');row.className=`shopping-row ${item.checked?'checked':''}`;
        row.innerHTML=`<label class="shopping-check"><input type="checkbox" ${item.checked?'checked':''}><span><strong>${escapeHtml(item.name)}</strong>${item.quantity?`<small>${escapeHtml(item.quantity)}</small>`:''}${item.source?`<em>${escapeHtml(item.source)}</em>`:''}</span></label><div class="shopping-row-actions"><select class="row-store" aria-label="Store for ${escapeHtml(item.name)}"></select><button class="text-button remove-shopping">Remove</button></div>`;
        const storeSelect=row.querySelector('.row-store');
        (state.stores||[]).forEach(st=>{const o=document.createElement('option');o.value=st;o.textContent=st;storeSelect.append(o)});
        storeSelect.value=normalizeStore(item.store);
        storeSelect.addEventListener('change',()=>{item.store=normalizeStore(storeSelect.value);saveState();renderShoppingList();});
        row.querySelector('input').addEventListener('change',e=>{item.checked=e.target.checked;saveState();renderShoppingList();renderCounts()});
        row.querySelector('.remove-shopping').addEventListener('click',()=>{state.shoppingList=state.shoppingList.filter(x=>x.id!==item.id);saveState();renderShoppingList();renderCounts()});
        box.append(row)
      });
      els.shoppingGroups.append(section);
    });
  }

  function openShoppingItemDialog() { populateStoreSelects(); els.shoppingItemForm.reset(); els.shoppingItemDialog.showModal(); }
  function addManualShoppingItem(event){event.preventDefault();const name=document.querySelector('#shoppingItemName').value.trim();const quantity=document.querySelector('#shoppingItemQuantity').value.trim();const store=normalizeStore(els.shoppingItemStore.value);if(!name)return;state.shoppingList.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),name,quantity,store,checked:false,source:'Manual'});if(document.querySelector('#saveRegularItem').checked&&!state.regularItems.some(x=>x.name.toLowerCase()===name.toLowerCase()))state.regularItems.push({id:String(Date.now()+Math.random()),name,quantity,store});saveState();els.shoppingItemDialog.close();renderShoppingList();renderCounts()}

  function showRegularItems(){populateStoreSelects();els.regularItemsList.innerHTML='';if(!state.regularItems.length){els.regularItemsList.innerHTML='<p>No regular items yet. Add a manual item and choose “Save as regular item.”</p>';}state.regularItems.forEach(item=>{const row=document.createElement('div');row.className='regular-item-row';row.innerHTML=`<span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.quantity||'')} · ${escapeHtml(item.store||'Unassigned')}</small></span><button type="button" class="button secondary">Add</button>`;row.querySelector('button').addEventListener('click',()=>{state.shoppingList.push({id:String(Date.now()+Math.random()),name:item.name,quantity:item.quantity,store:item.store,checked:false,source:'Regular item'});saveState();renderCounts();});els.regularItemsList.append(row)});els.regularItemsDialog.showModal()}

  function ingredientQuantityLabel(ingredient) {
    let amount='';
    if (ingredient.displayQuantity && ingredient.scalable === false) amount=ingredient.displayQuantity;
    else if (typeof ingredient.quantity === 'number') amount=formatFraction(ingredient.scalable === false ? ingredient.quantity : ingredient.quantity * activeScale);
    return [amount, ingredient.unit].filter(Boolean).join(' ').trim();
  }
  function cleanShoppingName(item) { return String(item || '').replace(/^of\s+/i,'').trim(); }
  function openIngredientShopping(recipe){
    populateStoreSelects();
    els.ingredientShoppingChoices.innerHTML='';
    (recipe.ingredientGroups||[]).forEach(group=>{
      if(group.name&&group.name!=='Main'){const h=document.createElement('h3');h.textContent=group.name;els.ingredientShoppingChoices.append(h)}
      ;(group.ingredients||[]).forEach(ing=>{
        const label=document.createElement('label');label.className='ingredient-choice';
        const name=cleanShoppingName(ing.item); const quantity=ingredientQuantityLabel(ing);
        label.innerHTML=`<input type="checkbox" data-item="${escapeHtml(name)}" data-quantity="${escapeHtml(quantity)}" checked><span>${formatIngredient(ing)}</span>`;
        els.ingredientShoppingChoices.append(label)
      })
    });
    els.confirmIngredientAdd.dataset.recipeName=recipe.name;
    els.ingredientShoppingDialog.showModal();
  }
  function confirmAddIngredients(){
    const store=normalizeStore(els.ingredientStoreSelect.value);const source=els.confirmIngredientAdd.dataset.recipeName;
    els.ingredientShoppingChoices.querySelectorAll('input:checked').forEach(input=>{
      state.shoppingList.push({id:String(Date.now()+Math.random()),name:cleanShoppingName(input.dataset.item),quantity:input.dataset.quantity,store,checked:false,source})
    });
    saveState();els.ingredientShoppingDialog.close();renderCounts();alert('Selected ingredients added to the shopping list.');
  }

  function manageStores() {
    const action = prompt(`Stores:
${(state.stores||[]).join('\n')}

Type a new store name to add it, or type REMOVE: Store Name to remove one.`);
    if (!action) return;
    if (/^REMOVE:/i.test(action)) {
      const name=action.replace(/^REMOVE:/i,'').trim();
      if (!name || name==='Unassigned') return alert('Unassigned cannot be removed.');
      state.stores=state.stores.filter(x=>x.toLowerCase()!==name.toLowerCase());
      state.shoppingList.forEach(x=>{if(normalizeStore(x.store).toLowerCase()===name.toLowerCase())x.store='Unassigned'});
      state.regularItems.forEach(x=>{if(normalizeStore(x.store).toLowerCase()===name.toLowerCase())x.store='Unassigned'});
    } else {
      const name=action.trim(); if(name && !state.stores.some(x=>x.toLowerCase()===name.toLowerCase()))state.stores.push(name);
    }
    saveState();populateStoreSelects();renderShoppingList();
  }

  function shoppingText(){const groups={};state.shoppingList.filter(x=>!x.checked).forEach(x=>(groups[normalizeStore(x.store)]??=[]).push(x));return Object.entries(groups).map(([store,items])=>`${store}\n${items.map(x=>`- ${x.quantity?x.quantity+' ':''}${x.name}`).join('\n')}`).join('\n\n')||'Shopping list is empty.'}
  async function shareShoppingList(){const text=shoppingText();if(navigator.share){try{await navigator.share({title:'Kitchen Companion Shopping List',text});return}catch(e){if(e.name==='AbortError')return}}try{await navigator.clipboard.writeText(text);alert('Shopping list copied to the clipboard.')}catch{prompt('Copy your shopping list:',text)}}

  async function loadModuleCatalog(){
    currentView='modules'; showModules();
    try{const res=await fetch(`${MODULE_CATALOG_URL}?v=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw new Error(`Catalog returned ${res.status}`);const catalog=await res.json();renderCatalog(catalog.modules||[])}catch(error){alert(`Could not load the GitHub module catalog: ${error.message}. Make sure catalog.json and the recipepack files are uploaded to the repository root.`)}
  }
  function replacementIds(entry, module) {
    return [...new Set([...(entry.replacesModuleIds || []), ...(module.replacesModuleIds || [])].filter(Boolean))];
  }
  function renderCatalog(modules){
    const existing=document.querySelector('#catalogSection');existing?.remove();
    const section=document.createElement('section');section.id='catalogSection';section.className='catalog-section';
    section.innerHTML='<h2>Available from GitHub</h2><div class="module-cards catalog-cards"></div>';
    const box=section.querySelector('.catalog-cards');
    modules.forEach(entry=>{
      const aliases=entry.replacesModuleIds||[];
      const installed=state.modules.find(m=>m.moduleId===entry.moduleId)||state.modules.find(m=>aliases.includes(m.moduleId));
      const card=document.createElement('section');card.className='module-card';
      const renamed=installed&&installed.moduleId!==entry.moduleId;
      const newer=installed&&compareVersions(entry.version,installed.version)>0;
      const action=!installed?'Install':renamed?'Replace old module':newer?'Update':'Reinstall';
      card.innerHTML=`<div><h2>${escapeHtml(entry.name)}</h2><div class="module-meta">${escapeHtml(entry.publisher||'Unknown publisher')} · Version ${escapeHtml(entry.version)} · ${entry.recipeCount||'?'} recipes</div><p>${escapeHtml(entry.description||'')}</p>${renamed?`<p><strong>Replaces installed module:</strong> ${escapeHtml(installed.name)}</p>`:''}</div><div class="module-actions"><button class="button catalog-install">${action}</button></div>`;
      card.querySelector('button').addEventListener('click',()=>installCatalogModule(entry));box.append(card)
    });
    els.modulesPane.prepend(section)
  }
  async function installCatalogModule(entry){
    try{
      const moduleUrl=(entry.url||'').replace('./modules/','./');
      const separator=moduleUrl.includes('?')?'&':'?';
      const res=await fetch(`${moduleUrl}${separator}kc=${Date.now()}`,{cache:'no-store'});
      if(!res.ok)throw new Error(`Module returned ${res.status}`);
      const module=await res.json();validateModule(module);
      if(entry.moduleId&&module.moduleId!==entry.moduleId)throw new Error(`Catalog expects moduleId ${entry.moduleId}, but the downloaded file contains ${module.moduleId}. Update catalog.json or the module file so they match.`);
      if(entry.version&&String(module.version)!==String(entry.version))throw new Error(`Catalog lists version ${entry.version}, but the downloaded file contains version ${module.version}. Update catalog.json so both versions match.`);
      const replacedIds=replacementIds(entry,module).filter(id=>id!==module.moduleId);
      const oldFavorites=new Set(state.favorites);
      state.modules=state.modules.filter(m=>!replacedIds.includes(m.moduleId));
      replacedIds.forEach(id=>delete state.moduleSources[id]);
      const idx=state.modules.findIndex(m=>m.moduleId===module.moduleId);
      if(idx>=0)state.modules[idx]=module;else state.modules.push(module);
      state.moduleSources[module.moduleId]=moduleUrl;
      if(replacedIds.length){
        state.favorites=[...new Set(state.favorites.map(key=>{
          const oldId=replacedIds.find(id=>key.startsWith(`${id}:`));
          return oldId?`${module.moduleId}:${key.slice(oldId.length+1)}`:key;
        }))];
      }
      saveState();refreshAll();showModules();
      alert(`${module.name} ${module.version} installed.${replacedIds.length?' The previous module was removed and matching favorites were preserved.':''}`)
    }catch(error){alert(`Could not install module: ${error.message}`)}
  }
  async function updateModuleFromSource(module){
    const url=state.moduleSources[module.moduleId];if(!url)return;
    try{
      const res=await fetch(`${MODULE_CATALOG_URL}?v=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw new Error(`Catalog returned ${res.status}`);
      const catalog=await res.json();
      const entry=(catalog.modules||[]).find(x=>x.moduleId===module.moduleId||(x.replacesModuleIds||[]).includes(module.moduleId));
      if(!entry)return alert("This installed module is no longer listed in the catalog. Uninstall it, or add its old moduleId to the new catalog entry's replacesModuleIds list.");
      const renamed=entry.moduleId!==module.moduleId;
      if(!renamed&&compareVersions(entry.version,module.version)<=0)return alert(`${module.name} is up to date (${module.version}).`);
      if(confirm(renamed?`Replace ${module.name} with ${entry.name} ${entry.version}?`:`Update ${module.name} from ${module.version} to ${entry.version}?`))await installCatalogModule(entry)
    }catch(error){alert(`Could not check for updates: ${error.message}`)}
  }
  function compareVersions(a,b){const aa=String(a).split('.').map(Number),bb=String(b).split('.').map(Number);for(let i=0;i<Math.max(aa.length,bb.length);i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return d}return 0}


  let pendingBackup = null;

  function safeFilename(name) {
    return String(name || 'recipe').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'recipe';
  }

  async function deliverFile(filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const file = new File([blob], filename, { type: mime });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return; } catch (error) { if (error.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openShareRecipe(recipe) {
    selectedRecipeKey = recipe.key;
    els.shareRecipeName.textContent = recipe.name;
    els.shareIncludeNotes.checked = false;
    els.shareRecipeDialog.showModal();
  }

  function recipePlainText(recipe, includeNotes = false) {
    const lines = [recipe.name, ''];
    if (recipe.category) lines.push(`Category: ${recipe.category}`);
    if (recipe.prepTime) lines.push(`Prep time: ${recipe.prepTime}`);
    if (recipe.cookTime) lines.push(`Cook time: ${recipe.cookTime}`);
    if (recipe.yield) lines.push(`Yield: ${recipe.yield.amount ?? ''} ${recipe.yield.unit ?? ''}`.trim());
    if (recipe.description) lines.push('', recipe.description);
    lines.push('', 'Ingredients');
    (recipe.ingredientGroups || []).forEach(group => { if (group.name && group.name !== 'Main') lines.push('', group.name); (group.ingredients || []).forEach(i => lines.push(`- ${[i.displayQuantity || (i.quantity ?? ''), i.unit, i.item].filter(Boolean).join(' ')}`)); });
    lines.push('', 'Instructions'); (recipe.instructions || []).forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    if (includeNotes && state.recipeNotes[recipe.key]) lines.push('', 'My notes', state.recipeNotes[recipe.key]);
    return lines.join('\n');
  }

  async function shareSelectedRecipe(format) {
    const recipe = getAllRecipes({ enabledOnly:false, includeOverridden:true }).find(r => r.key === selectedRecipeKey); if (!recipe) return;
    const includeNotes = els.shareIncludeNotes.checked;
    els.shareRecipeDialog.close();
    if (format === 'text') return deliverFile(`${safeFilename(recipe.name)}.txt`, recipePlainText(recipe, includeNotes), 'text/plain');
    const payload = { format:'kitchen-companion-recipe', schemaVersion:1, exportedAt:new Date().toISOString(), recipe:{...recipe, key:undefined, moduleId:undefined, moduleName:undefined, publisher:undefined}, notes:includeNotes ? (state.recipeNotes[recipe.key] || '') : '' };
    await deliverFile(`${safeFilename(recipe.name)}.kcrecipe`, JSON.stringify(payload, null, 2));
  }

  async function importSharedRecipe(event) {
    const file = event.target.files[0]; event.target.value=''; if (!file) return;
    try { const payload=JSON.parse(await file.text()); const recipe=payload.format==='kitchen-companion-recipe'?payload.recipe:payload.recipe || payload; if (!recipe?.name || !Array.isArray(recipe.instructions)) throw new Error('This is not a valid shared recipe file.');
      const personal=ensurePersonalModule(); const copy={...recipe,id:uniqueRecipeId(slugify(recipe.name),personal.recipes),copiedFrom:null}; personal.recipes.push(copy); saveState(); refreshAll(); alert(`${copy.name} was imported into My Recipes.`);
    } catch(error){ alert(`Could not import recipe: ${error.message}`); }
  }

  function backupPayload() {
    return { format:'kitchen-companion-backup', schemaVersion:2, engineVersion:ENGINE_VERSION, createdAt:new Date().toISOString(), activeProfile:profileStore.getActiveProfileMeta(), state:JSON.parse(JSON.stringify(state)) };
  }

  async function createFullBackup() { const b=backupPayload(); await deliverFile(`Kitchen-Companion-Backup-${new Date().toISOString().slice(0,10)}.kcbackup`, JSON.stringify(b,null,2)); state.backupMeta.lastManualBackupAt=b.createdAt; saveState(); }
  async function exportPersonalRecipes() { const module=state.modules.find(m=>m.moduleId==='my-recipes'); const payload={format:'kitchen-companion-personal-recipes',schemaVersion:1,exportedAt:new Date().toISOString(),recipes:module?.recipes||[]}; await deliverFile(`My-Kitchen-Companion-Recipes-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2)); }

  async function prepareBackupRestore(event) {
    const file=event.target.files[0]; event.target.value=''; if(!file)return;
    try { const payload=JSON.parse(await file.text()); if(payload.format!=='kitchen-companion-backup' || !payload.state || !Array.isArray(payload.state.modules)) throw new Error('This is not a valid Kitchen Companion backup.'); pendingBackup=payload;
      const personal=payload.state.modules.find(m=>m.moduleId==='my-recipes'); els.backupSummary.innerHTML=`<strong>${escapeHtml(new Date(payload.createdAt).toLocaleString())}</strong><span>Personal recipes: <b>${personal?.recipes?.length||0}</b></span><span>Favorites: <b>${payload.state.favorites?.length||0}</b></span><span>Installed modules: <b>${payload.state.modules.length}</b></span>`; els.settingsDialog.close(); els.restoreBackupDialog.showModal();
    } catch(error){ alert(`Could not read backup: ${error.message}`); }
  }

  function mergeBackupState(current, incoming) {
    const result=JSON.parse(JSON.stringify(current)); const incomingPersonal=incoming.modules.find(m=>m.moduleId==='my-recipes'); const personal=result.modules.find(m=>m.moduleId==='my-recipes') || ensurePersonalModule();
    if(incomingPersonal){ const byId=new Map(personal.recipes.map(r=>[r.id,r])); incomingPersonal.recipes.forEach(r=>byId.set(r.id,r)); personal.recipes=[...byId.values()]; }
    result.favorites=[...new Set([...(result.favorites||[]),...(incoming.favorites||[])])]; result.recipeNotes={...(incoming.recipeNotes||{}),...(result.recipeNotes||{})}; result.customCategories=[...new Set([...(result.customCategories||[]),...(incoming.customCategories||[])])]; result.shoppingList=[...(result.shoppingList||[]),...(incoming.shoppingList||[])]; result.regularItems=[...(result.regularItems||[]),...(incoming.regularItems||[])]; result.stores=[...new Set([...(result.stores||[]),...(incoming.stores||[])])]; result.settings={...(incoming.settings||{}),...(result.settings||{})}; return result;
  }

  function restoreSelectedBackup(event) {
    event.preventDefault(); if(!pendingBackup)return; const mode=new FormData(els.restoreBackupForm).get('restoreMode');
    try { localStorage.setItem(`${STORAGE_KEY}.rollback`, JSON.stringify(state)); const restored=mode==='replace'?pendingBackup.state:mergeBackupState(state,pendingBackup.state); if(!Array.isArray(restored.modules))throw new Error('Backup validation failed.'); Object.keys(state).forEach(key => delete state[key]); Object.assign(state, restored); saveState(); pendingBackup=null; els.restoreBackupDialog.close(); alert('Backup restored into the current profile. Kitchen Companion will reload now.'); location.reload(); } catch(error){ alert(`Restore failed: ${error.message}`); }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }
})();
