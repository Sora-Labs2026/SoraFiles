// Real-user size targets outside Resize: "under 50 KB" photos, "under 100 KB" PDFs, 300 DPI page images.
import { webkit, devices } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base = process.env.SORA_BASE_URL ?? 'http://127.0.0.1:4396';
const qa = (name) => `tests/fixtures/sorafiles-qa/${name}`;
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices['iPhone 15'], acceptDownloads: true, serviceWorkers: 'block' });
await context.route((url) => /^https?:$/.test(url.protocol) && url.hostname !== '127.0.0.1', (route) => route.abort());
const page = await context.newPage();
const results = [];

const open = async (tool, fixture) => {
  await page.goto(`${base}/${tool}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('input[type=file]').first().setInputFiles(fixture);
  const options = page.locator('[data-workspace-mobile-nav] [data-mobile-panel="inspector"]');
  await options.waitFor({ state: 'visible', timeout: 30000 });
  await options.click();
};
const download = async (run, link, result) => {
  await page.locator(run).click();
  await page.locator(result).waitFor({ state: 'visible', timeout: 120000 });
  const [file] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator(link).click()]);
  return new Uint8Array(await readFile(await file.path()));
};
const jpegDims = (bytes) => {
  let at = 2;
  while (at < bytes.length) { const marker = bytes[at + 1], len = (bytes[at + 2] << 8) | bytes[at + 3]; if (marker >= 0xc0 && marker <= 0xc3) return [(bytes[at + 7] << 8) | bytes[at + 8], (bytes[at + 5] << 8) | bytes[at + 6]]; at += 2 + len; }
  return null;
};

try {
  // 1. Compress image, JPG under 50 KB: quality search only, slider switches to Automatic.
  await open('compress-image', qa('landscape.jpg'));
  await page.locator('#max-file-size').fill('50');
  assert.equal(await page.locator('#compression-strength').isDisabled(), true);
  const jpg = await download('#process-file', '#download-result', '#result-state');
  assert.ok(jpg.length <= 50_000, `jpg ${jpg.length}`);
  const jpgNote = await page.locator('#result-warning').textContent();
  assert.match(jpgNote, /under the 50 KB limit/);
  results.push(`compress JPG ${jpg.length} B ≤ 50 KB (${jpegDims(jpg)?.join('×')})`);

  // 2. Compress image, PNG under 2 KB: oxipng alone reaches ~4 KB (lossless), so pixels must shrink.
  await open('compress-image', qa('landscape.png'));
  await page.locator('#max-file-size').fill('2');
  const png = await download('#process-file', '#download-result', '#result-state');
  assert.ok(png.length <= 2_000, `png ${png.length}`);
  assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47]);
  const pngNote = await page.locator('#result-warning').textContent();
  assert.match(pngNote, /Made \d+ × \d+/);
  results.push(`compress PNG ${png.length} B ≤ 2 KB, ${pngNote.match(/Made ([^ ]+ × [^ ]+)/)[1]}`);

  // 3. Compress PDF, scanned pages under 60 KB: stronger profiles until it fits.
  await open('pdf', qa('mixed-content.pdf'));
  await page.locator('#pdf-max-size-unit').selectOption('KB');
  await page.locator('#pdf-max-size').fill('60');
  const pdf = await download('#pdf-process', '#pdf-download', '#pdf-result');
  const pdfNote = await page.locator('#pdf-result-warning').textContent();
  assert.equal(new TextDecoder().decode(pdf.subarray(0, 5)), '%PDF-');
  assert.ok(pdf.length <= 60_000, `pdf ${pdf.length} · ${pdfNote}`);
  assert.match(pdfNote, /under the 60 KB limit/);
  results.push(`compress PDF ${pdf.length} B · ${pdfNote}`);

  // 4. Compress PDF, selectable text under 1 KB: impossible, explained honestly.
  await open('pdf', qa('native-text-3-pages.pdf'));
  await page.locator('#pdf-max-size-unit').selectOption('KB');
  await page.locator('#pdf-max-size').fill('1');
  await download('#pdf-process', '#pdf-download', '#pdf-result');
  assert.match(await page.locator('#pdf-result-warning').textContent(), /could not safely get below 1 KB/);
  results.push('native-text PDF limit miss explained');

  // 4b. Default Compress PDF (no limit). The scanned fixture holds flat lossless art that JPEG cannot beat,
  // so it only gets the structural pass; a text+photo PDF shrinks; text-only stays text.
  for (const [fixture, expectSmaller] of [['scanned-document.pdf', 'not-bigger'], ['mixed-content.pdf', true], ['native-text-3-pages.pdf', false]]) {
    await open('pdf', qa(fixture));
    const out = await download('#pdf-process', '#pdf-download', '#pdf-result');
    const stats = await page.locator('#pdf-result-stats').textContent();
    const note = await page.locator('#pdf-result-warning').textContent();
    const before = (await readFile(qa(fixture))).length;
    if (expectSmaller === 'not-bigger') assert.ok(out.length <= before, `${fixture}: ${before} → ${out.length}`);
    else if (expectSmaller) assert.ok(out.length < before * 0.9, `${fixture}: ${before} → ${out.length} · ${note}`);
    else assert.match(note, /Selectable text was detected and preserved/);
    results.push(`default ${fixture}: ${before} → ${out.length} B · ${stats}`);
  }

  // 5. PDF to JPG at 300 DPI: JFIF density says 300 and pixels match A4/Letter at 300.
  await open('pdf-to-jpg', qa('native-text-3-pages.pdf'));
  await page.locator('#jpg-resolution').selectOption('4.1667');
  await page.locator('#pdf-image-pages').fill('1');
  const pageJpg = await download('#action-process', '#action-download', '#action-result');
  assert.deepEqual([...pageJpg.subarray(13, 18)], [1, 1, 44, 1, 44]);
  const dims = jpegDims(pageJpg);
  assert.ok(dims[0] >= 2400 && dims[0] <= 2600, `width ${dims}`);
  results.push(`pdf-to-jpg 300 DPI ${dims.join('×')}`);

  console.log(`SIZE LIMITS PASS\n- ${results.join('\n- ')}`);
} catch (error) {
  console.log(`SIZE LIMITS FAIL after:\n- ${results.join('\n- ')}`);
  throw error;
} finally { await browser.close(); }
