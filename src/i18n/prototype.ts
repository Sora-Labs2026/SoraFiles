import type {LocalePath} from './config';
import {localeContent} from './index';
import {getWorkbenchMessages} from './workbench';

// The English keys are the locked prototype copy. Other languages translate its
// visible text without changing the prototype's structure or interactions.
const keys = [
  'Desktop','Help','Guides','Overview','Plans','Download','Releases','Legal',
  'Processed on your device.',
  'Supported tools run in your browser. File contents are never sent to a SoraFiles server.',
  'Right-click a file. Pick a tool. Done.',
  'Run SoraFiles from your file manager, on one file or a whole batch. Fewer steps for repeat work.',
  'Explore Desktop','Everyday PDF','and image tools.',
  'Compress, convert, merge and sign files in your browser. Free, no account.',
] as const;
type Key = typeof keys[number];
const rows:Record<Exclude<LocalePath,'en'>,readonly string[]> = {
  ja:['デスクトップ','ヘルプ','ガイド','概要','プラン','ダウンロード','リリース情報','法的情報','お使いの端末内で処理。','対応ツールはブラウザ内で動作します。ファイルの内容がSoraFilesのサーバーに送信されることはありません。','右クリックして、ツールを選ぶだけ。','ファイルマネージャーからSoraFilesを実行。1つのファイルも、まとめて複数のファイルも、少ない手順で処理できます。','デスクトップ版を見る','毎日のPDF・','画像ツール。','ブラウザでファイルを圧縮、変換、結合、署名。無料、アカウント不要。'],
  ko:['데스크톱','도움말','가이드','개요','요금제','다운로드','출시 정보','법률 정보','기기에서 처리됩니다.','지원되는 도구는 브라우저에서 실행됩니다. 파일 내용은 SoraFiles 서버로 전송되지 않습니다.','파일을 마우스 오른쪽 버튼으로 클릭하고 도구를 선택하면 끝.','파일 관리자에서 SoraFiles를 실행하세요. 파일 하나나 여러 파일을 더 적은 단계로 처리할 수 있습니다.','데스크톱 알아보기','일상에 필요한 PDF와','이미지 도구.','브라우저에서 파일을 압축, 변환, 병합하고 서명하세요. 무료이며 계정이 필요 없습니다.'],
  es:['Escritorio','Ayuda','Guías','Descripción general','Planes','Descargar','Versiones','Avisos legales','Procesado en tu dispositivo.','Las herramientas compatibles funcionan en tu navegador. El contenido de los archivos nunca se envía a un servidor de SoraFiles.','Haz clic derecho en un archivo. Elige una herramienta. Listo.','Usa SoraFiles desde el gestor de archivos, con uno o varios archivos. Menos pasos para las tareas repetitivas.','Explorar la app de escritorio','Herramientas cotidianas','para PDF e imágenes.','Comprime, convierte, une y firma archivos en tu navegador. Gratis y sin cuenta.'],
  fr:['Bureau','Aide','Guides','Présentation','Offres','Télécharger','Versions','Mentions légales','Traité sur votre appareil.','Les outils compatibles fonctionnent dans votre navigateur. Le contenu des fichiers n’est jamais envoyé à un serveur SoraFiles.','Cliquez droit sur un fichier. Choisissez un outil. C’est fait.','Utilisez SoraFiles depuis votre gestionnaire de fichiers, pour un fichier ou tout un lot. Moins d’étapes pour les tâches répétitives.','Découvrir la version bureau','Des outils PDF et image','pour tous les jours.','Compressez, convertissez, fusionnez et signez dans votre navigateur. Gratuit, sans compte.'],
  de:['Desktop','Hilfe','Anleitungen','Übersicht','Tarife','Herunterladen','Versionen','Rechtliches','Auf deinem Gerät verarbeitet.','Unterstützte Tools laufen im Browser. Dateiinhalte werden niemals an einen SoraFiles-Server gesendet.','Rechtsklick auf eine Datei. Tool wählen. Fertig.','Starte SoraFiles im Dateimanager für eine Datei oder einen ganzen Stapel. Weniger Schritte bei wiederkehrenden Aufgaben.','Desktop-App entdecken','PDF- und Bildtools','für jeden Tag.','Dateien im Browser komprimieren, konvertieren, zusammenfügen und signieren. Kostenlos, ohne Konto.'],
  pt:['Computador','Ajuda','Guias','Visão geral','Planos','Transferir','Versões','Informações legais','Processado no seu dispositivo.','As ferramentas suportadas funcionam no navegador. O conteúdo dos ficheiros nunca é enviado para um servidor SoraFiles.','Clique com o botão direito num ficheiro. Escolha uma ferramenta. Feito.','Use o SoraFiles no gestor de ficheiros, com um ficheiro ou um lote inteiro. Menos passos para tarefas repetidas.','Explorar a versão para computador','Ferramentas PDF e imagem','para o dia a dia.','Comprima, converta, una e assine ficheiros no navegador. Grátis e sem conta.'],
  'zh-cn':['桌面版','帮助','指南','概览','方案','下载','发布版本','法律信息','在您的设备上处理。','支持的工具在浏览器中运行。文件内容绝不会发送到 SoraFiles 服务器。','右键单击文件，选择工具，即可完成。','直接从文件管理器运行 SoraFiles，处理单个文件或整批文件。重复工作所需步骤更少。','了解桌面版','日常 PDF 与','图像工具。','在浏览器中压缩、转换、合并和签署文件。免费，无需账户。'],
  'zh-tw':['桌面版','說明','指南','總覽','方案','下載','發行版本','法律資訊','在您的裝置上處理。','支援的工具在瀏覽器中執行。檔案內容絕不會傳送至 SoraFiles 伺服器。','在檔案上按一下右鍵，選擇工具，就完成了。','直接從檔案管理員執行 SoraFiles，處理單一檔案或整批檔案。重複工作所需步驟更少。','探索桌面版','日常 PDF 與','圖片工具。','在瀏覽器中壓縮、轉換、合併及簽署檔案。免費，無需帳戶。'],
  hi:['डेस्कटॉप','सहायता','मार्गदर्शिकाएँ','परिचय','प्लान','डाउनलोड','रिलीज़','कानूनी','आपके डिवाइस पर संसाधित।','समर्थित टूल आपके ब्राउज़र में चलते हैं। फ़ाइल की सामग्री कभी SoraFiles सर्वर पर नहीं भेजी जाती।','फ़ाइल पर राइट-क्लिक करें। टूल चुनें। बस हो गया।','फ़ाइल मैनेजर से SoraFiles चलाएँ, एक फ़ाइल या पूरा बैच संसाधित करें। बार-बार के काम में कम चरण लगते हैं।','डेस्कटॉप देखें','रोज़मर्रा के PDF','और छवि टूल।','ब्राउज़र में फ़ाइलें संपीड़ित, परिवर्तित, मर्ज और साइन करें। मुफ़्त, बिना खाते के।'],
  ar:['سطح المكتب','المساعدة','الأدلة','نظرة عامة','الخطط','تنزيل','الإصدارات','الشؤون القانونية','تُعالج على جهازك.','تعمل الأدوات المدعومة في متصفحك. لا يُرسل محتوى الملفات مطلقًا إلى خادم SoraFiles.','انقر بزر الفأرة الأيمن على ملف. اختر أداة. تم.','شغّل SoraFiles من مدير الملفات، لملف واحد أو لمجموعة كاملة. خطوات أقل للعمل المتكرر.','استكشف تطبيق سطح المكتب','أدوات PDF والصور','للاستخدام اليومي.','اضغط الملفات وحوّلها وادمجها ووقّعها في متصفحك. مجانًا ودون حساب.'],
  ru:['Для компьютера','Помощь','Руководства','Обзор','Тарифы','Скачать','Выпуски','Правовая информация','Обрабатывается на вашем устройстве.','Поддерживаемые инструменты работают в браузере. Содержимое файлов никогда не отправляется на сервер SoraFiles.','Нажмите на файл правой кнопкой. Выберите инструмент. Готово.','Запускайте SoraFiles из файлового менеджера для одного файла или целого набора. Меньше шагов для повторяющихся задач.','Узнать о версии для компьютера','Инструменты для PDF','и изображений на каждый день.','Сжимайте, конвертируйте, объединяйте и подписывайте файлы в браузере. Бесплатно, без аккаунта.'],
  id:['Desktop','Bantuan','Panduan','Ikhtisar','Paket','Unduh','Rilis','Hukum','Diproses di perangkat Anda.','Alat yang didukung berjalan di browser Anda. Isi file tidak pernah dikirim ke server SoraFiles.','Klik kanan file. Pilih alat. Selesai.','Jalankan SoraFiles dari pengelola file untuk satu file atau sekaligus banyak file. Lebih sedikit langkah untuk pekerjaan berulang.','Jelajahi Desktop','Alat PDF dan gambar','untuk sehari-hari.','Kompres, konversi, gabungkan, dan tanda tangani file di browser. Gratis, tanpa akun.'],
  it:['Desktop','Aiuto','Guide','Panoramica','Piani','Scarica','Versioni','Note legali','Elaborato sul tuo dispositivo.','Gli strumenti supportati funzionano nel browser. Il contenuto dei file non viene mai inviato a un server SoraFiles.','Fai clic destro su un file. Scegli uno strumento. Fatto.','Avvia SoraFiles dal file manager, per un file o un intero gruppo. Meno passaggi per le attività ripetitive.','Scopri la versione desktop','Strumenti PDF e immagini','per tutti i giorni.','Comprimi, converti, unisci e firma file nel browser. Gratis, senza account.'],
  nl:['Desktop','Help','Handleidingen','Overzicht','Abonnementen','Downloaden','Versies','Juridisch','Verwerkt op je apparaat.','Ondersteunde tools draaien in je browser. De inhoud van bestanden wordt nooit naar een SoraFiles-server gestuurd.','Klik met rechts op een bestand. Kies een tool. Klaar.','Gebruik SoraFiles vanuit je bestandsbeheer voor één bestand of een hele reeks. Minder stappen voor terugkerend werk.','Ontdek Desktop','PDF- en afbeeldingstools','voor elke dag.','Comprimeer, converteer, voeg samen en onderteken bestanden in je browser. Gratis, zonder account.'],
  tr:['Masaüstü','Yardım','Kılavuzlar','Genel bakış','Planlar','İndir','Sürümler','Yasal','Cihazınızda işlenir.','Desteklenen araçlar tarayıcınızda çalışır. Dosya içeriği hiçbir zaman SoraFiles sunucusuna gönderilmez.','Dosyaya sağ tıklayın. Bir araç seçin. Bitti.','SoraFiles’ı dosya yöneticinizden tek dosya veya tüm toplu işlem için çalıştırın. Tekrarlanan işler için daha az adım.','Masaüstünü keşfedin','Günlük PDF ve','görsel araçları.','Tarayıcınızda dosyaları sıkıştırın, dönüştürün, birleştirin ve imzalayın. Ücretsiz, hesap gerekmez.'],
  vi:['Máy tính','Trợ giúp','Hướng dẫn','Tổng quan','Gói dịch vụ','Tải xuống','Bản phát hành','Pháp lý','Được xử lý trên thiết bị của bạn.','Các công cụ được hỗ trợ chạy trong trình duyệt. Nội dung tệp không bao giờ được gửi đến máy chủ SoraFiles.','Nhấp chuột phải vào tệp. Chọn công cụ. Xong.','Chạy SoraFiles từ trình quản lý tệp, với một tệp hoặc cả loạt tệp. Ít bước hơn cho công việc lặp lại.','Khám phá bản máy tính','Công cụ PDF và ảnh','hằng ngày.','Nén, chuyển đổi, ghép và ký tệp ngay trong trình duyệt. Miễn phí, không cần tài khoản.'],
  th:['เดสก์ท็อป','ช่วยเหลือ','คู่มือ','ภาพรวม','แพ็กเกจ','ดาวน์โหลด','รุ่นที่เผยแพร่','กฎหมาย','ประมวลผลบนอุปกรณ์ของคุณ','เครื่องมือที่รองรับทำงานในเบราว์เซอร์ เนื้อหาไฟล์จะไม่ถูกส่งไปยังเซิร์ฟเวอร์ของ SoraFiles','คลิกขวาที่ไฟล์ เลือกเครื่องมือ เสร็จแล้ว','ใช้ SoraFiles จากตัวจัดการไฟล์กับไฟล์เดียวหรือทั้งชุด ลดขั้นตอนสำหรับงานที่ทำซ้ำ','สำรวจแอปเดสก์ท็อป','เครื่องมือ PDF และรูปภาพ','สำหรับทุกวัน','บีบอัด แปลง รวม และลงนามไฟล์ในเบราว์เซอร์ ฟรี ไม่ต้องมีบัญชี'],
  pl:['Na komputer','Pomoc','Poradniki','Przegląd','Plany','Pobierz','Wydania','Informacje prawne','Przetwarzane na Twoim urządzeniu.','Obsługiwane narzędzia działają w przeglądarce. Zawartość plików nigdy nie trafia na serwer SoraFiles.','Kliknij plik prawym przyciskiem. Wybierz narzędzie. Gotowe.','Uruchamiaj SoraFiles z menedżera plików dla jednego pliku lub całej partii. Mniej kroków przy powtarzalnej pracy.','Poznaj wersję na komputer','Narzędzia PDF i graficzne','na co dzień.','Kompresuj, konwertuj, łącz i podpisuj pliki w przeglądarce. Za darmo, bez konta.'],
};

const sceneKeys=['3 PDFs into one file','24.6 MB down to 4.8 MB','One PDF, one file per page','Sideways pages turned 90°','Illustrated tool preview','Choose a preview','3 pages','3 files, one per page','Pages upright'] as const;
const scenes:Record<Exclude<LocalePath,'en'>,readonly string[]>={
 ja:['3つのPDFを1つのファイルに','24.6 MBから4.8 MBへ','1つのPDFをページごとに分割','横向きのページを90°回転','ツールのイラストプレビュー','プレビューを選択','3ページ','1ページずつ、3つのファイル','ページの向きを修正'],
 ko:['PDF 3개를 파일 하나로','24.6 MB에서 4.8 MB로','PDF 1개를 페이지별 파일로','옆으로 누운 페이지를 90° 회전','도구 미리보기 그림','미리보기 선택','3페이지','페이지당 파일 하나씩 3개','페이지 방향 수정'],
 es:['3 PDF en un archivo','De 24,6 MB a 4,8 MB','Un PDF, un archivo por página','Páginas giradas 90°','Vista ilustrada de la herramienta','Elegir vista previa','3 páginas','3 archivos, uno por página','Páginas enderezadas'],
 fr:['3 PDF en un seul fichier','De 24,6 Mo à 4,8 Mo','Un PDF, un fichier par page','Pages tournées de 90°','Aperçu illustré de l’outil','Choisir un aperçu','3 pages','3 fichiers, un par page','Pages redressées'],
 de:['3 PDFs in einer Datei','Von 24,6 MB auf 4,8 MB','Ein PDF, eine Datei pro Seite','Seiten um 90° gedreht','Illustrierte Tool-Vorschau','Vorschau wählen','3 Seiten','3 Dateien, eine pro Seite','Seiten aufrecht'],
 pt:['3 PDF num ficheiro','De 24,6 MB para 4,8 MB','Um PDF, um ficheiro por página','Páginas rodadas 90°','Pré-visualização ilustrada','Escolher pré-visualização','3 páginas','3 ficheiros, um por página','Páginas direitas'],
 'zh-cn':['3 个 PDF 合为一个文件','从 24.6 MB 缩小到 4.8 MB','一个 PDF，每页一个文件','页面旋转 90°','工具示意预览','选择预览','3 页','3 个文件，每页一个','页面已摆正'],
 'zh-tw':['3 個 PDF 合為一個檔案','從 24.6 MB 縮小至 4.8 MB','一個 PDF，每頁一個檔案','頁面旋轉 90°','工具示意預覽','選擇預覽','3 頁','3 個檔案，每頁一個','頁面已擺正'],
 hi:['3 PDF एक फ़ाइल में','24.6 MB से 4.8 MB','एक PDF, हर पेज की अलग फ़ाइल','तिरछे पेज 90° घुमाए गए','टूल का चित्रित पूर्वावलोकन','पूर्वावलोकन चुनें','3 पेज','3 फ़ाइलें, हर पेज की एक','पेज सीधे किए गए'],
 ar:['3 ملفات PDF في ملف واحد','من 24.6 إلى 4.8 ميغابايت','ملف PDF واحد، ملف لكل صفحة','تدوير الصفحات الجانبية 90°','معاينة توضيحية للأداة','اختر معاينة','3 صفحات','3 ملفات، ملف لكل صفحة','الصفحات مستقيمة'],
 ru:['3 PDF в одном файле','С 24,6 до 4,8 МБ','Один PDF, отдельный файл для каждой страницы','Страницы повернуты на 90°','Иллюстрация работы инструмента','Выбрать пример','3 страницы','3 файла, по одному на страницу','Страницы выровнены'],
 id:['3 PDF menjadi satu file','Dari 24,6 MB ke 4,8 MB','Satu PDF, satu file per halaman','Halaman miring diputar 90°','Pratinjau alat bergambar','Pilih pratinjau','3 halaman','3 file, satu per halaman','Halaman tegak'],
 it:['3 PDF in un solo file','Da 24,6 MB a 4,8 MB','Un PDF, un file per pagina','Pagine ruotate di 90°','Anteprima illustrata dello strumento','Scegli un’anteprima','3 pagine','3 file, uno per pagina','Pagine raddrizzate'],
 nl:['3 PDF’s in één bestand','Van 24,6 MB naar 4,8 MB','Eén PDF, één bestand per pagina','Pagina’s 90° gedraaid','Geïllustreerd toolvoorbeeld','Voorbeeld kiezen','3 pagina’s','3 bestanden, één per pagina','Pagina’s rechtop'],
 tr:['3 PDF tek dosyada','24,6 MB’den 4,8 MB’ye','Bir PDF, her sayfa için bir dosya','Yatay sayfalar 90° döndürüldü','Araç önizleme çizimi','Önizleme seç','3 sayfa','Her sayfa için bir dosya, toplam 3','Sayfalar düzeltildi'],
 vi:['3 PDF thành một tệp','Từ 24,6 MB xuống 4,8 MB','Một PDF, mỗi trang một tệp','Trang nằm ngang được xoay 90°','Hình minh họa công cụ','Chọn bản xem trước','3 trang','3 tệp, mỗi trang một tệp','Trang đã thẳng'],
 th:['รวม PDF 3 ไฟล์เป็นไฟล์เดียว','จาก 24.6 MB เหลือ 4.8 MB','PDF หนึ่งไฟล์ แยกเป็นไฟล์ละหน้า','หมุนหน้าที่เอียง 90°','ภาพตัวอย่างเครื่องมือ','เลือกตัวอย่าง','3 หน้า','3 ไฟล์ ไฟล์ละหนึ่งหน้า','หน้ากระดาษตั้งตรง'],
 pl:['3 pliki PDF w jednym','Z 24,6 MB do 4,8 MB','Jeden PDF, osobny plik dla każdej strony','Strony obrócone o 90°','Ilustrowany podgląd narzędzia','Wybierz podgląd','3 strony','3 pliki, po jednym na stronę','Strony wyprostowane'],
};
const sceneText=Object.fromEntries(Object.entries(scenes).map(([locale,values])=>[locale,Object.fromEntries(sceneKeys.map((key,index)=>[key,values[index]]))])) as Record<Exclude<LocalePath,'en'>,Record<typeof sceneKeys[number],string>>;

const smallKeys=['All','Security','Made with','by','Breadcrumb','Document.pdf','Combined.pdf','Contract.pdf','Contract-signed.pdf','Report.pdf','Rename','Cancel subscription'] as const;
const smallRows:Record<Exclude<LocalePath,'en'>,readonly string[]>={
 ja:['すべて','セキュリティ','心を込めて','制作：','現在位置','文書.pdf','結合済み.pdf','契約書.pdf','契約書-署名済み.pdf','報告書.pdf','名前を変更','サブスクリプションを解約'],
 ko:['전체','보안','정성을 담아','제작:','현재 위치','문서.pdf','합친-문서.pdf','계약서.pdf','계약서-서명.pdf','보고서.pdf','이름 바꾸기','구독 해지'],
 es:['Todo','Seguridad','Hecho con','por','Ruta de navegación','Documento.pdf','Combinado.pdf','Contrato.pdf','Contrato-firmado.pdf','Informe.pdf','Cambiar nombre','Cancelar suscripción'],
 fr:['Tout','Sécurité','Fait avec','par','Fil d’Ariane','Document.pdf','Fusionné.pdf','Contrat.pdf','Contrat-signé.pdf','Rapport.pdf','Renommer','Résilier l’abonnement'],
 de:['Alle','Sicherheit','Mit Liebe gemacht','von','Navigationspfad','Dokument.pdf','Zusammengefügt.pdf','Vertrag.pdf','Vertrag-signiert.pdf','Bericht.pdf','Umbenennen','Abo kündigen'],
 pt:['Todas','Segurança','Feito com','por','Navegação','Documento.pdf','Combinado.pdf','Contrato.pdf','Contrato-assinado.pdf','Relatório.pdf','Mudar nome','Cancelar subscrição'],
 'zh-cn':['全部','安全','用心制作','作者：','导航路径','文档.pdf','已合并.pdf','合同.pdf','已签署合同.pdf','报告.pdf','重命名','取消订阅'],
 'zh-tw':['全部','安全','用心製作','作者：','導覽路徑','文件.pdf','已合併.pdf','合約.pdf','已簽署合約.pdf','報告.pdf','重新命名','取消訂閱'],
 hi:['सभी','सुरक्षा','प्रेम से बनाया','द्वारा','नेविगेशन पथ','दस्तावेज़.pdf','संयुक्त.pdf','अनुबंध.pdf','हस्ताक्षरित-अनुबंध.pdf','रिपोर्ट.pdf','नाम बदलें','सदस्यता रद्द करें'],
 ar:['الكل','الأمان','صُنع بحب','بواسطة','مسار التنقل','مستند.pdf','مجمّع.pdf','عقد.pdf','عقد-موقّع.pdf','تقرير.pdf','إعادة التسمية','إلغاء الاشتراك'],
 ru:['Все','Безопасность','Сделано с любовью','автор:','Навигация','Документ.pdf','Объединено.pdf','Договор.pdf','Подписанный-договор.pdf','Отчёт.pdf','Переименовать','Отменить подписку'],
 id:['Semua','Keamanan','Dibuat dengan cinta','oleh','Jejak navigasi','Dokumen.pdf','Gabungan.pdf','Kontrak.pdf','Kontrak-ditandatangani.pdf','Laporan.pdf','Ubah nama','Batalkan langganan'],
 it:['Tutti','Sicurezza','Fatto con amore','da','Percorso di navigazione','Documento.pdf','Unito.pdf','Contratto.pdf','Contratto-firmato.pdf','Rapporto.pdf','Rinomina','Annulla abbonamento'],
 nl:['Alles','Beveiliging','Met liefde gemaakt','door','Navigatiepad','Document.pdf','Samengevoegd.pdf','Contract.pdf','Contract-ondertekend.pdf','Rapport.pdf','Naam wijzigen','Abonnement opzeggen'],
 tr:['Tümü','Güvenlik','Sevgiyle yapıldı','geliştiren:','Gezinme yolu','Belge.pdf','Birleştirilmiş.pdf','Sözleşme.pdf','İmzalı-sözleşme.pdf','Rapor.pdf','Yeniden adlandır','Aboneliği iptal et'],
 vi:['Tất cả','Bảo mật','Được làm bằng tình yêu','bởi','Đường dẫn điều hướng','Tài-liệu.pdf','Đã-gộp.pdf','Hợp-đồng.pdf','Hợp-đồng-đã-ký.pdf','Báo-cáo.pdf','Đổi tên','Hủy gói đăng ký'],
 th:['ทั้งหมด','ความปลอดภัย','สร้างด้วยใจ','โดย','เส้นทางนำทาง','เอกสาร.pdf','รวมแล้ว.pdf','สัญญา.pdf','สัญญาที่ลงนาม.pdf','รายงาน.pdf','เปลี่ยนชื่อ','ยกเลิกการสมัครสมาชิก'],
 pl:['Wszystkie','Bezpieczeństwo','Stworzone z sercem','przez','Ścieżka nawigacji','Dokument.pdf','Połączony.pdf','Umowa.pdf','Podpisana-umowa.pdf','Raport.pdf','Zmień nazwę','Anuluj subskrypcję'],
};
const smallText=Object.fromEntries(Object.entries(smallRows).map(([locale,values])=>[locale,Object.fromEntries(smallKeys.map((key,index)=>[key,values[index]]))])) as Record<Exclude<LocalePath,'en'>,Record<typeof smallKeys[number],string>>;
const categoryFilter:Record<Exclude<LocalePath,'en'>,string>={
 ja:'カテゴリーで絞り込む',ko:'카테고리별 필터',es:'Filtrar por categoría',fr:'Filtrer par catégorie',de:'Nach Kategorie filtern',pt:'Filtrar por categoria',
 'zh-cn':'按类别筛选','zh-tw':'依類別篩選',hi:'श्रेणी के अनुसार छाँटें',ar:'تصفية حسب الفئة',ru:'Фильтр по категории',id:'Saring menurut kategori',it:'Filtra per categoria',nl:'Filteren op categorie',tr:'Kategoriye göre filtrele',vi:'Lọc theo danh mục',th:'กรองตามหมวดหมู่',pl:'Filtruj według kategorii',
};

const extra = Object.fromEntries(Object.entries(rows).map(([locale,values]) => [locale,
  Object.fromEntries(keys.map((key,index)=>[key,values[index]]))
])) as Record<Exclude<LocalePath,'en'>,Record<Key,string>>;

const commonKeys:Record<string,keyof typeof localeContent.en.common>={
  'Tools':'tools','All tools':'allTools','Theme':'theme','Image':'images',
  'Convert':'convert','About':'about','Open source':'openSource','Contact':'contact',
  'Privacy':'privacy','Terms':'terms','PDF':'pdf','Compress PDF':'compressPdf',
  'Merge PDF':'mergePdf','Security':'privacy','All':'allTools',
};

const ja:Record<string,string>={
  'Main':'メインナビゲーション','Light theme':'ライトテーマ','Dark theme':'ダークテーマ','Mobile':'ナビゲーション',
  'PDF and image tools by Sora Labs.':'Sora LabsのPDF・画像ツール。','Made with':'心を込めて','by':'制作：',
  'This device':'この端末','Ready':'完了','Contract.pdf':'契約書.pdf','Contract-signed.pdf':'契約書-署名済み.pdf','Report.pdf':'報告書.pdf',
  'Open':'開く','Rename':'名前を変更','Edit with SoraFiles':'SoraFilesで編集','PDF to JPG':'PDFからJPG',
  'SoraFiles Desktop · Windows, macOS and Linux':'SoraFiles Desktop · Windows・macOS・Linux',
  'Filter by category':'カテゴリーで絞り込む','Security':'セキュリティ','Image':'画像','All':'すべて','Convert':'変換',
  'Show all 26 tools':'26個のツールをすべて表示','{count} tools':'{count}個のツール','{count} of {total} tools':'{total}個中{count}個のツール',
  'Original':'元のファイル','Compressed':'圧縮後','Document.pdf':'文書.pdf','Combined.pdf':'結合済み.pdf','3 pages':'3ページ','3 files, one per page':'1ページずつ、3つのファイル','Pages upright':'ページの向きを修正',
};

const translatedCount=(locale:LocalePath,text:string)=>{
  const countWords:Partial<Record<LocalePath,[string,string,string]>>={
    ko:['도구 {count}개','도구 {total}개 중 {count}개','도구 26개 모두 보기'],es:['{count} herramientas','{total} herramientas: {count} visibles','Ver las 26 herramientas'],fr:['{count} outils','{count} outils sur {total}','Voir les 26 outils'],de:['{count} Tools','{count} von {total} Tools','Alle 26 Tools anzeigen'],pt:['{count} ferramentas','{count} de {total} ferramentas','Ver as 26 ferramentas'],
    'zh-cn':['{count} 个工具','共 {total} 个，显示 {count} 个','查看全部 26 个工具'],'zh-tw':['{count} 個工具','共 {total} 個，顯示 {count} 個','查看全部 26 個工具'],hi:['{count} टूल','{total} में से {count} टूल','सभी 26 टूल देखें'],ar:['{count} أداة','{count} من أصل {total} أداة','عرض الأدوات الـ 26 كلها'],ru:['{count} инструментов','{count} из {total} инструментов','Показать все 26 инструментов'],id:['{count} alat','{count} dari {total} alat','Lihat semua 26 alat'],it:['{count} strumenti','{count} di {total} strumenti','Mostra tutti i 26 strumenti'],nl:['{count} tools','{count} van {total} tools','Alle 26 tools tonen'],tr:['{count} araç','{total} araçtan {count} tanesi','26 aracın tümünü göster'],vi:['{count} công cụ','{count} trên {total} công cụ','Xem tất cả 26 công cụ'],th:['{count} เครื่องมือ','{count} จาก {total} เครื่องมือ','ดูเครื่องมือทั้ง 26 รายการ'],pl:['{count} narzędzi','{count} z {total} narzędzi','Pokaż wszystkie 26 narzędzi'],
  };
  const words=countWords[locale];
  return words?.[text==='{count} tools'?0:text==='{count} of {total} tools'?1:2];
};

export function prototypeText(locale:LocalePath,text:string):string {
  if(locale==='en')return text;
  if(locale==='ja'&&ja[text])return ja[text];
  const specialized=extra[locale][text as Key];
  if(specialized)return specialized;
  const scene=sceneText[locale][text as typeof sceneKeys[number]];
  if(scene)return scene;
  const small=smallText[locale][text as typeof smallKeys[number]];
  if(small)return small;
  if(text==='Filter by category')return categoryFilter[locale];
  const content=localeContent[locale];
  const workbench=getWorkbenchMessages(locale);
  const direct:Record<string,string>={
    'Main':content.common.menu,'Mobile':content.common.menu,
    'Light theme':content.common.light,'Dark theme':content.common.dark,
    'Web':'Web','Sora Labs':'Sora Labs',
    'PDF and image tools by Sora Labs.':content.common.footerTagline,
    'This device':content.common.localProcessing,'Ready':workbench.ready,
    'Open':content.common.openTool,'Rename':content.common.edit,
    'Edit with SoraFiles':`${content.common.edit} SoraFiles`,
    'PDF to JPG':content.tools['pdf-to-jpg'].title,
    'SoraFiles Desktop · Windows, macOS and Linux':`SoraFiles ${extra[locale].Desktop} · Windows, macOS, Linux`,
    'Original':workbench.original,'Compressed':content.common.compress,
  };
  if(direct[text])return direct[text];
  const key=commonKeys[text];
  if(key)return content.common[key];
  if(text==='Show all 26 tools'||text==='{count} tools'||text==='{count} of {total} tools')return translatedCount(locale,text)??text;
  return text;
}
