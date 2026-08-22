// Extra tools engine — 100% client-side. No file ever leaves the browser.
import { safeOutputStem } from '../utils/filename.ts';
import { createLocalOcrEngine } from '../lib/ocr/local-engine.ts';
// protect/unlock : real AES-256 encryption via @pdfsmaller (PDF 2.0 standard)
// repair         : lenient pdf-lib re-save
// metadata       : strip PDF Info + XMP, strip image EXIF via canvas re-encode
// excel<->pdf     : SheetJS (xlsx) + pdf-lib table render / pdf.js text extract
// ocr            : tesseract.js (runs in a Web Worker)
import { PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
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
// Metadata remover — PDFs (Info + XMP) and images (EXIF/GPS via re-encode).
// ----------------------------------------------------------------------------
async function stripImageMeta(file) {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error("badImage"));
            i.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const png = /\.png$/i.test(file.name) || file.type === "image/png";
        const type = png ? "image/png" : "image/jpeg";
        const blob = await new Promise((res) => canvas.toBlob(res, type, png ? undefined : 0.92));
        return { blob, ext: png ? "png" : "jpg" };
    } finally {
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
}

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
            results.push({ name: `${baseName(file.name)}-clean.pdf`, blob: pdfBlob(out) });
        } else {
            const { blob, ext } = await stripImageMeta(file);
            if (!blob) throw new Error("badImage");
            results.push({ name: `${baseName(file.name)}-clean.${ext}`, blob });
        }
        prog?.(idx + 1, files.length);
    }
    return results;
}

// ----------------------------------------------------------------------------
// Excel -> PDF — render each sheet as a paginated table.
// ----------------------------------------------------------------------------
function fitText(font, text, size, maxWidth) {
    let s = String(text ?? "");
    if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
    while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > maxWidth) s = s.slice(0, -1);
    return s + "…";
}

export async function excelToPdf(files, _opts, prog, ctrl) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(new Uint8Array(await files[0].arrayBuffer()), { type: "array" });
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const PAGE_W = 842; // A4 landscape
    const PAGE_H = 595;
    const MARGIN = 32;
    const ROW_H = 20;
    const FONT_SIZE = 9;
    const sheetNames = wb.SheetNames;

    for (let sIdx = 0; sIdx < sheetNames.length; sIdx++) {
        checkCancel(ctrl);
        const ws = wb.Sheets[sheetNames[sIdx]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
        if (!aoa.length) continue;
        const cols = Math.max(1, ...aoa.map((r) => r.length));
        const usableW = PAGE_W - MARGIN * 2;
        const colW = usableW / cols;

        let page = pdf.addPage([PAGE_W, PAGE_H]);
        let y = PAGE_H - MARGIN;

        // Sheet title
        page.drawText(fitText(bold, sheetNames[sIdx], 12, usableW), { x: MARGIN, y: y - 10, size: 12, font: bold, color: rgb(0.29, 0.16, 0.64) });
        y -= 28;

        for (let r = 0; r < aoa.length; r++) {
            if (y - ROW_H < MARGIN) {
                page = pdf.addPage([PAGE_W, PAGE_H]);
                y = PAGE_H - MARGIN;
            }
            const row = aoa[r];
            const isHeader = r === 0;
            if (isHeader) {
                page.drawRectangle({ x: MARGIN, y: y - ROW_H + 4, width: usableW, height: ROW_H, color: rgb(0.95, 0.94, 0.99) });
            }
            for (let c = 0; c < cols; c++) {
                const cx = MARGIN + c * colW + 4;
                const val = row[c];
                if (val !== "" && val != null) {
                    page.drawText(fitText(isHeader ? bold : font, val, FONT_SIZE, colW - 8), {
                        x: cx,
                        y: y - 13,
                        size: FONT_SIZE,
                        font: isHeader ? bold : font,
                        color: rgb(0.15, 0.17, 0.24),
                    });
                }
            }
            // horizontal separator
            page.drawLine({ start: { x: MARGIN, y: y - ROW_H + 4 }, end: { x: MARGIN + usableW, y: y - ROW_H + 4 }, thickness: 0.5, color: rgb(0.85, 0.86, 0.9) });
            y -= ROW_H;
        }
        prog?.(sIdx + 1, sheetNames.length);
    }
    if (pdf.getPageCount() === 0) throw new Error("badExcel");
    const out = await pdf.save();
    return [{ name: `${baseName(files[0].name)}.pdf`, blob: pdfBlob(out) }];
}

// ----------------------------------------------------------------------------
// PDF -> Excel — extract text into a sheet per page (best-effort tables).
// ----------------------------------------------------------------------------
export async function pdfToExcel(files, _opts, prog, ctrl) {
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
    return [{ name: `${baseName(files[0].name)}.xlsx`, blob: new Blob([buf], { type: XLSX_MIME }) }];
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
