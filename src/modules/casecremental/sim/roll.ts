import { RARITY_ORDER, rarityWeights } from "./rarity";
import type { Rng } from "./rng";
import { RARITY_VALUE_MULT, STATTRAK_CHANCE, STATTRAK_MULT } from "./tuning";
import type { CaseDef, Drop, RarityId } from "./types";
import { wearOf } from "./wear";

/** The rarity whose cumulative weight band contains `roll` (in [0, 1)). */
export function pickRarity(weights: Record<RarityId, number>, roll: number): RarityId {
  let acc = 0;
  for (const r of RARITY_ORDER) {
    acc += weights[r];
    if (roll < acc) return r;
  }
  return RARITY_ORDER[RARITY_ORDER.length - 1]!;
}

/** Rolls one case: rarity (luck-adjusted), skin, float/wear, StatTrak, base value. */
export function rollDrop(
  c: CaseDef,
  price: number,
  luckLevel: number,
  rng: Rng,
  id: number,
): Drop {
  const rarity = pickRarity(rarityWeights(luckLevel), rng.next());
  const skin = rng.pick(c.skins.filter((s) => s.rarity === rarity));
  const float = rng.next();
  const wear = wearOf(float);
  const statTrak = rng.next() < STATTRAK_CHANCE;
  const value = price * RARITY_VALUE_MULT[rarity] * wear.mult * (statTrak ? STATTRAK_MULT : 1);
  return { id, caseId: c.id, skinId: skin.id, rarity, float, wear: wear.id, statTrak, value };
}
