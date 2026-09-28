# SoraFiles Tool Copy Simplification

Audit date: 2026-09-01

The copy pass preserves technical capability while moving implementation details out of normal workflow text.

| Area | Before | After |
|---|---|---|
| Compress PDF helper | “Optimizes PDF structure… Image downsampling…” | “Reduces the file size without changing page content or dimensions… automatically uses a safer method.” |
| Compress PDF profile | “Strong · 180 DPI · SSIM floor 0.980” | “Strong · Smaller file with clear text and images.” |
| Compress PDF result | Named optimizer/recompression paths and raw similarity score | Actual bytes/reduction plus “PDF safely optimized,” “original retained,” or a plain safety explanation |
| Compress Image processing | Encoder and SSIM validation language | “Compressing image” / “Checking image quality” |
| Compress Image result | Codec names and quality score | Lossless/transparency/dimensions outcome and actual reduction |
| PDF OCR | “Loading local OCR model” / “Low confidence … 63%” | “Preparing text recognition” / “Page … may contain recognition mistakes” |
| PDF to Word | “Extract native objects and reconstruct…” | “Turn PDF text into editable paragraphs…” or “Keep the page appearance” |
| Repair PDF | Parser pass, object recovery, visual salvage | “Try to fix a PDF that will not open” and a page/feature recovery summary |
| Metadata Remover | EXIF/XMP/IPTC/chunks | “Hidden file details” such as author, device, dates, and location |
| PDF to Excel | Inferred table regions and ISO dates | “Find tables and place their values into editable spreadsheet cells” |
| Remove Background | AI matting engine/model download | “Preparing background removal” / “Removing the background” |
| Protect PDF | AES implementation label | “Add a password to your PDF” |
| Unlock PDF | Decrypt/encryption wording | “Remove the password from a PDF you are authorized to unlock” |
| Doc Scanner | Local engine / perspective-processing implication | “Straighten the page and make the scan easier to read” / “Save scan” |
| Generic buttons | Process locally / Start / Apply | Compress PDF, Merge PDFs, Split PDF, Add watermark, Add signature, Convert to Excel, Run OCR, Resize image, Save scan, etc. |

## Necessary limitations retained

- Strong PDF compression may make text non-selectable and can remove links, forms, signatures, bookmarks, or accessibility information.
- Visual Word/PDF modes preserve appearance but may not keep text editable/selectable.
- JPG cannot preserve transparency; the user must confirm a white background or choose PNG/WebP.
- Recognition accuracy depends on scan quality, language, handwriting, and layout.
- Repair is best effort; damaged interactive features may remain incomplete.
- Spreadsheet conversions require review for complex tables, merged cells, fonts, and page breaks.
- Visible PDF signatures are not certificate-backed identity verification.
- PDF reader permission choices may not prevent every workaround.

## Intentionally retained technical terms

- **PDF, JPG, PNG, WebP, HEIC/HEIF, TIFF, DOCX, XLSX, ZIP:** file-format choices users must identify.
- **OCR:** retained in tool names and compact labels because it is a common document feature; explanatory text says “text recognition.”
- **DPI:** retained only in PDF-to-image resolution controls/results, where the user directly chooses output resolution.
- **Pixels, width, height, dimensions, megapixels, KB/MB:** needed for exact resize, size, and device-safety decisions.
- **AES, SSIM, QFactor, codec, WASM, worker, parser, object stream, downsampling, EXIF/XMP:** remain only in internal code/tests or the dedicated Open Source information page, not the normal English tool workflow.
