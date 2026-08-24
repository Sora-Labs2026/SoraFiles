const CACHE_PREFIX = 'sorafiles-local-';
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const CORE = ['/', '/site.webmanifest', '/favicon-48x48.png', '/icon-192.png'];
const MAX_NAVIGATION_ENTRIES = 20;
const MAX_STATIC_ENTRIES = 80;

const isCacheableStatic = (url) =>
  url.pathname.startsWith('/_astro/') ||
  url.pathname.startsWith('/fonts/') ||
  /^\/(?:favicon(?:-[0-9]+x[0-9]+)?\.(?:png|ico)|icon-(?:192|512)\.png|apple-touch-icon\.png|site\.webmanifest)$/.test(url.pathname);

const trimCache = async (cache, maximum) => {
  const keys = await cache.keys();
  const overflow = keys.length - maximum;
  if (overflow > 0) await Promise.allSettled(keys.slice(0, overflow).map((request) => cache.delete(request)));
};

const store = async (request, response, maximum) => {
  if (!response.ok || response.type === 'opaque') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
    await trimCache(cache, maximum);
  } catch {
    // Quota denial or unavailable storage must never block a live response.
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(CORE.map((url) => cache.add(url)));
      await trimCache(cache, MAX_STATIC_ENTRIES);
    } finally {
      await self.skipWaiting();
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.allSettled(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        event.waitUntil(store(request, response, MAX_NAVIGATION_ENTRIES));
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  if (!isCacheableStatic(url)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    event.waitUntil(store(request, response, MAX_STATIC_ENTRIES));
    return response;
  })());
});
