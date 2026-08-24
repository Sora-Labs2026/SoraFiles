import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  SectionType,
} from 'docx';

export interface VisualDocxPage {
  image: Uint8Array;
  widthPoints: number;
  heightPoints: number;
  pageNumber: number;
}

const POINTS_TO_TWIPS = 20;
const POINTS_TO_CSS_PIXELS = 96 / 72;
const WORD_MAX_PAGE_POINTS = 22 * 72;

export async function createVisualDocx(pages: VisualDocxPage[]): Promise<Blob> {
  if (!pages.length) throw new Error('No PDF pages were available to convert.');

  const sections = pages.map((page, index) => {
    const physicalScale = Math.min(
      1,
      WORD_MAX_PAGE_POINTS / Math.max(1, page.widthPoints),
      WORD_MAX_PAGE_POINTS / Math.max(1, page.heightPoints),
    );
    const widthPoints = Math.max(1, page.widthPoints * physicalScale);
    const heightPoints = Math.max(1, page.heightPoints * physicalScale);

    return {
      properties: {
        ...(index > 0 ? { type: SectionType.NEXT_PAGE } : {}),
        page: {
          size: {
            width: Math.round(widthPoints * POINTS_TO_TWIPS),
            height: Math.round(heightPoints * POINTS_TO_TWIPS),
          },
          margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new ImageRun({
              data: page.image,
              type: 'png',
              transformation: {
                width: Math.round(widthPoints * POINTS_TO_CSS_PIXELS),
                height: Math.round(heightPoints * POINTS_TO_CSS_PIXELS),
              },
              altText: {
                title: `PDF page ${page.pageNumber}`,
                description: `Visual reproduction of PDF page ${page.pageNumber}`,
                name: `PDF page ${page.pageNumber}`,
              },
            }),
          ],
        }),
      ],
    };
  });

  return Packer.toBlob(new Document({ sections }));
}
