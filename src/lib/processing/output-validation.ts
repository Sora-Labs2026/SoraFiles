import { ProcessingError } from './errors.ts';
import { DOCX_DOCUMENT_XML_LIMIT, SIGNATURE_PROBE_BYTES } from './signatures.ts';

export type OutputKind =
  | 'pdf'
  | 'split-pdf-zip'
  | 'pdf-to-jpg-zip'
  | 'docx'
  | 'jpeg'
  | 'png'
  | 'webp';

type ArchiveOutputKind = Extract<OutputKind, 'split-pdf-zip' | 'pdf-to-jpg-zip' | 'docx'>;

const text = new TextDecoder('ascii');

const invalidOutput = () => new ProcessingError({
  code: 'output-invalid',
  phase: 'validate-output',
  retryable: true,
  messageKey: 'errors.output-invalid',
  recoveryKey: 'recovery.retry',
});

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((value, index) => bytes[offset + index] === value);

const asciiAt = (bytes: Uint8Array, value: string, offset = 0): boolean =>
  text.decode(bytes.subarray(offset, offset + value.length)) === value;

const validateArchive = async (blob: Blob, kind: ArchiveOutputKind): Promise<void> => {
  try {
    const { unzipSync } = await import('fflate');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let entryCount = 0;
    let unexpectedEntry = false;
    let documentXml = false;
    let oversizedDocumentXml = false;
    const expectedEntry = kind === 'split-pdf-zip' ? /^page-\d{3}\.pdf$/
      : kind === 'pdf-to-jpg-zip' ? /^page-\d{3}\.jpg$/
        : null;
    unzipSync(bytes, {
      filter(entry) {
        if (!entry.name.endsWith('/')) {
          entryCount += 1;
          if (expectedEntry && !expectedEntry.test(entry.name)) unexpectedEntry = true;
        }
        if (entry.name === 'word/document.xml') {
          documentXml = true;
          oversizedDocumentXml = entry.originalSize > DOCX_DOCUMENT_XML_LIMIT;
        }
        return false;
      },
    });
    if (entryCount === 0) throw invalidOutput();
    if (expectedEntry && unexpectedEntry) throw invalidOutput();
    if (kind === 'docx' && (!documentXml || oversizedDocumentXml)) throw invalidOutput();
  } catch (error) {
    if (error instanceof ProcessingError) throw error;
    throw invalidOutput();
  }
};

export async function validateOutput(blob: Blob, kind: OutputKind): Promise<void> {
  if (blob.size === 0) throw invalidOutput();
  if (kind === 'split-pdf-zip' || kind === 'pdf-to-jpg-zip' || kind === 'docx') {
    await validateArchive(blob, kind);
    return;
  }

  const probe = new Uint8Array(await blob.slice(0, SIGNATURE_PROBE_BYTES).arrayBuffer());
  const valid = kind === 'pdf' ? asciiAt(probe, '%PDF-')
    : kind === 'jpeg' ? startsWith(probe, [0xff, 0xd8, 0xff])
      : kind === 'png' ? startsWith(probe, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        : asciiAt(probe, 'RIFF') && asciiAt(probe, 'WEBP', 8);
  if (!valid) throw invalidOutput();
}
