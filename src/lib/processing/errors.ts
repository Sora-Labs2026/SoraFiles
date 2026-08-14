import type { SerializedProcessingError } from './contracts';

export type { ProcessingErrorCode, ProcessingPhase, SerializedProcessingError } from './contracts';

export class ProcessingError extends Error {
  readonly value: SerializedProcessingError;

  constructor(value: SerializedProcessingError) {
    super(value.code);
    this.name = 'ProcessingError';
    this.value = value;
  }
}

const unknownProcessingError: SerializedProcessingError = {
  code: 'unknown',
  phase: 'process',
  retryable: false,
  messageKey: 'errors.unknown',
  recoveryKey: 'recovery.retry',
};

export function serializeProcessingError(error: unknown, _unsafeContext?: unknown): SerializedProcessingError {
  const value = error instanceof ProcessingError ? error.value : unknownProcessingError;
  const serialized: SerializedProcessingError = {
    code: value.code,
    phase: value.phase,
    retryable: value.retryable,
    messageKey: value.messageKey,
    recoveryKey: value.recoveryKey,
  };

  return serialized;
}
