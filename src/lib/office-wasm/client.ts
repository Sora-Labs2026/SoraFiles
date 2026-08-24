import officeThreadUrl from './office.worker.ts?worker&url';

type OfficeKind = 'writer' | 'calc';
type ProgressStage = 'downloading-engine' | 'loading-document' | 'exporting-pdf';
type ProgressCallback = (stage: ProgressStage) => void;

type ZetaHelperMain = {
  thrPort: MessagePort;
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
  };
  start(callback: () => void): void;
};

type ZetaHelperConstructor = new (
  threadUrl: string,
  options: { threadJsType: 'module'; wasmPkg: 'free'; blockPageScroll: false },
) => ZetaHelperMain;

type PendingJob = {
  inputPath: string;
  outputPath: string;
  resolve: (bytes: Uint8Array) => void;
  reject: (error: Error) => void;
};

type Runtime = { helper: ZetaHelperMain; ready: Promise<void>; pending: Map<string, PendingJob> };

const HELPER_URL = '/vendor/zetajs/1.2.0/zetaHelper.js';
let runtimePromise: Promise<Runtime> | undefined;
let jobSequence = 0;

function ensureCanvas() {
  let canvas = document.querySelector<HTMLCanvasElement>('#qtcanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'qtcanvas';
    canvas.width = 1;
    canvas.height = 1;
    canvas.hidden = true;
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
  }
}

function removeFile(helper: ZetaHelperMain, path: string) {
  try { helper.FS.unlink(path); } catch {}
}

async function initializeRuntime(): Promise<Runtime> {
  if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    throw new Error('officeIsolation');
  }
  ensureCanvas();
  const module = await import(/* @vite-ignore */ HELPER_URL) as { ZetaHelperMain: ZetaHelperConstructor };
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const helper = new module.ZetaHelperMain(officeThreadUrl, {
    threadJsType: 'module',
    wasmPkg: 'free',
    blockPageScroll: false,
  });
  const pending = new Map<string, PendingJob>();

  helper.start(() => {
    helper.thrPort.onmessage = (event: MessageEvent<{ cmd?: string; jobId?: string; outputPath?: string; message?: string }>) => {
      const message = event.data;
      if (message.cmd === 'ready') {
        resolveReady();
        return;
      }
      if (!message.jobId) return;
      const job = pending.get(message.jobId);
      if (!job) return;
      if (message.cmd === 'success') {
        try {
          const source = helper.FS.readFile(job.outputPath);
          const bytes = new Uint8Array(source.byteLength);
          bytes.set(source);
          job.resolve(bytes);
        } catch (error) {
          job.reject(error instanceof Error ? error : new Error('officeFailed'));
        } finally {
          removeFile(helper, job.inputPath);
          removeFile(helper, job.outputPath);
          pending.delete(message.jobId);
        }
      } else if (message.cmd === 'error') {
        removeFile(helper, job.inputPath);
        removeFile(helper, job.outputPath);
        pending.delete(message.jobId);
        job.reject(new Error(message.message || 'officeFailed'));
      }
    };
  });

  addEventListener('error', (event) => {
    if (/SharedArrayBuffer|cross-origin/i.test(event.message || '')) rejectReady(new Error('officeIsolation'));
  }, { once: true });

  return { helper, ready: ready.then(() => undefined), pending };
}

async function getRuntime(onProgress?: ProgressCallback) {
  onProgress?.('downloading-engine');
  runtimePromise ??= initializeRuntime().catch((error) => {
    runtimePromise = undefined;
    throw error;
  });
  const runtime = await runtimePromise;
  await runtime.ready;
  return runtime;
}

export async function convertOfficeToPdf(
  file: File,
  kind: OfficeKind,
  options: { signal?: AbortSignal; onProgress?: ProgressCallback } = {},
): Promise<Uint8Array> {
  if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const runtime = await getRuntime(options.onProgress);
  if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');

  options.onProgress?.('loading-document');
  const jobId = `sf-office-${Date.now()}-${jobSequence += 1}`;
  const extension = file.name.toLowerCase().split('.').pop()?.replace(/[^a-z0-9]/g, '') || (kind === 'writer' ? 'docx' : 'xlsx');
  const inputPath = `/tmp/${jobId}.${extension}`;
  const outputPath = `/tmp/${jobId}.pdf`;
  runtime.helper.FS.writeFile(inputPath, new Uint8Array(await file.arrayBuffer()));
  options.onProgress?.('exporting-pdf');

  return new Promise<Uint8Array>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Cancelled', 'AbortError'));
    options.signal?.addEventListener('abort', onAbort, { once: true });
    runtime.pending.set(jobId, {
      inputPath,
      outputPath,
      resolve: (bytes) => { options.signal?.removeEventListener('abort', onAbort); resolve(bytes); },
      reject: (error) => { options.signal?.removeEventListener('abort', onAbort); reject(error); },
    });
    runtime.helper.thrPort.postMessage({
      cmd: 'convert',
      jobId,
      inputPath,
      outputPath,
      filterName: kind === 'writer' ? 'writer_pdf_Export' : 'calc_pdf_Export',
    });
  });
}
