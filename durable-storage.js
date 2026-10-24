(() => {
  'use strict';
  const owned = key => /^(kitchenCompanion\.|serenityKitchen\.|recipeEngineState\.v1)/.test(key);
  const clone = value => JSON.parse(JSON.stringify(value));
  function historyToKeep(entries) {
    const sorted=[...entries].sort((a,b)=>b.revision-a.revision),keep=new Set(sorted.filter(item=>item.pinned).map(item=>item.id));
    sorted.filter(item=>!item.pinned).slice(0,40).forEach(item=>keep.add(item.id));
    const day=value=>value.slice(0,10),week=value=>{const d=new Date(value);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);};
    for(const [limit,key] of [[14,day],[8,week],[12,value=>value.slice(0,7)]]){
      const periods=new Set();for(const item of sorted){const period=key(item.createdAt);if(periods.has(period)||periods.size>=limit)continue;periods.add(period);keep.add(item.id);}
    }
    return keep;
  }
  class KitchenMemoryStorage {
    constructor(entries = {}) { this.entries = new Map(Object.entries(entries)); this.generation = 0; }
    get length() { return this.entries.size; }
    key(index) { return [...this.entries.keys()][index] ?? null; }
    getItem(key) { return this.entries.get(String(key)) ?? null; }
    setItem(key, value) {
      key = String(key); value = String(value);
      if (!owned(key)) throw new Error('Unsupported kitchen storage key.');
      if (this.entries.get(key) === value) return;
      this.entries.set(key, value); this.generation++; this.onchange?.();
    }
    removeItem(key) { if (this.entries.delete(String(key))) { this.generation++; this.onchange?.(); } }
    snapshot() { return Object.fromEntries(this.entries); }
  }

  class SKDurableStorage {
    static connect(indexedDB, initialize = false) {
      return new Promise((resolve, reject) => {
        const request = initialize ? indexedDB.open('serenity-kitchen-durable', 1) : indexedDB.open('serenity-kitchen-durable');
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('current')) db.createObjectStore('current', {keyPath:'id'});
          if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', {keyPath:'id'});
        };
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('current') || !db.objectStoreNames.contains('history')) {
            db.close();
            reject(new Error('The saved kitchen format needs recovery. No data was replaced.'));
            return;
          }
          resolve(db);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Close other SK windows before opening the saved kitchen.'));
      });
    }
    static async open(legacy, indexedDB) {
      const db = await SKDurableStorage.connect(indexedDB, true);
      const backend = new SKDurableStorage(db, indexedDB);
      const current = await backend.readCurrent();
      const legacyEntries = {};
      for (let i=0;i<legacy.length;i++){const key=legacy.key(i);if(owned(key))legacyEntries[key]=legacy.getItem(key);}
      const legacyFingerprint=await backend.semanticFingerprint(legacyEntries);
      backend.legacyFingerprint=legacyFingerprint;
      if (current) {
        if (current.schema !== 1 || !current.entries || typeof current.revision !== 'number') {
          backend.close(); throw new Error('The saved kitchen format needs recovery. No data was replaced.');
        }
        backend.revision = current.revision;
        backend.storage = new KitchenMemoryStorage(current.entries);
        if(current.legacyFingerprint && current.legacyFingerprint!==legacyFingerprint){
          backend.pendingLegacy=legacyEntries;
          backend.olderInstallationPreserved=true;
          await backend.flush('before-older-version-review',true);
        }
      } else {
        backend.storage = new KitchenMemoryStorage(legacyEntries);
        // The original localStorage and its historical snapshots are untouched.
        await backend.flush('migration-original', true);
      }
      backend.storage.onchange = () => backend.schedule();
      return backend;
    }
    constructor(db, indexedDB) {
      this.indexedDB = indexedDB;
      this.revision = 0;
      this.savedGeneration = -1;
      this.queue = Promise.resolve();
      this.queuedGeneration = -1;
      this.closed = false;
      this.attach(db);
    }
    attach(db) {
      this.db = db;
      this.connectionStale = false;
      db.onversionchange = () => {
        if (this.db !== db || this.closed) return;
        this.connectionStale = true;
        db.close();
      };
      db.onclose = () => { if (this.db === db && !this.closed) this.connectionStale = true; };
      return db;
    }
    connectionError(error) {
      const message = String(error?.message || '');
      return error?.name === 'InvalidStateError' || /database connection is closing|connection (?:is )?clos(?:ed|ing)/i.test(message) || (this.connectionStale && error?.name === 'AbortError');
    }
    serverError(error) {
      const message = String(error?.message || '');
      return error?.name === 'UnknownError' && /internal error.*indexed database server|connection to indexed database server lost/i.test(message);
    }
    unavailableError(error) {
      if (error?.reloadRequired) return error;
      const unavailable = new Error("The iPhone saved-data service stopped. Existing saved data was not cleared. Export a backup if you have unsaved changes, then reload SK.");
      unavailable.name = 'IndexedDBServerError'; unavailable.reloadRequired = true; unavailable.cause = error;
      return unavailable;
    }
    stopForReload(error) {
      this.connectionStale = true;
      try { this.db?.close(); } catch {}
      this.lastError = this.unavailableError(error);
      this.reloadRequired = true;
      return this.lastError;
    }
    reconnect() {
      if (this.reloadRequired) return Promise.reject(this.lastError);
      if (this.closed) return Promise.reject(new Error('Saved kitchen connection closed. Export your changes and reopen SK.'));
      if (this.reconnecting) return this.reconnecting;
      this.connectionStale = true;
      try { this.db?.close(); } catch {}
      this.reconnecting = SKDurableStorage.connect(this.indexedDB)
        .then(db => {
          if (this.closed) { db.close(); throw new Error('Saved kitchen connection closed. Export your changes and reopen SK.'); }
          return this.attach(db);
        })
        .catch(error => { throw this.serverError(error) ? this.stopForReload(error) : error; })
        .finally(() => { this.reconnecting = null; });
      return this.reconnecting;
    }
    async withConnection(operation, retry = true) {
      if (this.reloadRequired) throw this.lastError;
      if (this.closed) throw new Error('Saved kitchen connection closed. Export your changes and reopen SK.');
      if (this.connectionStale) await this.reconnect();
      const db = this.db;
      try { return await operation(db); }
      catch (error) {
        if (this.serverError(error)) throw this.stopForReload(error);
        if (!retry || !this.connectionError(error)) throw error;
        await this.reconnect();
        return this.withConnection(operation, false);
      }
    }
    readCurrent() {
      return this.withConnection(db => new Promise((resolve, reject) => {
        const request = db.transaction('current', 'readonly').objectStore('current').get('active');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      }));
    }
    schedule() {
      if (this.scheduled) return;
      this.scheduled = true;
      queueMicrotask(() => {
        this.scheduled = false;
        this.flush().catch(error => this.onError?.(error));
      });
    }
    async semanticFingerprint(entries) {
      const hash=async text=>{if(globalThis.crypto?.subtle){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}return text;};
      this.fingerprintCache ||= new Map();
      const clean=value=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>!['updatedAt','lastUsedAt','lastOpenedAt','lastSavedAt','backupMeta'].includes(key)).map(key=>[key,clean(value[key])])):value;
      const parts=[];
      for(const key of Object.keys(entries).sort())if(key.startsWith('kitchenCompanion.')&&!key.includes('safetyBackups')){
        const cached=this.fingerprintCache.get(key);
        if(cached?.source===entries[key]){parts.push(JSON.stringify(key)+':'+cached.canonical);continue;}
        let value;try{value=JSON.stringify(clean(JSON.parse(entries[key])));}catch{value=JSON.stringify(entries[key]);}
        parts.push(JSON.stringify(key)+':'+value);this.fingerprintCache.set(key,{source:entries[key],canonical:value});
      }
      const text='{'+parts.join(',')+'}';
      for(const key of this.fingerprintCache.keys())if(!(key in entries))this.fingerprintCache.delete(key);
      return hash(text);
    }
    flush(reason = 'save', pin = false, forceHistory = false) {
      if (this.reloadRequired) return Promise.reject(this.lastError);
      if (this.closed) return Promise.reject(new Error('Saved kitchen connection closed. Export your changes and reopen SK.'));
      const generation = this.storage.generation;
      if (generation === this.queuedGeneration && !pin && !forceHistory) return this.queue;
      const entries = this.storage.snapshot();
      this.queuedGeneration = generation;
      const write = async () => {
        const fingerprint=await this.semanticFingerprint(entries);
        try {
          const nextRevision = await this.withConnection(db => new Promise((resolve, reject) => {
            let tx;
            try { tx = db.transaction(['current','history'], 'readwrite'); }
            catch (error) { reject(error); return; }
            let failure, committedRevision;
            const request = tx.objectStore('current').get('active');
            request.onsuccess = () => {
              const current = request.result;
              if (Number(current?.revision || 0) !== this.revision) {
                failure = new Error('Another SK window saved newer data. Your unsaved changes are still visible. Export them, then reopen SK.');
                tx.abort(); return;
              }
              committedRevision = this.revision + 1;
              const createdAt = new Date().toISOString();
              const next = {id:'active', schema:1, revision:committedRevision, createdAt, entries, fingerprint,legacyFingerprint:this.legacyFingerprint};
              // Store meaningful restore points independently of the active record.
              const due = forceHistory || !current?.historyAt || fingerprint!==current.historyFingerprint && Date.now() - current.historyAt >= 15 * 60 * 1000;
              next.historyAt = pin || due ? Date.now() : current.historyAt;
              next.historyFingerprint=pin||due?fingerprint:current.historyFingerprint;
              const history = tx.objectStore('history'), additions=[];
              if(this.pendingLegacy){
                const id=`legacy:${createdAt}:${committedRevision}`;
                history.put({...next,id,entries:this.pendingLegacy,reason:'older-version-changes',pinned:true});
                additions.push({id,createdAt,revision:committedRevision,reason:'older-version-changes',pinned:true});
              }
              if (pin || due) {
                const id=`${createdAt}:${committedRevision}`;
                history.put({...next,id,reason,pinned:pin});
                additions.push({id,createdAt,revision:committedRevision,reason,pinned:pin});
              }
              // Keep a small index beside the active record. Older history
              // without index metadata remains untouched; loading every full
              // recipe snapshot with getAll() can crash iPhone's IDB service.
              const indexed = Array.isArray(current?.historyIndex) ? current.historyIndex.filter(item=>item?.id&&item?.createdAt) : [];
              const byId = new Map([...indexed,...additions].map(item=>[item.id,item]));
              const historyIndex=[...byId.values()],keep=historyToKeep(historyIndex);
              historyIndex.filter(item=>!keep.has(item.id)).forEach(item=>history.delete(item.id));
              next.historyIndex=historyIndex.filter(item=>keep.has(item.id));
              tx.objectStore('current').put(next);
            };
            tx.oncomplete = () => resolve(committedRevision);
            tx.onabort = () => reject(failure || tx.error || new Error('The kitchen could not be saved. Keep it open and export your changes.'));
            tx.onerror = () => {};
          }));
          this.revision = nextRevision;
          this.savedGeneration = generation;
          this.pendingLegacy=null;
          this.lastError = null;
          try{this.onSaved?.();}catch(error){console.warn('Save status display failed.',error);}
          return nextRevision;
        } catch (error) {
          this.queuedGeneration = -1;
          this.lastError = error;
          throw error;
        }
      };
      // Failed saves do not prevent a later explicit retry. Each transaction
      // stores a frozen full view, including pending sync operations.
      this.queue = this.queue.catch(() => {}).then(write).catch(error=>{this.queuedGeneration=-1;this.lastError=error;throw error;});
      return this.queue;
    }
    history() {
      return this.withConnection(db => new Promise((resolve,reject) => {
        const request=db.transaction('history','readonly').objectStore('history').getAll();
        request.onsuccess=()=>resolve(clone(request.result)); request.onerror=()=>reject(request.error);
      }));
    }
    close() { this.closed = true; this.connectionStale = true; this.db?.close(); }
  }
  window.SKDurableStorage = SKDurableStorage;
  window.KitchenMemoryStorage = KitchenMemoryStorage;
  window.SKHistoryToKeep = historyToKeep;
})();
