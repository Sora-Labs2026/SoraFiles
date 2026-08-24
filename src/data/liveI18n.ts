import en from './liveCopy';
import latin from './liveLatin.js';
import asia from './liveAsia.js';
import arRu from './liveArRu.js';
import { liveSupplement } from './liveSupplement';
import type { LocalePath } from '../i18n/config';
import { getConversionFidelityMessages } from '../i18n/documentTools';
import { getSpreadsheetToolMessages } from '../i18n/spreadsheetTools';
import { getBackgroundRemovalMessages } from '../i18n/backgroundRemoval';

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
  const value = resolve(dictionaries[previewCode[locale]] ?? en, path);
  if (value === undefined) throw new Error(`Missing reviewed localization: ${locale}:${path}`);
  return value as T;
}

export function liveText(locale: LocalePath, path: string, vars?: Record<string, string | number>): string {
  const fidelity = getConversionFidelityMessages(locale);
  const spreadsheet = getSpreadsheetToolMessages(locale);
  const background = getBackgroundRemovalMessages(locale);
  if (path === 'tool.pdf-to-word.d') return fidelity.pdfToWordResult;
  if (path === 'tool.pdf-to-word.t') return fidelity.exactAppearance;
  if (path === 'tool.word-to-pdf.d') return fidelity.wordToPdfResult;
  if (path === 'tool.word-to-pdf.t') return fidelity.exactAppearance;
  if (path === 'tool.pdf-to-excel.d') return spreadsheet.exactResult;
  if (path === 'tool.pdf-to-excel.t') return spreadsheet.exactAppearance;
  if (path === 'tool.excel-to-pdf.d') return spreadsheet.excelResult;
  if (path === 'tool.excel-to-pdf.t') return spreadsheet.exactAppearance;
  if (path === 'lim.pdfToExcel') return spreadsheet.exactHelp;
  if (path === 'lim.excelToPdf') return spreadsheet.excelResult;
  if (path === 'tool.remove-background.n') return background.name;
  if (path === 'tool.remove-background.d') return background.description;
  if (path === 'tool.remove-background.t') return background.tagline;
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
