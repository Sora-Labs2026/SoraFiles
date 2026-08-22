import type { LocalePath } from './config';

export const themeMessages: Record<LocalePath, { theme: string; system: string; dark: string; light: string }> = {
  en: { theme: 'Theme', system: 'System', dark: 'Dark', light: 'Light' }, ja: { theme: 'テーマ', system: 'システム', dark: 'ダーク', light: 'ライト' }, ko: { theme: '테마', system: '시스템', dark: '다크', light: '라이트' },
  es: { theme: 'Tema', system: 'Sistema', dark: 'Oscuro', light: 'Claro' }, fr: { theme: 'Thème', system: 'Système', dark: 'Sombre', light: 'Clair' }, de: { theme: 'Darstellung', system: 'System', dark: 'Dunkel', light: 'Hell' }, pt: { theme: 'Tema', system: 'Sistema', dark: 'Escuro', light: 'Claro' },
  'zh-cn': { theme: '主题', system: '跟随系统', dark: '深色', light: '浅色' }, 'zh-tw': { theme: '主題', system: '跟隨系統', dark: '深色', light: '淺色' }, hi: { theme: 'थीम', system: 'सिस्टम', dark: 'डार्क', light: 'लाइट' }, ar: { theme: 'المظهر', system: 'النظام', dark: 'داكن', light: 'فاتح' },
  ru: { theme: 'Тема', system: 'Системная', dark: 'Тёмная', light: 'Светлая' }, id: { theme: 'Tema', system: 'Sistem', dark: 'Gelap', light: 'Terang' }, it: { theme: 'Tema', system: 'Sistema', dark: 'Scuro', light: 'Chiaro' }, nl: { theme: 'Thema', system: 'Systeem', dark: 'Donker', light: 'Licht' },
  tr: { theme: 'Tema', system: 'Sistem', dark: 'Koyu', light: 'Açık' }, vi: { theme: 'Giao diện', system: 'Hệ thống', dark: 'Tối', light: 'Sáng' }, th: { theme: 'ธีม', system: 'ระบบ', dark: 'มืด', light: 'สว่าง' }, pl: { theme: 'Motyw', system: 'Systemowy', dark: 'Ciemny', light: 'Jasny' },
};
