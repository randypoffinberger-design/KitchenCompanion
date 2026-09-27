(() => {
  'use strict';

  const STORAGE_KEY = 'serenityKitchen.sync.v1';
  const COLLECTIONS = ['shopping-list', 'pantry', 'recipes', 'meal-plans'];
  const DEFAULT_SERVER = 'https://api.serenityvalleyworks.com/sk';
  const LEGACY_SERVERS = new Set(['https://pj.tail96598f.ts.net', 'https://randys.tail96598f.ts.net']);

  const clone = value => JSON.parse(JSON.stringify(value));
  const uuid = () => globalThis.crypto?.randomUUID?.() || `sync-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const stable = value => JSON.stringify(value, function (key, item) {
    return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item;
  });
  const recipeId = recipe => String(recipe?.id || recipe?.name || '').trim();

  class RecipeSync {
    constructor(client) { this.client = client; }
    load() {
      const c = this.client;
      const key = `serenityKitchen.recipeSync.v1:${c.serverUrl()}:${c.config.user?.id}:${c.config.activeHouseholdId}:${c.profileId}`;
      if (key !== this.storageKey) {
        const raw = localStorage.getItem(key);
        this.data = raw ? JSON.parse(raw) : { cursor:0, owners:{}, versions:{}, observed:{}, pending:{} };
        this.storageKey = key;
      }
      return this.data;
    }
    save() { localStorage.setItem(this.storageKey, JSON.stringify(this.data)); }
    stage(recipes) {
      const data = this.load();
      const identities = new Set();
      for (const recipe of recipes || []) {
        const id = recipeId(recipe);
        if (!id || id.length > 160 || ['__proto__','constructor','prototype'].includes(id)) throw new Error('A saved recipe has an invalid identity. Export it for review before syncing.');
        if (identities.has(id)) throw new Error('Two saved recipes have the same identity. Both local copies were kept; export them for review before syncing.');
        identities.add(id);
      }
      for (const recipe of recipes || []) {
        const id = recipeId(recipe);
        if (stable(data.observed[id]) === stable(recipe)) continue;
        const previous = data.pending[id];
        data.pending[id] = { id, mutationId:uuid(), baseVersion:previous ? previous.baseVersion : data.versions[id] || null, payload:clone(recipe) };
        data.observed[id] = clone(recipe);
      }
      // Missing IDs are never deletions. Device visibility stays in profile storage.
      this.save();
    }
    async sync(recipes) {
      const c = this.client, context = c.context();
      this.stage(recipes);
      const data = this.data, generation = c.changeGeneration;
      const owners = clone(data.owners), versions = { ...data.versions };
      let cursor = data.cursor, page;
      const route = `/api/v1/households/${encodeURIComponent(c.config.activeHouseholdId)}/recipe-sync`;
      do {
        page = await c.request(`${route}?since=${cursor}`, { method:'GET' }); c.assertContext(context);
        for (const event of page.events || []) {
          if (!event.id.startsWith('owner:') || !event.payload || event.deleted) continue;
          owners[event.id] = { id:event.id, ...event.payload };
          if (event.id === c.recipeOwnerId()) Object.assign(versions, event.versions || {});
        }
        const next = Number(page.cursor || cursor);
        if (page.hasMore && next <= cursor) throw new Error('Recipe history did not advance. Sync will retry safely.');
        cursor = next;
      } while (page.hasMore);
      const ownId = c.recipeOwnerId();
      const own = owners[ownId] || { id:ownId, ownerUserId:c.config.user.id, ownerDisplayName:c.config.user.displayName, personalRecipes:[] };
      owners[ownId] = own;
      const remote = new Map((own.personalRecipes || []).map(recipe => [recipeId(recipe), recipe]));
      // First-contact recipes with identical contents need no upload or conflict copy.
      for (const [id, pending] of Object.entries(data.pending)) {
        if (stable(remote.get(id)) === stable(pending.payload)) delete data.pending[id];
      }
      for (const operation of Object.values({ ...data.pending })) {
        let result;
        try { result = await c.request(route, { method:'POST', body:JSON.stringify({ changes:[operation] }) }); }
        catch (error) { if (error.status === 409 && error.body?.conflicts) result = error.body; else throw error; }
        c.assertContext(context);
        const pending = data.pending[operation.id];
        const applied = result.applied?.find(item => item.mutationId === operation.mutationId);
        if (applied) {
          remote.set(operation.id, operation.payload); versions[operation.id] = applied.version;
          if (pending?.mutationId === operation.mutationId) delete data.pending[operation.id];
          else if (pending) pending.baseVersion = applied.version;
        }
        const conflict = result.conflicts?.find(item => item.mutationId === operation.mutationId);
        if (conflict && pending) {
          // Retain the newer server recipe and a separately named local version.
          // The deterministic ID also makes recovery after an interrupted save safe.
          const copyId = `conflict-${pending.mutationId}`;
          const payload = { ...pending.payload, id:copyId, name:`${pending.payload.name || 'Recipe'} (conflict copy)`, conflictOf:operation.id };
          data.pending[copyId] = { id:copyId, mutationId:uuid(), baseVersion:null, payload };
          delete data.pending[operation.id];
          if (conflict.current) { remote.set(operation.id, conflict.current.payload); versions[operation.id] = conflict.current.version; }
          else remote.delete(operation.id);
          data.conflictNotice = true;
        }
        if (!applied && !conflict) throw new Error('The server did not acknowledge the recipe. Its pending change has been kept.');
        this.save();
      }
      if (generation !== c.changeGeneration) return false;
      own.personalRecipes = [...remote.values()];
      const visibleOwn = new Map(remote);
      Object.values(data.pending).forEach(operation => visibleOwn.set(operation.id, operation.payload));
      const localOwn = [...visibleOwn.values()];
      const ownerRecords = Object.values(owners).map(owner => owner.id === ownId ? { ...owner, personalRecipes:localOwn } : owner);
      c.assertContext(context);
      // An unchanged poll must not repeatedly save the profile or consume its
      // rolling safety checkpoints.
      if (!data.applied || stable(owners) !== stable(data.owners) || stable(localOwn) !== stable(recipes)) {
        c.onRemoteState({ recipes:{ ownerRecords } }, { recipeReconciled:true });
      }
      // Only consume history after the profile write succeeded.
      const previous = clone(data);
      Object.assign(data, { owners, versions, cursor, applied:true, observed:Object.fromEntries(localOwn.map(recipe => [recipeId(recipe), clone(recipe)])) });
      try { this.save(); } catch (error) { this.data = previous; throw error; }
      return Object.keys(data.pending).length === 0;
    }
  }

  class SKHouseholdSync {
    constructor(options = {}) {
      this.onRemoteState = options.onRemoteState || (() => {});
      this.confirmProfileBinding = options.confirmProfileBinding || (() => true);
      this.onStatus = options.onStatus || (() => {});
      this.profileId = options.profileId || '';
      this.timer = null;
      this.pushTimer = null;
      this.syncing = false;
      this.dirty = false;
      this.changeGeneration = 0;
      this.config = this.load();
      this.sessionEpoch = 0;
      this.recipeSync = new RecipeSync(this);
      if (this.config.user?.id && this.config.profileId) {
        this.config.profileAccounts[this.bindingKey(this.config.profileId)] ||= this.config.user.id;
      }
      this.dirty = !!this.config.pendingScopes[this.scopeKey()];
      if (LEGACY_SERVERS.has(String(this.config.serverUrl || '').replace(/\/+$/, ''))) {
        this.config.serverUrl = DEFAULT_SERVER;
        this.save();
      }
      if (this.config.recipeOwnershipVersion !== 2) {
        this.config.recipeOwnershipVersion = 2;
        this.config.recipeOwnershipMigrationComplete = false;
        Object.keys(this.config.cursors || {}).filter(key => key.endsWith(':recipes')).forEach(key => { this.config.cursors[key] = 0; });
        this.save();
      }
      this.ownershipMigrationPending = this.config.recipeOwnershipMigrationComplete !== true;
    }

    defaults() {
      return {
        serverUrl: DEFAULT_SERVER,
        token: '', expiresAt: '', user: null, households: [], activeHouseholdId: '',
        profileAccounts:{}, pendingScopes:{}, profileId: '', initializedHouseholds: {}, cursors: {}, revisions: {}, recipeOwnershipVersion:0, recipeOwnershipMigrationComplete:false, lastSyncAt: '', lastError: ''
      };
    }

    load() {
      try { return { ...this.defaults(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
      catch { return this.defaults(); }
    }

    save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config)); }
    serverUrl() { return String(this.config.serverUrl || DEFAULT_SERVER).replace(/\/+$/, ''); }
    isSignedIn() { return !!this.config.token && Date.parse(this.config.expiresAt || 0) > Date.now(); }
    activeHousehold() { return this.config.households.find(item => item.id === this.config.activeHouseholdId) || null; }
    bindingKey(profileId = this.profileId) { return this.serverUrl() + ':' + profileId; }
    scopeKey() { return this.serverUrl() + ':' + this.config.user?.id + ':' + this.config.activeHouseholdId + ':' + this.profileId; }
    context() { return this.sessionEpoch + ':' + this.scopeKey() + ':' + this.config.token; }
    assertContext(context) { if (context !== this.context()) throw Object.assign(new Error('Account or household changed. The old sync response was ignored.'), { staleContext:true }); }
    isProfileBound() { return (!this.config.profileId || this.config.profileId === this.profileId) && (!this.config.profileAccounts[this.bindingKey()] || this.config.profileAccounts[this.bindingKey()] === this.config.user?.id); }
    initializationKey() { return `${this.config.activeHouseholdId}:${this.profileId}`; }
    isReady() { return this.isSignedIn() && !!this.activeHousehold() && this.isProfileBound() && !!this.config.initializedHouseholds[this.initializationKey()]; }

    summary() {
      return {
        serverUrl:this.serverUrl(), signedIn:this.isSignedIn(), user:clone(this.config.user), households:clone(this.config.households),
        activeHousehold:clone(this.activeHousehold()), profileBound:this.isProfileBound(), initialized:!!this.config.initializedHouseholds[this.initializationKey()],
        lastSyncAt:this.config.lastSyncAt, lastError:this.config.lastError
      };
    }

    setServerUrl(value) {
      const parsed = new URL(String(value || '').trim());
      if (parsed.protocol !== 'https:' && parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') throw new Error('Use an HTTPS server address.');
      this.stop(); this.sessionEpoch += 1;
      this.config.serverUrl = parsed.origin + parsed.pathname.replace(/\/+$/, '');
      this.save();
    }

    async request(path, options = {}) {
      const context = this.context();
      const headers = { 'content-type':'application/json', ...(options.headers || {}) };
      if (this.config.token) headers.authorization = `Bearer ${this.config.token}`;
      let response;
      try { response = await fetch(`${this.serverUrl()}${path}`, { ...options, headers, cache:'no-store' }); }
      catch { throw new Error('The server could not be reached. Check your internet connection and try again.'); }
      const body = await response.json().catch(() => ({}));
      this.assertContext(context);
      if (!response.ok) {
        const error = new Error(body.error || `Server request failed (${response.status}).`);
        error.status = response.status; error.body = body; throw error;
      }
      return body;
    }

    async health(serverUrl) {
      if (serverUrl) this.setServerUrl(serverUrl);
      return this.request('/health', { method:'GET' });
    }

    async importRecipePage(url) {
      if (!this.isSignedIn()) throw new Error('Sign in to use server recipe importing.');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        return await this.request('/api/v1/recipes/import-url', { method:'POST', signal:controller.signal, body:JSON.stringify({ url }) });
      } catch (error) {
        if (controller.signal.aborted) throw new Error('The recipe server took too long to respond. Try again or use Paste recipe.');
        throw error;
      } finally { clearTimeout(timeout); }
    }

    async estimateNutrition(payload) {
      if (!this.isSignedIn()) throw new Error('Nutrition estimation is waiting for the private Serenity Kitchen server.');
      return this.request('/api/v1/recipes/estimate-nutrition', { method:'POST', body:JSON.stringify(payload) });
    }

    async register({ displayName, email, password }) {
      await this.request('/api/v1/auth/register', { method:'POST', body:JSON.stringify({ displayName, email, password }) });
      return this.login({ email, password });
    }

    async login({ email, password }) {
      this.stop(); this.sessionEpoch += 1;
      const result = await this.request('/api/v1/auth/login', { method:'POST', body:JSON.stringify({ email, password }) });
      const bound = this.config.profileAccounts[this.bindingKey()];
      if (bound && bound !== result.user.id) throw new Error('This local profile belongs to another account. Switch to a separate local profile before signing in.');
      if (!bound && !this.confirmProfileBinding(result.user)) throw new Error('Sign-in cancelled. Create or select a separate local profile to keep these recipes separate.');
      this.config.profileAccounts[this.bindingKey()] = result.user.id;
      this.config.token = result.token; this.config.expiresAt = result.expiresAt; this.config.user = result.user;
      this.config.profileId = this.profileId; this.config.lastError = ''; this.save();
      await this.refreshAccount(); this.dirty = !!this.config.pendingScopes[this.scopeKey()]; return this.summary();
    }

    async refreshAccount() {
      const result = await this.request('/api/v1/me', { method:'GET' });
      this.config.user = result.user; this.config.households = result.households || [];
      if (!this.config.households.some(item => item.id === this.config.activeHouseholdId)) this.config.activeHouseholdId = this.config.households[0]?.id || '';
      this.save(); return this.summary();
    }

    async logout() {
      const token = this.config.token, serverUrl = this.config.serverUrl;
      const { profileAccounts, pendingScopes, initializedHouseholds, cursors, revisions } = this.config;
      this.stop(); this.sessionEpoch += 1;
      this.config = { ...this.defaults(), serverUrl, profileAccounts, pendingScopes, initializedHouseholds, cursors, revisions };
      this.dirty = false; this.save(); this.emit('Signed out.', 'idle');
      try { if (token) await this.request('/api/v1/auth/logout', { method:'POST', headers:{ authorization:'Bearer '+token }, body:'{}' }); } catch {}
    }

    async createHousehold(name) {
      const result = await this.request('/api/v1/households', { method:'POST', body:JSON.stringify({ name }) });
      await this.refreshAccount(); this.config.activeHouseholdId = result.household.id; this.save(); return result.household;
    }

    async joinHousehold(code) {
      const result = await this.request('/api/v1/households/join', { method:'POST', body:JSON.stringify({ code:String(code || '').trim() }) });
      await this.refreshAccount(); this.config.activeHouseholdId = result.household.id; this.config.profileId = this.profileId; this.save(); return result.household;
    }

    async createInvite(role = 'adult') {
      const household = this.activeHousehold();
      if (!household) throw new Error('Choose a household first.');
      return this.request(`/api/v1/households/${encodeURIComponent(household.id)}/invites`, { method:'POST', body:JSON.stringify({ role }) });
    }

    selectHousehold(id) {
      if (!this.config.households.some(item => item.id === id)) throw new Error('Household not found.');
      this.stop(); this.sessionEpoch += 1;
      this.config.activeHouseholdId = id; this.config.profileId = this.profileId;
      this.dirty = !!this.config.pendingScopes[this.scopeKey()]; this.save();
    }

    key(collection, recordId = '') { return `${this.config.activeHouseholdId}:${collection}${recordId ? `:${recordId}` : ''}`; }
    recipeOwnerId() { return `owner:${this.config.user?.id || ''}`; }

    async fetchCollection(collection, since = 0) {
      const id = encodeURIComponent(this.config.activeHouseholdId);
      const context = this.context(), events = []; let cursor = Number(since) || 0, page;
      do {
        page = await this.request(`/api/v1/households/${id}/sync/${collection}?since=${cursor}`, { method:'GET' }); this.assertContext(context);
        events.push(...(page.events || []));
        const next = Number(page.cursor || cursor);
        if ((page.events || []).length >= 1000 && next <= cursor) throw new Error('Sync history did not advance.');
        cursor = next;
      } while ((page.events || []).length >= 1000);
      return { events, cursor };
    }

    async pushCollection(collection, payload, baseRevision = 0) {
      const context = this.context();
      if (collection === 'recipes') return this.recipeSync.sync(payload?.personalRecipes || []);
      const id = encodeURIComponent(this.config.activeHouseholdId);
      const recordId = 'shared-state';
      let result;
      try {
        result = await this.request(`/api/v1/households/${id}/sync/${collection}`, {
          method:'POST', body:JSON.stringify({ changes:[{ id:recordId, mutationId:uuid(), baseRevision, payload }] })
        });
      } catch (error) {
        const current = error.status === 409 ? error.body?.conflicts?.find(item => item.id === recordId)?.current : null;
        if (!current) throw error;
        result = await this.request(`/api/v1/households/${id}/sync/${collection}`, {
          method:'POST', body:JSON.stringify({ changes:[{ id:recordId, mutationId:uuid(), baseRevision:Number(current.revision || 0), payload }] })
        });
      }
      this.assertContext(context);
      const applied = result.applied?.[0];
      if (applied) {
        this.config.revisions[this.key(collection, recordId)] = applied.revision;
        // A write acknowledgement is not a read cursor: other members may have
        // written intervening events that this device has not downloaded yet.
      }
      return result;
    }

    async remoteSnapshot() {
      const context = this.context(), snapshot = {}, cursors = {}, revisions = {}; let hasData = false;
      for (const collection of COLLECTIONS) {
        const result = await this.fetchCollection(collection, 0);
        const events = result.events || [];
        if (collection === 'recipes') {
          const latestOwners = new Map();
          events.filter(item => item.id.startsWith('owner:')).forEach(item => latestOwners.set(item.id, item));
          const ownerRecords = [...latestOwners.values()].filter(item => !item.deleted && item.payload);
          if (ownerRecords.length) { snapshot.recipes = { ownerRecords:ownerRecords.map(item => ({ id:item.id, ...item.payload })) }; hasData = true; }
          ownerRecords.forEach(item => { if (item.id === this.recipeOwnerId()) revisions[this.key(collection, item.id)] = item.revision; });
        } else {
          const event = [...events].reverse().find(item => item.id === 'shared-state');
          if (event && !event.deleted && event.payload) {
            snapshot[collection] = event.payload; hasData = true;
            revisions[this.key(collection, 'shared-state')] = event.revision;
          }
        }
        cursors[this.key(collection)] = result.cursor || 0;
      }
      this.assertContext(context); return { snapshot, hasData, cursors, revisions };
    }

    async initialize(mode, localSnapshot) {
      if (!this.isSignedIn() || !this.activeHousehold()) throw new Error('Sign in and choose a household first.');
      if (!this.isProfileBound()) throw new Error('This profile belongs to another account.');
      const context = this.context();
      this.config.profileId = this.profileId;
      const remote = await this.remoteSnapshot();
      this.assertContext(context);
      if (mode === 'upload') {
        if (remote.hasData) throw new Error('This household already contains data. Download it first to prevent accidental replacement.');
        for (const collection of COLLECTIONS) await this.pushCollection(collection, localSnapshot[collection], 0);
      } else if (mode === 'download') {
        if (!remote.hasData) throw new Error('This household does not contain any shared data yet. Upload this device instead.');
        this.onRemoteState(remote.snapshot, { initial:true });
      } else throw new Error('Choose whether to upload or download the first household copy.');
      this.assertContext(context);
      Object.assign(this.config.cursors, remote.cursors || {}); Object.assign(this.config.revisions, remote.revisions || {});
      this.config.initializedHouseholds[this.initializationKey()] = true;
      this.config.lastSyncAt = new Date().toISOString(); this.config.lastError = ''; this.save(); this.start();
      this.emit('Household sync is active.', 'success');
    }

    markDirty() {
      if (!this.isReady()) return;
      this.dirty = true; this.changeGeneration += 1;
      this.config.pendingScopes[this.scopeKey()] = true; this.save();
      if (this.localSnapshotProvider) this.recipeSync.stage(this.localSnapshotProvider().recipes?.personalRecipes || []);
      clearTimeout(this.pushTimer);
      if (this.syncing) return;
      this.pushTimer = setTimeout(() => this.syncNow(this.localSnapshotProvider).catch(error => this.fail(error)), 900);
    }

    async pullUpdates() {
      const context = this.context(), updates = {};
      const generation = this.changeGeneration;
      const cursors = { ...this.config.cursors }, revisions = { ...this.config.revisions };
      for (const collection of COLLECTIONS.filter(name => name !== 'recipes')) {
        const key = this.key(collection); const result = await this.fetchCollection(collection, this.config.cursors[key] || 0);
        const events = result.events || [];
        if (collection === 'recipes') {
          const ownerEvents = new Map();
          events.filter(item => item.id.startsWith('owner:')).forEach(item => ownerEvents.set(item.id, item));
          if (ownerEvents.size) updates.recipes = { ownerRecords:[...ownerEvents.values()].filter(item => !item.deleted && item.payload).map(item => ({ id:item.id, ...item.payload })) };
          const own = ownerEvents.get(this.recipeOwnerId());
          if (own) revisions[this.key(collection, own.id)] = own.revision;
        } else {
          const event = [...events].reverse().find(item => item.id === 'shared-state');
          if (event) {
            revisions[this.key(collection, 'shared-state')] = event.revision;
            if (!event.deleted && event.payload) updates[collection] = event.payload;
          }
        }
        cursors[key] = result.cursor || this.config.cursors[key] || 0;
      }
      // Keep edits made while these requests were in flight. Consume the remote
      // events only after they have actually been applied and saved locally.
      this.assertContext(context);
      if (this.dirty || generation !== this.changeGeneration) return {};
      if (Object.keys(updates).length) this.onRemoteState(updates, { initial:false });
      this.config.cursors = cursors; this.config.revisions = revisions;
      return updates;
    }

    async syncNow(localSnapshotProvider) {
      if (!this.isReady() || this.syncing) return;
      const context = this.context();
      this.syncing = true; this.emit('Syncing household…', 'working');
      let completed = false, failure = null;
      try {
        const provider = localSnapshotProvider || this.localSnapshotProvider;
        if (this.dirty && provider) {
          const generation = this.changeGeneration, snapshot = provider();
          for (const collection of COLLECTIONS.filter(name => name !== 'recipes')) {
            try { await this.pushCollection(collection, snapshot[collection], this.config.revisions[this.key(collection, 'shared-state')] || 0); }
            catch (error) { failure ||= error; }
            this.assertContext(context);
          }
          if (!failure && generation === this.changeGeneration) {
            this.dirty = false; delete this.config.pendingScopes[this.scopeKey()]; this.save();
          }
        }
        // Recipe problems cannot prevent pantry, shopping, or meal-plan updates.
        if (!this.dirty) await this.pullUpdates();
        this.assertContext(context);
        if (provider) {
          try { await this.recipeSync.sync(provider().recipes?.personalRecipes || []); }
          catch (error) { failure ||= error; }
        }
        this.assertContext(context);
        if (failure) throw failure;
        completed = true;
        this.config.lastSyncAt = new Date().toISOString(); this.config.lastError = ''; this.save();
        const conflicts = this.recipeSync.data?.conflictNotice;
        this.emit(conflicts ? 'Both recipe versions were kept. Review recipes marked “conflict copy”.' : this.dirty ? 'Local changes are waiting to sync.' : 'Household is up to date.', conflicts ? 'warning' : 'success');
      } finally {
        this.syncing = false;
        if (context === this.context() && this.dirty) {
          clearTimeout(this.pushTimer);
          this.pushTimer = setTimeout(() => this.syncNow(this.localSnapshotProvider).catch(error => this.fail(error)), completed ? 100 : 5000);
        }
      }
    }

    start(localSnapshotProvider) {
      this.stop();
      if (!this.isReady()) return;
      this.localSnapshotProvider = localSnapshotProvider || this.localSnapshotProvider;
      const run = () => this.syncNow(this.localSnapshotProvider).catch(error => this.fail(error));
      this.timer = setInterval(run, 5000); run();
    }

    stop() { clearInterval(this.timer); clearTimeout(this.pushTimer); this.timer = null; this.pushTimer = null; }
    fail(error) { if (error.staleContext) return; this.config.lastError = error.message; this.save(); this.emit(error.message, 'error'); }
    emit(message, kind) { this.onStatus({ message, kind, summary:this.summary() }); }
  }

  window.SKHouseholdSync = SKHouseholdSync;
})();
