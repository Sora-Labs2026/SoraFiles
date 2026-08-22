import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCompressionTarget, compressionTargetBytes, reductionPercent } from '../../src/lib/compression/targets.ts';

test('80 percent reduction creates an exact 20 percent byte ceiling', () => {
  assert.equal(compressionTargetBytes({ mode: 'percent', sourceBytes: 100_000, reductionPercent: 80 }), 20_000);
});

test('target sizes and auto mode are hard ceilings', () => {
  assert.equal(compressionTargetBytes({ mode: 'target', sourceBytes: 1_000_000, targetKb: 200 }), 200_000);
  assert.equal(compressionTargetBytes({ mode: 'auto', sourceBytes: 100_000 }), 80_000);
  assert.doesNotThrow(() => assertCompressionTarget(20_000, 20_000));
  assert.throws(() => assertCompressionTarget(20_001, 20_000), /hard limit could not be reached/);
});

test('invalid or non-compressing goals are rejected', () => {
  assert.throws(() => compressionTargetBytes({ mode: 'target', sourceBytes: 100_000, targetKb: 100 }), /smaller than the original/);
  assert.throws(() => compressionTargetBytes({ mode: 'percent', sourceBytes: 100_000, reductionPercent: 0 }), /1% to 95%/);
  assert.equal(reductionPercent(100_000, 20_000), 80);
});
