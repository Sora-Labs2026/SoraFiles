# Sora Files tool verification report

## Test environment

- Date: 2026-08-11
- Browser: installed Microsoft Edge, controlled headlessly with Playwright
- App target: Astro production build served by Astro preview in background mode
- Validation rule: downloaded files are reopened with an independent parser or decoder

## PDF to Word

### Basic two-page text PDF

- Fixture: `tests/fixtures/text-two-page.pdf`, generated with pdf-lib
- Result before changes: PASS
- Download: valid DOCX package
- Independent inspection: Mammoth extracted both `Sora Files page one` and `Sora Files page two`

### External CMap PDF

- Fixture: `tests/fixtures/mozilla-cmap-gbkp-euc-h.pdf`
- Provenance: Mozilla PDF.js test corpus, `test/pdfs/issue3521.pdf`
- Expected text: `我们都是黑体字`
- Result before changes: FAIL
- Visible status: `No selectable text was found. Scanned PDFs need OCR, which is not available locally yet.`
- Browser evidence: PDF.js logged `Ensure that the cMapUrl API parameter is provided.`
- Root cause: the shared PDF.js loader configured a worker and a WASM path, but did not configure or deploy packed CMaps. PDFs whose fonts rely on an external CMap therefore appeared to contain no selectable text.

### Repair hypothesis

Deploy the packed CMaps from the installed `pdfjs-dist` version and pass their URL to `getDocument`. The same failing browser test must then produce a valid DOCX containing the expected Chinese text.

### Repair result

- Packed CMaps deployed under `/pdfjs/cmaps/`: 169 files, 1,167,747 bytes
- Loader now passes `cMapUrl` and `cMapPacked: true`
- External CMap fixture after repair: PASS; valid DOCX independently reopened with the expected Chinese text
- Basic two-page fixture regression: PASS
- Blank-page/no-OCR recovery: PASS; no download is exposed

## Document action matrix

| Tool | Download inspected | Independent result |
| --- | --- | --- |
| Merge PDF | `merged-sora-files.pdf` | PASS: valid PDF, 2 input files, 2 output pages |
| Split PDF | `text-two-page-pages.zip` | PASS: valid ZIP, 2 numbered PDFs, 1 valid page in each |
| Rotate PDF | `text-two-page-rotated.pdf` | PASS: valid 2-page PDF, every page rotated 90 degrees |
| JPG to PDF | `images-sora-files.pdf` | PASS: valid 1-page PDF with positive page dimensions |
| PDF to JPG | `text-two-page-jpg.zip` | PASS: valid ZIP, 2 numbered JPGs, both decoded with positive dimensions |
| PDF to Word | `text-two-page.docx` | PASS: valid DOCX with both expected page strings |
| Word to PDF | `single-paragraph.pdf` | PASS: valid PDF; PDF.js independently extracted `Walking on imported air` |

All seven document routes also rejected extension-matching files with invalid magic bytes and exposed no result download.

## All-in-one image converter

| Flow | Download inspected | Independent result |
| --- | --- | --- |
| JPG to PNG | `sample-converted.png` | PASS: PNG signature; decoded at 960 × 540 |
| JPG to WebP | `sample-converted.webp` | PASS: RIFF/WebP signature; decoded at 960 × 540 |
| JPG to JPG | `sample-converted.jpg` | PASS: JPEG signature; decoded at 960 × 540 |
| HEIC to JPG | `libheif-example-converted.jpg` | PASS: JPEG signature; decoded at 1280 × 854 |

Corrupt HEIC, unknown binary, camera RAW, and INDD inputs were rejected with format-specific recovery text and no result. The visible format claims remain aligned with actual behavior: RAW and INDD are explained as unsupported; JPEG 2000 remains explicitly browser-dependent.

## Compress and resize images

| Mode/input | Result | Independent inspection |
| --- | --- | --- |
| Auto JPG | 87.9 KB → 59.5 KB (32% smaller) | PASS: decoded output; exceeds the promised 20% minimum saving |
| Target 40 KB WebP | 87.9 KB → 38.6 KB | PASS: under the 38.8 KB safety-margin target |
| Reduce by 25% WebP | 87.9 KB → 65.6 KB | PASS: reduction is based on source bytes |
| Target selected from PNG Auto | 1.26 MB → 240 KB | PASS: control immediately switches to target-capable WebP |
| Auto opaque PNG | 1.26 MB → 802 KB (37% smaller) | PASS: valid opaque PNG, resized only after full-size encoding was insufficient |
| Auto transparent PNG | 1.36 MB → 1.00 MB (26% smaller) | PASS: valid PNG with transparent pixels preserved |
| HEIC through HEIC route | 718 KB → 495 KB (31% smaller) | PASS: valid JPG decoded independently |

The previously reported “Auto made the file larger” and weak PNG behavior do not reproduce in the current engine. Regression tests now fail if Auto presents a result above 80% of the source for these representative fixtures, or if PNG transparency is lost.

## Compress PDF

- Rasterization acknowledgement: PASS; processing does not start until the user confirms that text, links, forms, signatures, bookmarks, and accessibility structure will be flattened.
- Image-heavy three-page PDF: PASS; 1.37 MB → 403 KB (71% smaller), valid three-page output, then rendered through PDF-to-JPG and independently decoded.
- Efficient two-page text PDF: PASS; valid two-page output, clearly labeled larger than the original, recommends keeping the original, and independent extraction confirms the flattened result has no selectable text.
- JPEG 2000 page: PASS after decoder repair; valid output with zero `/pdfjs/wasm/` 404 responses.
- Invalid signature, corrupt PDF body, and password-protected PDF: PASS; clear recovery text and no stale result.

### JPEG 2000 decoder repair

The first JPEG 2000 run completed only after 404 responses for `openjpeg.wasm` and `openjpeg_nowasm_fallback.js`. The installed PDF.js decoder files are now deployed under `/pdfjs/wasm/`; the same browser test passes without failed asset requests.
