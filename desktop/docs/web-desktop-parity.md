# Web / Desktop parity baseline

September 17, 2026, Windows 10 x64; additive design/parity/compact-installer steering.
This is a source-inspected baseline, not a parity certification. All 25 eligible
tools remain unreleased. Unlock PDF stays free Web-only and is absent from Desktop
execution, entitlement and package entry points. No renamed substitute is allowed.

There are 23 scoped processing routes and 22 basic option forms. Two Office
engines and the signature editor are not connected to a complete user workflow.
**No tool has complete cross-platform Web parity certification.** Existing fixture
passes prove the specific properties below, not every format or option in Web.

## Per-tool matrix

Web input/output labels come from `src/data/liveTools.ts` and
`src/lib/tool-metadata.ts`; controls and operations were inspected in the named
workbenches/engine modules. Desktop limits are enforced by `desktop/core`, not
merely displayed labels. All rows need side-by-side browser/native fixtures.

| Tool | Web baseline / inputs → outputs | Current Desktop operations / limits | Evidence and material gap |
| --- | --- | --- | --- |
| Compress PDF | PDF → PDF; structural and image compression, quality/profile controls | qpdf structural compression; 64 MB, 1,000 pages; refuses signed/encrypted; unchanged-copy warning | Pixel-identical fixture, forms/attachments retained. Image downsampling and quality targets missing; no compression-ratio parity claim. |
| Merge PDF | PDF selections → PDF; visual order/page workspace | Ordered files and core page selection/rotation; 256 MB aggregate, 1,000 pages | Page-order/text fixtures pass. Thumbnail/page editor and complex document-level features need comparison. |
| Split PDF | PDF → PDF/ZIP; ranges, groups, visual selection | Each/odd-even/ranges/fixed groups; 256 MB, 1,000 pages | Decoded page membership/ZIP checked. Core custom groups not exposed; visual preview missing. |
| Rotate PDF | PDF → PDF; visual page selection and quarter turns | Explicit ranges and quarter turns; 256 MB, 1,000 pages | Crop/rotation/page content fixtures. Visual editor and comparable encrypted-input behavior pending. |
| Remove Pages | PDF → PDF; thumbnail selection | Explicit page ranges; retains at least one page; 256 MB, 1,000 pages | Count/order and invalid selection checks. Thumbnail selection and undo missing. |
| PDF to JPG | PDF → JPG/PNG/ZIP; page/quality/resolution controls | All pages or ranges, JPG/PNG, quality 40–100, 150/300 DPI UI; 72–300 core; bounded pixel budget | Independent crop/rotation/colour/dimension and selected page-number/order checks. ZIP names keep source page numbers. Actual Web renderer/quality comparison and visual page selection pending. |
| JPG to PDF | JPG/PNG → PDF; page ordering/layout | Ordered JPG/PNG, A4/Letter/image size and orientation; 256 MB, 100 MP aggregate | Pixel/layout fixtures. Margin/DPI core options not exposed; per-page preview missing. |
| PDF to Word | PDF → DOCX; editable reconstruction, visual mode and OCR paths | Selectable text and page breaks only; direction; 64 MB, 60 pages; every page must contain text | DOCX XML/text checked. Layout/images/tables/scans/blank pages and visual mode below Web scope. |
| Word to PDF | DOCX → PDF through ZetaOffice Writer | Not ported | Cached browser prototype is historical evidence only. Complete offline engine/font pack, safe import settings and fidelity fixture baseline required. |
| Watermark PDF | PDF → PDF; interactive overlay controls | Text watermark; size, angle, opacity, colour, margin and page selection UI | Rotated/cropped text-angle fixture. September 23 browser-form-to-engine selection/option checks pass. Visual placement remains missing. |
| Page Numbers | PDF → PDF; position/format/selection controls | Start, six positions, format, margin, size, colour, skip and page selection UI | Geometry/number-order tests. September 23 form-to-engine Roman/total/skip checks pass; visual preview remains missing. |
| Sign PDF | PDF plus drawn/typed/imported visual signature → PDF | Core image placement only; 256 MB, 1,000 pages; no UI editor | Rotated/cropped placement pixels checked. Draw/type/import placement UI missing. Neither product promises certificate signing. |
| Image Converter | Broad JPG/PNG/WebP/GIF/TIFF/PSD/HEIC/etc. → supported image/ZIP outputs | Sharp JPG/PNG/WebP/GIF/TIFF decode, selected page core; JPG/PNG/WebP output; 64 MB/25 MP | Dimensions/alpha/orientation fixtures. Many Web formats, page/frame controls and codec comparisons missing. |
| Compress Image | Web codecs, quality/format/profile controls → image/ZIP | Sharp JPG/PNG/WebP, quality 40–100; unchanged-original fallback; 64 MB/25 MP | Output decode/collision checks. Equivalent-quality perceptual/size comparisons and Web profiles missing. |
| HEIC to JPG | HEIC/HEIF → JPG/ZIP | Primary still HEVC photo only; 64 MB/25 MP; quality 40–100; warns additional images | Pinned upstream fixture: dimensions, colour MAE <8 and PSNR >28 dB against decoded original. No Web comparison, HDR/sequence/general HEIF claim. |
| Edit Image | JPG/PNG/WebP; crop, rotation, flips, manual adjustments → image | Rotation/mirror and ten colour/detail controls; crop/resize core; 64 MB/25 MP | All ten shared adjustments match browser pixels exactly across 12 synthetic sRGB cases including alpha. Live preview, interactive crop, full geometry/profile/format parity missing. |
| Remove Background | JPG/PNG/WebP; ISNET, soft masks, optional solid-edge cleanup | JPG/PNG/WebP; pinned uint8 model, CPU WASM, original-alpha multiplication; 64 MB/12 MP | Real-model known regions/RGB/alpha/batch fixtures. Cleanup, photographic/hair/glass comparisons missing; model legal provenance pending. |
| Protect PDF | PDF → password-protected PDF | Opening-password encryption; 256 MB/1,000 pages; refuses already encrypted | Independent password-required decode, wrong-password and source checks. Full Web permission/settings and signature behavior comparison pending. |
| Repair PDF | Readable damaged PDF → rewritten PDF | Structural rewrite; 64 MB/100 pages; refuses encrypted/signed; compares PDF.js page/text/operators | Corrupted startxref, pixels/forms/attachment fixture. General corruption and Web rewrite comparison pending; missing bytes unrecoverable. |
| Metadata Remover | PDF/JPG/PNG/WebP/DOCX/XLSX/PPTX → cleaned same family | PDF properties/XMP, still JPG/PNG/WebP metadata, unsigned DOCX/XLSX/PPTX properties without macros; 64 MB | Shared lossless Web image subset; conversion cases re-encode with disclosure. September 23 Office fixtures match Web property scope and preserve non-property entries, readable Word text, spreadsheet values/formulas. Strict/legacy and relocated OOXML layouts may be refused; full Office application rendering/cross-platform parity pending. This is not redaction. |
| PDF to Excel | PDF → XLSX; selectable tables and visual mode | Shared selectable-text table extraction; text cell preservation; 64 MB/100 pages | Identifiers/formula-like strings remain literal. Visual sheets, scan support and Web extraction comparison pending. |
| Excel to PDF | XLSX/XLS/CSV → PDF; Calc/print-layout conversion | Not ported | Complete local engine/font pack and print-area/chart/formula/pagination fixtures required. |
| OCR | PDF/JPG/PNG/WebP → text/searchable outputs with language choices | PDF/JPG/PNG/WebP, 19 bundled languages, TXT/searchable PDF; 100 pages/100 MP; PDF raster 150 DPI | Known invoice, licensed Unicode-name WebP, language asset integrity and searchability checked. Six bundled CPU fallback cores recognize English. Multilingual accuracy/layout/rotation and Web output comparison pending. |
| Resize Image | JPG/PNG/WebP; dimensions, aspect, presets, resampling → JPG/PNG/WebP | Max-width UI, fit/dimensions/enlargement core; 64 MB/25 MP | Independent dimensions/alpha checks. Web controls/presets and equivalent resampling quality comparison pending. |
| Document Scanner | Imported/camera images, perspective corners, filters/manual adjustments, reorder → PDF/JPG/PNG and searchable workflows | Imported JPG/PNG/WebP; shared filters, rotation, ordering, A4/Letter/image PDF; 20 images/60 MP total/12 MP each | Rendered order/rotation/dark markings tested. Camera, perspective/editor, per-page edits, image/searchable export missing. |

## Common behavior and platform scope

Desktop processing requires a verified signed trial/paid entitlement at the native
boundary and queue. Lifetime remains usable permanently offline after activation;
support replacement revokes only future server issuance for the old activation.
Every new result uses a separate filename; Windows pins inputs/directories and
publishes validated bytes by open handle. Batches retain completed outputs when
cancelled. Workers receive bytes/options; no file upload or runtime asset download.
Malformed/encrypted inputs fail within each declared scope; unsupported formats
must not be described as implemented simply because the shared Web registry lists them.

Windows helper destruction/recreation, offline processing, output publication and
process-tree cleanup have local tests. Installed Explorer/login/upgrade/uninstall
are pending. macOS/Linux are unverified here; old CI builds do not certify new ports.

## Engine/version baseline and assets

Shared: pdf-lib 1.17.1, PDF.js 6.2.108, Tesseract.js/core 7.0.0, docx 9.7.1,
SheetJS 0.20.3. Desktop images use Sharp 0.35.4; Web uses Canvas and JSquash codecs.
qpdf-wasm package 0.3.0 contains qpdf 12.2.0. HEIC wrapper 1.5.2 contains libheif
1.22.2/libde265 1.0.16. Background uses ONNX Runtime Web 1.21.0 and the pinned
44,348,940-byte IMG.LY 1.7.0 uint8 ISNET model. ZetaJS 1.2.0's historical cached
Office assets are not a current production Office port.

Package notices are retained. AGPL/source, HEVC, model, qpdf wrapper provenance,
Office/font and all platform redistribution reviews remain release gates.
Current development packs bundle OCR languages and the background model; no
customer-facing optional-download workflow exists yet. Do not advertise a smaller
installer by quietly omitting these assets.

## Next measurable parity work

1. Run shared Web/Desktop scanner filter and table-extraction fixtures from the
   same bytes; expand formats and controls with the largest documented gaps.
2. Expand existing synthetic background comparisons with photographic/detail
   fixtures and explicit solid-edge cleanup; still WebP is supported.
3. Compare compression at equal perceptual quality; preserve conservative output
   fallback and measure size plus quality together. Office needs a full local
   converter benchmark before choosing a compact implementation.

Passing subset fixtures updates the corresponding row only. Publication remains
closed until advertised scope, installer/platform checks and release gates pass.

### First measured subset comparison

`node desktop/tests/scanner-parity.mjs` PASS on Chrome: seven Web scan filters
executed in the browser versus final Desktop PDF pixels from identical opaque
sRGB input, full image at 150 DPI. Every filter has MAE 0 and maximum channel
difference 0. Evidence: `.artifacts/parity/scanner-filters.json`. This does not
close perspective/camera/format/control gaps. Model license inspection also found
upstream Apache-2.0 versus supplier MIT; exact model redistribution grant unresolved.

Actual background worker comparison now measures three synthetic inputs with the
same CPU uint8 model. Canvas resampling reduced alpha MAE versus Web from
0.474/0.709/0.964 to 0.091/0.187/0.747 (byte units). Edge maxima remain 124/128/160;
this is measured improvement, not parity certification. Full measurements,
limitations and fixture provenance are in `background-removal.md`.
