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
  return { bytes: concatBytes(parts), removed, detail: `Removed ${removed} EXIF/XMP/IPTC/comment ${removed === 1 ? 'segment' : 'segments'} without re-encoding pixels.` };
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
  return { bytes: concatBytes(parts), removed, detail: `Removed ${removed} textual/EXIF/time ${removed === 1 ? 'chunk' : 'chunks'} without re-encoding pixels.` };
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
  return { bytes: concatBytes([header, body]), removed, detail: `Removed ${removed} EXIF/XMP ${removed === 1 ? 'chunk' : 'chunks'} without re-encoding pixels.` };
}

export async function stripImageMeta(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpg' : ascii(bytes, 1, 4) === 'PNG' ? 'png' : ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP' ? 'webp' : null;
  if (!kind) throw new Error('badImage');
  const result = kind === 'jpg' ? stripJpegMetadata(bytes) : kind === 'png' ? stripPngMetadata(bytes) : stripWebpMetadata(bytes);
  return { blob: new Blob([result.bytes], { type: kind === 'jpg' ? 'image/jpeg' : `image/${kind}` }), ext: kind, detail: result.detail };
}

export async function stripOpenXmlMeta(file) {
  const { unzipSync, zipSync, strFromU8, strToU8 } = await import('fflate');
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  if (!archive['[Content_Types].xml']) throw new Error('wrongType');
  const clearElements = (xml, names) => names.reduce((value, name) => value.replace(new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${name}>`, 'gi'), ''), xml);
  if (archive['docProps/core.xml']) archive['docProps/core.xml'] = strToU8(clearElements(strFromU8(archive['docProps/core.xml']), ['dc:title','dc:subject','dc:creator','cp:keywords','cp:lastModifiedBy','cp:category','cp:contentStatus','cp:revision','dcterms:created','dcterms:modified']));
  if (archive['docProps/app.xml']) archive['docProps/app.xml'] = strToU8(clearElements(strFromU8(archive['docProps/app.xml']), ['Company','Manager','HyperlinkBase']));
  if (archive['docProps/custom.xml']) archive['docProps/custom.xml'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>');
  const extension = file.name.toLowerCase().match(/\.(docx|xlsx|pptx)$/)?.[1];
  if (!extension) throw new Error('wrongType');
  const mime = extension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : extension === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  return { blob: new Blob([zipSync(archive, { level: 6 })], { type: mime }), ext: extension, detail: 'Removed standard author, title, date, company, manager, and custom document properties. Document content was preserved.' };
}
