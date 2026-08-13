import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { ko } from './ko';
import { ar, de, hi, id, it, nl, pl, pt, ru, th, tr, vi, zhCn, zhTw } from './otherLocales';
import type { LocaleContent } from './types';
import type { LocalePath } from './config';

export const localeContent: Record<LocalePath, LocaleContent> = {
  en, ja, ko, es, fr,
  de, pt, 'zh-cn': zhCn, 'zh-tw': zhTw, hi, ar, ru, id, it, nl, tr, vi, th, pl,
};

export function getLocaleContent(locale: string): LocaleContent {
  const content = localeContent[locale as LocalePath];
  if (!content) throw new Error(`No reviewed content catalog for locale: ${locale}`);
  return content;
}

export function getCommonMessages(locale: string): LocaleContent['common'] {
  return locale === 'en' ? en.common : getLocaleContent(locale).common;
}
