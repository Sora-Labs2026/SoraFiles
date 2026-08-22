import type { LocalePath } from '../i18n/config';

export interface ShareCopy {
  share: string;
  heading: string;
  native: string;
  copy: string;
  copied: string;
  close: string;
}

export const shareCopy: Record<LocalePath, ShareCopy> = {
  en: { share: 'Share', heading: 'Share this page', native: 'Share with an app', copy: 'Copy link', copied: 'Copied', close: 'Close share menu' },
  ja: { share: '共有', heading: 'このページを共有', native: 'アプリで共有', copy: 'リンクをコピー', copied: 'コピーしました', close: '共有メニューを閉じる' },
  ko: { share: '공유', heading: '이 페이지 공유', native: '앱으로 공유', copy: '링크 복사', copied: '복사됨', close: '공유 메뉴 닫기' },
  es: { share: 'Compartir', heading: 'Compartir esta página', native: 'Compartir con una aplicación', copy: 'Copiar enlace', copied: 'Copiado', close: 'Cerrar el menú para compartir' },
  fr: { share: 'Partager', heading: 'Partager cette page', native: 'Partager avec une application', copy: 'Copier le lien', copied: 'Copié', close: 'Fermer le menu de partage' },
  de: { share: 'Teilen', heading: 'Diese Seite teilen', native: 'Mit einer App teilen', copy: 'Link kopieren', copied: 'Kopiert', close: 'Teilen-Menü schließen' },
  pt: { share: 'Partilhar', heading: 'Partilhar esta página', native: 'Partilhar com uma aplicação', copy: 'Copiar ligação', copied: 'Copiado', close: 'Fechar menu de partilha' },
  'zh-cn': { share: '分享', heading: '分享此页面', native: '通过应用分享', copy: '复制链接', copied: '已复制', close: '关闭分享菜单' },
  'zh-tw': { share: '分享', heading: '分享此頁面', native: '透過應用程式分享', copy: '複製連結', copied: '已複製', close: '關閉分享選單' },
  hi: { share: 'साझा करें', heading: 'यह पेज साझा करें', native: 'ऐप से साझा करें', copy: 'लिंक कॉपी करें', copied: 'कॉपी हो गया', close: 'शेयर मेनू बंद करें' },
  ar: { share: 'مشاركة', heading: 'مشاركة هذه الصفحة', native: 'المشاركة عبر تطبيق', copy: 'نسخ الرابط', copied: 'تم النسخ', close: 'إغلاق قائمة المشاركة' },
  ru: { share: 'Поделиться', heading: 'Поделиться страницей', native: 'Поделиться через приложение', copy: 'Копировать ссылку', copied: 'Скопировано', close: 'Закрыть меню «Поделиться»' },
  id: { share: 'Bagikan', heading: 'Bagikan halaman ini', native: 'Bagikan lewat aplikasi', copy: 'Salin tautan', copied: 'Tersalin', close: 'Tutup menu bagikan' },
  it: { share: 'Condividi', heading: 'Condividi questa pagina', native: 'Condividi con un’app', copy: 'Copia link', copied: 'Copiato', close: 'Chiudi il menu di condivisione' },
  nl: { share: 'Delen', heading: 'Deze pagina delen', native: 'Delen via een app', copy: 'Link kopiëren', copied: 'Gekopieerd', close: 'Deelmenu sluiten' },
  tr: { share: 'Paylaş', heading: 'Bu sayfayı paylaş', native: 'Bir uygulamayla paylaş', copy: 'Bağlantıyı kopyala', copied: 'Kopyalandı', close: 'Paylaşım menüsünü kapat' },
  vi: { share: 'Chia sẻ', heading: 'Chia sẻ trang này', native: 'Chia sẻ qua ứng dụng', copy: 'Sao chép liên kết', copied: 'Đã sao chép', close: 'Đóng menu chia sẻ' },
  th: { share: 'แชร์', heading: 'แชร์หน้านี้', native: 'แชร์ผ่านแอป', copy: 'คัดลอกลิงก์', copied: 'คัดลอกแล้ว', close: 'ปิดเมนูแชร์' },
  pl: { share: 'Udostępnij', heading: 'Udostępnij tę stronę', native: 'Udostępnij przez aplikację', copy: 'Kopiuj link', copied: 'Skopiowano', close: 'Zamknij menu udostępniania' },
};
