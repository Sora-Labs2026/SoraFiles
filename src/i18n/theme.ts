import type { LocalePath } from './config';

export interface ThemeMessages {
  theme: string;
  system: string;
  dark: string;
  light: string;
  ambientBubbles: string;
  ambientOn: string;
  ambientOff: string;
  ambientSystemSuppressed: string;
}

export const themeMessages: Record<LocalePath, ThemeMessages> = {
  en: { theme: 'Theme', system: 'System', dark: 'Dark', light: 'Light', ambientBubbles: 'Ambient bubbles', ambientOn: 'On', ambientOff: 'Off', ambientSystemSuppressed: 'Disabled by system settings' },
  ja: { theme: 'テーマ', system: 'システム', dark: 'ダーク', light: 'ライト', ambientBubbles: '背景のバブル', ambientOn: 'オン', ambientOff: 'オフ', ambientSystemSuppressed: 'システム設定により無効' },
  ko: { theme: '테마', system: '시스템', dark: '다크', light: '라이트', ambientBubbles: '배경 버블', ambientOn: '켜짐', ambientOff: '꺼짐', ambientSystemSuppressed: '시스템 설정으로 인해 사용할 수 없음' },
  es: { theme: 'Tema', system: 'Sistema', dark: 'Oscuro', light: 'Claro', ambientBubbles: 'Burbujas ambientales', ambientOn: 'Activadas', ambientOff: 'Desactivadas', ambientSystemSuppressed: 'Desactivadas por la configuración del sistema' },
  fr: { theme: 'Thème', system: 'Système', dark: 'Sombre', light: 'Clair', ambientBubbles: 'Bulles d’ambiance', ambientOn: 'Activées', ambientOff: 'Désactivées', ambientSystemSuppressed: 'Désactivées par les réglages système' },
  de: { theme: 'Darstellung', system: 'System', dark: 'Dunkel', light: 'Hell', ambientBubbles: 'Hintergrundblasen', ambientOn: 'Ein', ambientOff: 'Aus', ambientSystemSuppressed: 'Durch Systemeinstellungen deaktiviert' },
  pt: { theme: 'Tema', system: 'Sistema', dark: 'Escuro', light: 'Claro', ambientBubbles: 'Bolhas de ambiente', ambientOn: 'Ativadas', ambientOff: 'Desativadas', ambientSystemSuppressed: 'Desativadas pelas definições do sistema' },
  'zh-cn': { theme: '主题', system: '跟随系统', dark: '深色', light: '浅色', ambientBubbles: '氛围气泡', ambientOn: '开启', ambientOff: '关闭', ambientSystemSuppressed: '已因系统设置停用' },
  'zh-tw': { theme: '主題', system: '跟隨系統', dark: '深色', light: '淺色', ambientBubbles: '氛圍氣泡', ambientOn: '開啟', ambientOff: '關閉', ambientSystemSuppressed: '已因系統設定停用' },
  hi: { theme: 'थीम', system: 'सिस्टम', dark: 'डार्क', light: 'लाइट', ambientBubbles: 'परिवेश बबल', ambientOn: 'चालू', ambientOff: 'बंद', ambientSystemSuppressed: 'सिस्टम सेटिंग की वजह से बंद' },
  ar: { theme: 'المظهر', system: 'النظام', dark: 'داكن', light: 'فاتح', ambientBubbles: 'فقاعات الخلفية', ambientOn: 'مفعّلة', ambientOff: 'متوقفة', ambientSystemSuppressed: 'معطّلة بسبب إعدادات النظام' },
  ru: { theme: 'Тема', system: 'Системная', dark: 'Тёмная', light: 'Светлая', ambientBubbles: 'Фоновые пузырьки', ambientOn: 'Включены', ambientOff: 'Выключены', ambientSystemSuppressed: 'Отключены настройками системы' },
  id: { theme: 'Tema', system: 'Sistem', dark: 'Gelap', light: 'Terang', ambientBubbles: 'Gelembung latar', ambientOn: 'Aktif', ambientOff: 'Nonaktif', ambientSystemSuppressed: 'Dinonaktifkan oleh pengaturan sistem' },
  it: { theme: 'Tema', system: 'Sistema', dark: 'Scuro', light: 'Chiaro', ambientBubbles: 'Bolle d’ambiente', ambientOn: 'Attivate', ambientOff: 'Disattivate', ambientSystemSuppressed: 'Disattivate dalle impostazioni di sistema' },
  nl: { theme: 'Thema', system: 'Systeem', dark: 'Donker', light: 'Licht', ambientBubbles: 'Sfeerbellen', ambientOn: 'Aan', ambientOff: 'Uit', ambientSystemSuppressed: 'Uitgeschakeld door systeeminstellingen' },
  tr: { theme: 'Tema', system: 'Sistem', dark: 'Koyu', light: 'Açık', ambientBubbles: 'Arka plan baloncukları', ambientOn: 'Açık', ambientOff: 'Kapalı', ambientSystemSuppressed: 'Sistem ayarları nedeniyle devre dışı' },
  vi: { theme: 'Giao diện', system: 'Hệ thống', dark: 'Tối', light: 'Sáng', ambientBubbles: 'Bong bóng nền', ambientOn: 'Bật', ambientOff: 'Tắt', ambientSystemSuppressed: 'Đã tắt theo cài đặt hệ thống' },
  th: { theme: 'ธีม', system: 'ระบบ', dark: 'มืด', light: 'สว่าง', ambientBubbles: 'ฟองอากาศพื้นหลัง', ambientOn: 'เปิด', ambientOff: 'ปิด', ambientSystemSuppressed: 'ปิดใช้งานตามการตั้งค่าระบบ' },
  pl: { theme: 'Motyw', system: 'Systemowy', dark: 'Ciemny', light: 'Jasny', ambientBubbles: 'Bąbelki w tle', ambientOn: 'Włączone', ambientOff: 'Wyłączone', ambientSystemSuppressed: 'Wyłączone przez ustawienia systemowe' },
};
