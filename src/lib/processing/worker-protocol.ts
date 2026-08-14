import type {
  ProcessingErrorCode,
  ProcessingPhase,
  ProcessingWarning,
  SerializedProcessingError,
} from './contracts.ts';
import type { PublicToolId } from './contracts.ts';

export type MainToWorker =
  | { type: 'start'; jobId: string; toolId: PublicToolId; payload: unknown }
  | { type: 'archive-entry'; jobId: string; index: number; bytes: ArrayBuffer }
  | { type: 'cancel'; jobId: string }
  | { type: 'dispose' };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'progress'; jobId: string; phase: ProcessingPhase; completed?: number; total?: number }
  | { type: 'warning'; jobId: string; warning: ProcessingWarning }
  | { type: 'success'; jobId: string; result: unknown }
  | { type: 'failure'; jobId: string; error: SerializedProcessingError }
  | { type: 'cancelled'; jobId: string }
  | { type: 'disposed' };

const phases = new Set<ProcessingPhase>([
  'validate', 'decode', 'process', 'encode', 'package', 'validate-output', 'cleanup',
]);

const errorCodes = new Set<ProcessingErrorCode>([
  'invalid-signature', 'corrupt-input', 'unsupported-format', 'unsupported-variant',
  'encrypted-file', 'password-required', 'file-count-limit', 'file-size-limit',
  'page-limit', 'pixel-limit', 'memory-pressure', 'browser-unsupported',
  'decode-failed', 'encode-failed', 'render-failed', 'archive-failed',
  'worker-start-failed', 'worker-crashed', 'wasm-load-failed',
  'target-unreachable', 'output-invalid', 'cancelled', 'unknown',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(record);
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key));
}

function hasOnlyOptionalKeys(record: Record<string, unknown>, required: readonly string[], optional: readonly string[]): boolean {
  const actualKeys = Object.keys(record);
  return required.every((key) => Object.hasOwn(record, key))
    && actualKeys.every((key) => required.includes(key) || optional.includes(key));
}

function isJobId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isMainToWorker(value: unknown, expectedJobId?: string): value is MainToWorker {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'dispose') return hasOnlyKeys(value, ['type']);
  if (value.type === 'cancel') {
    return hasOnlyKeys(value, ['type', 'jobId'])
      && isJobId(value.jobId)
      && (expectedJobId === undefined || value.jobId === expectedJobId);
  }
  if (value.type === 'archive-entry') {
    return hasOnlyKeys(value, ['type', 'jobId', 'index', 'bytes'])
      && isJobId(value.jobId)
      && (expectedJobId === undefined || value.jobId === expectedJobId)
      && typeof value.index === 'number'
      && Number.isSafeInteger(value.index)
      && value.index > 0
      && value.bytes instanceof ArrayBuffer;
  }
  if (value.type === 'start') {
    return hasOnlyKeys(value, ['type', 'jobId', 'toolId', 'payload'])
      && isJobId(value.jobId)
      && (expectedJobId === undefined || value.jobId === expectedJobId)
      && typeof value.toolId === 'string'
      && value.toolId.length > 0;
  }
  return false;
}

function isWarning(value: unknown): value is ProcessingWarning {
  if (!isRecord(value) || !hasOnlyOptionalKeys(value, ['code', 'messageKey'], ['recoveryKey'])) return false;
  return typeof value.code === 'string'
    && value.code.length > 0
    && typeof value.messageKey === 'string'
    && value.messageKey.length > 0
    && (value.recoveryKey === undefined || typeof value.recoveryKey === 'string');
}

function isSerializedProcessingError(value: unknown): value is SerializedProcessingError {
  if (!isRecord(value) || !hasOnlyOptionalKeys(
    value,
    ['code', 'phase', 'retryable', 'messageKey', 'recoveryKey'],
    ['diagnosticId'],
  )) return false;

  return typeof value.code === 'string'
    && errorCodes.has(value.code as ProcessingErrorCode)
    && typeof value.phase === 'string'
    && phases.has(value.phase as ProcessingPhase)
    && typeof value.retryable === 'boolean'
    && typeof value.messageKey === 'string'
    && value.messageKey.length > 0
    && typeof value.recoveryKey === 'string'
    && value.recoveryKey.length > 0
    && (value.diagnosticId === undefined || typeof value.diagnosticId === 'string');
}

export function isWorkerToMain(value: unknown): value is WorkerToMain {
  if (!isRecord(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'ready':
    case 'disposed':
      return hasOnlyKeys(value, ['type']);
    case 'progress': {
      if (!hasOnlyOptionalKeys(value, ['type', 'jobId', 'phase'], ['completed', 'total'])) return false;
      if (!isJobId(value.jobId) || typeof value.phase !== 'string' || !phases.has(value.phase as ProcessingPhase)) return false;
      if ((value.completed === undefined) !== (value.total === undefined)) return false;
      if (value.completed === undefined) return true;
      return typeof value.completed === 'number'
        && Number.isFinite(value.completed)
        && value.completed >= 0
        && typeof value.total === 'number'
        && Number.isFinite(value.total)
        && value.total >= value.completed;
    }
    case 'warning':
      return hasOnlyKeys(value, ['type', 'jobId', 'warning'])
        && isJobId(value.jobId)
        && isWarning(value.warning);
    case 'success':
      return hasOnlyKeys(value, ['type', 'jobId', 'result']) && isJobId(value.jobId);
    case 'failure':
      return hasOnlyKeys(value, ['type', 'jobId', 'error'])
        && isJobId(value.jobId)
        && isSerializedProcessingError(value.error);
    case 'cancelled':
      return hasOnlyKeys(value, ['type', 'jobId']) && isJobId(value.jobId);
    default:
      return false;
  }
}
