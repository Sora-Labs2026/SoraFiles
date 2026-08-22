const CANONICAL_HOST = 'sorafiles.com';
const AD_FRAME_HOST = 'ads.sorafiles.com';
const AD_FRAME_PATH = /^\/ad-frame\/(?:desktop|mobile|native|rectangle)\/?$/;
const AD_FRAME_ROBOTS = `User-agent: *\nDisallow: /\nAllow: /ad-frame/\n`;
const COUNTRY_LOCALES = {
  AR: 'es', AT: 'de', AU: 'en', BE: 'nl', BR: 'pt', CA: 'en', CH: 'de', CL: 'es', CN: 'zh-cn',
  CO: 'es', DE: 'de', EG: 'ar', ES: 'es', FR: 'fr', GB: 'en', HK: 'zh-tw', ID: 'id', IN: 'hi',
  IT: 'it', JP: 'ja', KR: 'ko', MX: 'es', NL: 'nl', NZ: 'en', PE: 'es', PL: 'pl', PT: 'pt',
  RU: 'ru', SA: 'ar', SG: 'zh-cn', TH: 'th', TR: 'tr', TW: 'zh-tw', US: 'en', VN: 'vi', ZA: 'en',
};
const REMOVED_AD_PATHS = new Set(['/ads.txt', '/bbd8dc6c771660df9481.txt']);
const REMOVED_VERIFICATION_PATHS = new Set(['/012e83a8-ea3b-4e5f-984a-0b5e9d3bd7ad.html']);
const HASHED_ASTRO_ASSET = /^\/_astro\/[^/?]+\.[A-Za-z0-9_-]{8,}\.(?:css|js|mjs|woff2?)$/i;
const HSTS = 'max-age=31536000';
const PUBLIC_CSP = "base-uri 'self'; object-src 'none'; frame-ancestors 'none'";
const PERMISSIONS_POLICY = 'camera=(), geolocation=(), microphone=(), payment=(), usb=()';

function redirectWithHsts(url) {
  return new Response(null, { status: 301, headers: { Location: url, 'Strict-Transport-Security': HSTS } });
}

function preparePublicHtml(response) {
  if (!/^text\/html\b/i.test(response.headers.get('Content-Type') || '')) return response;

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Strict-Transport-Security', HSTS);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', PUBLIC_CSP);
  headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  const cacheControl = (headers.get('Cache-Control') || 'public, max-age=0, must-revalidate')
    .split(',')
    .map((directive) => directive.trim())
    .filter((directive) => directive && directive.toLowerCase() !== 'no-transform')
    .join(', ');
  headers.set('Cache-Control', cacheControl);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Google must be able to render the isolated iframe as a page resource.
    // The frame response itself remains noindex/nofollow below, while every
    // unrelated ads-origin path stays disallowed and unavailable.
    if (url.protocol === 'https:' && url.hostname === AD_FRAME_HOST && url.pathname === '/robots.txt') {
      return new Response(AD_FRAME_ROBOTS, {
        headers: {
          'Cache-Control': 'public, max-age=300',
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    if (url.protocol === 'https:' && url.hostname === AD_FRAME_HOST && AD_FRAME_PATH.test(url.pathname)) {
      const assetUrl = new URL(url);
      assetUrl.hostname = CANONICAL_HOST;
      const response = await env.ASSETS.fetch(new Request(assetUrl, request));
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=3600, no-transform');
      headers.set('Content-Type', 'text/html; charset=utf-8');
      headers.set('Content-Security-Policy', `base-uri 'none'; object-src 'none'; frame-ancestors https://${CANONICAL_HOST}`);
      headers.set('Permissions-Policy', PERMISSIONS_POLICY);
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    if (url.protocol !== 'https:' || url.hostname !== CANONICAL_HOST) {
      url.protocol = 'https:';
      url.hostname = CANONICAL_HOST;
      url.port = '';
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

    if (url.pathname === '/__locale') {
      const country = request.cf?.country;
      return Response.json(
        { suggestedLocale: COUNTRY_LOCALES[country] || null },
        { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } },
      );
    }

    if (AD_FRAME_PATH.test(url.pathname)) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
      });
    }

    // Keep retired verification artifacts unavailable even if an older
    // static-asset response is still retained at an edge.
    if (REMOVED_AD_PATHS.has(url.pathname) || REMOVED_VERIFICATION_PATHS.has(url.pathname)) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'X-Robots-Tag': 'noindex',
        },
      });
    }

    if (HASHED_ASTRO_ASSET.test(url.pathname)) {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    if (url.pathname === '/sitemap.xml' || url.pathname === '/robots.txt') {
      const assetUrl = new URL(url);
      assetUrl.searchParams.set('asset-version', '2026-08-21-seo-geo-1');
      const response = await env.ASSETS.fetch(new Request(assetUrl, request));
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=300');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    return preparePublicHtml(await env.ASSETS.fetch(request));
  },
};
