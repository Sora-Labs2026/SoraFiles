import { createLocaleContent, type LocaleSeed } from './factory';
import type { LocaleContent } from './types';

type ToolNames = LocaleSeed['toolNames'];

export interface CompactLocaleSeed {
  common: LocaleContent['common'];
  home: {
    title: string; description: string; h1: string; intro: string; action: string;
    privacyProof: LocaleContent['home']['privacyProof'];
    proofTitle: string; proof: [string, string, string];
    explorerTitle: string; explorerIntro: string; searchLabel: string; searchPlaceholder: string;
    categories: LocaleContent['home']['categories']; noResults: string; clearSearch: string;
    privacyTitle: string; privacyIntro: string;
    privacySteps: [{ title: string; text: string }, { title: string; text: string }, { title: string; text: string }];
    contentTitle: string;
    sections: Array<{ heading: string; paragraphs: string[] }>;
    faqTitle: string; faqs: LocaleContent['home']['faqs'];
  };
  toolNames: ToolNames;
  toolTemplate: LocaleSeed['toolTemplate'];
  pages: LocaleContent['pages'];
}

export function createCompactLocale(seed: CompactLocaleSeed): LocaleContent {
  return createLocaleContent({
    common: seed.common,
    home: {
      title: seed.home.title,
      description: seed.home.description,
      h1: seed.home.h1,
      intro: seed.home.intro,
      primaryAction: seed.home.action,
      privacyProof: seed.home.privacyProof,
      proofTitle: seed.home.proofTitle,
      proofItems: seed.home.proof,
      explorerTitle: seed.home.explorerTitle,
      explorerIntro: seed.home.explorerIntro,
      searchLabel: seed.home.searchLabel,
      searchPlaceholder: seed.home.searchPlaceholder,
      categories: seed.home.categories,
      noResults: seed.home.noResults,
      clearSearch: seed.home.clearSearch,
      privacyTitle: seed.home.privacyTitle,
      privacyIntro: seed.home.privacyIntro,
      privacySteps: seed.home.privacySteps,
      contentTitle: seed.home.contentTitle,
      contentSections: seed.home.sections,
      faqTitle: seed.home.faqTitle,
      faqs: seed.home.faqs,
    },
    toolNames: seed.toolNames,
    toolTemplate: seed.toolTemplate,
    pages: seed.pages,
  });
}
