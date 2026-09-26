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
    footerPromise: 'Instant, free PDF and image tools that process files in your browser. No account or watermark.',
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
      eyebrow: 'Private PDF tools',
      title: 'Your files stay under your control.',
      intro: 'The supported tools process files inside this browser and create a separate result.',
      items: [
        { icon: 'device', title: 'File uploads', value: 'None', description: 'Files stay inside this browser while the tool works.' },
        { icon: 'account', title: 'Account required', value: 'No', description: 'Open a tool and start instantly without registering.' },
        { icon: 'watermark', title: 'Watermarks', value: 'None', description: 'SoraFiles does not stamp a brand mark onto your result.' },
        { icon: 'original', title: 'Original overwritten', value: 'Never', description: 'Every workflow creates a separate downloadable file.' },
      ],
    },
    proofTitle: 'Built for privacy',
    proofItems: [
      'Files stay on this device, inside this browser, from selection to download.',
      'No registration, email, sign-in, or payment card.',
      'SoraFiles does not stamp a brand mark onto your result.',
      'Every tool creates a separate download. The original never changes.'
    ],
    explorerTitle: 'Find the right file tool.',
    explorerIntro: 'Search by task or format. Every result below is ready to use in your browser.',
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
    privacyTitle: 'How does SoraFiles process files without uploading them?',
    privacyIntro: 'Supported files are processed directly in your browser, so they do not need to be uploaded to a SoraFiles processing server. Your original stays on your device.',
    privacySteps: [
      { title: 'Select', text: 'The file opens on this device.' },
      { title: 'Process on your device', text: 'Your browser does the work.' },
      { title: 'Download', text: 'A new file; the original stays.' }
    ],
    contentTitle: 'Which SoraFiles workflow fits the job?',
    contentSections: [
      {
        heading: 'Compress for a real limit',
        paragraphs: [
          'Use Compress PDF when an email, application, or form rejects a large document. Choose a compression strength, then inspect the smaller copy. SoraFiles uses a safer method when it detects text or important document features.',
          'With Compress Images, choose a compression strength and compare the result before downloading. Original dimensions are retained. If encoding does not make the image smaller, SoraFiles returns the original file.'
        ]
      },
      {
        heading: 'Convert images and pages',
        paragraphs: [
          'The Image Converter accepts JPG, PNG, WebP, HEIC, HEIF, TIFF, and flattened PSD files, then creates a JPG, PNG, or WebP. For animated or multipage files, it uses the frame or page shown before conversion. Camera RAW and INDD files are not supported.',
          'PDF to JPG turns each PDF page into an image, while JPG to PDF combines JPG or PNG images into one document. When PDF to JPG creates several images, they are downloaded together in a ZIP.'
        ]
      },
      {
        heading: 'Organize PDF pages',
        paragraphs: [
          'Merge PDF joins documents in the order you select. Split PDF creates one PDF per page, and Rotate PDF fixes the direction of every page. These tools work on your device, though larger files can take longer.',
          'PDF to Word and Word to PDF aim to keep each page looking like the original. Their page content may not be editable. Text recognition for scans can vary with image quality, language, handwriting, and page layout.'
        ]
      }
    ],
    faqTitle: 'Frequently asked questions',
    faqs: [
      {
        question: 'Are my files uploaded to your servers?',
        answer: 'No. The available SoraFiles PDF, image, HEIC, and basic Word tools process file contents inside your browser. Your browser reads the selected file, performs the task on this device, and prepares a new result for download. File contents are not sent to a SoraFiles processing server.'
      },
      {
        question: 'Is SoraFiles really private? Do my files leave my device?',
        answer: 'Supported SoraFiles tools keep your file on your device from selection to download. Analytics may receive ordinary page-visit information, but not the contents of the files you process.'
      },
      {
        question: 'Is SoraFiles completely free? Are there limits or watermarks?',
        answer: 'The current tools are free and add no watermark. There is no paid download gate. Available memory, file size, and your browser can still limit what your device can process.'
      },
      {
        question: 'Do I need to create an account?',
        answer: 'No. Open a tool, choose a supported file, process it on your device, and download the result. No registration, sign-in, email address, trial, or payment card is required.'
      },
      {
        question: 'How does SoraFiles keep files on my device?',
        answer: 'Supported tools read and change the selected file directly in your browser, then prepare a new download. They do not send the file to a SoraFiles processing server.'
      },
      {
        question: 'Is it safe for sensitive or confidential documents?',
        answer: 'Supported files are not sent to SoraFiles for processing. You should still use a trusted, updated browser and device, protect the downloaded result, and follow any document-handling rules set by your school, workplace, client, or government.'
      },
      {
        question: 'Will compression reduce PDF or image quality?',
        answer: 'SoraFiles uses a safer method for documents with detected text or important features. Stronger compression can soften images in eligible PDFs. Keep the original and inspect the downloaded copy.'
      },
      {
        question: 'Can I compress a PDF without uploading it?',
        answer: 'Yes. Open Compress PDF, choose the document, and choose a compression strength. The PDF stays in your browser and the original is never overwritten.'
      },
      {
        question: 'How do I convert HEIC to JPG privately?',
        answer: 'Open HEIC to JPG or the Image Converter, choose an HEIC or HEIF photo, select JPG, and create the result. Decoding and conversion happen on your device. This is useful for converting iPhone photos without sending them to a file-conversion server.'
      },
      {
        question: 'What happens to my files when I close the page?',
        answer: 'Your browser keeps the file only while you work. When you clear the tool or close the page, SoraFiles has no server copy to retain or delete. Downloaded files remain wherever your browser saved them.'
      },
      {
        question: 'How is SoraFiles different from Smallpdf, iLovePDF, or Adobe?',
        answer: 'Supported SoraFiles tools work on your device without uploading the file to SoraFiles. They require no account, add no watermark, and leave the original unchanged. Other services have their own features and privacy policies, so compare the exact tool you plan to use.'
      }
    ],
  },
  tools: {
    'image-converter': {
      title: 'Image Converter', short: 'JPG, PNG, HEIC, TIFF & more', description: 'Convert everyday image formats to JPG, PNG, or WebP in one private workspace.',
      h1: 'Image Converter', intro: 'Convert everyday image formats to JPG, PNG, or WebP in one private workspace.', sectionTitle: 'How can you convert images without uploading them?', paragraphs: ['Choose a supported image and SoraFiles decodes it inside this browser, then creates a new JPG, PNG, or WebP download. The image converter is useful for everyday photos, transparent graphics, iPhone HEIC or HEIF photos, TIFF files, and flattened PSD previews.', 'JPG is usually the practical choice for photographs, PNG preserves transparency, and WebP is efficient for web use. Output does not retain every source feature: metadata is removed, animated or multipage inputs use a disclosed frame or page, and editable PSD layers are flattened.'], steps: ['Choose a supported image.', 'Select JPG, PNG, or WebP.', 'Convert locally, review the preview, and download the new image.'], note: 'Camera RAW and INDD files are not supported.', faqs: [{ question: 'Are images uploaded during conversion?', answer: 'No. Supported images are decoded and converted in this browser.' }, { question: 'Which output format should I choose?', answer: 'Use JPG for photographs and broad compatibility, PNG when transparency matters, or WebP for an efficient web image.' }]
    },
    'compress-image': {
      title: 'Compress Images', short: 'JPG, PNG, WebP & HEIC', description: 'Reduce image file size with an adjustable compression strength.',
      h1: 'Compress Images', intro: 'Reduce image file size with an adjustable compression strength.', sectionTitle: 'How can you compress an image to a useful file size?', paragraphs: ['The image compressor works locally with JPG, PNG, WebP, HEIC, and HEIF files. Choose a compression strength, then compare the preview and output size. Image dimensions are retained; if encoding does not reduce the file size, the original is returned.', 'Stronger settings may change fine detail in JPG and WebP images. PNG uses lossless encoding. Review text, faces, gradients, and transparent edges before downloading. Your original image is never overwritten.'], steps: ['Choose an image.', 'Choose a compression strength.', 'Review the preview and verified output size before downloading.'], note: 'An already efficient image may have little safe room to shrink without visible quality loss.', faqs: [{ question: 'Can I compress an image to a specific KB size?', answer: 'The current interface offers a strength slider, not an exact KB target. Check the resulting file size before downloading.' }, { question: 'Will image compression change the dimensions?', answer: 'No. This compressor retains the original pixel dimensions. Use Resize Image when you need different dimensions.' }]
    },
    'heic-to-jpg': {
      title: 'HEIC to JPG', short: 'iPhone photos anywhere', description: 'Turn an HEIC or HEIF photo into a widely compatible JPG.',
      h1: 'HEIC to JPG', intro: 'Turn an HEIC or HEIF photo into a widely compatible JPG.', sectionTitle: 'How can you convert an iPhone HEIC photo privately?', paragraphs: ['HEIC stores camera photos efficiently, but some forms, editors, and older devices still expect JPG. This HEIC to JPG converter decodes supported HEIC or HEIF photos on your device and creates a separate, widely compatible JPG.', 'You can review the photo and choose compression settings before download. The original HEIC remains unchanged, and no SoraFiles processing server receives the photo.'], steps: ['Choose an HEIC or HEIF photo.', 'Review the preview and compression setting.', 'Convert locally and download the JPG.'], note: 'Some unusual HEIC variants may not decode in every browser.', faqs: [{ question: 'Does the HEIC photo leave my device?', answer: 'No. Supported HEIC decoding and JPG encoding happen in this browser.' }, { question: 'Is the original iPhone photo changed?', answer: 'No. SoraFiles creates a separate JPG download.' }]
    },
    'compress-pdf': {
      title: 'Compress PDF', short: 'Smaller document', description: 'Reduce a PDF file size while keeping the document clear.',
      h1: 'Compress PDF', intro: 'Reduce a PDF file size on your device while keeping the document clear.', sectionTitle: 'How can you compress a PDF without uploading it?', paragraphs: ['SoraFiles reduces the file size while keeping the document clear. If stronger compression could affect important PDF features, it automatically uses a safer method. If the PDF is already efficient, SoraFiles keeps the original instead of creating a larger file.', 'At the highest strength, an optional smaller-file setting can soften images in eligible PDFs. Documents with detected text or important features use a safer method, and signed documents are kept unchanged.'], steps: ['Choose a PDF under the displayed safety limits.', 'Choose a safe compression strength.', 'Compress the PDF, review the result, and download a separate copy.'], note: 'Stronger image compression can reduce detail. Keep the original and check the downloaded copy before sharing.', faqs: [{ question: 'Is the PDF sent to a compression server?', answer: 'No. Your PDF is processed on this device.' }, { question: 'Does compression preserve selectable text?', answer: 'SoraFiles uses a safer method for documents with detected text or important features. Check text selection and any features you need in the downloaded copy.' }]
    },
    'merge-pdf': {
      title: 'Merge PDF', short: 'Combine documents', description: 'Join PDF files in the order you select and download one new document.',
      h1: 'Merge PDF', intro: 'Join PDF files in the order you select and download one new document.', sectionTitle: 'How can you combine PDF files in the right order?', paragraphs: ['Add two or more PDFs, review their order in the workspace, and move files before processing when needed. The merge PDF tool copies pages into one new document locally, without uploading the source files or changing them.', 'The downloaded PDF is validated before it is offered. Encrypted or damaged documents may need to be unlocked or repaired first, and very large jobs remain limited by the memory available on your device.'], steps: ['Choose two or more PDFs.', 'Reorder the files in the workspace.', 'Merge locally and verify the combined download.'], note: 'The displayed file order becomes the output order.', faqs: [{ question: 'Can I change the PDF order before merging?', answer: 'Yes. Use the reorder controls in the workspace before creating the combined PDF.' }, { question: 'Are merged PDFs uploaded?', answer: 'No. Supported PDFs are combined in this browser.' }]
    },
    'split-pdf': {
      title: 'Split PDF', short: 'One file per page', description: 'Separate every PDF page into its own file and download one ZIP.',
      h1: 'Split PDF', intro: 'Separate every PDF page into its own file and download one ZIP.', sectionTitle: 'How can you split selected PDF pages?', paragraphs: ['Open a PDF in the page workspace, select all pages or enter a page range, and create one PDF for each selected page. The split PDF results are bundled in a ZIP so the browser can download them together reliably.', 'Page thumbnails and selection controls run locally. Each output is a separate PDF, the original document remains unchanged, and no page content is sent to a SoraFiles processing server.'], steps: ['Choose one PDF.', 'Select pages visually or enter a page range.', 'Split locally and download the page PDFs in one ZIP.'], note: 'Long, image-heavy documents can use substantial browser memory.', faqs: [{ question: 'Can I split only selected pages?', answer: 'Yes. Select thumbnails or enter a supported range such as 1,3-5.' }, { question: 'Why is the result a ZIP file?', answer: 'A ZIP lets the browser deliver multiple page PDFs in one reliable download.' }]
    },
    'rotate-pdf': {
      title: 'Rotate PDF', short: 'Fix page direction', description: 'Rotate every PDF page by 90°, 180°, or 270°.',
      h1: 'Rotate PDF', intro: 'Rotate every PDF page by 90°, 180°, or 270°.', sectionTitle: 'How can you fix sideways PDF pages?', paragraphs: ['Choose the page thumbnails that need correction, then rotate them left or right in the visual workspace. Text, images, and other page content stay intact.', 'You can apply rotation to selected pages and inspect the thumbnail direction before creating the result. The tool saves a separate PDF and leaves the original document untouched.'], steps: ['Choose a PDF.', 'Select the pages and rotate them left or right.', 'Review the orientations and download the new PDF.'], note: 'Always inspect mixed-orientation documents before replacing an existing copy.', faqs: [{ question: 'Can I rotate individual PDF pages?', answer: 'Yes. Select the page thumbnails you want to rotate before applying the direction.' }, { question: 'Does rotation turn pages into images?', answer: 'No. It changes the page direction while keeping the page content intact.' }]
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
      h1: 'JPG to PDF', intro: 'Turn one or more JPG or PNG images into a single PDF.', sectionTitle: 'How can you combine images into one PDF?', paragraphs: ['Add one or more JPG or PNG images and arrange them in the order the PDF should use. The JPG to PDF tool creates a new document in your browser, which is useful for receipts, notes, forms, or photographed pages.', 'Large camera photos can produce a large PDF because the image data must be embedded. If a strict upload limit applies, compress or resize the images first, then inspect the finished PDF before submitting it.'], steps: ['Choose one or more JPG or PNG images.', 'Review and reorder the image list.', 'Create the PDF locally and download it.'], note: 'The source images are not changed or deleted.', faqs: [{ question: 'Can I combine multiple JPG files into one PDF?', answer: 'Yes. Choose multiple supported images and arrange them before creating the PDF.' }, { question: 'Are the images uploaded?', answer: 'No. The PDF is assembled in this browser.' }]
    },
    'pdf-to-jpg': {
      title: 'PDF to JPG', short: 'Pages into images', description: 'Render every PDF page as a JPG and download multiple pages in a ZIP.',
      h1: 'PDF to JPG', intro: 'Render every PDF page as a JPG and download multiple pages in a ZIP.', sectionTitle: 'How can you convert PDF pages to JPG images?', paragraphs: ['Select the PDF pages you need and choose the image quality. The PDF to JPG tool renders those pages locally as numbered JPG files, then packages multiple results in a ZIP for one download.', 'A JPG preserves the visible appearance of a page but not selectable text, links, form fields, or accessibility structure. Use it for previews and image-only submission systems, and retain the original PDF when document structure matters.'], steps: ['Choose a PDF.', 'Select pages and image quality.', 'Render locally and download the JPG files.'], note: 'Long PDFs and high-resolution rendering require more device memory.', faqs: [{ question: 'Can I convert only certain PDF pages?', answer: 'Yes. Use the thumbnail or range controls before conversion.' }, { question: 'Will text remain selectable in the JPG?', answer: 'No. JPG is an image of the page, not an editable document.' }]
    },
    'pdf-to-word': {
      title: 'PDF to Word', short: 'Choose editable text or visual pages', description: 'Convert a PDF to DOCX on your device. Choose editable text with layout changes or visual pages that preserve appearance as images.',
      h1: 'PDF to Word', intro: 'Create a DOCX with editable text or page images, without uploading your PDF.', sectionTitle: 'Choose the Word output you need', paragraphs: ['Editable output extracts text and reconstructs paragraphs, headings, lists, and simple tables. Scanned pages may need OCR. Fonts, spacing, reading order, and layout can change.', 'Visual output places a rendered image of each PDF page on a Word page. It prioritizes appearance, but the page text is not editable.'], steps: ['Choose a PDF.', 'Choose editable text or visual pages.', 'Convert and inspect the downloaded DOCX.'], note: 'Keep the original. Review complex tables and any recognized text before relying on the result.', faqs: [{ question: 'Will the Word file look like the PDF?', answer: 'Visual output aims to retain the page appearance as images. Editable output can change the layout; review either result.' }, { question: 'Can I edit its text?', answer: 'Choose editable output to revise the extracted or recognized text. Visual output contains page images instead of editable paragraphs.' }]
    },
    'word-to-pdf': {
      title: 'Word to PDF', short: 'Preserve the Word layout', description: 'Render DOCX pages with their fonts, spacing, images, tables, headers, and footers into PDF.',
      h1: 'Word to PDF with high visual fidelity', intro: 'Render a DOCX page by page in your browser and preserve its appearance in PDF.', sectionTitle: 'How high-fidelity Word to PDF works', paragraphs: ['SoraFiles uses a local DOCX renderer for fonts, images, tables, headers, footers, spacing, and page geometry.', 'Each rendered page is preserved in the PDF as a lossless visual, so its text is not selectable. Word-only features can still vary from Microsoft Word.'], steps: ['Choose a DOCX file.', 'Render its pages locally.', 'Download the visual-fidelity PDF and verify it.'], note: 'The PDF prioritizes appearance. Its pages are flattened, so text is not selectable and Word-only rendering features may differ.', faqs: [{ question: 'Are images and layout preserved?', answer: 'Supported DOCX images, tables, spacing, headers, footers, and fonts are rendered locally.' }, { question: 'Can I select the PDF text?', answer: 'No. The pages are preserved as lossless visuals to avoid text-only conversion damage.' }]
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
        { heading: 'Core libraries', paragraphs: ['PDF.js, pdf-lib, qpdf WebAssembly (ISC), GhostPDL/Ghostscript WebAssembly (AGPL-3.0-or-later), jSquash MozJPEG/OxiPNG/WebP codecs (Apache-2.0), jsPDF, Mammoth.js, docx, fflate, libheif, UTIF, and ag-psd power supported PDF, document, archive, HEIC, TIFF, and PSD workflows. Each library remains subject to its respective upstream license and copyright terms.'] },
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
