import type { LocalToolRuntimeDefinition, PublicToolId } from './contracts';

const megabyte = 1_000_000;

export const runtimeDefinitions: readonly LocalToolRuntimeDefinition[] = [
  {
    id: 'image-converter', engineId: 'image',
    acceptedSignatures: ['jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'svg', 'ico', 'heif', 'tiff', 'psd', 'jpeg-2000'],
    outputKinds: ['jpeg', 'png', 'webp'], modes: ['convert'], execution: 'library-worker', cancellable: false,
    lossProfile: 'lossy-pixels', limits: { maxFiles: 1, maxTotalBytes: 50 * megabyte, maxPixelsPerSurface: 32_000_000 },
    warningKeys: ['warnings.animationLost', 'warnings.extraPagesIgnored', 'warnings.psdLayersFlattened', 'warnings.heicAuxiliaryDataLost', 'warnings.metadataMayBeLost', 'warnings.colorProfileUncertain'],
  },
  {
    id: 'compress-image', engineId: 'image',
    acceptedSignatures: ['jpeg', 'png', 'webp', 'heif'], outputKinds: ['jpeg', 'png', 'webp'],
    modes: ['auto', 'target-bytes', 'reduction-percent'], execution: 'library-worker', cancellable: false,
    lossProfile: 'lossy-pixels', limits: { maxFiles: 1, maxTotalBytes: 50 * megabyte, maxPixelsPerSurface: 32_000_000 },
    warningKeys: ['warnings.targetUnreachable', 'warnings.transparencyMayChange', 'warnings.metadataMayBeLost'],
  },
  {
    id: 'heic-to-jpg', engineId: 'image',
    acceptedSignatures: ['heif'], outputKinds: ['jpeg'], modes: ['convert'], execution: 'library-worker', cancellable: false,
    lossProfile: 'lossy-pixels', limits: { maxFiles: 1, maxTotalBytes: 50 * megabyte, maxPixelsPerSurface: 32_000_000 },
    warningKeys: ['warnings.heicAuxiliaryDataLost', 'warnings.metadataMayBeLost'],
  },
  {
    id: 'compress-pdf', engineId: 'pdf',
    acceptedSignatures: ['pdf'], outputKinds: ['pdf'], modes: ['small', 'balanced', 'quality'], execution: 'dedicated-worker', cancellable: true,
    lossProfile: 'flattened', limits: { maxFiles: 1, maxTotalBytes: 50 * megabyte, maxPages: 40, maxPixelsPerSurface: 16_000_000 },
    warningKeys: ['warnings.pdfFlattened', 'warnings.outputMayBeLarger'],
  },
  {
    id: 'merge-pdf', engineId: 'pdf',
    acceptedSignatures: ['pdf'], outputKinds: ['pdf'], modes: ['merge'], execution: 'dedicated-worker', cancellable: true,
    lossProfile: 'lossless-structure', limits: { maxFiles: 20, maxTotalBytes: 100 * megabyte }, warningKeys: [],
  },
  {
    id: 'split-pdf', engineId: 'pdf',
    acceptedSignatures: ['pdf'], outputKinds: ['pdf', 'zip'], modes: ['split'], execution: 'dedicated-worker', cancellable: true,
    lossProfile: 'lossless-structure', limits: { maxFiles: 1, maxTotalBytes: 100 * megabyte, maxPages: 100 }, warningKeys: [],
  },
  {
    id: 'rotate-pdf', engineId: 'pdf',
    acceptedSignatures: ['pdf'], outputKinds: ['pdf'], modes: ['rotate-90', 'rotate-180', 'rotate-270'], execution: 'dedicated-worker', cancellable: true,
    lossProfile: 'lossless-structure', limits: { maxFiles: 1, maxTotalBytes: 100 * megabyte }, warningKeys: [],
  },
  {
    id: 'jpg-to-pdf', engineId: 'pdf',
    acceptedSignatures: ['jpeg', 'png'], outputKinds: ['pdf'], modes: ['a4', 'image'], execution: 'dedicated-worker', cancellable: true,
    lossProfile: 'lossless-structure', limits: { maxFiles: 20, maxTotalBytes: 100 * megabyte }, warningKeys: [],
  },
  {
    id: 'pdf-to-jpg', engineId: 'pdf',
    acceptedSignatures: ['pdf'], outputKinds: ['jpeg', 'zip'], modes: ['render'], execution: 'dedicated-worker', cancellable: true,
    lossProfile: 'lossy-pixels', limits: { maxFiles: 1, maxTotalBytes: 100 * megabyte, maxPages: 40, maxPixelsPerSurface: 16_000_000 },
    warningKeys: ['warnings.pdfPagesRasterized'],
  },
  {
    id: 'pdf-to-word', engineId: 'document',
    acceptedSignatures: ['pdf'], outputKinds: ['docx'], modes: ['basic'], execution: 'library-worker', cancellable: true,
    lossProfile: 'text-only', limits: { maxFiles: 1, maxTotalBytes: 100 * megabyte, maxPages: 60, maxPixelsPerSurface: 8_000_000 },
    warningKeys: ['warnings.layoutSimplified', 'warnings.ocrAccuracy', 'warnings.lowConfidence'],
  },
  {
    id: 'word-to-pdf', engineId: 'document',
    acceptedSignatures: ['docx'], outputKinds: ['pdf'], modes: ['basic'], execution: 'main-short', cancellable: false,
    lossProfile: 'text-only', limits: { maxFiles: 1, maxTotalBytes: 25 * megabyte },
    warningKeys: ['warnings.wordFormattingSimplified'],
  },
];

export const runtimeByToolId: ReadonlyMap<PublicToolId, LocalToolRuntimeDefinition> = new Map(
  runtimeDefinitions.map((definition) => [definition.id, definition]),
);
