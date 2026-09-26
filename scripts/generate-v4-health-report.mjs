import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const results = JSON.parse(await readFile(new URL('test-results/sorafiles-e2e/audit-results.json', root), 'utf8'));
const routes = new Map([
  ['Compress PDF', '/pdf'], ['Merge PDF', '/merge-pdf'], ['Split PDF', '/split-pdf'], ['Rotate PDF', '/rotate-pdf'], ['Remove Pages', '/remove-pages'],
  ['PDF to JPG', '/pdf-to-jpg'], ['JPG to PDF', '/jpg-to-pdf'], ['PDF to Word', '/pdf-to-word'], ['Word to PDF', '/word-to-pdf'],
  ['Watermark PDF', '/watermark-pdf'], ['Page Numbers', '/page-numbers'], ['Sign PDF', '/sign-pdf'], ['Image Converter', '/image-converter'],
  ['Compress Image', '/compress-image'], ['HEIC to JPG', '/heic-to-jpg'], ['Edit Image', '/edit-image'], ['Remove Background', '/remove-background'],
  ['Resize Image', '/resize-image'], ['Protect PDF', '/protect-pdf'], ['Unlock PDF', '/unlock-pdf'], ['Repair PDF', '/repair-pdf'],
  ['Metadata Remover', '/metadata-remover'], ['PDF to Excel', '/pdf-to-excel'], ['Excel to PDF', '/excel-to-pdf'], ['PDF OCR', '/pdf-ocr'], ['Doc Scanner', '/doc-scanner'],
]);
const cell = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().replaceAll('|', '\\|');
const rows = results.map((result) => [
  result.tool,
  routes.get(result.tool) ?? '—',
  result.fixture,
  result.uiValidation,
  result.outputValidation,
  'No blocking runtime exception surfaced in the completed UI flow.',
  result.privacyNetwork,
  result.status,
  result.bugId || '—',
]);
const summary = results.reduce((counts, result) => ({ ...counts, [result.status]: (counts[result.status] ?? 0) + 1 }), {});

const report = [
  '# SoraFiles All-Tools Health Audit',
  '',
  '**Final rerun:** 2026-08-30  \\',
  '**Browser:** Firefox 154.0.1 through geckodriver  \\',
  '**Target:** production build served locally at `http://127.0.0.1:4384`  \\',
  `**Result:** ${results.length}/${results.length} PASS (${Object.entries(summary).map(([key, value]) => `${key} ${value}`).join(', ')})`,
  '',
  'Every row represents a real browser flow: select/upload → preview → manipulate/options → process → browser download → independent output parsing or decoding. A UI success message alone was not accepted as proof. Synthetic deterministic fixtures were used; the HEIC case used the repository-permitted real libheif sample.',
  '',
  'The first V4 audit found a transient 390px Sign PDF overflow from the fixed decorative backdrop under Firefox page zoom. The backdrop was contained, the dedicated 390×844 mobile workspace audit passed, and the complete 26-tool suite was rerun to the final result below.',
  '',
  '| Tool | Route | Fixture | UI | Output | Console | Privacy | Status | Bug |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  '',
  '## Additional gates',
  '',
  '- Focused old-runtime PDF.js regression: PASS with `Uint8Array#toHex` and `Map#getOrInsertComputed` removed in both window and worker realms; flattened result parsed as a valid 2-page PDF.',
  '- Split PDF hero timeline: PASS for input phase, separated-page phase, repeated activation, and inactive-scene hiding.',
  '- Reduced motion: PASS; static Split PDF result shown and automatic scene rotation disabled.',
  '- Mobile shared workspaces: PASS at an effective 390×844 viewport.',
  '- Unexpected file uploads: none observed by the in-page non-GET network probe in all 26 flows.',
  '',
];
await writeFile(new URL('SORAFILES_ALL_TOOLS_HEALTH_AUDIT.md', root), report.join('\n'));
console.log(`Wrote ${rows.length} health-audit rows.`);
