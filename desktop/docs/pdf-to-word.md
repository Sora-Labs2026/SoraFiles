# Desktop PDF-to-Word

This initial port produces editable DOCX paragraphs from selectable PDF text.
It keeps source page breaks and offers left-to-right/right-to-left paragraph
direction. It uses the existing Web text-grouping helper, generated at packaging
time by `sync-pdf-text.mjs`, and the installed MIT-licensed `docx` 9.7.1 library.
No additional package was fetched.

Images, annotations, forms, links, signatures and original visual layout are not
copied. Spacing and table alignment need review. Each page must contain selectable
text; a blank or scanned page fails the whole file to prevent silent omission
from mixed documents. OCR-assisted conversion and visual reconstruction remain
unfinished. The existing independent OCR tool can export recognized text/PDF.

Limits: unencrypted PDFs up to 64 MB and 60 pages, 10,000 text items per page,
100,000 total items, four million characters, 64 MB output, a 512 MB worker heap
and a two-minute deadline. Worker cancellation is supported; the normal offline
entitlement, sequential batch and no-overwrite output boundaries apply.

Tests independently read DOCX ZIP/XML, compare source text through PDF.js,
verify literal XML-sensitive characters and source page breaks, and reject active
links/fields or embedded macros. Blank/mixed, malformed, encrypted, excessive-page
and cancelled inputs are refused. Licensed batch/collision/source-preservation
tests pass. This is scoped text-conversion evidence, not Word application or
full-layout fidelity certification.
