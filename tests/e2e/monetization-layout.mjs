import { chromium } from 'playwright';
import { ensureAstroServer, baseUrl } from './run-server.mjs';

const executablePath = process.env.SORA_BROWSER_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const widths = [320, 390, 768, 1024, 1440];
const publicPaths = ['/', '/tools/', '/pdf/', '/ja/', '/ja/tools/', '/ja/pdf/', '/privacy/', '/terms/', '/contact/', '/open-source/', '/404.html'];

await ensureAstroServer();
const browser = await chromium.launch({ executablePath });

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();

    for (const path of publicPaths) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const state = await page.evaluate(() => ({
        loaders: document.querySelectorAll('script[src*="acscdn.com"], script[src*="highperformanceformat"], script[src*="effectivecpmnetwork"]').length,
        runtimeText: /runAutoTag|ag86oktn3r/.test(document.documentElement.innerHTML),
        slots: document.querySelectorAll('[data-sf-ad-slot], [data-ad-placement], iframe[data-ad-frame]').length,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }));
      if (state.loaders || state.runtimeText || state.slots) throw new Error(`${width}px ${path}: advertising code or placement remains.`);
      if (state.overflow) throw new Error(`${width}px ${path}: page has horizontal overflow.`);
    }

    await context.close();
    console.log(`Advertising-free layout passed at ${width}px.`);
  }
} finally {
  await browser.close();
}

console.log('Advertising-free layout verification passed.');
