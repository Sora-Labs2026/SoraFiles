import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { stripImageMeta, stripOpenXmlMeta } from '../../src/lib/metadata-strip.js';

const namedBlob = (parts, name, type) => {
  const blob = new Blob(parts, { type });
  Object.defineProperty(blob, 'name', { value: name });
  return blob;
};

const pngChunk = (type, data = new Uint8Array()) => {
  const output = new Uint8Array(12 + data.length);
  new DataView(output.buffer).setUint32(0, data.length);
  output.set(strToU8(type), 4);
  output.set(data, 8);
  return output;
};

test('metadata cleanup removes PNG text chunks without re-encoding image bytes', async () => {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const input = namedBlob([signature, pngChunk('tEXt', strToU8('Author\0Sora')), pngChunk('IEND')], 'private.png', 'image/png');
  const result = await stripImageMeta(input);
  const text = new TextDecoder('latin1').decode(await result.blob.arrayBuffer());
  assert.doesNotMatch(text, /tEXt|Author|Sora/);
  assert.match(result.detail, /without re-encoding pixels/);
  assert.equal(result.ext, 'png');
});

test('metadata cleanup clears Open XML properties while preserving document content', async () => {
  const archive = zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'docProps/core.xml': strToU8('<cp:coreProperties><dc:creator>Private Author</dc:creator><dc:title>Secret</dc:title></cp:coreProperties>'),
    'word/document.xml': strToU8('<document><body>Keep this content</body></document>'),
  });
  const input = namedBlob([archive], 'private.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const result = await stripOpenXmlMeta(input);
  const cleaned = unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
  assert.doesNotMatch(strFromU8(cleaned['docProps/core.xml']), /Private Author|Secret/);
  assert.match(strFromU8(cleaned['word/document.xml']), /Keep this content/);
  assert.equal(result.ext, 'docx');
});

test('shared workbenches retain Chapter 1 format, batch, preview, and signature guarantees', async () => {
  const [image, document, preview, localizedPage] = await Promise.all([
    readFile('src/components/FileWorkbench.astro', 'utf8'),
    readFile('src/components/DocumentActionWorkbench.astro', 'utf8'),
    readFile('src/components/PdfWorkbench.astro', 'utf8'),
    readFile('src/components/LocalizedToolPage.astro', 'utf8'),
  ]);

  assert.match(localizedPage, /forceJpg=\{tool\.id === 'heic-to-jpg'\}/);
  assert.match(image, /forceJpg \? 'image\/jpeg'/);
  assert.match(image, /Confirm the white background or choose a format that preserves transparency/);
  assert.doesNotMatch(image, /formatSelect\.value\s*=\s*'image\/webp'.*mode/s);

  assert.match(document, /id="action-add"/);
  assert.match(document, /Move up/);
  assert.match(document, /data-merge-minimum=\{t\('wb\.err\.tooFew'\)\}/);
  assert.match(document, /actionRoot\.dataset\.mergeMinimum/);
  assert.match(document, /data-sign-mode="type"/);
  assert.match(document, /data-sign-mode="draw"/);
  assert.match(document, /data-sign-mode="upload"/);
  assert.match(document, /setPointerCapture/);
  assert.match(document, /same normalized coordinates/);

  assert.match(preview, /1 of/);
  assert.match(preview, /max-h-\[20rem\]/);
  assert.match(preview, /devicePixelRatio/);
  assert.match(preview, /id="pdf-preview-stage"/);
  assert.match(preview, /pdfPreviewStage\.clientWidth/);
  assert.match(preview, /new ResizeObserver\(schedulePreviewResize\)/);
  assert.doesNotMatch(preview, /Math\.max\(220, Math\.min\(520, window\.innerWidth/);
  assert.match(preview, /previewRenderTask\?\.cancel/);
});

test('document and image workbenches expose the new resilient editing controls', async () => {
  const [document, scanner, imageEditor] = await Promise.all([
    readFile('src/components/DocumentActionWorkbench.astro', 'utf8'),
    readFile('src/components/DocScannerWorkbench.astro', 'utf8'),
    readFile('src/components/ExtraToolWorkbench.astro', 'utf8'),
  ]);
  assert.match(document, /id="remove-page-spec"[\s\S]*?inputmode="text"/);
  assert.match(document, /data-watermark-mode="image"/);
  assert.match(document, /value="as-is"/);
  assert.match(document, /value="remove"/);
  assert.match(document, /watermarkProcessedCanvas/);
  assert.doesNotMatch(scanner, /data-camera-start|data-camera-panel|getUserMedia/);
  assert.match(scanner, /sorafiles-doc-scanner-draft/);
  assert.match(scanner, /data-scanner-reset/);
  assert.match(scanner, /quality = \.97/);
  assert.match(scanner, /existing\?\.filter \|\| 'color'/);
  assert.match(scanner, /data-scanner-action-status/);
  assert.match(scanner, /data-export-format/);
  assert.match(scanner, /data-export-run/);
  assert.match(imageEditor, /data-edit-preview/);
  assert.match(imageEditor, /data-edit-ratio/);
  assert.match(imageEditor, /data-edit-preset/);
  assert.match(imageEditor, /pointerdown/);
  assert.match(imageEditor, /setPointerCapture/);
  assert.match(imageEditor, /imageSmoothingQuality = 'high'/);
  assert.match(imageEditor, /'brightness'/);
  assert.match(imageEditor, /renderEditCanvas/);
});
