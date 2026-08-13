import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPdfForWord, PdfToWordError } from '../../src/lib/pdf-to-word/convert.ts';
import { createDocxFromPages } from '../../src/lib/pdf-to-word/docx.ts';

function createMockPage(number, textItems, pixels = 1000) {
  return {
    number,
    async textItems() {
      return textItems;
    },
    async renderForOcr(maxPixels) {
      assert.ok(maxPixels <= 8_000_000, 'canvas max pixels limit respected');
      return {
        width: Math.min(100, maxPixels),
        height: Math.min(100, maxPixels),
      };
    },
    cleanup() {},
  };
}

function createMockDoc(pages) {
  return {
    pageCount: pages.length,
    async openPage(num) {
      return pages[num - 1];
    },
    async destroy() {},
  };
}

test('embedded pages never call ocr.recognize', async () => {
  let ocrCalled = false;
  const page1 = createMockPage(1, [
    { str: 'This is a long embedded text paragraph that passes the threshold easily.' },
  ]);
  const doc = createMockDoc([page1]);
  const controller = new AbortController();

  const pages = await extractPdfForWord({
    document: doc,
    createOcrEngine: async () => {
      ocrCalled = true;
      return {
        async recognize() {
          return { text: 'OCR text', confidence: 99 };
        },
        async terminate() {},
      };
    },
    signal: controller.signal,
    onProgress() {},
  });

  assert.equal(ocrCalled, false);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].source, 'embedded');
});

test('a one-character page renders and calls OCR once', async () => {
  let ocrCount = 0;
  const page1 = createMockPage(1, [{ str: '1' }]);
  const doc = createMockDoc([page1]);
  const controller = new AbortController();

  const pages = await extractPdfForWord({
    document: doc,
    createOcrEngine: async () => ({
      async recognize() {
        ocrCount++;
        return { text: 'Scanned text recognized', confidence: 95 };
      },
      async terminate() {},
    }),
    signal: controller.signal,
    onProgress() {},
  });

  assert.equal(ocrCount, 1);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].source, 'ocr');
  assert.deepEqual(pages[0].lines, ['Scanned text recognized']);
});

test('mixed pages preserve source order', async () => {
  const page1 = createMockPage(1, [{ str: '1' }]);
  const page2 = createMockPage(2, [
    { str: 'This is another long embedded text paragraph that passes threshold.' },
  ]);
  const doc = createMockDoc([page1, page2]);
  const controller = new AbortController();

  const pages = await extractPdfForWord({
    document: doc,
    createOcrEngine: async () => ({
      async recognize() {
        return { text: 'Page 1 OCR', confidence: 90 };
      },
      async terminate() {},
    }),
    signal: controller.signal,
    onProgress() {},
  });

  assert.equal(pages.length, 2);
  assert.equal(pages[0].pageNumber, 1);
  assert.equal(pages[0].source, 'ocr');
  assert.equal(pages[1].pageNumber, 2);
  assert.equal(pages[1].source, 'embedded');
});

test('a 61-page document rejects with page-limit error', async () => {
  const pages = Array.from({ length: 61 }, (_, i) => createMockPage(i + 1, [{ str: 'Text' }]));
  const doc = createMockDoc(pages);
  const controller = new AbortController();

  await assert.rejects(
    async () => {
      await extractPdfForWord({
        document: doc,
        createOcrEngine: async () => ({}),
        signal: controller.signal,
        onProgress() {},
      });
    },
    (err) => err instanceof PdfToWordError && err.code === 'page-limit',
  );
});

test('DOCX generation converts pages to Blob', async () => {
  const extracted = [
    { pageNumber: 1, source: 'embedded', lines: ['Hello World'] },
    { pageNumber: 2, source: 'ocr', lines: ['Scanned Line'] },
  ];
  const blob = await createDocxFromPages(extracted, 'ltr');
  assert.ok(blob instanceof Blob);
  assert.ok(blob.size > 0);
});
