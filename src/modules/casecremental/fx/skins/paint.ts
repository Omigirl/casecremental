// The paint kit every pattern file shares: palette colours, picking, ramps and blends. Pure.

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
/** fbm bunches around 0.5 — spread it over the whole 0..1 range. */
export const spread = (n: number): number => clamp01((n - 0.25) / 0.5);
/** Hermite ease of t between edges a and b (0 below a, 1 above b). */
export const smoothstep = (a: number, b: number, t: number): number => {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};
/** Fractional part, always in [0, 1). */
export const fract = (t: number): number => t - Math.floor(t);

/** The palette from colour i on — never empty: a short palette keeps at least its last colour. */
export const tail = (pal: readonly Rgb[], i: number): readonly Rgb[] => pal.slice(Math.max(0, Math.min(i, pal.length - 1)));

/** Palette colour i, clamped into the palette (a short palette never reads past its end). */
export const at = (pal: readonly Rgb[], i: number): Rgb => pal[Math.max(0, Math.min(pal.length - 1, i))]!;

export const pick = (pal: readonly Rgb[], t: number): Rgb => pal[Math.min(pal.length - 1, Math.floor(clamp01(t) * pal.length))]!;

/** a → b by f, rounded to whole channels. */
export function mix(a: Rgb, b: Rgb, f: number): Rgb {
  const k = clamp01(f);
  return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
}

/** A smooth walk from the first colour to the last: a blend of two neighbouring palette colours. */
export function ramp(pal: readonly Rgb[], t: number): Rgb {
  if (pal.length === 1) return pal[0]!;
  const x = clamp01(t) * (pal.length - 1);
  const i = Math.min(pal.length - 2, Math.floor(x));
  return mix(pal[i]!, pal[i + 1]!, x - i);
}

/** A ramp that wraps: the last colour flows back into the first, so t and t + 1 give the same colour. */
export function cycle(pal: readonly Rgb[], t: number): Rgb {
  const x = fract(t) * pal.length;
  const i = Math.floor(x) % pal.length;
  return mix(pal[i]!, pal[(i + 1) % pal.length]!, x - Math.floor(x));
}

/** Where a pattern is sampled: (u, v) ∈ [0,1)² of the 2.5 : 1 texture (motion may push it a little
 *  outside), the same point in feature units (x = u·scale·2.5, y = v·scale), and the skin's seed and scale. */
export interface PatternPoint {
  u: number;
  v: number;
  x: number;
  y: number;
  scale: number;
  seed: number;
}
