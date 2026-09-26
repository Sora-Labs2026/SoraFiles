import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyManualAdjustments,
  defaultManualAdjustments,
  normalizeManualAdjustments,
} from '../../src/lib/image/manual-adjustments.ts';

if (!globalThis.ImageData) {
  globalThis.ImageData = class ImageData {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
  };
}

const image = (pixels, width, height) => new ImageData(new Uint8ClampedArray(pixels), width, height);

test('manual adjustment defaults preserve pixels and normalize safe ranges', () => {
  const source = image([12, 40, 220, 117, 240, 90, 30, 255], 2, 1);
  const output = applyManualAdjustments(source, defaultManualAdjustments());
  assert.notEqual(output.data, source.data);
  assert.deepEqual([...output.data], [...source.data]);
  assert.deepEqual(normalizeManualAdjustments({ exposure: 900, blackPoint: -20, sharpness: 130 }), {
    ...defaultManualAdjustments(), exposure: 100, blackPoint: 0, sharpness: 100,
  });
});

test('light controls change shadows and highlights while preserving alpha', () => {
  const source = image([28, 28, 28, 91, 128, 128, 128, 170, 230, 230, 230, 249], 3, 1);
  const output = applyManualAdjustments(source, { exposure: 10, shadows: 45, highlights: -80 });
  assert.ok(output.data[0] > source.data[0], 'positive shadows should lift dark tones');
  assert.notEqual(output.data[4], source.data[4], 'midtones should react to exposure and contrast');
  assert.ok(output.data[8] < source.data[8], 'negative highlights should retain bright detail');
  assert.deepEqual([output.data[3], output.data[7], output.data[11]], [91, 170, 249]);
});

test('noise reduction smooths isolated noise and detail controls remain bounded', () => {
  const pixels = [];
  for (let index = 0; index < 25; index += 1) pixels.push(index === 12 ? 135 : 100, index === 12 ? 135 : 100, index === 12 ? 135 : 100, 255);
  const source = image(pixels, 5, 5);
  const denoised = applyManualAdjustments(source, { noiseReduction: 100 });
  assert.ok(denoised.data[12 * 4] < 135, 'isolated noise should be reduced');
  const detailed = applyManualAdjustments(source, { definition: 100, sharpness: 100 });
  assert.ok(detailed.data.every((value) => value >= 0 && value <= 255));
});

test('Doc Scanner and Edit Image expose the complete shared live adjustment stack', async () => {
  const [scanner, editor] = await Promise.all([
    readFile('src/components/DocScannerWorkbench.astro', 'utf8'),
    readFile('src/components/ExtraToolWorkbench.astro', 'utf8'),
  ]);
  for (const key of ['exposure','highlights','shadows','contrast','brightness','blackPoint','definition','sharpness','noiseReduction']) {
    assert.match(scanner, new RegExp(`['"]${key}['"]`), `Doc Scanner is missing ${key}.`);
    assert.match(editor, new RegExp(`['"]${key}['"]`), `Edit Image is missing ${key}.`);
  }
  assert.match(scanner, /applyManualAdjustments/);
  assert.match(scanner, /queueAdjustmentPreview/);
  assert.match(scanner, /adjustments:normalizeManualAdjustments\(item\.adjustments\)/);
  assert.match(editor, /applyManualAdjustments\(pixels,editState,false\)/);
});
