import test from 'node:test';
import assert from 'node:assert/strict';
import { localeDefinitions } from '../../src/i18n/config.ts';
import { OCR_LANGUAGE_BY_LOCALE, OCR_LANGUAGE_OPTIONS } from '../../src/lib/ocr/languages.ts';
import { ocrMessages } from '../../src/i18n/ocr.ts';

import { readFile } from 'node:fs/promises';

test('every locale maps to a self-hosted OCR model and messages', () => {
  for (const locale of localeDefinitions.filter((item) => item.published)) {
    assert.ok(OCR_LANGUAGE_BY_LOCALE[locale.path]);
    assert.ok(ocrMessages[locale.path]);
  }
  assert.equal(OCR_LANGUAGE_OPTIONS.length, 19);
  assert.equal(OCR_LANGUAGE_BY_LOCALE['zh-cn'], 'chi_sim');
  assert.equal(OCR_LANGUAGE_BY_LOCALE['zh-tw'], 'chi_tra');
});

test('local OCR engine uses strictly same-origin paths and zero external calls', async () => {
  const code = await readFile('src/lib/ocr/local-engine.ts', 'utf8');
  assert.match(code, /\/ocr\/runtime\/worker\.min\.js/);
  assert.match(code, /\/ocr\/runtime/);
  assert.match(code, /\/ocr\/lang/);
  assert.doesNotMatch(code, /jsdelivr|unpkg|githubusercontent|fetch\(file/i);
});

test('the standalone OCR tool uses the same local engine and all locale models', async () => {
  const [engine, workbench] = await Promise.all([
    readFile('src/engines/liveExtra.js', 'utf8'),
    readFile('src/components/ExtraToolWorkbench.astro', 'utf8'),
  ]);
  assert.match(engine, /createLocalOcrEngine/);
  assert.doesNotMatch(engine, /createWorker|jsdelivr|unpkg|githubusercontent/);
  assert.match(workbench, /OCR_LANGUAGE_OPTIONS\.map/);
  assert.match(workbench, /OCR_LANGUAGE_BY_LOCALE/);
});
