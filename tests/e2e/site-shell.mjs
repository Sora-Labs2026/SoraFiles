import { chromium } from 'playwright';
import { ensureAstroServer, baseUrl } from './run-server.mjs';

const executablePath = process.env.SORA_BROWSER_PATH;

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
  'split-pdf', 'rotate-pdf', 'remove-pages', 'watermark-pdf', 'page-numbers', 'sign-pdf',
  'jpg-to-pdf', 'pdf-to-jpg', 'pdf-to-word', 'word-to-pdf', 'edit-image', 'protect-pdf',
  'unlock-pdf', 'repair-pdf', 'metadata-remover', 'pdf-to-excel', 'excel-to-pdf', 'pdf-ocr',
  'resize-image', 'doc-scanner', 'remove-background'
];

async function runTests() {
  let hasFailures = false;
  
  console.log('Ensuring Astro server is running...');
  await ensureAstroServer();

  console.log('Launching browser...');
  const browser = await chromium.launch({ executablePath });

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
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
          
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

          // The preview design exposes paired light/dark controls for desktop and mobile.
          const themeOptionCount = await page.locator('[data-theme-choice]').count();
          if (themeOptionCount !== 4) {
            console.error(`  FAIL: Expected 4 [data-theme-choice] elements on ${route}, found ${themeOptionCount}`);
            hasFailures = true;
          }

          const primaryHeaderCount = await page.locator('[data-testid="site-header"]').count();
          if (primaryHeaderCount !== 1) {
            console.error(`  FAIL: Expected one preview site header on ${route}, found ${primaryHeaderCount}`);
            hasFailures = true;
          }

          const mobileLanguageSelector = page.locator('[data-testid="mobile-language-selector"]');
          const desktopLanguageSelector = page.locator('[data-testid="language-selector"]');
          if (width < 640) {
            if (!(await mobileLanguageSelector.isVisible())) {
              console.error(`  FAIL: Mobile language globe is not visible on ${route} at ${width}px`);
              hasFailures = true;
            }
            if (await desktopLanguageSelector.isVisible()) {
              console.error(`  FAIL: Desktop language selector should be hidden on ${route} at ${width}px`);
              hasFailures = true;
            }
            await mobileLanguageSelector.click();
            const mobileLanguageOptions = await page.locator('[data-testid^="mobile-language-option-"]:visible').count();
            if (mobileLanguageOptions !== 19) {
              console.error(`  FAIL: Expected 19 mobile language choices on ${route}, found ${mobileLanguageOptions}`);
              hasFailures = true;
            }
            await page.keyboard.press('Escape');
          } else if (!(await desktopLanguageSelector.isVisible())) {
            console.error(`  FAIL: Desktop language selector is not visible on ${route} at ${width}px`);
            hasFailures = true;
          }

          if ((route === '/' && (width === 375 || width === 1440)) || (route === '/ja/' && width === 375)) {
            const shareTrigger = page.locator('[data-testid="share-menu-trigger"]');
            if (await shareTrigger.count() !== 1) {
              console.error(`  FAIL: Expected one share control on ${route} at ${width}px`);
              hasFailures = true;
            } else {
              await shareTrigger.evaluate((element) => element.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' }));
              await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
              await shareTrigger.click({ trial: true });
              const shareScrollBefore = await page.evaluate(() => window.scrollY);
              const shareTriggerTopBefore = await shareTrigger.evaluate((element) => element.getBoundingClientRect().top);
              await shareTrigger.click();
              const shareLinks = page.locator('[data-share-target]');
              if (await shareLinks.count() !== 6) {
                console.error(`  FAIL: Expected six lightweight social share links on ${route}`);
                hasFailures = true;
              }
              if (await page.locator('[data-share-copy]').count() !== 1) {
                console.error(`  FAIL: Expected Copy link to remain as the final share action on ${route}`);
                hasFailures = true;
              }
              if (await page.locator('[data-google-preferred-source]').count() !== 0) {
                console.error(`  FAIL: Removed Google Preferred Source action is still present on ${route}`);
                hasFailures = true;
              }
              const unnamedShareLinks = await shareLinks.evaluateAll((links) => links.filter((link) => !(link.getAttribute('aria-label') || link.textContent || '').trim()).length);
              if (unnamedShareLinks !== 0) {
                console.error(`  FAIL: Found ${unnamedShareLinks} social share actions without accessible names on ${route}`);
                hasFailures = true;
              }
              if (await page.locator('[data-share-portal] > [data-share-dismiss]').getAttribute('aria-hidden') !== 'true') {
                console.error(`  FAIL: Pointer-only Share backdrop is exposed as a duplicate close control on ${route}`);
                hasFailures = true;
              }

              const shareState = await page.evaluate(() => {
                const menu = document.querySelector('[data-share-menu]');
                const portal = document.querySelector('[data-share-portal]');
                const panel = document.querySelector('[data-share-panel]');
                const backdrop = document.querySelector('[data-share-portal] > [data-share-dismiss]');
                const xLink = portal?.querySelector('[data-share-target="x"]');
                const hrefs = Array.from(portal?.querySelectorAll('[data-share-target]') ?? []).map((link) => link.href);
                const xUrl = xLink ? new URL(xLink.href) : null;
                const text = xUrl?.searchParams.get('text') ?? '';
                const panelRect = panel?.getBoundingClientRect();
                const backdropRect = backdrop?.getBoundingClientRect();
                return {
                  open: menu?.hasAttribute('open') ?? false,
                  textLength: Array.from(text).length,
                  hasCustomTitle: text.length > 20,
                  validTargets: hrefs.every((href) => href.startsWith('https://') && href !== `${location.origin}/#`),
                  sdkCount: Array.from(document.scripts).filter((script) => /facebook|twitter|threads|reddit|linkedin|whatsapp/i.test(script.src)).length,
                  portalAtBody: portal?.parentElement === document.body,
                  portalCount: document.querySelectorAll('[data-share-portal]').length,
                  panelCount: document.querySelectorAll('[data-share-panel]').length,
                  backdropCount: document.querySelectorAll('[data-share-portal] > [data-share-dismiss]').length,
                  scrollLocked: document.documentElement.dataset.shareScrollLocked === 'true' && document.body.style.position === 'fixed',
                  panelRect: panelRect ? { top: panelRect.top, bottom: panelRect.bottom, left: panelRect.left, right: panelRect.right } : null,
                  backdropRect: backdropRect ? { top: backdropRect.top, bottom: backdropRect.bottom, left: backdropRect.left, right: backdropRect.right } : null,
                };
              });
              if (!shareState.open || !shareState.validTargets || !shareState.hasCustomTitle) {
                console.error(`  FAIL: Share menu did not produce ready-to-use custom share links on ${route}`);
                hasFailures = true;
              }
              if (shareState.textLength > 210) {
                console.error(`  FAIL: X share copy exceeds the 210-character content ceiling (${shareState.textLength})`);
                hasFailures = true;
              }
              if (shareState.sdkCount !== 0) {
                console.error(`  FAIL: Social SDK scripts were loaded by the share menu`);
                hasFailures = true;
              }
              if (!shareState.portalAtBody || shareState.portalCount !== 1 || shareState.panelCount !== 1 || shareState.backdropCount !== 1 || !shareState.scrollLocked) {
                console.error(`  FAIL: Share overlay is not a single body-level, scroll-locked portal (${JSON.stringify(shareState)})`);
                hasFailures = true;
              }
              if (!shareState.panelRect || shareState.panelRect.top < -1 || shareState.panelRect.bottom > 801 || shareState.panelRect.left < -1 || shareState.panelRect.right > width + 1) {
                console.error(`  FAIL: Share panel is outside the intended viewport (${JSON.stringify(shareState.panelRect)})`);
                hasFailures = true;
              }
              if (width === 375 && (!shareState.backdropRect || shareState.backdropRect.top > 1 || shareState.backdropRect.bottom < 799 || shareState.backdropRect.left > 1 || shareState.backdropRect.right < 374)) {
                console.error(`  FAIL: Mobile Share backdrop does not cover the viewport (${JSON.stringify(shareState.backdropRect)})`);
                hasFailures = true;
              }
              if (route === '/ja/' && (await shareTrigger.innerText()).trim() !== '共有') {
                console.error('  FAIL: Japanese share label is not localized');
                hasFailures = true;
              }
              await page.locator('[data-share-panel] [data-share-dismiss]').press('Shift+Tab');
              if (!(await page.evaluate(() => document.activeElement?.hasAttribute('data-share-copy') ?? false))) {
                console.error(`  FAIL: Share focus did not wrap to the final Copy link action on ${route}`);
                hasFailures = true;
              }
              await page.keyboard.press('Escape');
              await page.waitForTimeout(100);
              if (!(await shareTrigger.evaluate((element) => element === document.activeElement))) {
                console.error(`  FAIL: Share trigger did not regain focus after Escape on ${route}`);
                hasFailures = true;
              }
              const closedState = await page.evaluate(() => ({
                hidden: document.querySelector('[data-share-portal]')?.hasAttribute('hidden') ?? false,
                inert: document.querySelector('[data-share-portal]')?.inert ?? false,
                locked: document.documentElement.dataset.shareScrollLocked === 'true' || document.body.style.position === 'fixed',
                scrollY,
                triggerTop: document.querySelector('[data-testid="share-menu-trigger"]')?.getBoundingClientRect().top,
              }));
              if (!closedState.hidden || !closedState.inert || closedState.locked || Math.abs(closedState.scrollY - shareScrollBefore) > 1 || Math.abs((closedState.triggerTop ?? 0) - shareTriggerTopBefore) > 3) {
                console.error(`  FAIL: Share close did not fully restore the page (${JSON.stringify(closedState)})`);
                hasFailures = true;
              }

              const openRect = async () => {
                await shareTrigger.click();
                await page.waitForTimeout(250);
                return page.locator('[data-share-panel]').evaluate((panel) => {
                  const rect = panel.getBoundingClientRect();
                  return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
                });
              };
              const secondRect = await openRect();
              await page.locator('[data-share-panel] [data-share-dismiss]').click();
              await page.waitForTimeout(100);
              const secondClosed = await page.evaluate(() => document.querySelector('[data-share-portal]')?.hasAttribute('hidden') && !document.documentElement.hasAttribute('data-share-scroll-locked'));
              const thirdRect = await openRect();
              if (width === 375) await page.locator('[data-share-portal] > [data-share-dismiss]').click({ position: { x: 4, y: 4 } });
              else await page.keyboard.press('Escape');
              await page.waitForTimeout(100);
              const thirdClosed = await page.evaluate(() => document.querySelector('[data-share-portal]')?.hasAttribute('hidden') && document.documentElement.dataset.shareScrollLocked !== 'true' && document.body.style.position !== 'fixed');
              const rectDelta = Math.max(...['top', 'bottom', 'left', 'right'].map((key) => Math.abs(secondRect[key] - thirdRect[key])));
              if (!secondClosed || !thirdClosed || rectDelta > 1) {
                console.error(`  FAIL: Share second/third-open lifecycle did not reset cleanly (${JSON.stringify({ secondClosed, thirdClosed, rectDelta, secondRect, thirdRect })})`);
                hasFailures = true;
              }
              await page.evaluate(() => scrollTo(0, 0));
              await page.waitForTimeout(200);
            }
          }

          if (route === '/') {
            const headerText = await page.locator('header').textContent();
            for (const label of ['All Tools', 'Compress PDF', 'Merge PDF', 'Split PDF', 'PDF to Word', 'Rotate PDF', 'More']) {
              if (!headerText.includes(label)) {
                console.error(`  FAIL: Missing header navigation label ${label}`);
                hasFailures = true;
              }
            }
            for (const prohibited of ['Upgrade', 'Pricing']) {
              if (headerText.includes(prohibited)) {
                console.error(`  FAIL: Prohibited paid header control ${prohibited} found`);
                hasFailures = true;
              }
            }

            const trustIcons = await page.locator('[data-testid="trust-strip"] [data-trust-icon]').count();
            if (trustIcons !== 5) {
              console.error(`  FAIL: Expected the five preview trust icons, found ${trustIcons}`);
              hasFailures = true;
            }

            const featureIcons = await page.locator('[data-testid="feature-strip"] [data-feature-icon]').count();
            if (featureIcons !== 5) {
              console.error(`  FAIL: Expected the five preview feature icons, found ${featureIcons}`);
              hasFailures = true;
            }

            const pipelineParticles = await page.locator('[data-testid="processing-flow"] .sf-flow-particle').count();
            if (pipelineParticles !== 6) {
              console.error(`  FAIL: Expected six preview pipeline particles, found ${pipelineParticles}`);
              hasFailures = true;
            }

            if (width === 1440) {
              const pipelineAnimations = await page.locator('[data-testid="processing-flow"]').evaluate(() => {
                const state = (selector) => {
                  const element = document.querySelector(selector);
                  if (!element) return null;
                  const styles = getComputedStyle(element);
                  return { name: styles.animationName, duration: styles.animationDuration };
                };
                return {
                  input: state('[data-testid="panel-flow-input"]'),
                  progress: state('[data-testid="processing-progress-fill"]'),
                  gate: state('.sf-flow-gate'),
                  output: state('[data-testid="panel-flow-output"]'),
                  success: state('.sf-success-check'),
                  ready: state('.sf-ready-pulse'),
                };
              });
              for (const [stage, animation] of Object.entries(pipelineAnimations)) {
                if (!animation || animation.name === 'none') {
                  console.error(`  FAIL: Missing preview pipeline animation for ${stage}`);
                  hasFailures = true;
                }
              }
              for (const stage of ['progress', 'gate', 'output', 'success', 'ready']) {
                if (pipelineAnimations[stage]?.duration !== '4.4s') {
                  console.error(`  FAIL: ${stage} is not synchronized to the preview 4.4s master cycle`);
                  hasFailures = true;
                }
              }

              const marquee = page.locator('.marquee-track');
              const animationName = await marquee.evaluate((element) => getComputedStyle(element).animationName);
              const before = await marquee.evaluate((element) => getComputedStyle(element).transform);
              await page.waitForTimeout(700);
              const after = await marquee.evaluate((element) => getComputedStyle(element).transform);
              if (animationName === 'none' || before === after) {
                console.error(`  FAIL: Editorial marquee is not moving (animation=${animationName}, before=${before}, after=${after})`);
                hasFailures = true;
              }

              const localPanel = page.locator('[data-testid="local-processing-panel"]');
              await localPanel.scrollIntoViewIfNeeded();
              await page.waitForTimeout(300);
              const motionState = await page.evaluate(() => ({
                heroPaused: document.querySelector('[data-hero-visualization]')?.getAttribute('data-motion-paused'),
                localPaused: document.querySelector('[data-testid="local-processing-panel"]')?.closest('[data-motion-region]')?.getAttribute('data-motion-paused'),
              }));
              if (motionState.heroPaused !== 'true' || motionState.localPaused !== 'false') {
                console.error(`  FAIL: Off-screen motion was not paused correctly (${JSON.stringify(motionState)})`);
                hasFailures = true;
              }
              await page.evaluate(() => scrollTo(0, 0));
              await page.waitForTimeout(300);
              if (await page.locator('[data-hero-visualization]').getAttribute('data-motion-paused') !== 'false') {
                console.error('  FAIL: Hero motion did not resume after returning on screen');
                hasFailures = true;
              }
            }
          }

          if (route === '/' || route === '/ar/' || route === '/ja/') {
            const shellLandmarks = [
              '[data-testid="hero-section"]',
              '[data-hero-visualization]',
              '[data-testid="trust-strip"]',
              '[data-testid="local-processing-panel"]',
              '[data-testid="feature-strip"]',
              '[data-live-tool-search]',
            ];

            for (const selector of shellLandmarks) {
              const count = await page.locator(selector).count();
              if (count !== 1) {
                console.error(`  FAIL: Expected 1 ${selector} on ${route}, found ${count}`);
                hasFailures = true;
              }
            }

            if (route === '/' && (width === 375 || width === 1440)) {
              const searchInput = page.locator('[data-testid="hero-search-input"]');
              const searchSubmit = page.locator('[data-testid="hero-search-submit"]');
              if (await searchSubmit.count() !== 1) {
                console.error(`  FAIL: Search submit control is missing at ${width}px`);
                hasFailures = true;
              } else {
                await searchInput.fill('merge');
                const scrollBeforeSubmit = await page.evaluate(() => scrollY);
                await searchInput.press('Enter');
                await page.waitForTimeout(1_200);
                const scrollAfterEnter = await page.evaluate(() => scrollY);
                const mergeResultVisible = await page.locator('[data-tool-search-item][data-search*="merge-pdf"]:visible').count();
                if (scrollAfterEnter <= scrollBeforeSubmit || mergeResultVisible !== 1) {
                  console.error(`  FAIL: Enter did not scroll to the expected filtered result at ${width}px`);
                  hasFailures = true;
                }

                await page.evaluate(() => scrollTo(0, 0));
                await page.waitForTimeout(200);
                await searchInput.fill('rotate');
                await searchSubmit.click();
                await page.waitForTimeout(1_200);
                const scrollAfterClick = await page.evaluate(() => scrollY);
                const rotateResultVisible = await page.locator('[data-tool-search-item][data-search*="rotate-pdf"]:visible').count();
                if (scrollAfterClick <= 0 || rotateResultVisible !== 1) {
                  console.error(`  FAIL: Search arrow did not reach the expected filtered result at ${width}px (scroll=${scrollAfterClick}, rotate=${rotateResultVisible})`);
                  hasFailures = true;
                }
              }
            }

            const prohibitedClaims = ['4.9/5', '10K+ users', '50+ Tools', 'SEO & GEO Ready', '-86%', '98%'];
            const bodyText = await page.locator('body').innerText();
            for (const claim of prohibitedClaims) {
              if (bodyText.includes(claim)) {
                console.error(`  FAIL: Prohibited reference-only claim ${claim} found on ${route}`);
                hasFailures = true;
              }
            }
          }

          // Contact page assertions
          if (route === '/contact') {
            const contactFormCount = await page.locator('[data-contact-form]').count();
            if (contactFormCount !== 1) {
              console.error(`  FAIL: Expected 1 [data-contact-form] on ${route}, found ${contactFormCount}`);
              hasFailures = true;
            }
            const contactAttachCount = await page.locator('[data-contact-file]').count();
            if (contactAttachCount !== 1) {
              console.error(`  FAIL: Expected 1 contact attachment input on ${route}, found ${contactAttachCount}`);
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
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        
        // Assert all public tool links are present in the HTML (crawlable)
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
