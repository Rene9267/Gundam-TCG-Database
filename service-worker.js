const CACHE_NAME = 'gundamdb-v3';
const IMG_CACHE = 'gundam-images-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './reference_cards.json',
  './js/config.js',
  './js/state.js',
  './js/supabase.js',
  './js/utils.js',
  './js/cardtrader.js',
  './js/reference.js',
  './js/cards.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/collection.js',
  './js/sheet.js',
  './js/menu.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== IMG_CACHE).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first: images cached only if CORS-enabled
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      fetch(event.request).then((res) => {
        if (res.type === 'opaque') return res;
        cache.put(event.request, res.clone()).catch(() => {});
        return res;
      }).catch(() => caches.match(event.request))
    )
  );
});
