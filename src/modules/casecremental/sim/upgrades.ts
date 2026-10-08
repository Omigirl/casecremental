import { APPRAISER_PER_LEVEL, QUICK_HANDS_FACTOR, SPIN_BASE_SECONDS, SPIN_MIN_SECONDS, UPGRADE_COSTS } from "./tuning";

export type UpgradeId = keyof typeof UPGRADE_COSTS;
export const UPGRADE_IDS: readonly UpgradeId[] = ["luck", "appraiser", "quickHands"];

export const UPGRADE_INFO: Readonly<Record<UpgradeId, { name: string; description: string }>> = {
  luck: { name: "Luck", description: "Better rarities drop more often" },
  appraiser: { name: "Appraiser", description: "+25% sell value per level" },
  quickHands: { name: "Quick Hands", description: "The reel spins faster" },
};

/** Price of the next level, or null when maxed. */
export function upgradeCost(id: UpgradeId, level: number): number | null {
  const c = UPGRADE_COSTS[id];
  if (level >= c.maxLevel) return null;
  return Math.ceil(c.baseCost * c.growth ** level);
}

export interface Effects {
  luckLevel: number;
  sellMult: number;
  spinSeconds: number;
}

export function effectsOf(levels: Record<UpgradeId, number>): Effects {
  return {
    luckLevel: levels.luck,
    sellMult: 1 + APPRAISER_PER_LEVEL * levels.appraiser,
    spinSeconds: Math.max(SPIN_MIN_SECONDS, SPIN_BASE_SECONDS * QUICK_HANDS_FACTOR ** levels.quickHands),
  };
}
