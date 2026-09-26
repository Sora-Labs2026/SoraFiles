import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('one adaptive shell provides canvas, preview, and quick workspace modes', async () => {
  const [shell, documents, extras, compressor, imagePreview] = await Promise.all([
    read('src/components/AdaptiveWorkspace.astro'),
    read('src/components/DocumentActionWorkbench.astro'),
    read('src/components/ExtraToolWorkbench.astro'),
    read('src/components/PdfWorkbench.astro'),
    read('src/components/FileWorkbench.astro'),
  ]);
  for (const contract of ['data-adaptive-workspace', 'data-workspace-mode', 'data-workspace-discard', 'data-workspace-mobile-nav', 'prefers-reduced-motion']) {
    assert.match(shell, new RegExp(contract), `Adaptive shell is missing ${contract}.`);
  }
  assert.match(documents, /mode=\{workspaceMode\}/);
  assert.match(compressor, /mode="preview"/);
  assert.match(imagePreview, /mode="preview"/);
  assert.match(extras, /quickToolIds/);
  assert.match(extras, /'protect-pdf'.*'unlock-pdf'.*'repair-pdf'.*'metadata-remover'/s);
});

test('Sign PDF is a direct-manipulation reference workspace', async () => {
  const [markup, controller, actions] = await Promise.all([
    read('src/components/VisualPdfWorkspace.astro'),
    read('src/lib/pdf/visual-workspace.ts'),
    read('src/components/DocumentActionWorkbench.astro'),
  ]);
  for (const capability of ['data-workspace-pages', 'data-workspace-canvas', 'data-signature-instance', 'data-sign-handle', 'signature-page-stage']) {
    assert.match(markup, new RegExp(capability), `Sign PDF workspace is missing ${capability}.`);
  }
  assert.match(actions, /translate3d\(/, 'Dragging should use a visual transform during pointer movement.');
  assert.match(actions, /signature-duplicate/);
  assert.match(actions, /signature-delete/);
  assert.match(actions, /signatureUndo/);
  assert.match(actions, /\[data-signature-instance\]/, 'Export must consume placed signature objects.');
  assert.match(controller, /IntersectionObserver/, 'Page thumbnails must remain lazy.');
  assert.match(controller, /renderMainPage/, 'The shared PDF rail must drive a large central preview.');
});

test('visual image tools use the shared canvas workspace shell', async () => {
  const sources = await Promise.all([
    read('src/components/ResizeImageWorkbench.astro'),
    read('src/components/BackgroundRemovalWorkbench.astro'),
    read('src/components/DocScannerWorkbench.astro'),
  ]);
  for (const source of sources) {
    assert.match(source, /AdaptiveWorkspace/);
    assert.match(source, /mode="canvas"/);
  }
});
