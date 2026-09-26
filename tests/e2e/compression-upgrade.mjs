import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FirefoxWebDriver } from './firefox-webdriver.mjs';
import { extractPdfText, validatePdf } from './output-validators.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const fixtures = `${root}/tests/fixtures/sorafiles-qa`;
const downloads = `${root}/test-results/compression-upgrade/downloads`;
const baseUrl = process.env.SORA_BASE_URL ?? 'http://127.0.0.1:4329';
await mkdir(downloads, { recursive: true });

const driver = new FirefoxWebDriver({ downloadDir: downloads, port: 4452 });

async function download(selector, timeout = 240_000) {
  const path = await driver.waitForDownload(() => driver.click(selector), { timeout });
  return { path, bytes: await readFile(path) };
}

async function open(route) {
  await driver.navigate(`${baseUrl}/${route}`);
  await driver.waitFor('h1');
  await driver.installPrivacyProbe();
}

async function assertPrivate() {
  const requests = await driver.privacyRequests();
  assert.deepEqual(requests.filter(({ method }) => !['GET', 'HEAD'].includes(method)), []);
}

try {
  await driver.start();

  await open('compress-image');
  await driver.setFiles('#file-input', `${fixtures}/landscape.jpg`);
  await driver.waitFor('#work-state');
  assert.equal(await driver.value('#compression-strength'), '60');
  assert.match(await driver.text('#strength-output'), /Balanced/);
  const originalJpeg = await readFile(`${fixtures}/landscape.jpg`);
  const originalInspection = await driver.inspectImage(originalJpeg, 'image/jpeg');
  await driver.click('#process-file');
  await driver.waitFor('#result-state', { timeout: 180_000 });
  const jpeg = await download('#download-result');
  const jpegInspection = await driver.inspectImage(jpeg.bytes, 'image/jpeg');
  assert.deepEqual([jpegInspection.width, jpegInspection.height], [originalInspection.width, originalInspection.height]);
  assert.match(await driver.text('#result-warning'), /compression used|original file unchanged/);
  await assertPrivate();
  console.log('PASS balanced JPEG compression preserves dimensions and passes its quality guard');

  await open('compress-image');
  await driver.setFiles('#file-input', `${fixtures}/transparency.png`);
  await driver.waitFor('#work-state');
  assert.equal(await driver.value('#output-format'), 'image/png');
  await driver.click('#process-file');
  await driver.waitFor('#result-state', { timeout: 180_000 });
  const png = await download('#download-result');
  const pngInspection = await driver.inspectImage(png.bytes, 'image/png');
  assert.ok(pngInspection.transparent > 0, 'Transparent PNG pixels must survive compression.');
  assert.match(await driver.text('#result-warning'), /stayed lossless|original file unchanged/);
  await assertPrivate();
  console.log('PASS lossless PNG compression preserves transparency');

  await open('compress-image');
  await driver.setFiles('#file-input', `${fixtures}/portrait.jpg`);
  await driver.waitFor('#work-state');
  await driver.setValue('#compression-strength', 95);
  assert.match(await driver.text('#strength-output'), /Maximum safe/);
  const strongOriginal = await readFile(`${fixtures}/portrait.jpg`);
  const strongOriginalInspection = await driver.inspectImage(strongOriginal, 'image/jpeg');
  await driver.click('#process-file');
  await driver.waitFor('#result-state', { timeout: 180_000 });
  const strongJpeg = await download('#download-result');
  const strongInspection = await driver.inspectImage(strongJpeg.bytes, 'image/jpeg');
  assert.deepEqual([strongInspection.width, strongInspection.height], [strongOriginalInspection.width, strongOriginalInspection.height]);
  assert.match(await driver.text('#result-warning'), /Maximum safe|screenshot protection|original file unchanged/);
  await assertPrivate();
  console.log('PASS maximum-safe JPEG profile remains bounded and preserves dimensions');

  await open('compress-image');
  await driver.setFiles('#file-input', `${fixtures}/webp-image.webp`);
  await driver.waitFor('#work-state');
  assert.equal(await driver.value('#output-format'), 'image/webp');
  const originalWebp = await readFile(`${fixtures}/webp-image.webp`);
  const originalWebpInspection = await driver.inspectImage(originalWebp, 'image/webp');
  await driver.click('#process-file');
  await driver.waitFor('#result-state', { timeout: 180_000 });
  const webp = await download('#download-result');
  const webpInspection = await driver.inspectImage(webp.bytes, 'image/webp');
  assert.deepEqual([webpInspection.width, webpInspection.height], [originalWebpInspection.width, originalWebpInspection.height]);
  assert.match(await driver.text('#result-warning'), /compression used|original file unchanged/);
  await assertPrivate();
  console.log('PASS jSquash WebP compression preserves format and dimensions');

  await open('pdf');
  await driver.setFiles('#pdf-input', `${fixtures}/native-text-3-pages.pdf`);
  await driver.waitFor('#pdf-work');
  assert.equal(await driver.value('#pdf-strength'), '60');
  await driver.click('#pdf-process');
  await driver.waitFor('#pdf-result', { timeout: 180_000 });
  const nativePdf = await download('#pdf-download');
  await validatePdf(nativePdf.bytes, { pageCount: 3 });
  assert.match(await extractPdfText(nativePdf.bytes), /SORAFILES QA PAGE 3/i);
  assert.match(await driver.text('#pdf-result-stats'), /original retained|smaller/);
  assert.match(await driver.text('#pdf-result-warning'), /Selectable text was detected and preserved/);
  await assertPrivate();
  console.log('PASS native-text PDF keeps page count and selectable text');

  await open('pdf');
  await driver.setFiles('#pdf-input', `${fixtures}/scanned-document.pdf`);
  await driver.waitFor('#pdf-work');
  await driver.click('#pdf-process');
  await driver.waitFor('#pdf-result', { timeout: 300_000 });
  const scannedPdf = await download('#pdf-download', 180_000);
  await validatePdf(scannedPdf.bytes, { pageCount: 2 });
  const scannedMessage = await driver.text('#pdf-result-warning');
  assert.doesNotMatch(scannedMessage, /Image optimization was unavailable/);
  assert.match(`${await driver.text('#pdf-result-stats')} ${scannedMessage}`, /compression|safest setting|safer result/i);
  await assertPrivate();
  console.log('PASS Ghostscript browser-WASM path executes on a scanned PDF and returns a valid fallback-safe result');

  await open('pdf');
  await driver.setFiles('#pdf-input', `${fixtures}/form-or-link.pdf`);
  await driver.waitFor('#pdf-work');
  await driver.click('#pdf-process');
  await driver.waitFor('#pdf-result', { timeout: 180_000 });
  const protectedPdf = await download('#pdf-download');
  await validatePdf(protectedPdf.bytes);
  assert.match(await driver.text('#pdf-result-warning'), /Important PDF features were detected/);
  await assertPrivate();
  console.log('PASS interactive PDF is routed away from image recompression');

  for (const [route, chooser] of [
    ['merge-pdf', '#action-choose'],
    ['split-pdf', '#action-choose'],
    ['rotate-pdf', '#action-choose'],
    ['jpg-to-pdf', '#action-choose'],
    ['pdf-to-jpg', '#action-choose'],
    ['resize-image', '[data-resize-choose]'],
    ['image-converter', '#converter-choose'],
    ['pdf-ocr', '[data-extra-drop]'],
  ]) {
    await open(route);
    const health = await driver.pageHealth();
    assert.equal(health.h1, 1, `${route} must keep exactly one H1.`);
    assert.equal(health.overflow, false, `${route} must not have horizontal overflow.`);
    assert.ok(await driver.exists(chooser), `${route} chooser must remain available.`);
    console.log(`PASS surrounding-tool route smoke: ${route}`);
  }
} finally {
  await driver.stop();
}
