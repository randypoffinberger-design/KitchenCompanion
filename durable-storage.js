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
    static async open(legacy, indexedDB) {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('serenity-kitchen-durable', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('current', {keyPath:'id'});
          request.result.createObjectStore('history', {keyPath:'id'});
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Close other SK windows before opening the saved kitchen.'));
      });
      const backend = new SKDurableStorage(db);
      const current = await backend.readCurrent();
      const legacyEntries = {};
      for (let i=0;i<legacy.length;i++){const key=legacy.key(i);if(owned(key))legacyEntries[key]=legacy.getItem(key);}
      const legacyFingerprint=await backend.semanticFingerprint(legacyEntries);
      backend.legacyFingerprint=legacyFingerprint;
      if (current) {
        if (current.schema !== 1 || !current.entries || typeof current.revision !== 'number') {
          db.close(); throw new Error('The saved kitchen format needs recovery. No data was replaced.');
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
      db.onversionchange = () => { backend.closed = true; db.close(); };
      return backend;
    }
    constructor(db) { this.db = db; this.revision = 0; this.savedGeneration = -1; this.queue = Promise.resolve(); this.queuedGeneration = -1; }
    readCurrent() {
      return new Promise((resolve, reject) => {
        const request = this.db.transaction('current', 'readonly').objectStore('current').get('active');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
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
      if (this.closed) return Promise.reject(new Error('Saved kitchen connection closed. Export your changes and reopen SK.'));
      const generation = this.storage.generation;
      if (generation === this.queuedGeneration && !pin && !forceHistory) return this.queue;
      const entries = this.storage.snapshot();
      this.queuedGeneration = generation;
      const write = async () => {
       const fingerprint=await this.semanticFingerprint(entries);
       return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['current','history'], 'readwrite');
        let failure, nextRevision;
        const request = tx.objectStore('current').get('active');
        request.onsuccess = () => {
          const current = request.result;
          if (Number(current?.revision || 0) !== this.revision) {
            failure = new Error('Another SK window saved newer data. Your unsaved changes are still visible. Export them, then reopen SK.');
            tx.abort(); return;
          }
          nextRevision = this.revision + 1;
          const createdAt = new Date().toISOString();
          const next = {id:'active', schema:1, revision:nextRevision, createdAt, entries, fingerprint,legacyFingerprint:this.legacyFingerprint};
          // Store meaningful restore points independently of the active record.
          const due = forceHistory || !current?.historyAt || fingerprint!==current.historyFingerprint && Date.now() - current.historyAt >= 15 * 60 * 1000;
          next.historyAt = pin || due ? Date.now() : current.historyAt;
          next.historyFingerprint=pin||due?fingerprint:current.historyFingerprint;
          tx.objectStore('current').put(next);
          if(this.pendingLegacy)tx.objectStore('history').put({...next,id:`legacy:${createdAt}:${nextRevision}`,entries:this.pendingLegacy,reason:'older-version-changes',pinned:true});
          if (pin || due) {
            const store = tx.objectStore('history');
            store.put({...next, id:`${createdAt}:${nextRevision}`, reason, pinned:pin});
            const all = store.getAll();
            all.onsuccess = () => {const keep=historyToKeep(all.result);all.result.filter(item=>!keep.has(item.id)).forEach(item=>store.delete(item.id));};
          }
        };
        tx.oncomplete = () => { this.revision = nextRevision; this.savedGeneration = generation; this.pendingLegacy=null; this.lastError = null; try{this.onSaved?.();}catch(error){console.warn('Save status display failed.',error);} resolve(nextRevision); };
        tx.onabort = () => {
          this.queuedGeneration = -1;
          this.lastError = failure || tx.error || new Error('The kitchen could not be saved. Keep it open and export your changes.');
          reject(this.lastError);
        };
        tx.onerror = () => {};
      });
      };
      // Failed saves do not prevent a later explicit retry. Each transaction
      // stores a frozen full view, including pending sync operations.
      this.queue = this.queue.catch(() => {}).then(write).catch(error=>{this.queuedGeneration=-1;this.lastError=error;throw error;});
      return this.queue;
    }
    history() {
      return new Promise((resolve,reject) => {
        const request=this.db.transaction('history','readonly').objectStore('history').getAll();
        request.onsuccess=()=>resolve(clone(request.result)); request.onerror=()=>reject(request.error);
      });
    }
    close() { this.closed = true; this.db.close(); }
  }
  window.SKDurableStorage = SKDurableStorage;
  window.KitchenMemoryStorage = KitchenMemoryStorage;
  window.SKHistoryToKeep = historyToKeep;
})();
