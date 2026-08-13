import type { LocalePath } from './config';

export interface OcrMessages {
  languageLabel: string;
  languageHelp: string;
  automaticFallback: string;
  inspecting: string;
  loadingModel: string;
  recognizingPage: string;
  ocrSummary: string;
  lowConfidence: string;
  tooManyScans: string;
  unavailable: string;
  cancel: string;
  cancelled: string;
  layoutWarning: string;
}

export function formatOcrMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return values[key] !== undefined ? String(values[key]) : `{${key}}`;
  });
}

export const ocrMessages: Record<LocalePath, OcrMessages> = {
  en: {
    languageLabel: 'Document language',
    languageHelp: 'Select the language of the scanned text for optimal recognition.',
    automaticFallback: 'Scanned pages are automatically recognized using local OCR.',
    inspecting: 'Inspecting PDF pages for readable text…',
    loadingModel: 'Loading local OCR model ({code})…',
    recognizingPage: 'Recognizing scanned page {current} of {total}…',
    ocrSummary: '{pages} scanned page(s) recognized with local OCR.',
    lowConfidence: 'Low confidence on page {current} ({confidence}%). Double-check output text.',
    tooManyScans: 'More than 20 pages require OCR. Processing may take a few minutes.',
    unavailable: 'Local OCR failed to load. Text-only extraction was used.',
    cancel: 'Cancel OCR',
    cancelled: 'OCR processing cancelled.',
    layoutWarning:
      'Complex layouts may become simplified paragraphs. Scanned pages are recognized locally with OCR; accuracy depends on scan clarity, language, handwriting, and page structure.',
  },
  ja: {
    languageLabel: 'ドキュメントの言語',
    languageHelp: '最適な認識のため、スキャンされたテキストの言語を選択してください。',
    automaticFallback: 'スキャンされたページはローカルOCRを使用して自動的に認識されます。',
    inspecting: 'PDFページ内の読み取り可能なテキストを確認中…',
    loadingModel: 'ローカルOCRモデル ({code}) を読み込み中…',
    recognizingPage: 'スキャンページ {current} / {total} を認識中…',
    ocrSummary: '{pages} ページのスキャンページをローカルOCRで認識しました。',
    lowConfidence: '{current} ページの認識精度が低めです ({confidence}%)。結果を確認してください。',
    tooManyScans: '20ページ以上でOCRが必要です。処理に数分かかる場合があります。',
    unavailable: 'ローカルOCRの読み込みに失敗しました。テキストのみ抽出を行いました。',
    cancel: 'OCRをキャンセル',
    cancelled: 'OCR処理がキャンセルされました。',
    layoutWarning:
      '複雑なレイアウトはシンプルな段落に統合される場合があります。スキャンページはローカルOCRで認識されます。精度は画像の鮮明さ、言語、手書き文字、レイアウト構成に依存します。',
  },
  ko: {
    languageLabel: '문서 언어',
    languageHelp: '최적의 인식을 위해 스캔된 텍스트의 언어를 선택하세요.',
    automaticFallback: '스캔된 페이지는 로컬 OCR을 사용하여 자동으로 인식됩니다.',
    inspecting: 'PDF 페이지에서 읽을 수 있는 텍스트 검사 중…',
    loadingModel: '로컬 OCR 모델 ({code}) 불러오는 중…',
    recognizingPage: '스캔된 페이지 인식 중: {current} / {total}…',
    ocrSummary: '{pages}개의 스캔된 페이지를 로컬 OCR로 인식했습니다.',
    lowConfidence: '{current} 페이지의 인식 신뢰도가 낮습니다 ({confidence}%). 텍스트를 재확인하세요.',
    tooManyScans: '20페이지 이상에서 OCR이 필요합니다. 처리에 수 분이 걸릴 수 있습니다.',
    unavailable: '로컬 OCR을 로드하지 못했습니다. 텍스트 추출만 진행되었습니다.',
    cancel: 'OCR 취소',
    cancelled: 'OCR 처리가 취소되었습니다.',
    layoutWarning:
      '복잡한 레이아웃은 단편적인 단락으로 단순화될 수 있습니다. 스캔된 페이지는 로컬 OCR로 인식되며, 정확도는 화질, 언어, 손글씨, 레이아웃에 따라 달라집니다.',
  },
  es: {
    languageLabel: 'Idioma del documento',
    languageHelp: 'Seleccione el idioma del texto escaneado para un reconocimiento óptimo.',
    automaticFallback: 'Las páginas escaneadas se reconocen automáticamente mediante OCR local.',
    inspecting: 'Inspeccionando páginas PDF en busca de texto legible…',
    loadingModel: 'Cargando modelo OCR local ({code})…',
    recognizingPage: 'Reconociendo página escaneada {current} de {total}…',
    ocrSummary: '{pages} página(s) escaneada(s) reconocida(s) con OCR local.',
    lowConfidence: 'Baja confianza en la página {current} ({confidence}%). Verifique el texto obtenido.',
    tooManyScans: 'Más de 20 páginas requieren OCR. El procesamiento puede tardar varios minutos.',
    unavailable: 'No se pudo cargar el OCR local. Se utilizó extracción de texto simple.',
    cancel: 'Cancelar OCR',
    cancelled: 'Procesamiento OCR cancelado.',
    layoutWarning:
      'Los diseños complejos pueden convertirse en párrafos simples. Las páginas escaneadas se reconocen localmente con OCR; la precisión depende de la claridad, el idioma, la letra manuscrita y la estructura.',
  },
  fr: {
    languageLabel: 'Langue du document',
    languageHelp: 'Sélectionnez la langue du texte scanné pour une reconnaissance optimale.',
    automaticFallback: 'Les pages scannées sont automatiquement reconnues à l’aide de l’OCR local.',
    inspecting: 'Inspection des pages du PDF pour le texte lisible…',
    loadingModel: 'Chargement du modèle OCR local ({code})…',
    recognizingPage: 'Reconnaissance de la page scannée {current} sur {total}…',
    ocrSummary: '{pages} page(s) scannée(s) reconnue(s) avec l’OCR local.',
    lowConfidence: 'Confiance faible sur la page {current} ({confidence}%). Vérifiez le texte généré.',
    tooManyScans: 'Plus de 20 pages nécessitent l’OCR. Le traitement peut prendre quelques minutes.',
    unavailable: 'Échec du chargement de l’OCR local. Seule l’extraction de texte a été effectuée.',
    cancel: 'Annuler l’OCR',
    cancelled: 'Traitement OCR annulé.',
    layoutWarning:
      'Les mises en page complexes peuvent être simplifiées en paragraphes. Les pages scannées sont reconnues localement avec l’OCR; la précision dépend de la netteté, de la langue, de l’écriture manuscrite et de la structure.',
  },
  de: {
    languageLabel: 'Dokumentsprache',
    languageHelp: 'Wählen Sie die Sprache des gescannten Textes für eine optimale Erkennung.',
    automaticFallback: 'Gescannte Seiten werden automatisch mit lokaler OCR erkannt.',
    inspecting: 'PDF-Seiten werden auf lesbaren Text überprüft…',
    loadingModel: 'Lokales OCR-Modell ({code}) wird geladen…',
    recognizingPage: 'Gescannte Seite {current} von {total} wird erkannt…',
    ocrSummary: '{pages} gescannte Seite(n) mit lokaler OCR erkannt.',
    lowConfidence: 'Geringe Erkennungsgenauigkeit auf Seite {current} ({confidence}%). Bitte Text überprüfen.',
    tooManyScans: 'Mehr als 20 Seiten benötigen OCR. Die Verarbeitung kann einige Minuten dauern.',
    unavailable: 'Lokales OCR konnte nicht geladen werden. Nur Reinextraktion durchgeführt.',
    cancel: 'OCR abbrechen',
    cancelled: 'OCR-Verarbeitung abgebrochen.',
    layoutWarning:
      'Komplexe Layouts werden zu einfachen Absätzen zusammengefasst. Gescannte Seiten werden lokal per OCR erkannt; die Genauigkeit hängt von Bildschärfe, Sprache, Handschrift und Struktur ab.',
  },
  pt: {
    languageLabel: 'Idioma do documento',
    languageHelp: 'Selecione o idioma do texto digitalizado para obter o melhor reconhecimento.',
    automaticFallback: 'Páginas digitalizadas são reconhecidas automaticamente via OCR local.',
    inspecting: 'Inspecionando páginas do PDF para localizar texto legível…',
    loadingModel: 'Carregando modelo OCR local ({code})…',
    recognizingPage: 'Reconhecendo página digitalizada {current} de {total}…',
    ocrSummary: '{pages} página(s) digitalizada(s) reconhecida(s) com OCR local.',
    lowConfidence: 'Baixa precisão na página {current} ({confidence}%). Verifique o texto gerado.',
    tooManyScans: 'Mais de 20 páginas requerem OCR. O processamento pode levar alguns minutos.',
    unavailable: 'Falha ao carregar o OCR local. Apenas extração direta de texto foi realizada.',
    cancel: 'Cancelar OCR',
    cancelled: 'Processamento OCR cancelado.',
    layoutWarning:
      'Layouts complexos podem se tornar parágrafos simples. Páginas digitalizadas são reconhecidas localmente com OCR; a precisão depende da nitidez, idioma, caligrafia e estrutura.',
  },
  'zh-cn': {
    languageLabel: '文档语言',
    languageHelp: '选择扫描文本的对应语言，以获得最佳识别效果。',
    automaticFallback: '扫描页面将通过本地 OCR 自动识别。',
    inspecting: '正在检查 PDF 页面中的可读文本…',
    loadingModel: '正在加载本地 OCR 模型 ({code})…',
    recognizingPage: '正在识别扫描页面 {current} / {total}…',
    ocrSummary: '已通过本地 OCR 成功识别 {pages} 个扫描页面。',
    lowConfidence: '第 {current} 页识别可信度较低 ({confidence}%)。请仔细核对文本。',
    tooManyScans: '超过 20 个页面需要 OCR 识别，处理可能需要几分钟。',
    unavailable: '本地 OCR 加载失败，已回退为纯文本提取。',
    cancel: '取消 OCR',
    cancelled: 'OCR 识别处理已取消。',
    layoutWarning:
      '复杂排版可能会被简化为普通段落。扫描页面均在本地使用 OCR 进行识别；准确率取决于清晰度、语言、手写字迹及页面结构。',
  },
  'zh-tw': {
    languageLabel: '文件語言',
    languageHelp: '選擇掃描文字的對應語言，以獲得最佳辨識效果。',
    automaticFallback: '掃描頁面將透過本機 OCR 自動辨識。',
    inspecting: '正在檢查 PDF 頁面中的可讀文字…',
    loadingModel: '正在載入本機 OCR 模型 ({code})…',
    recognizingPage: '正在辨識掃描頁面 {current} / {total}…',
    ocrSummary: '已透過本機 OCR 成功辨識 {pages} 個掃描頁面。',
    lowConfidence: '第 {current} 頁辨識信心度較低 ({confidence}%)。請仔細核對文字。',
    tooManyScans: '超過 20 個頁面需要 OCR 辨識，處理可能需要數分鐘。',
    unavailable: '本機 OCR 載入失敗，已退回為純文字擷取。',
    cancel: '取消 OCR',
    cancelled: 'OCR 辨識處理已取消。',
    layoutWarning:
      '複雜版面可能會被簡化为普通段落。掃描頁面均在本機使用 OCR 進行辨識；準確度取決於清晰度、語言、手寫字跡及頁面結構。',
  },
  hi: {
    languageLabel: 'दस्तावेज़ की भाषा',
    languageHelp: 'सर्वोत्तम पहचान के लिए स्कैन किए गए टेक्स्ट की भाषा चुनें।',
    automaticFallback: 'स्कैन किए गए पृष्ठ स्थानीय OCR का उपयोग करके स्वचालित रूप से पहचाने जाते हैं।',
    inspecting: 'पठनीय टेक्स्ट के लिए PDF पृष्ठों की जाँच की जा रही है…',
    loadingModel: 'स्थानीय OCR मॉडल ({code}) लोड हो रहा है…',
    recognizingPage: 'स्कैन किए गए पृष्ठ {current} / {total} की पहचान की जा रही है…',
    ocrSummary: 'स्थानीय OCR द्वारा {pages} स्कैन किए गए पृष्ठ पहचाने गए।',
    lowConfidence: 'पृष्ठ {current} पर कम विश्वसनीयता ({confidence}%)। टेक्स्ट की पुनः जाँच करें।',
    tooManyScans: '20 से अधिक पृष्ठों को OCR की आवश्यकता है। इसमें कुछ मिनट लग सकते हैं।',
    unavailable: 'स्थानीय OCR लोड करने में विफ़ल। केवल टेक्स्ट निष्कर्षण का उपयोग किया गया।',
    cancel: 'OCR रद्द करें',
    cancelled: 'OCR प्रक्रिया रद्द कर दी गई।',
    layoutWarning:
      'जटिल लेआउट सरल पैराग्राफ बन सकते हैं। स्कैन किए गए पृष्ठों को OCR से स्थानीय रूप से पहचाना जाता है; सटीकता स्पष्टता, भाषा, लिखावट और संरचना पर निर्भर करती है।',
  },
  ar: {
    languageLabel: 'لغة المستند',
    languageHelp: 'حدد لغة النص الممسوح ضوئيًا للحصول على أفضل التعرف.',
    automaticFallback: 'يتم التعرف على الصفحات الممسوحة ضوئيًا تلقائيًا باستخدام OCR المحلي.',
    inspecting: 'جاري فحص صفحات PDF للبحث عن نص قابل للقراءة…',
    loadingModel: 'جاري تحميل نموذج OCR المحلي ({code})…',
    recognizingPage: 'جاري التعرف على الصفحة الممسوحة {current} من {total}…',
    ocrSummary: 'تم التعرف على {pages} صفحة ممسوحة ضوئيًا بواسطة OCR المحلي.',
    lowConfidence: 'دقة منخفضة في الصفحة {current} ({confidence}%). يرجى مراجعة النص المستخرج.',
    tooManyScans: 'أكثر من 20 صفحة تتطلب OCR. قد يستغرق المعالجة بضع دقائق.',
    unavailable: 'تعذر تحميل OCR المحلي. تم استخدام استخراج النص المباشر فقط.',
    cancel: 'إلغاء OCR',
    cancelled: 'تم إلغاء عملية OCR.',
    layoutWarning:
      'قد تتحول التنسيقات المعقدة إلى فقرات بسيطة. يتم التعرف على الصفحات الممسوحة محليًا بواسطة OCR؛ وتعتمد الدقة على وضوح المسح واللغة وخط اليد وهيكل الصفحة.',
  },
  ru: {
    languageLabel: 'Язык документа',
    languageHelp: 'Выберите язык отсканированного текста для оптимального распознавания.',
    automaticFallback: 'Отсканированные страницы автоматически распознаются с помощью локального OCR.',
    inspecting: 'Проверка страниц PDF на наличие читаемого текста…',
    loadingModel: 'Загрузка локальной модели OCR ({code})…',
    recognizingPage: 'Распознавание отсканированной страницы {current} из {total}…',
    ocrSummary: 'Распознано страниц с помощью локального OCR: {pages}.',
    lowConfidence: 'Низкая точность на странице {current} ({confidence}%). Проверьте полученный текст.',
    tooManyScans: 'Более 20 страниц требуют OCR. Обработка может занять несколько минут.',
    unavailable: 'Не удалось загрузить локальный OCR. Выполнено прямое извлечение текста.',
    cancel: 'Отмена OCR',
    cancelled: 'Распознавание OCR отменено.',
    layoutWarning:
      'Сложные макеты могут превратиться в простые абзацы. Сканированные страницы распознаются локально; точность зависит от чёткости, языка, почерка и структуры.',
  },
  id: {
    languageLabel: 'Bahasa dokumen',
    languageHelp: 'Pilih bahasa teks hasil pemindaian untuk pengenalan optimal.',
    automaticFallback: 'Halaman hasil pemindaian dikenali secara otomatis menggunakan OCR lokal.',
    inspecting: 'Memeriksa halaman PDF untuk teks yang dapat dibaca…',
    loadingModel: 'Memuat model OCR lokal ({code})…',
    recognizingPage: 'Mengenali halaman pindai {current} dari {total}…',
    ocrSummary: '{pages} halaman pindai berhasil dikenali dengan OCR lokal.',
    lowConfidence: 'Tingkat akurasi rendah pada halaman {current} ({confidence}%). Periksa kembali teks.',
    tooManyScans: 'Lebih dari 20 halaman memerlukan OCR. Proses mungkin memakan waktu beberapa menit.',
    unavailable: 'Gagal memuat OCR lokal. Menggunakan ekstraksi teks biasa.',
    cancel: 'Batalkan OCR',
    cancelled: 'Proses OCR dibatalkan.',
    layoutWarning:
      'Tata letak rumit dapat berubah menjadi paragraf sederhana. Halaman pindai dikenali secara lokal dengan OCR; akurasi bergantung pada kejelasan pindai, bahasa, tulisan tangan, dan struktur.',
  },
  it: {
    languageLabel: 'Lingua del documento',
    languageHelp: 'Seleziona la lingua del testo scansionato per un riconoscimento ottimale.',
    automaticFallback: 'Le pagine scansionate vengono riconosciute automaticamente tramite OCR locale.',
    inspecting: 'Ispezione delle pagine PDF per testo leggibile…',
    loadingModel: 'Caricamento del modello OCR locale ({code})…',
    recognizingPage: 'Riconoscimento della pagina scansionata {current} di {total}…',
    ocrSummary: '{pages} pagina/e scansionata/e riconosciuta/e con OCR locale.',
    lowConfidence: 'Accuratezza ridotta alla pagina {current} ({confidence}%). Verificare il testo.',
    tooManyScans: 'Più di 20 pagine richiedono l’OCR. L’elaborazione potrebbe richiedere alcuni minuti.',
    unavailable: 'Impossibile caricare l’OCR locale. È stata eseguita solo l’estrazione del testo.',
    cancel: 'Annulla OCR',
    cancelled: 'Elaborazione OCR annullata.',
    layoutWarning:
      'I layout complessi possono essere semplificati in paragrafi. Le pagine scansionate sono elaborate localmente con OCR; la precisione dipende da nitidezza, lingua, scrittura e struttura.',
  },
  nl: {
    languageLabel: 'Documenttaal',
    languageHelp: 'Selecteer de taal van de gescande tekst voor optimale herkenning.',
    automaticFallback: 'Gescande pagina’s worden automatisch herkend met behulp van lokale OCR.',
    inspecting: 'PDF-pagina’s controleren op leesbare tekst…',
    loadingModel: 'Lokaal OCR-model laden ({code})…',
    recognizingPage: 'Gescande pagina {current} van {total} herkennen…',
    ocrSummary: '{pages} gescande pagina(’s) herkend met lokale OCR.',
    lowConfidence: 'Lage nauwkeurigheid op pagina {current} ({confidence}%). Controleer de tekst.',
    tooManyScans: 'Meer dan 20 pagina’s vereisen OCR. De verwerking kan enkele minuten duren.',
    unavailable: 'Lokaal OCR kon niet worden geladen. Alleen tekstextractie uitgevoerd.',
    cancel: 'OCR annuleren',
    cancelled: 'OCR-verwerking geannuleerd.',
    layoutWarning:
      'Complexe lay-outs kunnen vereenvoudigde alinea’s worden. Gescande pagina’s worden lokaal verwerkt met OCR; nauwkeurigheid hangt af van scherpte, taal, handschrift en structuur.',
  },
  tr: {
    languageLabel: 'Belge dili',
    languageHelp: 'En iyi tanımlama için taranan metnin dilini seçin.',
    automaticFallback: 'Taranan sayfalar yerel OCR kullanılarak otomatik olarak tanınır.',
    inspecting: 'PDF sayfaları okunabilir metin için inceleniyor…',
    loadingModel: 'Yerel OCR modeli ({code}) yükleniyor…',
    recognizingPage: 'Taranan sayfa {current} / {total} tanınıyor…',
    ocrSummary: '{pages} taranan sayfa yerel OCR ile tanındı.',
    lowConfidence: 'Sayfa {current} üzerinde düşük doğruluk ({confidence}%). Metni kontrol edin.',
    tooManyScans: '20’den fazla sayfa OCR gerektiriyor. İşlem birkaç dakika sürebilir.',
    unavailable: 'Yerel OCR yüklenemedi. Yalnızca düz metin çıkarma işlemi uygulandı.',
    cancel: 'OCR’ı İptal Et',
    cancelled: 'OCR işlemi iptal edildi.',
    layoutWarning:
      'Karmaşık düzenler basit paragraflara dönüşebilir. Taranan sayfalar yerel OCR ile tanınır; doğruluk netlik, dil, el yazısı ve sayfa yapısına bağlıdır.',
  },
  vi: {
    languageLabel: 'Ngôn ngữ tài liệu',
    languageHelp: 'Chọn ngôn ngữ của văn bản quét để nhận dạng tối ưu.',
    automaticFallback: 'Các trang quét được tự động nhận dạng bằng OCR cục bộ.',
    inspecting: 'Đang kiểm tra các trang PDF để tìm văn bản có thể đọc…',
    loadingModel: 'Đang tải mô hình OCR cục bộ ({code})…',
    recognizingPage: 'Đang nhận dạng trang quét {current} / {total}…',
    ocrSummary: 'Đã nhận dạng {pages} trang quét bằng OCR cục bộ.',
    lowConfidence: 'Độ tin cậy thấp tại trang {current} ({confidence}%). Vui lòng kiểm tra lại văn bản.',
    tooManyScans: 'Hơn 20 trang yêu cầu OCR. Quá trình xử lý có thể mất vài phút.',
    unavailable: 'Không thể tải OCR cục bộ. Chỉ trích xuất văn bản đơn thuần.',
    cancel: 'Hủy OCR',
    cancelled: 'Đã hủy quá trình xử lý OCR.',
    layoutWarning:
      'Bố cục phức tạp có thể trở thành các đoạn văn đơn giản. Các trang quét được nhận dạng cục bộ bằng OCR; độ chính xác phụ thuộc vào độ rõ, ngôn ngữ, chữ viết tay và cấu trúc.',
  },
  th: {
    languageLabel: 'ภาษาของเอกสาร',
    languageHelp: 'เลือกภาษาของข้อความที่สแกนเพื่อการประมวลผลที่ดีที่สุด',
    automaticFallback: 'หน้าเอกสารที่สแกนจะถูกจดจำโดยอัตโนมัติด้วย OCR ในเครื่อง',
    inspecting: 'กำลังตรวจสอบหน้า PDF เพื่อหาข้อความที่อ่านได้…',
    loadingModel: 'กำลังโหลดโมเดล OCR ในเครื่อง ({code})…',
    recognizingPage: 'กำลังประมวลผลหน้าสแกนที่ {current} จาก {total}…',
    ocrSummary: 'ประมวลผลหน้าสแกนสำเร็จ {pages} หน้าด้วย OCR ในเครื่อง',
    lowConfidence: 'ความแม่นยำต่ำในหน้าที่ {current} ({confidence}%) กรุณาตรวจสอบข้อความ',
    tooManyScans: 'มีหน้าเอกสารมากกว่า 20 หน้าที่ต้องใช้ OCR อาจใช้เวลาประมวลผลหลายนาที',
    unavailable: 'ไม่สามารถโหลด OCR ในเครื่องได้ ดำเนินการสกัดข้อความธรรมดาเท่านั้น',
    cancel: 'ยกเลิก OCR',
    cancelled: 'ยกเลิกการประมวลผล OCR แล้ว',
    layoutWarning:
      'เลย์เอาต์ที่ซับซ้อนอาจถูกจัดรูปแบบเป็นย่อหน้าอย่างง่าย หน้าที่สแกนจะถูกประมวลผลในเครื่องด้วย OCR ความแม่นยำขึ้นอยู่กับความคมชัด ภาษา ลายมือ และโครงสร้างหน้าเอกสาร',
  },
  pl: {
    languageLabel: 'Język dokumentu',
    languageHelp: 'Wybierz język zeskanowanego tekstu dla optymalnego rozpoznawania.',
    automaticFallback: 'Zeskanowane strony są automatycznie rozpoznawane przy użyciu lokalnego OCR.',
    inspecting: 'Sprawdzanie stron PDF pod kątem czytelnego tekstu…',
    loadingModel: 'Wczytywanie lokalnego modelu OCR ({code})…',
    recognizingPage: 'Rozpoznawanie zeskanowanej strony {current} z {total}…',
    ocrSummary: 'Rozpoznano {pages} zeskanowanych stron za pomocą lokalnego OCR.',
    lowConfidence: 'Niska dokładność na stronie {current} ({confidence}%). Sprawdź tekst wyjściowy.',
    tooManyScans: 'Więcej niż 20 stron wymaga OCR. Przetwarzanie może potrwać kilka minut.',
    unavailable: 'Nie udało się wczytać lokalnego OCR. Użyto tylko ekstrakcji zwykłego tekstu.',
    cancel: 'Anuluj OCR',
    cancelled: 'Przetwarzanie OCR zostało anulowane.',
    layoutWarning:
      'Złożone układy mogą zostać uproszczone do zwykłych akapitów. Zeskanowane strony są rozpoznawane lokalnie przez OCR; dokładność zależy od ostrości, języka, pisma ręcznego i struktury.',
  },
};

export function getOcrMessages(locale: LocalePath): OcrMessages {
  return ocrMessages[locale] ?? ocrMessages.en;
}
