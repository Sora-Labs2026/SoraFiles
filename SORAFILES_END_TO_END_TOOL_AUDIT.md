# SoraFiles End-to-End Tool Audit

Updated: 2026-08-29 (Asia/Kathmandu)

## Verdict

**PASS — 26 of 26 production tools completed real black-box UI workflows and produced outputs that passed format-aware validation.**

- Open P0 defects: **0**
- Open P1 defects in the tested local build: **0**
- P1 defects found and fixed during this audit: **1** (`SF-V2-001`)
- Live production drift: **0** (the detected stale-deployment difference was resolved)
- Browser: Firefox 154.0.1 with geckodriver 0.36
- Runtime/build verification: Node 22.13.0 compatibility mirror
- Viewports: 1440px desktop, 900px tablet, and asserted 390 CSS-pixel phone viewport
- Processing target: local production build served from `http://127.0.0.1:4355`

Every tool was opened through its real public route. The runner used native file inputs, production controls, production workers/engines, actual browser downloads, independent output parsers, pixel inspection where applicable, and responsive screenshots. It did not invoke tool engines directly to manufacture a pass.

## Deterministic fixture set

`tests/fixtures/generate-sorafiles-qa.mjs` creates the reusable fixture corpus in `tests/fixtures/sorafiles-qa/`:

- native-text, mixed-content, table, image-only OCR, form/link, metadata, protected, damaged, zero-byte, and invalid-signature PDFs;
- landscape, portrait, transparent, foreground/background, metadata-bearing, signature, watermark, and photographed-document images;
- simple and layout-sensitive DOCX files plus a styled two-sheet XLSX workbook;
- a WebP generated in-browser from the deterministic PNG and the repository-permitted libheif HEIC sample.

Protected PDF password: `SoraQA2026!`. Fixtures contain synthetic QA content only.

## Complete tool matrix

Privacy/network result `Local-only` means the in-page fetch/XHR/beacon probe observed no unexpected non-GET file request. Expected page, worker, font, WASM, and model asset GETs were allowed; no selected file body was uploaded.

| Tool | Fixture | Actions performed | Download/output | Output validation | UI validation | Privacy/network | Status | Bug ID / notes |
|---|---|---|---|---|---|---|---|---|
| Compress PDF | `mixed-content.pdf` | Ran recommended native compression; explicitly acknowledged and ran maximum flattened mode | Two PDFs | Both parse as 2 pages; recommended output retains known native text; maximum output is smaller | Real options, warning, result, and download flow; no overflow | Local-only | PASS | Native/flattened distinction proved |
| Merge PDF | Native 3-page + mixed 2-page PDFs | Uploaded both, moved second file earlier, merged | 5-page PDF | Parser confirms 5 pages, reordered content, and extractable text | Real reorder control reflected in output | Local-only | PASS | Same-file-twice case separately produced a valid 6-page PDF |
| Split PDF | Native 3-page PDF | Selected pages 1 and 3, exported separate files | ZIP with 2 PDFs | ZIP parses; each PDF has exactly 1 page; Alpha/Charlie present, Bravo absent | Selection and range controls exercised | Local-only | PASS | No-selection path clearly blocked |
| Rotate PDF | Native 3-page PDF | Selected page 2, rotated 90°, undo, redo, zoom, export | 3-page PDF | Page rotations are exactly `[0, 90, 0]`; known text retained | Canvas, selection, undo/redo, zoom; desktop and tablet screenshots | Local-only | PASS | — |
| Remove Pages | Native 3-page PDF | Removed page 2 | 2-page PDF | Alpha/Charlie remain; Bravo removed | Before/after count changed 3 → 2 | Local-only | PASS | — |
| PDF to JPG | Native 3-page PDF | Exported all pages | ZIP with 3 JPEGs | All images decode, are nonblank, and are 1224×1584 | Result/download flow and preview inspection | Local-only | PASS | — |
| JPG to PDF | Landscape + portrait JPEGs | Reordered portrait first and exported with fit defaults | 2-page PDF | First page portrait, second landscape; no unexpected stretch | Real reorder and export controls | Local-only | PASS | — |
| PDF to Word | Native PDF + table PDF | Ran editable mode for both and visual-fidelity mode for native PDF | 3 DOCX files | Valid DOCX containers; editable text/table values retained; visual mode has one page image per source page | Both modes selected through UI | Local-only | PASS | — |
| Word to PDF | Simple + layout DOCX | Converted each independently | 2 PDFs | Both parse; headings, second page, table, and controlled text retained | Long-running conversion completed without frozen UI | Local-only | PASS | — |
| Watermark PDF | Native PDF + transparent logo | Added selected-page text watermark; dragged/resized; separately added image watermark | 2 PDFs | Both parse as 3 pages; text watermark extractable; image watermark adds embedded content | Live overlay drag/resize and rasterized output inspection | Local-only | PASS | Dirty-state keep-editing guard also exercised |
| Page Numbers | Native 3-page PDF | Set “Page X of N”, bottom center, start 1 | 3-page PDF | Extracted text contains Page 1/2/3 of 3 in sequence | Live configuration and export | Local-only | PASS | — |
| Sign PDF | Native PDF + synthetic signature PNG | Upload, drag, resize, undo/redo, save locally, reopen, clear, export | Signed 3-page PDF | Valid PDF; signature appearance increases content; rendered preview nonblank | Desktop and 390px mobile; dirty-close guard; mobile panel; local save/clear | Local-only; signature persisted only in localStorage | PASS | Synthetic signature only |
| Image Converter | JPEG + transparent PNG + WebP | JPG→WebP, PNG→JPG, WebP→PNG | 3 images | Declared signatures decode at original dimensions with nonblank pixels | Three real conversion directions | Local-only | PASS | — |
| Compress Image | Landscape JPEG | Auto compression; 90 KB WebP target | JPEG + WebP | Auto reduced 120901→93756 bytes; target is 27318 bytes and ≤90 KB; both decode | Normal and target-size controls | Local-only | PASS | — |
| HEIC to JPG | Real libheif HEIC | Converted and downloaded | JPEG | JPEG signature; decodes 1280×854; nonblank | Real HEIC decode path, not extension renaming | Local-only | PASS | — |
| Edit Image | Landscape JPEG | Square crop, rotate, flip, brightness/contrast, undo/redo, WebP export | 900×900 WebP | Valid nonblank square image; pixels/dimensions differ from source | Every named control changed real workspace state | Local-only | PASS | `SF-V2-001` fixed and retested |
| Remove Background | Foreground/background PNG | Ran installed matting model and downloaded | Transparent PNG | Decodes 1200×900 with meaningful transparent and opaque pixels | Real model completed; checkerboard result screenshot | Local-only | PASS | Foreground not erased |
| Resize Image | Landscape JPEG | Aspect-locked resize to 800×450; separate 1:1 crop preset | 2 JPEGs | Exact 800×450 and 900×900 dimensions | Resize and crop-preset contracts both exercised | Local-only | PASS | — |
| Protect PDF | Native 3-page PDF | Set password, disabled copying, protected, tested wrong/correct password externally | Encrypted PDF | `/Encrypt` present; wrong password rejected; correct password decrypts to valid 3-page PDF with known text | Password and permission controls | Local-only | PASS | AES-256 path |
| Unlock PDF | Protected PDF | Tried wrong password, then correct password | Unlocked PDF | Wrong password shows visible error; output trailer is unencrypted; 3 pages and known text parse | No false success on wrong password | Local-only | PASS | — |
| Repair PDF | Truncated PDF + valid control | Submitted damaged fixture, then valid control | Repaired control PDF | Damaged input shows visible failure and no download; control remains valid 3-page PDF with native text | UI recovers after error and processes next file | Local-only | PASS | No empty/corrupt success accepted |
| Metadata Remover | Metadata PDF + metadata JPEG | Uploaded both together and removed metadata | Clean PDF + JPEG | PDF title/author/subject removed; JPEG synthetic make/description absent; both remain readable | Multi-file result/download flow | Local-only | PASS | — |
| PDF to Excel | Controlled table PDF | Used editable-table mode | XLSX | Valid workbook; all controlled names, quantities, and prices are editable cells | Default editable mode exercised | Local-only | PASS | Page-image-only workbook would fail validation |
| Excel to PDF | Styled two-sheet XLSX | Converted workbook | PDF | Valid PDF; both sheets, Sales table, Summary, and merged-cell text retained | Workbook conversion completed | Local-only | PASS | — |
| PDF OCR | Browser-rendered image-only 2-page PDF | English OCR to searchable PDF, then TXT; separate run cancelled | Searchable PDF + TXT | PDF parses as 2 pages; both outputs contain controlled phrase and numbers 8675309/12345 | Real OCR worker, language/output controls, cancellation | Local-only | PASS | Fixture contains no native text layer |
| Doc Scanner | Photographed-document PNG ×2 | Uploaded two pages, adjusted a corner, applied perspective, selected contrast, exported | 2-page PDF | PDF parses with exactly 2 nonempty pages | Four handles present; real corner movement; 390px full-screen editor; no overflow | Local-only | PASS | Mobile screenshot saved |

## Negative and recovery paths

| Case | Evidence | Status |
|---|---|---|
| Unsupported extension | `unsupported.txt is not a valid PDF. Choose files with a real PDF signature.`; no result | PASS |
| Zero-byte file | `zero-byte.pdf is not a valid PDF. Choose files with a real PDF signature.`; no result | PASS |
| Invalid PDF signature | `invalid-signature.pdf is not a valid PDF. Choose files with a real PDF signature.`; no result | PASS |
| Wrong password | Visible unlock error; correct retry succeeds | PASS |
| Corrupted PDF | Visible processing failure; no blank download; valid control succeeds afterward | PASS |
| Cancel processing | OCR cancellation reports `Cancel`; no result exposed | PASS |
| Close during edit | Dirty Sign/Watermark workspace opens discard guard; Keep editing preserves work | PASS |
| Duplicate/same file twice | Merge handles two copies deterministically; resulting PDF parses with 6 pages | PASS |
| Export with no pages selected | Split reports `Select at least one page to extract.`; no result | PASS |

The excessively-large-dimensions case was not generated because a genuinely decoded oversized bitmap would add unnecessary memory pressure to this workstation. Existing production pixel guards were retained and are covered by unit/source checks; the real-browser negative suite focused on safe fixtures.

## Visual and responsive evidence

- Desktop: Sign, Watermark, Rotate, Remove Background, and representative Preview/Quick flows were inspected at 1440px.
- Tablet: Rotate workspace inspected at 900px with no horizontal overflow.
- Phone: Sign and Doc Scanner inspected at an asserted 390 CSS-pixel viewport. Mobile panel navigation, primary actions, full-screen geometry, and overflow checks passed.
- Passing screenshots are under the ignored `test-results/sorafiles-e2e-*/screenshots/` directories, including `sign-pdf-desktop-pass.png`, `sign-pdf-mobile-pass.png`, `watermark-pdf-output-pass.png`, `rotate-pdf-tablet-pass.png`, `remove-background-pass.png`, and `doc-scanner-corners-pass.png`.

## Defects found and resolved

### SF-V2-001 — Edit Image undo/redo advertised but not implemented

- Severity: P1
- Cause: the adaptive workspace displayed undo/redo commands, but Edit Image did not keep meaningful snapshots or respond to workspace command events.
- Fix: added bounded edit snapshots and undo/redo stacks, synchronized button state, and recorded crop, rotate, flip, brightness, contrast, preset, drag, and reset actions.
- Retest: PASS. Undo reverses a meaningful edit, redo restores it, and the exported WebP has changed pixels and dimensions.

## PRODUCTION_DRIFT — resolved

A safe QA-only Firefox smoke test initially found one stale-deployment difference after the local PASS:

- Rotate PDF: PASS; behavior and parsed output match local.
- Edit Image: initially failed on the undo assertion because the live deployment still had the pre-fix behavior.

The verified build was then deployed as Worker version `c3e78984-d5d6-49c0-ae52-a227d369892a`. The post-deploy Firefox audit passed both Rotate PDF and Edit Image, including Edit Image crop, rotate, flip, brightness/contrast, undo, redo, and changed-pixel WebP export. The production drift is resolved.

## Final repository gates

- `astro check`: 126 files, 0 errors, 0 warnings, 0 hints.
- Production build: PASS, 629 static pages.
- Unit suite: PASS, 68/68.
- `git diff --check`: PASS.
- Known non-blocking build notices: ONNX runtime URL remains runtime-resolved and the existing large-chunk advisory remains.

## Reproduction commands

```sh
npm run fixtures:qa
npm run test:tools:firefox-audit
```

The audit also supports focused retests:

```sh
SORA_QA_RUN_RESPONSIVE=1 npm run test:tools:firefox-audit -- --tool "Rotate PDF"
SORA_QA_RUN_ERROR_PATHS=1 npm run test:tools:firefox-audit -- --tool "__error_paths__"
```

## Evidence locations

- Full initial matrix: `test-results/sorafiles-e2e/audit-results.json`
- Focused passing retests: `test-results/sorafiles-e2e-retest-2/`, `sorafiles-e2e-retest-3/`, `sorafiles-e2e-retest-7/`, `sorafiles-e2e-edit-retest-2/`, and `sorafiles-e2e-repair-retest-2/`
- Tablet evidence: `test-results/sorafiles-e2e-tablet/`
- Negative-path evidence: `test-results/sorafiles-e2e-error-paths-3/error-path-results.json`

These directories are intentionally ignored because they contain generated downloads and screenshots. The deterministic generator, Firefox runner, parsers, and this report are repository artifacts.

## V6 final benchmark and integration audit — 2026-08-30

The mandatory V6 engine work ran first in `/tmp/sorafiles-engine-lab` and then on isolated branch `codex/v6-benchmark`. Only MozJPEG and OxiPNG cleared the material-win gate; both were integrated with lazy loading, a 12-megapixel cap, and native fallback before this final audit.

### Black-box result

- First complete post-integration Firefox 154 run: **26/26 tools PASS**.
- Final rebuilt-artifact run: **25 PASS, 1 transient Sign PDF discard-control wait timeout**; the exact Sign PDF workflow immediately passed in a clean focused rerun in 10 seconds. The earlier complete run and separate mobile run also passed Sign PDF.
- Error paths: **6/6 PASS** — unsupported extension, zero-byte PDF, invalid PDF signature, duplicate merge input, no split selection, and cancellation.
- Mobile workspaces: **all shared families PASS at 390×844**.
- Remove Background: meaningful foreground plus transparent output pixels.
- Doc Scanner: multi-page, full-image default, manual corners, non-default adjustment sliders/live preview, mobile panel navigation, and adjusted PDF export.
- Adopted codecs inside SoraFiles: Image Converter passed three format directions; Compress Image passed normal and hard-size-target modes; downloaded outputs decoded, were nonblank, and respected dimensions/signatures.
- Privacy: in-page probes observed no unexpected file-bearing non-GET request.

### Final repository gates

- Astro diagnostics: **129 files, 0 errors, 0 warnings, 0 hints**.
- Unit suite: **75/75 PASS**.
- Production build: **629 static pages PASS**.
- The existing ONNX runtime-resolution and large-chunk build advisories remain non-blocking and unchanged.

### V6 evidence

- Complete passing integration run: `/tmp/sorafiles-engine-lab/outputs/v6-full-audit/`
- Final rebuilt run: `/tmp/sorafiles-engine-lab/outputs/v6-final-audit/`
- Focused Sign PDF confirmation: `/tmp/sorafiles-engine-lab/outputs/v6-sign-retry/`
- Mobile: `/tmp/sorafiles-engine-lab/outputs/v6-mobile/`
- Candidate benchmarks: `/tmp/sorafiles-engine-lab/outputs/{qpdf,scribe,paddle,codec}-benchmark.json`

### V6 status

**VERIFIED WITH KNOWN LIMITATIONS** — Safari and stable browser peak-memory instrumentation were unavailable on this host; several named but unadopted browser candidates were unavailable or failed the bounded runtime gate. Every production tool and every adopted engine path was black-box tested with downloaded-output validation.

### V6 production confirmation

Cloudflare Worker version `75571fe2-bb74-480c-ae0c-dce9dc937d6d` was deployed to both custom domains with the existing daily schedule preserved. Live HTTP checks returned 200 for the homepage and four representative upgraded tools. A post-deploy Firefox audit passed Image Converter, Compress Image, Remove Background, and Doc Scanner **4/4**, including validated downloads, privacy probes, real background transparency, mobile scanner navigation, manual adjustments, and adjusted export. Evidence: `/tmp/sorafiles-v6-production-audit/`.
