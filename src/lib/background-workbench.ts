import { safeOutputStem } from '../utils/filename';
import { LatestJob, backgroundProviders, backgroundPixelLimit, backgroundModel } from './background-removal';

export function initializeBackgroundWorkbench(root: HTMLElement) {
  const q = <T extends HTMLElement>(name: string) => root.querySelector<T>(`[data-background-${name}]`)!;
  const messages = JSON.parse(q('messages').textContent || '{}') as Record<string, string>;
  const input = q<HTMLInputElement>('input'), process = q<HTMLButtonElement>('process');
  const before = q<HTMLImageElement>('before'), after = q<HTMLImageElement>('after');
  const error = q('error'), result = q('result'), progress = q('progress'), status = q('status');
  const workspace = root.querySelector<HTMLElement>('[data-adaptive-workspace]')!;
  const download = q<HTMLAnchorElement>('download'), cancel = q<HTMLButtonElement>('cancel');
  const cleanup = q<HTMLInputElement>('cleanup');
  const viewButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-background-view]')];
  const setView = (view: string) => { root.dataset.backgroundPreview = view; viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.backgroundView === view))); };
  viewButtons.forEach(button => button.addEventListener('click', () => setView(button.dataset.backgroundView!)));
  setView('before');
  const jobs = new LatestJob();
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const pixelLimit = backgroundPixelLimit(memory);
  let file: File | null = null, sourceUrl = '', resultUrl = '', busy = false;
  let activeWorker: Worker | undefined, rejectActive: (() => void) | undefined;
  const stopWorker = () => { activeWorker?.terminate(); activeWorker = undefined; rejectActive?.(); rejectActive = undefined; };
  const revoke = () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); if (resultUrl) URL.revokeObjectURL(resultUrl); sourceUrl = ''; resultUrl = ''; download.removeAttribute('href'); };
  const setBusy = (value: boolean) => { busy = value; process.disabled = value; cleanup.disabled = value; cancel.hidden = !value; root.setAttribute('aria-busy', String(value)); };
  const fail = (text: string) => {
    // Validation can fail before a workspace exists; keep its message visible there too.
    if (workspace.hidden) q('empty').after(error); else q('editor').append(error);
    error.textContent = text; error.hidden = false; error.focus();
  };
  const reset = () => {
    jobs.next(); stopWorker(); setBusy(false); revoke(); file = null; input.value = ''; cleanup.checked = false;
    setView('before'); viewButtons[1].disabled = true;
    delete root.dataset.workspaceFilename;
    before.removeAttribute('src'); after.removeAttribute('src'); after.hidden = true;
    q('placeholder').hidden = false; q('empty').hidden = false; q('editor').hidden = true;
    progress.hidden = true; result.hidden = true; error.hidden = true;
    workspace.dispatchEvent(new CustomEvent('workspace-clean')); workspace.hidden = true;
  };
  const select = async (candidate?: File) => {
    if (!candidate) return;
    reset();
    const token = jobs.next(); stopWorker(); setBusy(false);
    error.hidden = true; result.hidden = true; progress.hidden = true;
    const tooLarge = messages.tooLarge.replace('40', String(pixelLimit / 1_000_000));
    if (candidate.size <= 0 || candidate.size > 50_000_000 || !/^image\/(jpeg|png|webp)$/i.test(candidate.type)) { fail(candidate.size > 50_000_000 ? tooLarge : messages.invalid); return; }
    try {
      const bitmap = await createImageBitmap(candidate, { imageOrientation: 'from-image' });
      const pixels = bitmap.width * bitmap.height; bitmap.close();
      if (!jobs.current(token)) return;
      if (!pixels || pixels > pixelLimit) { fail(tooLarge); return; }
    } catch { if (jobs.current(token)) fail(messages.invalid); return; }
    revoke(); file = candidate; sourceUrl = URL.createObjectURL(candidate); before.src = sourceUrl;
    root.dataset.workspaceFilename = candidate.name;
    workspace.querySelector<HTMLElement>('[data-workspace-filename]')!.textContent = candidate.name;
    q('empty').hidden = true; q('editor').hidden = false; workspace.hidden = false;
    after.removeAttribute('src'); after.hidden = true; q('placeholder').hidden = false;
    workspace.dispatchEvent(new CustomEvent('workspace-clean')); process.focus();
  };
  const attempt = (source: File, publicPath: string, device: 'gpu' | 'cpu', model: 'isnet_fp16' | 'isnet_quint8', token: number) => new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/background-removal.worker.ts', import.meta.url), { type: 'module' });
    activeWorker = worker;
    const timer = setTimeout(() => finish(new Error('timeout')), 180_000);
    const finish = (reason?: Error, blob?: Blob) => {
      clearTimeout(timer); worker.terminate();
      if (activeWorker === worker) { activeWorker = undefined; rejectActive = undefined; }
      reason ? reject(reason) : resolve(blob!);
    };
    rejectActive = () => finish(new Error('cancelled'));
    worker.onerror = () => finish(new Error('runtime'));
    worker.onmessage = ({ data }) => {
      if (!jobs.current(token)) { finish(new Error('cancelled')); return; }
      if (data.type === 'progress') status.textContent = data.stage === 'loading' ? messages.loading : messages.processing;
      if (data.type === 'error') finish(new Error('processing'));
      if (data.type === 'result') finish(undefined, data.blob);
    };
    worker.postMessage({ file: source, publicPath, device, model, pixelLimit, cleanup: cleanup.checked });
  });
  q('drop').addEventListener('click', () => input.click());
  input.addEventListener('change', () => void select(input.files?.[0]));
  for (const name of ['dragenter', 'dragover']) q('drop').addEventListener(name, event => { event.preventDefault(); q('drop').dataset.dragActive = 'true'; });
  for (const name of ['dragleave', 'drop']) q('drop').addEventListener(name, event => { event.preventDefault(); delete q('drop').dataset.dragActive; });
  q('drop').addEventListener('drop', event => void select((event as DragEvent).dataTransfer?.files[0]));
  q('reset').addEventListener('click', reset);
  cancel.addEventListener('click', () => { jobs.next(); stopWorker(); setBusy(false); progress.hidden = true; result.hidden = true; process.focus(); });
  process.addEventListener('click', async () => {
    if (!file || busy) return;
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') { fail(messages.failed); return; }
    const token = jobs.next(), source = file;
    setBusy(true); error.hidden = true; result.hidden = true; progress.hidden = false; status.textContent = messages.loading;
    try {
      let blob: Blob | undefined;
      const model = backgroundModel(memory);
      const providers: { device: 'gpu' | 'cpu'; model: 'isnet_fp16' | 'isnet_quint8' }[] = backgroundProviders('gpu' in navigator).map(device => ({ device, model }));
      if (model !== 'isnet_quint8') providers.push({ device: 'cpu', model: 'isnet_quint8' });
      const paths = [`${location.origin}/__sf/background-removal/`, 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/'];
      for (const { device, model } of providers) {
        for (const path of paths) {
          if (!jobs.current(token)) return;
          try { blob = await attempt(source, path, device, model, token); break; } catch { /* Try the next static asset source/provider. */ }
        }
        if (blob) break;
      }
      if (!jobs.current(token)) return;
      if (!blob || blob.type !== 'image/png' || !blob.size) throw new Error('output');
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(blob); after.src = resultUrl; after.hidden = false; q('placeholder').hidden = true;
      download.href = resultUrl; download.download = `${safeOutputStem(source.name, 'image')}-transparent.png`;
      progress.hidden = true; result.hidden = false;
      q('comparison').after(result); viewButtons[1].disabled = false; setView('after');
      result.focus({ preventScroll: true }); q('editor').scrollTo({ top: 0 });
    } catch { if (jobs.current(token)) { fail(messages.failed); progress.hidden = true; } }
    finally { if (jobs.current(token)) setBusy(false); }
  });
  addEventListener('pagehide', () => { jobs.next(); stopWorker(); revoke(); });
}
