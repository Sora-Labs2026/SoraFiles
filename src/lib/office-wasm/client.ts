import frameUrl from './frame.ts?worker&url';

type ProgressStage = 'downloading-engine' | 'loading-document' | 'exporting-pdf';

// Removing the per-conversion browsing context terminates its dedicated WASM
// workers, including synchronous Office work that cannot handle an abort message.
export function convertOfficeToPdf(
  file: File,
  kind: 'writer' | 'calc',
  options: { signal?: AbortSignal; onProgress?: (stage: ProgressStage) => void } = {},
): Promise<Uint8Array> {
  if (options.signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
  if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') return Promise.reject(new Error('officeIsolation'));
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.setAttribute('aria-hidden', 'true');
    frame.dataset.officeRuntime = '';
    const channel = new MessageChannel();
    let settled = false;
    const finish = (error?: Error, bytes?: Uint8Array) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      channel.port1.close();
      channel.port2.close();
      frame.remove();
      if (error) reject(error); else resolve(bytes!);
    };
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('officeFailed')), 240_000);
    options.signal?.addEventListener('abort', abort, { once: true });
    channel.port1.onmessage = ({ data }) => {
      if (data.type === 'progress') options.onProgress?.(data.stage);
      else if (data.type === 'result' && data.bytes instanceof Uint8Array && data.bytes.byteLength) finish(undefined, data.bytes);
      else if (data.type === 'error') finish(new Error(data.code === 'officeIsolation' ? 'officeIsolation' : 'officeFailed'));
    };
    frame.addEventListener('load', () => {
      if (!settled) frame.contentWindow?.postMessage({ type: 'office-convert', file, kind }, location.origin, [channel.port2]);
    }, { once: true });
    const src = new URL(frameUrl, location.href).href.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="${src}"></script></body></html>`;
    document.body.append(frame);
  });
}
