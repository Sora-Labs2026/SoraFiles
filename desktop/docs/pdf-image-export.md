# PDF image export scope

PDF.js 6.2.108 with bundled fonts/CMaps/WASM and native Canvas render locally in
an on-demand child process. Desktop accepts unencrypted PDFs up to 256 MB and
1,000 pages. JPG/PNG output supports 72–300 DPI in the engine; the current form
offers 150/300 DPI and JPG quality 40–100. PNG ignores JPG quality.

The page-range field defaults to all pages. Enter one-based ranges such as
`1-3, 5`; the engine validates against the actual source count, orders pages as
in the source, and preserves original page numbers in multi-image ZIP names
(`page-0001.png`, `page-0005.png`). A single selected page saves one image.
In a batch the same range applies to each PDF, and missing pages fail that file.

Selected pages count against the aggregate rendering pixel budget. Whole-document
page-count and embedded-image safety preflight still apply: selecting one page is
not a way to bypass source validation. Each canvas is bounded to 25 megapixels,
total decoded pixels to one billion, output to 256 MB and elapsed processing to
two minutes. Large conversions should be split into smaller selections. A child
process/heap limit is not an OS sandbox or a complete native-memory limit.

Regression fixtures verify cropped/rotated geometry, known colours, source order,
original page labels, selected pixel budgets, bounds, malformed/oversized images
and cancellation. OCR still defaults to all pages with its lower limits. The UI
tests verify range/quality submission and malformed-range rejection. The isolated
pack verifier checks output ZIP membership and decoded dimensions.

This closes basic range/quality controls, not full Web renderer parity. Visual
thumbnail selection, photographic equal-quality comparisons, complex profiles,
forms/annotations fidelity and platform-native testing remain pending.
