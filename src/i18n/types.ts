import type { PublicToolSlug } from '../data/tools';

export interface LocalizedFaq {
  question: string;
  answer: string;
}

export interface LocalizedToolCopy {
  title: string;
  short: string;
  description: string;
  h1: string;
  intro: string;
  sectionTitle: string;
  paragraphs: string[];
  steps: string[];
  note: string;
  faqs: LocalizedFaq[];
}

export interface LocalizedInfoPage {
  title: string;
  description: string;
  h1: string;
  intro: string;
  updated?: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
}

export interface PrivacyProofItem {
  icon: 'device' | 'account' | 'watermark' | 'original';
  title: string;
  value: string;
  description: string;
}

export interface HomePrivacyProof {
  eyebrow: string;
  title: string;
  intro: string;
  items: [PrivacyProofItem, PrivacyProofItem, PrivacyProofItem, PrivacyProofItem];
}

export interface LocaleContent {
  common: {
    skipToContent: string;
    openTool: string;
    theme: string;
    system: string;
    dark: string;
    light: string;
    allTools: string;
    compress: string;
    merge: string;
    split: string;
    convert: string;
    edit: string;
    more: string;
    api: string;
    changelog: string;
    images: string;
    pdf: string;
    about: string;
    contact: string;
    menu: string;
    tools: string;
    information: string;
    imageConverter: string;
    compressImages: string;
    compressPdf: string;
    mergePdf: string;
    privacy: string;
    terms: string;
    openSource: string;
    footerPromise: string;
    footerTagline: string;
    language: string;
    languageHelp: string;
    planned: string;
    reviewed: string;
    viewIn: string;
    stayHere: string;
    instantAccess: string;
    noAccount: string;
    noWatermark: string;
    localProcessing: string;
    supportedFormats: string;
    verifiedScope: string;
    stable: string;
    basic: string;
    limitations: string;
    relatedTools: string;
    home: string;
    toolControlsEnglish: string;
  };
  home: {
    title: string;
    description: string;
    h1: string;
    intro: string;
    primaryAction: string;
    privacyProof: HomePrivacyProof;
    proofTitle: string;
    proofItems: string[];
    explorerTitle: string;
    explorerIntro: string;
    searchLabel: string;
    searchPlaceholder: string;
    categories: Record<'all' | 'image' | 'compress' | 'convert' | 'organize', string>;
    noResults: string;
    clearSearch: string;
    privacyTitle: string;
    privacyIntro: string;
    privacySteps: Array<{ title: string; text: string }>;
    contentTitle: string;
    contentSections: Array<{ heading: string; paragraphs: string[] }>;
    faqTitle: string;
    faqs: LocalizedFaq[];
  };
  tools: Record<PublicToolSlug, LocalizedToolCopy>;
  pages: {
    about: LocalizedInfoPage;
    privacy: LocalizedInfoPage;
    terms: LocalizedInfoPage;
    openSource: LocalizedInfoPage;
    contact: LocalizedInfoPage & {
      form: {
        name: string;
        email: string;
        subject: string;
        message: string;
        attachment: string;
        optional: string;
        subjects: string[];
        attachmentHelp: string;
        consent: string;
        send: string;
        sending: string;
        success: string;
        caution: string;
      };
    };
  };
}
