const CACHE_NAME = 'gundamdb-v8';
const IMG_CACHE = 'gundam-images-v2';
const R2_HOST = 'pub-f106953afafa4b379122130a0f038335.r2.dev';
const IMG_CACHE_MAX = 200;

const PRECACHE_URLS = [
  './',
  './index.html',
  './dist/tailwind.css',
  './style.css',
  './manifest.json',
  './reference/index.json',
  './js/config.js',
  './js/state.js',
  './js/supabase.js',
  './js/utils.js',
  './js/ui-progress.js',
  './js/cardtrader.js',
  './js/reference.js',
  './js/cards.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/collection-filters.js',
  './js/collection-overview.js',
  './js/collection-grid.js',
  './js/collection-stats.js',
  './js/sheet.js',
  './js/menu.js',
  './js/app.js',
];

function isApiRequest(url) {
  return url.hostname.includes('supabase.co');
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname;
  return p.endsWith('.js') || p.endsWith('.css') || p.endsWith('.json') ||
    p.endsWith('.html') || p === '/' || p.endsWith('/');
}

function isR2Image(url) {
  return url.hostname === R2_HOST && url.pathname.endsWith('.webp');
}

async function trimImageCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMG_CACHE_MAX) return;
  const excess = keys.length - IMG_CACHE_MAX;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

async function cacheFirstImage(request) {
  const cache = await caches.open(IMG_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) {
      cache.put(request, res.clone()).catch(() => {});
      trimImageCache(cache).catch(() => {});
    }
    return res;
  } catch (_) {
    const fallback = await cache.match(request);
    if (fallback) return fallback;
    throw _;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request).then((res) => {
    if (res.ok && res.type !== 'opaque') {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => null);
  return cached || network || fetch(request);
}

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
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (isApiRequest(url)) return;

  if (isR2Image(url)) {
    event.respondWith(cacheFirstImage(event.request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
