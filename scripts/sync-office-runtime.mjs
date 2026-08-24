import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules', 'zetajs', 'source');
const target = resolve(root, 'public', 'vendor', 'zetajs', '1.2.0');

await mkdir(target, { recursive: true });
await Promise.all([
  copyFile(resolve(source, 'zeta.js'), resolve(target, 'zeta.js')),
  copyFile(resolve(source, 'zetaHelper.js'), resolve(target, 'zetaHelper.js')),
]);

console.log('Synced ZetaJS 1.2.0 browser runtime.');
