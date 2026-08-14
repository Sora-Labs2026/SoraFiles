import type { ProcessingEvent } from './contracts';
import { ProcessingError } from './errors.ts';
import { ResourceScope } from './resource-scope.ts';

export type JobState =
  | 'idle'
  | 'validating'
  | 'ready'
  | 'processing'
  | 'success'
  | 'result'
  | 'failure'
  | 'error'
  | 'cancelling'
  | 'cancelled';

export interface JobHandle {
  readonly jobId: string;
  readonly signal: AbortSignal;
  readonly resources: ResourceScope;
}

type ActiveJob = JobHandle & {
  readonly abortController: AbortController;
};

type JobIdFactory = () => string;

const legalTransitions = {
  idle: ['validating'],
  validating: ['ready', 'failure', 'cancelling'],
  ready: ['processing', 'failure', 'cancelling'],
  processing: ['success', 'failure', 'cancelling'],
  success: ['result'],
  result: ['validating', 'idle'],
  failure: ['error'],
  error: ['validating', 'idle'],
  cancelling: ['cancelled'],
  cancelled: ['validating', 'idle'],
} as const satisfies Record<JobState, readonly JobState[]>;

const lifecycleError = (): ProcessingError => new ProcessingError({
  code: 'unknown',
  phase: 'cleanup',
  retryable: false,
  messageKey: 'errors.unknown',
  recoveryKey: 'recovery.retry',
});

let fallbackJobSequence = 0;

export function createJobId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  fallbackJobSequence += 1;
  return `job-${Date.now().toString(36)}-${fallbackJobSequence.toString(36)}`;
}

export class JobController {
  #state: JobState = 'idle';
  #current: ActiveJob | null = null;
  #lifecycleQueue: Promise<void> = Promise.resolve();
  #cleanupFailed = false;
  readonly #createId: JobIdFactory;

  constructor(createId: JobIdFactory = createJobId) {
    this.#createId = createId;
  }

  get state(): JobState {
    return this.#state;
  }

  async start(): Promise<JobHandle> {
    return this.#enqueue(() => this.#start());
  }

  async #start(): Promise<JobHandle> {
    if (this.#cleanupFailed) {
      throw lifecycleError();
    }

    if (this.#current) {
      this.#settleForDisposal();

      try {
        await this.#disposeCurrent();
      } catch {
        this.#cleanupFailed = true;
        this.#finishDisposalToIdle();
        throw lifecycleError();
      }

      if (this.#state === 'cancelling') {
        this.transition('cancelled');
      }
    }

    const abortController = new AbortController();
    const activeJob: ActiveJob = {
      jobId: this.#createId(),
      signal: abortController.signal,
      resources: new ResourceScope(),
      abortController,
    };

    this.#current = activeJob;
    this.transition('validating');

    return activeJob;
  }

  transition(nextState: JobState): void {
    const allowed = legalTransitions[this.#state] as readonly JobState[];
    if (!allowed.includes(nextState)) {
      throw lifecycleError();
    }

    this.#state = nextState;
  }

  accept(event: ProcessingEvent): boolean {
    return this.#current?.jobId === event.jobId && !this.#current.signal.aborted;
  }

  async cancelAndDispose(): Promise<void> {
    return this.#enqueue(() => this.#cancelAndDispose());
  }

  async #cancelAndDispose(): Promise<void> {
    if (this.#current) {
      this.#settleForDisposal();

      try {
        await this.#disposeCurrent();
      } catch {
        this.#cleanupFailed = true;
        this.#finishDisposalToIdle();
        throw lifecycleError();
      }
    }

    this.#finishDisposalToIdle();

    if (this.#cleanupFailed) {
      throw lifecycleError();
    }
  }

  #settleForDisposal(): void {
    if (this.#state === 'validating' || this.#state === 'ready' || this.#state === 'processing') {
      this.transition('cancelling');
    } else if (this.#state === 'success') {
      this.transition('result');
    } else if (this.#state === 'failure') {
      this.transition('error');
    }
  }

  #finishDisposalToIdle(): void {
    if (this.#state === 'cancelling') {
      this.transition('cancelled');
    }

    if (this.#state === 'result' || this.#state === 'error' || this.#state === 'cancelled') {
      this.transition('idle');
    }
  }

  async #disposeCurrent(): Promise<void> {
    const current = this.#current;
    if (!current) return;

    current.abortController.abort();
    this.#current = null;
    await current.resources.dispose();
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#lifecycleQueue.then(operation);
    this.#lifecycleQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
