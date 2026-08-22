import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { liveTools, popularToolIds } from '../src/data/liveTools.ts';
import { localizedPath, publishedLocales } from '../src/i18n/config.ts';
import { getHardReductionMessage, getPdfPageLimit, workbenchMessages } from '../src/i18n/workbench.ts';

const failures = [];
const toolIds = new Set(liveTools.map((tool) => tool.id));
const slugs = new Set(liveTools.map((tool) => tool.slug));
const featured = new Set(popularToolIds);

if (toolIds.size !== liveTools.length) failures.push('Tool IDs must be unique.');
if (slugs.size !== liveTools.length) failures.push('Tool slugs must be unique.');
if (featured.size !== popularToolIds.length) failures.push('Featured tool IDs must be unique.');
for (const id of popularToolIds) if (!toolIds.has(id)) failures.push(`Featured tool “${id}” is not in the public registry.`);

const compressImage = liveTools.find((tool) => tool.id === 'compress-image');
if (!compressImage?.accept.toLowerCase().includes('heic') || !compressImage.accept.toLowerCase().includes('heif')) {
  failures.push('Compress Image metadata must include its implemented HEIC/HEIF inputs.');
}
const imageConverter = liveTools.find((tool) => tool.id === 'image-converter');
for (const extension of ['heic', 'tiff', 'psd']) {
  if (!imageConverter?.accept.toLowerCase().includes(extension)) failures.push(`Image Converter metadata is missing implemented ${extension.toUpperCase()} input.`);
}

for (const { path: locale } of publishedLocales) {
  const messages = workbenchMessages[locale];
  if (!messages?.approximateReduction) failures.push(`${locale}: missing reduction-limit label.`);
  if (/approx|ungefähr|geschätz|przybliż|yaklaşık|ước tính|โดยประมาณ|예상|おおよそ|预计|預計|अनुमानित|تقريبي|примерн|perkiraan/i.test(messages?.approximateReduction ?? '')) {
    failures.push(`${locale}: hard reduction control is still labelled as approximate.`);
  }
  if (!getHardReductionMessage(locale)) failures.push(`${locale}: missing hard-reduction explanation.`);
  if (!getPdfPageLimit(locale)) failures.push(`${locale}: missing PDF page-limit copy.`);
}

const readableExtensions = new Set(['.astro', '.js', '.mjs', '.ts', '.txt']);
const readTree = (root) => {
  if (!existsSync(root)) return '';
  return readdirSync(root, { withFileTypes: true }).map((entry) => {
    const target = join(root, entry.name);
    if (entry.isDirectory()) return readTree(target);
    return readableExtensions.has(extname(entry.name)) ? readFileSync(target, 'utf8') : '';
  }).join('\n');
};

const publicSource = [readTree('src'), readFileSync('public/llms.txt', 'utf8')].join('\n');
if (/Sora(?:\s+|-)Files/i.test(publicSource)) failures.push('Current application source contains a spaced or hyphenated SoraFiles product name.');
if (/data-google-preferred-source|preferences\/source\?q=sorafiles\.com/i.test(publicSource)) failures.push('Removed Google Preferred Source CTA was reintroduced.');

const canonicalCopy = readFileSync('src/data/liveCopy.ts', 'utf8');
for (const stale of ['No uploads, no accounts, no watermarks.', 'nothing is uploaded', 'Nothing is uploaded.', 'No servers. No uploads.']) {
  if (canonicalCopy.includes(stale)) failures.push(`Canonical copy contains deprecated broad privacy wording: “${stale}”`);
}
for (const required of ['No file uploads for processing', 'No processing servers.', 'files stay on your device']) {
  if (!canonicalCopy.includes(required)) failures.push(`Canonical copy is missing precise file-processing wording: “${required}”`);
}

const localeSeedSource = readTree('src/i18n');
if (/(?:primaryAction|action):\s*['"][^'"]*\b(?:11|15|23)\b[^'"]*['"]/.test(localeSeedSource)) {
  failures.push('Locale action copy contains a hardcoded historical tool count.');
}
if (!localeSeedSource.includes("primaryAction.replace(/\\{\\{n\\}\\}/g, String(liveTools.length))")) {
  failures.push('Locale action count must derive from the authoritative live tool registry.');
}

if (!process.argv.includes('--source-only') && existsSync('dist/index.html')) {
  for (const { path: locale } of publishedLocales) {
    const homepage = join('dist', ...(locale === 'en' ? [] : [locale]), 'index.html');
    const html = readFileSync(homepage, 'utf8');
    const renderedTools = (html.match(/\sdata-tool-search-item(?:\s|>)/g) ?? []).length;
    const renderedFeatured = (html.match(/data-popular="true"/g) ?? []).length;
    if (renderedTools !== liveTools.length) failures.push(`${locale}: rendered ${renderedTools} tools; registry has ${liveTools.length}.`);
    if (renderedFeatured !== popularToolIds.length) failures.push(`${locale}: rendered ${renderedFeatured} featured tools; configuration has ${popularToolIds.length}.`);
    if (!html.includes(`data-tool-results-status`) || !html.includes(`: ${popularToolIds.length}</p>`)) failures.push(`${locale}: featured count is not rendered from configuration.`);

    const contactFile = join('dist', ...(locale === 'en' ? [] : [locale]), 'contact', 'index.html');
    const contactHtml = readFileSync(contactFile, 'utf8');
    if (!contactHtml.includes('action="https://formsubmit.co/')) failures.push(`${locale}: contact page is missing the current form workflow.`);
    if (contactHtml.includes('hello@sorafiles.com')) failures.push(`${locale}: contact page still renders the obsolete mail-app card.`);

    for (const route of ['/pdf', '/compress-image']) {
      const file = join('dist', ...localizedPath(locale, route).split('/').filter(Boolean), 'index.html');
      const toolHtml = readFileSync(file, 'utf8');
      if (!toolHtml.includes(getHardReductionMessage(locale))) failures.push(`${locale}${route}: missing hard byte-limit explanation.`);
      if (route === '/pdf' && !toolHtml.includes(getPdfPageLimit(locale))) failures.push(`${locale}${route}: missing localized 40-page safety limit.`);
    }
  }
}

if (failures.length) {
  console.error(`Content truth validation failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Content truth validation passed: ${liveTools.length} registry tools, ${popularToolIds.length} featured tools, ${publishedLocales.length} locale contracts.`);
