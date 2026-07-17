const CACHE_NAME = 'kitchen-companion-v0.6.2';
const APP_SHELL = [
  './', './index.html', './styles.css?v=0.6.2', './kitchen-engine.js?v=0.6.2', './app.js?v=0.6.2',
  './app.webmanifest?v=0.6.2', './icon-180.png?v=0.6.2', './icon-192.png?v=0.6.2', './icon-512.png?v=0.6.2'
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
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request, { cache: 'no-store' });
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      return (await caches.match(event.request)) || (await caches.match('./index.html'));
    }
  })());
});
