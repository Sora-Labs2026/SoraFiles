import { localeDefinitions, type LocalePath } from '../../i18n/config';

export const OCR_LANGUAGE_BY_LOCALE = {
  en: 'eng',
  ja: 'jpn',
  ko: 'kor',
  es: 'spa',
  fr: 'fra',
  de: 'deu',
  pt: 'por',
  'zh-cn': 'chi_sim',
  'zh-tw': 'chi_tra',
  hi: 'hin',
  ar: 'ara',
  ru: 'rus',
  id: 'ind',
  it: 'ita',
  nl: 'nld',
  tr: 'tur',
  vi: 'vie',
  th: 'tha',
  pl: 'pol',
} as const satisfies Record<LocalePath, string>;

export type OcrLanguageCode = (typeof OCR_LANGUAGE_BY_LOCALE)[LocalePath];

export interface OcrLanguageOption {
  locale: LocalePath;
  code: OcrLanguageCode;
  nativeName: string;
  direction: 'ltr' | 'rtl';
}

export const OCR_LANGUAGE_OPTIONS: OcrLanguageOption[] = localeDefinitions
  .filter((item) => item.published)
  .map((item) => ({
    locale: item.path,
    code: OCR_LANGUAGE_BY_LOCALE[item.path],
    nativeName: item.nativeName,
    direction: item.direction,
  }));
