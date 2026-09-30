# Desktop structural PDF compression

This first compression workflow uses the installed qpdf WASM 12.2.0 engine from
`@neslinesli93/qpdf-wasm` 0.3.0. It compresses object/Flate streams without image
downsampling or lossy image recompression. There are no target-size or quality
profiles yet. If optimization is not smaller, the exact original bytes are saved
as a new unchanged copy with an explicit warning. Originals are never overwritten.

Limits: 64 MB input/output, 1000 pages, separate worker with a two-minute deadline
and 512 MB JavaScript heap. Encrypted PDFs and detected signature dictionaries
are rejected; no password-removal path is offered. A nonzero qpdf result, including
warning status, fails the file. The result is reparsed and page count, media/crop
boxes and rotation are checked. Full engine containment remains separate work.

Tests compare independently rendered pixels before/after, extracted text, form
values, attachments, metadata, source preservation and size reduction. They also
cover unchanged output, encrypted/signed/malformed/over-limit input, cancellation
and ordinary offline entitlement/batch handling. This does not promise every
document-level feature survives or that every PDF shrinks.

The npm wrapper declares ISC, but the runtime's `--copyright` identifies qpdf
itself as Apache-2.0 with Jay Berkenbilt/Manfred Holger copyright. Both layers
must be represented in notices; exact WASM source/build provenance remains a
release gate. No Ghostscript compression component was added to this workflow.
