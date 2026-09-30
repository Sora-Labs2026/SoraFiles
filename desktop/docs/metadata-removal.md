# Desktop metadata removal

The port accepts unencrypted PDFs, still JPEG, PNG and WebP images, and unsigned
DOCX/XLSX/PPTX documents without macros, up to 64 MB per file.
Animated/multipage images are not supported. It processes selected files sequentially with the same
offline entitlement checks, separate outputs and collision handling as other
Desktop tools. Unsupported files fail individually within a batch.

PDF processing removes the trailer Info dictionary and Metadata entries,
including document/page XMP. It then removes unreachable objects so detached
metadata streams are not simply left in the rewritten PDF. Objects still used
by content remain. It checks page count and metadata absence after serialization.
Tests inspect independent PDF.js text/properties/attachments plus the serialized
object graph. Existing encrypted PDFs are refused: this tool cannot remove PDF
password protection.

Still sRGB images without an ICC profile or orientation transform now reuse the
actual Web segment/chunk metadata removal code. Both source and result are
decoded and compared exactly; a result is accepted without re-encoding only when
pixels/dimensions/format match and checked metadata fields are absent. Encoded
image data stays intact in this path, including JPEG/WebP. Clean images are
idempotent. `sync-image-metadata.mjs` generates only the Web image subset; no
Office extraction or dependency is pulled into this path.

Images needing camera orientation, colour-profile conversion or unsupported
metadata layouts keep the existing re-encoding path: orient, convert to sRGB,
strip EXIF/XMP/IPTC/ICC, then decode and inspect output. PNG is lossless for the
tested converted pixels; JPEG/WebP quality 95 can change appearance/quality.
Saved-result warnings say whether that particular image was re-encoded.
No universal byte-preserving or lossless cleanup claim is made.

The regression fixture compares JPEG/PNG/WebP output byte-for-byte with actual
Web code and independently verifies decoded colour/alpha preservation, input
preservation and repeat cleanup. Existing orientation, PDF, encrypted, malformed,
animated and cancelled-input coverage remains. The browser parity runner also
executes the Web source in Chrome; evidence is recorded separately.

This is metadata cleanup, not anonymization or redaction. Visible content, PDF
annotations, forms, attachments and other structures can still contain personal
information. PDF rewriting may invalidate digital signatures. These limits are
shown before processing and included in saved-result warnings.

A separate on-demand process limits heap, input/output size and elapsed time.
Cancellation terminates it. This is not an OS security sandbox.
Redistribution/source obligations remain release gates.

## September 23 Office-container extension

`metadata-office.mjs` inspects ZIP central/local headers before extraction, checks
CRC and actual inflated lengths, and caps entries (4,096), each expanded entry
(32 MiB), total expanded bytes (128 MiB) and inspected XML (2 MiB per part).
Paths, duplicates, UTF-8, overlapping entries, encryption and ZIP64 are checked or
refused. No archive files are extracted to disk. Native zlib limits actual output,
including archives that lie about sizes; processing stays in the bounded worker.

The output type comes from OOXML content types and the root document relationship,
not the input filename. Signed/macro/ActiveX containers, ambiguous document types,
relocated property parts and malformed property/relationship XML fail closed.
DTD/entity declarations are refused. The existing MIT `@xmldom/xmldom` 0.8.15 is
now an explicit pinned dependency and included in the runtime package with its
license; no package was downloaded. Namespace-aware removal handles aliases and
nested property values. Non-property entries are retained byte-for-byte after
decompression; ZIP bytes/timestamps and property XML serialization can differ.

The removed property scope matches the Web implementation: standard author/title/
dates and related core fields, company/manager/hyperlink base, and custom properties.
Comments, tracked changes, document text, embedded files, thumbnails and unrelated
XML remain; this is not comprehensive anonymization. Unused content-type defaults
do not make an ordinary SheetJS XLSX macro-enabled: dangerous effective types are
checked against actual entries. Strict/legacy/relocated Office layouts outside
this tested scope may be refused.

Source tests compare all three formats to actual Web cleanup at the metadata DOM
level, preserve every other entry, and independently reopen generated Word/XLSX
fixtures. Workbook values and formulas survive. These are Node tests of Web source,
not an Office desktop application's rendering or full browser parity certificate.
Host tests cover offline grants, source preservation, inferred extensions and
collision naming. Synthetic fixtures are authored in the repository. PPTX native
classification, publication and output registration are connected separately.
