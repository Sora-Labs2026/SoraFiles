import test from 'node:test';
import assert from 'node:assert/strict';
import { safeOutputStem, shortenFilename } from '../../src/utils/filename.ts';

test('long Unicode and RTL filenames remain bounded without splitting graphemes', () => {
  const filename = `${'ملف🙂文書'.repeat(40)}.pdf`;
  const shortened = shortenFilename(filename, 42);
  assert.ok(Array.from(shortened).length < Array.from(filename).length);
  assert.match(shortened, /\.pdf$/);
  assert.match(shortened, /…/);
  assert.doesNotMatch(shortened, /\uFFFD/);
});

test('short filenames remain byte-for-byte unchanged', () => {
  assert.equal(shortenFilename('quarterly-report.pdf'), 'quarterly-report.pdf');
});

test('output stems preserve useful Unicode while removing paths and controls', () => {
  assert.equal(safeOutputStem('../folder/ملف🙂文書.pdf'), 'ملف🙂文書');
  assert.equal(safeOutputStem('folder\\report\u202Ecod.exe.pdf'), 'reportcod.exe');
  assert.equal(safeOutputStem('CON.pdf'), 'file-CON');
  assert.equal(safeOutputStem('..\\..\\?.pdf'), 'sora-file');
});

test('output stems are bounded without splitting grapheme clusters', () => {
  const stem = safeOutputStem(`${'ملف🙂文書'.repeat(40)}.pdf`, 'file', 48);
  assert.ok(Array.from(stem).length <= 48);
  assert.doesNotMatch(stem, /[\\/:*?"<>|]/);
  assert.doesNotMatch(stem, /\uFFFD/);
});
