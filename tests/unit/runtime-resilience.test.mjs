import test from 'node:test';
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import worker from '../../worker.js';

const listAstroFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listAstroFiles(path) : path.endsWith('.astro') ? [path] : [];
  }));
  return nested.flat();
};

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
  assert.match(response.headers.get('Permissions-Policy') || '', /camera=\(self\)/);
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

test('tool preview CTA is crawlable before client enhancement', async () => {
  const source = await readFile('src/components/ToolPeekModal.astro', 'utf8');
  assert.match(source, /const initialOpenToolHref = payload\[0\]\?\.href \?\? localizedPath\(locale, '\/'\);/);
  assert.match(source, /<a href=\{initialOpenToolHref\} data-peek-open/);
});

test('every first-party Astro image declares alt semantics', async () => {
  const files = await listAstroFiles('src');
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const tag of source.match(/<img\b[^>]*>/gs) ?? []) {
      assert.match(tag, /\balt\s*=/, `${file} contains an img without an alt attribute`);
    }
  }
});

test('homepage metadata and decorative brand marks satisfy the Part 14 contract', async () => {
  const index = await readFile('src/pages/index.astro', 'utf8');
  const description = index.match(/const description = '([^']+)'/)?.[1] ?? '';
  assert.ok(description.length >= 120 && description.length <= 160, `homepage description length is ${description.length}`);
  assert.match(description, /process files locally in your browser/i);

  for (const file of ['src/components/Header.astro', 'src/components/Footer.astro']) {
    const source = await readFile(file, 'utf8');
    assert.match(source, /aria-hidden="true"[^>]+background-image: url\('\/favicon-48x48\.png'\)/);
    assert.doesNotMatch(source, /<img[^>]+favicon-48x48\.png/);
  }
});

test('Ahrefs analytics uses one direct low-priority asynchronous head tag', async () => {
  const layout = await readFile('src/layouts/Layout.astro', 'utf8');
  assert.equal((layout.match(/https:\/\/analytics\.ahrefs\.com\/analytics\.js/g) || []).length, 1);
  assert.match(layout, /data-key="YJO4kDicTtFqaLaxSZH09Q"/);
  assert.match(layout, /\basync\b/);
  assert.match(layout, /fetchpriority="low"/);
  assert.doesNotMatch(layout, /GTM-[A-Z0-9]+/);
});

test('Google Analytics runtime and measurement ID stay removed', async () => {
  const layout = await readFile('src/layouts/Layout.astro', 'utf8');
  await assert.rejects(access('src/components/GoogleServices.astro', constants.F_OK));
  assert.doesNotMatch(layout, /GoogleServices|googletagmanager|google-analytics|G-GQ973RY74K|\bgtag\s*\(/i);
  for (const path of ['dist/index.html', 'dist/privacy/index.html', 'dist/ja/index.html']) {
    const html = await readFile(path, 'utf8');
    assert.doesNotMatch(html, /googletagmanager|google-analytics|G-GQ973RY74K|data-sf-google-analytics|\bgtag\s*\(/i, path);
  }
});

test('localized home metadata uses the reviewed native catalog instead of visual hero fragments', async () => {
  const route = await readFile('src/pages/[locale]/[...path].astro', 'utf8');
  assert.match(route, /const title = isHome \? content\.home\.title/);
  assert.match(route, /const description = isHome \? content\.home\.description/);
  assert.doesNotMatch(route, /isHome \? `SoraFiles — \$\{liveText\(locale, 'hero\.l1b'\)\}/);
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

test('legacy preview hubs permanently redirect to localized tools hubs', async () => {
  const env = { ASSETS: { fetch: async () => new Response('not used') } };
  const english = await worker.fetch(new Request('https://sorafiles.com/preview'), env);
  const japanese = await worker.fetch(new Request('https://sorafiles.com/ja/preview/'), env);
  assert.equal(english.status, 301); assert.equal(english.headers.get('Location'), 'https://sorafiles.com/tools');
  assert.equal(japanese.status, 301); assert.equal(japanese.headers.get('Location'), 'https://sorafiles.com/ja/tools');
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
