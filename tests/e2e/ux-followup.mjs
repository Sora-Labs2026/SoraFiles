import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.SORA_BASE_URL ?? 'http://localhost:4321';
const executablePath = process.env.SORA_BROWSER_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const image = fileURLToPath(new URL('../fixtures/sample.jpg', import.meta.url));
const pdf = fileURLToPath(new URL('../fixtures/text-two-page.pdf', import.meta.url));
await mkdir('.artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1100 } });
    const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${baseUrl}/edit-image`, { waitUntil: 'domcontentloaded' }); await page.locator('[data-extra-input]').setInputFiles(image); await page.locator('[data-edit-editor]').waitFor({ state: 'visible' }); await page.locator('[data-edit-preset="color"]').click(); assert.equal(await page.locator('[data-edit-preset="color"]').getAttribute('aria-pressed'), 'true', 'Color preset did not become visibly selected.'); assert.equal(await page.locator('[data-edit-control="saturation"]').inputValue(), '24', 'Color preset did not update its controls.'); await page.locator('[data-edit-control="brightness"]').fill('25'); assert.equal(await page.locator('[data-edit-preset][aria-pressed="true"]').count(), 0, 'Manual adjustment must clear the preset selection.'); await page.locator('[data-edit-ratio][value="1"]').check(); await page.locator('[data-edit-control="zoom"]').fill('150'); await page.waitForFunction(() => { const canvas = document.querySelector('[data-edit-preview]'); return canvas && canvas.width === canvas.height; }); const previewBox = await page.locator('[data-edit-preview]').boundingBox(); assert.ok(previewBox, 'Edit Image preview is not interactive.'); await page.mouse.move(previewBox.x + previewBox.width / 2, previewBox.y + previewBox.height / 2); await page.mouse.down(); await page.mouse.move(previewBox.x + previewBox.width / 2 + 30, previewBox.y + previewBox.height / 2); await page.mouse.up(); assert.notEqual(await page.locator('[data-edit-control="x"]').inputValue(), '0', 'Dragging the crop preview did not reposition the image.'); assert.ok((await page.locator('[data-edit-preview]').getAttribute('width')) === (await page.locator('[data-edit-preview]').getAttribute('height')), 'Square crop preview must be square.'); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, `Edit Image overflows at ${width}px.`);
    if (width === 390) await page.screenshot({ path: '.artifacts/edit-image-mobile.png', fullPage: true });
    await page.goto(`${baseUrl}/watermark-pdf`, { waitUntil: 'domcontentloaded' }); await page.locator('#action-input').setInputFiles(pdf); await page.locator('#action-form').waitFor({ state: 'visible' }); await page.locator('[data-watermark-mode="image"]').click(); await page.locator('#watermark-image').setInputFiles(image); await page.locator('input[name="watermarkImageTreatment"][value="remove"]').check(); assert.equal(await page.locator('#watermark-cleanup-controls').isVisible(), true); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, `Watermark PDF overflows at ${width}px.`);
    if (width === 390) await page.screenshot({ path: '.artifacts/watermark-image-mobile.png', fullPage: true });
    assert.deepEqual(errors, [], `Browser errors at ${width}px: ${errors.join(' | ')}`); await context.close();
    console.log(`PASS follow-up UI at ${width}px.`);
  }
} finally { await browser.close(); }
