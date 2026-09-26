import { publishedLocales, localizedRoutePaths, localizedPath } from '../i18n/config.ts';
import { guideSitemapUrls } from '../data/guides.ts';
export const canonicalIndexableUrls = () => [...publishedLocales.flatMap(locale => localizedRoutePaths.map(route => `https://sorafiles.com${localizedPath(locale.path, route) === '/' ? '/' : localizedPath(locale.path, route)}`)), ...guideSitemapUrls()];
export function filterIndexNowUrls(values: string[], allowed = canonicalIndexableUrls()) {
  const allow = new Set(allowed);
  return [...new Set(values)].filter(value => {
    try {
      const url = new URL(value);
      return url.origin === 'https://sorafiles.com' && !url.username && !url.password && !url.search && !url.hash && value === url.href && allow.has(value);
    } catch { return false; }
  });
}
export function indexNowBatches(urls: string[], size = 10000) {
  if (!Number.isInteger(size) || size < 1 || size > 10000) throw new Error('IndexNow batch size must be 1–10000');
  const result: string[][] = [];
  for (let i = 0; i < urls.length; i += size) result.push(urls.slice(i, i + size));
  return result;
}
