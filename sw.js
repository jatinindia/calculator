// Offline support: serve the app shell from cache, refresh it in the background.
// Bump VERSION whenever app files change so phones pick up the update.
const VERSION = 'calc-v6';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'calc.js',
  'editor.js',
  'convert.js',
  'history.js',
  'tools.js',
  'graph.js',
  'graph-view.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Only the app's own files; live data such as exchange rates always goes to the network.
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
      return cached ?? network;
    }),
  );
});
