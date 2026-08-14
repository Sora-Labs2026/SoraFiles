import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { zipSync } from 'fflate';

import { assertAcceptedInput, detectInput } from '../../src/lib/processing/signatures.ts';
import { validateOutput } from '../../src/lib/processing/output-validation.ts';

const encoder = new TextEncoder();

const bytes = (...values) => new Uint8Array(values);
const ascii = (value) => encoder.encode(value);
const concat = (...parts) => {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};
const file = (contents, name = 'fixture.bin', type = 'application/octet-stream') =>
  new File([contents], name, { type });
const zip = (entries) => zipSync(Object.fromEntries(
  Object.entries(entries).map(([name, value]) => [name, typeof value === 'string' ? ascii(value) : value]),
));

const cases = [
  ['pdf', ascii('%PDF-1.7\n'), 'forged.jpg', 'image/jpeg'],
  ['jpeg', bytes(0xff, 0xd8, 0xff, 0xe0), 'photo.bin'],
  ['png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'photo.bin'],
  ['webp', concat(ascii('RIFF'), bytes(0x04, 0, 0, 0), ascii('WEBP')), 'photo.bin'],
  ['gif', ascii('GIF89a'), 'animation.bin'],
  ['bmp', concat(ascii('BM'), bytes(0, 0, 0, 0)), 'bitmap.bin'],
  ['tiff', bytes(0x49, 0x49, 0x2a, 0x00, 0x08, 0, 0, 0), 'scan.bin'],
  ['psd', concat(ascii('8BPS'), bytes(0, 1, 0, 0)), 'layers.bin'],
  ['ico', bytes(0, 0, 1, 0, 1, 0), 'icon.bin'],
  ['jpeg-2000', bytes(0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a), 'image.bin'],
  ['heif', concat(bytes(0, 0, 0, 0x18), ascii('ftyp'), ascii('heic'), bytes(0, 0, 0, 0), ascii('mif1'), ascii('heic')), 'iphone.bin'],
  ['avif', concat(bytes(0, 0, 0, 0x18), ascii('ftyp'), ascii('avif'), bytes(0, 0, 0, 0), ascii('mif1'), ascii('avif')), 'photo.bin'],
  ['svg', ascii('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'vector.bin'],
];

for (const [kind, contents, name, type] of cases) {
  test(`detectInput identifies ${kind} from bytes instead of filename or MIME`, async () => {
    assert.equal((await detectInput(file(contents, name, type))).kind, kind);
  });
}

test('detectInput identifies a genuine DOCX container', async () => {
  const fixture = await readFile(new URL('../fixtures/single-paragraph.docx', import.meta.url));
  assert.equal((await detectInput(file(fixture, 'document.zip', 'application/zip'))).kind, 'docx');
});

test('detectInput recognizes the standalone HEIF major brand', async () => {
  const standaloneHeif = concat(bytes(0, 0, 0, 0x10), ascii('ftyp'), ascii('heif'), bytes(0, 0, 0, 0));
  assert.equal((await detectInput(file(standaloneHeif, 'iphone-photo.bin'))).kind, 'heif');
});

test('detectInput rejects known camera RAW and InDesign signatures', async () => {
  const raw = concat(bytes(0x49, 0x49, 0x2a, 0, 0x10, 0, 0, 0), ascii('CR'), bytes(2, 0));
  const indd = bytes(0x06, 0x06, 0xed, 0xf5, 0xd8, 0x1d, 0x46, 0xe5, 0xbd, 0x31, 0xef, 0xe7, 0xfe, 0x74, 0xb7, 0x1d);
  for (const [name, contents] of [['camera.cr2', raw], ['layout.indd', indd]]) {
    await assert.rejects(() => detectInput(file(contents, name)), (error) => {
      assert.equal(error.value.code, 'unsupported-format');
      return true;
    });
  }
});

test('assertAcceptedInput rejects a real signature that is not accepted by the tool', async () => {
  await assert.rejects(
    () => assertAcceptedInput(file('%PDF-1.7', 'wrong.jpg', 'image/jpeg'), ['jpeg', 'png']),
    (error) => {
      assert.equal(error.value.code, 'invalid-signature');
      return true;
    },
  );
});

test('detectInput rejects unknown and malformed ZIP bytes without trusting metadata', async () => {
  for (const candidate of [
    file('not an image', 'photo.jpg', 'image/jpeg'),
    file(concat(ascii('PK\x03\x04'), ascii('not-a-real-archive')), 'document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  ]) {
    await assert.rejects(() => detectInput(candidate), (error) => {
      assert.ok(['invalid-signature', 'corrupt-input'].includes(error.value.code));
      return true;
    });
  }
});

test('ordinary signature detection reads no more than the first 4096 bytes', async () => {
  const reads = [];
  const probe = {
    name: 'large.pdf',
    type: 'application/pdf',
    size: 50_000_000,
    slice(start, end) {
      reads.push([start, end]);
      return new Blob([ascii('%PDF-1.7')]);
    },
    async arrayBuffer() {
      throw new Error('ordinary detection must not read the complete file');
    },
  };

  assert.equal((await detectInput(probe)).kind, 'pdf');
  assert.deepEqual(reads, [[0, 4096]]);
});

test('validateOutput accepts each registered output container', async () => {
  const valid = [
    ['pdf', new Blob([ascii('%PDF-1.7\n')])],
    ['jpeg', new Blob([bytes(0xff, 0xd8, 0xff, 0xdb)])],
    ['png', new Blob([bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)])],
    ['webp', new Blob([concat(ascii('RIFF'), bytes(0x04, 0, 0, 0), ascii('WEBP'))])],
    ['split-pdf-zip', new Blob([zip({ 'page-001.pdf': '%PDF-1.7' })])],
    ['pdf-to-jpg-zip', new Blob([zip({ 'page-001.jpg': bytes(0xff, 0xd8, 0xff) })])],
    ['docx', new Blob([zip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': '<w:document/>' })])],
  ];

  for (const [kind, blob] of valid) {
    await assert.doesNotReject(() => validateOutput(blob, kind));
  }
});

test('ordinary output validation reads no more than the first 4096 bytes', async () => {
  const reads = [];
  const output = {
    size: 50_000_000,
    slice(start, end) {
      reads.push([start, end]);
      return new Blob([ascii('%PDF-1.7')]);
    },
    async arrayBuffer() {
      throw new Error('ordinary validation must not read the complete output');
    },
  };

  await validateOutput(output, 'pdf');
  assert.deepEqual(reads, [[0, 4096]]);
});

test('ordinary signature and output modules do not eagerly load archive code', async () => {
  const [signatureSource, outputSource] = await Promise.all([
    readFile(new URL('../../src/lib/processing/signatures.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../src/lib/processing/output-validation.ts', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(signatureSource, /^import\s+\{\s*unzipSync\s*\}\s+from\s+['"]fflate['"]/m);
  assert.doesNotMatch(outputSource, /^import\s+\{\s*unzipSync\s*\}\s+from\s+['"]fflate['"]/m);
  assert.match(signatureSource, /await import\(['"]fflate['"]\)/);
  assert.match(outputSource, /await import\(['"]fflate['"]\)/);
});

test('validateOutput rejects forged and structurally invalid results as output-invalid', async () => {
  const invalid = [
    ['pdf', new Blob(['not pdf'])],
    ['jpeg', new Blob(['not jpeg'])],
    ['png', new Blob(['not png'])],
    ['webp', new Blob(['not webp'])],
    ['split-pdf-zip', new Blob([ascii('PK\x03\x04broken')])],
    ['pdf-to-jpg-zip', new Blob([zip({ 'folder/': new Uint8Array() })])],
    ['docx', new Blob([zip({ 'word/styles.xml': '<w:styles/>' })])],
  ];

  for (const [kind, blob] of invalid) {
    await assert.rejects(() => validateOutput(blob, kind), (error) => {
      assert.equal(error.value.code, 'output-invalid');
      assert.equal(error.value.phase, 'validate-output');
      return true;
    });
  }
});

test('ZIP output validation requires the exact tool-specific page entry contract', async () => {
  const wrong = [
    ['split-pdf-zip', new Blob([zip({ 'page-001.jpg': bytes(0xff, 0xd8, 0xff) })])],
    ['pdf-to-jpg-zip', new Blob([zip({ 'page-001.pdf': '%PDF-1.7' })])],
    ['split-pdf-zip', new Blob([zip({ 'readme.txt': 'unrelated output' })])],
    ['zip', new Blob([zip({ 'readme.txt': 'legacy generic ZIP must not pass' })])],
  ];

  for (const [kind, blob] of wrong) {
    await assert.rejects(() => validateOutput(blob, kind), (error) => {
      assert.equal(error.value.code, 'output-invalid');
      return true;
    });
  }
});

test('DOCX input and output reject an oversized document XML entry', async () => {
  const oversized = new Uint8Array(20_000_001);
  const archive = new Blob([zip({ 'word/document.xml': oversized })]);

  await assert.rejects(
    () => detectInput(new File([archive], 'oversized.docx')),
    (error) => ['corrupt-input', 'unsupported-variant'].includes(error.value.code),
  );
  await assert.rejects(
    () => validateOutput(archive, 'docx'),
    (error) => error.value.code === 'output-invalid',
  );
});
