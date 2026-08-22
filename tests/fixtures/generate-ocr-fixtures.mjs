import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument, degrees } from 'pdf-lib';

const root = fileURLToPath(new URL('../..', import.meta.url));
const targetDir = `${root}/tests/fixtures`;
const ocrTargetDir = `${targetDir}/ocr`;

await mkdir(targetDir, { recursive: true });
await mkdir(ocrTargetDir, { recursive: true });

const languagePhrases = [
  { code: 'eng', font: 'Arial', phrase: 'Sora Files local OCR keeps this scanned page on your device.' },
  { code: 'jpn', font: 'Yu Gothic', phrase: 'Sora Files ローカル OCR はスキャンページを安全に処理します。' },
  { code: 'kor', font: 'Malgun Gothic', phrase: 'Sora Files 로컬 OCR은 스캔된 페이지를 장치 내에서 처리합니다.' },
  { code: 'spa', font: 'Arial', phrase: 'El OCR local de Sora Files procesa este escaneo en su dispositivo.' },
  { code: 'fra', font: 'Arial', phrase: 'L’OCR local de Sora Files traite cette page scannée sur votre appareil.' },
  { code: 'deu', font: 'Arial', phrase: 'Lokale OCR von Sora Files verarbeitet diese gescannte Seite auf Ihrem Gerät.' },
  { code: 'por', font: 'Arial', phrase: 'O OCR local do Sora Files processa esta página digitalizada no seu dispositivo.' },
  { code: 'chi_sim', font: 'Microsoft YaHei', phrase: 'Sora Files 本地 OCR 在您的设备上安全识别扫描页面。' },
  { code: 'chi_tra', font: 'Microsoft JhengHei', phrase: 'Sora Files 本機 OCR 在您的裝置上安全辨識掃描頁面。' },
  { code: 'hin', font: 'Nirmala UI', phrase: 'Sora Files स्थानीय OCR इस पृष्ठ को आपके डिवाइस पर प्रोसेस करता है।' },
  { code: 'ara', font: 'Segoe UI', phrase: 'يعمل OCR المحلي في Sora Files على معالجة هذه الصفحة الممسوحة.' },
  { code: 'rus', font: 'Arial', phrase: 'Локальный OCR Sora Files обрабатывает эту страницу на вашем устройстве.' },
  { code: 'ind', font: 'Arial', phrase: 'OCR lokal Sora Files memproses halaman pemindaian di perangkat Anda.' },
  { code: 'ita', font: 'Arial', phrase: 'L’OCR locale di Sora Files elabora questa pagina sul tuo dispositivo.' },
  { code: 'nld', font: 'Arial', phrase: 'Lokale OCR van Sora Files verwerkt deze pagina op uw apparaat.' },
  { code: 'tur', font: 'Arial', phrase: 'Sora Files yerel OCR bu taranmış sayfayı cihazınızda işler.' },
  { code: 'vie', font: 'Arial', phrase: 'OCR cục bộ của Sora Files xử lý trang quét này trên thiết bị của bạn.' },
  { code: 'tha', font: 'Leelawadee UI', phrase: 'OCR ในเครื่องของ Sora Files ประมวลผลหน้าที่สแกนนี้บนอุปกรณ์ของคุณ' },
  { code: 'pol', font: 'Arial', phrase: 'Lokalne OCR Sora Files przetwarza tę zeskanowaną stronę na Twoim urządzeniu.' },
];

async function createRasterPdf(browser, text, font = 'Arial', rotateAngle = 0) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin: 0; padding: 60px; background: #ffffff; color: #000000; font-family: '${font}', sans-serif; font-size: 32px; font-weight: bold; line-height: 1.6;">
        <div>${text}</div>
      </body>
    </html>
  `;
  await page.setContent(html);
  const screenshot = await page.screenshot({ type: 'png' });
  await page.close();

  const pdfDoc = await PDFDocument.create();
  const embeddedImage = await pdfDoc.embedPng(screenshot);
  const pdfPage = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
  pdfPage.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: embeddedImage.width,
    height: embeddedImage.height,
  });

  if (rotateAngle !== 0) {
    pdfPage.setRotation(degrees(rotateAngle));
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

console.log('Generating scan PDF fixtures with Playwright and pdf-lib...');
const browser = await chromium.launch();

try {
  // 1. scan-english.pdf
  const engBytes = await createRasterPdf(
    browser,
    'Sora Files local OCR keeps this scanned page on your device.',
    'Arial',
  );
  await writeFile(`${targetDir}/scan-english.pdf`, engBytes);
  console.log('Created scan-english.pdf');

  // 2. scan-rotated.pdf
  const rotBytes = await createRasterPdf(
    browser,
    'Rotation-aware local recognition.',
    'Arial',
    90,
  );
  await writeFile(`${targetDir}/scan-rotated.pdf`, rotBytes);
  console.log('Created scan-rotated.pdf');

  // 3. scan-mixed.pdf (Page 1: embedded text, Page 2: rasterized scan image)
  const mixedDoc = await PDFDocument.create();
  const page1 = mixedDoc.addPage([600, 400]);
  page1.drawText('Embedded page one keeps document text local and clear.', {
    x: 50,
    y: 300,
    size: 18,
  });

  const scanPage2Bytes = await createRasterPdf(
    browser,
    'Scanned page two stays local.',
    'Arial',
  );
  const scanPage2Doc = await PDFDocument.load(scanPage2Bytes);
  const [copiedScanPage] = await mixedDoc.copyPages(scanPage2Doc, [0]);
  mixedDoc.addPage(copiedScanPage);

  const mixedBytes = await mixedDoc.save();
  await writeFile(`${targetDir}/scan-mixed.pdf`, mixedBytes);
  console.log('Created scan-mixed.pdf');

  // 4. scan-{code}.pdf for all 19 language models
  for (const item of languagePhrases) {
    const bytes = await createRasterPdf(browser, item.phrase, item.font);
    await writeFile(`${ocrTargetDir}/scan-${item.code}.pdf`, bytes);
    console.log(`Created ocr/scan-${item.code}.pdf`);
  }
} finally {
  await browser.close();
}

console.log('Successfully generated all OCR scan fixtures.');
