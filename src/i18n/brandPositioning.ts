import type { LocalePath } from './config';

export interface BrandPositioning {
  homeTitle: string;
  description: string;
  heroLine1: string;
  heroLine2: string;
  aboutTitle: string;
  aboutIntro: string;
  oneAppA: string;
  oneAppB: string;
  oneAppSummary: string;
  footerTagline: string;
}

// Canonical, reviewed one-app positioning for every published locale.
// Workflow names and workflow-page SEO copy continue to live in their existing registries.
export const brandPositioning: Record<LocalePath, BrandPositioning> = {
  en: {
    homeTitle: 'SoraFiles - Private File Processing in Your Browser',
    description: 'SoraFiles is a privacy-first web app for working with PDFs and images directly in your browser. Supported file processing happens locally on your device.',
    heroLine1: 'A Privacy-First',
    heroLine2: 'Web App.',
    aboutTitle: 'One web app. Private by architecture.',
    aboutIntro: 'SoraFiles is a privacy-first web application built by Sora Labs for working with files directly in the browser. Supported file processing happens locally on your device.',
    oneAppA: 'One', oneAppB: 'Web App', oneAppSummary: 'PDF and image workflows in one place.',
    footerTagline: 'by Sora Labs — a privacy-first web app that runs locally in your browser.',
  },
  ja: {
    homeTitle: 'SoraFiles - ブラウザでプライベートにファイル処理',
    description: 'SoraFilesは、PDFや画像をブラウザ上で直接扱える、プライバシー重視のWebアプリです。対応するファイル処理はお使いの端末内で行われます。',
    heroLine1: 'プライバシー重視の', heroLine2: 'Webアプリ。',
    aboutTitle: 'ひとつのWebアプリ。設計からプライベート。',
    aboutIntro: 'SoraFilesは、ブラウザ上で直接ファイルを扱うためにSora Labsが開発した、プライバシー重視のWebアプリです。対応するファイル処理はお使いの端末内で行われます。',
    oneAppA: 'ひとつの', oneAppB: 'Webアプリ', oneAppSummary: 'PDFと画像の作業を一か所で。',
    footerTagline: 'Sora Labs開発 — ブラウザ内でローカルに動く、プライバシー重視のWebアプリ。',
  },
  ko: {
    homeTitle: 'SoraFiles - 브라우저에서 안전하게 파일 처리',
    description: 'SoraFiles는 브라우저에서 PDF와 이미지를 직접 다루는 개인정보 보호 중심 웹 앱입니다. 지원되는 파일 처리는 사용자의 기기에서 로컬로 실행됩니다.',
    heroLine1: '개인정보 보호 중심', heroLine2: '웹 앱.',
    aboutTitle: '하나의 웹 앱. 설계부터 프라이빗하게.',
    aboutIntro: 'SoraFiles는 브라우저에서 파일을 직접 다루기 위해 Sora Labs가 만든 개인정보 보호 중심 웹 애플리케이션입니다. 지원되는 파일 처리는 사용자의 기기에서 로컬로 실행됩니다.',
    oneAppA: '하나의', oneAppB: '웹 앱', oneAppSummary: 'PDF와 이미지 작업을 한곳에서.',
    footerTagline: 'Sora Labs 제작 — 브라우저에서 로컬로 실행되는 개인정보 보호 중심 웹 앱.',
  },
  es: {
    homeTitle: 'SoraFiles - Procesamiento privado de archivos en tu navegador',
    description: 'SoraFiles es una aplicación web centrada en la privacidad para trabajar con PDF e imágenes directamente en tu navegador. El procesamiento compatible se realiza de forma local en tu dispositivo.',
    heroLine1: 'Una aplicación web', heroLine2: 'centrada en la privacidad.',
    aboutTitle: 'Una sola aplicación web. Privada por arquitectura.',
    aboutIntro: 'SoraFiles es una aplicación web centrada en la privacidad, creada por Sora Labs para trabajar con archivos directamente en el navegador. El procesamiento compatible se realiza de forma local en tu dispositivo.',
    oneAppA: 'Una sola', oneAppB: 'Aplicación web', oneAppSummary: 'Flujos de PDF e imágenes en un solo lugar.',
    footerTagline: 'de Sora Labs — una aplicación web privada que se ejecuta localmente en tu navegador.',
  },
  fr: {
    homeTitle: 'SoraFiles - Traitement privé des fichiers dans votre navigateur',
    description: 'SoraFiles est une application web axée sur la confidentialité pour travailler avec les PDF et les images directement dans votre navigateur. Les traitements pris en charge s’effectuent localement sur votre appareil.',
    heroLine1: 'Une application web', heroLine2: 'axée sur la confidentialité.',
    aboutTitle: 'Une seule application. Privée par architecture.',
    aboutIntro: 'SoraFiles est une application web axée sur la confidentialité, créée par Sora Labs pour travailler avec des fichiers directement dans le navigateur. Les traitements pris en charge s’effectuent localement sur votre appareil.',
    oneAppA: 'Une seule', oneAppB: 'Application web', oneAppSummary: 'Les flux PDF et image au même endroit.',
    footerTagline: 'par Sora Labs — une application web privée qui s’exécute localement dans votre navigateur.',
  },
  de: {
    homeTitle: 'SoraFiles - Private Dateiverarbeitung in deinem Browser',
    description: 'SoraFiles ist eine datenschutzorientierte Web-App, mit der du PDFs und Bilder direkt im Browser bearbeitest. Unterstützte Dateiverarbeitung findet lokal auf deinem Gerät statt.',
    heroLine1: 'Eine datenschutzorientierte', heroLine2: 'Web-App.',
    aboutTitle: 'Eine Web-App. Privat durch Architektur.',
    aboutIntro: 'SoraFiles ist eine von Sora Labs entwickelte, datenschutzorientierte Webanwendung zur direkten Dateibearbeitung im Browser. Unterstützte Dateiverarbeitung findet lokal auf deinem Gerät statt.',
    oneAppA: 'Eine', oneAppB: 'Web-App', oneAppSummary: 'PDF- und Bildabläufe an einem Ort.',
    footerTagline: 'von Sora Labs — eine datenschutzorientierte Web-App, die lokal in deinem Browser läuft.',
  },
  pt: {
    homeTitle: 'SoraFiles - Processamento privado de ficheiros no navegador',
    description: 'O SoraFiles é uma aplicação web focada na privacidade para trabalhar com PDF e imagens diretamente no navegador. O processamento compatível acontece localmente no seu dispositivo.',
    heroLine1: 'Uma aplicação web', heroLine2: 'focada na privacidade.',
    aboutTitle: 'Uma só aplicação. Privada por arquitetura.',
    aboutIntro: 'O SoraFiles é uma aplicação web focada na privacidade, criada pela Sora Labs para trabalhar com ficheiros diretamente no navegador. O processamento compatível acontece localmente no seu dispositivo.',
    oneAppA: 'Uma só', oneAppB: 'Aplicação web', oneAppSummary: 'Fluxos de PDF e imagem num só lugar.',
    footerTagline: 'da Sora Labs — uma aplicação web privada que funciona localmente no navegador.',
  },
  'zh-cn': {
    homeTitle: 'SoraFiles - 在浏览器中私密处理文件',
    description: 'SoraFiles 是一款注重隐私的 Web 应用，可直接在浏览器中处理 PDF 和图像。受支持的文件处理会在你的设备上本地完成。',
    heroLine1: '一款注重隐私的', heroLine2: 'Web 应用。',
    aboutTitle: '一个 Web 应用，从架构上保护隐私。',
    aboutIntro: 'SoraFiles 是 Sora Labs 打造的注重隐私的 Web 应用，用于直接在浏览器中处理文件。受支持的文件处理会在你的设备上本地完成。',
    oneAppA: '一个', oneAppB: 'Web 应用', oneAppSummary: '集中完成 PDF 和图像工作。',
    footerTagline: '由 Sora Labs 打造 — 在浏览器中本地运行的隐私优先 Web 应用。',
  },
  'zh-tw': {
    homeTitle: 'SoraFiles - 在瀏覽器中私密處理檔案',
    description: 'SoraFiles 是一款重視隱私的 Web 應用程式，可直接在瀏覽器中處理 PDF 與影像。支援的檔案處理會在你的裝置上本機完成。',
    heroLine1: '一款重視隱私的', heroLine2: 'Web 應用程式。',
    aboutTitle: '一個 Web 應用程式，從架構保護隱私。',
    aboutIntro: 'SoraFiles 是 Sora Labs 打造的隱私優先 Web 應用程式，用於直接在瀏覽器中處理檔案。支援的檔案處理會在你的裝置上本機完成。',
    oneAppA: '一個', oneAppB: 'Web 應用程式', oneAppSummary: '集中完成 PDF 與影像工作。',
    footerTagline: '由 Sora Labs 打造 — 在瀏覽器中本機執行的隱私優先 Web 應用程式。',
  },
  hi: {
    homeTitle: 'SoraFiles - ब्राउज़र में निजी फ़ाइल प्रोसेसिंग',
    description: 'SoraFiles एक गोपनीयता-प्रथम वेब ऐप है, जिसमें PDF और इमेज पर सीधे ब्राउज़र में काम किया जा सकता है। समर्थित फ़ाइल प्रोसेसिंग आपके डिवाइस पर स्थानीय रूप से होती है।',
    heroLine1: 'गोपनीयता-प्रथम', heroLine2: 'वेब ऐप।',
    aboutTitle: 'एक वेब ऐप। बनावट से ही निजी।',
    aboutIntro: 'SoraFiles, Sora Labs द्वारा बनाया गया गोपनीयता-प्रथम वेब ऐप है, जिसमें फ़ाइलों पर सीधे ब्राउज़र में काम किया जाता है। समर्थित फ़ाइल प्रोसेसिंग आपके डिवाइस पर स्थानीय रूप से होती है।',
    oneAppA: 'एक', oneAppB: 'वेब ऐप', oneAppSummary: 'PDF और इमेज के काम एक ही जगह।',
    footerTagline: 'Sora Labs द्वारा — ब्राउज़र में स्थानीय रूप से चलने वाला गोपनीयता-प्रथम वेब ऐप।',
  },
  ar: {
    homeTitle: 'SoraFiles - معالجة خاصة للملفات داخل متصفحك',
    description: 'SoraFiles تطبيق ويب يضع الخصوصية أولًا للعمل على ملفات PDF والصور مباشرة داخل متصفحك. تتم معالجة الملفات المدعومة محليًا على جهازك.',
    heroLine1: 'تطبيق ويب', heroLine2: 'يضع الخصوصية أولًا.',
    aboutTitle: 'تطبيق ويب واحد. خاص بحكم بنيته.',
    aboutIntro: 'SoraFiles تطبيق ويب يضع الخصوصية أولًا، طورته Sora Labs للعمل على الملفات مباشرة داخل المتصفح. تتم معالجة الملفات المدعومة محليًا على جهازك.',
    oneAppA: 'تطبيق', oneAppB: 'ويب واحد', oneAppSummary: 'مهام PDF والصور في مكان واحد.',
    footerTagline: 'من Sora Labs — تطبيق ويب يضع الخصوصية أولًا ويعمل محليًا داخل متصفحك.',
  },
  ru: {
    homeTitle: 'SoraFiles - Приватная обработка файлов в браузере',
    description: 'SoraFiles — веб-приложение с приоритетом конфиденциальности для работы с PDF и изображениями прямо в браузере. Поддерживаемая обработка выполняется локально на вашем устройстве.',
    heroLine1: 'Веб-приложение', heroLine2: 'с приоритетом приватности.',
    aboutTitle: 'Одно веб-приложение. Приватное по архитектуре.',
    aboutIntro: 'SoraFiles — разработанное Sora Labs веб-приложение с приоритетом конфиденциальности для работы с файлами прямо в браузере. Поддерживаемая обработка выполняется локально на вашем устройстве.',
    oneAppA: 'Одно', oneAppB: 'Веб-приложение', oneAppSummary: 'Работа с PDF и изображениями в одном месте.',
    footerTagline: 'от Sora Labs — приватное веб-приложение, которое работает локально в вашем браузере.',
  },
  id: {
    homeTitle: 'SoraFiles - Pemrosesan file privat di browser Anda',
    description: 'SoraFiles adalah aplikasi web yang mengutamakan privasi untuk bekerja dengan PDF dan gambar langsung di browser. Pemrosesan file yang didukung berlangsung secara lokal di perangkat Anda.',
    heroLine1: 'Aplikasi web', heroLine2: 'yang mengutamakan privasi.',
    aboutTitle: 'Satu aplikasi web. Privat dari arsitekturnya.',
    aboutIntro: 'SoraFiles adalah aplikasi web buatan Sora Labs yang mengutamakan privasi untuk bekerja dengan file langsung di browser. Pemrosesan file yang didukung berlangsung secara lokal di perangkat Anda.',
    oneAppA: 'Satu', oneAppB: 'Aplikasi web', oneAppSummary: 'Alur PDF dan gambar di satu tempat.',
    footerTagline: 'dari Sora Labs — aplikasi web privat yang berjalan secara lokal di browser Anda.',
  },
  it: {
    homeTitle: 'SoraFiles - Elaborazione privata dei file nel browser',
    description: 'SoraFiles è un’app web orientata alla privacy per lavorare con PDF e immagini direttamente nel browser. L’elaborazione supportata avviene localmente sul tuo dispositivo.',
    heroLine1: 'Un’app web', heroLine2: 'orientata alla privacy.',
    aboutTitle: 'Una sola app web. Privata per architettura.',
    aboutIntro: 'SoraFiles è un’applicazione web orientata alla privacy, creata da Sora Labs per lavorare con i file direttamente nel browser. L’elaborazione supportata avviene localmente sul tuo dispositivo.',
    oneAppA: 'Una sola', oneAppB: 'App web', oneAppSummary: 'Flussi PDF e immagini in un unico posto.',
    footerTagline: 'di Sora Labs — un’app web privata che funziona localmente nel tuo browser.',
  },
  nl: {
    homeTitle: 'SoraFiles - Privébestandsverwerking in je browser',
    description: 'SoraFiles is een privacygerichte webapp voor het werken met pdf’s en afbeeldingen, rechtstreeks in je browser. Ondersteunde bestandsverwerking gebeurt lokaal op je apparaat.',
    heroLine1: 'Een privacygerichte', heroLine2: 'webapp.',
    aboutTitle: 'Eén webapp. Privé door de architectuur.',
    aboutIntro: 'SoraFiles is een door Sora Labs gebouwde, privacygerichte webapp om rechtstreeks in de browser met bestanden te werken. Ondersteunde bestandsverwerking gebeurt lokaal op je apparaat.',
    oneAppA: 'Eén', oneAppB: 'Webapp', oneAppSummary: 'Pdf- en afbeeldingswerkstromen op één plek.',
    footerTagline: 'van Sora Labs — een privacygerichte webapp die lokaal in je browser draait.',
  },
  tr: {
    homeTitle: 'SoraFiles - Tarayıcınızda özel dosya işleme',
    description: 'SoraFiles, PDF ve görsellerle doğrudan tarayıcıda çalışmak için gizlilik odaklı bir web uygulamasıdır. Desteklenen dosya işlemleri cihazınızda yerel olarak gerçekleşir.',
    heroLine1: 'Gizlilik odaklı', heroLine2: 'web uygulaması.',
    aboutTitle: 'Tek web uygulaması. Mimarisi gereği gizli.',
    aboutIntro: 'SoraFiles, dosyalarla doğrudan tarayıcıda çalışmak için Sora Labs tarafından geliştirilen gizlilik odaklı bir web uygulamasıdır. Desteklenen dosya işlemleri cihazınızda yerel olarak gerçekleşir.',
    oneAppA: 'Tek', oneAppB: 'Web uygulaması', oneAppSummary: 'PDF ve görsel iş akışları tek yerde.',
    footerTagline: 'Sora Labs tarafından — tarayıcınızda yerel çalışan gizlilik odaklı web uygulaması.',
  },
  vi: {
    homeTitle: 'SoraFiles - Xử lý tệp riêng tư trong trình duyệt',
    description: 'SoraFiles là ứng dụng web ưu tiên quyền riêng tư để làm việc với PDF và hình ảnh ngay trong trình duyệt. Việc xử lý tệp được hỗ trợ diễn ra cục bộ trên thiết bị của bạn.',
    heroLine1: 'Ứng dụng web', heroLine2: 'ưu tiên quyền riêng tư.',
    aboutTitle: 'Một ứng dụng web. Riêng tư từ kiến trúc.',
    aboutIntro: 'SoraFiles là ứng dụng web ưu tiên quyền riêng tư do Sora Labs xây dựng để làm việc với tệp ngay trong trình duyệt. Việc xử lý tệp được hỗ trợ diễn ra cục bộ trên thiết bị của bạn.',
    oneAppA: 'Một', oneAppB: 'Ứng dụng web', oneAppSummary: 'Quy trình PDF và hình ảnh ở một nơi.',
    footerTagline: 'từ Sora Labs — ứng dụng web ưu tiên quyền riêng tư chạy cục bộ trong trình duyệt.',
  },
  th: {
    homeTitle: 'SoraFiles - ประมวลผลไฟล์อย่างเป็นส่วนตัวในเบราว์เซอร์',
    description: 'SoraFiles คือเว็บแอปที่ให้ความสำคัญกับความเป็นส่วนตัว สำหรับทำงานกับ PDF และรูปภาพโดยตรงในเบราว์เซอร์ การประมวลผลไฟล์ที่รองรับจะทำในเครื่องของคุณ',
    heroLine1: 'เว็บแอปที่ให้ความสำคัญ', heroLine2: 'กับความเป็นส่วนตัว',
    aboutTitle: 'เว็บแอปเดียว เป็นส่วนตัวด้วยสถาปัตยกรรม',
    aboutIntro: 'SoraFiles คือเว็บแอปที่ให้ความสำคัญกับความเป็นส่วนตัว สร้างโดย Sora Labs เพื่อทำงานกับไฟล์โดยตรงในเบราว์เซอร์ การประมวลผลไฟล์ที่รองรับจะทำในเครื่องของคุณ',
    oneAppA: 'หนึ่ง', oneAppB: 'เว็บแอป', oneAppSummary: 'งาน PDF และรูปภาพในที่เดียว',
    footerTagline: 'โดย Sora Labs — เว็บแอปที่ให้ความสำคัญกับความเป็นส่วนตัวและทำงานในเบราว์เซอร์ของคุณ',
  },
  pl: {
    homeTitle: 'SoraFiles - Prywatne przetwarzanie plików w przeglądarce',
    description: 'SoraFiles to aplikacja internetowa stawiająca prywatność na pierwszym miejscu, służąca do pracy z PDF-ami i obrazami bezpośrednio w przeglądarce. Obsługiwane pliki są przetwarzane lokalnie na Twoim urządzeniu.',
    heroLine1: 'Aplikacja internetowa', heroLine2: 'stawiająca prywatność na pierwszym miejscu.',
    aboutTitle: 'Jedna aplikacja internetowa. Prywatna z założenia.',
    aboutIntro: 'SoraFiles to stworzona przez Sora Labs aplikacja internetowa, która stawia prywatność na pierwszym miejscu i pozwala pracować z plikami bezpośrednio w przeglądarce. Obsługiwane pliki są przetwarzane lokalnie na Twoim urządzeniu.',
    oneAppA: 'Jedna', oneAppB: 'Aplikacja internetowa', oneAppSummary: 'Obsługa PDF-ów i obrazów w jednym miejscu.',
    footerTagline: 'od Sora Labs — prywatna aplikacja internetowa działająca lokalnie w Twojej przeglądarce.',
  },
};

export function getBrandPositioning(locale: LocalePath): BrandPositioning {
  return brandPositioning[locale];
}
