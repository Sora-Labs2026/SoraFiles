import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), 'utf8');
}

test('premium image codecs remain lazy, bounded, and use dedicated compression workers', async () => {
  const [manifestText, helper, converter, compressor, worker] = await Promise.all([
    read('package.json'),
    read('src/lib/image/premium-codecs.ts'),
    read('src/components/ImageConverterWorkbench.astro'),
    read('src/components/FileWorkbench.astro'),
    read('src/workers/image-compression.worker.ts'),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.dependencies['@jsquash/jpeg'], '^1.6.0');
  assert.equal(manifest.dependencies['@jsquash/oxipng'], '^2.3.0');
  assert.equal(manifest.dependencies['@jsquash/webp'], '1.5.0');
  assert.match(helper, /import\('@jsquash\/jpeg'\)/);
  assert.match(helper, /import\('@jsquash\/oxipng'\)/);
  assert.match(helper, /MOZJPEG_PIXEL_LIMIT\s*=\s*12_000_000/);
  assert.match(helper, /catch \{\s*return null;/);
  assert.match(helper, /catch \{\s*return blob;/);
  assert.match(helper, /image\/webp/);
  assert.match(worker, /import\('@jsquash\/webp'\)/);
  assert.match(worker, /import\('@jsquash\/jpeg'\)/);
  assert.match(worker, /import\('@jsquash\/oxipng'\)/);

  assert.match(converter, /encodePremiumCanvas/);
  assert.match(converter, /type OutputMime/);
  assert.match(compressor, /image-compression\.worker\.ts/);
  assert.match(compressor, /rgbaSsim/);
  assert.match(compressor, /compressed result was not smaller/);
  assert.doesNotMatch(compressor, /resizeCanvas|quantizePngPixels|low = 0\.04/);
});
