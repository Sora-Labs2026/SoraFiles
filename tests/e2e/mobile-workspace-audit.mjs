import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FirefoxWebDriver, sleep } from './firefox-webdriver.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const baseUrl = process.env.SORA_BASE_URL ?? 'http://127.0.0.1:4355';
const fixtureDir = process.env.SORA_QA_FIXTURE_DIR ?? `${repoRoot}/tests/fixtures/sorafiles-qa`;
const screenshotDir = process.env.SORA_QA_MOBILE_SCREENSHOTS ?? `${repoRoot}/test-results/mobile-workspaces`;
const driver = new FirefoxWebDriver({ downloadDir: `${repoRoot}/test-results/mobile-workspaces/downloads` });
const qa = (name) => `${fixtureDir}/${name}`;

await mkdir(screenshotDir, { recursive: true });

async function openMobile(route) {
  await driver.setPageZoom(1).catch(() => {});
  await driver.setViewport(500, 844);
  await driver.navigate(`${baseUrl}/${route}`);
  const baseWidth = await driver.execute('return window.innerWidth;');
  if (Math.abs(baseWidth - 390) > 10) await driver.setPageZoom(baseWidth / 390);
  await driver.waitFor('h1');
  assert.ok(Math.abs((await driver.execute('return window.innerWidth;')) - 390) <= 12, `${route}: mobile viewport was not 390px.`);
  assert.equal((await driver.pageHealth()).overflow, false, `${route}: page has horizontal overflow.`);
  const dropHeight = await driver.execute('return document.querySelector(".sf-upload-dropzone")?.getBoundingClientRect().height || 0;');
  assert.ok(dropHeight > 120 && dropHeight <= 300, `${route}: upload zone is not mobile-compact (${dropHeight}px).`);
}

async function upload(route, input, fixture, ready) {
  await openMobile(route);
  await driver.setFiles(input, qa(fixture));
  await driver.waitFor(ready, { timeout: 120_000 });
  await driver.waitFor('[data-workspace-surface]', { timeout: 120_000 });
  await sleep(250);
  assert.equal((await driver.pageHealth()).overflow, false, `${route}: workspace caused horizontal overflow.`);
}

async function assertTabs(count) {
  const visible = await driver.execute(`return [...document.querySelectorAll('[data-workspace-mobile-nav] [data-mobile-panel]')].filter((node) => !node.hidden && getComputedStyle(node).display !== 'none').length;`);
  assert.equal(visible, count, `Expected ${count} visible mobile workspace tabs.`);
}

async function assertVisible(selector, minHeight = 40) {
  const box = await driver.execute(`const node=document.querySelector(${JSON.stringify(selector)}); if(!node)return null; const r=node.getBoundingClientRect(); const s=getComputedStyle(node); return {w:r.width,h:r.height,display:s.display,visibility:s.visibility};`);
  assert.ok(box && box.display !== 'none' && box.visibility !== 'hidden' && box.w > 100 && box.h >= minHeight, `${selector} is not usefully visible: ${JSON.stringify(box)}`);
}

async function assertOptionsWorkspace(route, input, fixture, ready, cta) {
  await upload(route, input, fixture, ready);
  await assertTabs(2);
  await assertVisible('[data-workspace-source]', 180);
  await driver.click('[data-mobile-panel="inspector"]');
  await assertVisible('[data-workspace-inspector]', 300);
  assert.equal(await driver.execute('return getComputedStyle(document.querySelector("[data-workspace-source]")).display;'), 'none');
  const fontSize = await driver.execute('const node=document.querySelector("[data-workspace-inspector] input:not([type=range]):not([type=radio]):not([type=checkbox]),[data-workspace-inspector] select"); return node ? parseFloat(getComputedStyle(node).fontSize) : 16;');
  assert.ok(fontSize >= 16, `${route}: form controls can trigger iOS focus zoom (${fontSize}px).`);
  await assertVisible(cta, 44);
}

try {
  const capabilities = await driver.start();
  console.log(`Firefox ${capabilities.browserVersion}: mobile workspace audit at ${baseUrl}`);

  await assertOptionsWorkspace('compress-image', '#file-input', 'landscape.jpg', '#work-state', '#process-file');
  await assertOptionsWorkspace('image-converter', '#converter-input', 'landscape.jpg', '#converter-work', '#converter-submit');
  await assertOptionsWorkspace('pdf', '#pdf-input', 'mixed-content.pdf', '#pdf-work', '#pdf-process');
  await assertOptionsWorkspace('pdf-to-jpg', '#action-input', 'native-text-3-pages.pdf', '#action-work', '#action-process');

  await upload('doc-scanner', '[data-scanner-input]', 'photographed-document.png', '[data-scanner-workspace]');
  await assertTabs(3);
  await driver.click('[data-mobile-panel="inspector"]');
  await assertVisible('.scanner-preview-panel', 140);
  await assertVisible('.scanner-inspector-panel', 220);
  const scannerSource = await driver.execute('return document.querySelector("[data-scanner-preview]")?.currentSrc || "";');
  await driver.setValue('[data-scanner-adjustment="exposure"]', '30');
  await driver.waitUntil('return (document.querySelector("[data-scanner-preview]")?.currentSrc || "") !== arguments[0]', [scannerSource], 120_000, 'scanner mobile live preview');
  await driver.screenshot(`${screenshotDir}/doc-scanner-live-preview.png`);

  await upload('edit-image', '[data-extra-input]', 'landscape.jpg', '[data-edit-editor]');
  await assertTabs(2);
  await driver.click('[data-mobile-panel="inspector"]');
  await assertVisible('[data-edit-editor] [data-workspace-canvas]', 120);
  await assertVisible('[data-edit-editor] [data-workspace-inspector]', 170);
  await driver.setValue('[data-edit-control="exposure"]', '25');
  await driver.screenshot(`${screenshotDir}/edit-image-live-preview.png`);

  await upload('resize-image', '[data-resize-input]', 'landscape.jpg', '[data-resize-editor]');
  await assertTabs(2);
  await driver.click('[data-mobile-panel="inspector"]');
  await assertVisible('[data-resize-stage]', 120);
  await assertVisible('.resize-canvas-workspace [data-workspace-inspector]', 180);
  await assertVisible('[data-resize-run]', 44);
  await driver.screenshot(`${screenshotDir}/resize-image-controls.png`);

  await upload('sign-pdf', '#action-input', 'native-text-3-pages.pdf', '#action-work');
  await driver.waitUntil('return Boolean(document.querySelector("[data-pdf-workspace-summary]")?.textContent?.trim())', [], 120_000, 'PDF page workspace');
  await assertTabs(3);
  await driver.click('[data-mobile-panel="inspector"]');
  await assertVisible('.has-visual-pdf [data-workspace-source]', 120);
  await assertVisible('.has-visual-pdf [data-workspace-inspector]', 180);
  await driver.screenshot(`${screenshotDir}/sign-pdf-live-workspace.png`);

  await upload('remove-background', '[data-background-input]', 'background-subject.png', '[data-background-editor]');
  assert.equal(await driver.execute('return document.querySelector("[data-workspace-mobile-nav]").hidden;'), true, 'Simple background removal should not show empty workspace tabs.');
  const comparison = await driver.execute('const n=document.querySelector("[data-background-comparison]"); return {client:n.clientWidth,scroll:n.scrollWidth,snap:getComputedStyle(n).scrollSnapType};');
  assert.ok(comparison.scroll > comparison.client && comparison.snap.includes('mandatory'), `Background comparison is not swipeable: ${JSON.stringify(comparison)}`);
  await assertVisible('[data-background-process]', 44);

  await upload('protect-pdf', '[data-extra-input]', 'native-text-3-pages.pdf', '[data-extra-selected]');
  assert.equal(await driver.execute('return document.querySelector("[data-workspace-mobile-nav]");'), null, 'Quick tools should not render redundant tabs.');
  await driver.execute('document.querySelector("[data-workspace-body]").scrollTo(0, document.querySelector("[data-workspace-body]").scrollHeight);');
  await assertVisible('[data-extra-start]', 44);

  console.log('MOBILE WORKSPACE AUDIT PASS: all shared workspace families passed at 390×844.');
} finally {
  await driver.stop();
}
