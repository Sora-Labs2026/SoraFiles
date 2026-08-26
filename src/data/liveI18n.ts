import en from './liveCopy';
import latin from './liveLatin.js';
import asia from './liveAsia.js';
import arRu from './liveArRu.js';
import { liveSupplement } from './liveSupplement';
import type { LocalePath } from '../i18n/config';
import { getSpreadsheetToolMessages } from '../i18n/spreadsheetTools';
import { getBackgroundRemovalMessages } from '../i18n/backgroundRemoval';
import { getBrandPositioning } from '../i18n/brandPositioning';

type Dictionary = Record<string, unknown>;
const compactDictionaries: Record<string, Dictionary> = { en, ...latin, ...asia, ...arRu };
const previewCode: Record<LocalePath, string> = { en: 'en', ja: 'ja', ko: 'ko', es: 'es', fr: 'fr', de: 'de', pt: 'pt', 'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW', hi: 'hi', ar: 'ar', ru: 'ru', id: 'id', it: 'it', nl: 'nl', tr: 'tr', vi: 'vi', th: 'th', pl: 'pl' };
const resolve = (dict: Dictionary, path: string): unknown => path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Dictionary)[key] : undefined, dict);
const merge = (base: Dictionary, extra: Dictionary): Dictionary => {
  const result: Dictionary = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = result[key];
    result[key] = current && value && typeof current === 'object' && typeof value === 'object' && !Array.isArray(current) && !Array.isArray(value)
      ? merge(current as Dictionary, value as Dictionary)
      : value;
  }
  return result;
};
const dictionaries = Object.fromEntries(Object.entries(previewCode).map(([locale, code]) => [
  code,
  locale === 'en' ? en : merge(compactDictionaries[code] ?? {}, liveSupplement(locale as LocalePath)),
])) as Record<string, Dictionary>;
const interpolate = (value: string, vars?: Record<string, string | number>) => value.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars?.[key] === undefined ? `{{${key}}}` : String(vars[key]));

export function liveRaw<T>(locale: LocalePath, path: string): T {
  const brand = getBrandPositioning(locale);
  if (path === 'page.about.title') return brand.aboutTitle as T;
  if (path === 'page.about.intro') return brand.aboutIntro as T;
  const value = resolve(dictionaries[previewCode[locale]] ?? en, path);
  if (value === undefined) throw new Error(`Missing reviewed localization: ${locale}:${path}`);
  return value as T;
}

export function liveText(locale: LocalePath, path: string, vars?: Record<string, string | number>): string {
  const spreadsheet = getSpreadsheetToolMessages(locale);
  const background = getBackgroundRemovalMessages(locale);
  const brand = getBrandPositioning(locale);
  if (path === 'hero.desc') return brand.description;
  if (path === 'page.about.title') return brand.aboutTitle;
  if (path === 'page.about.intro') return brand.aboutIntro;
  if (path === 'footer.tagline') return brand.footerTagline;
  if (path === 'lim.pdfToExcel') return spreadsheet.exactHelp;
  if (path === 'lim.excelToPdf') return spreadsheet.excelResult;
  if (path === 'tool.remove-background.n') return background.name;
  if (path === 'tool.remove-background.d') return background.tagline;
  if (path === 'tool.remove-background.t') return background.result;
  const value = liveRaw<unknown>(locale, path);
  return interpolate(typeof value === 'string' ? value : path, vars);
}

export function liveToolCopy(locale: LocalePath, id: string) {
  return {
    n: liveText(locale, `tool.${id}.n`),
    d: liveText(locale, `tool.${id}.d`),
    t: liveText(locale, `tool.${id}.t`),
  };
}
