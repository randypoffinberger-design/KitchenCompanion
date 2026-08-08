(() => {
  'use strict';

  const STORAGE_KEY = 'serenityKitchen.sync.v1';
  const COLLECTIONS = ['shopping-list', 'pantry', 'recipes', 'meal-plans'];
  const DEFAULT_SERVER = 'https://pj.tail96598f.ts.net';

  const clone = value => JSON.parse(JSON.stringify(value));
  const uuid = () => globalThis.crypto?.randomUUID?.() || `sync-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  class SKHouseholdSync {
    constructor(options = {}) {
      this.onRemoteState = options.onRemoteState || (() => {});
      this.onStatus = options.onStatus || (() => {});
      this.profileId = options.profileId || '';
      this.timer = null;
      this.pushTimer = null;
      this.syncing = false;
      this.dirty = false;
      this.config = this.load();
    }

    defaults() {
      return {
        serverUrl: DEFAULT_SERVER,
        token: '', expiresAt: '', user: null, households: [], activeHouseholdId: '',
        profileId: '', initializedHouseholds: {}, cursors: {}, revisions: {}, lastSyncAt: '', lastError: ''
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
    isProfileBound() { return !this.config.profileId || this.config.profileId === this.profileId; }
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
      if (parsed.protocol !== 'https:' && parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') throw new Error('Use the private HTTPS server address.');
      this.config.serverUrl = parsed.origin;
      this.save();
    }

    async request(path, options = {}) {
      const headers = { 'content-type':'application/json', ...(options.headers || {}) };
      if (this.config.token) headers.authorization = `Bearer ${this.config.token}`;
      let response;
      try { response = await fetch(`${this.serverUrl()}${path}`, { ...options, headers, cache:'no-store' }); }
      catch { throw new Error('The private server could not be reached. Check Tailscale and the server laptop.'); }
      const body = await response.json().catch(() => ({}));
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

    async register({ displayName, email, password }) {
      await this.request('/api/v1/auth/register', { method:'POST', body:JSON.stringify({ displayName, email, password }) });
      return this.login({ email, password });
    }

    async login({ email, password }) {
      const result = await this.request('/api/v1/auth/login', { method:'POST', body:JSON.stringify({ email, password }) });
      this.config.token = result.token; this.config.expiresAt = result.expiresAt; this.config.user = result.user;
      this.config.profileId = this.profileId; this.config.lastError = ''; this.save();
      await this.refreshAccount(); return this.summary();
    }

    async refreshAccount() {
      const result = await this.request('/api/v1/me', { method:'GET' });
      this.config.user = result.user; this.config.households = result.households || [];
      if (!this.config.households.some(item => item.id === this.config.activeHouseholdId)) this.config.activeHouseholdId = this.config.households[0]?.id || '';
      this.save(); return this.summary();
    }

    async logout() {
      try { if (this.config.token) await this.request('/api/v1/auth/logout', { method:'POST', body:'{}' }); } catch {}
      const serverUrl = this.config.serverUrl;
      this.stop(); this.config = { ...this.defaults(), serverUrl }; this.save(); this.emit('Signed out.', 'idle');
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
      this.config.activeHouseholdId = id; this.config.profileId = this.profileId; this.save(); this.stop();
    }

    key(collection) { return `${this.config.activeHouseholdId}:${collection}`; }

    async fetchCollection(collection, since = 0) {
      const id = encodeURIComponent(this.config.activeHouseholdId);
      return this.request(`/api/v1/households/${id}/sync/${collection}?since=${Number(since) || 0}`, { method:'GET' });
    }

    async pushCollection(collection, payload, baseRevision = 0) {
      const id = encodeURIComponent(this.config.activeHouseholdId);
      const result = await this.request(`/api/v1/households/${id}/sync/${collection}`, {
        method:'POST', body:JSON.stringify({ changes:[{ id:'shared-state', mutationId:uuid(), baseRevision, payload }] })
      });
      const applied = result.applied?.[0];
      if (applied) {
        this.config.revisions[this.key(collection)] = applied.revision;
        this.config.cursors[this.key(collection)] = Math.max(Number(this.config.cursors[this.key(collection)] || 0), Number(applied.eventId || 0));
      }
      return result;
    }

    async remoteSnapshot() {
      const snapshot = {}; let hasData = false;
      for (const collection of COLLECTIONS) {
        const result = await this.fetchCollection(collection, 0);
        const event = [...(result.events || [])].reverse().find(item => item.id === 'shared-state');
        if (event && !event.deleted && event.payload) {
          snapshot[collection] = event.payload; hasData = true;
          this.config.revisions[this.key(collection)] = event.revision;
        }
        this.config.cursors[this.key(collection)] = result.cursor || 0;
      }
      this.save(); return { snapshot, hasData };
    }

    async initialize(mode, localSnapshot) {
      if (!this.isSignedIn() || !this.activeHousehold()) throw new Error('Sign in and choose a household first.');
      this.config.profileId = this.profileId;
      const remote = await this.remoteSnapshot();
      if (mode === 'upload') {
        if (remote.hasData) throw new Error('This household already contains data. Download it first to prevent accidental replacement.');
        for (const collection of COLLECTIONS) await this.pushCollection(collection, localSnapshot[collection], 0);
      } else if (mode === 'download') {
        if (!remote.hasData) throw new Error('This household does not contain any shared data yet. Upload this device instead.');
        this.onRemoteState(remote.snapshot, { initial:true });
      } else throw new Error('Choose whether to upload or download the first household copy.');
      this.config.initializedHouseholds[this.initializationKey()] = true;
      this.config.lastSyncAt = new Date().toISOString(); this.config.lastError = ''; this.save(); this.start();
      this.emit('Household sync is active.', 'success');
    }

    markDirty() {
      if (!this.isReady() || this.syncing) return;
      this.dirty = true; clearTimeout(this.pushTimer);
      this.pushTimer = setTimeout(() => this.syncNow(this.localSnapshotProvider).catch(error => this.fail(error)), 900);
    }

    async pullUpdates() {
      const updates = {};
      for (const collection of COLLECTIONS) {
        const key = this.key(collection); const result = await this.fetchCollection(collection, this.config.cursors[key] || 0);
        const event = [...(result.events || [])].reverse().find(item => item.id === 'shared-state');
        if (event) {
          this.config.revisions[key] = event.revision;
          if (!event.deleted && event.payload) updates[collection] = event.payload;
        }
        this.config.cursors[key] = result.cursor || this.config.cursors[key] || 0;
      }
      if (Object.keys(updates).length) this.onRemoteState(updates, { initial:false });
      return updates;
    }

    async syncNow(localSnapshotProvider) {
      if (!this.isReady() || this.syncing) return;
      this.syncing = true; this.emit('Syncing household…', 'working');
      try {
        if (this.dirty && localSnapshotProvider) {
          const snapshot = localSnapshotProvider();
          for (const collection of COLLECTIONS) await this.pushCollection(collection, snapshot[collection], this.config.revisions[this.key(collection)] || 0);
          this.dirty = false;
        }
        await this.pullUpdates();
        this.config.lastSyncAt = new Date().toISOString(); this.config.lastError = ''; this.save(); this.emit('Household is up to date.', 'success');
      } finally { this.syncing = false; }
    }

    start(localSnapshotProvider) {
      this.stop();
      if (!this.isReady()) return;
      this.localSnapshotProvider = localSnapshotProvider || this.localSnapshotProvider;
      const run = () => this.syncNow(this.localSnapshotProvider).catch(error => this.fail(error));
      this.timer = setInterval(run, 5000); run();
    }

    stop() { clearInterval(this.timer); clearTimeout(this.pushTimer); this.timer = null; this.pushTimer = null; }
    fail(error) { this.config.lastError = error.message; this.save(); this.emit(error.message, 'error'); }
    emit(message, kind) { this.onStatus({ message, kind, summary:this.summary() }); }
  }

  window.SKHouseholdSync = SKHouseholdSync;
})();
