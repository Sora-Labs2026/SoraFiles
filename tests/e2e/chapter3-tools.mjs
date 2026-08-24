import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

const baseUrl = process.env.SORA_BASE_URL ?? 'http://127.0.0.1:4355';
const executablePath = process.env.SORA_BROWSER_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const fixture = fileURLToPath(new URL('../fixtures/sample.jpg', import.meta.url));

const browser = await chromium.launch({ executablePath, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
try {
  if (!process.env.SORA_CH3_SCANNER_ONLY) for (const width of [320, 390, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(`${baseUrl}/resize-image`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    assert.ok(response?.ok(), `Resize Image failed to load at ${width}px.`);
    await page.locator('[data-resize-input]').setInputFiles(fixture);
    await page.locator('[data-resize-editor]').waitFor({ state: 'visible' });
    await page.locator('[data-resize-width]').fill('320');
    await page.locator('[data-resize-width]').dispatchEvent('input');
    if (width === 320) {
      await page.locator('[data-resize-run]').click();
      await page.locator('[data-resize-cancel]').waitFor({ state: 'visible' });
      await page.locator('[data-resize-cancel]').click();
      await page.locator('[data-resize-run]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-resize-result]').isVisible(), false, 'Cancelled resize exposed a stale result.');
    }
    await page.locator('[data-resize-run]').click();
    await page.locator('[data-resize-result]').waitFor({ state: 'visible', timeout: 60_000 });
    const dimensions = await page.locator('[data-resize-download]').evaluate(async (link) => {
      const response = await fetch(link.href);
      const bitmap = await createImageBitmap(await response.blob());
      const result = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return result;
    });
    assert.equal(dimensions.width, 320, `Resize output width is wrong at ${width}px.`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(overflow, false, `Resize Image overflows at ${width}px.`);
    assert.deepEqual(errors, [], `Resize Image emitted browser errors at ${width}px: ${errors.join(' | ')}`);
    if (process.env.SORA_CH3_SCREENSHOTS && width === 390) await page.screenshot({ path: '.artifacts/chapter3-resize-mobile.png', fullPage: true });
    await context.close();
    console.log(`PASS Resize Image at ${width}px (${dimensions.width}x${dimensions.height}).`);
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const fileRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method()) && !request.url().includes('/cdn-cgi/challenge-platform/')) {
      fileRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  const response = await page.goto(`${baseUrl}/doc-scanner`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert.ok(response?.ok(), 'Doc Scanner failed to load.');
  assert.equal(await page.locator('[data-camera-start], [data-camera-panel]').count(), 0, 'Doc Scanner must not expose a camera workflow.');
  await page.locator('[data-scanner-input]').setInputFiles(fixture);
  await page.locator('[data-page-list] li').waitFor({ state: 'visible', timeout: 60_000 });
  assert.equal(await page.locator('input[name="scan-filter"][value="color"]').isChecked(), true, 'Doc Scanner should default to the natural Color filter.');
  await page.waitForTimeout(800);
  const recoveryPage = await context.newPage();
  await recoveryPage.goto(`${baseUrl}/doc-scanner`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await recoveryPage.locator('[data-page-list] li').waitFor({ state: 'visible', timeout: 60_000 });
  assert.equal(await recoveryPage.locator('[data-page-list] li').count(), 1, 'Doc Scanner did not recover its local draft in a new page.');
  await recoveryPage.close();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-scanner-retake]').click();
  const chooser = await chooserPromise;
  await chooser.setFiles(fixture);
  await page.locator('[data-page-list] li').waitFor({ state: 'visible', timeout: 60_000 });
  assert.equal(await page.locator('[data-page-list] li').count(), 1, 'Retake added a page instead of replacing it.');
  await page.locator('[data-scanner-recrop]').click();
  await page.locator('[data-corner-host]').waitFor({ state: 'visible' });
  await page.locator('[data-corners-apply]').click();
  await page.locator('[data-corners-apply][data-state="applied"]').waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('[data-export-format][value="jpg"]').check();
  assert.match(await page.locator('[data-export-run]').innerText(), /JPG/i, 'JPG selection is not reflected in the export action.');
  await page.locator('[data-export-run]').click();
  await page.locator('[data-export-result]').waitFor({ state: 'visible', timeout: 60_000 });
  const jpgSignature = await page.locator('[data-export-download]').evaluate(async (link) => {
    const bytes = new Uint8Array(await (await fetch(link.href)).arrayBuffer());
    return Array.from(bytes.slice(0, 3));
  });
  assert.deepEqual(jpgSignature, [0xff, 0xd8, 0xff], 'Doc Scanner JPG output is invalid.');
  await page.locator('[data-scanner-input]').setInputFiles(fixture);
  await page.locator('[data-page-list] li').nth(1).waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('input[name="scan-filter"][value="contrast"]').check({ force: true });
  await page.locator('[data-scanner-progress]').waitFor({ state: 'hidden', timeout: 60_000 });
  await page.locator('[data-scanner-action-status]').waitFor({ state: 'visible' });
  const previousPngHref = await page.locator('[data-export-download]').getAttribute('href');
  await page.locator('[data-export-format][value="png"]').check();
  await page.locator('[data-export-run]').click();
  await page.waitForFunction((oldHref) => document.querySelector('[data-export-download]')?.getAttribute('href') !== oldHref, previousPngHref, { timeout: 60_000 });
  const zipSignature = await page.locator('[data-export-download]').evaluate(async (link) => Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer()).slice(0, 4)));
  assert.deepEqual(zipSignature, [0x50, 0x4b, 0x03, 0x04], 'Multi-page PNG export is not a valid ZIP.');
  const downloadPromise = page.waitForEvent('download');
  const previousPdfHref = await page.locator('[data-export-download]').getAttribute('href');
  await page.locator('[data-export-format][value="pdf"]').check();
  await page.locator('[data-export-run]').click();
  await page.waitForFunction((oldHref) => document.querySelector('[data-export-download]')?.getAttribute('href') !== oldHref, previousPdfHref, { timeout: 60_000 });
  await page.locator('[data-export-download]').click();
  const download = await downloadPromise;
  const path = await download.path();
  assert.ok(path, 'Doc Scanner PDF did not download.');
  const pdf = await readFile(path);
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-', 'Doc Scanner PDF signature is invalid.');
  const parsedPdf = await PDFDocument.load(pdf);
  assert.equal(parsedPdf.getPageCount(), 2, 'Doc Scanner PDF page count is wrong.');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, 'Doc Scanner overflows on mobile.');
  if (process.env.SORA_CH3_SCREENSHOTS) await page.screenshot({ path: '.artifacts/chapter3-scanner-mobile.png', fullPage: true });
  assert.deepEqual(errors, [], `Doc Scanner emitted browser errors: ${errors.join(' | ')}`);
  assert.deepEqual(fileRequests, [], `Doc Scanner sent a non-GET request: ${fileRequests.join(' | ')}`);
  await context.close();
  console.log('PASS Doc Scanner upload, perspective fallback, filter, JPG, PDF, privacy and mobile layout.');
} finally {
  await browser.close();
}
