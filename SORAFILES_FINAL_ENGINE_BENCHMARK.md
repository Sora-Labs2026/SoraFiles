# SoraFiles V6 Final Engine Benchmark

Date: 2026-08-30  
Execution: isolated lab `/tmp/sorafiles-engine-lab`, isolated branch `codex/v6-benchmark`  
Decision rule: adopt only a material fidelity, size, speed, memory, or capability win without privacy/mobile regression.

## Final benchmark table

| Tool | Current Engine | Candidate(s) | Test Result | Winner | Final Decision | Evidence |
|---|---|---|---|---|---|---|
| Merge, split, rotate, remove/reorder pages | pdf-lib native page/object operations | qpdf WASM, pdfcpu, Unfleece | Current preserved page order, native selectable text, page counts, and rotation in real downloaded PDFs. The prompt makes alternatives conditional on a current failure; none occurred. | Current | **KEEP CURRENT** | Final Firefox audit: all structural tools passed; `v6-final-audit/audit-results.json`. |
| Compress PDF | pdf-lib structural optimization; explicit raster maximum mode | qpdf WASM, pdfcpu, Ghostscript, BentoPDF, Unfleece | On the same 123,434-byte fixture, current produced 122,649 bytes in 29.7 ms; qpdf produced 122,730 bytes in 69.9 ms. Both retained two pages and exact text. Other named paths had no distinct maintained browser artifact that cleared the gate. | Current | **KEEP CURRENT** | `/tmp/sorafiles-engine-lab/outputs/qpdf-benchmark.json`; real normal/maximum UI output validation. |
| Protect / unlock / repair PDF | `@pdfsmaller` encryption/decryption plus pdf-lib/PDF.js salvage | qpdf WASM | qpdf AES workflow correctly withheld output for a wrong password and preserved exact content after correct unlock, but added a 1,334,286-byte WASM and did not recover the damaged fixture. Current real AES-256/wrong-password/honest-repair paths all passed. | Current | **KEEP CURRENT** | qpdf protect 139.5 ms, unlock 98.1 ms; repair output 0 bytes. Final Firefox audit. |
| PDF OCR | Tesseract.js 7, self-hosted same-origin models | Scribe.js 0.14.6, PaddleOCR.js 0.4.2 | Current recovered both controlled scan pages exactly in 13 s. Scribe reached only 62–64% character accuracy and used about 914 MB process RSS. Paddle reached 86–88%, retained the test numbers, but required about 60 MB of cold browser resources and was not more accurate overall. | Current | **KEEP CURRENT**; no misleading “High Accuracy” mode | `scribe-benchmark.json`, `paddle-benchmark.json`, `current-ocr/audit-results.json`. |
| PDF to Word | Current semantic DOCX reconstruction plus visual-fidelity mode | Scribe.js, MuPDF/PyMuPDF, BentoPDF | Both current modes produced valid real UI outputs. Scribe's controlled table PDF yielded no native text and only a 9,426-byte effectively empty DOCX. No distinct eligible browser-local Bento path improved the existing implementation. | Current | **KEEP CURRENT** | Final Firefox audit; `scribe-benchmark.json`. |
| PDF to Excel | Current geometric table extraction and structured XLSX | Scribe.js, Paddle table/layout, PyMuPDF | Current real output passed the “not a page-image-only workbook” gate and unit fixtures recover typed recurring rows/columns. Scribe's XLSX export threw before producing bytes. Paddle table/layout and PyMuPDF did not provide a bounded browser-local result strong enough to replace current. | Current | **KEEP CURRENT** | Final Firefox audit; 75/75 unit suite; `scribe-benchmark.json`. |
| Word / Excel to PDF | LibreOffice WASM via ZetaJS 1.2.0 | LibreOffice WASM, BentoPDF approach | The candidate is already the current engine. Real Word content and both workbook sheets survived downloaded PDF validation. BentoPDF documents the same heavy LibreOffice WASM architecture rather than a distinct engine win. | Current LibreOffice WASM | **KEEP CURRENT** | Final Firefox audit; cold Word conversion approximately 41–49 s on this host. |
| Image conversion / compression | Browser canvas/native WebP; existing jSquash resize | MozJPEG, OxiPNG, jSquash WebP/AVIF/resize | MozJPEG was 24.7–25.8% smaller than native JPEG and improved PSNR by 1.9–2.6 dB. OxiPNG was 75.0% smaller losslessly with identical transparency. jSquash WebP produced identical bytes/PSNR but was slower. AVIF exceeded the bounded 300 s run. | MozJPEG + OxiPNG for eligible images; native WebP/current resize | **ADOPT TWO WINNERS** | Real Firefox 392 px benchmark in `codec-benchmark.json`; integrated conversion/compression outputs passed. |
| HEIC to JPG | `heic-to` 1.5.2 / libheif WASM | libheif via maintained wrapper | The required candidate is already current. A real repository-permitted libheif HEIC decoded, converted, preserved dimensions, and produced a valid nonblank JPEG. | Current | **KEEP CURRENT** | Final Firefox audit, not an extension-rename fixture. |
| Remove Background | IMG.LY browser-local 1.7.0 | IMG.LY browser-local | The required candidate is already current. Real Firefox output contained meaningful transparent and opaque pixels and preserved foreground instead of returning fake success. | Current IMG.LY | **KEEP CURRENT** | Two complete V6 audit passes. |
| Doc Scanner | Scanic 1.6.0 plus SoraFiles manual-corner and adjustment pipeline | Scanic, Nitidoc/OpenCV.js | Scanic is already current and passed multi-page import, full-image default, opt-in corner correction, manual sliders/live preview, mobile panels, and adjusted export. Nitidoc's OpenCV runtime cost did not establish a material product win. | Current Scanic | **KEEP CURRENT** | Final Firefox audit plus separate 390×844 workspace audit. |
| Sign, watermark, page numbers | pdf-lib coordinate overlays | Pagelea/Unfleece/editor interaction references | Correct real placement, drag/resize, undo/redo, page targeting, output coordinates, and mobile interaction passed. No engine replacement was justified. | Current | **KEEP CURRENT; retain premium workspace UI** | Full run plus focused Sign PDF retry pass. |

## Adopted implementation

- `@jsquash/jpeg@1.6.0` is lazy-loaded only for JPEG work, capped at 12 megapixels, and falls back to native canvas encoding on unsupported/failed WASM execution.
- `@jsquash/oxipng@2.3.0` is lazy-loaded for lossless PNG optimization, preserves alpha, uses the same 12-megapixel cap, and falls back to the original native PNG.
- Image Converter uses the winners for JPG/PNG and retains native WebP.
- Compress Image tries lossless OxiPNG once before its existing lossy PNG path. MozJPEG is accepted only when it is smaller than the selected native JPEG and still obeys the user's hard byte ceiling.

## Verification gates

- Astro diagnostics: **129 files, 0 errors, 0 warnings, 0 hints**.
- Unit tests: **75/75 PASS**.
- Production build: **629 pages PASS**.
- Real Firefox 154 audit: **26/26 tools PASS** in the first final integration run; the rebuilt final-artifact run produced 25 PASS plus one transient Sign PDF wait timeout, followed by an immediate focused **Sign PDF PASS**.
- Negative paths: **6/6 PASS**.
- Mobile workspace audit: **all shared families PASS at 390×844**.
- Privacy probes: no unexpected file-bearing non-GET requests.
- Production: Cloudflare Worker `75571fe2-bb74-480c-ae0c-dce9dc937d6d`; focused live Firefox verification **4/4 PASS** for Image Converter, Compress Image, Remove Background, and Doc Scanner.

## Final status

**VERIFIED WITH KNOWN LIMITATIONS**

Known limitations are bounded: Safari was unavailable on this macOS host; browser peak memory could not be captured with a stable Firefox API, so package/resource transfer and process RSS were used; Paddle table-layout/PyMuPDF and unavailable browser builds such as pdfcpu/Unfleece were not treated as successful candidates; and AVIF exceeded the five-minute benchmark ceiling. No adopted engine depends on those incomplete paths.
