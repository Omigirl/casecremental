// How far along its path the reel is (0 → 1). Free spin: ease-out over the full duration.
// Braked: from wherever it was, a fast ease-out to the end over the remaining brake time —
// continuous at the moment of braking, never backwards.

export interface ReelMotion {
  elapsed: number;
  fullDuration: number;
  endsAt: number;
  brakedAt: number | null;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function easeOutQuart(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u * u;
}

export function reelFraction(m: ReelMotion): number {
  if (m.brakedAt === null) return easeOutQuart(m.elapsed / m.fullDuration);
  const from = easeOutQuart(m.brakedAt / m.fullDuration);
  const span = m.endsAt - m.brakedAt;
  if (span <= 0) return 1;
  const u = clamp01((m.elapsed - m.brakedAt) / span);
  return from + (1 - from) * (1 - (1 - u) * (1 - u));
}
