# SoraFiles local engine audit

Updated: 2026-08-24

## Decision standard

Every engine must produce a real, reopenable result entirely in the browser, remain truthful about loss and unsupported input, fit Cloudflare static delivery, load only on its tool route after user intent, and stay usable on bounded-memory mobile devices. A larger or more fashionable engine is not automatically a better SoraFiles engine.

## Shared-family benchmark decisions

| Family | Candidates checked | Decision | Evidence and reason |
| --- | --- | --- | --- |
| Structural PDF | Current `pdf-lib` + PDF.js; upstream qpdf; `qpdf-wasm` 0.1.0 | Retain current stack | Current fixtures produce parseable output across all structural tools. qpdf itself is mature, but the available browser wrapper is a small, lightly maintained package and did not justify replacing proven routes. |
| PDF protection | `@pdfsmaller/pdf-encrypt` 1.2.0 and `@pdfsmaller/pdf-decrypt` 1.0.1 | Retain | Existing encrypted/decrypted output reopens in PDF.js and rejects unsupported inputs truthfully. |
| PDF compression | PDF.js raster render + JPEG/PNG encoding + `pdf-lib` assembly | Retain | Only the current pipeline can enforce the product's exact hard byte ceiling. UI discloses flattening and loss of searchable structure. |
| OCR | Tesseract.js 7 local assets; PaddleOCR browser 0.4.2 | Retain Tesseract | Tesseract already passes the 19-language fixture set and is isolated by route. Paddle's browser package is about 23.8 MB unpacked before models and adds OpenCV/ONNX runtime weight without a proven product-level gain. |
| Office documents | Mammoth 1.12, docx 9.7, SheetJS 0.20.3; `docx-preview` 0.4.0; LibreOffice WASM | Retain current text/table-focused stack | Existing DOCX/XLSX results parse and match the disclosed fidelity. `docx-preview` is display-oriented, and LibreOffice WASM is too large and operationally unsuitable for a free static local-first site. |
| Image codecs | Browser Canvas, heic-to 1.5, UTIF 3.1, ag-psd 31.0 | Retain | Real PNG/JPEG/WebP/HEIC/TIFF/PSD fixtures pass; capability gates prevent fake conversions. |
| Resize | Canvas-only, pica, `@jsquash/resize` 2.1.1 | Select jSquash Lanczos | Final resize uses a lazy 9.3 KB route chunk and 34.5 KB WASM resampler. Exact 320 × 180 output passed at 320, 390, 1024 and 1440 px viewports. |
| Document scanning | OpenCV.js, jscanify, Scanic 1.6.0 | Select Scanic classical core | Scanic provides local corner detection, perspective extraction, and an accessible keyboard/touch corner editor. The route chunk is about 105.7 KB. Optional ML detection was rejected because it requires additional ONNX/model delivery and remote-by-default examples. |
| Metadata | Existing format-aware parsers; ExifReader | Retain | Existing fixtures verify supported field removal without adding a roughly 1.19 MB full dependency. |

All adopted package licenses are compatible with the AGPL application: jSquash resize is Apache-2.0 and Scanic is MIT. Server processing, paid containers, remote models, and a full LibreOffice runtime were rejected.

## Tool-by-tool status

| # | Tool | Engine decision | Verified behavior |
| ---: | --- | --- | --- |
| 1 | Compress PDF | Retained current engine after benchmark | Exact byte ceiling; parseable flattened PDF; loss disclosed. |
| 2 | Merge PDF | Retained current engine after benchmark | Ordered inputs merge into a parseable PDF. |
| 3 | Split PDF | Retained current engine after benchmark | Selected page range reopens correctly. |
| 4 | Rotate PDF | Retained current engine after benchmark | Page rotation persists in output. |
| 5 | Remove Pages | Retained current engine after benchmark | Chosen pages are omitted; empty output is blocked. |
| 6 | PDF to JPG | Retained current engine after benchmark | PDF pages render as real JPEG images. |
| 7 | JPG to PDF | Retained current engine after benchmark | Images become ordered PDF pages. |
| 8 | PDF to Word | Retained current engine after benchmark | Text-first DOCX output parses; layout limit disclosed. |
| 9 | Word to PDF | Retained current engine after benchmark | Text-first PDF output parses; layout limit disclosed. |
| 10 | Watermark PDF | Retained current engine after benchmark | Visible watermark is embedded on pages. |
| 11 | Page Numbers | Retained current engine after benchmark | Page labels are embedded at the selected position. |
| 12 | Sign PDF | Retained current engine after benchmark | Drawn signature is embedded in the selected page. |
| 13 | Image Converter | Retained current engine after benchmark | Capability-gated PNG/JPEG/WebP/TIFF/PSD conversion. |
| 14 | Compress Image | Retained current engine after benchmark | Valid images and truthful larger-output warning. |
| 15 | HEIC to JPG | Retained current engine after benchmark | Local HEIC decode and JPEG output. |
| 16 | Edit Image | Retained current engine after benchmark | Real pixel edits and valid image output. |
| 17 | Protect PDF | Retained current engine after benchmark | Password-encrypted PDF reopens with the password. |
| 18 | Unlock PDF | Retained current engine after benchmark | Supported encrypted PDF becomes an unencrypted PDF. |
| 19 | Repair PDF | Retained current engine after benchmark | Recoverable input is rewritten and reopened; unrecoverable input is rejected. |
| 20 | Metadata Remover | Retained current engine after benchmark | Supported metadata fields are removed locally. |
| 21 | PDF to Excel | Retained current engine after benchmark | Extracted tables/text produce a parseable workbook. |
| 22 | Excel to PDF | Retained current engine after benchmark | Workbook cells produce a parseable PDF. |
| 23 | PDF OCR | Retained current engine after benchmark | Local OCR produces a searchable PDF for supported languages. |
| 24 | Resize Image | New jSquash engine | Crop, ratios, exact pixels, contain/fill/pad/stretch, quality and alpha-aware outputs. |
| 25 | Doc Scanner | New Scanic + existing PDF/OCR engines | Upload/camera, corners, perspective, filters, multi-page reorder, JPG/PNG/PDF and optional local OCR. |

## Isolation and safety

- Neither new engine is imported by the homepage or shared shell.
- jSquash, Scanic, PDF assembly, ZIP, and OCR code are dynamically imported after user action.
- Resize rejects unsafe decoded/output pixel allocations before creating large canvases.
- Scanner detection uses a bounded analysis dimension, caps a session at 20 pages, closes media tracks on stop, page hide, and backgrounding, and revokes generated object URLs.
- File replacement and cancellation invalidate stale jobs so a late result cannot overwrite newer state.
- Runtime tests assert that processing makes no non-GET upload request and that tool output signatures/dimensions are real.
