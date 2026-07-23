const CACHE_NAME = 'kitchen-companion-v0.10.2';
const APP_SHELL = [
  './', './index.html', './styles.css?v=0.10.2', './kitchen-engine.js?v=0.10.2', './profile-storage.js?v=0.10.2', './app.js?v=0.10.2',
  './ocr-service.js?v=0.10.2', './alarm-bell.wav?v=0.10.2', './app.webmanifest?v=0.10.2', './icon-180.png?v=0.10.2', './icon-192.png?v=0.10.2', './icon-512.png?v=0.10.2'
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
    try {
      const response = await fetch(event.request, { cache: 'no-store' });
      if (response && response.ok && (url.origin === self.location.origin || ['script','worker','wasm'].includes(event.request.destination))) {
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
