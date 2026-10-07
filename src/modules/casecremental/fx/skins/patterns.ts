import type { PatternSpec } from "../../sim/types";
import { fbm, hash2, voronoi } from "./noise";

// Ten procedural finishes for the first three cases: army (camo, digital, tiger), forest (leaves,
// bark, moss) and rocks (marble, granite, crystal, lava). Each maps a point of the texture to a
// color from the skin's palette. Later cases add shader-based, animated finishes (milestone 2).

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** fbm bunches around 0.5 — spread it over the whole 0..1 range. */
const spread = (n: number) => clamp01((n - 0.25) / 0.5);

const pick = (pal: readonly Rgb[], t: number): Rgb =>
  pal[Math.min(pal.length - 1, Math.floor(clamp01(t) * pal.length))]!;

function ramp(pal: readonly Rgb[], t: number): Rgb {
  if (pal.length === 1) return pal[0]!;
  const x = clamp01(t) * (pal.length - 1);
  const i = Math.min(pal.length - 2, Math.floor(x));
  const f = x - i;
  const a = pal[i]!;
  const b = pal[i + 1]!;
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/** Color at (u, v) ∈ [0,1)² of a 2.5 : 1 texture. */
export function patternColor(spec: PatternSpec, pal: readonly Rgb[], u: number, v: number): Rgb {
  const x = u * spec.scale * 2.5;
  const y = v * spec.scale;
  const seed = spec.seed;
  switch (spec.kind) {
    case "camo":
      return pick(pal, spread(fbm(x, y, seed)));
    case "digital": {
      const q = 3;
      return pick(pal, spread(fbm(Math.floor(x * q) / q, Math.floor(y * q) / q, seed)));
    }
    case "tiger": {
      const t = Math.sin((x * 1.6 + fbm(x * 0.5, y * 0.5, seed, 3) * 4) * Math.PI);
      if (t > 0.45) return pal[1]!;
      if (t < -0.85 && pal.length > 2) return pal[2]!;
      return pal[0]!;
    }
    case "leaves":
      return pick(pal, spread(fbm(x, y * 0.6, seed) + 0.12 * Math.sin(x * 6 + y * 2)));
    case "bark":
      return ramp(pal, spread(fbm(x * 0.25, y * 3, seed, 5)));
    case "moss":
      return ramp(pal, spread(fbm(x * 2, y * 2, seed, 6)));
    case "marble": {
      const t = Math.abs(Math.sin((x * 0.5 + fbm(x * 0.6, y * 0.6, seed, 5) * 6) * Math.PI));
      if (t < 0.06 && pal.length > 2) return pal[2]!;
      return ramp([pal[0]!, pal[1]!], t ** 0.4);
    }
    case "granite":
      return pick(pal, hash2(Math.floor(x * 6), Math.floor(y * 6), seed));
    case "crystal": {
      const { f1, f2, cell } = voronoi(x * 1.2, y * 1.2, seed);
      if (f2 - f1 < 0.06) return pal[pal.length - 1]!;
      return pick(pal.slice(0, Math.max(1, pal.length - 1)), cell);
    }
    case "lava": {
      const half = Math.max(1, Math.floor(pal.length / 2));
      const { f1, f2 } = voronoi(x * 1.1, y * 1.1, seed);
      const crack = f2 - f1;
      if (crack < 0.08) return ramp(pal.slice(half), 1 - crack / 0.08);
      return pick(pal.slice(0, half), fbm(x, y, seed));
    }
  }
}

export function renderPattern(spec: PatternSpec, w: number, h: number): Uint8ClampedArray<ArrayBuffer> {
  const pal = spec.palette.map(hexToRgb);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const c = patternColor(spec, pal, i / w, j / h);
      const o = (j * w + i) * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  return out;
}
