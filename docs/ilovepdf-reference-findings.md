# iLovePDF Desktop reference findings — 29 September 2026

Read-only inspection of the owner-supplied install at `C:\Users\Drishya\Desktop\iLovePDF-App\` (MSIX layout, about 1.1 GB). Nothing from it is shipped, copied or linked by SoraFiles. Findings come from file names, its `THIRD_PARTY_LICENSES.txt`, and bundled folder structure only; proprietary binaries were not executed, disassembled or reused.

## Architecture

| Area | What the install contains | Notes |
|---|---|---|
| Shell/UI | Qt 6 Quick/QML (`Qt6Quick*.dll`, Controls 2 styles) plus Qt WebEngine (`Qt6WebEngineCore.dll`, 154 MB) and a `web/` bundle for the PDF editor | QML is compiled into `iLovePDF.exe`; no readable UI source. The editor view is a web app inside WebEngine, similar in spirit to SoraFiles' WebView approach. |
| PDF core | `PDFNetC.dll` (53 MB) and `pdftron_*.plugin` | Apryse (formerly PDFTron) PDFNet: commercial, proprietary SDK. |
| Conversion | `SolidFrameworkNative.dll`, `SolidCore.dll`, `SolidLanguage.dll`, `*Flt.flt` filters (DOCX, XLSX, PPTX, RTF, HTML, CSV, JSON) | Solid Documents' Solid Framework: commercial, proprietary. |
| Task APIs | `Pdf2PdfAPI`, `PdfOptimizeAPI`, `PdfOcrAPI`, `PdfRepairAPI`, `PdfSecureAPI`, `PdfValidatorAPI`, `Pdf2ImgAPI`, `Img2PdfApi` | Vendor per-task wrappers; proprietary. |
| OCR | `tesseract.dll` plus `ocr_iris*.dll`, `ocr_solid.dll` | Tesseract (Apache-2.0) alongside IRIS OCR (commercial). |
| Images | ImageMagick (`CORE_RL_Magick*`) | ImageMagick License (permissive). |
| Other | OpenSSL 3 (Apache-2.0), Sentry, SQL drivers, Explorer context-menu DLL | Standard components. |

The third-party notice lists only OpenSSL and ImageMagick. The core PDF, conversion and OCR engines are commercial SDKs licensed to iLovePDF; they are not open source and cannot be reused.

## Engine decision: keep SoraFiles engines

- **Apryse PDFNet, Solid Framework, IRIS OCR**: proprietary and commercially licensed. Reusing or redistributing them is not permitted, and buying them would break SoraFiles' AGPL/offline-first model and add 60–150 MB per platform. **Not adopted.**
- **Tesseract**: SoraFiles already uses Tesseract (Tesseract.js 7 on the web, with self-hosted models). The 30 August benchmark (`SORAFILES_FINAL_ENGINE_BENCHMARK.md`) found it recovered the controlled scans exactly, beating Scribe.js and PaddleOCR.js. **Keep current.**
- **ImageMagick**: SoraFiles' jSquash codecs (MozJPEG/OxiPNG, Apache-2.0/MIT), plus the Desktop image engine, already cover conversion, resizing and compression, and pass the byte-parity checks. ImageMagick would add a large native dependency and attack surface without a measured quality win. **Not adopted.**
- **Qt**: a toolkit rather than a processing engine. SoraFiles Desktop's Tauri/WebView shell already reuses the proven web engines with a much smaller footprint. **Not adopted.**

Direct speed or quality benchmarks against iLovePDF's engines were not run. Doing that would mean executing proprietary SDK binaries outside their licensed application. The legitimate upstream projects found in the install (Tesseract, ImageMagick) were compared against SoraFiles' current engines through the existing benchmark and license matrix (`SORAFILES_ENGINE_LICENSE_MATRIX.md`).

## Interaction patterns adopted (general patterns only, no assets)

- After a file loads, the tool becomes a full-window workspace: a flat neutral canvas, the document as the only raised surface, a slim toolbar, and one options column with the primary action pinned at its bottom.
- Secondary controls look like text until hovered; selection is monochrome.
- There is one strong action per screen, and marketing content is absent inside the workspace.

These are implemented with SoraFiles tokens, typography and brand in `src/styles/v10-calm-workspace.css` and `desktop/ui/layout.css`.
