import { rarityWeights } from "../../sim/rarity";
import type { Rng } from "../../sim/rng";
import { pickRarity } from "../../sim/roll";
import type { CaseDef, SkinDef } from "../../sim/types";

// The strip of skins that scrolls past the marker. The outcome is already rolled by the sim; the
// strip only decides what the player SEES around it — including the near miss: the case's knife
// one slot past the winner, so the reel creeps past it (spec §9.2). Visual only.

export const STRIP_LENGTH = 48;
export const WIN_INDEX = 40;
export const NEAR_MISS_CHANCE = 0.35;

export function buildStrip(c: CaseDef, winner: SkinDef, rng: Rng): SkinDef[] {
  const weights = rarityWeights(0);
  const strip: SkinDef[] = [];
  for (let i = 0; i < STRIP_LENGTH; i++) {
    const r = pickRarity(weights, rng.next());
    strip.push(rng.pick(c.skins.filter((s) => s.rarity === r)));
  }
  strip[WIN_INDEX] = winner;
  if (winner.rarity !== "gold" && rng.next() < NEAR_MISS_CHANCE) {
    const knife = c.skins.find((s) => s.rarity === "gold");
    if (knife) strip[WIN_INDEX + 1] = knife;
  }
  return strip;
}
