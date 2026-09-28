# SoraFiles V6 Engine License Matrix

Verified on 2026-08-30 from installed package metadata/license files and the named projects' upstream repositories. SoraFiles is AGPL-3.0-only; copyleft candidates are not automatically incompatible, but their complete distribution/source obligations and embedded third-party notices must remain satisfied.

| Engine / artifact | Version evaluated | License | Upstream evidence | Decision / obligation |
|---|---:|---|---|---|
| pdf-lib | 1.17.1 | MIT | [pdf-lib repository](https://github.com/Hopding/pdf-lib) | Current; retain MIT notice. |
| PDF.js | 6.2.108 | Apache-2.0 | [Mozilla PDF.js](https://github.com/mozilla/pdf.js) | Current; retain Apache notice. |
| `@pdfsmaller/pdf-encrypt` / decrypt | 1.2.0 / 1.0.1 | MIT | Installed package metadata | Current; retain MIT notices. |
| qpdf | 12.2.0 embedded in wrapper | Apache-2.0 | [qpdf](https://github.com/qpdf/qpdf) | Compatible candidate; rejected on benchmark, not shipped. |
| `@neslinesli93/qpdf-wasm` | 0.3.0 | ISC | [qpdf-wasm wrapper](https://github.com/neslinesli93/qpdf-wasm) | Compatible wrapper; rejected, not shipped. |
| pdfcpu | current upstream candidate | Apache-2.0 | [pdfcpu](https://github.com/pdfcpu/pdfcpu) | Compatible source project; no maintained official browser artifact qualified, not shipped. |
| Ghostscript | upstream candidate | AGPL-3.0-or-later / commercial | [GhostPDL license](https://github.com/ArtifexSoftware/ghostpdl/blob/master/LICENSE) | Copyleft-compatible in principle only with full obligations; no adopted browser runtime. |
| MuPDF / MuPDF.js | upstream candidate | AGPL / commercial | [official MuPDF.js](https://github.com/ArtifexSoftware/mupdf.js) | Sensitive copyleft/commercial dual license; no adopted runtime. |
| Scribe.js | 0.14.6 | AGPL-3.0 | [Scribe.js](https://github.com/scribeocr/scribe.js) | Compatible with AGPL distribution obligations; rejected on accuracy/runtime/export benchmark. |
| PaddleOCR / PaddleOCR.js | 0.4.2 SDK | Apache-2.0 | [official PaddleOCR browser SDK](https://github.com/PaddlePaddle/PaddleOCR/tree/main/paddleocr-js) | Compatible; rejected on transfer/runtime/accuracy tradeoff. Models tested from official project assets. |
| Tesseract.js | 7.0.0 | Apache-2.0 | [Tesseract.js](https://github.com/naptha/tesseract.js) | Current OCR; self-hosted model notices must remain. |
| jSquash core/codecs | JPEG 1.6.0; OxiPNG 2.3.0; resize 2.1.1 | Apache-2.0 | [jSquash](https://github.com/jamsinclair/jSquash) | Current/adopted; retain Apache and codec notices. |
| OxiPNG upstream codec | wrapper 2.3.0 | MIT upstream; Apache-2.0 wrapper | [OxiPNG](https://github.com/oxipng/oxipng) | Adopted via jSquash; retain both applicable notices. |
| heic-to / libheif | 1.5.2 | LGPL-3.0 wrapper/package | [heic-to](https://github.com/hoppergee/heic-to) | Current. Preserve LGPL notices, source/relinking obligations, and libheif codec notices. |
| IMG.LY background removal | 1.7.0 | AGPL (package points to bundled license) | [IMG.LY background-removal-js](https://github.com/imgly/background-removal-js) | Current and compatible with AGPL SoraFiles; keep source/notice obligations. |
| Scanic | 1.6.0 | MIT | [Scanic](https://github.com/marquaye/scanic) | Current scanner; retain MIT notice. |
| Nitidoc | upstream candidate | AGPL-3.0-or-later | [Nitidoc](https://github.com/santiagoisra/nitidoc) | Compatible subject to AGPL obligations; rejected for runtime/no proven material win. |
| ZetaJS | 1.2.0 | MIT | [ZetaJS](https://github.com/allotropia/zetajs) | Current LibreOffice WASM bridge; retain MIT notice. |
| LibreOffice WASM | repository-synced runtime | MPL-2.0 / LGPLv3+ project terms and component notices | [LibreOffice WASM build documentation](https://github.com/LibreOffice/core/blob/master/static/README.wasm.md) | Current Office engine; preserve source/license/notice obligations for shipped runtime. |
| BentoPDF | upstream reference | AGPL / commercial | [BentoPDF](https://github.com/alam00000/bentopdf) | Its Office path is a LibreOffice WASM integration reference, not an adopted distinct engine. |
| Pagelea | upstream UI reference | AGPL-3.0-or-later | [Pagelea](https://github.com/inochisrl/pagelea.com) | Reference only; no copied engine/runtime. |
| Unfleece | named upstream candidate | Not conclusively verified | No stable official browser package/repository was identifiable within the locked search | **UNAVAILABLE / NOT SHIPPED**. No code copied and no license assumption made. |

## Integration conclusion

The only new shipped packages are `@jsquash/jpeg` and `@jsquash/oxipng`, both Apache-2.0 wrappers in the existing jSquash family. No rejected candidate was copied into the application. Unfleece remains explicitly unresolved and therefore cannot be integrated.
