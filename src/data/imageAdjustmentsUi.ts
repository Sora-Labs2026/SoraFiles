import type { LocalePath } from '../i18n/config';

const keys = ['adjustments','light','detail','exposure','highlights','shadows','contrast','brightness','blackPoint','definition','sharpness','noiseReduction','saturation'] as const;
export type ImageAdjustmentUiKey = (typeof keys)[number];
type Pack = Record<ImageAdjustmentUiKey, string>;

function pack(values: readonly string[]): Pack {
  if (values.length !== keys.length) throw new Error(`Image adjustment translation pack has ${values.length} values; expected ${keys.length}.`);
  return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as Pack;
}

const labels: Record<LocalePath, Pack> = {
  en: pack(['Manual adjustments','Light','Detail','Exposure','Highlights','Shadows','Contrast','Brightness','Black point','Definition','Sharpness','Noise reduction','Saturation']),
  ja: pack(['手動調整','ライト','ディテール','露出','ハイライト','シャドウ','コントラスト','明るさ','ブラックポイント','精細度','シャープネス','ノイズ軽減','彩度']),
  ko: pack(['수동 조정','조명','디테일','노출','하이라이트','그림자','대비','밝기','블랙 포인트','선명도','샤프니스','노이즈 감소','채도']),
  es: pack(['Ajustes manuales','Luz','Detalle','Exposición','Iluminaciones','Sombras','Contraste','Brillo','Punto negro','Definición','Nitidez','Reducción de ruido','Saturación']),
  fr: pack(['Réglages manuels','Lumière','Détail','Exposition','Hautes lumières','Ombres','Contraste','Luminosité','Point noir','Définition','Netteté','Réduction du bruit','Saturation']),
  de: pack(['Manuelle Anpassungen','Licht','Details','Belichtung','Lichter','Schatten','Kontrast','Helligkeit','Schwarzpunkt','Definition','Schärfe','Rauschreduzierung','Sättigung']),
  pt: pack(['Ajustes manuais','Luz','Detalhe','Exposição','Realces','Sombras','Contraste','Brilho','Ponto preto','Definição','Nitidez','Redução de ruído','Saturação']),
  'zh-cn': pack(['手动调整','光线','细节','曝光','高光','阴影','对比度','亮度','黑点','清晰度','锐度','降噪','饱和度']),
  'zh-tw': pack(['手動調整','光線','細節','曝光','亮部','陰影','對比度','亮度','黑點','清晰度','銳利度','降噪','飽和度']),
  hi: pack(['मैन्युअल समायोजन','प्रकाश','विवरण','एक्सपोज़र','हाइलाइट्स','छायाएँ','कंट्रास्ट','चमक','ब्लैक पॉइंट','डेफ़िनिशन','शार्पनेस','नॉइज़ रिडक्शन','सैचुरेशन']),
  ar: pack(['تعديلات يدوية','الإضاءة','التفاصيل','التعرّض','الإضاءات العالية','الظلال','التباين','السطوع','النقطة السوداء','التحديد','الحدة','تقليل التشويش','التشبع']),
  ru: pack(['Ручные настройки','Свет','Детали','Экспозиция','Светлые области','Тени','Контраст','Яркость','Точка чёрного','Чёткость','Резкость','Шумоподавление','Насыщенность']),
  id: pack(['Penyesuaian manual','Cahaya','Detail','Eksposur','Sorotan','Bayangan','Kontras','Kecerahan','Titik hitam','Definisi','Ketajaman','Pengurangan noise','Saturasi']),
  it: pack(['Regolazioni manuali','Luce','Dettaglio','Esposizione','Luci','Ombre','Contrasto','Luminosità','Punto di nero','Definizione','Nitidezza','Riduzione rumore','Saturazione']),
  nl: pack(['Handmatige aanpassingen','Licht','Detail','Belichting','Hooglichten','Schaduwen','Contrast','Helderheid','Zwartpunt','Definitie','Scherpte','Ruisonderdrukking','Verzadiging']),
  tr: pack(['Manuel ayarlar','Işık','Ayrıntı','Pozlama','Vurgular','Gölgeler','Kontrast','Parlaklık','Siyah nokta','Tanım','Keskinlik','Gürültü azaltma','Doygunluk']),
  vi: pack(['Điều chỉnh thủ công','Ánh sáng','Chi tiết','Phơi sáng','Vùng sáng','Vùng tối','Tương phản','Độ sáng','Điểm đen','Độ rõ','Độ sắc nét','Giảm nhiễu','Độ bão hòa']),
  th: pack(['การปรับด้วยตนเอง','แสง','รายละเอียด','การรับแสง','ส่วนสว่าง','เงา','คอนทราสต์','ความสว่าง','จุดดำ','ความชัด','ความคมชัด','ลดจุดรบกวน','ความอิ่มสี']),
  pl: pack(['Regulacja ręczna','Światło','Szczegóły','Ekspozycja','Światła','Cienie','Kontrast','Jasność','Punkt czerni','Wyrazistość','Ostrość','Redukcja szumów','Nasycenie']),
};

export const imageAdjustmentText = (locale: LocalePath, key: ImageAdjustmentUiKey) => labels[locale][key];
