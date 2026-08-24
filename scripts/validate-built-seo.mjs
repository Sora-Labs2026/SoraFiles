import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { liveTools } from '../src/data/liveTools.ts';
import { localeDefinitions, localizedPath, localizedRoutePaths, publishedLocales } from '../src/i18n/config.ts';

const allPages = process.argv.includes('--all');
const failures = [];
const siteUrl = 'https://sorafiles.com';
const localePaths = new Set(publishedLocales.map((locale) => locale.path));
const hreflangs = new Set([...publishedLocales.map((locale) => locale.code), 'x-default']);
const toolBasePaths = new Set(liveTools.map((tool) => `/${tool.slug}`));
const titleIndex = new Map();
const descriptionIndex = new Map();

const decodeHtml = (value = '') => value
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#(?:x27|39);/gi, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const plainText = (html) => decodeHtml(html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim());

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) result[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? '');
  return result;
}

function tags(html, name) {
  return Array.from(html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi')), (match) => ({ tag: match[0], attributes: attributes(match[0]) }));
}

function schemasFrom(html, pageLabel) {
  const schemas = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]));
      schemas.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch (error) {
      failures.push(`${pageLabel}: invalid JSON-LD (${error.message}).`);
    }
  }
  return schemas.flatMap((schema) => Array.isArray(schema?.['@graph']) ? schema['@graph'] : [schema]);
}

function routeFromFile(file) {
  const relative = path.relative('dist', file).replaceAll('\\', '/');
  if (relative === 'index.html') return '/';
  if (relative === '404.html') return '/404';
  return `/${relative.replace(/\/index\.html$/, '').replace(/\.html$/, '')}`;
}

function routeContext(route) {
  const segments = route.split('/').filter(Boolean);
  const locale = segments.length && localePaths.has(segments[0]) && segments[0] !== 'en' ? segments.shift() : 'en';
  const base = segments.length ? `/${segments.join('/')}` : '/';
  return { locale, base };
}

function indexMetadata(index, locale, value, route) {
  if (!value) return;
  const key = `${locale}\0${value.trim().toLocaleLowerCase(locale === 'zh-cn' || locale === 'zh-tw' ? 'zh' : locale)}`;
  const matches = index.get(key) ?? [];
  matches.push(route);
  index.set(key, matches);
}

function validateSchemas(text, label, locale, baseRoute, schemas) {
  for (const schema of schemas) {
    if (!schema || typeof schema !== 'object') continue;
    if (schema['@type'] === 'Organization' && schema.name !== 'Sora Labs') failures.push(`${label}: Organization schema must name Sora Labs.`);
    if (schema['@type'] === 'WebSite' && schema.name !== 'SoraFiles') failures.push(`${label}: WebSite schema must name SoraFiles.`);
    if (['WebApplication', 'SoftwareApplication'].includes(schema['@type'])) failures.push(`${label}: review-gated SoftwareApplication markup must not be published without genuine reviews.`);
    if (schema['@type'] === 'FAQPage') {
      for (const question of schema.mainEntity ?? []) if (question?.name && !text.includes(decodeHtml(question.name))) failures.push(`${label}: FAQ schema question is not visible: ${question.name}`);
    }
  }

  if (baseRoute === '/') {
    const website = schemas.find((item) => item?.['@type'] === 'WebSite');
    const organization = schemas.find((item) => item?.['@type'] === 'Organization');
    const itemList = schemas.find((item) => item?.['@type'] === 'ItemList');
    const collection = schemas.find((item) => item?.['@type'] === 'CollectionPage');
    if (locale === 'en' && (!website || website.name !== 'SoraFiles')) failures.push(`${label}: canonical homepage WebSite schema is missing.`);
    if (locale === 'en' && JSON.stringify(website?.alternateName) !== JSON.stringify(['sorafiles.com'])) failures.push(`${label}: canonical homepage WebSite alternateName is incomplete.`);
    if (locale === 'en' && (!organization || organization.name !== 'Sora Labs')) failures.push(`${label}: canonical homepage Organization schema is missing.`);
    if (locale !== 'en' && (!collection || collection.inLanguage !== localeDefinitions.find((item) => item.path === locale)?.code)) failures.push(`${label}: localized homepage CollectionPage schema is missing or has the wrong language.`);
    if (!itemList || itemList.itemListElement?.length !== liveTools.length) failures.push(`${label}: homepage ItemList must contain all ${liveTools.length} tools.`);
    for (const item of itemList?.itemListElement ?? []) if (item?.name && !text.includes(decodeHtml(item.name))) failures.push(`${label}: ItemList fact is not visible: ${item.name}`);
  } else if (toolBasePaths.has(baseRoute)) {
    if (!schemas.some((item) => item?.['@type'] === 'WebPage')) failures.push(`${label}: tool page is missing WebPage schema.`);
    if (!schemas.some((item) => item?.['@type'] === 'BreadcrumbList')) failures.push(`${label}: tool page is missing BreadcrumbList schema.`);
  }
}

async function htmlFiles() {
  const walk = async (directory) => {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await walk(file));
      else if (entry.isFile() && entry.name.endsWith('.html')) files.push(file);
    }
    return files;
  };
  return walk('dist');
}

async function validatePage(file) {
  const html = await readFile(file, 'utf8');
  const route = routeFromFile(file);
  const label = route;
  if (html.includes('Sora Files') || html.includes('Sora-Files')) failures.push(`${label}: public brand text must use SoraFiles without spaces or hyphens.`);
  const charset = /<meta\s+charset=["']utf-8["'][^>]*>/i.exec(html);
  if (!charset) failures.push(`${label}: missing UTF-8 character encoding declaration.`);
  else if (Buffer.byteLength(html.slice(0, charset.index + charset[0].length), 'utf8') > 1024) failures.push(`${label}: UTF-8 character encoding declaration must be completely within the first 1024 bytes.`);
  const text = plainText(html);
  const { locale, base } = routeContext(route);
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  if (route === '/404' ? h1Count !== 0 : h1Count !== 1) failures.push(`${label}: unexpected H1 count ${h1Count}.`);
  if ((html.match(/<title\b/gi) ?? []).length !== 1 || !/<title>[^<]+<\/title>/i.test(html)) failures.push(`${label}: expected one non-empty title.`);

  const metas = tags(html, 'meta');
  const descriptions = metas.filter(({ attributes: attrs }) => attrs.name === 'description' && attrs.content?.trim());
  if (descriptions.length !== 1) failures.push(`${label}: expected one non-empty meta description.`);
  const robots = metas.find(({ attributes: attrs }) => attrs.name === 'robots')?.attributes.content ?? '';
  const noIndex = /\bnoindex\b/i.test(robots);
  if (!noIndex && !/\bindex\b/i.test(robots)) failures.push(`${label}: indexable page is missing an explicit index directive.`);
  if (metas.find(({ attributes: attrs }) => attrs.property === 'og:site_name')?.attributes.content !== 'SoraFiles') failures.push(`${label}: og:site_name must be SoraFiles.`);
  const socialTitle = metas.find(({ attributes: attrs }) => attrs.property === 'og:title')?.attributes.content ?? '';
  if (!socialTitle) failures.push(`${label}: OpenGraph title is missing.`);
  if (/[–—]/.test(socialTitle)) failures.push(`${label}: OpenGraph title must use parser-safe ASCII punctuation.`);

  const links = tags(html, 'link');
  const canonicals = links.filter(({ attributes: attrs }) => attrs.rel === 'canonical');
  if (canonicals.length !== 1) failures.push(`${label}: expected exactly one canonical link.`);
  const canonical = canonicals[0]?.attributes.href;
  if (canonical) {
    try {
      const parsed = new URL(canonical);
      if (parsed.protocol !== 'https:' || parsed.host !== 'sorafiles.com' || parsed.search || parsed.hash) failures.push(`${label}: canonical is not a clean HTTPS sorafiles.com URL.`);
    } catch {
      failures.push(`${label}: canonical URL is invalid.`);
    }
  }

  if (!noIndex) {
    const title = decodeHtml(html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '');
    indexMetadata(titleIndex, locale, title, route);
    indexMetadata(descriptionIndex, locale, descriptions[0]?.attributes.content ?? '', route);
    const expectedCanonical = new URL(localizedPath(locale, base), siteUrl).toString();
    if (canonical !== expectedCanonical) failures.push(`${label}: canonical ${canonical} does not match ${expectedCanonical}.`);
    const alternates = links.filter(({ attributes: attrs }) => attrs.rel === 'alternate' && attrs.hreflang);
    const actualHreflangs = new Set(alternates.map(({ attributes: attrs }) => attrs.hreflang));
    if (alternates.length !== hreflangs.size || actualHreflangs.size !== hreflangs.size || [...hreflangs].some((code) => !actualHreflangs.has(code))) failures.push(`${label}: hreflang cluster must contain all ${hreflangs.size} unique languages including x-default.`);
    for (const alternate of alternates) {
      const code = alternate.attributes.hreflang;
      const localeDefinition = publishedLocales.find((item) => item.code === code);
      const expected = code === 'x-default' ? new URL(base, siteUrl).toString() : new URL(localizedPath(localeDefinition.path, base), siteUrl).toString();
      if (alternate.attributes.href !== expected) failures.push(`${label}: hreflang ${code} points to ${alternate.attributes.href}, expected ${expected}.`);
    }
    const htmlTag = tags(html, 'html')[0]?.attributes ?? {};
    const localeDefinition = localeDefinitions.find((item) => item.path === locale);
    if (htmlTag.lang !== localeDefinition?.code || (htmlTag.dir || 'ltr') !== localeDefinition?.direction) failures.push(`${label}: html lang/dir does not match locale ${locale}.`);
    validateSchemas(text, label, locale, base, schemasFrom(html, label));
  } else if (!['/404', '/heic'].includes(route)) {
    failures.push(`${label}: unexpected noindex page.`);
  }
}

async function validateInternalLinks(files) {
  const publicRoutes = new Set(files.map(routeFromFile));
  const html = await readFile('dist/index.html', 'utf8');
  const hrefs = new Set(tags(html, 'a').map(({ attributes: attrs }) => attrs.href?.replace(/\/$/, '')).filter(Boolean));
  for (const tool of liveTools) {
    const href = `/${tool.slug}`;
    if (!hrefs.has(href)) failures.push(`/: missing crawlable ${href} tool link.`);
  }

  for (const file of files) {
    const route = routeFromFile(file);
    const page = await readFile(file, 'utf8');
    for (const { attributes: attrs } of tags(page, 'a')) {
      const href = attrs.href?.trim();
      if (!href || href.startsWith('#') || /^(?:mailto:|tel:|data:|javascript:)/i.test(href)) continue;
      let target;
      try {
        target = new URL(href, `${siteUrl}${route === '/' ? '/' : `${route}/`}`);
      } catch {
        failures.push(`${route}: invalid link ${href}.`);
        continue;
      }
      if (target.origin !== siteUrl) continue;
      const pathname = decodeURIComponent(target.pathname).replace(/\/$/, '') || '/';
      if (!publicRoutes.has(pathname)) failures.push(`${route}: broken internal link ${href} -> ${pathname}.`);
    }
  }
}

function validateMetadataUniqueness() {
  for (const [key, routes] of titleIndex) {
    if (routes.length > 1) failures.push(`duplicate title within ${key.split('\0')[0]}: ${routes.join(', ')}.`);
  }
  for (const [key, routes] of descriptionIndex) {
    if (routes.length > 1) failures.push(`duplicate description within ${key.split('\0')[0]}: ${routes.join(', ')}.`);
  }
}

async function validateSitemapAndRobots() {
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  const entries = Array.from(sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g), (match) => {
    const block = match[1];
    return {
      loc: decodeHtml(block.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? ''),
      lastmod: block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? '',
      alternates: tags(block, 'xhtml:link').map(({ attributes: attrs }) => ({
        rel: attrs.rel,
        hreflang: attrs.hreflang,
        href: attrs.href,
      })),
    };
  });
  const expectedByUrl = new Map();
  for (const route of localizedRoutePaths) {
    const alternates = new Map(publishedLocales.map((locale) => [
      locale.code,
      new URL(localizedPath(locale.path, route), siteUrl).toString(),
    ]));
    alternates.set('x-default', new URL(localizedPath('en', route), siteUrl).toString());
    for (const locale of publishedLocales) {
      expectedByUrl.set(new URL(localizedPath(locale.path, route), siteUrl).toString(), alternates);
    }
  }
  const expectedUrls = [...expectedByUrl.keys()];
  const expectedSet = new Set(expectedUrls);
  const actualSet = new Set(entries.map((entry) => entry.loc));
  if (!sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"')) failures.push('sitemap: xhtml namespace for hreflang alternates is missing.');
  if (entries.length !== expectedUrls.length || actualSet.size !== expectedSet.size) failures.push(`sitemap: expected ${expectedUrls.length} unique URLs, found ${entries.length}/${actualSet.size}.`);
  for (const url of expectedSet) if (!actualSet.has(url)) failures.push(`sitemap: missing ${url}.`);
  for (const url of actualSet) if (!expectedSet.has(url)) failures.push(`sitemap: unexpected ${url}.`);
  for (const entry of entries) {
    if (entry.lastmod) {
      const today = new Date().toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod) || entry.lastmod > today) failures.push(`sitemap: invalid or future lastmod for ${entry.loc}.`);
    }
    const expectedAlternates = expectedByUrl.get(entry.loc);
    if (!expectedAlternates) continue;
    const actualHreflangs = new Set(entry.alternates.map((alternate) => alternate.hreflang));
    if (entry.alternates.length !== hreflangs.size || actualHreflangs.size !== hreflangs.size || [...hreflangs].some((code) => !actualHreflangs.has(code))) {
      failures.push(`sitemap: ${entry.loc} must contain all ${hreflangs.size} unique reciprocal hreflang links.`);
      continue;
    }
    for (const alternate of entry.alternates) {
      if (alternate.rel !== 'alternate' || alternate.href !== expectedAlternates.get(alternate.hreflang)) {
        failures.push(`sitemap: ${entry.loc} has an invalid ${alternate.hreflang || 'missing'} alternate ${alternate.href || 'missing'}.`);
      }
    }
    if (!entry.alternates.some((alternate) => alternate.hreflang !== 'x-default' && alternate.href === entry.loc)) failures.push(`sitemap: ${entry.loc} is missing its self-referential hreflang link.`);
  }

  const robots = await readFile('dist/robots.txt', 'utf8');
  const groups = new Map(robots.replaceAll('\r\n', '\n').trim().split(/\n\s*\n/).flatMap((block) => {
    const agent = block.match(/^User-agent:\s*(.+)$/im)?.[1]?.trim();
    return agent ? [[agent, block]] : [];
  }));
  for (const agent of ['*', 'Googlebot-Image', 'OAI-SearchBot', 'PerplexityBot']) {
    const group = groups.get(agent) ?? '';
    if (!group) failures.push(`robots: missing ${agent} user-agent group.`);
    if (!/^Allow:\s*\/$/im.test(group)) failures.push(`robots: ${agent} is missing the explicit public root allow rule.`);
    if (!/^Disallow:\s*\/__locale$/im.test(group)) failures.push(`robots: ${agent} does not exclude the internal locale endpoint.`);
  }
  if ((robots.match(/^Sitemap:\s*https:\/\/sorafiles\.com\/sitemap\.xml$/gim) ?? []).length !== 1) failures.push('robots: expected exactly one canonical sitemap declaration.');
  if (/^Disallow:\s*\/$/im.test(robots)) failures.push('robots: site-wide crawling is blocked.');
  if (/^(?:Crawl-delay|Host):/im.test(robots)) failures.push('robots: nonportable crawl-delay or Host directive must not be used.');
}

const generatedHtmlFiles = await htmlFiles();
await validateInternalLinks(generatedHtmlFiles);
await validateSitemapAndRobots();
if (allPages) {
  for (const file of generatedHtmlFiles) await validatePage(file);
  validateMetadataUniqueness();
} else {
  await validatePage('dist/index.html');
}

if (failures.length > 0) {
  console.error(`Built SEO/GEO validation failed:\n- ${failures.slice(0, 200).join('\n- ')}${failures.length > 200 ? `\n- …and ${failures.length - 200} more` : ''}`);
  process.exit(1);
}

console.log(`Built SEO/GEO validation passed${allPages ? ' for all generated pages, canonicals, HTML and sitemap hreflang clusters, sitemap URLs, robots, and visible structured-data facts' : ' for the homepage'}.`);
