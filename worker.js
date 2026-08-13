const CANONICAL_HOST = 'sorafiles.com';
const COUNTRY_LOCALES = {
  AR: 'es', AT: 'de', AU: 'en', BE: 'nl', BR: 'pt', CA: 'en', CH: 'de', CL: 'es', CN: 'zh-cn',
  CO: 'es', DE: 'de', EG: 'ar', ES: 'es', FR: 'fr', GB: 'en', HK: 'zh-tw', ID: 'id', IN: 'hi',
  IT: 'it', JP: 'ja', KR: 'ko', MX: 'es', NL: 'nl', NZ: 'en', PE: 'es', PL: 'pl', PT: 'pt',
  RU: 'ru', SA: 'ar', SG: 'zh-cn', TH: 'th', TR: 'tr', TW: 'zh-tw', US: 'en', VN: 'vi', ZA: 'en',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || url.hostname !== CANONICAL_HOST) {
      url.protocol = 'https:';
      url.hostname = CANONICAL_HOST;
      url.port = '';
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/kr' || url.pathname.startsWith('/kr/')) {
      url.pathname = `/ko${url.pathname.slice(3) || '/'}`;
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/__locale') {
      const country = request.cf?.country;
      return Response.json(
        { suggestedLocale: COUNTRY_LOCALES[country] || null },
        { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } },
      );
    }

    if (url.pathname === '/sitemap-index.xml' || url.pathname === '/sitemap-0.xml' || url.pathname === '/robots.txt') {
      const assetUrl = new URL(url);
      assetUrl.searchParams.set('asset-version', '2026-08-11-i18n-1');
      const response = await env.ASSETS.fetch(new Request(assetUrl, request));
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=300');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    return env.ASSETS.fetch(request);
  },
};
