# SoraFiles Compression Upgrade Implementation

## Final status

**FULLY VERIFIED**

The production build, real Firefox downloads, PDF reopen checks, text extraction, image decoding, transparency checks, dimension checks, quality guards, and the production-bundled Ghostscript and qpdf paths were exercised successfully. Strength 60 resolves to Balanced for both tools.

## Current root cause

The previous Compress Image implementation treated a requested byte target as a hard contract. It binary-searched JPEG/WebP quality from `0.04` to `0.96`, then repeatedly resized dimensions as low as 32% when encoding did not hit the target. PNG fallback reduced RGB channels to 23 and then 15 levels and could also resize. This could manufacture a large reduction at visibly destructive quality.

The previous stronger PDF mode rasterized every page through a canvas. Its retries could lower render scale to `0.32` and JPEG quality to `0.14`, flattening text, vectors, forms, links, signatures, and accessibility data to satisfy a hard byte target. The default native path only re-saved with pdf-lib and did not provide a production-grade image-heavy compression route.

## PDF

### Engines and routing

1. Preflight validates the PDF and inspects extracted text, annotations, attachments, and signature markers.
2. qpdf WASM performs safe structural optimization with object streams, compressed streams, generalized decoding, Flate recompression, and level-9 compression.
3. Native-text PDFs stop after structural optimization so selectable text and vector content are not unexpectedly rasterized.
4. Forms, links, widgets, attachments, and signatures are excluded from Ghostscript image recompression. Signed PDFs return the original bytes without structural rewriting.
5. Eligible scanned/image-heavy PDFs run through Ghostscript WASM in a dedicated worker.
6. The output is reopened, page count is verified, sampled pages are rendered, and SSIM is checked. A failed candidate retries once with the next gentler profile. A larger candidate is discarded.

Installed versions:

| Package | Version | Role |
|---|---:|---|
| `@neslinesli93/qpdf-wasm` | 0.3.0 | structural PDF optimization |
| `@okathira/ghostpdl-wasm` | 1.1.0 | selective image downsampling/recompression |

qpdf arguments: `--object-streams=generate`, `--stream-data=compress`, `--decode-level=generalized`, `--recompress-flate`, `--compression-level=9`.

Profiles:

| Strength | Profile | Color/gray DPI | JPEG QFactor | Mono DPI | SSIM floor |
|---:|---|---:|---:|---:|---:|
| 0–29 | Safe | structural only | — | — | — |
| 30–54 | Quality | 230 | 0.27 | 300 | 0.985 |
| 55–74 | Balanced | 200 | 0.35 | 300 | 0.985 |
| 75–89 | Strong | 180 | 0.42 | 300 | 0.980 |
| 90–100 | Maximum safe | 150 | 0.55 | 300 | 0.975 |
| 100, explicit opt-in | Smallest | 120 | 0.68 | 300 | 0.970 |

Strength 60 is therefore Balanced at 200 DPI with a 0.985 sampled-page SSIM floor. Output page count and PDF readability are always verified. Native text candidates also undergo extracted-text preservation comparison after qpdf.

## Image

All heavy image encoding runs in a dedicated worker. The compressor preserves source format and dimensions by default; HEIC-to-JPG remains the explicit exception for that existing conversion route. There is no automatic resizing and no lossy PNG quantization.

| Format | Engine | Safe | Quality | Balanced (60) | Strong | Maximum safe |
|---|---|---:|---:|---:|---:|---:|
| JPEG | jSquash MozJPEG | 90 | 86 | 84 | 82 | 76 |
| WebP | jSquash/libwebp | 90 | 86 | 85 | 81 | 75 |
| PNG | jSquash OxiPNG | lossless | lossless | lossless | lossless | lossless |

JPEG/WebP quality floors are SSIM 0.990 for Safe, Quality, and Balanced; 0.985 for Strong; and 0.975 for Maximum safe. Screenshot-like images use JPEG/WebP quality of at least 86/88 and SSIM of at least 0.992. If the chosen quality does not pass, the worker tries bounded gentler qualities. If no candidate passes, no lossy download is offered. If an encoded result is not smaller, the original file is returned.

PNG uses lossless OxiPNG only, preserving exact pixels, alpha, and dimensions. WebP now uses the pinned jSquash WebP encoder instead of browser-native canvas encoding.

## Performance

Production-build artifacts measured on 2026-08-31:

| Artifact | Bytes | Load behavior |
|---|---:|---|
| Ghostscript WASM | 15,533,045 | lazy, PDF worker only, eligible scanned/image-heavy PDFs |
| qpdf WASM | 1,334,286 | lazy, PDF worker only |
| PDF worker JS | 82,121 | created only when processing starts |
| Image worker JS | 109,070 | created only when processing starts |
| MozJPEG encoder WASM | 251,524 | lazy, image worker |
| WebP encoder WASM | 281,261; SIMD 345,584 | lazy, image worker |
| OxiPNG WASM | 164,172 / 236,042 | lazy, image worker |

The focused real-Firefox suite completed 7 processing/guard scenarios plus 8 surrounding-route smoke checks in 45.39 seconds on this machine, including cold worker/WASM loads. Work is off the main thread, modules remain cached within each worker for repeat jobs, input size is capped at 50 MB, images at 32 megapixels, PDFs at 40 pages, and PDF sample rendering is bounded to roughly 900 pixels on the longest side.

## Privacy

The real-browser network probe observed no POST, PUT, PATCH, beacon, or other non-GET file-processing request in JPEG, PNG, WebP, qpdf, Ghostscript, native-text PDF, or protected-PDF cases. WASM and worker assets were loaded from the same local origin. Selected file bytes remained in browser memory and worker messages.

## Licenses

| Package | Version | License |
|---|---:|---|
| `@okathira/ghostpdl-wasm` | 1.1.0 | AGPL-3.0-or-later |
| `@neslinesli93/qpdf-wasm` | 0.3.0 | ISC |
| `@jsquash/webp` | 1.5.0 | Apache-2.0 |
| `@jsquash/jpeg` | 1.6.0 | Apache-2.0 |
| `@jsquash/oxipng` | 2.3.0 | Apache-2.0 |

Attribution is exposed on the Open Source page and in `/compression-licenses/NOTICE.txt`.

## Tests and results

Focused fixtures exercised:

- `landscape.jpg`: Balanced MozJPEG, 120,901 → 72,314 bytes (40% smaller), dimensions preserved.
- `portrait.jpg`: Maximum-safe profile, 96,081 → 52,594 bytes (45% smaller), dimensions preserved.
- `transparency.png`: lossless OxiPNG, 30,042 → 3,756 bytes (87% smaller), transparency and dimensions preserved.
- `webp-image.webp`: already efficient; original 18,384 bytes returned, format and dimensions preserved.
- `native-text-3-pages.pdf`: qpdf path, 2,997 → 2,030 bytes (32% smaller), three pages and extracted text preserved.
- `scanned-document.pdf`: production Ghostscript path executed, 93,728 → 84,821 bytes (9% smaller), two pages reopened successfully; the quality-first result was retained rather than forcing a larger reduction.
- `form-or-link.pdf`: protected-content routing skipped Ghostscript and returned a readable PDF.

Automated results:

- Astro diagnostics: 135 files, 0 errors, 0 warnings.
- Unit suite: 83/83 passed.
- Real Firefox compression suite: all JPEG, Maximum-safe JPEG, PNG, WebP, native-text PDF, scanned Ghostscript PDF, protected-PDF, download/open, privacy, and routing assertions passed.
- Surrounding route smoke: Merge PDF, Split PDF, Rotate PDF, JPG to PDF, PDF to JPG, Resize Image, Image Converter, and PDF OCR passed.
- Production static build: 629 pages built; qpdf, Ghostscript, MozJPEG, OxiPNG, and WebP worker/WASM artifacts emitted with hashed same-origin URLs.
- Production validators: content truth, brand positioning, 19-language i18n, SEO/GEO, search branding, advertising-free checks, OCR assets, and optimizer policy passed.

The Chromium smoke command could not launch because this machine does not have Playwright's matching Chromium binary installed. This does not reduce the final status because the complete production-bundled compression paths, downloads, file validation, Ghostscript execution, and privacy assertions were tested in a supported real Firefox browser; the surrounding tools were also smoke-tested there.
