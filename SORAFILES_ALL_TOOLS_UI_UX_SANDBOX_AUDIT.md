# SoraFiles All-Tools UI/UX Sandbox Audit

Audit date: 2026-09-01  
Sandbox: production build and Astro production preview  
Primary browser: system Google Chrome (Playwright)  
Additional browser: Firefox 154.0.1 (GeckoDriver)  
Scope: all 26 published tools, shared controls, 320–1920 px responsive matrix, light/dark, keyboard, pointer/drag, reduced motion, and representative localization/RTL.

Status legend: `PASS`, `PASS_WITH_MINOR_ISSUE`, `FAIL`, `BLOCKED_ENVIRONMENT`.

| Tool | State tested | Desktop | Mobile | Dark | Light | Keyboard | Touch/drag | Copy simplicity | Control accuracy | Bugs found | Fix | Final status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Compress PDF | Empty, loaded, strength profiles, processing, result, invalid/corrupt/encrypted, repeat | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Fill stopped before thumb; raw DPI/SSIM and structural terms | Shared normalized fill; plain profiles/status/result copy | PASS |
| Merge PDF | Empty, multi-file load, reorder, remove, processing, output, invalid signature | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Generic action label | “Merge PDFs”; shared workspace/mobile controls verified | PASS |
| Split PDF | Empty, page selection/ranges, processing, ZIP, invalid signature | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Internal page-structure wording | Consequence-first page copy | PASS |
| Rotate PDF | Empty, page selection, rotation, output, invalid signature | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Raster/native wording | Plain “content stays intact” explanation | PASS |
| Remove Pages | Empty, selection/range, remaining count, output, invalid signature | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Generic action | “Remove selected pages” | PASS |
| PDF to JPG | Empty, page selection, quality, single/ZIP output, invalid signature | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Generic action | “Convert pages”; retained DPI only for user-controlled resolution | PASS |
| JPG to PDF | Empty, load, reorder, create, validated PDF, invalid signature | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Generic action | “Create PDF” | PASS |
| PDF to Word | Empty, editable/visual, native text, scanned page, DOCX validation, invalid signature | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Object/reconstruction/OCR jargon | Editable-vs-appearance language and readable recognition status | PASS |
| Word to PDF | Empty, DOCX conversion, PDF/text validation, invalid signature | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Local office-engine language | Task-language action/status and plain limitation | PASS |
| Watermark PDF | Empty, text/image, drag/scale/opacity, preview, output, invalid signature | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Shared sliders had inconsistent fill architecture | Shared normalized range component | PASS |
| Page Numbers | Empty, position/start/range, preview, output, invalid signature | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Generic action | “Add page numbers” | PASS |
| Sign PDF | Empty, draw/type/upload, drag/resize/delete/pages, output, invalid signature | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Cryptographic phrasing in normal explanation | Plain visible-signature limitation retained | PASS |
| Image Converter | Empty, JPG/PNG/WebP/HEIC/TIFF/GIF paths, preview, output, malformed/unsupported | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | “Decoded/rendered to pixels” status | Format-specific “image is ready” copy | PASS |
| Compress Image | Empty, loaded, 0–100 slider, JPG/PNG/WebP/HEIC, transparency, processing, actual reduction | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Fill sync, change-only label, codec/SSIM wording | Live input update, shared fill, quality consequence copy | PASS |
| HEIC to JPG | Empty, HEIC load/orientation, processing, validated JPG | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Decode/metadata implementation wording | Plain still-image and omitted-feature explanation | PASS |
| Edit Image | Empty, crop, rotate, zoom/pan, adjustments, reset, WebP output | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Generic action | “Save image”; all adjustment sliders use shared geometry | PASS |
| Remove Background | Empty, loaded, first-use preparation, before/after, transparent PNG | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | AI model/engine terminology | “Preparing background removal” / “Removing the background” | PASS |
| Protect PDF | Empty, passwords, permissions, processing, encrypted output | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | AES implementation term | “Add a password”; simple reader-permission warning | PASS |
| Unlock PDF | Empty, password, protected input, output, authorization wording | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Decrypt/encryption result language | Password/removable-restrictions language | PASS |
| Repair PDF | Empty, readable/damaged workflow, validated output, fallback limitation | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Parser/object-recovery terminology | Page-recovery result and truthful feature-loss warning | PASS |
| Metadata Remover | Empty, PDF/image selection, categories, multi-result validation | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | EXIF/XMP/IPTC/chunk jargon | “Hidden file details” categories and plain result report | PASS |
| PDF to Excel | Empty, editable table mode, conversion, XLSX cell validation | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Region/heuristic/inferred-date wording | “Find tables” and editable-cell expectation | PASS |
| Excel to PDF | Empty, XLSX conversion, delayed first-use runtime, validated PDF/text | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Runtime/library name in limitation | Formatting/page-break consequence language | PASS |
| PDF OCR | Empty, language/output, TXT and searchable PDF, progress, result | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Model/confidence/local-OCR jargon | “Text recognition,” review-mistakes wording | PASS |
| Resize Image | Empty, exact width, aspect ratio, cancellation, output at four widths | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | “Resize locally” generic action | “Resize image”; mobile Adjust-panel sequence verified | PASS |
| Doc Scanner | Empty, multi-page load, corner drag, full/manual crop, retake, filters, JPG/PNG ZIP/PDF, draft recovery | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Engine/export wording; mobile test assumed hidden panel visible | “Save scan”; plain recognition status; panel-aware QA | PASS |

## Matrix evidence

- Every route: 320×568 dark and 1440×900 light in Chrome and Firefox.
- Representative workspace families: 320×568, 360×800, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900, and 1920×1080.
- Localization stress: English, German, French, Spanish, Arabic RTL, Hindi, Simplified Chinese, and Japanese at 390×844.
- All 34 rendered range controls: min, min+step, normalized 25%, 50%, 60%, 75%, 88%, max-step, and max.
- Real outputs were downloaded and validated for file signature, parseability, dimensions/page count, editable text/cells, ZIP members, or transparency as applicable.

## Browser note

Safari/WebKit automation was not available in the installed test harness. WebKit-specific range styling uses the same `::-webkit-slider-*` implementation exercised by Chrome; Firefox’s independent `::-moz-range-progress` path was verified in system Firefox. No tool was skipped.
