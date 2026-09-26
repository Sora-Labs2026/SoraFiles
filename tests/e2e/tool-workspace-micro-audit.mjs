import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { baseUrl, ensureAstroServer } from './run-server.mjs';

const routes = [
  '/pdf', '/merge-pdf', '/split-pdf', '/rotate-pdf', '/remove-pages', '/pdf-to-jpg',
  '/jpg-to-pdf', '/pdf-to-word', '/word-to-pdf', '/watermark-pdf', '/page-numbers',
  '/sign-pdf', '/image-converter', '/compress-image', '/heic-to-jpg', '/edit-image',
  '/remove-background', '/protect-pdf', '/unlock-pdf', '/repair-pdf', '/metadata-remover',
  '/pdf-to-excel', '/excel-to-pdf', '/pdf-ocr', '/resize-image', '/doc-scanner',
];
const viewports = [
  [320, 568], [360, 800], [390, 844], [430, 932], [768, 1024],
  [1024, 768], [1280, 800], [1440, 900], [1920, 1080],
];
const locales = ['en', 'de', 'fr', 'es', 'ar', 'hi', 'zh-cn', 'ja'];
const banned = /\b(?:SSIM|QFactor|MozJPEG|Ghostscript|qpdf|PyMuPDF|WASM|ONNX|Distiller|downsampling|object streams?|confidence floor|codec)\b/i;
const fixture = fileURLToPath(new URL('../fixtures/minimal.pdf', import.meta.url));
const artifacts = fileURLToPath(new URL('../../test-results/tool-micro-audit', import.meta.url));

await ensureAstroServer();
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.SORA_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

const diagnostics = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (error) => diagnostics.push(`pageerror ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(`console ${message.text()}`); });
page.on('response', (response) => {
  if (response.url().startsWith(baseUrl) && response.status() >= 400) diagnostics.push(`${response.status()} ${response.url()}`);
});

async function open(path, width, height, theme = 'light') {
  await page.setViewportSize({ width, height });
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((value) => {
    localStorage.setItem('sora-theme', value);
    document.documentElement.classList.toggle('dark', value === 'dark');
  }, theme);
  await page.locator('[data-workbench], [data-extra-workbench]').first().waitFor({ state: 'attached' });
}

async function assertShell(path, width, height, theme) {
  await open(path, width, height, theme);
  assert.equal(await page.locator('h1').count(), 1, `${path} must have one H1.`);
  const health = await page.evaluate(() => ({
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    workbenchText: document.querySelector('[data-workbench], [data-extra-workbench]')?.innerText ?? '',
    chooserCount: document.querySelectorAll('[data-workbench] input[type="file"], [data-extra-workbench] input[type="file"]').length,
    dark: document.documentElement.classList.contains('dark'),
  }));
  assert.ok(health.overflow <= 1, `${path} overflows ${width}px viewport by ${health.overflow}px.`);
  assert.ok(health.chooserCount >= 1, `${path} must expose a file chooser.`);
  assert.doesNotMatch(health.workbenchText, banned, `${path} exposes internal terminology.`);
  assert.equal(health.dark, theme === 'dark', `${path} did not apply ${theme} theme.`);
}

try {
  for (const route of routes) {
    await assertShell(route, 320, 568, 'dark');
    await assertShell(route, 1440, 900, 'light');
    console.log(`PASS responsive shell ${route}`);
  }

  for (const [width, height] of viewports) {
    for (const route of ['/pdf', '/watermark-pdf', '/edit-image', '/doc-scanner']) {
      await assertShell(route, width, height, width <= 430 ? 'dark' : 'light');
    }
    console.log(`PASS viewport ${width}x${height}`);
  }

  for (const locale of locales) {
    const prefix = locale === 'en' ? '' : `/${locale}`;
    await open(`${prefix}/pdf`, 390, 844, 'light');
    const state = await page.evaluate(() => ({
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
    }));
    assert.ok(state.overflow <= 1, `${locale} localization overflows by ${state.overflow}px.`);
    assert.equal(state.lang, locale === 'zh-cn' ? 'zh-Hans' : locale);
    if (locale === 'ar') assert.equal(state.dir, 'rtl', 'Arabic must render right-to-left.');
    console.log(`PASS localization ${locale}`);
  }

  const rangeInventory = [];
  for (const route of routes) {
    await open(route, 1440, 900, 'light');
    const ranges = await page.locator('input[type="range"]').count();
    for (let index = 0; index < ranges; index += 1) {
      const range = page.locator('input[type="range"]').nth(index);
      const id = await range.getAttribute('id') || `${route}#${index}`;
      const limits = await range.evaluate((input) => ({ min: Number(input.min || 0), max: Number(input.max || 100), step: Number(input.step || 1) }));
      const rawValues = [limits.min, limits.min + limits.step, ...[.25, .5, .6, .75, .88].map((p) => limits.min + p * (limits.max - limits.min)), limits.max - limits.step, limits.max];
      for (const raw of rawValues) {
        const value = Math.min(limits.max, Math.max(limits.min, Math.round(raw / limits.step) * limits.step));
        const state = await range.evaluate((input, next) => {
          input.value = String(next);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          const min = Number(input.min || 0); const max = Number(input.max || 100);
          return {
            value: Number(input.value),
            css: parseFloat(getComputedStyle(input).getPropertyValue('--range-progress')),
            expected: (Number(input.value) - min) / (max - min) * 100,
            shared: input.classList.contains('sf-range'),
          };
        }, value);
        assert.equal(state.value, value, `${id} value must update immediately.`);
        assert.ok(Math.abs(state.css - state.expected) < .001, `${id} fill ${state.css}% does not match ${state.expected}%.`);
        assert.ok(state.shared, `${id} must use the shared range geometry.`);
      }
      rangeInventory.push(`${route}:${id}`);
    }
  }
  assert.ok(rangeInventory.length >= 20, `Expected a complete range inventory, found ${rangeInventory.length}.`);
  console.log(`PASS ${rangeInventory.length} shared sliders at min/min+1/25/50/60/75/88/max-1/max`);

  await open('/pdf', 1440, 900, 'light');
  await page.locator('#pdf-input').setInputFiles(fixture);
  await page.locator('#pdf-work').waitFor({ state: 'visible' });
  const slider = page.locator('#pdf-strength');
  await slider.evaluate((input) => { input.value = '88'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await page.locator('#pdf-strength-output').textContent(), '88 · Strong');
  const focused = await slider.evaluate((input) => ({
    value: input.value,
    progress: getComputedStyle(input).getPropertyValue('--range-progress').trim(),
  }));
  assert.deepEqual({ value: focused.value, progress: focused.progress }, { value: '88', progress: '88%' });
  await slider.screenshot({ path: `${artifacts}/compress-pdf-slider-88.png` });
  await slider.focus();
  await page.keyboard.press('Home');
  assert.equal(await slider.inputValue(), '0');
  await page.keyboard.press('End');
  assert.equal(await slider.inputValue(), '100');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await slider.inputValue(), '99');
  await slider.evaluate((input) => { input.value = '88'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const box = await slider.boundingBox();
  assert.ok(box, 'Compression slider must have browser geometry.');
  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .6, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  const pointerState = await slider.evaluate((input) => ({ value: Number(input.value), css: parseFloat(getComputedStyle(input).getPropertyValue('--range-progress')) }));
  assert.ok(pointerState.value >= 55 && pointerState.value <= 65, `Pointer drag ended at ${pointerState.value}, expected about 60.`);
  assert.ok(Math.abs(pointerState.value - pointerState.css) < .001, 'Pointer drag must keep fill and thumb synchronized.');
  console.log('PASS focused 88% slider geometry, keyboard, and pointer input');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open('/edit-image', 390, 844, 'dark');
  assert.ok(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
  console.log('PASS reduced-motion mode');

  assert.deepEqual(diagnostics, [], `Browser diagnostics:\n${diagnostics.join('\n')}`);
  console.log('PASS console, asset, and runtime diagnostics');
} finally {
  await browser.close();
}
