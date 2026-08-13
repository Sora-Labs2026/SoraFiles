export type OcrStage = 'loading-model' | 'initializing' | 'recognizing' | 'complete';

export interface OcrProgress {
  stage: OcrStage;
  progress?: number;
  page: number;
  pageCount: number;
}

export interface OcrPageResult {
  text: string;
  confidence: number;
}

export interface OcrEngine {
  recognize(image: HTMLCanvasElement, signal: AbortSignal): Promise<OcrPageResult>;
  terminate(): Promise<void>;
}
