import { BOOTSTRAP_POPULAR_TOOL_IDS, PUBLISHED_TOOL_IDS } from './src/data/popularityRegistry.generated.js';
import { computePopularityRanking, createBootstrapRanking } from './src/lib/popularity/core.js';

const CANONICAL_HOST = 'sorafiles.com';
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
const COUNTRY_LOCALES = {
  AR: 'es', AT: 'de', AU: 'en', BE: 'nl', BR: 'pt', CA: 'en', CH: 'de', CL: 'es', CN: 'zh-cn',
  CO: 'es', DE: 'de', EG: 'ar', ES: 'es', FR: 'fr', GB: 'en', HK: 'zh-tw', ID: 'id', IN: 'hi',
  IT: 'it', JP: 'ja', KR: 'ko', MX: 'es', NL: 'nl', NZ: 'en', PE: 'es', PL: 'pl', PT: 'pt',
  RU: 'ru', SA: 'ar', SG: 'zh-cn', TH: 'th', TR: 'tr', TW: 'zh-tw', US: 'en', VN: 'vi', ZA: 'en',
};
const REMOVED_AD_PATHS = new Set(['/ads.txt', '/bbd8dc6c771660df9481.txt']);
const HASHED_ASTRO_ASSET = /^\/_astro\/[^/?]+\.[A-Za-z0-9_-]{8,}\.(?:css|js|mjs|woff2?)$/i;
const HOMEPAGE_PATH = /^\/(?:[a-z]{2}|zh-(?:cn|tw))?\/?$/;
const POPULARITY_EVENT_PATH = '/__sf/popularity/event';
const POPULARITY_RANKING_PATH = '/__sf/popularity/ranking';
const PUBLISHED_TOOL_SET = new Set(PUBLISHED_TOOL_IDS);
const HSTS = 'max-age=31536000';
const PUBLIC_CSP = "base-uri 'self'; object-src 'none'; frame-ancestors 'none'";
const OFFICE_CONVERTER_PATH = /\/(?:word-to-pdf|excel-to-pdf|remove-background)\/?$/;
// The document scanner needs same-origin camera access after explicit browser consent.
// All unrelated powerful features remain disabled.
const PERMISSIONS_POLICY = 'camera=(self), geolocation=(), microphone=(), payment=(), usb=()';
const DAY_MS = 86_400_000;
const RANKING_CACHE_MS = 300_000;
let rankingCache;
let rankingCacheExpires = 0;

function redirectWithHsts(url) {
  return new Response(null, { status: 301, headers: { Location: url, 'Strict-Transport-Security': HSTS } });
}

function preparePublicHtml(response, ranking, pathname = '/') {
  if (!/^text\/html\b/i.test(response.headers.get('Content-Type') || '')) return response;
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Strict-Transport-Security', HSTS);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', PUBLIC_CSP);
  headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  if (OFFICE_CONVERTER_PATH.test(pathname)) {
    // ZetaOffice/LibreOffice WebAssembly requires SharedArrayBuffer. Keep the
    // isolation surgical so ordinary pages and third-party analytics are not
    // affected by the heavier converter runtime.
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Origin-Agent-Cluster', '?1');
  }
  const cacheControl = (headers.get('Cache-Control') || 'public, max-age=0, must-revalidate')
    .split(',').map((directive) => directive.trim())
    .filter((directive) => directive && directive.toLowerCase() !== 'no-transform').join(', ');
  headers.set('Cache-Control', cacheControl);
  const secured = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  if (!ranking || typeof HTMLRewriter === 'undefined') return secured;
  return new HTMLRewriter()
    .on('script[data-popularity-ranking]', { element(element) { element.setInnerContent(JSON.stringify(ranking), { html: true }); } })
    .transform(secured);
}

function fallbackRanking(now = new Date()) {
  return createBootstrapRanking(PUBLISHED_TOOL_IDS, BOOTSTRAP_POPULAR_TOOL_IDS, now);
}

function isValidRanking(value) {
  return value && value.version === 1 && Array.isArray(value.tools) && value.tools.length === 10
    && new Set(value.tools).size === 10 && value.tools.every((tool) => PUBLISHED_TOOL_SET.has(tool));
}

async function getCachedRanking(env) {
  const now = Date.now();
  if (rankingCache && rankingCacheExpires > now) return rankingCache;
  if (!env.POPULARITY_DB) {
    rankingCache = fallbackRanking();
    rankingCacheExpires = now + RANKING_CACHE_MS;
    return rankingCache;
  }
  try {
    const row = await env.POPULARITY_DB.prepare('SELECT value FROM popularity_state WHERE key = ?1').bind('current').first();
    const parsed = row?.value ? JSON.parse(row.value) : null;
    rankingCache = isValidRanking(parsed) ? parsed : fallbackRanking();
  } catch {
    rankingCache = fallbackRanking();
  }
  rankingCacheExpires = now + RANKING_CACHE_MS;
  return rankingCache;
}

function noStore(status, text = '') {
  return new Response(text || null, { status, headers: {
    'Cache-Control': 'private, no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  } });
}

function isAutomatedRequest(request) {
  if (request.cf?.botManagement?.verifiedBot) return true;
  return /(?:bot|crawler|spider|headless|lighthouse|pagespeed|google-inspectiontool)/i.test(request.headers.get('User-Agent') || '');
}

async function handlePopularityEvent(request, env, ctx) {
  if (request.method !== 'POST') return noStore(405, 'Method Not Allowed');
  if (!env.POPULARITY_DB) return noStore(503, 'Unavailable');
  if (request.headers.get('Origin') !== CANONICAL_ORIGIN) return noStore(403, 'Forbidden');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site') return noStore(403, 'Forbidden');
  if (isAutomatedRequest(request)) return noStore(204);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) return noStore(415, 'Unsupported Media Type');
  if (Number(request.headers.get('Content-Length') || 0) > 192) return noStore(413, 'Payload Too Large');
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 192) return noStore(413, 'Payload Too Large');
    body = JSON.parse(raw);
  } catch {
    return noStore(400, 'Invalid JSON');
  }
  if (!body || Object.keys(body).sort().join(',') !== 'event,tool'
    || body.event !== 'tool_process_success' || typeof body.tool !== 'string'
    || !PUBLISHED_TOOL_SET.has(body.tool)) return noStore(400, 'Invalid Event');

  const day = new Date().toISOString().slice(0, 10);
  const write = env.POPULARITY_DB.prepare(`
    INSERT INTO tool_usage_daily (day, tool, success_count) VALUES (?1, ?2, 1)
    ON CONFLICT(day, tool) DO UPDATE SET success_count = success_count + 1
  `).bind(day, body.tool).run();
  if (ctx?.waitUntil) ctx.waitUntil(Promise.resolve(write).catch(() => {}));
  else await write;
  return noStore(204);
}

function dayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

async function refreshPopularityRanking(env, now = new Date()) {
  if (!env.POPULARITY_DB) return fallbackRanking(now);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const result = await env.POPULARITY_DB.prepare(`
    SELECT day, tool, success_count FROM tool_usage_daily
    WHERE day >= ?1 ORDER BY day ASC, tool ASC
  `).bind(dayKey(today - (89 * DAY_MS))).all();
  const totals = new Map(PUBLISHED_TOOL_IDS.map((id) => [id, { id, success7: 0, success30: 0, success90: 0 }]));
  for (const row of result.results || []) {
    if (!PUBLISHED_TOOL_SET.has(row.tool)) continue;
    const age = Math.floor((today - Date.parse(`${row.day}T00:00:00Z`)) / DAY_MS);
    const count = Math.max(0, Number(row.success_count) || 0);
    const entry = totals.get(row.tool);
    if (!entry || age < 0 || age >= 90) continue;
    entry.success90 += count;
    if (age < 30) entry.success30 += count;
    if (age < 7) entry.success7 += count;
  }
  const previous = await getCachedRanking(env);
  const ranking = computePopularityRanking({
    toolIds: PUBLISHED_TOOL_IDS,
    bootstrapIds: BOOTSTRAP_POPULAR_TOOL_IDS,
    usage: [...totals.values()],
    searchConsole: null,
    marketDemand: null,
    previousTools: previous.tools,
    mode: env.POPULARITY_MODE || 'dynamic',
    pin: env.POPULARITY_PIN || '',
    exclude: env.POPULARITY_EXCLUDE || '',
    now,
  });
  await env.POPULARITY_DB.batch([
    env.POPULARITY_DB.prepare(`
      INSERT INTO popularity_state (key, value, updated_at) VALUES ('current', ?1, ?2)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(JSON.stringify(ranking), ranking.generatedAt),
    env.POPULARITY_DB.prepare('DELETE FROM tool_usage_daily WHERE day < ?1').bind(dayKey(today - (120 * DAY_MS))),
  ]);
  rankingCache = ranking;
  rankingCacheExpires = Date.now() + RANKING_CACHE_MS;
  return ranking;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || url.hostname !== CANONICAL_HOST) {
      url.protocol = 'https:'; url.hostname = CANONICAL_HOST; url.port = '';
      return redirectWithHsts(url.toString());
    }
    if (url.pathname === '/kr' || url.pathname.startsWith('/kr/')) {
      url.pathname = `/ko${url.pathname.slice(3) || '/'}`;
      return redirectWithHsts(url.toString());
    }
    if (/^\/index\.(?:html?|php)$/i.test(url.pathname)) {
      url.pathname = '/';
      return redirectWithHsts(url.toString());
    }
    const previewMatch = url.pathname.match(/^\/(?:([a-z]{2}|zh-(?:cn|tw))\/)?preview\/?$/i);
    if (previewMatch) {
      url.pathname = previewMatch[1] ? `/${previewMatch[1].toLowerCase()}/tools` : '/tools';
      return redirectWithHsts(url.toString());
    }
    if (url.pathname === POPULARITY_EVENT_PATH) return handlePopularityEvent(request, env, ctx);
    if (url.pathname === POPULARITY_RANKING_PATH) {
      if (request.method !== 'GET') return noStore(405, 'Method Not Allowed');
      return Response.json(await getCachedRanking(env), { headers: {
        'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow, noarchive',
      } });
    }
    if (url.pathname === '/__locale') {
      const country = request.cf?.country;
      return Response.json({ suggestedLocale: COUNTRY_LOCALES[country] || null }, { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
    }
    if (REMOVED_AD_PATHS.has(url.pathname)) return noStore(404, 'Not Found');
    if (HASHED_ASTRO_ASSET.test(url.pathname)) {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    if (url.pathname === '/sitemap.xml' || url.pathname === '/robots.txt') {
      const assetUrl = new URL(url);
      assetUrl.searchParams.set('asset-version', '2026-08-23-popularity-1');
      const response = await env.ASSETS.fetch(new Request(assetUrl, request));
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=300');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    const response = await env.ASSETS.fetch(request);
    const ranking = request.method === 'GET' && HOMEPAGE_PATH.test(url.pathname) ? await getCachedRanking(env) : null;
    return preparePublicHtml(response, ranking, url.pathname);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(refreshPopularityRanking(env, new Date(controller.scheduledTime)));
  },
};
