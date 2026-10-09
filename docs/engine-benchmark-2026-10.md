# Engine benchmark, October 2026

Question from the owner: are SoraFiles' web and desktop engines the best available? Nothing below has been
switched in production yet; this is the evidence for deciding.

## Summary

| Area | Engine today | Finding | Recommendation |
| --- | --- | --- | --- |
| Compress PDF (web) | Ghostscript WASM + qpdf | **Bug fixed:** downsampling was never switched on and JPEGs passed through untouched, so every strength level produced almost the same file. | Shipped in the working tree (see below). |
| OCR (web + desktop) | Tesseract.js 7, LSTM | Excellent for Latin scripts, weak for Korean, Thai, Hindi and Chinese. | Hybrid: PaddleOCR for those languages, Tesseract elsewhere. Error rate 16.3% → 9.4%. |
| Background removal | IMG.LY ISNet (quint8, 44 MB) | BiRefNet-lite (MIT) is ~7× slower on CPU (33–43 s per photo), 2.6–5× larger, and not clearly better: it finds whole subjects but over-includes background. | Keep ISNet. Add mask refinement; revisit BiRefNet only with WebGPU on the web. |
| JPEG encoding | MozJPEG (jSquash / sharp) | Still the best broadly packaged encoder. jpegli has no maintained WASM build. | Keep. |

## Compress PDF: Ghostscript settings

`src/workers/pdf-compression.worker.ts` passed `ColorImageResolution` targets without
`DownsampleColorImages true`, and pdfwrite passes JPEGs through by default. Same 123 KB text + photo PDF:

| Profile | Before | After |
| --- | --- | --- |
| Balanced (200 DPI) | 124.9 KB (bigger than input) | 103.0 KB |
| Strong (180 DPI) | 124.9 KB | 83.0 KB |
| Maximum safe (150 DPI) | 124.9 KB | 61.7 KB |
| Smallest (120 DPI) | 124.9 KB | 44.9 KB |

Every candidate still passes the page-count check, the SSIM visual floor and, for PDFs with selectable
text, a new check that every page's text is unchanged.

## OCR

**Method.** The 19 SoraFiles OCR phrases plus a line of numbers and dates, rendered as 20 px document text, in
three conditions: clean, phone photo (grey paper, low contrast, 2° tilt, blur, JPEG 40) and small text (~12 px).
Metric: character error rate (CER) against the known text, whitespace ignored. Tesseract ran exactly as SoraFiles
configures it (LSTM only, PSM auto, the bundled traineddata). PaddleOCR ran through `ppu-paddle-ocr` 6.6.1 (MIT)
on onnxruntime.

| Engine | Clean | Photo | Small | All |
| --- | --- | --- | --- | --- |
| Tesseract (today) | 10.9% | 26.4% | 11.6% | 16.3% |
| PP-OCRv6 tiny | 14.8% | 48.6% | 16.2% | 26.5% |
| PP-OCRv6 small | 15.3% | 52.9% | 16.0% | 28.1% |
| PP-OCRv5 language specialists | 23.8% | 53.7% | 28.2% | 35.2% |
| **Hybrid (best per language)** | **5.5%** | **17.2%** | **5.5%** | **9.4%** |

Per language, where switching helps:

| Language | Tesseract | Better engine | CER |
| --- | --- | --- | --- |
| Korean | 48.8% | PP-OCRv5 Korean | 2.9% |
| Thai | 35.4% | PP-OCRv5 Thai | 8.6% |
| Hindi | 35.2% | PP-OCRv5 Devanagari | 8.1% |
| Simplified Chinese | 21.5% | PP-OCRv6 small | 2.1% |
| Traditional Chinese | 7.7% | PP-OCRv6 small | 0.0% |
| Japanese | 6.7% | PP-OCRv6 small | 2.4% |

Tesseract stays best for English, Spanish, French, German, Portuguese, Italian, Dutch, Polish, Indonesian,
Turkish, Vietnamese and Russian (about 2% on clean pages).

**Caveats found while testing**

- The PaddleOCR SDK draws upright boxes, so a 2° tilt can make it drop a whole line (it found the line but
  the crop was too narrow and was filtered). Deskew before recognition, which the scanner already does.
- Arabic is poor on both engines (Tesseract 44% clean; PaddleOCR returns visual order and drops embedded
  Latin words). Needs bidi reordering before a decision.
- PaddleOCR's language specialist is ~13 MB per language (detector + recognizer), similar speed to Tesseract
  (≈0.2–0.4 s per page on a laptop CPU).

## Background removal

**Method.** Eight real photos (long hair, fur on wood and dark backgrounds, a pug in a blanket, shoes, hooded
figures in flowers and haze). ISNet with the desktop worker's exact preprocessing; BiRefNet-lite with its
reference preprocessing. onnxruntime CPU on the same laptop.

| Model | Size | Time per photo (CPU, one photo per process) |
| --- | --- | --- |
| ISNet quint8 (today) | 44 MB | ≈5.3 s |
| BiRefNet-lite fp32 | 224 MB | 33–43 s (≈90 s when memory is contended; it can run out of native memory) |
| BiRefNet-lite fp16 | 115 MB | needs WebGPU (no fast CPU kernels) |

Quality on the same photos (cutouts checked side by side on a checkerboard):

| Photo | ISNet (today) | BiRefNet-lite |
| --- | --- | --- |
| Canoe, long hair | Clean hair and boat; drops the paddle | Keeps the paddle but cuts in trees and sky above the head |
| Dark dog on a dark background | **Fails:** keeps only head and harness | Keeps the whole dog, with background bleeding in |
| Pug in a blanket | Pug and hood; drops the blanket | Pug, blanket, bed and wall |
| White shoes on a red wall | Clean shoes; faint red streaks left above | Shoes plus wall and floor chunks |

Neither model wins outright: BiRefNet-lite finds whole subjects (the dog) but over-includes background, and it is
7× slower and 5× larger. Keep ISNet. Its real weakness is low-contrast subjects, so the most useful next step is a
"keep more / keep less" mask refinement in the editor rather than a model swap. A WebGPU-only "high quality"
option on the web remains possible later.

## Reproducing

The scripts live outside the repo so no benchmark-only dependencies are added: an image generator (19 phrases ×
3 conditions), an OCR runner (`tesseract.js`, `ppu-paddle-ocr`, `onnxruntime-node`) and a background runner
(`onnxruntime-node`, models from `onnx-community/BiRefNet_lite-ONNX` and the checksum-pinned ISNet from
`desktop/scripts/sync-background-model.mjs --download`).
