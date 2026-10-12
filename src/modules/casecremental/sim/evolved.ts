import { runCaseIds } from "./campaign";
import type { RunCtx, RunState } from "./runTypes";
import { ASSEMBLY_FREE_EVERY, HOT_HAND_LUCK, HOT_HAND_MIN_COMBO, MONEY_PRINTER_MULT, SLOT_MACHINE_OPEN } from "./tuning";
import type { Drop } from "./types";

// The evolutions a run has bought (finish spec §7.3) and the small hooks the machines call for their effects. This
// file imports no machine, so the bot, the auto-seller and auto-spin can use it without an import cycle; the
// recipes and the purchase are in evolutions.ts.

export type EvolutionId = "slotMachine" | "cartel" | "moneyPrinter" | "assemblyLine" | "hotHand";
export const EVOLUTION_IDS: readonly EvolutionId[] = ["slotMachine", "cartel", "moneyPrinter", "assemblyLine", "hotHand"];

export interface EvolutionState {
  owned: EvolutionId[];
  /** The run's best combo so far (Hot Hand's recipe); it never drops. */
  bestCombo: number;
  /** Auto-spin buys counted for Assembly Line's free case. */
  pulls: number;
}

export const freshEvolutions = (): EvolutionState => ({ owned: [], bestCombo: 0, pulls: 0 });

export const evolved = (s: Pick<RunState, "evolutions">, id: EvolutionId): boolean => s.evolutions.owned.includes(id);

/** Cases one BUY opens before cash limits it: Slot Machine's ten, else the Multi-open width. */
export const benchWidth = (s: Pick<RunState, "evolutions">, multiOpenWidth: number): number =>
  evolved(s, "slotMachine") ? SLOT_MACHINE_OPEN : multiOpenWidth;

/** Hot Hand: extra Luck levels for your bench's rolls while the combo is high. */
export const hotHandLuck = (s: Pick<RunState, "evolutions" | "combo">): number =>
  evolved(s, "hotHand") && s.combo >= HOT_HAND_MIN_COMBO ? HOT_HAND_LUCK : 0;

/** Money Printer: the auto-seller's sales × this. */
export const sellerMult = (s: Pick<RunState, "evolutions">): number => (evolved(s, "moneyPrinter") ? MONEY_PRINTER_MULT : 1);

/** The bot's roll for one case. Cartel rolls it twice and keeps the higher value: still one open. */
export function botRoll(ctx: RunCtx, caseId: string): Drop {
  if (!evolved(ctx.state, "cartel")) return ctx.rollFor(caseId);
  const a = ctx.rollFor(caseId);
  ctx.state.opened--; // one case, rolled twice: both rolls see the same count (Lucky Seven fires on neither extra)
  const b = ctx.rollFor(caseId);
  return b.value > a.value ? b : a;
}

/** Assembly Line counts an auto-spin buy: every ASSEMBLY_FREE_EVERY-th is a free case of the next tier up the run's
 *  unlocked shelf (the top case stays itself), returned here; null for an ordinary buy (and without Assembly Line). */
export function assemblyFree(ctx: RunCtx, caseId: string): string | null {
  if (!evolved(ctx.state, "assemblyLine")) return null;
  const e = ctx.state.evolutions;
  e.pulls++;
  if (e.pulls % ASSEMBLY_FREE_EVERY !== 0) return null;
  const shelf = runCaseIds(ctx.setup.run).filter((id) => ctx.state.unlocked.includes(id));
  const i = shelf.indexOf(caseId);
  return i < 0 ? caseId : shelf[Math.min(shelf.length - 1, i + 1)]!;
}

/** A free case locks on the empty bench (like a Ricochet case). */
export function placeFreeCase(ctx: RunCtx, caseId: string): void {
  ctx.state.bench = { phase: "locked", caseId, free: true, count: 1 };
  ctx.emit({ type: "caseBought", caseId, free: true, count: 1 });
}
