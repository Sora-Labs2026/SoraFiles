import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(await readFile('public/ocr/manifest.json', 'utf8'));
const errors = [];
for (const entry of manifest.files) {
  const bytes = await readFile(`public/ocr/${entry.path}`);
  const details = await stat(`public/ocr/${entry.path}`);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (details.size !== entry.bytes) errors.push(`${entry.path}: size mismatch`);
  if (hash !== entry.sha256) errors.push(`${entry.path}: sha256 mismatch`);
  if (details.size > 25 * 1024 * 1024) errors.push(`${entry.path}: exceeds Cloudflare's 25 MiB asset limit`);
}
if (errors.length) throw new Error(errors.join('\n'));
console.log(`Verified ${manifest.files.length} OCR assets.`);
