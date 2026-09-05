// Brick and Banner service worker — the whole game is one HTML file, so offline
// support is a small cached shell. (GitHub Pages build: the game is index.html.)
//
// HTML requests are network-first (fresh when online, cached offline); static
// assets stay cache-first. CACHE is stamped with the bundle's content hash, so
// every build ships a new cache and 'activate' clears the old one.
const CACHE = 'cfb-dynasty-ab6db86387';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const isHTML = e.request.mode === 'navigate'
    || (e.request.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    // Network-first: online users always get the latest build; offline users
    // get the cached one. The successful fetch refreshes the cache.
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // B22 — assets/audio/ is CACHE-ON-FETCH, not addAll. The pool is ~25 MB of
  // MP3s that the app is designed to run without: it is never part of the
  // install, so a missing or slow file cannot break the offline shell. The
  // first time a clip is fetched (which only happens after a user gesture,
  // in the game viewer) the response is cloned into THIS build's cache, and
  // every later play — online or off — is served from it. Only a plain 200
  // is stored: the Cache API cannot hold a 206, which is why js/ui/music.js
  // fetches a blob rather than pointing an <audio src> at the URL.
  if (e.request.method === 'GET' && new URL(e.request.url).pathname.includes('/assets/audio/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res && res.ok && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    })));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
