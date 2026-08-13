import { chromium } from 'playwright';
import { ensureAstroServer, baseUrl } from './run-server.mjs';

const browserLaunchOptions = () => process.env.SORA_BROWSER_PATH
  ? { executablePath: process.env.SORA_BROWSER_PATH }
  : {};

const routes = [
  '/',
  '/ar/',
  '/ja/',
  '/pdf-to-word',
  '/ar/pdf-to-word',
  '/about',
  '/contact',
  '/privacy'
];

const widths = [375, 768, 1024, 1440];

const tools = [
  'image-converter', 'compress-image', 'heic-to-jpg', 'pdf', 'merge-pdf',
  'split-pdf', 'rotate-pdf', 'jpg-to-pdf', 'pdf-to-jpg', 'pdf-to-word', 'word-to-pdf'
];

async function runTests() {
  let hasFailures = false;
  
  console.log('Ensuring Astro server is running...');
  await ensureAstroServer();

  console.log('Launching browser...');
  const browser = await chromium.launch(browserLaunchOptions());

  try {
    for (const width of widths) {
      console.log(`\n--- Testing at width ${width}px ---`);
      
      const context = await browser.newContext({
        viewport: { width, height: 800 }
      });
      
      for (const route of routes) {
        const url = `${baseUrl}${route}`;
        const page = await context.newPage();
        
        try {
          console.log(`Testing ${route} at ${width}px...`);
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          
          // Exactly one <h1> element
          const h1Count = await page.locator('h1').count();
          if (h1Count !== 1) {
            console.error(`  FAIL: Expected exactly 1 <h1> on ${route}, found ${h1Count}`);
            hasFailures = true;
          }
          
          // Correct lang attribute
          const htmlLang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
          const expectedLang = route.startsWith('/ar') ? 'ar' : route.startsWith('/ja') ? 'ja' : 'en';
          if (!htmlLang || !htmlLang.startsWith(expectedLang)) {
            console.error(`  FAIL: Expected lang starting with '${expectedLang}' on ${route}, found '${htmlLang}'`);
            hasFailures = true;
          }
          
          // Correct dir attribute
          const htmlDir = await page.evaluate(() => document.documentElement.getAttribute('dir') || 'ltr');
          const expectedDir = route.startsWith('/ar') ? 'rtl' : 'ltr';
          if (htmlDir !== expectedDir) {
            console.error(`  FAIL: Expected dir '${expectedDir}' on ${route}, found '${htmlDir}'`);
            hasFailures = true;
          }
          
          // No horizontal overflow
          const hasHorizontalOverflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
          });
          if (hasHorizontalOverflow) {
            console.error(`  FAIL: Horizontal overflow detected on ${route} at ${width}px`);
            hasFailures = true;
          }
          
          // Working skip link
          const skipLinkCount = await page.locator('a[href="#main"]').count();
          if (skipLinkCount === 0) {
            console.error(`  FAIL: Skip link (a[href="#main"]) not found on ${route}`);
            hasFailures = true;
          }

          // Header theme menu assertions
          const themeMenuCount = await page.locator('[data-theme-menu]').count();
          if (themeMenuCount !== 1) {
            console.error(`  FAIL: Expected 1 [data-theme-menu] on ${route}, found ${themeMenuCount}`);
            hasFailures = true;
          }
          const themeOptionCount = await page.locator('[data-theme-option]').count();
          if (themeOptionCount !== 3) {
            console.error(`  FAIL: Expected 3 [data-theme-option] elements on ${route}, found ${themeOptionCount}`);
            hasFailures = true;
          }

          // Contact page assertions
          if (route === '/contact') {
            const contactFormCount = await page.locator('[data-contact-form]').count();
            if (contactFormCount !== 1) {
              console.error(`  FAIL: Expected 1 [data-contact-form] on ${route}, found ${contactFormCount}`);
              hasFailures = true;
            }
            const contactAttachCount = await page.locator('[data-contact-attachment-disclosure]').count();
            if (contactAttachCount !== 1) {
              console.error(`  FAIL: Expected 1 [data-contact-attachment-disclosure] on ${route}, found ${contactAttachCount}`);
              hasFailures = true;
            }
          }

          // Tool route workbench assertions
          if (route.includes('pdf-to-word') || route.includes('image-converter') || route.includes('compress-image')) {
            const workbenchCount = await page.locator('[data-workbench]').count();
            if (workbenchCount !== 1) {
              console.error(`  FAIL: Expected 1 [data-workbench] on ${route}, found ${workbenchCount}`);
              hasFailures = true;
            }
            const controlsCount = await page.locator('[data-workbench-controls]').count();
            if (controlsCount !== 1) {
              console.error(`  FAIL: Expected 1 [data-workbench-controls] on ${route}, found ${controlsCount}`);
              hasFailures = true;
            }
            const statusCount = await page.locator('[data-workbench-status]').count();
            if (statusCount !== 1) {
              console.error(`  FAIL: Expected 1 [data-workbench-status] on ${route}, found ${statusCount}`);
              hasFailures = true;
            }
            const resultCount = await page.locator('[data-workbench-result]').count();
            if (resultCount !== 1) {
              console.error(`  FAIL: Expected 1 [data-workbench-result] on ${route}, found ${resultCount}`);
              hasFailures = true;
            }
          }
          
          console.log(`  PASS: ${route} at ${width}px`);
        } catch (err) {
          console.error(`  ERROR testing ${route} at ${width}px:`, err.message);
          hasFailures = true;
        } finally {
          await page.close();
        }
      }
      await context.close();
    }
    
    // Test locales with JS disabled
    console.log(`\n--- Testing tool links on homepages with JS disabled ---`);
    const noJsContext = await browser.newContext({ javaScriptEnabled: false });
    const localeRoutes = ['/', '/ar/', '/ja/'];
    
    for (const route of localeRoutes) {
      const url = `${baseUrl}${route}`;
      const page = await noJsContext.newPage();
      
      try {
        console.log(`Testing tool links on ${route} (JS disabled)...`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        
        // Assert all 11 tool links are present in the HTML (crawlable)
        const toolLinksCount = await page.evaluate((tools) => {
          let count = 0;
          for (const tool of tools) {
            if (document.querySelector(`a[href*="/${tool}"]`)) count++;
          }
          return count;
        }, tools);
        
        if (toolLinksCount < tools.length) {
          console.error(`  FAIL: Expected ${tools.length} tool links on ${route}, found ${toolLinksCount}`);
          hasFailures = true;
        }
        
        // Count elements matching exactly [data-tool-card]
        const toolCardsCount = await page.locator('[data-tool-card]').count();
        if (toolCardsCount !== tools.length) {
          console.error(`  FAIL: Expected exactly ${tools.length} [data-tool-card] elements on ${route}, found ${toolCardsCount}`);
          hasFailures = true;
        }

        // Check for live results status element
        const statusCount = await page.locator('[data-tool-results-status]').count();
        if (statusCount === 0) {
          console.error(`  FAIL: Missing [data-tool-results-status] element on ${route}`);
          hasFailures = true;
        }
        
        console.log(`  PASS: JS-disabled tool links on ${route}`);
      } catch (err) {
        console.error(`  ERROR testing JS-disabled tool links on ${route}:`, err.message);
        hasFailures = true;
      } finally {
        await page.close();
      }
    }
    await noJsContext.close();

  } finally {
    console.log('Closing browser...');
    await browser.close();
  }

  if (hasFailures) {
    console.error('\nTests failed.');
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Unhandled error during tests:', err);
  process.exit(1);
});
