// Real-user flow on a phone: passport preset + 50 KB limit, then PNG + limit.
import { webkit, devices } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base = process.env.SORA_BASE_URL ?? 'http://127.0.0.1:4396';
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices['iPhone 15'], acceptDownloads: true, serviceWorkers: 'block' });
await context.route((url) => /^https?:$/.test(url.protocol) && url.hostname !== '127.0.0.1', (route) => route.abort()); // third parties never gate a local test
const page = await context.newPage();
try {
  await page.goto(`${base}/resize-image/`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-resize-input]').setInputFiles('tests/fixtures/sorafiles-qa/landscape.jpg');
  await page.locator('[data-resize-editor]').waitFor({ state: 'visible' });
  await page.locator('[data-workspace-mobile-nav] [data-mobile-panel="inspector"]').click();
  await page.locator('[data-resize-preset]').selectOption('passport');
  assert.equal(await page.locator('[data-unit="mm"]').getAttribute('aria-checked'), 'true');
  assert.equal(await page.locator('[data-resize-width]').inputValue(), '34.97');
  assert.equal(await page.locator('[data-resize-dpi-field]').isVisible(), true);
  await page.locator('[data-resize-max]').fill('50');
  assert.equal(await page.locator('[data-resize-quality]').isDisabled(), true);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }).catch(() => null), (async () => { await page.locator('[data-resize-run]').click(); await page.locator('[data-resize-result]').waitFor({ state: 'visible', timeout: 60000 }); await page.locator('[data-resize-download]').click(); })()]);
  const summary = await page.locator('[data-resize-summary]').textContent();
  assert.match(summary, /413 × 531px \(34\.97 × 44\.96 mm, 300 DPI\)/);
  const bytes = new Uint8Array(await readFile(await download.path()));
  assert.ok(bytes.length <= 50_000, `size ${bytes.length}`);
  // JFIF density: units=1 (dpi), 300 × 300.
  assert.deepEqual([...bytes.subarray(13, 18)], [1, 1, 44, 1, 44]);
  // SOF0/SOF2 dimensions.
  let at = 2; let dims = null;
  while (at < bytes.length) { const marker = bytes[at + 1], len = (bytes[at + 2] << 8) | bytes[at + 3]; if (marker >= 0xc0 && marker <= 0xc3) { dims = [(bytes[at + 7] << 8) | bytes[at + 8], (bytes[at + 5] << 8) | bytes[at + 6]]; break; } at += 2 + len; }
  assert.deepEqual(dims, [413, 531]);
  // PNG cannot honour a size limit: an honest message, no download.
  await page.locator('[data-resize-format]').selectOption('image/png');
  await page.locator('[data-resize-run]').click();
  await page.locator('[data-resize-error]').waitFor({ state: 'visible' });
  assert.match(await page.locator('[data-resize-error]').textContent(), /PNG keeps every pixel/);
  console.log(`RESIZE PRINT SIZE PASS: 413×531 px, ${bytes.length} bytes ≤ 50 KB, 300 DPI; PNG limit explained. Summary: ${summary}`);
} finally { await browser.close(); }
