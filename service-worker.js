const CACHE_NAME = 'serenity-kitchen-v0.20.4';
const OCR_CACHE_NAME = 'kitchen-companion-ocr-tesseract-7.0.0-best-int';
const APP_SHELL = [
  './', './index.html', './styles.css?v=0.20.4', './kitchen-engine.js?v=0.20.4', './profile-storage.js?v=0.20.4', './meal-planner.js?v=0.20.4', './app.js?v=0.20.4',
  './url-recipe-import.js?v=0.20.4', './ocr-service.js?v=0.20.4', './alarm-bell.wav?v=0.20.4', './app.webmanifest?v=0.20.4', './icon-180.png?v=0.20.4', './icon-192.png?v=0.20.4', './icon-512.png?v=0.20.4', './serenity-kitchen-icon-1024.png?v=0.20.4', './serenity-kitchen-home.jpeg?v=0.20.4', './sk-watermark.png?v=0.20.4'
];
const OCR_ASSETS = [
  './Vendor/tesseract-7.0.0/tesseract.min.js',
  './Vendor/tesseract-7.0.0/worker.min.js',
  './Vendor/tesseract-7.0.0/core/tesseract-core-lstm.wasm.js',
  './Vendor/tesseract-7.0.0/core/tesseract-core-simd-lstm.wasm.js',
  './Vendor/tesseract-7.0.0/core/tesseract-core-relaxedsimd-lstm.wasm.js',
  './Vendor/tesseract-7.0.0/lang/eng.traineddata.gz'
];

async function installOfflineOcr() {
  const cache = await caches.open(OCR_CACHE_NAME);
  for (const asset of OCR_ASSETS) {
    const request = new Request(new URL(asset, self.registration.scope).href);
    if (await cache.match(request)) continue;
    const response = await fetch(request, { cache:'no-store' });
    if (!response.ok) throw new Error(`Offline OCR asset failed: ${asset}`);
    await cache.put(request, response);
  }
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(Promise.all([
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)),
    installOfflineOcr().catch(error => console.warn('Offline OCR will finish on demand.', error))
  ]));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME && key !== OCR_CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  event.respondWith((async () => {
    const isCatalogRequest = url.origin === self.location.origin && url.pathname.endsWith('/catalog.json');
    if (isCatalogRequest) {
      const cache = await caches.open(CACHE_NAME);
      const canonicalRequest = new Request(`${self.registration.scope}catalog.json`);
      try {
        const response = await fetch(event.request, { cache:'no-store' });
        if (response?.ok) {
          await cache.put(canonicalRequest, response.clone());
          return response;
        }
        const cachedCatalog = await cache.match(canonicalRequest);
        if (cachedCatalog) return cachedCatalog;
        return response;
      } catch (error) {
        const cachedCatalog = await cache.match(canonicalRequest);
        if (cachedCatalog) return cachedCatalog;
        return new Response(JSON.stringify({ error:'catalog-unavailable' }), {
          status:503,
          headers:{ 'Content-Type':'application/json', 'Cache-Control':'no-store' }
        });
      }
    }

    if (event.request.mode === 'navigate') {
      const cachedPage = await caches.match('./index.html') || await caches.match('./');
      if (cachedPage) return cachedPage;
    }

    const cacheFirst = url.origin === self.location.origin;
    if (cacheFirst) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
    }

    try {
      const response = await fetch(event.request, { cache: 'no-store' });
      if (response && (response.ok || response.type === 'opaque') && cacheFirst) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      throw error;
    }
  })());
});
