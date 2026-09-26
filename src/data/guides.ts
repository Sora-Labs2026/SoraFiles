import { firstGuides } from './guides-first-batch.ts';
import { desktopGuides } from './guides-desktop.ts';
export const guideCategories = ['SoraFiles Desktop', 'PDF', 'Images', 'Privacy & Security', 'Troubleshooting', 'File Formats'] as const;
export const guideStatuses = ['idea', 'brief', 'draft', 'review', 'approved', 'published', 'archived'] as const;
export type GuideBlock =
  | { type: 'heading'; level: 2 | 3; text: string; id: string }
  | { type: 'paragraph' | 'callout'; text: string }
  | { type: 'linked-paragraph'; parts: (string | { text: string; href: string })[] }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][]; caption: string }
  | { type: 'image'; src: string; alt: string; width: number; height: number; caption?: string };
export interface Guide {
  slug: string; title: string; description: string;
  primaryQuery: string; secondaryQueries: string[]; searchIntent: string; funnelStage: string;
  category: typeof guideCategories[number]; tags: string[];
  targetTool?: string; relatedTools: string[]; relatedGuides: string[];
  author: { name: string; type: 'Person' | 'Organization'; url?: string };
  publisher: { name: 'Sora Labs'; url: 'https://sorafiles.com/' };
  status: typeof guideStatuses[number]; publishedAt?: string; modifiedAt?: string; reviewedAt?: string;
  canonical: string; socialImage?: string; indexable: boolean;
  references: { title: string; url: string }[];
  locale: string; translationOf?: string; introduction: string; body: GuideBlock[];
}
// Both batches were explicitly commissioned by the site owner; Desktop dates are unknown.
export const guides: Guide[] = [...desktopGuides, ...firstGuides];
export const guidePath = (slug: string) => `/guides/${slug}`;
export const isPublicGuide = (g: Guide) => g.status === 'published' && g.locale === 'en';
export const isIndexableGuide = (g: Guide) => isPublicGuide(g) && g.indexable === true;
export const publishedGuides = (registry: Guide[] = guides) => registry.filter(isIndexableGuide);
export const relatedGuidesForTool = (id: string, registry: Guide[] = guides) => publishedGuides(registry).filter(g => g.targetTool === id || g.relatedTools.includes(id));
export const guideSitemapUrls = (registry: Guide[] = guides) => publishedGuides(registry).length ? ['https://sorafiles.com/guides', ...publishedGuides(registry).map(g => g.canonical)] : [];
export function guideSchema(g: Guide) {
  return [{
    '@context': 'https://schema.org', '@type': 'Article', '@id': `${g.canonical}#article`,
    headline: g.title, description: g.description, url: g.canonical, mainEntityOfPage: g.canonical, inLanguage: g.locale,
    author: { '@type': g.author.type, name: g.author.name, ...(g.author.url ? { url: g.author.url } : {}) },
    publisher: { '@type': 'Organization', '@id': 'https://sorafiles.com/#organization', name: g.publisher.name, url: g.publisher.url },
    ...(g.publishedAt ? { datePublished: g.publishedAt } : {}), ...(g.modifiedAt ? { dateModified: g.modifiedAt } : {}),
    ...(g.socialImage ? { image: new URL(g.socialImage, 'https://sorafiles.com').href } : {}),
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://sorafiles.com/' },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: 'https://sorafiles.com/guides' },
      { '@type': 'ListItem', position: 3, name: g.title, item: g.canonical },
    ],
  }];
}
