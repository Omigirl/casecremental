import { rarityWeights } from "../../sim/rarity";
import type { Rng } from "../../sim/rng";
import { pickRarity } from "../../sim/roll";
import type { CaseDef, RarityId, SkinDef } from "../../sim/types";

// The strip of skins that scrolls past the marker. The outcome is already rolled by the sim; the
// strip only decides what the player SEES around it — including a fake tease's decoy: a red or a
// knife right beside the winner, which the reel stops a sliver short of ("short", the decoy ahead)
// or creeps a sliver past ("over", the decoy behind). Visual only.

export const STRIP_LENGTH = 48;
export const WIN_INDEX = 40;

export type NearMissSide = "short" | "over";

export interface Decoy {
  rarity: RarityId;
  side: NearMissSide;
}

export function buildStrip(c: CaseDef, winner: SkinDef, rng: Rng, decoy: Decoy | null): SkinDef[] {
  const weights = rarityWeights(0);
  const strip: SkinDef[] = [];
  for (let i = 0; i < STRIP_LENGTH; i++) {
    const r = pickRarity(weights, rng.next());
    strip.push(rng.pick(c.skins.filter((s) => s.rarity === r)));
  }
  strip[WIN_INDEX] = winner;
  const pool = decoy ? c.skins.filter((s) => s.rarity === decoy.rarity) : [];
  if (decoy && pool.length) strip[WIN_INDEX + (decoy.side === "short" ? 1 : -1)] = rng.pick(pool);
  return strip;
}

/** Where on the winning card the marker stops, as a fraction of a card from its centre (±0.5 = its edges). */
export function landingJitter(side: NearMissSide | null, rng: Rng): number {
  if (!side) return (rng.next() - 0.5) * 0.7;
  const sliver = 0.39 + rng.next() * 0.04; // 0.39–0.43: a hair inside the card's visible edge (28 of 30 px), never on the gap
  return side === "short" ? sliver : -sliver;
}
