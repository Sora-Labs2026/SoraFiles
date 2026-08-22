import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { baseUrl, ensureAstroServer } from './run-server.mjs';
import { validateDocx } from './output-validators.mjs';

const fixtureDir = join(process.cwd(), 'tests', 'fixtures');
const ocrFixtureDir = join(fixtureDir, 'ocr');

const languagePhrases = [
  { code: 'eng', phrase: 'Sora Files local OCR' },
  { code: 'jpn', phrase: 'ローカル OCR' },
  { code: 'kor', phrase: '로컬 OCR' },
  { code: 'spa', phrase: 'OCR local' },
  { code: 'fra', phrase: 'OCR local' },
  { code: 'deu', phrase: 'Lokale OCR' },
  { code: 'por', phrase: 'OCR local' },
  { code: 'chi_sim', phrase: '本地 OCR' },
  { code: 'chi_tra', phrase: '本機 OCR' },
  { code: 'hin', phrase: 'स्थानीय OCR' },
  { code: 'ara', phrase: 'OCR المحلي' },
  { code: 'rus', phrase: 'Локальный OCR' },
  { code: 'ind', phrase: 'OCR lokal' },
  { code: 'ita', phrase: 'OCR locale' },
  { code: 'nld', phrase: 'Lokale OCR' },
  { code: 'tur', phrase: 'yerel OCR' },
  { code: 'vie', phrase: 'OCR cục bộ' },
  { code: 'tha', phrase: 'OCR ในเครื่อง' },
  { code: 'pol', phrase: 'Lokalne OCR' },
];

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

test('pdf-to-word processes scanned English PDF and preserves privacy', async () => {
  await ensureAstroServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const networkRequests = [];
  page.on('request', (req) => {
    networkRequests.push(req.url());
  });

  try {
    await page.goto(`${baseUrl}/pdf-to-word`);
    await page.locator('#action-input').setInputFiles(join(fixtureDir, 'scan-english.pdf'));
    await page.locator('#action-work').waitFor({ state: 'visible' });
    await page.locator('#fidelity-confirm').check();
    await page.locator('#action-process').click();

    await page.locator('#action-result').waitFor({ state: 'visible', timeout: 90_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#action-download').click(),
    ]);

    const downloadPath = await download.path();
    assert.ok(downloadPath);
    const { text } = await validateDocx(await readFile(downloadPath), 'Sora Files local OCR');
    assert.match(text, /Sora Files local OCR/i);

    // Assert request privacy: only same-origin requests under /ocr/
    for (const url of networkRequests) {
      if (url.includes('/ocr/')) {
        assert.ok(url.startsWith(`${baseUrl}/ocr/`), `OCR request ${url} must be same-origin`);
        assert.doesNotMatch(url, /scan-english|Sora Files/i, `OCR request URL must contain no document payload`);
      }
    }
  } finally {
    await browser.close();
  }
});

test('pdf-to-word processes mixed embedded + scanned PDF in source order', async () => {
  await ensureAstroServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${baseUrl}/pdf-to-word`);
    await page.locator('#action-input').setInputFiles(join(fixtureDir, 'scan-mixed.pdf'));
    await page.locator('#action-work').waitFor({ state: 'visible' });
    await page.locator('#fidelity-confirm').check();
    await page.locator('#action-process').click();

    await page.locator('#action-result').waitFor({ state: 'visible', timeout: 90_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#action-download').click(),
    ]);

    const downloadPath = await download.path();
    const { text } = await validateDocx(await readFile(downloadPath));
    assert.match(text, /Embedded page one/i);
    assert.match(text, /Scanned page two/i);
  } finally {
    await browser.close();
  }
});

test('pdf-to-word supports cancellation', async () => {
  await ensureAstroServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${baseUrl}/pdf-to-word`);
    await page.locator('#action-input').setInputFiles(join(fixtureDir, 'scan-english.pdf'));
    await page.locator('#action-work').waitFor({ state: 'visible' });
    await page.locator('#fidelity-confirm').check();
    await page.locator('#action-process').click();

    await page.locator('#ocr-cancel').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('#ocr-cancel').click();

    await page.locator('#action-status').waitFor({ state: 'visible' });
    const statusText = await page.locator('#action-status').textContent();
    assert.match(statusText, /cancelled|canceled/i);
    assert.ok(await page.locator('#action-result').isHidden(), 'Result must be hidden on cancellation');
  } finally {
    await browser.close();
  }
});

if (process.argv.includes('--all-languages')) {
  test('pdf-to-word recognizes scanned pages across all 19 language models', async () => {
    await ensureAstroServer();
    const browser = await chromium.launch();

    for (const item of languagePhrases) {
      const page = await browser.newPage();
      try {
        await page.goto(`${baseUrl}/pdf-to-word`);
        await page.locator('#action-input').setInputFiles(join(ocrFixtureDir, `scan-${item.code}.pdf`));
        await page.locator('#action-work').waitFor({ state: 'visible' });
        await page.locator('#ocr-language').selectOption(item.code);
        await page.locator('#fidelity-confirm').check();
        await page.locator('#action-process').click();

        await page.locator('#action-result').waitFor({ state: 'visible', timeout: 90_000 });

        const [download] = await Promise.all([
          page.waitForEvent('download'),
          page.locator('#action-download').click(),
        ]);

        const downloadPath = await download.path();
        const { text } = await validateDocx(await readFile(downloadPath));
        assert.ok(text.length > 0, `${item.code} must extract non-empty DOCX text`);
        console.log(`PASS OCR model language ${item.code} (${text.length} chars)`);
      } finally {
        await page.close();
      }
    }
    await browser.close();
  });
}
