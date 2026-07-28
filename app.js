(() => {
  'use strict';

  const STORAGE_KEY = 'recipeEngineState.v1';
  const ENGINE_VERSION = '0.16.7';
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
  state.favorites ||= []; state.recipeNotes ||= {}; state.hiddenRecipes ||= []; state.settings ||= {}; state.settings.accentColor ||= '#7b3f00'; state.settings.wakeLockMode ||= 'recipes-and-timers'; state.settings.alarmVolume ??= 0.85; state.settings.alarmSoundEnabled ??= true; state.customCategories ||= []; state.timers ||= []; state.shoppingList ||= []; state.regularItems ||= []; state.stores ||= ['Unassigned','Costco','Walmart']; state.moduleSources ||= {}; state.backupMeta ||= {}; state.learnedStorePreferences ||= {}; state.learnedShoppingGroups ||= {}; state.learnedAisles ||= {}; state.manualCrossLinks ||= []; state.ratings = normalizeRatingMap(state.ratings);
  let currentView = 'all';
  let selectedCategory = null;
  let selectedRecipeKey = null;
  let recipeNavigationStack = [];
  let activeScale = 1;
  let timerTicker = null;
  let bellAudio = null;
  let wakeLockSentinel = null;
  let wakeLockRequestPending = false;

  const els = {
    sidebar: document.querySelector('#sidebar'), scrim: document.querySelector('#scrim'), menuBtn: document.querySelector('#menuBtn'),
    searchInput: document.querySelector('#searchInput'), recipeGrid: document.querySelector('#recipeGrid'), emptyState: document.querySelector('#emptyState'),
    categoryList: document.querySelector('#categoryList'), moduleFilter: document.querySelector('#moduleFilter'), categoryFilter: document.querySelector('#categoryFilter'), ratingFilter: document.querySelector('#ratingFilter'), ratingSort: document.querySelector('#ratingSort'), clearSearchBtn: document.querySelector('#clearSearchBtn'), favoritesFilterBtn: document.querySelector('#favoritesFilterBtn'), clearFiltersBtn: document.querySelector('#clearFiltersBtn'),
    viewTitle: document.querySelector('#viewTitle'), viewSubtitle: document.querySelector('#viewSubtitle'),
    listPane: document.querySelector('#listPane'), detailPane: document.querySelector('#detailPane'), modulesPane: document.querySelector('#modulesPane'), shoppingPane: document.querySelector('#shoppingPane'),
    recipeDetail: document.querySelector('#recipeDetail'), backBtn: document.querySelector('#backBtn'), moduleCards: document.querySelector('#moduleCards'),
    moduleFile: document.querySelector('#moduleFile'), importBtn: document.querySelector('#importBtn'), moduleImportBtn: document.querySelector('#moduleImportBtn'),
    moduleCount: document.querySelector('#moduleCount'), navModuleCount: document.querySelector('#navModuleCount'), allCount: document.querySelector('#allCount'), favoriteCount: document.querySelector('#favoriteCount'),
    settingsBtn: document.querySelector('#menuSettings'), settingsDialog: document.querySelector('#settingsDialog'), darkModeToggle: document.querySelector('#darkModeToggle'), metricToggle: document.querySelector('#metricToggle'),
    reportProblemBtn: document.querySelector('#reportProblemBtn'), sendFeedbackBtn: document.querySelector('#sendFeedbackBtn'), feedbackDialog: document.querySelector('#feedbackDialog'), feedbackForm: document.querySelector('#feedbackForm'), feedbackDialogTitle: document.querySelector('#feedbackDialogTitle'), feedbackIntro: document.querySelector('#feedbackIntro'), feedbackReportId: document.querySelector('#feedbackReportId'), feedbackType: document.querySelector('#feedbackType'), feedbackSeverityField: document.querySelector('#feedbackSeverityField'), feedbackSeverity: document.querySelector('#feedbackSeverity'), feedbackSummary: document.querySelector('#feedbackSummary'), feedbackBugFields: document.querySelector('#feedbackBugFields'), feedbackActivity: document.querySelector('#feedbackActivity'), feedbackActual: document.querySelector('#feedbackActual'), feedbackExpected: document.querySelector('#feedbackExpected'), feedbackDetailsField: document.querySelector('#feedbackDetailsField'), feedbackDetails: document.querySelector('#feedbackDetails'), feedbackEmail: document.querySelector('#feedbackEmail'), feedbackScreenshot: document.querySelector('#feedbackScreenshot'), feedbackScreenshotStatus: document.querySelector('#feedbackScreenshotStatus'), feedbackIncludeDiagnostics: document.querySelector('#feedbackIncludeDiagnostics'), prepareFeedbackBtn: document.querySelector('#prepareFeedbackBtn'), feedbackPreviewField: document.querySelector('#feedbackPreviewField'), feedbackReportPreview: document.querySelector('#feedbackReportPreview'), feedbackStatus: document.querySelector('#feedbackStatus'), copyFeedbackBtn: document.querySelector('#copyFeedbackBtn'), downloadFeedbackBtn: document.querySelector('#downloadFeedbackBtn'), shareFeedbackBtn: document.querySelector('#shareFeedbackBtn'), closeFeedbackBtn: document.querySelector('#closeFeedbackBtn'),
    createRecipeBtn: document.querySelector('#menuCreateRecipe'), recipeEditorDialog: document.querySelector('#recipeEditorDialog'), recipeEditorForm: document.querySelector('#recipeEditorForm'), closeRecipeEditor: document.querySelector('#closeRecipeEditor'), cancelRecipeEditor: document.querySelector('#cancelRecipeEditor'), accentColorInput: document.querySelector('#accentColorInput'), themeColorMeta: document.querySelector('#themeColorMeta'),
    timersBtn: document.querySelector('#timersBtn'), timerCount: document.querySelector('#timerCount'), timerDock: document.querySelector('#timerDock'), timerList: document.querySelector('#timerList'), closeTimerDock: document.querySelector('#closeTimerDock'),
    editCategory: document.querySelector('#editCategory'), addCustomCategory: document.querySelector('#addCustomCategory'), customCategoryInput: document.querySelector('#customCategoryInput'),
    rangeTimerDialog: document.querySelector('#rangeTimerDialog'), rangeTimerLabel: document.querySelector('#rangeTimerLabel'), rangeTimerChoices: document.querySelector('#rangeTimerChoices'),
    menuImportModule: document.querySelector('#menuImportModule'), shoppingCount: document.querySelector('#shoppingCount'), shoppingGroups: document.querySelector('#shoppingGroups'), shoppingStoreFilter: document.querySelector('#shoppingStoreFilter'), addShoppingItemBtn: document.querySelector('#addShoppingItemBtn'), shareShoppingBtn: document.querySelector('#shareShoppingBtn'), shareShoppingDialog: document.querySelector('#shareShoppingDialog'), shareShoppingFileBtn: document.querySelector('#shareShoppingFileBtn'), copyShoppingMessageBtn: document.querySelector('#copyShoppingMessageBtn'), shoppingShareStatus: document.querySelector('#shoppingShareStatus'), importShoppingBtn: document.querySelector('#importShoppingBtn'), importShoppingDialog: document.querySelector('#importShoppingDialog'), chooseShoppingFileBtn: document.querySelector('#chooseShoppingFileBtn'), shoppingMessageText: document.querySelector('#shoppingMessageText'), shoppingPasteError: document.querySelector('#shoppingPasteError'), importPastedShoppingBtn: document.querySelector('#importPastedShoppingBtn'), shoppingImportFile: document.querySelector('#shoppingImportFile'), clearCheckedBtn: document.querySelector('#clearCheckedBtn'), regularItemsBtn: document.querySelector('#regularItemsBtn'), manageStoresBtn: document.querySelector('#manageStoresBtn'), ingredientShoppingDialog: document.querySelector('#ingredientShoppingDialog'), ingredientShoppingChoices: document.querySelector('#ingredientShoppingChoices'), ingredientStoreSelect: document.querySelector('#ingredientStoreSelect'), confirmIngredientAdd: document.querySelector('#confirmIngredientAdd'), shoppingItemDialog: document.querySelector('#shoppingItemDialog'), shoppingItemForm: document.querySelector('#shoppingItemForm'), shoppingItemStore: document.querySelector('#shoppingItemStore'), shoppingItemDialogTitle: document.querySelector('#shoppingItemDialogTitle'), shoppingItemEditId: document.querySelector('#shoppingItemEditId'), shoppingItemSubmitBtn: document.querySelector('#shoppingItemSubmitBtn'), regularItemsDialog: document.querySelector('#regularItemsDialog'), regularItemsList: document.querySelector('#regularItemsList'), catalogRefreshBtn: document.querySelector('#catalogRefreshBtn'), importOptionsDialog: document.querySelector('#importOptionsDialog'), browseGithubBtn: document.querySelector('#browseGithubBtn'), importFileBtn: document.querySelector('#importFileBtn'), forceUpdateBtn: document.querySelector('#forceUpdateBtn'), recipeCreateDialog: document.querySelector('#recipeCreateDialog'), manualRecipeBtn: document.querySelector('#manualRecipeBtn'), pasteRecipeBtn: document.querySelector('#pasteRecipeBtn'), imageRecipeBtn: document.querySelector('#imageRecipeBtn'), pasteRecipeDialog: document.querySelector('#pasteRecipeDialog'), pasteRecipeForm: document.querySelector('#pasteRecipeForm'), pastedRecipeText: document.querySelector('#pastedRecipeText'), imageRecipeDialog: document.querySelector('#imageRecipeDialog'), imageRecipeForm: document.querySelector('#imageRecipeForm'), recipeImageFiles: document.querySelector('#recipeImageFiles'), recipeImagePreviews: document.querySelector('#recipeImagePreviews'), recognizedRecipeText: document.querySelector('#recognizedRecipeText'), recognizeRecipeImages: document.querySelector('#recognizeRecipeImages'), ocrStatus: document.querySelector('#ocrStatus'), recipeImportFile: document.querySelector('#recipeImportFile'), backupRestoreFile: document.querySelector('#backupRestoreFile'), createBackupBtn: document.querySelector('#createBackupBtn'), restoreBackupBtn: document.querySelector('#restoreBackupBtn'), exportPersonalRecipesBtn: document.querySelector('#exportPersonalRecipesBtn'), importRecipeBtn: document.querySelector('#importRecipeBtn'), shareRecipeDialog: document.querySelector('#shareRecipeDialog'), shareRecipeName: document.querySelector('#shareRecipeName'), shareIncludeNotes: document.querySelector('#shareIncludeNotes'), shareRecipeJsonBtn: document.querySelector('#shareRecipeJsonBtn'), shareRecipeTextBtn: document.querySelector('#shareRecipeTextBtn'), restoreBackupDialog: document.querySelector('#restoreBackupDialog'), restoreBackupForm: document.querySelector('#restoreBackupForm'), backupSummary: document.querySelector('#backupSummary'), cancelRestoreBackup: document.querySelector('#cancelRestoreBackup'), hiddenRecipesBtn: document.querySelector('#hiddenRecipesBtn'), hiddenRecipesDialog: document.querySelector('#hiddenRecipesDialog'), hiddenRecipesList: document.querySelector('#hiddenRecipesList'), restoreAllHiddenBtn: document.querySelector('#restoreAllHiddenBtn'), wakeLockMode: document.querySelector('#wakeLockMode'), wakeLockStatus: document.querySelector('#wakeLockStatus'), alarmSoundToggle: document.querySelector('#alarmSoundToggle'), alarmVolume: document.querySelector('#alarmVolume'), testBellBtn: document.querySelector('#testBellBtn'), activeProfileName: document.querySelector('#activeProfileName'), manageProfilesBtn: document.querySelector('#manageProfilesBtn'), profilesDialog: document.querySelector('#profilesDialog'), profilesList: document.querySelector('#profilesList'), addProfileBtn: document.querySelector('#addProfileBtn'), addKitchenProfileBtn: document.querySelector('#addKitchenProfileBtn'), profileSetupDialog: document.querySelector('#profileSetupDialog'), profileSetupForm: document.querySelector('#profileSetupForm'), profileSetupName: document.querySelector('#profileSetupName'), importProfileBtn: document.querySelector('#importProfileBtn'), profileImportFile: document.querySelector('#profileImportFile'), profileStorageSummary: document.querySelector('#profileStorageSummary'), headerProfileBtn: document.querySelector('#headerProfileBtn'), headerProfileAvatar: document.querySelector('#headerProfileAvatar'), headerProfileName: document.querySelector('#headerProfileName'), profileQuickMenu: document.querySelector('#profileQuickMenu'), profileEditDialog: document.querySelector('#profileEditDialog'), profileEditForm: document.querySelector('#profileEditForm'), profileEditName: document.querySelector('#profileEditName'), profileEditEmoji: document.querySelector('#profileEditEmoji'), profileEditImage: document.querySelector('#profileEditImage'), profileEditImageInput: document.querySelector('#profileEditImageInput'), profileEditImageBtn: document.querySelector('#profileEditImageBtn'), profileEditRemoveImageBtn: document.querySelector('#profileEditRemoveImageBtn'), profileEditPreview: document.querySelector('#profileEditPreview'), profileEditColorChoices: document.querySelector('#profileEditColorChoices'), cancelProfileEdit: document.querySelector('#cancelProfileEdit'), safeguardStatus: document.querySelector('#safeguardStatus'), safetyBackupList: document.querySelector('#safetyBackupList'), createSafetyBackupBtn: document.querySelector('#createSafetyBackupBtn'), runDiagnosticsBtn: document.querySelector('#runDiagnosticsBtn'), optimizeStorageBtn: document.querySelector('#optimizeStorageBtn'), diagnosticsOutput: document.querySelector('#diagnosticsOutput')
  };

  const startupIssues = [];
  function startupStep(label, action) {
    try { return action(); }
    catch (error) {
      startupIssues.push({ label, error });
      console.error(`Startup step failed: ${label}`, error);
      return undefined;
    }
  }

  function showStartupIssues() {
    if (!startupIssues.length) return;
    const notice = document.createElement('div');
    notice.className = 'startup-recovery-notice';
    notice.setAttribute('role', 'alert');
    notice.innerHTML = `<strong>Kitchen Companion opened in recovery mode.</strong><span>Your information was loaded, but ${startupIssues.length} startup task${startupIssues.length===1?'':'s'} could not finish. This is commonly caused by full iPhone website storage. The controls remain available so you can create a full backup and clean up storage.</span><button type="button" aria-label="Dismiss recovery notice">×</button>`;
    notice.querySelector('button').addEventListener('click', () => notice.remove());
    document.body.prepend(notice);
  }

  function init() {
    // Controls and update recovery must be established before any storage
    // migration or write. A rejected housekeeping save must never freeze UI.
    startupStep('event controls', bindEvents);
    startupStep('update service', registerServiceWorker);
    startupStep('built-in module', () => { if (!state.modules.length) state.modules.push(builtInModule); });
    const migrated = startupStep('data migration', migrateState);
    startupStep('personal recipe module', ensurePersonalModule);
    startupStep(migrated ? 'save migrated data' : 'startup save', saveState);
    startupStep('appearance', applySettings);
    startupStep('version label', () => { const versionLabel=document.querySelector('#engineVersionLabel'); if(versionLabel) versionLabel.textContent=ENGINE_VERSION; });
    startupStep('active profile', renderActiveProfile);
    startupStep('safeguards', renderSafeguards);
    startupStep('profile setup', showProfileSetupIfNeeded);
    startupStep('main interface', refreshAll);
    startupStep('timers', startTimerTicker);
    startupStep('alarm', initBellAudio);
    startupStep('screen wake lock', updateWakeLock);
    showStartupIssues();
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && Array.isArray(parsed.modules)) return parsed;
    } catch (error) { console.warn('Unable to load saved state', error); }
    return { modules: [], favorites: [], recipeNotes: {}, hiddenRecipes: [], customCategories: [], timers: [], shoppingList: [], regularItems: [], stores: ['Unassigned','Costco','Walmart'], moduleSources: {}, manualCrossLinks: [], settings: { darkMode: false, metricHelpers: false, accentColor: '#7b3f00', wakeLockMode: 'recipes-and-timers', alarmVolume: 0.85, alarmSoundEnabled: true } };
  }

  function saveState() { profileStore.saveCombinedState(state); }

  function normalizeRatingRecord(entry) {
    const rawValue = typeof entry === 'number' ? entry : entry?.value;
    const value = Math.round(Number(rawValue));
    if (!Number.isFinite(value) || value < 1 || value > 5) return null;
    const updatedAt = typeof entry === 'object' && entry && Number.isFinite(Date.parse(entry.updatedAt)) ? entry.updatedAt : null;
    return { value, updatedAt };
  }

  function normalizeRatingMap(ratings) {
    const normalized = {};
    if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) return normalized;
    Object.entries(ratings).forEach(([recipeKey, entry]) => {
      const record = normalizeRatingRecord(entry);
      if (record) normalized[recipeKey] = record;
    });
    return normalized;
  }

  function recipeRatingRecord(recipeKey) { return normalizeRatingRecord(state.ratings?.[recipeKey]); }
  function recipeRatingValue(recipeKey) { return recipeRatingRecord(recipeKey)?.value || 0; }
  function ratingStars(value) {
    const rating = Math.max(0, Math.min(5, Number(value) || 0));
    return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
  }

  function bindEvents() {
    els.headerProfileBtn?.addEventListener('click', event => {
      event.stopPropagation();
      toggleProfileQuickMenu();
    });
    els.profileQuickMenu?.addEventListener('click', event => event.stopPropagation());
    const closeOpenProfileMenusFromOutsidePress = event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('.profile-more-wrap')) closeProfileMoreMenus();
      if (!target?.closest('.header-profile-wrap')) closeProfileQuickMenu();
    };
    // Use capture-phase listeners so iPhone Safari cannot swallow the outside press.
    document.addEventListener('pointerdown', closeOpenProfileMenusFromOutsidePress, true);
    document.addEventListener('touchstart', closeOpenProfileMenusFromOutsidePress, true);
    document.addEventListener('click', closeOpenProfileMenusFromOutsidePress, true);
    els.profilesDialog?.addEventListener('pointerdown', closeOpenProfileMenusFromOutsidePress, true);
    els.profilesDialog?.addEventListener('touchstart', closeOpenProfileMenusFromOutsidePress, true);
    els.profilesDialog?.addEventListener('click', closeOpenProfileMenusFromOutsidePress, true);
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
    els.ratingFilter?.addEventListener('change', renderRecipeList);
    els.ratingSort?.addEventListener('change', renderRecipeList);
    els.favoritesFilterBtn.addEventListener('click', () => { currentView = currentView === 'favorites' ? 'all' : 'favorites'; selectedCategory = null; syncFavoriteFilterButton(); renderRecipeList(); });
    els.clearFiltersBtn.addEventListener('click', clearRecipeFilters);
    els.backBtn.addEventListener('click', navigateBackFromRecipe);
    
    els.moduleImportBtn.addEventListener('click', openImportOptions);
    els.menuImportModule.addEventListener('click', () => { toggleSidebar(false); openImportOptions(); });
    els.browseGithubBtn.addEventListener('click', () => { els.importOptionsDialog.close(); currentView='modules'; showModules(); loadModuleCatalog(); });
    els.importFileBtn.addEventListener('click', () => { els.importOptionsDialog.close(); els.moduleFile.click(); });
    els.moduleFile.addEventListener('change', importModules);
    els.settingsBtn.addEventListener('click', () => { toggleSidebar(false); renderHiddenRecipes(); renderActiveProfile(); els.settingsDialog.showModal(); });
    els.reportProblemBtn?.addEventListener('click', () => openFeedbackDialog('bug'));
    els.sendFeedbackBtn?.addEventListener('click', () => openFeedbackDialog('suggestion'));
    els.closeFeedbackBtn?.addEventListener('click', () => els.feedbackDialog?.close());
    els.feedbackType?.addEventListener('change', updateFeedbackTypeFields);
    els.feedbackScreenshot?.addEventListener('change', validateFeedbackScreenshot);
    els.prepareFeedbackBtn?.addEventListener('click', () => prepareFeedbackPreview(true, true));
    els.copyFeedbackBtn?.addEventListener('click', copyFeedbackReport);
    els.downloadFeedbackBtn?.addEventListener('click', downloadFeedbackReport);
    els.feedbackForm?.addEventListener('submit', shareFeedbackReport);
    els.feedbackForm?.addEventListener('input', event => {
      if (event.target === els.feedbackReportPreview || event.target === els.feedbackScreenshot) return;
      els.feedbackReportPreview.value = '';
      els.feedbackPreviewField.hidden = true;
      setFeedbackStatus('');
    });
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
    els.profileEditForm?.addEventListener('submit', saveProfileEdits);
    els.profileEditImageBtn?.addEventListener('click', () => els.profileEditImageInput?.click());
    els.profileEditImageInput?.addEventListener('change', handleProfileImageImport);
    els.profileEditRemoveImageBtn?.addEventListener('click', removeProfileImageDraft);
    els.profileEditEmoji?.addEventListener('input', updateProfileEditPreview);
    els.profileEditName?.addEventListener('input', updateProfileEditPreview);
    els.cancelProfileEdit?.addEventListener('click', () => els.profileEditDialog?.close());
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
    els.shoppingStoreFilter.addEventListener('change', () => { shoppingSelectedIds.clear(); updateShoppingBulkBar(); renderShoppingList(); });
    document.querySelector('#shoppingSelectBtn')?.addEventListener('click', beginShoppingSelection);
    document.querySelector('#shoppingSelectionCancel')?.addEventListener('click', cancelShoppingSelection);
    document.querySelector('#shoppingSelectAll')?.addEventListener('click', selectAllVisibleShopping);
    document.querySelector('#shoppingBulkMove')?.addEventListener('click', openBulkShoppingMoveDialog);
    document.querySelector('#shoppingBulkDelete')?.addEventListener('click', deleteSelectedShoppingItems);
    document.querySelector('#shoppingMoveCancel')?.addEventListener('click', () => document.querySelector('#shoppingMoveDialog')?.close());
    document.querySelector('#shoppingMoveConfirm')?.addEventListener('click', confirmShoppingMove);
    document.querySelector('#shoppingMoveStore')?.addEventListener('change', updateShoppingMoveNewStoreFields);
    document.querySelector('#shoppingMoveNewStoreName')?.addEventListener('input', clearShoppingMoveStoreError);
    document.querySelector('#shoppingUndoBtn')?.addEventListener('click', undoShoppingBulkAction);
    window.addEventListener('keydown', event => { if(event.key==='Escape' && shoppingSelectionMode) cancelShoppingSelection(); });
    els.addShoppingItemBtn.addEventListener('click', () => openShoppingItemDialog());
    document.querySelector('#cancelShoppingItem').addEventListener('click', () => els.shoppingItemDialog.close());
    els.shoppingItemForm.addEventListener('submit', addManualShoppingItem);
    els.regularItemsBtn.addEventListener('click', showRegularItems);
    els.shareShoppingBtn.addEventListener('click', openShareShoppingDialog);
    els.shareShoppingFileBtn?.addEventListener('click', shareShoppingListFile);
    els.copyShoppingMessageBtn?.addEventListener('click', copyShoppingListForMessage);
    els.importShoppingBtn?.addEventListener('click', openImportShoppingDialog);
    els.chooseShoppingFileBtn?.addEventListener('click', () => els.shoppingImportFile?.click());
    els.importPastedShoppingBtn?.addEventListener('click', importPastedShoppingList);
    els.shoppingMessageText?.addEventListener('input', () => {
      els.shoppingPasteError.hidden = true;
      els.shoppingPasteError.textContent = '';
    });
    els.shoppingImportFile?.addEventListener('change', importShoppingList);
    els.clearCheckedBtn.addEventListener('click', () => {
      if (!state.shoppingList.some(x => x.checked)) return;
      try {
        requireSafetyCheckpoint('before-bulk-delete');
        state.shoppingList = state.shoppingList.filter(x => !x.checked);
        saveState(); renderShoppingList(); renderCounts();
      } catch (error) { alert(`Checked items were not cleared: ${error.message}`); }
    });
    els.confirmIngredientAdd.addEventListener('click', confirmAddIngredients);
    els.catalogRefreshBtn.addEventListener('click', loadModuleCatalog);
    els.manageStoresBtn.addEventListener('click', manageStores);
    els.forceUpdateBtn?.addEventListener('click', forceAppUpdate);
    document.querySelector('#manualCrossLinkSearch')?.addEventListener('input', renderManualCrossLinkResults);
    document.querySelector('#manualCrossLinkType')?.addEventListener('change', renderManualCrossLinkResults);
    document.querySelector('#cancelManualCrossLink')?.addEventListener('click', () => document.querySelector('#manualCrossLinkDialog')?.close());
    els.createSafetyBackupBtn?.addEventListener('click', () => {
      const button = els.createSafetyBackupBtn;
      const originalText = button.textContent;
      try {
        const backup = profileStore.createSafetyBackup('manual-checkpoint', { force:true });
        if (!backup) throw new Error('No app data was available to save.');
        renderSafeguards();
        button.textContent = 'Checkpoint created';
        button.disabled = true;
        window.setTimeout(() => { button.textContent = originalText; button.disabled = false; }, 1800);
      } catch (error) {
        console.error('Manual safety checkpoint failed.', error);
        button.textContent = 'Checkpoint failed';
        window.setTimeout(() => { button.textContent = originalText; }, 2200);
        alert(`Safety checkpoint could not be created: ${error.message || error}`);
      }
    });
    els.runDiagnosticsBtn?.addEventListener('click', runDiagnostics);
    els.optimizeStorageBtn?.addEventListener('click', optimizeLocalStorage);
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


  function profileAvatarContent(profile, displayName = null) {
    const name = displayName || (profile?.kind === 'household' ? 'Shared Kitchen' : profile?.displayName || 'My Profile');
    if (profile?.avatarType === 'image' && profile?.avatarValue) {
      return `<img src="${escapeHtml(profile.avatarValue)}" alt="" class="profile-avatar-image">`;
    }
    if (profile?.avatarType === 'emoji' && profile?.avatarValue) return `<span class="profile-avatar-emoji">${escapeHtml(profile.avatarValue)}</span>`;
    return escapeHtml(profile?.kind === 'household' ? '⌂' : profileInitials(name));
  }

  function setProfileAvatarElement(element, profile, displayName = null) {
    if (!element) return;
    element.style.setProperty('--profile-color', profile?.color || '#7b3f00');
    element.innerHTML = profileAvatarContent(profile, displayName);
  }

  let editingProfileId = null;
  let profileAvatarDraft = { type:'initials', value:'' };
  const PROFILE_COLORS = ['#7b3f00','#2563eb','#15803d','#7e22ce','#be123c','#0f766e','#c2410c','#4338ca','#0369a1','#4d7c0f','#a21caf','#374151'];

  function openProfileEditor(profile) {
    if (!els.profileEditDialog) return;
    editingProfileId = profile.profileId;
    els.profileEditName.value = profile.kind === 'household' ? (profile.displayName || 'Kitchen') : profile.displayName;
    profileAvatarDraft = { type:profile.avatarType || (profile.kind === 'household' ? 'emoji' : 'initials'), value:profile.avatarValue || (profile.kind === 'household' ? '🏠' : '') };
    els.profileEditEmoji.value = profileAvatarDraft.type === 'emoji' ? profileAvatarDraft.value : '';
    if (els.profileEditImageInput) els.profileEditImageInput.value = '';
    renderProfileColorChoices(profile.color || '#7b3f00');
    updateProfileEditPreview();
    closeProfileMoreMenus();
    els.profileEditDialog.showModal();
  }

  function renderProfileColorChoices(selected) {
    if (!els.profileEditColorChoices) return;
    els.profileEditColorChoices.innerHTML = '';
    PROFILE_COLORS.forEach(color => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `profile-color-choice${color.toLowerCase() === String(selected).toLowerCase() ? ' selected' : ''}`;
      button.style.setProperty('--choice-color', color);
      button.dataset.color = color;
      button.setAttribute('aria-label', `Choose profile color ${color}`);
      button.addEventListener('click', () => { renderProfileColorChoices(color); updateProfileEditPreview(); });
      els.profileEditColorChoices.appendChild(button);
    });
  }

  function selectedProfileColor() {
    return els.profileEditColorChoices?.querySelector('.profile-color-choice.selected')?.dataset.color || '#7b3f00';
  }

  function updateProfileEditPreview() {
    if (!els.profileEditPreview) return;
    const typedEmoji = els.profileEditEmoji?.value.trim();
    if (typedEmoji) profileAvatarDraft = { type:'emoji', value:typedEmoji };
    const draft = { color:selectedProfileColor(), avatarType:profileAvatarDraft.type, avatarValue:profileAvatarDraft.value, kind:'personal', displayName:els.profileEditName?.value || 'Profile' };
    setProfileAvatarElement(els.profileEditPreview, draft, draft.displayName);
    if (els.profileEditRemoveImageBtn) els.profileEditRemoveImageBtn.hidden = profileAvatarDraft.type !== 'image';
  }

  async function handleProfileImageImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Choose an image file.'); return; }
    try {
      const avatar = await resizeProfileImage(file);
      profileAvatarDraft = { type:'image', value:avatar };
      if (els.profileEditEmoji) els.profileEditEmoji.value = '';
      updateProfileEditPreview();
    } catch (error) { alert(`The avatar image could not be imported: ${error.message}`); }
  }

  function resizeProfileImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('The selected file could not be read.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('The selected image format is not supported.'));
        image.onload = () => {
          const size = 256;
          const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
          const sx = (image.naturalWidth - sourceSize) / 2;
          const sy = (image.naturalHeight - sourceSize) / 2;
          ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
          let result;
          try { result = canvas.toDataURL('image/webp', 0.82); } catch { result = canvas.toDataURL('image/jpeg', 0.85); }
          if (!result || result.length > 500000) result = canvas.toDataURL('image/jpeg', 0.78);
          resolve(result);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function removeProfileImageDraft() {
    profileAvatarDraft = { type:'initials', value:'' };
    if (els.profileEditEmoji) els.profileEditEmoji.value = '';
    if (els.profileEditImageInput) els.profileEditImageInput.value = '';
    updateProfileEditPreview();
  }

  function saveProfileEdits(event) {
    event.preventDefault();
    const name = els.profileEditName.value.trim();
    if (!name) { alert('Enter a profile name.'); return; }
    const typedEmoji = els.profileEditEmoji.value.trim();
    if (typedEmoji) profileAvatarDraft = { type:'emoji', value:typedEmoji };
    try {
      profileStore.updateProfile(editingProfileId, { displayName:name, color:selectedProfileColor(), avatarType:profileAvatarDraft.type, avatarValue:profileAvatarDraft.value });
      els.profileEditDialog.close();
      renderProfiles(); renderActiveProfile();
    } catch (error) { alert(error.message); }
  }

  function renderActiveProfile() {
    const profile = profileStore.getActiveProfileMeta();
    const displayName = profile?.kind === 'household' ? 'Shared Kitchen' : (profile?.displayName || 'My Profile');
    if (els.activeProfileName) els.activeProfileName.textContent = displayName;
    const menuLabel = document.querySelector('#menuProfileName');
    if (menuLabel) menuLabel.textContent = displayName;
    if (els.headerProfileName) els.headerProfileName.textContent = displayName;
    if (els.headerProfileAvatar) {
      setProfileAvatarElement(els.headerProfileAvatar, profile, displayName);
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
      button.innerHTML = `<span class="profile-quick-avatar" style="--profile-color:${escapeHtml(profile.color || '#7b3f00')}">${profileAvatarContent(profile, name)}</span><span>${escapeHtml(name)}</span>${profile.profileId === activeId ? '<span class="profile-quick-check">✓</span>' : ''}`;
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
    document.querySelectorAll('.profile-more-wrap.is-open').forEach(wrapper => {
      if (wrapper === except) return;
      wrapper.classList.remove('is-open');
      const button = wrapper.querySelector('.profile-more-button');
      const menu = wrapper.querySelector('.profile-more-menu');
      button?.setAttribute('aria-expanded', 'false');
      if (menu) menu.hidden = true;
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
      row.innerHTML = `<div class="profile-avatar" style="--profile-color:${escapeHtml(profile.color || '#7b3f00')}">${profileAvatarContent(profile, profile.kind==='household'?'Shared Kitchen':profile.displayName)}</div><div class="profile-row-main"><div class="profile-name-line"><strong>${escapeHtml(profile.kind==='household'?'Shared Kitchen':profile.displayName)}</strong>${profile.kind==='household'?'<span class="profile-kind">Household</span>':''}${profile.profileId===activeId?'<span class="profile-current">Current</span>':''}</div><div class="profile-metrics"><span><b>${summary.personalRecipes}</b> recipes</span><span><b>${summary.favorites}</b> favorites</span><span><b>${summary.notes}</b> notes</span><span><b>${summary.shoppingItems}</b> shopping</span><span><b>${summary.hidden}</b> hidden</span><span><b>${summary.ratings}</b> ratings</span></div><div class="profile-last-used">Last used: ${escapeHtml(lastUsed)}</div></div><div class="profile-row-actions"></div>`;
      const actions = row.querySelector('.profile-row-actions');
      if (profile.profileId !== activeId) {
        const switchBtn=document.createElement('button'); switchBtn.type='button'; switchBtn.className='button'; switchBtn.textContent='Use profile';
        switchBtn.addEventListener('click',()=>{ saveState(); profileStore.switchProfile(profile.profileId); location.reload(); }); actions.appendChild(switchBtn);
      }
      const exportBtn=document.createElement('button'); exportBtn.type='button'; exportBtn.className='button secondary'; exportBtn.textContent='Export profile'; exportBtn.addEventListener('click',()=>exportProfile(profile)); actions.appendChild(exportBtn);
      const more=document.createElement('div');
      more.className='profile-more-wrap';
      more.innerHTML='<button type="button" class="button secondary profile-more-button" aria-haspopup="menu" aria-expanded="false">More</button><div class="profile-more-menu" role="menu" hidden></div>';
      const moreButton = more.querySelector('.profile-more-button');
      const menu=more.querySelector('.profile-more-menu');
      moreButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = !more.classList.contains('is-open');
        closeProfileMoreMenus(willOpen ? more : null);
        closeProfileQuickMenu();
        more.classList.toggle('is-open', willOpen);
        moreButton.setAttribute('aria-expanded', String(willOpen));
        menu.hidden = !willOpen;
      });
      menu.addEventListener('click', event => event.stopPropagation());
      const editBtn=document.createElement('button'); editBtn.type='button'; editBtn.className='button secondary'; editBtn.textContent='Edit profile'; editBtn.addEventListener('click',()=>openProfileEditor(profile)); menu.appendChild(editBtn);
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

  function shoppingId() { return crypto.randomUUID ? crypto.randomUUID() : `shopping-${Date.now()}-${Math.random()}`; }
  function extractEmbeddedShoppingQuantity(name) {
    const value = String(name || '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    const singleAmount = String.raw`(?:\d+\s+\d+\/\d+|\d+[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])`;
    const amount = String.raw`(?:${singleAmount})(?:\s*(?:-|to)\s*(?:${singleAmount}))?`;
    const unit = String.raw`(?:cups?|c|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|pounds?|lbs?|grams?|g|kilograms?|kg|milliliters?|ml|liters?|litres?|l|packets?|packages?|envelopes?|cans?|jars?|bottles?|cloves?|sticks?)`;
    const parenthetical = new RegExp(`^\\(\\s*(${amount}\\s*${unit})\\s*\\)\\s*`, 'i');
    const leading = new RegExp(`^(${amount}\\s*${unit})\\b\\s*`, 'i');
    const match = value.match(parenthetical) || value.match(leading);
    if (!match) return { name:value, quantity:'' };
    return { name:value.slice(match[0].length).trim(), quantity:match[1].replace(/\s+/g, ' ').trim() };
  }
  function normalizeShoppingName(name) {
    let value = extractEmbeddedShoppingQuantity(name).name
      .replace(/^of\s+/i, '')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove trailing preparation, usage, and purchase notes. These belong to
    // the recipe-source line, not the identity used for shopping-list grouping.
    const trailingNote = /(?:,|\s)\s*(?:divided|chopped|finely chopped|roughly chopped|diced|minced|sliced|thinly sliced|shredded|grated|softened|melted|beaten|crushed|peeled|seeded|drained|rinsed|at room temperature|room temperature|to taste|as needed|if needed|optional|for cooking|for frying|for sauteing|for sautéing|for greasing|for brushing|for serving|for garnish|for garnishing|plus more|plus extra|extra for serving|more as needed)(?:\s+.*)?$/i;
    const parentheticalNote = /\s*\((?:[^)]*\b(?:divided|chopped|diced|minced|sliced|shredded|grated|softened|melted|to taste|as needed|if needed|optional|for cooking|for frying|for serving|for garnish|plus)\b[^)]*)\)\s*$/i;

    let previous;
    do {
      previous = value;
      value = value.replace(parentheticalNote, '').replace(trailingNote, '').trim();
    } while (value && value !== previous);

    value = value.replace(/[,:;]+$/, '').trim();
    if (/^(?:whole|skim|low-?fat|reduced-?fat|[12]%?)\s+milk$/i.test(value)) value = 'milk';
    if (/^active\s+dry\s+yeast$/i.test(value)) value = 'active yeast';
    return value;
  }

  function displayShoppingName(name) {
    const value = normalizeShoppingName(name);
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
  }
  function shoppingNameKey(name) {
    return normalizeShoppingName(name)
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  const SHOPPING_GROUPS = ['Produce','Meat & Seafood','Dairy & Eggs','Bakery','Pantry','Canned & Jarred','Spices & Baking','Frozen','Beverages','Household','Other'];
  const SHOPPING_GROUP_ORDER = new Map(SHOPPING_GROUPS.map((group, index) => [group, index]));

  function classifyShoppingGroup(name) {
    const key = shoppingNameKey(name);
    if (!key) return 'Other';
    const learned = state.learnedShoppingGroups?.[key];
    if (SHOPPING_GROUPS.includes(learned)) return learned;
    const rules = [
      ['Produce', /\b(apple|apples|banana|bananas|berry|berries|blueberry|blueberries|strawberry|strawberries|orange|oranges|lemon|lemons|lime|limes|avocado|avocados|tomato|tomatoes|potato|potatoes|onion|onions|garlic|bell pepper|bell peppers|lettuce|spinach|cabbage|carrot|carrots|celery|broccoli|cauliflower|mushroom|mushrooms|corn|zucchini|squash|cucumber|cilantro|parsley|basil|rosemary|thyme|ginger|fruit|vegetable|salad greens)\b/],
      ['Meat & Seafood', /\b(beef|steak|ground beef|chicken|turkey|pork|bacon|sausage|ham|lamb|fish|salmon|tuna|shrimp|crab|meatball|meatballs)\b/],
      ['Dairy & Eggs', /\b(milk|cream|half and half|butter|cheese|mozzarella|cheddar|parmesan|romano|yogurt|sour cream|cream cheese|egg|eggs)\b/],
      ['Spices & Baking', /\b(flour|sugar|brown sugar|powdered sugar|baking soda|baking powder|yeast|cornstarch|vanilla|extract|cocoa|chocolate chips|salt|pepper|paprika|cumin|oregano|seasoning|spice|cinnamon|nutmeg)\b/],
      ['Bakery', /\b(bread|bun|buns|roll|rolls|bagel|bagels|tortilla|tortillas|pita|pie crust)\b/],
      ['Frozen', /\b(frozen|ice cream|popsicle|popsicles)\b/],
      ['Beverages', /\b(water|soda|juice|coffee|tea|drink|lemonade)\b/],
      ['Household', /\b(foil|paper towel|paper towels|toilet paper|napkin|napkins|trash bag|trash bags|dish soap|detergent|cleaner|sponge|sponges)\b/],
      ['Canned & Jarred', /\b(canned|can of|tomato sauce|tomato paste|marinara|broth|stock|beans|olives|pickle|pickles|jam|jelly)\b/]
    ];
    return rules.find(([, pattern]) => pattern.test(key))?.[0] || 'Pantry';
  }

  function preferredStoreFor(name) {
    const preference = state.learnedStorePreferences?.[shoppingNameKey(name)];
    return preference?.store && (preference.count || 0) >= 3 ? normalizeStore(preference.store) : '';
  }

  function learnStoreChoice(name, store) {
    const key = shoppingNameKey(name);
    const destination = normalizeStore(store);
    if (!key || destination === 'Unassigned') return;
    state.learnedStorePreferences ||= {};
    const preference = state.learnedStorePreferences[key] || { store:destination, count:0, choices:{} };
    preference.choices ||= {};
    preference.choices[destination] = (preference.choices[destination] || 0) + 1;
    const ranked = Object.entries(preference.choices).sort((a,b) => b[1] - a[1]);
    preference.store = ranked[0][0];
    preference.count = ranked[0][1];
    preference.updatedAt = new Date().toISOString();
    state.learnedStorePreferences[key] = preference;
  }
  function aislePreferenceKey(name, store) {
    return `${normalizeStore(store).toLowerCase()}|${shoppingNameKey(name)}`;
  }
  function preferredAisleFor(name, store) {
    if (normalizeStore(store) === 'Unassigned') return '';
    return String(state.learnedAisles?.[aislePreferenceKey(name, store)] || '').trim();
  }
  function learnAisleChoice(name, store, aisle) {
    const value = String(aisle || '').trim().slice(0, 40);
    if (!shoppingNameKey(name) || normalizeStore(store) === 'Unassigned') return;
    const key = aislePreferenceKey(name, store);
    if (value) state.learnedAisles[key] = value;
    else delete state.learnedAisles[key];
  }
  function normalizeShoppingEntry(entry = {}) {
    return {
      id: entry.id || shoppingId(),
      quantity: String(entry.quantity || '').trim(),
      source: String(entry.source || 'Manual').trim(),
      recipeKey: entry.recipeKey || '',
      importKey: String(entry.importKey || ''),
      createdAt: entry.createdAt || new Date().toISOString()
    };
  }
  function normalizeShoppingItem(item = {}) {
    const embedded = extractEmbeddedShoppingQuantity(item.name);
    const name = normalizeShoppingName(embedded.name);
    const entries = Array.isArray(item.entries) && item.entries.length
      ? item.entries.map(normalizeShoppingEntry)
      : [normalizeShoppingEntry({ quantity:item.quantity, source:item.source, recipeKey:item.recipeKey, createdAt:item.createdAt })];
    if (embedded.quantity && entries.length && !entries[0].quantity) entries[0].quantity = embedded.quantity;
    const learnedGroup = state.learnedShoppingGroups?.[shoppingNameKey(name)];
    let group = SHOPPING_GROUPS.includes(item.group) ? item.group : classifyShoppingGroup(name);
    if (!SHOPPING_GROUPS.includes(learnedGroup) && group === 'Bakery' && /\bflour\b/i.test(name)) group = 'Spices & Baking';
    return {
      id: item.id || shoppingId(),
      name,
      normalizedName: shoppingNameKey(item.normalizedName || name),
      store: normalizeStore(item.store),
      group,
      aisle: String(item.aisle || preferredAisleFor(name, item.store)).trim().slice(0, 40),
      checked: !!item.checked,
      entries,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    };
  }
  function migrateState() {
    let changed = false;
    const grouped = new Map();
    if (repairFavoriteReferences()) changed = true;
    state.settings ||= {};
    if (!state.settings.shoppingFlourGroupMigrationV1) {
      Object.entries(state.learnedShoppingGroups || {}).forEach(([key, group]) => {
        if (group === 'Bakery' && /\bflour\b/i.test(key)) delete state.learnedShoppingGroups[key];
      });
      state.settings.shoppingFlourGroupMigrationV1 = true;
      changed = true;
    }

    (state.shoppingList || []).forEach(original => {
      const item = normalizeShoppingItem(original);
      item.name = displayShoppingName(item.name);
      item.normalizedName = shoppingNameKey(item.name);
      const mergeKey = `${item.checked ? 'checked' : 'open'}|${item.normalizedName}`;
      const existing = grouped.get(mergeKey);
      if (existing) {
        existing.entries.push(...item.entries);
        existing.updatedAt = [existing.updatedAt, item.updatedAt].filter(Boolean).sort().at(-1) || new Date().toISOString();
        changed = true;
      } else {
        grouped.set(mergeKey, item);
      }
      if (!Array.isArray(original.entries) || original.normalizedName !== item.normalizedName || original.name !== item.name || original.store !== item.store || original.group !== item.group) changed = true;
    });

    state.shoppingList = [...grouped.values()];
    state.regularItems = (state.regularItems || []).map(item => ({
      id:item.id || shoppingId(), name:displayShoppingName(item.name), normalizedName:shoppingNameKey(item.normalizedName || item.name), quantity:String(item.quantity || '').trim(), store:normalizeStore(item.store), group:SHOPPING_GROUPS.includes(item.group) ? item.group : classifyShoppingGroup(item.name), aisle:String(item.aisle || preferredAisleFor(item.name, item.store)).trim().slice(0, 40)
    }));
    return changed;
  }

  function openImportOptions() { els.importOptionsDialog.showModal(); }

  async function forceAppUpdate() {
    const lastExport = state.backupMeta?.lastManualBackupAt;
    const oldExport = !lastExport || Date.now() - Date.parse(lastExport) > 7 * 24 * 60 * 60 * 1000;
    if (oldExport && !confirm('Before updating, Kitchen Companion recommends creating a full backup file. Local checkpoints cannot help if browser storage is erased.\n\nContinue checking for an update without a recent exported backup?')) return;
    try {
      requireSafetyCheckpoint('before-engine-update');
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update()));
      }
      location.href = `${location.pathname}?app=${Date.now()}`;
    } catch (error) { alert(`Update check stopped to protect your data: ${error.message}`); }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./service-worker.js?v=0.16.7').then(reg => reg.update()).catch(console.warn);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!sessionStorage.getItem('kc-reloaded')) {
        sessionStorage.setItem('kc-reloaded','1');
        location.reload();
      }
    });
  }

  function renderSafeguards() {
    if (!els.safeguardStatus) return;
    const info = profileStore.getDiagnostics();
    const recoveryMessage = info.recoveredAt ? ` • Recovered from ${new Date(info.recoveredAt).toLocaleString()}` : '';
    const storageMb = (info.storageBytes / 1024 / 1024).toFixed(2);
    els.safeguardStatus.textContent = `Storage schema ${info.storageSchemaVersion} • ${info.validBackupCount}/${info.backupCount} checkpoints healthy • ${info.manualBackupCount} manual • ${info.automaticBackupCount} automatic • ${info.fullBackupCount} full-module recovery point • About ${storageMb} MB used • Last checkpoint ${info.lastBackupAt ? new Date(info.lastBackupAt).toLocaleString() : 'not yet created'}${recoveryMessage}.`;
    if (!els.safetyBackupList) return;
    els.safetyBackupList.innerHTML = '';
    const reasonLabels = {
      'manual-checkpoint':'Manual checkpoint', 'startup':'Daily startup', 'engine-update':'First launch after engine update', 'before-engine-update':'Before update check',
      'before-restore':'Before checkpoint restore', 'before-full-backup-restore':'Before full backup restore',
      'before-module-import':'Before module import', 'before-module-update':'Before module update',
      'before-module-uninstall':'Before module uninstall', 'before-recipe-import':'Before recipe import',
      'before-recipe-delete':'Before recipe deletion', 'before-bulk-delete':'Before bulk deletion',
      'before-shopping-list-import':'Before shopping-list import'
    };
    profileStore.compactSafetyBackups().forEach(backup => {
      const row = document.createElement('div'); row.className = 'safety-backup-row';
      const label = document.createElement('span');
      const type = backup.kind === 'manual' ? 'Manual' : 'Automatic';
      const scope = backup.snapshotMode === 'full' ? 'Full module recovery' : 'Compact';
      label.textContent = `${type}: ${reasonLabels[backup.reason] || backup.reason} • ${scope} • ${new Date(backup.createdAt).toLocaleString()}`;
      const button = document.createElement('button'); button.type='button'; button.className='button secondary'; button.textContent='Restore';
      button.addEventListener('click', () => {
        if (!confirm(`Restore checkpoint from ${new Date(backup.createdAt).toLocaleString()}? A fresh checkpoint will be created first.`)) return;
        try { profileStore.restoreSafetyBackup(backup.id); location.reload(); }
        catch (error) { alert(`Checkpoint was not restored: ${error.message}`); }
      });
      row.append(label, button); els.safetyBackupList.append(row);
    });
  }

  function runDiagnostics() {
    const storageInfo = profileStore.getDiagnostics();
    const checks = [
      ['Profile store loaded', !!profileStore.getActiveProfileMeta()],
      ['Recipe modules available', Array.isArray(state.modules) && state.modules.length > 0],
      ['Favorites storage valid', Array.isArray(state.favorites)],
      ['Notes storage valid', state.recipeNotes && typeof state.recipeNotes === 'object' && !Array.isArray(state.recipeNotes)],
      ['Shopping list storage valid', Array.isArray(state.shoppingList)],
      ['Personal recipes available', Array.isArray(profileStore.activeProfile?.personalRecipes)],
      ['All retained checkpoints healthy', storageInfo.backupCount === storageInfo.validBackupCount],
      ['Service workers supported', 'serviceWorker' in navigator],
      ['Local storage writable', (() => { try { localStorage.setItem('kc-diagnostic-test','1'); localStorage.removeItem('kc-diagnostic-test'); return true; } catch { return false; } })()]
    ];
    const passed = checks.filter(([, ok]) => ok).length;
    els.diagnosticsOutput.hidden = false;
    els.diagnosticsOutput.textContent = `Kitchen Companion ${ENGINE_VERSION} diagnostics\n${checks.map(([name, ok]) => `${ok ? 'PASS' : 'FAIL'}  ${name}`).join('\n')}\n\nStorage used: ${(storageInfo.storageBytes/1024/1024).toFixed(2)} MB\nFull-module recovery points: ${storageInfo.fullBackupCount}\n${passed}/${checks.length} checks passed.`;
  }

  const FEEDBACK_TYPE_LABELS = {
    bug:'Bug or problem',
    suggestion:'Suggestion',
    question:'Question',
    general:'General feedback'
  };

  function newFeedbackReportId() {
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const bytes = new Uint8Array(3);
    globalThis.crypto?.getRandomValues?.(bytes);
    const suffix = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()
      || Math.random().toString(16).slice(2, 8).padEnd(6, '0').toUpperCase();
    return `KC-${stamp}-${suffix}`;
  }

  function openFeedbackDialog(initialType = 'general') {
    els.feedbackForm.reset();
    els.feedbackReportId.value = newFeedbackReportId();
    els.feedbackType.value = FEEDBACK_TYPE_LABELS[initialType] ? initialType : 'general';
    els.feedbackIncludeDiagnostics.checked = true;
    els.feedbackReportPreview.value = '';
    els.feedbackPreviewField.hidden = true;
    els.feedbackScreenshotStatus.textContent = 'No screenshot selected.';
    setFeedbackStatus('');
    updateFeedbackTypeFields();
    els.settingsDialog.close();
    els.feedbackDialog.showModal();
    window.setTimeout(() => els.feedbackSummary.focus(), 50);
  }

  function updateFeedbackTypeFields() {
    const isBug = els.feedbackType.value === 'bug';
    els.feedbackSeverityField.hidden = !isBug;
    els.feedbackBugFields.hidden = !isBug;
    els.feedbackDetailsField.hidden = isBug;
    for (const field of [els.feedbackActivity, els.feedbackActual, els.feedbackExpected]) field.required = isBug;
    els.feedbackDetails.required = !isBug;
    els.feedbackDialogTitle.textContent = isBug ? 'Report a problem' : 'Send feedback';
    els.feedbackIntro.textContent = isBug
      ? 'Tell us what happened. You can review everything before sharing it.'
      : 'Share an idea, question, or general feedback. You can review everything before sharing it.';
  }

  function validateFeedbackScreenshot() {
    const file = els.feedbackScreenshot.files?.[0];
    if (!file) {
      els.feedbackScreenshotStatus.textContent = 'No screenshot selected.';
      return true;
    }
    const looksLikeImage = String(file.type || '').startsWith('image/')
      || /\.(?:png|jpe?g|webp|gif|heic|heif)$/i.test(file.name || '');
    if (!looksLikeImage) {
      els.feedbackScreenshot.value = '';
      els.feedbackScreenshotStatus.textContent = 'The selected file is not an image.';
      return false;
    }
    if (file.size > 12 * 1024 * 1024) {
      els.feedbackScreenshot.value = '';
      els.feedbackScreenshotStatus.textContent = 'The screenshot is larger than the 12 MB limit.';
      return false;
    }
    els.feedbackScreenshotStatus.textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    return true;
  }

  function feedbackDiagnostics() {
    const storage = profileStore.getDiagnostics();
    return {
      appVersion:ENGINE_VERSION,
      moduleFormat:'1.x',
      installedModules:(state.modules || [])
        .filter(module => module.moduleId !== 'my-recipes')
        .map(module => ({
          moduleId:String(module.moduleId || ''),
          name:String(module.name || ''),
          version:String(module.version || ''),
          recipeCount:Array.isArray(module.recipes) ? module.recipes.length : 0,
          enabled:module.enabled !== false
        })),
      browser:{
        userAgent:String(navigator.userAgent || ''),
        platform:String(navigator.platform || ''),
        language:String(navigator.language || ''),
        online:navigator.onLine !== false,
        standalone:window.matchMedia?.('(display-mode: standalone)')?.matches || !!navigator.standalone
      },
      display:{
        viewportWidth:Math.round(window.innerWidth || 0),
        viewportHeight:Math.round(window.innerHeight || 0),
        screenWidth:Math.round(window.screen?.width || 0),
        screenHeight:Math.round(window.screen?.height || 0),
        pixelRatio:Number(window.devicePixelRatio || 1)
      },
      storage:{
        schemaVersion:storage.storageSchemaVersion,
        profileCount:storage.profileCount,
        moduleCount:storage.moduleCount,
        checkpointCount:storage.backupCount,
        healthyCheckpointCount:storage.validBackupCount,
        fullModuleRecoveryPoints:storage.fullBackupCount,
        approximateBytes:storage.storageBytes
      },
      context:{ currentView },
      startupErrors:startupIssues.map(issue => ({
        step:String(issue.label || 'unknown'),
        errorType:String(issue.error?.name || 'Error')
      }))
    };
  }

  function feedbackFormData() {
    const type = FEEDBACK_TYPE_LABELS[els.feedbackType.value] ? els.feedbackType.value : 'general';
    const screenshot = els.feedbackScreenshot.files?.[0] || null;
    return {
      reportId:els.feedbackReportId.value || newFeedbackReportId(),
      type,
      typeLabel:FEEDBACK_TYPE_LABELS[type],
      severity:type === 'bug' ? els.feedbackSeverity.value : '',
      summary:els.feedbackSummary.value.trim(),
      activity:type === 'bug' ? els.feedbackActivity.value.trim() : '',
      actual:type === 'bug' ? els.feedbackActual.value.trim() : '',
      expected:type === 'bug' ? els.feedbackExpected.value.trim() : '',
      details:type === 'bug' ? '' : els.feedbackDetails.value.trim(),
      contactEmail:els.feedbackEmail.value.trim(),
      screenshot:screenshot ? { name:screenshot.name, type:screenshot.type, size:screenshot.size } : null,
      diagnostics:els.feedbackIncludeDiagnostics.checked ? feedbackDiagnostics() : null
    };
  }

  function feedbackReportText(report) {
    const lines = [
      'Kitchen Companion Feedback Report',
      `Report ID: ${report.reportId}`,
      `Created: ${new Date().toLocaleString()}`,
      `Type: ${report.typeLabel}`,
      ...(report.severity ? [`Severity: ${report.severity}`] : []),
      '',
      `Summary: ${report.summary}`
    ];
    if (report.type === 'bug') {
      lines.push(
        '',
        'What I was doing:',
        report.activity,
        '',
        'What happened:',
        report.actual,
        '',
        'What I expected:',
        report.expected
      );
    } else lines.push('', 'Details:', report.details);
    if (report.contactEmail) lines.push('', `Contact email: ${report.contactEmail}`);
    lines.push('', `Screenshot attached: ${report.screenshot ? `${report.screenshot.name} (${report.screenshot.size} bytes)` : 'No'}`);
    if (report.diagnostics) lines.push('', 'Anonymous diagnostics:', JSON.stringify(report.diagnostics, null, 2));
    else lines.push('', 'Anonymous diagnostics: Not included');
    return lines.join('\n');
  }

  function prepareFeedbackPreview(requireValid = true, force = false) {
    if (requireValid && !els.feedbackForm.reportValidity()) return '';
    if (!validateFeedbackScreenshot()) return '';
    if (!force && !els.feedbackPreviewField.hidden && els.feedbackReportPreview.value.trim()) return els.feedbackReportPreview.value;
    const text = feedbackReportText(feedbackFormData());
    els.feedbackReportPreview.value = text;
    els.feedbackPreviewField.hidden = false;
    els.feedbackReportPreview.scrollIntoView({ behavior:'smooth', block:'center' });
    setFeedbackStatus('Report prepared. Review or edit it before sharing.');
    return text;
  }

  function currentFeedbackPayload() {
    const report = feedbackFormData();
    const reportText = els.feedbackReportPreview.value.trim() || feedbackReportText(report);
    return {
      format:'kitchen-companion-feedback',
      schemaVersion:1,
      reportId:report.reportId,
      createdAt:new Date().toISOString(),
      appVersion:ENGINE_VERSION,
      report:{
        type:report.type,
        severity:report.severity || null,
        summary:report.summary,
        activity:report.activity || null,
        actual:report.actual || null,
        expected:report.expected || null,
        details:report.details || null,
        contactEmail:report.contactEmail || null,
        screenshot:report.screenshot,
        diagnostics:report.diagnostics,
        reportText
      }
    };
  }

  function feedbackFilename() {
    return `Kitchen-Companion-Feedback-${safeFilename(els.feedbackReportId.value || newFeedbackReportId())}.kcfeedback`;
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function feedbackReportFile() {
    const payload = currentFeedbackPayload();
    return new File([JSON.stringify(payload, null, 2)], feedbackFilename(), { type:'application/json' });
  }

  function setFeedbackStatus(message, error = false) {
    els.feedbackStatus.textContent = message;
    els.feedbackStatus.classList.toggle('form-error', !!error);
  }

  async function copyFeedbackReport() {
    if (!prepareFeedbackPreview()) return;
    try {
      await copyTextToClipboard(els.feedbackReportPreview.value);
      setFeedbackStatus('Report copied. Paste it into a text, email, Messenger, or another app.');
    } catch (error) { setFeedbackStatus(`Report could not be copied: ${error.message}`, true); }
  }

  function downloadFeedbackReport() {
    if (!prepareFeedbackPreview()) return;
    const file = feedbackReportFile();
    downloadBlob(file.name, file);
    setFeedbackStatus('Report downloaded. Attach it wherever you want to send it.');
  }

  async function shareFeedbackReport(event) {
    event.preventDefault();
    if (!prepareFeedbackPreview()) return;
    const reportFile = feedbackReportFile();
    const screenshot = els.feedbackScreenshot.files?.[0] || null;
    const files = screenshot ? [reportFile, screenshot] : [reportFile];
    const shareTitle = `Kitchen Companion report ${els.feedbackReportId.value}`;
    try {
      if (navigator.share) {
        if (!navigator.canShare || navigator.canShare({ files })) {
          await navigator.share({ title:shareTitle, text:`Kitchen Companion ${FEEDBACK_TYPE_LABELS[els.feedbackType.value]} — ${els.feedbackSummary.value.trim()}`, files });
        } else {
          await navigator.share({ title:shareTitle, text:els.feedbackReportPreview.value });
        }
        setFeedbackStatus('The report was handed to your selected sharing app.');
        return;
      }
      downloadBlob(reportFile.name, reportFile);
      setFeedbackStatus('Sharing is not supported here, so the report was downloaded instead.');
    } catch (error) {
      if (error?.name === 'AbortError') {
        setFeedbackStatus('Sharing was canceled. Your completed report is still here.');
        return;
      }
      setFeedbackStatus(`The report could not be shared: ${error.message || error}. Use Download Report instead.`, true);
    }
  }

  function optimizeLocalStorage() {
    try {
      const result = profileStore.optimizeStorage();
      renderSafeguards();
      const freed = (result.freedBytes / 1024 / 1024).toFixed(2);
      alert(`Storage cleanup complete. ${freed} MB was freed. Your active recipes, profiles, notes, shopping data, and settings were not removed.`);
    } catch (error) { alert(`Storage cleanup could not finish: ${error.message}`); }
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

  function repairFavoriteReferences() {
    const allRecipes = getAllRecipes({ enabledOnly:false, includeOverridden:true, includeHidden:true });
    const byKey = new Map(allRecipes.map(recipe => [recipe.key, recipe]));
    let overriddenBy = new Map(allRecipes.filter(recipe => recipe.moduleId === 'my-recipes' && recipe.copiedFrom).map(recipe => [recipe.copiedFrom, recipe.key]));
    const byModuleAndName = new Map();
    allRecipes.forEach(recipe => {
      const lookup = `${recipe.moduleId}|${engine.slugify(recipe.name)}`;
      const matches = byModuleAndName.get(lookup) || [];
      matches.push(recipe.key);
      byModuleAndName.set(lookup, matches);
    });
    const referencedKeys = new Set([
      ...(state.favorites || []),
      ...(state.hiddenRecipes || []),
      ...Object.keys(state.ratings || {}),
      ...Object.keys(state.recipeNotes || {}),
      ...(state.manualCrossLinks || []).flatMap(link => [link.sourceKey, link.targetKey]),
      ...(state.timers || []).map(timer => timer.recipeKey),
      ...(state.shoppingList || []).flatMap(item => (item.entries || []).map(entry => entry.recipeKey)),
      ...(state.modules.find(module => module.moduleId === 'my-recipes')?.recipes || []).map(recipe => recipe.copiedFrom)
    ].filter(key => typeof key === 'string' && key));
    const keyMap = new Map();
    referencedKeys.forEach(key => {
      if (byKey.has(key)) return;
      const separator = key.indexOf(':');
      if (separator <= 0) return;
      const lookup = `${key.slice(0, separator)}|${engine.slugify(key.slice(separator + 1))}`;
      const matches = byModuleAndName.get(lookup) || [];
      if (matches.length === 1) keyMap.set(key, matches[0]);
    });
    remapRecipeReferences(keyMap);
    overriddenBy = new Map((state.modules.find(module => module.moduleId === 'my-recipes')?.recipes || [])
      .filter(recipe => recipe.copiedFrom)
      .map(recipe => [recipe.copiedFrom, `my-recipes:${recipe.id}`]));
    const repaired = [];
    (state.favorites || []).forEach(rawKey => {
      if (typeof rawKey !== 'string' || !rawKey) return;
      let key = overriddenBy.get(rawKey) || rawKey;
      if (!byKey.has(key)) {
        const separator = key.indexOf(':');
        if (separator > 0) {
          const lookup = `${key.slice(0, separator)}|${engine.slugify(key.slice(separator + 1))}`;
          const matches = byModuleAndName.get(lookup) || [];
          if (matches.length === 1) key = overriddenBy.get(matches[0]) || matches[0];
        }
      }
      if (byKey.has(key) && !repaired.includes(key)) repaired.push(key);
    });
    const changed = keyMap.size > 0 || JSON.stringify(repaired) !== JSON.stringify(state.favorites || []);
    state.favorites = repaired;
    return changed;
  }

  function renderCounts() {
    const recipes = getAllRecipes();
    const visibleKeys = new Set(recipes.map(recipe => recipe.key));
    els.moduleCount.textContent = `${state.modules.length} module${state.modules.length === 1 ? '' : 's'}`;
    els.navModuleCount.textContent = state.modules.length;
    els.allCount.textContent = recipes.length;
    els.favoriteCount.textContent = [...new Set(state.favorites)].filter(key => visibleKeys.has(key)).length;
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
    if (els.ratingFilter) els.ratingFilter.value = 'all';
    if (els.ratingSort) els.ratingSort.value = 'name';
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
    const ratingFilter = els.ratingFilter?.value || 'all';
    if (ratingFilter === 'rated') recipes = recipes.filter(recipe => recipeRatingValue(recipe.key) > 0);
    else if (ratingFilter === 'unrated') recipes = recipes.filter(recipe => recipeRatingValue(recipe.key) === 0);
    else if (/^[3-5]$/.test(ratingFilter)) recipes = recipes.filter(recipe => recipeRatingValue(recipe.key) >= Number(ratingFilter));

    els.viewTitle.textContent = currentView === 'favorites' ? 'Favorites' : currentView === 'category' ? selectedCategory : 'All recipes';
    els.viewSubtitle.textContent = `${recipes.length} recipe${recipes.length === 1 ? '' : 's'} shown.`;
    els.recipeGrid.innerHTML = '';
    els.emptyState.hidden = recipes.length > 0;

    const ratingSort = els.ratingSort?.value || 'name';
    recipes.sort((a, b) => {
      if (ratingSort === 'rating-high') return recipeRatingValue(b.key) - recipeRatingValue(a.key) || a.name.localeCompare(b.name);
      if (ratingSort === 'rating-low') {
        const aValue = recipeRatingValue(a.key); const bValue = recipeRatingValue(b.key);
        return (aValue || 6) - (bValue || 6) || a.name.localeCompare(b.name);
      }
      if (ratingSort === 'recently-rated') {
        const aTime = Date.parse(recipeRatingRecord(a.key)?.updatedAt || '') || 0;
        const bTime = Date.parse(recipeRatingRecord(b.key)?.updatedAt || '') || 0;
        return bTime - aTime || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    }).forEach(recipe => {
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
      const rating = recipeRatingValue(recipe.key);
      const ratingSummary = fragment.querySelector('.recipe-card-rating');
      if (rating) {
        ratingSummary.hidden = false;
        ratingSummary.textContent = `${ratingStars(rating)} ${rating}/5`;
        ratingSummary.setAttribute('aria-label', `My rating: ${rating} out of 5`);
      }
      fragment.querySelector('.recipe-description').textContent = recipe.description || 'No description yet.';
      const meta = fragment.querySelector('.recipe-meta');
      [recipe.prepTime && `Prep ${recipe.prepTime}`, recipe.cookTime && `Cook ${recipe.cookTime}`, recipe.yield && `${recipe.yield.amount} ${recipe.yield.unit}`].filter(Boolean).forEach(text => {
        const span = document.createElement('span'); span.textContent = text; meta.append(span);
      });
      fragment.querySelector('.recipe-source').textContent = recipe.moduleName;
      const openCard = () => { recipeNavigationStack = []; selectedRecipeKey = recipe.key; activeScale = 1; showDetail(); };
      card.addEventListener('click', openCard);
      card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCard(); } });
      els.recipeGrid.append(fragment);
    });
  }

  function recipeSearchText(recipe) { return engine.searchText(recipe); }

  function showList() {
    recipeNavigationStack = [];
    selectedRecipeKey = null;
    els.listPane.hidden = false; els.detailPane.hidden = true; els.modulesPane.hidden = true; els.shoppingPane.hidden = true;
    renderRecipeList(); updateWakeLock(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showDetail() {
    els.listPane.hidden = true; els.detailPane.hidden = false; els.modulesPane.hidden = true; els.shoppingPane.hidden = true;
    renderRecipeDetail(); updateWakeLock(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigateBackFromRecipe() {
    const previous = recipeNavigationStack.pop();
    if (!previous) return showList();
    selectedRecipeKey = previous;
    activeScale = 1;
    showDetail();
  }

  function openCrossLinkedRecipe(targetKey) {
    if (!targetKey || targetKey === selectedRecipeKey) return;
    if (selectedRecipeKey) recipeNavigationStack.push(selectedRecipeKey);
    selectedRecipeKey = targetKey;
    activeScale = 1;
    document.querySelector('#crossLinkChoicesDialog')?.close();
    showDetail();
  }

  function showModules() {
    selectedRecipeKey = null;
    els.listPane.hidden = true; els.detailPane.hidden = true; els.modulesPane.hidden = false; els.shoppingPane.hidden = true;
    renderModules(); updateWakeLock(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  let crossLinkCache = { signature:'', index:null };
  function getCrossLinkIndex() {
    const recipes = getAllRecipes();
    const signature = JSON.stringify(recipes.map(recipe => [
      recipe.key,
      recipe.name,
      recipe.crossLinkAliases,
      recipe.description,
      (recipe.ingredientGroups || []).flatMap(group => (group.ingredients || []).map(ingredient => ingredient.item)),
      recipe.instructions
    ]));
    if (crossLinkCache.signature !== signature) {
      crossLinkCache = { signature, index:engine.buildCrossLinks(recipes) };
    }
    return crossLinkCache.index;
  }

  function combinedCrossLinks(recipeKey, automaticIndex = getCrossLinkIndex()) {
    const recipesByKey = new Map(getAllRecipes().map(recipe => [recipe.key, recipe]));
    const outgoing = [...(automaticIndex.outgoingByRecipe.get(recipeKey) || [])];
    const incoming = [...(automaticIndex.incomingByRecipe.get(recipeKey) || [])];
    (state.manualCrossLinks || []).forEach(link => {
      if (!link?.id || !['ingredient','pairing'].includes(link.type)) return;
      const source = recipesByKey.get(link.sourceKey);
      const target = recipesByKey.get(link.targetKey);
      if (!source || !target || source.key === target.key) return;
      if (source.key === recipeKey) outgoing.push({
        id:`manual-${link.id}`,
        type:link.type,
        context:'',
        manualId:link.id,
        targets:[{ key:target.key, name:target.name, moduleName:target.moduleName, manualId:link.id }]
      });
      if (target.key === recipeKey) incoming.push({
        sourceKey:source.key,
        sourceName:source.name,
        sourceModuleName:source.moduleName,
        type:link.type,
        manualId:link.id
      });
    });
    return { outgoing, incoming };
  }

  function compactCrossLinkButton(target) {
    const linkButton = `<button type="button" class="crosslink-used-link" data-crosslink-target="${escapeHtml(target.key)}">${escapeHtml(target.name)}</button>`;
    if (!target.manualId) return linkButton;
    return `<span class="manual-crosslink-row">${linkButton}<button type="button" class="manual-crosslink-remove" data-remove-crosslink="${escapeHtml(target.manualId)}" aria-label="Remove manual link to ${escapeHtml(target.name)}">Remove</button></span>`;
  }

  function renderCrossLinkTargetButton(target, label = '') {
    return `<button type="button" class="crosslink-target-button" data-crosslink-target="${escapeHtml(target.key)}">${escapeHtml(label || target.name)}<small>${escapeHtml(target.moduleName || '')}</small></button>`;
  }

  function renderCrossLinkSection(recipe, links, incoming) {
    const outgoingByTarget = new Map();
    links.forEach(link => link.targets.forEach(target => {
      const existing = outgoingByTarget.get(target.key);
      if (!existing || (existing.type === 'pairing' && link.type === 'ingredient')) outgoingByTarget.set(target.key, { ...target, type:link.type, manualId:link.manualId || target.manualId });
    }));
    const renderCompactLinks = targets => targets.map(compactCrossLinkButton).join('');
    const usedRecipeLinks = renderCompactLinks([...outgoingByTarget.values()].filter(target => target.type === 'ingredient'));
    const outgoingPairingLinks = renderCompactLinks([...outgoingByTarget.values()].filter(target => target.type === 'pairing'));
    const outgoingSections = `${usedRecipeLinks ? `<div class="crosslink-subsection crosslink-used-section"><h3>Uses:</h3><div class="crosslink-used-list">${usedRecipeLinks}</div></div>` : ''}${outgoingPairingLinks ? `<div class="crosslink-subsection crosslink-used-section"><h3>Paired with:</h3><div class="crosslink-used-list">${outgoingPairingLinks}</div></div>` : ''}`;
    const incomingBySource = new Map();
    incoming.forEach(reference => {
      const existing = incomingBySource.get(reference.sourceKey);
      if (!existing || (existing.type === 'pairing' && reference.type === 'ingredient')) incomingBySource.set(reference.sourceKey, reference);
    });
    const uniqueIncoming = [...incomingBySource.values()];
    const renderIncomingList = type => uniqueIncoming.filter(reference => reference.type === type).map(reference =>
      compactCrossLinkButton({ key:reference.sourceKey, name:reference.sourceName, manualId:reference.manualId })
    ).join('');
    const usedWithLinks = renderIncomingList('ingredient');
    const pairedWithLinks = renderIncomingList('pairing');
    const incomingSections = `${usedWithLinks ? `<div class="crosslink-subsection crosslink-used-section"><h3>Used with:</h3><div class="crosslink-used-list">${usedWithLinks}</div></div>` : ''}${pairedWithLinks ? `<div class="crosslink-subsection crosslink-used-section"><h3>Paired with:</h3><div class="crosslink-used-list">${pairedWithLinks}</div></div>` : ''}`;
    const connectionCount = outgoingByTarget.size + uniqueIncoming.length;
    return `<section class="recipe-section crosslink-section"><div class="crosslink-heading"><div><div class="recipe-kicker">Across installed modules</div><h2>Cross-Link</h2></div><div class="crosslink-heading-actions"><span>${connectionCount} connection${connectionCount === 1 ? '' : 's'}</span><button type="button" id="addManualCrossLink" class="button secondary">+ Add link</button></div></div>${outgoingSections}${incomingSections}${connectionCount ? '' : '<p class="crosslink-empty">No connected recipes yet. Add one manually or install a module containing a matching recipe.</p>'}</section>`;
  }

  function openCrossLinkChoices(link) {
    const dialog = document.querySelector('#crossLinkChoicesDialog');
    const context = document.querySelector('#crossLinkChoicesContext');
    const list = document.querySelector('#crossLinkChoicesList');
    context.textContent = link.type === 'ingredient' ? `Recipes matching “${link.context}”` : link.context;
    list.innerHTML = link.targets.map(target => renderCrossLinkTargetButton(target)).join('');
    list.querySelectorAll('[data-crosslink-target]').forEach(button => button.addEventListener('click', () => openCrossLinkedRecipe(button.dataset.crosslinkTarget)));
    dialog.showModal();
  }

  function bindCrossLinkControls(links) {
    document.querySelectorAll('[data-crosslink-target]').forEach(button => button.addEventListener('click', () => openCrossLinkedRecipe(button.dataset.crosslinkTarget)));
    document.querySelector('#addManualCrossLink')?.addEventListener('click', openManualCrossLinkDialog);
    document.querySelectorAll('[data-remove-crosslink]').forEach(button => button.addEventListener('click', () => removeManualCrossLink(button.dataset.removeCrosslink)));
    document.querySelectorAll('[data-crosslink-choice]').forEach(button => button.addEventListener('click', () => {
      const link = links.find(item => item.id === button.dataset.crosslinkChoice);
      if (link) openCrossLinkChoices(link);
    }));
  }

  function openManualCrossLinkDialog() {
    const source = getAllRecipes({ enabledOnly:false, includeOverridden:true }).find(recipe => recipe.key === selectedRecipeKey);
    if (!source) return;
    const dialog = document.querySelector('#manualCrossLinkDialog');
    document.querySelector('#manualCrossLinkSource').textContent = `Link another installed recipe to ${source.name}.`;
    document.querySelector('#manualCrossLinkType').value = 'source-uses-target';
    document.querySelector('#manualCrossLinkSearch').value = '';
    renderManualCrossLinkResults();
    dialog.showModal();
    window.setTimeout(() => document.querySelector('#manualCrossLinkSearch')?.focus(), 50);
  }

  function manualLinkAlreadyExists(sourceKey, targetKey, type) {
    const automatic = getCrossLinkIndex();
    if ((automatic.outgoingByRecipe.get(sourceKey) || []).some(link => link.targets.some(target => target.key === targetKey))) return true;
    if ((state.manualCrossLinks || []).some(link => link.sourceKey === sourceKey && link.targetKey === targetKey)) return true;
    if (type === 'pairing') {
      if ((automatic.incomingByRecipe.get(sourceKey) || []).some(link => link.type === 'pairing' && link.sourceKey === targetKey)) return true;
      if ((state.manualCrossLinks || []).some(link => link.type === 'pairing' && link.sourceKey === targetKey && link.targetKey === sourceKey)) return true;
    }
    return false;
  }

  function manualLinkEndpoints(selectedKey, relationship) {
    if (relationship === 'target-uses-source') return { sourceKey:selectedKey, targetKey:selectedRecipeKey, type:'ingredient' };
    return { sourceKey:selectedRecipeKey, targetKey:selectedKey, type:relationship === 'pairing' ? 'pairing' : 'ingredient' };
  }

  function renderManualCrossLinkResults() {
    const results = document.querySelector('#manualCrossLinkResults');
    if (!results || !selectedRecipeKey) return;
    const query = String(document.querySelector('#manualCrossLinkSearch')?.value || '').trim().toLowerCase();
    const relationship = document.querySelector('#manualCrossLinkType')?.value || 'source-uses-target';
    const matches = getAllRecipes()
      .filter(recipe => recipe.key !== selectedRecipeKey)
      .filter(recipe => !query || `${recipe.name} ${recipe.moduleName}`.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 60);
    if (!matches.length) {
      results.innerHTML = '<p class="crosslink-empty">No installed recipes match that search.</p>';
      return;
    }
    results.innerHTML = matches.map(recipe => {
      const endpoints = manualLinkEndpoints(recipe.key, relationship);
      const linked = manualLinkAlreadyExists(endpoints.sourceKey, endpoints.targetKey, endpoints.type);
      return `<button type="button" class="manual-crosslink-choice" data-manual-crosslink-target="${escapeHtml(recipe.key)}" ${linked ? 'disabled' : ''}><strong>${escapeHtml(recipe.name)}</strong><small>${escapeHtml(recipe.moduleName || '')}${linked ? ' · Already linked' : ''}</small></button>`;
    }).join('');
    results.querySelectorAll('[data-manual-crosslink-target]:not(:disabled)').forEach(button => button.addEventListener('click', () => addManualCrossLink(button.dataset.manualCrosslinkTarget)));
  }

  function addManualCrossLink(selectedTargetKey) {
    const relationship = document.querySelector('#manualCrossLinkType')?.value || 'source-uses-target';
    const endpoints = manualLinkEndpoints(selectedTargetKey, relationship);
    const { sourceKey, targetKey, type } = endpoints;
    if (!selectedRecipeKey || !selectedTargetKey || selectedRecipeKey === selectedTargetKey) return;
    if (manualLinkAlreadyExists(sourceKey, targetKey, type)) return alert('Those recipes are already linked.');
    const link = {
      id:globalThis.crypto?.randomUUID?.() || `crosslink-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sourceKey,
      targetKey,
      type,
      createdAt:new Date().toISOString()
    };
    state.manualCrossLinks.push(link);
    try {
      saveState();
      document.querySelector('#manualCrossLinkDialog')?.close();
      renderRecipeDetail();
    } catch (error) {
      state.manualCrossLinks = state.manualCrossLinks.filter(item => item.id !== link.id);
      alert(`The recipe link could not be saved: ${error.message}`);
    }
  }

  function removeManualCrossLink(linkId) {
    const link = (state.manualCrossLinks || []).find(item => item.id === linkId);
    if (!link || !confirm('Remove this manual recipe link?')) return;
    const previous = state.manualCrossLinks;
    state.manualCrossLinks = previous.filter(item => item.id !== linkId);
    try {
      saveState();
      renderRecipeDetail();
    } catch (error) {
      state.manualCrossLinks = previous;
      alert(`The recipe link could not be removed: ${error.message}`);
    }
  }

  function renderRecipeRating(recipe) {
    const value = recipeRatingValue(recipe.key);
    const stars = [1,2,3,4,5].map(star =>
      `<button type="button" class="recipe-rating-star ${star <= value ? 'selected' : ''}" data-recipe-rating="${star}" aria-label="Rate ${star} out of 5" aria-pressed="${star === value}">★</button>`
    ).join('');
    return `<div class="recipe-rating-panel"><div><strong>My rating</strong><span>${value ? `${value} out of 5` : 'Not rated yet'}</span></div><div class="recipe-rating-controls" role="group" aria-label="Rate ${escapeHtml(recipe.name)}">${stars}${value ? '<button type="button" id="clearRecipeRating" class="recipe-rating-clear">Clear</button>' : ''}</div></div>`;
  }

  function setRecipeRating(recipeKey, value) {
    const rating = Number(value);
    if (!recipeKey || !Number.isInteger(rating) || rating < 0 || rating > 5) return;
    const previous = state.ratings[recipeKey] ? JSON.parse(JSON.stringify(state.ratings[recipeKey])) : null;
    if (rating) state.ratings[recipeKey] = { value:rating, updatedAt:new Date().toISOString() };
    else delete state.ratings[recipeKey];
    try {
      saveState();
      const persisted = normalizeRatingRecord(profileStore.loadActiveState().ratings?.[recipeKey]);
      if ((persisted?.value || 0) !== rating) throw new Error('Saved rating could not be verified.');
      renderRecipeDetail();
    } catch (error) {
      if (previous) state.ratings[recipeKey] = previous; else delete state.ratings[recipeKey];
      alert(`The rating could not be saved: ${error.message}`);
    }
  }

  function renderRecipeDetail() {
    const recipe = getAllRecipes({ enabledOnly: false, includeOverridden: true }).find(r => r.key === selectedRecipeKey);
    if (!recipe) return showList();
    const crossLinkIndex = getCrossLinkIndex();
    const combinedLinks = combinedCrossLinks(recipe.key, crossLinkIndex);
    const crossLinks = combinedLinks.outgoing;
    const incomingLinks = combinedLinks.incoming;
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
        ${renderRecipeRating(recipe)}
        <div class="recipe-action-row"><button id="favoriteRecipeBtn" class="favorite-button">${favorite ? '★ Saved' : '☆ Favorite'}</button><button id="editRecipeBtn" class="button secondary">✎ Edit</button><button id="shareRecipeBtn" class="button secondary">Share recipe</button>${recipe.copiedFrom ? '<button id="viewOriginalBtn" class="button secondary">View original</button>' : ''}${recipe.moduleId === 'my-recipes' ? '<button id="deleteRecipeBtn" class="button danger">Delete recipe</button>' : '<button id="hideRecipeBtn" class="button danger">Hide recipe</button>'}</div>
      </section>
      <div class="scale-bar"><strong>Scale recipe:</strong>${[0.5,1,1.5,2,3].map(scale => `<button class="scale-button ${scale === activeScale ? 'active' : ''}" data-scale="${scale}">${scale}×</button>`).join('')}</div>
      <div class="recipe-layout">
        <section class="recipe-section"><div class="section-title-row"><h2>Ingredients</h2><button id="addIngredientsBtn" class="button secondary">Add to shopping list</button></div>${renderIngredientGroups(recipe, crossLinks)}</section>
        <section class="recipe-section"><h2>Instructions</h2><ol class="instruction-list">${(recipe.instructions || []).map((step,index) => `<li>${renderInstructionWithTimers(step, recipe, index)}</li>`).join('')}</ol></section>
      </div>
      ${renderCrossLinkSection(recipe, crossLinks, incomingLinks)}
      <section class="recipe-section recipe-notes"><h2>My notes</h2><textarea id="recipeNotesInput" placeholder="Add changes, reminders, results, or ideas for next time…">${escapeHtml(state.recipeNotes[recipe.key] || '')}</textarea><div id="saveNoteStatus" class="save-note-status"></div></section>`;

    document.querySelector('#favoriteRecipeBtn').addEventListener('click', () => toggleFavorite(recipe.key));
    document.querySelectorAll('[data-recipe-rating]').forEach(button => button.addEventListener('click', () => setRecipeRating(recipe.key, Number(button.dataset.recipeRating))));
    document.querySelector('#clearRecipeRating')?.addEventListener('click', () => setRecipeRating(recipe.key, 0));
    document.querySelector('#editRecipeBtn').addEventListener('click', () => openRecipeEditor(recipe));
    document.querySelector('#shareRecipeBtn').addEventListener('click', () => openShareRecipe(recipe));
    document.querySelector('#addIngredientsBtn').addEventListener('click', () => openIngredientShopping(recipe));
    document.querySelector('#viewOriginalBtn')?.addEventListener('click', () => { selectedRecipeKey = recipe.copiedFrom; renderRecipeDetail(); });
    document.querySelector('#deleteRecipeBtn')?.addEventListener('click', () => deletePersonalRecipe(recipe));
    document.querySelector('#hideRecipeBtn')?.addEventListener('click', () => hideModuleRecipe(recipe));
    document.querySelectorAll('.timer-link').forEach(button => button.addEventListener('click', () => offerTimer(button, recipe)));
    bindCrossLinkControls(crossLinks);
    const notesInput = document.querySelector('#recipeNotesInput'); let noteTimer;
    notesInput.addEventListener('input', () => { clearTimeout(noteTimer); document.querySelector('#saveNoteStatus').textContent = 'Saving…'; noteTimer=setTimeout(() => { state.recipeNotes[recipe.key]=notesInput.value; saveState(); document.querySelector('#saveNoteStatus').textContent='Saved on this device'; }, 350); });
    document.querySelectorAll('.scale-button').forEach(button => button.addEventListener('click', () => { activeScale = Number(button.dataset.scale); renderRecipeDetail(); }));
  }

  function renderIngredientGroups(recipe, crossLinks = []) {
    const ingredientLinks = new Map(crossLinks.filter(link => link.type === 'ingredient').map(link => [`${link.groupIndex}:${link.ingredientIndex}`, link]));
    return (recipe.ingredientGroups || []).map(group => `
      <div class="ingredient-group">
        ${group.name && group.name !== 'Main' ? `<h3>${escapeHtml(group.name)}</h3>` : ''}
        <ul class="ingredient-list">${(group.ingredients || []).map((ingredient, ingredientIndex) => {
          const groupIndex = (recipe.ingredientGroups || []).indexOf(group);
          const link = ingredientLinks.get(`${groupIndex}:${ingredientIndex}`);
          const linkButton = !link ? '' : link.targets.length === 1
            ? `<button type="button" class="crosslink-inline-button" data-crosslink-target="${escapeHtml(link.targets[0].key)}">View recipe</button>`
            : `<button type="button" class="crosslink-inline-button" data-crosslink-choice="${escapeHtml(link.id)}">${link.targets.length} recipe options</button>`;
          return `<li><label><input type="checkbox"><span>${formatIngredient(ingredient)}</span></label>${linkButton}</li>`;
        }).join('')}</ul>
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
    repairFavoriteReferences();
    if (state.favorites.includes(key)) state.favorites = state.favorites.filter(item => item !== key);
    else state.favorites = [...new Set([...state.favorites, key])];
    saveState(); renderCounts(); renderRecipeDetail();
  }

  function toggleFavoriteFromList(key) {
    repairFavoriteReferences();
    if (state.favorites.includes(key)) state.favorites = state.favorites.filter(item => item !== key);
    else state.favorites = [...new Set([...state.favorites, key])];
    saveState();
    renderCounts();
    renderRecipeList();
  }

  function cleanupRecipeReferences(key) {
    state.favorites = state.favorites.filter(item => item !== key);
    delete state.recipeNotes[key];
    state.timers = state.timers.filter(timer => timer.recipeKey !== key);
    state.shoppingList = state.shoppingList.map(item => ({...item, entries:(item.entries||[]).filter(entry=>entry.recipeKey!==key)})).filter(item=>(item.entries||[]).length);
  }

  function deletePersonalRecipe(recipe) {
    if (recipe.moduleId !== 'my-recipes') return;
    if (!confirm(`Permanently delete “${recipe.name}”?

This removes the recipe, its favorite status, notes, and related personal metadata from this device.`)) return;
    try {
      requireSafetyCheckpoint('before-recipe-delete');
      const personal = ensurePersonalModule();
      personal.recipes = personal.recipes.filter(item => item.id !== recipe.id);
      cleanupRecipeReferences(recipe.key);
      state.hiddenRecipes = state.hiddenRecipes.filter(key => key !== recipe.key);
      selectedRecipeKey = null;
      saveState(); refreshAll(); showList();
    } catch (error) { alert(`Recipe was not deleted: ${error.message}`); }
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
      if (els.recognizedRecipeText.dataset.ocrQuality === 'low') {
        alert('This scan was not reliable enough to parse safely. Use the original full-resolution photo, crop closer to the recipe, or correct the recognized text before continuing.');
        return;
      }
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
    const categories=allCategoryNames();
    if(!categories.includes('Uncategorized'))categories.push('Uncategorized');
    categories.sort((a,b)=>a.localeCompare(b)).forEach(category => { const option=document.createElement('option'); option.value=category; option.textContent=category; els.editCategory.append(option); });
    if (selected && !categories.includes(selected)) { const option=document.createElement('option'); option.value=selected; option.textContent=selected; els.editCategory.append(option); }
    els.editCategory.value = selected || 'Uncategorized';
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
    const pattern = /\b(?:(\d+)\s*(?:hours?|hrs?|hr)\s*(?:and\s*)?)?(\d+(?:\s*(?:[–-]|to)\s*\d+)?)\s*(minutes?|mins?|min)\b|\b(\d+(?:\s*(?:[–-]|to)\s*\d+)?)\s*(hours?|hrs?|hr)\b/gi;
    return escaped.replace(pattern, (match, hours, minutePart, _minuteUnit, hourOnly) => {
      let values=[];
      if (hourOnly) values=String(hourOnly).split(/\s*(?:[–-]|to)\s*/i).map(value=>Number(value)*60);
      else {
        const base=(Number(hours)||0)*60;
        const nums=String(minutePart).split(/\s*(?:[–-]|to)\s*/i).map(x=>Number(x.trim()));
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
    bellAudio = new Audio('./alarm-bell.wav?v=0.16.7');
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
    const quantity = parseQuantity(match[1]), candidateUnit = (match[2] || '').replace(/[.,]$/, '');
    const knownUnits = new Set(['cup','cups','tbsp','tablespoon','tablespoons','tsp','teaspoon','teaspoons','oz','ounce','ounces','lb','lbs','pound','pounds','g','gram','grams','kg','ml','l','liter','liters','clove','cloves','can','cans','package','packages','packet','packets','stick','sticks','slice','slices','piece','pieces','pinch','dash']);
    const unit = knownUnits.has(candidateUnit.toLowerCase()) ? candidateUnit : '';
    const item = unit ? (match[3] || unit) : [candidateUnit, match[3]].filter(Boolean).join(' ');
    return { quantity, unit: item === unit ? '' : unit, item, scalable: Number.isFinite(quantity) };
  }
  function parseQuantity(text) { const glyphs={'⅛':.125,'¼':.25,'⅓':1/3,'⅜':.375,'½':.5,'⅝':.625,'⅔':2/3,'¾':.75,'⅞':.875}; if(glyphs[text]) return glyphs[text]; if(text.includes(' ')){const [a,b]=text.split(' '); return Number(a)+parseQuantity(b);} if(text.includes('/')){const [a,b]=text.split('/').map(Number); return a/b;} return Number(text); }
  function slugify(text) { return engine.slugify(text); }
  function uniqueRecipeId(base, recipes) { return engine.uniqueRecipeId(base, recipes); }

  async function importModules(event) {
    const files = [...event.target.files];
    let backupCreated = false;
    for (const file of files) {
      try {
        const module = JSON.parse(await file.text());
        const report = validateModule(module);
        if (report.warnings.length) console.warn(`Imported ${file.name} with warnings:`, report.warnings);
        module.enabled = module.enabled !== false;
        if (!backupCreated) { requireSafetyCheckpoint('before-module-import'); backupCreated = true; }
        const existingIndex = state.modules.findIndex(m => m.moduleId === module.moduleId);
        if (existingIndex >= 0) {
          const replace = confirm(`${module.name} is already installed. Replace version ${state.modules[existingIndex].version} with ${module.version}?`);
          if (!replace) continue;
          const recipeKeyMap = buildRecipeUpdateKeyMap([state.modules[existingIndex]], module);
          state.modules[existingIndex] = module;
          remapRecipeReferences(recipeKeyMap);
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

  function requireSafetyCheckpoint(reason) {
    const backup = profileStore.createSafetyBackup(reason, { force:true, required:true });
    if (!backup) throw new Error('A verified safety checkpoint could not be created.');
    return backup;
  }

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
        try {
          requireSafetyCheckpoint('before-module-uninstall');
          state.modules = state.modules.filter(m => m.moduleId !== module.moduleId); delete state.moduleSources[module.moduleId];
          state.favorites = state.favorites.filter(key => !key.startsWith(`${module.moduleId}:`));
          state.hiddenRecipes = state.hiddenRecipes.filter(key => !key.startsWith(`${module.moduleId}:`));
          saveState(); refreshAll(); renderModules();
        } catch (error) { alert(`Module was not uninstalled: ${error.message}`); }
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


  let shoppingSelectionMode = false;
  const shoppingSelectedIds = new Set();
  let shoppingUndoSnapshot = null;
  let shoppingUndoTimer = null;
  let shoppingMoveTargetIds = [];

  function visibleShoppingItems() {
    const filter = els.shoppingStoreFilter.value || 'all';
    return state.shoppingList
      .filter(item => filter === 'all' || normalizeStore(item.store) === filter)
      .sort((a,b) => Number(a.checked) - Number(b.checked)
        || (SHOPPING_GROUP_ORDER.get(a.group) ?? 999) - (SHOPPING_GROUP_ORDER.get(b.group) ?? 999)
        || String(a.aisle || '').localeCompare(String(b.aisle || ''), undefined, { numeric:true, sensitivity:'base' })
        || a.name.localeCompare(b.name));
  }

  function updateShoppingBulkBar() {
    const normal = document.querySelector('#shoppingSelectBtn');
    const actions = document.querySelector('#shoppingBulkActions');
    const count = document.querySelector('#shoppingSelectedCount');
    const move = document.querySelector('#shoppingBulkMove');
    const del = document.querySelector('#shoppingBulkDelete');
    if (!normal || !actions) return;
    normal.hidden = shoppingSelectionMode;
    actions.hidden = !shoppingSelectionMode;
    const n = shoppingSelectedIds.size;
    count.textContent = `${n} selected`;
    move.disabled = n === 0;
    del.disabled = n === 0;
    const allButton = document.querySelector('#shoppingSelectAll');
    const visible = visibleShoppingItems();
    const allSelected = visible.length > 0 && visible.every(item => shoppingSelectedIds.has(item.id));
    if (allButton) {
      allButton.textContent = allSelected ? 'None' : 'All';
      allButton.setAttribute('aria-label', allSelected ? 'Clear all visible selections' : 'Select all visible items');
    }
  }

  function beginShoppingSelection() {
    shoppingSelectionMode = true;
    shoppingSelectedIds.clear();
    updateShoppingBulkBar();
    renderShoppingList();
  }

  function cancelShoppingSelection() {
    shoppingSelectionMode = false;
    shoppingSelectedIds.clear();
    updateShoppingBulkBar();
    renderShoppingList();
  }

  function selectAllVisibleShopping() {
    const visible = visibleShoppingItems();
    const allSelected = visible.length > 0 && visible.every(item => shoppingSelectedIds.has(item.id));
    visible.forEach(item => allSelected ? shoppingSelectedIds.delete(item.id) : shoppingSelectedIds.add(item.id));
    updateShoppingBulkBar();
    renderShoppingList();
  }

  function showShoppingUndo(message, snapshot) {
    shoppingUndoSnapshot = snapshot;
    clearTimeout(shoppingUndoTimer);
    const toast = document.querySelector('#shoppingUndoToast');
    document.querySelector('#shoppingUndoMessage').textContent = message;
    toast.hidden = false;
    shoppingUndoTimer = setTimeout(() => { toast.hidden = true; shoppingUndoSnapshot = null; }, 7000);
  }

  function undoShoppingBulkAction() {
    if (!shoppingUndoSnapshot) return;
    state.shoppingList = shoppingUndoSnapshot;
    shoppingUndoSnapshot = null;
    clearTimeout(shoppingUndoTimer);
    document.querySelector('#shoppingUndoToast').hidden = true;
    saveState();
    renderShoppingList();
    renderCounts();
  }

  function clearShoppingMoveStoreError() {
    const error = document.querySelector('#shoppingMoveStoreError');
    if (!error) return;
    error.hidden = true;
    error.textContent = '';
  }

  function updateShoppingMoveNewStoreFields() {
    const select = document.querySelector('#shoppingMoveStore');
    const fields = document.querySelector('#shoppingMoveNewStoreFields');
    const input = document.querySelector('#shoppingMoveNewStoreName');
    const confirmButton = document.querySelector('#shoppingMoveConfirm');
    if (!select || !fields || !confirmButton) return;
    const addingStore = select.value === '__new_store__';
    fields.hidden = !addingStore;
    confirmButton.textContent = addingStore ? 'Add & Move' : 'Move';
    clearShoppingMoveStoreError();
    if (addingStore) setTimeout(() => input?.focus(), 0);
  }

  function openShoppingMoveDialog(ids, title) {
    shoppingMoveTargetIds = [...ids];
    if (!shoppingMoveTargetIds.length) return;
    populateStoreSelects();
    const dialog = document.querySelector('#shoppingMoveDialog');
    const heading = document.querySelector('#shoppingMoveDialogTitle');
    const select = document.querySelector('#shoppingMoveStore');
    const input = document.querySelector('#shoppingMoveNewStoreName');
    heading.textContent = title || `Move ${shoppingMoveTargetIds.length} item${shoppingMoveTargetIds.length===1?'':'s'}`;
    if (input) input.value = '';
    const first = state.shoppingList.find(item => item.id === shoppingMoveTargetIds[0]);
    if (first && [...select.options].some(option => option.value === normalizeStore(first.store))) select.value = normalizeStore(first.store);
    updateShoppingMoveNewStoreFields();
    dialog.showModal();
  }

  function openBulkShoppingMoveDialog() {
    openShoppingMoveDialog([...shoppingSelectedIds]);
  }

  function confirmShoppingMove() {
    const selected = [...shoppingMoveTargetIds];
    if (!selected.length) return;
    const select = document.querySelector('#shoppingMoveStore');
    let destination;
    if (select.value === '__new_store__') {
      const input = document.querySelector('#shoppingMoveNewStoreName');
      const error = document.querySelector('#shoppingMoveStoreError');
      const proposed = (input?.value || '').trim();
      if (!proposed) {
        error.textContent = 'Enter a store name.';
        error.hidden = false;
        input?.focus();
        return;
      }
      const existing = (state.stores || []).find(store => store.toLowerCase() === proposed.toLowerCase());
      if (existing) {
        error.textContent = `${existing} already exists. Choose it from the list instead.`;
        error.hidden = false;
        input?.focus();
        return;
      }
      destination = proposed;
      state.stores ||= [];
      state.stores.push(destination);
    } else {
      destination = normalizeStore(select.value);
    }
    const snapshot = JSON.parse(JSON.stringify(state.shoppingList));
    const now = new Date().toISOString();
    state.shoppingList.forEach(item => {
      if (selected.includes(item.id)) {
        const changedStore = normalizeStore(item.store) !== destination;
        item.store = destination;
        item.updatedAt = now;
        if (changedStore) {
          learnStoreChoice(item.name, destination);
          item.aisle = preferredAisleFor(item.name, destination);
        }
      }
    });
    saveState();
    document.querySelector('#shoppingMoveDialog').close();
    shoppingMoveTargetIds = [];
    populateStoreSelects();
    if (shoppingSelectionMode) cancelShoppingSelection(); else renderShoppingList();
    showShoppingUndo(`${selected.length} item${selected.length===1?'':'s'} moved to ${destination}.`, snapshot);
  }

  function deleteSelectedShoppingItems() {
    const selected = [...shoppingSelectedIds];
    if (!selected.length) return;
    if (!confirm(`Remove ${selected.length} selected item${selected.length===1?'':'s'} from the shopping list?`)) return;
    const snapshot = JSON.parse(JSON.stringify(state.shoppingList));
    state.shoppingList = state.shoppingList.filter(item => !shoppingSelectedIds.has(item.id));
    saveState();
    cancelShoppingSelection();
    renderCounts();
    showShoppingUndo(`${selected.length} item${selected.length===1?'':'s'} removed.`, snapshot);
  }

  function showShopping() {
    selectedRecipeKey = null;
    els.listPane.hidden = true; els.detailPane.hidden = true; els.modulesPane.hidden = true; els.shoppingPane.hidden = false;
    shoppingSelectionMode=false; shoppingSelectedIds.clear(); populateStoreSelects(); updateShoppingBulkBar(); renderShoppingList(); updateWakeLock(); window.scrollTo({top:0,behavior:'smooth'});
  }

  function normalizeStore(store) { return store && store.trim() ? store.trim() : 'Unassigned'; }
  function displayStoreName(store) { return normalizeStore(store) === 'Unassigned' ? 'No store' : normalizeStore(store); }
  function populateStoreSelects() {
    const stores=[...new Set(['Unassigned',...(state.stores||[]),...state.shoppingList.map(x=>normalizeStore(x.store))])];
    state.stores=stores;
    const fill=(select,all=false)=>{ const current=select.value; select.innerHTML=all?'<option value="all">All stores</option>':''; stores.forEach(st=>{const o=document.createElement('option');o.value=st;o.textContent=displayStoreName(st);select.append(o)}); if([...select.options].some(o=>o.value===current))select.value=current; };
    fill(els.shoppingStoreFilter,true); fill(els.shoppingItemStore); fill(els.ingredientStoreSelect); const moveStore=document.querySelector('#shoppingMoveStore'); if(moveStore) { fill(moveStore); const addOption=document.createElement('option'); addOption.value='__new_store__'; addOption.textContent='＋ New store…'; moveStore.append(addOption); }
  }

  function addShoppingEntry({name, quantity='', store='Unassigned', source='Manual', recipeKey='', group='', aisle='', learnStore=false}) {
    const embedded=extractEmbeddedShoppingQuantity(name);
    const cleanName=displayShoppingName(embedded.name); if(!cleanName)return null;
    quantity=String(quantity || embedded.quantity || '').trim();
    const normalizedName=shoppingNameKey(cleanName);
    const requestedStore=normalizeStore(store);
    const normalizedStore=requestedStore === 'Unassigned' ? (preferredStoreFor(cleanName) || requestedStore) : requestedStore;
    if (learnStore && requestedStore !== 'Unassigned') learnStoreChoice(cleanName, requestedStore);
    let item=state.shoppingList.find(x=>!x.checked && shoppingNameKey(x.normalizedName||x.name)===normalizedName);
    const entry=normalizeShoppingEntry({quantity,source,recipeKey});
    if(item){ item.entries ||= []; item.entries.push(entry); item.updatedAt=new Date().toISOString(); }
    else {
      item=normalizeShoppingItem({id:shoppingId(),name:cleanName,normalizedName,store:normalizedStore,group:SHOPPING_GROUPS.includes(group)?group:classifyShoppingGroup(cleanName),aisle:aisle || preferredAisleFor(cleanName, normalizedStore),checked:false,entries:[entry]});
      state.shoppingList.push(item);
    }
    return item;
  }

  function renderShoppingList(highlightId='') {
    populateStoreSelects();
    updateShoppingBulkBar();
    const items=visibleShoppingItems();
    els.shoppingGroups.innerHTML='';
    if(!items.length){els.shoppingGroups.innerHTML='<div class="empty-state"><h2>Your list is empty</h2><p>Add items manually, from regular items, or from a recipe.</p></div>';return;}
    const groups={}; items.forEach(x=>(groups[normalizeStore(x.store)]??=[]).push(x));
    Object.entries(groups).forEach(([store,list])=>{
      const remaining=list.filter(x=>!x.checked).length;
      const section=document.createElement('section');section.className='shopping-store-card';
      section.innerHTML=`<div class="shopping-store-heading"><h2>${escapeHtml(displayStoreName(store))}</h2><span>${remaining} remaining</span></div><div class="shopping-items"></div>`;
      const box=section.querySelector('.shopping-items');
      let previousGroup = '';
      let checkedHeadingShown = false;
      list.forEach(item=>{
        const group = SHOPPING_GROUPS.includes(item.group) ? item.group : classifyShoppingGroup(item.name);
        item.group = group;
        if (item.checked && !checkedHeadingShown) {
          const checkedHeading = document.createElement('h3');
          checkedHeading.className = 'shopping-group-heading shopping-checked-heading';
          checkedHeading.textContent = 'Checked';
          box.append(checkedHeading);
          checkedHeadingShown = true;
        } else if (!item.checked && group !== previousGroup) {
          const groupHeading = document.createElement('h3');
          groupHeading.className = 'shopping-group-heading';
          groupHeading.textContent = group;
          box.append(groupHeading);
          previousGroup = group;
        }
        const row=document.createElement('div');
        row.className=`shopping-row shopping-row-compact ${item.checked?'checked':''} ${item.id===highlightId?'shopping-row-new':''} ${shoppingSelectedIds.has(item.id)?'bulk-selected':''}`;
        row.dataset.shoppingId=item.id;
        const details=(item.entries||[]).map(entry=>{
          const quantity=String(entry.quantity||'').trim();
          const source=String(entry.source||'').trim();
          const reason=String(entry.reason||entry.note||'').trim();
          return `<div class="shopping-detail-entry">${quantity?`<strong>${escapeHtml(quantity)}</strong>`:''}${source?`<span>${escapeHtml(source)}</span>`:''}${reason?`<small>${escapeHtml(reason)}</small>`:''}</div>`;
        }).join('') || '<div class="shopping-detail-entry"><span>No additional details</span></div>';
        const leading=shoppingSelectionMode
          ? `<label class="bulk-select-control" aria-label="Select ${escapeHtml(item.name)}"><input class="bulk-select-check" type="checkbox" ${shoppingSelectedIds.has(item.id)?'checked':''}></label>`
          : `<label class="shopping-check" aria-label="Mark ${escapeHtml(item.name)} purchased"><input class="purchase-check" type="checkbox" ${item.checked?'checked':''}></label>`;
        const aisleDetail=item.aisle?`<small class="shopping-aisle-label">Aisle: ${escapeHtml(item.aisle)}</small>`:'';
        const aisleButtonLabel=item.aisle?`Aisle ${item.aisle}`:'＋ Set aisle';
        row.innerHTML=`<div class="shopping-row-mainline">${leading}<button type="button" class="shopping-name-toggle" aria-expanded="false"><strong>${escapeHtml(item.name)}</strong></button><div class="shopping-location-actions"><button type="button" class="row-store-pill" aria-label="Change store for ${escapeHtml(item.name)}" ${shoppingSelectionMode?'disabled':''}>${escapeHtml(displayStoreName(item.store))}</button><button type="button" class="aisle-quick-button" aria-label="Set aisle for ${escapeHtml(item.name)} at ${escapeHtml(displayStoreName(item.store))}" ${shoppingSelectionMode?'disabled':''}>${escapeHtml(aisleButtonLabel)}</button></div><button type="button" class="shopping-detail-toggle" aria-label="Show details for ${escapeHtml(item.name)}" aria-expanded="false"><span class="shopping-details-chevron">⌄</span></button></div><div class="shopping-row-details" hidden>${details}<small class="shopping-group-label">Group: ${escapeHtml(group)}</small>${aisleDetail}<div class="shopping-detail-actions"><button type="button" class="text-button edit-shopping">Edit</button><button type="button" class="text-button danger-text remove-shopping">Remove</button></div></div>`;
        const storeButton=row.querySelector('.row-store-pill');
        storeButton.addEventListener('click',()=>openShoppingMoveDialog([item.id],`Move ${item.name}`));
        const purchase=row.querySelector('.purchase-check');
        purchase?.addEventListener('change',e=>{item.checked=e.target.checked;item.updatedAt=new Date().toISOString();saveState();renderShoppingList();renderCounts()});
        const bulk=row.querySelector('.bulk-select-check');
        bulk?.addEventListener('change',e=>{e.target.checked?shoppingSelectedIds.add(item.id):shoppingSelectedIds.delete(item.id);row.classList.toggle('bulk-selected',e.target.checked);updateShoppingBulkBar();});
        const nameToggle=row.querySelector('.shopping-name-toggle');
        const aisleButton=row.querySelector('.aisle-quick-button');
        const detailToggle=row.querySelector('.shopping-detail-toggle');
        const toggleDetails=()=>{
          if(shoppingSelectionMode){bulk.checked=!bulk.checked;bulk.dispatchEvent(new Event('change',{bubbles:true}));return;}
          const panel=row.querySelector('.shopping-row-details');
          panel.hidden=!panel.hidden;
          detailToggle.setAttribute('aria-expanded',String(!panel.hidden));
          row.querySelector('.shopping-details-chevron').textContent=panel.hidden?'⌄':'⌃';
        };
        nameToggle.addEventListener('click',toggleDetails);
        aisleButton.addEventListener('click',()=>{
          const store=normalizeStore(item.store);
          if(store==='Unassigned')return alert(`Choose a store for ${item.name} before setting its aisle.`);
          const response=prompt(`Aisle for ${item.name} at ${store}:\\n\\nLeave blank to clear the saved aisle.`,item.aisle||preferredAisleFor(item.name,store));
          if(response===null)return;
          item.aisle=String(response).trim().slice(0,40);
          learnAisleChoice(item.name,store,item.aisle);
          item.updatedAt=new Date().toISOString();
          saveState();renderShoppingList(item.id);
        });
        detailToggle.addEventListener('click',toggleDetails);
        row.querySelector('.edit-shopping').addEventListener('click',()=>openShoppingItemDialog(item));
        row.querySelector('.remove-shopping').addEventListener('click',()=>{if(!confirm(`Remove ${item.name} from the shopping list?`))return;state.shoppingList=state.shoppingList.filter(x=>x.id!==item.id);saveState();renderShoppingList();renderCounts()});
        box.append(row);
      });
      els.shoppingGroups.append(section);
    });
    if(highlightId){requestAnimationFrame(()=>{const row=els.shoppingGroups.querySelector(`[data-shopping-id="${CSS.escape(highlightId)}"]`);row?.scrollIntoView({block:'nearest',behavior:'smooth'});setTimeout(()=>row?.classList.remove('shopping-row-new'),1500);});}
  }

  function openShoppingItemDialog(item=null) {
    if (!item || typeof item !== 'object' || !item.id) item = null;
    populateStoreSelects(); els.shoppingItemForm.reset();
    els.shoppingItemEditId.value=item?.id||'';
    els.shoppingItemDialogTitle.textContent=item?'Edit shopping item':'Add shopping item';
    els.shoppingItemSubmitBtn.textContent=item?'Save changes':'Add item';
    document.querySelector('#saveRegularItem').closest('label').hidden=false;
    const groupSelect=document.querySelector('#shoppingItemGroup');
    groupSelect.innerHTML=SHOPPING_GROUPS.map(group=>`<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join('');
    groupSelect.dataset.touched='false';
    groupSelect.onchange=()=>{groupSelect.dataset.touched='true';};
    const nameInput=document.querySelector('#shoppingItemName');
    nameInput.oninput=()=>{if(groupSelect.dataset.touched!=='true'&&!item)groupSelect.value=classifyShoppingGroup(nameInput.value);};
    const quantityInput=document.querySelector('#shoppingItemQuantity'); quantityInput.disabled=false; quantityInput.placeholder='1 gallon, 2 boxes, etc.';
    const aisleInput=document.querySelector('#shoppingItemAisle'); aisleInput.dataset.touched='false';
    aisleInput.oninput=()=>{aisleInput.dataset.touched='true';};
    els.shoppingItemStore.onchange=()=>{if(aisleInput.dataset.touched!=='true')aisleInput.value=preferredAisleFor(nameInput.value,els.shoppingItemStore.value);};
    if(item){ const entries=item.entries||[]; document.querySelector('#shoppingItemName').value=item.name; quantityInput.value=entries.length===1?(entries[0].quantity||''):''; if(entries.length>1){quantityInput.disabled=true;quantityInput.placeholder='Multiple recipe quantities are listed separately';} els.shoppingItemStore.value=normalizeStore(item.store); groupSelect.value=SHOPPING_GROUPS.includes(item.group)?item.group:classifyShoppingGroup(item.name); aisleInput.value=item.aisle||preferredAisleFor(item.name,item.store); }
    else { groupSelect.value='Other'; aisleInput.value=''; }
    els.shoppingItemDialog.showModal();
  }

  function upsertRegularItem({ name, quantity, store, group, aisle }) {
    const normalizedName = shoppingNameKey(name);
    const values = {
      name:displayShoppingName(name),
      normalizedName,
      quantity:String(quantity || '').trim(),
      store:normalizeStore(store),
      group:SHOPPING_GROUPS.includes(group) ? group : classifyShoppingGroup(name),
      aisle:String(aisle || '').trim().slice(0, 40)
    };
    let regularItem = state.regularItems.find(item => shoppingNameKey(item.normalizedName || item.name) === normalizedName);
    if (regularItem) Object.assign(regularItem, values);
    else {
      regularItem = { id:shoppingId(), ...values };
      state.regularItems.push(regularItem);
    }
    return regularItem;
  }

  function addManualShoppingItem(event){
    event.preventDefault(); const name=document.querySelector('#shoppingItemName').value.trim(); const quantity=document.querySelector('#shoppingItemQuantity').value.trim(); const store=normalizeStore(els.shoppingItemStore.value); const group=document.querySelector('#shoppingItemGroup').value; const aisle=document.querySelector('#shoppingItemAisle').value.trim().slice(0,40); if(!name)return;
    const saveAsRegular = new FormData(event.currentTarget).has('saveRegularItem');
    const editId=els.shoppingItemEditId.value;
    let item;
    try {
      if(editId){
        item=state.shoppingList.find(x=>x.id===editId); if(!item)return;
        const key=shoppingNameKey(name);
        const changedStore=normalizeStore(item.store)!==store;
        item.name=displayShoppingName(name); item.normalizedName=key; item.store=store; item.group=group; item.aisle=aisle;
        if (document.querySelector('#shoppingItemGroup').dataset.touched === 'true') state.learnedShoppingGroups[key]=group;
        if(changedStore)learnStoreChoice(name,store);
        learnAisleChoice(name,store,aisle);
        if((item.entries||[]).length<=1)item.entries=[normalizeShoppingEntry({quantity,source:item.entries?.[0]?.source||'Manual',recipeKey:item.entries?.[0]?.recipeKey||''})];
        item.updatedAt=new Date().toISOString();
      }
      else {
        item=addShoppingEntry({name,quantity,store,group,aisle,source:'Manual',learnStore:true});
        state.learnedShoppingGroups[shoppingNameKey(name)]=group;
        learnAisleChoice(name,store,aisle);
      }
      if(saveAsRegular) upsertRegularItem({name,quantity,store,group,aisle});
      saveState();
      if (saveAsRegular) {
        const persisted = profileStore.loadActiveState().regularItems.some(regular => shoppingNameKey(regular.normalizedName || regular.name) === shoppingNameKey(name));
        if (!persisted) throw new Error('The regular item could not be verified after saving.');
      }
      els.shoppingItemDialog.close(); renderShoppingList(item.id); renderCounts();
    } catch (error) {
      alert(`Shopping item was not saved: ${error.message}`);
    }
  }

  function showRegularItems(){
    populateStoreSelects(); els.regularItemsList.innerHTML='';
    if(!state.regularItems.length){els.regularItemsList.innerHTML='<p>No regular items yet. Add a manual item and choose “Save as regular item.”</p>';}
    state.regularItems.forEach(item=>{
      const row=document.createElement('div');row.className='regular-item-row';
      row.innerHTML=`<span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.quantity||'No default quantity')} · ${escapeHtml(displayStoreName(item.store))}</small></span><div class="regular-item-actions"><button type="button" class="button secondary add-regular">Add</button><button type="button" class="text-button edit-regular">Edit</button><button type="button" class="text-button remove-regular">Remove</button></div>`;
      row.querySelector('.add-regular').addEventListener('click',e=>{const added=addShoppingEntry({name:item.name,quantity:item.quantity,store:item.store,group:item.group,aisle:item.aisle,source:'Regular item',learnStore:true});saveState();renderShoppingList(added.id);renderCounts();e.currentTarget.textContent='Added ✓';setTimeout(()=>e.currentTarget.textContent='Add',1000);});
      row.querySelector('.edit-regular').addEventListener('click',()=>{const name=prompt('Regular item name:',item.name);if(!name)return;const quantity=prompt('Default quantity or note:',item.quantity||'')??item.quantity;const store=prompt(`Default store:\n${state.stores.join('\n')}`,item.store||'Unassigned')||item.store;item.name=displayShoppingName(name);item.normalizedName=shoppingNameKey(name);item.quantity=quantity.trim();item.store=normalizeStore(store);saveState();showRegularItems();});
      row.querySelector('.remove-regular').addEventListener('click',()=>{if(!confirm(`Remove ${item.name} from regular items?`))return;state.regularItems=state.regularItems.filter(x=>x.id!==item.id);saveState();showRegularItems();});
      els.regularItemsList.append(row)
    });
    if(!els.regularItemsDialog.open)els.regularItemsDialog.showModal();
  }

  function ingredientQuantityLabel(ingredient) {
    let amount='';
    if (ingredient.displayQuantity && ingredient.scalable === false) amount=ingredient.displayQuantity;
    else if (typeof ingredient.quantity === 'number') amount=formatFraction(ingredient.scalable === false ? ingredient.quantity : ingredient.quantity * activeScale);
    return [amount, ingredient.unit].filter(Boolean).join(' ').trim();
  }
  function cleanShoppingName(item) { return normalizeShoppingName(item); }
  function openIngredientShopping(recipe){
    populateStoreSelects(); els.ingredientShoppingChoices.innerHTML='';
    (recipe.ingredientGroups||[]).forEach(group=>{
      if(group.name&&group.name!=='Main'){const h=document.createElement('h3');h.textContent=group.name;els.ingredientShoppingChoices.append(h)}
      ;(group.ingredients||[]).forEach(ing=>{
        const label=document.createElement('label');label.className='ingredient-choice';
        const embedded=extractEmbeddedShoppingQuantity(ing.item);
        const name=cleanShoppingName(embedded.name); const quantity=ingredientQuantityLabel(ing) || embedded.quantity;
        label.innerHTML=`<input type="checkbox" data-item="${escapeHtml(name)}" data-quantity="${escapeHtml(quantity)}" checked><span>${formatIngredient(ing)}</span>`;
        els.ingredientShoppingChoices.append(label)
      })
    });
    els.confirmIngredientAdd.dataset.recipeName=recipe.name;
    els.confirmIngredientAdd.dataset.recipeKey=selectedRecipeKey||'';
    els.ingredientShoppingDialog.showModal();
  }
  function confirmAddIngredients(){
    const store=normalizeStore(els.ingredientStoreSelect.value);const source=els.confirmIngredientAdd.dataset.recipeName;const recipeKey=els.confirmIngredientAdd.dataset.recipeKey||'';let first='';let count=0;
    els.ingredientShoppingChoices.querySelectorAll('input:checked').forEach(input=>{const item=addShoppingEntry({name:cleanShoppingName(input.dataset.item),quantity:input.dataset.quantity,store,source,recipeKey,learnStore:true});first ||= item.id;count++;});
    saveState();els.ingredientShoppingDialog.close();renderShoppingList(first);renderCounts();alert(`${count} ingredient${count===1?'':'s'} added to the shopping list.`);
  }

  function manageStores() {
    const action = prompt(`Stores:\n${(state.stores||[]).join('\n')}\n\nType a new store name to add it, or type REMOVE: Store Name to remove one.`);
    if (!action) return;
    if (/^REMOVE:/i.test(action)) {
      const name=action.replace(/^REMOVE:/i,'').trim();
      if (!name || name==='Unassigned') return alert('No store cannot be removed.');
      state.stores=state.stores.filter(x=>x.toLowerCase()!==name.toLowerCase());
      state.shoppingList.forEach(x=>{if(normalizeStore(x.store).toLowerCase()===name.toLowerCase())x.store='Unassigned'});
      state.regularItems.forEach(x=>{if(normalizeStore(x.store).toLowerCase()===name.toLowerCase())x.store='Unassigned'});
      Object.values(state.learnedStorePreferences||{}).forEach(preference=>{
        if(normalizeStore(preference.store).toLowerCase()===name.toLowerCase()){preference.store='';preference.count=0;}
        Object.keys(preference.choices||{}).forEach(store=>{if(store.toLowerCase()===name.toLowerCase())delete preference.choices[store];});
      });
      Object.keys(state.learnedAisles||{}).forEach(key=>{if(key.startsWith(`${name.toLowerCase()}|`))delete state.learnedAisles[key];});
    } else { const name=action.trim(); if(name && !state.stores.some(x=>x.toLowerCase()===name.toLowerCase()))state.stores.push(name); }
    saveState();populateStoreSelects();renderShoppingList();
  }

  function shoppingListPayload() {
    const profile = profileStore.getActiveProfileMeta();
    const items = state.shoppingList.filter(item => !item.checked).map(item => ({
      name:item.name,
      store:normalizeStore(item.store),
      group:SHOPPING_GROUPS.includes(item.group) ? item.group : classifyShoppingGroup(item.name),
      aisle:String(item.aisle || '').trim(),
      entries:(item.entries || []).map(entry => ({
        id:entry.id || shoppingId(),
        quantity:String(entry.quantity || '').trim(),
        source:String(entry.source || '').trim(),
        recipeKey:entry.recipeKey || ''
      }))
    }));
    return {
      format:'kitchen-companion-shopping-list',
      schemaVersion:1,
      exportId:shoppingId(),
      exportedAt:new Date().toISOString(),
      exportedBy:{ displayName:profile?.displayName || 'Kitchen Companion user' },
      stores:[...new Set(items.map(item => item.store).filter(store => store !== 'Unassigned'))],
      items
    };
  }

  function validateShoppingListPayload(payload) {
    if (!payload || payload.format !== 'kitchen-companion-shopping-list') throw new Error('This is not a Kitchen Companion shopping list.');
    if (Number(payload.schemaVersion) !== 1) throw new Error(`Shopping-list version ${payload.schemaVersion ?? 'unknown'} is not supported.`);
    if (!payload.exportId || typeof payload.exportId !== 'string') throw new Error('The shopping-list file has no sharing identifier.');
    if (!payload.exportedAt || !Number.isFinite(Date.parse(payload.exportedAt))) throw new Error('The shopping-list date is missing or invalid.');
    if (!Array.isArray(payload.items) || payload.items.length > 2000) throw new Error('The shopping-list items are missing or invalid.');
    if (payload.stores !== undefined && !Array.isArray(payload.stores)) throw new Error('The shopping-list stores are invalid.');
    (payload.stores || []).forEach(store => {
      if (typeof store !== 'string' || store.length > 60) throw new Error('The shopping list contains an invalid store name.');
    });
    payload.items.forEach((item, index) => {
      if (!item || typeof item.name !== 'string' || item.name.length > 200 || !shoppingNameKey(item.name)) throw new Error(`Shopping item ${index + 1} has no valid name.`);
      if (item.store !== undefined && (typeof item.store !== 'string' || item.store.length > 60)) throw new Error(`Shopping item ${index + 1} has an invalid store.`);
      if (item.group !== undefined && typeof item.group !== 'string') throw new Error(`Shopping item ${index + 1} has an invalid shopping group.`);
      if (item.aisle !== undefined && (typeof item.aisle !== 'string' || item.aisle.length > 40)) throw new Error(`Shopping item ${index + 1} has an invalid aisle.`);
      if (item.entries !== undefined && !Array.isArray(item.entries)) throw new Error(`Shopping item ${index + 1} has invalid details.`);
      if ((item.entries || []).length > 100) throw new Error(`Shopping item ${index + 1} contains too many detail entries.`);
      (item.entries || []).forEach(entry => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`Shopping item ${index + 1} contains an invalid detail entry.`);
        for (const key of ['id','quantity','source','recipeKey']) {
          if (entry[key] !== undefined && (typeof entry[key] !== 'string' || entry[key].length > 500)) throw new Error(`Shopping item ${index + 1} contains invalid ${key} data.`);
        }
      });
    });
    return true;
  }

  function openShareShoppingDialog() {
    const payload = shoppingListPayload();
    if (!payload.items.length) return alert('There are no unchecked shopping items to share.');
    els.shoppingShareStatus.textContent = '';
    els.shareShoppingDialog.showModal();
  }

  async function shareShoppingListFile() {
    const payload = shoppingListPayload();
    if (!payload.items.length) return alert('There are no unchecked shopping items to share.');
    const owner = safeFilename(payload.exportedBy.displayName || 'Shopping-List');
    els.shareShoppingDialog.close();
    await deliverFile(`${owner}-Shopping-List-${new Date().toISOString().slice(0,10)}.kcshopping`, JSON.stringify(payload, null, 2), 'application/json');
  }

  function encodeShoppingMessagePayload(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function decodeShoppingMessagePayload(encoded) {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function buildShoppingMessage(payload) {
    const sender = payload.exportedBy?.displayName || 'A Kitchen Companion user';
    const lines = [`Kitchen Companion shopping list from ${sender}`, ''];
    payload.items.forEach(item => {
      const quantities = [...new Set((item.entries || []).map(entry => String(entry.quantity || '').trim()).filter(Boolean))];
      const details = [
        quantities.join(' + '),
        normalizeStore(item.store) === 'Unassigned' ? '' : normalizeStore(item.store),
        item.aisle ? `Aisle: ${item.aisle}` : ''
      ].filter(Boolean);
      lines.push(`• ${item.name}${details.length ? ` — ${details.join(' — ')}` : ''}`);
    });
    lines.push(
      '',
      'Copy this entire message, then open Kitchen Companion → Shopping list → Import list → Paste shared list.',
      '',
      `KC-SHOPPING-LIST-V1:${encodeShoppingMessagePayload(payload)}`
    );
    return lines.join('\n');
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {}
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand?.('copy') === true;
    textarea.remove();
    if (!copied) throw new Error('The clipboard was unavailable. Try sharing the list file instead.');
    return true;
  }

  async function copyShoppingListForMessage() {
    const payload = shoppingListPayload();
    if (!payload.items.length) return alert('There are no unchecked shopping items to share.');
    const button = els.copyShoppingMessageBtn;
    const originalText = button.textContent;
    try {
      await copyTextToClipboard(buildShoppingMessage(payload));
      els.shoppingShareStatus.textContent = 'Copied. Open Messages and paste it into your conversation.';
      button.textContent = 'Copied ✓';
      window.setTimeout(() => { button.textContent = originalText; }, 1800);
    } catch (error) {
      els.shoppingShareStatus.textContent = error.message;
    }
  }

  function openImportShoppingDialog() {
    els.shoppingMessageText.value = '';
    els.shoppingPasteError.textContent = '';
    els.shoppingPasteError.hidden = true;
    els.importShoppingDialog.showModal();
  }

  function parseShoppingMessage(text) {
    const value = String(text || '').trim();
    if (!value) throw new Error('Paste the complete shared shopping-list message first.');
    if (value.length > 7 * 1024 * 1024) throw new Error('The pasted shopping list is larger than the 7 MB safety limit.');
    if (value.startsWith('{')) return JSON.parse(value);
    const match = value.match(/KC-SHOPPING-LIST-V1:([A-Za-z0-9_-]+)/);
    if (!match) throw new Error('No Kitchen Companion shopping-list data was found. Copy and paste the entire message.');
    return decodeShoppingMessagePayload(match[1]);
  }

  window.KCShoppingMessageTools = Object.freeze({
    build: buildShoppingMessage,
    parse: parseShoppingMessage
  });

  function importShoppingPayload(payload) {
    let previousShoppingList = null;
    let previousStores = null;
    let previousLearnedAisles = null;
    try {
      validateShoppingListPayload(payload);
      const sender = String(payload.exportedBy?.displayName || 'another Kitchen Companion user').trim();
      if (!confirm(`Import ${payload.items.length} unchecked item${payload.items.length===1?'':'s'} from ${sender}?\n\nMatching ingredients will merge with your current list. Your existing stores and checked items will remain.`)) return false;
      requireSafetyCheckpoint('before-shopping-list-import');
      previousShoppingList = JSON.parse(JSON.stringify(state.shoppingList));
      previousStores = JSON.parse(JSON.stringify(state.stores));
      previousLearnedAisles = JSON.parse(JSON.stringify(state.learnedAisles));
      (payload.stores || []).forEach(store => {
        const name = normalizeStore(String(store || ''));
        if (name !== 'Unassigned' && !state.stores.some(existing => existing.toLowerCase() === name.toLowerCase())) state.stores.push(name);
      });
      let addedEntries = 0;
      let skippedEntries = 0;
      payload.items.forEach(incoming => {
        const normalized = normalizeShoppingItem({ ...incoming, checked:false });
        let target = state.shoppingList.find(item => !item.checked && shoppingNameKey(item.normalizedName || item.name) === normalized.normalizedName);
        if (!target) {
          target = normalizeShoppingItem({ ...normalized, id:shoppingId(), entries:[] });
          target.entries = [];
          state.shoppingList.push(target);
        }
        if (!target.aisle && normalized.aisle) {
          target.aisle = normalized.aisle;
          learnAisleChoice(target.name, target.store, target.aisle);
        }
        (normalized.entries.length ? normalized.entries : [normalizeShoppingEntry({ source:`Shared by ${sender}` })]).forEach(entry => {
          const importKey = `${payload.exportId}:${entry.id}`;
          if ((target.entries || []).some(existing => existing.importKey === importKey)) { skippedEntries += 1; return; }
          target.entries ||= [];
          target.entries.push(normalizeShoppingEntry({
            ...entry,
            id:shoppingId(),
            importKey,
            source:entry.source || `Shared by ${sender}`
          }));
          addedEntries += 1;
        });
        target.updatedAt = new Date().toISOString();
      });
      saveState();
      populateStoreSelects();
      renderShoppingList();
      renderCounts();
      els.importShoppingDialog?.close();
      alert(`${payload.items.length} shopping item${payload.items.length===1?'':'s'} imported from ${sender}.${skippedEntries ? ` ${skippedEntries} previously imported detail${skippedEntries===1?' was':'s were'} skipped.` : ''}`);
      return true;
    } catch (error) {
      if (previousShoppingList && previousStores && previousLearnedAisles) {
        state.shoppingList = previousShoppingList;
        state.stores = previousStores;
        state.learnedAisles = previousLearnedAisles;
        try { saveState(); } catch {}
        populateStoreSelects();
        renderShoppingList();
        renderCounts();
      }
      throw error;
    }
  }

  async function importShoppingList(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('This shopping-list file is larger than the 5 MB safety limit.');
      importShoppingPayload(JSON.parse(await file.text()));
    } catch (error) {
      alert(`Shopping list was not imported: ${error.message}`);
    }
  }

  function importPastedShoppingList() {
    try {
      const payload = parseShoppingMessage(els.shoppingMessageText.value);
      importShoppingPayload(payload);
    } catch (error) {
      els.shoppingPasteError.textContent = `Shopping list was not imported: ${error.message}`;
      els.shoppingPasteError.hidden = false;
    }
  }

  async function fetchModuleCatalog() {
    let lastError = null;
    for (const url of [`${MODULE_CATALOG_URL}?v=${Date.now()}`, MODULE_CATALOG_URL]) {
      try {
        const response = await fetch(url, { cache:'no-store' });
        if (!response.ok) {
          const error = new Error(`Catalog returned ${response.status}`);
          error.status = response.status;
          throw error;
        }
        const catalog = await response.json();
        if (!catalog || !Array.isArray(catalog.modules)) throw new Error('Catalog data is damaged or missing its modules list.');
        return catalog;
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error('Catalog request failed.');
  }
  function renderCatalogLoadError(error) {
    document.querySelector('#catalogSection')?.remove();
    const section = document.createElement('section');
    section.id = 'catalogSection';
    section.className = 'catalog-section catalog-error-section';
    const missing = error?.status === 404;
    section.innerHTML = `<h2>Available from GitHub</h2><div class="catalog-load-error"><strong>${missing ? 'The module catalog was not found.' : 'The module catalog is temporarily unavailable.'}</strong><p>${missing ? 'Confirm that catalog.json is uploaded to the repository root.' : 'Your installed recipes remain available. Check your connection and try again; after one successful load, Kitchen Companion can reuse the saved catalog when service is limited.'}</p><button type="button" class="button catalog-retry">Try again</button></div>`;
    section.querySelector('.catalog-retry').addEventListener('click', loadModuleCatalog);
    els.modulesPane.prepend(section);
  }
  async function loadModuleCatalog(){
    currentView='modules'; showModules();
    try{const catalog=await fetchModuleCatalog();renderCatalog(catalog.modules||[])}catch(error){renderCatalogLoadError(error)}
  }
  function replacementIds(entry, module) {
    return [...new Set([...(entry.replacesModuleIds || []), ...(module.replacesModuleIds || [])].filter(Boolean))];
  }
  function buildRecipeUpdateKeyMap(previousModules, nextModule) {
    const keyMap = new Map();
    const nextById = new Map((nextModule.recipes || []).map(recipe => [recipe.id, recipe]));
    const nextByName = new Map();
    (nextModule.recipes || []).forEach(recipe => {
      const nameKey = engine.slugify(recipe.name);
      const matches = nextByName.get(nameKey) || [];
      matches.push(recipe);
      nextByName.set(nameKey, matches);
    });
    (previousModules || []).forEach(previousModule => {
      (previousModule.recipes || []).forEach(previousRecipe => {
        let match = nextById.get(previousRecipe.id);
        if (!match) {
          const matches = nextByName.get(engine.slugify(previousRecipe.name)) || [];
          if (matches.length === 1) [match] = matches;
        }
        if (match) keyMap.set(`${previousModule.moduleId}:${previousRecipe.id}`, `${nextModule.moduleId}:${match.id}`);
      });
    });
    return keyMap;
  }
  function remapRecipeReferences(keyMap) {
    if (!keyMap?.size) return;
    const remap = key => keyMap.get(key) || key;
    state.favorites = [...new Set((state.favorites || []).map(remap).filter(Boolean))];
    state.hiddenRecipes = [...new Set((state.hiddenRecipes || []).map(remap).filter(Boolean))];
    for (const field of ['ratings','recipeNotes']) {
      const remapped = {};
      const entries = Object.entries(state[field] || {});
      entries.filter(([key]) => remap(key) === key).forEach(([key, value]) => { remapped[key] = value; });
      entries.filter(([key]) => remap(key) !== key).forEach(([key, value]) => {
        const newKey = remap(key);
        if (remapped[newKey] === undefined) remapped[newKey] = value;
      });
      state[field] = remapped;
    }
    const links = new Map();
    (state.manualCrossLinks || []).forEach(link => {
      const repaired = { ...link, sourceKey:remap(link.sourceKey), targetKey:remap(link.targetKey) };
      if (!repaired.sourceKey || !repaired.targetKey || repaired.sourceKey === repaired.targetKey) return;
      const identity = `${repaired.type}|${repaired.sourceKey}|${repaired.targetKey}`;
      if (!links.has(identity)) links.set(identity, repaired);
    });
    state.manualCrossLinks = [...links.values()];
    state.timers = (state.timers || []).map(timer => ({ ...timer, recipeKey:remap(timer.recipeKey) }));
    state.shoppingList = (state.shoppingList || []).map(item => ({
      ...item,
      entries:(item.entries || []).map(entry => ({ ...entry, recipeKey:remap(entry.recipeKey) }))
    }));
    const personal = state.modules.find(module => module.moduleId === 'my-recipes');
    if (personal) personal.recipes = (personal.recipes || []).map(recipe => ({ ...recipe, copiedFrom:remap(recipe.copiedFrom) }));
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
      requireSafetyCheckpoint('before-module-update');
      const replacedIds=replacementIds(entry,module).filter(id=>id!==module.moduleId);
      const previousModules=state.modules.filter(installed=>installed.moduleId===module.moduleId||replacedIds.includes(installed.moduleId));
      const recipeKeyMap=buildRecipeUpdateKeyMap(previousModules,module);
      state.modules=state.modules.filter(m=>!replacedIds.includes(m.moduleId));
      replacedIds.forEach(id=>delete state.moduleSources[id]);
      const idx=state.modules.findIndex(m=>m.moduleId===module.moduleId);
      if(idx>=0)state.modules[idx]=module;else state.modules.push(module);
      state.moduleSources[module.moduleId]=moduleUrl;
      remapRecipeReferences(recipeKeyMap);
      saveState();refreshAll();showModules();
      alert(`${module.name} ${module.version} installed.${previousModules.length?' Saved recipe information was carried forward to matching recipes.':''}`)
    }catch(error){alert(`Could not install module: ${error.message}`)}
  }
  async function updateModuleFromSource(module){
    const url=state.moduleSources[module.moduleId];if(!url)return;
    try{
      const catalog=await fetchModuleCatalog();
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
    try {
      const payload=JSON.parse(await file.text()); const recipe=payload.format==='kitchen-companion-recipe'?payload.recipe:payload.recipe || payload; if (!recipe?.name || !Array.isArray(recipe.instructions)) throw new Error('This is not a valid shared recipe file.');
      requireSafetyCheckpoint('before-recipe-import');
      const personal=ensurePersonalModule(); const copy={...recipe,id:uniqueRecipeId(slugify(recipe.name),personal.recipes),copiedFrom:null}; personal.recipes.push(copy); saveState(); refreshAll(); alert(`${copy.name} was imported into My Recipes.`);
    } catch(error){ alert(`Could not import recipe: ${error.message}`); }
  }

  function backupPayload() {
    return { format:'kitchen-companion-backup', schemaVersion:2, engineVersion:ENGINE_VERSION, createdAt:new Date().toISOString(), activeProfile:profileStore.getActiveProfileMeta(), state:JSON.parse(JSON.stringify(state)) };
  }

  async function createFullBackup() { const b=backupPayload(); await deliverFile(`Kitchen-Companion-Backup-${new Date().toISOString().slice(0,10)}.kcbackup`, JSON.stringify(b,null,2)); state.backupMeta.lastManualBackupAt=b.createdAt; saveState(); }
  async function exportPersonalRecipes() { const module=state.modules.find(m=>m.moduleId==='my-recipes'); const payload={format:'kitchen-companion-personal-recipes',schemaVersion:1,exportedAt:new Date().toISOString(),recipes:module?.recipes||[]}; await deliverFile(`My-Kitchen-Companion-Recipes-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2)); }

  function validateBackupPayload(payload) {
    if (!payload || payload.format !== 'kitchen-companion-backup') throw new Error('This is not a Kitchen Companion backup.');
    if (![1, 2].includes(Number(payload.schemaVersion))) throw new Error(`Backup schema ${payload.schemaVersion ?? 'unknown'} is not supported.`);
    if (!payload.createdAt || !Number.isFinite(Date.parse(payload.createdAt))) throw new Error('The backup date is missing or invalid.');
    const incoming = payload.state;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('The backup state is missing.');
    if (!Array.isArray(incoming.modules)) throw new Error('The installed module list is damaged.');
    const moduleIds = new Set();
    incoming.modules.forEach(module => {
      if (!module || typeof module !== 'object' || !module.moduleId || !Array.isArray(module.recipes)) throw new Error('The backup contains a damaged recipe module.');
      if (moduleIds.has(module.moduleId)) throw new Error(`The backup contains duplicate module ${module.moduleId}.`);
      moduleIds.add(module.moduleId);
      const recipeIds = new Set();
      module.recipes.forEach(recipe => {
        if (!recipe?.id || !recipe?.name || !Array.isArray(recipe.instructions)) throw new Error(`Module ${module.name || module.moduleId} contains a damaged recipe.`);
        if (recipeIds.has(recipe.id)) throw new Error(`Module ${module.name || module.moduleId} contains duplicate recipe ${recipe.id}.`);
        recipeIds.add(recipe.id);
      });
    });
    for (const key of ['favorites','shoppingList','regularItems','stores','manualCrossLinks']) {
      if (incoming[key] !== undefined && !Array.isArray(incoming[key])) throw new Error(`Backup field ${key} is damaged.`);
    }
    for (const key of ['recipeNotes','settings','moduleSources','backupMeta','ratings']) {
      if (incoming[key] !== undefined && (!incoming[key] || typeof incoming[key] !== 'object' || Array.isArray(incoming[key]))) throw new Error(`Backup field ${key} is damaged.`);
    }
    Object.entries(incoming.ratings || {}).forEach(([recipeKey, entry]) => {
      if (!recipeKey || !normalizeRatingRecord(entry)) throw new Error(`Backup rating for ${recipeKey || 'an unknown recipe'} is damaged.`);
    });
    (incoming.manualCrossLinks || []).forEach((link, index) => {
      if (!link?.id || !link.sourceKey || !link.targetKey || link.sourceKey === link.targetKey || !['ingredient','pairing'].includes(link.type)) throw new Error(`Backup manual recipe link ${index + 1} is damaged.`);
    });
    return true;
  }

  async function prepareBackupRestore(event) {
    const file=event.target.files[0]; event.target.value=''; if(!file)return;
    try { const payload=JSON.parse(await file.text()); validateBackupPayload(payload); pendingBackup=payload;
      const personal=payload.state.modules.find(m=>m.moduleId==='my-recipes'); const profileName=payload.activeProfile?.displayName || 'Unknown profile'; els.backupSummary.innerHTML=`<strong>${escapeHtml(new Date(payload.createdAt).toLocaleString())}</strong><span>Profile: <b>${escapeHtml(profileName)}</b></span><span>Personal recipes: <b>${personal?.recipes?.length||0}</b></span><span>Favorites: <b>${payload.state.favorites?.length||0}</b></span><span>Installed modules: <b>${payload.state.modules.length}</b></span>`; els.settingsDialog.close(); els.restoreBackupDialog.showModal();
    } catch(error){ alert(`Could not read backup: ${error.message}`); }
  }

  function mergeBackupState(current, incoming) {
    const result=JSON.parse(JSON.stringify(current)); const incomingPersonal=incoming.modules.find(m=>m.moduleId==='my-recipes'); const personal=result.modules.find(m=>m.moduleId==='my-recipes') || ensurePersonalModule();
    if(incomingPersonal){ const byId=new Map(personal.recipes.map(r=>[r.id,r])); incomingPersonal.recipes.forEach(r=>byId.set(r.id,r)); personal.recipes=[...byId.values()]; }
    result.favorites=[...new Set([...(result.favorites||[]),...(incoming.favorites||[])])]; result.recipeNotes={...(incoming.recipeNotes||{}),...(result.recipeNotes||{})}; result.ratings=normalizeRatingMap({...(incoming.ratings||{}),...(result.ratings||{})}); result.customCategories=[...new Set([...(result.customCategories||[]),...(incoming.customCategories||[])])]; result.shoppingList=[...(result.shoppingList||[]),...(incoming.shoppingList||[])]; result.regularItems=[...(result.regularItems||[]),...(incoming.regularItems||[])]; result.stores=[...new Set([...(result.stores||[]),...(incoming.stores||[])])]; result.settings={...(incoming.settings||{}),...(result.settings||{})}; result.learnedStorePreferences={...(incoming.learnedStorePreferences||{}),...(result.learnedStorePreferences||{})}; result.learnedShoppingGroups={...(incoming.learnedShoppingGroups||{}),...(result.learnedShoppingGroups||{})}; result.learnedAisles={...(incoming.learnedAisles||{}),...(result.learnedAisles||{})}; const manualLinks=new Map([...(incoming.manualCrossLinks||[]),...(result.manualCrossLinks||[])].map(link=>[`${link.sourceKey}|${link.targetKey}`,link])); result.manualCrossLinks=[...manualLinks.values()]; return result;
  }

  function restoreSelectedBackup(event) {
    event.preventDefault(); if(!pendingBackup)return; const mode=new FormData(els.restoreBackupForm).get('restoreMode');
    const previousState = JSON.parse(JSON.stringify(state));
    const previousProfileMeta = profileStore.getActiveProfileMeta();
    try {
      validateBackupPayload(pendingBackup);
      requireSafetyCheckpoint('before-full-backup-restore');
      const rollback = JSON.stringify(previousState);
      localStorage.setItem(`${STORAGE_KEY}.rollback`, rollback);
      if (localStorage.getItem(`${STORAGE_KEY}.rollback`) !== rollback) throw new Error('The restore rollback copy could not be verified.');
      const restored=mode==='replace'?JSON.parse(JSON.stringify(pendingBackup.state)):mergeBackupState(state,pendingBackup.state);
      Object.keys(state).forEach(key => delete state[key]); Object.assign(state, restored);
      if (mode === 'replace' && pendingBackup.activeProfile) profileStore.applyActiveProfileMeta(pendingBackup.activeProfile);
      saveState();
      pendingBackup=null; els.restoreBackupDialog.close();
      alert('Backup restored and verified. Kitchen Companion will reload now.'); location.reload();
    } catch(error) {
      Object.keys(state).forEach(key => delete state[key]); Object.assign(state, previousState);
      try { profileStore.applyActiveProfileMeta(previousProfileMeta); } catch {}
      try { saveState(); } catch {}
      alert(`Restore failed and your previous data was kept: ${error.message}`);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  // Existing shopping data uses constants declared throughout this script.
  // Start only after every const and helper has finished initialization.
  init();
})();
