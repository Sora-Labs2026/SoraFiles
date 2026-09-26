/// <reference lib="webworker" />
import qpdfWasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';
import ghostscriptWasmUrl from '@okathira/ghostpdl-wasm/gs.wasm?url';

type PdfWorkerRequest =
  | { id: number; operation: 'structural'; bytes: ArrayBuffer }
  | { id: number; operation: 'images'; bytes: ArrayBuffer; dpi: number; qFactor: number; monoDpi: number };

let qpdfPromise: Promise<any> | null = null;
let ghostscriptPromise: Promise<any> | null = null;

async function structural(bytes: ArrayBuffer): Promise<Uint8Array> {
  const createQpdf = (await import('@neslinesli93/qpdf-wasm')).default;
  qpdfPromise ??= createQpdf({ locateFile: () => qpdfWasmUrl });
  const qpdf = await qpdfPromise;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const input = `/input-${suffix}.pdf`;
  const output = `/output-${suffix}.pdf`;
  qpdf.FS.writeFile(input, new Uint8Array(bytes));
  try {
    qpdf.callMain([
      '--object-streams=generate', '--stream-data=compress', '--decode-level=generalized',
      '--recompress-flate', '--compression-level=9', input, output,
    ]);
    return new Uint8Array(qpdf.FS.readFile(output));
  } finally {
    try { qpdf.FS.unlink(input); } catch {}
    try { qpdf.FS.unlink(output); } catch {}
  }
}

async function compressImages(bytes: ArrayBuffer, dpi: number, qFactor: number, monoDpi: number): Promise<Uint8Array> {
  const loadGhostscript = (await import('@okathira/ghostpdl-wasm')).default;
  ghostscriptPromise ??= loadGhostscript({ locateFile: () => ghostscriptWasmUrl, noInitialRun: true });
  const gs = await ghostscriptPromise;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const input = `/input-${suffix}.pdf`;
  const output = `/output-${suffix}.pdf`;
  gs.FS.writeFile(input, new Uint8Array(bytes));
  const distiller = `<< /ColorImageDownsampleType /Bicubic /ColorImageResolution ${dpi} /ColorImageDownsampleThreshold 1.0 /GrayImageDownsampleType /Bicubic /GrayImageResolution ${dpi} /GrayImageDownsampleThreshold 1.0 /MonoImageDownsampleType /Subsample /MonoImageResolution ${monoDpi} /MonoImageDownsampleThreshold 1.0 /AutoFilterColorImages false /AutoFilterGrayImages false /ColorImageFilter /DCTEncode /GrayImageFilter /DCTEncode /ColorImageDict << /QFactor ${qFactor} >> /GrayImageDict << /QFactor ${qFactor} >> >> setdistillerparams`;
  try {
    gs.callMain([
      '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET', '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.7',
      '-dDetectDuplicateImages=true', '-dCompressFonts=true', '-dSubsetFonts=true', '-dAutoRotatePages=/None',
      `-sOutputFile=${output}`, '-c', distiller, '-f', input,
    ]);
    return new Uint8Array(gs.FS.readFile(output, { encoding: 'binary' }));
  } finally {
    try { gs.FS.unlink(input); } catch {}
    try { gs.FS.unlink(output); } catch {}
  }
}

self.onmessage = async (event: MessageEvent<PdfWorkerRequest>) => {
  const request = event.data;
  try {
    const output = request.operation === 'structural'
      ? await structural(request.bytes)
      : await compressImages(request.bytes, request.dpi, request.qFactor, request.monoDpi);
    const bytes = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
    self.postMessage({ id: request.id, ok: true, bytes }, { transfer: [bytes] });
  } catch (error) {
    self.postMessage({ id: request.id, ok: false, error: error instanceof Error ? error.message : 'PDF compression failed.' });
  }
};

export {};
