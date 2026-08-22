export function bindPercentRange(input: HTMLInputElement, output: HTMLOutputElement): () => void {
  const sync = () => {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const raw = Number(input.value);
    const value = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : min;
    const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.value = String(value);
    input.style.setProperty('--range-progress', `${progress}%`);
    input.setAttribute('aria-valuetext', `${value}% reduction`);
    output.value = `${value}%`;
    output.textContent = `${value}%`;
  };

  input.addEventListener('input', sync);
  input.addEventListener('change', sync);
  sync();
  return sync;
}
