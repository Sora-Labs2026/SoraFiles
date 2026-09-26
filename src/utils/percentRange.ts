export function normalizedRangeProgress(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export function syncRangeProgress(input: HTMLInputElement): number {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const raw = Number(input.value);
  const value = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : min;
  const progress = normalizedRangeProgress(value, min, max);
  input.value = String(value);
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
  sync();
  return sync;
}

export function bindAllRangeProgress(root: ParentNode = document): void {
  root.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(bindRangeProgress);
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
