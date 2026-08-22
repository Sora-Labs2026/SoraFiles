/**
 * Diagnostic script: captures browser console output while processing a scanned PDF
 * through the pdf-to-word tool to identify why OCR may be failing silently.
 */
import { join } from 'node:path';
import { chromium } from 'playwright';
import { baseUrl, ensureAstroServer } from './run-server.mjs';

const fixtureDir = join(process.cwd(), 'tests', 'fixtures');

await ensureAstroServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Capture ALL console messages
const consoleLogs = [];
page.on('console', (msg) => {
  consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
});

// Capture page errors
page.on('pageerror', (err) => {
  consoleLogs.push(`[PAGE_ERROR] ${err.message}`);
});

// Capture failed network requests
page.on('requestfailed', (req) => {
  consoleLogs.push(`[NET_FAIL] ${req.url()} → ${req.failure()?.errorText}`);
});

// Capture successful OCR-related network requests
page.on('response', (res) => {
  if (res.url().includes('/ocr/')) {
    consoleLogs.push(`[NET_OCR] ${res.status()} ${res.url()} (${res.headers()['content-type'] || 'unknown'})`);
  }
});

try {
  console.log('Navigating to /pdf-to-word...');
  await page.goto(`${baseUrl}/pdf-to-word`, { waitUntil: 'domcontentloaded' });

  console.log('Uploading scan-english.pdf...');
  await page.locator('#action-input').setInputFiles(join(fixtureDir, 'scan-english.pdf'));
  await page.locator('#action-work').waitFor({ state: 'visible' });

  console.log('Checking fidelity confirm...');
  await page.locator('#fidelity-confirm').check();

  console.log('Clicking process...');
  await page.locator('#action-process').click();

  // Wait up to 120s, checking status every 2s
  const startTime = Date.now();
  let lastStatus = '';
  while (Date.now() - startTime < 120_000) {
    await page.waitForTimeout(2000);
    const status = await page.locator('#action-status').textContent();
    const resultHidden = await page.locator('#action-result').isHidden();
    if (status !== lastStatus) {
      console.log(`[${Math.round((Date.now() - startTime) / 1000)}s] Status: "${status}" | Result hidden: ${resultHidden}`);
      lastStatus = status;
    }
    if (!resultHidden) {
      console.log('SUCCESS: #action-result is visible!');
      break;
    }
    // If status indicates error/cancellation, stop
    if (status && (status.includes('failed') || status.includes('unavailable') || status.includes('cancelled'))) {
      console.log('STOPPED: Error detected in status.');
      break;
    }
  }

  console.log('\n=== CONSOLE LOGS ===');
  for (const log of consoleLogs) {
    console.log(log);
  }
} finally {
  await browser.close();
  // Kill preview server
  process.exit(0);
}
