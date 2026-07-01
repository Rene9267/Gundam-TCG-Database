const CACHE_NAME = 'gundamdb-v2';
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

  // Cache-first for reference_cards.json (scarica solo 1 volta)
  if (url.pathname.endsWith('reference_cards.json')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Network-first per tutto il resto
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
