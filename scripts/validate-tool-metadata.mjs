import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tools } from '../src/data/tools.ts';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const failures = [];
const allowedCategories = new Set(['image', 'compress', 'convert', 'organize']);
const slugs = new Set(tools.map((tool) => tool.slug));

if (tools.length !== 11) {
  failures.push(`Expected 11 public tools, found ${tools.length}.`);
}

for (const tool of tools) {
  if (!allowedCategories.has(tool.category)) failures.push(`${tool.slug}: missing or invalid category.`);
  if (!Array.isArray(tool.formats) || tool.formats.length === 0) failures.push(`${tool.slug}: formats must be a non-empty list.`);
  if (!Array.isArray(tool.keywords) || tool.keywords.length < 2) failures.push(`${tool.slug}: keywords must contain at least two useful search terms.`);
  if (!tool.privacy || typeof tool.privacy !== 'string') failures.push(`${tool.slug}: privacy statement is required.`);
  if (!['stable', 'basic'].includes(tool.status)) failures.push(`${tool.slug}: status must be stable or basic.`);
  if (!Array.isArray(tool.related) || tool.related.length < 2) failures.push(`${tool.slug}: add at least two related tools.`);
  for (const related of tool.related ?? []) {
    if (!slugs.has(related)) failures.push(`${tool.slug}: related tool “${related}” is not public.`);
    if (related === tool.slug) failures.push(`${tool.slug}: cannot relate to itself.`);
  }

  const route = tool.href === '/pdf' ? 'pdf' : tool.href.replace(/^\//, '');
  try {
    await access(`${projectRoot}src/pages/${route}.astro`);
  } catch {
    try {
      await access(`${projectRoot}src/pages/[tool].astro`);
      if (!['merge-pdf', 'split-pdf', 'rotate-pdf', 'jpg-to-pdf', 'pdf-to-jpg', 'pdf-to-word', 'word-to-pdf'].includes(tool.slug)) {
        throw new Error('Not a generated document route.');
      }
    } catch {
      failures.push(`${tool.slug}: route ${tool.href} has no Astro page.`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Tool metadata validation failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Tool metadata validation passed for ${tools.length} public tools.`);
