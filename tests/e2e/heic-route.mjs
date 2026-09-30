import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { validateImageInBrowser } from './output-validators.mjs';

const base = process.env.SORA_BASE_URL ?? 'http://127.0.0.1:4395';
const browser = await chromium.launch({ executablePath: process.env.SORA_BROWSER_PATH });
try {
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const uploads = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) uploads.push(`${request.method()} ${request.url()}`); });
  await page.goto(`${base}/heic-to-jpg`, { waitUntil: 'domcontentloaded' });
  await page.locator('#file-input').setInputFiles(fileURLToPath(new URL('../fixtures/libheif-example.heic', import.meta.url)));
  await page.locator('#work-state').waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('#process-file').click();
  await page.locator('#result-state').waitFor({ state: 'visible', timeout: 90_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download-result').click()]);
  const output = await readFile(await download.path());
  assert.deepEqual([...output.subarray(0, 3)], [255, 216, 255]);
  const size = await validateImageInBrowser(page, output, 'image/jpeg');
  assert.deepEqual([size.width, size.height], [1280, 854]);
  assert.deepEqual(errors, []);
  assert.deepEqual(uploads, []);
  console.log(`PASS heic-to-jpg dedicated route: ${download.suggestedFilename()}, 1280x854 JPEG, no upload or page errors`);
} finally {
  await browser.close();
}
