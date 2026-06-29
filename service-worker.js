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
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== IMG_CACHE).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Proxy for gundam-gcg.com card images — CDN non supporta CORS,
  // usiamo {mode:'no-cors'} per ottenere una risposta "opaca"
  // che funziona comunque con i tag <img> della pagina.
  if (url.hostname === 'www.gundam-gcg.com' && url.pathname.includes('/images/cards/card/')) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request.url, {
            mode: 'no-cors',
            credentials: 'omit'
          }).then((res) => {
            cache.put(event.request, res.clone());
            return res;
          }).catch(() => {
            // Se la fetch fallisce, ritorna la placeholder locale
            return fetch('./icons/icon-192.png');
          });
        })
      )
    );
    return;
  }

  // Normal cache-first for app assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
