import { publishedLocales, localizedRoutePaths, localizedPath } from '../i18n/config';

export const prerender = true;

const siteUrl = 'https://sorafiles.com';

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

export function GET() {
  const entries = localizedRoutePaths.flatMap((route) => {
    const alternates = publishedLocales.map((locale) => ({
      hreflang: locale.code,
      href: new URL(localizedPath(locale.path, route), siteUrl).toString(),
    }));
    const englishUrl = new URL(localizedPath('en', route), siteUrl).toString();
    const alternateLinks = [
      ...alternates,
      { hreflang: 'x-default', href: englishUrl },
    ];

    return alternates.map(({ href }) => ({ url: href, alternateLinks }));
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries
    .map(({ url, alternateLinks }) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n${alternateLinks
      .map(({ hreflang, href }) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}" />`)
      .join('\n')}\n  </url>`)
    .join('\n')}\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
