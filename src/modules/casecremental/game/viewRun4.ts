import { runContent } from "../sim/campaign";
import { EVOLUTION_IDS, evolved, type EvolutionId } from "../sim/evolved";
import { partDone, RECIPES, recipeDone, type RecipePart } from "../sim/evolutions";
import { RARITY_ORDER } from "../sim/rarity";
import type { Run } from "../sim/run";
import { EVOLUTION_COSTS, HOT_HAND_MIN_COMBO, UPGRADER_COST, UPGRADER_MULTS, UPGRADER_SPIN_SECONDS } from "../sim/tuning";
import type { RarityId } from "../sim/types";
import { stakeItems, upgraderChance } from "../sim/upgrader";
import { lockerWaiting } from "../sim/locker";

// Run 4's machines in the view (finish spec §7.2, §7.3): the Upgrader on the locker and the evolutions — derived
// from the run, never stored separately. buildView (view.ts) puts them in the GameView.

export interface UpgraderView {
  /** This run has the Upgrader. */
  available: boolean;
  on: boolean;
  cost: number;
  canBuy: boolean;
  /** It can't be bought before the locker (its stakes come from there). */
  needsLocker: boolean;
  stake: RarityId | null;
  /** Skins GO would stake now, and what they would sell for. */
  stakeCount: number;
  stakeValue: number;
  /** Rarities the locker holds now, lowest first (what CHANGE cycles through). */
  stakes: RarityId[];
  target: number;
  mult: number;
  /** The win chance at this target (Loaded Dice included). */
  chance: number;
  spinning: boolean;
  /** The dial's progress 0–1. */
  progress: number;
  canGo: boolean;
}

export interface EvolutionView {
  id: EvolutionId;
  owned: boolean;
  cost: number;
  /** Its recipe is complete. */
  ready: boolean;
  canBuy: boolean;
  /** Each line of the recipe; `have` is the best hand combo for the combo line, else null. */
  parts: Array<{ part: RecipePart; done: boolean; have: number | null }>;
}

export interface EvolutionsView {
  /** This run has evolutions. */
  available: boolean;
  list: EvolutionView[];
}

export function upgraderView(run: Run): UpgraderView {
  const s = run.state;
  const u = s.upgrader;
  const open = !run.locked();
  const available = runContent(run.setup.run).upgrader;
  const items = stakeItems(run);
  const mult = UPGRADER_MULTS[u.target]!;
  return {
    available,
    on: u.on,
    cost: UPGRADER_COST,
    canBuy: open && available && s.locker.on && !u.on && s.cash >= UPGRADER_COST,
    needsLocker: !s.locker.on,
    stake: u.stake,
    stakeCount: items.length,
    stakeValue: items.reduce((a, d) => a + run.payout(d, false), 0),
    stakes: RARITY_ORDER.filter((r) => s.locker.items.some((d) => d.rarity === r)),
    target: u.target,
    mult,
    chance: upgraderChance(mult, run.setup.charms),
    spinning: u.spin !== null,
    progress: u.spin ? Math.min(1, u.spin.elapsed / UPGRADER_SPIN_SECONDS) : 0,
    canGo: open && u.on && !u.spin && !s.locker.press && !lockerWaiting(s.locker) && items.length > 0,
  };
}

export function evolutionsView(run: Run): EvolutionsView {
  const s = run.state;
  const open = !run.locked();
  const available = runContent(run.setup.run).evolutions;
  return {
    available,
    list: EVOLUTION_IDS.map((id) => {
      const owned = evolved(s, id);
      const ready = recipeDone(run, id);
      const cost = EVOLUTION_COSTS[id];
      return {
        id,
        owned,
        cost,
        ready,
        canBuy: open && available && !owned && ready && s.cash >= cost,
        parts: RECIPES[id].map((part) => ({
          part,
          done: partDone(run, part),
          have: part.kind === "combo" ? s.evolutions.bestCombo : null,
        })),
      };
    }),
  };
}

/** Hot Hand burns (owned, combo at least HOT_HAND_MIN_COMBO): the HUD's combo meter gets flames. */
export const hotHandView = (run: Run): boolean => evolved(run.state, "hotHand") && run.state.combo >= HOT_HAND_MIN_COMBO;
