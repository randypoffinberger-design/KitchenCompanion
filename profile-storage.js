(() => {
  'use strict';

  const DEVICE_KEY = 'kitchenCompanion.device.v1';
  const SHARED_KEY = 'kitchenCompanion.shared.v1';
  const PROFILE_PREFIX = 'kitchenCompanion.profile.v1.';
  const LEGACY_KEY = 'recipeEngineState.v1';
  const DB_NAME = 'kitchen-companion';
  const DB_VERSION = 1;
  const BACKUP_KEY = 'kitchenCompanion.safetyBackups.v1';
  const MAX_SAFETY_BACKUPS = 5;
  const STORAGE_SCHEMA_VERSION = 2;

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
        schemaVersion: 2,
        profileId,
        personalRecipes: [],
        favorites: [], recipeNotes: {}, hiddenRecipes: [], customCategories: [],
        shoppingList: [], regularItems: [], stores: ['Unassigned', 'Costco', 'Walmart'],
        settings: { darkMode:false, metricHelpers:false, accentColor:'#7b3f00', wakeLockMode:'recipes-and-timers', alarmVolume:0.85, alarmSoundEnabled:true },
        ratings: {}, learnedStorePreferences: {}, createdAt: now(), updatedAt: now()
      };
    }

    defaultShared() {
      return { schemaVersion:1, modules:[], moduleSources:{}, timers:[], backupMeta:{}, createdAt:now(), updatedAt:now() };
    }


    collectStorageSnapshot() {
      const values = {};
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('kitchenCompanion.') || key === LEGACY_KEY) && key !== BACKUP_KEY) values[key] = localStorage.getItem(key);
      }
      return values;
    }

    createSafetyBackup(reason = 'startup') {
      try {
        const snapshot = this.collectStorageSnapshot();
        if (!Object.keys(snapshot).length) return null;
        const fingerprint = JSON.stringify(snapshot);
        const backups = this.getSafetyBackups();
        if (backups[0]?.fingerprint === fingerprint) return backups[0];
        const backup = { id:uuid(), createdAt:now(), reason, schemaVersion:STORAGE_SCHEMA_VERSION, fingerprint, snapshot };
        backups.unshift(backup);
        localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, MAX_SAFETY_BACKUPS)));
        return backup;
      } catch (error) { console.warn('Safety backup failed.', error); return null; }
    }

    getSafetyBackups() {
      try { return JSON.parse(localStorage.getItem(BACKUP_KEY)) || []; } catch { return []; }
    }

    restoreSafetyBackup(backupId) {
      const backup = this.getSafetyBackups().find(item => item.id === backupId);
      if (!backup?.snapshot) throw new Error('Safety backup not found.');
      this.createSafetyBackup('before-restore');
      Object.keys(backup.snapshot).forEach(key => localStorage.setItem(key, backup.snapshot[key]));
      return true;
    }

    getDiagnostics() {
      const backups = this.getSafetyBackups();
      return { storageSchemaVersion:STORAGE_SCHEMA_VERSION, activeProfileId:this.activeProfile?.profileId || this.device?.activeProfileId || '', profileCount:this.device?.profiles?.length || 0, moduleCount:this.shared?.modules?.length || 0, lastBackupAt:backups[0]?.createdAt || null, backupCount:backups.length, migration:this.device?.migration || null };
    }

    initialize() {
      this.createSafetyBackup('startup');
      try {
        const device = JSON.parse(localStorage.getItem(DEVICE_KEY));
        const shared = JSON.parse(localStorage.getItem(SHARED_KEY));
        if (device?.profiles?.length && shared) {
          this.device = device;
          this.normalizeProfileMetadata();
          this.shared = shared;
          this.activeProfile = this.normalizeProfileData(this.readProfile(device.activeProfileId) || this.defaultProfileData(device.activeProfileId));
          this.markProfileUsed(device.activeProfileId);
          this.persistAll();
          return;
        }
      } catch (error) { console.warn('Profile storage could not be loaded.', error); }
      this.migrateLegacy();
    }

    normalizeProfileMetadata() {
      const palette = ['#7b3f00','#2563eb','#15803d','#7e22ce','#be123c','#0f766e'];
      let changed = false;
      (this.device?.profiles || []).forEach((profile, index) => {
        if (!profile.color) { profile.color = palette[index % palette.length]; changed = true; }
        if (!profile.kind) { profile.kind = 'personal'; changed = true; }
        if (!profile.avatarType) { profile.avatarType = profile.kind === 'household' ? 'emoji' : 'initials'; changed = true; }
        if (profile.avatarValue === undefined) { profile.avatarValue = profile.kind === 'household' ? '🏠' : ''; changed = true; }
        if (profile.setupComplete === undefined) { profile.setupComplete = profile.migrationStatus !== 'migrated-from-v0.9'; changed = true; }
        if (profile.displayName === 'Primary Profile') { profile.displayName = 'My Profile'; changed = true; }
      });
      if (changed) localStorage.setItem(DEVICE_KEY, JSON.stringify(this.device));
    }

    normalizeProfileData(data) {
      const normalized = data || this.defaultProfileData(this.device?.activeProfileId || uuid());
      if (!Array.isArray(normalized.personalRecipes)) {
        normalized.personalRecipes = clone(normalized.personalModule?.recipes || []);
      }
      delete normalized.personalModule;
      normalized.schemaVersion = 2;
      return normalized;
    }

    markProfileUsed(profileId) {
      const meta = this.device?.profiles?.find(profile => profile.profileId === profileId);
      if (meta) meta.lastUsedAt = now();
    }

    migrateLegacy() {
      let legacy = null;
      try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY)); } catch {}
      const profileId = uuid();
      const createdAt = now();
      this.device = {
        schemaVersion:1,
        activeProfileId:profileId,
        profiles:[{ profileId, displayName:'My Profile', color:'#7b3f00', kind:'personal', setupComplete:!legacy, createdAt, updatedAt:createdAt, migrationStatus: legacy ? 'migrated-from-v0.9' : 'local-only', avatarType:'initials', avatarValue:'' }],
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
        this.activeProfile.personalRecipes = clone(legacy.modules.find(module => module.moduleId === 'my-recipes')?.recipes || []);
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
      const personalRecipes = clone(this.activeProfile.personalRecipes || []);
      const personal = personalRecipes.length ? { schemaVersion:1, moduleId:'my-recipes', name:'My Recipes', publisher:'Kitchen Companion user', version:'1.0.0', description:'Recipes created or edited in Kitchen Companion.', license:'Personal', enabled:true, recipes:personalRecipes } : null;
      return {
        modules: [...clone(this.shared.modules || []), ...(personal ? [personal] : [])],
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
      this.activeProfile.personalRecipes = clone((state.modules || []).find(module => module.moduleId === 'my-recipes')?.recipes || []);
      for (const key of ['favorites','recipeNotes','hiddenRecipes','customCategories','shoppingList','regularItems','stores','settings','ratings','learnedStorePreferences']) {
        this.activeProfile[key] = clone(state[key] ?? this.activeProfile[key]);
      }
      this.persistAll();
    }

    getActiveProfileMeta() { return clone(this.device.profiles.find(p => p.profileId === this.device.activeProfileId)); }
    listProfiles() { return clone(this.device.profiles); }

    createProfile(displayName, options = {}) {
      const name = String(displayName || '').trim();
      if (!name) throw new Error('Enter a profile name.');
      const profileId = uuid(); const createdAt = now();
      const palette = ['#7b3f00','#2563eb','#15803d','#7e22ce','#be123c','#0f766e'];
      const kind = options.kind || 'personal';
      const meta = { profileId, displayName:name, color:options.color || palette[this.device.profiles.length % palette.length], kind, avatarType:options.avatarType || (kind === 'household' ? 'emoji' : 'initials'), avatarValue:options.avatarValue ?? (kind === 'household' ? '🏠' : ''), setupComplete:true, createdAt, updatedAt:createdAt, migrationStatus:'local-only', lastUsedAt:createdAt };
      const data = this.defaultProfileData(profileId);
      localStorage.setItem(PROFILE_PREFIX + profileId, JSON.stringify(data));
      this.device.profiles.push(meta); this.persistAll();
      return clone(meta);
    }

    duplicateProfile(profileId, displayName) {
      const sourceMeta = this.device.profiles.find(p => p.profileId === profileId);
      const sourceData = profileId === this.activeProfile.profileId ? this.activeProfile : this.readProfile(profileId);
      if (!sourceMeta || !sourceData) throw new Error('Profile not found.');
      const copy = this.createProfile(displayName || `${sourceMeta.displayName} Copy`, { color:sourceMeta.color, kind:'personal', avatarType:sourceMeta.avatarType, avatarValue:sourceMeta.avatarValue });
      const data = this.normalizeProfileData(clone(sourceData));
      data.profileId = copy.profileId; data.createdAt = now(); data.updatedAt = data.createdAt;
      localStorage.setItem(PROFILE_PREFIX + copy.profileId, JSON.stringify(data));
      this.persistAll();
      return copy;
    }

    completeProfileSetup(profileId, displayName) {
      const meta = this.device.profiles.find(p => p.profileId === profileId);
      if (!meta) throw new Error('Profile not found.');
      const name = String(displayName || '').trim();
      if (name) meta.displayName = name;
      meta.setupComplete = true; meta.updatedAt = now(); this.persistAll();
    }

    renameProfile(profileId, displayName) {
      const name = String(displayName || '').trim(); if (!name) throw new Error('Enter a profile name.');
      const meta = this.device.profiles.find(p => p.profileId === profileId); if (!meta) throw new Error('Profile not found.');
      meta.displayName = name; meta.updatedAt = now(); this.persistAll();
    }


    updateProfile(profileId, changes = {}) {
      const meta = this.device.profiles.find(p => p.profileId === profileId);
      if (!meta) throw new Error('Profile not found.');
      const name = String(changes.displayName ?? meta.displayName).trim();
      if (!name) throw new Error('Enter a profile name.');
      meta.displayName = name;
      if (changes.color) meta.color = String(changes.color);
      if (['initials','emoji','image'].includes(changes.avatarType)) meta.avatarType = changes.avatarType;
      meta.avatarValue = changes.avatarValue == null ? '' : String(changes.avatarValue);
      meta.updatedAt = now();
      this.persistAll();
      return clone(meta);
    }

    switchProfile(profileId) {
      if (!this.device.profiles.some(p => p.profileId === profileId)) throw new Error('Profile not found.');
      this.device.activeProfileId = profileId;
      this.markProfileUsed(profileId);
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
      return { format:'kitchen-companion-profile', schemaVersion:2, exportedAt:now(), profile:clone(meta), data:this.normalizeProfileData(clone(data)) };
    }

    importProfile(payload, mode = 'add-copy') {
      if (!payload || payload.format !== 'kitchen-companion-profile' || !payload.profile || !payload.data) throw new Error('This is not a valid Kitchen Companion profile export.');
      const incomingData = this.normalizeProfileData(clone(payload.data));
      const existing = this.device.profiles.find(profile => profile.profileId === payload.profile.profileId);
      if (existing && mode === 'replace') {
        const wasActive = existing.profileId === this.device.activeProfileId;
        existing.displayName = String(payload.profile.displayName || existing.displayName).trim() || existing.displayName;
        existing.color = payload.profile.color || existing.color;
        existing.kind = payload.profile.kind || existing.kind;
        existing.avatarType = payload.profile.avatarType || existing.avatarType || 'initials';
        existing.avatarValue = payload.profile.avatarValue ?? existing.avatarValue ?? '';
        existing.updatedAt = now();
        incomingData.profileId = existing.profileId;
        incomingData.updatedAt = now();
        localStorage.setItem(PROFILE_PREFIX + existing.profileId, JSON.stringify(incomingData));
        if (wasActive) this.activeProfile = incomingData;
        this.persistAll();
        return clone(existing);
      }
      const importedName = String(payload.profile.displayName || 'Imported Profile').trim() || 'Imported Profile';
      const meta = this.createProfile(existing ? `${importedName} Imported` : importedName, { color:payload.profile.color, kind:payload.profile.kind || 'personal', avatarType:payload.profile.avatarType, avatarValue:payload.profile.avatarValue });
      incomingData.profileId = meta.profileId;
      incomingData.createdAt = now(); incomingData.updatedAt = incomingData.createdAt;
      localStorage.setItem(PROFILE_PREFIX + meta.profileId, JSON.stringify(incomingData));
      this.persistAll();
      return meta;
    }

    profileSummary(profileId) {
      const data = profileId === this.activeProfile.profileId ? this.activeProfile : this.readProfile(profileId);
      return { personalRecipes:(data?.personalRecipes || data?.personalModule?.recipes || []).length, favorites:data?.favorites?.length || 0, notes:Object.keys(data?.recipeNotes || {}).length, hidden:data?.hiddenRecipes?.length || 0, ratings:Object.keys(data?.ratings || {}).length, shoppingItems:data?.shoppingList?.length || 0, stores:(data?.stores || []).filter(x => x && x !== 'Unassigned').length };
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
