import type { LocaleContent } from './types';

export const en: LocaleContent = {
  common: {
    skipToContent: 'Skip to content',
    openTool: 'Open',
    theme: 'Theme',
    system: 'System',
    dark: 'Dark',
    light: 'Light',
    allTools: 'All tools',
    images: 'Images',
    pdf: 'PDF',
    about: 'About',
    contact: 'Contact',
    menu: 'Menu',
    tools: 'Tools',
    information: 'Information',
    imageConverter: 'Image Converter',
    compressImages: 'Compress Images',
    compressPdf: 'Compress PDF',
    mergePdf: 'Merge PDF',
    privacy: 'Privacy Policy',
    terms: 'Terms & Conditions',
    openSource: 'Open Source',
    footerPromise: 'Instant, free PDF and image tools that process files locally in your browser. No account or watermark.',
    footerTagline: 'Your files. Your rules.',
    language: 'Language',
    languageHelp: 'Switch to the equivalent version of this page.',
    planned: 'Translation review planned',
    reviewed: 'Translated',
    viewIn: 'View in English',
    stayHere: 'Stay here',
    instantAccess: 'Instant access',
    noAccount: 'No account',
    noWatermark: 'No watermark',
    localProcessing: 'Local processing',
    supportedFormats: 'Supported formats',
    verifiedScope: 'Verified scope',
    stable: 'Stable',
    basic: 'Basic conversion',
    limitations: 'Limitations',
    relatedTools: 'Related tools',
    home: 'Home',
    toolControlsEnglish: 'This tool interface is available in English.',
  },
  home: {
    title: 'Sora Files | Instant, Free PDF & Image Tools',
    description: 'Use instant, free PDF and image tools in your browser. Compress, convert, merge, split, and resize files locally with no account or watermark.',
    h1: 'Instant, free PDF & image tools.',
    intro: 'Compress, convert, merge, split, and resize without an upload queue. Start immediately—no account, no watermark, and no changed original.',
    primaryAction: 'Browse all 11 tools',
    popularTitle: 'Common workflows',
    popularIntro: 'Start with a common file workflow.',
    searchExamplesLabel: 'Try a search',
    searchExamples: ['make a PDF smaller', 'turn photos into PDF', 'extract PDF text'],
    resultCount: 'Tools found: {count}',
    searchAliases: {
      'image-converter': ['convert image format', 'change photo format'],
      'compress-image': ['shrink photo', 'make image smaller'],
      'heic-to-jpg': ['iphone photo to jpg', 'convert heic to jpeg'],
      'compress-pdf': ['make pdf smaller', 'reduce pdf file size'],
      'merge-pdf': ['combine documents', 'join pdf files'],
      'split-pdf': ['separate pdf pages', 'split document pages'],
      'rotate-pdf': ['turn pdf pages', 'fix pdf orientation'],
      'jpg-to-pdf': ['photos to pdf', 'combine images into pdf'],
      'pdf-to-jpg': ['pdf pages to images', 'convert pdf to jpg'],
      'pdf-to-word': ['extract pdf text', 'convert pdf to docx'],
      'word-to-pdf': ['docx to pdf', 'convert word document'],
    },
    privacyProof: {
      eyebrow: 'Private by architecture',
      title: 'Your files stay under your control.',
      intro: 'The supported tools process files inside this browser and create a separate result.',
      items: [
        { icon: 'device', title: 'File uploads', value: 'None', description: 'Files stay inside this browser while the tool works.' },
        { icon: 'account', title: 'Account required', value: 'No', description: 'Open a tool and start instantly without registering.' },
        { icon: 'watermark', title: 'Watermarks', value: 'None', description: 'Sora Files does not stamp a brand mark onto your result.' },
        { icon: 'original', title: 'Original overwritten', value: 'Never', description: 'Every workflow creates a separate downloadable file.' },
      ],
    },
    proofTitle: 'Private by architecture',
    proofItems: [
      'Files stay on this device, inside this browser, from selection to download.',
      'No registration, email, sign-in, or payment card.',
      'Sora Files does not stamp a brand mark onto your result.',
      'Every tool creates a separate download. The original never changes.'
    ],
    explorerTitle: 'Find the right file tool.',
    explorerIntro: 'Search by task or format. Every result below is a working, local browser tool.',
    searchLabel: 'Search file tools',
    searchPlaceholder: 'Search PDF, HEIC, merge…',
    categories: {
      all: 'All tools',
      image: 'Images',
      compress: 'Compress',
      convert: 'Convert',
      organize: 'Organize PDF'
    },
    noResults: 'No matching tool yet.',
    clearSearch: 'Clear search',
    privacyTitle: 'Your browser is the processing room.',
    privacyIntro: 'The tool code works with the selected file in this browser instead of uploading it to a server. This design choice removes the upload queue and keeps the original file safely on your device.',
    privacySteps: [
      { title: 'Select', text: 'The file opens on this device.' },
      { title: 'Process locally', text: 'Your browser does the work.' },
      { title: 'Download', text: 'A new file; the original stays.' }
    ],
    contentTitle: 'Useful control, not a mystery setting.',
    contentSections: [
      {
        heading: 'Compress for a real limit',
        paragraphs: [
          'Use Compress PDF when an email, application, or form rejects a large document. PDF pages are rebuilt as images, so the tool clearly asks you to confirm that selectable text, links, forms, signatures, bookmarks, and accessibility structure will be flattened. An exact PDF size cannot always be guaranteed without harming readability.',
          'For photos and graphics, Compress Images offers Auto, Reduce by, and Target size modes. The target search works toward the requested KB or MB limit when feasible. If an efficient source cannot safely become smaller, the result explains that instead of pretending a larger file is a successful compression.'
        ]
      },
      {
        heading: 'Convert images and pages',
        paragraphs: [
          'The all-in-one Image Converter accepts common browser images plus HEIC, HEIF, TIFF, and flattened PSD files, then creates JPG, PNG, or WebP. Animated and multipage sources use one clearly disclosed frame or page. Camera RAW and INDD are not advertised as working conversions because they require a different development or layout workflow.',
          'PDF to JPG renders each PDF page as an image, while JPG to PDF combines JPG or PNG images into a document. Multiple generated images are packaged in a ZIP only to make downloading practical.'
        ]
      },
      {
        heading: 'Organize PDF pages',
        paragraphs: [
          'Merge PDF joins documents in the order you select. Split PDF creates one PDF per page, and Rotate PDF fixes the direction of every page. These workflows are immediate to open and run locally, although processing time still depends on the file and device.',
          'Basic PDF to Word extracts readable text into a DOCX, and Word to PDF creates a clean PDF from DOCX text. Scanned pages can use local OCR, but scan clarity, language, handwriting, tables, and columns affect recognition accuracy, and exact layout reconstruction is not available.'
        ]
      }
    ],
    faqTitle: 'Frequently asked file tool questions',
    faqs: [
      {
        question: 'Are my files uploaded to your servers?',
        answer: 'No. The available Sora Files PDF, image, HEIC, and basic Word tools process file contents inside your browser. Your browser reads the selected file, performs the task on this device, and prepares a new result for download. File contents are not sent to a Sora Files processing server. The separate Contact form sends the submitted name, email address, subject, message, and any optional attachment over the network to FormSubmit for delivery to Sora Labs. It is not part of the local file-tool flow.'
      },
      {
        question: 'Is Sora Files really private? Do my files leave my device?',
        answer: 'Sora Files is private by architecture for its supported file tools. The processing path stays on your device from selection to download. Analytics may receive ordinary page-visit information, but not the contents of the files you process.'
      },
      {
        question: 'Is Sora Files completely free? Are there limits or watermarks?',
        answer: 'The current tools are free and add no watermark. There is no paid download gate. Practical memory, file-size, and browser limits may apply because your own device performs the work; those are technical limits rather than an artificial daily quota.'
      },
      {
        question: 'Do I need to create an account?',
        answer: 'No. Open a tool, choose a supported file, process it locally, and download the result. No registration, sign-in, email address, trial, or payment card is required.'
      },
      {
        question: 'How does local browser processing work?',
        answer: 'The tool code runs in the browser using local JavaScript, browser APIs, and carefully selected file libraries. The browser reads and transforms the file in memory, then creates a downloadable result. There is no upload or remote-processing stage for the supported tools.'
      },
      {
        question: 'Is it safe for sensitive or confidential documents?',
        answer: 'Local processing removes the need to transmit supported files to Sora Files, reducing exposure compared with an upload-based workflow. You should still use a trusted, updated browser and device, protect the downloaded result, and follow any document-handling rules set by your school, workplace, client, or government.'
      },
      {
        question: 'Will compression reduce PDF or image quality?',
        answer: 'Compression trades some visual detail for a smaller file. Auto and balanced settings are useful starting points, while stronger settings can make fine text or image detail less clear. PDF compression rebuilds pages as images, so selectable text, links, forms, signatures, bookmarks, and accessibility structure are not retained.'
      },
      {
        question: 'Can I compress a PDF without uploading it?',
        answer: 'Yes. Open Compress PDF, choose the document, acknowledge the image-based output, select a compression level, and process it in this browser. The result is a separate download and your original PDF is never overwritten.'
      },
      {
        question: 'How do I convert HEIC to JPG privately?',
        answer: 'Open HEIC to JPG or the Image Converter, choose an HEIC or HEIF photo, select JPG, and create the result. Decoding and conversion happen on your device. This is useful for converting iPhone photos without sending them to a file-conversion server.'
      },
      {
        question: 'What happens to my files when I close the page?',
        answer: 'Working file data is held temporarily by your browser for the current task. When you clear the tool or close the page, Sora Files has no server copy to retain or delete. Files you downloaded remain wherever your browser saved them on your device.'
      },
      {
        question: 'How is Sora Files different from Smallpdf, iLovePDF, or Adobe?',
        answer: 'Sora Files focuses on a local-processing path for its supported tools: no file upload to Sora Files, no account requirement, no watermark, and no overwritten original. Other services have their own capabilities and privacy models, so compare the current policy and behavior of the exact tool you plan to use.'
      }
    ],
  },
  tools: {
    'image-converter': {
      title: 'Image Converter', short: 'JPG, PNG, HEIC, TIFF & more', description: 'Convert everyday image formats to JPG, PNG, or WebP in one private workspace.',
      h1: 'Image Converter', intro: 'Convert everyday image formats to JPG, PNG, or WebP in one private workspace.', sectionTitle: 'How to convert images', paragraphs: [], steps: [], note: '', faqs: []
    },
    'compress-image': {
      title: 'Compress Images', short: 'JPG, PNG, WebP & HEIC', description: 'Shrink an image automatically, by percentage, or toward a target file size.',
      h1: 'Compress Images', intro: 'Shrink an image automatically, by percentage, or toward a target file size.', sectionTitle: 'How to compress images', paragraphs: [], steps: [], note: '', faqs: []
    },
    'heic-to-jpg': {
      title: 'HEIC to JPG', short: 'iPhone photos anywhere', description: 'Turn an HEIC or HEIF photo into a widely compatible JPG.',
      h1: 'HEIC to JPG', intro: 'Turn an HEIC or HEIF photo into a widely compatible JPG.', sectionTitle: 'How to convert HEIC to JPG', paragraphs: [], steps: [], note: '', faqs: []
    },
    'compress-pdf': {
      title: 'Compress PDF', short: 'Smaller document', description: 'Create a smaller image-based PDF with clear rasterization warnings.',
      h1: 'Compress PDF', intro: 'Create a smaller image-based PDF with clear rasterization warnings.', sectionTitle: 'How to compress a PDF', paragraphs: [], steps: [], note: '', faqs: []
    },
    'merge-pdf': {
      title: 'Merge PDF', short: 'Combine documents', description: 'Join PDF files in the order you select and download one new document.',
      h1: 'Merge PDF', intro: 'Join PDF files in the order you select and download one new document.', sectionTitle: 'How to merge PDF files', paragraphs: [], steps: [], note: '', faqs: []
    },
    'split-pdf': {
      title: 'Split PDF', short: 'One file per page', description: 'Separate every PDF page into its own file and download one ZIP.',
      h1: 'Split PDF', intro: 'Separate every PDF page into its own file and download one ZIP.', sectionTitle: 'How to split a PDF', paragraphs: [], steps: [], note: '', faqs: []
    },
    'rotate-pdf': {
      title: 'Rotate PDF', short: 'Fix page direction', description: 'Rotate every PDF page by 90°, 180°, or 270°.',
      h1: 'Rotate PDF', intro: 'Rotate every PDF page by 90°, 180°, or 270°.', sectionTitle: 'How to rotate a PDF', paragraphs: [], steps: [], note: '', faqs: []
    },
    'jpg-to-pdf': {
      title: 'JPG to PDF', short: 'Images into one PDF', description: 'Turn one or more JPG or PNG images into a single PDF.',
      h1: 'JPG to PDF', intro: 'Turn one or more JPG or PNG images into a single PDF.', sectionTitle: 'How to convert JPG to PDF', paragraphs: [], steps: [], note: '', faqs: []
    },
    'pdf-to-jpg': {
      title: 'PDF to JPG', short: 'Pages into images', description: 'Render every PDF page as a JPG and download multiple pages in a ZIP.',
      h1: 'PDF to JPG', intro: 'Render every PDF page as a JPG and download multiple pages in a ZIP.', sectionTitle: 'How to convert PDF to JPG', paragraphs: [], steps: [], note: '', faqs: []
    },
    'pdf-to-word': {
      title: 'PDF to Word', short: 'Extract editable text', description: 'Create a basic DOCX from readable text in a PDF.',
      h1: 'PDF to Word', intro: 'Create a basic DOCX from readable text in a PDF.', sectionTitle: 'How to convert PDF to Word', paragraphs: [], steps: [], note: '', faqs: []
    },
    'word-to-pdf': {
      title: 'Word to PDF', short: 'Text-first conversion', description: 'Turn DOCX text into a clean, basic PDF.',
      h1: 'Word to PDF', intro: 'Turn DOCX text into a clean, basic PDF.', sectionTitle: 'How to convert Word to PDF', paragraphs: [], steps: [], note: '', faqs: []
    },
  },
  pages: {
    about: { title: 'About', description: 'About Sora Files.', h1: 'About', intro: '', sections: [] },
    privacy: { title: 'Privacy Policy', description: 'Privacy policy for Sora Files.', h1: 'Privacy Policy', intro: '', sections: [] },
    terms: { title: 'Terms & Conditions', description: 'Terms and conditions for Sora Files.', h1: 'Terms & Conditions', intro: '', sections: [] },
    openSource: { title: 'Open Source', description: 'Open source acknowledgements.', h1: 'Open Source', intro: '', sections: [] },
    contact: { 
      title: 'Contact', description: 'Contact Sora Files.', h1: 'Contact', intro: '', sections: [],
      form: { name: 'Name', email: 'Email', subject: 'Subject', message: 'Message', attachment: 'Attachment', optional: '(optional)', subjects: ['General', 'Support', 'Feedback'], attachmentHelp: 'Max 10MB', consent: 'I agree', send: 'Send', sending: 'Sending...', success: 'Sent!', caution: 'Error' }
    },
  },
};
