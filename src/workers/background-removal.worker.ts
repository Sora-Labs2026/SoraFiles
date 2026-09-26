import { letterbox } from '../lib/background-removal';
import { solidPalette, refineSolidStrip } from '../lib/solid-background';

self.onmessage = async ({ data }) => {
  let source: ImageBitmap | undefined, mask: ImageBitmap | undefined;
  let inference: OffscreenCanvas | undefined, output: OffscreenCanvas | undefined;
  try {
    const { file, publicPath, device, model, pixelLimit, cleanup } = data;
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
    if (!source.width || source.width * source.height > pixelLimit) throw new Error('size');
    const rect = letterbox(source.width, source.height);
    inference = new OffscreenCanvas(rect.size, rect.size);
    const ctx = inference.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, rect.size, rect.size);
    ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
    const module = await import('@imgly/background-removal');
    // Only the bounded square is decoded by IMG.LY. The original never enters its full-size tensor path.
    const maskBlob = await module.segmentForeground(await inference.convertToBlob({ type: 'image/png' }), {
      publicPath, device, model, rescale: true, proxyToWorker: false, debug: false,
      output: { format: 'image/png', quality: 1 },
      progress: (key: string) => self.postMessage({ type: 'progress', stage: key.startsWith('compute:') ? 'processing' : 'loading' }),
    });
    mask = await createImageBitmap(maskBlob);
    if (mask.width !== rect.size || mask.height !== rect.size) throw new Error('mask');
    ctx.clearRect(0, 0, rect.size, rect.size);
    ctx.drawImage(mask, 0, 0);
    const alpha = ctx.getImageData(rect.x, rect.y, rect.width, rect.height).data;
    let foreground = false;
    for (let i = 3; i < alpha.length; i += 4) if (alpha[i] > 0) { foreground = true; break; }
    // A blank mask is an inference failure, never a successful transparent download.
    if (!foreground) throw new Error('empty-mask');
    output = new OffscreenCanvas(source.width, source.height);
    const out = output.getContext('2d')!;
    out.drawImage(source, 0, 0);
    // Multiply existing source alpha by the soft mask; never replace transparency with opaque pixels.
    out.globalCompositeOperation = 'destination-in';
    out.imageSmoothingEnabled = true; out.imageSmoothingQuality = 'high';
    out.drawImage(mask, rect.x, rect.y, rect.width, rect.height, 0, 0, source.width, source.height);
    if (cleanup) {
      const probe = letterbox(source.width, source.height, 256);
      inference.width = probe.width; inference.height = probe.height;
      ctx.drawImage(source, 0, 0, probe.width, probe.height);
      const pixels = ctx.getImageData(0, 0, probe.width, probe.height).data;
      ctx.clearRect(0, 0, probe.width, probe.height);
      ctx.drawImage(mask, rect.x, rect.y, rect.width, rect.height, 0, 0, probe.width, probe.height);
      const palette = solidPalette(pixels, ctx.getImageData(0, 0, probe.width, probe.height).data, probe.width, probe.height);
      if (palette) {
        const rows = Math.max(1, Math.min(256, Math.floor(4_000_000 / source.width)));
        inference.width = source.width; inference.height = rows;
        for (let y = 0; y < source.height; y += rows) {
          const height = Math.min(rows, source.height - y);
          ctx.clearRect(0, 0, source.width, rows);
          ctx.drawImage(source, 0, y, source.width, height, 0, 0, source.width, height);
          const original = ctx.getImageData(0, 0, source.width, height);
          const cleaned = out.getImageData(0, y, source.width, height);
          refineSolidStrip(original.data, cleaned.data, palette);
          out.putImageData(cleaned, 0, y);
        }
      }
    }
    const blob = await output.convertToBlob({ type: 'image/png' });
    if (!blob.size) throw new Error('encode');
    self.postMessage({ type: 'result', blob, width: source.width, height: source.height });
  } catch {
    // Never include input names, pixels, or upstream exception payloads in diagnostics.
    self.postMessage({ type: 'error' });
  } finally {
    source?.close(); mask?.close();
    if (inference) { inference.width = 0; inference.height = 0; }
    if (output) { output.width = 0; output.height = 0; }
  }
};
