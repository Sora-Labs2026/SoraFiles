// Generated from src/lib/metadata-strip.js by sync-image-metadata.mjs.
const concatBytes = (parts) => {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const ascii = (bytes, start, end) => new TextDecoder('ascii').decode(bytes.slice(start, end));

function stripJpegMetadata(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('badImage');
  const parts = [bytes.slice(0, 2)]; let offset = 2; let removed = 0;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('badImage');
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) { parts.push(bytes.slice(offset)); offset = bytes.length; break; }
    if (marker === 0x00 || marker === 0xff || (marker >= 0xd0 && marker <= 0xd7)) { parts.push(bytes.slice(offset, offset + 2)); offset += 2; continue; }
    if (offset + 4 > bytes.length) throw new Error('badImage');
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]; const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) throw new Error('badImage');
    const privateSegment = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (privateSegment) removed += 1; else parts.push(bytes.slice(offset, end));
    offset = end;
  }
  return { bytes: concatBytes(parts), removed, detail: `Removed ${removed} hidden detail ${removed === 1 ? 'group' : 'groups'} without changing the image pixels.` };
}

function stripPngMetadata(bytes) {
  if (ascii(bytes, 1, 4) !== 'PNG') throw new Error('badImage');
  const parts = [bytes.slice(0, 8)]; const privateChunks = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']); let offset = 8; let removed = 0;
  while (offset + 12 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 4); const length = view.getUint32(0); const end = offset + 12 + length;
    if (end > bytes.length) throw new Error('badImage');
    const type = ascii(bytes, offset + 4, offset + 8);
    if (privateChunks.has(type)) removed += 1; else parts.push(bytes.slice(offset, end));
    offset = end;
    if (type === 'IEND') break;
  }
  return { bytes: concatBytes(parts), removed, detail: `Removed ${removed} hidden detail ${removed === 1 ? 'group' : 'groups'} without changing the image pixels.` };
}

function stripWebpMetadata(bytes) {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 12) !== 'WEBP') throw new Error('badImage');
  const chunks = []; let offset = 12; let removed = 0;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, offset + 4); const length = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true); const end = offset + 8 + length + (length % 2);
    if (end > bytes.length) throw new Error('badImage');
    if (type === 'EXIF' || type === 'XMP ') removed += 1;
    else {
      const chunk = bytes.slice(offset, end);
      if (type === 'VP8X' && chunk.length >= 9) chunk[8] &= ~(0x08 | 0x04);
      chunks.push(chunk);
    }
    offset = end;
  }
  const body = concatBytes(chunks); const header = new Uint8Array(12);
  header.set(new TextEncoder().encode('RIFF'), 0); new DataView(header.buffer).setUint32(4, body.length + 4, true); header.set(new TextEncoder().encode('WEBP'), 8);
  return { bytes: concatBytes([header, body]), removed, detail: `Removed ${removed} hidden detail ${removed === 1 ? 'group' : 'groups'} without changing the image pixels.` };
}

export async function stripImageMeta(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpg' : ascii(bytes, 1, 4) === 'PNG' ? 'png' : ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP' ? 'webp' : null;
  if (!kind) throw new Error('badImage');
  const result = kind === 'jpg' ? stripJpegMetadata(bytes) : kind === 'png' ? stripPngMetadata(bytes) : stripWebpMetadata(bytes);
  return { blob: new Blob([result.bytes], { type: kind === 'jpg' ? 'image/jpeg' : `image/${kind}` }), ext: kind, detail: result.detail };
}

