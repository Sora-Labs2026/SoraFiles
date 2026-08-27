export type ScanFilter = 'original' | 'enhanced' | 'color' | 'grayscale' | 'bw' | 'contrast' | 'receipt';

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const luma = (r: number, g: number, b: number) => (54 * r + 183 * g + 19 * b) >> 8;

function conservativeWhiteBalance(data: Uint8ClampedArray): [number, number, number] {
  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;
  const stride = Math.max(4, Math.floor(data.length / 80_000 / 4) * 4);
  for (let index = 0; index < data.length; index += stride) {
    red += data[index];
    green += data[index + 1];
    blue += data[index + 2];
    samples += 1;
  }
  const average = (red + green + blue) / Math.max(1, samples * 3);
  const restrainedGain = (channel: number) => {
    const grayWorld = average / Math.max(1, channel / Math.max(1, samples));
    return Math.max(.9, Math.min(1.1, 1 + (grayWorld - 1) * .28));
  };
  return [restrainedGain(red), restrainedGain(green), restrainedGain(blue)];
}

function restrainedSharpen(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  if (width < 3 || height < 3 || amount <= 0) return;
  const rowBytes = width * 4;
  let previous = data.slice(0, rowBytes);
  let current = data.slice(rowBytes, rowBytes * 2);
  for (let y = 1; y < height - 1; y += 1) {
    const next = data.slice((y + 1) * rowBytes, (y + 2) * rowBytes);
    for (let x = 1; x < width - 1; x += 1) {
      const offset = x * 4;
      const center = luma(current[offset], current[offset + 1], current[offset + 2]);
      const neighbors = (
        luma(current[offset - 4], current[offset - 3], current[offset - 2])
        + luma(current[offset + 4], current[offset + 5], current[offset + 6])
        + luma(previous[offset], previous[offset + 1], previous[offset + 2])
        + luma(next[offset], next[offset + 1], next[offset + 2])
      ) / 4;
      const detail = Math.max(-8, Math.min(8, (center - neighbors) * amount));
      const target = y * rowBytes + offset;
      data[target] = clamp(current[offset] + detail);
      data[target + 1] = clamp(current[offset + 1] + detail);
      data[target + 2] = clamp(current[offset + 2] + detail);
    }
    previous = current;
    current = next;
  }
}

function percentileBounds(data: Uint8ClampedArray): [number, number] {
  const histogram = new Uint32Array(256);
  let pixels = 0;
  for (let index = 0; index < data.length; index += 16) {
    histogram[luma(data[index], data[index + 1], data[index + 2])] += 1;
    pixels += 1;
  }
  const lowTarget = pixels * 0.015;
  const highTarget = pixels * 0.985;
  let total = 0;
  let low = 0;
  let high = 255;
  for (let value = 0; value < 256; value += 1) {
    total += histogram[value];
    if (total >= lowTarget) { low = value; break; }
  }
  total = 0;
  for (let value = 0; value < 256; value += 1) {
    total += histogram[value];
    if (total >= highTarget) { high = value; break; }
  }
  return high - low < 24 ? [Math.max(0, low - 12), Math.min(255, high + 12)] : [low, high];
}

function adaptiveThreshold(image: ImageData, bias: number): ImageData {
  const { width, height, data } = image;
  const integralWidth = width + 1;
  const integral = new Uint32Array(integralWidth * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let row = 0;
    for (let x = 1; x <= width; x += 1) {
      const pixel = ((y - 1) * width + (x - 1)) * 4;
      row += luma(data[pixel], data[pixel + 1], data[pixel + 2]);
      integral[y * integralWidth + x] = integral[(y - 1) * integralWidth + x] + row;
    }
  }
  const radius = Math.max(8, Math.min(32, Math.round(Math.min(width, height) / 45)));
  const output = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[(y1 + 1) * integralWidth + x1 + 1]
        - integral[y0 * integralWidth + x1 + 1]
        - integral[(y1 + 1) * integralWidth + x0]
        + integral[y0 * integralWidth + x0];
      const pixel = (y * width + x) * 4;
      const value = luma(data[pixel], data[pixel + 1], data[pixel + 2]) < (sum / count) - bias ? 0 : 255;
      output[pixel] = value;
      output[pixel + 1] = value;
      output[pixel + 2] = value;
      output[pixel + 3] = data[pixel + 3];
    }
  }
  return new ImageData(output, width, height);
}

export function applyScanFilter(source: ImageData, filter: ScanFilter): ImageData {
  if (filter === 'original') return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  if (filter === 'bw' || filter === 'receipt') return adaptiveThreshold(source, filter === 'receipt' ? 13 : 9);

  const output = new Uint8ClampedArray(source.data);
  const [low, high] = percentileBounds(output);
  const range = Math.max(1, high - low);
  const balance = filter === 'enhanced' ? conservativeWhiteBalance(output) : [1, 1, 1];
  for (let index = 0; index < output.length; index += 4) {
    const y = luma(output[index], output[index + 1], output[index + 2]);
    if (filter === 'grayscale' || filter === 'contrast') {
      const normalized = clamp(((y - low) * 255) / range);
      const value = filter === 'contrast' ? clamp((normalized - 128) * 1.18 + 128) : normalized;
      output[index] = value;
      output[index + 1] = value;
      output[index + 2] = value;
    } else {
      const strength = filter === 'enhanced' ? 0.72 : 0.5;
      const normalized = clamp(((y - low) * 255) / range);
      const gain = y > 4 ? (y + (normalized - y) * strength) / y : 1;
      output[index] = clamp(output[index] * gain * balance[0]);
      output[index + 1] = clamp(output[index + 1] * gain * balance[1]);
      output[index + 2] = clamp(output[index + 2] * gain * balance[2]);
    }
  }
  restrainedSharpen(output, source.width, source.height, filter === 'enhanced' ? .18 : filter === 'color' ? .1 : filter === 'grayscale' ? .08 : 0);
  return new ImageData(output, source.width, source.height);
}

export function scanQualityHint(image: ImageData): 'more-light' | 'glare' | 'blur' | 'hold-steady' {
  const { data, width, height } = image;
  let total = 0;
  let bright = 0;
  let edges = 0;
  let samples = 0;
  const stride = Math.max(1, Math.floor(Math.max(width, height) / 480));
  for (let y = stride; y < height - stride; y += stride) {
    for (let x = stride; x < width - stride; x += stride) {
      const index = (y * width + x) * 4;
      const value = luma(data[index], data[index + 1], data[index + 2]);
      total += value;
      if (value > 246) bright += 1;
      const rightIndex = (y * width + x + stride) * 4;
      const downIndex = ((y + stride) * width + x) * 4;
      edges += Math.abs(value - luma(data[rightIndex], data[rightIndex + 1], data[rightIndex + 2]));
      edges += Math.abs(value - luma(data[downIndex], data[downIndex + 1], data[downIndex + 2]));
      samples += 1;
    }
  }
  const average = total / Math.max(1, samples);
  if (average < 58) return 'more-light';
  if (bright / Math.max(1, samples) > 0.18) return 'glare';
  if (edges / Math.max(1, samples * 2) < 5.5) return 'blur';
  return 'hold-steady';
}
