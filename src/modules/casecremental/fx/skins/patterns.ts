import type { PatternSpec } from "../../sim/types";
import { fbm, hash2, voronoi } from "./noise";
import { hexToRgb, pick, ramp, spread, type PatternPoint, type Rgb } from "./paint";
import { carbon, circuit, hex } from "./patternsLate";

// The skin finishes: each maps a point of the texture to a colour of the skin's palette. Cases 1-3's ten live
// here (army: camo, digital, tiger; forest: leaves, bark, moss; rocks: marble, granite, crystal, lava); cases
// 4-7's thirteen richer ones in patternsLate.ts; the shared colour helpers in paint.ts.

export { hexToRgb, type Rgb } from "./paint";
export { OWN_MOTION } from "./patternsLate";

/** Color at (u, v) ∈ [0,1)² of a 2.5 : 1 texture. `phase` (the loop phase, not wrapped here) reaches only the
 *  kinds that draw their own motion (OWN_MOTION); every other kind ignores it. */
export function patternColor(spec: PatternSpec, pal: readonly Rgb[], u: number, v: number, phase?: number): Rgb {
  const x = u * spec.scale * 2.5;
  const y = v * spec.scale;
  const seed = spec.seed;
  // the late kinds (Tasks 2-5) take the point as one object, plus `phase`
  const p: PatternPoint = { u, v, x, y, scale: spec.scale, seed };
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
    case "circuit":
      return circuit(pal, p, phase);
    case "hex":
      return hex(pal, p, phase);
    case "carbon":
      return carbon(pal, p);
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
