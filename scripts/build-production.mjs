import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const astro = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));
const result = spawnSync(process.execPath, [astro, 'build'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, PUBLIC_ADSENSE_ENABLED: 'true' },
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
