import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FirefoxWebDriver } from './firefox-webdriver.mjs';

const baseUrl = process.env.SORA_BASE_URL ?? 'http://127.0.0.1:4329';
const routes = ['/pdf','/merge-pdf','/split-pdf','/rotate-pdf','/remove-pages','/pdf-to-jpg','/jpg-to-pdf','/pdf-to-word','/word-to-pdf','/watermark-pdf','/page-numbers','/sign-pdf','/image-converter','/compress-image','/heic-to-jpg','/edit-image','/remove-background','/protect-pdf','/unlock-pdf','/repair-pdf','/metadata-remover','/pdf-to-excel','/excel-to-pdf','/pdf-ocr','/resize-image','/doc-scanner'];
const downloads = fileURLToPath(new URL('../../test-results/tool-micro-audit/firefox-downloads', import.meta.url));
const fixture = fileURLToPath(new URL('../fixtures/minimal.pdf', import.meta.url));
await mkdir(downloads, { recursive: true });
const driver = new FirefoxWebDriver({ downloadDir: downloads, port: 4457 });

try {
  await driver.start();
  for (const route of routes) {
    for (const [width, height] of [[320, 568], [1440, 900]]) {
      await driver.setViewport(width, height);
      await driver.navigate(`${baseUrl}${route}`);
      await driver.waitFor('[data-workbench], [data-extra-workbench]', { visible: false });
      const health = await driver.execute(`
        return {
          h1: document.querySelectorAll('h1').length,
          overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
          ranges: [...document.querySelectorAll('input[type="range"]')].map((input) => ({
            id: input.id,
            shared: input.classList.contains('sf-range'),
            css: parseFloat(getComputedStyle(input).getPropertyValue('--range-progress')),
            expected: (Number(input.value) - Number(input.min || 0)) / (Number(input.max || 100) - Number(input.min || 0)) * 100,
          })),
        };
      `);
      assert.equal(health.h1, 1, `${route} must have one H1 in Firefox.`);
      assert.ok(health.overflow <= 1, `${route} overflows Firefox ${width}px viewport by ${health.overflow}px.`);
      for (const range of health.ranges) {
        assert.ok(range.shared, `${route} ${range.id} must use shared range CSS in Firefox.`);
        assert.ok(Math.abs(range.css - range.expected) < .001, `${route} ${range.id} has incorrect Firefox progress.`);
      }
    }
    console.log(`PASS Firefox responsive shell ${route}`);
  }
  await driver.navigate(`${baseUrl}/pdf`);
  await driver.setFiles('#pdf-input', fixture);
  await driver.waitFor('#pdf-work');
  await driver.setValue('#pdf-strength', 88);
  const focused = await driver.execute(`
    const input = document.querySelector('#pdf-strength');
    return { value: input.value, progress: getComputedStyle(input).getPropertyValue('--range-progress').trim(), label: document.querySelector('#pdf-strength-output').textContent };
  `);
  assert.deepEqual(focused, { value: '88', progress: '88%', label: '88 · Strong' });
  console.log('PASS Firefox 88% range progress');
} finally {
  await driver.stop();
}
