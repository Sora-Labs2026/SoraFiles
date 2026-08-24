import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ensureAstroServer, baseUrl } from './run-server.mjs';

const executablePath = process.env.SORA_BROWSER_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const widths = [320, 360, 375, 390, 412, 430];
const routes = ['/', '/tools', '/compress-image', '/pdf', '/merge-pdf', '/sign-pdf'];
const pdfFixture = fileURLToPath(new URL('../fixtures/text-two-page.pdf', import.meta.url));

await ensureAstroServer();
const browser = await chromium.launch({ executablePath });
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    await context.route(/acscdn\.com/i, (route) => route.abort());
    const page = await context.newPage();
    for (const route of routes) {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      assert.ok(response?.ok(), `${width}px ${route} did not load.`);
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        h1: document.querySelectorAll('h1').length,
        viewport: document.documentElement.clientWidth,
      }));
      assert.equal(layout.overflow, false, `${width}px ${route} has horizontal overflow.`);
      assert.equal(layout.h1, 1, `${width}px ${route} must have one H1.`);
      assert.equal(layout.viewport, width, `${width}px ${route} has an unexpected layout viewport.`);
    }
    await page.goto(`${baseUrl}/sign-pdf`, { waitUntil: 'domcontentloaded' });
    await page.locator('#action-input').setInputFiles(pdfFixture);
    await page.locator('#action-work').waitFor({ state: 'visible' });
    for (const mode of ['type', 'draw', 'upload']) {
      const control = page.locator(`[data-sign-mode="${mode}"]`);
      assert.equal(await control.count(), 1, `${width}px Sign PDF is missing ${mode}.`);
      const box = await control.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width, `${width}px Sign PDF ${mode} is outside the viewport.`);
    }
    await context.close();
    console.log(`PASS Chapter 1 mobile shell at ${width}px.`);
  }
} finally {
  await browser.close();
}
