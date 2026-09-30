# Desktop image processing evidence

The job layer implements image conversion, compression, resize and basic crop/rotate/flip editing with pinned Sharp 0.35.4. The same decoder supplies oriented, lossless images to image-to-PDF and visible-signature placement. Conversion, compression, resize and basic rotation/mirroring are connected through the native processing bridge and UI, including sequential per-file batches. Full visual crop/signature editors and a published installer remain unfinished.

The helper starts a separate process for each image and waits for it to exit before returning success. The process receives image bytes and validated options, not selected paths or licensing credentials. Environment inheritance is limited to ordinary runtime paths. Cancellation terminates the process, and a two-minute deadline bounds stalled decoding. This is process separation, not an OS sandbox: inherited user filesystem/network rights still require native restrictions before release.

Inputs are limited to 64 MB and 25 million pixels. Output dimensions and bytes are bounded. These are current conservative implementation limits, not claims that desktop hardware has unlimited capacity. JPEG/PNG/WebP output is decoded completely a second time before saving. The queue writes a separate output and compares staged bytes before atomic publication. Compression preserves the original bytes when a candidate is not smaller.

JPEG/PNG are supported by the PDF image paths. The standalone image paths additionally accept WebP, GIF and TIFF. Multipage or animated input requires an explicit page/frame index, and APNG is currently rejected. HEIC, PSD and other web-supported formats remain separate implementation work; do not advertise full converter format parity yet.

Auto-orientation occurs before cropping or sizing. Resize preserves aspect ratio by default and disallows enlargement unless explicitly selected. JPEG uses an explicit background for transparency and 4:4:4 chroma sampling. PNG remains lossless. Metadata is omitted from new encodings; original-byte compression fallback retains the original metadata and must not be described as metadata removal. General image editing, HDR/wide-gamut/CMYK ground-truth fixtures, hostile-decoder OS containment, packed engine provenance and minimum-machine benchmarks remain release gates.

Tests decode saved output using an independent canvas/image implementation. They check alpha, colours, crop coordinates after camera rotation, quarter-turns, paper margins, fit modes, enlargement, lossless PNG pixels, malformed files, cancellation and explicit animation selection. These small-fixture tests establish correctness for the tested cases; they do not establish universal superiority over the web tools.

Implementation references: [Sharp constructor and input limits](https://sharp.pixelplumbing.com/api-constructor/), [input metadata](https://sharp.pixelplumbing.com/api-input/), [orientation](https://sharp.pixelplumbing.com/api-operation/). Sharp and its libvips/codec distribution require their own notices, provenance and source/relinking assessment before shipping.

## Shared colour and detail adjustments

The editor now reuses `src/lib/image/manual-adjustments.ts` through generated
`shared/image-adjustments.mjs`. All ten controls are supported: exposure,
highlights, shadows, contrast, brightness, black point, definition, sharpness,
noise reduction and saturation. Adjustments run after geometry and before output
encoding. Alpha is retained. Unknown, nonnumeric and out-of-range controls fail;
other image tools cannot silently apply editor settings.

The existing form adds a keyboard-operated Colour and detail disclosure, numeric
controls with neutral defaults and a reset button. There is no live preview or
interactive crop claim. No new font, palette, animation or runtime dependency.

`node desktop/tests/image-adjustments-parity.mjs` executes actual Web adjustment
source in Chrome and compares it with decoded Desktop PNG pixels. All 12 cases
(neutral, ten individual controls, combined negative/positive settings) have
MAE 0 and maximum channel difference 0, including varying alpha. This verifies
the adjustment subset on synthetic sRGB input; resampling, profile handling,
visual previews and photographic quality require further comparisons.

The scoped interaction review used Emil's `emil-design-eng` guidance at revision
85e8e2363b713506e1d5b6e07a0eb2da66be1bc3, as MIT reference material only:

| Before | After | Why |
| --- | --- | --- |
| Rotation and mirror controls only | Ten neutral adjustment controls in an optional native disclosure | Add Web controls without overwhelming the default form |
| No way to restore adjustment values | Local reset with an announced result and retained focus | Predictable reversal without processing or changing output format |
| Missing editor parity evidence | Exact browser-versus-decoded-PNG comparison | Validate output behavior independently of UI labels |

SoraFiles tokens and native form conventions remain authoritative. Impeccable,
Taste and Apple-design collections remain inspected but unused for this change;
Figma is unavailable. This is a scoped review, not general design certification.
