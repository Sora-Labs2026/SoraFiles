import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { ExtractedPage } from './convert';

export async function createDocxFromPages(
  pages: ExtractedPage[],
  direction: 'ltr' | 'rtl' = 'ltr',
): Promise<Blob> {
  const isRtl = direction === 'rtl';
  const paragraphs: Paragraph[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const isFirstPage = i === 0;

    if (page.lines.length === 0) {
      continue;
    }

    for (let j = 0; j < page.lines.length; j++) {
      const lineText = page.lines[j];
      const isFirstLineOfPage = j === 0;

      paragraphs.push(
        new Paragraph({
          pageBreakBefore: !isFirstPage && isFirstLineOfPage,
          bidirectional: isRtl,
          children: [
            new TextRun({
              text: lineText,
              rightToLeft: isRtl,
            }),
          ],
        }),
      );
    }
  }

  if (paragraphs.length === 0) {
    paragraphs.push(
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
        children: paragraphs,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
