# SoraFiles Tool Upgrade Log

Updated: 2026-08-28 (Asia/Kathmandu)

## Task objective

Deeply upgrade the existing 26 SoraFiles workflows to professional-grade fidelity, usability, privacy, consistency, accessibility, and performance without unnecessary redesign, tool-count growth, server file processing, or regressions.

## Initial findings

- Canonical workspace: `/Volumes/Web Apps/SoraFiles`; branch `main`; `origin/main` was already current at task start.
- The repository already has 26 public tools, 19 localized route catalogs, real-output browser tests, local OCR assets, local LibreOffice WASM conversion, output validation, cancellation in heavy paths, and strong scanner/background-removal foundations.
- The binding visual language is documented in `DESIGN.md`; this work will extend the existing glass/card system rather than redesign it.
- There is no shared visual PDF page workspace. Merge supports file ordering only; rotate affects every page; remove-pages is text-input-first; split defaults to one file per page and can rasterize pages in its default “smart” path.
- PDF compression currently rasterizes every page in every mode and requires a flattening acknowledgement. This conflicts with the new preserve-native default requirement.
- PDF-to-Word currently provides visual-fidelity DOCX only. PDF-to-Excel already separates exact page visuals from best-effort editable extraction. Word/Excel-to-PDF use route-lazy local LibreOffice WASM and retain selectable text where supported.
- OCR is local, lazy, cancellable, and multilingual, but PDF OCR currently exposes TXT output only.
- Product copy still includes an English “no artificial limits” claim despite browser/device safety guards.
- Existing untracked `prompts/` belongs to the user and will not be modified.

## Decisions made

- Build one reusable, route-local visual PDF workspace and integrate it through `DocumentActionWorkbench` for Merge, Split, Rotate, Remove Pages, Watermark, Page Numbers, and Sign PDF.
- Preserve the established SoraFiles palette, typography, rounded glass workbench, responsive breakpoints, and progressive-disclosure pattern. The workspace’s distinctive element will be a compact page-filmstrip/grid with explicit selection badges and non-drag reorder controls.
- Change PDF compression to native structural optimization by default. Keep rasterization only in an explicitly labeled Maximum / Flattened mode with a clear warning.
- Change Split PDF to native extraction by default and remove automatic rasterization from the normal path.
- Reuse installed `pdf-lib`, PDF.js, `fflate`, Tesseract.js, and LibreOffice WASM unless evidence shows a material quality gap that an acceptable browser-local dependency can solve.

## Files changed

- `src/components/VisualPdfWorkspace.astro`, `src/lib/pdf/visual-workspace.ts` — shared lazy thumbnail, selection, range, reorder, rotation, preview, and history workspace.
- `src/components/DocumentActionWorkbench.astro` — native merge/split/rotate/remove, expanded watermark/page-number/sign/image-PDF controls, explicit PDF-to-Word modes.
- `src/components/PdfWorkbench.astro` — native-preserving compression default and explicit flattened maximum mode.
- `src/components/ExtraToolWorkbench.astro`, `src/engines/liveExtra.js` — searchable PDF OCR, table-aware PDF-to-Excel, protection controls, batch unlock reporting, repair recovery reports, selective PDF metadata cleanup, and visible result details.
- `src/lib/pdf-to-excel/table-extraction.ts` — recurring row/column clustering, table-region separation, and numeric/date inference.
- `src/lib/pdf-to-word/*`, `src/lib/ocr/text-items.ts` — shared native-text/OCR routing and inferred headings, lists, simple tables, and page breaks in editable DOCX.
- `README.md`, `PRODUCT.md`, `src/data/liveCopy.ts`, `src/data/liveTools.ts`, `src/i18n/en.ts`, `src/i18n/spreadsheetTools.ts` — capability and limitation copy aligned with implemented behavior.
- `tests/e2e/tool-flows.mjs`, `tests/unit/pdf-workspace.test.mjs`, `tests/unit/pdf-to-excel.test.mjs`, `tests/unit/pdf-to-word.test.mjs`, `tests/unit/ocr-text-items.test.mjs` — updated regression and fidelity coverage.

## Tools completed

- Shared workspace consumers: Merge, Split, Rotate, Remove Pages, Watermark, Page Numbers, and Sign PDF now share page thumbnails and selection state; native pages are copied/modified without normal-path rasterization.
- Compress PDF: native structural re-save is the default; flattened compression is explicit and warned; larger output falls back to original bytes.
- PDF OCR: searchable PDF is the default, TXT remains available, native text pages skip OCR, and scanned pages receive a local invisible text layer.
- PDF to Word: explicit Editable and Visual Fidelity modes; native pages skip OCR, scanned pages use local OCR, and editable output infers basic headings, lists, tables, and page breaks.
- PDF to Excel: editable detected tables are the default; recurring rows/columns, multiple separated table regions, numeric values, percentages, and ISO dates are inferred. Page-visual worksheets remain an explicit reference mode.
- Word/Excel to PDF: retained the route-lazy browser-local LibreOffice pipeline and honest font/layout limitations.
- Protect/Unlock PDF: AES-256 controls, strength feedback, owner/user password distinction, permissions, batch unlock, and per-result restriction reports.
- Repair PDF: normal, lenient, and last-chance visual salvage passes with recovered/skipped page reports and explicit fallback losses.
- Metadata Remover: PDF category inspection/selective removal, output verification, and per-result reports; existing lossless image/OpenXML container cleanup retained.
- PDF to image and image to PDF: ranges, resolution, JPG/PNG/WebP, quality, reported pixel dimensions, image thumbnails/reorder/per-image rotation, page sizing/orientation/margins/fit, and deterministic multi-page ZIP output.
- Split PDF: native one-file-per-page, selected-pages-as-one, custom semicolon groups, every-N, and odd/even modes with deterministic direct/ZIP output.

## Tools remaining

- Live overlay previews for watermark and page numbers remain desirable; processing itself is native and selection-aware.
- The established image winners remain functional but do not yet implement every requested expansion: converter/compressor/HEIC/resize are single-file, Edit Image lacks full history/temperature/sharpness, and Background Removal lacks manual mask brushes/feather/background replacement.
- Excel-to-PDF does not expose all Calc print settings in SoraFiles UI; LibreOffice preserves source print configuration where supported.

## Tests run

- Final Astro diagnostics in a temporary Node 22 dependency mirror: 125 files, 0 errors, 0 warnings, 0 hints.
- Full production build completed in the compatibility mirror: 629 pages generated; tool metadata, content truth, brand positioning, i18n (19 languages × 33 routes), built SEO/GEO, search branding, monetization, OCR asset, and optimizer gates all passed.
- Focused native-workspace/OCR/DOCX/table tests: 18/18 pass, including shared workspace, native compression/split invariants, OCR default/native-skip behavior, PDF table extraction, and structured DOCX generation.
- Direct full unit sweep without the incompatible TypeScript/esbuild loader: 57/63 pass. The six non-passing cases are environmental: three require a generated `dist/`, and three require extensionless TypeScript resolution normally supplied by the blocked loader. No assertion-based regression failed.
- Content truth, brand positioning, and monetization validators pass.
- Full unit runner started successfully and passed its first suites, then hit the known Catalina/esbuild binary incompatibility and was stopped rather than repeatedly retried.

## Known issues

- This Catalina host cannot execute esbuild 0.27+ (`_SecTrustCopyCertificateChain` dyld symbol). The production build and deployment were completed with a temporary compatibility mirror using esbuild 0.26 for Wrangler and a compatible top-level build binary; the repository dependency tree was not rewritten.
- Searchable-PDF OCR currently uses pdf-lib's built-in WinAnsi font for the invisible layer. TXT retains Unicode OCR output, but non-Latin searchable layers require a locally bundled Unicode font before they can be declared reliable.
- PDF-to-Excel detects tables only from selectable positioned text. Scanned-table OCR, merged-cell inference, and an interactive grid/boundary editor are not yet production-ready.
- PDF-to-Word semantic inference is deliberately basic; complex columns, embedded images in editable mode, and advanced reading order may require the Visual Fidelity mode or cleanup.

## Intentionally deferred

- Advanced PDF object optimization (resource deduplication, image downsampling without flattening, safe font subsetting, unused-object pruning) is not supported reliably by the installed pdf-lib stack. Native re-save is used and original bytes are returned when it grows the file.
- Outline/bookmark merging and preservation of every advanced PDF form/link/signature object cannot be guaranteed by pdf-lib; product copy avoids such guarantees.
- Unicode OCR text-layer embedding, scanned-table OCR, advanced DOCX semantic reconstruction, and expanded image editing require additional benchmarked assets/engines or more extensive UI work. Current safe fallbacks are exposed and described to users.

## Recovery checkpoint

Core P0 fidelity paths, shared PDF workspace, native Split composition modes, and targeted PDF/image workflow upgrades are implemented and statically clean. If more implementation time is available, prioritize image-tool batch/history controls and live watermark/page-number overlays. Do not touch the user-owned untracked `prompts/` directory and do not deploy without explicit authorization.

## Production deployment

- Authorized and deployed on 2026-08-28 through the named Wrangler `sorafiles` OAuth profile to Cloudflare account `8f3adcfff74a52e95ed0989db6fc241e`.
- Activated Worker `sora-files` version `d16c31f8-d0d1-458f-8a48-fc4686aeed8c` on `sorafiles.com` and `www.sorafiles.com`; the scheduled popularity refresh remains configured for `17 3 * * *`.
- Confirmed the `sorafiles-popularity` D1 binding and existing `tool_usage_daily` / `popularity_state` schema.
- Live verification passed for the homepage, Split PDF visual workspace, PDF OCR searchable-output UI, PDF-to-Excel table mode, Spanish PDF OCR route, 10-tool popularity ranking endpoint, immutable hashed assets, canonical redirect, and security headers.
- Live SEO audit passed all 627 canonical sitemap URLs with 627 HTTP 200 responses, 100% sitemap coverage, and zero known technical blockers.
- IndexNow accepted all 627 canonical URLs. Google Search Console and Bing Webmaster API submission were skipped because `.env.search.local` credentials are not configured; Bing remains covered by IndexNow.
