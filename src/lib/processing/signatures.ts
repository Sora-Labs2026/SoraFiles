import { ProcessingError } from './errors.ts';

export const SIGNATURE_PROBE_BYTES = 4_096;
export const DOCX_DOCUMENT_XML_LIMIT = 20_000_000;

export type InputKind =
  | 'pdf'
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'bmp'
  | 'tiff'
  | 'psd'
  | 'ico'
  | 'jpeg-2000'
  | 'heif'
  | 'avif'
  | 'svg'
  | 'docx';

export interface DetectedInput {
  kind: InputKind;
}

type BlobInput = Pick<Blob, 'size' | 'slice' | 'arrayBuffer'>;

const text = new TextDecoder('ascii');

const processingError = (
  code: 'invalid-signature' | 'corrupt-input' | 'unsupported-format' | 'unsupported-variant',
) => new ProcessingError({
  code,
  phase: 'validate',
  retryable: false,
  messageKey: `errors.${code}`,
  recoveryKey: code === 'unsupported-format' || code === 'unsupported-variant'
    ? 'recovery.chooseSupportedFormat'
    : 'recovery.chooseOriginal',
});

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  signature.every((value, index) => bytes[offset + index] === value);

const asciiAt = (bytes: Uint8Array, value: string, offset = 0): boolean =>
  text.decode(bytes.subarray(offset, offset + value.length)) === value;

const isIsoBmff = (bytes: Uint8Array): boolean => bytes.length >= 12 && asciiAt(bytes, 'ftyp', 4);

const isoBrands = (bytes: Uint8Array): string[] => {
  if (!isIsoBmff(bytes)) return [];
  const declaredSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  const boxEnd = Math.min(bytes.length, declaredSize >= 16 ? declaredSize : bytes.length);
  const brands: string[] = [];
  for (let offset = 8; offset + 4 <= boxEnd; offset += 4) {
    if (offset === 12) continue;
    brands.push(text.decode(bytes.subarray(offset, offset + 4)));
  }
  return brands;
};

const inspectDocx = async (file: BlobInput): Promise<'docx' | 'oversized' | 'not-docx' | 'corrupt'> => {
  try {
    const { unzipSync } = await import('fflate');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let documentXml = false;
    let oversized = false;
    unzipSync(bytes, {
      filter(entry) {
        if (entry.name !== 'word/document.xml') return false;
        if (entry.originalSize > DOCX_DOCUMENT_XML_LIMIT) {
          oversized = true;
          return false;
        }
        documentXml = true;
        return true;
      },
    });
    if (oversized) return 'oversized';
    return documentXml ? 'docx' : 'not-docx';
  } catch {
    return 'corrupt';
  }
};

export async function detectInput(file: BlobInput): Promise<DetectedInput> {
  const probe = new Uint8Array(await file.slice(0, SIGNATURE_PROBE_BYTES).arrayBuffer());

  if (asciiAt(probe, '%PDF-')) return { kind: 'pdf' };
  if (startsWith(probe, [0xff, 0xd8, 0xff])) return { kind: 'jpeg' };
  if (startsWith(probe, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: 'png' };
  if (asciiAt(probe, 'RIFF') && asciiAt(probe, 'WEBP', 8)) return { kind: 'webp' };
  if (asciiAt(probe, 'GIF87a') || asciiAt(probe, 'GIF89a')) return { kind: 'gif' };
  if (asciiAt(probe, 'BM')) return { kind: 'bmp' };

  if (
    startsWith(probe, [0x06, 0x06, 0xed, 0xf5, 0xd8, 0x1d, 0x46, 0xe5, 0xbd, 0x31, 0xef, 0xe7, 0xfe, 0x74, 0xb7, 0x1d])
    || startsWith(probe, [0x06, 0x06, 0xed, 0xf5, 0xc4, 0xd8, 0x1b, 0x4a, 0xa5, 0x1f, 0xe7, 0xfe, 0x74, 0xb7, 0x1d])
  ) throw processingError('unsupported-format');

  const isCr2 = startsWith(probe, [0x49, 0x49, 0x2a, 0, 0x10, 0, 0, 0, 0x43, 0x52]);
  const isKnownRaw = isCr2
    || asciiAt(probe, 'FUJIFILMCCD-RAW ')
    || startsWith(probe, [0x49, 0x49, 0x52, 0x4f])
    || startsWith(probe, [0x4d, 0x4d, 0x4f, 0x52])
    || startsWith(probe, [0x49, 0x49, 0x55, 0]);
  if (isKnownRaw) throw processingError('unsupported-format');

  if (startsWith(probe, [0x49, 0x49, 0x2a, 0]) || startsWith(probe, [0x4d, 0x4d, 0, 0x2a])) return { kind: 'tiff' };
  if (asciiAt(probe, '8BPS')) return { kind: 'psd' };
  if (startsWith(probe, [0, 0, 1, 0])) return { kind: 'ico' };
  if (
    startsWith(probe, [0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a])
    || startsWith(probe, [0xff, 0x4f, 0xff, 0x51])
  ) return { kind: 'jpeg-2000' };

  if (isIsoBmff(probe)) {
    const brands = isoBrands(probe);
    if (brands.some((brand) => brand === 'crx ')) throw processingError('unsupported-format');
    if (brands.some((brand) => brand === 'avif' || brand === 'avis')) return { kind: 'avif' };
    if (brands.some((brand) => ['heif', 'heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand))) {
      return { kind: 'heif' };
    }
  }

  const sourceText = new TextDecoder().decode(probe).replace(/^\uFEFF/, '').trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(sourceText)) return { kind: 'svg' };

  if (startsWith(probe, [0x50, 0x4b, 0x03, 0x04])) {
    const docx = await inspectDocx(file);
    if (docx === 'docx') return { kind: 'docx' };
    if (docx === 'oversized') throw processingError('unsupported-variant');
    if (docx === 'corrupt') throw processingError('corrupt-input');
    throw processingError('unsupported-format');
  }

  throw processingError('invalid-signature');
}

export async function assertAcceptedInput(
  file: BlobInput,
  allowed: readonly InputKind[],
): Promise<DetectedInput> {
  const detected = await detectInput(file);
  if (!allowed.includes(detected.kind)) throw processingError('invalid-signature');
  return detected;
}
