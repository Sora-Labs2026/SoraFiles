import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

type PdfJsRuntime = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let runtimePromise: Promise<PdfJsRuntime> | undefined;

/**
 * Load PDF.js through its official compatibility entry in both the window and
 * worker realms. The legacy bundle feature-detects newer platform methods such
 * as Uint8Array#toHex and Map#getOrInsertComputed before installing fallbacks,
 * so native implementations are kept when the browser already provides them.
 */
export const loadPdfJs = async (): Promise<PdfJsRuntime> => {
  runtimePromise ??= import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfjs = await runtimePromise;
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  return pdfjs;
};

export { pdfWorkerUrl };
