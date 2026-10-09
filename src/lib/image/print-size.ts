// Physical sizes, print resolution and file-size limits for image outputs.
// Pure helpers (no DOM) except encodeWithinBytes, which takes an encoder.

export type SizeUnit = 'px' | 'cm' | 'mm' | 'in';
export const SIZE_UNITS: SizeUnit[] = ['px', 'cm', 'mm', 'in'];
const PER_INCH: Record<Exclude<SizeUnit, 'px'>, number> = { in: 1, cm: 2.54, mm: 25.4 };

/** A length in `unit` at `dpi` → whole pixels (at least 1). */
export function toPixels(value: number, unit: SizeUnit, dpi: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.max(1, Math.round(unit === 'px' ? value : (value / PER_INCH[unit]) * dpi));
}

/** Pixels → a length in `unit` at `dpi`, rounded for display (px whole, others 2 decimals). */
export function fromPixels(pixels: number, unit: SizeUnit, dpi: number): number {
  if (unit === 'px') return Math.round(pixels);
  return Math.round(((pixels / dpi) * PER_INCH[unit]) * 100) / 100;
}

export const clampDpi = (dpi: number) => Math.min(1200, Math.max(30, Math.round(Number.isFinite(dpi) ? dpi : 300)));

/** "50 KB" / "2 MB" → bytes, or null when empty/invalid (no limit). Decimal units (1 KB = 1000 bytes)
    are the stricter reading, so the result passes forms that count either way. */
export function limitToBytes(value: number, unit: 'KB' | 'MB'): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value * (unit === 'MB' ? 1_000_000 : 1000));
}

export function formatBytes(bytes: number): string {
  // Decimal, like the limits, so "50 KB" reads the same in the box and the result.
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(2)} MB` : `${Math.max(0.1, bytes / 1000).toFixed(1)} KB`;
}

// ---- Print resolution metadata ----

const CRC_TABLE = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return table; })();
function crc32(bytes: Uint8Array): number { let c = 0xffffffff; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** JPEG: set the JFIF density to `dpi` (inserting a JFIF segment when missing). */
export function jpegWithDpi(input: Uint8Array, dpi: number): Uint8Array {
  if (input[0] !== 0xff || input[1] !== 0xd8) return input;
  const d = clampDpi(dpi);
  const isJfif = input[2] === 0xff && input[3] === 0xe0 && String.fromCharCode(...input.subarray(6, 11)) === 'JFIF\0';
  if (isJfif) {
    const out = input.slice();
    out[13] = 1; out[14] = d >> 8; out[15] = d & 0xff; out[16] = d >> 8; out[17] = d & 0xff;
    return out;
  }
  const app0 = new Uint8Array([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, d >> 8, d & 0xff, d >> 8, d & 0xff, 0x00, 0x00]);
  const out = new Uint8Array(input.length + app0.length);
  out.set(input.subarray(0, 2)); out.set(app0, 2); out.set(input.subarray(2), 2 + app0.length);
  return out;
}

/** PNG: add (or replace) a pHYs chunk with `dpi` in pixels per metre. */
export function pngWithDpi(input: Uint8Array, dpi: number): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((byte, index) => input[index] === byte)) return input;
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const ppm = Math.round(clampDpi(dpi) / 0.0254);
  const chunk = new Uint8Array(21); const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4); chunkView.setUint32(8, ppm); chunkView.setUint32(12, ppm); chunk[16] = 1;
  chunkView.setUint32(17, crc32(chunk.subarray(4, 17)));
  const parts: Uint8Array[] = [input.subarray(0, 8)];
  let offset = 8, inserted = false;
  while (offset + 8 <= input.length) {
    const length = view.getUint32(offset); const type = String.fromCharCode(...input.subarray(offset + 4, offset + 8)); const end = offset + 12 + length;
    if (end > input.length) return input;
    if (type === 'pHYs') { offset = end; continue; }
    if (!inserted && (type === 'IDAT' || type === 'IEND')) { parts.push(chunk); inserted = true; }
    parts.push(input.subarray(offset, end)); offset = end;
  }
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0; for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

export async function withDpi(blob: Blob, mime: string, dpi: number): Promise<Blob> {
  if (mime !== 'image/jpeg' && mime !== 'image/png') return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new Blob([(mime === 'image/jpeg' ? jpegWithDpi(bytes, dpi) : pngWithDpi(bytes, dpi)) as BlobPart], { type: mime });
}

// ---- File-size limit ----

export type LimitedEncode = { blob: Blob; quality: number; fits: boolean };

/**
 * Highest quality whose output fits `maxBytes` (binary search, 8 encodes at most).
 * Dimensions never change here: the caller's size request is respected and an
 * unreachable limit is reported (fits=false, smallest output returned).
 */
export async function encodeWithinBytes(encode: (quality: number) => Promise<Blob>, maxBytes: number, startQuality = 0.92, minQuality = 0.05): Promise<LimitedEncode> {
  const first = await encode(startQuality);
  if (first.size <= maxBytes) return { blob: first, quality: startQuality, fits: true };
  let low = Math.min(minQuality, startQuality), high = startQuality, best: Blob | null = null, bestQuality = low;
  const floor = await encode(low);
  if (floor.size > maxBytes) return { blob: floor, quality: low, fits: false };
  best = floor;
  for (let i = 0; i < 7 && high - low > 0.01; i++) {
    const mid = (low + high) / 2; const candidate = await encode(mid);
    if (candidate.size <= maxBytes) { best = candidate; bestQuality = mid; low = mid; } else high = mid;
  }
  return { blob: best, quality: bestQuality, fits: true };
}

export type FittedImage = LimitedEncode & { width: number; height: number; scaled: boolean };

/**
 * For "make this file smaller than X": quality first (never below `minQuality`),
 * then fewer pixels. Each step estimates the scale from the byte ratio, since
 * encoded size grows roughly with pixel count. `lossy` false (PNG) only scales.
 */
export async function fitImageToBytes(
  size: { width: number; height: number },
  encodeAt: (width: number, height: number, quality: number) => Promise<Blob>,
  maxBytes: number,
  { lossy = true, startQuality = 0.9, minQuality = 0.45, minSide = 16 } = {},
): Promise<FittedImage> {
  const attemptAt = async (w: number, h: number) => lossy
    ? encodeWithinBytes((q) => encodeAt(w, h, q), maxBytes, startQuality, minQuality)
    : encodeAt(w, h, 1).then((blob) => ({ blob, quality: 1, fits: blob.size <= maxBytes }));
  const at = (scale: number) => ({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) });
  let { width, height } = size;
  let failedScale = 1;
  for (let step = 0; step < 8; step++) {
    const attempt = await attemptAt(width, height);
    if (attempt.fits && step === 0) return { ...attempt, width, height, scaled: false };
    if (attempt.fits) {
      // A scale step can overshoot; bisect back toward the last size that failed and keep the largest fit.
      let best = { ...attempt, width, height };
      let low = width / size.width, high = failedScale;
      for (let probe = 0; probe < 3; probe++) {
        const mid = (low + high) / 2, dims = at(mid);
        if (dims.width === best.width) break;
        const tried = await attemptAt(dims.width, dims.height);
        if (tried.fits) { best = { ...tried, ...dims }; low = mid; } else high = mid;
      }
      return { ...best, scaled: true };
    }
    failedScale = width / size.width;
    const scale = Math.min(0.9, Math.sqrt(maxBytes / attempt.blob.size) * 0.95);
    const next = { width: Math.round(width * scale), height: Math.round(height * scale) };
    if (Math.min(next.width, next.height) < minSide) return { ...attempt, width, height, scaled: step > 0, fits: false };
    ({ width, height } = next);
  }
  const blob = await encodeAt(width, height, lossy ? minQuality : 1);
  return { blob, quality: minQuality, fits: blob.size <= maxBytes, width, height, scaled: true };
}
