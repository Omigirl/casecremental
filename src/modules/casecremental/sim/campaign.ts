import { CASES } from "./content/cases";
import { CATCH_UP_PER_VAULT, LAST_RUN, RUN_CONTENT, VAULT_GROWTH, VAULT_PRICES, type RunContent } from "./tuning";

// The campaign: Vault I leads into Run 2, Vault II into Run 3, Vault III into Run 4, and The Last Case replays Run 4.
// Run numbers are derived from meta.loops; RUN_CONTENT says what each run has.

export const runNumber = (loops: number): number => Math.min(loops + 1, LAST_RUN);

export const runContent = (run: number): RunContent => RUN_CONTENT[Math.min(Math.max(run, 1), LAST_RUN) - 1]!;

/** The case ids on this run's shelf, cheapest first. */
export const runCaseIds = (run: number): string[] => CASES.slice(0, runContent(run).cases).map((c) => c.id);

/** The vault price for the run that starts after `loops` vaults. */
export function vaultPriceFor(loops: number): number {
  const run = runNumber(loops);
  return VAULT_PRICES[run - 1]! * VAULT_GROWTH ** Math.max(0, loops - (run - 1));
}

/** Every sale's catch-up boost in the run that starts after `loops` vaults: each opened vault's boost multiplied
 *  (a replay repeats The Last Case's). */
export function catchUpBoost(loops: number): number {
  let boost = 1;
  for (let i = 0; i < loops; i++) boost *= CATCH_UP_PER_VAULT[Math.min(i, CATCH_UP_PER_VAULT.length - 1)]!;
  return boost;
}

/** A level at this run's cap that a later run (up to LAST_RUN) lets you go past: the UI says NEXT RUN, not MAX. */
export function capRaisedLater(cap: (run: number) => number, level: number, run: number): boolean {
  for (let r = run + 1; r <= LAST_RUN; r++) if (cap(r) > level) return true;
  return false;
}
