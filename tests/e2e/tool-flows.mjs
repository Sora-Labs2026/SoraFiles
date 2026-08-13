import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { baseUrl, ensureAstroServer } from './run-server.mjs';
import { extractPdfText, validateDocx, validateImageInBrowser, validatePdf, validateZip } from './output-validators.mjs';

const routes = [
  { path: '/image-converter', chooser: '#converter-choose' },
  { path: '/compress-image', chooser: '#choose-file' },
  { path: '/heic-to-jpg', chooser: '#choose-file' },
  { path: '/pdf', chooser: '#pdf-choose' },
  { path: '/merge-pdf', chooser: '#action-choose' },
  { path: '/split-pdf', chooser: '#action-choose' },
  { path: '/rotate-pdf', chooser: '#action-choose' },
  { path: '/jpg-to-pdf', chooser: '#action-choose' },
  { path: '/pdf-to-jpg', chooser: '#action-choose' },
  { path: '/pdf-to-word', chooser: '#action-choose' },
  { path: '/word-to-pdf', chooser: '#action-choose' },
];

const fixturePath = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function runSmoke(page) {
  for (const route of routes) {
    const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `${route.path} returned ${response?.status() ?? 'no response'}.`);
    assert.equal(await page.locator('h1').count(), 1, `${route.path} must render exactly one H1.`);
    assert.equal(await page.locator('input[type="file"]').count(), 1, `${route.path} must render one file input.`);
    const chooser = page.locator(route.chooser);
    assert.equal(await chooser.count(), 1, `${route.path} must render its chooser.`);
    assert.ok(await chooser.isEnabled(), `${route.path} chooser must be enabled.`);
    console.log(`PASS route smoke ${route.path}`);
  }
}

async function runPdfToWord(page, fixtureName = 'text') {
  const fixture = fixtureName === 'cmap'
    ? { file: 'mozilla-cmap-gbkp-euc-h.pdf', expected: '我们都是黑体字', secondExpected: undefined }
    : { file: 'text-two-page.pdf', expected: 'Sora Files page one', secondExpected: 'Sora Files page two' };
  const diagnostics = [];
  page.on('console', (message) => diagnostics.push(`console:${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.stack ?? error.message}`));
  page.on('requestfailed', (request) => diagnostics.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`));

  await page.goto(`${baseUrl}/pdf-to-word`, { waitUntil: 'domcontentloaded' });
  await page.locator('#action-input').setInputFiles(fixturePath(fixture.file));
  await page.locator('#action-work').waitFor({ state: 'visible' });
  await page.locator('#fidelity-confirm').check();
  await page.locator('#action-process').click();

  try {
    await page.locator('#action-result').waitFor({ state: 'visible', timeout: 60_000 });
  } catch (error) {
    const status = await page.locator('#action-status').textContent();
    throw new Error(`PDF to Word did not produce a result. Status: ${status}\n${diagnostics.join('\n')}`, { cause: error });
  }

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#action-download').click(),
  ]);
  assert.match(download.suggestedFilename(), /\.docx$/i, 'PDF to Word must download a DOCX file.');
  const downloadPath = await download.path();
  assert.ok(downloadPath, 'Browser download path must be available.');
  const { text } = await validateDocx(await readFile(downloadPath), fixture.expected);
  if (fixture.secondExpected) {
    assert.match(text, new RegExp(fixture.secondExpected, 'i'), 'DOCX must contain text from the second PDF page.');
  }
  console.log(`PASS pdf-to-word ${download.suggestedFilename()} (${text.trim().length} extracted characters)`);
}

async function runPdfToWordNoText(page) {
  await page.goto(`${baseUrl}/pdf-to-word`, { waitUntil: 'domcontentloaded' });
  await page.locator('#action-input').setInputFiles(fixturePath('blank-page.pdf'));
  await page.locator('#action-work').waitFor({ state: 'visible' });
  await page.locator('#fidelity-confirm').check();
  await page.locator('#action-process').click();
  try {
    await page.waitForFunction(() => document.querySelector('#action-status')?.textContent?.includes('No selectable text was found'), undefined, { timeout: 30_000 });
  } catch (error) {
    throw new Error(`No-text recovery message was not shown. Status: ${await page.locator('#action-status').textContent()}`, { cause: error });
  }
  assert.ok(await page.locator('#action-result').isHidden(), 'A no-text PDF must not expose a download result.');
  console.log('PASS pdf-to-word no-text recovery');
}

async function processDocumentAction(page, { route, files, configure }) {
  await page.goto(`${baseUrl}/${route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#action-input').setInputFiles(files.map((file) => typeof file === 'string' ? fixturePath(file) : file));
  await page.locator('#action-work').waitFor({ state: 'visible' });
  if (configure) await configure(page);
  await page.locator('#action-process').click();
  try {
    await page.locator('#action-result').waitFor({ state: 'visible', timeout: 60_000 });
  } catch (error) {
    throw new Error(`${route} did not produce a result. Status: ${await page.locator('#action-status').textContent()}`, { cause: error });
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#action-download').click(),
  ]);
  const path = await download.path();
  assert.ok(path, `${route} download path must be available.`);
  return {
    buffer: await readFile(path),
    filename: download.suggestedFilename(),
    stats: await page.locator('#action-result-stats').textContent(),
  };
}

async function runDocumentActions(page) {
  const merge = await processDocumentAction(page, {
    route: 'merge-pdf',
    files: ['minimal.pdf', 'minimal-2.pdf'],
  });
  assert.match(merge.filename, /\.pdf$/i);
  await validatePdf(merge.buffer, { pageCount: 2 });
  console.log(`PASS merge-pdf ${merge.filename} ${merge.stats}`);

  const split = await processDocumentAction(page, {
    route: 'split-pdf',
    files: ['text-two-page.pdf'],
  });
  assert.match(split.filename, /\.zip$/i);
  const splitZip = validateZip(split.buffer, /^page-\d{3}\.pdf$/i);
  assert.equal(splitZip.names.length, 2, 'Split PDF must create one output per page.');
  for (const name of splitZip.names) await validatePdf(splitZip.entries[name], { pageCount: 1 });
  console.log(`PASS split-pdf ${split.filename} ${split.stats}`);

  const rotate = await processDocumentAction(page, {
    route: 'rotate-pdf',
    files: ['text-two-page.pdf'],
    configure: async (currentPage) => currentPage.locator('#rotate-angle').selectOption('90'),
  });
  await validatePdf(rotate.buffer, { pageCount: 2, rotation: 90 });
  console.log(`PASS rotate-pdf ${rotate.filename} ${rotate.stats}`);

  const imagesToPdf = await processDocumentAction(page, {
    route: 'jpg-to-pdf',
    files: ['sample.jpg'],
  });
  const imagePdf = await validatePdf(imagesToPdf.buffer, { pageCount: 1 });
  const imagePageSize = imagePdf.pages[0].getSize();
  assert.ok(imagePageSize.width > 0 && imagePageSize.height > 0, 'JPG to PDF page must have positive dimensions.');
  console.log(`PASS jpg-to-pdf ${imagesToPdf.filename} ${imagesToPdf.stats}`);

  const pdfToImages = await processDocumentAction(page, {
    route: 'pdf-to-jpg',
    files: ['text-two-page.pdf'],
  });
  const imageZip = validateZip(pdfToImages.buffer, /^page-\d{3}\.jpg$/i);
  assert.equal(imageZip.names.length, 2, 'PDF to JPG must create one image per page.');
  for (const name of imageZip.names) await validateImageInBrowser(page, imageZip.entries[name], 'image/jpeg');
  console.log(`PASS pdf-to-jpg ${pdfToImages.filename} ${pdfToImages.stats}`);

  await runPdfToWord(page);
  await runPdfToWordNoText(page);

  const wordToPdf = await processDocumentAction(page, {
    route: 'word-to-pdf',
    files: ['single-paragraph.docx'],
    configure: async (currentPage) => currentPage.locator('#fidelity-confirm').check(),
  });
  const wordPdf = await validatePdf(wordToPdf.buffer);
  assert.ok(wordPdf.pageCount >= 1, 'Word to PDF must create at least one page.');
  assert.match(await extractPdfText(wordToPdf.buffer), /Walking on imported air/i, 'Word to PDF must preserve readable fixture text.');
  console.log(`PASS word-to-pdf ${wordToPdf.filename} ${wordToPdf.stats}`);
}

async function runInvalidDocumentSignatures(page) {
  const cases = [
    ['merge-pdf', 'forged.pdf', 'application/pdf'],
    ['split-pdf', 'forged.pdf', 'application/pdf'],
    ['rotate-pdf', 'forged.pdf', 'application/pdf'],
    ['jpg-to-pdf', 'forged.jpg', 'image/jpeg'],
    ['pdf-to-jpg', 'forged.pdf', 'application/pdf'],
    ['pdf-to-word', 'forged.pdf', 'application/pdf'],
    ['word-to-pdf', 'forged.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ];
  for (const [route, name, mimeType] of cases) {
    await page.goto(`${baseUrl}/${route}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#action-input').setInputFiles({ name, mimeType, buffer: Buffer.from('not a real file') });
    await page.locator('#action-error').waitFor({ state: 'visible' });
    assert.match((await page.locator('#action-error').textContent()) ?? '', /not a valid|valid DOCX/i, `${route} must explain the invalid signature.`);
    assert.ok(await page.locator('#action-result').isHidden(), `${route} must not expose a forged-file result.`);
    console.log(`PASS invalid signature ${route}`);
  }
}

async function processImageConversion(page, { file, outputMime }) {
  await page.goto(`${baseUrl}/image-converter`, { waitUntil: 'domcontentloaded' });
  await page.locator('#converter-input').setInputFiles(fixturePath(file));
  try {
    await page.locator('#converter-work').waitFor({ state: 'visible', timeout: 60_000 });
  } catch (error) {
    throw new Error(`Image converter could not load ${file}. Error: ${await page.locator('#converter-error').textContent()}`, { cause: error });
  }
  await page.locator('#converter-format').selectOption(outputMime);
  await page.locator('#converter-submit').click();
  try {
    await page.locator('#converter-result').waitFor({ state: 'visible', timeout: 60_000 });
  } catch (error) {
    throw new Error(`Image converter did not produce ${outputMime}. Status: ${await page.locator('#converter-status').textContent()}`, { cause: error });
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#converter-download').click(),
  ]);
  const path = await download.path();
  assert.ok(path, 'Image converter download path must be available.');
  return {
    buffer: await readFile(path),
    filename: download.suggestedFilename(),
    stats: await page.locator('#converter-stats').textContent(),
  };
}

function assertImageSignature(buffer, mime) {
  if (mime === 'image/png') {
    assert.deepEqual(Array.from(buffer.subarray(0, 4)), [0x89, 0x50, 0x4e, 0x47], 'PNG signature must match.');
  } else if (mime === 'image/jpeg') {
    assert.deepEqual(Array.from(buffer.subarray(0, 3)), [0xff, 0xd8, 0xff], 'JPG signature must match.');
  } else if (mime === 'image/webp') {
    assert.equal(buffer.subarray(0, 4).toString('ascii'), 'RIFF', 'WebP must start with RIFF.');
    assert.equal(buffer.subarray(8, 12).toString('ascii'), 'WEBP', 'WebP container signature must match.');
  }
}

async function runImageConverter(page) {
  for (const [outputMime, extension] of [['image/png', 'png'], ['image/webp', 'webp'], ['image/jpeg', 'jpg']]) {
    const result = await processImageConversion(page, { file: 'sample.jpg', outputMime });
    assert.match(result.filename, new RegExp(`\\.${extension}$`, 'i'));
    assertImageSignature(result.buffer, outputMime);
    const dimensions = await validateImageInBrowser(page, result.buffer, outputMime);
    console.log(`PASS image-converter JPG to ${extension.toUpperCase()} ${dimensions.width}x${dimensions.height} ${result.stats}`);
  }

  const heic = await processImageConversion(page, { file: 'libheif-example.heic', outputMime: 'image/jpeg' });
  assert.match(heic.filename, /\.jpg$/i);
  assertImageSignature(heic.buffer, 'image/jpeg');
  const heicDimensions = await validateImageInBrowser(page, heic.buffer, 'image/jpeg');
  console.log(`PASS image-converter HEIC to JPG ${heicDimensions.width}x${heicDimensions.height} ${heic.stats}`);

  const unsupportedCases = [
    { name: 'corrupted.heic', mimeType: 'image/heic', expected: /supported image signature/i },
    { name: 'unknown.bin', mimeType: 'application/octet-stream', expected: /supported image signature/i },
    { name: 'camera.cr2', mimeType: 'image/x-canon-cr2', expected: /camera RAW format/i },
    { name: 'layout.indd', mimeType: 'application/x-indesign', expected: /InDesign document, not an image/i },
  ];
  for (const current of unsupportedCases) {
    await page.goto(`${baseUrl}/image-converter`, { waitUntil: 'domcontentloaded' });
    await page.locator('#converter-input').setInputFiles({ name: current.name, mimeType: current.mimeType, buffer: Buffer.from('not a real image') });
    await page.locator('#converter-error').waitFor({ state: 'visible' });
    assert.match((await page.locator('#converter-error').textContent()) ?? '', current.expected);
    assert.ok(await page.locator('#converter-result').isHidden(), `${current.name} must not expose a result.`);
    console.log(`PASS image-converter rejected ${current.name}`);
  }
}

async function generatePngFixture(page, transparent) {
  const base64 = await page.evaluate(async (withTransparency) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas fixture generation is unavailable.');
    const image = context.createImageData(canvas.width, canvas.height);
    let seed = withTransparency ? 20260812 : 20260811;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const index = (y * canvas.width + x) * 4;
        image.data[index] = (x + (seed & 63)) & 255;
        image.data[index + 1] = (y + ((seed >>> 8) & 63)) & 255;
        image.data[index + 2] = Math.floor((x + y) / 2 + ((seed >>> 16) & 63)) & 255;
        image.data[index + 3] = withTransparency && (x + y) % 9 === 0 ? 96 : 255;
      }
    }
    context.putImageData(image, 0, 0);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG fixture encoding failed.')), 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }, transparent);
  return Buffer.from(base64, 'base64');
}

async function processImageCompression(page, { input, mode = 'auto', outputMime, targetKb, reductionPercent, route = 'compress-image' }) {
  await page.goto(`${baseUrl}/${route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#file-input').setInputFiles(input);
  try {
    await page.locator('#work-state').waitFor({ state: 'visible', timeout: 60_000 });
  } catch (error) {
    throw new Error(`Image compressor could not load input. Error: ${await page.locator('#file-error').textContent()}`, { cause: error });
  }
  await page.locator(`input[name="mode"][value="${mode}"]`).check({ force: true });
  if (outputMime) await page.locator('#output-format').selectOption(outputMime);
  if (targetKb !== undefined) await page.locator('#target-kb').fill(String(targetKb));
  if (reductionPercent !== undefined) await page.locator('#reduction-percent').fill(String(reductionPercent));
  await page.locator('#process-file').click();
  try {
    await page.locator('#result-state').waitFor({ state: 'visible', timeout: 90_000 });
  } catch (error) {
    throw new Error(`Image compressor did not produce a result. Status: ${await page.locator('#process-status').textContent()}`, { cause: error });
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#download-result').click(),
  ]);
  const path = await download.path();
  assert.ok(path, 'Image compressor download path must be available.');
  return {
    buffer: await readFile(path),
    filename: download.suggestedFilename(),
    stats: (await page.locator('#result-stats').textContent()) ?? '',
    warning: (await page.locator('#result-warning').textContent()) ?? '',
    outputMime: await page.locator('#output-format').inputValue(),
  };
}

async function runImageCompression(page) {
  const sourceJpg = await readFile(fixturePath('sample.jpg'));
  const auto = await processImageCompression(page, { input: fixturePath('sample.jpg') });
  assert.ok(auto.buffer.length <= sourceJpg.length * 0.8, `Auto JPG must save at least 20%; got ${auto.buffer.length}/${sourceJpg.length} bytes. Warning: ${auto.warning}`);
  await validateImageInBrowser(page, auto.buffer, auto.outputMime);
  console.log(`PASS compress-image Auto JPG ${auto.stats}`);

  const targetKb = 40;
  const target = await processImageCompression(page, { input: fixturePath('sample.jpg'), mode: 'target', outputMime: 'image/webp', targetKb });
  assert.ok(target.buffer.length <= targetKb * 1000 * 0.97 || /could not be reached/i.test(target.warning), 'Target mode must meet its safety margin or explain the miss.');
  await validateImageInBrowser(page, target.buffer, 'image/webp');
  console.log(`PASS compress-image Target ${target.stats}`);

  const reductionPercent = 25;
  const reduced = await processImageCompression(page, { input: fixturePath('sample.jpg'), mode: 'percent', outputMime: 'image/webp', reductionPercent });
  assert.ok(reduced.buffer.length <= sourceJpg.length * 0.75 || /could not be reached/i.test(reduced.warning), 'Reduce-by mode must use source bytes or explain the miss.');
  await validateImageInBrowser(page, reduced.buffer, 'image/webp');
  console.log(`PASS compress-image Reduce by ${reduced.stats}`);

  await page.goto(`${baseUrl}/compress-image`, { waitUntil: 'domcontentloaded' });
  const opaquePng = await generatePngFixture(page, false);
  const transparentPng = await generatePngFixture(page, true);

  const targetSwitch = await processImageCompression(page, {
    input: { name: 'opaque.png', mimeType: 'image/png', buffer: opaquePng },
    mode: 'target',
    targetKb: 250,
  });
  assert.equal(targetSwitch.outputMime, 'image/webp', 'Choosing Target from PNG Auto must switch to a target-capable format immediately.');
  console.log(`PASS compress-image PNG target-mode switch ${targetSwitch.stats}`);

  const opaque = await processImageCompression(page, {
    input: { name: 'opaque.png', mimeType: 'image/png', buffer: opaquePng },
    outputMime: 'image/png',
  });
  assert.ok(opaque.buffer.length <= opaquePng.length * 0.8, `PNG Auto must save at least 20%; got ${opaque.buffer.length}/${opaquePng.length} bytes.`);
  const opaqueInspection = await validateImageInBrowser(page, opaque.buffer, 'image/png');
  assert.equal(opaqueInspection.hasTransparency, false, 'Opaque PNG must remain opaque.');
  console.log(`PASS compress-image Auto opaque PNG ${opaque.stats}`);

  const transparent = await processImageCompression(page, {
    input: { name: 'transparent.png', mimeType: 'image/png', buffer: transparentPng },
    outputMime: 'image/png',
  });
  assert.ok(transparent.buffer.length <= transparentPng.length * 0.8, `Transparent PNG Auto must save at least 20%; got ${transparent.buffer.length}/${transparentPng.length} bytes.`);
  const transparentInspection = await validateImageInBrowser(page, transparent.buffer, 'image/png');
  assert.equal(transparentInspection.hasTransparency, true, 'Transparent PNG output must preserve transparent pixels.');
  console.log(`PASS compress-image Auto transparent PNG ${transparent.stats}`);

  const heicSource = await readFile(fixturePath('libheif-example.heic'));
  const heic = await processImageCompression(page, { input: fixturePath('libheif-example.heic'), route: 'heic-to-jpg' });
  assert.match(heic.filename, /\.jpg$/i);
  assert.ok(heic.buffer.length < heicSource.length, 'HEIC compressor output should be smaller than this fixture.');
  await validateImageInBrowser(page, heic.buffer, 'image/jpeg');
  console.log(`PASS compress-image HEIC to JPG ${heic.stats}`);
}

async function processPdfCompression(page, { input, level = 'balanced' }) {
  await page.goto(`${baseUrl}/pdf`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pdf-input').setInputFiles(input);
  try {
    await page.locator('#pdf-work').waitFor({ state: 'visible', timeout: 60_000 });
  } catch (error) {
    throw new Error(`PDF compressor could not load input. Error: ${await page.locator('#pdf-file-error').textContent()}`, { cause: error });
  }
  await page.locator(`input[name="pdfLevel"][value="${level}"]`).check({ force: true });
  await page.locator('#pdf-confirm').check();
  await page.locator('#pdf-process').click();
  try {
    await page.locator('#pdf-result').waitFor({ state: 'visible', timeout: 120_000 });
  } catch (error) {
    throw new Error(`PDF compressor did not produce a result. Status: ${await page.locator('#pdf-status').textContent()}`, { cause: error });
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#pdf-download').click(),
  ]);
  const path = await download.path();
  assert.ok(path, 'PDF compressor download path must be available.');
  return {
    buffer: await readFile(path),
    filename: download.suggestedFilename(),
    stats: (await page.locator('#pdf-result-stats').textContent()) ?? '',
    warning: (await page.locator('#pdf-result-warning').textContent()) ?? '',
  };
}

async function generateImageHeavyPdf(page) {
  await page.goto(`${baseUrl}/pdf`, { waitUntil: 'domcontentloaded' });
  const png = await generatePngFixture(page, false);
  const { PDFDocument, rgb } = await import('pdf-lib');
  const document = await PDFDocument.create();
  const image = await document.embedPng(png);
  for (let index = 0; index < 3; index += 1) {
    const pdfPage = document.addPage([612, 792]);
    pdfPage.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 1, 1) });
    const scale = Math.min(540 / image.width, 680 / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    pdfPage.drawImage(image, { x: (612 - width) / 2, y: (792 - height) / 2, width, height });
  }
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

async function runPdfCompression(page) {
  await page.goto(`${baseUrl}/pdf`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pdf-input').setInputFiles(fixturePath('text-two-page.pdf'));
  await page.locator('#pdf-work').waitFor({ state: 'visible' });
  await page.locator('#pdf-process').click();
  await page.waitForFunction(() => Boolean(document.querySelector('#pdf-status')?.textContent?.trim()) && document.activeElement?.id === 'pdf-confirm');
  assert.ok(await page.locator('#pdf-result').isHidden(), 'PDF compression must not start without rasterization acknowledgement.');
  console.log('PASS pdf compression requires rasterization acknowledgement');

  const imageHeavySource = await generateImageHeavyPdf(page);
  const imageHeavy = await processPdfCompression(page, {
    input: { name: 'image-heavy-three-page.pdf', mimeType: 'application/pdf', buffer: imageHeavySource },
  });
  assert.match(imageHeavy.filename, /\.pdf$/i);
  assert.ok(imageHeavy.buffer.length < imageHeavySource.length, `Image-heavy PDF should shrink; got ${imageHeavy.buffer.length}/${imageHeavySource.length} bytes.`);
  await validatePdf(imageHeavy.buffer, { pageCount: 3 });
  const rendered = await processDocumentAction(page, {
    route: 'pdf-to-jpg',
    files: [{ name: 'compressed.pdf', mimeType: 'application/pdf', buffer: imageHeavy.buffer }],
  });
  const renderedZip = validateZip(rendered.buffer, /^page-\d{3}\.jpg$/i);
  assert.equal(renderedZip.names.length, 3, 'Compressed PDF must render all three pages.');
  await validateImageInBrowser(page, renderedZip.entries[renderedZip.names[0]], 'image/jpeg');
  console.log(`PASS pdf compression image-heavy PDF ${imageHeavy.stats}`);

  const standardFontWarnings = [];
  const recordStandardFontWarning = (message) => {
    if (message.text().includes('standardFontDataUrl')) standardFontWarnings.push(message.text());
  };
  page.on('console', recordStandardFontWarning);
  try {
    const textPdf = await processPdfCompression(page, { input: fixturePath('text-two-page.pdf') });
    await validatePdf(textPdf.buffer, { pageCount: 2 });
    assert.match(textPdf.stats, /larger than the original/i, 'Efficient text PDF should disclose a larger rasterized output.');
    assert.match(textPdf.warning, /already efficient|image-based version is larger/i, 'Efficient text PDF must recommend keeping the original.');
    assert.equal((await extractPdfText(textPdf.buffer)).trim(), '', 'Rasterized PDF output must contain no selectable text.');
    assert.deepEqual(standardFontWarnings, [], `PDF.js standard font assets must be configured: ${standardFontWarnings.join(', ')}`);
    console.log(`PASS pdf compression efficient-text warning ${textPdf.stats}`);
  } finally {
    page.off('console', recordStandardFontWarning);
  }

  const wasmFailures = [];
  const recordWasmFailure = (response) => {
    if (response.url().includes('/pdfjs/wasm/') && response.status() >= 400) wasmFailures.push(`${response.status()} ${response.url()}`);
  };
  page.on('response', recordWasmFailure);
  try {
    const jpx = await processPdfCompression(page, { input: fixturePath('mozilla-jpx-smask.pdf'), level: 'small' });
    await validatePdf(jpx.buffer, { pageCount: 1 });
    assert.deepEqual(wasmFailures, [], `PDF.js WASM assets must not return errors: ${wasmFailures.join(', ')}`);
    console.log(`PASS pdf compression JPEG 2000/WASM rendering ${jpx.stats}`);
  } finally {
    page.off('response', recordWasmFailure);
  }

  const invalidCases = [
    { input: { name: 'forged.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') }, expected: /valid PDF signature/i },
    { input: { name: 'corrupt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-not-a-document') }, expected: /invalid PDF|PDF could not|InvalidPDF/i },
    { input: fixturePath('mozilla-password-protected.pdf'), expected: /Password-protected PDFs are not supported/i },
  ];
  for (const current of invalidCases) {
    await page.goto(`${baseUrl}/pdf`, { waitUntil: 'domcontentloaded' });
    await page.locator('#pdf-input').setInputFiles(current.input);
    await page.locator('#pdf-file-error').waitFor({ state: 'visible', timeout: 30_000 });
    assert.match((await page.locator('#pdf-file-error').textContent()) ?? '', current.expected);
    assert.ok(await page.locator('#pdf-result').isHidden(), 'Invalid PDF input must not expose a result.');
  }
  console.log('PASS pdf compression invalid, corrupt, and encrypted recovery');
}

await ensureAstroServer();
const browserLaunchOptions = process.env.SORA_BROWSER_PATH
  ? { headless: true, executablePath: process.env.SORA_BROWSER_PATH }
  : { headless: true };
const browser = await chromium.launch(browserLaunchOptions);

try {
  const page = await browser.newPage({ acceptDownloads: true });
  const toolIndex = process.argv.indexOf('--tool');
  const selectedTool = toolIndex >= 0 ? process.argv[toolIndex + 1] : undefined;
  const fixtureIndex = process.argv.indexOf('--fixture');
  const selectedFixture = fixtureIndex >= 0 ? process.argv[fixtureIndex + 1] : undefined;
  const groupIndex = process.argv.indexOf('--group');
  const selectedGroup = groupIndex >= 0 ? process.argv[groupIndex + 1] : undefined;
  if (selectedGroup === 'documents') {
    await runDocumentActions(page);
    await runInvalidDocumentSignatures(page);
  } else if (selectedGroup === 'image-converter') {
    await runImageConverter(page);
  } else if (selectedGroup === 'compress-image') {
    await runImageCompression(page);
  } else if (selectedGroup === 'pdf') {
    await runPdfCompression(page);
  } else if (selectedGroup) {
    throw new Error(`Unknown tool group: ${selectedGroup}`);
  } else if (selectedTool === 'pdf-to-word') {
    await runPdfToWord(page, selectedFixture);
    if (!selectedFixture) await runPdfToWordNoText(page);
  } else if (selectedTool) {
    throw new Error(`Unknown tool test: ${selectedTool}`);
  } else {
    await runSmoke(page);
    if (!process.argv.includes('--smoke')) {
      await runDocumentActions(page);
      await runInvalidDocumentSignatures(page);
      await runImageConverter(page);
      await runImageCompression(page);
      await runPdfCompression(page);
      console.log('PASS complete tool regression suite');
    }
  }
} finally {
  await browser.close();
}
