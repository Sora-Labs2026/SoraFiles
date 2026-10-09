// Prints the computed layout chain for one element: node tests/e2e/ux-probe.mjs <tool> <device> <selector> [inspector]
import { chromium, webkit, devices } from 'playwright';
const [tool, device, selector, view] = process.argv.slice(2);
const cfg = { 'iphone-se': [webkit, devices['iPhone SE']], 'iphone-15': [webkit, devices['iPhone 15']], 'android-360': [chromium, { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } }], 'laptop-1280': [chromium, { viewport: { width: 1280, height: 720 } }] }[device];
const fixtures = { pdf: 'tests/fixtures/sorafiles-qa/native-text-3-pages.pdf', img: 'tests/fixtures/sorafiles-qa/landscape.jpg' };
const browser = await cfg[0].launch(cfg[0] === chromium ? { channel: 'msedge' } : {});
const page = await (await browser.newContext({ ...cfg[1], serviceWorkers: 'block' })).newPage();
await page.goto(`http://127.0.0.1:4396/${tool}/`);
await page.locator('input[type=file]').first().setInputFiles(/image|resize|edit|scanner|background|jpg-to/.test(tool) ? fixtures.img : fixtures.pdf);
await page.locator('[data-workspace-surface]').first().waitFor({ state: 'visible' });
await page.waitForTimeout(1500);
if (view === 'inspector') { await page.locator('[data-workspace-mobile-nav]:not([hidden]) [data-mobile-panel="inspector"]').first().click(); await page.waitForTimeout(600); }
console.log(await page.evaluate((sel) => {
  const lines = [];
  for (let el = document.querySelector(sel); el && el !== document.body; el = el.parentElement) {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    lines.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''} ${[...el.attributes].filter((a) => a.name.startsWith('data-workspace') || a.name === 'data-mobile-view').map((a) => `[${a.name}${a.value ? '=' + a.value : ''}]`).join('')} | ${Math.round(r.width)}x${Math.round(r.height)} | display:${s.display} cols:${s.gridTemplateColumns.slice(0, 60)} rows:${s.gridTemplateRows.slice(0, 60)} h:${s.height} pos:${s.position} ovY:${s.overflowY} scrollH:${el.scrollHeight} top:${Math.round(r.top)}`);
  }
  return lines.join('\n');
}, selector));
await browser.close();
