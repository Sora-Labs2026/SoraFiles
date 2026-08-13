import type { OcrEngine } from '../ocr/types';
import { classifyPageText, type PdfTextItemLike } from '../ocr/text-items';

export interface ExtractedPage {
  pageNumber: number;
  source: 'embedded' | 'ocr';
  lines: string[];
  confidence?: number;
}

export type PdfToWordProgress =
  | { stage: 'inspecting'; page: number; total: number }
  | { stage: 'scan-count'; scannedPages: number; total: number; warning: boolean }
  | { stage: 'loading-model'; scannedPages: number }
  | { stage: 'recognizing'; page: number; total: number; progress: number }
  | { stage: 'complete'; pages: number; scannedPages: number; lowConfidencePages: number[] };

export interface PdfPageAdapter {
  number: number;
  textItems(): Promise<PdfTextItemLike[]>;
  renderForOcr(maxPixels: number): Promise<HTMLCanvasElement>;
  cleanup(): void;
}

export interface PdfDocumentAdapter {
  pageCount: number;
  openPage(pageNumber: number): Promise<PdfPageAdapter>;
  destroy(): Promise<void>;
}

export interface ExtractPdfForWordOptions {
  document: PdfDocumentAdapter;
  createOcrEngine: (onProgress: (value: number) => void) => Promise<OcrEngine>;
  signal: AbortSignal;
  onProgress: (progress: PdfToWordProgress) => void;
}

export class PdfToWordError extends Error {
  constructor(readonly code: 'page-limit' | 'cancelled' | 'ocr-unavailable') {
    super(code);
  }
}

export async function extractPdfForWord(options: ExtractPdfForWordOptions): Promise<ExtractedPage[]> {
  const { document, createOcrEngine, signal, onProgress } = options;
  const pageCount = document.pageCount;

  if (pageCount > 60) {
    throw new PdfToWordError('page-limit');
  }

  const results: ExtractedPage[] = [];
  const scanPageNumbers: number[] = [];

  // Pass 1: Classify pages and collect embedded text
  for (let p = 1; p <= pageCount; p++) {
    if (signal.aborted) throw new PdfToWordError('cancelled');
    onProgress({ stage: 'inspecting', page: p, total: pageCount });

    const pageAdapter = await document.openPage(p);
    try {
      const items = await pageAdapter.textItems();
      const classified = classifyPageText(items);

      if (classified.mode === 'embedded') {
        results.push({
          pageNumber: p,
          source: 'embedded',
          lines: classified.lines,
        });
      } else {
        scanPageNumbers.push(p);
        results.push({
          pageNumber: p,
          source: 'ocr',
          lines: [],
        });
      }
    } finally {
      pageAdapter.cleanup();
    }
  }

  onProgress({
    stage: 'scan-count',
    scannedPages: scanPageNumbers.length,
    total: pageCount,
    warning: scanPageNumbers.length > 20,
  });

  if (scanPageNumbers.length === 0) {
    onProgress({
      stage: 'complete',
      pages: pageCount,
      scannedPages: 0,
      lowConfidencePages: [],
    });
    return results;
  }

  // Pass 2: Process scan pages with OCR engine
  if (signal.aborted) throw new PdfToWordError('cancelled');
  onProgress({ stage: 'loading-model', scannedPages: scanPageNumbers.length });

  let ocrEngine: OcrEngine | null = null;
  const lowConfidencePages: number[] = [];

  try {
    let currentOcrProgress = 0;
    ocrEngine = await createOcrEngine((val) => {
      currentOcrProgress = val;
    });

    for (let idx = 0; idx < scanPageNumbers.length; idx++) {
      if (signal.aborted) throw new PdfToWordError('cancelled');
      const pageNum = scanPageNumbers[idx];
      onProgress({
        stage: 'recognizing',
        page: pageNum,
        total: pageCount,
        progress: currentOcrProgress,
      });

      const pageAdapter = await document.openPage(pageNum);
      try {
        const canvas = await pageAdapter.renderForOcr(8_000_000);
        const ocrResult = await ocrEngine.recognize(canvas, signal);

        const target = results.find((r) => r.pageNumber === pageNum);
        if (target) {
          if (ocrResult.text.length > 0) {
            target.lines = ocrResult.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
          } else {
            target.lines = [];
          }
          target.confidence = ocrResult.confidence;

          if (ocrResult.confidence < 60) {
            lowConfidencePages.push(pageNum);
          }
        }

        // Clean canvas memory
        canvas.width = 1;
        canvas.height = 1;
      } finally {
        pageAdapter.cleanup();
      }
    }
  } catch (err: any) {
    if (signal.aborted || err?.name === 'AbortError' || err?.code === 'cancelled') {
      throw new PdfToWordError('cancelled');
    }
    if (err instanceof PdfToWordError) throw err;
    throw new PdfToWordError('ocr-unavailable');
  } finally {
    if (ocrEngine) {
      await ocrEngine.terminate().catch(() => {});
    }
  }

  onProgress({
    stage: 'complete',
    pages: pageCount,
    scannedPages: scanPageNumbers.length,
    lowConfidencePages,
  });

  return results;
}
