import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.SORA_BASE_URL ?? 'http://127.0.0.1:4384';
const executablePath = process.env.SORA_BROWSER_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath, headless: true });

const splitState = () => {
  const root = document.querySelector('[data-hero-visualization]');
  const scene = root?.querySelector('[data-scene="split-pdf"]');
  const pages = [...(scene?.querySelectorAll('.sf-split-page') ?? [])].map((page) => {
    const box = page.getBoundingClientRect();
    const styles = getComputedStyle(page);
    return { center: box.x + box.width / 2, opacity: Number(styles.opacity), animation: styles.animationName };
  });
  const input = scene?.querySelector('.sf-split-input');
  return {
    active: root?.dataset.activeScene,
    hidden: scene?.hidden,
    inputOpacity: input ? Number(getComputedStyle(input).opacity) : -1,
    pages,
  };
};

const isSeparated = (state) => state.active === 'split-pdf'
  && state.hidden === false
  && state.pages.length === 3
  && state.pages.every((page) => page.opacity > 0.8)
  && state.pages[1].center - state.pages[0].center > 50
  && state.pages[2].center - state.pages[1].center > 50;

const activate = async (page, sceneId) => {
  await page.locator(`[data-scene-id="${sceneId}"]`).evaluate((button) => button.click());
  await page.waitForFunction((id) => document.querySelector('[data-hero-visualization]')?.dataset.activeScene === id, sceneId);
};

const verifyAnimatedSplit = async (page, label) => {
  await activate(page, 'split-pdf');
  await page.waitForFunction(() => {
    const scene = document.querySelector('[data-scene="split-pdf"]');
    const pages = [...(scene?.querySelectorAll('.sf-split-page') ?? [])];
    if (pages.length !== 3) return false;
    const centers = pages.map((item) => { const box = item.getBoundingClientRect(); return box.x + box.width / 2; });
    return pages.every((item) => Number(getComputedStyle(item).opacity) > 0.8)
      && centers[1] - centers[0] > 50
      && centers[2] - centers[1] > 50;
  }, undefined, { timeout: 4_000 });
  const separated = await page.evaluate(splitState);
  assert.ok(isSeparated(separated), `${label}: Split pages did not separate: ${JSON.stringify(separated)}`);
  assert.deepEqual(separated.pages.map((item) => item.animation), ['sf-hero-split-page', 'sf-hero-split-page', 'sf-hero-split-page']);

  await activate(page, 'rotate-pdf');
  await activate(page, 'split-pdf');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-scene="split-pdf"] .sf-split-input')).opacity) > 0.8, undefined, { timeout: 1_500 });
  const restarted = await page.evaluate(splitState);
  assert.ok(restarted.inputOpacity > 0.8 && restarted.pages.every((item) => item.opacity < 0.2), `${label}: Split did not restart at its input phase: ${JSON.stringify(restarted)}`);
};

const consoleErrors = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const colorScheme of ['light', 'dark']) {
      const label = `${viewport.width}px ${colorScheme}`;
      const context = await browser.newContext({ viewport, colorScheme });
      const page = await context.newPage();
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(`${label}: ${message.text()}`); });
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await verifyAnimatedSplit(page, label);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, `${label}: horizontal overflow`);
      await page.setViewportSize(viewport.width === 1440 ? { width: 390, height: 844 } : { width: 1440, height: 900 });
      await page.waitForTimeout(50);
      const resized = await page.evaluate(splitState);
      assert.ok(resized.pages.length === 3, `${label}: Split scene was lost after resize`);
      await page.goto(`${baseUrl}/about`, { waitUntil: 'domcontentloaded' });
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await verifyAnimatedSplit(page, `${label} back-navigation`);
      await page.goForward({ waitUntil: 'domcontentloaded' });
      assert.match(page.url(), /\/about\/?$/, `${label}: forward navigation did not restore About`);
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await verifyAnimatedSplit(page, `${label} forward/back-navigation`);
      await context.close();
    }
  }

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const state = await page.evaluate(splitState);
    assert.ok(isSeparated(state), `${viewport.width}px reduced motion: static Split result is invalid: ${JSON.stringify(state)}`);
    assert.deepEqual(state.pages.map((item) => item.animation), ['none', 'none', 'none']);
    await page.waitForTimeout(4_200);
    assert.equal(await page.locator('[data-hero-visualization]').getAttribute('data-active-scene'), 'split-pdf', `${viewport.width}px reduced motion: hero auto-advanced`);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  const expected = ['compress-pdf', 'split-pdf', 'rotate-pdf', 'merge-pdf', 'compress-pdf', 'split-pdf', 'rotate-pdf', 'merge-pdf'];
  const observed = [];
  let previous = 'merge-pdf';
  for (const scene of expected) {
    await page.waitForFunction((last) => document.querySelector('[data-hero-visualization]')?.dataset.activeScene !== last, previous, { timeout: 5_000 });
    const active = await page.locator('[data-hero-visualization]').getAttribute('data-active-scene');
    observed.push(active);
    assert.equal(active, scene);
    if (scene === 'split-pdf') {
      await page.waitForFunction(() => {
        const pages = [...document.querySelectorAll('[data-scene="split-pdf"] .sf-split-page')];
        const centers = pages.map((item) => { const box = item.getBoundingClientRect(); return box.x + box.width / 2; });
        return pages.length === 3 && pages.every((item) => Number(getComputedStyle(item).opacity) > 0.8)
          && centers[1] - centers[0] > 50 && centers[2] - centers[1] > 50;
      }, undefined, { timeout: 3_000 });
    }
    previous = active;
  }
  assert.deepEqual(observed, expected);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hiddenScene = await page.locator('[data-hero-visualization]').getAttribute('data-active-scene');
  await page.waitForTimeout(4_200);
  assert.equal(await page.locator('[data-hero-visualization]').getAttribute('data-active-scene'), hiddenScene, 'hidden tab: hero auto-advanced');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction((last) => document.querySelector('[data-hero-visualization]')?.dataset.activeScene !== last, hiddenScene, { timeout: 5_000 });
  await context.close();

  assert.deepEqual(consoleErrors, [], `Serious console errors were reported:\n${consoleErrors.join('\n')}`);
  console.log('MAIN HERO SPLIT PDF PASS: desktop/mobile, light/dark, reduced motion, back/forward navigation, resize, tab visibility, restart, and two automatic cycles.');
} finally {
  await browser.close();
}
