(() => {
  'use strict';

  const DEVICE_KEY = 'kitchenCompanion.device.v1';
  const SHARED_KEY = 'kitchenCompanion.shared.v1';
  const PROFILE_PREFIX = 'kitchenCompanion.profile.v1.';
  const LEGACY_KEY = 'recipeEngineState.v1';
  const DB_NAME = 'kitchen-companion';
  const DB_VERSION = 1;

  const clone = value => JSON.parse(JSON.stringify(value));
  const uuid = () => globalThis.crypto?.randomUUID?.() || `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const now = () => new Date().toISOString();

  class KCProfileStore {
    constructor() {
      this.device = null;
      this.shared = null;
      this.activeProfile = null;
      this.initialize();
    }

    defaultProfileData(profileId) {
      return {
        schemaVersion: 1,
        profileId,
        personalModule: null,
        favorites: [], recipeNotes: {}, hiddenRecipes: [], customCategories: [],
        shoppingList: [], regularItems: [], stores: ['Unassigned', 'Costco', 'Walmart'],
        settings: { darkMode:false, metricHelpers:false, accentColor:'#7b3f00', wakeLockMode:'recipes-and-timers', alarmVolume:0.85, alarmSoundEnabled:true },
        ratings: {}, learnedStorePreferences: {}, createdAt: now(), updatedAt: now()
      };
    }

    defaultShared() {
      return { schemaVersion:1, modules:[], moduleSources:{}, timers:[], backupMeta:{}, createdAt:now(), updatedAt:now() };
    }

    initialize() {
      try {
        const device = JSON.parse(localStorage.getItem(DEVICE_KEY));
        const shared = JSON.parse(localStorage.getItem(SHARED_KEY));
        if (device?.profiles?.length && shared) {
          this.device = device;
          this.shared = shared;
          this.activeProfile = this.readProfile(device.activeProfileId) || this.defaultProfileData(device.activeProfileId);
          this.persistAll();
          return;
        }
      } catch (error) { console.warn('Profile storage could not be loaded.', error); }
      this.migrateLegacy();
    }

    migrateLegacy() {
      let legacy = null;
      try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY)); } catch {}
      const profileId = uuid();
      const createdAt = now();
      this.device = {
        schemaVersion:1,
        activeProfileId:profileId,
        profiles:[{ profileId, displayName:'Primary Profile', createdAt, updatedAt:createdAt, migrationStatus: legacy ? 'migrated-from-v0.9' : 'local-only' }],
        migration:{ id:'single-state-to-profiles-v1', migratedAt:createdAt, sourceKey:LEGACY_KEY, legacyFound:!!legacy }
      };
      this.shared = this.defaultShared();
      this.activeProfile = this.defaultProfileData(profileId);
      if (legacy?.modules) {
        localStorage.setItem(`${LEGACY_KEY}.preProfiles`, JSON.stringify(legacy));
        this.shared.modules = clone(legacy.modules.filter(module => module.moduleId !== 'my-recipes'));
        this.shared.moduleSources = clone(legacy.moduleSources || {});
        this.shared.timers = clone((legacy.timers || []).map(timer => ({ ...timer, profileId: timer.profileId || profileId })));
        this.shared.backupMeta = clone(legacy.backupMeta || {});
        this.activeProfile.personalModule = clone(legacy.modules.find(module => module.moduleId === 'my-recipes') || null);
        for (const key of ['favorites','recipeNotes','hiddenRecipes','customCategories','shoppingList','regularItems','stores','settings','ratings','learnedStorePreferences']) {
          if (legacy[key] !== undefined) this.activeProfile[key] = clone(legacy[key]);
        }
      }
      this.persistAll();
    }

    readProfile(profileId) {
      try { return JSON.parse(localStorage.getItem(PROFILE_PREFIX + profileId)); } catch { return null; }
    }

    persistAll() {
      this.shared.updatedAt = now();
      this.activeProfile.updatedAt = now();
      localStorage.setItem(DEVICE_KEY, JSON.stringify(this.device));
      localStorage.setItem(SHARED_KEY, JSON.stringify(this.shared));
      localStorage.setItem(PROFILE_PREFIX + this.activeProfile.profileId, JSON.stringify(this.activeProfile));
      this.mirrorToIndexedDB().catch(error => console.warn('IndexedDB mirror unavailable; local fallback remains active.', error));
    }

    loadActiveState() {
      const personal = this.activeProfile.personalModule;
      return {
        modules: [...clone(this.shared.modules || []), ...(personal ? [clone(personal)] : [])],
        favorites: clone(this.activeProfile.favorites || []),
        recipeNotes: clone(this.activeProfile.recipeNotes || {}),
        hiddenRecipes: clone(this.activeProfile.hiddenRecipes || []),
        customCategories: clone(this.activeProfile.customCategories || []),
        timers: clone(this.shared.timers || []),
        shoppingList: clone(this.activeProfile.shoppingList || []),
        regularItems: clone(this.activeProfile.regularItems || []),
        stores: clone(this.activeProfile.stores || ['Unassigned','Costco','Walmart']),
        moduleSources: clone(this.shared.moduleSources || {}),
        settings: clone(this.activeProfile.settings || {}),
        backupMeta: clone(this.shared.backupMeta || {}),
        ratings: clone(this.activeProfile.ratings || {}),
        learnedStorePreferences: clone(this.activeProfile.learnedStorePreferences || {})
      };
    }

    saveCombinedState(state) {
      this.shared.modules = clone((state.modules || []).filter(module => module.moduleId !== 'my-recipes'));
      this.shared.moduleSources = clone(state.moduleSources || {});
      this.shared.timers = clone((state.timers || []).map(timer => ({ ...timer, profileId: timer.profileId || this.device.activeProfileId })));
      this.shared.backupMeta = clone(state.backupMeta || {});
      this.activeProfile.personalModule = clone((state.modules || []).find(module => module.moduleId === 'my-recipes') || null);
      for (const key of ['favorites','recipeNotes','hiddenRecipes','customCategories','shoppingList','regularItems','stores','settings','ratings','learnedStorePreferences']) {
        this.activeProfile[key] = clone(state[key] ?? this.activeProfile[key]);
      }
      this.persistAll();
    }

    getActiveProfileMeta() { return clone(this.device.profiles.find(p => p.profileId === this.device.activeProfileId)); }
    listProfiles() { return clone(this.device.profiles); }

    createProfile(displayName) {
      const name = String(displayName || '').trim();
      if (!name) throw new Error('Enter a profile name.');
      const profileId = uuid(); const createdAt = now();
      const meta = { profileId, displayName:name, createdAt, updatedAt:createdAt, migrationStatus:'local-only' };
      const data = this.defaultProfileData(profileId);
      localStorage.setItem(PROFILE_PREFIX + profileId, JSON.stringify(data));
      this.device.profiles.push(meta); this.persistAll();
      return clone(meta);
    }

    renameProfile(profileId, displayName) {
      const name = String(displayName || '').trim(); if (!name) throw new Error('Enter a profile name.');
      const meta = this.device.profiles.find(p => p.profileId === profileId); if (!meta) throw new Error('Profile not found.');
      meta.displayName = name; meta.updatedAt = now(); this.persistAll();
    }

    switchProfile(profileId) {
      if (!this.device.profiles.some(p => p.profileId === profileId)) throw new Error('Profile not found.');
      this.device.activeProfileId = profileId;
      localStorage.setItem(DEVICE_KEY, JSON.stringify(this.device));
    }

    deleteProfile(profileId) {
      if (this.device.profiles.length <= 1) throw new Error('Kitchen Companion must keep at least one profile.');
      if (profileId === this.device.activeProfileId) throw new Error('Switch to another profile before deleting this one.');
      this.device.profiles = this.device.profiles.filter(p => p.profileId !== profileId);
      localStorage.removeItem(PROFILE_PREFIX + profileId); this.persistAll();
    }

    exportProfile(profileId = this.device.activeProfileId) {
      const meta = this.device.profiles.find(p => p.profileId === profileId);
      const data = profileId === this.activeProfile.profileId ? this.activeProfile : this.readProfile(profileId);
      if (!meta || !data) throw new Error('Profile not found.');
      return { format:'kitchen-companion-profile', schemaVersion:1, exportedAt:now(), profile:clone(meta), data:clone(data) };
    }

    profileSummary(profileId) {
      const data = profileId === this.activeProfile.profileId ? this.activeProfile : this.readProfile(profileId);
      return { personalRecipes:data?.personalModule?.recipes?.length || 0, favorites:data?.favorites?.length || 0, notes:Object.keys(data?.recipeNotes || {}).length, shoppingItems:data?.shoppingList?.length || 0 };
    }

    async mirrorToIndexedDB() {
      if (!('indexedDB' in window)) return;
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('appMeta')) db.createObjectStore('appMeta');
          if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath:'profileId' });
          if (!db.objectStoreNames.contains('profileData')) db.createObjectStore('profileData', { keyPath:'profileId' });
          if (!db.objectStoreNames.contains('modules')) db.createObjectStore('modules', { keyPath:'moduleId' });
        };
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['appMeta','profiles','profileData','modules'], 'readwrite');
        tx.objectStore('appMeta').put(clone(this.device), 'device');
        tx.objectStore('appMeta').put({ ...clone(this.shared), modules:undefined }, 'shared');
        this.device.profiles.forEach(profile => tx.objectStore('profiles').put(clone(profile)));
        const data = { ...clone(this.activeProfile), profileId:this.activeProfile.profileId };
        tx.objectStore('profileData').put(data);
        (this.shared.modules || []).forEach(module => tx.objectStore('modules').put(clone(module)));
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
      db.close();
    }
  }

  window.KCProfileStore = KCProfileStore;
})();
