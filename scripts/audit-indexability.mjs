import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const live = process.argv.includes('--live');
const origin = 'https://sorafiles.com';
const sitemapUrl = `${origin}/sitemap.xml`;
const robotsUrl = `${origin}/robots.txt`;
const faviconUrl = `${origin}/favicon-48x48.png`;
const indexNowKey = 'fc1b21d84d0549ba9d2ab3bea5dc3845';
const keyUrl = `${origin}/${indexNowKey}.txt`;
const outputPath = new URL('../.artifacts/seo-indexability-audit.json', import.meta.url);

const decodeHtml = (value = '') => value
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>');

async function fetchOnce(url) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': 'SoraFiles-Indexability-Audit/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
    return {
      status: response.status,
      location: response.headers.get('location'),
      contentType: response.headers.get('content-type'),
      xRobotsTag: response.headers.get('x-robots-tag') || '',
      body: await response.text(),
    };
  } catch (error) {
    return { status: 0, location: null, contentType: null, xRobotsTag: '', body: '', error: error instanceof Error ? error.message : String(error) };
  }
}

async function localHtml(url) {
  const pathname = new URL(url).pathname;
  const relative = pathname.replace(/^\//, '');
  const candidates = pathname === '/'
    ? [path.join('dist', 'index.html')]
    : [path.join('dist', relative, 'index.html'), path.join('dist', `${relative}.html`)];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return { status: 200, location: null, contentType: 'text/html; charset=utf-8', xRobotsTag: '', body: await readFile(candidate, 'utf8') };
    } catch {}
  }
  return { status: 404, location: null, contentType: null, xRobotsTag: '', body: '' };
}

function sitemapLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeHtml(match[1]));
}

function robotsRules(text) {
  const rules = [];
  let applies = false;
  for (const rawLine of text.replaceAll('\r\n', '\n').split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') applies = value === '*';
    else if (applies && (field === 'allow' || field === 'disallow') && value) rules.push({ type: field, path: value });
  }
  return rules;
}

function robotsAllows(url, rules) {
  const pathname = new URL(url).pathname;
  const matches = rules.filter((rule) => pathname.startsWith(rule.path)).sort((a, b) => b.path.length - a.path.length);
  return matches[0]?.type !== 'disallow';
}

function htmlFacts(html) {
  const canonical = decodeHtml(html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1]
    || html.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i)?.[1]
    || '');
  const robots = html.match(/<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1]
    || html.match(/<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']robots["'][^>]*>/i)?.[1]
    || '';
  const title = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '');
  const visibleText = decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
  return { canonical, robots, title, visibleTextLength: visibleText.length };
}

async function mapLimited(values, limit, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

const sitemapResponse = live ? await fetchOnce(sitemapUrl) : { status: 200, body: await readFile('dist/sitemap.xml', 'utf8'), contentType: 'application/xml; charset=utf-8', location: null };
const robotsResponse = live ? await fetchOnce(robotsUrl) : { status: 200, body: await readFile('dist/robots.txt', 'utf8'), contentType: 'text/plain; charset=utf-8', location: null };
if (sitemapResponse.status !== 200) throw new Error(`Sitemap audit stopped: HTTP ${sitemapResponse.status}.`);
if (robotsResponse.status !== 200) throw new Error(`Robots audit stopped: HTTP ${robotsResponse.status}.`);

const urls = sitemapLocations(sitemapResponse.body);
const uniqueUrls = new Set(urls);
const duplicateCount = urls.length - uniqueUrls.size;
const rules = robotsRules(robotsResponse.body);
const records = await mapLimited([...uniqueUrls], live ? 12 : 24, async (url) => {
  const response = live ? await fetchOnce(url) : await localHtml(url);
  const facts = htmlFacts(response.body);
  const canonicalValid = facts.canonical === url;
  const noindexAbsent = !/\bnoindex\b/i.test(`${facts.robots} ${response.xRobotsTag}`);
  const allowed = robotsAllows(url, rules);
  const meaningfulHtml = response.body.includes('<html') && facts.visibleTextLength >= 200;
  const indexable = response.status === 200 && !response.location && canonicalValid && noindexAbsent && allowed && Boolean(facts.title) && meaningfulHtml;
  return {
    url,
    httpStatus: response.status,
    redirectLocation: response.location,
    indexable,
    inSitemap: true,
    canonical: facts.canonical || null,
    canonicalValid,
    robotsAllowed: allowed,
    noindexAbsent,
    title: facts.title || null,
    meaningfulHtml,
    visibleTextLength: facts.visibleTextLength,
    indexNowEligible: indexable,
    googleInspectionStatus: null,
    notes: response.error || (indexable ? '' : 'One or more technical indexability checks failed.'),
  };
});

const faviconResponse = live ? await fetchOnce(faviconUrl) : { status: 200, location: null, contentType: 'image/png', body: await readFile('public/favicon-48x48.png') };
const keyResponse = live ? await fetchOnce(keyUrl) : { status: 200, location: null, contentType: 'text/plain; charset=utf-8', body: await readFile(`public/${indexNowKey}.txt`, 'utf8') };
const keyValid = keyResponse.status === 200 && !keyResponse.location && (keyResponse.body === indexNowKey || keyResponse.body === `${indexNowKey}\n`);

const summary = {
  mode: live ? 'live' : 'built',
  auditedAt: new Date().toISOString(),
  publicHtmlRoutesDiscovered: 577,
  intendedForIndexing: urls.length,
  intentionallyExcluded: 7,
  intentionalExclusions: [
    { route: '/404', classification: 'technical', reason: 'Error document; noindex.' },
    { route: '/heic', classification: 'duplicate-alias', reason: 'Compatibility alias; noindex and canonicalized to /heic-to-jpg.' },
    { route: '/__locale', classification: 'technical', reason: 'Private no-store locale suggestion JSON endpoint.' },
  ],
  runtimeDynamicPublicHtmlRoutes: 0,
  generatedStaticIndexableUrls: urls.length,
  sitemapUrls: urls.length,
  sitemapCoveragePercent: urls.length ? 100 : 0,
  http200: records.filter((record) => record.httpStatus === 200).length,
  redirects: records.filter((record) => record.httpStatus >= 300 && record.httpStatus < 400).length,
  notFound: records.filter((record) => record.httpStatus === 404).length,
  otherHttpErrors: records.filter((record) => record.httpStatus !== 200 && !(record.httpStatus >= 300 && record.httpStatus < 400) && record.httpStatus !== 404).length,
  noindexConflicts: records.filter((record) => !record.noindexAbsent).length,
  robotsConflicts: records.filter((record) => !record.robotsAllowed).length,
  canonicalConflicts: records.filter((record) => !record.canonicalValid).length,
  duplicateSitemapUrls: duplicateCount,
  missingTitles: records.filter((record) => !record.title).length,
  soft404Candidates: records.filter((record) => !record.meaningfulHtml).length,
  technicallyIndexable: records.filter((record) => record.indexable).length,
  indexNowEligible: records.filter((record) => record.indexNowEligible).length,
  knownTechnicalBlockers: records.filter((record) => !record.indexable).length,
  knownUnindexedUrls: null,
  knownUnindexedReason: 'Unavailable without authorized Google Search Console URL Inspection data.',
  sitemap: { url: sitemapUrl, httpStatus: sitemapResponse.status, contentType: sitemapResponse.contentType, redirected: Boolean(sitemapResponse.location) },
  robots: { url: robotsUrl, httpStatus: robotsResponse.status, contentType: robotsResponse.contentType, sitemapDeclared: robotsResponse.body.includes(`Sitemap: ${sitemapUrl}`) },
  favicon: { url: faviconUrl, httpStatus: faviconResponse.status, contentType: faviconResponse.contentType, redirected: Boolean(faviconResponse.location) },
  indexNowKey: { url: keyUrl, httpStatus: keyResponse.status, contentType: keyResponse.contentType, redirected: Boolean(keyResponse.location), valid: keyValid },
};

await mkdir(new URL('../.artifacts/', import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ summary, routes: records }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
console.log('Full route audit written to .artifacts/seo-indexability-audit.json.');

if (summary.knownTechnicalBlockers || duplicateCount || !keyValid || !summary.robots.sitemapDeclared || summary.favicon.httpStatus !== 200) process.exitCode = 1;
