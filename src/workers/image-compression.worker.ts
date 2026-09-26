/// <reference lib="webworker" />

type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
type EncodeRequest = { id: number; pixels: Uint8ClampedArray; width: number; height: number; mime: ImageMime; quality: number };

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
  const { id, pixels, width, height, mime, quality } = event.data;
  try {
    const ownedPixels = new Uint8ClampedArray(pixels.length);
    ownedPixels.set(pixels);
    const image = new ImageData(ownedPixels, width, height);
    let bytes: ArrayBuffer;
    if (mime === 'image/jpeg') {
      const { encode } = await import('@jsquash/jpeg');
      bytes = await encode(image, { quality });
    } else if (mime === 'image/webp') {
      const { encode } = await import('@jsquash/webp');
      bytes = await encode(image, { quality });
    } else {
      const { optimise } = await import('@jsquash/oxipng');
      bytes = await optimise(image, { level: 3, optimiseAlpha: false, interlace: false });
    }
    self.postMessage({ id, ok: true, bytes }, { transfer: [bytes] });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : 'Image encoding failed.' });
  }
};

export {};
