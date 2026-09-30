import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { FirefoxWebDriver, sleep } from './firefox-webdriver.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const baseUrl = process.env.SORA_BASE_URL ?? 'http://127.0.0.1:4384';
const resultDir = `${root}/test-results/v4-regressions`;
const fixture = `${root}/tests/fixtures/sorafiles-qa/mixed-content.pdf`;
await mkdir(resultDir, { recursive: true });

const assets = await readdir(`${root}/dist/_astro`);
const workerName = assets.find((name) => /^pdf\.worker\.min\..+\.mjs$/.test(name));
assert.ok(workerName, 'Built PDF.js worker asset was not found.');
const workerPath = `${root}/dist/_astro/${workerName}`;
const workerSource = await readFile(workerPath, 'utf8');
assert.match(workerSource, /getOrInsertComputed|toHex/, 'PDF.js worker does not contain the expected compatibility surface.');

const driver = new FirefoxWebDriver({ downloadDir: `${resultDir}/downloads`, port: 4465 });
const reducedDriver = new FirefoxWebDriver({
  downloadDir: `${resultDir}/reduced-downloads`,
  port: 4466,
  prefs: { 'ui.prefersReducedMotion': 1 },
});

try {
  // Emulate an older worker global before PDF.js evaluates. The official
  // compatibility entry must feature-detect and install its own fallbacks.
  await writeFile(workerPath, `delete Uint8Array.prototype.toHex; delete Map.prototype.getOrInsertComputed;\n${workerSource}`);

  const capabilities = await driver.start();
  await driver.navigate(`${baseUrl}/pdf`);
  await driver.waitFor('#pdf-input', { visible: false });
  const removed = await driver.execute('delete Uint8Array.prototype.toHex; delete Map.prototype.getOrInsertComputed; return [typeof Uint8Array.prototype.toHex, typeof Map.prototype.getOrInsertComputed];');
  assert.deepEqual(removed, ['undefined', 'undefined']);
  await driver.setFiles('#pdf-input', fixture);
  await driver.waitFor('#pdf-work', { timeout: 120_000 });
  assert.equal(await driver.execute('return document.querySelector("#pdf-file-error").hidden;'), true);
  await driver.setValue('#pdf-strength', 100);
  await driver.check('#pdf-smallest-opt-in');
  await driver.click('#pdf-process');
  await driver.waitFor('#pdf-result', { timeout: 240_000 });
  const outputPath = await driver.waitForDownload(() => driver.click('#pdf-download'), { timeout: 120_000 });
  const output = await readFile(outputPath);
  const pdf = await PDFDocument.load(output);
  assert.equal(pdf.getPageCount(), 2);
  await driver.screenshot(`${resultDir}/compress-pdf-old-runtime-pass.png`);

  await driver.navigate(`${baseUrl}/`);
  await driver.waitFor('[data-scene-id="split-pdf"]');
  await driver.clickJs('[data-scene-id="rotate-pdf"]');
  await sleep(100);
  await driver.clickJs('[data-scene-id="split-pdf"]');
  await sleep(1_150);
  const inputPhase = await driver.execute(`
    const scene=document.querySelector('[data-scene="split-pdf"]');
    return {activeScene:document.querySelector('[data-hero-visualization]').dataset.activeScene,active:scene.dataset.sceneActive,hidden:scene.hidden,input:Number(getComputedStyle(scene.querySelector('.sf-split-input')).opacity),pages:[...scene.querySelectorAll('.sf-split-page')].map((node)=>Number(getComputedStyle(node).opacity))};
  `);
  assert.equal(inputPhase.activeScene, 'split-pdf');
  assert.equal(inputPhase.active, 'true');
  assert.equal(inputPhase.hidden, false);
  assert.ok(inputPhase.input > 0.8, `Split input should be visible, opacity ${inputPhase.input}.`);
  assert.ok(inputPhase.pages.every((opacity) => opacity < 0.05), `Split pages appeared before separation: ${inputPhase.pages}.`);
  await sleep(1_200);
  const outputPhase = await driver.execute(`return {input:Number(getComputedStyle(document.querySelector('.sf-split-input')).opacity),pages:[...document.querySelectorAll('[data-scene="split-pdf"] .sf-split-page')].map((node)=>({opacity:Number(getComputedStyle(node).opacity),animation:getComputedStyle(node).animationName,center:node.getBoundingClientRect().x+node.getBoundingClientRect().width/2}))};`);
  assert.ok(outputPhase.input < 0.05, `Split input should be hidden after separation, opacity ${outputPhase.input}.`);
  assert.ok(outputPhase.pages.every((page) => page.opacity > 0.8), `Split pages should be visible after separation: ${JSON.stringify(outputPhase.pages)}.`);
  assert.deepEqual(outputPhase.pages.map((page) => page.animation), ['sf-hero-split-page', 'sf-hero-split-page', 'sf-hero-split-page']);
  assert.ok(outputPhase.pages[1].center - outputPhase.pages[0].center > 50 && outputPhase.pages[2].center - outputPhase.pages[1].center > 50, `Split pages did not move into distinct results: ${JSON.stringify(outputPhase.pages)}.`);
  await driver.clickJs('[data-scene-id="rotate-pdf"]');
  assert.equal(await driver.execute(`return document.querySelector('[data-hero-visualization]').dataset.activeScene;`), 'rotate-pdf');
  await driver.clickJs('[data-scene-id="split-pdf"]');
  await sleep(1_150);
  assert.ok(await driver.execute(`return Number(getComputedStyle(document.querySelector('[data-scene="split-pdf"] .sf-split-input')).opacity) > .8;`), 'Split input did not restart after returning from Rotate PDF.');
  await driver.screenshot(`${resultDir}/split-pdf-synchronized-pass.png`);

  const reducedCapabilities = await reducedDriver.start();
  await reducedDriver.navigate(`${baseUrl}/`);
  await reducedDriver.waitFor('[data-scene-id="split-pdf"]');
  assert.equal(await reducedDriver.execute('return matchMedia("(prefers-reduced-motion: reduce)").matches;'), true);
  const reducedState = await reducedDriver.execute(`
    const scene=document.querySelector('[data-scene="split-pdf"]');
    return {activeScene:document.querySelector('[data-hero-visualization]').dataset.activeScene,title:document.querySelector('[data-hero-scene-title]').textContent,input:Number(getComputedStyle(scene.querySelector('.sf-split-input')).opacity),inputAnimation:getComputedStyle(scene.querySelector('.sf-split-input')).animationName,pages:[...scene.querySelectorAll('.sf-split-page')].map((node)=>({opacity:Number(getComputedStyle(node).opacity),animation:getComputedStyle(node).animationName,center:node.getBoundingClientRect().x+node.getBoundingClientRect().width/2}))};
  `);
  assert.equal(reducedState.activeScene, 'split-pdf');
  assert.match(reducedState.title, /Split PDF/i);
  assert.equal(reducedState.input, 0);
  assert.equal(reducedState.inputAnimation, 'none');
  assert.deepEqual(reducedState.pages.map((item) => item.opacity), [1, 1, 1]);
  assert.deepEqual(reducedState.pages.map((item) => item.animation), ['none', 'none', 'none']);
  assert.ok(reducedState.pages[1].center - reducedState.pages[0].center > 50 && reducedState.pages[2].center - reducedState.pages[1].center > 50, `Reduced-motion Split pages are not separated: ${JSON.stringify(reducedState.pages)}.`);
  await sleep(4_500);
  assert.match(await reducedDriver.text('[data-hero-scene-title]'), /Split PDF/i, 'Reduced-motion mode should not auto-advance.');

  console.log(`V4 REGRESSIONS PASS: Firefox ${capabilities.browserVersion}; reduced-motion Firefox ${reducedCapabilities.browserVersion}; old-runtime PDF output ${output.length} bytes.`);
} finally {
  await writeFile(workerPath, workerSource);
  await driver.stop();
  await reducedDriver.stop();
}
