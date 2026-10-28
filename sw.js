// Offline support: serve the app shell from cache, refresh it in the background.
// Bump VERSION whenever app files change so phones pick up the update.
const CACHE_PREFIX = 'calc-';
const VERSION = `${CACHE_PREFIX}v8`;
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
  // cache: 'reload' skips the browser's HTTP cache (GitHub Pages allows 10 minutes), so a new
  // version never stores a mix of old and new files.
  const fresh = ASSETS.map((url) => new Request(url, { cache: 'reload' }));
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Other sites on the same github.io origin share this cache storage: only remove our own old versions.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Only the app's own files; live data such as exchange rates always goes to the network.
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true, cacheName: VERSION }).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
      if (cached === undefined) return network;
      // Serve the cached copy now; a failed background refresh (e.g. offline) is expected, not fatal.
      network.catch((err) => console.warn(`Background refresh of ${event.request.url} failed`, err));
      return cached;
    }),
  );
});
