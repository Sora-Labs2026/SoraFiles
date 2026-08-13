import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureAstroServer, baseUrl } from './run-server.mjs';

const browserLaunchOptions = process.env.SORA_BROWSER_PATH
  ? { headless: true, executablePath: process.env.SORA_BROWSER_PATH }
  : { headless: true };

const routes = [
  { path: '/', locale: 'en', prefix: '', direction: 'ltr', forbiddenHeroText: /(?:choose|select)\s+(?:a\s+)?(?:file|image)|drop\s+(?:a\s+)?(?:file|image)/iu },
  { path: '/es/', locale: 'es', prefix: '/es', direction: 'ltr', forbiddenHeroText: /(?:elegir|seleccionar|escoger)\s+(?:un(?:a)?\s+)?(?:archivo|imagen)|(?:arrastra|suelta)\s+(?:un(?:a)?\s+)?(?:archivo|imagen)/iu },
  { path: '/ja/', locale: 'ja', prefix: '/ja', direction: 'ltr', forbiddenHeroText: /(?:ファイル|画像)(?:を)?(?:選択|選ぶ|ドラッグ|ドロップ)/u },
  { path: '/ar/', locale: 'ar', prefix: '/ar', direction: 'rtl', forbiddenHeroText: /(?:اختر|اختيار|اسحب|أفلت)\s+(?:ملف(?:ًا)?|صورة)/u },
];

const popularWorkflows = [
  { slug: 'compress-pdf', path: '/pdf' },
  { slug: 'compress-image', path: '/compress-image' },
  { slug: 'image-converter', path: '/image-converter' },
  { slug: 'merge-pdf', path: '/merge-pdf' },
  { slug: 'pdf-to-jpg', path: '/pdf-to-jpg' },
  { slug: 'jpg-to-pdf', path: '/jpg-to-pdf' },
];

const expectedTitle = 'Sora Files | Instant, Free PDF & Image Tools';
const expectedDescription = 'Use instant, free PDF and image tools in your browser. Compress, convert, merge, split, and resize files locally with no account or watermark.';
const expectedKeywords = 'compress PDF no upload, private PDF compressor, merge PDF local, split PDF without uploading, image converter, compress image online free, HEIC to JPG, PDF to image, image to PDF';
const expectedTools = [
  { name: 'Image Converter', url: 'https://sorafiles.com/image-converter' },
  { name: 'Compress Images', url: 'https://sorafiles.com/compress-image' },
  { name: 'HEIC to JPG', url: 'https://sorafiles.com/heic-to-jpg' },
  { name: 'Compress PDF', url: 'https://sorafiles.com/pdf' },
  { name: 'Merge PDF', url: 'https://sorafiles.com/merge-pdf' },
  { name: 'Split PDF', url: 'https://sorafiles.com/split-pdf' },
  { name: 'Rotate PDF', url: 'https://sorafiles.com/rotate-pdf' },
  { name: 'JPG to PDF', url: 'https://sorafiles.com/jpg-to-pdf' },
  { name: 'PDF to JPG', url: 'https://sorafiles.com/pdf-to-jpg' },
  { name: 'PDF to Word', url: 'https://sorafiles.com/pdf-to-word' },
  { name: 'Word to PDF', url: 'https://sorafiles.com/word-to-pdf' },
];
const expectedToolSlugs = [
  'image-converter',
  'compress-image',
  'heic-to-jpg',
  'compress-pdf',
  'merge-pdf',
  'split-pdf',
  'rotate-pdf',
  'jpg-to-pdf',
  'pdf-to-jpg',
  'pdf-to-word',
  'word-to-pdf',
];
const requiredHeadingIds = [
  'popular-workflows-heading',
  'tools-heading',
  'privacy-architecture-heading',
  'process-flow-heading',
  'tool-faq-heading',
];

const failures = [];
const responsiveWidths = [375, 768, 1024, 1440];
const themes = ['light', 'dark'];

const visibleToolHrefs = (page) => page.locator('[data-tool-wrapper]:visible a[data-tool-card]').evaluateAll((links) => (
  links.map((link) => link.getAttribute('href'))
));

const waitForLayout = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

const collectRuntimeErrors = (page) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
};

async function assertDocumentStartKeyboardOrder(page, route, { empty = false } = {}) {
  assert.ok(['BODY', 'HTML'].includes(await page.evaluate(() => document.activeElement?.tagName ?? '')), 'Tab traversal did not begin at the document start');

  const expected = [
    'hero',
    ...popularWorkflows.map(({ slug }) => `popular:${slug}`),
    'search',
    'example:0',
    'example:1',
    'example:2',
    'filter:all',
    'filter:compress',
    'filter:convert',
    'filter:organize',
    'filter:image',
    ...(empty ? ['clear'] : expectedToolSlugs.map((slug) => `tool:${slug}`)),
  ];
  const encountered = [];
  let reachedFooter = false;
  let emptyQueryEntered = false;

  for (let press = 0; press < 120 && !reachedFooter; press += 1) {
    await page.keyboard.press('Tab');
    const state = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return null;
      const allExamples = [...document.querySelectorAll('[data-tool-search-example]')];
      let token = null;
      if (element.matches('[data-home-hero] a[href="#all-tools"]')) token = 'hero';
      else if (element.matches('[data-popular-workflow]')) token = `popular:${element.dataset.toolSlug}`;
      else if (element.matches('[data-tool-search-input]')) token = 'search';
      else if (element.matches('[data-tool-search-example]')) token = `example:${allExamples.indexOf(element)}`;
      else if (element.matches('[data-tool-filter]')) token = `filter:${element.dataset.toolFilter}`;
      else if (element.matches('[data-tool-clear]')) token = 'clear';
      else if (element.matches('a[data-tool-card]')) token = `tool:${element.dataset.toolSlug}`;
      const styles = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const rowRect = element.matches('[data-tool-filter]') ? element.parentElement?.getBoundingClientRect() : null;
      return {
        token,
        footer: Boolean(element.closest('footer')),
        visible: element.getClientRects().length > 0,
        focusVisible: element.matches(':focus-visible'),
        outlineStyle: styles.outlineStyle,
        boxShadow: styles.boxShadow,
        width: rect.width,
        height: rect.height,
        chipVisible: rowRect ? rect.left >= rowRect.left - 1 && rect.right <= rowRect.right + 1 : true,
      };
    });
    assert.ok(state?.visible, `Tab ${press + 1} landed on a hidden target`);
    reachedFooter = Boolean(state.footer);
    if (!state.token) continue;
    assert.notEqual(encountered.at(-1), state.token, `keyboard focus trapped on ${state.token}`);
    encountered.push(state.token);
    assert.equal(state.focusVisible, true, `${state.token} does not match :focus-visible`);
    assert.ok(state.outlineStyle !== 'none' || state.boxShadow !== 'none', `${state.token} has no visible focus treatment`);
    assert.ok(state.width >= 44, `${state.token} width was ${state.width}`);
    assert.ok(state.height >= 44, `${state.token} height was ${state.height}`);
    if (state.token === 'filter:image') assert.equal(state.chipVisible, true, 'focused final category chip remained clipped');
    if (empty && state.token === 'search' && !emptyQueryEntered) {
      await page.keyboard.type('sora-no-matching-tool-xyz');
      emptyQueryEntered = true;
    }
  }

  assert.equal(reachedFooter, true, `${route.path} Tab traversal did not reach the footer within the bounded sequence`);
  assert.deepEqual(encountered, expected, `${route.path} focusable discovery targets were skipped, duplicated, or reordered`);
}

async function assertResponsiveSurface(page, route, width) {
  await page.setViewportSize({ width, height: 1100 });
  await waitForLayout(page);

  const layout = await page.evaluate(() => {
    const headings = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')];
    const headingLevels = headings.map((heading) => Number(heading.tagName.slice(1)));
    const requiredHeadingIds = ['popular-workflows-heading', 'tools-heading', 'privacy-architecture-heading', 'process-flow-heading', 'tool-faq-heading'];
    const sectionHeadings = requiredHeadingIds.map((id) => document.getElementById(id));
    const viewportInteractive = [...document.querySelectorAll(
      '[data-home-workspace] a[href], [data-home-workspace] button:not(:disabled), [data-home-workspace] input:not(:disabled)',
    )].filter((element) => element.getClientRects().length > 0).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
        width: rect.width,
        height: rect.height,
      };
    });
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      h1Count: document.querySelectorAll('main h1').length,
      headingLevels,
      requiredHeadingTags: sectionHeadings.map((heading) => heading?.tagName ?? null),
      sectionHeadingsOrdered: sectionHeadings.every((heading, index) => (
        index === 0 || Boolean(sectionHeadings[index - 1]?.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)
      )),
      h1BeforeSections: sectionHeadings.every((heading) => Boolean(
        document.querySelector('main h1')?.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING
      )),
      viewportInteractive,
    };
  });

  assert.ok(layout.scrollWidth <= layout.clientWidth, `${route.path} overflowed by ${layout.scrollWidth - layout.clientWidth}px at ${width}px`);
  assert.equal(layout.h1Count, 1, 'expected one logical h1');
  assert.deepEqual(layout.requiredHeadingTags, requiredHeadingIds.map(() => 'H2'), 'required section IDs must be actual h2 elements');
  assert.equal(layout.sectionHeadingsOrdered, true, 'h2 sections are out of document order');
  assert.equal(layout.h1BeforeSections, true, 'h1 must precede all homepage h2 sections');
  for (let index = 1; index < layout.headingLevels.length; index += 1) {
    assert.ok(layout.headingLevels[index] - layout.headingLevels[index - 1] <= 1, `heading level skipped from h${layout.headingLevels[index - 1]} to h${layout.headingLevels[index]}`);
  }

  const arrow = await page.evaluate(() => {
    const group = document.querySelector('[data-tool-direction-arrow]');
    if (!(group instanceof SVGGraphicsElement)) return null;
    const styles = getComputedStyle(group);
    const matrix = styles.transform === 'none' ? new DOMMatrix() : new DOMMatrix(styles.transform);
    const rotation = styles.rotate === 'none' ? 0 : Number.parseFloat(styles.rotate);
    const origin = styles.transformOrigin.split(' ').map(Number.parseFloat);
    const box = group.getBBox();
    return {
      a: matrix.a,
      b: matrix.b,
      c: matrix.c,
      d: matrix.d,
      rotation,
      transformBox: styles.transformBox,
      centeredOrigin: Math.abs(origin[0] - box.width / 2) <= 0.5 && Math.abs(origin[1] - box.height / 2) <= 0.5,
    };
  });
  assert.ok(arrow, 'tool cards must expose an inner directional arrow group');
  assert.equal(arrow.transformBox, 'fill-box', 'tool arrow does not use an explicit fill-box transform space');
  assert.equal(arrow.centeredOrigin, true, 'tool arrow transform origin is not centered in its fill box');
  assert.ok(Math.abs(arrow.b) <= 0.001 && Math.abs(arrow.c) <= 0.001, 'tool arrow has an unexpected skew/quarter-turn');
  const evaluatedDirection = Math.cos((arrow.rotation * Math.PI) / 180) * arrow.a;
  const expectedDirection = route.direction === 'rtl' ? -1 : 1;
  assert.ok(Math.abs(evaluatedDirection - expectedDirection) <= 0.001, `${route.path} evaluated tool arrow direction was ${evaluatedDirection} from rotate ${arrow.rotation}deg`);
  for (const target of layout.viewportInteractive) {
    assert.ok(target.width >= 44, `${target.label} width was ${target.width}`);
    assert.ok(target.height >= 44, `${target.label} height was ${target.height}`);
  }

  if (route.direction === 'rtl') {
    const rtl = await page.evaluate(() => {
      const input = document.querySelector('[data-tool-search-input]');
      const icon = input?.parentElement?.querySelector('svg');
      const field = input?.parentElement;
      const categoryRow = document.querySelector('[data-tool-filter]')?.parentElement;
      const firstChip = categoryRow?.querySelector('[data-tool-filter]');
      const fieldRect = field?.getBoundingClientRect();
      const iconRect = icon?.getBoundingClientRect();
      const rowRect = categoryRow?.getBoundingClientRect();
      const chipRect = firstChip?.getBoundingClientRect();
      const inputStyles = input ? getComputedStyle(input) : null;
      const status = document.querySelector('[data-tool-results-status]');
      return {
        cardAlignments: [...document.querySelectorAll('[data-popular-workflow], [data-tool-card]')].map((card) => getComputedStyle(card).textAlign),
        iconInlineStartGap: fieldRect && iconRect ? fieldRect.right - iconRect.right : Number.POSITIVE_INFINITY,
        inputPaddingInlineStart: inputStyles ? Number.parseFloat(inputStyles.paddingInlineStart) : 0,
        inputPaddingInlineEnd: inputStyles ? Number.parseFloat(inputStyles.paddingInlineEnd) : 0,
        chipAtInlineStart: rowRect && chipRect ? Math.abs(rowRect.right - chipRect.right) <= 2 : false,
        rowDirection: categoryRow ? getComputedStyle(categoryRow).direction : '',
        statusAlignment: status ? getComputedStyle(status).textAlign : '',
        statusDirection: status ? getComputedStyle(status).direction : '',
      };
    });
    assert.ok(rtl.cardAlignments.every((alignment) => alignment === 'start'), `RTL cards used ${rtl.cardAlignments.join(', ')}`);
    assert.ok(rtl.iconInlineStartGap >= 8 && rtl.iconInlineStartGap <= 40, `RTL search icon inline-start gap was ${rtl.iconInlineStartGap}`);
    assert.ok(rtl.inputPaddingInlineStart > rtl.inputPaddingInlineEnd, 'RTL search input does not reserve logical inline-start space');
    assert.equal(rtl.chipAtInlineStart, true, 'RTL categories do not begin at logical inline-start');
    assert.equal(rtl.rowDirection, 'rtl');
    assert.equal(rtl.statusAlignment, 'start');
    assert.equal(rtl.statusDirection, 'rtl');
  }
}

async function assertArabicBrowserZoom(page, nominalPhysicalWidth) {
  const effectiveCssWidth = Math.round(nominalPhysicalWidth / 2);
  await waitForLayout(page);
  const screenshot = await page.screenshot({ animations: 'disabled' });
  const physicalScreenshotWidth = screenshot.readUInt32BE(16);
  const state = await page.evaluate(() => {
    const remLabel = document.querySelector('[data-tool-card] h3');
    const fixedLabel = document.querySelector('[data-tool-card] li');
    if (!(remLabel instanceof HTMLElement) || !(fixedLabel instanceof HTMLElement)) throw new Error('Missing zoom labels');
    const grid = document.querySelector('[data-tool-grid]');
    const explorerHeader = document.querySelector('[data-tool-explorer] > div');
    const readable = [...document.querySelectorAll('[data-tool-card] h3, [data-tool-card] p, [data-tool-card] li')].every((element) => {
      if (!(element instanceof HTMLElement)) return false;
      const card = element.closest('[data-tool-card]');
      if (!(card instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1;
    });
    return {
      bodyZoom: Number.parseFloat(getComputedStyle(document.body).zoom),
      rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      devicePixelRatio: window.devicePixelRatio,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      smallBreakpoint: matchMedia('(min-width: 640px)').matches,
      largeBreakpoint: matchMedia('(min-width: 1024px)').matches,
      gridColumnCount: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
      explorerColumnCount: explorerHeader ? getComputedStyle(explorerHeader).gridTemplateColumns.split(' ').length : 0,
      toolCount: document.querySelectorAll('[data-tool-card]').length,
      heroVisible: Boolean(document.querySelector('[data-home-hero]')?.getClientRects().length),
      remComputed: Number.parseFloat(getComputedStyle(remLabel).fontSize),
      remHeight: remLabel.getBoundingClientRect().height,
      fixedComputed: Number.parseFloat(getComputedStyle(fixedLabel).fontSize),
      fixedHeight: fixedLabel.getBoundingClientRect().height,
      readable,
    };
  });
  assert.equal(state.bodyZoom, 1, 'browser-zoom emulation must not inject CSS zoom');
  assert.equal(state.rootFontSize, 16, 'browser-zoom emulation must not rewrite the root font size');
  assert.equal(state.devicePixelRatio, 2, 'browser-zoom emulation must render two physical pixels per CSS pixel');
  assert.equal(state.innerWidth, effectiveCssWidth, `${nominalPhysicalWidth}px physical viewport did not expose the expected half-width CSS viewport`);
  assert.equal(state.innerHeight, 550, '1100px physical height did not expose the expected half-height CSS viewport');
  assert.equal(physicalScreenshotWidth, effectiveCssWidth * 2, 'PNG width did not reflect deviceScaleFactor 2');
  assert.ok(Math.abs(physicalScreenshotWidth - nominalPhysicalWidth) <= 1, `physical screenshot width ${physicalScreenshotWidth}px did not preserve nominal ${nominalPhysicalWidth}px width`);
  assert.equal(state.smallBreakpoint, effectiveCssWidth >= 640, '640px media query did not respond to the effective CSS viewport');
  assert.equal(state.largeBreakpoint, effectiveCssWidth >= 1024, '1024px media query did not respond to the effective CSS viewport');
  assert.equal(state.gridColumnCount, effectiveCssWidth >= 640 ? 2 : 1, 'tool grid did not reflow for the effective CSS viewport');
  assert.equal(state.explorerColumnCount, 1, 'explorer header did not stack below the effective 1024px breakpoint');
  assert.equal(state.toolCount, expectedTools.length, 'required tool content was missing after browser-zoom reflow');
  assert.equal(state.heroVisible, true, 'required hero content was not visible after browser-zoom reflow');
  assert.equal(state.remComputed, 18, 'rem-based ToolCard title did not retain its normal CSS size');
  assert.equal(state.fixedComputed, 10, 'fixed-pixel ToolCard label did not retain its normal CSS size');
  assert.ok(state.remHeight >= 28, `rem title was not readable at ${state.remHeight}px CSS height`);
  assert.ok(state.fixedHeight >= 25, `fixed-pixel label was not readable at ${state.fixedHeight}px CSS height`);
  assert.ok(state.scrollWidth <= state.clientWidth, `/ar/ overflowed by ${state.scrollWidth - state.clientWidth}px at 200% browser-zoom emulation and ${nominalPhysicalWidth}px`);
  assert.equal(state.readable, true, `/ar/ tool-card text was clipped at 200% browser-zoom emulation and ${nominalPhysicalWidth}px`);
}

async function check(name, assertion) {
  try {
    await assertion();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

await ensureAstroServer();
const browser = await chromium.launch(browserLaunchOptions);

try {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 900 },
  });

  for (const route of routes) {
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(15_000);
    const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });

    await check(`${route.path} returns a document`, () => {
      assert.equal(response?.status(), 200);
    });

    await check(`${route.path} has one discovery composition`, async () => {
      assert.equal(await page.locator('[data-home-hero]').count(), 1, 'expected one [data-home-hero]');
      assert.equal(await page.locator('[data-popular-workflows]').count(), 1, 'expected one [data-popular-workflows]');
      assert.equal(await page.locator('[data-tool-explorer]').count(), 1, 'expected one [data-tool-explorer]');
      assert.equal(await page.locator('h1').count(), 1, 'expected one h1');
      assert.equal(await page.locator('[data-home-workspace] > [data-home-hero]').count(), 1, 'hero must be inside the workspace boundary');
      assert.equal(await page.locator('[data-home-workspace] [data-popular-workflows]').count(), 1, 'popular workflows must be inside the workspace boundary');
      assert.equal(await page.locator('[data-home-workspace] [data-tool-explorer]').count(), 1, 'tool explorer must be inside the workspace boundary');
      assert.equal(await page.locator('[data-home-hero] .max-w-4xl > :first-child').evaluate((element) => element.tagName), 'H1', 'hero h1 must lead without an eyebrow label');
    });

    await check(`${route.path} hero has no file picker or drop zone`, async () => {
      const hero = page.locator('[data-home-hero]');
      assert.equal(await hero.locator('input[type="file"]').count(), 0);
      assert.equal(await hero.locator('[id*="drop-zone"], [data-drop-zone], [class*="drop-zone"]').count(), 0);
      assert.doesNotMatch(await hero.innerText(), route.forbiddenHeroText);
    });

    await check(`${route.path} has six locale-correct popular workflows`, async () => {
      const anchors = page.locator('[data-popular-workflow]');
      assert.equal(await anchors.count(), popularWorkflows.length);
      assert.deepEqual(
        await anchors.evaluateAll((items) => items.map((item) => ({
          slug: item.getAttribute('data-tool-slug'),
          href: item.getAttribute('href'),
        }))),
        popularWorkflows.map((workflow) => ({
          slug: workflow.slug,
          href: `${route.prefix}${workflow.path}`,
        })),
      );
    });

    await check(`${route.path} keeps all 11 static tool links visible without JavaScript`, async () => {
      const links = page.locator('[data-tool-wrapper] a[data-tool-card]');
      assert.equal(await links.count(), expectedTools.length);
      assert.equal(await page.locator('[data-tool-wrapper]:visible a[data-tool-card]').count(), expectedTools.length);
      assert.ok((await links.evaluateAll((items) => items.map((item) => item.getAttribute('href')))).every(Boolean));
      assert.ok(await links.evaluateAll((items) => items.every((item) => (
        Boolean(item.textContent?.trim())
        && Boolean(item.querySelector('h3')?.textContent?.trim())
        && item.querySelectorAll('p').length >= 2
        && Boolean(item.querySelector('li')?.textContent?.trim())
      ))), 'every no-JavaScript tool-card anchor must contain localized title, short copy, description, and format text');
    });

    await check(`${route.path} has four modular trust items`, async () => {
      const trustItems = page.locator('[data-home-trust-item]');
      assert.equal(await trustItems.count(), 4);
      const trustFacts = await trustItems.evaluateAll((items) => items.map((item) => ({
        element: item.tagName,
        parent: item.parentElement?.tagName,
        title: item.querySelector('[data-home-trust-title]')?.textContent?.trim(),
        value: item.querySelector('[data-home-trust-value]')?.textContent?.trim(),
        description: item.querySelector('[data-home-trust-description]')?.textContent?.trim(),
      })));
      for (const fact of trustFacts) {
        assert.equal(fact.element, 'LI');
        assert.equal(fact.parent, 'UL');
        assert.ok(fact.title, 'trust item title must be nonempty');
        assert.ok(fact.value, 'trust item value must be nonempty');
        assert.ok(fact.description, 'trust item description must be nonempty');
      }
    });

    await check(`${route.path} keeps later privacy proof distinct from hero trust cards`, async () => {
      assert.equal(await page.locator('[data-privacy-proof]').count(), 1);
      assert.equal(await page.locator('[data-privacy-proof] [data-home-privacy-item]').count(), 0);
      assert.equal(await page.locator('[data-privacy-proof] [data-privacy-architecture]').count(), 1);
      assert.equal(await page.locator('[data-privacy-proof] [data-process-flow]').count(), 1);
    });

    await check(`${route.path} places discovery before long-form content and FAQ`, async () => {
      assert.equal(await page.evaluate(() => {
        const explorer = document.querySelector('[data-tool-explorer]');
        const content = document.querySelector('[data-home-content]');
        const faq = document.querySelector('#tool-faq-heading')?.closest('section');
        if (!explorer || !content || !faq) return false;
        const follows = Node.DOCUMENT_POSITION_FOLLOWING;
        return Boolean(explorer.compareDocumentPosition(content) & follows)
          && Boolean(explorer.compareDocumentPosition(faq) & follows);
      }), true);
    });

    await check(`${route.path} exposes the expected document direction`, async () => {
      assert.equal(await page.locator('html').getAttribute('lang'), route.locale);
      assert.equal(await page.locator('html').getAttribute('dir'), route.direction);
    });

    if (route.locale === 'ar') {
      await check('/ar/ uses logical start alignment for sections and modules', async () => {
        assert.deepEqual(await page.locator('[data-home-hero], [data-popular-workflows]').evaluateAll((items) => (
          items.map((item) => getComputedStyle(item).textAlign)
        )), ['start', 'start']);
        assert.deepEqual(await page.locator('[data-popular-workflow], [data-home-trust-item]').evaluateAll((items) => (
          items.map((item) => getComputedStyle(item).textAlign)
        )), Array(10).fill('start'));
      });
    }

    await page.close();
  }

  await check('/ preserves English metadata and root schema graph', async () => {
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(15_000);
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.title(), expectedTitle);
    assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), expectedDescription);
    assert.equal(await page.locator('meta[name="keywords"]').getAttribute('content'), expectedKeywords);

    const schema = await page.locator('script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent ?? '{}'));
    assert.equal(schema['@context'], 'https://schema.org');
    assert.equal(schema['@graph'].length, 4);
    const [website, application, itemList, faqPage] = schema['@graph'];
    assert.deepEqual(website, {
      '@type': 'WebSite',
      '@id': 'https://sorafiles.com/#website',
      name: 'Sora Files',
      alternateName: ['SoraFiles'],
      url: 'https://sorafiles.com/',
      description: expectedDescription,
    });
    assert.deepEqual(application, {
      '@type': 'WebApplication',
      '@id': 'https://sorafiles.com/#application',
      name: 'Sora Files',
      url: 'https://sorafiles.com/',
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any operating system with a modern web browser',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: expectedDescription,
      featureList: expectedTools.map(({ name }) => name),
    });
    assert.deepEqual(itemList, {
      '@type': 'ItemList',
      '@id': 'https://sorafiles.com/#tools',
      name: 'Sora Files PDF and image tools',
      numberOfItems: expectedTools.length,
      itemListElement: expectedTools.map(({ name, url }, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name,
        url,
      })),
    });

    const renderedFaqs = await page.locator('section:has(#tool-faq-heading) details').evaluateAll((details) => details.map((item) => ({
      question: item.querySelector('summary span')?.textContent?.trim(),
      answer: item.querySelector('p')?.textContent?.trim(),
    })));
    assert.equal(renderedFaqs.length, 11);
    assert.deepEqual(faqPage, {
      '@type': 'FAQPage',
      '@id': 'https://sorafiles.com/#faq',
      mainEntity: renderedFaqs.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    });
    await page.close();
  });

  await check('/ static tool link remains keyboard-navigable without JavaScript', async () => {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const link = page.locator('a[data-tool-card][href="/image-converter"]');
    let reached = false;
    for (let press = 0; press < 40; press += 1) {
      await page.keyboard.press('Tab');
      if (await link.evaluate((element) => element === document.activeElement)) {
        reached = true;
        break;
      }
    }
    assert.equal(reached, true, 'document-start Tab traversal did not reach the static tool link');
    await page.keyboard.press('Enter');
    await page.waitForURL(`${baseUrl}/image-converter`);
    assert.equal(new URL(page.url()).pathname, '/image-converter');
    await page.close();
  });

  await context.close();

  const interactiveContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  for (const route of routes) {
    await check(`${route.path} FAQ is keyboard reachable, visible when open, and matches JSON-LD`, async () => {
      const page = await interactiveContext.newPage();
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
      const faq = page.locator('section:has(#tool-faq-heading) details').first();
      const summary = faq.locator('summary');
      const question = (await summary.locator('span').innerText()).trim();

      let precedingHref = null;
      let reachedSummary = false;
      for (let press = 0; press < 100; press += 1) {
        precedingHref = await page.evaluate(() => document.activeElement?.getAttribute('href'));
        await page.keyboard.press('Tab');
        if (await summary.evaluate((element) => element === document.activeElement)) {
          reachedSummary = true;
          break;
        }
      }
      assert.equal(reachedSummary, true, 'Tab traversal did not reach the first FAQ summary');
      assert.equal(precedingHref, `${route.prefix}/word-to-pdf`);
      assert.equal(await summary.evaluate((element) => element === document.activeElement), true);
      assert.equal(await summary.evaluate((element) => element.matches(':focus-visible')), true);
      const focusAppearance = await summary.evaluate((element) => {
        const styles = getComputedStyle(element);
        return { outline: styles.outlineStyle, shadow: styles.boxShadow };
      });
      assert.ok(focusAppearance.outline !== 'none' || focusAppearance.shadow !== 'none', 'FAQ summary has no visible focus treatment');
      await page.keyboard.press('Enter');
      assert.equal(await faq.getAttribute('open'), '');
      assert.equal(await faq.locator('p').isVisible(), true);
      const answer = (await faq.locator('p').innerText()).trim();

      const graph = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) => nodes.flatMap((node) => {
        const schema = JSON.parse(node.textContent ?? '{}');
        return Array.isArray(schema['@graph']) ? schema['@graph'] : [schema];
      }));
      const faqPage = graph.find((item) => item['@type'] === 'FAQPage');
      assert.equal(faqPage?.mainEntity?.[0]?.name, question);
      assert.equal(faqPage?.mainEntity?.[0]?.acceptedAnswer?.text, answer);
      await page.close();
    });
  }

  await check('English synonym search uses token AND matching', async () => {
    const page = await interactiveContext.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const input = page.locator('[data-tool-search-input]');
    await input.fill('make pdf smaller');
    assert.deepEqual(await visibleToolHrefs(page), ['/pdf']);
    assert.equal(await page.locator('[data-tool-results-status]').textContent(), 'Tools found: 1');
    await page.close();
  });

  for (const flow of [
    { name: 'Spanish aliases', path: '/es/', query: 'unir pdf', href: '/es/merge-pdf' },
    { name: 'Japanese aliases', path: '/ja/', query: 'PDF 結合', href: '/ja/merge-pdf' },
    { name: 'Arabic aliases', path: '/ar/', query: 'PDF إلى صورة', href: '/ar/pdf-to-jpg' },
  ]) {
    await check(`${flow.name} find the localized tool`, async () => {
      const page = await interactiveContext.newPage();
      await page.goto(`${baseUrl}${flow.path}`, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-tool-search-input]').fill(flow.query);
      assert.deepEqual(await visibleToolHrefs(page), [flow.href]);
      await page.close();
    });
  }

  await check('category and query combine', async () => {
    const page = await interactiveContext.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const convert = page.locator('[data-tool-filter="convert"]');
    await convert.click();
    assert.equal(await convert.getAttribute('aria-pressed'), 'true');
    await page.locator('[data-tool-search-input]').fill('pdf image');
    assert.ok((await visibleToolHrefs(page)).includes('/pdf-to-jpg'));
    assert.equal(await page.locator('a[data-tool-card][href="/pdf"]').isVisible(), false);
    await page.close();
  });

  await check('impossible query shows the localized empty state and clear restores all tools', async () => {
    const page = await interactiveContext.newPage();
    await page.goto(`${baseUrl}/es/`, { waitUntil: 'domcontentloaded' });
    const input = page.locator('[data-tool-search-input]');
    await input.fill('ninguna-herramienta-posible');
    const empty = page.locator('[data-tool-empty]');
    assert.equal(await empty.isVisible(), true);
    assert.match(await empty.innerText(), /No hay herramientas que coincidan/u);
    const clear = page.locator('[data-tool-clear]');
    await clear.click();
    assert.equal(await input.inputValue(), '');
    assert.equal(await page.locator('[data-tool-filter="all"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-tool-wrapper]:visible').count(), expectedTools.length);
    assert.equal(await input.evaluate((element) => element === document.activeElement), true);
    await page.close();
  });

  await check('search example activation writes, resets, updates, and focuses', async () => {
    const page = await interactiveContext.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const compress = page.locator('[data-tool-filter="compress"]');
    await compress.click();
    const firstExample = page.locator('[data-tool-search-example]').first();
    const label = (await firstExample.innerText()).trim();
    await firstExample.click();
    const input = page.locator('[data-tool-search-input]');
    assert.equal(await input.inputValue(), label);
    assert.equal(await page.locator('[data-tool-filter="all"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await input.evaluate((element) => element === document.activeElement), true);
    assert.deepEqual(await visibleToolHrefs(page), ['/pdf']);
    await page.close();
  });

  await check('local explorer interaction emits no network requests or history changes', async () => {
    const page = await interactiveContext.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    const initialUrl = page.url();
    await page.waitForTimeout(1_500);
    const requests = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.locator('[data-tool-search-input]').fill('make pdf smaller');
    await page.locator('[data-tool-filter="compress"]').click();
    assert.deepEqual(requests, []);
    assert.equal(page.url(), initialUrl);
    await page.close();
  });

  for (const theme of themes) {
    for (const route of routes) {
      const page = await interactiveContext.newPage();
      const consoleErrors = collectRuntimeErrors(page);
      await page.addInitScript((preference) => localStorage.setItem('sora-theme', preference), theme);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });

      await check(`${route.path} applies ${theme} theme`, async () => {
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        assert.equal(await page.locator('html').getAttribute('data-theme-preference'), theme);
      });

      for (const width of responsiveWidths) {
        await check(`${route.path} ${theme} responsive contract at ${width}px`, () => (
          assertResponsiveSurface(page, route, width)
        ));
      }

      if (theme === 'light') {
        await page.setViewportSize({ width: 375, height: 1100 });
        await waitForLayout(page);
        await check(`${route.path} document-start Tab order reaches every discovery target once`, () => (
          assertDocumentStartKeyboardOrder(page, route)
        ));

        await check(`${route.path} empty-state clear participates once in document-start Tab order`, async () => {
          const emptyPage = await interactiveContext.newPage();
          const emptyErrors = collectRuntimeErrors(emptyPage);
          await emptyPage.addInitScript(() => localStorage.setItem('sora-theme', 'light'));
          await emptyPage.setViewportSize({ width: 375, height: 1100 });
          await emptyPage.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
          await assertDocumentStartKeyboardOrder(emptyPage, route, { empty: true });
          assert.deepEqual(emptyErrors, []);
          await emptyPage.close();
        });
      }

      await check(`${route.path} ${theme} emits no console errors`, async () => {
        assert.deepEqual(consoleErrors, []);
      });
      await page.close();
    }
  }

  for (const width of responsiveWidths) {
    await check(`/ar/ 200% browser zoom/effective viewport emulation at ${width}px physical`, async () => {
      const zoomContext = await browser.newContext({
        viewport: { width: Math.round(width / 2), height: 550 },
        deviceScaleFactor: 2,
      });
      const page = await zoomContext.newPage();
      const consoleErrors = collectRuntimeErrors(page);
      await page.addInitScript(() => localStorage.setItem('sora-theme', 'light'));
      await page.goto(`${baseUrl}/ar/`, { waitUntil: 'domcontentloaded' });
      await assertArabicBrowserZoom(page, width);
      assert.deepEqual(consoleErrors, []);
      await zoomContext.close();
    });
  }

  await check('reduced motion suppresses ambient visuals and transition motion', async () => {
    const page = await interactiveContext.newPage();
    const runtimeErrors = collectRuntimeErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await waitForLayout(page);
    const state = await page.evaluate(() => {
      const layer = document.querySelector('[data-ambient-layer]');
      const heroAction = document.querySelector('[data-home-hero] a[href="#all-tools"]');
      return {
        layerDisplay: layer ? getComputedStyle(layer).display : '',
        layerState: layer?.getAttribute('data-ambient-state'),
        bubbleCount: document.querySelectorAll('[data-ambient-bubble]').length,
        transitionDuration: heroAction ? getComputedStyle(heroAction).transitionDuration : '',
      };
    });
    assert.equal(state.layerDisplay, 'none');
    assert.equal(state.layerState, 'suppressed');
    assert.equal(state.bubbleCount, 0);
    assert.ok(Number.parseFloat(state.transitionDuration) <= 0.00001, `transition duration remained ${state.transitionDuration}`);
    assert.deepEqual(runtimeErrors, []);
    await page.close();
  });

  await check('ambient off preference suppresses bubbles and reports the saved state', async () => {
    const page = await interactiveContext.newPage();
    const runtimeErrors = collectRuntimeErrors(page);
    await page.addInitScript(() => localStorage.setItem('sora-ambient-bubbles', 'off'));
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await waitForLayout(page);
    assert.equal(await page.locator('[data-ambient-layer]').getAttribute('data-ambient-state'), 'suppressed');
    assert.equal(await page.locator('[data-ambient-bubble]').count(), 0);
    assert.equal(await page.locator('[data-ambient-preference]').getAttribute('aria-checked'), 'false');
    assert.deepEqual(runtimeErrors, []);
    await page.close();
  });

  await check('ambient layer stays behind discovery and cannot steal real clicks', async () => {
    const page = await interactiveContext.newPage();
    const runtimeErrors = collectRuntimeErrors(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const layer = document.querySelector('[data-ambient-layer]');
      if (!(layer instanceof HTMLElement)) throw new Error('Missing ambient layer');
      const blocker = document.createElement('span');
      blocker.dataset.ambientBubble = '';
      blocker.className = 'ambient-bubble';
      blocker.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;opacity:1;animation:none;transform:none;pointer-events:auto;';
      layer.append(blocker);
      window.__homepageStackingClicks = [];
      document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;
        const target = event.target.closest('[data-tool-search-input], [data-tool-filter], [data-popular-workflow], a[data-tool-card]');
        if (!target) return;
        window.__homepageStackingClicks.push(
          target.matches('[data-tool-search-input]') ? 'search'
            : target.matches('[data-tool-filter]') ? 'filter'
              : target.matches('[data-popular-workflow]') ? 'workflow'
                : 'tool',
        );
        if (target.matches('a')) event.preventDefault();
      }, { capture: true });
    });

    await page.locator('[data-tool-search-input]').click();
    assert.equal(await page.locator('[data-tool-search-input]').evaluate((element) => element === document.activeElement), true);
    await page.locator('[data-tool-filter="convert"]').click();
    assert.equal(await page.locator('[data-tool-filter="convert"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-popular-workflow]').first().click();
    await page.locator('[data-tool-wrapper]:visible a[data-tool-card]').first().click({ position: { x: 20, y: 20 } });
    assert.deepEqual(await page.evaluate(() => window.__homepageStackingClicks), ['search', 'filter', 'workflow', 'tool']);

    const stacking = await page.evaluate(() => ({
      ambient: getComputedStyle(document.querySelector('[data-ambient-layer]')).zIndex,
      content: getComputedStyle(document.querySelector('.site-content')).zIndex,
    }));
    assert.ok(Number(stacking.content) > Number(stacking.ambient), `ambient ${stacking.ambient} was not behind content ${stacking.content}`);
    assert.deepEqual(runtimeErrors, []);
    await page.close();
  });

  await interactiveContext.close();
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\nHomepage discovery contract failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('\nHomepage discovery contract passed.');
