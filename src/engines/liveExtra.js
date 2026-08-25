// Extra tools engine — 100% client-side. No file ever leaves the browser.
import { safeOutputStem } from '../utils/filename.ts';
import { createLocalOcrEngine } from '../lib/ocr/local-engine.ts';
import { stripImageMeta, stripOpenXmlMeta } from '../lib/metadata-strip.js';
// protect/unlock : real AES-256 encryption via @pdfsmaller (PDF 2.0 standard)
// repair         : lenient pdf-lib re-save
// metadata       : strip PDF Info/XMP and common image/Open XML metadata without changing content
// excel->pdf       : LibreOffice WebAssembly (lazy-loaded, browser-local)
// pdf->excel       : exact page visuals or optional best-effort editable extraction
// ocr            : tesseract.js (runs in a Web Worker)
import { PDFDocument, PDFName } from "pdf-lib";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export const baseName = (name) => safeOutputStem(name);

const pdfBlob = (bytes) => new Blob([bytes], { type: "application/pdf" });
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const checkCancel = (ctrl) => {
    if (ctrl?.cancelled || ctrl?.abortController?.signal?.aborted) {
        const e = new Error("cancelled");
        e.cancelled = true;
        throw e;
    }
};

const isPdfFile = (file) => /\.pdf$/i.test(file.name) || file.type === "application/pdf";

// Own pdf.js loader (worker configured) so this module is self-contained.
let pdfjsPromise;
async function getPdfjs() {
    if (!pdfjsPromise) {
        pdfjsPromise = import("pdfjs-dist").then((m) => {
            m.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
            return m;
        });
    }
    return pdfjsPromise;
}

// ----------------------------------------------------------------------------
// Protect PDF — add an open password (AES-256).
// ----------------------------------------------------------------------------
export async function protectPdf(files, opts) {
    const pw = String(opts?.password || "").trim();
    if (!pw) throw new Error("noPassword");
    const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt");
    const bytes = new Uint8Array(await files[0].arrayBuffer());
    // Ensure the input is a readable (unencrypted) PDF first.
    try {
        await PDFDocument.load(bytes);
    } catch (e) {
        throw new Error("alreadyEncrypted");
    }
    const encrypted = await encryptPDF(bytes, pw);
    return [{ name: `${baseName(files[0].name)}-protected.pdf`, blob: pdfBlob(encrypted) }];
}

// ----------------------------------------------------------------------------
// Unlock PDF — remove a known password / owner restrictions.
// ----------------------------------------------------------------------------
export async function unlockPdf(files, opts) {
    const pw = String(opts?.password || "").trim();
    const bytes = new Uint8Array(await files[0].arrayBuffer());

    // Detect whether the file is actually encrypted.
    let encrypted = false;
    try {
        await PDFDocument.load(bytes);
    } catch (e) {
        encrypted = /encrypt/i.test(e?.message || "");
        if (!encrypted) throw new Error("badPdf");
    }

    if (!encrypted) {
        // Not encrypted — just re-save (also clears light owner restrictions).
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const out = await doc.save();
        return [{ name: `${baseName(files[0].name)}-unlocked.pdf`, blob: pdfBlob(out) }];
    }

    const { decryptPDF } = await import("@pdfsmaller/pdf-decrypt");
    try {
        const dec = await decryptPDF(bytes, pw); // pw may be "" for owner-only locks
        return [{ name: `${baseName(files[0].name)}-unlocked.pdf`, blob: pdfBlob(dec) }];
    } catch (e) {
        throw new Error(pw ? "wrongPassword" : "needPassword");
    }
}

// ----------------------------------------------------------------------------
// Repair PDF — best-effort structural rebuild via a lenient re-save.
// ----------------------------------------------------------------------------
export async function repairPdf(files) {
    const bytes = new Uint8Array(await files[0].arrayBuffer());
    let doc;
    try {
        doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
    } catch (e) {
        doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    }
    const out = await doc.save({ useObjectStreams: false });
    return [{ name: `${baseName(files[0].name)}-repaired.pdf`, blob: pdfBlob(out) }];
}

// ----------------------------------------------------------------------------
// Metadata remover — PDFs, lossless JPG/PNG/WebP container cleanup, and Open XML.
// ----------------------------------------------------------------------------
export async function removeMetadata(files, _opts, prog, ctrl) {
    const results = [];
    for (let idx = 0; idx < files.length; idx++) {
        checkCancel(ctrl);
        const file = files[idx];
        if (isPdfFile(file)) {
            const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true, updateMetadata: false });
            doc.setTitle("");
            doc.setAuthor("");
            doc.setSubject("");
            doc.setKeywords([]);
            doc.setProducer("");
            doc.setCreator("");
            try {
                doc.setCreationDate(new Date(0));
                doc.setModificationDate(new Date(0));
            } catch (e) {
                /* some docs lack date entries */
            }
            // Remove the XMP metadata stream if present.
            try {
                doc.catalog.delete(PDFName.of("Metadata"));
            } catch (e) {
                /* no XMP present */
            }
            const out = await doc.save({ useObjectStreams: false });
            results.push({ name: `${baseName(file.name)}-clean.pdf`, blob: pdfBlob(out), detail: 'Removed PDF document information and XMP metadata. Page content was preserved.' });
        } else if (/\.(docx|xlsx|pptx)$/i.test(file.name)) {
            const cleaned = await stripOpenXmlMeta(file);
            results.push({ name: `${baseName(file.name)}-clean.${cleaned.ext}`, blob: cleaned.blob, detail: cleaned.detail });
        } else {
            const { blob, ext, detail } = await stripImageMeta(file);
            if (!blob) throw new Error("badImage");
            results.push({ name: `${baseName(file.name)}-clean.${ext}`, blob, detail });
        }
        prog?.(idx + 1, files.length);
    }
    return results;
}

// ----------------------------------------------------------------------------
// Excel -> PDF — export with LibreOffice Calc running locally in WebAssembly.
// ----------------------------------------------------------------------------
export async function excelToPdf(files, _opts, prog, ctrl) {
    checkCancel(ctrl);
    const { convertOfficeToPdf } = await import('../lib/office-wasm/client.ts');
    let out;
    try {
        out = await convertOfficeToPdf(files[0], 'calc', {
            signal: ctrl?.abortController?.signal,
            onProgress: (stage) => prog?.(stage === 'downloading-engine' ? 1 : stage === 'loading-document' ? 2 : 3, 4),
        });
    } catch (error) {
        if (error?.name === 'AbortError') throw new Error('cancelled');
        if (error?.message === 'officeIsolation') throw new Error('officeIsolation');
        throw new Error('officeFailed');
    }
    checkCancel(ctrl);
    const verified = await PDFDocument.load(out, { ignoreEncryption: true });
    if (!verified.getPageCount()) throw new Error('officeFailed');
    prog?.(4, 4);
    return [{
        name: `${baseName(files[0].name)}.pdf`,
        blob: pdfBlob(out),
    }];
}

// ----------------------------------------------------------------------------
// PDF -> Excel — exact page visuals by default; editable extraction is explicit.
// ----------------------------------------------------------------------------
async function pdfToEditableExcel(files, _opts, prog, ctrl) {
    const XLSX = await import("xlsx");
    const pdfjs = await getPdfjs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await files[0].arrayBuffer()) }).promise;
    const wb = XLSX.utils.book_new();
    let anyRows = false;
    try {
        for (let p = 1; p <= doc.numPages; p++) {
            checkCancel(ctrl);
            const page = await doc.getPage(p);
            const tc = await page.getTextContent();
            const rowsMap = new Map();
            for (const it of tc.items) {
                const str = (it.str || "").trim();
                if (!str) continue;
                const y = Math.round(it.transform[5]);
                const x = it.transform[4];
                if (!rowsMap.has(y)) rowsMap.set(y, []);
                rowsMap.get(y).push({ x, s: it.str });
            }
            const ys = [...rowsMap.keys()].sort((a, b) => b - a);
            const aoa = ys.map((y) => rowsMap.get(y).sort((a, b) => a.x - b.x).map((c) => c.s));
            if (aoa.length) anyRows = true;
            const ws = XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [[""]]);
            XLSX.utils.book_append_sheet(wb, ws, `Page ${p}`.slice(0, 31));
            prog?.(p, doc.numPages);
        }
    } finally {
        doc.destroy?.();
    }
    if (!anyRows) throw new Error("noText");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return [{
        name: `${baseName(files[0].name)}-editable.xlsx`,
        blob: new Blob([buf], { type: XLSX_MIME }),
    }];
}

export async function pdfToExcel(files, opts, prog, ctrl) {
    if (opts?.spreadsheetMode === 'editable') return pdfToEditableExcel(files, opts, prog, ctrl);
    const pdfjs = await getPdfjs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await files[0].arrayBuffer()) }).promise;
    const pages = [];
    try {
        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
            checkCancel(ctrl);
            const page = await doc.getPage(pageNumber);
            const base = page.getViewport({ scale: 1 });
            const scale = Math.max(1, Math.min(2, Math.sqrt(16_000_000 / Math.max(1, base.width * base.height))));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.ceil(viewport.width));
            canvas.height = Math.max(1, Math.ceil(viewport.height));
            const context = canvas.getContext('2d', { alpha: false });
            if (!context) throw new Error('officeFailed');
            context.fillStyle = '#fff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvas, canvasContext: context, viewport, background: '#fff', intent: 'display' }).promise;
            const pngBlob = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('officeFailed')), 'image/png'));
            pages.push({
                png: new Uint8Array(await pngBlob.arrayBuffer()),
                widthPixels: canvas.width,
                heightPixels: canvas.height,
                pageNumber,
            });
            page.cleanup();
            canvas.width = 1;
            canvas.height = 1;
            prog?.(pageNumber, doc.numPages + 1);
        }
    } finally {
        doc.destroy?.();
    }
    checkCancel(ctrl);
    const { createVisualWorkbook } = await import('../lib/pdf-to-excel/visual-workbook.ts');
    const blob = createVisualWorkbook(pages);
    prog?.(doc.numPages + 1, doc.numPages + 1);
    return [{
        name: `${baseName(files[0].name)}.xlsx`,
        blob,
    }];
}

// ----------------------------------------------------------------------------
// OCR — recognize text from images or scanned PDFs (tesseract.js).
// ----------------------------------------------------------------------------
export async function ocr(files, opts, prog, ctrl) {
    const lang = opts?.lang || "eng";
    let engine;
    try {
        engine = await createLocalOcrEngine(lang, () => {});
        checkCancel(ctrl);
    } catch (e) {
        if (ctrl?.cancelled || e?.name === 'AbortError') throw new Error('cancelled');
        throw new Error("ocrFailed");
    }
    try {
        const results = [];
        const signal = ctrl?.abortController?.signal ?? new AbortController().signal;
        // rough total for progress: sum of pages/images
        for (let i = 0; i < files.length; i++) {
            checkCancel(ctrl);
            const file = files[i];
            let text = "";
            if (isPdfFile(file)) {
                const pdfjs = await getPdfjs();
                const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
                try {
                    for (let p = 1; p <= doc.numPages; p++) {
                        checkCancel(ctrl);
                        const page = await doc.getPage(p);
                        const viewport = page.getViewport({ scale: 2 });
                        const canvas = document.createElement("canvas");
                        canvas.width = Math.ceil(viewport.width);
                        canvas.height = Math.ceil(viewport.height);
                        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
                        const recognized = await engine.recognize(canvas, signal);
                        text += `----- Page ${p} -----\n${recognized.text}\n\n`;
                        canvas.width = 1;
                        canvas.height = 1;
                        prog?.(p, doc.numPages);
                    }
                } finally {
                    doc.destroy?.();
                }
            } else {
                const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const context = canvas.getContext('2d');
                if (!context) { bitmap.close(); throw new Error('ocrFailed'); }
                context.drawImage(bitmap, 0, 0);
                bitmap.close();
                const recognized = await engine.recognize(canvas, signal);
                text += recognized.text;
                canvas.width = 1;
                canvas.height = 1;
                prog?.(i + 1, files.length);
            }
            results.push({ name: `${baseName(file.name)}.txt`, blob: new Blob([text], { type: "text/plain;charset=utf-8" }) });
        }
        return results;
    } catch (e) {
        if (e?.cancelled || e?.name === 'AbortError' || ctrl?.cancelled) throw new Error('cancelled');
        throw new Error("ocrFailed");
    } finally {
        try {
            await engine.terminate();
        } catch (e) {
            /* ignore */
        }
    }
}
