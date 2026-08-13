import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('DocumentActionWorkbench satisfies PDF rendering and OCR client-script contracts', { timeout: 60_000 }, () => {
  const result = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'check'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
