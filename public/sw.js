const CACHE_PREFIX = 'sorafiles-local-';
const CACHE_NAME = `${CACHE_PREFIX}v5-static`;
const NAVIGATION_CACHE = `${CACHE_PREFIX}v5-pages`;
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

const store = async (request, response, maximum, name = CACHE_NAME) => {
  if (!response.ok || response.type === 'opaque' || /(?:no-store|private)/i.test(response.headers.get('Cache-Control') || '')) return;
  try {
    // Clone before yielding: respondWith may consume the original while caches.open awaits.
    const copy = response.clone();
    const cache = await caches.open(name);
    await cache.put(request, copy);
    await trimCache(cache, maximum);
  } catch {
    // Quota denial or unavailable storage must never block a live response.
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(CORE.filter(url => url !== '/').map((url) => cache.add(url)));
      const pages = await caches.open(NAVIGATION_CACHE);
      await pages.add('/').catch(() => {});
      await trimCache(cache, MAX_STATIC_ENTRIES);
    } finally {
      await self.skipWaiting();
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.allSettled(names.filter((name) => name.startsWith(CACHE_PREFIX) && ![CACHE_NAME, NAVIGATION_CACHE].includes(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.headers.has('range')) return;
  // License return URLs must never enter persistent navigation storage.
  if (/^\/desktop\/(?:purchase|redeem)(?:\/|\/index\.html)?$/.test(url.pathname) || url.searchParams.has('license_key')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        event.waitUntil(store(request, response, MAX_NAVIGATION_ENTRIES, NAVIGATION_CACHE));
        return response;
      } catch {
        const pages = await caches.open(NAVIGATION_CACHE);
        // A home page under another URL is misleading. Uncached routes stay unavailable offline.
        return (await pages.match(request)) || Response.error();
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
