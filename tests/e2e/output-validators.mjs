import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';

const asUint8Array = (buffer) => new Uint8Array(buffer);

export async function validatePdf(buffer, expected = {}) {
  const bytes = asUint8Array(buffer);
  assert.ok(bytes.byteLength > 0, 'PDF output must not be empty.');
  const document = await PDFDocument.load(bytes);
  const pages = document.getPages();
  if (expected.pageCount !== undefined) {
    assert.equal(pages.length, expected.pageCount, 'PDF page count did not match.');
  }
  if (expected.rotation !== undefined) {
    for (const page of pages) {
      assert.equal(page.getRotation().angle, expected.rotation, 'PDF page rotation did not match.');
    }
  }
  return { pageCount: pages.length, pages };
}

export async function validateDocx(buffer, expectedText = '') {
  const bytes = asUint8Array(buffer);
  assert.ok(bytes.byteLength > 0, 'DOCX output must not be empty.');
  const entries = unzipSync(bytes);
  for (const required of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
    assert.ok(entries[required]?.byteLength > 0, `DOCX is missing ${required}.`);
  }
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  if (expectedText) assert.match(value, new RegExp(expectedText, 'i'), 'DOCX text did not match.');
  return { text: value, entries };
}

export function validateZip(buffer, entryPattern) {
  const entries = unzipSync(asUint8Array(buffer));
  const names = Object.keys(entries).filter((name) => !name.endsWith('/'));
  assert.ok(names.length > 0, 'ZIP output must contain at least one file.');
  for (const name of names) {
    if (entryPattern) assert.match(name, entryPattern, `Unexpected ZIP entry: ${name}`);
    assert.ok(entries[name].byteLength > 0, `ZIP entry ${name} must not be empty.`);
  }
  return { entries, names };
}

export async function validateImageInBrowser(page, buffer, mime) {
  const bytes = Array.from(asUint8Array(buffer));
  const result = await page.evaluate(async ({ bytes: serialized, mimeType }) => {
    const blob = new Blob([new Uint8Array(serialized)], { type: mimeType });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    if (!context) throw new Error('Canvas inspection is unavailable.');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasTransparency = false;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 255) {
        hasTransparency = true;
        break;
      }
    }
    const dimensions = { width: bitmap.width, height: bitmap.height, hasTransparency };
    bitmap.close();
    return dimensions;
  }, { bytes, mimeType: mime });
  assert.ok(result.width > 0 && result.height > 0, 'Image output must decode with positive dimensions.');
  return result;
}

export async function extractPdfText(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const standardFontDataUrl = `${fileURLToPath(new URL('../../node_modules/pdfjs-dist/standard_fonts', import.meta.url)).replaceAll('\\', '/')}/`;
  const loadingTask = pdfjs.getDocument({
    data: asUint8Array(buffer),
    standardFontDataUrl,
  });
  const document = await loadingTask.promise;
  const pages = [];
  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => 'str' in item ? item.str : '').filter(Boolean).join(' '));
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages.join('\n');
}
