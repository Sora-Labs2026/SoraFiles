import { renderAsync } from 'docx-preview';
import { toCanvas } from 'html-to-image';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';

export interface WordToPdfProgress {
  stage: 'rendering-document' | 'rendering-page' | 'assembling';
  page?: number;
  total?: number;
}

interface VisualPdfOptions {
  signal: AbortSignal;
  onProgress: (progress: WordToPdfProgress) => void;
}

const abortIfNeeded = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
};

const canvasBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Page image encoding failed.')), 'image/png');
});

const assertNoLinkedExternalImages = (bytes: Uint8Array) => {
  const entries = unzipSync(bytes);
  const decoder = new TextDecoder();
  for (const [name, entry] of Object.entries(entries)) {
    if (!name.endsWith('.rels')) continue;
    const xml = decoder.decode(entry);
    for (const match of xml.matchAll(/<Relationship\b[^>]*\/>/gi)) {
      const relationship = match[0];
      if (/TargetMode\s*=\s*["']External["']/i.test(relationship) && /Type\s*=\s*["'][^"']*\/image["']/i.test(relationship)) {
        throw new Error('This DOCX links to an external image. Embed the image in Word, save the file, and try again so conversion stays private.');
      }
    }
  }
};

const waitForImages = async (container: HTMLElement) => {
  const pending = Array.from(container.querySelectorAll('img')).map(async (image) => {
    if (image.complete) return;
    await new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
  });
  await Promise.all(pending);
};

export async function createVisualPdfFromDocx(source: ArrayBuffer, options: VisualPdfOptions): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const bytes = new Uint8Array(source);
  assertNoLinkedExternalImages(bytes);
  abortIfNeeded(options.signal);
  options.onProgress({ stage: 'rendering-document' });

  const host = document.createElement('div');
  host.dataset.wordRenderHost = '';
  host.style.cssText = 'position:fixed;left:-100000px;top:0;width:max-content;background:#fff;pointer-events:none;z-index:-1;';
  document.body.append(host);

  try {
    await renderAsync(bytes, host, host, {
      className: 'sf-docx',
      inWrapper: true,
      breakPages: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      ignoreLastRenderedPageBreak: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      renderChanges: false,
      renderComments: false,
      renderAltChunks: false,
      experimental: true,
      useBase64URL: true,
      debug: false,
    });
    abortIfNeeded(options.signal);
    await document.fonts?.ready;
    await waitForImages(host);

    const renderedPages = Array.from(host.querySelectorAll<HTMLElement>('.sf-docx-wrapper > section.sf-docx'));
    const pages = renderedPages.length ? renderedPages : Array.from(host.querySelectorAll<HTMLElement>('section'));
    if (!pages.length) throw new Error('The DOCX renderer did not produce any pages. Save the document as DOCX and try again.');
    if (pages.length > 60) throw new Error('Exact Word to PDF currently supports up to 60 rendered pages per task.');

    const pdf = await PDFDocument.create();
    for (let index = 0; index < pages.length; index += 1) {
      abortIfNeeded(options.signal);
      options.onProgress({ stage: 'rendering-page', page: index + 1, total: pages.length });
      const pageNode = pages[index];
      const rect = pageNode.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(rect.width || pageNode.scrollWidth));
      const height = Math.max(1, Math.ceil(rect.height || pageNode.scrollHeight));
      const pixelRatio = Math.min(2.25, Math.sqrt(8_000_000 / Math.max(1, width * height)));
      const canvas = await toCanvas(pageNode, {
        backgroundColor: '#ffffff',
        cacheBust: false,
        pixelRatio,
        width,
        height,
        style: { margin: '0', boxShadow: 'none' },
      });
      const imageBlob = await canvasBlob(canvas);
      const image = await pdf.embedPng(await imageBlob.arrayBuffer());
      const pdfPage = pdf.addPage([width * .75, height * .75]);
      pdfPage.drawImage(image, { x: 0, y: 0, width: pdfPage.getWidth(), height: pdfPage.getHeight() });
      canvas.width = 1;
      canvas.height = 1;
    }

    options.onProgress({ stage: 'assembling', total: pages.length });
    abortIfNeeded(options.signal);
    return { bytes: await pdf.save({ useObjectStreams: true }), pageCount: pages.length };
  } finally {
    host.remove();
  }
}
