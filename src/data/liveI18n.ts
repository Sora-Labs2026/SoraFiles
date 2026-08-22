import en from './liveCopy';
import latin from './liveLatin.js';
import asia from './liveAsia.js';
import arRu from './liveArRu.js';
import { liveSupplement } from './liveSupplement';
import type { LocalePath } from '../i18n/config';

type Dictionary = Record<string, unknown>;
const compactDictionaries: Record<string, Dictionary> = { en, ...latin, ...asia, ...arRu };
const previewCode: Record<LocalePath, string> = { en: 'en', ja: 'ja', ko: 'ko', es: 'es', fr: 'fr', de: 'de', pt: 'pt', 'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW', hi: 'hi', ar: 'ar', ru: 'ru', id: 'id', it: 'it', nl: 'nl', tr: 'tr', vi: 'vi', th: 'th', pl: 'pl' };
const adLightCopy: Record<LocalePath, string> = {
  en: 'Quiet ads that never block your tools',
  es: 'Anuncios discretos que nunca bloquean tus herramientas',
  fr: 'Des publicités discrètes qui ne bloquent jamais vos outils',
  de: 'Dezente Anzeigen, die deine Tools nie blockieren',
  pt: 'Anúncios discretos que nunca bloqueiam as ferramentas',
  it: 'Annunci discreti che non bloccano mai gli strumenti',
  nl: 'Rustige advertenties die je tools nooit blokkeren',
  pl: 'Dyskretne reklamy, które nigdy nie zasłaniają narzędzi',
  ru: 'Ненавязчивая реклама, которая не мешает инструментам',
  tr: 'Araçlarını asla engellemeyen sade reklamlar',
  th: 'โฆษณาแบบสุภาพที่ไม่เคยบังเครื่องมือ',
  ar: 'إعلانات هادئة لا تعيق أدواتك أبداً',
  hi: 'शांत विज्ञापन जो टूल को कभी नहीं रोकते',
  id: 'Iklan ringan yang tidak pernah menghalangi alat',
  ja: 'ツールを妨げない控えめな広告',
  ko: '도구를 가리지 않는 조용한 광고',
  'zh-cn': '安静的广告，绝不遮挡工具',
  'zh-tw': '低調的廣告，絕不遮擋工具',
  vi: 'Quảng cáo nhẹ nhàng, không bao giờ che công cụ',
};

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
  if (path === 'feat.f3s') return interpolate(adLightCopy[locale], vars);
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
