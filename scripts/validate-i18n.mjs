import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { localizedPath, localizedRoutePaths, publishedLocales } from '../src/i18n/config.ts';
import { liveTools } from '../src/data/liveTools.ts';

const site = 'https://sorafiles.com';
const locales = publishedLocales.map(({ path, code, direction }) => [path, code, direction]);
const routes = localizedRoutePaths;
const toolRoutes = new Set(liveTools.map((tool) => `/${tool.slug}`));
const errors = [];
const sitemap = readFileSync(join('dist', 'sitemap.xml'), 'utf8');
const englishWorkbenchLabels = ['Local file tool', 'Local image tool', 'Local PDF tool', 'No server upload', 'Processed on your device', 'Choose file', 'Choose files', 'Choose image', 'Choose PDF', 'Remove all', 'Compression goal', 'Target size', 'Output format', 'Ready to download', 'Download result'];
const forbiddenEnglishFragments = [
  'Everything Happens', 'On Your Device', 'No servers. No uploads.', 'Safe & Private',
  'Free • On-device', 'Good to know:', 'Processing happens locally', 'Works with',
  'You get', 'Copied!', 'tools shown', 'No tools match', 'Skip to content',
  'Share this page', 'Share with an app', 'Copy link',
  'This is a hard byte limit.',
  'aria-label="Primary"', 'aria-label="Appearance"', 'aria-label="Open menu"',
  'aria-label="Footer"', 'aria-label="Capabilities"', 'aria-label="Product features"',
  'PDF password', 'Enter a password', 'No rotation', 'clockwise',
];
const obsoleteHomepageClaims = [
  'Popular Tools', '人気のツール', '인기 도구', '热门工具', '熱門工具', 'लोकप्रिय टूल', 'เครื่องมือยอดนิยม',
  'Herramientas populares', 'Outils populaires', 'Beliebte Tools', 'Ferramentas populares', 'Strumenti popolari',
  'Populaire tools', 'Popularne narzędzia', 'Popüler araçlar', 'Alat populer', 'Công cụ phổ biến', 'أدوات شائعة', 'Популярные инструменты',
  'No servers. No uploads.', 'サーバーなし。アップロードなし。', '서버 없음. 업로드 없음.', '无服务器。无上传。', '無伺服器。無上傳。',
  'ना सर्वर। ना अपलोड।', 'ไม่มีเซิร์ฟเวอร์ ไม่มีการอัปโหลด', 'Sin servidores. Sin subidas.', "Pas de serveurs. Pas d'envois.",
  'Keine Server. Keine Uploads.', 'Sem servidores. Sem envios.', 'Niente server. Niente caricamenti.', 'Geen servers. Geen uploads.',
  'Bez serwerów. Bez wysyłania.', 'Sunucu yok. Yükleme yok.', 'Tanpa server. Tanpa unggahan.', 'Không máy chủ. Không tải lên.',
  'لا خوادم. لا رفع.', 'Без серверов. Без загрузок.',
];


const urlFor = (locale, route) => {
  return new URL(localizedPath(locale, route), site).toString();
};
const fileFor = (locale, route) => {
  const segments = [];
  if (locale !== 'en') segments.push(locale);
  if (route !== '/') segments.push(route.slice(1));
  return join('dist', ...segments, 'index.html');
};
const textMatch = (html, pattern) => html.match(pattern)?.[1]?.trim() || '';

for (const [locale, language, direction] of locales) {
  for (const route of routes) {
    const file = fileFor(locale, route);
    const expectedUrl = urlFor(locale, route);
    if (!existsSync(file)) {
      errors.push(`${locale}${route}: missing generated page`);
      continue;
    }
    const html = readFileSync(file, 'utf8');
    const head = textMatch(html, /<head>([\s\S]*?)<\/head>/i);
    const htmlTag = textMatch(html, /(<html[^>]*>)/i);
    const canonical = textMatch(head, /<link rel="canonical" href="([^"]+)"/i);
    const title = textMatch(head, /<title>([\s\S]*?)<\/title>/i);
    const description = textMatch(head, /<meta name="description" content="([^"]+)"/i);
    const h1 = textMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '').trim();
    const alternatePairs = [...head.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/gi)].map((match) => [match[1], match[2]]);

    if (!htmlTag.includes(`lang="${language}"`)) errors.push(`${locale}${route}: expected html lang=${language}`);
    if (!htmlTag.includes(`dir="${direction}"`)) errors.push(`${locale}${route}: expected dir=${direction}`);
    if (canonical !== expectedUrl) errors.push(`${locale}${route}: canonical ${canonical || 'missing'} != ${expectedUrl}`);
    if (!title || !title.includes('SoraFiles')) errors.push(`${locale}${route}: missing canonical SoraFiles title brand`);
    if (!description) errors.push(`${locale}${route}: missing description`);
    if (!h1) errors.push(`${locale}${route}: missing H1`);
    if (html.includes('\uFFFD')) errors.push(`${locale}${route}: replacement character found`);
    if (locale !== 'en') {
      for (const fragment of forbiddenEnglishFragments) {
        if (html.includes(fragment)) errors.push(`${locale}${route}: untranslated shared UI “${fragment}”`);
      }
    }
    if (route === '/') {
      for (const claim of obsoleteHomepageClaims) if (html.includes(claim)) errors.push(`${locale}${route}: obsolete or unsupported homepage claim “${claim}”`);
      if (!html.includes('data-privacy-proof')) errors.push(`${locale}${route}: missing data-privacy-proof container`);
      const cardCount = (html.match(/data-privacy-proof-card/g) || []).length;
      if (cardCount !== 5) errors.push(`${locale}${route}: expected 5 data-privacy-proof-card elements, found ${cardCount}`);
      if (locale !== 'en') {
        const englishProofLabels = ['Your files stay under your control', 'File uploads', 'Account required', 'Original overwritten'];
        for (const label of englishProofLabels) {
          if (html.includes(label)) errors.push(`${locale}${route}: untranslated proof label "${label}" found`);
        }
      }
    }
    if (locale !== 'en' && toolRoutes.has(route)) {
      for (const label of englishWorkbenchLabels) if (html.includes(`>${label}<`)) errors.push(`${locale}${route}: untranslated workbench label “${label}”`);
    }
    if (alternatePairs.length !== locales.length + 1) errors.push(`${locale}${route}: expected 20 head hreflang links, found ${alternatePairs.length}`);

    for (const [alternateLocale, alternateLanguage] of locales) {
      const expectedAlternate = urlFor(alternateLocale, route);
      if (!alternatePairs.some(([code, href]) => code === alternateLanguage && href === expectedAlternate)) {
        errors.push(`${locale}${route}: missing reciprocal ${alternateLanguage} -> ${expectedAlternate}`);
      }
    }
    if (!alternatePairs.some(([code, href]) => code === 'x-default' && href === urlFor('en', route))) {
      errors.push(`${locale}${route}: missing x-default`);
    }
    if (!sitemap.includes(`<loc>${expectedUrl}</loc>`)) errors.push(`${locale}${route}: missing sitemap URL ${expectedUrl}`);

    for (const match of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
      try { JSON.parse(match[1]); } catch { errors.push(`${locale}${route}: invalid JSON-LD`); }
    }
  }
}

if (sitemap.includes('/kr') || sitemap.includes('/heic</loc>') || sitemap.includes('/heic/</loc>')) {
  errors.push('sitemap contains a compatibility or legacy URL');
}

if (errors.length) {
  console.error(`i18n validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors.slice(0, 80)) console.error(`- ${error}`);
  if (errors.length > 80) console.error(`- ...and ${errors.length - 80} more`);
  process.exit(1);
}

console.log(`i18n validation passed: ${locales.length} languages × ${routes.length} equivalent routes (${locales.length * routes.length} localized URLs).`);
