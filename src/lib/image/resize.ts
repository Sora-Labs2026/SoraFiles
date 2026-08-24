export type ResizeMethod = 'contain' | 'fill' | 'pad' | 'stretch';

export interface PixelSize {
  width: number;
  height: number;
}

export interface SourceRect extends PixelSize {
  x: number;
  y: number;
}

export const MAX_IMAGE_PIXELS = 50_000_000;
export const MAX_WORKING_BYTES = 512 * 1024 * 1024;

export function estimateResizeBytes(source: PixelSize, crop: PixelSize, output: PixelSize): number {
  return (source.width * source.height + crop.width * crop.height + output.width * output.height * 2) * 4;
}

export function assertSafeResize(source: PixelSize, crop: PixelSize, output: PixelSize): void {
  const dimensions = [source, crop, output];
  if (dimensions.some(({ width, height }) => !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1)) {
    throw new Error('invalid-dimensions');
  }
  if (dimensions.some(({ width, height }) => width * height > MAX_IMAGE_PIXELS)) {
    throw new Error('image-too-large');
  }
  if (estimateResizeBytes(source, crop, output) > MAX_WORKING_BYTES) {
    throw new Error('image-too-large');
  }
}

export function fitSize(source: PixelSize, target: PixelSize, method: ResizeMethod): PixelSize {
  if (method === 'stretch' || method === 'fill' || method === 'pad') return { ...target };
  const scale = Math.min(target.width / source.width, target.height / source.height);
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}

async function resizeOnMainThread(image: ImageData, size: PixelSize): Promise<ImageData> {
  const module = await import('@jsquash/resize');
  return module.default(image, {
    width: size.width,
    height: size.height,
    method: 'lanczos3',
    fitMethod: 'stretch',
    premultiply: true,
    linearRGB: true,
  });
}

export async function resizeLanczos(image: ImageData, size: PixelSize, signal?: AbortSignal): Promise<ImageData> {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (typeof Worker === 'undefined') return resizeOnMainThread(image, size);
  let worker: Worker;
  try { worker = new Worker(new URL('../../workers/resize.worker.ts', import.meta.url), { type: 'module' }); }
  catch { return resizeOnMainThread(image, size); }
  return new Promise<ImageData>((resolve, reject) => {
    const abort = () => { worker.terminate(); reject(new DOMException('Cancelled', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    worker.addEventListener('message', (event: MessageEvent<{ ok: boolean; width?: number; height?: number; buffer?: ArrayBuffer; message?: string }>) => {
      signal?.removeEventListener('abort', abort); worker.terminate();
      if (!event.data.ok || !event.data.buffer || !event.data.width || !event.data.height) { reject(new Error(event.data.message || 'resize-failed')); return; }
      resolve(new ImageData(new Uint8ClampedArray(event.data.buffer), event.data.width, event.data.height));
    }, { once: true });
    worker.addEventListener('error', () => { signal?.removeEventListener('abort', abort); worker.terminate(); reject(new Error('resize-worker-failed')); }, { once: true });
    worker.postMessage({ width: image.width, height: image.height, buffer: image.data.buffer, size }, [image.data.buffer]);
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('encode-failed')), mime, quality);
  });
}
