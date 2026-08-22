import { chromium } from 'playwright';
import { ensureAstroServer, baseUrl } from './run-server.mjs';

const executablePath = process.env.SORA_BROWSER_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const widths = [320, 390, 768, 1024, 1440];
const providerPattern = /effectivecpmnetwork|highperformanceformat/i;

async function revealAdSlots(page) {
  await page.locator('body').dispatchEvent('pointerdown');
  const slots = page.locator('[data-sf-ad-slot]');
  for (let index = 0; index < await slots.count(); index += 1) {
    const slot = slots.nth(index);
    if (await slot.isVisible()) await slot.scrollIntoViewIfNeeded();
    await page.waitForFunction((position) => {
      const element = document.querySelectorAll('[data-sf-ad-slot]')[position];
      return element?.dataset.adReady === 'true';
    }, index);
  }
}

await ensureAstroServer();
const browser = await chromium.launch({ executablePath });

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const providerRequests = [];
    const page = await context.newPage();
    page.on('request', (request) => {
      if (providerPattern.test(request.url())) providerRequests.push(request.url());
    });

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await revealAdSlots(page);

    const home = await page.evaluate(() => {
      const horizontal = document.querySelector('[data-ad-placement="home-primary"]');
      const rectangle = document.querySelector('[data-ad-placement="home-lower-desktop"]');
      const native = document.querySelector('[data-ad-placement="home-secondary"]');
      const host = horizontal?.querySelector('[data-ad-frame-host]');
      const primaryFrame = horizontal?.querySelector('iframe[data-ad-frame]');
      const nativeFrame = native?.querySelector('iframe[data-ad-frame]');
      const box = host?.getBoundingClientRect();
      return {
        slots: document.querySelectorAll('[data-ad-placement]').length,
        frames: document.querySelectorAll('iframe[data-ad-frame]').length,
        selected: horizontal?.dataset.adSelected,
        rectangleSelected: rectangle?.dataset.adSelected,
        rectangleVisible: rectangle ? getComputedStyle(rectangle).display !== 'none' : false,
        horizontalWidth: box?.width ?? 0,
        horizontalHeight: box?.height ?? 0,
        primaryLoading: primaryFrame?.getAttribute('loading'),
        primaryFetchPriority: primaryFrame?.getAttribute('fetchpriority'),
        nativeLoading: nativeFrame?.getAttribute('loading'),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        outOfBounds: [...document.querySelectorAll('[data-ad-frame-host]')].some((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.left < -0.5 || bounds.right > document.documentElement.clientWidth + 0.5;
        }),
        sandboxed: [...document.querySelectorAll('iframe[data-ad-frame]')].every((frame) =>
          frame.getAttribute('sandbox') === 'allow-scripts allow-same-origin allow-forms allow-top-navigation-by-user-activation'),
        testModeIsBlank: [...document.querySelectorAll('iframe[data-ad-frame]')].every((frame) =>
          !frame.hasAttribute('src') && frame.srcdoc.includes('<body style="margin:0">')),
      };
    });

    const desktopHorizontal = width >= 768;
    const desktopRectangle = width >= 1024;
    if (home.slots !== 3) throw new Error(`${width}px home: expected 3 slots, found ${home.slots}`);
    if (home.frames !== (desktopRectangle ? 3 : 2)) throw new Error(`${width}px home: unexpected mounted frame count ${home.frames}`);
    if (home.selected !== (desktopHorizontal ? 'desktop' : 'mobile')) throw new Error(`${width}px home: wrong horizontal selection ${home.selected}`);
    if (home.rectangleSelected !== (desktopRectangle ? 'rectangle' : 'none')) throw new Error(`${width}px home: wrong rectangle state ${home.rectangleSelected}`);
    if (home.rectangleVisible !== desktopRectangle) throw new Error(`${width}px home: rectangle visibility is incorrect`);
    if (Math.round(home.horizontalWidth) !== (desktopHorizontal ? 728 : 320)) throw new Error(`${width}px home: wrong horizontal width ${home.horizontalWidth}`);
    if (Math.round(home.horizontalHeight) !== (desktopHorizontal ? 90 : 50)) throw new Error(`${width}px home: wrong horizontal height ${home.horizontalHeight}`);
    if (home.primaryLoading !== 'eager' || home.primaryFetchPriority !== 'high' || home.nativeLoading !== 'lazy') throw new Error(`${width}px home: ad loading priorities are incorrect`);
    if (home.overflow || home.outOfBounds) throw new Error(`${width}px home: advertising caused horizontal overflow`);
    if (!home.sandboxed || !home.testModeIsBlank) throw new Error(`${width}px home: ad sandbox or automated no-network mode failed`);

    await page.goto(`${baseUrl}/pdf`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await revealAdSlots(page);
    const tool = await page.evaluate(() => {
      const workbench = document.querySelector('#workbench');
      const primary = document.querySelector('[data-ad-placement="tool-after-workbench"]');
      const native = document.querySelector('[data-ad-placement="tool-before-related"]');
      const primaryFrame = primary?.querySelector('iframe[data-ad-frame]');
      const nativeFrame = native?.querySelector('iframe[data-ad-frame]');
      return {
        slots: document.querySelectorAll('[data-ad-placement]').length,
        frames: document.querySelectorAll('iframe[data-ad-frame]').length,
        selected: primary?.dataset.adSelected,
        primaryLoading: primaryFrame?.getAttribute('loading'),
        primaryFetchPriority: primaryFrame?.getAttribute('fetchpriority'),
        nativeLoading: nativeFrame?.getAttribute('loading'),
        followsWorkbench: Boolean(workbench && primary && (workbench.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING)),
        rectangle: document.querySelectorAll('[data-ad-kind="rectangle"]').length,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    if (tool.slots !== 2 || tool.frames !== 2) throw new Error(`${width}px tool: expected 2 isolated ads`);
    if (tool.selected !== (desktopHorizontal ? 'desktop' : 'mobile')) throw new Error(`${width}px tool: wrong horizontal selection ${tool.selected}`);
    if (tool.primaryLoading !== 'eager' || tool.primaryFetchPriority !== 'high' || tool.nativeLoading !== 'lazy') throw new Error(`${width}px tool: ad loading priorities are incorrect`);
    if (!tool.followsWorkbench || tool.rectangle !== 0 || tool.overflow) throw new Error(`${width}px tool: placement or overflow rule failed`);

    await page.goto(`${baseUrl}/privacy`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (await page.locator('[data-ad-placement]').count()) throw new Error(`${width}px privacy: information pages must remain ad-free`);
    if (providerRequests.length) throw new Error(`${width}px: automated verification requested a live provider: ${providerRequests[0]}`);

    await context.close();
    console.log(`Ad layout passed at ${width}px.`);
  }

  const providerContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  await providerContext.route(providerPattern, async (route) => {
    const key = route.request().url().match(/\/([a-f0-9]{32})\/invoke\.js/)?.[1] ?? 'unknown';
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `document.documentElement.dataset.providerBooted = ${JSON.stringify(key)}; document.documentElement.dataset.providerOptions = globalThis.atOptions?.key || 'native';`,
    });
  });
  const providerPage = await providerContext.newPage();
  const frameUnits = [
    ['desktop', '70a4fb276bf6ae0d7991a271ba576aae'],
    ['mobile', '75b5c758697745d4fa0f23560ae6d3d2'],
    ['native', 'e64ba76560a59a8652ea3c5504009c7c'],
    ['rectangle', '620aced0385b8490a1344af907d1d151'],
  ];
  for (const [unit, key] of frameUnits) {
    await providerPage.goto(`${baseUrl}/ad-frame/${unit}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await providerPage.waitForFunction((expected) => document.documentElement.dataset.providerBooted === expected, key);
    const options = await providerPage.locator('html').getAttribute('data-provider-options');
    if (options !== (unit === 'native' ? 'native' : key)) throw new Error(`${unit} frame: provider options did not boot correctly`);
  }
  await providerContext.close();
  console.log('All four provider documents booted with intercepted, non-impression scripts.');
} finally {
  await browser.close();
}

console.log('Monetization layout and provider boot verification passed without requesting or clicking live ads.');
