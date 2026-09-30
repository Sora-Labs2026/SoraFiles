type Color = [number, number, number];
export type SolidPalette = { background: Color; foreground: Color[] };
const distance = (a: Color, b: Color) => a.reduce((sum, v, c) => sum + (v - b[c]) ** 2, 0);

// This optional color key is restricted to opaque, nearly uniform borders.
// Photographs with textured borders and pretransparent images keep their mask.
export function solidPalette(source: Uint8ClampedArray, mask: Uint8ClampedArray, width: number, height: number): SolidPalette | undefined {
  const border: Color[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x > 1 && y > 1 && x < width - 2 && y < height - 2) continue;
    const i = (y * width + x) * 4;
    if (source[i + 3] !== 255) return;
    border.push([source[i], source[i + 1], source[i + 2]]);
  }
  const background = [0, 1, 2].map(c => border.map(v => v[c]).sort((a, b) => a - b)[Math.floor(border.length / 2)]) as Color;
  if (border.filter(v => distance(v, background) <= 64).length / border.length < .98) return;
  const bins = new Map<string, { sum: Color; count: number }>();
  for (let i = 0; i < source.length; i += 4) {
    const color: Color = [source[i], source[i + 1], source[i + 2]];
    if (source[i + 3] !== 255 || mask[i + 3] < 250 || distance(color, background) < 4900) continue;
    const key = color.map(v => Math.floor(v / 24)).join(',');
    const bin = bins.get(key) ?? { sum: [0, 0, 0] as Color, count: 0 };
    bin.count++;
    color.forEach((v, c) => bin.sum[c] += v);
    bins.set(key, bin);
  }
  const foreground = [...bins.values()].filter(b => b.count >= 3).sort((a, b) => b.count - a.count).slice(0, 12).map(b => b.sum.map(v => v / b.count) as Color);
  if (!foreground.length) return;
  return { background, foreground };
}

// Work in bounded strips at the original resolution. Fit a pixel to a mixture
// of the border color and a confidently segmented subject color. Keep the model
// result wherever that simple mixture does not explain the source pixel.
export function refineSolidStrip(source: Uint8ClampedArray, output: Uint8ClampedArray, palette: SolidPalette) {
  const b = palette.background;
  for (let i = 0; i < source.length; i += 4) {
    if (source[i + 3] !== 255) continue;
    const p: Color = [source[i], source[i + 1], source[i + 2]];
    if (distance(p, b) <= 16) { output[i + 3] = 0; continue; }
    let bestError = 48, bestAlpha = 0, bestColor: Color | undefined;
    for (const f of palette.foreground) {
      const vector = f.map((v, c) => v - b[c]);
      const alpha = Math.max(0, Math.min(1, vector.reduce((sum, v, c) => sum + (p[c] - b[c]) * v, 0) / distance(f, b)));
      const error = p.reduce((sum, v, c) => sum + (v - b[c] - alpha * vector[c]) ** 2, 0);
      if (error < bestError) { bestError = error; bestAlpha = alpha; bestColor = f; }
    }
    if (!bestColor) continue;
    output[i + 3] = Math.round(bestAlpha * source[i + 3]);
    if (bestAlpha > .01 && bestAlpha < .98) bestColor.forEach((v, c) => output[i + c] = Math.round(v));
  }
}
