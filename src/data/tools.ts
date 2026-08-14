export type ToolSlug = 'merge-pdf' | 'split-pdf' | 'rotate-pdf' | 'jpg-to-pdf' | 'pdf-to-jpg' | 'pdf-to-word' | 'word-to-pdf';
export type PublicToolSlug = ToolSlug | 'image-converter' | 'compress-image' | 'compress-pdf' | 'heic-to-jpg';
export type ToolIcon = 'compress' | 'merge' | 'split' | 'rotate' | 'image-in' | 'image-out' | 'word-in' | 'word-out' | 'spark';
export type ToolCategory = 'image' | 'compress' | 'convert' | 'organize';
export type ToolStatus = 'stable' | 'basic';

export interface ToolDefinition {
  slug: PublicToolSlug;
  runtimeId: PublicToolSlug;
  title: string;
  short: string;
  description: string;
  href: string;
  icon: ToolIcon;
  tone: 'indigo' | 'cyan' | 'violet' | 'coral' | 'pink' | 'green';
  badge?: string;
  accept: string;
  multiple: boolean;
  caution?: string;
  category: ToolCategory;
  formats: string[];
  keywords: string[];
  privacy: string;
  related: PublicToolSlug[];
  status: ToolStatus;
}

const localPrivacy = 'Runs locally in your browser. Your file stays on this device.';

export const tools: ToolDefinition[] = [
  {
    slug: 'image-converter',
    runtimeId: 'image-converter',
    title: 'Image Converter',
    short: 'JPG, PNG, HEIC, TIFF & more',
    description: 'Convert everyday image formats to JPG, PNG, or WebP in one private workspace.',
    href: '/image-converter',
    icon: 'spark',
    tone: 'green',
    badge: 'Many formats',
    accept: '',
    multiple: false,
    category: 'image',
    formats: ['JPG', 'PNG', 'WebP', 'GIF', 'BMP', 'AVIF', 'SVG', 'ICO', 'HEIC', 'HEIF', 'TIFF', 'PSD', 'JPEG 2000'],
    keywords: ['convert image', 'image format converter', 'JPG to PNG', 'PNG to JPG', 'TIFF to JPG', 'PSD to PNG'],
    privacy: localPrivacy,
    related: ['compress-image', 'heic-to-jpg', 'jpg-to-pdf'],
    status: 'stable',
  },
  {
    slug: 'compress-image',
    runtimeId: 'compress-image',
    title: 'Compress Images',
    short: 'JPG, PNG, WebP & HEIC',
    description: 'Shrink an image automatically, by percentage, or toward a target file size.',
    href: '/compress-image',
    icon: 'compress',
    tone: 'indigo',
    badge: 'Popular',
    accept: '',
    multiple: false,
    category: 'compress',
    formats: ['JPG', 'PNG', 'WebP', 'HEIC', 'HEIF'],
    keywords: ['compress image', 'reduce image size', 'image resize online', 'target image size'],
    privacy: localPrivacy,
    related: ['image-converter', 'heic-to-jpg', 'compress-pdf'],
    status: 'stable',
  },
  {
    slug: 'heic-to-jpg',
    runtimeId: 'heic-to-jpg',
    title: 'HEIC to JPG',
    short: 'iPhone photos anywhere',
    description: 'Turn an HEIC or HEIF photo into a widely compatible JPG.',
    href: '/heic-to-jpg',
    icon: 'image-out',
    tone: 'cyan',
    accept: '',
    multiple: false,
    category: 'convert',
    formats: ['HEIC', 'HEIF', 'JPG'],
    keywords: ['HEIC to JPG', 'iPhone photo converter', 'HEIF to JPEG', 'convert HEIC privately'],
    privacy: localPrivacy,
    related: ['image-converter', 'compress-image', 'jpg-to-pdf'],
    status: 'stable',
  },
  {
    slug: 'compress-pdf',
    runtimeId: 'compress-pdf',
    title: 'Compress PDF',
    short: 'Smaller document',
    description: 'Create a smaller image-based PDF with clear rasterization warnings.',
    href: '/pdf',
    icon: 'compress',
    tone: 'coral',
    badge: 'Popular',
    accept: '',
    multiple: false,
    category: 'compress',
    formats: ['PDF'],
    keywords: ['compress PDF', 'reduce PDF size', 'PDF compressor no upload', 'compress PDF for email'],
    privacy: localPrivacy,
    related: ['merge-pdf', 'split-pdf', 'pdf-to-jpg'],
    status: 'stable',
  },
  {
    slug: 'merge-pdf',
    runtimeId: 'merge-pdf',
    title: 'Merge PDF',
    short: 'Combine documents',
    description: 'Join PDF files in the order you select and download one new document.',
    href: '/merge-pdf',
    icon: 'merge',
    tone: 'violet',
    accept: 'application/pdf,.pdf',
    multiple: true,
    category: 'organize',
    formats: ['PDF'],
    keywords: ['merge PDF', 'combine PDF files', 'local PDF merge', 'merge PDF free'],
    privacy: localPrivacy,
    related: ['split-pdf', 'rotate-pdf', 'compress-pdf'],
    status: 'stable',
  },
  {
    slug: 'split-pdf',
    runtimeId: 'split-pdf',
    title: 'Split PDF',
    short: 'One file per page',
    description: 'Separate every PDF page into its own file and download one ZIP.',
    href: '/split-pdf',
    icon: 'split',
    tone: 'cyan',
    accept: 'application/pdf,.pdf',
    multiple: false,
    category: 'organize',
    formats: ['PDF', 'ZIP'],
    keywords: ['split PDF', 'separate PDF pages', 'split PDF locally', 'extract PDF pages'],
    privacy: localPrivacy,
    related: ['merge-pdf', 'rotate-pdf', 'pdf-to-jpg'],
    status: 'stable',
  },
  {
    slug: 'rotate-pdf',
    runtimeId: 'rotate-pdf',
    title: 'Rotate PDF',
    short: 'Fix page direction',
    description: 'Rotate every PDF page by 90°, 180°, or 270°.',
    href: '/rotate-pdf',
    icon: 'rotate',
    tone: 'green',
    accept: 'application/pdf,.pdf',
    multiple: false,
    category: 'organize',
    formats: ['PDF'],
    keywords: ['rotate PDF', 'turn PDF pages', 'fix PDF orientation', 'rotate PDF locally'],
    privacy: localPrivacy,
    related: ['merge-pdf', 'split-pdf', 'compress-pdf'],
    status: 'stable',
  },
  {
    slug: 'jpg-to-pdf',
    runtimeId: 'jpg-to-pdf',
    title: 'JPG to PDF',
    short: 'Images into one PDF',
    description: 'Turn one or more JPG or PNG images into a single PDF.',
    href: '/jpg-to-pdf',
    icon: 'image-in',
    tone: 'pink',
    accept: 'image/jpeg,image/png,.jpg,.jpeg,.png',
    multiple: true,
    category: 'convert',
    formats: ['JPG', 'JPEG', 'PNG', 'PDF'],
    keywords: ['image to PDF', 'JPG to PDF', 'PNG to PDF', 'convert image to PDF'],
    privacy: localPrivacy,
    related: ['pdf-to-jpg', 'image-converter', 'merge-pdf'],
    status: 'stable',
  },
  {
    slug: 'pdf-to-jpg',
    runtimeId: 'pdf-to-jpg',
    title: 'PDF to JPG',
    short: 'Pages into images',
    description: 'Render every PDF page as a JPG and download multiple pages in a ZIP.',
    href: '/pdf-to-jpg',
    icon: 'image-out',
    tone: 'coral',
    accept: 'application/pdf,.pdf',
    multiple: false,
    category: 'convert',
    formats: ['PDF', 'JPG', 'ZIP'],
    keywords: ['PDF to image', 'PDF to JPG', 'convert PDF pages', 'PDF image converter'],
    privacy: localPrivacy,
    related: ['jpg-to-pdf', 'split-pdf', 'compress-pdf'],
    status: 'stable',
  },
  {
    slug: 'pdf-to-word',
    runtimeId: 'pdf-to-word',
    title: 'PDF to Word',
    short: 'Extract editable text',
    description: 'Create a basic DOCX from readable text in a PDF.',
    href: '/pdf-to-word',
    icon: 'word-out',
    tone: 'indigo',
    accept: 'application/pdf,.pdf',
    multiple: false,
    caution: 'Complex layouts become simple paragraphs. Scanned pages are recognized locally with OCR; accuracy depends on scan clarity, language, handwriting, and page structure.',
    category: 'convert',
    formats: ['PDF', 'DOCX'],
    keywords: ['PDF to Word', 'PDF to DOCX', 'extract PDF text', 'convert PDF text'],
    privacy: localPrivacy,
    related: ['word-to-pdf', 'pdf-to-jpg', 'split-pdf'],
    status: 'basic',
  },
  {
    slug: 'word-to-pdf',
    runtimeId: 'word-to-pdf',
    title: 'Word to PDF',
    short: 'Text-first conversion',
    description: 'Turn DOCX text into a clean, basic PDF.',
    href: '/word-to-pdf',
    icon: 'word-in',
    tone: 'cyan',
    accept: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx',
    multiple: false,
    caution: 'Advanced Word formatting is simplified.',
    category: 'convert',
    formats: ['DOCX', 'PDF'],
    keywords: ['Word to PDF', 'DOCX to PDF', 'convert Word text', 'basic Word converter'],
    privacy: localPrivacy,
    related: ['pdf-to-word', 'jpg-to-pdf', 'merge-pdf'],
    status: 'basic',
  },
];

const actionSlugs = new Set<ToolSlug>(['merge-pdf', 'split-pdf', 'rotate-pdf', 'jpg-to-pdf', 'pdf-to-jpg', 'pdf-to-word', 'word-to-pdf']);
export const actionTools = tools.filter((tool): tool is ToolDefinition & { slug: ToolSlug } => actionSlugs.has(tool.slug as ToolSlug));

export const toolBySlug = new Map(tools.map((tool) => [tool.slug, tool]));
