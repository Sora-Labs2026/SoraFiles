# Desktop PDF-to-Excel

The first port extracts tables from selectable PDF text into editable XLSX cells.
It reuses the web table-position algorithm through a generated JavaScript module.
`sync-pdf-tables.mjs` regenerates it during packaging. The shared function's new
`preserveText` option is opt-in; existing Web numeric/date conversion is unchanged.

Desktop keeps every value as text. Leading zeros, dates, currency notation and
strings beginning with `=`, `+`, `-` or `@` remain literal; no formula or hyperlink
is created. Each detected table gets a worksheet identified by source page.
Pages without tables are skipped with a count in the result warning. A PDF with
no detected tables fails without publishing an empty workbook.

Limits: 64 MB input/output, 100 pages and sheets, 100,000 cells/text items in
total, 10,000 text items on one page, 4 million source characters and a two-minute
worker deadline. A separate process bounds heap and supports cancellation;
this is not an OS sandbox. Encrypted PDFs, including owner-password-only sources,
are refused. Scanned tables, OCR-assisted extraction, visual page worksheets,
merged-cell fidelity and arbitrary layouts remain unfinished.

The worker validates cells after writing/reopening the workbook. Tests separately
inspect the ZIP/XML for literal cells and absence of formulas/external links,
exercise real licensed batches/collisions and preserve originals. Review extracted
rows and columns before relying on the data. No superiority over Web is claimed.

Packaging includes the existing Apache-2.0 SheetJS 0.20.3 dependency and its notice.
Full dependency/source/provenance clearance remains a release gate.
