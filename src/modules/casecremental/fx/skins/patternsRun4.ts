import type { PatternKind, PatternMotion } from "../../sim/types";
import { fbm, hash2 } from "./noise";
import { at, cycle, fract, ramp, smoothstep, spread, type PatternPoint, type Rgb } from "./paint";

// Six finishes for cases 8–9 (finish spec §7.1): Glitch (datamosh, scanline, rgbsplit) and Fever Dream (melt,
// kaleido, huecycle). Same contract as patternsLate.ts: a pure function of (palette, point[, phase]); every pixel one
// palette colour or a blend of two; palettes darkest first; tuned for the 26 × 10 in-game skin at scales 4–7. Glitch's
// kinds stutter (`glitch`: GLITCH_STEPS held arrangements a loop), melt drips down (`drip`, seamless through the
// noise's period), kaleido and huecycle turn (`flow`). Every one repeats at phase 1.

export const RUN4_OWN_MOTION: Partial<Record<PatternKind, PatternMotion>> = {
  datamosh: "glitch",
  scanline: "glitch",
  rgbsplit: "glitch",
  melt: "drip",
  kaleido: "flow",
  huecycle: "flow",
};

/** Held arrangements per loop of the `glitch` motion. */
export const GLITCH_STEPS = 4;

/** Which held arrangement the loop phase is in (0 for a still skin). */
export const glitchStep = (t: number): number => Math.floor(fract(t) * GLITCH_STEPS);

const TAU = Math.PI * 2;
const hot = (pal: readonly Rgb[]): Rgb => at(pal, pal.length - 1);
/** In-game pixel rows of the texture (the skin is 10 tall). */
const SKIN_ROWS = 10;
/** Whole noise rows per texture height, so a vertical run repeats seamlessly. */
const rows = (p: PatternPoint): number => Math.max(1, Math.round(p.scale));

// ── Glitch ──────────────────────────────────────────────────────────────────────────────────────

/** Macroblocks: a smeared base image in blocks; about a third copy their left neighbour shifted (the mosh), a few
 *  are the hottest colour. Glitch: every step rearranges which blocks mosh. Roles: ramp, last = hot block. */
export function datamosh(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
  const step = t === undefined ? 0 : glitchStep(t);
  const bw = 1.25;
  const bh = 0.6;
  const bx = Math.floor(p.x / bw);
  const by = Math.floor(p.y / bh);
  const h = hash2(bx, by + 31 * step, p.seed);
  if (h > 0.93) return hot(pal);
  const smear = h < 0.35 ? (1 + Math.floor(hash2(bx, by, p.seed + 7 + step) * 3)) * bw * 0.5 : 0;
  const n = fbm((p.x - smear) * 0.7, by * bh * 0.7, p.seed, 3);
  return ramp(pal.slice(0, Math.max(1, pal.length - 1)), spread(n));
}

/** CRT: horizontal streaks, every other in-game row darker; a two-row tear band shifted sideways and edged in the
 *  hottest colour. Glitch: the tear jumps to a new row and offset each step. */
export function scanline(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
  const step = t === undefined ? 0 : glitchStep(t);
  const row = Math.floor(fract(p.v) * SKIN_ROWS);
  const tearRow = Math.floor(hash2(step, 0, p.seed) * (SKIN_ROWS - 1));
  const inTear = row === tearRow || row === tearRow + 1;
  const shift = inTear ? (hash2(step, 1, p.seed) - 0.5) * p.scale * 0.8 : 0;
  const k = spread(fbm((p.x + shift) * 0.35, p.y * 0.18, p.seed, 3));
  if (inTear && Math.abs(fract((p.x + shift) * 0.5) - 0.5) < 0.04) return hot(pal);
  return ramp(pal, row % 2 === 1 ? k * 0.55 : k);
}

/** Bold shapes drawn three times: a red ghost left (role 2), a cyan ghost right (role 3), the shape (role 1) over
 *  the ground (role 0), white where all three overlap (last). Glitch: the split width jumps each step. */
export function rgbsplit(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
  const step = t === undefined ? 0 : glitchStep(t);
  const shape = (dx: number) => fbm((p.x + dx) * 0.55, p.y * 0.55, p.seed, 3) > 0.52;
  const d = 0.25 + 0.45 * hash2(step, 2, p.seed);
  const c = shape(0);
  const r = shape(-d);
  const b = shape(d);
  if (c && r && b) return hot(pal);
  if (c) return at(pal, 1);
  if (r) return at(pal, 2);
  if (b) return at(pal, 3);
  return at(pal, 0);
}

// ── Fever Dream ─────────────────────────────────────────────────────────────────────────────────

/** Wax: noise that sags down each column by its own amount. Drip: the texture runs down one height a loop (the
 *  noise repeats every height, so the loop has no seam). The phase is wrapped first, so phase 1 is exactly phase 0. */
export function melt(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
  const P = rows(p);
  const col = Math.floor(p.x * 1.2);
  const sag = 0.35 * P * smoothstep(0, 1, hash2(col, 0, p.seed)) * (0.6 + 0.4 * Math.sin(p.x * 2.1));
  const yy = (p.v - fract(t ?? 0)) * P - sag;
  return ramp(pal, spread(fbm(p.x * 0.6, yy, p.seed, 4, P)));
}

/** Six-fold mirrored wedges of noise around each tile's centre. Flow: they turn a sixth of a turn a loop, which maps
 *  the pattern onto itself. */
export function kaleido(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
  const W = TAU / 6;
  const cx = fract(p.x / 2) * 2 - 1;
  const cy = fract(p.y / 2) * 2 - 1;
  const r = Math.hypot(cx, cy);
  let a = Math.atan2(cy, cx) + W * fract(t ?? 0);
  a = ((a % W) + W) % W;
  if (a > W / 2) a = W - a;
  const n = fbm(r * Math.cos(a) * 1.4 + 3, r * Math.sin(a) * 1.4 + 3, p.seed, 3);
  return cycle(pal, spread(n) * 1.2 + r * 0.35);
}

/** Soft swirled bands through the palette as a wheel. Flow: the wheel turns one full cycle a loop. */
export function huecycle(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
  const warp = fbm(p.x * 0.3, p.y * 0.3, p.seed + 5, 3);
  return cycle(pal, fbm(p.x * 0.35 + 1.5 * warp, p.y * 0.35, p.seed, 3) * 1.4 + fract(t ?? 0));
}
