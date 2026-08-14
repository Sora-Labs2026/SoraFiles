import test from 'node:test';
import assert from 'node:assert/strict';
import { JobController, createJobId } from '../../src/lib/processing/controller.ts';
import { ProcessingError } from '../../src/lib/processing/errors.ts';
import { ResourceScope } from '../../src/lib/processing/resource-scope.ts';

test('disposes resources once in reverse acquisition order', async () => {
  const calls = [];
  const scope = new ResourceScope();
  scope.defer(() => calls.push('url'));
  scope.defer(async () => calls.push('worker'));

  const firstDisposal = scope.dispose();
  const secondDisposal = scope.dispose();

  assert.strictEqual(secondDisposal, firstDisposal);
  await Promise.all([firstDisposal, secondDisposal]);
  assert.deepEqual(calls, ['worker', 'url']);
});

test('continues cleanup after a disposer rejects and reports every failure', async () => {
  const calls = [];
  const firstFailure = new Error('worker cleanup failed');
  const secondFailure = new Error('url cleanup failed');
  const scope = new ResourceScope();
  scope.defer(() => {
    calls.push('url');
    throw secondFailure;
  });
  scope.defer(() => {
    calls.push('canvas');
  });
  scope.defer(async () => {
    calls.push('worker');
    throw firstFailure;
  });

  await assert.rejects(scope.dispose(), (error) => {
    assert(error instanceof AggregateError);
    assert.equal(error.message, 'resource-cleanup-failed');
    assert.deepEqual(error.errors, [firstFailure, secondFailure]);
    return true;
  });
  assert.deepEqual(calls, ['worker', 'canvas', 'url']);
  await assert.rejects(scope.dispose(), AggregateError);
  assert.deepEqual(calls, ['worker', 'canvas', 'url']);
  assert.throws(() => scope.defer(() => undefined), /resource-scope-disposed/);
});

test('rejects resources registered reentrantly during disposal', async () => {
  const scope = new ResourceScope();
  scope.defer(() => {
    assert.throws(() => scope.defer(() => undefined), /resource-scope-disposed/);
  });

  await scope.dispose();
});

test('returns the cached disposal promise when dispose is called reentrantly', async () => {
  const calls = [];
  const scope = new ResourceScope();
  let nestedDisposal;
  scope.defer(() => {
    calls.push('dispose');
    nestedDisposal = scope.dispose();
  });

  const outerDisposal = scope.dispose();
  await outerDisposal;

  assert.strictEqual(nestedDisposal, outerDisposal);
  assert.deepEqual(calls, ['dispose']);
});

test('resource helpers release acquired browser resources', async () => {
  const scope = new ResourceScope();
  const sourceUrl = URL.createObjectURL(new Blob(['local-only']));
  const bitmap = { closed: false, close() { this.closed = true; } };
  const canvas = { width: 1920, height: 1080 };
  const pdf = { destroyed: false, async destroy() { this.destroyed = true; } };
  const worker = { terminated: false, terminate() { this.terminated = true; } };

  assert.equal(scope.trackObjectUrl(sourceUrl), sourceUrl);
  assert.strictEqual(scope.trackImageBitmap(bitmap), bitmap);
  assert.strictEqual(scope.trackCanvas(canvas), canvas);
  assert.strictEqual(scope.trackPdfProxy(pdf), pdf);
  assert.strictEqual(scope.trackWorker(worker), worker);
  assert.equal((await fetch(sourceUrl)).ok, true);

  await scope.dispose();

  await assert.rejects(fetch(sourceUrl));
  assert.equal(bitmap.closed, true);
  assert.deepEqual(canvas, { width: 1, height: 1 });
  assert.equal(pdf.destroyed, true);
  assert.equal(worker.terminated, true);
});

test('allows only the explicitly enumerated job state transitions', async () => {
  const successController = new JobController(() => 'success-job');
  assert.equal(successController.state, 'idle');
  assert.equal((await successController.start()).jobId, 'success-job');
  assert.equal(successController.state, 'validating');
  successController.transition('ready');
  successController.transition('processing');
  successController.transition('success');
  successController.transition('result');
  assert.equal(successController.state, 'result');

  const failureController = new JobController(() => 'failure-job');
  await failureController.start();
  failureController.transition('failure');
  failureController.transition('error');
  assert.equal(failureController.state, 'error');

  const cancellationController = new JobController(() => 'cancelled-job');
  await cancellationController.start();
  cancellationController.transition('cancelling');
  cancellationController.transition('cancelled');
  cancellationController.transition('idle');
  assert.equal(cancellationController.state, 'idle');
});

test('rejects illegal state transitions without mutating state', async () => {
  const controller = new JobController(() => 'illegal-job');
  await controller.start();

  assert.throws(
    () => controller.transition('success'),
    (error) => {
      assert(error instanceof ProcessingError);
      assert.deepEqual(error.value, {
        code: 'unknown',
        phase: 'cleanup',
        retryable: false,
        messageKey: 'errors.unknown',
        recoveryKey: 'recovery.retry',
      });
      return true;
    },
  );
  assert.equal(controller.state, 'validating');
});

test('aborts and starts disposing the previous job before allocating the next job', async () => {
  const lifecycle = [];
  let jobNumber = 0;
  let releaseCleanup;
  let notifyCleanupStarted;
  const cleanupGate = new Promise((resolve) => { releaseCleanup = resolve; });
  const cleanupStarted = new Promise((resolve) => { notifyCleanupStarted = resolve; });
  const controller = new JobController(() => {
    const jobId = `job-${++jobNumber}`;
    lifecycle.push(`allocate:${jobId}`);
    return jobId;
  });
  const first = await controller.start();
  first.signal.addEventListener('abort', () => lifecycle.push(`abort:job-1:${controller.state}`));
  first.resources.defer(async () => {
    lifecycle.push(`dispose:job-1:start:${controller.state}`);
    notifyCleanupStarted();
    await cleanupGate;
    lifecycle.push('dispose:job-1:end');
  });

  let replacementSettled = false;
  const replacement = controller.start();
  void replacement.finally(() => { replacementSettled = true; });
  await cleanupStarted;

  assert.equal(first.signal.aborted, true);
  assert.equal(replacementSettled, false);
  assert.deepEqual(lifecycle, [
    'allocate:job-1',
    'abort:job-1:cancelling',
    'dispose:job-1:start:cancelling',
  ]);
  releaseCleanup();
  const second = await replacement;
  assert.equal(second.signal.aborted, false);
  assert.deepEqual(lifecycle, [
    'allocate:job-1',
    'abort:job-1:cancelling',
    'dispose:job-1:start:cancelling',
    'dispose:job-1:end',
    'allocate:job-2',
  ]);
});

test('does not start a successor when predecessor cleanup fails', async () => {
  const lifecycle = [];
  let jobNumber = 0;
  const controller = new JobController(() => {
    const jobId = `job-${++jobNumber}`;
    lifecycle.push(`allocate:${jobId}`);
    return jobId;
  });
  const first = await controller.start();
  first.resources.defer(() => lifecycle.push('dispose:last'));
  first.resources.defer(() => {
    lifecycle.push('dispose:failed');
    throw new Error('private cleanup detail');
  });
  first.resources.defer(() => lifecycle.push('dispose:first'));

  await assert.rejects(controller.start(), (error) => {
    assert(error instanceof ProcessingError);
    assert.deepEqual(error.value, {
      code: 'unknown',
      phase: 'cleanup',
      retryable: false,
      messageKey: 'errors.unknown',
      recoveryKey: 'recovery.retry',
    });
    assert.equal(error.message.includes('private cleanup detail'), false);
    return true;
  });

  assert.deepEqual(lifecycle, [
    'allocate:job-1',
    'dispose:first',
    'dispose:failed',
    'dispose:last',
  ]);
  assert.equal(jobNumber, 1);
  assert.equal(controller.state, 'idle');
});

test('cancelAndDispose aborts before cleanup and returns to idle after cleanup', async () => {
  const lifecycle = [];
  const controller = new JobController(() => 'active-job');
  const job = await controller.start();
  job.signal.addEventListener('abort', () => lifecycle.push('abort'));
  job.resources.defer(() => {
    lifecycle.push(`dispose:${controller.state}`);
  });

  await controller.cancelAndDispose();

  assert.deepEqual(lifecycle, ['abort', 'dispose:cancelling']);
  assert.equal(job.signal.aborted, true);
  assert.equal(controller.state, 'idle');
  assert.equal(controller.accept({ type: 'phase', jobId: job.jobId, phase: 'cleanup' }), false);
});

test('reset settles success and failure before disposing their resources', async () => {
  const successLifecycle = [];
  const successController = new JobController(() => 'success-job');
  const successJob = await successController.start();
  successController.transition('ready');
  successController.transition('processing');
  successController.transition('success');
  successJob.resources.defer(() => successLifecycle.push(successController.state));

  await successController.cancelAndDispose();

  assert.deepEqual(successLifecycle, ['result']);
  assert.equal(successController.state, 'idle');

  const failureLifecycle = [];
  const failureController = new JobController(() => 'failure-job');
  const failureJob = await failureController.start();
  failureController.transition('failure');
  failureJob.resources.defer(() => failureLifecycle.push(failureController.state));

  await failureController.cancelAndDispose();

  assert.deepEqual(failureLifecycle, ['error']);
  assert.equal(failureController.state, 'idle');
});

test('accepts events only for the current non-aborted job', async () => {
  const jobIds = ['first-job', 'second-job'];
  const controller = new JobController(() => jobIds.shift());
  const first = await controller.start();
  const second = await controller.start();

  assert.equal(controller.accept({ type: 'phase', jobId: first.jobId, phase: 'process' }), false);
  assert.equal(controller.accept({ type: 'phase', jobId: second.jobId, phase: 'process' }), true);
  assert.equal(controller.accept({
    type: 'progress', jobId: second.jobId, phase: 'process', completed: 1, total: 2,
  }), true);
});

test('creates unique opaque job IDs', () => {
  const first = createJobId();
  const second = createJobId();

  assert.notEqual(first, second);
  assert.equal(first.length > 0, true);
  assert.equal(second.length > 0, true);
});
