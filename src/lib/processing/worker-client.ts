import type { PublicToolId, SerializedProcessingError } from './contracts.ts';
import { ProcessingError } from './errors.ts';
import type { JobHandle } from './controller.ts';
import { isWorkerToMain, type MainToWorker, type WorkerToMain } from './worker-protocol.ts';

const cancellationGraceMs = 1_500;

export interface WorkerPort {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  postMessage(message: MainToWorker, transferables?: Transferable[]): void;
  terminate(): void | Promise<void>;
}

type WorkerEvent = Extract<WorkerToMain, { jobId: string; type: 'progress' | 'warning' }>;

interface ActiveRun {
  readonly jobId: string;
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: unknown) => void;
  readonly messageListener: EventListener;
  readonly errorListener: EventListener;
  readonly abortListener: () => void;
  readonly signal: AbortSignal;
  readonly onEvent?: (event: WorkerEvent) => void;
  cancelPromise: Promise<void> | null;
  resolveCancellation: (() => void) | null;
  cancellationTimer: ReturnType<typeof setTimeout> | null;
  cancelling: boolean;
}

function safeError(
  code: SerializedProcessingError['code'],
  phase: SerializedProcessingError['phase'] = 'process',
  retryable = false,
): ProcessingError {
  return new ProcessingError({
    code,
    phase,
    retryable,
    messageKey: `errors.${code}`,
    recoveryKey: 'recovery.retry',
  });
}

export class WorkerClient {
  readonly #worker: WorkerPort;
  #active: ActiveRun | null = null;
  #disposed = false;
  #terminated = false;
  #disposePromise: Promise<void> | null = null;

  constructor(worker: WorkerPort) {
    this.#worker = worker;
  }

  run<T>(
    job: JobHandle,
    toolId: PublicToolId,
    payload: unknown,
    transferables: Transferable[] = [],
    onEvent?: (event: WorkerEvent) => void,
  ): Promise<T> {
    if (this.#disposed || this.#terminated || this.#active) return Promise.reject(safeError('worker-start-failed'));
    try {
      job.resources.defer(() => this.cancel(job.jobId));
    } catch {
      return Promise.reject(safeError('worker-start-failed'));
    }

    let resolveRun: (value: unknown) => void = () => undefined;
    let rejectRun: (reason: unknown) => void = () => undefined;
    const result = new Promise<unknown>((resolve, reject) => {
      resolveRun = resolve;
      rejectRun = reject;
    });

    const active = {
      jobId: job.jobId,
      resolve: resolveRun,
      reject: rejectRun,
      messageListener: null as unknown as EventListener,
      errorListener: null as unknown as EventListener,
      abortListener: () => { void this.cancel(job.jobId); },
      signal: job.signal,
      onEvent,
      cancelPromise: null,
      resolveCancellation: null,
      cancellationTimer: null,
      cancelling: false,
    } satisfies ActiveRun;

    active.messageListener = ((event: Event) => this.#handleMessage(active, (event as MessageEvent<unknown>).data)) as EventListener;
    active.errorListener = (() => this.#handleWorkerError(active)) as EventListener;
    this.#active = active;
    this.#worker.addEventListener('message', active.messageListener);
    this.#worker.addEventListener('error', active.errorListener);
    job.signal.addEventListener('abort', active.abortListener, { once: true });

    try {
      this.#worker.postMessage({ type: 'start', jobId: job.jobId, toolId, payload }, transferables);
      if (job.signal.aborted) void this.cancel(job.jobId);
    } catch {
      this.#settle(active, 'error', safeError('worker-start-failed'));
    }

    return result as Promise<T>;
  }

  cancel(jobId?: string): Promise<void> {
    const active = this.#active;
    if (!active || (jobId !== undefined && jobId !== active.jobId)) return Promise.resolve();
    if (active.cancelPromise) return active.cancelPromise;

    active.cancelling = true;
    active.cancelPromise = new Promise<void>((resolve) => {
      active.resolveCancellation = resolve;
    });

    try {
      this.#worker.postMessage({ type: 'cancel', jobId: active.jobId });
    } catch {
      void this.#terminateAndSettleCancellation(active);
      return active.cancelPromise;
    }

    active.cancellationTimer = setTimeout(() => {
      if (this.#active !== active) return;
      void this.#terminateAndSettleCancellation(active);
    }, cancellationGraceMs);

    return active.cancelPromise;
  }

  dispose(): Promise<void> {
    if (!this.#disposePromise) {
      this.#disposed = true;
      const active = this.#active;
      if (active) this.#settle(active, 'cancelled');
      this.#disposePromise = Promise.resolve().then(async () => {
        try {
          this.#worker.postMessage({ type: 'dispose' });
        } catch {
          // Disposing an already-crashed worker still terminates its local resources.
        }
        await this.#terminateWorker();
      });
    }

    return this.#disposePromise;
  }

  #handleMessage(active: ActiveRun, value: unknown): void {
    if (this.#active !== active) return;
    if (!isWorkerToMain(value)) {
      this.#handleWorkerError(active);
      return;
    }
    if (!('jobId' in value) || value.jobId !== active.jobId) return;

    if (value.type === 'progress' || value.type === 'warning') {
      if (!active.cancelling) active.onEvent?.(value);
      return;
    }

    if (active.cancelling && value.type !== 'cancelled') return;
    if (value.type === 'success') this.#settle(active, 'success', value.result);
    else if (value.type === 'failure') this.#settle(active, 'error', new ProcessingError(value.error));
    else if (value.type === 'cancelled') this.#settle(active, 'cancelled');
  }

  #handleWorkerError(active: ActiveRun): void {
    if (this.#active !== active) return;
    void this.#terminateAndSettleError(active);
  }

  #settle(active: ActiveRun, outcome: 'success' | 'error' | 'cancelled', value?: unknown): void {
    if (this.#active !== active) return;
    this.#active = null;
    if (active.cancellationTimer) clearTimeout(active.cancellationTimer);
    this.#worker.removeEventListener('message', active.messageListener);
    this.#worker.removeEventListener('error', active.errorListener);
    active.signal.removeEventListener('abort', active.abortListener);

    if (outcome === 'success') active.resolve(value);
    else if (outcome === 'error') active.reject(value);
    else active.reject(safeError('cancelled', 'process', true));
    active.resolveCancellation?.();
  }

  async #terminateWorker(): Promise<void> {
    if (this.#terminated) return;
    this.#terminated = true;
    try {
      await this.#worker.terminate();
    } catch {
      // Worker termination is best-effort; callers still receive a safe terminal outcome.
    }
  }

  async #terminateAndSettleCancellation(active: ActiveRun): Promise<void> {
    await this.#terminateWorker();
    this.#settle(active, 'cancelled');
  }

  async #terminateAndSettleError(active: ActiveRun): Promise<void> {
    await this.#terminateWorker();
    this.#settle(active, 'error', safeError('worker-crashed'));
  }
}
