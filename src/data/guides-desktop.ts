import type { Guide, GuideBlock } from './guides';

// Owner-approved V10 guide topics. No publication/review dates were supplied;
// omitted dates must remain absent in the visible byline and Article schema.
const h = (id: string, text: string): GuideBlock => ({ type: 'heading', level: 2, id, text });
const p = (text: string): GuideBlock => ({ type: 'paragraph', text });
const link = (text: string, href: string, label: string): GuideBlock => ({ type: 'linked-paragraph', parts: [text, { text: label, href }, '.'] });
const list = (items: string[], ordered = false): GuideBlock => ({ type: 'list', items, ordered });
const make = (slug: string, title: string, description: string, introduction: string, body: GuideBlock[], relatedGuides: string[]): Guide => ({
  slug, title, description, introduction, body, relatedGuides,
  primaryQuery: title.replace(/\?$/, ''), secondaryQueries: [], searchIntent: `Learn ${slug}`, funnelStage: 'consideration',
  category: 'SoraFiles Desktop', tags: ['Desktop'], relatedTools: [],
  author: { name: 'Sora Labs', type: 'Organization', url: 'https://sorafiles.com/about' },
  publisher: { name: 'Sora Labs', url: 'https://sorafiles.com/' },
  status: 'published', indexable: true, locale: 'en', canonical: `https://sorafiles.com/guides/${slug}`,
  references: [{ title: 'SoraFiles Desktop Help', url: 'https://sorafiles.com/desktop/help' }],
});

export const desktopGuides: Guide[] = [
  make('what-is-sorafiles-desktop', 'What is SoraFiles Desktop?',
    'An introduction to the desktop companion for local PDF and image work, including its file-manager actions and how it fits beside SoraFiles Web.',
    'SoraFiles Desktop is the desktop companion to the free SoraFiles web app. It lets you work with supported PDFs and images on your computer, including actions started directly from your file manager.', [
      h('who-its-for', 'Who it is for'), p('Desktop suits repeated file work: compressing scans, converting images or working through a batch without choosing the same files again in a browser. For occasional work, SoraFiles Web remains free and needs no installation.'),
      h('what-it-does', 'What it does'), list(['Start from the app or from Edit with SoraFiles in a supported file manager.', 'See actions relevant to the files you selected.', 'Process a supported file or batch on your computer.', 'Save new output files beside the originals, or use another output location in Settings.']),
      h('platforms', 'Choosing a platform build'), link('Packages are available for Windows, macOS and Linux. Choose the architecture and format for your computer, and check the current platform requirements on ', '/desktop/download', 'Downloads'),
      h('web-stays-free', 'SoraFiles Web stays free'), p('Desktop does not replace the web app. Some capabilities differ between them: Unlock PDF is available on the web only. You can use both products.'),
      h('plans', 'Plans and trial'), link('Desktop has a seven-day trial. Personal covers one active device; Team covers up to five. Current prices and billing periods are on ', '/desktop/pricing', 'Pricing'),
    ], ['how-sorafiles-desktop-works', 'getting-started-with-sorafiles-desktop', 'sorafiles-web-vs-desktop']),
  make('how-sorafiles-desktop-works', 'How SoraFiles Desktop works',
    'Follow a supported file from selection through Edit with SoraFiles to a new result, with practical notes on options and batches.',
    'Start with the files you already have. SoraFiles chooses the available actions from your selection and processes supported work on your computer.', [
      h('the-flow', 'From selection to saved file'), list(['Select one or more compatible files in your file manager.', 'Right-click and choose Edit with SoraFiles.', 'Choose a relevant action.', 'Set any options the action needs, then run it.', 'Find the new output beside your originals, unless you selected another output location.'], true),
      h('options', 'Quick actions and options'), p('Actions with ready-to-use defaults can run directly. When an action needs your choices, SoraFiles presents its controls with your files already selected.'), link('The interface can differ between installed versions. Published changes are listed in the ', '/desktop/releases', 'release notes'),
      h('batches', 'Several files at once'), p('Batch-compatible actions accept several supported files. Actions such as merging also depend on the number and type of selected files. The available menu changes with that selection.'),
      h('results', 'Where results go'), p('Results are new files. The default output location is beside the source files; Settings lets you choose another location. Keep the originals until you have checked the results.'),
      h('local', 'Processing stays on your computer'), p('Supported Desktop processing runs locally. Setup, activation and online services still need a connection.'),
    ], ['use-sorafiles-from-your-file-manager', 'getting-started-with-sorafiles-desktop', 'using-sorafiles-desktop-offline']),
  make('getting-started-with-sorafiles-desktop', 'Getting started with SoraFiles Desktop',
    'Choose a package, finish setup, understand the automatic trial and run your first supported file action.',
    'Use an internet connection for setup and activation. Once setup is complete, supported file processing works offline.', [
      h('download', '1. Download the right build'), link('Choose the installer for your operating system and processor from ', '/desktop/download', 'Downloads'), p('Use the package metadata and checksum shown for that release. Follow the platform-specific installation guidance if your operating system asks you to approve the app.'),
      h('install', '2. Install and finish setup'), link('Run the Windows installer, copy the macOS app from its DMG into Applications, or use the Linux package for your system. Open the app and check the integration status in Settings. Installation details are in ', '/desktop/help', 'Desktop Help'),
      h('trial', '3. Use the automatic trial'), p('The seven-day trial starts during Windows installation. For portable packages such as macOS DMG and Linux AppImage, it starts on first launch. There is no separate trial activation button. The License screen shows your current access.'),
      h('first-action', '4. Run your first action'), list(['Select a supported file, such as a PDF.', 'Right-click and find Edit with SoraFiles.', 'Choose an available action and complete any required options.', 'Check the new output file.'], true),
      h('activate', '5. Activate your purchase'), p('To continue after the trial, open License in SoraFiles Desktop and enter the key from your purchase email. Check Spam or Junk if the message is missing. Keep the key private.'), link('Personal and Team options are listed on ', '/desktop/pricing', 'Pricing'),
    ], ['use-sorafiles-from-your-file-manager', 'how-sorafiles-desktop-works', 'using-sorafiles-desktop-offline']),
  make('use-sorafiles-from-your-file-manager', 'Use SoraFiles from your file manager',
    'Find relevant Edit with SoraFiles actions for selected files and check native integration when a menu is unavailable.',
    'With file-manager integration enabled, you can start supported work from the selection in your file manager.', [
      h('basics', 'The basics'), list(['Select the files you want to use.', 'Right-click the selection.', 'Choose Edit with SoraFiles.', 'Pick an action and set any options it requires.'], true),
      h('relevant-actions', 'Only the actions that fit'), p('The available actions depend on file types, the number of selected files and the capabilities of the installed build. A single PDF and several images may produce different menus. Unlock PDF is a web-only tool.'),
      h('batches', 'Several files at once'), p('Select compatible files together for a batch-compatible action. Merge PDF needs multiple PDFs; conversion and compression actions follow the selection limits shown by the app.'),
      h('platforms', 'Check integration on your computer'), p('Windows, macOS and Linux expose file actions differently. Open Settings in SoraFiles Desktop to check or repair integration for your platform. On macOS, verify setup and the enabled file actions there after installation.'),
      h('missing-menu', 'If the menu is missing'), link('Confirm that the app is installed, its integration is enabled and the selected file type is supported. Use the platform-specific troubleshooting steps in ', '/desktop/help', 'Desktop Help'), p('You can also select files inside the Desktop app or use the free web tools while resolving a file-manager issue.'),
    ], ['how-sorafiles-desktop-works', 'getting-started-with-sorafiles-desktop', 'sorafiles-web-vs-desktop']),
  make('sorafiles-web-vs-desktop', 'SoraFiles Web vs SoraFiles Desktop',
    'Compare the free browser tools with the Desktop app by workflow, installation, file-manager access and local processing.',
    'Both products process supported files on your device. Choose based on where you want to start and which workflow you need.', [
      h('comparison', 'At a glance'), { type: 'table', caption: 'Web and Desktop workflows', headers: ['Feature', 'SoraFiles Web', 'SoraFiles Desktop'], rows: [
        ['Access', 'Free browser tools', 'Paid app with a seven-day trial'], ['Installation', 'No installation', 'Choose a package for your computer'], ['Start a task', 'Open a tool and select files', 'Use the app or a supported file-manager action'], ['Processing', 'Locally in the browser', 'Locally on the computer'], ['Unlock PDF', 'Available', 'Not included'], ['Offline use', 'Availability depends on loaded tool assets', 'Works offline after setup with valid access'],
      ] },
      h('web', 'When the web app fits'), list(['You need a tool occasionally.', 'You cannot install an application on the computer.', 'You are using a phone or tablet.', 'You need a web-only tool such as Unlock PDF.']),
      h('desktop', 'When Desktop fits'), list(['You often repeat PDF or image work.', 'You want to begin with files selected in your file manager.', 'You use supported batch actions regularly.']),
      h('both', 'Use both when useful'), link('SoraFiles Web stays free whether or not you buy Desktop. Browse the available ', '/tools', 'web tools'), link('See current Desktop plans on ', '/desktop/pricing', 'Pricing'),
    ], ['what-is-sorafiles-desktop', 'how-sorafiles-desktop-works']),
  make('using-sorafiles-desktop-offline', 'Using SoraFiles Desktop offline',
    'Understand local processing after setup, the services that need a connection and how the app shows trial or license access.',
    'SoraFiles Desktop works offline after setup. Your files stay on your computer for supported local processing.', [
      h('offline', 'What works offline'), p('Installed local processing tools can work without uploading your files. Finish setup and any required component downloads before you disconnect.'),
      h('online', 'What needs a connection'), list(['Downloading and setting up the app or required components.', 'Activating a license or completing a purchase.', 'Verifying purchaser email and paying for a device replacement.', 'Checking for available releases and other online services.']),
      h('access', 'Check your access before disconnecting'), p('The License screen shows the trial or license state available on this computer. A seven-day trial does not restart when you go offline. Monthly and Annual access follow the paid period; Lifetime access has no time-based expiry.'),
      h('expired', 'When access ends'), p('Processing requires a valid trial or license. Settings and license options remain available so you can reconnect and resolve access when needed.'),
      h('help', 'If a tool cannot run offline'), link('Reconnect to complete missing setup or activation, then check the status in the app. For installation and access guidance, use ', '/desktop/help', 'Desktop Help'),
    ], ['what-local-file-processing-means', 'getting-started-with-sorafiles-desktop', 'what-is-sorafiles-desktop']),
];
