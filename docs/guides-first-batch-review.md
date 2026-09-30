# First Guides batch — 2026-09-10

The site owner explicitly commissioned research, creation, validation, and publication of these six English articles. This scoped authorization supersedes the earlier no-articles restriction and the default editorial-policy approval gate for this batch only. Drafting and source/code review were AI-assisted; no individual human reviewer or independent certification is claimed. Sora Labs is the organizational author and publisher. Publication is dated September 10, 2026; no fabricated review or update dates are used.

## Intent review

All six titles, slugs, primary queries, headings and canonical URLs were compared against the 26 tool registry entries and one another. Headings explain concepts and decision criteria; tool links retain the action-oriented destinations. No exact transactional-intent duplicates were found. Automated guide/cannibalization validation returned six records, zero errors and zero warnings before enabling publication.

| Guide slug | Informational focus | Transactional destination |
|---|---|---|
| what-local-file-processing-means | Where processing occurs and what locality does not guarantee | /tools, /pdf, /image-converter |
| pdf-compression-quality-vs-file-size | Quality, resolution, and size tradeoffs | /pdf |
| why-pdf-to-word-formatting-changes | Reasons for layout changes; visual versus editable output | /pdf-to-word |
| jpg-vs-png-vs-webp | Format selection and compatibility | /image-converter |
| remove-metadata-before-sharing-files | Metadata scope versus visible redaction | /metadata-remover |
| scanned-pdf-vs-searchable-pdf | Page images, native text, and OCR layers | /pdf-ocr |

## Evidence and claim boundaries

Current deployed Guides, relevant English tool pages, About, Privacy, Open Source, and Terms were read alongside the repository. Saved page evidence is under `.artifacts/astra-guide-evidence`. Search-result snapshots were stale and were not treated as current implementation evidence.

- Local processing: File API, object URLs, WebAssembly and service-worker documentation from MDN; source and Privacy disclosures distinguish file processing from resource downloads, aggregate usage events and contact submission. Local processing is not described as independent security proof.
- Compression: Adobe optimizer settings and the JPEG standards overview support the general explanation. `PdfWorkbench.astro` and the compression worker establish structural-first processing, eligibility checks for image compression, original-file fallback and signed-file handling. Obsolete English flattened-mode copy was corrected.
- Word: Microsoft’s PDF conversion explanation and WordprocessingML documentation, plus Adobe font documentation. Current conversion code and UI offer editable reconstruction and visual page images. English explanatory copy was updated to cover both modes. Other locales still contain legacy visual-only explanations and need a separate translation review; the guide does not repeat those claims.
- Images: MDN, W3C PNG third edition, Google WebP documentation and the JPEG standards overview. Format capabilities are distinguished from the converter’s selected-frame/page exports. No compatibility percentages or universal size advantage are claimed.
- Metadata: CIPA Exif overview, Adobe PDF properties and W3C PNG documentation, checked against `metadata-strip.js` and `liveExtra.js`. PDF dates are reset rather than deleted; custom metadata and visible/embedded content are outside a universal wipe claim. JPEG orientation removal can affect display.
- OCR: Adobe OCR documentation and Tesseract quality/FAQ pages, checked against the current OCR engine. The searchable-PDF exporter uses restricted Latin text encoding and does not align hidden text word by word. The guide prominently explains these limitations and recommends checking TXT output when needed. Recognition is not described as perfect, structured, or automatically accessible.

Every guide has an immediate answer, useful comparison table, concrete example, limitations, contextual internal links, and primary-source references. References are original source links, not copied competitor content. No keyword volumes, rankings, test statistics, authors, or SEO gains were invented.

## Publication checks

The production build validates guide records, unique metadata, canonicals, sitemap inclusion, schema and indexability. `tests/e2e/guides-published.mjs` checks all six articles and the hub at 1147px and 320px, including dark mode, bounded horizontally scrollable tables, heading positioning, Article/Breadcrumb data, dates, real tool relationships, internal link status, and hero icon clarity. Screenshots are retained for visual review. The hub is indexable only when published indexable records exist. No translated guide routes or hreflang entries are created.

Live deployment, crawl and final test results are recorded in `tool-verification-report.md`. External ranking, Ahrefs and AI citation changes require later independent observation.
