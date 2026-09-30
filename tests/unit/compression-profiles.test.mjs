import assert from 'node:assert/strict';
import test from 'node:test';
import { fallbackPdfProfile, imageProfileForStrength, pdfProfileForStrength, profileNameForStrength } from '../../src/lib/compression/profiles.ts';

test('strength mapping keeps 60 in the balanced quality profile', () => {
  assert.equal(profileNameForStrength(0), 'safe');
  assert.equal(profileNameForStrength(29), 'safe');
  assert.equal(profileNameForStrength(30), 'quality');
  assert.equal(profileNameForStrength(54), 'quality');
  assert.equal(profileNameForStrength(60), 'balanced');
  assert.equal(profileNameForStrength(75), 'strong');
  assert.equal(profileNameForStrength(90), 'max-safe');
});

test('PDF profiles enforce locked DPI, QFactor, and SSIM floors', () => {
  assert.deepEqual(pdfProfileForStrength(60), {
    name: 'balanced', label: 'Balanced', dpi: 200, qFactor: .35, monoDpi: 300, ssimFloor: .985,
  });
  assert.equal(pdfProfileForStrength(100).dpi, 150);
  assert.equal(pdfProfileForStrength(100, true).dpi, 120);
  assert.equal(fallbackPdfProfile(pdfProfileForStrength(95))?.name, 'strong');
});

test('image profiles never cross the quality floor and protect screenshots', () => {
  assert.equal(imageProfileForStrength(60).jpegQuality, 84);
  assert.equal(imageProfileForStrength(100).jpegQuality, 76);
  assert.ok(imageProfileForStrength(100, true).jpegQuality >= 86);
  assert.ok(imageProfileForStrength(100, true).ssimFloor >= .992);
});
