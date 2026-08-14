import type { ProcessingEvent } from '../contracts.ts';
import type { JobHandle } from '../controller.ts';
import { ProcessingError } from '../errors.ts';
import { WorkerClient } from '../worker-client.ts';
import type { MainToWorker } from '../worker-protocol.ts';
import pdfJsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export type PdfJobInput =
  | { operation: 'compress'; bytes: ArrayBuffer; preset: 'small' | 'balanced' | 'quality' }
  | { operation: 'merge'; files: ArrayBuffer[] }
  | { operation: 'split'; bytes: ArrayBuffer }
  | { operation: 'rotate'; bytes: ArrayBuffer; degrees: 90 | 180 | 270 }
  | { operation: 'images-to-pdf'; images: ArrayBuffer[]; pageMode: 'a4' | 'image' }
  | { operation: 'pdf-to-images'; bytes: ArrayBuffer; scale: number };

export interface PdfJobOutput {
  bytes: ArrayBuffer;
  pages: number;
}

export interface LocalJobContext {
  job: JobHandle;
  onEvent?: (event: ProcessingEvent) => void;
}

type LifecycleWindow = Window & {
  __SORA_TEST_PDF_LIFECYCLE__?: boolean;
};

type PdfResource = 'loading-task' | 'page' | 'render-task';
type PdfResourceEvent = 'acquired' | 'destroyed' | 'cleaned' | 'cancelled';

const toolByOperation = {
  compress: 'compress-pdf',
  merge: 'merge-pdf',
  split: 'split-pdf',
  rotate: 'rotate-pdf',
  'images-to-pdf': 'jpg-to-pdf',
  'pdf-to-images': 'pdf-to-jpg',
} as const;

function inputBuffers(input: PdfJobInput): ArrayBuffer[] {
  if (input.operation === 'merge') return input.files;
  if (input.operation === 'images-to-pdf') return input.images;
  return [input.bytes];
}

type RenderedPdfPayload =
  | { operation: 'assemble-compressed'; images: ArrayBuffer[]; sizes: Array<{ width: number; height: number }> }
  | { operation: 'archive-images' };

const cancelled = () => new ProcessingError({
  code: 'cancelled', phase: 'process', retryable: true,
  messageKey: 'errors.cancelled', recoveryKey: 'recovery.retry',
});

function assertActive(job: JobHandle): void {
  if (job.signal.aborted) throw cancelled();
}

function resourceLifecycle(resource: PdfResource, event: PdfResourceEvent, jobId: string): void {
  if (typeof window === 'undefined' || !(window as LifecycleWindow).__SORA_TEST_PDF_LIFECYCLE__) return;
  window.dispatchEvent(new CustomEvent('sora:pdf-resource-lifecycle', {
    detail: { resource, event, jobId },
  }));
}

function normalizedPdfError(error: unknown, job: JobHandle, documentLoaded: boolean): ProcessingError {
  if (job.signal.aborted) return cancelled();
  if (error instanceof ProcessingError) return error;
  const name = error instanceof Error ? error.name : '';
  if (name === 'PasswordException') return new ProcessingError({
    code: 'password-required', phase: 'decode', retryable: false,
    messageKey: 'errors.password-required', recoveryKey: 'recovery.chooseOriginal',
  });
  return new ProcessingError(documentLoaded ? {
    code: 'render-failed', phase: 'process', retryable: true,
    messageKey: 'errors.render-failed', recoveryKey: 'recovery.retry',
  } : {
    code: 'corrupt-input', phase: 'decode', retryable: false,
    messageKey: 'errors.corrupt-input', recoveryKey: 'recovery.chooseOriginal',
  });
}

const canvasJpeg = (canvas: HTMLCanvasElement, quality: number) => new Promise<ArrayBuffer>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) reject(new ProcessingError({
      code: 'encode-failed', phase: 'encode', retryable: true,
      messageKey: 'errors.encode-failed', recoveryKey: 'recovery.retry',
    }));
    else void blob.arrayBuffer().then(resolve, reject);
  }, 'image/jpeg', quality);
});

async function renderPages(
  input: Extract<PdfJobInput, { operation: 'compress' | 'pdf-to-images' }>,
  context: LocalJobContext,
  stageImage?: (bytes: ArrayBuffer, index: number) => void,
): Promise<RenderedPdfPayload> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfJsWorkerUrl;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(input.bytes),
    cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, wasmUrl: '/pdfjs/wasm/',
  });
  let documentProxy: Awaited<typeof loadingTask.promise> | null = null;
  let destroyed = false;
  resourceLifecycle('loading-task', 'acquired', context.job.jobId);
  const destroy = async () => {
    if (destroyed) return;
    destroyed = true;
    try {
      await loadingTask.destroy();
    } finally {
      resourceLifecycle('loading-task', 'destroyed', context.job.jobId);
    }
  };
  context.job.resources.defer(destroy);
  try {
    documentProxy = await loadingTask.promise;
    if (documentProxy.numPages > 40) throw new ProcessingError({
      code: 'page-limit', phase: 'validate', retryable: false,
      messageKey: 'errors.page-limit', recoveryKey: 'recovery.chooseOriginal',
    });
    const images: ArrayBuffer[] = [];
    const sizes: Array<{ width: number; height: number }> = [];
    const preset = input.operation === 'compress' ? input.preset : null;
    const setting = preset === 'small' ? { scale: 1.2, quality: 0.58 }
      : preset === 'quality' ? { scale: 2, quality: 0.82 }
        : { scale: input.operation === 'pdf-to-images' ? input.scale : 1.5, quality: input.operation === 'pdf-to-images' ? 0.86 : 0.72 };
    for (let index = 1; index <= documentProxy.numPages; index += 1) {
      assertActive(context.job);
      const page = await documentProxy.getPage(index);
      assertActive(context.job);
      resourceLifecycle('page', 'acquired', context.job.jobId);
      let cleaned = false;
      const cleanup = () => { if (!cleaned) { cleaned = true; try { page.cleanup(); } finally { resourceLifecycle('page', 'cleaned', context.job.jobId); } } };
      context.job.resources.defer(cleanup);
      const points = page.getViewport({ scale: 1 });
      let scale = setting.scale;
      const pixels = points.width * scale * points.height * scale;
      if (pixels > 16_000_000) scale *= Math.sqrt(16_000_000 / pixels);
      const viewport = page.getViewport({ scale });
      const canvas = context.job.resources.trackCanvas(document.createElement('canvas'));
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const canvasContext = canvas.getContext('2d', { alpha: false });
      if (!canvasContext) throw new ProcessingError({ code: 'browser-unsupported', phase: 'process', retryable: false, messageKey: 'errors.browser-unsupported', recoveryKey: 'recovery.retry' });
      canvasContext.fillStyle = '#fff'; canvasContext.fillRect(0, 0, canvas.width, canvas.height);
      const renderTask = page.render({ canvas, canvasContext, viewport, background: '#fff' });
      resourceLifecycle('render-task', 'acquired', context.job.jobId);
      let rendering = true;
      let renderCancelled = false;
      const cancelRender = () => {
        if (!rendering || renderCancelled) return;
        renderCancelled = true;
        try { renderTask.cancel(); } finally { resourceLifecycle('render-task', 'cancelled', context.job.jobId); }
      };
      context.job.resources.defer(cancelRender);
      try {
        if ((window as LifecycleWindow).__SORA_TEST_PDF_LIFECYCLE__) {
          await new Promise<void>((resolve) => setTimeout(resolve, 250));
        }
        await renderTask.promise;
        rendering = false;
        assertActive(context.job);
        const bytes = await canvasJpeg(canvas, setting.quality);
        assertActive(context.job);
        if (input.operation === 'pdf-to-images' && stageImage) stageImage(bytes, index);
        else images.push(bytes);
        sizes.push({ width: points.width, height: points.height });
      } finally {
        cancelRender();
        cleanup(); canvas.width = 1; canvas.height = 1;
      }
      context.onEvent?.({ type: 'progress', jobId: context.job.jobId, phase: 'process', completed: index, total: documentProxy.numPages });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    return input.operation === 'compress' ? { operation: 'assemble-compressed', images, sizes } : { operation: 'archive-images' };
  } catch (error) {
    throw normalizedPdfError(error, context.job, documentProxy !== null);
  } finally {
    try {
      await destroy();
    } catch (error) {
      throw normalizedPdfError(error, context.job, documentProxy !== null);
    }
  }
}

function lifecycle(event: 'created' | 'disposed', jobId: string): void {
  if (typeof window === 'undefined' || !(window as LifecycleWindow).__SORA_TEST_PDF_LIFECYCLE__) return;
  window.dispatchEvent(new CustomEvent('sora:pdf-worker-lifecycle', {
    detail: { engine: 'pdf', event, jobId },
  }));
}

export const pdfEngine = {
  async run(input: PdfJobInput, context: LocalJobContext): Promise<PdfJobOutput> {
    const worker = new Worker(new URL('../workers/pdf.worker.ts', import.meta.url), { type: 'module' });
    const client = new WorkerClient(worker);
    let disposed = false;
    lifecycle('created', context.job.jobId);

    const dispose = async () => {
      if (disposed) return;
      disposed = true;
      await client.dispose();
      lifecycle('disposed', context.job.jobId);
    };
    context.job.resources.defer(dispose);

    try {
      const payload: PdfJobInput | RenderedPdfPayload = input.operation === 'compress' || input.operation === 'pdf-to-images'
        ? await renderPages(input, context, input.operation === 'pdf-to-images' ? (bytes, index) => {
            const message: MainToWorker = { type: 'archive-entry', jobId: context.job.jobId, index, bytes };
            worker.postMessage(message, [bytes]);
          } : undefined)
        : input;
      assertActive(context.job);
      const transferables = payload.operation === 'assemble-compressed'
        ? payload.images
        : payload.operation === 'archive-images' ? [] : inputBuffers(input);
      const output = await client.run<PdfJobOutput>(
        context.job,
        toolByOperation[input.operation],
        payload,
        transferables,
        (event) => context.onEvent?.({
          ...event,
          completed: event.type === 'progress' ? event.completed ?? 0 : undefined,
          total: event.type === 'progress' ? event.total ?? 0 : undefined,
        } as ProcessingEvent),
      );
      assertActive(context.job);
      return output;
    } catch (error) {
      if (context.job.signal.aborted) throw cancelled();
      throw error;
    } finally {
      await dispose();
    }
  },
};
