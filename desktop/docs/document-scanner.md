# Document scanner: imported images

The local workflow combines 1–20 JPG/PNG/WebP images in selected order into one
image-only PDF. It reuses Web's scan filters (original, enhanced, colour,
grayscale, black-and-white, contrast and receipt), supports quarter-turn rotation,
and offers A4, Letter or image-sized pages. Outputs default beside the first
source and never overwrite originals or earlier results.

Camera capture, perspective correction, per-page edits and searchable text are
unfinished. The UI states these limits and asks users to review faint markings
after filtering. This is initial processing coverage, not complete scanner parity.

Limits: 64 MB/12 megapixels per image, 256 MB/60 megapixels together, 256 MB output,
20 pages and a three-minute worker deadline. The reused adaptive threshold uses a
32-bit summed-area table; the 12-megapixel cap keeps the maximum sum below 2^32.
Transparency is flattened onto white; source orientation is applied before
filtering. No camera access or file upload occurs.

The worker receives only bytes/options. Its image decoder is also a child process;
the Windows native host's Job Object owns the whole tree. Portable process-tree
cleanup remains a platform gate. JavaScript heap limits do not cap native memory.
Filtered images are embedded losslessly. The saved PDF is parsed before ordinary
license-gated, collision-safe publication.

Tests inspect rendered colours, page order, rotation, retained dark markings,
grayscale channels, page geometry, absence of searchable text, authorization,
source preservation, collisions, limits, malformed files and cancellation.
Broader real receipts, faint pencil, low-light and camera fixtures remain needed.
