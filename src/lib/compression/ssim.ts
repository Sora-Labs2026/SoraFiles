function luminance(data: Uint8ClampedArray, pixel: number): number {
  const offset = pixel * 4;
  return .2126 * data[offset] + .7152 * data[offset + 1] + .0722 * data[offset + 2];
}

/** Block SSIM over RGBA pixels. Inputs must have identical dimensions. */
export function rgbaSsim(a: ImageData, b: ImageData, blockSize = 8): number {
  if (a.width !== b.width || a.height !== b.height || a.width < 1 || a.height < 1) return 0;
  const c1 = (255 * .01) ** 2;
  const c2 = (255 * .03) ** 2;
  let sum = 0;
  let blocks = 0;
  for (let top = 0; top < a.height; top += blockSize) {
    for (let left = 0; left < a.width; left += blockSize) {
      const right = Math.min(a.width, left + blockSize);
      const bottom = Math.min(a.height, top + blockSize);
      const count = (right - left) * (bottom - top);
      let meanA = 0;
      let meanB = 0;
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const pixel = y * a.width + x;
          meanA += luminance(a.data, pixel);
          meanB += luminance(b.data, pixel);
        }
      }
      meanA /= count;
      meanB /= count;
      let varianceA = 0;
      let varianceB = 0;
      let covariance = 0;
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const pixel = y * a.width + x;
          const deltaA = luminance(a.data, pixel) - meanA;
          const deltaB = luminance(b.data, pixel) - meanB;
          varianceA += deltaA * deltaA;
          varianceB += deltaB * deltaB;
          covariance += deltaA * deltaB;
        }
      }
      const divisor = Math.max(1, count - 1);
      varianceA /= divisor;
      varianceB /= divisor;
      covariance /= divisor;
      sum += ((2 * meanA * meanB + c1) * (2 * covariance + c2)) /
        ((meanA * meanA + meanB * meanB + c1) * (varianceA + varianceB + c2));
      blocks += 1;
    }
  }
  return blocks ? sum / blocks : 0;
}

