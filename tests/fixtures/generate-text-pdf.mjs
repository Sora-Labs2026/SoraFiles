import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const document = await PDFDocument.create();
const fixedDate = new Date('2026-08-11T00:00:00.000Z');
document.setCreationDate(fixedDate);
document.setModificationDate(fixedDate);
document.setCreator('Sora Files test fixture generator');
document.setProducer('pdf-lib');
document.setTitle('Sora Files two-page text fixture');
const font = await document.embedFont(StandardFonts.Helvetica);

for (const text of ['Sora Files page one', 'Sora Files page two']) {
  const page = document.addPage([612, 792]);
  page.drawText(text, {
    x: 72,
    y: 700,
    size: 24,
    font,
    color: rgb(0.06, 0.09, 0.16),
  });
}

const bytes = await document.save({ useObjectStreams: false });
writeFileSync(fileURLToPath(new URL('./text-two-page.pdf', import.meta.url)), bytes);

const blankDocument = await PDFDocument.create();
blankDocument.setCreationDate(fixedDate);
blankDocument.setModificationDate(fixedDate);
blankDocument.setCreator('Sora Files test fixture generator');
blankDocument.setProducer('pdf-lib');
blankDocument.setTitle('Sora Files blank page fixture');
blankDocument.addPage([612, 792]);
writeFileSync(
  fileURLToPath(new URL('./blank-page.pdf', import.meta.url)),
  await blankDocument.save({ useObjectStreams: false }),
);
