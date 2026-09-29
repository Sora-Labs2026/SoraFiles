export function normalizedRangeProgress(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

// The native value accessor, looked up lazily so this module also loads outside a browser.
const nativeValue = () => Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;

export function syncRangeProgress(input: HTMLInputElement): number {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const native = nativeValue();
  const raw = Number(native.get!.call(input));
  const value = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : min;
  const progress = normalizedRangeProgress(value, min, max);
  if (native.get!.call(input) !== String(value)) native.set!.call(input, String(value));
  input.style.setProperty('--range-progress', `${progress * 100}%`);
  input.classList.add('sf-range');
  return progress;
}

export function bindRangeProgress(input: HTMLInputElement): () => void {
  if (input.dataset.rangeProgressBound === 'true') return () => syncRangeProgress(input);
  input.dataset.rangeProgressBound = 'true';
  const sync = () => { syncRangeProgress(input); };
  input.addEventListener('input', sync);
  input.addEventListener('change', sync);
  // Tools also move sliders from code (input.value = …, or a new max once an image
  // loads). Those fire no events, so the fill used to lag behind the handle.
  const native = nativeValue();
  Object.defineProperty(input, 'value', {
    configurable: true,
    enumerable: true,
    get() { return native.get!.call(this); },
    set(next) { native.set!.call(this, next); syncRangeProgress(this); },
  });
  new MutationObserver(sync).observe(input, { attributes: true, attributeFilter: ['min', 'max', 'step', 'value'] });
  sync();
  return sync;
}

let watchingNewRanges = false;
export function bindAllRangeProgress(root: ParentNode = document): void {
  root.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(bindRangeProgress);
  // Tool panels render sliders after load; bind those as they appear.
  if (watchingNewRanges || root !== document) return;
  watchingNewRanges = true;
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node instanceof HTMLInputElement && node.type === 'range') bindRangeProgress(node);
      node.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(bindRangeProgress);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}

export function bindPercentRange(input: HTMLInputElement, output: HTMLOutputElement): () => void {
  const syncProgress = bindRangeProgress(input);
  const sync = () => {
    syncProgress();
    const value = Number(input.value);
    input.setAttribute('aria-valuetext', `${value}%`);
    output.value = `${value}%`;
    output.textContent = `${value}%`;
  };
  input.addEventListener('input', sync);
  input.addEventListener('change', sync);
  sync();
  return sync;
}
