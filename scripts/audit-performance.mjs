import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureAstroServer, baseUrl } from '../tests/e2e/run-server.mjs';

const executablePath = process.env.SORA_BROWSER_PATH;
const scenarios = [
  { name: 'mobile-home', route: '/', width: 390, height: 844 },
  { name: 'mobile-tool', route: '/pdf', width: 390, height: 844 },
  { name: 'desktop-home', route: '/', width: 1440, height: 900 },
  { name: 'desktop-rtl-tool', route: '/ar/pdf-to-word', width: 1440, height: 900 },
];

await ensureAstroServer();
const browser = await chromium.launch({ executablePath });
const results = [];

try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height } });
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') await route.continue();
      else await route.abort();
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__soraPerformance = { lcp: 0, cls: 0, longTasks: [] };
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        window.__soraPerformance.lcp = entries.at(-1)?.startTime ?? window.__soraPerformance.lcp;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__soraPerformance.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__soraPerformance.longTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: true });
    });

    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 80,
      downloadThroughput: 500_000,
      uploadThroughput: 250_000,
      connectionType: 'cellular4g',
    });
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.goto(`${baseUrl}${scenario.route}`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(2_500);
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const resources = performance.getEntriesByType('resource');
      const state = window.__soraPerformance;
      return {
        domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
        loadMs: Math.round(navigation.loadEventEnd),
        firstContentfulPaintMs: Math.round(paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? 0),
        largestContentfulPaintMs: Math.round(state.lcp),
        cumulativeLayoutShift: Number(state.cls.toFixed(4)),
        longTaskCount: state.longTasks.length,
        longTaskTotalMs: Math.round(state.longTasks.reduce((sum, duration) => sum + duration, 0)),
        initialResourceCount: resources.length,
        initialTransferBytes: Math.round((navigation.transferSize || 0) + resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0)),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    results.push({ ...scenario, ...metrics });
    await context.close();
  }
} finally {
  await browser.close();
}

const warnings = results.flatMap((result) =>
  result.largestContentfulPaintMs > 2_500 && result.largestContentfulPaintMs <= 4_000
    ? [`${result.name}: LCP is above the 2500ms good-experience target`]
    : []);
const failures = results.flatMap((result) => {
  const issues = [];
  if (result.largestContentfulPaintMs > 4_000) issues.push('LCP > 4000ms');
  if (result.cumulativeLayoutShift > 0.1) issues.push('CLS > 0.1');
  if (result.horizontalOverflow) issues.push('horizontal overflow');
  return issues.map((issue) => `${result.name}: ${issue}`);
});
const report = {
  measuredAt: new Date().toISOString(),
  method: 'Local production preview, Edge/Chromium, 4× CPU slowdown, 80ms latency, 4Mbps download, third-party requests blocked',
  results,
  warnings,
  failures,
};
await mkdir('.artifacts', { recursive: true });
await writeFile('.artifacts/performance-audit.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
