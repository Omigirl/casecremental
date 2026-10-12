import type { Action } from "../game/controller";
import type { GameView } from "../game/view";
import { RARITY_ORDER } from "../sim/rarity";
import { GRID_RESERVES, TRADE_UP_COUNT } from "../sim/tuning";
import type { RarityId } from "../sim/types";

// The Upgrades board's small rules (spec §2, §5, §6): which label a maxed button shows, and how the Machines tab's
// settings cycle.

export type Act = (a: Action) => void;

/** The vault is not out and the run is not over: the board's switches work. */
export const boardOpen = (view: GameView): boolean => view.vault.phase === null && !view.over;

/** A maxed button: NEXT RUN when a later run lifts the cap, MAX when none does (spec §2). */
export const capKey = (nextRun: boolean): "cap.nextrun" | "btn.max" => (nextRun ? "cap.nextrun" : "btn.max");

/** Collect cycles: off, then each rarity a contract takes (never ★). */
export const COLLECT_CYCLE: readonly (RarityId | null)[] = [null, "milspec", "restricted", "classified", "covert"];

export function nextCollect(r: RarityId | null): RarityId | null {
  return COLLECT_CYCLE[(COLLECT_CYCLE.indexOf(r) + 1) % COLLECT_CYCLE.length]!;
}

/** The grid's reserve cycles 25 → 50 → 75 → 25 %. */
export function nextReserve(r: number): number {
  const i = (GRID_RESERVES as readonly number[]).indexOf(r);
  return GRID_RESERVES[(i + 1) % GRID_RESERVES.length]!;
}

/** What the TRADE UP button counts toward: the rarity ready to press, else the Collect rarity, else the fullest one
 *  below ★ (ties: the lowest). */
export function tradeUpProgress(
  counts: Record<RarityId, number>,
  collect: RarityId | null,
  ready: RarityId | null,
): { rarity: RarityId; n: number; of: number } {
  const pool = RARITY_ORDER.filter((r) => r !== "gold");
  const rarity = ready ?? collect ?? pool.reduce((best, r) => (counts[r] > counts[best] ? r : best), pool[0]!);
  return { rarity, n: Math.min(counts[rarity], TRADE_UP_COUNT), of: TRADE_UP_COUNT };
}

export const percent = (share: number): number => Math.round(share * 100);
