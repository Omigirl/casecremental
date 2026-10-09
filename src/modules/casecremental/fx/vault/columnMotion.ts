import type { Rect } from "../pixel/layout";

// The vault's five vertical reel columns (spec 2026-10-09 §1): where each strip is in time, and where the
// columns sit. Pure, so the lock-ins are tested without Pixi.

/** Cells a column decelerates through before it lands. */
export const COLUMN_SLOW_CELLS = 6;
/** The settle after a landing: the strip overshoots ~0.25 cell and is back on its target by then. */
const SETTLE_SECONDS = 0.25;
/** sin(πu)(1 − u) peaks at ~0.58, so this makes the overshoot ~0.25 cell. */
const OVERSHOOT = 0.43;

/** Where column i's strip is at time t, in cells (fractional): still at 0 until `start`, a fast constant spin
 *  from there, then a quadratic ease-out through the last `slowCells` cells to land exactly on `target` at
 *  `land`, an overshoot of ~0.25 cell and a settle back by `land + 0.25`. Monotonic until the overshoot.
 *  The spin's speed follows from the rest — (target + slowCells) / (land − start) — so columns that start at
 *  different times spin at different speeds, out of phase; pick `target` for the speed you want. */
export function columnMotion(t: number, start: number, land: number, target: number, opts: { slowCells?: number } = {}): number {
  if (t >= land) {
    const u = (t - land) / SETTLE_SECONDS;
    return u >= 1 ? target : target + OVERSHOOT * Math.sin(Math.PI * u) * (1 - u);
  }
  if (t <= start) return 0;
  const slow = Math.min(opts.slowCells ?? COLUMN_SLOW_CELLS, target / 2);
  const speed = (target + slow) / (land - start);
  const slowSeconds = (2 * slow) / speed;
  const remaining = land - t;
  // velocity falls linearly from `speed` to 0 over the slow part: continuous in position and speed
  return remaining >= slowSeconds ? speed * (t - start) : target - (speed / (2 * slowSeconds)) * remaining * remaining;
}

/** World px between the vault's columns. */
export const COLUMN_GAP = 3;

/** n equal whole-pixel columns side by side across `area`, `gap` px apart, centred, as tall as the area. */
export function columnRects(area: Rect, n: number, gap: number): Rect[] {
  const x = Math.round(area.x);
  const y = Math.round(area.y);
  const w = Math.max(1, Math.floor((Math.floor(area.w) - gap * (n - 1)) / n));
  const total = n * w + gap * (n - 1);
  const x0 = x + Math.floor((Math.floor(area.w) - total) / 2);
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (w + gap), y, w, h: Math.floor(area.h) }));
}
