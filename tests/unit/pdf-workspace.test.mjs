import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('the shared PDF workspace is reused by all page-oriented PDF tools', async () => {
  const [workbench, workspace, controller] = await Promise.all([
    read('src/components/DocumentActionWorkbench.astro'),
    read('src/components/VisualPdfWorkspace.astro'),
    read('src/lib/pdf/visual-workspace.ts'),
  ]);
  for (const tool of ['merge-pdf', 'split-pdf', 'rotate-pdf', 'remove-pages', 'watermark-pdf', 'page-numbers', 'sign-pdf']) {
    assert.match(workbench, new RegExp(`['"]${tool}['"]`), `${tool} is not connected to the shared workspace.`);
  }
  for (const capability of ['data-pdf-page-grid', 'data-pdf-range', 'data-pdf-undo', 'data-pdf-redo', 'data-pdf-preview-dialog']) {
    assert.match(workspace, new RegExp(capability), `Workspace is missing ${capability}.`);
  }
  assert.match(controller, /IntersectionObserver/, 'Thumbnails must be rendered lazily.');
  assert.match(controller, /getSelectedPages/, 'Consumers need one shared selection API.');
  assert.match(controller, /moveSelected/, 'Workspace must provide a non-drag reorder path.');
});

test('quality-guarded compression and splitting preserve native PDF objects', async () => {
  const [compressor, worker, actions] = await Promise.all([
    read('src/components/PdfWorkbench.astro'),
    read('src/workers/pdf-compression.worker.ts'),
    read('src/components/DocumentActionWorkbench.astro'),
  ]);
  assert.match(compressor, /value="60"/, 'Balanced compression must be the default.');
  assert.match(compressor, /inspectPdf/);
  assert.match(compressor, /rgbaSsim/);
  assert.match(worker, /--object-streams=generate/);
  assert.match(worker, /setdistillerparams/);
  assert.doesNotMatch(compressor, /quality = Math\.max\(0\.14|scale = Math\.max\(0\.32/);
  const splitBody = actions.slice(actions.indexOf('const splitPdf'), actions.indexOf('const rotatePdf'));
  assert.match(splitBody, /copyPages\(source/, 'Split must copy native PDF pages.');
  assert.doesNotMatch(splitBody, /render\(|embedJpg|embedPng/, 'Normal split must never rasterize pages.');
});

test('PDF OCR exposes searchable PDF and skips OCR on readable native pages', async () => {
  const [workbench, engine] = await Promise.all([
    read('src/components/ExtraToolWorkbench.astro'),
    read('src/engines/liveExtra.js'),
  ]);
  assert.match(workbench, /data-ocr-output/);
  assert.match(workbench, /value="pdf" selected>Searchable PDF/);
  assert.match(engine, /meaningful < 12/);
  assert.match(engine, /addSearchText\(searchable\.getPage/);
  assert.match(engine, /opacity: 0/, 'OCR text layer must remain visually invisible.');
});

test('repair and metadata workflows expose recovery and verification reports', async () => {
  const [workbench, engine] = await Promise.all([
    read('src/components/ExtraToolWorkbench.astro'),
    read('src/engines/liveExtra.js'),
  ]);
  assert.match(engine, /throwOnInvalidObject: false/);
  assert.match(engine, /salvaged\.addPage/);
  assert.match(engine, /recovered as page images; \$\{skipped\} skipped/);
  assert.match(workbench, /data-metadata-category/);
  assert.match(engine, /Found:/);
  assert.match(workbench, /result\.detail/);
});
