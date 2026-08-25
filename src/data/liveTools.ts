import copy from './liveCopy.ts';

export type LiveToolIcon =
  | 'compress' | 'merge' | 'split' | 'rotate' | 'remove' | 'image-out'
  | 'image-in' | 'word-out' | 'word-in' | 'watermark' | 'numbers' | 'sign'
  | 'spark' | 'minimize' | 'crop' | 'lock' | 'unlock' | 'repair' | 'eraser'
  | 'table' | 'spreadsheet' | 'scan' | 'resize' | 'scanner';

export interface LiveTool {
  slug: string;
  id: string;
  icon: LiveToolIcon;
  engine: string | null;
  tile: string;
  tint: string;
  accept: string;
  multiple: boolean;
  reorder: boolean;
  inputFormats: string[];
  outputFormats: string[];
  outputLabel: string;
  limitationKey: string | null;
  related: string[];
  name: string;
  description: string;
  tagline: string;
}

const PDF = 'application/pdf,.pdf';
const IMG = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
const JPG_PNG = 'image/jpeg,image/png,.jpg,.jpeg,.png';
const COMPRESSIBLE_IMG = `${IMG},image/heic,image/heif,.heic,.heif`;
const CONVERTER_IMG = 'image/*,.heic,.heif,.tif,.tiff,.psd,.jfif,.pjpeg,.pjp,.ico,.jp2,.j2k,.jpf,.jpx';
const toolCopy = copy.tool as Record<string, { n?: string; d?: string; t?: string }>;

const toolFormats: Record<string, { input: string[]; output: string[] }> = {
  'compress-pdf': { input: ['PDF'], output: ['PDF'] },
  'merge-pdf': { input: ['PDF'], output: ['PDF'] },
  'split-pdf': { input: ['PDF'], output: ['PDF', 'ZIP'] },
  'rotate-pdf': { input: ['PDF'], output: ['PDF'] },
  'remove-pages': { input: ['PDF'], output: ['PDF'] },
  'pdf-to-jpg': { input: ['PDF'], output: ['JPG', 'ZIP'] },
  'jpg-to-pdf': { input: ['JPG', 'PNG'], output: ['PDF'] },
  'pdf-to-word': { input: ['PDF'], output: ['DOCX'] },
  'word-to-pdf': { input: ['DOCX'], output: ['PDF'] },
  'watermark-pdf': { input: ['PDF'], output: ['PDF'] },
  'page-numbers': { input: ['PDF'], output: ['PDF'] },
  'sign-pdf': { input: ['PDF'], output: ['PDF'] },
  'image-converter': { input: ['JPG', 'PNG', 'WebP', 'GIF', 'BMP', 'AVIF', 'SVG', 'HEIC', 'HEIF', 'TIFF', 'PSD', 'ICO', 'JP2'], output: ['JPG', 'PNG', 'WebP'] },
  'compress-image': { input: ['JPG', 'PNG', 'WebP', 'HEIC', 'HEIF'], output: ['JPG', 'PNG', 'WebP'] },
  'heic-to-jpg': { input: ['HEIC', 'HEIF'], output: ['JPG'] },
  'edit-image': { input: ['JPG', 'PNG', 'WebP'], output: ['JPG', 'PNG', 'WebP'] },
  'remove-background': { input: ['JPG', 'PNG', 'WebP'], output: ['PNG'] },
  'protect-pdf': { input: ['PDF'], output: ['PDF'] },
  'unlock-pdf': { input: ['PDF'], output: ['PDF'] },
  'repair-pdf': { input: ['PDF'], output: ['PDF'] },
  'metadata-remover': { input: ['PDF', 'JPG', 'PNG', 'WebP', 'DOCX', 'XLSX', 'PPTX'], output: ['PDF', 'JPG', 'PNG', 'WebP', 'DOCX', 'XLSX', 'PPTX'] },
  'pdf-to-excel': { input: ['PDF'], output: ['XLSX'] },
  'excel-to-pdf': { input: ['XLSX', 'XLS', 'CSV'], output: ['PDF'] },
  'pdf-ocr': { input: ['PDF', 'JPG', 'PNG', 'WebP'], output: ['TXT'] },
  'resize-image': { input: ['JPG', 'PNG', 'WebP'], output: ['JPG', 'PNG', 'WebP'] },
  'doc-scanner': { input: ['JPG', 'PNG', 'WebP'], output: ['PDF', 'JPG', 'PNG'] },
};

const define = (tool: Omit<LiveTool, 'name' | 'description' | 'tagline' | 'inputFormats' | 'outputFormats'>): LiveTool => {
  const words = toolCopy[tool.id] ?? {};
  const formats = toolFormats[tool.id];
  if (!formats) throw new Error(`Missing format metadata for ${tool.id}.`);
  return {
    ...tool,
    inputFormats: [...formats.input],
    outputFormats: [...formats.output],
    outputLabel: formats.output.join(' / '),
    name: words.n ?? `tool.${tool.id}.n`,
    description: words.d ?? `tool.${tool.id}.d`,
    tagline: words.t ?? `tool.${tool.id}.t`,
  };
};

export const liveTools: LiveTool[] = [
  define({ slug: 'pdf', id: 'compress-pdf', icon: 'compress', engine: 'compressPdf', tile: 'from-rose-500 to-red-600 shadow-rose-500/30', tint: 'border-rose-100 bg-rose-50/80 hover:border-rose-200 dark:border-rose-400/10 dark:bg-rose-500/[0.07]', accept: PDF, multiple: false, reorder: false, outputLabel: 'PDF', limitationKey: 'lim.compress', related: ['merge-pdf', 'doc-scanner', 'pdf-ocr', 'metadata-remover'] }),
  define({ slug: 'merge-pdf', id: 'merge-pdf', icon: 'merge', engine: 'mergePdf', tile: 'from-sky-500 to-blue-600 shadow-sky-500/30', tint: 'border-sky-100 bg-sky-50/80 hover:border-sky-200 dark:border-sky-400/10 dark:bg-sky-500/[0.07]', accept: PDF, multiple: true, reorder: true, outputLabel: 'PDF', limitationKey: null, related: ['split-pdf', 'compress-pdf', 'rotate-pdf'] }),
  define({ slug: 'split-pdf', id: 'split-pdf', icon: 'split', engine: 'splitPdf', tile: 'from-emerald-400 to-teal-600 shadow-emerald-500/30', tint: 'border-emerald-100 bg-emerald-50/80 hover:border-emerald-200 dark:border-emerald-400/10 dark:bg-emerald-500/[0.07]', accept: PDF, multiple: false, reorder: false, outputLabel: 'PDF', limitationKey: null, related: ['merge-pdf', 'remove-pages', 'rotate-pdf'] }),
  define({ slug: 'rotate-pdf', id: 'rotate-pdf', icon: 'rotate', engine: 'rotatePdf', tile: 'from-pink-500 to-fuchsia-600 shadow-pink-500/30', tint: 'border-pink-100 bg-pink-50/80 hover:border-pink-200 dark:border-pink-400/10 dark:bg-pink-500/[0.07]', accept: PDF, multiple: false, reorder: false, outputLabel: 'PDF', limitationKey: null, related: ['split-pdf', 'merge-pdf', 'jpg-to-pdf'] }),
  define({ slug: 'remove-pages', id: 'remove-pages', icon: 'remove', engine: 'removePagesPdf', tile: 'from-indigo-400 to-blue-600 shadow-indigo-500/30', tint: 'border-indigo-100 bg-indigo-50/80 hover:border-indigo-200 dark:border-indigo-400/10 dark:bg-indigo-500/[0.07]', accept: PDF, multiple: false, reorder: false, outputLabel: 'PDF', limitationKey: null, related: ['split-pdf', 'merge-pdf', 'compress-pdf'] }),
  define({ slug: 'pdf-to-jpg', id: 'pdf-to-jpg', icon: 'image-out', engine: 'pdfToImages', tile: 'from-cyan-400 to-teal-500 shadow-cyan-500/30', tint: 'border-cyan-100 bg-cyan-50/80 hover:border-cyan-200 dark:border-cyan-400/10 dark:bg-cyan-500/[0.07]', accept: PDF, multiple: false, reorder: false, outputLabel: 'JPG / PNG / ZIP', limitationKey: null, related: ['jpg-to-pdf', 'compress-image', 'compress-pdf'] }),
  define({ slug: 'jpg-to-pdf', id: 'jpg-to-pdf', icon: 'image-in', engine: 'imagesToPdf', tile: 'from-amber-400 to-orange-500 shadow-amber-500/30', tint: 'border-amber-100 bg-amber-50/80 hover:border-amber-200 dark:border-amber-400/10 dark:bg-amber-500/[0.07]', accept: JPG_PNG, multiple: true, reorder: true, outputLabel: 'PDF', limitationKey: null, related: ['pdf-to-jpg', 'image-converter', 'merge-pdf'] }),
  define({ slug: 'pdf-to-word', id: 'pdf-to-word', icon: 'word-out', engine: 'pdfToDocx', tile: 'from-blue-500 to-indigo-600 shadow-blue-500/30', tint: 'border-blue-100 bg-blue-50/80 hover:border-blue-200 dark:border-blue-400/10 dark:bg-blue-500/[0.07]', accept: PDF, multiple: false, reorder: false, outputLabel: 'DOCX', limitationKey: null, related: ['word-to-pdf', 'compress-pdf', 'split-pdf'] }),
  define({ slug: 'word-to-pdf', id: 'word-to-pdf', icon: 'word-in', engine: 'docxToPdf', tile: 'from-violet-500 to-purple-600 shadow-violet-500/30', tint: 'border-violet-100 bg-violet-50/80 hover:border-violet-200 dark:border-violet-400/10 dark:bg-violet-500/[0.07]', accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', multiple: false, reorder: false, outputLabel: 'PDF', limitationKey: null, related: ['pdf-to-word', 'compress-pdf', 'merge-pdf'] }),
  define({ slug: 'watermark-pdf', id: 'watermark-pdf', icon: 'watermark', engine: 'watermarkPdf', tile: 'from-cyan-500 to-blue-500 shadow-cyan-500/30', tint: 'border-cyan-100 bg-cyan-50/80 hover:border-cyan-200 dark:border-cyan-400/10 dark:bg-cyan-500/[0.07]', accept: PDF, multiple: false, reorder: false, outputLabel: 'PDF', limitationKey: null, related: ['sign-pdf', 'page-numbers', 'compress-pdf'] }),
  define({ slug: 'page-numbers', id: 'page-numbers', icon: 'numbers', engine: 'pageNumbersPdf', tile: 'from-fuchsia-500 to-purple-600 shadow-fuchsia-500/30', tint: 'border-fuchsia-100 bg-fuchsia-50/80 hover:border-fuchsia-200 dark:border-fuchsia-400/10 dark:bg-fuchsia-500/[0.07]', accept: PDF, multiple: false, reorder: false, outputLabel: 'PDF', limitationKey: null, related: ['watermark-pdf', 'merge-pdf', 'rotate-pdf'] }),
  define({ slug: 'sign-pdf', id: 'sign-pdf', icon: 'sign', engine: 'signPdf', tile: 'from-rose-400 to-pink-600 shadow-rose-500/30', tint: 'border-rose-100 bg-rose-50/80 hover:border-rose-200 dark:border-rose-400/10 dark:bg-rose-500/[0.07]', accept: PDF, multiple: false, reorder: false, outputLabel: 'PDF', limitationKey: 'lim.sign', related: ['watermark-pdf', 'pdf-to-word', 'compress-pdf'] }),
  define({ slug: 'image-converter', id: 'image-converter', icon: 'spark', engine: 'convertImages', tile: 'from-indigo-500 to-violet-600 shadow-indigo-500/30', tint: 'border-indigo-100 bg-indigo-50/80 hover:border-indigo-200 dark:border-indigo-400/10 dark:bg-indigo-500/[0.07]', accept: CONVERTER_IMG, multiple: true, reorder: false, outputLabel: 'JPG / PNG / WebP / ZIP', limitationKey: 'lim.flatten', related: ['compress-image', 'heic-to-jpg', 'jpg-to-pdf'] }),
  define({ slug: 'compress-image', id: 'compress-image', icon: 'minimize', engine: 'compressImages', tile: 'from-teal-400 to-cyan-600 shadow-teal-500/30', tint: 'border-teal-100 bg-teal-50/80 hover:border-teal-200 dark:border-teal-400/10 dark:bg-teal-500/[0.07]', accept: COMPRESSIBLE_IMG, multiple: true, reorder: false, outputLabel: 'JPG / WebP / ZIP', limitationKey: 'lim.flatten', related: ['image-converter', 'heic-to-jpg', 'jpg-to-pdf'] }),
  define({ slug: 'heic-to-jpg', id: 'heic-to-jpg', icon: 'image-out', engine: 'heicToJpg', tile: 'from-orange-400 to-rose-500 shadow-orange-500/30', tint: 'border-orange-100 bg-orange-50/80 hover:border-orange-200 dark:border-orange-400/10 dark:bg-orange-500/[0.07]', accept: '.heic,.heif,image/heic,image/heif', multiple: true, reorder: false, outputLabel: 'JPG / ZIP', limitationKey: null, related: ['image-converter', 'compress-image', 'jpg-to-pdf'] }),
  define({ slug: 'edit-image', id: 'edit-image', icon: 'crop', engine: null, tile: 'from-pink-500 to-rose-600 shadow-pink-500/30', tint: 'border-pink-100 bg-pink-50/80 hover:border-pink-200 dark:border-pink-400/10 dark:bg-pink-500/[0.07]', accept: IMG, multiple: false, reorder: false, outputLabel: 'Image', limitationKey: null, related: ['compress-image', 'image-converter', 'heic-to-jpg'] }),
  define({ slug: 'remove-background', id: 'remove-background', icon: 'eraser', engine: 'imgly-isnet-quint8', tile: 'from-violet-500 to-cyan-500 shadow-violet-500/30', tint: 'border-violet-100 bg-violet-50/80 hover:border-violet-200 dark:border-violet-400/10 dark:bg-violet-500/[0.07]', accept: IMG, multiple: false, reorder: false, outputLabel: 'PNG', limitationKey: null, related: ['edit-image', 'image-converter', 'compress-image'] }),
  define({ slug: 'protect-pdf', id: 'protect-pdf', icon: 'lock', engine: 'protectPdf', tile: 'from-slate-700 to-slate-900 shadow-slate-700/30', tint: 'border-slate-200 bg-slate-50/80 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.05]', accept: PDF, multiple: false, reorder: false, outputLabel: 'PDF', limitationKey: 'lim.protect', related: ['unlock-pdf', 'watermark-pdf', 'sign-pdf'] }),
  define({ slug: 'unlock-pdf', id: 'unlock-pdf', icon: 'unlock', engine: 'unlockPdf', tile: 'from-teal-500 to-emerald-600 shadow-teal-500/30', tint: 'border-teal-100 bg-teal-50/80 hover:border-teal-200 dark:border-teal-400/10 dark:bg-teal-500/[0.07]', accept: PDF, multiple: false, reorder: false, outputLabel: 'PDF', limitationKey: 'lim.unlock', related: ['protect-pdf', 'repair-pdf', 'compress-pdf'] }),
  define({ slug: 'repair-pdf', id: 'repair-pdf', icon: 'repair', engine: 'repairPdf', tile: 'from-amber-500 to-orange-600 shadow-amber-500/30', tint: 'border-amber-100 bg-amber-50/80 hover:border-amber-200 dark:border-amber-400/10 dark:bg-amber-500/[0.07]', accept: PDF, multiple: false, reorder: false, outputLabel: 'PDF', limitationKey: 'lim.repair', related: ['compress-pdf', 'unlock-pdf', 'merge-pdf'] }),
  define({ slug: 'metadata-remover', id: 'metadata-remover', icon: 'eraser', engine: 'removeMetadata', tile: 'from-fuchsia-500 to-pink-600 shadow-fuchsia-500/30', tint: 'border-fuchsia-100 bg-fuchsia-50/80 hover:border-fuchsia-200 dark:border-fuchsia-400/10 dark:bg-fuchsia-500/[0.07]', accept: 'application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.pptx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation', multiple: true, reorder: false, outputLabel: 'PDF / Image / Office', limitationKey: 'lim.metadata', related: ['protect-pdf', 'compress-image', 'compress-pdf'] }),
  define({ slug: 'pdf-to-excel', id: 'pdf-to-excel', icon: 'table', engine: 'pdfToExcel', tile: 'from-green-500 to-emerald-600 shadow-green-500/30', tint: 'border-green-100 bg-green-50/80 hover:border-green-200 dark:border-green-400/10 dark:bg-green-500/[0.07]', accept: PDF, multiple: false, reorder: false, outputLabel: 'XLSX', limitationKey: null, related: ['excel-to-pdf', 'pdf-to-word', 'pdf-to-jpg'] }),
  define({ slug: 'excel-to-pdf', id: 'excel-to-pdf', icon: 'spreadsheet', engine: 'excelToPdf', tile: 'from-emerald-500 to-green-700 shadow-emerald-500/30', tint: 'border-emerald-100 bg-emerald-50/80 hover:border-emerald-200 dark:border-emerald-400/10 dark:bg-emerald-500/[0.07]', accept: '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv', multiple: false, reorder: false, outputLabel: 'PDF', limitationKey: null, related: ['pdf-to-excel', 'word-to-pdf', 'jpg-to-pdf'] }),
  define({ slug: 'pdf-ocr', id: 'pdf-ocr', icon: 'scan', engine: 'ocr', tile: 'from-violet-500 to-indigo-700 shadow-violet-500/30', tint: 'border-violet-100 bg-violet-50/80 hover:border-violet-200 dark:border-violet-400/10 dark:bg-violet-500/[0.07]', accept: 'application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', multiple: true, reorder: false, outputLabel: 'TXT', limitationKey: 'lim.ocr', related: ['pdf-to-word', 'pdf-to-excel', 'doc-scanner', 'compress-pdf'] }),
  define({ slug: 'resize-image', id: 'resize-image', icon: 'resize', engine: 'jsquashResize', tile: 'from-cyan-400 to-blue-600 shadow-cyan-500/30', tint: 'border-cyan-100 bg-cyan-50/80 hover:border-cyan-200 dark:border-cyan-400/10 dark:bg-cyan-500/[0.07]', accept: IMG, multiple: false, reorder: false, outputLabel: 'JPG / PNG / WebP', limitationKey: 'lim.resize', related: ['compress-image', 'edit-image', 'image-converter', 'heic-to-jpg'] }),
  define({ slug: 'doc-scanner', id: 'doc-scanner', icon: 'scanner', engine: 'scanic', tile: 'from-emerald-400 to-cyan-600 shadow-emerald-500/30', tint: 'border-emerald-100 bg-emerald-50/80 hover:border-emerald-200 dark:border-emerald-400/10 dark:bg-emerald-500/[0.07]', accept: IMG, multiple: true, reorder: true, outputLabel: 'PDF / JPG / PNG', limitationKey: 'lim.scanner', related: ['jpg-to-pdf', 'pdf-ocr', 'compress-pdf', 'merge-pdf'] }),
];

export const documentActionToolIds = new Set([
  'merge-pdf', 'split-pdf', 'rotate-pdf', 'remove-pages', 'watermark-pdf',
  'page-numbers', 'sign-pdf', 'jpg-to-pdf', 'pdf-to-jpg', 'pdf-to-word', 'word-to-pdf',
]);
export const dedicatedWorkbenchToolIds = new Set([
  'compress-pdf', 'image-converter', 'compress-image', 'heic-to-jpg',
  'resize-image', 'doc-scanner', 'remove-background',
  ...documentActionToolIds,
]);
export const liveToolById = new Map(liveTools.map((tool) => [tool.id, tool]));
export const liveToolBySlug = new Map(liveTools.map((tool) => [tool.slug, tool]));
