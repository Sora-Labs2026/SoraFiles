export const localeDefinitions = [
  { path: 'en', code: 'en', og: 'en_US', nativeName: 'English', englishName: 'English', direction: 'ltr', published: true },
  { path: 'ja', code: 'ja', og: 'ja_JP', nativeName: '日本語', englishName: 'Japanese', direction: 'ltr', published: true },
  { path: 'ko', code: 'ko', og: 'ko_KR', nativeName: '한국어', englishName: 'Korean', direction: 'ltr', published: true },
  { path: 'es', code: 'es', og: 'es_ES', nativeName: 'Español', englishName: 'Spanish', direction: 'ltr', published: true },
  { path: 'fr', code: 'fr', og: 'fr_FR', nativeName: 'Français', englishName: 'French', direction: 'ltr', published: true },
  { path: 'de', code: 'de', og: 'de_DE', nativeName: 'Deutsch', englishName: 'German', direction: 'ltr', published: true },
  { path: 'pt', code: 'pt', og: 'pt_PT', nativeName: 'Português', englishName: 'Portuguese', direction: 'ltr', published: true },
  { path: 'zh-cn', code: 'zh-Hans', og: 'zh_CN', nativeName: '简体中文', englishName: 'Chinese (Simplified)', direction: 'ltr', published: true },
  { path: 'zh-tw', code: 'zh-Hant', og: 'zh_TW', nativeName: '繁體中文', englishName: 'Chinese (Traditional)', direction: 'ltr', published: true },
  { path: 'hi', code: 'hi', og: 'hi_IN', nativeName: 'हिन्दी', englishName: 'Hindi', direction: 'ltr', published: true },
  { path: 'ar', code: 'ar', og: 'ar_AR', nativeName: 'العربية', englishName: 'Arabic', direction: 'rtl', published: true },
  { path: 'ru', code: 'ru', og: 'ru_RU', nativeName: 'Русский', englishName: 'Russian', direction: 'ltr', published: true },
  { path: 'id', code: 'id', og: 'id_ID', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', direction: 'ltr', published: true },
  { path: 'it', code: 'it', og: 'it_IT', nativeName: 'Italiano', englishName: 'Italian', direction: 'ltr', published: true },
  { path: 'nl', code: 'nl', og: 'nl_NL', nativeName: 'Nederlands', englishName: 'Dutch', direction: 'ltr', published: true },
  { path: 'tr', code: 'tr', og: 'tr_TR', nativeName: 'Türkçe', englishName: 'Turkish', direction: 'ltr', published: true },
  { path: 'vi', code: 'vi', og: 'vi_VN', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', direction: 'ltr', published: true },
  { path: 'th', code: 'th', og: 'th_TH', nativeName: 'ไทย', englishName: 'Thai', direction: 'ltr', published: true },
  { path: 'pl', code: 'pl', og: 'pl_PL', nativeName: 'Polski', englishName: 'Polish', direction: 'ltr', published: true },
] as const;

export type LocalePath = (typeof localeDefinitions)[number]['path'];
export type PublishedLocalePath = Extract<(typeof localeDefinitions)[number], { published: true }>['path'];

export const publishedLocales = localeDefinitions.filter((locale) => locale.published);
export const localeByPath = new Map(localeDefinitions.map((locale) => [locale.path, locale]));

export const localizedRoutePaths = [
  '/',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/open-source',
  '/image-converter',
  '/compress-image',
  '/heic-to-jpg',
  '/pdf',
  '/merge-pdf',
  '/split-pdf',
  '/rotate-pdf',
  '/jpg-to-pdf',
  '/pdf-to-jpg',
  '/pdf-to-word',
  '/word-to-pdf',
] as const;

export type LocalizedRoutePath = (typeof localizedRoutePaths)[number];

export function isLocalePath(value: string): value is LocalePath {
  return localeByPath.has(value as LocalePath);
}

export function isPublishedLocale(value: string): value is PublishedLocalePath {
  return publishedLocales.some((locale) => locale.path === value);
}

export function normalizeRoutePath(pathname: string): string {
  const clean = `/${pathname.split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '')}`;
  return clean === '/' ? '/' : clean;
}

export function localizedPath(locale: LocalePath, pathname = '/'): string {
  const clean = normalizeRoutePath(pathname);
  if (locale === 'en') return clean;
  return clean === '/' ? `/${locale}/` : `/${locale}${clean}`;
}

export function basePathFromLocalized(pathname: string): string {
  const clean = normalizeRoutePath(pathname);
  const segments = clean.split('/').filter(Boolean);
  if (segments.length && isLocalePath(segments[0])) {
    const remainder = `/${segments.slice(1).join('/')}`;
    return remainder === '/' ? '/' : remainder;
  }
  if (segments[0] === 'kr') {
    const remainder = `/${segments.slice(1).join('/')}`;
    return remainder === '/' ? '/' : remainder;
  }
  return clean;
}

export function publishedAlternates(pathname: string) {
  const basePath = basePathFromLocalized(pathname);
  if (!localizedRoutePaths.includes(basePath as LocalizedRoutePath)) return [];
  return publishedLocales.map((locale) => ({
    hreflang: locale.code,
    href: new URL(localizedPath(locale.path, basePath), 'https://sorafiles.com').toString(),
  }));
}
