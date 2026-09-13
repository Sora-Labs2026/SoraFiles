# Desktop tool and dependency audit

Recorded 2026-09-13T12:42:19.397Z. 26 tools, 30 direct dependencies, 449 production lock entries. 234 local public assets total 63552241 bytes. Remote Office/model payloads are additional; these are not installer-size measurements.

RELEASE BLOCKED: source/compliance packs and native-host prototypes incomplete

The earlier engine matrix is historical: qpdf and GhostPDL are currently used, despite its old rejected/unshipped descriptions. Installed package metadata and current imports take precedence. A package license does not alone clear every embedded codec or model. No desktop redistribution is marked cleared until corresponding source, notices and reproducible pack provenance are assembled.

## Compress PDF — /pdf
- Engine: compressPdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0); @neslinesli93/qpdf-wasm 0.3.0 (ISC); @okathira/ghostpdl-wasm 1.1.0 (AGPL-3.0-or-later).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: No guaranteed reduction; signed originals kept; eligible image compression can reduce detail.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Merge PDF — /merge-pdf
- Engine: mergePdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Split PDF — /split-pdf
- Engine: splitPdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0); fflate 0.8.3 (MIT).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Rotate PDF — /rotate-pdf
- Engine: rotatePdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Remove Pages — /remove-pages
- Engine: removePagesPdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## PDF to JPG — /pdf-to-jpg
- Engine: pdfToImages. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0); fflate 0.8.3 (MIT).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## JPG to PDF — /jpg-to-pdf
- Engine: imagesToPdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## PDF to Word — /pdf-to-word
- Engine: pdfToDocx. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0); docx 9.7.1 (MIT); tesseract.js 7.0.0 (Apache-2.0); tesseract.js-core 7.0.0 (Apache-2.0).
- Model: Tesseract traineddata Apache-2.0 notices must accompany packs.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Install chosen OCR language packs before offline use.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Editable reconstruction changes layout; visual output uses page images.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Word to PDF — /word-to-pdf
- Engine: docxToPdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: zetajs 1.2.0 (MIT).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Blocked until complete pinned Office pack and redistribution/source bundle are obtained.
- Packaging: Optional full Office component pack; native LibreOffice sidecar is a candidate, not yet adopted.
- Replacement assessment: Native LibreOffice may reduce browser constraints; benchmark before choosing.
- Current limits: Fonts and unsupported document features can change layout; current runtime is fetched from the ZetaJS CDN.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Watermark PDF — /watermark-pdf
- Engine: watermarkPdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Page Numbers — /page-numbers
- Engine: pageNumbersPdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Sign PDF — /sign-pdf
- Engine: signPdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Visual signature, not a certificate-backed digital signature.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Image Converter — /image-converter
- Engine: convertImages. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: @jsquash/jpeg 1.6.0 (Apache-2.0); @jsquash/webp 1.5.0 (Apache-2.0); @jsquash/oxipng 2.3.0 (Apache-2.0); @jsquash/resize 2.1.1 (Apache-2.0); heic-to 1.5.2 (LGPL-3.0); utif 3.1.0 (MIT); ag-psd 31.0.2 (MIT); pdfjs-dist 6.2.108 (Apache-2.0); fflate 0.8.3 (MIT).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Selected frame/page only; PSD flattened; exotic codec variants require independent checks.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Compress Image — /compress-image
- Engine: compressImages. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: @jsquash/jpeg 1.6.0 (Apache-2.0); @jsquash/webp 1.5.0 (Apache-2.0); @jsquash/oxipng 2.3.0 (Apache-2.0); @jsquash/resize 2.1.1 (Apache-2.0); heic-to 1.5.2 (LGPL-3.0); fflate 0.8.3 (MIT).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## HEIC to JPG — /heic-to-jpg
- Engine: heicToJpg. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: heic-to 1.5.2 (LGPL-3.0); fflate 0.8.3 (MIT).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: HEVC decoder/license and patent considerations; HDR/color conversion needs validation.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Edit Image — /edit-image
- Engine: Canvas / shared image adjustments. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: Browser Canvas / original project code (AGPL-3.0-only).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Remove Background — /remove-background
- Engine: imgly-isnet-quint8. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: @imgly/background-removal 1.7.0 (AGPL-3.0; ISNET model MIT per ThirdPartyLicenses.json); onnxruntime-web 1.21.0 (MIT).
- Model: ISNET MIT per shipped third-party manifest; distributed model byte provenance still needs pinning.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Requires complete pinned model/ONNX pack; current web proxy uses upstream resources.
- Packaging: Optional installed model pack; unload worker process after job.
- Replacement assessment: Native ONNX is a candidate; preserve alpha/quality benchmark.
- Current limits: Matting has difficult-edge limitations; solid cleanup can remove matching subject colors.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Protect PDF — /protect-pdf
- Engine: protectPdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0); @pdfsmaller/pdf-encrypt 1.2.0 (MIT).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Unlock PDF — /unlock-pdf
- Engine: unlockPdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0); @pdfsmaller/pdf-decrypt 1.0.1 (MIT); fflate 0.8.3 (MIT).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Repair PDF — /repair-pdf
- Engine: repairPdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Best-effort rewrite cannot reconstruct arbitrary missing bytes.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Metadata Remover — /metadata-remover
- Engine: removeMetadata. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); fflate 0.8.3 (MIT).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Selected fields only; PDF dates reset; no visible redaction; JPEG orientation can change.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## PDF to Excel — /pdf-to-excel
- Engine: pdfToExcel. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0); xlsx 0.20.3 (Apache-2.0).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Inferred tables are not original spreadsheet formulas; visual mode is not editable table reconstruction.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Excel to PDF — /excel-to-pdf
- Engine: excelToPdf. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: zetajs 1.2.0 (MIT); xlsx 0.20.3 (Apache-2.0).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Blocked until complete pinned Office pack and redistribution/source bundle are obtained.
- Packaging: Optional full Office component pack; native LibreOffice sidecar is a candidate, not yet adopted.
- Replacement assessment: Native LibreOffice may reduce browser constraints; benchmark before choosing.
- Current limits: Print areas, fonts, pagination and unsupported spreadsheet features require inspection; Office CDN runtime is not bundled.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## PDF OCR — /pdf-ocr
- Engine: ocr. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: pdf-lib 1.17.1 (MIT); pdfjs-dist 6.2.108 (Apache-2.0); tesseract.js 7.0.0 (Apache-2.0); tesseract.js-core 7.0.0 (Apache-2.0).
- Model: Tesseract traineddata Apache-2.0 notices must accompany packs.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Install chosen OCR language packs before offline use.
- Replacement assessment: Native OCR plus positioned Unicode text layer is a candidate.
- Current limits: Recognition errors; current added PDF text has restricted encoding and is not word aligned.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Resize Image — /resize-image
- Engine: jsquashResize. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: @jsquash/resize 2.1.1 (Apache-2.0).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.

## Doc Scanner — /doc-scanner
- Engine: scanic. Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.
- Dependencies: scanic 1.6.0 (MIT); pdf-lib 1.17.1 (MIT).
- Model: None separately identified.
- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.
- Offline: Feasible with local packaged code and assets; must prove in native host with network blocked.
- Packaging: Bundle local assets; run only within authorized job boundary.
- Replacement assessment: Reuse tested engine first; replace only with measured benefit.
- Current limits: Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.
- Desktop path: Engine extraction and native-host prototype pending; not claimed shipped.
