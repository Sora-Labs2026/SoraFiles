// Runs in the document head before resources or shared page behavior. Checkout
// parameters are untrusted display data, never payment or entitlement authority.
(() => {
  const query = new URLSearchParams(location.search);
  const values = query.getAll('license_key');
  let key = values.length === 1 && /^[A-Za-z0-9_-]{6,512}$/.test(values[0]) ? values[0] : '';
  query.delete('license_key');
  try { history.replaceState(null, '', location.pathname); }
  catch { key = ''; }

  document.addEventListener('DOMContentLoaded', () => {
    const panel = document.querySelector('[data-checkout-key]');
    const empty = document.querySelector('[data-checkout-empty]');
    const input = document.querySelector('[data-license-value]');
    const reveal = document.querySelector('[data-license-reveal]');
    const copy = document.querySelector('[data-license-copy]');
    const status = document.querySelector('[data-checkout-status]');
    if (!panel || !empty || !input || !reveal || !copy || !status) { key = ''; return; }
    if (key) { panel.hidden = false; empty.hidden = true; }
    let revealed = false;
    reveal.addEventListener('click', () => {
      if (!key) return;
      revealed = !revealed;
      input.value = revealed ? key : '';
      input.hidden = !revealed;
      reveal.textContent = revealed ? 'Hide key' : 'Show key';
      reveal.setAttribute('aria-expanded', String(revealed));
    });
    copy.addEventListener('click', async () => {
      if (!key) return;
      try { await navigator.clipboard.writeText(key); status.textContent = key ? 'License key copied. Paste it in SoraFiles Desktop.' : ''; }
      catch { status.textContent = key ? 'Copy is unavailable. Choose Show key, then select and copy it.' : ''; }
    });
    addEventListener('pagehide', () => {
      key = ''; input.value = ''; input.hidden = true;
      panel.hidden = true; empty.hidden = false; status.textContent = '';
    });
  }, { once: true });
})();
