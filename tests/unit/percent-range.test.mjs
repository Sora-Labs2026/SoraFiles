import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { normalizedRangeProgress } from '../../src/utils/percentRange.ts';

test('range progress is normalized from min and max instead of assuming value is a percentage', () => {
  assert.equal(normalizedRangeProgress(0, 0, 100), 0);
  assert.equal(normalizedRangeProgress(88, 0, 100), .88);
  assert.equal(normalizedRangeProgress(70, 40, 100), .5);
  assert.equal(normalizedRangeProgress(100, 1, 200), 99 / 199);
  assert.equal(normalizedRangeProgress(-20, -100, 100), .4);
});

test('range progress clamps invalid and out-of-range values safely', () => {
  assert.equal(normalizedRangeProgress(-1, 0, 100), 0);
  assert.equal(normalizedRangeProgress(101, 0, 100), 1);
  assert.equal(normalizedRangeProgress(Number.NaN, 0, 100), 0);
  assert.equal(normalizedRangeProgress(5, 10, 10), 0);
});

test('shared range CSS uses the normalized property in Chromium and native progress in Firefox', async () => {
  const css = await readFile(new URL('../../src/styles/global.css', import.meta.url), 'utf8');
  assert.match(css, /\.sf-range::\-webkit-slider-runnable-track\s*\{[^}]*var\(--range-progress\)[^}]*var\(--range-progress\)/s);
  assert.match(css, /\.sf-range::\-moz-range-progress\s*\{[^}]*background:\s*#7c3aed/s);
  assert.match(css, /\.sf-range::\-webkit-slider-thumb\s*\{[^}]*margin-top:\s*-.375rem/s);
});
