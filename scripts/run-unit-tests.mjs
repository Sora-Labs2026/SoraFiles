import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const shim = path.join(root, 'scripts', 'optimizer', 'windows-runtime-shim.mjs');
const tests = readdirSync(path.join(root, 'tests', 'unit'))
  .filter((file) => file.endsWith('.test.mjs'))
  .sort()
  .map((file) => `tests/unit/${file}`);

const result = spawnSync(process.execPath, [
  '--import', pathToFileURL(shim).href,
  '--import', 'tsx',
  '--test',
  '--test-concurrency=1',
  ...tests,
], { cwd: root, env: process.env, stdio: 'inherit', shell: false, windowsHide: true });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
