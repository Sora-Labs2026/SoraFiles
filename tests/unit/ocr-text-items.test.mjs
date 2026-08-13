import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPageText, groupTextItems } from '../../src/lib/ocr/text-items.ts';

test('uses embedded text for a meaningful text layer', () => {
  const items = [
    { str: 'Sora Files scanned-page fallback', transform: [1, 0, 0, 1, 10, 700], hasEOL: true },
    { str: 'keeps document text local', transform: [1, 0, 0, 1, 10, 680] },
  ];
  assert.deepEqual(classifyPageText(items), {
    mode: 'embedded',
    lines: ['Sora Files scanned-page fallback', 'keeps document text local'],
    meaningfulCharacters: 50,
  });
});

test('uses OCR when a scan has only a page number text layer', () => {
  assert.equal(classifyPageText([{ str: '7', transform: [1, 0, 0, 1, 300, 20] }]).mode, 'ocr');
});

test('handles whitespace-only items and split sentences on one baseline', () => {
  const items = [
    { str: 'Hello ', transform: [1, 0, 0, 1, 10, 500] },
    { str: 'world! ', transform: [1, 0, 0, 1, 60, 500] },
    { str: '   ', transform: [1, 0, 0, 1, 110, 500] },
  ];
  const grouped = groupTextItems(items);
  assert.deepEqual(grouped, ['Hello world!']);
});

test('handles CJK text and Arabic text correctly', () => {
  const cjkItems = [{ str: 'Sora Files 画像変換', transform: [1, 0, 0, 1, 10, 700] }];
  const cjkResult = classifyPageText(cjkItems);
  assert.equal(cjkResult.mode, 'embedded');
  assert.ok(cjkResult.meaningfulCharacters >= 12);

  const araItems = [{ str: 'مستندات PDF محلياً', transform: [1, 0, 0, 1, 10, 700] }];
  const araResult = classifyPageText(araItems);
  assert.equal(araResult.mode, 'embedded');
  assert.ok(araResult.meaningfulCharacters >= 12);
});
