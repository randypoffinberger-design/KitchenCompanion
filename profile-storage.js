(() => {
  'use strict';

  const DEVICE_KEY = 'kitchenCompanion.device.v1';
  const SHARED_KEY = 'kitchenCompanion.shared.v1';
  const PROFILE_PREFIX = 'kitchenCompanion.profile.v1.';
  const LEGACY_KEY = 'recipeEngineState.v1';
  const DB_NAME = 'kitchen-companion';
  const DB_VERSION = 1;
  const BACKUP_KEY = 'kitchenCompanion.safetyBackups.v1';
  const MAX_AUTOMATIC_BACKUPS = 5;
  const MAX_MANUAL_BACKUPS = 10;
  const STARTUP_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const APP_VERSION = '0.11.5.4';
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

    validateStorageSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Checkpoint data is missing or damaged.');
      const keys = Object.keys(snapshot);
      if (!keys.length) throw new Error('No Kitchen Companion data was available to protect.');
      for (const key of keys) {
        if (!(key.startsWith('kitchenCompanion.') || key === LEGACY_KEY) || key === BACKUP_KEY) throw new Error(`Checkpoint contains an unsupported storage key: ${key}`);
        if (typeof snapshot[key] !== 'string') throw new Error(`Checkpoint entry ${key} is damaged.`);
        try { JSON.parse(snapshot[key]); } catch { throw new Error(`Checkpoint entry ${key} is not valid saved data.`); }
      }
      return true;
    }

    writeAndVerify(key, value) {
      localStorage.setItem(key, value);
      if (localStorage.getItem(key) !== value) throw new Error(`Browser storage could not verify ${key}.`);
    }

    semanticFingerprint(snapshot) {
      const stripVolatile = value => {
        if (Array.isArray(value)) return value.map(stripVolatile);
        if (!value || typeof value !== 'object') return value;
        const output = {};
        Object.keys(value).sort().forEach(key => {
          if (['updatedAt','lastUsedAt','lastOpenedAt','lastSavedAt'].includes(key)) return;
          output[key] = stripVolatile(value[key]);
        });
        return output;
      };
      const normalized = {};
      Object.keys(snapshot).sort().forEach(key => {
        const raw = snapshot[key];
        try { normalized[key] = stripVolatile(JSON.parse(raw)); }
        catch { normalized[key] = raw; }
      });
      return JSON.stringify(normalized);
    }

    backupKind(reason) {
      return reason === 'manual-checkpoint' ? 'manual' : 'automatic';
    }

    normalizeSafetyBackups(backups = this.getSafetyBackups()) {
      return backups.filter(item => item?.snapshot && item?.createdAt).map(item => ({
        ...item,
        kind: item.kind || this.backupKind(item.reason),
        appVersion: item.appVersion || '0.11.5.2',
        fingerprint: item.fingerprint || this.semanticFingerprint(item.snapshot)
      })).sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }

    retainSafetyBackups(backups) {
      const normalized = this.normalizeSafetyBackups(backups);
      const manual = normalized.filter(item => item.kind === 'manual').slice(0, MAX_MANUAL_BACKUPS);
      const automatic = normalized.filter(item => item.kind !== 'manual').slice(0, MAX_AUTOMATIC_BACKUPS);
      return [...manual, ...automatic].sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }

    createSafetyBackup(reason = 'startup', options = {}) {
      try {
        const snapshot = this.collectStorageSnapshot();
        this.validateStorageSnapshot(snapshot);
        const fingerprint = this.semanticFingerprint(snapshot);
        const backups = this.normalizeSafetyBackups();
        const kind = options.kind || this.backupKind(reason);
        const comparable = backups.find(item => item.kind === kind);
        if (!options.force && comparable?.fingerprint === fingerprint) return comparable;
        const backup = { id:uuid(), createdAt:now(), reason, kind, appVersion:APP_VERSION, schemaVersion:STORAGE_SCHEMA_VERSION, fingerprint, snapshot };
        const retained = this.retainSafetyBackups([backup, ...backups]);
        const encoded = JSON.stringify(retained);
        this.writeAndVerify(BACKUP_KEY, encoded);
        const saved = this.getSafetyBackups().find(item => item.id === backup.id);
        if (!saved || saved.fingerprint !== fingerprint) throw new Error('Checkpoint verification failed.');
        return backup;
      } catch (error) {
        console.warn('Safety backup failed.', error);
        if (options.required) throw error;
        return null;
      }
    }

    compactSafetyBackups() {
      const backups = this.normalizeSafetyBackups();
      const compacted = [];
      let newestStartupTime = null;
      const seenAutomaticFingerprints = new Set();
      for (const backup of backups) {
        if (backup.reason === 'startup') {
          const backupTime = Date.parse(backup.createdAt);
          if (Number.isFinite(backupTime) && newestStartupTime !== null && newestStartupTime - backupTime < STARTUP_BACKUP_INTERVAL_MS) continue;
          if (Number.isFinite(backupTime)) newestStartupTime = backupTime;
        }
        if (backup.kind !== 'manual') {
          const duplicateKey = `${backup.reason}:${backup.fingerprint}`;
          if (seenAutomaticFingerprints.has(duplicateKey)) continue;
          seenAutomaticFingerprints.add(duplicateKey);
        }
        compacted.push(backup);
      }
      const retained = this.retainSafetyBackups(compacted);
      if (JSON.stringify(retained) !== JSON.stringify(this.getSafetyBackups())) localStorage.setItem(BACKUP_KEY, JSON.stringify(retained));
      return retained;
    }

    createStartupSafetyBackup() {
      const backups = this.compactSafetyBackups();
      const latestLifecycle = backups.find(backup => backup.reason === 'startup' || backup.reason === 'engine-update');
      const snapshot = this.collectStorageSnapshot();
      if (!Object.keys(snapshot).length) return null;
      const fingerprint = this.semanticFingerprint(snapshot);
      if (!latestLifecycle) return this.createSafetyBackup('startup', { force:true });
      if (latestLifecycle.appVersion !== APP_VERSION) return this.createSafetyBackup('engine-update', { force:true });
      const latestLifecycleTime = Date.parse(latestLifecycle.createdAt);
      const due = !Number.isFinite(latestLifecycleTime) || Date.now() - latestLifecycleTime >= STARTUP_BACKUP_INTERVAL_MS;
      if (due && latestLifecycle.fingerprint !== fingerprint) return this.createSafetyBackup('startup', { force:true });
      return latestLifecycle;
    }

    getSafetyBackups() {
      try { return JSON.parse(localStorage.getItem(BACKUP_KEY)) || []; } catch { return []; }
    }

    restoreSafetyBackup(backupId) {
      const backup = this.getSafetyBackups().find(item => item.id === backupId);
      if (!backup?.snapshot) throw new Error('Safety backup not found.');
      this.validateStorageSnapshot(backup.snapshot);
      this.createSafetyBackup('before-restore', { force:true, required:true });
      const current = this.collectStorageSnapshot();
      try {
        Object.keys(current).filter(key => !(key in backup.snapshot)).forEach(key => localStorage.removeItem(key));
        Object.keys(backup.snapshot).forEach(key => this.writeAndVerify(key, backup.snapshot[key]));
      } catch (error) {
        Object.keys(this.collectStorageSnapshot()).forEach(key => localStorage.removeItem(key));
        Object.keys(current).forEach(key => localStorage.setItem(key, current[key]));
        throw new Error(`Checkpoint restore was rolled back: ${error.message}`);
      }
      return true;
    }

    getDiagnostics() {
      const backups = this.compactSafetyBackups();
      const validBackupCount = backups.filter(backup => {
        try { return this.validateStorageSnapshot(backup.snapshot); } catch { return false; }
      }).length;
      return { storageSchemaVersion:STORAGE_SCHEMA_VERSION, activeProfileId:this.activeProfile?.profileId || this.device?.activeProfileId || '', profileCount:this.device?.profiles?.length || 0, moduleCount:this.shared?.modules?.length || 0, lastBackupAt:backups[0]?.createdAt || null, backupCount:backups.length, validBackupCount, manualBackupCount:backups.filter(item => item.kind === 'manual').length, automaticBackupCount:backups.filter(item => item.kind !== 'manual').length, recoveredAt:sessionStorage.getItem('kitchenCompanion.recoveredCheckpoint'), migration:this.device?.migration || null };
    }

    loadCurrentStorage() {
      const device = JSON.parse(localStorage.getItem(DEVICE_KEY));
      const shared = JSON.parse(localStorage.getItem(SHARED_KEY));
      if (!device?.profiles?.length || !shared) return false;
      this.device = device;
      this.normalizeProfileMetadata();
      this.shared = shared;
      this.activeProfile = this.normalizeProfileData(this.readProfile(device.activeProfileId) || this.defaultProfileData(device.activeProfileId));
      this.markProfileUsed(device.activeProfileId);
      this.persistAll();
      return true;
    }

    recoverLatestValidCheckpoint() {
      const original = this.collectStorageSnapshot();
      for (const backup of this.normalizeSafetyBackups()) {
        try {
          this.validateStorageSnapshot(backup.snapshot);
          Object.keys(this.collectStorageSnapshot()).forEach(key => localStorage.removeItem(key));
          Object.keys(backup.snapshot).forEach(key => this.writeAndVerify(key, backup.snapshot[key]));
          if (this.loadCurrentStorage()) return backup;
        } catch (error) {
          console.warn('A recovery checkpoint could not be used.', error);
          Object.keys(this.collectStorageSnapshot()).forEach(key => localStorage.removeItem(key));
          Object.keys(original).forEach(key => localStorage.setItem(key, original[key]));
        }
      }
      Object.keys(this.collectStorageSnapshot()).forEach(key => localStorage.removeItem(key));
      Object.keys(original).forEach(key => localStorage.setItem(key, original[key]));
      return null;
    }

    initialize() {
      this.createStartupSafetyBackup();
      try {
        if (this.loadCurrentStorage()) return;
      } catch (error) { console.warn('Profile storage could not be loaded.', error); }
      try {
        const recovered = this.recoverLatestValidCheckpoint();
        if (recovered) {
          sessionStorage.setItem('kitchenCompanion.recoveredCheckpoint', recovered.createdAt);
          return;
        }
      } catch (error) { console.warn('Startup recovery failed.', error); }
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
      const writes = [
        [DEVICE_KEY, JSON.stringify(this.device)],
        [SHARED_KEY, JSON.stringify(this.shared)],
        [PROFILE_PREFIX + this.activeProfile.profileId, JSON.stringify(this.activeProfile)]
      ];
      const previous = new Map(writes.map(([key]) => [key, localStorage.getItem(key)]));
      try {
        writes.forEach(([key, value]) => this.writeAndVerify(key, value));
      } catch (error) {
        writes.forEach(([key]) => {
          const value = previous.get(key);
          if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
        });
        throw new Error(`Save failed and was rolled back: ${error.message}`);
      }
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
