import { zipSync } from 'fflate';
import { PDFDocument, degrees as pdfDegrees } from 'pdf-lib';

import type { SerializedProcessingError } from '../contracts.ts';
import type { PdfJobInput, PdfJobOutput } from '../engines/pdf.ts';
import { isMainToWorker, type MainToWorker, type WorkerToMain } from '../worker-protocol.ts';

type RenderedPdfPayload =
  | { operation: 'assemble-compressed'; images: ArrayBuffer[]; sizes: Array<{ width: number; height: number }> }
  | { operation: 'archive-images' };

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<MainToWorker>) => void): void;
  postMessage(message: WorkerToMain, transferables?: Transferable[]): void;
  close(): void;
}

const scope = self as unknown as WorkerScope;
const cancelledJobs = new Set<string>();
const stagedImages = new Map<string, Map<number, Uint8Array>>();

const safeError = (
  code: SerializedProcessingError['code'],
  phase: SerializedProcessingError['phase'],
  retryable = true,
): SerializedProcessingError => ({
  code,
  phase,
  retryable,
  messageKey: `errors.${code}`,
  recoveryKey: 'recovery.retry',
});

function transferable(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function checkCancelled(jobId: string): void {
  if (cancelledJobs.has(jobId)) throw safeError('cancelled', 'process');
}

const yieldToCancellation = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function progress(jobId: string, phase: 'decode' | 'process' | 'encode' | 'package', completed: number, total: number): void {
  scope.postMessage({ type: 'progress', jobId, phase, completed, total });
}

async function loadPdf(bytes: ArrayBuffer) {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/encrypt|password/i.test(message)) throw safeError('encrypted-file', 'decode', false);
    throw safeError('corrupt-input', 'decode', false);
  }
}

async function merge(input: Extract<PdfJobInput, { operation: 'merge' }>, jobId: string): Promise<PdfJobOutput> {
  const output = await PDFDocument.create();
  let pages = 0;
  for (let index = 0; index < input.files.length; index += 1) {
    checkCancelled(jobId);
    const source = await loadPdf(input.files[index]);
    const copied = await output.copyPages(source, source.getPageIndices());
    copied.forEach((page) => output.addPage(page));
    pages += copied.length;
    progress(jobId, 'process', index + 1, input.files.length);
    await yieldToCancellation();
  }
  const bytes = await output.save({ useObjectStreams: true });
  return { bytes: transferable(bytes), pages };
}

async function split(input: Extract<PdfJobInput, { operation: 'split' }>, jobId: string): Promise<PdfJobOutput> {
  const source = await loadPdf(input.bytes);
  const pages = source.getPageCount();
  if (pages > 100) throw safeError('page-limit', 'validate', false);
  const entries: Record<string, Uint8Array> = {};
  for (let index = 0; index < pages; index += 1) {
    checkCancelled(jobId);
    const output = await PDFDocument.create();
    const [page] = await output.copyPages(source, [index]);
    output.addPage(page);
    entries[`page-${String(index + 1).padStart(3, '0')}.pdf`] = await output.save({ useObjectStreams: true });
    progress(jobId, 'process', index + 1, pages);
    await yieldToCancellation();
  }
  checkCancelled(jobId);
  progress(jobId, 'package', 0, 1);
  const bytes = zipSync(entries, { level: 6 });
  return { bytes: transferable(bytes), pages };
}

async function rotate(input: Extract<PdfJobInput, { operation: 'rotate' }>, jobId: string): Promise<PdfJobOutput> {
  const source = await loadPdf(input.bytes);
  const pages = source.getPages();
  pages.forEach((page, index) => {
    checkCancelled(jobId);
    page.setRotation(pdfDegrees((page.getRotation().angle + input.degrees) % 360));
    progress(jobId, 'process', index + 1, pages.length);
  });
  const bytes = await source.save({ useObjectStreams: true });
  return { bytes: transferable(bytes), pages: pages.length };
}

async function imagesToPdf(input: Extract<PdfJobInput, { operation: 'images-to-pdf' }>, jobId: string): Promise<PdfJobOutput> {
  const output = await PDFDocument.create();
  for (let index = 0; index < input.images.length; index += 1) {
    checkCancelled(jobId);
    const bytes = input.images[index];
    const probe = new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength));
    const png = probe[0] === 0x89 && probe[1] === 0x50 && probe[2] === 0x4e && probe[3] === 0x47;
    const image = png ? await output.embedPng(bytes) : await output.embedJpg(bytes);
    let pageWidth: number;
    let pageHeight: number;
    if (input.pageMode === 'a4') {
      const landscape = image.width > image.height;
      pageWidth = landscape ? 841.89 : 595.28;
      pageHeight = landscape ? 595.28 : 841.89;
    } else {
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      pageWidth = image.width * scale * 0.75;
      pageHeight = image.height * scale * 0.75;
    }
    const page = output.addPage([pageWidth, pageHeight]);
    const margin = input.pageMode === 'a4' ? 28 : 0;
    const fit = Math.min((pageWidth - margin * 2) / image.width, (pageHeight - margin * 2) / image.height);
    const width = image.width * fit;
    const height = image.height * fit;
    page.drawImage(image, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height });
    progress(jobId, 'process', index + 1, input.images.length);
    await yieldToCancellation();
  }
  const bytes = await output.save({ useObjectStreams: true });
  return { bytes: transferable(bytes), pages: input.images.length };
}

async function assembleCompressed(input: Extract<RenderedPdfPayload, { operation: 'assemble-compressed' }>, jobId: string): Promise<PdfJobOutput> {
  const output = await PDFDocument.create();
  output.setProducer('Sora Files local PDF compressor');
  for (let index = 0; index < input.images.length; index += 1) {
    checkCancelled(jobId);
    const image = await output.embedJpg(input.images[index]);
    const size = input.sizes[index];
    const page = output.addPage([size.width, size.height]);
    page.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
    await yieldToCancellation();
  }
  const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false });
  return { bytes: transferable(bytes), pages: input.images.length };
}

function archiveImages(_input: Extract<RenderedPdfPayload, { operation: 'archive-images' }>, jobId: string): PdfJobOutput {
  checkCancelled(jobId);
  const entries: Record<string, Uint8Array> = {};
  const staged = stagedImages.get(jobId) ?? new Map();
  for (const [index, bytes] of [...staged.entries()].sort(([left], [right]) => left - right)) {
    entries[`page-${String(index).padStart(3, '0')}.jpg`] = bytes;
  }
  const bytes = zipSync(entries, { level: 0 });
  stagedImages.delete(jobId);
  return { bytes: transferable(bytes), pages: staged.size };
}

interface CanvasSurface {
  canvas: OffscreenCanvas;
  context: OffscreenCanvasRenderingContext2D;
}

class WorkerCanvasFactory {
  create(width: number, height: number): CanvasSurface {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw safeError('browser-unsupported', 'process', false);
    return { canvas, context };
  }
  reset(surface: CanvasSurface, width: number, height: number): void {
    surface.canvas.width = width;
    surface.canvas.height = height;
  }
  destroy(surface: CanvasSurface): void {
    surface.canvas.width = 1;
    surface.canvas.height = 1;
  }
}

async function renderPdf(
  input: Extract<PdfJobInput, { operation: 'compress' | 'pdf-to-images' }>,
  jobId: string,
): Promise<PdfJobOutput> {
  const pdfjs = await import('pdfjs-dist');
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(input.bytes),
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    wasmUrl: '/pdfjs/wasm/',
    CanvasFactory: WorkerCanvasFactory,
  });
  let document: Awaited<typeof loadingTask.promise> | null = null;
  try {
    document = await loadingTask.promise;
    if (document.numPages > 40) throw safeError('page-limit', 'validate', false);
    const output = input.operation === 'compress' ? await PDFDocument.create() : null;
    if (output) output.setProducer('Sora Files local PDF compressor');
    const entries: Record<string, Uint8Array> = {};
    const preset = input.operation === 'compress' ? input.preset : null;
    const setting = preset === 'small' ? { scale: 1.2, quality: 0.58 }
      : preset === 'quality' ? { scale: 2, quality: 0.82 }
        : { scale: input.operation === 'pdf-to-images' ? input.scale : 1.5, quality: input.operation === 'pdf-to-images' ? 0.86 : 0.72 };

    for (let index = 1; index <= document.numPages; index += 1) {
      checkCancelled(jobId);
      const page = await document.getPage(index);
      let surface: CanvasSurface | null = null;
      let renderTask: ReturnType<typeof page.render> | null = null;
      let renderComplete = false;
      try {
        const points = page.getViewport({ scale: 1 });
        let scale = setting.scale;
        const pixelCount = points.width * scale * points.height * scale;
        if (pixelCount > 16_000_000) scale *= Math.sqrt(16_000_000 / pixelCount);
        const viewport = page.getViewport({ scale });
        const factory = new WorkerCanvasFactory();
        surface = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
        surface.context.fillStyle = '#fff';
        surface.context.fillRect(0, 0, surface.canvas.width, surface.canvas.height);
        renderTask = page.render({
          canvas: surface.canvas as unknown as HTMLCanvasElement,
          canvasContext: surface.context as unknown as CanvasRenderingContext2D,
          viewport,
          background: '#fff',
        });
        await renderTask.promise;
        renderComplete = true;
        checkCancelled(jobId);
        const blob = await surface.canvas.convertToBlob({ type: 'image/jpeg', quality: setting.quality });
        const jpeg = new Uint8Array(await blob.arrayBuffer());
        if (output) {
          const image = await output.embedJpg(jpeg);
          const outPage = output.addPage([points.width, points.height]);
          outPage.drawImage(image, { x: 0, y: 0, width: points.width, height: points.height });
        } else {
          entries[`page-${String(index).padStart(3, '0')}.jpg`] = jpeg;
        }
      } finally {
        if (renderTask && !renderComplete) renderTask.cancel();
        page.cleanup();
        if (surface) new WorkerCanvasFactory().destroy(surface);
      }
      progress(jobId, 'process', index, document.numPages);
      await yieldToCancellation();
    }

    checkCancelled(jobId);
    const bytes = output
      ? await output.save({ useObjectStreams: true, addDefaultPage: false })
      : zipSync(entries, { level: 0 });
    return { bytes: transferable(bytes), pages: document.numPages };
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error) throw error;
    const name = error instanceof Error ? error.name : '';
    if (name === 'PasswordException') throw safeError('password-required', 'decode', false);
    throw safeError('render-failed', 'process');
  } finally {
    await loadingTask.destroy();
  }
}

async function run(input: PdfJobInput | RenderedPdfPayload, jobId: string): Promise<PdfJobOutput> {
  if (input.operation === 'assemble-compressed') return assembleCompressed(input, jobId);
  if (input.operation === 'archive-images') return archiveImages(input, jobId);
  if (input.operation === 'merge') return merge(input, jobId);
  if (input.operation === 'split') return split(input, jobId);
  if (input.operation === 'rotate') return rotate(input, jobId);
  if (input.operation === 'images-to-pdf') return imagesToPdf(input, jobId);
  return renderPdf(input, jobId);
}

scope.addEventListener('message', (event) => {
  if (!isMainToWorker(event.data)) return;
  const message = event.data;
  if (message.type === 'archive-entry') {
    const entries = stagedImages.get(message.jobId) ?? new Map<number, Uint8Array>();
    entries.set(message.index, new Uint8Array(message.bytes));
    stagedImages.set(message.jobId, entries);
    return;
  }
  if (message.type === 'cancel') {
    cancelledJobs.add(message.jobId);
    stagedImages.delete(message.jobId);
    return;
  }
  if (message.type === 'dispose') {
    stagedImages.clear();
    scope.postMessage({ type: 'disposed' });
    scope.close();
    return;
  }
  if (message.type !== 'start') return;

  const input = message.payload as PdfJobInput | RenderedPdfPayload;
  void run(input, message.jobId).then((result) => {
    if (cancelledJobs.has(message.jobId)) {
      scope.postMessage({ type: 'cancelled', jobId: message.jobId });
      return;
    }
    scope.postMessage({ type: 'success', jobId: message.jobId, result }, [result.bytes]);
  }).catch((error: unknown) => {
    const value = error as SerializedProcessingError;
    if (value?.code === 'cancelled' || cancelledJobs.has(message.jobId)) {
      scope.postMessage({ type: 'cancelled', jobId: message.jobId });
    } else {
      scope.postMessage({ type: 'failure', jobId: message.jobId, error: value?.code ? value : safeError('unknown', 'process') });
    }
  }).finally(() => cancelledJobs.delete(message.jobId));
});

scope.postMessage({ type: 'ready' });
