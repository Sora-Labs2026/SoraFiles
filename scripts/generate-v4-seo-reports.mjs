import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'parse5';

const root = new URL('../', import.meta.url);
const promptPath = new URL('prompts/SoraFiles-FINAL-V4-All-in-One-Health-GEO100-857Keywords-KeywordOnly-SplitHero-Codex-CLI-GPT-5.6-Sol-High-Efficiency.txt', root);
const prompt = await readFile(promptPath, 'utf8');
const bank = prompt.slice(prompt.indexOf('BROAD / ENTITY / CATEGORY KEYWORDS'), prompt.indexOf('24. INTERNAL LINKING'));

const groups = new Map();
let groupName;
for (const line of bank.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (/^[A-Z][A-Z /-]+(?:KEYWORDS|LONG-TAIL)$/.test(trimmed)) {
    groupName = trimmed;
    groups.set(groupName, []);
    continue;
  }
  const match = trimmed.match(/^\d+\.\s+(.+)$/);
  if (match && groupName) groups.get(groupName).push(match[1].trim().toLowerCase());
}

const groupRoutes = new Map([
  ['COMPRESS PDF KEYWORDS', '/pdf'],
  ['MERGE PDF KEYWORDS', '/merge-pdf'],
  ['SPLIT PDF KEYWORDS', '/split-pdf'],
  ['ROTATE PDF KEYWORDS', '/rotate-pdf'],
  ['REMOVE PAGES KEYWORDS', '/remove-pages'],
  ['PDF TO JPG KEYWORDS', '/pdf-to-jpg'],
  ['JPG TO PDF KEYWORDS', '/jpg-to-pdf'],
  ['PDF TO WORD KEYWORDS', '/pdf-to-word'],
  ['WORD TO PDF KEYWORDS', '/word-to-pdf'],
  ['WATERMARK PDF KEYWORDS', '/watermark-pdf'],
  ['PAGE NUMBERS KEYWORDS', '/page-numbers'],
  ['SIGN PDF KEYWORDS', '/sign-pdf'],
  ['IMAGE CONVERTER KEYWORDS', '/image-converter'],
  ['COMPRESS IMAGE KEYWORDS', '/compress-image'],
  ['HEIC TO JPG KEYWORDS', '/heic-to-jpg'],
  ['EDIT IMAGE KEYWORDS', '/edit-image'],
  ['REMOVE BACKGROUND KEYWORDS', '/remove-background'],
  ['PROTECT PDF KEYWORDS', '/protect-pdf'],
  ['UNLOCK PDF KEYWORDS', '/unlock-pdf'],
  ['REPAIR PDF KEYWORDS', '/repair-pdf'],
  ['METADATA REMOVER KEYWORDS', '/metadata-remover'],
  ['PDF TO EXCEL KEYWORDS', '/pdf-to-excel'],
  ['EXCEL TO PDF KEYWORDS', '/excel-to-pdf'],
  ['PDF OCR KEYWORDS', '/pdf-ocr'],
  ['RESIZE IMAGE KEYWORDS', '/resize-image'],
  ['DOC SCANNER KEYWORDS', '/doc-scanner'],
]);

const rules = [
  [/remove (?:image )?background|background remover|transparent background/, '/remove-background'],
  [/document scanner|doc scanner|pdf scanner|scan (?:document|photo|receipt|page)|document perspective/, '/doc-scanner'],
  [/resize image|image resizer|resize photo|image dimensions|image width height|image crop/, '/resize-image'],
  [/pdf (?:ocr|text recognition)|ocr pdf|searchable pdf|scanned pdf searchable|extract text from scanned pdf/, '/pdf-ocr'],
  [/pdf to excel|pdf to xlsx|pdf table to excel|extract table from (?:scanned )?pdf|invoice to excel/, '/pdf-to-excel'],
  [/excel to pdf|xlsx to pdf|xls to pdf|spreadsheet to pdf/, '/excel-to-pdf'],
  [/metadata|\bexif\b/, '/metadata-remover'],
  [/repair pdf|fix (?:a )?(?:corrupt|broken|damaged|invalid)? ?pdf|recover (?:damaged|corrupted|readable) pdf/, '/repair-pdf'],
  [/unlock pdf|remove (?:known )?pdf password|decrypt pdf|open locked pdf|pdf password remover/, '/unlock-pdf'],
  [/protect pdf|password protect|encrypt pdf|pdf encryption|lock pdf/, '/protect-pdf'],
  [/edit image|image editor|photo editor|crop (?:an )?image|rotate image|flip image|adjust .* image|sharpen image|black and white image/, '/edit-image'],
  [/heic|iphone photo to jpg/, '/heic-to-jpg'],
  [/compress (?:an )?image|image compressor|reduce (?:photo|image) (?:file )?size|reduce image (?:kb|mb)|shrink image|make image smaller/, '/compress-image'],
  [/image converter|convert (?:jpg to png|png to jpg|webp to jpg|webp to png|jpg to webp|png to webp)|image format converter/, '/image-converter'],
  [/sign pdf|signature (?:to|on) pdf|pdf signature|add signature|draw signature|type signature|place signature|initials to pdf/, '/sign-pdf'],
  [/page numbers|number pdf|number pages|page numbering/, '/page-numbers'],
  [/watermark/, '/watermark-pdf'],
  [/word to pdf|docx to pdf|doc to pdf|word document to pdf/, '/word-to-pdf'],
  [/pdf to word|pdf to docx|pdf editable in word/, '/pdf-to-word'],
  [/jpg to pdf|jpeg to pdf|image to pdf|images? into pdf|photos to pdf|png to pdf/, '/jpg-to-pdf'],
  [/pdf to jpg|pdf to jpeg|pdf to image|pdf pages? to (?:jpg|images)|save pdf as jpg/, '/pdf-to-jpg'],
  [/remove .*pages? from pdf|delete .*pdf pages?|pdf page remover|remove pdf page/, '/remove-pages'],
  [/rotate pdf|pdf rotate|sideways pdf|pdf page orientation|turn pdf page/, '/rotate-pdf'],
  [/split pdf|pdf splitter|separate pdf pages|extract .*pages? from (?:a )?pdf|divide pdf/, '/split-pdf'],
  [/merge pdf|combine (?:two |multiple )?pdf|join pdf|put pdfs together|pdf merger/, '/merge-pdf'],
  [/compress (?:a )?pdf|pdf compressor|reduce pdf|shrink pdf|make (?:a )?pdf smaller|optimize pdf|pdf size reducer/, '/pdf'],
];

const related = new Map([
  ['/', '/tools'], ['/tools', '/'], ['/privacy', '/'],
  ['/pdf', '/merge-pdf'], ['/merge-pdf', '/split-pdf'], ['/split-pdf', '/merge-pdf'], ['/rotate-pdf', '/remove-pages'], ['/remove-pages', '/rotate-pdf'],
  ['/pdf-to-jpg', '/jpg-to-pdf'], ['/jpg-to-pdf', '/pdf-to-jpg'], ['/pdf-to-word', '/word-to-pdf'], ['/word-to-pdf', '/pdf-to-word'],
  ['/watermark-pdf', '/sign-pdf'], ['/page-numbers', '/watermark-pdf'], ['/sign-pdf', '/watermark-pdf'],
  ['/image-converter', '/compress-image'], ['/compress-image', '/resize-image'], ['/heic-to-jpg', '/image-converter'], ['/edit-image', '/resize-image'], ['/remove-background', '/edit-image'],
  ['/protect-pdf', '/unlock-pdf'], ['/unlock-pdf', '/protect-pdf'], ['/repair-pdf', '/metadata-remover'], ['/metadata-remover', '/privacy'],
  ['/pdf-to-excel', '/excel-to-pdf'], ['/excel-to-pdf', '/pdf-to-excel'], ['/pdf-ocr', '/pdf-to-word'], ['/resize-image', '/compress-image'], ['/doc-scanner', '/pdf-ocr'],
]);

const resolveRoute = (keyword, group) => {
  if (groupRoutes.has(group)) return groupRoutes.get(group);
  for (const [pattern, route] of rules) if (pattern.test(keyword)) return route;
  if (group === 'PRIVACY / LOCAL-PROCESSING LONG-TAIL') return '/privacy';
  if (group === 'BROAD / ENTITY / CATEGORY KEYWORDS' && /tools|file|document|pdf|image/.test(keyword)) return '/';
  return '/tools';
};

const excludedTags = new Set(['script', 'style', 'svg', 'template', 'noscript']);
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
const classList = (node) => (attr(node, 'class') ?? '').split(/\s+/);
const isExcluded = (node) => excludedTags.has(node.tagName) || node.attrs?.some((item) => item.name === 'hidden' || (item.name === 'aria-hidden' && item.value === 'true')) || classList(node).includes('sr-only');
const nodeText = (node, options = {}) => {
  if (node.nodeName === '#text') return node.value ?? '';
  if (!options.includeExcluded && isExcluded(node)) return '';
  return (node.childNodes ?? []).map((child) => nodeText(child, options)).join(' ');
};
const walk = (node, visit, excluded = false) => {
  const nextExcluded = excluded || isExcluded(node);
  if (!nextExcluded) visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit, nextExcluded);
};
const clean = (value) => value.replace(/\s+/g, ' ').trim();
const escapeCell = (value) => clean(String(value ?? '')).replaceAll('|', '\\|');
const exactCount = (text, phrase) => {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...text.matchAll(new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'gi'))].length;
};
const wordCount = (text) => text.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
const htmlPath = (route) => new URL(route === '/' ? 'dist/index.html' : `dist${route}/index.html`, root);

const pageCache = new Map();
const inspectPage = async (route) => {
  if (pageCache.has(route)) return pageCache.get(route);
  const html = await readFile(htmlPath(route), 'utf8');
  const document = parse(html);
  let title = '', description = '', h1 = '';
  const headings = [];
  const links = [];
  walk(document, (node) => {
    if (node.tagName === 'title') title = clean(nodeText(node, { includeExcluded: true }));
    if (node.tagName === 'meta' && attr(node, 'name') === 'description') description = attr(node, 'content') ?? '';
    if (node.tagName === 'h1' && !h1) h1 = clean(nodeText(node));
    if (/^h[2-3]$/.test(node.tagName ?? '')) headings.push(clean(nodeText(node)));
    if (node.tagName === 'a') {
      const href = attr(node, 'href') ?? '';
      if (href.startsWith('/') && !href.startsWith('//')) links.push(`${clean(nodeText(node)) || 'link'} → ${href}`);
    }
  });
  const body = (() => { let found; walk(document, (node) => { if (node.tagName === 'body') found = node; }); return found; })();
  const visibleText = clean(nodeText(body ?? document));
  const result = { route, title, description, h1, headings: [...new Set(headings.filter(Boolean))], links: [...new Set(links.filter(Boolean))], visibleText, words: wordCount(visibleText) };
  pageCache.set(route, result);
  return result;
};

const numberedCount = [...groups.values()].reduce((sum, values) => sum + values.length, 0);
const keywordRows = [];
const seen = new Set();
for (const [group, keywords] of groups) {
  for (const keyword of keywords) {
    if (seen.has(keyword)) continue;
    seen.add(keyword);
    const primary = resolveRoute(keyword, group);
    const secondary = related.get(primary) ?? (primary === '/' ? '/tools' : '/');
    const page = await inspectPage(primary);
    const count = exactCount(page.visibleText, keyword);
    const density = page.words ? count / page.words * 100 : 0;
    const privacyLed = /without upload|no upload|private|privacy|local|browser|on device|no server|files stay/.test(keyword);
    const intent = keyword.startsWith('how to ') ? 'Informational / how-to' : privacyLed ? 'Privacy-led transactional' : group === 'BROAD / ENTITY / CATEGORY KEYWORDS' ? 'Category / discovery' : 'Transactional';
    const presence = count === 0 ? 'Not exact; cluster/context only' : count === 1 ? '1 natural exact use' : `${count} natural exact uses`;
    const action = count === 0 ? 'Mapped; add only when useful to the reader' : count === 1 ? 'Retain as supporting language' : 'Retain; do not increase mechanically';
    keywordRows.push([keyword, intent, primary, secondary, presence, action, `${count} uses · ${density.toFixed(2)}%`]);
  }
}

const mapLines = [
  '# SoraFiles SEO Keyword Map',
  '',
  `Generated from the V4 prompt’s embedded keyword bank on 2026-08-30. The prompt labels the bank “857+”, but the embedded numbered sections contain ${numberedCount} entries and ${seen.size} unique phrases after exact deduplication. No separate competitor export was present in the workspace. This report maps every discoverable unique phrase and uses no search-volume, CPC, competition, result-count, or other competitor metric.`,
  '',
  'The competitor brand is excluded as a target. Exact phrases absent from visible copy remain mapped for intent architecture; they are not automatically inserted. This prevents stuffing and page cannibalization.',
  '',
  '| Keyword | Intent | Primary Page | Secondary Page | Current Presence | Action | Final Density/Use |',
  '|---|---|---|---|---|---|---|',
  ...keywordRows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
  '',
];
await writeFile(new URL('SEO_KEYWORD_MAP.md', root), mapLines.join('\n'));

const primaryByRoute = new Map([['/', 'pdf tools'], ['/tools', 'file tools online'], ['/privacy', 'local file processing']]);
for (const [group, route] of groupRoutes) primaryByRoute.set(route, groups.get(group)[0]);

const densityLines = [
  '# SoraFiles Visible Keyword Density Report',
  '',
  'Generated from the production build. Counts exclude JSON-LD, scripts, CSS, SVG, `hidden` regions, `aria-hidden="true"` regions, and `.sr-only` accessibility duplicates. Expandable FAQ answers are included because users can reveal them and crawlers receive the same HTML. Density is descriptive, never a quota.',
  '',
  '| Page | Rendered visible words | Primary keyword | Exact count | Approx. density | Title | H1 | Description | Relevant headings | Internal links | Close variants present |',
  '|---|---:|---|---:|---:|---|---|---|---|---|---|',
];
for (const [route, primary] of primaryByRoute) {
  const page = await inspectPage(route);
  const count = exactCount(page.visibleText, primary);
  const group = [...groups.entries()].find(([, keywords]) => keywords[0] === primary)?.[1] ?? [];
  const variants = group.filter((keyword) => keyword !== primary && exactCount(page.visibleText, keyword) > 0).slice(0, 8);
  densityLines.push(`| ${escapeCell(route)} | ${page.words} | ${escapeCell(primary)} | ${count} | ${(page.words ? count / page.words * 100 : 0).toFixed(2)}% | ${escapeCell(page.title)} | ${escapeCell(page.h1)} | ${escapeCell(page.description)} | ${escapeCell(page.headings.slice(0, 8).join('; '))} | ${escapeCell(page.links.slice(0, 8).join('; '))} | ${escapeCell(variants.join('; ') || 'Semantic variants only')} |`);
}
densityLines.push('', '## Interpretation', '', '- Exact-match absence is not treated as a defect when the page already covers the intent naturally.', '- Long-tail phrases are architecture inputs, not a checklist to paste into body copy.', '- Tool pages own transactional clusters; the homepage owns broad SoraFiles, privacy, PDF-tool, and image-tool concepts.', '- No hidden keyword text was added.', '');
await writeFile(new URL('SEO_KEYWORD_DENSITY_REPORT.md', root), densityLines.join('\n'));

console.log(`Mapped ${seen.size} unique phrases from ${numberedCount} numbered entries across ${new Set(keywordRows.map((row) => row[2])).size} canonical pages.`);
