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
    compress: 'Compress',
    merge: 'Merge',
    split: 'Split',
    convert: 'Convert',
    edit: 'Edit',
    more: 'More',
    api: 'API',
    changelog: 'Changelog',
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
    planned: 'Coming soon',
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
    title: 'SoraFiles | Instant, Free PDF & Image Tools',
    description: 'Use instant, free PDF and image tools in your browser. Compress, convert, merge, split, and resize files locally with no account or watermark.',
    h1: 'All File Tools. Zero Uploads.',
    intro: 'Fast, private PDF and image tools that run on your device. No processing server, account, or watermark.',
    primaryAction: 'Explore all {{n}} tools',
    privacyProof: {
      eyebrow: 'Private by architecture',
      title: 'Your files stay under your control.',
      intro: 'The supported tools process files inside this browser and create a separate result.',
      items: [
        { icon: 'device', title: 'File uploads', value: 'None', description: 'Files stay inside this browser while the tool works.' },
        { icon: 'account', title: 'Account required', value: 'No', description: 'Open a tool and start instantly without registering.' },
        { icon: 'watermark', title: 'Watermarks', value: 'None', description: 'SoraFiles does not stamp a brand mark onto your result.' },
        { icon: 'original', title: 'Original overwritten', value: 'Never', description: 'Every workflow creates a separate downloadable file.' },
      ],
    },
    proofTitle: 'Private by architecture',
    proofItems: [
      'Files stay on this device, inside this browser, from selection to download.',
      'No registration, email, sign-in, or payment card.',
      'SoraFiles does not stamp a brand mark onto your result.',
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
          'Use Compress PDF when an email, application, or form rejects a large document. PDF pages are rebuilt as images, and selectable text, links, forms, signatures, bookmarks, and accessibility structure are flattened. A requested percentage or target size is enforced as a hard byte ceiling; if the engine cannot meet it, no result is presented as a success.',
          'Compress Images uses the same hard rule for Auto, Reduce by, and Target size. For example, an 80% reduction on a 100 KB image must produce no more than 20 KB. The engine can lower encoding quality and dimensions to meet the limit, then verifies the image before creating a download.'
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
          'Basic PDF to Word extracts readable text into a DOCX, and Word to PDF creates a clean PDF from DOCX text. They are intentionally labeled basic: complex layouts are simplified, and scanned pages are recognized locally with OCR; accuracy depends on scan clarity, language, handwriting, and page structure.'
        ]
      }
    ],
    faqTitle: 'Frequently asked file tool questions',
    faqs: [
      {
        question: 'Are my files uploaded to your servers?',
        answer: 'No. The available SoraFiles PDF, image, HEIC, and basic Word tools process file contents inside your browser. Your browser reads the selected file, performs the task on this device, and prepares a new result for download. File contents are not sent to a SoraFiles processing server.'
      },
      {
        question: 'Is SoraFiles really private? Do my files leave my device?',
        answer: 'SoraFiles is private by architecture for its supported file tools. The processing path stays on your device from selection to download. Analytics may receive ordinary page-visit information, but not the contents of the files you process.'
      },
      {
        question: 'Is SoraFiles completely free? Are there limits or watermarks?',
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
        answer: 'Local processing removes the need to transmit supported files to SoraFiles, reducing exposure compared with an upload-based workflow. You should still use a trusted, updated browser and device, protect the downloaded result, and follow any document-handling rules set by your school, workplace, client, or government.'
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
        answer: 'Working file data is held temporarily by your browser for the current task. When you clear the tool or close the page, SoraFiles has no server copy to retain or delete. Files you downloaded remain wherever your browser saved them on your device.'
      },
      {
        question: 'How is SoraFiles different from Smallpdf, iLovePDF, or Adobe?',
        answer: 'SoraFiles focuses on a local-processing path for its supported tools: no file upload to SoraFiles, no account requirement, no watermark, and no overwritten original. Other services have their own capabilities and privacy models, so compare the current policy and behavior of the exact tool you plan to use.'
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
    'remove-pages': {
      title: 'Remove PDF Pages', short: 'Delete selected pages', description: 'Remove specific pages while keeping the rest of the PDF intact.',
      h1: 'Remove PDF pages without uploading.', intro: 'Enter page numbers or ranges and create a verified PDF with the selected pages removed.', sectionTitle: 'Remove only the pages you choose', paragraphs: ['The PDF is edited locally and the remaining page count is verified before a download is created. Your original is never overwritten.'], steps: ['Choose a PDF.', 'Enter pages such as 2, 4-6, 9.', 'Create and verify the new PDF locally.'], note: 'At least one page must remain. Encrypted PDFs must be unlocked first.', faqs: [{ question: 'Can I remove page ranges?', answer: 'Yes. Use comma-separated pages and ranges such as 2, 4-6, 9.' }]
    },
    'watermark-pdf': {
      title: 'Watermark PDF', short: 'Add text to every page', description: 'Add a visible text watermark to every PDF page locally.',
      h1: 'Watermark a PDF without uploading.', intro: 'Add your text with controlled opacity to every page inside this browser.', sectionTitle: 'A visible local watermark', paragraphs: ['SoraFiles embeds the text into a new PDF and verifies every page before offering the result.'], steps: ['Choose a PDF.', 'Enter text and opacity.', 'Create and review the watermarked copy.'], note: 'A visible watermark is not encryption or access control.', faqs: [{ question: 'Is the PDF uploaded?', answer: 'No. Watermarking and output verification happen locally in this browser.' }]
    },
    'page-numbers': {
      title: 'Add Page Numbers', short: 'Number every PDF page', description: 'Add page numbers in a chosen position and starting sequence.',
      h1: 'Add PDF page numbers locally.', intro: 'Choose a position and starting number, then download a verified numbered PDF.', sectionTitle: 'Clear pagination without a server', paragraphs: ['Numbers are embedded on every page in a separate PDF while the source remains unchanged.'], steps: ['Choose a PDF.', 'Select the position and starting number.', 'Create and verify the numbered PDF.'], note: 'Inspect numbers where source content is close to the page edge.', faqs: [{ question: 'Can numbering start after 1?', answer: 'Yes. Enter a starting number from 1 to 999999.' }]
    },
    'sign-pdf': {
      title: 'Sign PDF', short: 'Draw a visible signature', description: 'Draw a signature and place its visible appearance on selected PDF pages locally.',
      h1: 'Add a visible signature to a PDF locally.', intro: 'Draw in the signature pad and place the mark on the first, last, or every page.', sectionTitle: 'Visible signing with an honest scope', paragraphs: ['The signature image is embedded in a new PDF and never leaves this browser. This is a visible appearance, not identity verification.'], steps: ['Choose a PDF.', 'Draw a signature and choose its page scope.', 'Create and verify the signed copy.'], note: 'This is not a certificate-backed digital signature and does not verify identity or document integrity.', faqs: [{ question: 'Is this a cryptographic digital signature?', answer: 'No. It adds a visible signature image only.' }]
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
    about: { title: 'About', description: 'About SoraFiles.', h1: 'About', intro: '', sections: [] },
    privacy: {
      title: 'Privacy Policy | SoraFiles',
      description: 'Local file processing, analytics, and contact-form privacy at SoraFiles.',
      h1: 'Your files remain yours.',
      intro: 'File tools and external page services handle different kinds of data.',
      updated: 'Last updated: August 23, 2026',
      sections: [
        { heading: 'Local file processing', paragraphs: ['Image, HEIC, PDF, ZIP, and DOCX tools process selected files inside this browser. File contents and results are not uploaded to a SoraFiles processing server.'] },
        { heading: 'Temporary browser data', paragraphs: ['Previews and download URLs exist temporarily in the open page and are released when a file is removed or the page is closed.'] },
        { heading: 'Analytics', paragraphs: ['Ahrefs Web Analytics may process page activity, device information, and approximate location, but not the contents of files processed locally. Its script loads asynchronously and does not receive file contents.'] },
        { heading: 'Contact form', paragraphs: ['Your name, email address, subject, message, and optional attachment are sent through FormSubmit for delivery to SoraFiles support. Do not attach confidential files.'] },
        { heading: 'Public source and contributions', paragraphs: ['The SoraFiles application source is published at github.com/Sora-Labs2026/SoraFiles under the GNU Affero General Public License v3.0. Local file processing does not send selected files to GitHub. Information or attachments that you voluntarily post in a public GitHub issue, discussion, or pull request are publicly visible, so do not submit confidential files or personal data there.'] },
      ],
    },
    terms: { title: 'Terms & Conditions', description: 'Terms and conditions for SoraFiles.', h1: 'Terms & Conditions', intro: '', sections: [] },
    openSource: {
      title: 'Open Source Libraries | SoraFiles',
      description: 'Open-source libraries used for private, local PDF and image processing in SoraFiles.',
      h1: 'Real, verifiable processing engines.',
      intro: 'SoraFiles combines established open-source libraries that run inside your browser.',
      sections: [
        { heading: 'Core libraries', paragraphs: ['PDF.js, pdf-lib, jsPDF, Mammoth.js, docx, fflate, libheif, UTIF, and ag-psd power supported PDF, document, archive, HEIC, TIFF, and PSD workflows. Each library remains subject to its respective upstream license and copyright terms.'] },
        { heading: 'How this supports local processing', paragraphs: ['The library code is delivered as part of the website, but files selected in supported tools are processed on your device and are not sent to a SoraFiles processing server.'] },
        { heading: 'Application source', paragraphs: ['The complete SoraFiles application source is published at github.com/Sora-Labs2026/SoraFiles under the GNU Affero General Public License v3.0 only (AGPL-3.0-only). Contributions and modified network deployments must follow that license.'] },
      ],
    },
    contact: { 
      title: 'Contact', description: 'Contact SoraFiles.', h1: 'Contact', intro: '', sections: [],
      form: { name: 'Name', email: 'Email', subject: 'Subject', message: 'Message', attachment: 'Attachment', optional: '(optional)', subjects: ['General', 'Support', 'Feedback'], attachmentHelp: 'Max 10MB', consent: 'I agree', send: 'Send', sending: 'Sending...', success: 'Sent!', caution: 'Error' }
    },
  },
};
