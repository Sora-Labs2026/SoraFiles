import { tools } from '../data/tools';
import type { LocaleContent, LocalizedInfoPage, LocalizedToolCopy } from './types';

type ToolSeed = Record<(typeof tools)[number]['slug'], { title: string; short: string; description: string; note?: string }>;

interface ToolTemplateSeed {
  h1: string;
  intro: string;
  sectionTitle: string;
  paragraphs: string[];
  steps: string[];
  note: string;
  faqs: Array<{ question: string; answer: string }>;
}

export interface LocaleSeed {
  common: LocaleContent['common'];
  home: LocaleContent['home'] & {
    popularTitle: string;
    popularIntro: string;
    searchExamplesLabel: string;
    searchExamples: [string, string, string];
    resultCount: string;
    searchAliases: LocaleContent['home']['searchAliases'];
  };
  toolNames: ToolSeed;
  toolTemplate: ToolTemplateSeed;
  pages: LocaleContent['pages'];
}

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

export function createLocaleContent(seed: LocaleSeed): LocaleContent {
  const localizedTools = Object.fromEntries(tools.map((tool) => {
    const names = seed.toolNames[tool.slug];
    const values = {
      tool: names.title,
      short: names.short,
      description: names.description,
      formats: tool.formats.join(', '),
    };
    const copy: LocalizedToolCopy = {
      title: names.title,
      short: names.short,
      description: names.description,
      h1: interpolate(seed.toolTemplate.h1, values),
      intro: interpolate(seed.toolTemplate.intro, values),
      sectionTitle: interpolate(seed.toolTemplate.sectionTitle, values),
      paragraphs: seed.toolTemplate.paragraphs.map((item) => interpolate(item, values)),
      steps: seed.toolTemplate.steps.map((item) => interpolate(item, values)),
      note: names.note ?? interpolate(seed.toolTemplate.note, values),
      faqs: seed.toolTemplate.faqs.map((item) => ({
        question: interpolate(item.question, values),
        answer: interpolate(item.answer, values),
      })),
    };
    return [tool.slug, copy];
  })) as LocaleContent['tools'];

  return { common: seed.common, home: seed.home, tools: localizedTools, pages: seed.pages };
}

export type { LocalizedInfoPage };
