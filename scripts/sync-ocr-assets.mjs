import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const languages = [
  'eng', 'jpn', 'kor', 'spa', 'fra', 'deu', 'por', 'chi_sim', 'chi_tra',
  'hin', 'ara', 'rus', 'ind', 'ita', 'nld', 'tur', 'vie', 'tha', 'pol',
];

const root = fileURLToPath(new URL('..', import.meta.url));
const target = `${root}/public/ocr`;
await mkdir(`${target}/runtime`, { recursive: true });
await mkdir(`${target}/lang`, { recursive: true });
await mkdir(`${target}/licenses`, { recursive: true });

await copyFile(`${root}/node_modules/tesseract.js/dist/worker.min.js`, `${target}/runtime/worker.min.js`);
await copyFile(`${root}/node_modules/tesseract.js/LICENSE`, `${target}/licenses/tesseract-js.txt`).catch(async () => {
  await copyFile(`${root}/node_modules/tesseract.js/LICENSE.md`, `${target}/licenses/tesseract-js.txt`).catch(() => {});
});
await copyFile(`${root}/node_modules/tesseract.js-core/LICENSE`, `${target}/licenses/tesseract-core.txt`).catch(() => {});
await copyFile(`${root}/node_modules/tesseract.js/LICENSE.md`, `${target}/licenses/tessdata-apache-2.0.txt`).catch(() => {});

for (const name of await readdir(`${root}/node_modules/tesseract.js-core`)) {
  if (/^tesseract-core.*\.wasm\.js$/.test(name)) {
    await copyFile(`${root}/node_modules/tesseract.js-core/${name}`, `${target}/runtime/${name}`);
  }
}

for (const code of languages) {
  const destination = `${target}/lang/${code}.traineddata.gz`;
  try {
    await stat(destination);
    console.log(`[ocr sync] ${code} traineddata exists locally.`);
    continue;
  } catch {}
  console.log(`[ocr sync] Downloading ${code} traineddata...`);
  const url = `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${code}@1.0.0/4.0.0_best_int/${code}.traineddata.gz`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${code}: ${response.status} ${response.statusText}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes.byteLength > 25 * 1024 * 1024) {
    throw new Error(`${code}: invalid or oversized trained data`);
  }
  const partial = `${destination}.partial`;
  try {
    await writeFile(partial, bytes);
    await rename(partial, destination);
    console.log(`[ocr sync] Downloaded ${code} (${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
}

const files = [];
for (const directory of ['runtime', 'lang', 'licenses']) {
  for (const name of await readdir(`${target}/${directory}`)) {
    const bytes = await readFile(`${target}/${directory}/${name}`);
    files.push({
      path: `${directory}/${name}`,
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
}
files.sort((a, b) => a.path.localeCompare(b.path));
await writeFile(`${target}/manifest.json`, `${JSON.stringify({ version: 1, files }, null, 2)}\n`);
console.log(`Sync complete. Manifest generated with ${files.length} files.`);
