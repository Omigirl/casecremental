// Small deterministic noise toolkit for the skin patterns: integer hash, value noise, fractal
// noise (fbm) and voronoi cells. Pure functions — same input, same pixels.

export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Distance to the nearest (f1) and second-nearest (f2) cell point, and the nearest cell's id. */
export function voronoi(x: number, y: number, seed: number): { f1: number; f2: number; cell: number } {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = Number.POSITIVE_INFINITY;
  let f2 = Number.POSITIVE_INFINITY;
  let cell = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx;
      const cy = yi + dy;
      const d = Math.hypot(cx + hash2(cx, cy, seed) - x, cy + hash2(cx, cy, seed + 7) - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        cell = hash2(cx, cy, seed + 13);
      } else if (d < f2) {
        f2 = d;
      }
    }
  return { f1, f2, cell };
}
