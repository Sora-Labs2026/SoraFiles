import test from 'node:test';
import assert from 'node:assert/strict';
import { tools } from '../../src/data/tools.ts';
import { ProcessingError, serializeProcessingError } from '../../src/lib/processing/errors.ts';
import { runtimeByToolId, runtimeDefinitions } from '../../src/lib/processing/registry.ts';

test('registers exactly one local runtime for every public tool', () => {
  assert.deepEqual(
    runtimeDefinitions.map((item) => item.id).sort(),
    tools.map((item) => item.slug).sort(),
  );
  assert.equal(new Set(runtimeDefinitions.map((item) => item.id)).size, 11);
  for (const tool of tools) assert.equal(tool.runtimeId, tool.slug, `${tool.slug} must address its own runtime.`);
  assert.equal(runtimeByToolId.size, 11);
});

test('PDF tool registry matches the cancellable dedicated-worker runtime', () => {
  for (const id of ['compress-pdf', 'merge-pdf', 'split-pdf', 'rotate-pdf', 'jpg-to-pdf', 'pdf-to-jpg']) {
    const runtime = runtimeByToolId.get(id);
    assert.ok(runtime, `${id} must have a runtime.`);
    assert.equal(runtime.execution, 'dedicated-worker', `${id} must advertise its dedicated app worker.`);
    assert.equal(runtime.cancellable, true, `${id} must advertise cancellation.`);
  }
});

test('keeps registry capabilities local-only', () => {
  assert.equal(JSON.stringify(runtimeDefinitions).match(/remote|upload|endpoint|transport/gi), null);
});

test('serializes processing errors without private error details', () => {
  const error = serializeProcessingError(new ProcessingError({
    code: 'decode-failed',
    phase: 'decode',
    retryable: true,
    messageKey: 'errors.decodeFailed',
    recoveryKey: 'recovery.exportSupported',
    diagnosticId: 'private-passport.pdf',
  }), {
    forbiddenName: 'private-passport.pdf',
    message: 'Raw decoder text',
    stack: 'private stack',
  });

  assert.deepEqual(error, {
    code: 'decode-failed',
    phase: 'decode',
    retryable: true,
    messageKey: 'errors.decodeFailed',
    recoveryKey: 'recovery.exportSupported',
  });
  assert.equal(JSON.stringify(error).includes('private-passport.pdf'), false);
  assert.equal('stack' in error, false);
});
