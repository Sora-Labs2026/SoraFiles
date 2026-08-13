import { readFile, readdir } from 'node:fs/promises';
import { tools } from '../src/data/tools.ts';
import { publishedLocales } from '../src/i18n/config.ts';
import {
  attribute,
  descendants,
  discoveryVisibilityFailures,
  elementsWithData,
  hasAttribute,
  identifiedDisclosureContract,
  parseHtml,
  textContent,
  toolCardLinkContract,
  visibleTextContent,
} from './lib/built-html-contract.mjs';
import { missingTextRequirements, spanishHomepageOcrRequirements } from './lib/ocr-disclosure-contract.mjs';

const allPages = process.argv.includes('--all');
const failures = [];
const origin = 'https://sorafiles.com';
const popularWorkflows = [
  { slug: 'compress-pdf', path: '/pdf' },
  { slug: 'compress-image', path: '/compress-image' },
  { slug: 'image-converter', path: '/image-converter' },
  { slug: 'merge-pdf', path: '/merge-pdf' },
  { slug: 'pdf-to-jpg', path: '/pdf-to-jpg' },
  { slug: 'jpg-to-pdf', path: '/jpg-to-pdf' },
];
const representativeHomes = [
  {
    label: 'home', locale: 'en', prefix: '', path: 'dist/index.html', expectedFaqCount: 11,
    ocrTruth: [/scanned pages can (?:use|be recognized with) local OCR/iu, /scan (?:clarity|quality)/iu, /language/iu, /handwriting/iu, /tables/iu, /columns/iu, /layout (?:reconstruction|reproduction)/iu],
  },
  {
    label: 'es home', locale: 'es', prefix: '/es', path: 'dist/es/index.html', expectedFaqCount: 4,
    ocrTruth: spanishHomepageOcrRequirements,
  },
  {
    label: 'ja home', locale: 'ja', prefix: '/ja', path: 'dist/ja/index.html', expectedFaqCount: 6,
    ocrTruth: [/スキャンPDF.*(?:端末内|ローカル)OCR.*使用/iu, /鮮明/iu, /言語/iu, /手書き/iu, /表/iu, /段組み/iu, /(?:レイアウト|ページ配置).*(?:再現|復元)/iu],
  },
  {
    label: 'ar home', locale: 'ar', prefix: '/ar', path: 'dist/ar/index.html', expectedFaqCount: 3,
    ocrTruth: [/للصفحات الممسوحة.*OCR محل/iu, /وضوح المسح/iu, /اللغة/iu, /الكتابة اليدوية/iu, /الجداول/iu, /الأعمدة/iu, /إعادة بناء (?:دقيقة )?للتخطيط/iu],
  },
];

const pdfToWordContracts = {
  en: { forbidden: /\bno OCR\b/iu, required: [/scanned pages.*(?:local OCR|recognized locally with OCR)/iu, /scan clarity/iu, /language/iu, /handwriting/iu, /tables/iu, /columns/iu, /exact (?:page )?layout/iu] },
  ja: { forbidden: /OCRは含まれず|OCRが必要/iu, required: [/スキャン.*(?:端末内|ローカル)OCR/iu, /鮮明/iu, /言語/iu, /手書き/iu, /表/iu, /段組み/iu, /正確な(?:ページ)?(?:配置|レイアウト).*再現/iu] },
  ko: { forbidden: /OCR.*제공하지/iu, required: [/스캔.*로컬 OCR/iu, /선명도/iu, /언어/iu, /필기/iu, /표/iu, /단/iu, /정확한 레이아웃.*재현/iu] },
  es: { forbidden: /No incluye OCR/iu, required: [/páginas escaneadas.*OCR local/iu, /claridad/iu, /idioma/iu, /(?:escritura a mano|manuscrit)/iu, /tablas/iu, /columnas/iu, /diseño exacto.*(?:reconstru|reproduc)/iu] },
  fr: { forbidden: /Aucun OCR/iu, required: [/pages numérisées.*OCR local/iu, /netteté/iu, /langue/iu, /écriture manuscrite/iu, /tableaux/iu, /colonnes/iu, /mise en page exacte.*(?:reconstru|reprodu)/iu] },
  de: { forbidden: /Kein OCR/iu, required: [/gescannte Seiten.*lokal(?:e|en|er|es)? OCR/iu, /Scanqualität/iu, /Sprache/iu, /Handschrift/iu, /Tabellen/iu, /Spalten/iu, /exakte.*Layout.*(?:rekonstruiert|wiederhergestellt)/iu] },
  pt: { forbidden: /Sem OCR/iu, required: [/páginas digitalizadas.*OCR local/iu, /nitidez/iu, /idioma/iu, /escrita (?:manual|à mão)/iu, /tabelas/iu, /colunas/iu, /layout exato.*reconstru/iu] },
  'zh-cn': { forbidden: /不含\s*OCR/iu, required: [/扫描页.*本地\s*OCR/iu, /清晰度/iu, /语言/iu, /手写/iu, /表格/iu, /分栏/iu, /不会.*精确.*重建.*版式/iu] },
  'zh-tw': { forbidden: /不含\s*OCR/iu, required: [/掃描頁.*本機\s*OCR/iu, /清晰度/iu, /語言/iu, /手寫/iu, /表格/iu, /分欄/iu, /不會.*精確.*重建.*版面/iu] },
  hi: { forbidden: /OCR.*शामिल नहीं/iu, required: [/स्कैन.*लोकल OCR/iu, /स्पष्टता/iu, /भाषा/iu, /लिखावट/iu, /तालिक/iu, /कॉलम/iu, /सटीक लेआउट.*पुनर्निर्म/iu] },
  ar: { forbidden: /لا يتضمن\s*OCR/iu, required: [/الصفحات الممسوحة.*OCR محلي/iu, /وضوح المسح/iu, /اللغة/iu, /الكتابة اليدوية/iu, /الجداول/iu, /الأعمدة/iu, /إعادة بناء دقيقة للتخطيط/iu] },
  ru: { forbidden: /Без OCR/iu, required: [/сканированн.*локальн.*OCR/iu, /качества скана/iu, /языка/iu, /почерка/iu, /таблиц/iu, /колонок/iu, /точн.*макет.*восстан/iu] },
  id: { forbidden: /Tanpa OCR/iu, required: [/halaman (?:hasil )?pindai.*OCR lokal/iu, /kejernihan/iu, /bahasa/iu, /tulisan tangan/iu, /tabel/iu, /kolom/iu, /tata letak tepat.*direkonstruksi/iu] },
  it: { forbidden: /Senza OCR/iu, required: [/pagine scansionate.*OCR locale/iu, /nitidezza/iu, /lingua/iu, /scrittura a mano/iu, /tabelle/iu, /colonne/iu, /layout esatto.*ricostru/iu] },
  nl: { forbidden: /Geen OCR/iu, required: [/gescande pagina.*lokale OCR/iu, /scherpte/iu, /taal/iu, /handschrift/iu, /tabellen/iu, /kolommen/iu, /exacte lay-out.*gereconstrueerd/iu] },
  tr: { forbidden: /\bOCR (?:desteği )?yok(?:tur)?\b/iu, required: [/taranmış sayfa.*yerel OCR/iu, /tarama netliği/iu, /dil/iu, /el yazısı/iu, /tablolar/iu, /sütunlar/iu, /tam düzen.*yeniden oluştur/iu] },
  vi: { forbidden: /Không có OCR/iu, required: [/trang quét.*OCR cục bộ/iu, /độ rõ/iu, /ngôn ngữ/iu, /chữ viết tay/iu, /bảng/iu, /cột/iu, /bố cục chính xác.*tái tạo/iu] },
  th: { forbidden: /ไม่มี OCR/iu, required: [/หน้าที่สแกน.*OCR ในเครื่อง/iu, /ความชัด/iu, /ภาษา/iu, /ลายมือ/iu, /ตาราง/iu, /คอลัมน์/iu, /ไม่มี.*สร้าง.*เลย์เอาต์ที่แม่นยำ/iu] },
  pl: { forbidden: /Bez OCR/iu, required: [/zeskanowane strony.*lokaln.*OCR/iu, /czytelności skanu/iu, /języka/iu, /pisma odręcznego/iu, /tabel/iu, /kolumn/iu, /dokładn.*układ.*odtwarz/iu] },
};

const elementsByTag = (document, tagName) => descendants(document, (node) => node.tagName === tagName);
const localizedHref = (prefix, path) => `${prefix}${path}` || '/';

function ancestor(node, tagName) {
  let candidate = node?.parentNode;
  while (candidate) {
    if (candidate.tagName === tagName) return candidate;
    candidate = candidate.parentNode;
  }
}

function schemasFrom(document, pageLabel) {
  const schemas = [];
  for (const script of elementsByTag(document, 'script').filter((node) => attribute(node, 'type') === 'application/ld+json')) {
    try {
      const parsed = JSON.parse(textContent(script));
      schemas.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch (error) {
      failures.push(`${pageLabel}: invalid JSON-LD (${error.message}).`);
    }
  }
  return schemas.flatMap((schema) => Array.isArray(schema?.['@graph']) ? schema['@graph'] : [schema]);
}

async function validateHomepage(home) {
  const html = await readFile(home.path, 'utf8');
  const document = parseHtml(html);
  const text = visibleTextContent(document);
  const schemas = schemasFrom(document, home.label);
  const h1Count = elementsByTag(document, 'h1').length;
  if (h1Count !== 1) failures.push(`${home.label}: expected one H1, found ${h1Count}.`);

  const expectedCanonical = `${origin}${home.prefix}/`;
  const canonical = elementsByTag(document, 'link').find((node) => attribute(node, 'rel') === 'canonical');
  if (attribute(canonical, 'href') !== expectedCanonical) failures.push(`${home.label}: expected canonical ${expectedCanonical}, found ${attribute(canonical, 'href') ?? 'none'}.`);

  const alternates = new Map(elementsByTag(document, 'link')
    .filter((node) => attribute(node, 'rel') === 'alternate' && hasAttribute(node, 'hreflang'))
    .map((node) => [attribute(node, 'hreflang'), attribute(node, 'href')]));
  const expectedAlternates = new Map([
    ...publishedLocales.map((locale) => [locale.code, `${origin}${locale.path === 'en' ? '/' : `/${locale.path}/`}`]),
    ['x-default', `${origin}/`],
  ]);
  if (alternates.size !== expectedAlternates.size) failures.push(`${home.label}: expected ${expectedAlternates.size} reciprocal hreflang links, found ${alternates.size}.`);
  for (const [hreflang, href] of expectedAlternates) if (alternates.get(hreflang) !== href) failures.push(`${home.label}: hreflang ${hreflang} must point to ${href}.`);

  const anchors = elementsByTag(document, 'a');
  const hrefs = new Set(anchors.map((node) => attribute(node, 'href')?.replace(/\/$/, '')).filter(Boolean));
  for (const tool of tools) {
    const expectedHref = localizedHref(home.prefix, tool.href);
    if (!hrefs.has(expectedHref)) failures.push(`${home.label}: missing crawlable ${expectedHref} tool link.`);
  }

  const renderedWorkflows = elementsWithData(document, 'data-popular-workflow').map((node) => ({
    slug: attribute(node, 'data-tool-slug'), href: attribute(node, 'href'),
  }));
  const expectedWorkflows = popularWorkflows.map((workflow) => ({ slug: workflow.slug, href: localizedHref(home.prefix, workflow.path) }));
  if (JSON.stringify(renderedWorkflows) !== JSON.stringify(expectedWorkflows)) failures.push(`${home.label}: popular workflows must contain the six locale-prefixed routes in catalog order.`);

  const toolCardLinks = toolCardLinkContract(document);
  if (toolCardLinks.cardCount !== tools.length) failures.push(`${home.label}: expected ${tools.length} descriptive tool-card anchors, found ${toolCardLinks.cardCount}.`);
  for (const failure of toolCardLinks.failures) failures.push(`${home.label}: ${failure}.`);

  const itemList = schemas.find((item) => item?.['@type'] === 'ItemList');
  if (!itemList || itemList.itemListElement?.length !== tools.length) failures.push(`${home.label}: ItemList must contain all ${tools.length} tools.`);
  else itemList.itemListElement.forEach((item, index) => {
    const expectedUrl = `${origin}${localizedHref(home.prefix, tools[index].href)}`;
    if (item.url !== expectedUrl) failures.push(`${home.label}: ItemList item ${index + 1} must use ${expectedUrl}.`);
  });

  const faq = schemas.find((item) => item?.['@type'] === 'FAQPage');
  const faqHeading = elementsByTag(document, 'h2').find((node) => attribute(node, 'id') === 'tool-faq-heading');
  const faqSection = ancestor(faqHeading, 'section');
  const visibleFaqs = faqSection ? descendants(faqSection, (node) => node.tagName === 'details').map((details) => ({
    question: textContent(descendants(details, (node) => node.tagName === 'summary')[0]),
    answer: textContent(descendants(details, (node) => node.tagName === 'p')[0]),
  })) : [];
  if (!faq?.mainEntity?.length) failures.push(`${home.label}: FAQPage schema is missing or empty.`);
  if (visibleFaqs.length !== home.expectedFaqCount) failures.push(`${home.label}: visible FAQ count must match the locale catalog count ${home.expectedFaqCount}.`);
  if (visibleFaqs.length !== faq?.mainEntity?.length) failures.push(`${home.label}: visible FAQ count must match FAQPage schema.`);
  for (const [index, question] of (faq?.mainEntity ?? []).entries()) {
    if (visibleFaqs[index]?.question !== question.name || visibleFaqs[index]?.answer !== question.acceptedAnswer?.text) failures.push(`${home.label}: visible FAQ ${index + 1} must match its JSON-LD entity.`);
  }
  if (home.locale === 'en') {
    for (const requirement of ['Contact form', 'name, email address, subject, message, and any optional attachment', 'FormSubmit', 'Sora Labs', 'not part of the local file-tool flow']) {
      if (!visibleFaqs[0]?.answer.includes(requirement)) failures.push(`home: homepage privacy FAQ must disclose ${requirement}.`);
    }
  }

  const hero = elementsWithData(document, 'data-home-hero')[0];
  if (hero && descendants(hero, (node) => node.tagName === 'input' && attribute(node, 'type')?.toLowerCase() === 'file').length) failures.push(`${home.label}: hero must not contain a file input.`);

  const ocrDisclosure = identifiedDisclosureContract(document, 'data-home-ocr-disclosure');
  if (ocrDisclosure.count !== 1) failures.push(`${home.label}: expected one identified static OCR disclosure, found ${ocrDisclosure.count}.`);
  if (ocrDisclosure.count === 1 && !ocrDisclosure.visible) failures.push(`${home.label}: identified static OCR disclosure must be effectively visible.`);
  for (const requirement of missingTextRequirements(ocrDisclosure.text, home.ocrTruth)) failures.push(`${home.label}: incomplete identified OCR disclosure (${requirement}).`);

  for (const failure of discoveryVisibilityFailures(document)) failures.push(`${home.label}: ${failure}.`);
}

async function validatePdfToWordPages() {
  for (const locale of publishedLocales) {
    const prefix = locale.path === 'en' ? '' : `/${locale.path}`;
    const path = `dist${prefix}/pdf-to-word/index.html`;
    const label = `${locale.path} PDF-to-Word`;
    const document = parseHtml(await readFile(path, 'utf8'));
    const pageText = visibleTextContent(document);
    const contract = pdfToWordContracts[locale.path];
    if (contract.forbidden.test(pageText)) failures.push(`${label}: stale negative OCR copy remains on the built page.`);
    const disclosure = identifiedDisclosureContract(document, 'data-pdf-to-word-ocr-disclosure');
    if (disclosure.count !== 1) failures.push(`${label}: expected one visible OCR disclosure, found ${disclosure.count}.`);
    if (disclosure.count === 1 && !disclosure.visible) failures.push(`${label}: identified OCR disclosure must be effectively visible.`);
    for (const requirement of missingTextRequirements(disclosure.text, contract.required)) failures.push(`${label}: incomplete OCR capability or limitation disclosure (${requirement}).`);
  }
}

async function validateRepresentativeHomes() {
  for (const home of representativeHomes) await validateHomepage(home);
  const rootDocument = parseHtml(await readFile('dist/index.html', 'utf8'));
  const rootText = visibleTextContent(rootDocument);
  if (!rootText.includes('Instant, free PDF & image tools.')) failures.push('home: missing the exact instant-access value statement.');
  if (!rootText.includes('Your browser is the processing room.')) failures.push('home: missing visible local-processing proof.');
  const website = schemasFrom(rootDocument, 'home').find((item) => item?.['@type'] === 'WebSite');
  if (website?.name !== 'Sora Files') failures.push('home: WebSite schema must name Sora Files.');
}

async function validateAllPages() {
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) files.push(...await walk(path));
      else if (entry.name === 'index.html') files.push(path);
    }
    return files;
  };
  for (const path of await walk('dist')) {
    const document = parseHtml(await readFile(path, 'utf8'));
    const label = path.replace(/^dist\//, '');
    const h1Count = elementsByTag(document, 'h1').length;
    if (h1Count !== 1) failures.push(`${label}: expected one H1, found ${h1Count}.`);
    if (!elementsByTag(document, 'title').some((node) => textContent(node))) failures.push(`${label}: missing title.`);
    if (!elementsByTag(document, 'meta').some((node) => attribute(node, 'name') === 'description' && attribute(node, 'content'))) failures.push(`${label}: missing meta description.`);
    if (!elementsByTag(document, 'link').some((node) => attribute(node, 'rel') === 'canonical')) failures.push(`${label}: missing canonical.`);
  }
}

await validateRepresentativeHomes();
await validatePdfToWordPages();
if (allPages) await validateAllPages();

if (failures.length > 0) {
  console.error(`Built SEO validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Built SEO validation passed${allPages ? ' for all generated pages' : ' for representative homepages and all localized PDF-to-Word pages'}.`);
