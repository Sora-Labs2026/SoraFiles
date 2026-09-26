// Extra tools engine — browser-local file processing. No selected file is uploaded.
import { safeOutputStem } from '../utils/filename.ts';
import { createLocalOcrEngine } from '../lib/ocr/local-engine.ts';
import { stripImageMeta, stripOpenXmlMeta } from '../lib/metadata-strip.js';
// protect/unlock : real AES-256 encryption via @pdfsmaller (PDF 2.0 standard)
// repair         : normal parse, lenient structural rewrite, then visual page salvage
// metadata       : strip PDF Info/XMP and common image/Open XML metadata without changing content
// excel->pdf       : LibreOffice WebAssembly (lazy-loaded, browser-local)
// pdf->excel       : inferred editable tables or optional page-visual worksheets
// ocr            : tesseract.js (runs in a Web Worker)
import { PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { loadPdfJs } from "../lib/pdfjsRuntime";

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
        pdfjsPromise = loadPdfJs();
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
    const encrypted = await encryptPDF(bytes, pw, {
        ownerPassword: String(opts?.ownerPassword || '') || pw,
        algorithm: 'AES-256',
        allowPrinting: opts?.allowPrinting !== false,
        allowCopying: opts?.allowCopying !== false,
        allowModifying: opts?.allowModifying !== false,
    });
    return [{ name: `${baseName(files[0].name)}-protected.pdf`, blob: pdfBlob(encrypted) }];
}

// ----------------------------------------------------------------------------
// Unlock PDF — remove a known password / owner restrictions.
// ----------------------------------------------------------------------------
export async function unlockPdf(files, opts) {
    const pw = String(opts?.password || "").trim();
    const { decryptPDF } = await import("@pdfsmaller/pdf-decrypt");
    const results = [];
    for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let encrypted = false;
        try { await PDFDocument.load(bytes); }
        catch (e) { encrypted = /encrypt/i.test(e?.message || ""); if (!encrypted) throw new Error("badPdf"); }
        if (!encrypted) {
            const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
            results.push({ name: `${baseName(file.name)}-unlocked.pdf`, blob: pdfBlob(await doc.save()), detail: 'This PDF did not need an open password. Available editing restrictions were removed.' });
            continue;
        }
        try {
            const dec = await decryptPDF(bytes, pw);
            results.push({ name: `${baseName(file.name)}-unlocked.pdf`, blob: pdfBlob(dec), detail: 'Password removed. Reader restrictions were removed where possible.' });
        } catch (e) {
            throw new Error(pw ? "wrongPassword" : "needPassword");
        }
    }
    return results;
}

// ----------------------------------------------------------------------------
// Repair PDF — multi-pass structural rebuild with last-chance visual page salvage.
// ----------------------------------------------------------------------------
export async function repairPdf(files, _opts, prog, ctrl) {
    const bytes = new Uint8Array(await files[0].arrayBuffer());
    let doc = null;
    try {
        doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    } catch {
        try {
            doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
        } catch {
            doc = null;
        }
    }
    if (doc) {
        checkCancel(ctrl);
        const pageCount = doc.getPageCount();
        const out = await doc.save({ useObjectStreams: false, addDefaultPage: false });
        const verified = await PDFDocument.load(out, { ignoreEncryption: true, updateMetadata: false });
        if (verified.getPageCount() !== pageCount) throw new Error('badPdf');
        prog?.(pageCount, pageCount);
        return [{
            name: `${baseName(files[0].name)}-repaired.pdf`,
            blob: pdfBlob(out),
            detail: `${pageCount} page${pageCount === 1 ? '' : 's'} recovered. Damaged forms, links, bookmarks, signatures, or hidden file details may still be incomplete.`,
        }];
    }

    const pdfjs = await getPdfjs();
    let source;
    try {
        source = await pdfjs.getDocument({ data: bytes.slice(), stopAtErrors: false }).promise;
    } catch {
        throw new Error('badPdf');
    }
    const salvaged = await PDFDocument.create();
    let recovered = 0;
    let skipped = 0;
    try {
        for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber++) {
            checkCancel(ctrl);
            try {
                const page = await source.getPage(pageNumber);
                const base = page.getViewport({ scale: 1 });
                const scale = Math.min(2, Math.sqrt(12_000_000 / Math.max(1, base.width * base.height)));
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.ceil(viewport.width));
                canvas.height = Math.max(1, Math.ceil(viewport.height));
                const context = canvas.getContext('2d', { alpha: false });
                if (!context) throw new Error('canvas');
                context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
                await page.render({ canvas, canvasContext: context, viewport, background: '#fff', intent: 'display' }).promise;
                const imageBlob = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('canvas')), 'image/jpeg', .94));
                const image = await salvaged.embedJpg(await imageBlob.arrayBuffer());
                const outputPage = salvaged.addPage([base.width, base.height]);
                outputPage.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
                recovered += 1;
                canvas.width = 1; canvas.height = 1;
                page.cleanup();
            } catch {
                skipped += 1;
            }
            prog?.(pageNumber, source.numPages);
        }
    } finally {
        source.destroy?.();
    }
    if (!recovered) throw new Error('badPdf');
    const out = await salvaged.save({ useObjectStreams: true, addDefaultPage: false });
    return [{
        name: `${baseName(files[0].name)}-salvaged.pdf`,
        blob: pdfBlob(out),
        detail: `${recovered} page${recovered === 1 ? '' : 's'} recovered as page images; ${skipped} skipped. Text selection, forms, links, bookmarks, signatures, and hidden file details could not be restored.`,
    }];
}

// ----------------------------------------------------------------------------
// Metadata remover — PDFs, lossless JPG/PNG/WebP container cleanup, and Open XML.
// ----------------------------------------------------------------------------
export async function removeMetadata(files, opts, prog, ctrl) {
    const results = [];
    const requested = new Set(opts?.metadataMode === 'selective' ? opts?.metadataCategories || [] : ['title', 'author', 'subject', 'keywords', 'creator', 'dates', 'xmp']);
    for (let idx = 0; idx < files.length; idx++) {
        checkCancel(ctrl);
        const file = files[idx];
        if (isPdfFile(file)) {
            const doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { ignoreEncryption: true, updateMetadata: false });
            const found = [];
            const has = (label, getter) => { try { if (getter()) found.push(label); } catch { /* malformed metadata */ } };
            has('title', () => doc.getTitle()); has('author', () => doc.getAuthor()); has('subject', () => doc.getSubject());
            has('keywords', () => doc.getKeywords()); has('creating app', () => doc.getCreator() || doc.getProducer());
            has('creation and modification dates', () => doc.getCreationDate() || doc.getModificationDate());
            has('other document details', () => doc.catalog.get(PDFName.of('Metadata')));
            if (requested.has('title')) doc.setTitle("");
            if (requested.has('author')) doc.setAuthor("");
            if (requested.has('subject')) doc.setSubject("");
            if (requested.has('keywords')) doc.setKeywords([]);
            if (requested.has('creator')) { doc.setProducer(""); doc.setCreator(""); }
            if (requested.has('dates')) try { doc.setCreationDate(new Date(0)); doc.setModificationDate(new Date(0)); } catch { /* some docs lack date entries */ }
            if (requested.has('xmp')) try { doc.catalog.delete(PDFName.of("Metadata")); } catch { /* no XMP present */ }
            const out = await doc.save({ useObjectStreams: false });
            const verified = await PDFDocument.load(out, { ignoreEncryption: true, updateMetadata: false });
            if (verified.getPageCount() !== doc.getPageCount()) throw new Error('badPdf');
            const selectedLabels = [...requested].map((value) => value === 'creator' ? 'creating app' : value === 'dates' ? 'creation and modification dates' : value === 'xmp' ? 'other document details' : value);
            results.push({ name: `${baseName(file.name)}-clean.pdf`, blob: pdfBlob(out), detail: `Found: ${found.length ? found.join(', ') : 'no hidden details in the selected categories'}. Removed: ${selectedLabels.join(', ') || 'nothing selected'}. Page count and visible content were preserved.` });
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
// PDF -> Excel — inferred editable tables by default; page visuals are explicit.
// ----------------------------------------------------------------------------
async function pdfToEditableExcel(files, _opts, prog, ctrl) {
    const XLSX = await import("xlsx");
    const { extractTablesFromTextItems } = await import('../lib/pdf-to-excel/table-extraction.ts');
    const pdfjs = await getPdfjs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await files[0].arrayBuffer()) }).promise;
    const wb = XLSX.utils.book_new();
    let tableCount = 0;
    let pagesWithoutTables = 0;
    try {
        for (let p = 1; p <= doc.numPages; p++) {
            checkCancel(ctrl);
            const page = await doc.getPage(p);
            const tc = await page.getTextContent();
            const tables = extractTablesFromTextItems(tc.items);
            if (!tables.length) pagesWithoutTables += 1;
            tables.forEach((table, tableIndex) => {
                const ws = XLSX.utils.aoa_to_sheet(table.rows, { cellDates: true });
                ws['!cols'] = Array.from({ length: table.columnCount }, (_, column) => ({
                    wch: Math.min(48, Math.max(10, ...table.rows.map((row) => String(row[column] ?? '').length + 2))),
                }));
                ws['!autofilter'] = table.rows.length > 1 && table.columnCount > 1
                    ? { ref: XLSX.utils.encode_range({ r: 0, c: 0 }, { r: table.rows.length - 1, c: table.columnCount - 1 }) }
                    : undefined;
                tableCount += 1;
                XLSX.utils.book_append_sheet(wb, ws, `P${p} Table ${tableIndex + 1}`.slice(0, 31));
            });
            page.cleanup();
            prog?.(p, doc.numPages);
        }
    } finally {
        doc.destroy?.();
    }
    if (!tableCount) throw new Error("noText");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return [{
        name: `${baseName(files[0].name)}-editable.xlsx`,
        blob: new Blob([buf], { type: XLSX_MIME }),
        detail: `${tableCount} table${tableCount === 1 ? '' : 's'} found and placed into editable spreadsheet cells.${pagesWithoutTables ? ` ${pagesWithoutTables} page${pagesWithoutTables === 1 ? '' : 's'} had no clear table and were skipped.` : ''} Review merged cells and complex tables before relying on the workbook.`,
    }];
}

export async function pdfToExcel(files, opts, prog, ctrl) {
    if (opts?.spreadsheetMode !== 'visual') return pdfToEditableExcel(files, opts, prog, ctrl);
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
        detail: 'Each worksheet contains a rendered page visual for reference. It is not editable spreadsheet data.',
    }];
}

// ----------------------------------------------------------------------------
// OCR — recognize text from images or scanned PDFs (tesseract.js).
// ----------------------------------------------------------------------------
export async function ocr(files, opts, prog, ctrl) {
    const lang = opts?.lang || "eng";
    const outputMode = opts?.ocrOutput === 'pdf' ? 'pdf' : 'txt';
    let engine;
    const getEngine = async () => {
        if (engine) return engine;
        try {
            engine = await createLocalOcrEngine(lang, () => {});
            checkCancel(ctrl);
            return engine;
        } catch (e) {
            if (ctrl?.cancelled || e?.name === 'AbortError') throw new Error('cancelled');
            throw new Error("ocrFailed");
        }
    };
    const safeWinAnsi = (value) => value.normalize('NFC').replace(/[^\x20-\xFF]/g, ' ').replace(/\s+/g, ' ').trim();
    const addSearchText = (page, font, text) => {
        const clean = safeWinAnsi(text);
        if (!clean) return;
        const { width } = page.getSize();
        const chunks = clean.match(/.{1,240}(?:\s|$)/g) || [clean.slice(0, 240)];
        chunks.slice(0, 80).forEach((line, index) => page.drawText(line.trim(), { x: 2, y: 2 + (index % 8) * 2, size: Math.max(1, Math.min(2, width / 500)), font, opacity: 0 }));
    };
    try {
        const results = [];
        const signal = ctrl?.abortController?.signal ?? new AbortController().signal;
        for (let i = 0; i < files.length; i++) {
            checkCancel(ctrl);
            const file = files[i];
            let text = "";
            if (isPdfFile(file)) {
                const sourceBytes = new Uint8Array(await file.arrayBuffer());
                const pdfjs = await getPdfjs();
                const doc = await pdfjs.getDocument({ data: sourceBytes.slice() }).promise;
                const searchable = outputMode === 'pdf' ? await PDFDocument.load(sourceBytes, { ignoreEncryption: false, updateMetadata: false }) : null;
                const font = searchable ? await searchable.embedFont(StandardFonts.Helvetica) : null;
                try {
                    for (let p = 1; p <= doc.numPages; p++) {
                        checkCancel(ctrl);
                        const page = await doc.getPage(p);
                        const content = await page.getTextContent();
                        const nativeText = content.items.map((item) => typeof item?.str === 'string' ? item.str : '').join(' ').replace(/\s+/g, ' ').trim();
                        const meaningful = nativeText.replace(/[\p{P}\p{S}\s]/gu, '').length;
                        let pageText = nativeText;
                        if (meaningful < 12) {
                            const viewport = page.getViewport({ scale: 2 });
                            const canvas = document.createElement("canvas");
                            const pixelScale = viewport.width * viewport.height > 12_000_000 ? Math.sqrt(12_000_000 / (viewport.width * viewport.height)) : 1;
                            const renderViewport = page.getViewport({ scale: 2 * pixelScale });
                            canvas.width = Math.ceil(renderViewport.width); canvas.height = Math.ceil(renderViewport.height);
                            const context = canvas.getContext('2d', { alpha: false }); if (!context) throw new Error('ocrFailed');
                            context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
                            await page.render({ canvasContext: context, viewport: renderViewport, background: '#fff' }).promise;
                            const recognized = await (await getEngine()).recognize(canvas, signal);
                            pageText = recognized.text;
                            if (searchable && font) addSearchText(searchable.getPage(p - 1), font, pageText);
                            canvas.width = 1; canvas.height = 1;
                        }
                        text += `----- Page ${p} -----\n${pageText}\n\n`;
                        page.cleanup();
                        prog?.(p, doc.numPages);
                    }
                } finally {
                    doc.destroy?.();
                }
                if (searchable) {
                    const bytes = await searchable.save({ useObjectStreams: true, addDefaultPage: false });
                    results.push({ name: `${baseName(file.name)}-searchable.pdf`, blob: pdfBlob(bytes) });
                } else {
                    results.push({ name: `${baseName(file.name)}.txt`, blob: new Blob([text], { type: "text/plain;charset=utf-8" }) });
                }
            } else {
                const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const context = canvas.getContext('2d');
                if (!context) { bitmap.close(); throw new Error('ocrFailed'); }
                context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(bitmap, 0, 0);
                bitmap.close();
                const recognized = await (await getEngine()).recognize(canvas, signal);
                text += recognized.text;
                if (outputMode === 'pdf') {
                    const searchable = await PDFDocument.create();
                    const imageBlob = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('ocrFailed')), 'image/jpeg', .92));
                    const image = await searchable.embedJpg(await imageBlob.arrayBuffer());
                    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
                    const page = searchable.addPage([image.width * scale * .75, image.height * scale * .75]);
                    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
                    const font = await searchable.embedFont(StandardFonts.Helvetica); addSearchText(page, font, text);
                    results.push({ name: `${baseName(file.name)}-searchable.pdf`, blob: pdfBlob(await searchable.save({ useObjectStreams: true })) });
                } else {
                    results.push({ name: `${baseName(file.name)}.txt`, blob: new Blob([text], { type: "text/plain;charset=utf-8" }) });
                }
                canvas.width = 1;
                canvas.height = 1;
                prog?.(i + 1, files.length);
            }
        }
        return results;
    } catch (e) {
        if (e?.cancelled || e?.name === 'AbortError' || ctrl?.cancelled) throw new Error('cancelled');
        throw new Error("ocrFailed");
    } finally {
        try {
            await engine?.terminate();
        } catch (e) {
            /* ignore */
        }
    }
}
