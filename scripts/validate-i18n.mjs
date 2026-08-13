import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';
import { elementsWithData, parseHtml, processFlowContract } from './lib/built-html-contract.mjs';

const site = 'https://sorafiles.com';
const locales = [
  ['en', 'en', 'ltr'], ['ja', 'ja', 'ltr'], ['ko', 'ko', 'ltr'], ['es', 'es', 'ltr'],
  ['fr', 'fr', 'ltr'], ['de', 'de', 'ltr'], ['pt', 'pt', 'ltr'], ['zh-cn', 'zh-Hans', 'ltr'],
  ['zh-tw', 'zh-Hant', 'ltr'], ['hi', 'hi', 'ltr'], ['ar', 'ar', 'rtl'], ['ru', 'ru', 'ltr'],
  ['id', 'id', 'ltr'], ['it', 'it', 'ltr'], ['nl', 'nl', 'ltr'], ['tr', 'tr', 'ltr'],
  ['vi', 'vi', 'ltr'], ['th', 'th', 'ltr'], ['pl', 'pl', 'ltr'],
];
const routes = ['/', '/about', '/contact', '/privacy', '/terms', '/open-source', '/image-converter', '/compress-image', '/heic-to-jpg', '/pdf', '/merge-pdf', '/split-pdf', '/rotate-pdf', '/jpg-to-pdf', '/pdf-to-jpg', '/pdf-to-word', '/word-to-pdf'];
const errors = [];
const sitemap = readFileSync(join('dist', 'sitemap-0.xml'), 'utf8');
const englishWorkbenchLabels = ['Local file tool', 'Local image tool', 'Local PDF tool', 'No server upload', 'Processed on your device', 'Choose file', 'Choose files', 'Choose image', 'Choose PDF', 'Remove all', 'Compression goal', 'Target size', 'Output format', 'Ready to download', 'Download result'];
const discoveryFields = ['popularTitle', 'popularIntro', 'searchExamplesLabel', 'resultCount'];
const publicToolSlugs = ['compress-image', 'compress-pdf', 'heic-to-jpg', 'image-converter', 'jpg-to-pdf', 'merge-pdf', 'pdf-to-jpg', 'pdf-to-word', 'rotate-pdf', 'split-pdf', 'word-to-pdf'];

const catalogBundle = await build({
  entryPoints: [join(process.cwd(), 'src', 'i18n', 'index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const { localeContent } = await import(`data:text/javascript;base64,${Buffer.from(catalogBundle.outputFiles[0].text).toString('base64')}`);
const normalizeAlias = (value, locale) => value
  .toLocaleLowerCase(locale)
  .normalize('NFKD')
  .replace(/\p{M}+/gu, '')
  .replace(/\p{P}+/gu, ' ')
  .replace(/\s+/gu, ' ')
  .trim();

for (const [locale, language] of locales) {
  const home = localeContent[locale]?.home;
  if (!home) {
    errors.push(`${locale}: missing locale catalog`);
    continue;
  }
  for (const field of discoveryFields) {
    if (typeof home[field] !== 'string' || !home[field].trim()) errors.push(`${locale}: missing home.${field}`);
  }
  if (!home.resultCount?.includes('{count}')) errors.push(`${locale}: home.resultCount missing {count}`);
  if (!Array.isArray(home.searchExamples) || home.searchExamples.length !== 3 || home.searchExamples.some((value) => !value?.trim())) {
    errors.push(`${locale}: home.searchExamples must contain three nonempty examples`);
  }
  if (!Array.isArray(home.privacySteps) || home.privacySteps.length !== 3 || home.privacySteps.some((step) => !step?.title?.trim() || !step?.text?.trim())) {
    errors.push(`${locale}: home.privacySteps must contain three nonempty localized steps`);
  }
  const aliasSlugs = Object.keys(home.searchAliases ?? {}).sort();
  if (aliasSlugs.join('|') !== publicToolSlugs.join('|')) errors.push(`${locale}: home.searchAliases must contain exactly 11 public tool slugs`);
  for (const slug of publicToolSlugs) {
    const aliases = home.searchAliases?.[slug];
    const normalized = Array.isArray(aliases) ? aliases.map((value) => normalizeAlias(value, language)).filter(Boolean) : [];
    if (new Set(normalized).size < 2) errors.push(`${locale}: ${slug} needs at least two unique nonempty aliases`);
  }
}

const urlFor = (locale, route) => {
  if (locale === 'en') return route === '/' ? `${site}/` : `${site}${route}`;
  return route === '/' ? `${site}/${locale}/` : `${site}/${locale}${route}`;
};
const fileFor = (locale, route) => {
  const segments = [];
  if (locale !== 'en') segments.push(locale);
  if (route !== '/') segments.push(route.slice(1));
  return join('dist', ...segments, 'index.html');
};
const textMatch = (html, pattern) => html.match(pattern)?.[1]?.trim() || '';
const decodeText = (value) => value
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#(?:x27|39);/gi, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

for (const [locale, language, direction] of locales) {
  for (const route of routes) {
    const file = fileFor(locale, route);
    const expectedUrl = urlFor(locale, route);
    if (!existsSync(file)) {
      errors.push(`${locale}${route}: missing generated page`);
      continue;
    }
    const html = readFileSync(file, 'utf8');
    const document = parseHtml(html);
    const head = textMatch(html, /<head>([\s\S]*?)<\/head>/i);
    const htmlTag = textMatch(html, /(<html[^>]*>)/i);
    const canonical = textMatch(head, /<link rel="canonical" href="([^"]+)"/i);
    const title = textMatch(head, /<title>([\s\S]*?)<\/title>/i);
    const description = textMatch(head, /<meta name="description" content="([^"]+)"/i);
    const h1 = textMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '').trim();
    const alternatePairs = [...head.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/gi)].map((match) => [match[1], match[2]]);

    if (!htmlTag.includes(`lang="${language}"`)) errors.push(`${locale}${route}: expected html lang=${language}`);
    if (!htmlTag.includes(`dir="${direction}"`)) errors.push(`${locale}${route}: expected dir=${direction}`);
    if (canonical !== expectedUrl) errors.push(`${locale}${route}: canonical ${canonical || 'missing'} != ${expectedUrl}`);
    if (!title || !title.includes('Sora Files')) errors.push(`${locale}${route}: missing branded title`);
    if (!description) errors.push(`${locale}${route}: missing description`);
    if (!h1) errors.push(`${locale}${route}: missing H1`);
    if (html.includes('\uFFFD')) errors.push(`${locale}${route}: replacement character found`);
    if (route === '/') {
      const proofCount = elementsWithData(document, 'data-privacy-proof').length;
      if (proofCount !== 1) errors.push(`${locale}${route}: expected one data-privacy-proof container, found ${proofCount}`);
      const architectureCount = elementsWithData(document, 'data-privacy-architecture').length;
      if (architectureCount !== 1) errors.push(`${locale}${route}: expected one data-privacy-architecture module, found ${architectureCount}`);
      const flow = processFlowContract(document);
      if (flow.moduleCount !== 1) errors.push(`${locale}${route}: expected one data-process-flow module, found ${flow.moduleCount}`);
      if (flow.orderedListCount !== 1) errors.push(`${locale}${route}: process flow must contain exactly one ordered list, found ${flow.orderedListCount}`);
      if (flow.steps.length !== 3 || flow.steps.some((step) => !step.title || !step.text)) errors.push(`${locale}${route}: process flow must render exactly three nonempty localized steps`);
      const expectedSteps = localeContent[locale].home.privacySteps;
      if (flow.steps.some((step, index) => decodeText(step.title) !== expectedSteps[index]?.title || decodeText(step.text) !== expectedSteps[index]?.text)) {
        errors.push(`${locale}${route}: process flow steps must match the locale catalog`);
      }
      if (locale !== 'en') {
        const englishProofLabels = ['Your files stay under your control', 'File uploads', 'Account required', 'Original overwritten'];
        for (const label of englishProofLabels) {
          if (html.includes(label)) errors.push(`${locale}${route}: untranslated proof label "${label}" found`);
        }
      }
    }
    if (locale !== 'en' && routes.indexOf(route) >= 6) {
      for (const label of englishWorkbenchLabels) if (html.includes(`>${label}<`)) errors.push(`${locale}${route}: untranslated workbench label “${label}”`);
    }
    if (alternatePairs.length !== locales.length + 1) errors.push(`${locale}${route}: expected 20 head hreflang links, found ${alternatePairs.length}`);

    for (const [alternateLocale, alternateLanguage] of locales) {
      const expectedAlternate = urlFor(alternateLocale, route);
      if (!alternatePairs.some(([code, href]) => code === alternateLanguage && href === expectedAlternate)) {
        errors.push(`${locale}${route}: missing reciprocal ${alternateLanguage} -> ${expectedAlternate}`);
      }
    }
    if (!alternatePairs.some(([code, href]) => code === 'x-default' && href === urlFor('en', route))) {
      errors.push(`${locale}${route}: missing x-default`);
    }
    if (!sitemap.includes(`<loc>${expectedUrl}</loc>`)) errors.push(`${locale}${route}: missing sitemap URL ${expectedUrl}`);

    for (const match of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
      try { JSON.parse(match[1]); } catch { errors.push(`${locale}${route}: invalid JSON-LD`); }
    }
  }
}

if (sitemap.includes('/kr') || sitemap.includes('/heic</loc>') || sitemap.includes('/heic/</loc>')) {
  errors.push('sitemap contains a compatibility or legacy URL');
}

if (errors.length) {
  console.error(`i18n validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors.slice(0, 80)) console.error(`- ${error}`);
  if (errors.length > 80) console.error(`- ...and ${errors.length - 80} more`);
  process.exit(1);
}

console.log(`i18n validation passed: ${locales.length} languages × ${routes.length} equivalent routes (${locales.length * routes.length} localized URLs).`);
