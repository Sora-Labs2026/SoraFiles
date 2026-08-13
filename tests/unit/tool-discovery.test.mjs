import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiscoveryText,
  formatResultCount,
  matchesDiscoveryFilter,
  matchesDiscoveryQuery,
  normalizeDiscoveryText,
  popularWorkflowSlugs,
} from '../../src/lib/tool-discovery.ts';

test('normalizes case, punctuation, whitespace, and removable diacritics', () => {
  assert.equal(normalizeDiscoveryText('  Réduire—PDF!! ', 'fr'), 'reduire pdf');
});

test('collapses multiple spaces between query terms', () => {
  assert.equal(normalizeDiscoveryText('make     PDF\t smaller', 'en'), 'make pdf smaller');
});

test('treats punctuation-only input as an empty query', () => {
  assert.equal(normalizeDiscoveryText('…—!!!', 'en'), '');
  assert.equal(matchesDiscoveryQuery('compress pdf make pdf smaller', '…—!!!', 'en'), true);
});

test('keeps non-Latin search terms meaningful', () => {
  assert.equal(normalizeDiscoveryText('PDFを 結合', 'ja'), 'pdfを 結合');
  assert.equal(normalizeDiscoveryText('دمج PDF', 'ar'), 'دمج pdf');
});

test('preserves meaningful combining marks in Japanese, Devanagari, and Thai', () => {
  assert.notEqual(normalizeDiscoveryText('が', 'ja'), normalizeDiscoveryText('か', 'ja'));
  assert.equal(normalizeDiscoveryText('फ़ाइल छोटी करें', 'hi'), 'फ़ाइल छोटी करें'.normalize('NFKD'));
  assert.equal(normalizeDiscoveryText('ลดขนาดไฟล์', 'th'), 'ลดขนาดไฟล์'.normalize('NFKD'));
});

test('removes Latin diacritics without stripping marks from mixed native terms', () => {
  assert.equal(normalizeDiscoveryText('Réduire PDF', 'fr'), 'reduire pdf');
  assert.equal(normalizeDiscoveryText('が PDF', 'ja'), 'が pdf'.normalize('NFKD'));
  assert.equal(normalizeDiscoveryText('फ़ाइल PDF', 'hi'), 'फ़ाइल pdf'.normalize('NFKD'));
});

test('matches every query token regardless of order', () => {
  const text = buildDiscoveryText(['Merge PDF', 'combine documents', 'PDF zusammenfügen'], 'en');
  assert.equal(matchesDiscoveryQuery(text, 'pdf combine', 'en'), true);
  assert.equal(matchesDiscoveryQuery(text, 'combine pdf', 'en'), true);
  assert.equal(matchesDiscoveryQuery(text, 'pdf resize', 'en'), false);
});

test('matches query diacritics against normalized discovery text', () => {
  const text = buildDiscoveryText(['Réduire le PDF'], 'fr');
  assert.equal(matchesDiscoveryQuery(text, 'reduire', 'fr'), true);
});

test('combines category and query filters', () => {
  const entry = { slug: 'merge-pdf', category: 'organize', searchText: 'merge pdf combine documents' };
  assert.equal(matchesDiscoveryFilter(entry, 'combine', 'organize', 'en'), true);
  assert.equal(matchesDiscoveryFilter(entry, 'combine', 'convert', 'en'), false);
  assert.equal(matchesDiscoveryFilter(entry, 'missing', 'organize', 'en'), false);
});

test('formats localized count templates without grammar assumptions', () => {
  assert.equal(formatResultCount('Results: {count}', 7), 'Results: 7');
});

test('keeps the approved popular workflow order', () => {
  assert.deepEqual(popularWorkflowSlugs, ['compress-pdf', 'compress-image', 'image-converter', 'merge-pdf', 'pdf-to-jpg', 'jpg-to-pdf']);
});
