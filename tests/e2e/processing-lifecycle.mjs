import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

import { baseUrl, ensureAstroServer } from './run-server.mjs';

const fixturePath = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function imageHeavyPdf(pageCount = 6) {
  const jpeg = await readFile(fixturePath('sample.jpg'));
  const document = await PDFDocument.create();
  const image = await document.embedJpg(jpeg);
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([612, 792]);
    page.drawImage(image, { x: 36, y: 72, width: 540, height: 648 });
  }
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

async function installLifecycleRecorder(page) {
  await page.addInitScript(() => {
    window.__SORA_TEST_PDF_LIFECYCLE__ = true;
    window.__pdfLifecycle = [];
    window.addEventListener('sora:pdf-worker-lifecycle', (event) => {
      window.__pdfLifecycle.push(event.detail);
    });
    window.__pdfResources = [];
    window.addEventListener('sora:pdf-resource-lifecycle', (event) => {
      window.__pdfResources.push(event.detail);
    });
  });
}

async function assertCorruptEngineErrorsAreSafe(page) {
  await page.goto(`${baseUrl}/pdf`, { waitUntil: 'domcontentloaded' });
  const results = await page.evaluate(async () => {
    const [{ pdfEngine }, { JobController }] = await Promise.all([
      import('/src/lib/processing/engines/pdf.ts'),
      import('/src/lib/processing/controller.ts'),
    ]);
    const bytes = new TextEncoder().encode('%PDF-not-a-document').buffer;
    const outcomes = [];
    for (const operation of ['compress', 'pdf-to-images']) {
      const controller = new JobController();
      const job = await controller.start();
      controller.transition('ready');
      controller.transition('processing');
      try {
        await pdfEngine.run(operation === 'compress'
          ? { operation, bytes: bytes.slice(0), preset: 'balanced' }
          : { operation, bytes: bytes.slice(0), scale: 1.5 }, { job });
        outcomes.push({ operation, unexpectedSuccess: true });
      } catch (error) {
        outcomes.push({
          operation,
          name: error?.name,
          value: error?.value,
          keys: error?.value ? Object.keys(error.value).sort() : [],
          serialized: JSON.stringify(error),
        });
      } finally {
        await controller.cancelAndDispose().catch(() => {});
      }
    }
    return outcomes;
  });
  for (const result of results) {
    assert.equal(result.name, 'ProcessingError', `${result.operation} corrupt input must reject with ProcessingError.`);
    assert.equal(result.value?.code, 'corrupt-input', `${result.operation} corrupt input must use corrupt-input.`);
    assert.deepEqual(result.keys, ['code', 'messageKey', 'phase', 'recoveryKey', 'retryable']);
    assert.equal(/InvalidPDF|not-a-document|private-passport|stack/i.test(result.serialized), false, `${result.operation} must expose no raw parser detail.`);
  }
  console.log('PASS corrupt PDF engine errors are structured and private');
}

async function assertLifecycleIsPrivate(page) {
  const events = await page.evaluate(() => window.__pdfLifecycle ?? []);
  assert.ok(events.some((event) => event.event === 'created'), 'PDF work must report worker creation.');
  assert.ok(events.some((event) => event.event === 'disposed'), 'PDF work must report worker disposal.');
  for (const event of events) {
    assert.deepEqual(Object.keys(event).sort(), ['engine', 'event', 'jobId'], 'Lifecycle instrumentation must contain metadata only.');
  }
}

async function cancelCompressionAndRetry(page, source) {
  await page.goto(`${baseUrl}/pdf`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pdf-input').setInputFiles({ name: 'many-pages.pdf', mimeType: 'application/pdf', buffer: source });
  await page.locator('#pdf-work').waitFor({ state: 'visible' });
  await page.locator('#pdf-confirm').check();
  await page.evaluate(() => {
    window.__pdfTerminals = [];
    const root = document.querySelector('#pdf-tool');
    new MutationObserver(() => window.__pdfTerminals.push(root?.dataset.jobTerminal ?? ''))
      .observe(root, { attributes: true, attributeFilter: ['data-job-terminal'] });
  });
  await page.locator('#pdf-process').click();
  await page.waitForFunction(() => (window.__pdfResources ?? []).some((event) => event.resource === 'render-task' && event.event === 'acquired'));
  await page.locator('#pdf-cancel').click();
  await page.waitForFunction(() => document.querySelector('#pdf-tool')?.dataset.jobTerminal === 'cancelled');
  assert.ok(await page.locator('#pdf-result').isHidden(), 'Cancelled compression must expose no result.');
  assert.ok(await page.locator('#pdf-process').isEnabled(), 'Compression button must be responsive after cancellation.');
  const cancellation = await page.evaluate(() => ({ terminals: window.__pdfTerminals, resources: window.__pdfResources }));
  assert.deepEqual(cancellation.terminals, ['cancelled'], 'Active-render cancellation must publish exactly one cancelled terminal.');
  const counts = (resource, event) => cancellation.resources.filter((item) => item.resource === resource && item.event === event).length;
  assert.equal(counts('loading-task', 'acquired'), 1);
  assert.equal(counts('loading-task', 'destroyed'), 1);
  assert.equal(counts('page', 'acquired'), counts('page', 'cleaned'), 'Every acquired page must be cleaned exactly once.');
  assert.equal(counts('render-task', 'cancelled'), 1, 'The one active render must be cancelled exactly once.');

  await page.locator('#pdf-process').click();
  try {
    await page.locator('#pdf-result').waitFor({ state: 'visible', timeout: 120_000 });
  } catch (error) {
    throw new Error(`Compression retry failed. Status: ${await page.locator('#pdf-status').textContent()}; terminal: ${await page.locator('#pdf-tool').getAttribute('data-job-terminal')}`, { cause: error });
  }
  assert.equal(await page.locator('#pdf-tool').getAttribute('data-job-terminal'), 'result');
  await assertLifecycleIsPrivate(page);
  console.log('PASS PDF compression cancellation, disposal, and retry');
}

async function cancelPdfToJpgAndRetry(page, source) {
  await page.goto(`${baseUrl}/pdf-to-jpg`, { waitUntil: 'domcontentloaded' });
  await page.locator('#action-input').setInputFiles({ name: 'many-pages.pdf', mimeType: 'application/pdf', buffer: source });
  await page.locator('#action-work').waitFor({ state: 'visible' });
  await page.locator('#jpg-resolution').selectOption('1.5');
  await page.locator('#action-process').click();
  try {
    await page.waitForFunction(() => /\d+\s+of\s+\d+/i.test(document.querySelector('#action-status')?.textContent ?? ''));
  } catch (error) {
    throw new Error(`PDF-to-JPG did not report progress. Status: ${await page.locator('#action-status').textContent()}; terminal: ${await page.locator('#document-tool').getAttribute('data-job-terminal')}`, { cause: error });
  }
  await page.locator('#action-cancel').click();
  await page.waitForFunction(() => document.querySelector('#document-tool')?.dataset.jobTerminal === 'cancelled');
  assert.ok(await page.locator('#action-result').isHidden(), 'Cancelled PDF-to-JPG must expose no result.');
  assert.ok(await page.locator('#action-process').isEnabled(), 'PDF-to-JPG button must be responsive after cancellation.');

  await page.locator('#action-process').click();
  await page.locator('#action-result').waitFor({ state: 'visible', timeout: 120_000 });
  assert.equal(await page.locator('#document-tool').getAttribute('data-job-terminal'), 'result');
  await assertLifecycleIsPrivate(page);
  console.log('PASS PDF-to-JPG cancellation, disposal, and retry');
}

async function resetSplitWithoutStaleResult(page, source) {
  await page.goto(`${baseUrl}/split-pdf`, { waitUntil: 'domcontentloaded' });
  await page.locator('#action-input').setInputFiles({ name: 'many-pages.pdf', mimeType: 'application/pdf', buffer: source });
  await page.locator('#action-work').waitFor({ state: 'visible' });
  await page.locator('#action-process').click();
  await page.waitForFunction(() => /\d+\s+of\s+\d+/i.test(document.querySelector('#action-status')?.textContent ?? ''));
  await page.locator('#action-remove').click();
  await page.locator('#action-empty').waitFor({ state: 'visible' });
  await page.waitForTimeout(750);
  assert.ok(await page.locator('#action-result').isHidden(), 'Reset split must never expose a stale ZIP result.');
  assert.equal(await page.locator('#document-tool').getAttribute('data-job-terminal'), 'cancelled');
  await assertLifecycleIsPrivate(page);
  console.log('PASS split reset rejects stale ZIP output');
}

async function resetDuringValidationWithoutStalePublication(page, source) {
  await page.addInitScript(() => {
    window.__SORA_TEST_DELAY_OUTPUT_VALIDATION__ = true;
    window.__pdfObjectUrls = 0;
    window.__pdfResultScrolls = 0;
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (...args) => { window.__pdfObjectUrls += 1; return create(...args); };
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      if (this.id === 'action-result') window.__pdfResultScrolls += 1;
      return scroll?.apply(this, args);
    };
  });
  await page.goto(`${baseUrl}/rotate-pdf`, { waitUntil: 'domcontentloaded' });
  await page.locator('#action-input').setInputFiles({ name: 'validation-window.pdf', mimeType: 'application/pdf', buffer: source });
  await page.locator('#action-work').waitFor({ state: 'visible' });
  await page.locator('#action-process').click();
  await page.waitForFunction(() => document.querySelector('#document-tool')?.dataset.outputValidation === 'pending');
  await page.locator('#action-remove').click();
  await page.locator('#action-empty').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  assert.ok(await page.locator('#action-result').isHidden(), 'Reset during validation must reveal no stale result.');
  assert.deepEqual(await page.evaluate(() => ({ urls: window.__pdfObjectUrls, scrolls: window.__pdfResultScrolls })), { urls: 0, scrolls: 0 });

  await page.locator('#action-input').setInputFiles({ name: 'retry.pdf', mimeType: 'application/pdf', buffer: source });
  await page.locator('#action-process').click();
  await page.locator('#action-result').waitFor({ state: 'visible', timeout: 120_000 });
  assert.equal(await page.locator('#document-tool').getAttribute('data-job-terminal'), 'result');
  console.log('PASS reset during output validation rejects stale publication and retry succeeds');
}

await ensureAstroServer();
const executablePath = process.env.SORA_BROWSER_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ headless: true, executablePath });

try {
  const page = await browser.newPage();
  await installLifecycleRecorder(page);
  const source = await imageHeavyPdf();
  if (!process.argv.includes('--active-render-only')) await assertCorruptEngineErrorsAreSafe(page);
  await cancelCompressionAndRetry(page, source);
  if (process.argv.includes('--active-render-only')) process.exitCode = 0;
  else {
  await cancelPdfToJpgAndRetry(page, source);
  await resetSplitWithoutStaleResult(page, source);
  await resetDuringValidationWithoutStalePublication(page, source);
  }
} finally {
  await browser.close();
}
