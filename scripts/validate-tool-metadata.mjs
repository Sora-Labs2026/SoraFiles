import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { liveTools } from '../src/data/liveTools.ts';
import { BOOTSTRAP_POPULAR_TOOL_IDS, PUBLISHED_TOOL_IDS } from '../src/data/popularityRegistry.generated.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const failures = [];
const slugs = new Set(liveTools.map((tool) => tool.slug));
const ids = new Set(liveTools.map((tool) => tool.id));
const popularIds = new Set(BOOTSTRAP_POPULAR_TOOL_IDS);

if (liveTools.length < 10) failures.push(`At least 10 public tools are required, found ${liveTools.length}.`);
if (slugs.size !== liveTools.length) failures.push('Every tool needs a unique public slug.');
if (ids.size !== liveTools.length) failures.push('Every tool needs a unique engine id.');
if (popularIds.size !== 10 || BOOTSTRAP_POPULAR_TOOL_IDS.length !== 10) failures.push('Popular Tools must contain exactly 10 unique IDs.');
if (JSON.stringify(PUBLISHED_TOOL_IDS) !== JSON.stringify(liveTools.map((tool) => tool.id))) failures.push('Generated popularity registry is stale.');
for (const id of BOOTSTRAP_POPULAR_TOOL_IDS) if (!ids.has(id)) failures.push(`Popular tool “${id}” is not public.`);

for (const tool of liveTools) {
  if (!tool.name || !tool.description || !tool.tagline) failures.push(`${tool.slug}: public copy is incomplete.`);
  if (!tool.accept) failures.push(`${tool.slug}: accepted file types are required.`);
  if (!tool.outputLabel) failures.push(`${tool.slug}: output label is required.`);
  if (!Array.isArray(tool.inputFormats) || !tool.inputFormats.length) failures.push(`${tool.slug}: visible input formats are required.`);
  if (!Array.isArray(tool.outputFormats) || !tool.outputFormats.length) failures.push(`${tool.slug}: visible output formats are required.`);
  if (new Set(tool.inputFormats).size !== tool.inputFormats.length) failures.push(`${tool.slug}: visible input formats must be unique.`);
  if (new Set(tool.outputFormats).size !== tool.outputFormats.length) failures.push(`${tool.slug}: visible output formats must be unique.`);
  if (tool.outputLabel !== tool.outputFormats.join(' / ')) failures.push(`${tool.slug}: output label must match the visible output formats.`);
  if (!Array.isArray(tool.related) || tool.related.length < 2) failures.push(`${tool.slug}: add at least two related tools.`);
  for (const related of tool.related ?? []) {
    const exists = liveTools.some((candidate) => candidate.id === related || candidate.slug === related);
    if (!exists) failures.push(`${tool.slug}: related tool “${related}” is not public.`);
    if (related === tool.id || related === tool.slug) failures.push(`${tool.slug}: cannot relate to itself.`);
  }
  try {
    await access(`${projectRoot}src/pages/${tool.slug}.astro`);
  } catch {
    try { await access(`${projectRoot}src/pages/[tool].astro`); }
    catch { failures.push(`${tool.slug}: route /${tool.slug} has no Astro page.`); }
  }
}

if (failures.length) {
  console.error(`Tool metadata validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`Tool metadata validation passed for ${liveTools.length} public tools and 10 popular tools.`);
