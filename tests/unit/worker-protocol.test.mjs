import test from 'node:test';
import assert from 'node:assert/strict';
import { isMainToWorker, isWorkerToMain } from '../../src/lib/processing/worker-protocol.ts';
import { WorkerClient } from '../../src/lib/processing/worker-client.ts';
import { JobController } from '../../src/lib/processing/controller.ts';
import { ResourceScope } from '../../src/lib/processing/resource-scope.ts';

class FakeWorker {
  posts = [];
  terminated = 0;
  #listeners = new Map([['message', new Set()], ['error', new Set()]]);

  addEventListener(type, listener) {
    this.#listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.#listeners.get(type).delete(listener);
  }

  postMessage(message, transferables = []) {
    this.posts.push({ message, transferables });
  }

  terminate() {
    this.terminated += 1;
  }

  emitMessage(data) {
    for (const listener of this.#listeners.get('message')) listener({ data });
  }

  emitError() {
    for (const listener of this.#listeners.get('error')) listener(new Event('error'));
  }

  listenerCount(type) {
    return this.#listeners.get(type).size;
  }
}

function createJob(jobId = 'active-job') {
  const abortController = new AbortController();
  return {
    job: { jobId, signal: abortController.signal, resources: new ResourceScope() },
    abortController,
  };
}

const sampleWorkerEvents = [
  { type: 'ready' },
  { type: 'progress', jobId: 'job-1', phase: 'process', completed: 1, total: 2 },
  { type: 'warning', jobId: 'job-1', warning: { code: 'quality-reduced', messageKey: 'warnings.quality' } },
  { type: 'success', jobId: 'job-1', result: { output: new ArrayBuffer(3) } },
  { type: 'failure', jobId: 'job-1', error: { code: 'encode-failed', phase: 'encode', retryable: true, messageKey: 'errors.encode', recoveryKey: 'recovery.retry' } },
  { type: 'cancelled', jobId: 'job-1' },
  { type: 'disposed' },
];

test('accepts only complete, privacy-safe worker message shapes', () => {
  for (const event of sampleWorkerEvents) assert.equal(isWorkerToMain(event), true);

  for (const event of [
    { type: 'progress', phase: 'process' },
    { type: 'success', jobId: '', result: null },
    { type: 'failure', jobId: 'job-1', error: { code: 'encode-failed' } },
    { type: 'cancelled', jobId: 3 },
    { type: 'unknown', jobId: 'job-1' },
  ]) assert.equal(isWorkerToMain(event), false);

  for (const key of ['file', 'filename', 'text', 'pixels', 'stack', 'url']) {
    assert.equal(JSON.stringify(sampleWorkerEvents).includes(`\"${key}\"`), false);
  }
});

test('accepts only private archive entries for the active worker job shape', () => {
  const bytes = new ArrayBuffer(4);
  assert.equal(isMainToWorker({ type: 'archive-entry', jobId: 'job-1', index: 1, bytes }, 'job-1'), true);
  assert.equal(isMainToWorker({ type: 'archive-entry', jobId: '', index: 1, bytes }, 'job-1'), false);
  assert.equal(isMainToWorker({ type: 'archive-entry', jobId: 'wrong-job', index: 1, bytes }, 'job-1'), false);
  assert.equal(isMainToWorker({ type: 'archive-entry', jobId: 'job-1', index: 0, bytes }, 'job-1'), false);
  assert.equal(isMainToWorker({ type: 'archive-entry', jobId: 'job-1', index: 1, bytes, filename: 'private.pdf' }, 'job-1'), false);
});

test('runs only the active job and transfers the input buffer', async () => {
  const worker = new FakeWorker();
  const client = new WorkerClient(worker);
  const { job } = createJob();
  const input = new ArrayBuffer(4);
  const events = [];
  const result = client.run(job, 'compress-pdf', { input }, [input], (event) => events.push(event));

  assert.deepEqual(worker.posts, [{
    message: { type: 'start', jobId: 'active-job', toolId: 'compress-pdf', payload: { input } },
    transferables: [input],
  }]);

  worker.emitMessage({ type: 'progress', jobId: 'stale-job', phase: 'process', completed: 1, total: 2 });
  worker.emitMessage({ type: 'success', jobId: 'stale-job', result: { output: new ArrayBuffer(1) } });
  assert.deepEqual(events, []);

  const expected = { output: new ArrayBuffer(3) };
  worker.emitMessage({ type: 'success', jobId: 'active-job', result: expected });
  assert.strictEqual(await result, expected);
});

test('rejects a disposed job scope without posting or leaking the worker run', async () => {
  const worker = new FakeWorker();
  const client = new WorkerClient(worker);
  const disposed = createJob('disposed-job');
  await disposed.job.resources.dispose();

  const rejectedRun = client.run(disposed.job, 'compress-pdf', {});
  await assert.rejects(rejectedRun, (error) => {
    assert.deepEqual(error.value, {
      code: 'worker-start-failed',
      phase: 'process',
      retryable: false,
      messageKey: 'errors.worker-start-failed',
      recoveryKey: 'recovery.retry',
    });
    assert.equal(error.message.includes('resource-scope-disposed'), false);
    return true;
  });
  assert.deepEqual(worker.posts, []);
  assert.equal(worker.listenerCount('message'), 0);
  assert.equal(worker.listenerCount('error'), 0);

  const validRun = client.run(createJob('valid-job').job, 'compress-pdf', {});
  worker.emitMessage({ type: 'success', jobId: 'valid-job', result: 'safe-success' });
  assert.equal(await validRun, 'safe-success');
});

test('settles one terminal outcome and fails closed on worker crashes', async () => {
  const successfulWorker = new FakeWorker();
  const successfulClient = new WorkerClient(successfulWorker);
  const successfulJob = createJob().job;
  const completion = successfulClient.run(successfulJob, 'compress-pdf', {});
  successfulWorker.emitMessage({ type: 'success', jobId: 'active-job', result: 'first-result' });
  successfulWorker.emitMessage({ type: 'failure', jobId: 'active-job', error: { code: 'encode-failed', phase: 'encode', retryable: true, messageKey: 'errors.encode', recoveryKey: 'recovery.retry' } });
  assert.equal(await completion, 'first-result');

  const crashingWorker = new FakeWorker();
  const crashingClient = new WorkerClient(crashingWorker);
  const crashingJob = createJob().job;
  const crashed = crashingClient.run(crashingJob, 'compress-pdf', {});
  crashingWorker.emitError();
  await assert.rejects(crashed, (error) => {
    assert.deepEqual(error.value, {
      code: 'worker-crashed',
      phase: 'process',
      retryable: false,
      messageKey: 'errors.worker-crashed',
      recoveryKey: 'recovery.retry',
    });
    return true;
  });
});

test('posts cancellation and terminates after the 1,500 ms grace period', async () => {
  const worker = new FakeWorker();
  const client = new WorkerClient(worker);
  const { job, abortController } = createJob();
  const result = client.run(job, 'compress-pdf', {});
  const startedAt = Date.now();
  abortController.abort();

  assert.deepEqual(worker.posts[1], { message: { type: 'cancel', jobId: 'active-job' }, transferables: [] });
  await assert.rejects(result, (error) => {
    assert.equal(error.value.code, 'cancelled');
    return true;
  });
  assert.equal(worker.terminated, 1);
  assert.equal(Date.now() - startedAt >= 1_500, true);
});

test('a terminated worker rejects a successor run after cancellation timeout', async () => {
  const worker = new FakeWorker();
  const client = new WorkerClient(worker);
  const { job, abortController } = createJob();
  const timedOutRun = client.run(job, 'compress-pdf', {});
  abortController.abort();
  await assert.rejects(timedOutRun, (error) => error.value.code === 'cancelled');

  const successorRun = client.run(createJob('successor-job').job, 'compress-pdf', {});
  worker.emitMessage({ type: 'success', jobId: 'successor-job', result: 'unsafe-success' });
  await assert.rejects(successorRun, (error) => {
    assert.equal(error.value.code, 'worker-start-failed');
    return true;
  });
  assert.equal(worker.posts.some(({ message }) => message.jobId === 'successor-job'), false);
});

test('a crashed worker rejects a successor run without posting to the dead worker', async () => {
  const worker = new FakeWorker();
  const client = new WorkerClient(worker);
  const crashedRun = client.run(createJob().job, 'compress-pdf', {});
  worker.emitError();
  await assert.rejects(crashedRun, (error) => error.value.code === 'worker-crashed');

  const successorRun = client.run(createJob('successor-job').job, 'compress-pdf', {});
  worker.emitMessage({ type: 'success', jobId: 'successor-job', result: 'unsafe-success' });
  await assert.rejects(successorRun, (error) => {
    assert.equal(error.value.code, 'worker-start-failed');
    return true;
  });
  assert.equal(worker.posts.some(({ message }) => message.jobId === 'successor-job'), false);
});

test('a JobController replacement waits for worker cancellation before allocating the successor', async () => {
  const worker = new FakeWorker();
  const client = new WorkerClient(worker);
  const jobIds = ['first-job', 'second-job'];
  const controller = new JobController(() => jobIds.shift());
  const first = await controller.start();
  const firstRun = client.run(first, 'compress-pdf', {});
  const firstRunCancelled = assert.rejects(firstRun, (error) => error.value.code === 'cancelled');
  const successor = controller.start();
  let successorSettled = false;
  void successor.then(() => { successorSettled = true; });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(successorSettled, false);
  assert.deepEqual(worker.posts.map(({ message }) => message), [
    { type: 'start', jobId: 'first-job', toolId: 'compress-pdf', payload: {} },
    { type: 'cancel', jobId: 'first-job' },
  ]);

  worker.emitMessage({ type: 'cancelled', jobId: 'first-job' });
  await firstRunCancelled;
  assert.equal((await successor).jobId, 'second-job');
});

test('uses the worker cancellation terminal event and disposes exactly once', async () => {
  const worker = new FakeWorker();
  const client = new WorkerClient(worker);
  const { job, abortController } = createJob();
  const result = client.run(job, 'compress-pdf', {});
  abortController.abort();
  worker.emitMessage({ type: 'cancelled', jobId: 'active-job' });

  await assert.rejects(result, (error) => error.value.code === 'cancelled');
  assert.equal(worker.terminated, 0);
  await client.dispose();
  await client.dispose();
  assert.equal(worker.terminated, 1);
  assert.deepEqual(worker.posts.at(-1), { message: { type: 'dispose' }, transferables: [] });
});
