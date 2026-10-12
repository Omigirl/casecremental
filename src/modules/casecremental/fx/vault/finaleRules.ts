import type { VaultState } from "../../sim/run";
import { VAULT_CUES } from "./cues";

// The Last Case's finale (finish spec §7.4), as pure functions of the vault's clock so a reload lands on the same
// frame: the screen tears from the impact for TEAR_SECONDS (its slices reseed at most TEAR_RESEEDS_PER_SECOND, each
// reseed asking the flash gate), and every reel on screen spins one long free spin from the key turn that lands as the
// lid opens, under a lighter dim so it shows.

export const TEAR_SECONDS = 1.5;
export const TEAR_RESEEDS_PER_SECOND = 3;
/** The slices' largest offset, screen px at pixel scale 4 (scaled by k / 4 and the strength). */
export const TEAR_OFFSET = 24;
/** The vault's dim while the table's reels spin in the intro (an ordinary vault's is 0.86). */
export const FINALE_INTRO_DIM = 0.55;

export interface Tear {
  /** 1 at the impact, easing to 0 at the end. */
  strength: number;
  /** Which reseed window this is (the slices reseed when it changes). */
  slot: number;
}

/** The tear at the vault's time `t` (from the key turn), or null outside its window. */
export function tearAt(t: number): Tear | null {
  const d = t - VAULT_CUES.impact;
  if (d < 0 || d >= TEAR_SECONDS) return null;
  return { strength: 1 - (d / TEAR_SECONDS) ** 2, slot: Math.floor(d * TEAR_RESEEDS_PER_SECOND) };
}

/** The reels' free spin while the intro plays (key turn → impact); null outside it or for an ordinary vault. */
export function finaleSpin(v: VaultState | null, finale: boolean): { elapsed: number; duration: number } | null {
  if (!finale || v?.phase !== "opening" || v.t >= VAULT_CUES.impact) return null;
  return { elapsed: v.t, duration: VAULT_CUES.impact };
}

/** The vault's dim once the key has turned: lighter through The Last Case's intro, so the spinning reels show. */
export const finaleDim = (finale: boolean, t: number, dimOpen: number): number =>
  finale && t < VAULT_CUES.impact ? FINALE_INTRO_DIM : dimOpen;
