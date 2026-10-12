import type { PatternKind, PatternMotion } from "../../sim/types";
import { fbm, hash2, wrapRow } from "./noise";
import { at, clamp01, cycle, fract, mix, ramp, smoothstep, spread, tail, type PatternPoint, type Rgb } from "./paint";

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
  synthgrid: "flow",
  hueflow: "flow",
  aurora: "flow",
  flame: "rise",
  ember: "rise",
  molten: "rise",
};

const TAU = Math.PI * 2;
const hot = (pal: readonly Rgb[]): Rgb => at(pal, pal.length - 1);
/** Lattice rows per texture height for the kinds that rise: whole, so the texture repeats every height. */
const rows = (p: PatternPoint, k = 1): number => Math.max(1, Math.round(p.scale * k));
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

// ── Neon Nights ─────────────────────────────────────────────────────────────────────────────────

/** Synthwave: a striped sun sinking behind the horizon over a perspective grid. Flow: the grid rolls toward
 *  you by one line and the sun's stripes slide down by one per loop. Roles: 0 night, 1 sky at the horizon,
 *  2 grid and the sun's foot, 3 horizon glow, last = the sun's top. */
export function synthgrid(pal: readonly Rgb[], p: PatternPoint, t = 0): Rgb {
  const X = p.u * 2.5;
  const H = 0.5 + 0.08 * (hash2(1, 2, p.seed) - 0.5);
  if (p.v < H) {
    const sx = 0.55 + 1.4 * hash2(3, 4, p.seed);
    const sy = H - 0.06;
    const r = 0.34;
    const dy = p.v - sy;
    if (Math.hypot(X - sx, dy) < r) {
      const k = (dy + r) / (2 * r);
      const cut = dy > -0.1 && fract((dy + 0.1) / 0.14 - t) < 0.2 + 0.45 * clamp01((dy + 0.1) / r);
      if (!cut) return mix(hot(pal), at(pal, 2), k);
    }
    return mix(at(pal, 0), at(pal, 1), clamp01(p.v / H) ** 1.5);
  }
  const dz = p.v - H;
  const z = 0.25 / (dz + 0.03);
  const D = 0.35 * Math.max(1, p.scale);
  const phase = z * D + t;
  const dH = Math.abs(fract(phase + 0.5) - 0.5) / ((D * 0.25) / (dz + 0.03) ** 2);
  const xw = (X - 1.25) * z * 1.25 * Math.max(1, p.scale);
  const dV = Math.abs(fract(xw + 0.5) - 0.5) / (z * 1.25 * Math.max(1, p.scale));
  const fog = smoothstep(0.06, 0.2, dz);
  const grid = (1 - smoothstep(0.012, 0.045, Math.min(dH, dV))) * fog;
  const glow = 1 - smoothstep(0, 0.09, dz);
  if (glow > grid) return mix(at(pal, 0), at(pal, 3), glow);
  return mix(at(pal, 0), at(pal, 2), grid);
}

/** Neon tubes: contour lines of noise, one tube per middle palette colour, kept an even width by measuring
 *  their distance (value over gradient), with a pale core and a soft halo on black.
 *  Roles: 0 black, 1 halo, 2 .. second-to-last = tubes, last = core tint. */
export function neonline(pal: readonly Rgb[], p: PatternPoint): Rgb {
  const tubes = pal.length >= 4 ? pal.slice(2, pal.length - 1) : [hot(pal)];
  let best = 0;
  let tube = tubes[0]!;
  let core = false;
  for (let k = 0; k < tubes.length; k++) {
    const s = p.seed + 31 * k;
    const ax = p.x * 0.3;
    const ay = p.y * 0.3;
    const n = fbm(ax, ay, s, 3);
    const e = 0.01;
    const g = Math.hypot(fbm(ax + e, ay, s, 3) - n, fbm(ax, ay + e, s, 3) - n) / e + 1e-4;
    const dv = Math.abs(n - 0.5) / g / 0.3 / Math.max(1, p.scale);
    const glow = (1 - clamp01((dv - 0.045) / 0.16)) ** 1.5;
    if (glow > best) {
      best = glow;
      tube = tubes[k]!;
      core = dv < 0.045;
    }
  }
  if (core) return mix(tube, hot(pal), 0.4);
  return ramp([at(pal, 0), at(pal, 1), tube], best);
}

/** Liquid colour: twice domain-warped noise mapped through the palette as a wheel (the last colour flows back
 *  into the first). Flow: the bands march one full turn of the wheel per loop. */
export function hueflow(pal: readonly Rgb[], p: PatternPoint, t = 0): Rgb {
  const ax = p.x * 0.35;
  const ay = p.y * 0.35;
  const qx = fbm(ax, ay, p.seed, 3);
  const qy = fbm(ax + 5.2, ay + 1.3, p.seed, 3);
  const n = fbm(ax + 2.5 * qx, ay + 2.5 * qy, p.seed + 9, 4);
  return cycle(pal, n * 2.2 + p.u * 0.6 - t);
}

// ── Deep Space ──────────────────────────────────────────────────────────────────────────────────

/** A star in the cell of size `cell` (texture-height units) around (X, Y), present with probability
 *  `chance`: 2 = its core, 1 = a spike of its cross (when `cross`), 0 = none. */
function star(X: number, Y: number, cell: number, chance: number, r: number, seed: number, cross: boolean): number {
  const i = Math.floor(X / cell);
  const j = Math.floor(Y / cell);
  if (hash2(i, j, seed) >= chance) return 0;
  const sx = (i + 0.25 + 0.5 * hash2(i, j, seed + 1)) * cell;
  const sy = (j + 0.25 + 0.5 * hash2(i, j, seed + 2)) * cell;
  const dx = Math.abs(X - sx);
  const dy = Math.abs(Y - sy);
  if (dx < r && dy < r) return 2;
  if (cross && ((dx < r * 0.6 && dy < r * 3) || (dy < r * 0.6 && dx < r * 3))) return 1;
  return 0;
}

/** Three depths of stars over a faint dust lane: far ones dim and dense, near ones bright with a cross.
 *  Roles: 0 space, 1 dust, 2 far star, second-to-last = mid star, last = near star. */
export function starfield(pal: readonly Rgb[], p: PatternPoint): Rgb {
  const X = p.u * 2.5;
  const k = 4 / Math.max(1, p.scale);
  if (star(X, p.v, 0.42 * k, 0.45, 0.05, p.seed + 10, true)) return hot(pal);
  if (star(X, p.v, 0.22 * k, 0.4, 0.045, p.seed + 20, false)) return at(pal, pal.length - 2);
  if (star(X, p.v, 0.13 * k, 0.35, 0.04, p.seed + 30, false)) return at(pal, 2);
  const lane = smoothstep(0.45, 0.75, fbm(X * 2.2, p.v * 2.2 + X * 0.6, p.seed, 4));
  return mix(at(pal, 0), at(pal, 1), 0.75 * lane);
}

/** Gas clouds: twice domain-warped noise through the palette's dark-to-bright ramp, stars only where the gas
 *  is thin. Roles: 0 .. second-to-last = gas (thin to dense), last = stars. */
export function nebula(pal: readonly Rgb[], p: PatternPoint): Rgb {
  const ax = p.x * 0.4;
  const ay = p.y * 0.4;
  const wx = fbm(ax, ay, p.seed + 3, 3);
  const wy = fbm(ax + 7.1, ay + 2.3, p.seed + 3, 3);
  const d = spread(fbm(ax + 3 * wx, ay + 3 * wy, p.seed, 5));
  if (d < 0.4 && star(p.u * 2.5, p.v, 0.16, 0.25, 0.045, p.seed + 40, false)) return hot(pal);
  return ramp(pal.slice(0, Math.max(1, pal.length - 1)), d ** 1.2);
}

/** Northern lights: curtains of fine vertical rays hanging from a wavy lower edge (sharp at the bottom,
 *  fading upward), a fainter curtain higher up, as a dark-to-bright ramp. Flow: the curtains sway and the
 *  rays drift once round a small circle per loop. */
export function aurora(pal: readonly Rgb[], p: PatternPoint, t = 0): Rgb {
  const X = p.u * 2.5;
  const c = 0.35 * Math.cos(TAU * t);
  const s = 0.35 * Math.sin(TAU * t);
  const k = Math.max(1, p.scale) / 4;
  let I = 0;
  for (let layer = 0; layer < 2; layer++) {
    const seed = p.seed + 50 * layer;
    const edge = 0.7 - 0.28 * layer + 0.3 * (fbm(X * 1.1 * k + c, 3 + s, seed, 3) - 0.5) + 0.07 * Math.sin(X * 3 * k + seed);
    const rays = 0.45 + 0.55 * fbm(X * 10 * k + 2 * c, p.v * 0.8 + s, seed + 7, 3);
    const below = p.v - edge;
    const profile = below > 0 ? Math.exp(-below * 28) : Math.exp(below * 3.5);
    I = Math.max(I, profile * rays * (layer ? 0.6 : 1.1));
  }
  return ramp(pal, clamp01(I));
}

/** Oil slick: swirled film thickness turned into thin interference bands that cycle through the bright
 *  colours, broken by pools of bare dark metal. Roles: 0 metal, 1 .. last = the film's band colours. */
export function iridescent(pal: readonly Rgb[], p: PatternPoint): Rgb {
  const ax = p.x * 0.3;
  const ay = p.y * 0.3;
  const n = fbm(ax, ay, p.seed, 4);
  const w = fbm(ax + 4 * n, ay + 4 * n, p.seed + 17, 4);
  if (w < 0.4) return at(pal, 0);
  return cycle(tail(pal, 1), (w - 0.4) * 3.5 + p.v * 0.6);
}

// ── Inferno ─────────────────────────────────────────────────────────────────────────────────────

/** Fire: warped noise stretched upward licking into tongues over a heat that grows toward the bottom, as a
 *  dark-to-bright ramp. Rise: the noise scrolls up one texture height per loop (it repeats every height)
 *  while the heat stays put, so the flames climb but never leave. */
export function flame(pal: readonly Rgb[], p: PatternPoint, t = 0): Rgb {
  const P = rows(p);
  const xn = p.u * 2.5 * P;
  const yn = (p.v + t) * P;
  const warp = fbm(xn, yn, p.seed + 3, 3, P);
  const n = fbm(xn * 1.6 + 1.2 * warp, yn, p.seed, 4, P);
  const I = smoothstep(0.15, 1, p.v * 1.2 - 0.1 + (n - 0.5) * 2);
  return ramp(pal, I);
}

/** Embers: glowing specks of different sizes and heat over hard char flakes, each flickering. Rise: the
 *  specks drift up one texture height per loop (their lattice repeats every height); the char stays.
 *  Roles: 0-1 char, 2 glow, 3 .. last = hotter. */
export function ember(pal: readonly Rgb[], p: PatternPoint, t = 0): Rgb {
  const P = rows(p);
  const X = p.u * 2.5 * P;
  const Y = (p.v + t) * P;
  const xi = Math.floor(X);
  const yi = Math.floor(Y);
  let I = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx;
      const cy = yi + dy;
      const hy = wrapRow(cy, P);
      if (hash2(cx, hy, p.seed) >= 0.55) continue;
      const ex = cx + 0.2 + 0.6 * hash2(cx, hy, p.seed + 1);
      const ey = cy + 0.2 + 0.6 * hash2(cx, hy, p.seed + 2);
      const r = 0.3 + 0.25 * hash2(cx, hy, p.seed + 3);
      const heat = (0.65 + 0.35 * hash2(cx, hy, p.seed + 4)) * (0.8 + 0.2 * Math.cos(TAU * (2 * t + hash2(cx, hy, p.seed + 5))));
      I = Math.max(I, heat * clamp01(1 - Math.hypot(X - ex, Y - ey) / r) ** 1.2);
    }
  const char = fbm(p.x * 0.8, p.y * 0.8, p.seed + 9, 4) > 0.52 ? at(pal, 1) : at(pal, 0);
  if (I < 0.3) return mix(char, at(pal, 2), I / 0.3);
  return ramp(tail(pal, 2), (I - 0.3) / 0.7);
}

/** Molten rock: rivers of glow along the ridges of warped noise (flowing, branching cracks) fading into a
 *  dark two-tone crust. Rise: the whole flow creeps up one texture height per loop.
 *  Roles: 0-1 crust, 2 glow, 3 .. last = hotter. */
export function molten(pal: readonly Rgb[], p: PatternPoint, t = 0): Rgb {
  const P = rows(p, 0.5);
  const X = p.u * 2.5 * P;
  const Y = (p.v + t) * P;
  const w1 = fbm(X, Y, p.seed + 5, 3, P);
  const w2 = fbm(X + 3.1, Y, p.seed + 6, 3, P);
  const n = fbm(X + 1.6 * w1, Y + 1.6 * (w2 - 0.5), p.seed, 4, P);
  const ridge = 1 - Math.abs(2 * n - 1);
  const I = smoothstep(0.76, 0.97, ridge);
  const crust = fbm(X * 2, Y * 2, p.seed + 8, 3, P * 2) > 0.5 ? at(pal, 1) : at(pal, 0);
  if (I < 0.35) return mix(crust, at(pal, 2), I / 0.35);
  return ramp(tail(pal, 2), (I - 0.35) / 0.65);
}
