import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../../worker.js';

test('ads robots allows render resources while keeping the rest of the origin blocked', async () => {
  const response = await worker.fetch(new Request('https://ads.sorafiles.com/robots.txt'), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^text\/plain/);
  const body = await response.text();
  assert.match(body, /^Disallow: \/$/m);
  assert.match(body, /^Allow: \/ad-frame\/$/m);
});

test('worker never marks unhashed public assets immutable', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset', { headers: { 'Cache-Control': 'public,max-age=0,must-revalidate' } }) } };
  const response = await worker.fetch(new Request('https://sorafiles.com/favicon.png'), env);
  assert.doesNotMatch(response.headers.get('Cache-Control') ?? '', /immutable/i);
});

test('worker secures HTML while allowing native Cloudflare compression', async () => {
  const env = {
    ASSETS: {
      fetch: async () => new Response('<!doctype html><title>SoraFiles</title>', {
        headers: {
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'Content-Type': 'text/html',
        },
      }),
    },
  };
  const response = await worker.fetch(new Request('https://sorafiles.com/', { headers: { 'Accept-Encoding': 'identity' } }), env);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.match(response.headers.get('Content-Security-Policy') || '', /frame-ancestors 'none'/);
  assert.match(response.headers.get('Content-Security-Policy') || '', /object-src 'none'/);
  assert.match(response.headers.get('Permissions-Policy') || '', /camera=\(\)/);
  assert.doesNotMatch(response.headers.get('Cache-Control') || '', /(?:^|,)\s*no-transform\s*(?:,|$)/i);
  assert.doesNotMatch(await response.text(), /cloudflareinsights|beacon\.min\.js|data-cf-beacon/i);
});

test('worker removes stale no-transform directives from public HTML', async () => {
  const env = {
    ASSETS: {
      fetch: async () => new Response('<!doctype html><title>SoraFiles</title>', {
        headers: { 'Cache-Control': 'public, max-age=0, must-revalidate, no-transform', 'Content-Type': 'text/html' },
      }),
    },
  };
  const response = await worker.fetch(new Request('https://sorafiles.com/'), env);
  assert.equal(response.headers.get('Content-Encoding'), null);
  assert.doesNotMatch(response.headers.get('Cache-Control') || '', /no-transform/i);
  assert.match(await response.text(), /<title>SoraFiles<\/title>/);
});

test('canonical and www page responses advertise HSTS', async () => {
  const env = { ASSETS: { fetch: async () => new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }) } };
  const canonical = await worker.fetch(new Request('https://sorafiles.com/', { headers: { 'Accept-Encoding': 'identity' } }), env);
  const www = await worker.fetch(new Request('https://www.sorafiles.com/'), env);
  assert.equal(canonical.headers.get('Strict-Transport-Security'), 'max-age=31536000');
  assert.equal(www.status, 301);
  assert.equal(www.headers.get('Strict-Transport-Security'), 'max-age=31536000');
});

test('legacy index filenames permanently redirect to the canonical root', async () => {
  const env = { ASSETS: { fetch: async () => new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }) } };
  for (const suffix of ['index.html', 'index.htm', 'index.php']) {
    const response = await worker.fetch(new Request(`https://sorafiles.com/${suffix}`), env);
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('Location'), 'https://sorafiles.com/');
    assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000');
  }
});

test('completed Trustpilot HTML verification artifact remains unavailable', async () => {
  const env = { ASSETS: { fetch: async () => new Response('stale token') } };
  const response = await worker.fetch(new Request('https://sorafiles.com/012e83a8-ea3b-4e5f-984a-0b5e9d3bd7ad.html'), env);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(await response.text(), 'Not Found');
});

test('Ahrefs analytics uses one direct low-priority asynchronous head tag', async () => {
  const layout = await readFile('src/layouts/Layout.astro', 'utf8');
  assert.equal((layout.match(/https:\/\/analytics\.ahrefs\.com\/analytics\.js/g) || []).length, 1);
  assert.match(layout, /data-key="YJO4kDicTtFqaLaxSZH09Q"/);
  assert.match(layout, /\basync\b/);
  assert.match(layout, /fetchpriority="low"/);
  assert.doesNotMatch(layout, /GTM-[A-Z0-9]+/);
});

test('English open-source page keeps substantive, truthful content', async () => {
  const english = await readFile('src/i18n/en.ts', 'utf8');
  const pageStart = english.indexOf('openSource: {', english.indexOf('pages: {'));
  const pageEnd = english.indexOf('\n    contact:', pageStart);
  const openSourcePage = english.slice(pageStart, pageEnd);
  assert.notEqual(pageStart, -1);
  assert.match(openSourcePage, /Real, verifiable processing engines/);
  assert.match(openSourcePage, /Core libraries/);
  assert.match(openSourcePage, /How this supports local processing/);
  assert.match(openSourcePage, /Application source/);
  assert.match(openSourcePage, /github\.com\/Sora-Labs2026\/SoraFiles/);
  assert.match(openSourcePage, /AGPL-3\.0-only/);
  assert.doesNotMatch(openSourcePage, /sections:\s*\[\s*\]/);
});

test('isolated ad-frame HTML also disables Cloudflare analytics injection', async () => {
  const env = {
    ASSETS: {
      fetch: async () => new Response('<!doctype html><title>Advertisement</title>', {
        headers: { 'Content-Type': 'text/html' },
      }),
    },
  };
  const response = await worker.fetch(new Request('https://ads.sorafiles.com/ad-frame/mobile'), env);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(response.headers.get('Content-Security-Policy') || '', /frame-ancestors https:\/\/sorafiles\.com/);
  assert.equal(response.headers.get('X-Frame-Options'), null);
  assert.match(response.headers.get('Cache-Control') || '', /(?:^|,)\s*no-transform\s*(?:,|$)/i);
});

test('worker marks only allowlisted hashed Astro assets immutable when the recipe is active', async () => {
  const source = await readFile('worker.js', 'utf8');
  if (!source.includes('HASHED_ASTRO_ASSET')) return;
  const env = { ASSETS: { fetch: async () => new Response('asset', { headers: { 'Cache-Control': 'public,max-age=0,must-revalidate' } }) } };
  const hashed = await worker.fetch(new Request('https://sorafiles.com/_astro/Footer.BxnnQBGd.css'), env);
  assert.equal(hashed.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  const unhashed = await worker.fetch(new Request('https://sorafiles.com/_astro/Footer.css'), env);
  assert.doesNotMatch(unhashed.headers.get('Cache-Control') ?? '', /immutable/i);
});

test('service-worker runtime storage is explicitly bounded when v2 is active', async () => {
  const source = await readFile('public/sw.js', 'utf8');
  if (!source.includes('MAX_STATIC_ENTRIES = 80')) {
    assert.match(source, /sorafiles-local-v1/);
    return;
  }
  assert.match(source, /MAX_NAVIGATION_ENTRIES = 20/);
  assert.match(source, /MAX_STATIC_ENTRIES = 80/);
  assert.match(source, /if \(!isCacheableStatic\(url\)\) return/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /Quota denial or unavailable storage/);
  assert.doesNotMatch(source, /pathname\.startsWith\('\/ocr\/'\)/);
});
