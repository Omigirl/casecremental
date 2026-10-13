import { runContent } from "./campaign";
import { APPRAISER_PER_LEVEL, QUICK_HANDS_FACTOR, SPIN_BASE_SECONDS, SPIN_MIN_SECONDS, UPGRADE_COSTS } from "./tuning";

export type UpgradeId = keyof typeof UPGRADE_COSTS;
export const UPGRADE_IDS: readonly UpgradeId[] = ["luck", "appraiser", "quickHands", "multiOpen"];

export const UPGRADE_INFO: Readonly<Record<UpgradeId, { name: string; description: string }>> = {
  luck: { name: "Luck", description: "Better rarities drop more often" },
  appraiser: { name: "Appraiser", description: "+25% sell value per level" },
  quickHands: { name: "Quick Hands", description: "The reel spins faster" },
  multiOpen: { name: "Multi-open", description: "One BUY opens many cases" },
};

/** The highest level this run lets you buy: multi-open follows the run's widest open, the rest never change. */
export function upgradeCap(id: UpgradeId, run = 1): number {
  return id === "multiOpen" ? runContent(run).multiOpen - 1 : UPGRADE_COSTS[id].maxLevel;
}

/** Price of the next level, or null at this run's cap. */
export function upgradeCost(id: UpgradeId, level: number, run = 1): number | null {
  const c = UPGRADE_COSTS[id];
  if (level >= upgradeCap(id, run)) return null;
  return Math.ceil(c.baseCost * c.growth ** level);
}

export interface Effects {
  luckLevel: number;
  sellMult: number;
  spinSeconds: number;
  /** Cases one BUY opens. */
  openCount: number;
}

export function effectsOf(levels: Record<UpgradeId, number>): Effects {
  return {
    luckLevel: levels.luck,
    sellMult: 1 + APPRAISER_PER_LEVEL * levels.appraiser,
    spinSeconds: Math.max(SPIN_MIN_SECONDS, SPIN_BASE_SECONDS * QUICK_HANDS_FACTOR ** levels.quickHands),
    openCount: 1 + levels.multiOpen,
  };
}
