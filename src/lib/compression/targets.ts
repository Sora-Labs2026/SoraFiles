export type CompressionGoal =
  | { mode: 'auto'; sourceBytes: number }
  | { mode: 'target'; sourceBytes: number; targetKb: number }
  | { mode: 'percent'; sourceBytes: number; reductionPercent: number };

const MIN_TARGET_BYTES = 1;

export function compressionTargetBytes(goal: CompressionGoal): number {
  if (!Number.isSafeInteger(goal.sourceBytes) || goal.sourceBytes <= 0) {
    throw new Error('The source file size is invalid. Choose the file again.');
  }

  if (goal.mode === 'auto') return Math.max(MIN_TARGET_BYTES, Math.floor(goal.sourceBytes * 0.8));

  if (goal.mode === 'target') {
    if (!Number.isFinite(goal.targetKb) || goal.targetKb < 1) {
      throw new Error('Enter a valid target size.');
    }
    const requested = Math.floor(goal.targetKb * 1_000);
    if (requested >= goal.sourceBytes) {
      throw new Error('Choose a target smaller than the original file.');
    }
    return Math.max(MIN_TARGET_BYTES, requested);
  }

  if (!Number.isFinite(goal.reductionPercent) || goal.reductionPercent < 1 || goal.reductionPercent > 95) {
    throw new Error('Choose a reduction from 1% to 95%.');
  }
  return Math.max(MIN_TARGET_BYTES, Math.floor((goal.sourceBytes * (100 - goal.reductionPercent)) / 100));
}

export function assertCompressionTarget(outputBytes: number, targetBytes: number): void {
  if (!Number.isSafeInteger(outputBytes) || outputBytes <= 0) {
    throw new Error('The compressor produced an invalid empty result. Your original file is unchanged.');
  }
  if (outputBytes > targetBytes) {
    throw new Error(`The requested hard limit could not be reached. The result was ${outputBytes} bytes, above the ${targetBytes}-byte limit, so no download was created.`);
  }
}

export function reductionPercent(sourceBytes: number, outputBytes: number): number {
  return Math.max(0, Math.round((1 - outputBytes / sourceBytes) * 100));
}
