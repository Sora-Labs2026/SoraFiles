export const manualAdjustmentKeys = [
  'exposure',
  'highlights',
  'shadows',
  'contrast',
  'brightness',
  'blackPoint',
  'definition',
  'sharpness',
  'noiseReduction',
  'saturation',
] as const;

export type ManualAdjustmentKey = (typeof manualAdjustmentKeys)[number];
export type ManualImageAdjustments = Record<ManualAdjustmentKey, number>;

export const defaultManualAdjustments = (): ManualImageAdjustments => ({
  exposure: 0,
  highlights: 0,
  shadows: 0,
  contrast: 0,
  brightness: 0,
  blackPoint: 0,
  definition: 0,
  sharpness: 0,
  noiseReduction: 0,
  saturation: 0,
});

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const clampControl = (value: unknown, minimum = -100) => Math.max(minimum, Math.min(100, Number(value) || 0));
const luma = (red: number, green: number, blue: number) => (54 * red + 183 * green + 19 * blue) >> 8;

export function normalizeManualAdjustments(value?: Partial<ManualImageAdjustments> | null): ManualImageAdjustments {
  return {
    exposure: clampControl(value?.exposure),
    highlights: clampControl(value?.highlights),
    shadows: clampControl(value?.shadows),
    contrast: clampControl(value?.contrast),
    brightness: clampControl(value?.brightness),
    blackPoint: clampControl(value?.blackPoint, 0),
    definition: clampControl(value?.definition, 0),
    sharpness: clampControl(value?.sharpness, 0),
    noiseReduction: clampControl(value?.noiseReduction, 0),
    saturation: clampControl(value?.saturation),
  };
}

export function hasManualAdjustments(value: ManualImageAdjustments): boolean {
  return manualAdjustmentKeys.some((key) => value[key] !== 0);
}

function reduceNoise(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  if (amount <= 0 || width < 3 || height < 3) return;
  const rowBytes = width * 4;
  let previous = data.slice(0, rowBytes);
  let current = data.slice(rowBytes, rowBytes * 2);
  const blend = Math.min(.72, amount / 100 * .72);
  const threshold = 10 + amount * .42;
  for (let y = 1; y < height - 1; y += 1) {
    const next = data.slice((y + 1) * rowBytes, (y + 2) * rowBytes);
    for (let x = 1; x < width - 1; x += 1) {
      const offset = x * 4;
      const centerLuma = luma(current[offset], current[offset + 1], current[offset + 2]);
      const neighbors = [
        [current, offset - 4], [current, offset + 4],
        [previous, offset], [next, offset],
      ] as const;
      let red = current[offset]; let green = current[offset + 1]; let blue = current[offset + 2]; let weight = 1;
      for (const [row, neighborOffset] of neighbors) {
        const difference = Math.abs(centerLuma - luma(row[neighborOffset], row[neighborOffset + 1], row[neighborOffset + 2]));
        if (difference > threshold) continue;
        const neighborWeight = 1 - difference / (threshold + 1);
        red += row[neighborOffset] * neighborWeight;
        green += row[neighborOffset + 1] * neighborWeight;
        blue += row[neighborOffset + 2] * neighborWeight;
        weight += neighborWeight;
      }
      const target = y * rowBytes + offset;
      data[target] = clampByte(current[offset] + (red / weight - current[offset]) * blend);
      data[target + 1] = clampByte(current[offset + 1] + (green / weight - current[offset + 1]) * blend);
      data[target + 2] = clampByte(current[offset + 2] + (blue / weight - current[offset + 2]) * blend);
    }
    previous = current;
    current = next;
  }
}

function addLocalDetail(data: Uint8ClampedArray, width: number, height: number, amount: number, detailLimit: number) {
  if (amount <= 0 || width < 3 || height < 3) return;
  const rowBytes = width * 4;
  let previous = data.slice(0, rowBytes);
  let current = data.slice(rowBytes, rowBytes * 2);
  for (let y = 1; y < height - 1; y += 1) {
    const next = data.slice((y + 1) * rowBytes, (y + 2) * rowBytes);
    for (let x = 1; x < width - 1; x += 1) {
      const offset = x * 4;
      const center = luma(current[offset], current[offset + 1], current[offset + 2]);
      const surround = (
        luma(current[offset - 4], current[offset - 3], current[offset - 2])
        + luma(current[offset + 4], current[offset + 5], current[offset + 6])
        + luma(previous[offset], previous[offset + 1], previous[offset + 2])
        + luma(next[offset], next[offset + 1], next[offset + 2])
      ) / 4;
      const detail = Math.max(-detailLimit, Math.min(detailLimit, center - surround)) * amount;
      const target = y * rowBytes + offset;
      data[target] = clampByte(current[offset] + detail);
      data[target + 1] = clampByte(current[offset + 1] + detail);
      data[target + 2] = clampByte(current[offset + 2] + detail);
    }
    previous = current;
    current = next;
  }
}

export function applyManualAdjustments(source: ImageData, raw: Partial<ManualImageAdjustments>, copy = true): ImageData {
  const adjustments = normalizeManualAdjustments(raw);
  const output = copy ? new Uint8ClampedArray(source.data) : source.data;
  const exposureGain = 2 ** (adjustments.exposure / 50);
  const brightnessOffset = adjustments.brightness / 100 * 64;
  const contrastGain = Math.max(0, 1 + adjustments.contrast / 100);
  const blackLevel = adjustments.blackPoint / 100 * 64;
  const blackRange = Math.max(1, 255 - blackLevel);
  const saturationGain = Math.max(0, 1 + adjustments.saturation / 100);
  const shadows = adjustments.shadows / 100;
  const highlights = adjustments.highlights / 100;

  if (exposureGain !== 1 || brightnessOffset !== 0 || contrastGain !== 1 || blackLevel !== 0 || saturationGain !== 1 || shadows !== 0 || highlights !== 0) {
    for (let index = 0; index < output.length; index += 4) {
      let red = output[index] * exposureGain;
      let green = output[index + 1] * exposureGain;
      let blue = output[index + 2] * exposureGain;
      const luminance = Math.max(0, Math.min(1, luma(red, green, blue) / 255));
      const tonalOffset = (shadows * (1 - luminance) ** 2 + highlights * luminance ** 2) * 88;
      red += tonalOffset + brightnessOffset;
      green += tonalOffset + brightnessOffset;
      blue += tonalOffset + brightnessOffset;
      red = (red - 128) * contrastGain + 128;
      green = (green - 128) * contrastGain + 128;
      blue = (blue - 128) * contrastGain + 128;
      red = (red - blackLevel) * 255 / blackRange;
      green = (green - blackLevel) * 255 / blackRange;
      blue = (blue - blackLevel) * 255 / blackRange;
      const gray = luma(red, green, blue);
      output[index] = clampByte(gray + (red - gray) * saturationGain);
      output[index + 1] = clampByte(gray + (green - gray) * saturationGain);
      output[index + 2] = clampByte(gray + (blue - gray) * saturationGain);
    }
  }

  reduceNoise(output, source.width, source.height, adjustments.noiseReduction);
  addLocalDetail(output, source.width, source.height, adjustments.definition / 100 * .72, 22);
  addLocalDetail(output, source.width, source.height, adjustments.sharpness / 100 * 1.15, 10);
  return new ImageData(output, source.width, source.height);
}
