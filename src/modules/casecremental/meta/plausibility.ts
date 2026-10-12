import { SERVER_CAP, SERVER_MIN_REPLAY_SEC, SERVER_MIN_VAULT_SEC } from "../sim/tuning";

// The leaderboard score and the server's plausibility cap (plan F7). Lifetime earnings outgrow safe integers, so the
// board keeps floor(log10(e) × 1000) and the UI turns it back. The cap is the same curve CloudCode applies.

/** best_run's score for a run that earned this much. */
export const scoreFor = (lifetimeEarnings: number): number => (lifetimeEarnings > 1 ? Math.floor(Math.log10(lifetimeEarnings) * 1000) : 0);

/** The earnings a best_run score stands for. */
export const earningsFromScore = (score: number): number => 10 ** (score / 1000);

/** log10 of the most a run can have earned after `elapsedSec` with `loops` vaults behind it. */
export function maxPlausibleLog10(elapsedSec: number, loops: number): number {
  const c = SERVER_CAP;
  return Math.min(c.ceilLog10, c.baseLog10 + c.perSqrtSecond * Math.sqrt(Math.max(0, elapsedSec)) + c.perLoop * Math.max(0, loops));
}

/** Earnings clamped to [0, the plausible maximum]. */
export const cappedEarnings = (e: number, elapsedSec: number, loops: number): number =>
  Math.min(Math.max(0, e), 10 ** maxPlausibleLog10(elapsedSec, loops));

/** The least a run with `loops` vaults behind it takes before the server counts its vault (CloudCode's minRunSec). */
export const minRunSeconds = (loops: number): number =>
  loops < SERVER_MIN_VAULT_SEC.length ? SERVER_MIN_VAULT_SEC[Math.max(0, loops)]! : SERVER_MIN_REPLAY_SEC;
