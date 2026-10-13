import { caseById } from "./content/cases";
import { RARITY_ORDER } from "./rarity";
import type { RevealSpot, RunCtx, RunState } from "./runTypes";
import {
  CHAIN_REACTION_CHANCE,
  COLLECTOR_MULT,
  DOUBLE_TAP_MULT,
  FEVER_PAY_MULT,
  FREE_CASE_QUEUE_MAX,
  HOARDER_PER_SKIN,
  GOLD_RUSH_MULT,
  INSIDER_PRICE_MULT,
  LAST_RUN,
  LUCKY_SEVEN_EVERY,
  MANIAC_MILSPEC_MULT,
  MANIAC_OTHER_MULT,
  STATTRAK_CHANCE,
  WEAR_TABLE,
} from "./tuning";
import type { Drop, RarityId, WearId } from "./types";

// Charms (base spec §8.1, M2b spec §8): rules that bend a run, picked on the prestige screen for the next
// run only. Run 1's pool is the eight that work with Run 1's systems; the rest come with later runs (Loaded Dice with
// Run 4's Upgrader).

export type CharmId =
  | "luckySeven"
  | "rustBucket"
  | "pityJar"
  | "doubleTap"
  | "ricochet"
  | "goldRush"
  | "insider"
  | "milSpecManiac"
  | "chainReaction"
  | "contractKiller"
  | "hoarder"
  | "fever"
  | "collectorsEye"
  | "loadedDice";

export const RUN1_CHARMS: readonly CharmId[] = [
  "luckySeven",
  "rustBucket",
  "pityJar",
  "doubleTap",
  "ricochet",
  "goldRush",
  "insider",
  "milSpecManiac",
];

export const RUN2_CHARMS: readonly CharmId[] = [...RUN1_CHARMS, "chainReaction", "contractKiller", "hoarder"];
export const RUN3_CHARMS: readonly CharmId[] = [...RUN2_CHARMS, "fever", "collectorsEye"];
export const RUN4_CHARMS: readonly CharmId[] = [...RUN3_CHARMS, "loadedDice"];

/** The charms each run offers. */
export const CHARM_POOLS: Readonly<Record<number, readonly CharmId[]>> = { 1: RUN1_CHARMS, 2: RUN2_CHARMS, 3: RUN3_CHARMS, 4: RUN4_CHARMS };
export const charmPool = (run: number): readonly CharmId[] => CHARM_POOLS[Math.min(Math.max(run, 1), LAST_RUN)]!;

const wearMult = (id: WearId) => WEAR_TABLE.find((w) => w.id === id)!.mult;

/** What the run-dependent charms read when a drop is paid. */
export interface CharmRun {
  lockerCount: number;
  /** Collector's Eye: every non-★ skin of this case has shown up. */
  collected: (caseId: string) => boolean;
}

/** Everything that multiplies a drop's value; ctx-dependent charms read the run. */
export function charmValueMult(charms: readonly CharmId[], d: Drop, run?: CharmRun): number {
  let m = 1;
  if (charms.includes("fever")) m *= FEVER_PAY_MULT;
  if (run && charms.includes("hoarder")) m *= 1 + HOARDER_PER_SKIN * run.lockerCount;
  if (run && charms.includes("collectorsEye") && run.collected(d.caseId)) m *= COLLECTOR_MULT;
  if (charms.includes("rustBucket") && d.wear === "BS") m *= wearMult("FN") / wearMult("BS");
  if (charms.includes("goldRush") && d.rarity === "gold") m *= GOLD_RUSH_MULT;
  if (charms.includes("milSpecManiac")) m *= d.rarity === "milspec" ? MANIAC_MILSPEC_MULT : MANIAC_OTHER_MULT;
  return m;
}

export const charmPriceMult = (charms: readonly CharmId[]): number => (charms.includes("insider") ? INSIDER_PRICE_MULT : 1);

export const charmStatTrakChance = (charms: readonly CharmId[]): number =>
  STATTRAK_CHANCE * (charms.includes("doubleTap") ? DOUBLE_TAP_MULT : 1);

/** Lucky Seven: every 7th case opened is at least Classified (`opened` counts this one). */
export const charmMinRarity = (charms: readonly CharmId[], opened: number): RarityId | null =>
  charms.includes("luckySeven") && opened % LUCKY_SEVEN_EVERY === 0 ? "classified" : null;

export const isBigRarity = (r: RarityId): boolean => RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf("covert");

/** Every non-★ skin of the case has been revealed this run. */
export const setCollected = (seen: RunState["seen"], caseId: string): boolean => {
  const got = seen[caseId];
  return !!got && caseById(caseId).skins.every((s) => s.rarity === "gold" || got.includes(s.id));
};

/** A free case waits for the bench; the queue holds FREE_CASE_QUEUE_MAX at most (Ricochet and Chain Reaction share it). */
export function queueFreeCase(s: RunState, caseId: string): void {
  if (s.freeCases.length < FREE_CASE_QUEUE_MAX) s.freeCases.push(caseId);
}

/** Chain Reaction and Collector's Eye on a reveal. Contract results chain nothing; the vault never reveals through here. */
export function reactToReveal(ctx: RunCtx, d: Drop, spot: RevealSpot): void {
  const s = ctx.state;
  const charms = ctx.setup.charms;
  if (charms.includes("chainReaction") && spot !== "locker" && (d.rarity === "classified" || isBigRarity(d.rarity))) {
    if (ctx.rng.next() < CHAIN_REACTION_CHANCE) queueFreeCase(s, d.caseId);
  }
  if (charms.includes("collectorsEye")) {
    const seen = (s.seen[d.caseId] ??= []);
    if (seen.includes(d.skinId)) return;
    const wasComplete = setCollected(s.seen, d.caseId);
    seen.push(d.skinId);
    if (!wasComplete && setCollected(s.seen, d.caseId)) ctx.emit({ type: "setCompleted", caseId: d.caseId });
  }
}
