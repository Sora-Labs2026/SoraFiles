import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { baseUrl, ensureAstroServer } from './run-server.mjs';

test('OCR stays a dedicated localized, privacy-first tool', async () => {
  await ensureAstroServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${baseUrl}/pdf-to-word`);
    assert.equal(await page.locator('#ocr-language, #fidelity-confirm').count(), 0, 'PDF to Word must not expose retired OCR controls.');
    assert.equal(await page.locator('#ocr-cancel').isHidden(), true, 'PDF to Word cancellation stays hidden before processing.');

    await page.goto(`${baseUrl}/pdf-ocr`);
    const englishLanguage = page.locator('[data-extra-lang]');
    assert.equal(await englishLanguage.count(), 1, 'PDF OCR exposes one language selector.');
    assert.equal(await englishLanguage.inputValue(), 'eng', 'English PDF OCR defaults to English.');
    assert.equal(await englishLanguage.locator('option').count(), 19, 'PDF OCR exposes all 19 self-hosted language models.');
    assert.equal(await page.locator('[data-extra-cancel]').isHidden(), true, 'OCR cancellation stays hidden before processing.');
    assert.match(await page.locator('[data-extra-workbench]').innerText(), /device|local|browser|upload/i, 'PDF OCR explains its local processing boundary.');

    const externalOcrScripts = await page.locator('script[src]').evaluateAll((scripts) => scripts
      .map((script) => script.src)
      .filter((source) => /ocr|tesseract|traineddata/i.test(source) && !source.startsWith(location.origin)));
    assert.deepEqual(externalOcrScripts, [], 'PDF OCR loads no third-party OCR runtime or model.');

    await page.goto(`${baseUrl}/ar/pdf-ocr`);
    assert.equal(await page.locator('[data-extra-lang]').inputValue(), 'ara', 'Arabic PDF OCR defaults to Arabic.');
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl', 'Arabic PDF OCR preserves RTL layout.');

    await page.goto(`${baseUrl}/merge-pdf`);
    assert.equal(await page.locator('[data-extra-lang], #ocr-language').count(), 0, 'Merge PDF exposes no OCR controls.');
  } finally {
    await browser.close();
  }
});
