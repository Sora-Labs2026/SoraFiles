import { guideCategories, guideStatuses, guidePath, isIndexableGuide, type Guide } from '../data/guides.ts';
import { liveTools } from '../data/liveTools.ts';
export const normalizeTopic = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const words = (text: string) => new Set(normalizeTopic(text).split(' ').filter(Boolean));
const overlap = (a: string, b: string) => { const left = words(a), right = words(b); return [...left].filter(w => right.has(w)).length / Math.max(1, new Set([...left, ...right]).size); };
export function safeGuideUrl(value: string) {
  if (/[\u0000-\u0020\u007f]/.test(value) || value.includes('\\')) return false;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
export function validateGuides(registry: Guide[], assetExists: (path: string) => boolean = () => true) {
  const errors: string[] = [], warnings: string[] = [];
  const ids = new Set(liveTools.map(t => t.id)), slugs = new Set(registry.map(g => g.slug));
  const indexes = new Map<string, Set<string>>();
  const dateValid = (v: string) => /^\d{4}-\d{2}-\d{2}(?:T.*Z)?$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v.slice(0, 10);
  for (const g of registry) {
    const error = (message: string) => errors.push(`${g.slug || '(missing slug)'}: ${message}`);
    const warn = (message: string) => warnings.push(`${g.slug}: ${message}`);
    for (const field of ['title', 'slug', 'description', 'primaryQuery', 'searchIntent', 'canonical'] as const) if (!g[field]?.trim()) error(`missing ${field}`);
    for (const field of ['slug', 'canonical', 'title', 'primaryQuery', 'description'] as const) {
      const key = field === 'canonical' || field === 'slug' ? g[field] : normalizeTopic(g[field] || '');
      const seen = indexes.get(field) ?? new Set<string>();
      if (seen.has(key)) error(`duplicate ${field}`);
      seen.add(key); indexes.set(field, seen);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(g.slug)) error('slug must be URL-safe lowercase words');
    if (g.canonical !== `https://sorafiles.com${guidePath(g.slug)}`) error('canonical must use exact production URL without query or fragment');
    if (!guideCategories.includes(g.category)) error('invalid category');
    if (!guideStatuses.includes(g.status)) error('invalid status');
    if (!g.author?.name?.trim() || !['Person', 'Organization'].includes(g.author?.type)) error('real author identity required');
    if (g.author?.url && !safeGuideUrl(g.author.url)) error('unsafe author URL');
    if (g.publisher?.name !== 'Sora Labs' || g.publisher?.url !== 'https://sorafiles.com/') error('publisher must be Sora Labs at production origin');
    if (g.locale !== 'en') error('only real English guides are currently supported');
    if (g.indexable && g.status !== 'published') error('only published guides may be indexable');
    if (g.status === 'published' && (!g.introduction?.trim() || !g.body.length)) error('published guide needs introduction and body');
    for (const field of ['publishedAt', 'modifiedAt', 'reviewedAt'] as const) if (g[field] && !dateValid(g[field]!)) error(`invalid ${field}`);
    if (g.publishedAt) for (const field of ['modifiedAt', 'reviewedAt'] as const) if (g[field] && Date.parse(g[field]!) < Date.parse(g.publishedAt)) error(`${field} precedes publication`);
    for (const id of [g.targetTool, ...g.relatedTools].filter(Boolean)) if (!ids.has(id!)) error(`unknown tool ${id}`);
    for (const slug of [...g.relatedGuides, ...(g.translationOf ? [g.translationOf] : [])]) if (!slugs.has(slug) || slug === g.slug) error(`invalid guide reference ${slug}`);
    if (isIndexableGuide(g) && !g.targetTool && !g.relatedTools.length && !registry.some(other => isIndexableGuide(other) && other.relatedGuides.includes(g.slug))) warn('no contextual inbound relationships; only the guide hub links here');
    for (const ref of g.references) if (!ref.title?.trim() || !safeGuideUrl(ref.url)) error('reference requires title and safe URL');
    if (g.socialImage && (!safeGuideUrl(g.socialImage) || (g.socialImage.startsWith('/') && !assetExists(g.socialImage)))) error('social image must resolve to a real safe asset');
    let level = 1; const headings = new Set<string>();
    for (const block of g.body) {
      if (block.type === 'linked-paragraph' && (!block.parts.length || block.parts.some(part => typeof part !== 'string' && (!part.text.trim() || !safeGuideUrl(part.href))))) error('linked paragraph requires text and safe URLs');
      if (block.type === 'heading') {
        if (![2, 3].includes(block.level) || block.level > level + 1 || !block.text.trim()) error('invalid heading structure; template owns H1');
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(block.id) || headings.has(block.id)) error('heading IDs must be unique and URL-safe');
        headings.add(block.id); level = block.level;
      }
      if (block.type === 'image' && (!block.alt?.trim() || !safeGuideUrl(block.src) || (block.src.startsWith('/') && !assetExists(block.src)) || !(block.width > 0 && block.height > 0))) error('image requires alt text, real source and dimensions');
      if (block.type === 'table' && (!block.caption?.trim() || !block.headers.length || block.rows.some(row => row.length !== block.headers.length))) error('table requires caption and consistent columns');
    }
    for (const tool of liveTools) if (normalizeTopic(g.primaryQuery) === normalizeTopic(tool.name) || overlap(g.primaryQuery, tool.name) >= .7) warn(`possible tool-page intent conflict with /${tool.slug}`);
  }
  for (let i = 0; i < registry.length; i++) for (const b of registry.slice(i + 1)) {
    const a = registry[i];
    if (overlap(a.title, b.title) >= .7 || overlap(a.primaryQuery, b.primaryQuery) >= .6 || (a.searchIntent === b.searchIntent && a.targetTool && a.targetTool === b.targetTool)) warnings.push(`${a.slug} / ${b.slug}: possible topic or intent overlap; editorial review required`);
  }
  return { errors, warnings };
}
