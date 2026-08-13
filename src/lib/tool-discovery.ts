import type { PublicToolSlug, ToolCategory } from '../data/tools';

export interface DiscoveryEntry {
  slug: PublicToolSlug;
  category: ToolCategory;
  searchText: string;
}

export type DiscoveryCategory = 'all' | ToolCategory;

export const popularWorkflowSlugs = [
  'compress-pdf',
  'compress-image',
  'image-converter',
  'merge-pdf',
  'pdf-to-jpg',
  'jpg-to-pdf',
] as const satisfies readonly PublicToolSlug[];

export function normalizeDiscoveryText(value: string, locale: string): string {
  return value
    .toLocaleLowerCase(locale)
    .normalize('NFKD')
    .replace(/(\p{Script=Latin})\p{M}+/gu, '$1')
    .replace(/\p{P}+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function buildDiscoveryText(values: readonly string[], locale: string): string {
  return normalizeDiscoveryText(values.join(' '), locale);
}

export function matchesDiscoveryQuery(searchText: string, query: string, locale: string): boolean {
  const normalizedSearchText = normalizeDiscoveryText(searchText, locale);
  const queryTokens = normalizeDiscoveryText(query, locale).split(' ').filter(Boolean);

  return queryTokens.every((token) => normalizedSearchText.includes(token));
}

export function matchesDiscoveryFilter(
  entry: DiscoveryEntry,
  query: string,
  category: DiscoveryCategory,
  locale: string,
): boolean {
  return (category === 'all' || entry.category === category)
    && matchesDiscoveryQuery(entry.searchText, query, locale);
}

export function formatResultCount(template: string, count: number): string {
  return template.replaceAll('{count}', String(count));
}
