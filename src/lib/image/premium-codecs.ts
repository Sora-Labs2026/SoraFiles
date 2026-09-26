export type BrowserImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const MOZJPEG_PIXEL_LIMIT = 12_000_000;

function nativeCanvasBlob(canvas: HTMLCanvasElement, mime: BrowserImageMime, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('encode-failed')), mime, quality);
  });
}

export async function encodeMozJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  if (canvas.width * canvas.height > MOZJPEG_PIXEL_LIMIT) return null;
  try {
    const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!context) return null;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const { encode } = await import('@jsquash/jpeg');
    const bytes = await encode(pixels, { quality: Math.round(Math.max(.01, Math.min(1, quality)) * 100) });
    return new Blob([bytes], { type: 'image/jpeg' });
  } catch {
    return null;
  }
}

export async function optimizePngBlob(blob: Blob, pixelCount = 0): Promise<Blob> {
  if (pixelCount > MOZJPEG_PIXEL_LIMIT) return blob;
  try {
    const { optimise } = await import('@jsquash/oxipng');
    const bytes = await optimise(await blob.arrayBuffer(), { level: 3, optimiseAlpha: false, interlace: false });
    const optimized = new Blob([bytes], { type: 'image/png' });
    return optimized.size < blob.size ? optimized : blob;
  } catch {
    return blob;
  }
}

export async function encodePremiumCanvas(canvas: HTMLCanvasElement, mime: BrowserImageMime, quality = .88): Promise<Blob> {
  if (mime === 'image/jpeg') {
    const optimized = await encodeMozJpeg(canvas, quality);
    if (optimized) return optimized;
  }
  const native = await nativeCanvasBlob(canvas, mime, quality);
  return mime === 'image/png' ? optimizePngBlob(native, canvas.width * canvas.height) : native;
}
