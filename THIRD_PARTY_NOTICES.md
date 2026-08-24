# Third-party notices

SoraFiles uses the following open-source libraries for local file processing. Complete license texts are included in each installed package and remain available from the linked source repositories.

## PDF.js

- Copyright Mozilla and PDF.js contributors
- License: Apache License 2.0
- Source: https://github.com/mozilla/pdf.js
- Use: parsing and rendering PDF pages in the browser

## pdf-lib

- Copyright Andrew Dillon and pdf-lib contributors
- License: MIT
- Source: https://github.com/Hopding/pdf-lib
- Use: assembling locally rendered pages into a new PDF

## heic-to

- Copyright Hopper Gee and contributors
- License: GNU Lesser General Public License v3.0
- Source: https://github.com/hoppergee/heic-to
- Use: browser HEIC/HEIF decoding and conversion

## libheif

- Copyright struktur AG and libheif contributors
- License: GNU Lesser General Public License v3.0
- Source: https://github.com/strukturag/libheif
- Use: HEIC/HEIF codec engine embedded by heic-to

## Mammoth.js

- Copyright Michael Williamson and contributors
- License: BSD 2-Clause
- Source: https://github.com/mwilliamson/mammoth.js
- Use: reading text from DOCX files in the browser

## docx

- Copyright Dolan Miu and contributors
- License: MIT
- Source: https://github.com/dolanmiu/docx
- Use: generating editable DOCX files from extracted PDF text

## jsPDF

- Copyright James Hall and jsPDF contributors
- License: MIT
- Source: https://github.com/parallax/jsPDF
- Use: creating text-first PDF files from DOCX content

## fflate

- Copyright Arjun Barrett and contributors
- License: MIT
- Source: https://github.com/101arrowz/fflate
- Use: creating local ZIP downloads and validating DOCX containers

## SheetJS Community Edition

- Copyright SheetJS LLC and contributors
- License: Apache License 2.0
- Source: https://git.sheetjs.com/sheetjs/sheetjs
- Use: optional best-effort editable PDF-text-to-XLSX extraction

## ZetaJS and ZetaOffice / LibreOffice WebAssembly

- ZetaJS copyright allotropia software GmbH and contributors
- ZetaJS license: MIT
- LibreOffice license: Mozilla Public License 2.0 / GNU Lesser General Public License 3.0 or later, as applicable to the distributed components
- Sources: https://github.com/allotropia/zetajs and https://git.libreoffice.org/core/
- Use: running LibreOffice locally in the browser for high-fidelity Word/Excel-to-PDF export

## IMG.LY Background Removal

- Copyright IMG.LY GmbH and contributors
- License: GNU Affero General Public License v3.0
- Source: https://github.com/imgly/background-removal-js
- Use: browser-local ISNet image matting and transparent PNG output

## ONNX Runtime Web

- Copyright Microsoft Corporation and contributors
- License: MIT
- Source: https://github.com/microsoft/onnxruntime
- Use: local CPU/WebAssembly or WebGPU inference for background removal

## Tesseract.js & Tesseract.js Core

- Copyright Jerome Wu and Tesseract.js contributors
- License: Apache License 2.0
- Source: https://github.com/naptha/tesseract.js
- Use: local browser Web Worker OCR execution for scanned PDF pages

## tessdata (tesseract.js-data)

- Copyright Tesseract OCR authors
- License: Apache License 2.0
- Source: https://github.com/tesseract-ocr/tessdata_best
- Use: self-hosted OCR trained-data language models for 19 locales

No third-party processing library receives SoraFiles user files over a network. These libraries execute as downloaded application code in the user's browser.
