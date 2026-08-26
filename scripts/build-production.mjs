import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const astro = fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url));
const generator = fileURLToPath(new URL('./generate-popularity-registry.mjs', import.meta.url));
const officeRuntimeSync = fileURLToPath(new URL('./sync-office-runtime.mjs', import.meta.url));
for (const setupScript of [generator, officeRuntimeSync]) {
  const setup = spawnSync(process.execPath, [setupScript], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: process.env,
    stdio: 'inherit',
  });
  if (setup.status !== 0) process.exit(setup.status ?? 1);
}

const result = spawnSync(process.execPath, [astro, 'build'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: process.env,
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status ?? 1);

const checks = [
  './validate-tool-metadata.mjs',
  './validate-content-truth.mjs',
  './validate-brand-positioning.mjs',
  './validate-i18n.mjs',
  './validate-built-seo.mjs',
  './verify-search-branding.mjs',
  './verify-monetization.mjs',
  './verify-ocr-assets.mjs',
  './optimizer/validate.mjs',
];

for (const check of checks) {
  const checkPath = fileURLToPath(new URL(check, import.meta.url));
  const checkArgs = check === './validate-built-seo.mjs' ? [checkPath, '--all'] : [checkPath];
  const checkResult = spawnSync(process.execPath, checkArgs, {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'inherit',
  });
  if (checkResult.status !== 0) process.exit(checkResult.status ?? 1);
}
