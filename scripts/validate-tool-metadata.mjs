import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { liveTools, popularToolIds } from '../src/data/liveTools.ts';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const failures = [];
const slugs = new Set(liveTools.map((tool) => tool.slug));
const ids = new Set(liveTools.map((tool) => tool.id));
const featuredIds = new Set(popularToolIds);

if (liveTools.length !== 23) failures.push(`Expected 23 public tools, found ${liveTools.length}.`);
if (slugs.size !== liveTools.length) failures.push('Every tool needs a unique public slug.');
if (ids.size !== liveTools.length) failures.push('Every tool needs a unique engine id.');
if (featuredIds.size !== popularToolIds.length) failures.push('Every featured tool ID must be unique.');
for (const id of popularToolIds) if (!ids.has(id)) failures.push(`Featured tool “${id}” is not public.`);

for (const tool of liveTools) {
  if (!tool.name || !tool.description || !tool.tagline) failures.push(`${tool.slug}: public copy is incomplete.`);
  if (!tool.accept) failures.push(`${tool.slug}: accepted file types are required.`);
  if (!tool.outputLabel) failures.push(`${tool.slug}: output label is required.`);
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
console.log(`Tool metadata validation passed for ${liveTools.length} public tools and ${popularToolIds.length} configured featured tools.`);
