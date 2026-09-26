// The installed PDF.js decoder supplies the local JPEG 2000 implementation.
// @ts-expect-error PDF.js does not ship declarations for its image-only bundle.
import { JpxImage } from 'pdfjs-dist/image_decoders/pdf.image_decoders.mjs';

self.onmessage = async ({ data }) => {
  try {
    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const { width, height } = JpxImage.parseImageProperties(bytes);
    if (!width || !height || width * height > 32_000_000) throw new Error('size');
    JpxImage.setOptions({ useWasm: true, useWorkerFetch: true, wasmUrl: data.wasmUrl });
    const decoded = await JpxImage.instance.decode(bytes, { numComponents: 4 });
    const components = decoded.length / (width * height);
    if (![1, 2, 3, 4].includes(components)) throw new Error('decode');
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let p = 0; p < width * height; p++) {
      const i = p * components, j = p * 4;
      pixels[j] = decoded[i];
      pixels[j + 1] = decoded[i + (components >= 3 ? 1 : 0)];
      pixels[j + 2] = decoded[i + (components >= 3 ? 2 : 0)];
      pixels[j + 3] = components === 4 ? decoded[i + 3] : components === 2 ? decoded[i + 1] : 255;
    }
    self.postMessage({ width, height, pixels }, [pixels.buffer]);
  } catch {
    self.postMessage({ error: true });
  }
};
