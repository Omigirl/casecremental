// The vault's five reels (spec 2026-10-09 §1, §5): where each beam's strip is in time, in cells (items). Pure,
// so the lock-ins are tested without Pixi.

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
