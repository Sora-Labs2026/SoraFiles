import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brandPositioning } from '../src/i18n/brandPositioning.ts';
import { publishedLocales } from '../src/i18n/config.ts';
import { liveToolById } from '../src/data/liveTools.ts';
import liveCopy from '../src/data/liveCopy.ts';

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const tagline = 'A privacy-first web app that runs locally in your browser.';
const description = 'SoraFiles is a privacy-first web app for working with PDFs and images directly in your browser. Supported file processing happens locally on your device.';

check(Object.keys(brandPositioning).length === publishedLocales.length, 'Brand positioning must cover every published locale exactly once.');
for (const { path: locale } of publishedLocales) {
  const copy = brandPositioning[locale];
  check(Boolean(copy), `${locale}: missing brand positioning.`);
  for (const [key, value] of Object.entries(copy ?? {})) {
    check(typeof value === 'string' && value.trim().length > 0, `${locale}.${key}: missing copy.`);
    check(!String(value).includes('{{n}}'), `${locale}.${key}: brand identity must not use a changing count.`);
  }
}
check(brandPositioning.en.description === description, 'English canonical description has drifted.');
check(brandPositioning.en.footerTagline.toLowerCase().includes(tagline.toLowerCase()), 'English footer must preserve the canonical tagline.');

const read = (path) => readFileSync(path, 'utf8');
for (const [path, required] of [
  ['README.md', description],
  ['docs/BRAND_POSITIONING.md', tagline],
  ['public/site.webmanifest', tagline],
]) check(read(path).includes(required), `${path}: missing canonical positioning.`);

const countLedBranding = /\b(?:23|25|26)\s+(?:free\s+)?tools?\b|\b(?:23|25|26)\s+public\s+(?:file\s+)?tools?\b/i;
for (const path of ['README.md', 'PRODUCT.md', 'package.json', 'public/site.webmanifest']) {
  check(!countLedBranding.test(read(path)), `${path}: contains count-led brand copy.`);
}

if (existsSync('dist/index.html')) {
  for (const { path: locale } of publishedLocales) {
    const prefix = locale === 'en' ? 'dist' : join('dist', locale);
    const homepage = read(join(prefix, 'index.html'));
    const about = read(join(prefix, 'about', 'index.html'));
    const copy = brandPositioning[locale];
    check(homepage.includes(copy.heroLine1) && homepage.includes(copy.heroLine2), `${locale}: homepage is missing one-app hero positioning.`);
    check(homepage.includes(copy.description), `${locale}: homepage is missing localized privacy-first description.`);
    check(about.includes(copy.aboutTitle) && about.includes(copy.aboutIntro), `${locale}: About page is missing localized one-app positioning.`);
    check(!countLedBranding.test(homepage) && !countLedBranding.test(about), `${locale}: rendered brand page contains a historical tool-count claim.`);
  }

  const workflowIds = ['compress-pdf', 'merge-pdf', 'split-pdf', 'sign-pdf', 'pdf-ocr', 'pdf-to-word', 'word-to-pdf', 'compress-image', 'metadata-remover'];
  for (const id of workflowIds) {
    const tool = liveToolById.get(id);
    const html = read(join('dist', tool?.slug ?? id, 'index.html'));
    const expectedH1 = tool ? liveCopy.tool[tool.id].n : '';
    const renderedH1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]+>/g, '').trim().replace(/\.$/, '') ?? '';
    check(expectedH1 && renderedH1 === expectedH1, `${id}: workflow H1 intent changed.`);
  }
}

if (failures.length) {
  console.error(`Brand positioning validation failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Brand positioning validation passed: one-app identity across ${publishedLocales.length} languages with workflow SEO intent preserved.`);
