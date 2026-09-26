import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { encode } from 'fast-png';
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from 'pdf-lib';
import xlsx from 'xlsx';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const targetDir = process.env.SORA_QA_FIXTURE_DIR
  ? process.env.SORA_QA_FIXTURE_DIR
  : `${repoRoot}/tests/fixtures/sorafiles-qa`;
const fixedDate = new Date('2026-08-29T00:00:00.000Z');

await mkdir(targetDir, { recursive: true });
await writeFile(`${targetDir}/zero-byte.pdf`, Buffer.alloc(0));
await writeFile(`${targetDir}/invalid-signature.pdf`, Buffer.from('This is not a PDF container.\n', 'utf8'));
await writeFile(`${targetDir}/unsupported.txt`, Buffer.from('Unsupported SoraFiles QA fixture.\n', 'utf8'));

const font = {
  A: ['01110','10001','10001','11111','10001','10001','10001'], B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'], D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'], F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10111','10001','10001','01110'], H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['11111','00100','00100','00100','00100','00100','11111'], J: ['00111','00010','00010','00010','10010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'], L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'], N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'], P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'], R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'], T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'], V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','10101','01010'], X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'], Z: ['11111','00001','00010','00100','01000','10000','11111'],
  0: ['01110','10001','10011','10101','11001','10001','01110'], 1: ['00100','01100','00100','00100','00100','00100','01110'],
  2: ['01110','10001','00001','00010','00100','01000','11111'], 3: ['11110','00001','00001','01110','00001','00001','11110'],
  4: ['00010','00110','01010','10010','11111','00010','00010'], 5: ['11111','10000','10000','11110','00001','00001','11110'],
  6: ['01110','10000','10000','11110','10001','10001','01110'], 7: ['11111','00001','00010','00100','01000','01000','01000'],
  8: ['01110','10001','10001','01110','10001','10001','01110'], 9: ['01110','10001','10001','01111','00001','00001','01110'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
  '.': ['00000','00000','00000','00000','00000','00110','00110'],
  ':': ['00000','00110','00110','00000','00110','00110','00000'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  '!': ['00100','00100','00100','00100','00100','00000','00100'],
};

function image(width, height, background = [255, 255, 255, 255]) {
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) data.set(background, index);
  return { width, height, data };
}

function pixel(target, x, y, color) {
  if (x < 0 || y < 0 || x >= target.width || y >= target.height) return;
  const offset = (Math.floor(y) * target.width + Math.floor(x)) * 4;
  target.data.set(color, offset);
}

function rect(target, x, y, width, height, color) {
  for (let row = Math.max(0, y); row < Math.min(target.height, y + height); row += 1) {
    for (let column = Math.max(0, x); column < Math.min(target.width, x + width); column += 1) pixel(target, column, row, color);
  }
}

function circle(target, centerX, centerY, radius, color) {
  for (let y = -radius; y <= radius; y += 1) for (let x = -radius; x <= radius; x += 1) {
    if (x * x + y * y <= radius * radius) pixel(target, centerX + x, centerY + y, color);
  }
}

function text(target, value, x, y, scale = 8, color = [15, 23, 42, 255]) {
  let cursor = x;
  for (const rawCharacter of value.toUpperCase()) {
    const glyph = font[rawCharacter] ?? font[' '];
    glyph.forEach((row, rowIndex) => [...row].forEach((bit, columnIndex) => {
      if (bit === '1') rect(target, cursor + columnIndex * scale, y + rowIndex * scale, scale, scale, color);
    }));
    cursor += 6 * scale;
  }
}

function gradient(target, from, to) {
  for (let y = 0; y < target.height; y += 1) {
    const amount = y / Math.max(1, target.height - 1);
    const color = from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
    rect(target, 0, y, target.width, 1, color);
  }
}

async function savePng(name, target) {
  const bytes = encode({ width: target.width, height: target.height, data: target.data, channels: 4, depth: 8 });
  await writeFile(`${targetDir}/${name}`, bytes);
  return Buffer.from(bytes);
}

function makeLandscape() {
  const target = image(1600, 900);
  gradient(target, [238, 242, 255, 255], [219, 234, 254, 255]);
  rect(target, 90, 80, 1420, 740, [255, 255, 255, 255]);
  rect(target, 90, 80, 22, 740, [79, 70, 229, 255]);
  rect(target, 1050, 160, 340, 210, [30, 64, 175, 255]);
  rect(target, 1050, 390, 340, 130, [14, 165, 233, 255]);
  rect(target, 1050, 540, 340, 190, [124, 58, 237, 255]);
  text(target, 'SORAFILES IMAGE QA', 180, 220, 15);
  text(target, '1600X900', 180, 355, 18, [79, 70, 229, 255]);
  text(target, 'LOCAL PRIVATE FAST', 180, 540, 9, [71, 85, 105, 255]);
  return target;
}

function makePortrait() {
  const target = image(900, 1600);
  gradient(target, [250, 245, 255, 255], [224, 231, 255, 255]);
  rect(target, 75, 90, 750, 1420, [255, 255, 255, 255]);
  rect(target, 75, 90, 750, 30, [124, 58, 237, 255]);
  text(target, 'SORAFILES', 155, 240, 15);
  text(target, 'PORTRAIT QA', 155, 370, 11, [79, 70, 229, 255]);
  text(target, '900X1600', 155, 500, 11);
  rect(target, 155, 720, 590, 230, [219, 234, 254, 255]);
  rect(target, 155, 990, 590, 170, [224, 231, 255, 255]);
  rect(target, 155, 1200, 590, 180, [237, 233, 254, 255]);
  return target;
}

function makeTransparency() {
  const target = image(1000, 1000, [0, 0, 0, 0]);
  circle(target, 500, 500, 330, [79, 70, 229, 210]);
  circle(target, 500, 500, 260, [255, 255, 255, 245]);
  rect(target, 260, 435, 480, 130, [15, 23, 42, 245]);
  text(target, 'SORA QA', 310, 465, 12, [255, 255, 255, 255]);
  return target;
}

function makeSubject() {
  const target = image(1200, 900);
  gradient(target, [14, 116, 144, 255], [30, 64, 175, 255]);
  circle(target, 600, 400, 240, [251, 146, 60, 255]);
  rect(target, 390, 390, 420, 300, [255, 255, 255, 255]);
  rect(target, 445, 450, 310, 130, [15, 23, 42, 255]);
  text(target, 'QA', 520, 480, 20, [255, 255, 255, 255]);
  return target;
}

function makeScan(skew = false) {
  const target = image(1400, 900, [203, 213, 225, 255]);
  const left = skew ? 130 : 100;
  rect(target, left, 70, 1160, 760, [255, 255, 255, 255]);
  rect(target, left, 70, 18, 760, [79, 70, 229, 255]);
  text(target, 'SORAFILES OCR TEST', left + 100, 200, 13);
  text(target, 'INVOICE 8675309', left + 100, 380, 11, [30, 64, 175, 255]);
  text(target, 'TOTAL NPR 12345', left + 100, 535, 11, [124, 58, 237, 255]);
  rect(target, left + 100, 690, 760, 12, [148, 163, 184, 255]);
  return target;
}

function makeSignature() {
  const target = image(720, 240, [0, 0, 0, 0]);
  text(target, 'SORA QA', 75, 68, 16, [15, 23, 42, 255]);
  for (let x = 55; x < 665; x += 1) pixel(target, x, 195 + Math.round(Math.sin(x / 28) * 7), [79, 70, 229, 220]);
  return target;
}

function makeWatermark() {
  const target = image(420, 240, [0, 0, 0, 0]);
  rect(target, 25, 25, 370, 190, [79, 70, 229, 185]);
  text(target, 'QA', 120, 70, 18, [255, 255, 255, 255]);
  return target;
}

function makePhotoDocument() {
  const target = image(1400, 1000, [51, 65, 85, 255]);
  rect(target, 160, 100, 1090, 800, [255, 255, 255, 255]);
  rect(target, 160, 100, 1090, 18, [79, 70, 229, 255]);
  text(target, 'SORAFILES SCAN QA', 270, 245, 12);
  text(target, 'INVOICE 8675309', 270, 430, 10, [30, 64, 175, 255]);
  text(target, 'TOTAL NPR 12345', 270, 575, 10, [124, 58, 237, 255]);
  rect(target, 270, 715, 700, 12, [148, 163, 184, 255]);
  return target;
}

const landscapePng = await savePng('landscape.png', makeLandscape());
const portraitPng = await savePng('portrait.png', makePortrait());
await savePng('transparency.png', makeTransparency());
await savePng('background-subject.png', makeSubject());
const scanCleanPng = await savePng('scanned-clean.png', makeScan(false));
const scanSkewPng = await savePng('scanned-skew.png', makeScan(true));
const signaturePng = await savePng('signature.png', makeSignature());
const watermarkPng = await savePng('watermark-logo.png', makeWatermark());
await savePng('photographed-document.png', makePhotoDocument());

await sharp(landscapePng).jpeg({quality:92}).toFile(`${targetDir}/landscape.jpg`);
await sharp(portraitPng).jpeg({quality:92}).toFile(`${targetDir}/portrait.jpg`);
await sharp(landscapePng).withExif({IFD0:{Make:'SoraQA',ImageDescription:'SoraFiles Metadata QA'}}).jpeg({quality:92}).toFile(`${targetDir}/metadata-photo.jpg`);

function stamp(document, title) {
  document.setCreationDate(fixedDate);
  document.setModificationDate(fixedDate);
  document.setCreator('SoraFiles deterministic QA fixture generator');
  document.setProducer('SoraFiles QA');
  document.setTitle(title);
}

async function createNativePdf() {
  const document = await PDFDocument.create();
  stamp(document, 'SoraFiles native text QA');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pages = [
    ['SORAFILES QA PAGE 1', 'Alpha 12345', rgb(.12, .25, .68)],
    ['SORAFILES QA PAGE 2', 'Bravo 67890', rgb(.05, .65, .72)],
    ['SORAFILES QA PAGE 3', 'Charlie ABCDE', rgb(.49, .23, .93)],
  ];
  pages.forEach(([heading, detail, color], index) => {
    const page = document.addPage([612, 792]);
    page.drawRectangle({ x: 48, y: 48, width: 516, height: 696, borderColor: color, borderWidth: 4 });
    page.drawRectangle({ x: 48, y: 675, width: 516, height: 69, color });
    page.drawText(heading, { x: 78, y: 694, size: 24, font: bold, color: rgb(1, 1, 1) });
    page.drawText(detail, { x: 78, y: 585, size: 30, font: regular, color: rgb(.06, .09, .16) });
    page.drawText(`Controlled fixture page ${index + 1} of 3`, { x: 78, y: 535, size: 13, font: regular, color: rgb(.4, .45, .55) });
    page.drawLine({ start: { x: 78, y: 500 }, end: { x: 500, y: 500 }, thickness: 2, color });
  });
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

const nativePdf = await createNativePdf();
await writeFile(`${targetDir}/native-text-3-pages.pdf`, nativePdf);

const mixed = await PDFDocument.create();
stamp(mixed, 'SoraFiles mixed content QA');
const mixedRegular = await mixed.embedFont(StandardFonts.Helvetica);
const mixedBold = await mixed.embedFont(StandardFonts.HelveticaBold);
const mixedImage = await mixed.embedJpg(await readFile(`${targetDir}/landscape.jpg`));
for (let index = 0; index < 2; index += 1) {
  const page = mixed.addPage([612, 792]);
  page.drawText(`SORAFILES MIXED CONTENT PAGE ${index + 1}`, { x: 52, y: 735, size: 20, font: mixedBold, color: rgb(.06, .09, .16) });
  page.drawText(index === 0 ? 'Selectable text plus raster and vector content.' : 'Second page preserves text at multiple sizes.', { x: 52, y: 700, size: 12 + index * 4, font: mixedRegular });
  page.drawImage(mixedImage, { x: 52, y: 330, width: 508, height: 286 });
  page.drawRectangle({ x: 52, y: 245, width: 220, height: 46, color: index ? rgb(.49, .23, .93) : rgb(.12, .25, .68) });
  page.drawLine({ start: { x: 52, y: 205 }, end: { x: 560, y: 205 }, thickness: 5, color: rgb(.05, .65, .72) });
}
await writeFile(`${targetDir}/mixed-content.pdf`, await mixed.save({ useObjectStreams: false }));

const tablePdf = await PDFDocument.create();
stamp(tablePdf, 'SoraFiles table QA');
const tableFont = await tablePdf.embedFont(StandardFonts.Helvetica);
const tableBold = await tablePdf.embedFont(StandardFonts.HelveticaBold);
const tablePage = tablePdf.addPage([612, 792]);
tablePage.drawText('Invoice No: SF-QA-2026', { x: 64, y: 720, size: 20, font: tableBold });
const rows = [['Name', 'Qty', 'Price'], ['Apple', '2', '3.50'], ['Orange', '5', '1.20'], ['Mango', '1', '7.99']];
rows.forEach((row, rowIndex) => {
  const y = 650 - rowIndex * 48;
  row.forEach((cell, columnIndex) => {
    const x = 64 + columnIndex * 155;
    tablePage.drawRectangle({ x, y, width: 155, height: 48, borderColor: rgb(.4, .45, .55), borderWidth: 1, color: rowIndex === 0 ? rgb(.88, .91, 1) : undefined });
    tablePage.drawText(cell, { x: x + 12, y: y + 16, size: 14, font: rowIndex === 0 ? tableBold : tableFont });
  });
});
await writeFile(`${targetDir}/table.pdf`, await tablePdf.save({ useObjectStreams: false }));

const scanned = await PDFDocument.create();
stamp(scanned, 'SoraFiles image-only OCR QA');
for (const source of [scanCleanPng, scanSkewPng]) {
  const embedded = await scanned.embedPng(source);
  const page = scanned.addPage([700, 450]);
  page.drawImage(embedded, { x: 0, y: 0, width: 700, height: 450 });
}
await writeFile(`${targetDir}/scanned-document.pdf`, await scanned.save({ useObjectStreams: false }));

const formLink = await PDFDocument.create();
stamp(formLink, 'SoraFiles form and link QA');
formLink.setAuthor('Sora QA Bot');
formLink.setSubject('Form and hyperlink preservation');
const formFont = await formLink.embedFont(StandardFonts.Helvetica);
const formPage = formLink.addPage([612, 792]);
formPage.drawText('SORAFILES FORM AND LINK QA', { x: 72, y: 700, size: 20, font: formFont });
formPage.drawText('https://sorafiles.com', { x: 72, y: 650, size: 14, font: formFont, color: rgb(0, .35, .8) });
const form = formLink.getForm();
const field = form.createTextField('qa.reference');
field.setText('SF-QA-2026');
field.addToPage(formPage, { x: 72, y: 560, width: 260, height: 38 });
await writeFile(`${targetDir}/form-or-link.pdf`, await formLink.save({ useObjectStreams: false }));

const metadataPdf = await PDFDocument.load(nativePdf);
metadataPdf.setTitle('SoraFiles QA Metadata');
metadataPdf.setAuthor('Sora QA Bot');
metadataPdf.setSubject('Metadata Removal Test');
metadataPdf.setKeywords(['sorafiles', 'qa', 'test']);
await writeFile(`${targetDir}/metadata.pdf`, await metadataPdf.save({ useObjectStreams: false }));

const protectedPdf = await encryptPDF(nativePdf, 'SoraQA2026!', { ownerPassword: 'SoraQA2026!', algorithm: 'AES-256' });
await writeFile(`${targetDir}/protected.pdf`, protectedPdf);
await writeFile(`${targetDir}/damaged.pdf`, nativePdf.subarray(0, Math.max(100, nativePdf.length - 48)));

const simpleDocx = new Document({ sections: [{ children: [
  new Paragraph({ text: 'SoraFiles DOCX QA', heading: HeadingLevel.HEADING_1 }),
  new Paragraph({ children: [new TextRun('The quick brown fox jumps over the lazy dog. '), new TextRun({ text: 'Bold QA', bold: true }), new TextRun({ text: ' and italic QA.', italics: true })] }),
  new Paragraph({ text: 'First bullet', bullet: { level: 0 } }),
  new Paragraph({ text: 'Second bullet', bullet: { level: 0 } }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ text: 'SECOND PAGE QA', heading: HeadingLevel.HEADING_2 }),
] }] });
await writeFile(`${targetDir}/simple.docx`, await Packer.toBuffer(simpleDocx));

const layoutTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
  new TableRow({ children: ['Product', 'Quantity', 'Price'].map(value => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value, bold: true })] })] })) }),
  new TableRow({ children: ['Apple', '2', '3.50'].map(value => new TableCell({ children: [new Paragraph(value)] })) }),
] });
const layoutDocx = new Document({ sections: [{ children: [
  new Paragraph({ text: 'SoraFiles Layout DOCX QA', heading: HeadingLevel.HEADING_1 }),
  new Paragraph({ text: 'Left aligned paragraph.', alignment: AlignmentType.LEFT }),
  new Paragraph({ text: 'Centered paragraph.', alignment: AlignmentType.CENTER }),
  layoutTable,
  new Paragraph({ children: [new ImageRun({ data: landscapePng, transformation: { width: 480, height: 270 }, type: 'png' })] }),
] }] });
await writeFile(`${targetDir}/layout.docx`, await Packer.toBuffer(layoutDocx));

const workbook = xlsx.utils.book_new();
const sales = xlsx.utils.aoa_to_sheet([['Product', 'Quantity', 'Price'], ['Apple', 2, 3.5], ['Mango', 4, 7.99]]);
sales['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }];
sales.A1.s = sales.B1.s = sales.C1.s = { font: { bold: true }, fill: { fgColor: { rgb: 'DDE5FF' } }, border: { bottom: { style: 'thin', color: { rgb: '4F46E5' } } } };
xlsx.utils.book_append_sheet(workbook, sales, 'Sales');
const summary = xlsx.utils.aoa_to_sheet([['SORAFILES XLSX QA'], [], ['Merged Cell QA']]);
summary['!merges'] = [xlsx.utils.decode_range('A3:C3')];
summary['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }];
xlsx.utils.book_append_sheet(workbook, summary, 'Summary');
await writeFile(`${targetDir}/workbook.xlsx`, xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx', cellStyles: true }));

await writeFile(`${targetDir}/FIXTURE_MANIFEST.json`, `${JSON.stringify({
  generatedAt: fixedDate.toISOString(),
  protectedPdfPassword: 'SoraQA2026!',
  files: [
    'native-text-3-pages.pdf', 'mixed-content.pdf', 'table.pdf', 'scanned-document.pdf', 'form-or-link.pdf', 'protected.pdf', 'metadata.pdf', 'damaged.pdf',
    'zero-byte.pdf', 'invalid-signature.pdf', 'unsupported.txt',
    'landscape.jpg', 'portrait.jpg', 'transparency.png', 'background-subject.png', 'metadata-photo.jpg', 'simple.docx', 'layout.docx', 'workbook.xlsx',
    'signature.png', 'watermark-logo.png', 'photographed-document.png',
  ],
  notes: ['webp-image.webp is generated by the Firefox audit harness from landscape.png.', 'heic-image.heic reuses the repository-permitted libheif example fixture during the audit.'],
}, null, 2)}\n`);

console.log(`Generated deterministic SoraFiles QA fixtures in ${targetDir}`);
