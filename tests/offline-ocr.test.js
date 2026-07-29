const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const listeners = {};
const stores = new Map();

function cacheFor(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  const store = stores.get(name);
  return {
    async addAll(requests) {
      for (const request of requests) store.set(new URL(request, 'https://example.test/kc/').href, new Response('app'));
    },
    async match(request) {
      const url = typeof request === 'string' ? request : request.url;
      return store.get(url);
    },
    async put(request, response) {
      const url = typeof request === 'string' ? request : request.url;
      store.set(url, response);
    }
  };
}

const context = {
  console,
  URL,
  Request,
  Response,
  fetch: async request => new Response(`asset:${request.url}`, { status:200 }),
  caches: {
    open: async name => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    match: async request => {
      for (const name of stores.keys()) {
        const found = await cacheFor(name).match(request);
        if (found) return found;
      }
    }
  },
  self: {
    registration: { scope:'https://example.test/kc/' },
    location: { origin:'https://example.test' },
    clients: { claim: async () => {} },
    skipWaiting() {},
    addEventListener(type, handler) { listeners[type] = handler; }
  }
};

vm.runInNewContext(fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8'), context);

async function runLifecycle(type) {
  let promise;
  listeners[type]({ waitUntil(value) { promise = value; } });
  await promise;
}

(async () => {
  await runLifecycle('install');
  const ocrName = [...stores.keys()].find(name => name.includes('ocr-tesseract'));
  assert.ok(ocrName, 'stable OCR cache was not created');
  assert.equal(stores.get(ocrName).size, 6, 'all OCR runtime assets must be cached');

  stores.set('kitchen-companion-v-old', new Map());
  await runLifecycle('activate');
  assert.ok(stores.has(ocrName), 'normal app activation must preserve the OCR cache');
  assert.ok(!stores.has('kitchen-companion-v-old'), 'obsolete app cache should still be removed');

  const ocrService = fs.readFileSync(path.join(root, 'ocr-service.js'), 'utf8');
  assert.match(ocrService, /vendor\/tesseract-7[.]0[.]0/);
  assert.doesNotMatch(ocrService, /cdn[.]jsdelivr[.]net/);
  console.log('Offline OCR cache regression passed: six local assets survive app activation.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
