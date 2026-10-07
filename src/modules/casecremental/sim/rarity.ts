import { LUCK_PER_LEVEL, RARITY_BASE_WEIGHT } from "./tuning";
import type { RarityId } from "./types";

export const RARITY_ORDER: readonly RarityId[] = [
  "milspec",
  "restricted",
  "classified",
  "covert",
  "gold",
];

export const RARITY_INFO: Readonly<Record<RarityId, { name: string; color: number }>> = {
  milspec: { name: "Mil-Spec", color: 0x4b69ff },
  restricted: { name: "Restricted", color: 0x8847ff },
  classified: { name: "Classified", color: 0xd32ce6 },
  covert: { name: "Covert", color: 0xeb4b4b },
  gold: { name: "★ Rare Special", color: 0xffd700 },
};

/** Normalized drop weights: Luck multiplies everything above Mil-Spec, then they sum to 1. */
export function rarityWeights(luckLevel: number): Record<RarityId, number> {
  const boost = 1 + LUCK_PER_LEVEL * Math.max(0, luckLevel);
  const raw = Object.fromEntries(
    RARITY_ORDER.map((r) => [r, RARITY_BASE_WEIGHT[r] * (r === "milspec" ? 1 : boost)]),
  ) as Record<RarityId, number>;
  const total = RARITY_ORDER.reduce((a, r) => a + raw[r], 0);
  for (const r of RARITY_ORDER) raw[r] /= total;
  return raw;
}
