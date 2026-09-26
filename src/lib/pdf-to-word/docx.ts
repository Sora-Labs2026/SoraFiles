import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { ExtractedPage } from './convert.ts';

export async function createDocxFromPages(
  pages: ExtractedPage[],
  direction: 'ltr' | 'rtl' = 'ltr',
): Promise<Blob> {
  const isRtl = direction === 'rtl';
  const children: Array<Paragraph | Table> = [];

  const headingLevel = (line: string) => {
    const clean = line.trim();
    if (clean.length > 90 || /[.!?。！？]$/.test(clean)) return undefined;
    if (/^(?:chapter|section|part)\s+\d+/i.test(clean) || /^\d+\.\s+\S/.test(clean)) return HeadingLevel.HEADING_1;
    if (clean.length <= 55 && /\p{L}/u.test(clean) && clean === clean.toLocaleUpperCase()) return HeadingLevel.HEADING_2;
    return undefined;
  };

  const paragraph = (text: string, options: { pageBreakBefore?: boolean; bullet?: boolean } = {}) => new Paragraph({
    pageBreakBefore: options.pageBreakBefore,
    bidirectional: isRtl,
    bullet: options.bullet ? { level: 0 } : undefined,
    heading: headingLevel(text),
    children: [new TextRun({ text, rightToLeft: isRtl })],
  });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const isFirstPage = i === 0;

    if (page.lines.length === 0) {
      continue;
    }

    if (!isFirstPage) children.push(paragraph('', { pageBreakBefore: true }));
    for (let j = 0; j < page.lines.length;) {
      const lineText = page.lines[j];
      if (lineText.includes('\t')) {
        const tableLines: string[] = [];
        while (j < page.lines.length && page.lines[j].includes('\t')) tableLines.push(page.lines[j++]);
        const columns = Math.max(...tableLines.map((line) => line.split('\t').length));
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableLines.map((line) => {
            const cells = line.split('\t');
            return new TableRow({ children: Array.from({ length: columns }, (_, index) => new TableCell({ children: [paragraph(cells[index] ?? '')] })) });
          }),
        }));
        continue;
      }
      const bulletMatch = lineText.match(/^[•●▪◦‣*-]\s*(.+)$/u);
      children.push(paragraph(bulletMatch?.[1] ?? lineText, { bullet: Boolean(bulletMatch) }));
      j += 1;
    }
  }

  if (children.length === 0) {
    children.push(
      new Paragraph({
        bidirectional: isRtl,
        children: [
          new TextRun({
            text: '',
            rightToLeft: isRtl,
          }),
        ],
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
