// The HUD's cash counter. The SDK's useAnimatedNumber counts in whole numbers (which turns $8.49 into
// "$8.00") and lands on `from + (to - from)`, which float cancellation turns into 0 on a drop from ~1e19
// cents (a vault TOTAL) to a run's $6. The HUD tweens with cashTweenAt instead: it lands exactly on `to`.

/** The counter's value `progress` (0..1, linear time) of the way from `from` to `to`, eased out, in cents. */
export function cashTweenAt(from: number, to: number, progress: number): number {
  if (progress >= 1 || !Number.isFinite(from) || !Number.isFinite(to)) return to;
  const eased = 1 - Math.pow(1 - Math.max(0, progress), 3);
  // to·e + from·(1 − e) instead of from + (to − from)·e: neither term cancels the other's small end
  return Math.round((to * eased + from * (1 - eased)) * 100) / 100;
}
