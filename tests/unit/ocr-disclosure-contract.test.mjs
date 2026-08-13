import assert from 'node:assert/strict';
import test from 'node:test';
import {
  missingTextRequirements,
  spanishHomepageOcrRequirements,
} from '../../scripts/lib/ocr-disclosure-contract.mjs';

const priorSpanishDisclosure = 'Las conversiones PDF↔Word son básicas y centradas en texto. Las páginas escaneadas pueden usar OCR local, pero las tablas complejas, columnas, imágenes y tipografías exactas se simplifican, y la precisión depende de la claridad, el idioma, la escritura y la estructura de la página.';
const truthfulSpanishDisclosure = `${priorSpanishDisclosure} El diseño exacto de la página no se reconstruye.`;

test('Spanish homepage OCR disclosure requires an explicit exact-layout reconstruction limit', () => {
  assert.equal(missingTextRequirements(priorSpanishDisclosure, spanishHomepageOcrRequirements).length, 1);
  assert.equal(missingTextRequirements(truthfulSpanishDisclosure, spanishHomepageOcrRequirements).length, 0);
});
