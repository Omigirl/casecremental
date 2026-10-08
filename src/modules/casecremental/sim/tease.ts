import type { Rng } from "./rng";
import { FAKE_TEASE_CHANCE, FAKE_TEASE_GOLD_SHARE, TEASE_CRAWL, TEASE_PROGRESS, TEASE_RARITY } from "./tuning";
import type { RarityId } from "./types";

// The teasing spin: when a red or a knife is on its way the reel crawls its last stretch and the
// camera leans in — fully for the player's top case, barely for a cheap one. Now and then an
// ordinary drop gets a fake tease: a red or a knife lands right beside it and the reel stops a
// sliver short of it, or creeps a sliver past. Decided with the drop, so the reveal and the reel
// stay in step and pacing stays deterministic.

export interface Tease {
  /** 0–1: how slow the crawl and how deep the lean. */
  strength: number;
  /** The decoy rarity of a fake tease (the drop itself is ordinary); null for a real one. */
  fake: RarityId | null;
  /** Seconds the crawl adds to the spin. */
  extraSeconds: number;
}

export function teaseStrength(rarity: RarityId, caseTier: number, topTier: number): number {
  const r = TEASE_RARITY[rarity] ?? 0;
  const below = Math.max(0, topTier - caseTier);
  return r * TEASE_PROGRESS[Math.min(below, TEASE_PROGRESS.length - 1)]!;
}

/** Draws twice from `rng` whatever the outcome, so a tease never shifts the rest of the run.
 *  `forceFake` (dev board) makes an ordinary drop fake-tease every time. */
export function rollTease(
  rarity: RarityId,
  caseTier: number,
  topTier: number,
  spinSeconds: number,
  rng: Rng,
  forceFake = false,
): Tease | null {
  const fakeRoll = rng.next();
  const decoyRoll = rng.next();
  const real = teaseStrength(rarity, caseTier, topTier);
  if (real > 0) return { strength: real, fake: null, extraSeconds: TEASE_CRAWL * spinSeconds * real };
  if (!forceFake && fakeRoll >= FAKE_TEASE_CHANCE) return null;
  const strength = teaseStrength("covert", caseTier, topTier);
  return { strength, fake: decoyRoll < FAKE_TEASE_GOLD_SHARE ? "gold" : "covert", extraSeconds: TEASE_CRAWL * spinSeconds * strength };
}
