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
  { path: '/remove-pages', chooser: '#action-choose' },
  { path: '/watermark-pdf', chooser: '#action-choose' },
  { path: '/page-numbers', chooser: '#action-choose' },
  { path: '/sign-pdf', chooser: '#action-choose' },
  { path: '/jpg-to-pdf', chooser: '#action-choose' },
  { path: '/pdf-to-jpg', chooser: '#action-choose' },
  { path: '/pdf-to-word', chooser: '#action-choose' },
  { path: '/word-to-pdf', chooser: '#action-choose' },
  { path: '/edit-image', chooser: '[data-extra-drop]' },
  { path: '/protect-pdf', chooser: '[data-extra-drop]' },
  { path: '/unlock-pdf', chooser: '[data-extra-drop]' },
  { path: '/repair-pdf', chooser: '[data-extra-drop]' },
  { path: '/metadata-remover', chooser: '[data-extra-drop]' },
  { path: '/pdf-to-excel', chooser: '[data-extra-drop]' },
  { path: '/excel-to-pdf', chooser: '[data-extra-drop]' },
  { path: '/pdf-ocr', chooser: '[data-extra-drop]' },
  { path: '/resize-image', chooser: '[data-resize-choose]' },
  { path: '/doc-scanner', chooser: '[data-scanner-upload]' },
  { path: '/remove-background', chooser: '[data-background-drop]' },
];

const fixturePath = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function runSmoke(page) {
  for (const route of routes) {
    const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
    assert.ok(response?.ok(), `${route.path} returned ${response?.status() ?? 'no response'}.`);
    assert.equal(await page.locator('h1').count(), 1, `${route.path} must render exactly one H1.`);
    const expectedInputs = ['/sign-pdf', '/watermark-pdf'].includes(route.path) ? 2 : 1;
    assert.equal(await page.locator('input[type="file"]').count(), expectedInputs, `${route.path} must render its source file input${expectedInputs === 2 ? ' and signature-image input' : ''}.`);
    if (route.path === '/sign-pdf') assert.equal(await page.locator('#signature-upload').count(), 1, '/sign-pdf must render the signature-image chooser.');
    if (route.path === '/watermark-pdf') assert.equal(await page.locator('#watermark-image').count(), 1, '/watermark-pdf must render the watermark-image chooser.');
    const chooser = page.locator(route.chooser);
    assert.equal(await chooser.count(), 1, `${route.path} must render its chooser.`);
    assert.ok(await chooser.isEnabled(), `${route.path} chooser must be enabled.`);
    console.log(`PASS route smoke ${route.path}`);
  }
}

async function runPdfToWord(page, fixtureName = 'text') {
  const fixture = fixtureName === 'cmap'
    ? { file: 'mozilla-cmap-gbkp-euc-h.pdf', expectedPages: 1 }
    : { file: 'text-two-page.pdf', expectedPages: 2 };
  const diagnostics = [];
  page.on('console', (message) => diagnostics.push(`console:${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.stack ?? error.message}`));
  page.on('requestfailed', (request) => diagnostics.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`));

  await page.goto(`${baseUrl}/pdf-to-word`, { waitUntil: 'domcontentloaded' });
  await page.locator('#action-input').setInputFiles(fixturePath(fixture.file));
  await page.locator('#action-work').waitFor({ state: 'visible' });
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
  const { entries } = await validateDocx(await readFile(downloadPath));
  const media = Object.keys(entries).filter((name) => /^word\/media\/.*\.png$/i.test(name));
  assert.equal(media.length, fixture.expectedPages, 'Visual DOCX must contain one lossless page image per PDF page.');
  const documentXml = new TextDecoder().decode(entries['word/document.xml']);
  assert.equal((documentXml.match(/<w:sectPr\b/g) ?? []).length, fixture.expectedPages, 'Visual DOCX must preserve one Word section per PDF page.');
  console.log(`PASS pdf-to-word ${download.suggestedFilename()} (${media.length} page visuals)`);
}

async function runPdfToWordNoText(page) {
  await page.goto(`${baseUrl}/pdf-to-word`, { waitUntil: 'domcontentloaded' });
  await page.locator('#action-input').setInputFiles(fixturePath('scan-english.pdf'));
  await page.locator('#action-work').waitFor({ state: 'visible' });
  await page.locator('#action-process').click();
  await page.locator('#action-result').waitFor({ state: 'visible', timeout: 60_000 });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#action-download').click(),
  ]);
  const downloadPath = await download.path();
  assert.ok(downloadPath, 'Scan OCR download path must be available.');
  const { entries } = await validateDocx(await readFile(downloadPath));
  assert.equal(Object.keys(entries).filter((name) => /^word\/media\/.*\.png$/i.test(name)).length, 1, 'Scanned PDF page must be preserved as one page visual.');
  console.log('PASS pdf-to-word scanned page visual preservation');
}

async function processDocumentAction(page, { route, files, configure, timeout = 60_000 }) {
  await page.goto(`${baseUrl}/${route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#action-input').setInputFiles(files.map((file) => typeof file === 'string' ? fixturePath(file) : file));
  await page.locator('#action-work').waitFor({ state: 'visible' });
  if (configure) await configure(page);
  await page.locator('#action-process').click();
  try {
    await page.locator('#action-result').waitFor({ state: 'visible', timeout });
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
    warning: await page.locator('#action-result-warning').textContent(),
  };
}

async function processExtraTool(page, { route, files, configure, timeout = 60_000 }) {
  await page.goto(`${baseUrl}/${route}`, { waitUntil: 'domcontentloaded' });
  const input = page.locator('[data-extra-input]');
  await input.setInputFiles(files.map((file) => typeof file === 'string' ? fixturePath(file) : file));
  await page.locator('[data-extra-selected]').waitFor({ state: 'visible' });
  if (configure) await configure(page);
  await page.locator('[data-extra-start]').click();
  try {
    await page.locator('[data-extra-results]').waitFor({ state: 'visible', timeout });
  } catch (error) {
    throw new Error(`${route} did not produce a result. Error: ${await page.locator('[data-extra-error]').textContent()}`, { cause: error });
  }
  const links = page.locator('[data-extra-result-list] a[download]');
  const results = [];
  for (let index = 0; index < await links.count(); index += 1) {
    const [download] = await Promise.all([page.waitForEvent('download'), links.nth(index).click()]);
    const path = await download.path();
    assert.ok(path, `${route} download path must be available.`);
    results.push({ filename: download.suggestedFilename(), buffer: await readFile(path) });
  }
  assert.ok(results.length > 0, `${route} must expose at least one download.`);
  return results;
}

async function runBackgroundRemoval(page) {
  await page.goto(`${baseUrl}/remove-background`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-background-input]').setInputFiles(fixturePath('sample.jpg'));
  await page.locator('[data-background-editor]').waitFor({ state: 'visible' });
  await page.locator('[data-background-process]').click();
  for (let attempt = 0; attempt < 30 && await page.locator('[data-background-result]').isHidden(); attempt += 1) {
    await page.waitForTimeout(10_000);
    if (process.argv.includes('--diagnostic')) {
      console.log(`BACKGROUND ${await page.locator('[data-background-percent]').textContent()} ${await page.locator('[data-background-status]').textContent()} error=${await page.locator('[data-background-error]').textContent()}`);
    }
    if (await page.locator('[data-background-error]').isVisible()) throw new Error(`Remove Background failed: ${await page.locator('[data-background-error]').textContent()}`);
  }
  assert.ok(await page.locator('[data-background-result]').isVisible(), 'Remove Background must finish within five minutes on the CPU test path.');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-background-download]').click()]);
  const path = await download.path();
  assert.ok(path, 'Remove Background download path must be available.');
  const buffer = await readFile(path);
  await validateImageInBrowser(page, buffer, 'image/png');
  const { decode } = await import('fast-png');
  const image = decode(buffer);
  assert.equal(image.channels, 4, 'Remove Background must return an RGBA PNG.');
  assert.ok(image.data.some((value, index) => index % 4 === 3 && value < 255), 'Remove Background must create transparent pixels.');
  console.log(`PASS remove-background focused ${download.suggestedFilename()}`);
}

async function runExtraTools(page) {
  const edited = (await processExtraTool(page, {
    route: 'edit-image', files: ['sample.jpg'],
    configure: async (currentPage) => {
      await currentPage.locator('[data-edit-preview]').waitFor({ state: 'visible' });
      await currentPage.locator('[data-edit-rotate-right]').click();
      await currentPage.locator('[data-extra-format]').selectOption('image/webp');
    },
  }))[0];
  const editedImage = await validateImageInBrowser(page, edited.buffer, 'image/webp');
  assert.deepEqual([editedImage.width, editedImage.height], [540, 960]);
  console.log(`PASS edit-image ${edited.filename} ${editedImage.width}x${editedImage.height}`);

  const protectedPdf = (await processExtraTool(page, {
    route: 'protect-pdf', files: ['minimal.pdf'],
    configure: async (currentPage) => currentPage.locator('[data-extra-password]').fill('SoraFiles-test-42'),
  }))[0];
  assert.match(protectedPdf.filename, /-protected\.pdf$/i);
  assert.match(protectedPdf.buffer.subarray(0, 8).toString('ascii'), /^%PDF-/);
  assert.match(protectedPdf.buffer.toString('latin1'), /\/Encrypt/);
  console.log(`PASS protect-pdf ${protectedPdf.filename}`);

  const unlockedPdf = (await processExtraTool(page, {
    route: 'unlock-pdf',
    files: [{ name: protectedPdf.filename, mimeType: 'application/pdf', buffer: protectedPdf.buffer }],
    configure: async (currentPage) => currentPage.locator('[data-extra-password]').fill('SoraFiles-test-42'),
  }))[0];
  await validatePdf(unlockedPdf.buffer, { pageCount: 1 });
  console.log(`PASS unlock-pdf ${unlockedPdf.filename}`);

  const repaired = (await processExtraTool(page, { route: 'repair-pdf', files: ['minimal.pdf'] }))[0];
  await validatePdf(repaired.buffer, { pageCount: 1 });
  console.log(`PASS repair-pdf ${repaired.filename}`);

  const cleaned = await processExtraTool(page, { route: 'metadata-remover', files: ['minimal.pdf', 'sample.jpg'] });
  assert.equal(cleaned.length, 2);
  await validatePdf(cleaned.find((item) => item.filename.endsWith('.pdf')).buffer, { pageCount: 1 });
  await validateImageInBrowser(page, cleaned.find((item) => item.filename.endsWith('.jpg')).buffer, 'image/jpeg');
  console.log(`PASS metadata-remover ${cleaned.map((item) => item.filename).join(', ')}`);

  const spreadsheet = await import('xlsx');
  const workbook = spreadsheet.utils.book_new();
  spreadsheet.utils.book_append_sheet(workbook, spreadsheet.utils.aoa_to_sheet([['Name', 'Value'], ['SoraFiles', 23]]), 'Tools');
  const workbookBuffer = Buffer.from(spreadsheet.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  const excelPdf = (await processExtraTool(page, {
    route: 'excel-to-pdf',
    files: [{ name: 'tools.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: workbookBuffer }],
  }))[0];
  await validatePdf(excelPdf.buffer, { pageCount: 1 });
  assert.match(await extractPdfText(excelPdf.buffer), /SoraFiles/);
  console.log(`PASS excel-to-pdf ${excelPdf.filename}`);

  const pdfExcel = (await processExtraTool(page, { route: 'pdf-to-excel', files: ['text-two-page.pdf'] }))[0];
  const extractedWorkbook = spreadsheet.read(pdfExcel.buffer, { type: 'buffer' });
  assert.equal(extractedWorkbook.SheetNames.length, 2);
  assert.match(pdfExcel.buffer.toString('latin1'), /xl\/media\/page1\.png/i, 'Exact PDF to Excel must preserve page one as a worksheet visual.');
  assert.match(pdfExcel.buffer.toString('latin1'), /xl\/media\/page2\.png/i, 'Exact PDF to Excel must preserve page two as a worksheet visual.');
  console.log(`PASS pdf-to-excel ${pdfExcel.filename}`);

  const ocrText = (await processExtraTool(page, {
    route: 'pdf-ocr', files: ['scan-english.pdf'], timeout: 120_000,
    configure: async (currentPage) => currentPage.locator('[data-extra-lang]').selectOption('eng'),
  }))[0];
  assert.match(ocrText.buffer.toString('utf8'), /Sora Files local OCR/i);
  console.log(`PASS pdf-ocr ${ocrText.filename}`);
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

  const sharedImageSource = await generateImageHeavyPdf(page);
  const compactSplit = await processDocumentAction(page, {
    route: 'split-pdf',
    files: [{ name: 'shared-image-pages.pdf', mimeType: 'application/pdf', buffer: sharedImageSource }],
  });
  const compactZip = validateZip(compactSplit.buffer, /^page-\d{3}\.pdf$/i);
  assert.equal(compactZip.names.length, 3);
  assert.ok(compactSplit.warning?.trim(), 'Smart split must disclose when image-based compact pages were used.');
  assert.ok(compactSplit.buffer.length < sharedImageSource.length * 2, `Smart split remained abnormally large: ${compactSplit.buffer.length}/${sharedImageSource.length} bytes.`);
  for (const name of compactZip.names) await validatePdf(compactZip.entries[name], { pageCount: 1 });
  console.log(`PASS split-pdf compact fallback ${compactSplit.buffer.length}/${sharedImageSource.length} bytes`);

  const rotate = await processDocumentAction(page, {
    route: 'rotate-pdf',
    files: ['text-two-page.pdf'],
    configure: async (currentPage) => currentPage.locator('#rotate-angle').selectOption('90'),
  });
  await validatePdf(rotate.buffer, { pageCount: 2, rotation: 90 });
  console.log(`PASS rotate-pdf ${rotate.filename} ${rotate.stats}`);

  const removed = await processDocumentAction(page, {
    route: 'remove-pages',
    files: ['text-two-page.pdf'],
    configure: async (currentPage) => currentPage.locator('#remove-page-spec').fill('2'),
  });
  await validatePdf(removed.buffer, { pageCount: 1 });
  assert.match(await extractPdfText(removed.buffer), /Sora Files page one/i, 'Remove Pages must preserve the page that was not selected.');
  console.log(`PASS remove-pages ${removed.filename} ${removed.stats}`);

  const watermarked = await processDocumentAction(page, {
    route: 'watermark-pdf',
    files: ['text-two-page.pdf'],
    configure: async (currentPage) => currentPage.locator('#watermark-text').fill('QA WATERMARK'),
  });
  await validatePdf(watermarked.buffer, { pageCount: 2 });
  assert.match(await extractPdfText(watermarked.buffer), /QA WATERMARK/i, 'Watermark PDF must embed the requested visible text.');
  console.log(`PASS watermark-pdf ${watermarked.filename} ${watermarked.stats}`);

  const imageWatermarkAsIs = await processDocumentAction(page, {
    route: 'watermark-pdf',
    files: ['text-two-page.pdf'],
    configure: async (currentPage) => {
      await currentPage.locator('[data-watermark-mode="image"]').click();
      await currentPage.locator('#watermark-image').setInputFiles(fixturePath('sample.jpg'));
      await currentPage.locator('#watermark-image-preview').waitFor({ state: 'visible' });
      await currentPage.locator('input[name="watermarkImageTreatment"][value="as-is"]').check();
    },
  });
  await validatePdf(imageWatermarkAsIs.buffer, { pageCount: 2 });
  assert.ok(imageWatermarkAsIs.buffer.length > watermarked.buffer.length, 'Image watermark output must contain the embedded uploaded image.');

  const imageWatermarkCleaned = await processDocumentAction(page, {
    route: 'watermark-pdf',
    files: ['text-two-page.pdf'],
    configure: async (currentPage) => {
      await currentPage.locator('[data-watermark-mode="image"]').click();
      await currentPage.locator('#watermark-image').setInputFiles(fixturePath('sample.jpg'));
      await currentPage.locator('input[name="watermarkImageTreatment"][value="remove"]').check();
      await currentPage.locator('#watermark-cleanup').fill('40');
      assert.equal(await currentPage.locator('#watermark-cleanup-controls').isVisible(), true, 'Background removal must expose its strength control.');
    },
  });
  await validatePdf(imageWatermarkCleaned.buffer, { pageCount: 2 });
  assert.notDeepEqual(imageWatermarkCleaned.buffer, imageWatermarkAsIs.buffer, 'Background removal and as-is modes must produce distinct PDFs.');
  console.log('PASS watermark-pdf image as-is and background-removal modes');

  const numbered = await processDocumentAction(page, {
    route: 'page-numbers',
    files: ['text-two-page.pdf'],
    configure: async (currentPage) => currentPage.locator('#page-number-start').fill('3'),
  });
  await validatePdf(numbered.buffer, { pageCount: 2 });
  assert.match(await extractPdfText(numbered.buffer), /3 \/ 4/i, 'Page Numbers must embed the configured sequence.');
  console.log(`PASS page-numbers ${numbered.filename} ${numbered.stats}`);

  const signed = await processDocumentAction(page, {
    route: 'sign-pdf',
    files: ['text-two-page.pdf'],
    configure: async (currentPage) => {
      await currentPage.locator('[data-sign-mode="draw"]').click();
      const canvas = currentPage.locator('#signature-draw-canvas');
      await canvas.click({ position: { x: 35, y: 70 } });
      const box = await canvas.boundingBox();
      assert.ok(box, 'Signature canvas must be visible.');
      await currentPage.mouse.move(box.x + 35, box.y + box.height * 0.65);
      await currentPage.mouse.down();
      await currentPage.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.25, { steps: 8 });
      await currentPage.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.65, { steps: 8 });
      await currentPage.mouse.up();
    },
  });
  await validatePdf(signed.buffer, { pageCount: 2 });
  assert.ok(signed.buffer.length > 1_000, 'Signed PDF must contain a non-empty embedded signature appearance.');
  console.log(`PASS sign-pdf ${signed.filename} ${signed.stats}`);

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
    timeout: 300_000,
  });
  const wordPdf = await validatePdf(wordToPdf.buffer);
  assert.ok(wordPdf.pageCount >= 1, 'Word to PDF must create at least one page.');
  assert.ok(wordToPdf.buffer.byteLength > 2_000, 'Word to PDF must contain rendered page content.');
  assert.ok((await extractPdfText(wordToPdf.buffer)).trim().length > 0, 'LibreOffice Word to PDF must retain selectable text.');
  console.log(`PASS word-to-pdf ${wordToPdf.filename} ${wordToPdf.stats}`);
}

async function runInvalidDocumentSignatures(page) {
  const cases = [
    ['merge-pdf', 'forged.pdf', 'application/pdf'],
    ['split-pdf', 'forged.pdf', 'application/pdf'],
    ['rotate-pdf', 'forged.pdf', 'application/pdf'],
    ['remove-pages', 'forged.pdf', 'application/pdf'],
    ['watermark-pdf', 'forged.pdf', 'application/pdf'],
    ['page-numbers', 'forged.pdf', 'application/pdf'],
    ['sign-pdf', 'forged.pdf', 'application/pdf'],
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
  assert.ok(target.buffer.length <= targetKb * 1000, 'Target mode must never exceed the requested byte ceiling.');
  await validateImageInBrowser(page, target.buffer, 'image/webp');
  console.log(`PASS compress-image Target ${target.stats}`);

  const reductionPercent = 25;
  const reduced = await processImageCompression(page, { input: fixturePath('sample.jpg'), mode: 'percent', outputMime: 'image/webp', reductionPercent });
  assert.ok(reduced.buffer.length <= Math.floor(sourceJpg.length * 0.75), 'Reduce-by mode must never exceed its calculated byte ceiling.');
  await validateImageInBrowser(page, reduced.buffer, 'image/webp');
  console.log(`PASS compress-image Reduce by ${reduced.stats}`);

  const reduced80 = await processImageCompression(page, { input: fixturePath('sample.jpg'), mode: 'percent', outputMime: 'image/webp', reductionPercent: 80 });
  assert.ok(reduced80.buffer.length <= Math.floor(sourceJpg.length * 0.2), `80% reduction must produce at most 20% of source bytes; got ${reduced80.buffer.length}/${sourceJpg.length}.`);
  await validateImageInBrowser(page, reduced80.buffer, 'image/webp');
  console.log(`PASS compress-image hard 80% rule ${reduced80.stats}`);

  await page.goto(`${baseUrl}/compress-image`, { waitUntil: 'domcontentloaded' });
  const opaquePng = await generatePngFixture(page, false);
  const transparentPng = await generatePngFixture(page, true);

  const pngTarget = await processImageCompression(page, {
    input: { name: 'opaque.png', mimeType: 'image/png', buffer: opaquePng },
    mode: 'target',
    targetKb: 250,
  });
  assert.equal(pngTarget.outputMime, 'image/png', 'Choosing Target must not silently change PNG to WebP.');
  assert.ok(pngTarget.buffer.length <= 250_000, 'PNG Target mode must honor its byte ceiling without changing format.');
  await validateImageInBrowser(page, pngTarget.buffer, 'image/png');
  console.log(`PASS compress-image PNG target-mode format truth ${pngTarget.stats}`);

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

async function processPdfCompression(page, { input, level = 'balanced', mode = 'auto', targetKb, reductionPercent }) {
  await page.goto(`${baseUrl}/pdf`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pdf-input').setInputFiles(input);
  try {
    await page.locator('#pdf-work').waitFor({ state: 'visible', timeout: 60_000 });
  } catch (error) {
    throw new Error(`PDF compressor could not load input. Error: ${await page.locator('#pdf-file-error').textContent()}`, { cause: error });
  }
  await page.locator(`input[name="pdfLevel"][value="${level}"]`).check({ force: true });
  await page.locator(`input[name="pdfMode"][value="${mode}"]`).check({ force: true });
  if (targetKb !== undefined) await page.locator('#pdf-target-kb').fill(String(targetKb));
  if (reductionPercent !== undefined) await page.locator('#pdf-reduction-percent').fill(String(reductionPercent));
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

  const hard80 = await processPdfCompression(page, {
    input: { name: 'image-heavy-three-page.pdf', mimeType: 'application/pdf', buffer: imageHeavySource },
    mode: 'percent',
    level: 'small',
    reductionPercent: 80,
  });
  assert.ok(hard80.buffer.length <= Math.floor(imageHeavySource.length * 0.2), `PDF 80% reduction must produce at most 20% of source bytes; got ${hard80.buffer.length}/${imageHeavySource.length}.`);
  await validatePdf(hard80.buffer, { pageCount: 3 });
  console.log(`PASS pdf compression hard 80% rule ${hard80.stats}`);

  const standardFontWarnings = [];
  const recordStandardFontWarning = (message) => {
    if (message.text().includes('standardFontDataUrl')) standardFontWarnings.push(message.text());
  };
  page.on('console', recordStandardFontWarning);
  try {
    await page.goto(`${baseUrl}/pdf`, { waitUntil: 'domcontentloaded' });
    await page.locator('#pdf-input').setInputFiles(fixturePath('text-two-page.pdf'));
    await page.locator('#pdf-work').waitFor({ state: 'visible' });
    await page.locator('#pdf-confirm').check();
    await page.locator('#pdf-process').click();
    await page.waitForFunction(() => /hard limit could not be reached/i.test(document.querySelector('#pdf-status')?.textContent ?? ''), undefined, { timeout: 120_000 });
    assert.ok(await page.locator('#pdf-result').isHidden(), 'An efficient PDF must not expose a result above the hard limit.');
    assert.deepEqual(standardFontWarnings, [], `PDF.js standard font assets must be configured: ${standardFontWarnings.join(', ')}`);
    console.log('PASS pdf compression rejects larger-than-input output');
  } finally {
    page.off('console', recordStandardFontWarning);
  }

  const wasmFailures = [];
  const recordWasmFailure = (response) => {
    if (response.url().includes('/pdfjs/wasm/') && response.status() >= 400) wasmFailures.push(`${response.status()} ${response.url()}`);
  };
  page.on('response', recordWasmFailure);
  try {
    await page.goto(`${baseUrl}/pdf`, { waitUntil: 'domcontentloaded' });
    await page.locator('#pdf-input').setInputFiles(fixturePath('mozilla-jpx-smask.pdf'));
    await page.locator('#pdf-work').waitFor({ state: 'visible', timeout: 60_000 });
    assert.deepEqual(wasmFailures, [], `PDF.js WASM assets must not return errors: ${wasmFailures.join(', ')}`);
    console.log('PASS pdf compression JPEG 2000/WASM preview rendering');
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
const executablePath = process.env.SORA_BROWSER_PATH;
const browser = await chromium.launch({ headless: true, executablePath });

try {
  const page = await browser.newPage({ acceptDownloads: true });
  if (process.argv.includes('--diagnostic')) {
    page.on('console', (message) => console.log(`BROWSER ${message.type()}: ${message.text()}`));
    page.on('pageerror', (error) => console.log(`BROWSER pageerror: ${error.stack ?? error.message}`));
    page.on('requestfailed', (request) => console.log(`BROWSER requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`));
    page.on('response', (response) => {
      if (/staticimgly\.com|zetaoffice\.net/.test(response.url())) console.log(`BROWSER response: ${response.status()} ${response.url()}`);
    });
  }
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
  } else if (selectedGroup === 'extra') {
    await runExtraTools(page);
  } else if (selectedGroup) {
    throw new Error(`Unknown tool group: ${selectedGroup}`);
  } else if (selectedTool === 'pdf-to-word') {
    await runPdfToWord(page, selectedFixture);
    if (!selectedFixture) await runPdfToWordNoText(page);
  } else if (selectedTool === 'word-to-pdf') {
    const output = await processDocumentAction(page, { route: 'word-to-pdf', files: ['single-paragraph.docx'], timeout: 300_000 });
    const pdf = await validatePdf(output.buffer);
    assert.ok(pdf.pageCount >= 1, 'Word to PDF must create at least one page.');
    assert.ok((await extractPdfText(output.buffer)).trim().length > 0, 'LibreOffice Word to PDF must retain selectable text.');
    console.log(`PASS word-to-pdf focused ${output.filename}`);
  } else if (selectedTool === 'remove-background') {
    await runBackgroundRemoval(page);
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
      await runExtraTools(page);
      console.log('PASS complete tool regression suite');
    }
  }
} finally {
  await browser.close();
}
