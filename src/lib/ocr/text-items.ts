export interface PdfTextItemLike {
  str: string;
  transform?: number[];
  hasEOL?: boolean;
}

export interface ClassifiedPageText {
  mode: 'embedded' | 'ocr';
  lines: string[];
  meaningfulCharacters: number;
}

export function groupTextItems(items: PdfTextItemLike[]): string[] {
  const lines: string[] = [];
  let currentLine: string[] = [];
  let currentY: number | null = null;

  for (const item of items) {
    const rawStr = (item.str || '').normalize('NFC');
    const y = item.transform && item.transform.length >= 6 ? item.transform[5] : null;

    if (currentY !== null && y !== null && Math.abs(y - currentY) > 2) {
      const lineText = currentLine.join('').trim().replace(/\s+/g, ' ');
      if (lineText.length > 0) {
        lines.push(lineText);
      }
      currentLine = [];
    }

    if (y !== null) {
      currentY = y;
    }

    if (rawStr) {
      currentLine.push(rawStr);
    }

    if (item.hasEOL) {
      const lineText = currentLine.join('').trim().replace(/\s+/g, ' ');
      if (lineText.length > 0) {
        lines.push(lineText);
      }
      currentLine = [];
      currentY = null;
    }
  }

  if (currentLine.length > 0) {
    const lineText = currentLine.join('').trim().replace(/\s+/g, ' ');
    if (lineText.length > 0) {
      lines.push(lineText);
    }
  }

  return lines;
}

export function classifyPageText(items: PdfTextItemLike[]): ClassifiedPageText {
  const lines = groupTextItems(items);
  const fullText = lines.join(' ');
  const meaningfulCharacters = fullText.replace(/[\p{P}\p{S}\s]/gu, '').length;
  const mode = meaningfulCharacters >= 12 ? 'embedded' : 'ocr';

  return {
    mode,
    lines,
    meaningfulCharacters,
  };
}
