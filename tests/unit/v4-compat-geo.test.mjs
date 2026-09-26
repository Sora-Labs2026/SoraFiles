import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

const runIsolatedModuleCheck = (source) => {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: new URL('../..', import.meta.url),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
};

test('PDF.js compatibility entry supplies exact lowercase byte hex semantics when absent', () => {
  const output = runIsolatedModuleCheck(`
    delete Uint8Array.prototype.toHex;
    delete Map.prototype.getOrInsertComputed;
    await import('pdfjs-dist/legacy/build/pdf.mjs');
    const bytes = new Uint8Array([0, 1, 15, 16, 127, 128, 255]);
    if (bytes.toHex() !== '00010f107f80ff') throw new Error('Incorrect toHex semantics: ' + bytes.toHex());
    const map = new Map();
    if (map.getOrInsertComputed('key', () => 7) !== 7 || map.get('key') !== 7) throw new Error('Map compatibility failed.');
    console.log(bytes.toHex());
  `);
  assert.equal(output, '00010f107f80ff');
});

test('PDF.js compatibility entry does not replace a native toHex implementation', () => {
  const output = runIsolatedModuleCheck(`
    const native = function nativeToHexProbe() {
      return Array.from(this, (byte) => byte.toString(16).padStart(2, '0')).join('');
    };
    Object.defineProperty(Uint8Array.prototype, 'toHex', { configurable: true, writable: true, value: native });
    await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (Uint8Array.prototype.toHex !== native) throw new Error('Native toHex was replaced.');
    console.log(new Uint8Array([255]).toHex());
  `);
  assert.equal(output, 'ff');
});

test('every PDF.js caller shares the compatibility runtime and worker', async () => {
  const [runtime, compressor, documents, extras] = await Promise.all([
    read('src/lib/pdfjsRuntime.ts'),
    read('src/components/PdfWorkbench.astro'),
    read('src/components/DocumentActionWorkbench.astro'),
    read('src/engines/liveExtra.js'),
  ]);
  assert.match(runtime, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(runtime, /pdfjs-dist\/legacy\/build\/pdf\.worker\.min\.mjs\?url/);
  for (const source of [compressor, documents, extras]) assert.match(source, /pdfjsRuntime/);
  for (const source of [compressor, documents, extras]) assert.doesNotMatch(source, /pdfjs-dist\/build\/pdf\.worker/);
});

test('hero scenes pause offscreen and expose static reduced-motion previews', async () => {
  const hero = await read('src/components/HeroVisualization.astro');
  const css = await read('src/styles/v10-product-window.css');
  assert.match(hero, /data-preview-scene/);
  assert.match(hero, /IntersectionObserver/);
  assert.match(hero, /prefers-reduced-motion: reduce/);
  assert.match(hero, /!reduced.matches/);
  assert.match(hero, /visibilitychange/);
  assert.match(hero, /focusin/);
  assert.match(css, /@keyframes/);
  assert.doesNotMatch(hero, /offsetWidth|anim-twinkle|blur-\[/);
});

test('homepage GEO graph is grounded in visible FAQ, provenance, and first-party identity', async () => {
  const [page, home, positioning] = await Promise.all([read('src/pages/index.astro'), read('src/components/LocalizedHome.astro'), read('src/i18n/brandPositioning.ts')]);
  for (const type of ['WebPage', 'WebApplication', 'FAQPage', 'Organization', 'WebSite']) assert.match(page, new RegExp(`'@type': '${type}'`));
  assert.match(page, /sameAs: \['https:\/\/github\.com\/Sora-Labs2026\/SoraFiles'\]/);
  assert.doesNotMatch(page, /alternateName:/);
  assert.match(page, /CONTENT_PROVENANCE\.modifiedIso/);
  assert.match(page, /name: 'SoraFiles'/);
  assert.doesNotMatch(page, /name: brand\.homeTitle/);
  assert.match(positioning, /en: \{\s*homeTitle: 'SoraFiles',/);
  assert.match(home, /data-content-provenance/);
  assert.doesNotMatch(home, /WebAssembly|memory-safe|sandboxed execution/);
  assert.doesNotMatch(page, /citation:/);
  assert.match(home, /content\.home\.faqs\.map/);
});
