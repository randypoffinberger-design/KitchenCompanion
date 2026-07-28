const CACHE_NAME = 'kitchen-companion-v0.16.9';
const APP_SHELL = [
  './', './index.html', './styles.css?v=0.16.9', './kitchen-engine.js?v=0.16.9', './profile-storage.js?v=0.16.9', './app.js?v=0.16.9',
  './ocr-service.js?v=0.16.9', './alarm-bell.wav?v=0.16.9', './app.webmanifest?v=0.16.9', './icon-180.png?v=0.16.9', './icon-192.png?v=0.16.9', './icon-512.png?v=0.16.9'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
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

    const cacheFirst = url.origin === self.location.origin
      || url.hostname === 'cdn.jsdelivr.net';
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
