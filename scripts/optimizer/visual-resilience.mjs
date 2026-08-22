import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { decode as decodePng } from 'fast-png';
import { projectRoot, visualBaselinePath } from './core.mjs';

const mode = process.argv[2] ?? '--compare';
const port = 4400 + (process.pid % 500);
const baseUrl = `http://127.0.0.1:${port}`;
const astro = path.join(projectRoot, 'node_modules', 'astro', 'bin', 'astro.mjs');
const baselineImageDirectory = path.join(projectRoot, 'optimizer', 'baselines', 'screenshots');
const currentImageDirectory = path.join(projectRoot, '.artifacts', 'optimizer', mode.slice(2));
const cases = [
  { id: 'home-320', route: '/', width: 320, height: 900, lang: 'en', dir: 'ltr' },
  { id: 'home-390', route: '/', width: 390, height: 900, lang: 'en', dir: 'ltr' },
  { id: 'home-768', route: '/', width: 768, height: 960, lang: 'en', dir: 'ltr' },
  { id: 'home-1440', route: '/', width: 1440, height: 1000, lang: 'en', dir: 'ltr' },
  { id: 'home-1920', route: '/', width: 1920, height: 1080, lang: 'en', dir: 'ltr' },
  { id: 'rtl-390', route: '/ar', width: 390, height: 900, lang: 'ar', dir: 'rtl' },
  { id: 'merge-320', route: '/merge-pdf', width: 320, height: 900, lang: 'en', dir: 'ltr' },
  { id: 'merge-1440', route: '/merge-pdf', width: 1440, height: 1000, lang: 'en', dir: 'ltr' },
];

const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');
const isExpectedSandboxError = (message) => /service worker is disabled because the context is sandboxed/i.test(message);

function pixelDifference(expectedBuffer, actualBuffer) {
  const expected = decodePng(expectedBuffer);
  const actual = decodePng(actualBuffer);
  assert.equal(actual.width, expected.width, 'Screenshot width changed.');
  assert.equal(actual.height, expected.height, 'Screenshot height changed.');
  assert.equal(actual.channels, expected.channels, 'Screenshot color channels changed.');
  let materiallyChangedChannels = 0;
  let absoluteDifference = 0;
  for (let index = 0; index < expected.data.length; index += 1) {
    const difference = Math.abs(expected.data[index] - actual.data[index]);
    absoluteDifference += difference;
    if (difference > 8) materiallyChangedChannels += 1;
  }
  return {
    materiallyChangedRatio: materiallyChangedChannels / expected.data.length,
    meanAbsoluteDifference: absoluteDifference / expected.data.length,
  };
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Astro preview did not become ready within 30 seconds.');
}

async function createContext(browser, viewport, { denyStorage = false } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === baseUrl) await route.continue();
    else await route.abort();
  });
  if (denyStorage) {
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('Storage disabled by test', 'SecurityError'); },
      });
    });
  }
  return context;
}

async function stabilize(page) {
  await page.addStyleTag({ content: `
    *, *::before, *::after { animation-delay: 0s !important; animation-duration: 0s !important; transition-delay: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }
    html { scroll-behavior: auto !important; }
  ` });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  await page.waitForTimeout(100);
}

async function captureCase(browser, testCase, directory) {
  const context = await createContext(browser, { width: testCase.width, height: testCase.height });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => { if (!isExpectedSandboxError(error.message)) errors.push(error.message); });
  await page.goto(`${baseUrl}${testCase.route}`, { waitUntil: 'domcontentloaded' });
  await stabilize(page);
  const state = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    h1Count: document.querySelectorAll('h1').length,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir || 'ltr',
    mobileLanguageVisible: (() => {
      const element = document.querySelector('[data-testid="mobile-language-selector"]');
      return element instanceof HTMLElement && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0;
    })(),
  }));
  assert.ok(state.documentWidth <= state.viewportWidth + 1, `${testCase.id} has horizontal overflow: ${state.documentWidth} > ${state.viewportWidth}.`);
  assert.equal(state.h1Count, 1, `${testCase.id} must render exactly one H1.`);
  assert.equal(state.lang, testCase.lang, `${testCase.id} has the wrong lang.`);
  assert.equal(state.dir, testCase.dir, `${testCase.id} has the wrong direction.`);
  if (testCase.width < 768) assert.equal(state.mobileLanguageVisible, true, `${testCase.id} is missing the mobile language globe.`);
  assert.deepEqual(errors, [], `${testCase.id} emitted page errors: ${errors.join(' | ')}`);
  await mkdir(directory, { recursive: true });
  const screenshot = await page.screenshot({ animations: 'disabled', fullPage: false });
  await writeFile(path.join(directory, `${testCase.id}.png`), screenshot);
  await context.close();
  return { ...testCase, ...state, sha256: digest(screenshot) };
}

async function captureVisuals(browser, directory) {
  const results = [];
  for (const testCase of cases) results.push(await captureCase(browser, testCase, directory));
  return results;
}

async function runStress(browser, { runStorage = true, runBatch = true } = {}) {
  if (runStorage) {
    const storageContext = await createContext(browser, { width: 390, height: 900 }, { denyStorage: true });
    const storagePage = await storageContext.newPage();
    const storageErrors = [];
    storagePage.on('pageerror', (error) => { if (!isExpectedSandboxError(error.message)) storageErrors.push(error.message); });
    await storagePage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await stabilize(storagePage);
    await storagePage.locator('[data-theme-choice="dark"]').first().evaluate((element) => element.click());
    assert.equal(await storagePage.locator('html').evaluate((element) => element.classList.contains('dark')), true, 'Theme control failed when localStorage was unavailable.');
    assert.equal(await storagePage.locator('h1').count(), 1, 'Homepage became unusable when localStorage was unavailable.');
    assert.deepEqual(storageErrors, [], `Storage-denial page errors: ${storageErrors.join(' | ')}`);
    await storageContext.close();
  }

  if (!runBatch) return;
  const batchContext = await createContext(browser, { width: 320, height: 900 });
  const batchPage = await batchContext.newPage();
  await batchPage.goto(`${baseUrl}/merge-pdf`, { waitUntil: 'domcontentloaded' });
  await stabilize(batchPage);
  const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  const longName = `${'ملف-🙂-文書-'.repeat(32)}final.pdf`;
  const twentyOne = Array.from({ length: 21 }, (_, index) => ({ name: `${index}-${longName}`, mimeType: 'application/pdf', buffer: minimalPdf }));
  await batchPage.locator('#action-input').setInputFiles(twentyOne);
  await batchPage.locator('#action-error').waitFor({ state: 'visible' });
  assert.match(await batchPage.locator('#action-error').innerText(), /no more than 20/i, 'Huge batch did not fail with the bounded 20-file rule.');
  assert.equal(await batchPage.locator('#action-file-list > li').count(), 0, 'Rejected batch created an unbounded DOM list.');

  const twenty = twentyOne.slice(0, 20);
  await batchPage.locator('#action-input').setInputFiles(twenty);
  await batchPage.locator('#action-work').waitFor({ state: 'visible' });
  assert.equal(await batchPage.locator('#action-file-list > li').count(), 20, 'Valid bounded batch did not preserve every selected item.');
  const firstName = batchPage.locator('#action-file-list > li').first().locator('[aria-label]');
  assert.equal(await firstName.getAttribute('aria-label'), twenty[0].name, 'Long Unicode filename lost its accessible full value.');
  const overflow = await batchPage.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    elements: [...document.querySelectorAll('*')].flatMap((element) => {
      const rectangle = element.getBoundingClientRect();
      if (rectangle.width <= 0 || (rectangle.right <= document.documentElement.clientWidth + 1 && rectangle.left >= -1)) return [];
      return [{ tag: element.tagName, id: element.id, className: String(element.className).slice(0, 160), left: Math.round(rectangle.left), right: Math.round(rectangle.right), width: Math.round(rectangle.width), text: (element.textContent || '').trim().slice(0, 80) }];
    }).slice(0, 20),
  }));
  assert.ok(overflow.documentWidth <= overflow.viewportWidth + 1, `Long Unicode/RTL filenames caused document overflow: ${JSON.stringify(overflow)}.`);
  await mkdir(currentImageDirectory, { recursive: true });
  await batchPage.screenshot({ path: path.join(currentImageDirectory, 'stress-long-unicode-batch-320.png'), animations: 'disabled', fullPage: false });
  await batchContext.close();
}

spawnSync(process.execPath, [astro, 'preview', 'stop'], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'ignore',
  windowsHide: true,
});
const start = spawnSync(process.execPath, [astro, 'preview', '--background', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: projectRoot,
  env: process.env,
  encoding: 'utf8',
  stdio: 'pipe',
  windowsHide: true,
});
if (start.status !== 0) throw new Error(`Astro preview failed to start.\n${start.stdout}\n${start.stderr}`);

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  if (mode === '--capture-baseline') {
    const results = await captureVisuals(browser, baselineImageDirectory);
    await mkdir(path.dirname(visualBaselinePath), { recursive: true });
    await writeFile(visualBaselinePath, `${JSON.stringify({ schemaVersion: 1, capturedAt: new Date().toISOString(), cases: results }, null, 2)}\n`, 'utf8');
    console.log(`Captured ${results.length} immutable visual baselines.`);
  } else if (mode === '--compare') {
    const baseline = JSON.parse(await readFile(visualBaselinePath, 'utf8'));
    const current = await captureVisuals(browser, currentImageDirectory);
    assert.equal(baseline.schemaVersion, 1, 'Visual baseline schema is unsupported.');
    assert.equal(baseline.cases.length, current.length, 'Visual baseline case count changed.');
    for (const result of current) {
      const expected = baseline.cases.find((entry) => entry.id === result.id);
      assert.ok(expected, `Missing visual baseline ${result.id}.`);
      if (result.sha256 !== expected.sha256) {
        const difference = pixelDifference(
          await readFile(path.join(baselineImageDirectory, `${result.id}.png`)),
          await readFile(path.join(currentImageDirectory, `${result.id}.png`)),
        );
        assert.ok(difference.materiallyChangedRatio <= 0.003, `${result.id} changed ${Math.round(difference.materiallyChangedRatio * 100_000) / 1000}% of color channels.`);
        assert.ok(difference.meanAbsoluteDifference <= 0.15, `${result.id} mean color-channel difference ${difference.meanAbsoluteDifference} exceeds the single-capture visual budget.`);
      }
    }
    console.log(`Visual equivalence passed for ${current.length} responsive cases.`);
  } else if (mode === '--stress' || mode === '--stress-batch' || mode === '--stress-storage') {
    await runStress(browser, { runStorage: mode !== '--stress-batch', runBatch: mode !== '--stress-storage' });
    console.log('Storage-denial, batch-bound, Unicode, RTL, filename-accessibility, and overflow stress gates passed.');
  } else {
    throw new Error(`Unknown visual-resilience mode: ${mode}.`);
  }
} catch (error) {
  throw error;
} finally {
  if (browser) await browser.close();
  spawnSync(process.execPath, [astro, 'preview', 'stop'], { cwd: projectRoot, env: process.env, stdio: 'ignore', windowsHide: true });
}
