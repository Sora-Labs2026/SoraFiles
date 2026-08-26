import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ensureAstroServer, baseUrl } from './run-server.mjs';

const executablePath = process.env.SORA_BROWSER_PATH;
const widths = process.env.SORA_WIDTHS ? process.env.SORA_WIDTHS.split(',').map(Number) : [320, 390, 768, 1024, 1440];
const pdfFixture = fileURLToPath(new URL('../fixtures/text-two-page.pdf', import.meta.url));

await ensureAstroServer();
const browser = await chromium.launch({ executablePath });
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const response = await page.goto(`${baseUrl}/pdf`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    assert.ok(response?.ok(), `${width}px Compress PDF did not load.`);
    await page.locator('#pdf-input').setInputFiles(pdfFixture);
    await page.locator('#pdf-work').waitFor({ state: 'visible' });
    await page.locator('#pdf-preview-count').filter({ hasText: '1 of 2' }).waitFor();

    const layout = await page.evaluate(() => {
      const stage = document.querySelector('#pdf-preview-stage');
      const canvas = document.querySelector('#pdf-preview');
      if (!(stage instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) throw new Error('PDF preview is missing.');
      const stageRect = stage.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        stageLeft: stageRect.left,
        stageRight: stageRect.right,
        canvasLeft: canvasRect.left,
        canvasRight: canvasRect.right,
        canvasWidth: canvasRect.width,
        canvasHeight: canvasRect.height,
        renderedRatio: canvasRect.width / canvasRect.height,
        backingRatio: canvas.width / canvas.height,
      };
    });

    assert.equal(layout.overflow, false, `${width}px uploaded PDF creates horizontal overflow.`);
    assert.ok(layout.canvasLeft >= layout.stageLeft - 1, `${width}px preview escapes the left edge.`);
    assert.ok(layout.canvasRight <= layout.stageRight + 1, `${width}px preview escapes the right edge.`);
    assert.ok(layout.canvasWidth > 0 && layout.canvasHeight > 0, `${width}px preview has no visible size.`);
    assert.ok(Math.abs(layout.renderedRatio - layout.backingRatio) < 0.01, `${width}px preview aspect ratio is distorted.`);
    await context.close();
    console.log(`PASS PDF preview layout at ${width}px.`);
  }
} finally {
  await browser.close();
}
