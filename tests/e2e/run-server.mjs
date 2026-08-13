import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const baseUrl = process.env.SORA_BASE_URL ?? 'http://localhost:4321';

async function responds(url) {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(2_000) });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

export async function ensureAstroServer() {
  if (await responds(`${baseUrl}/`)) return;

  const projectRoot = new URL('../..', import.meta.url);
  const projectPath = fileURLToPath(projectRoot);
  if (!existsSync(fileURLToPath(new URL('dist/index.html', projectRoot)))) {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const build = spawnSync(npm, ['run', 'build'], {
      cwd: projectPath,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: 'pipe',
    });
    if (build.status !== 0) {
      throw new Error(`Astro production build failed.\n${build.stdout}\n${build.stderr}`);
    }
  }

  const astroBin = fileURLToPath(new URL('node_modules/astro/bin/astro.mjs', projectRoot));
  const result = spawnSync(process.execPath, [astroBin, 'preview', '--background'], {
    cwd: projectPath,
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    throw new Error(`Astro background preview failed to start.\n${result.stdout}\n${result.stderr}`);
  }

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await responds(`${baseUrl}/`)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Astro did not respond at ${baseUrl} within 30 seconds.`);
}
