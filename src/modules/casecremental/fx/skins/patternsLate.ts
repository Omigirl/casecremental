import type { PatternKind, PatternMotion } from "../../sim/types";
import { fbm, hash2 } from "./noise";
import { at, clamp01, fract, mix, ramp, smoothstep, type PatternPoint, type Rgb } from "./paint";

// Thirteen finishes for cases 4-7 (spec: M3 §3): Mainframe (circuit, hex, carbon), Neon Nights (synthgrid,
// neonline, hueflow), Deep Space (starfield, nebula, aurora, iridescent), Inferno (flame, ember, molten).
// Each is a richer technique than cases 1-3 (networks, perspective, domain warping, distance-based glow) and
// still a pure function of (palette, point[, phase]). Palettes run darkest first; glow is bright colours on
// dark ones with a soft falloff, and every pixel is one palette colour or a blend of two. They are tuned for
// the in-game skin (26 x 10 px) at scales 4-8: thin lines are kept at least one game pixel wide.

/** The motion each kind draws itself (traces lighting up, a grid rolling in, flames rising...): finishAt hands
 *  it the loop phase and lays nothing generic on top. Every one repeats at phase 1, so its loop has no seam. */
export const OWN_MOTION: Partial<Record<PatternKind, PatternMotion>> = {
  circuit: "pulse",
  hex: "pulse",
};

const TAU = Math.PI * 2;
const hot = (pal: readonly Rgb[]): Rgb => at(pal, pal.length - 1);
/** One pixel of the in-game skin (10 px tall) in feature units: thin lines stay at least this wide. */
const px = (p: PatternPoint): number => p.scale * 0.1;

// ── Mainframe ───────────────────────────────────────────────────────────────────────────────────

/** PCB: copper traces join cell centres along the lattice; a trace end gets a pad with a drilled via, a
 *  junction a pad, over a board with patches of ground pour. Pulse: a current wave runs along the traces.
 *  Roles: 0 board, 1 ground pour, 2 trace, 3 pad, last = lit. */
export function circuit(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
  const gx = p.x * 0.6;
  const gy = p.y * 0.6;
  const cx = Math.floor(gx);
  const cy = Math.floor(gy);
  const fx = gx - cx - 0.5;
  const fy = gy - cy - 0.5;
  const east = (i: number, j: number) => hash2(i, j, p.seed + 1) < 0.5;
  const south = (i: number, j: number) => hash2(i, j, p.seed + 2) < 0.42;
  const e = east(cx, cy);
  const w = east(cx - 1, cy);
  const s = south(cx, cy);
  const n = south(cx, cy - 1);
  const links = +e + +w + +s + +n;
  const centre = Math.max(Math.abs(fx), Math.abs(fy));
  let d = Number.POSITIVE_INFINITY;
  if (e && fx >= 0) d = Math.min(d, Math.abs(fy));
  if (w && fx <= 0) d = Math.min(d, Math.abs(fy));
  if (s && fy >= 0) d = Math.min(d, Math.abs(fx));
  if (n && fy <= 0) d = Math.min(d, Math.abs(fx));
  if (links) d = Math.min(d, centre);
  const lit = t === undefined ? 0 : Math.max(0, Math.cos(TAU * ((gx + gy) * 0.25 + hash2(0, 0, p.seed) - t))) ** 3;
  const pad = (links === 1 || links >= 3) && centre < 0.3;
  if (pad) {
    if (links === 1 && centre < 0.11) return at(pal, 0);
    return mix(at(pal, 3), hot(pal), lit);
  }
  const hw = Math.max(0.13, 0.33 * px(p));
  if (d < hw) return mix(at(pal, 2), hot(pal), lit);
  const board = fbm(p.x * 0.35, p.y * 0.35, p.seed + 5, 3) > 0.56 ? at(pal, 1) : at(pal, 0);
  if (d < hw + 0.22) return mix(board, at(pal, 2), 0.3 * (1 - (d - hw) / 0.22) + 0.3 * lit);
  return board;
}

/** Honeycomb: bevelled cells in dark seams, about one in five lit from inside. Pulse: each lit cell breathes
 *  at its own moment. Roles: 0 seam, 1-2 cell (top-lit), second-to-last = dimmed light, last = light. */
export function hex(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
  const R = 1;
  const W = Math.sqrt(3) * R;
  const V = 3 * R;
  const ia = Math.round(p.x / W);
  const ja = Math.round(p.y / V);
  const ib = Math.round((p.x - W / 2) / W);
  const jb = Math.round((p.y - V / 2) / V);
  const da = Math.hypot(p.x - ia * W, p.y - ja * V);
  const db = Math.hypot(p.x - (ib * W + W / 2), p.y - (jb * V + V / 2));
  const [ci, cj, dx, dy] =
    da <= db ? [ia, ja * 2, p.x - ia * W, p.y - ja * V] : [ib, jb * 2 + 1, p.x - (ib * W + W / 2), p.y - (jb * V + V / 2)];
  const qx = Math.abs(dx);
  const qy = Math.abs(dy);
  const hd = Math.max(qx, 0.5 * qx + 0.866 * qy) / (0.866 * R);
  if (hd > 0.8) return at(pal, 0);
  const id = hash2(ci, cj, p.seed);
  if (id < 0.22) {
    const k = t === undefined ? 1 : 0.5 + 0.5 * Math.cos(TAU * (t - hash2(ci, cj, p.seed + 3)));
    return mix(at(pal, Math.max(2, pal.length - 2)), hot(pal), k * (0.9 - 0.8 * hd));
  }
  return mix(at(pal, 1), at(pal, 2), clamp01(0.45 - dy / R));
}

/** 2/2 twill carbon fibre: tows go over and under in diagonal steps, each rounded across its width, the two
 *  directions catching the light differently, under a soft clear-coat streak. A ramp of the palette. */
export function carbon(pal: readonly Rgb[], p: PatternPoint): Rgb {
  const i = Math.floor(p.x);
  const j = Math.floor(p.y);
  const flat = (((i + j) % 4) + 4) % 4 < 2;
  const across = flat ? p.y - j : p.x - i;
  const bulge = Math.sin(Math.PI * across);
  const fibre = 0.1 * hash2(flat ? i : Math.floor(p.x * 6), flat ? Math.floor(p.y * 6) : j, p.seed);
  const coat = smoothstep(0.55, 1, 1 - Math.abs(fract((p.u * 2.5 + p.v) * 0.45 + 0.25 * fbm(p.x * 0.2, p.y * 0.2, p.seed, 3)) - 0.5) * 2);
  return ramp(pal, clamp01(bulge * (flat ? 0.62 : 0.4) + fibre + 0.35 * coat));
}
