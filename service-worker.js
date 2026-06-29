const CACHE_NAME = 'gundamdb-v1';
const IMG_CACHE = 'gundam-images-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './reference_cards.json'
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

  // Proxy for gundam-gcg.com card images
  // Il CDN non ha header CORS e Chrome blocca le richieste cross-site.
  // Con mode:'no-cors' otteniamo una risposta opaca che il tag <img> può
  // comunque renderizzare. credentials:'omit' evita i cookie cross-site.
  if (url.hostname === 'www.gundam-gcg.com' && url.pathname.includes('/images/cards/card/')) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request.url, {
            mode: 'no-cors',
            credentials: 'omit'
          }).then((res) => {
            cache.put(event.request, res.clone()).catch(() => {});
            return res;
          }).catch(() => {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="#f0f0f0"/><text x="150" y="200" text-anchor="middle" fill="#999" font-size="80" font-family="sans-serif">?</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          });
        })
      )
    );
    return;
  }

  // App assets: network-first, fallback su cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
