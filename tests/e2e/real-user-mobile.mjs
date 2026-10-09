// Real user on a phone: for every tool, upload → (Options tab) → run → see the result → download → the file is valid.
// Also: localized and right-to-left pages, dark mode readability, and visible text smells ("undefined", raw keys).
// node tests/e2e/real-user-mobile.mjs [--device iphone-15|android-360|desktop-1280] [--tool a,b] [--locale ja,ar] [--dark]
import { webkit, chromium, devices } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
const base = process.env.SORA_BASE_URL ?? 'http://127.0.0.1:4396';
const arg = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1].split(',') : null);
const qa = (name) => `tests/fixtures/sorafiles-qa/${name}`;
const fx = (name) => `tests/fixtures/${name}`;
const DEVICES = {
  'iphone-15': [webkit, { ...devices['iPhone 15'] }],
  'android-360': [chromium, { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } }],
  'desktop-1280': [chromium, { viewport: { width: 1280, height: 720 } }],
};
const deviceNames = arg('--device') ?? ['iphone-15', 'android-360'];
const locales = arg('--locale') ?? [''];
const dark = process.argv.includes('--dark');
const only = arg('--tool');

const isPdf = (b) => b.subarray(0, 5).toString() === '%PDF-';
const pdfPages = async (b) => (await PDFDocument.load(b, { ignoreEncryption: true })).getPageCount();
const isJpeg = (b) => b[0] === 0xff && b[1] === 0xd8;
const isPng = (b) => b[0] === 0x89 && b[1] === 0x50;
const isWebp = (b) => b.subarray(8, 12).toString() === 'WEBP';
const zipNames = (b) => Object.keys(unzipSync(new Uint8Array(b))).filter((n) => !n.endsWith('/'));
const jpegDims = (b) => { let at = 2; while (at < b.length) { const m = b[at + 1], len = (b[at + 2] << 8) | b[at + 3]; if (m >= 0xc0 && m <= 0xc3) return [(b[at + 7] << 8) | b[at + 8], (b[at + 5] << 8) | b[at + 6]]; at += 2 + len; } return null; };

// Each tool: route, fixtures, where things are, how to configure, how to judge the file.
const action = { input: '#action-input', result: '#action-result', download: '#action-download', status: '#action-status', error: '#action-error' };
const extra = { input: '[data-extra-input]', result: '[data-extra-results]', download: '[data-extra-result-list] a[download]', status: '[data-extra-status]', error: '[data-extra-error]' };
const TOOLS = {
  'compress-image': { files: [qa('landscape.jpg')], input: '#file-input', result: '#result-state', download: '#download-result', status: '#process-status', error: '#file-error', check: async (b) => isJpeg(b) && b.length < 120901 ? '' : 'not a smaller JPG' },
  'heic-to-jpg': { files: [fx('libheif-example.heic')], input: '#file-input', result: '#result-state', download: '#download-result', status: '#process-status', error: '#file-error', check: async (b) => isJpeg(b) ? '' : 'not a JPG' },
  'image-converter': { files: [qa('landscape.jpg')], input: '#converter-input', result: '#converter-result', download: '#converter-download', status: '#converter-status', error: '#converter-error', configure: async (p) => p.locator('#converter-format').selectOption('image/png'), check: async (b) => isPng(b) ? '' : 'not a PNG' },
  pdf: { files: [qa('mixed-content.pdf')], input: '#pdf-input', result: '#pdf-result', download: '#pdf-download', status: '#pdf-status', error: '#pdf-file-error', check: async (b) => isPdf(b) && await pdfPages(b) === 2 ? '' : 'not a 2-page PDF' },
  'merge-pdf': { ...action, files: [fx('minimal.pdf'), fx('minimal-2.pdf')], check: async (b) => await pdfPages(b) === 2 ? '' : 'not 2 pages' },
  'split-pdf': { ...action, files: [fx('text-two-page.pdf')], check: async (b) => zipNames(b).length === 2 ? '' : 'zip without 2 pages' },
  'rotate-pdf': { ...action, files: [fx('text-two-page.pdf')], configure: async (p) => { const pages = p.locator('[data-workspace-mobile-nav]:not([hidden]) [data-mobile-panel="pages"]'); if (await pages.isVisible().catch(() => false)) await pages.click(); const r = p.locator('[data-pdf-rotate="90"]'); if (await r.isVisible()) await r.click(); else return 'rotate control not visible on this device'; }, check: async (b) => (await PDFDocument.load(b)).getPage(0).getRotation().angle === 90 ? '' : 'page not rotated' },
  'remove-pages': { ...action, files: [fx('text-two-page.pdf')], configure: async (p) => p.locator('#remove-page-spec').fill('2'), check: async (b) => await pdfPages(b) === 1 ? '' : 'page not removed' },
  'watermark-pdf': { ...action, files: [fx('text-two-page.pdf')], configure: async (p) => p.locator('#watermark-text').fill('QA WATERMARK'), check: async (b) => await pdfPages(b) === 2 ? '' : 'not 2 pages' },
  'page-numbers': { ...action, files: [fx('text-two-page.pdf')], check: async (b) => await pdfPages(b) === 2 ? '' : 'not 2 pages' },
  'sign-pdf': { ...action, files: [fx('text-two-page.pdf')], configure: async (p) => { await p.locator('[data-sign-mode="draw"]').click(); const c = p.locator('#signature-draw-canvas'); const box = await c.boundingBox(); if (!box) return 'signature canvas not visible'; await p.mouse.move(box.x + 20, box.y + box.height * .6); await p.mouse.down(); await p.mouse.move(box.x + box.width * .4, box.y + box.height * .3, { steps: 6 }); await p.mouse.move(box.x + box.width * .7, box.y + box.height * .6, { steps: 6 }); await p.mouse.up(); }, check: async (b) => await pdfPages(b) === 2 && b.length > 1000 ? '' : 'no signature embedded' },
  'jpg-to-pdf': { ...action, files: [qa('landscape.jpg')], check: async (b) => await pdfPages(b) === 1 ? '' : 'not a 1-page PDF' },
  'pdf-to-jpg': { ...action, files: [fx('text-two-page.pdf')], check: async (b) => zipNames(b).filter((n) => /\.jpg$/i.test(n)).length === 2 ? '' : 'zip without 2 JPGs' },
  'pdf-to-word': { ...action, files: [fx('text-two-page.pdf')], configure: async (p) => p.locator('input[name="pdfWordMode"][value="visual"]').check({ force: true }), check: async (b) => zipNames(b).includes('word/document.xml') ? '' : 'not a DOCX' },
  'word-to-pdf': { ...action, files: [fx('single-paragraph.docx')], timeout: 600000, check: async (b) => isPdf(b) && await pdfPages(b) >= 1 ? '' : 'not a PDF' },
  'edit-image': { ...extra, files: [qa('landscape.jpg')], check: async (b) => isJpeg(b) || isPng(b) || isWebp(b) ? '' : 'not an image' },
  'protect-pdf': { ...extra, files: [fx('minimal.pdf')], configure: async (p) => p.locator('[data-extra-password]').fill('SoraFiles-test-42'), check: async (b) => /\/Encrypt/.test(b.toString('latin1')) ? '' : 'not encrypted' },
  'unlock-pdf': { ...extra, files: [qa('protected.pdf')], configure: async (p) => p.locator('[data-extra-password]').fill('SoraQA2026!'), check: async (b) => !/\/Encrypt/.test(b.toString('latin1')) && await pdfPages(b) === 3 ? '' : 'still encrypted' },
  'repair-pdf': { ...extra, files: [qa('native-text-3-pages.pdf')], check: async (b) => await pdfPages(b) === 3 ? '' : 'not 3 pages' },
  'metadata-remover': { ...extra, files: [qa('metadata.pdf')], check: async (b) => isPdf(b) ? '' : 'not a PDF' },
  'pdf-to-excel': { ...extra, files: [qa('table.pdf')], check: async (b) => zipNames(b).includes('xl/workbook.xml') ? '' : 'not an XLSX' },
  'excel-to-pdf': { ...extra, files: [qa('workbook.xlsx')], timeout: 600000, check: async (b) => isPdf(b) ? '' : 'not a PDF' },
  'pdf-ocr': { ...extra, files: [fx('scan-english.pdf')], timeout: 180000, configure: async (p) => { await p.locator('[data-extra-lang]').selectOption('eng'); await p.locator('[data-ocr-output]').selectOption('txt'); }, check: async (b) => /Sora Files local OCR/i.test(b.toString('utf8')) ? '' : 'OCR text missing' },
  'resize-image': { files: [qa('landscape.jpg')], input: '[data-resize-input]', result: '[data-resize-result]', download: '[data-resize-download]', status: '[data-resize-progress]', error: '[data-resize-error]', configure: async (p) => { await p.locator('[data-resize-width]').fill('800'); await p.locator('[data-resize-width]').dispatchEvent('input'); }, check: async (b) => { const d = jpegDims(b); return d && d[0] === 800 ? '' : `dims ${d}`; } },
  'doc-scanner': { files: [qa('photographed-document.png')], input: '[data-scanner-input]', result: '[data-export-result]', download: '[data-export-download]', status: '[data-scanner-progress]', error: '[data-scanner-error]', primary: '[data-export-run]', timeout: 180000, check: async (b) => isPdf(b) && await pdfPages(b) === 1 ? '' : 'not a 1-page PDF' },
  'remove-background': { files: [qa('background-subject.png')], input: '[data-background-input]', result: '[data-background-result]', download: '[data-background-download]', status: '[data-background-status]', error: '[data-background-error]', primary: '[data-background-process]', timeout: 300000, check: async (b) => isPng(b) ? '' : 'not a PNG' },
};

const SMELLS = /\bundefined\b|\bNaN\b|\[object |\{(size|limit|count|n)\}|\b(opt|wb|ui|msg)\.[a-zA-Z]+\b/;
async function visibleTextSmells(page) {
  return page.evaluate((re) => {
    const bad = new Set(); const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node; while ((node = walker.nextNode())) { const el = node.parentElement; if (!el || !el.offsetParent || el.closest('script,style,noscript,[hidden]')) continue; const text = node.textContent.trim(); if (text && new RegExp(re).test(text)) bad.add(text.slice(0, 80)); }
    return [...bad].slice(0, 5);
  }, SMELLS.source);
}
// Text contrast for everything visible inside the open workspace (WCAG 2.x, 4.5:1 normal, 3:1 large).
async function contrastIssues(page) {
  return page.evaluate(() => {
    const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const parse = (s) => { const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
    const bgOf = (el) => { for (let a = el; a; a = a.parentElement) { const c = parse(getComputedStyle(a).backgroundColor); if (c && c[3] > .9) return c; } return [255, 255, 255, 1]; };
    const root = document.querySelector('[data-workspace-surface]') || document.body; const out = [];
    for (const el of root.querySelectorAll('*')) {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
      if (!own) continue; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg || fg[3] < .9) continue; const bg = bgOf(el);
      const L1 = lum(...fg), L2 = lum(...bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
      const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700, large = size >= 24 || (size >= 18.66 && bold);
      if (ratio < (large ? 3 : 4.5)) out.push(`${ratio.toFixed(2)}:1 ${el.tagName.toLowerCase()} "${own.slice(0, 40)}" ${Math.round(size)}px`);
    }
    return out.slice(0, 8);
  });
}

const rows = [];
await mkdir('test-results/real-user', { recursive: true });
for (const deviceName of deviceNames) {
  const [engine, options] = DEVICES[deviceName];
  const browser = await engine.launch(engine === chromium ? { channel: 'msedge' } : {});
  for (const locale of locales) {
    const prefix = locale ? `/${locale}` : '';
    for (const [tool, spec] of Object.entries(TOOLS)) {
      if (only && !only.includes(tool)) continue;
      const context = await browser.newContext({ ...options, acceptDownloads: true, serviceWorkers: 'block', colorScheme: dark ? 'dark' : 'light' });
      // Third parties stay out of the test, except the hosts that serve the LibreOffice and background-removal engines.
      const engineHosts = new Set(['127.0.0.1', 'cdn.zetaoffice.net', 'business-cdn.zetaoffice.net', 'staticimgly.com']);
      await context.route((url) => /^https?:$/.test(url.protocol) && !engineHosts.has(url.hostname), (route) => route.abort());
      if (dark) await context.addInitScript(() => { try { localStorage.setItem('sora-theme', 'dark'); } catch {} });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
      const row = { device: deviceName, locale: locale || 'en', tool, ok: false, ms: 0, note: '' };
      const started = Date.now();
      try {
        await page.goto(`${base}${prefix}/${tool}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.locator(spec.input).first().setInputFiles(spec.files);
        // The workspace opens after the file is read; wait for it (or an immediate error) before acting.
        await Promise.race([page.locator('[data-workspace-surface]').first().waitFor({ state: 'visible', timeout: 60000 }), page.locator(spec.error).first().waitFor({ state: 'visible', timeout: 60000 }).then(async () => { throw new Error(`upload error: ${(await page.locator(spec.error).first().textContent())?.trim().slice(0, 140)}`); })]);
        await page.waitForTimeout(800);
        const nav = page.locator('[data-workspace-mobile-nav]:not([hidden]) [data-mobile-panel="inspector"]');
        const mobile = await nav.isVisible().catch(() => false);
        let configNote = '';
        if (spec.configure) { if (mobile) await nav.click(); configNote = (await spec.configure(page)) || ''; }
        // Without options a phone user taps the bottom button on the File tab; with options, the real button on the Options tab.
        const proxy = page.locator('[data-mobile-primary]:not([hidden])');
        const primary = page.locator(spec.primary ?? '[data-workspace-primary]').first();
        if (mobile && await proxy.isVisible().catch(() => false)) await proxy.click();
        else { await primary.waitFor({ state: 'visible', timeout: 30000 }); await primary.click(); }
        const result = page.locator(spec.result), error = page.locator(spec.error);
        await Promise.race([result.waitFor({ state: 'visible', timeout: spec.timeout ?? 120000 }), error.waitFor({ state: 'visible', timeout: spec.timeout ?? 120000 }).then(async () => { throw new Error(`tool error: ${(await error.textContent())?.trim().slice(0, 140)}`); })]);
        row.ms = Date.now() - started;
        const box = await result.boundingBox(); const vp = page.viewportSize();
        const inView = box && box.y < vp.height && box.y + box.height > 0;
        const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator(spec.download).first().click()]);
        const bytes = await readFile(await download.path());
        const bad = await spec.check(bytes);
        const smells = await visibleTextSmells(page);
        const contrast = dark ? await contrastIssues(page) : [];
        row.ok = !bad && !smells.length && !contrast.length && errors.length === 0;
        row.note = [bad && `file: ${bad}`, !inView && 'result not in view', smells.length && `text: ${smells.join(' | ')}`, contrast.length && `contrast: ${contrast.join(' | ')}`, errors.length && `js: ${errors[0]}`, configNote].filter(Boolean).join('; ');
        row.file = `${download.suggestedFilename()} ${bytes.length} B`;
        if (!inView) row.ok = false;
      } catch (e) {
        row.ms = Date.now() - started;
        const status = await page.locator(spec.status).first().textContent().catch(() => '');
        row.note = `${e.message.split('\n')[0].slice(0, 160)}${status ? ` · status: ${status.trim().slice(0, 100)}` : ''}${errors.length ? ` · js: ${errors[0]}` : ''}`;
      }
      rows.push(row);
      console.log(`${row.ok ? 'PASS' : 'FAIL'} ${deviceName.padEnd(12)} ${(locale || 'en').padEnd(3)} ${tool.padEnd(18)} ${String(row.ms).padStart(6)} ms ${row.file ?? ''} ${row.note}`);
      await context.close();
    }
  }
  await browser.close();
}
await writeFile(`test-results/real-user/${deviceNames.join('_')}${locales.filter(Boolean).length ? '-' + locales.filter(Boolean).join('_') : ''}${dark ? '-dark' : ''}.json`, JSON.stringify(rows, null, 1));
console.log(`REAL USER: ${rows.filter((r) => r.ok).length}/${rows.length} passed`);
