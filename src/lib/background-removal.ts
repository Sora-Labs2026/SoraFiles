export function letterbox(width: number, height: number, size = 1024) {
  if (![width, height, size].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid image dimensions');
  const scale = Math.min(size / width, size / height);
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  return { x: Math.floor((size - w) / 2), y: Math.floor((size - h) / 2), width: w, height: h, size };
}
export function backgroundProviders(hasGpu: boolean): ('gpu' | 'cpu')[] { return hasGpu ? ['gpu', 'cpu'] : ['cpu']; }
export function backgroundPixelLimit(memory?: number) { return memory && memory <= 4 ? 12_000_000 : 40_000_000; }
export function backgroundModel(memory?: number) { return memory && memory <= 4 ? 'isnet_quint8' : 'isnet_fp16'; }
export class LatestJob {
  private version = 0;
  next() { return ++this.version; }
  current(token: number) { return token === this.version; }
}
