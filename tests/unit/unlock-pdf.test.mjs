import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

// A real user unlocks a PDF to share it: the result must open without a password and must not
// carry the old encryption dictionary (and its password hashes) along as leftover bytes.
test('unlocking an AES-256 PDF removes the password and the stale /Encrypt dictionary', async () => {
  const { unlockPdf } = await import('../../src/engines/liveExtra.js');
  const bytes = await readFile(new URL('../fixtures/sorafiles-qa/protected.pdf', import.meta.url));
  await assert.rejects(PDFDocument.load(bytes), /encrypt/i, 'the fixture must be encrypted');
  const [result] = await unlockPdf([{ name: 'protected.pdf', arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }], { password: 'SoraQA2026!' });
  const out = Buffer.from(await result.blob.arrayBuffer());
  assert.equal(result.name, 'protected-unlocked.pdf');
  const doc = await PDFDocument.load(out);
  assert.equal(doc.isEncrypted, false);
  assert.equal(doc.getPageCount(), 3);
  assert.doesNotMatch(out.toString('latin1'), /\/Encrypt|\/StdCF|\/AESV3/, 'no encryption dictionary may remain in the unlocked file');
  // A wrong password is refused rather than producing a broken file.
  await assert.rejects(unlockPdf([{ name: 'protected.pdf', arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }], { password: 'nope' }));
});
