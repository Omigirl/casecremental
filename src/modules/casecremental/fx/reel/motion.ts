// How far along its path the reel is (0 → 1): an ease-out over the full spin, never backwards.

export interface ReelMotion {
  elapsed: number;
  fullDuration: number;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function easeOutQuart(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u * u;
}

export function reelFraction(m: ReelMotion): number {
  return easeOutQuart(m.elapsed / m.fullDuration);
}
