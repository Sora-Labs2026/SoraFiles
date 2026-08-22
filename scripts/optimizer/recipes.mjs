import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from './core.mjs';

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`${label}: expected source pattern was not found.`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`${label}: expected source pattern was not unique.`);
  return source.replace(search, replacement);
}

function replacePatternOnce(source, pattern, replacement, label) {
  const match = source.match(pattern);
  if (!match || match.index === undefined) throw new Error(`${label}: expected source pattern was not found.`);
  const remainder = source.slice(match.index + match[0].length);
  if (pattern.test(remainder)) throw new Error(`${label}: expected source pattern was not unique.`);
  return source.replace(pattern, replacement);
}

async function readTargets(targets) {
  return new Map(await Promise.all(targets.map(async (file) => [file, await readFile(path.join(projectRoot, file), 'utf8')])));
}

const boundedServiceWorker = `const CACHE_PREFIX = 'sorafiles-local-';
const CACHE_NAME = \`${'${CACHE_PREFIX}'}v2\`;
const CORE = ['/', '/site.webmanifest', '/favicon-48x48.png', '/icon-192.png'];
const MAX_NAVIGATION_ENTRIES = 20;
const MAX_STATIC_ENTRIES = 80;

const isCacheableStatic = (url) =>
  url.pathname.startsWith('/_astro/') ||
  url.pathname.startsWith('/fonts/') ||
  /^\\/(?:favicon(?:-[0-9]+x[0-9]+)?\\.(?:png|ico)|icon-(?:192|512)\\.png|apple-touch-icon\\.png|site\\.webmanifest)$/.test(url.pathname);

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
`;

export const recipes = Object.freeze({
  'canonical-locale-root': {
    id: 'canonical-locale-root',
    scope: 'technical-seo',
    targetPaths: ['src/i18n/config.ts', 'src/pages/sitemap.xml.ts', 'worker.js'],
    async transform() {
      const files = await readTargets(this.targetPaths);
      files.set('src/i18n/config.ts', replaceOnce(
        files.get('src/i18n/config.ts'),
        "  return clean === '/' ? `/${locale}/` : `/${locale}${clean}`;",
        "  return clean === '/' ? `/${locale}` : `/${locale}${clean}`;",
        this.id,
      ));
      files.set('src/pages/sitemap.xml.ts', replacePatternOnce(
        files.get('src/pages/sitemap.xml.ts'),
        /const lastmod = '\d{4}-\d{2}-\d{2}';/,
        `const lastmod = '${new Date().toISOString().slice(0, 10)}';`,
        this.id,
      ));
      files.set('worker.js', replacePatternOnce(
        files.get('worker.js'),
        /asset-version', '\d{4}-\d{2}-\d{2}-[a-z0-9-]+'/,
        `asset-version', '${new Date().toISOString().slice(0, 10)}-canonical-1'`,
        this.id,
      ));
      return files;
    },
    evidence(before, after) {
      if (before.trailingSlashCanonicals < 1 || after.trailingSlashCanonicals !== 0) throw new Error('Canonical proof did not eliminate redirecting locale-root canonicals.');
      return { gate: 'seo-validator', before: before.trailingSlashCanonicals, after: after.trailingSlashCanonicals, unit: 'count', noteCode: 'canonical-redirects-eliminated' };
    },
  },
  'immutable-astro-cache': {
    id: 'immutable-astro-cache',
    scope: 'performance',
    targetPaths: ['worker.js'],
    async transform() {
      const files = await readTargets(this.targetPaths);
      let worker = files.get('worker.js');
      worker = replaceOnce(
        worker,
        "const REMOVED_AD_PATHS = new Set(['/ads.txt', '/bbd8dc6c771660df9481.txt']);",
        "const REMOVED_AD_PATHS = new Set(['/ads.txt', '/bbd8dc6c771660df9481.txt']);\nconst HASHED_ASTRO_ASSET = /^\\/_astro\\/[^/?]+\\.[A-Za-z0-9_-]{8,}\\.(?:css|js|mjs|woff2?)$/i;",
        this.id,
      );
      worker = replaceOnce(
        worker,
        "    if (url.pathname === '/sitemap.xml' || url.pathname === '/robots.txt') {",
        "    if (HASHED_ASTRO_ASSET.test(url.pathname)) {\n      const response = await env.ASSETS.fetch(request);\n      const headers = new Headers(response.headers);\n      headers.set('Cache-Control', 'public, max-age=31536000, immutable');\n      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });\n    }\n\n    if (url.pathname === '/sitemap.xml' || url.pathname === '/robots.txt') {",
        this.id,
      );
      files.set('worker.js', worker);
      return files;
    },
    evidence() {
      return { gate: 'worker-contract', before: 0, after: 1, unit: 'boolean', noteCode: 'hashed-assets-immutable' };
    },
  },
  'bounded-service-worker-cache': {
    id: 'bounded-service-worker-cache',
    scope: 'resilience',
    targetPaths: ['public/sw.js'],
    async transform() {
      const files = await readTargets(this.targetPaths);
      if (!files.get('public/sw.js').includes("const CACHE_NAME = 'sorafiles-local-v1';")) throw new Error(`${this.id}: source is not the audited v1 service worker.`);
      files.set('public/sw.js', boundedServiceWorker);
      return files;
    },
    evidence() {
      return { gate: 'service-worker-contract', before: 0, after: 1, unit: 'boolean', noteCode: 'runtime-cache-bounded' };
    },
  },
  'storage-denial-safety': {
    id: 'storage-denial-safety',
    scope: 'resilience',
    targetPaths: ['src/layouts/Layout.astro', 'src/components/Header.astro'],
    async transform() {
      const files = await readTargets(this.targetPaths);
      let layout = files.get('src/layouts/Layout.astro');
      layout = replaceOnce(
        layout,
        `      const getThemePreference = () => {
        const savedTheme = localStorage.getItem('sora-theme');
        return validThemes.includes(savedTheme) ? savedTheme : 'light';
      };`,
        `      const getThemePreference = () => {
        try {
          const savedTheme = localStorage.getItem('sora-theme');
          return validThemes.includes(savedTheme) ? savedTheme : 'light';
        } catch {
          return 'light';
        }
      };

      const saveThemePreference = (preference) => {
        try { localStorage.setItem('sora-theme', preference); } catch {}
      };`,
        this.id,
      );
      layout = replaceOnce(layout, "            localStorage.setItem('sora-theme', choice);", "            saveThemePreference(choice);", this.id);
      files.set('src/layouts/Layout.astro', layout);
      files.set('src/components/Header.astro', replaceOnce(
        files.get('src/components/Header.astro'),
        "    localStorage.setItem('sora-theme', theme);",
        "    try { localStorage.setItem('sora-theme', theme); } catch {}",
        this.id,
      ));
      return files;
    },
    evidence() {
      return { gate: 'storage-stress', before: 0, after: 1, unit: 'boolean', noteCode: 'storage-denial-contained' };
    },
  },
  'workbench-overflow-containment': {
    id: 'workbench-overflow-containment',
    scope: 'resilience',
    targetPaths: ['src/components/DocumentActionWorkbench.astro'],
    async transform() {
      const files = await readTargets(this.targetPaths);
      let workbench = files.get('src/components/DocumentActionWorkbench.astro');
      workbench = replaceOnce(workbench, 'id="action-work" hidden class="grid lg:grid-cols-[1fr_0.85fr]"', 'id="action-work" hidden class="grid min-w-0 lg:grid-cols-[1fr_0.85fr]"', this.id);
      workbench = replaceOnce(workbench, 'class="border-b border-line p-5 sm:p-7 lg:border-b-0 lg:border-r"', 'class="min-w-0 border-b border-line p-5 sm:p-7 lg:border-b-0 lg:border-r"', this.id);
      workbench = replaceOnce(workbench, 'id="action-form" class="p-5 sm:p-7"', 'id="action-form" class="min-w-0 p-5 sm:p-7"', this.id);
      files.set('src/components/DocumentActionWorkbench.astro', workbench);
      return files;
    },
    evidence() {
      return { gate: 'input-stress', before: 0, after: 1, unit: 'boolean', noteCode: 'workbench-overflow-contained' };
    },
  },
});

export function getRecipe(id) {
  const recipe = recipes[id];
  if (!recipe) throw new Error(`Unknown or non-allowlisted recipe: ${id}.`);
  return recipe;
}
