// Website star ratings: placement, accessibility, pointer and keyboard rating,
// persistence, and tool pages that ask only after a result exists. The rating
// API is mocked here; the real backend is covered by tests/unit/ratings.test.mjs.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { ensureAstroServer, baseUrl } from './run-server.mjs';

await ensureAstroServer();
const browser = await chromium.launch({ executablePath: process.env.SORA_BROWSER_PATH });
const checks = [], errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const store = new Map(), posts = [];
  await context.route('**/__sf/ratings/*', async (route) => {
    const subject = new URL(route.request().url()).pathname.split('/').pop();
    const votes = store.get(subject) ?? new Map(); store.set(subject, votes);
    let userRating = null;
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); posts.push({ subject, ...body });
      if (Number.isInteger(body.rating)) votes.set(body.rater, body.rating);
      userRating = votes.get(body.rater) ?? null;
    }
    const values = [...votes.values()], count = values.length;
    await route.fulfill({ json: { subject, count, average: count ? Math.round((values.reduce((a, b) => a + b, 0) / count) * 100) / 100 : null, distribution: [1, 2, 3, 4, 5].map((n) => values.filter((v) => v === n).length), userRating } });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${baseUrl}/`);
  const section = page.locator('.sf-rating--site');
  await section.waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('[data-testid="desktop-promo"]')?.nextElementSibling?.classList.contains('sf-rating--site')), true, 'directly after the Desktop promo');
  assert.equal(await page.evaluate(() => { const rating = document.querySelector('.sf-rating--site'); const footer = document.querySelector('footer'); return !!(rating && footer && rating.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING); }), true, 'before the footer');
  assert.equal(await section.getByRole('heading', { name: 'Rate SoraFiles' }).count(), 1);
  for (const [n, name] of [[1, '1 star'], [3, '3 stars'], [5, '5 stars']]) assert.equal(await section.getByRole('radio', { name }).getAttribute('value'), String(n));
  assert.equal(await section.locator('.sf-rating__text').innerText(), 'No ratings yet');
  checks.push('Homepage section sits between the Desktop promo and the footer; stars are labelled radios');

  await section.getByRole('radio', { name: '5 stars' }).click();
  await section.getByText('Thanks for rating!').waitFor();
  assert.equal(await section.locator('.sf-rating__text').innerText(), '5.0 out of 5 · 1 rating');
  const rater = await page.evaluate(() => localStorage.getItem('sf-rater-id'));
  assert.match(rater, /^[A-Za-z0-9_-]{32}$/);
  assert.deepEqual(posts.at(-1), { subject: 'sorafiles', rater, rating: 5 });
  checks.push('A click rates immediately, shows thanks and the updated aggregate; anonymous id is random and local');

  await page.reload(); await section.waitFor();
  await page.waitForFunction(() => document.querySelector('.sf-rating--site input[value="5"]')?.checked);
  assert.match(await section.locator('[data-sf-rating-status]').innerText(), /Your rating: 5 of 5/);
  const before = posts.length;
  await section.getByRole('radio', { name: '5 stars' }).focus();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  assert.equal(posts.filter((post) => 'rating' in post).length, posts.slice(0, before).filter((post) => 'rating' in post).length, 'arrows do not submit');
  await page.keyboard.press('Enter');
  await section.getByText('Thanks for rating!').waitFor();
  assert.equal(posts.at(-1).rating, 3);
  assert.equal(await section.locator('.sf-rating__text').innerText(), '3.0 out of 5 · 1 rating', 'changing a rating replaces the earlier one');
  checks.push('Returning visitors see their rating; keyboard arrows choose and Enter changes it');

  await page.goto(`${baseUrl}/compress-image`);
  const tool = page.locator('.sf-rating--tool');
  await tool.waitFor();
  assert.equal(await tool.getByRole('heading', { name: 'Enjoying Compress Image?' }).count(), 1);
  assert.equal(await tool.locator('[data-sf-rating-form]').isHidden(), true, 'no stars before the tool was used');
  assert.equal(await tool.locator('.sf-rating__text').isVisible(), true, 'the aggregate is always visible');
  await page.evaluate(() => { const link = document.createElement('a'); link.download = 'out.jpg'; link.href = URL.createObjectURL(new Blob(['x'])); document.querySelector('#workbench').append(link); });
  await tool.locator('[data-sf-rating-form]').waitFor();
  await tool.getByRole('radio', { name: '4 stars' }).click();
  await tool.getByText('Thanks for rating!').waitFor();
  assert.deepEqual(posts.at(-1), { subject: 'compress-image', rater, rating: 4 });
  checks.push('Tool page asks only after a finished result; tool ratings are separate from the site rating');

  await page.goto(`${baseUrl}/ja/compress-image`);
  await page.locator('.sf-rating--tool').waitFor();
  assert.match(await page.locator('.sf-rating--tool .sf-rating__text').innerText(), /5点中4\.0 · 1件の評価/);
  assert.equal(await page.locator('.sf-rating--tool [data-sf-rating-form]').isVisible(), true, 'already rated: stars shown in any language');
  checks.push('Localized pages show the same shared tool aggregate in their language');

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', checks }, null, 1));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', checks, errors }, null, 1)); throw error;
} finally { await browser.close(); }
process.exit(0);
