/// <reference lib="webworker" />
import resize from '@jsquash/resize';

self.addEventListener('message', async (event: MessageEvent<{ width: number; height: number; buffer: ArrayBuffer; size: { width: number; height: number } }>) => {
  try {
    const { width, height, buffer, size } = event.data;
    const result = await resize(new ImageData(new Uint8ClampedArray(buffer), width, height), {
      width: size.width, height: size.height, method: 'lanczos3', fitMethod: 'stretch', premultiply: true, linearRGB: true,
    });
    self.postMessage({ ok: true, width: result.width, height: result.height, buffer: result.data.buffer }, { transfer: [result.data.buffer] });
  } catch (error) {
    self.postMessage({ ok: false, message: error instanceof Error ? error.message : 'resize-failed' });
  }
});
