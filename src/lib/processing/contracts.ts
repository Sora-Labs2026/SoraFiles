import type { PublicToolSlug } from '../../data/tools';

export type PublicToolId = PublicToolSlug;

export type ExecutionPolicy = 'main-short' | 'dedicated-worker' | 'library-worker';
export type LossProfile = 'lossless-structure' | 'lossy-pixels' | 'flattened' | 'text-only';

export interface LocalToolRuntimeDefinition {
  id: PublicToolId;
  engineId: string;
  acceptedSignatures: readonly string[];
  outputKinds: readonly string[];
  modes: readonly string[];
  execution: ExecutionPolicy;
  cancellable: boolean;
  lossProfile: LossProfile;
  limits: {
    maxFiles: number;
    maxTotalBytes: number;
    maxPages?: number;
    maxPixelsPerSurface?: number;
  };
  warningKeys: readonly string[];
}

export type ProcessingPhase =
  | 'validate' | 'decode' | 'process' | 'encode' | 'package'
  | 'validate-output' | 'cleanup';

export interface ProcessingWarning {
  code: string;
  messageKey: string;
  recoveryKey?: string;
}

export type ProcessingEvent =
  | { type: 'phase'; jobId: string; phase: ProcessingPhase }
  | { type: 'progress'; jobId: string; phase: ProcessingPhase; completed: number; total: number }
  | { type: 'warning'; jobId: string; warning: ProcessingWarning };

export interface ProcessingResult<T> {
  output: T;
  stats: {
    inputBytes: number;
    outputBytes: number;
    durationMs: number;
    pages?: number;
    width?: number;
    height?: number;
  };
  warnings: ProcessingWarning[];
  changes: string[];
}

export type ProcessingErrorCode =
  | 'invalid-signature' | 'corrupt-input' | 'unsupported-format' | 'unsupported-variant'
  | 'encrypted-file' | 'password-required' | 'file-count-limit' | 'file-size-limit'
  | 'page-limit' | 'pixel-limit' | 'memory-pressure' | 'browser-unsupported'
  | 'decode-failed' | 'encode-failed' | 'render-failed' | 'archive-failed'
  | 'worker-start-failed' | 'worker-crashed' | 'wasm-load-failed'
  | 'target-unreachable' | 'output-invalid' | 'cancelled' | 'unknown';

export interface SerializedProcessingError {
  code: ProcessingErrorCode;
  phase: ProcessingPhase;
  retryable: boolean;
  messageKey: string;
  recoveryKey: string;
  diagnosticId?: string;
}
