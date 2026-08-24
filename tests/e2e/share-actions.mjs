import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.SF_TEST_BASE_URL || 'http://127.0.0.1:4321';
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload) => {
        window.__sfSharePayload = payload;
      },
    });
  });

  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.getByTestId('share-menu-trigger').click();

  const expectedHosts = {
    x: 'twitter.com',
    facebook: 'www.facebook.com',
    threads: 'www.threads.net',
    reddit: 'www.reddit.com',
    linkedin: 'www.linkedin.com',
    whatsapp: 'wa.me',
  };
  for (const [network, host] of Object.entries(expectedHosts)) {
    const href = await page.locator(`[data-share-target="${network}"]`).getAttribute('href');
    assert.equal(new URL(href).host, host, `${network} must have a real share destination`);
  }

  await page.evaluate(() => navigator.clipboard.writeText('before-copy'));
  await page.locator('[data-share-copy]').click();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://sorafiles.com/');
  assert.equal(await page.locator('[data-share-copy-text]').textContent(), 'Copied');

  await page.locator('[data-share-native]').click();
  assert.deepEqual(
    await page.evaluate(() => ({ ...window.__sfSharePayload })),
    {
      title: 'SoraFiles - Free File Tools. Zero Uploads.',
      text: 'SoraFiles - Free File Tools. Zero Uploads. — Fast, free PDF and image tools. Files are processed locally on your device, with no account or watermark.',
      url: 'https://sorafiles.com/',
    },
  );

  await page.goto(`${baseUrl}/terms`, { waitUntil: 'networkidle' });
  const headings = await page.locator('h2').allTextContents();
  assert.equal(headings[0].replace(/\s+/g, ''), '01Theservice');
  assert.ok(!headings[0].includes('1. The service'));

  console.log('Share actions and Terms numbering passed in a real browser context.');
  await context.close();
} finally {
  await browser.close();
}
