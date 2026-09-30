import {readFile, writeFile} from 'node:fs/promises';
import {liveTools} from '../../src/data/liveTools.ts';
import {desktopToolIds, isDesktopTool} from '../shared/tool-policy.mjs';

// Ship only eligible metadata. Importing the full Web registry into the Desktop
// renderer would also bundle excluded labels and unrelated Web marketing copy.
const tools = liveTools.filter(tool => isDesktopTool(tool.id)).map(tool => ({
  id: tool.id, name: tool.name, slug: tool.slug,
  inputFormats: tool.inputFormats, outputFormats: tool.outputFormats,
}));
if (tools.length !== desktopToolIds.length || new Set(tools.map(t => t.id)).size !== tools.length)
  throw Error('Desktop policy and Web metadata disagree');
const output = JSON.stringify(tools, null, 2) + '\n';
const target = new URL('../shared/tool-metadata.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== output) throw Error('Run node desktop/scripts/sync-tool-metadata.mjs');
} else await writeFile(target, output);
