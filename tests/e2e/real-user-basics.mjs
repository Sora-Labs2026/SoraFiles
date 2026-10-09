// What a real user meets before any processing: the way to start is visible without scrolling, a wrong file
// gets a plain message instead of silence, and a keyboard user can reach the run button.
// node tests/e2e/real-user-basics.mjs [--device iphone-15|android-360|desktop-1280]
import { webkit, chromium, devices } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
const base = process.env.SORA_BASE_URL ?? 'http://127.0.0.1:4396';
const arg = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1].split(',') : null);
const DEVICES = { 'iphone-15': [webkit, { ...devices['iPhone 15'] }], 'android-360': [chromium, { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } }], 'desktop-1280': [chromium, { viewport: { width: 1280, height: 720 } }] };
const deviceNames = arg('--device') ?? ['iphone-15', 'desktop-1280'];
const qa = (name) => `tests/fixtures/sorafiles-qa/${name}`;
const action = { chooser: '#action-choose', input: '#action-input', error: '#action-error', good: 'tests/fixtures/text-two-page.pdf' };
const extra = { chooser: '[data-extra-drop]', input: '[data-extra-input]', error: '[data-extra-error]', good: qa('native-text-3-pages.pdf') };
const TOOLS = {
  'compress-image': { chooser: '#choose-file', input: '#file-input', error: '#file-error', good: qa('landscape.jpg') },
  'heic-to-jpg': { chooser: '#choose-file', input: '#file-input', error: '#file-error', good: 'tests/fixtures/libheif-example.heic' },
  'image-converter': { chooser: '#converter-choose', input: '#converter-input', error: '#converter-error', good: qa('landscape.jpg') },
  pdf: { chooser: '#pdf-choose', input: '#pdf-input', error: '#pdf-file-error', good: qa('mixed-content.pdf') },
  'merge-pdf': { ...action, good: ['tests/fixtures/minimal.pdf', 'tests/fixtures/minimal-2.pdf'] },
  ...Object.fromEntries(['split-pdf', 'rotate-pdf', 'remove-pages', 'watermark-pdf', 'page-numbers', 'sign-pdf', 'pdf-to-jpg', 'pdf-to-word'].map((t) => [t, action])),
  'jpg-to-pdf': { ...action, good: qa('landscape.jpg') }, 'word-to-pdf': { ...action, good: 'tests/fixtures/single-paragraph.docx' },
  ...Object.fromEntries(['protect-pdf', 'unlock-pdf', 'repair-pdf', 'metadata-remover', 'pdf-to-excel', 'pdf-ocr'].map((t) => [t, extra])),
  'edit-image': { ...extra, good: qa('landscape.jpg') }, 'excel-to-pdf': { ...extra, good: qa('workbook.xlsx') },
  'resize-image': { chooser: '[data-resize-choose]', input: '[data-resize-input]', error: '[data-resize-select-error], [data-resize-error]', good: qa('landscape.jpg') },
  'doc-scanner': { chooser: '[data-scanner-upload]', input: '[data-scanner-input]', error: '[data-scanner-error]', good: qa('photographed-document.png') },
  'remove-background': { chooser: '[data-background-drop]', input: '[data-background-input]', error: '[data-background-error]', good: qa('background-subject.png') },
};
const rows = [];
await mkdir('test-results/real-user', { recursive: true });
for (const deviceName of deviceNames) {
  const [engine, options] = DEVICES[deviceName];
  const browser = await engine.launch(engine === chromium ? { channel: 'msedge' } : {});
  const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
  await context.route((url) => /^https?:$/.test(url.protocol) && url.hostname !== '127.0.0.1', (route) => route.abort());
  for (const [tool, spec] of Object.entries(TOOLS)) {
    const page = await context.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));
    const row = { device: deviceName, tool, issues: [] };
    try {
      await page.goto(`${base}/${tool}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator(spec.chooser).first().waitFor({ state: 'visible', timeout: 30000 });
      const box = await page.locator(spec.chooser).first().boundingBox(), vh = page.viewportSize().height;
      if (!box || box.y + box.height > vh) row.issues.push(`start control below the fold (top ${Math.round(box?.y ?? -1)}px, screen ${vh}px)`);
      if (box && deviceName !== 'desktop-1280' && box.height < 44) row.issues.push(`start control only ${Math.round(box.height)}px tall`);
      // A wrong file type: the user must get a message, with no script error.
      await page.locator(spec.input).first().setInputFiles(qa('unsupported.txt'));
      const error = page.locator(spec.error).first();
      const got = await error.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
      const text = got ? (await error.textContent())?.replace(/\s+/g, ' ').trim() : '';
      if (!got) row.issues.push('wrong file type: no visible message');
      else if (text.length < 12 || /^error$/i.test(text)) row.issues.push(`wrong file type: unhelpful message "${text}"`);
      row.wrongFileMessage = text.slice(0, 90);
      if (await page.locator('[data-workspace-surface]').first().isVisible().catch(() => false)) row.issues.push('wrong file type: workspace opened anyway');
      // Keyboard: after a good file, Tab must reach the run button (desktop only; phones have no Tab).
      if (deviceName === 'desktop-1280') {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator(spec.input).first().setInputFiles(spec.good);
        await page.locator('[data-workspace-surface]').first().waitFor({ state: 'visible', timeout: 60000 });
        await page.waitForTimeout(600);
        let reached = false, steps = 0;
        for (; steps < 60 && !reached; steps++) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => document.activeElement?.matches('[data-workspace-primary]')); }
        if (!reached) row.issues.push('keyboard: run button not reachable within 60 Tabs');
        else {
          row.tabsToRun = steps;
          const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 || s.boxShadow !== 'none'; });
          if (!ring) row.issues.push('keyboard: focused run button shows no focus ring');
        }
      }
      if (errors.length) row.issues.push(`js: ${errors[0]}`);
    } catch (e) { row.issues.push(e.message.split('\n')[0].slice(0, 140)); }
    rows.push(row);
    console.log(`${row.issues.length ? 'ISSUE' : 'ok   '} ${deviceName.padEnd(12)} ${tool.padEnd(18)} ${row.tabsToRun ? `tabs:${row.tabsToRun} ` : ''}${row.issues.join('; ')}${row.issues.length ? '' : ` · "${row.wrongFileMessage}"`}`);
    await page.close();
  }
  await browser.close();
}
await writeFile(`test-results/real-user/basics-${deviceNames.join('_')}.json`, JSON.stringify(rows, null, 1));
console.log(`BASICS: ${rows.filter((r) => !r.issues.length).length}/${rows.length} clean`);
