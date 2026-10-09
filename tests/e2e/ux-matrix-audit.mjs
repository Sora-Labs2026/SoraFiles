// Measurement-only UX audit: every web tool, landing + workspace (+ mobile
// inspector tab), on real WebKit (iPhone/iPad/Safari) and Chromium (Android,
// Windows). Reports numbers, never screenshots.
// node tests/e2e/ux-matrix-audit.mjs [--tool a,b] [--device iphone-se,...]
import { chromium, webkit, devices } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const base = process.env.SORA_BASE_URL ?? 'http://127.0.0.1:4396';
const qa = (name) => `${root}tests/fixtures/sorafiles-qa/${name}`;
const arg = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1].split(',') : null);

const PDF = qa('native-text-3-pages.pdf'), JPG = qa('landscape.jpg');
const TOOLS = {
  'compress-image': JPG, 'doc-scanner': qa('photographed-document.png'), 'edit-image': JPG,
  'excel-to-pdf': qa('workbook.xlsx'), 'heic-to-jpg': `${root}tests/fixtures/libheif-example.heic`,
  'image-converter': JPG, 'jpg-to-pdf': JPG, 'merge-pdf': PDF, 'metadata-remover': qa('metadata.pdf'),
  'page-numbers': PDF, pdf: qa('mixed-content.pdf'), 'pdf-ocr': qa('scanned-document.pdf'), 'pdf-to-excel': qa('table.pdf'),
  'pdf-to-jpg': PDF, 'pdf-to-word': PDF, 'protect-pdf': PDF, 'remove-background': qa('background-subject.png'),
  'remove-pages': PDF, 'repair-pdf': PDF, 'resize-image': JPG, 'rotate-pdf': PDF, 'sign-pdf': PDF,
  'split-pdf': PDF, 'unlock-pdf': qa('protected.pdf'), 'watermark-pdf': PDF, 'word-to-pdf': qa('simple.docx'),
};
const DEVICES = {
  'iphone-se': { engine: webkit, ...devices['iPhone SE'] },
  'iphone-15': { engine: webkit, ...devices['iPhone 15'] },
  'android-360': { engine: chromium, ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } },
  'android-412': { engine: chromium, ...devices['Pixel 7'] },
  ipad: { engine: webkit, ...devices['iPad (gen 7)'] },
  'laptop-1280': { engine: chromium, viewport: { width: 1280, height: 720 } },
  'safari-1440': { engine: webkit, viewport: { width: 1440, height: 900 } },
};

// Runs in the page. Returns compact findings for the current state.
function measure(mobile) {
  const vw = innerWidth, vh = innerHeight, out = {};
  const visible = (el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && r.width > 1 && r.height > 1; };
  const label = (el) => { const t = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.name || el.id || '').trim().replace(/\s+/g, ' ').slice(0, 40); const c = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''; return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : c}${t ? ` "${t}"` : ''}`; };
  const clipsX = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') return true; } return false; };
  out.overflow = document.documentElement.scrollWidth - vw;
  // A full-screen workspace (mobile) is a modal: only its contents are reachable.
  const ws = document.querySelector('[data-workspace-surface]');
  const wsRect = ws && visible(ws) ? ws.getBoundingClientRect() : null;
  const scope = wsRect && wsRect.width >= vw - 2 && wsRect.height >= vh * 0.9 && wsRect.top <= 1 ? ws : document.body;
  out.modalWorkspace = scope !== document.body;
  const all = [...scope.querySelectorAll('*')].filter(visible).filter((el) => !el.closest('details:not([open]) > :not(summary)'));
  out.offscreen = all.filter((el) => { const r = el.getBoundingClientRect(); return (r.right > vw + 2 || r.left < -2) && !clipsX(el) && getComputedStyle(el).position !== 'fixed'; }).filter((el) => !el.closest('[aria-hidden="true"]')).slice(0, 6).map(label);
  const interactive = all.filter((el) => el.matches('a[href],button,select,textarea,input:not([type=hidden]):not([type=file]),[role=button],[role=tab],[tabindex]:not([tabindex="-1"]),summary,label:has(input[type=checkbox]),label:has(input[type=radio])') && !el.closest('[aria-hidden="true"]'));
  const inText = (el) => el.tagName === 'A' && el.closest('p,li') && el.closest('p,li').textContent.trim().length > el.textContent.trim().length + 20;
  const isRadioLike = (el) => el.matches('input[type=radio],input[type=checkbox]') && el.closest('label');
  const small = interactive.filter((el) => !inText(el) && !isRadioLike(el)).map((el) => [el, el.getBoundingClientRect()]).filter(([, r]) => r.width < (mobile ? 44 : 24) || r.height < (mobile ? 44 : 24));
  out.tapUnder24 = small.filter(([, r]) => r.width < 24 || r.height < 24).slice(0, 8).map(([el, r]) => `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  out.tapUnder44 = mobile ? small.length : 0;
  out.tapUnder44Sample = mobile ? small.filter(([, r]) => r.width >= 24 && r.height >= 24).slice(0, 6).map(([el, r]) => `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`) : [];
  out.iosZoomInputs = mobile ? interactive.filter((el) => el.matches('input:not([type=range]):not([type=radio]):not([type=checkbox]):not([type=color]),select,textarea') && parseFloat(getComputedStyle(el).fontSize) < 16).slice(0, 6).map((el) => `${label(el)} ${getComputedStyle(el).fontSize}`) : [];
  const texts = all.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1));
  out.tinyText = texts.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 11).slice(0, 6).map((el) => `${label(el)} ${getComputedStyle(el).fontSize}`);
  out.covered = interactive.filter((el) => { const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || y < 0 || x > vw || y > vh) return false; const hit = document.elementFromPoint(x, y); return hit && hit !== el && !el.contains(hit) && !hit.contains(el) && !(el.htmlFor && hit.id === el.htmlFor) && !(hit.closest('label') && hit.closest('label').contains(el)); }).slice(0, 6).map((el) => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return `${label(el)} under ${label(hit)}`; });
  const primary = [...scope.querySelectorAll('[data-mobile-primary],[data-workspace-primary]')].find((el) => visible(el)) || [...scope.querySelectorAll('[data-workspace-primary],.btn--primary,button[type=submit]')].find((el) => el.closest('[data-workspace-surface]')) || null;
  if (primary) { const r = primary.getBoundingClientRect(); out.primary = { label: label(primary), shown: visible(primary), top: Math.round(r.top + scrollY), inView: visible(primary) && r.top >= 0 && r.bottom <= vh, disabled: primary.disabled === true }; }
  const surface = document.querySelector('[data-workspace-surface]');
  if (surface && visible(surface)) { const r = surface.getBoundingClientRect(); out.surface = { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + scrollY), fitsWidth: r.left >= -1 && r.right <= vw + 1 }; }
  const canvas = [...document.querySelectorAll('[data-workspace-canvas] canvas,[data-workspace-canvas] img,[data-workspace-canvas],[data-resize-stage],.canvas-frame')].find(visible);
  if (canvas) { const r = canvas.getBoundingClientRect(); out.canvas = { w: Math.round(r.width), h: Math.round(r.height), fitsWidth: r.left >= -1 && r.right <= vw + 1, tallerThanView: r.height > vh }; }
  out.pageHeight = Math.round(document.documentElement.scrollHeight);
  out.vh = vh; out.vw = vw;
  return out;
}

const only = arg('--tool'), onlyDevices = arg('--device');
const results = [];
await mkdir(`${root}test-results/ux-matrix`, { recursive: true });
for (const [deviceName, cfg] of Object.entries(DEVICES)) {
  if (onlyDevices && !onlyDevices.includes(deviceName)) continue;
  const { engine, ...ctxOptions } = cfg;
  const browser = await engine.launch(engine === chromium ? { channel: 'msedge' } : {});
  const mobile = Boolean(ctxOptions.isMobile) || (ctxOptions.viewport?.width ?? 1280) < 820;
  for (const [tool, fixture] of Object.entries(TOOLS)) {
    if (only && !only.includes(tool)) continue;
    const context = await browser.newContext({ ...ctxOptions, serviceWorkers: 'block' });
    await context.route((url) => /^https?:$/.test(url.protocol) && url.hostname !== '127.0.0.1', (route) => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 120)));
    const row = { device: deviceName, tool, stages: {} };
    try {
      await page.goto(`${base}/${tool}/`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 30000 });
      await page.waitForTimeout(400);
      row.stages.landing = await page.evaluate(measure, mobile);
      const input = page.locator('input[type=file]').first();
      await input.setInputFiles(fixture);
      await page.locator('[data-workspace-surface]').first().waitFor({ state: 'visible', timeout: 90000 }).catch(() => { row.noWorkspace = true; });
      await page.waitForTimeout(1500);
      row.stages.workspace = await page.evaluate(measure, mobile);
      const tab = page.locator('[data-workspace-mobile-nav]:not([hidden]) [data-mobile-panel="inspector"]').first();
      if (mobile && await tab.isVisible().catch(() => false)) { await tab.click(); await page.waitForTimeout(500); row.stages.inspector = await page.evaluate(measure, mobile); }
    } catch (error) { row.error = String(error.message).split('\n')[0].slice(0, 160); }
    row.pageErrors = [...new Set(errors)].slice(0, 3);
    results.push(row);
    const flags = Object.entries(row.stages).map(([stage, m]) => `${stage}:${m.overflow > 1 ? ` overflow+${m.overflow}` : ''}${m.offscreen.length ? ` off${m.offscreen.length}` : ''}${m.tapUnder24.length ? ` tap<24:${m.tapUnder24.length}` : ''}${m.iosZoomInputs.length ? ` zoom${m.iosZoomInputs.length}` : ''}${m.covered.length ? ` covered${m.covered.length}` : ''}${m.tinyText.length ? ` tiny${m.tinyText.length}` : ''}`).join(' | ');
    console.log(`${deviceName.padEnd(12)} ${tool.padEnd(18)} ${row.error ? 'ERROR ' + row.error : ''}${row.noWorkspace ? 'NO-WORKSPACE ' : ''}${flags}${row.pageErrors.length ? ' pageErrors:' + row.pageErrors.length : ''}`);
    await context.close();
  }
  await browser.close();
  await writeFile(`${root}test-results/ux-matrix/${process.env.UX_OUT ?? 'results'}.json`, JSON.stringify(results, null, 1));
}
console.log(`UX MATRIX: ${results.length} device/tool runs written to test-results/ux-matrix/results.json`);
