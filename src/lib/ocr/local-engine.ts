import { createWorker, OEM, PSM } from 'tesseract.js';
import type { OcrEngine } from './types';
import type { OcrLanguageCode } from './languages';

export async function createLocalOcrEngine(
  language: OcrLanguageCode,
  onProgress: (progress: number) => void,
): Promise<OcrEngine> {
  let terminated = false;
  const worker = await createWorker(language, OEM.LSTM_ONLY, {
    workerPath: '/ocr/runtime/worker.min.js',
    corePath: '/ocr/runtime',
    langPath: '/ocr/lang',
    logger: (message) => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') {
        onProgress(message.progress);
      }
    },
  });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });

  return {
    async recognize(image, signal) {
      if (signal.aborted) throw new DOMException('OCR cancelled', 'AbortError');
      const abort = () => {
        void worker.terminate();
        terminated = true;
      };
      signal.addEventListener('abort', abort, { once: true });
      try {
        const result = await worker.recognize(image, { rotateAuto: true });
        return { text: result.data.text.normalize('NFC').trim(), confidence: result.data.confidence };
      } finally {
        signal.removeEventListener('abort', abort);
      }
    },
    async terminate() {
      if (!terminated) {
        terminated = true;
        await worker.terminate();
      }
    },
  };
}
