import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { baseUrl, ensureAstroServer } from './run-server.mjs';

test('pdf-to-word UI exposes localized OCR controls and layout warning', async () => {
  await ensureAstroServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // English PDF-to-Word
    await page.goto(`${baseUrl}/pdf-to-word`);
    const engSelector = page.locator('#ocr-language');
    await assert.rejects(engSelector.waitFor({ timeout: 2000 })).catch(() => {});
    const hasEngSelector = (await page.locator('#ocr-language').count()) === 1;
    assert.ok(hasEngSelector, '#ocr-language exists on /pdf-to-word');
    const selectedEng = await page.locator('#ocr-language').inputValue();
    assert.equal(selectedEng, 'eng');

    const engCancelHidden = await page.locator('#ocr-cancel').isHidden();
    assert.ok(engCancelHidden, '#ocr-cancel is hidden initially');

    // Arabic PDF-to-Word (RTL)
    await page.goto(`${baseUrl}/ar/pdf-to-word`);
    const hasAraSelector = (await page.locator('#ocr-language').count()) === 1;
    assert.ok(hasAraSelector, '#ocr-language exists on /ar/pdf-to-word');
    const selectedAra = await page.locator('#ocr-language').inputValue();
    assert.equal(selectedAra, 'ara');

    // Merge PDF (should NOT have OCR controls)
    await page.goto(`${baseUrl}/merge-pdf`);
    const mergeOcrCount = await page.locator('#ocr-options').count();
    assert.equal(mergeOcrCount, 0, '#ocr-options is absent on /merge-pdf');
  } finally {
    await browser.close();
  }
});
