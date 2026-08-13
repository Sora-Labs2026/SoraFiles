import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureAstroServer, baseUrl } from './run-server.mjs';

const browserLaunchOptions = process.env.SORA_BROWSER_PATH
  ? { headless: true, executablePath: process.env.SORA_BROWSER_PATH }
  : { headless: true };
const widths = [375, 768, 1024, 1440];
const scenarios = [
  { name: 'English light', route: '/', preference: 'light', direction: 'ltr' },
  { name: 'English dark', route: '/', preference: 'dark', direction: 'ltr' },
  { name: 'Arabic RTL', route: '/ar/', preference: 'light', direction: 'rtl' },
];
const ambientScenarios = [
  { route: '/', mode: 'standard', maxVisible: 5 },
  { route: '/ja/pdf', mode: 'standard', maxVisible: 5 },
  { route: '/ar/image-converter', mode: 'standard', maxVisible: 5 },
  { route: '/about', mode: 'reduced', maxVisible: 2 },
  { route: '/ko/open-source', mode: 'reduced', maxVisible: 2 },
  { route: '/contact', mode: 'off', maxVisible: 0 },
  { route: '/privacy', mode: 'off', maxVisible: 0 },
  { route: '/terms', mode: 'off', maxVisible: 0 },
  { route: '/404', mode: 'off', maxVisible: 0 },
];
const ambientPreferenceLocales = [
  {
    name: 'English',
    route: '/',
    direction: 'ltr',
    labels: { system: 'System', dark: 'Dark', light: 'Light', ambient: 'Ambient bubbles', on: 'On', off: 'Off', suppressed: 'Disabled by system settings' },
  },
  {
    name: 'Arabic',
    route: '/ar/',
    direction: 'rtl',
    labels: { system: 'النظام', dark: 'داكن', light: 'فاتح', ambient: 'فقاعات الخلفية', on: 'مفعّلة', off: 'متوقفة', suppressed: 'معطّلة بسبب إعدادات النظام' },
  },
];
const themePreferences = ['system', 'dark', 'light'];
const ambientPreferences = ['on', 'off'];
const adaptiveConstraints = [
  {
    name: 'reduced motion',
    setup: async (context, page) => page.emulateMedia({ reducedMotion: 'reduce' }),
  },
  {
    name: 'save data',
    setup: async (context) => context.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
    }),
  },
  {
    name: '2GB memory',
    setup: async (context) => context.addInitScript(() => {
      Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 2 });
    }),
  },
  {
    name: '2 hardware threads',
    setup: async (context) => context.addInitScript(() => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 2 });
    }),
  },
];
const densityScenarios = [
  { name: 'standard mobile', route: '/', width: 375, maxVisible: 2 },
  { name: 'standard desktop', route: '/', width: 1024, maxVisible: 5 },
  { name: 'reduced mobile', route: '/about', width: 375, maxVisible: 1 },
  { name: 'reduced desktop', route: '/about', width: 1024, maxVisible: 2 },
];
const responsiveLocales = [
  { name: 'English', route: '/', direction: 'ltr' },
  { name: 'Japanese', route: '/ja/pdf', direction: 'ltr' },
  { name: 'Arabic', route: '/ar/image-converter', direction: 'rtl' },
];
const toolSlugs = [
  'image-converter', 'compress-image', 'heic-to-jpg', 'pdf', 'merge-pdf',
  'split-pdf', 'rotate-pdf', 'jpg-to-pdf', 'pdf-to-jpg', 'pdf-to-word', 'word-to-pdf',
];
const lightGlassByWidth = new Map();
const responsiveFailures = [];
const task8Only = process.env.SORA_DESIGN_SYSTEM_FOCUS === 'task8';
const finalReviewOnly = process.env.SORA_DESIGN_SYSTEM_FOCUS === 'final-review';
const finalReviewCase = process.env.SORA_FINAL_REVIEW_CASE;

async function focusThemeTrigger(page, trigger) {
  for (let index = 0; index < 16; index += 1) {
    await page.keyboard.press('Tab');
    if (await trigger.evaluate((element) => element === document.activeElement)) return;
  }
  assert.fail('Theme trigger was not reachable through keyboard navigation');
}

async function staticPageSnapshot(page) {
  return page.evaluate((knownToolSlugs) => {
    const normalizeText = (element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const links = [...document.querySelectorAll('a[href]')];
    const isToolLink = (href) => knownToolSlugs.some((slug) => new URL(href, location.href).pathname.split('/').filter(Boolean).at(-1) === slug);

    return {
      h1: [...document.querySelectorAll('h1')].map(normalizeText),
      toolLinks: [...new Set(links.filter((link) => isToolLink(link.getAttribute('href') ?? '')).map((link) => link.getAttribute('href')))].sort(),
      faq: [...document.querySelectorAll('#faq summary, #tool-faq-heading, [aria-labelledby="tool-faq-heading"] summary')].map(normalizeText),
      footer: [...document.querySelectorAll('footer a[href]')].map((link) => `${normalizeText(link)}|${link.getAttribute('href')}`).sort(),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((link) => `${link.getAttribute('hreflang')}|${link.getAttribute('href')}`).sort(),
    };
  }, toolSlugs);
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth, `${label}: horizontal overflow (${dimensions.scrollWidth}px > ${dimensions.clientWidth}px)`);
}

async function assertMinimumTarget(locator, label) {
  const box = await locator.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, `${label}: pointer target must be at least 44×44, got ${box?.width ?? 0}×${box?.height ?? 0}`);
}

async function assertOpenMenuReflowsWithoutClipping(page, menu, label) {
  const failures = await menu.evaluate((element, menuLabel) => {
    const viewportWidth = document.documentElement.clientWidth;
    const menuRect = element.getBoundingClientRect();
    const results = [];
    const overflowX = getComputedStyle(element).overflowX;
    if (menuRect.left < -0.5 || menuRect.right > viewportWidth + 0.5) {
      results.push(`${menuLabel}: menu must stay within the document (${menuRect.left}px–${menuRect.right}px of ${viewportWidth}px)`);
    }
    if (element.scrollWidth > element.clientWidth) {
      results.push(`${menuLabel}: menu clips horizontally (${element.clientWidth}px client < ${element.scrollWidth}px scroll)`);
    }
    if (overflowX === 'hidden' || overflowX === 'clip') {
      results.push(`${menuLabel}: menu must not mask content with overflow-${overflowX}`);
    }

    const rows = [...element.querySelectorAll('[role^="menuitem"], a[href]')].filter((row) => row.getClientRects().length > 0);
    for (const [index, row] of rows.entries()) {
      const rowRect = row.getBoundingClientRect();
      if (row.scrollWidth > row.clientWidth) {
        results.push(`${menuLabel}: row ${index + 1} clips horizontally (${row.clientWidth}px client < ${row.scrollWidth}px scroll)`);
      }
      for (const labelElement of [...row.querySelectorAll('span')].filter((candidate) => candidate.getClientRects().length > 0 && candidate.textContent?.trim())) {
        const labelRect = labelElement.getBoundingClientRect();
        if (labelRect.left < rowRect.left - 0.5 || labelRect.right > rowRect.right + 0.5) {
          results.push(`${menuLabel}: label "${labelElement.textContent.trim()}" leaves its row (${labelRect.left}px–${labelRect.right}px vs ${rowRect.left}px–${rowRect.right}px)`);
        }
      }
    }
    return results;
  }, label);
  assert.deepEqual(failures, [], failures.join('\n'));
  await assertNoHorizontalOverflow(page, `${label} open`);
}

await ensureAstroServer();
const browser = await chromium.launch(browserLaunchOptions);

try {
  const runFinalReviewCase = (name) => !finalReviewOnly || !finalReviewCase || finalReviewCase === name;

  if (!task8Only && runFinalReviewCase('type')) {
    for (const { width, display, section } of [
      { width: 375, display: 36, section: 28 },
      { width: 1000, display: 50, section: 30 },
      { width: 1600, display: 72, section: 44 },
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
        const sizes = await page.evaluate(() => {
          const display = document.createElement('h2');
          const section = document.createElement('h3');
          display.className = 'type-display';
          section.className = 'type-section';
          document.body.append(display, section);
          const result = {
            display: Number.parseFloat(getComputedStyle(display).fontSize),
            section: Number.parseFloat(getComputedStyle(section).fontSize),
          };
          display.remove();
          section.remove();
          return result;
        });
        assert.equal(sizes.display, display, `type display clamp boundary at ${width}px`);
        assert.equal(sizes.section, section, `type section clamp boundary at ${width}px`);
      } finally {
        await page.close();
        await context.close();
      }
    }
    console.log('PASS exact semantic type clamps');
  }

  if (!task8Only && runFinalReviewCase('theme')) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    await context.addInitScript(() => localStorage.setItem('sora-theme', 'dark'));
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      const trigger = page.locator('[data-theme-menu] > summary');
      assert.equal(await trigger.getAttribute('aria-label'), 'Theme: Dark', 'persisted theme updates trigger accessible name');
      assert.equal(await trigger.getAttribute('title'), 'Theme: Dark', 'persisted theme updates trigger title');
      await trigger.click();
      await page.locator('[data-theme-option="light"]').click();
      assert.equal(await trigger.getAttribute('aria-label'), 'Theme: Light', 'live theme updates trigger accessible name');
      assert.equal(await trigger.getAttribute('title'), 'Theme: Light', 'live theme updates trigger title');
    } finally {
      await page.close();
      await context.close();
    }
    console.log('PASS theme trigger state text');
  }

  if (!task8Only && runFinalReviewCase('off-preference')) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await context.newPage();
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`${baseUrl}/contact`, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-theme-menu] > summary').click();
      const toggle = page.getByRole('menuitemcheckbox');
      assert.equal(await toggle.getAttribute('aria-checked'), 'true', 'off route keeps saved ambient on preference');
      assert.equal(await toggle.locator('[data-ambient-state-label]').textContent(), 'Disabled by system settings', 'off route reports reduced-motion suppression');
    } finally {
      await page.close();
      await context.close();
    }
    console.log('PASS off-route reduced-motion preference text');
  }

  if (!task8Only && runFinalReviewCase('drag')) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/image-converter`, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-ambient-bubble]').first().waitFor({ state: 'attached', timeout: 4_000 });
      await page.locator('#converter-drop-zone').evaluate((dropZone) => {
        const transfer = new DataTransfer();
        dropZone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        dropZone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      });
      await page.waitForTimeout(50);
      assert.equal(await page.locator('[data-ambient-layer]').getAttribute('data-ambient-state'), 'paused', 'real drag events pause ambient motion');
      await page.locator('#converter-drop-zone').evaluate((dropZone) => {
        dropZone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
      });
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'resuming');
    } finally {
      await page.close();
      await context.close();
    }
    console.log('PASS real drag lifecycle');
  }

  if (!task8Only && runFinalReviewCase('pointer')) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    await context.addInitScript(() => {
      const values = [0, 0, 0.5, 0, 0.5, 0, 0];
      let index = 0;
      Math.random = () => values[index++ % values.length];
    });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/about`, { waitUntil: 'domcontentloaded' });
      const bubble = page.locator('[data-ambient-bubble]').first();
      await bubble.waitFor({ state: 'attached', timeout: 4_000 });
      await page.waitForFunction(() => {
        const candidate = document.querySelector('[data-ambient-bubble]');
        return candidate && Number.parseFloat(getComputedStyle(candidate).opacity) >= 0.12;
      });
      const point = await bubble.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const top = document.elementFromPoint(point.x, point.y);
        if (top?.closest('a,button,input,select,textarea,summary,label,form,[role="button"],[role="link"],[role^="menuitem"],[data-workbench],iframe,ins.adsbygoogle,[data-ad]')) {
          throw new Error(`naturally rendered bubble center is interactive: ${top.tagName}.${top.className}`);
        }
        return point;
      });
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction(() => document.querySelector('[data-ambient-bubble][data-ambient-popping]'));
      const themeTrigger = page.locator('[data-theme-menu] > summary');
      const triggerBox = await themeTrigger.boundingBox();
      assert.ok(triggerBox);
      await page.mouse.click(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2);
      assert.equal(await page.locator('[data-theme-menu]').getAttribute('open'), '', 'functional theme trigger wins hit testing over ambient bubbles');
    } finally {
      await page.close();
      await context.close();
    }
    console.log('PASS real pointer hit testing');
  }

  if (!task8Only && runFinalReviewCase('bfcache')) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      const layer = page.locator('[data-ambient-layer]');
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
      assert.equal(await layer.getAttribute('data-ambient-state'), 'destroyed');
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await page.waitForFunction(() => ['running', 'paused'].includes(document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state')));
      assert.equal(await page.locator('[data-ambient-layer]').count(), 1, 'BFCache restore keeps one ambient layer');
      await page.waitForTimeout(1_650);
      assert.ok(await page.locator('[data-ambient-bubble]').count() <= 5, 'BFCache restore does not duplicate bubble producers');
    } finally {
      await page.close();
      await context.close();
    }
    console.log('PASS BFCache ambient reinitialization');
  }

  if (!finalReviewOnly) {
  if (!task8Only) {
  for (const scenario of scenarios) {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript((preference) => {
        localStorage.setItem('sora-theme', preference);
      }, scenario.preference);
      const page = await context.newPage();

      try {
        await page.goto(`${baseUrl}${scenario.route}`, { waitUntil: 'domcontentloaded' });
        const label = `${scenario.name} at ${width}px`;
        const glass = page.locator('[data-glass-surface="header"]');
        assert.equal(await glass.count(), 1, `${label}: expected one shared header glass surface`);

        const surface = await glass.evaluate((element) => {
          const style = getComputedStyle(element);
          const fallbackProbe = document.createElement('div');
          fallbackProbe.style.background = 'var(--surface-glass-fallback)';
          document.body.append(fallbackProbe);
          const fallbackColor = getComputedStyle(fallbackProbe).backgroundColor;
          fallbackProbe.remove();
          return {
            backgroundColor: style.backgroundColor,
            fallbackColor,
            borderColor: style.borderColor,
            backdropFilter: style.backdropFilter,
            supportsBackdropFilter: CSS.supports('backdrop-filter', 'blur(1px)'),
          };
        });
        assert.notEqual(surface.fallbackColor, 'rgba(0, 0, 0, 0)', `${label}: glass fallback must not be transparent`);
        assert.notEqual(surface.backgroundColor, 'rgba(0, 0, 0, 0)', `${label}: active glass must not be transparent`);
        if (surface.supportsBackdropFilter) {
          assert.match(surface.backdropFilter, /blur\(/, `${label}: supported glass must apply backdrop blur`);
        }
        if (scenario.preference === 'light') {
          lightGlassByWidth.set(width, surface);
        } else if (scenario.preference === 'dark') {
          const lightSurface = lightGlassByWidth.get(width);
          assert.ok(lightSurface, `${label}: light glass reference must exist`);
          assert.notEqual(surface.backgroundColor, lightSurface.backgroundColor, `${label}: dark glass background must differ from light glass`);
          assert.notEqual(surface.fallbackColor, lightSurface.fallbackColor, `${label}: dark glass fallback must differ from light glass`);
          assert.notEqual(surface.borderColor, lightSurface.borderColor, `${label}: dark glass line must differ from light glass`);
        }

        assert.equal(await page.locator('html').getAttribute('dir'), scenario.direction, `${label}: document direction`);
        assert.equal(await page.locator('html').getAttribute('data-theme'), scenario.preference, `${label}: applied theme`);

        const trigger = page.locator('[data-theme-menu] > summary');
        const triggerBox = await trigger.boundingBox();
        assert.ok(triggerBox, `${label}: theme trigger must be visible`);
        assert.ok(triggerBox.width >= 44 && triggerBox.height >= 44, `${label}: theme trigger must be at least 44×44, got ${triggerBox.width}×${triggerBox.height}`);

        await focusThemeTrigger(page, trigger);
        const focus = await trigger.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            focusVisible: element.matches(':focus-visible'),
            outlineStyle: style.outlineStyle,
            outlineWidth: Number.parseFloat(style.outlineWidth),
          };
        });
        assert.equal(focus.focusVisible, true, `${label}: keyboard focus must use :focus-visible`);
        assert.notEqual(focus.outlineStyle, 'none', `${label}: focus outline must be visible`);
        assert.ok(focus.outlineWidth >= 2, `${label}: focus outline must be at least 2px`);

        await trigger.click();
        const themeMenu = page.locator('[data-theme-menu]');
        const menu = themeMenu.locator('[role="menu"]');
        const themeOptions = menu.locator('[data-theme-option]');
        const optionValues = await themeOptions.evaluateAll((options) => options.map((option) => option.getAttribute('data-theme-option')));
        assert.equal(optionValues.length, 3, `${label}: expected exactly 3 theme options`);
        assert.deepEqual(optionValues, ['system', 'dark', 'light'], `${label}: expected System, Dark, and Light theme options in order`);

        const optionBoxes = await themeOptions.evaluateAll((options) => options.map((option) => {
          const rect = option.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }));
        for (const [index, box] of optionBoxes.entries()) {
          if (box.width < 44 || box.height < 44) {
            responsiveFailures.push(`${label}: theme option ${index + 1} must be at least 44×44, got ${box.width}×${box.height}`);
          }
        }

        if (scenario.direction === 'rtl') {
          const [anchorBox, menuBox] = await Promise.all([themeMenu.boundingBox(), menu.boundingBox()]);
          assert.ok(anchorBox && menuBox, `${label}: open RTL theme menu must be measurable`);
          if (width >= 480 && Math.abs(menuBox.x - anchorBox.x) > 1) {
            responsiveFailures.push(`${label}: RTL menu inline-end must align to the anchor's inline-end (${menuBox.x}px !== ${anchorBox.x}px)`);
          }
          if (width < 480 && (Math.abs(menuBox.x - 20) > 1 || Math.abs(menuBox.x + menuBox.width - (width - 20)) > 1)) {
            responsiveFailures.push(`${label}: narrow RTL menu must use symmetric 20px viewport gutters`);
          }
          if (menuBox.x < 0 || menuBox.x + menuBox.width > width) {
            responsiveFailures.push(`${label}: open RTL theme menu must stay within the viewport`);
          }
        }

        const dimensions = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        if (dimensions.scrollWidth > dimensions.clientWidth) {
          responsiveFailures.push(`${label}: horizontal overflow (${dimensions.scrollWidth}px > ${dimensions.clientWidth}px)`);
        }
        console.log(`PASS ${label}`);
      } finally {
        await page.close();
        await context.close();
      }
    }
  }

  for (const typography of [
    { name: 'English Latin', route: '/', expectedTight: true },
    { name: 'Japanese CJK', route: '/ja/pdf', expectedTight: false },
    { name: 'Arabic connected script', route: '/ar/image-converter', expectedTight: false },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${typography.route}`, { waitUntil: 'domcontentloaded' });
      const tracking = await page.evaluate(() => {
        const heading = document.createElement('h2');
        heading.className = 'type-display';
        heading.textContent = 'Typography probe';
        document.body.append(heading);
        const value = getComputedStyle(heading).letterSpacing;
        heading.remove();
        return value;
      });
      if (typography.expectedTight) {
        assert.ok(Number.parseFloat(tracking) < 0, `${typography.name}: Latin display heading keeps restrained tight tracking`);
      } else {
        assert.equal(tracking, 'normal', `${typography.name}: script-sensitive display heading must use normal tracking`);
      }
      console.log(`PASS ${typography.name} heading tracking`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  for (const scenario of ambientScenarios) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    try {
      await page.goto(`${baseUrl}${scenario.route}`, { waitUntil: 'domcontentloaded' });
      const layer = page.locator('[data-ambient-layer]');
      const expectedLayerCount = scenario.mode === 'off' ? 0 : 1;
      assert.equal(await layer.count(), expectedLayerCount, `${scenario.route}: ambient layer count`);

      if (scenario.mode !== 'off') {
        assert.equal(await layer.getAttribute('data-ambient-mode'), scenario.mode, `${scenario.route}: ambient route mode`);
        const layerStyle = await layer.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            position: style.position,
            inset: [style.top, style.right, style.bottom, style.left],
            overflow: style.overflow,
            pointerEvents: style.pointerEvents,
            contain: style.contain,
          };
        });
        assert.equal(layerStyle.position, 'fixed', `${scenario.route}: ambient layer must be fixed`);
        assert.deepEqual(layerStyle.inset, ['0px', '0px', '0px', '0px'], `${scenario.route}: ambient layer must cover the viewport`);
        assert.match(layerStyle.overflow, /clip|hidden/, `${scenario.route}: ambient layer must clip overflow`);
        assert.equal(layerStyle.pointerEvents, 'none', `${scenario.route}: ambient layer must not intercept content`);
        assert.match(layerStyle.contain, /strict/, `${scenario.route}: ambient layer must use strict containment`);

        await page.locator('[data-ambient-bubble]').first().waitFor({ state: 'attached', timeout: 4_000 });
        const bubbleCount = await page.locator('[data-ambient-bubble]').count();
        assert.ok(bubbleCount >= 1 && bubbleCount <= scenario.maxVisible, `${scenario.route}: bounded bubble count`);
      }

      assert.deepEqual(consoleErrors, [], `${scenario.route}: ambient layer must not log console errors`);
      scenario.staticSnapshot = await staticPageSnapshot(page);
      console.log(`PASS ambient ${scenario.route} = ${scenario.mode}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await context.newPage();

    try {
      await page.goto(`${baseUrl}/image-converter`, { waitUntil: 'domcontentloaded' });
      const layer = page.locator('[data-ambient-layer]');
      const bubbles = layer.locator('[data-ambient-bubble]');
      await bubbles.first().waitFor({ state: 'attached', timeout: 4_000 });

      await page.locator('[data-workbench]').evaluate((workbench) => {
        const processing = document.createElement('div');
        processing.dataset.workbenchProcessing = '';
        processing.textContent = 'Processing';
        workbench.append(processing);
      });
      await page.waitForTimeout(50);
      assert.equal(await layer.getAttribute('data-ambient-state'), 'paused', 'ambient lifecycle: visible processing pauses the layer');
      assert.equal(await bubbles.first().evaluate((bubble) => getComputedStyle(bubble).animationPlayState), 'paused', 'ambient lifecycle: pause freezes existing bubble animation');

      await page.locator('[data-workbench]').evaluate((workbench) => {
        workbench.querySelector('[data-workbench-processing]')?.remove();
        const submit = workbench.querySelector('button[type="submit"]');
        if (submit) {
          submit.closest('[hidden]')?.removeAttribute('hidden');
          submit.disabled = true;
        }
      });
      await page.waitForTimeout(50);
      assert.equal(await layer.getAttribute('data-ambient-state'), 'paused', 'ambient lifecycle: a disabled workbench processing button pauses the layer');

      await page.locator('[data-workbench]').evaluate((workbench) => {
        const submit = workbench.querySelector('button[type="submit"]');
        if (submit) submit.disabled = false;
        workbench.setAttribute('aria-busy', 'true');
      });
      await page.waitForTimeout(50);
      assert.equal(await layer.getAttribute('data-ambient-state'), 'paused', 'ambient lifecycle: clearing disabled cannot override aria-busy');

      await page.locator('[data-workbench]').evaluate((workbench) => workbench.removeAttribute('aria-busy'));
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'resuming');
      await page.locator('[data-workbench]').evaluate((workbench) => workbench.setAttribute('data-workbench-drag-active', ''));
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'paused');
      assert.equal(await layer.getAttribute('data-ambient-state'), 'paused', 'ambient lifecycle: marked active workbench drag pauses the layer');

      await page.locator('[data-workbench]').evaluate((workbench) => workbench.removeAttribute('data-workbench-drag-active'));
      await page.evaluate(() => {
        const dialog = document.createElement('dialog');
        dialog.textContent = 'Critical confirmation';
        document.body.append(dialog);
        dialog.showModal();
      });
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'paused');
      assert.equal(await layer.getAttribute('data-ambient-state'), 'paused', 'ambient lifecycle: an open modal pauses the layer');

      await page.evaluate(() => document.querySelector('dialog')?.close());
      await page.locator('#converter-work').evaluate((region) => region.removeAttribute('hidden'));
      await page.locator('[data-workbench-controls]').evaluate((form) => form.setAttribute('data-critical-form', ''));
      await page.locator('[data-workbench-controls] select').first().focus();
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'paused');
      assert.equal(await layer.getAttribute('data-ambient-state'), 'paused', 'ambient lifecycle: focus in a marked critical form pauses the layer');

      await page.locator('[data-workbench-controls] select').first().blur();
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('sora:critical-workflow', { detail: { active: true } })));
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'paused');
      assert.equal(await layer.getAttribute('data-ambient-state'), 'paused', 'ambient lifecycle: explicit critical workflow pauses the layer');

      const resumeStartedAt = Date.now();
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('sora:critical-workflow', { detail: { active: false } })));
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'resuming');
      await page.waitForTimeout(1_850);
      assert.equal(await layer.getAttribute('data-ambient-state'), 'resuming', 'ambient lifecycle: resume remains delayed for at least 2 seconds');
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'running');
      assert.ok(Date.now() - resumeStartedAt >= 2_000, 'ambient lifecycle: running state cannot return before the full resume delay');

      const bubbleCountBeforePop = await bubbles.count();
      const bubble = bubbles.first();
      await page.waitForFunction(() => {
        const candidate = document.querySelector('[data-ambient-bubble]');
        return candidate && Number.parseFloat(getComputedStyle(candidate).opacity) >= 0.12;
      });
      const beforePop = await bubble.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          centerX: rect.x + rect.width / 2,
          centerY: rect.y + rect.height / 2,
          width: rect.width,
          opacity: Number.parseFloat(getComputedStyle(element).opacity),
        };
      });
      assert.equal(await bubble.getAttribute('tabindex'), null, 'ambient pop: decorative bubble stays outside keyboard focus order');
      await bubble.dispatchEvent('pointerup', { pointerType: 'mouse', isPrimary: true });
      await page.waitForFunction(() => document.querySelector('[data-ambient-bubble]')?.hasAttribute('data-ambient-popping'));
      const popStart = await bubble.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          centerX: rect.x + rect.width / 2,
          centerY: rect.y + rect.height / 2,
          opacity: Number.parseFloat(getComputedStyle(element).opacity),
        };
      });
      assert.ok(Math.hypot(popStart.centerX - beforePop.centerX, popStart.centerY - beforePop.centerY) <= 2, 'ambient pop: first frame stays at the rising bubble position');
      assert.ok(popStart.opacity >= beforePop.opacity * 0.8, 'ambient pop: first frame retains the rising bubble opacity');
      const fragments = bubble.locator('[data-ambient-fragment]');
      const fragmentCount = await fragments.count();
      assert.ok(fragmentCount >= 2 && fragmentCount <= 4, `ambient pop: expected 2–4 fragments, got ${fragmentCount}`);
      assert.deepEqual(await fragments.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-hidden'))), Array(fragmentCount).fill('true'), 'ambient pop: every fragment is decorative');
      await page.waitForTimeout(80);
      const popProgress = await bubble.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const fragmentCenters = [...element.querySelectorAll('[data-ambient-fragment]')].map((fragment) => {
          const fragmentRect = fragment.getBoundingClientRect();
          return { x: fragmentRect.x + fragmentRect.width / 2, y: fragmentRect.y + fragmentRect.height / 2 };
        });
        return {
          centerX: rect.x + rect.width / 2,
          centerY: rect.y + rect.height / 2,
          width: rect.width,
          opacity: Number.parseFloat(getComputedStyle(element).opacity),
          fragmentCenters,
        };
      });
      assert.ok(popProgress.width > beforePop.width, 'ambient pop: bubble scales from its captured rendered size');
      assert.ok(popProgress.opacity < popStart.opacity, 'ambient pop: bubble fades from its captured rendered opacity');
      assert.ok(popProgress.fragmentCenters.every(({ x, y }) => Math.hypot(x - popProgress.centerX, y - popProgress.centerY) <= popProgress.width), 'ambient pop: fragments originate around the captured bubble position');
      await page.waitForFunction((count) => document.querySelectorAll('[data-ambient-bubble]').length === count - 1, bubbleCountBeforePop, { timeout: 350 });
      assert.equal(await bubbles.count(), bubbleCountBeforePop - 1, 'ambient pop: one complete bubble subtree is removed within 350ms');

      const pausedBubble = bubbles.first();
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('sora:critical-workflow', { detail: { active: true } })));
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'paused');
      const pausedRect = await pausedBubble.boundingBox();
      await pausedBubble.dispatchEvent('pointerup', { pointerType: 'mouse', isPrimary: true });
      await page.waitForTimeout(80);
      assert.equal(await pausedBubble.getAttribute('data-ambient-popping'), null, 'ambient pop: pointer activation is ignored while paused');
      assert.equal(await pausedBubble.locator('[data-ambient-fragment]').count(), 0, 'ambient pop: pause does not introduce fragments');
      assert.deepEqual(await pausedBubble.boundingBox(), pausedRect, 'ambient pop: paused bubble remains visually frozen');

      await page.evaluate(() => window.dispatchEvent(new CustomEvent('sora:critical-workflow', { detail: { active: false } })));
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'resuming');
      await pausedBubble.dispatchEvent('pointerup', { pointerType: 'mouse', isPrimary: true });
      await page.waitForTimeout(80);
      assert.equal(await pausedBubble.getAttribute('data-ambient-popping'), null, 'ambient pop: pointer activation is ignored during resume delay');
      assert.deepEqual(await pausedBubble.boundingBox(), pausedRect, 'ambient pop: resuming bubble remains visually frozen');

      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'running');
      await pausedBubble.dispatchEvent('pointerup', { pointerType: 'mouse', isPrimary: true });
      await page.waitForFunction(() => document.querySelector('[data-ambient-bubble][data-ambient-popping]'));
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('sora:critical-workflow', { detail: { active: true } })));
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'paused');
      const pausedPop = await pausedBubble.evaluate((element) => ({
        bubble: element.getAnimations()[0]?.currentTime,
        fragments: [...element.querySelectorAll('[data-ambient-fragment]')].map((fragment) => fragment.getAnimations()[0]?.currentTime),
      }));
      await page.waitForTimeout(120);
      const pausedPopAfterWait = await pausedBubble.evaluate((element) => ({
        bubble: element.getAnimations()[0]?.currentTime,
        bubblePlayState: element.getAnimations()[0]?.playState,
        fragments: [...element.querySelectorAll('[data-ambient-fragment]')].map((fragment) => ({ currentTime: fragment.getAnimations()[0]?.currentTime, playState: fragment.getAnimations()[0]?.playState })),
      }));
      assert.equal(pausedPopAfterWait.bubblePlayState, 'paused', 'ambient pop: in-progress bubble animation pauses for critical workflow');
      assert.ok(pausedPopAfterWait.fragments.every(({ playState }) => playState === 'paused'), 'ambient pop: in-progress fragment animations pause for critical workflow');
      assert.equal(pausedPopAfterWait.bubble, pausedPop.bubble, 'ambient pop: paused bubble animation clock does not advance');
      assert.deepEqual(pausedPopAfterWait.fragments.map(({ currentTime }) => currentTime), pausedPop.fragments, 'ambient pop: paused fragment animation clocks do not advance');

      await page.evaluate(() => window.dispatchEvent(new CustomEvent('sora:critical-workflow', { detail: { active: false } })));
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'resuming');
      await page.waitForTimeout(120);
      const resumingPop = await pausedBubble.evaluate((element) => ({
        bubble: element.getAnimations()[0]?.currentTime,
        bubblePlayState: element.getAnimations()[0]?.playState,
        fragments: [...element.querySelectorAll('[data-ambient-fragment]')].map((fragment) => ({ currentTime: fragment.getAnimations()[0]?.currentTime, playState: fragment.getAnimations()[0]?.playState })),
      }));
      assert.equal(resumingPop.bubblePlayState, 'paused', 'ambient pop: bubble remains frozen for the resume delay');
      assert.ok(resumingPop.fragments.every(({ playState }) => playState === 'paused'), 'ambient pop: fragments remain frozen for the resume delay');
      assert.equal(resumingPop.bubble, pausedPop.bubble, 'ambient pop: bubble clock remains frozen for the resume delay');
      assert.deepEqual(resumingPop.fragments.map(({ currentTime }) => currentTime), pausedPop.fragments, 'ambient pop: fragment clocks remain frozen for the resume delay');

      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
      assert.equal(await layer.getAttribute('data-ambient-state'), 'destroyed', 'ambient lifecycle: pagehide marks the layer destroyed');
      assert.equal(await bubbles.count(), 0, 'ambient lifecycle: pagehide empties the layer');
      await page.waitForTimeout(2_100);
      assert.equal(await bubbles.count(), 0, 'ambient lifecycle: destroyed callbacks cannot respawn bubbles');
      console.log('PASS ambient critical workflow lifecycle');
    } finally {
      await page.close();
      await context.close();
    }
  }

  for (const locale of ambientPreferenceLocales) {
    for (const themePreference of themePreferences) {
      for (const ambientPreference of ambientPreferences) {
        const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
        await context.addInitScript(({ themePreference, ambientPreference }) => {
          if (localStorage.getItem('sora-theme') === null) localStorage.setItem('sora-theme', themePreference);
          if (localStorage.getItem('sora-ambient-bubbles') === null) localStorage.setItem('sora-ambient-bubbles', ambientPreference);
          window.__ambientPreferenceEvents = [];
          window.addEventListener('sora:ambient-preference', (event) => {
            window.__ambientPreferenceEvents.push(event.detail?.preference);
          });
        }, { themePreference, ambientPreference });
        const page = await context.newPage();

        try {
          await page.goto(`${baseUrl}${locale.route}`, { waitUntil: 'domcontentloaded' });
          const label = `${locale.name} ${themePreference} theme with ambient ${ambientPreference}`;
          const themeMenu = page.locator('[data-theme-menu]');
          const trigger = themeMenu.locator(':scope > summary');
          assert.equal(await trigger.count(), 1, `${label}: exactly one header theme icon trigger`);
          assert.equal(await trigger.locator('[data-theme-icon]:visible').count(), 1, `${label}: exactly one theme-state icon is visible`);
          assert.equal(await page.locator('html').getAttribute('dir'), locale.direction, `${label}: document direction`);

          await trigger.click();
          const menu = themeMenu.locator('[role="menu"]');
          const themeOptions = menu.locator('[role="menuitemradio"]');
          assert.equal(await themeOptions.count(), 3, `${label}: exactly 3 theme radio choices`);
          assert.deepEqual(await themeOptions.allTextContents(), [locale.labels.system, locale.labels.dark, locale.labels.light], `${label}: localized theme choices remain unchanged`);
          assert.equal(await menu.locator(`[data-theme-option="${themePreference}"]`).getAttribute('aria-checked'), 'true', `${label}: selected theme radio state`);

          const ambientToggle = menu.getByRole('menuitemcheckbox');
          assert.equal(await ambientToggle.count(), 1, `${label}: exactly one ambient checkbox`);
          assert.equal(await ambientToggle.getAttribute('aria-checked'), ambientPreference === 'on' ? 'true' : 'false', `${label}: ambient checkbox state`);
          assert.equal(await ambientToggle.locator('[data-ambient-label]').textContent(), locale.labels.ambient, `${label}: localized ambient label`);
          assert.equal(await ambientToggle.locator('[data-ambient-state-label]').textContent(), locale.labels[ambientPreference], `${label}: localized ambient state label`);
          const toggleBox = await ambientToggle.boundingBox();
          assert.ok(toggleBox && toggleBox.width >= 44 && toggleBox.height >= 44, `${label}: ambient checkbox must be at least 44×44`);

          const ambientLayer = page.locator('[data-ambient-layer]');
          assert.equal(await ambientLayer.getAttribute('data-ambient-state'), ambientPreference === 'on' ? 'running' : 'suppressed', `${label}: persisted preference applies to the ambient layer`);

          await page.evaluate(() => {
            window.__storageWrites = [];
            const setItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key, value) {
              window.__storageWrites.push(key);
              return setItem.call(this, key, value);
            };
          });
          const nextAmbientPreference = ambientPreference === 'on' ? 'off' : 'on';
          await ambientToggle.click();
          assert.equal(await ambientToggle.getAttribute('aria-checked'), nextAmbientPreference === 'on' ? 'true' : 'false', `${label}: checkbox updates immediately`);
          assert.equal(await ambientToggle.locator('[data-ambient-state-label]').textContent(), locale.labels[nextAmbientPreference], `${label}: state text updates immediately`);
          assert.equal(await ambientLayer.getAttribute('data-ambient-state'), nextAmbientPreference === 'on' ? 'running' : 'suppressed', `${label}: ambient layer updates immediately`);
          assert.equal(await page.evaluate(() => localStorage.getItem('sora-ambient-bubbles')), nextAmbientPreference, `${label}: ambient preference persists`);
          assert.equal(await page.evaluate(() => localStorage.getItem('sora-theme')), themePreference, `${label}: ambient interaction does not write theme state`);
          assert.deepEqual(await page.evaluate(() => window.__storageWrites), ['sora-ambient-bubbles'], `${label}: ambient interaction writes only ambient storage`);
          assert.deepEqual(await page.evaluate(() => window.__ambientPreferenceEvents), [nextAmbientPreference], `${label}: one preference event is dispatched with the new value`);

          const nextThemePreference = themePreference === 'light' ? 'system' : 'light';
          await page.evaluate(() => { window.__storageWrites = []; });
          await menu.locator(`[data-theme-option="${nextThemePreference}"]`).click();
          assert.equal(await page.locator('html').getAttribute('data-theme-preference'), nextThemePreference, `${label}: theme radio behavior remains functional`);
          assert.equal(await page.evaluate(() => localStorage.getItem('sora-theme')), nextThemePreference, `${label}: theme preference persists`);
          assert.equal(await page.evaluate(() => localStorage.getItem('sora-ambient-bubbles')), nextAmbientPreference, `${label}: theme interaction does not write ambient state`);
          assert.deepEqual(await page.evaluate(() => window.__storageWrites), ['sora-theme'], `${label}: theme interaction writes only theme storage`);

          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.locator('[data-theme-menu] > summary').click();
          assert.equal(await page.getByRole('menuitemcheckbox').getAttribute('aria-checked'), nextAmbientPreference === 'on' ? 'true' : 'false', `${label}: ambient preference survives reload`);
          console.log(`PASS ambient preference ${label}`);
        } finally {
          await page.close();
          await context.close();
        }
      }
    }
  }

  {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    await context.addInitScript(() => {
      const getItem = Storage.prototype.getItem;
      const setItem = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key) {
        if (key === 'sora-ambient-bubbles') throw new DOMException('Storage unavailable', 'SecurityError');
        return getItem.call(this, key);
      };
      Storage.prototype.setItem = function (key, value) {
        if (key === 'sora-ambient-bubbles') throw new DOMException('Storage unavailable', 'SecurityError');
        return setItem.call(this, key, value);
      };
    });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-theme-menu] > summary').click();
      const ambientToggle = page.getByRole('menuitemcheckbox');
      const ambientLayer = page.locator('[data-ambient-layer]');
      assert.equal(await ambientToggle.getAttribute('aria-checked'), 'true', 'storage failure: ambient defaults on');
      await ambientToggle.click();
      assert.equal(await ambientToggle.getAttribute('aria-checked'), 'false', 'storage failure: checkbox keeps the off preference in memory');
      assert.equal(await ambientLayer.getAttribute('data-ambient-state'), 'suppressed', 'storage failure: layer follows the in-memory off preference');
      await ambientToggle.click();
      assert.equal(await ambientToggle.getAttribute('aria-checked'), 'true', 'storage failure: checkbox keeps the on preference in memory');
      assert.equal(await ambientLayer.getAttribute('data-ambient-state'), 'running', 'storage failure: layer follows the in-memory on preference');
      console.log('PASS ambient preference storage failure');
    } finally {
      await page.close();
      await context.close();
    }
  }

  for (const locale of ambientPreferenceLocales) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await context.newPage();
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`${baseUrl}${locale.route}`, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-theme-menu] > summary').click();
      const ambientToggle = page.getByRole('menuitemcheckbox');
      assert.equal(await ambientToggle.getAttribute('aria-checked'), 'true', `${locale.name} reduced motion: user preference stays checked`);
      assert.equal(await ambientToggle.locator('[data-ambient-state-label]').textContent(), locale.labels.suppressed, `${locale.name} reduced motion: localized system-suppressed state`);
      console.log(`PASS ambient preference ${locale.name} system suppression`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  const noJsContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1024, height: 900 } });
  try {
    for (const scenario of ambientScenarios) {
      const page = await noJsContext.newPage();
      try {
        await page.goto(`${baseUrl}${scenario.route}`, { waitUntil: 'domcontentloaded' });
        assert.equal(await page.locator('[data-ambient-bubble]').count(), 0, `${scenario.route}: no-JS page must have no bubbles`);
        assert.deepEqual(await staticPageSnapshot(page), scenario.staticSnapshot, `${scenario.route}: no-JS static content and search signals must be unchanged`);
        console.log(`PASS ambient no-JS ${scenario.route}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await noJsContext.close();
  }
  }

  {
    const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
    const page = await context.newPage();

    try {
      await page.goto(`${baseUrl}/ar/`, { waitUntil: 'domcontentloaded' });
      const navigationMenu = page.locator('header details:not([data-theme-menu])');
      const navigationTrigger = navigationMenu.locator(':scope > summary');
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      const themeMenu = page.locator('[data-theme-menu]');
      await themeMenu.locator(':scope > summary').click();
      await assertOpenMenuReflowsWithoutClipping(page, themeMenu.locator(':scope > [role="menu"]'), 'Arabic theme menu at 375px/200%');
      await themeMenu.evaluate((menu) => menu.removeAttribute('open'));
      await navigationTrigger.click();
      const [anchorBox, menuBox] = await Promise.all([
        navigationMenu.boundingBox(),
        navigationMenu.locator(':scope > nav').boundingBox(),
      ]);
      assert.ok(anchorBox && menuBox, 'Arabic mobile navigation: open menu must be measurable');
      assert.ok(
        Math.abs(menuBox.x - anchorBox.x) <= 1 || Math.abs(menuBox.x - 20) <= 1,
        `Arabic mobile navigation: logical inline-end or narrow-viewport logical gutter must align (${menuBox.x}px, anchor ${anchorBox.x}px)`,
      );
      assert.ok(menuBox.x >= 0 && menuBox.x + menuBox.width <= 375, 'Arabic mobile navigation: open menu must stay within the viewport');
      await assertOpenMenuReflowsWithoutClipping(page, navigationMenu.locator(':scope > nav'), 'Arabic mobile menu at 375px/200%');
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await assertMinimumTarget(navigationTrigger, 'Arabic icon-only mobile menu trigger');
      console.log('PASS Arabic mobile navigation logical alignment');
    } finally {
      await page.close();
      await context.close();
    }
  }

  {
    const viewport = { width: 375, height: 640 };
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/ar/`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      const navigationMenu = page.locator('header details:not([data-theme-menu])');
      const navigationTrigger = navigationMenu.locator(':scope > summary');
      await navigationTrigger.click();
      const menu = navigationMenu.locator(':scope > nav');
      const verticalLayout = await menu.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: rect.top,
          bottom: rect.bottom,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          overflowY: style.overflowY,
          overscrollBehaviorY: style.overscrollBehaviorY,
        };
      });
      assert.ok(verticalLayout.top >= 0 && verticalLayout.bottom <= viewport.height,
        `Arabic mobile menu at 375×640/200%: scroll container must stay inside the viewport (${verticalLayout.top}px–${verticalLayout.bottom}px)`);
      assert.ok(verticalLayout.scrollHeight > verticalLayout.clientHeight,
        `Arabic mobile menu at 375×640/200%: long content must use internal scrolling (${verticalLayout.scrollHeight}px <= ${verticalLayout.clientHeight}px)`);
      assert.match(verticalLayout.overflowY, /auto|scroll/, 'Arabic mobile menu at 375×640/200%: long content must scroll vertically');
      assert.equal(verticalLayout.overscrollBehaviorY, 'contain', 'Arabic mobile menu at 375×640/200%: internal scrolling must contain overscroll');

      const links = menu.locator('a[href]');
      await navigationTrigger.focus();
      for (let index = 0; index < await links.count(); index += 1) {
        const link = links.nth(index);
        await page.keyboard.press('Tab');
        const focus = await link.evaluate((element) => {
          const menuElement = element.closest('nav');
          const linkRect = element.getBoundingClientRect();
          const menuRect = menuElement.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            active: element === document.activeElement,
            focusVisible: element.matches(':focus-visible'),
            outlineStyle: style.outlineStyle,
            top: linkRect.top,
            bottom: linkRect.bottom,
            visibleTop: menuRect.top,
            visibleBottom: menuRect.bottom,
          };
        });
        assert.equal(focus.active, true, `Arabic mobile menu link ${index + 1}: keyboard focus must be reachable`);
        assert.equal(focus.focusVisible, true, `Arabic mobile menu link ${index + 1}: keyboard focus must be visibly indicated`);
        assert.notEqual(focus.outlineStyle, 'none', `Arabic mobile menu link ${index + 1}: focus outline must remain visible`);
        assert.ok(focus.top >= focus.visibleTop - 0.5 && focus.bottom <= focus.visibleBottom + 0.5,
          `Arabic mobile menu link ${index + 1}: focused link must scroll fully into view`);
      }
      console.log('PASS Arabic short-viewport mobile menu scrolling and keyboard reachability');
    } finally {
      await page.close();
      await context.close();
    }
  }


  for (const locale of responsiveLocales) {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      try {
        const label = `${locale.name} adaptive layout at ${width}px`;
        await page.goto(`${baseUrl}${locale.route}`, { waitUntil: 'domcontentloaded' });
        assert.equal(await page.locator('html').getAttribute('dir'), locale.direction, `${label}: document direction`);
        await assertNoHorizontalOverflow(page, label);
        if (locale.direction === 'rtl') {
          await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
          await assertNoHorizontalOverflow(page, `${label} at 200% text zoom`);
        }
        console.log(`PASS ${label}${locale.direction === 'rtl' ? ' and 200% text zoom' : ''}`);
      } finally {
        await page.close();
        await context.close();
      }
    }
  }

  for (const constraint of adaptiveConstraints) {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await context.newPage();
    try {
      await constraint.setup(context, page);
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1_650);
      assert.equal(await page.locator('[data-ambient-layer]').getAttribute('data-ambient-state'), 'suppressed', `${constraint.name}: layer must fail closed`);
      assert.equal(await page.locator('[data-ambient-bubble]').count(), 0, `${constraint.name}: no bubbles may spawn`);
      console.log(`PASS adaptive suppression ${constraint.name}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  for (const density of densityScenarios) {
    const context = await browser.newContext({ viewport: { width: density.width, height: 900 } });
    await context.addInitScript(() => {
      const values = [0, 0, 1, 0.5, 0.5, 0, 0];
      let index = 0;
      Math.random = () => values[index++ % values.length];
    });
    const page = await context.newPage();
    try {
      await page.clock.install();
      await page.goto(`${baseUrl}${density.route}`, { waitUntil: 'domcontentloaded' });
      await page.clock.runFor(21_000);
      const count = await page.locator('[data-ambient-bubble]').count();
      assert.equal(count, density.maxVisible, `${density.name}: must reach but never exceed the ${density.maxVisible}-bubble density limit`);
      console.log(`PASS density ${density.name} = ${count}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    await context.addInitScript(() => {
      let hidden = false;
      Object.defineProperties(document, {
        hidden: { configurable: true, get: () => hidden },
        visibilityState: { configurable: true, get: () => hidden ? 'hidden' : 'visible' },
      });
      window.__setTestVisibility = (nextHidden) => {
        hidden = nextHidden;
        document.dispatchEvent(new Event('visibilitychange'));
      };
    });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => window.__setTestVisibility(true));
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'paused');
      await page.waitForTimeout(2_100);
      assert.equal(await page.locator('[data-ambient-bubble]').count(), 0, 'hidden document: no catch-up bubble may spawn');
      const visibleAt = Date.now();
      await page.evaluate(() => window.__setTestVisibility(false));
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'resuming');
      await page.waitForTimeout(1_850);
      assert.equal(await page.locator('[data-ambient-layer]').getAttribute('data-ambient-state'), 'resuming', 'visible document: resume stays delayed for at least 2 seconds');
      assert.equal(await page.locator('[data-ambient-bubble]').count(), 0, 'visible document: no burst catch-up before the resume delay');
      await page.waitForFunction(() => document.querySelector('[data-ambient-layer]')?.getAttribute('data-ambient-state') === 'running');
      assert.ok(Date.now() - visibleAt >= 2_000, 'visible document: running state must wait for the full resume delay');
      assert.equal(await page.locator('[data-ambient-bubble]').count(), 1, 'visible document: resumes with exactly one fresh bubble');
      console.log('PASS hidden/visible delayed resume');
    } finally {
      await page.close();
      await context.close();
    }
  }

  {
    const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    await context.addInitScript(() => { Math.random = () => 0.5; });
    const page = await context.newPage();
    try {
      await page.clock.install();
      await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
      await page.clock.runFor(15_000);
      const bubbles = page.locator('[data-ambient-bubble]');
      assert.ok(await bubbles.count() >= 3, 'ambient accessibility: enough bubbles must exist to include a motif');
      assert.equal(await page.locator('[data-ambient-motif]').count(), 1, 'ambient accessibility: deterministic matrix must include one generated motif');
      assert.deepEqual(await bubbles.evaluateAll((nodes) => nodes.map((node) => ({ ariaHidden: node.getAttribute('aria-hidden'), tabIndex: node.getAttribute('tabindex') }))),
        Array(await bubbles.count()).fill({ ariaHidden: 'true', tabIndex: null }),
        'ambient accessibility: every bubble stays hidden from assistive technology and keyboard order');
      assert.equal((await page.locator('[data-ambient-layer]').ariaSnapshot()).trim(), '', 'ambient accessibility: bubbles and generated motif text must be absent from the accessibility snapshot');

      const controls = [
        ['brand link', page.locator('header a').first()],
        ['theme trigger', page.locator('[data-theme-menu] > summary')],
        ['primary tool control', page.locator('main button:visible').first()],
      ];
      for (const [name, control] of controls) {
        const stacking = await control.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          return {
            isTopmost: element === document.elementFromPoint(point.x, point.y) || element.contains(document.elementFromPoint(point.x, point.y)),
            containsBubble: Boolean(element.closest('[data-ambient-layer]')),
          };
        });
        assert.equal(stacking.containsBubble, false, `${name}: functional control must not belong to the ambient layer`);
        assert.equal(stacking.isTopmost, true, `${name}: functional control must remain above ambient bubbles`);
      }
      await assertMinimumTarget(page.locator('[data-theme-menu] > summary'), 'theme trigger');
      await page.locator('[data-theme-menu] > summary').click();
      for (const option of await page.locator('[data-theme-menu] [role^="menuitem"]').all()) {
        await assertMinimumTarget(option, 'theme/ambient menu option');
      }
      await page.locator('[data-theme-menu]').evaluate((menu) => menu.removeAttribute('open'));

      const bubbleElements = await bubbles.elementHandles();
      const focused = [];
      for (let index = 0; index < 32; index += 1) {
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, ambient: Boolean(document.activeElement?.closest?.('[data-ambient-layer]')) }));
        assert.equal(focus.ambient, false, `keyboard step ${index + 1}: focus must never enter ambient bubbles`);
        focused.push(focus.tag);
      }
      assert.ok(focused.includes('A') && focused.includes('SUMMARY') && focused.includes('BUTTON'), 'keyboard order: navigation, menu triggers, and functional controls must remain reachable');
      for (const handle of bubbleElements) await handle.dispose();
      console.log('PASS ambient accessibility, stacking, targets, and keyboard order');
    } finally {
      await page.close();
      await context.close();
    }
  }

  {
    const offRoutes = ['/contact', '/privacy', '/terms', '/404'];
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 1024, height: 900 } });
      try {
        for (const route of offRoutes) {
          const page = await context.newPage();
          try {
            await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
            assert.equal(await page.locator('[data-ambient-layer], [data-ambient-bubble]').count(), 0, `${route} ${javaScriptEnabled ? 'with JS' : 'without JS'}: off routes stay node-free`);
          } finally {
            await page.close();
          }
        }
      } finally {
        await context.close();
      }
    }
    console.log('PASS off routes stay node-free with and without JavaScript');
  }

  {
    const routes = ['/', '/ja/pdf', '/ar/image-converter'];
    for (const width of widths) {
      const noJsContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 } });
      try {
        for (const route of routes) {
          const page = await noJsContext.newPage();
          try {
            await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
            const snapshot = await staticPageSnapshot(page);
            assert.equal(snapshot.h1.length, 1, `${route} no-JS at ${width}px: primary content remains server-rendered`);
            assert.ok(snapshot.toolLinks.length > 0, `${route} no-JS at ${width}px: tool navigation remains server-rendered`);
            assert.ok(snapshot.footer.length > 0, `${route} no-JS at ${width}px: footer navigation remains server-rendered`);
            assert.equal(await page.locator('[data-ambient-bubble]').count(), 0, `${route} no-JS at ${width}px: no bubbles appear`);
            await assertNoHorizontalOverflow(page, `${route} no-JS at ${width}px`);
          } finally {
            await page.close();
          }
        }
      } finally {
        await noJsContext.close();
      }
    }
    console.log('PASS no-JS static content matrix');
  }
  }
} finally {
  await browser.close();
}

if (responsiveFailures.length > 0) {
  throw new AggregateError(responsiveFailures.map((message) => new Error(message)), `${responsiveFailures.length} responsive design-system assertions failed`);
}

console.log('PASS design-system browser checks');
