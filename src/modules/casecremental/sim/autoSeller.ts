import { RARITY_ORDER } from "./rarity";
import { SELLER_BIG_HOLD, SELLER_HOLD_SECONDS, SELLER_SPEED_COSTS } from "./tuning";
import type { RarityId } from "./types";

// The auto-seller machine (rework spec §1): once bought, any card left waiting — yours on the bench or the
// bot's at its station — is taken after a short hold: sold if it is at or below the threshold (no combo),
// else put in the claim tray. A held card is left alone; a full tray leaves the card where it is.

export interface SellerState {
  on: boolean;
  speedLevel: number;
  /** The rarest it sells; anything rarer goes to the claim tray. */
  threshold: RarityId;
}

export const freshSeller = (): SellerState => ({ on: false, speedLevel: 0, threshold: "classified" });

/** The Speed levels this run allows (Run 1: 4). */
export const SELLER_SPEED_LEVELS = SELLER_HOLD_SECONDS.length - 1;

export const sellsAt = (threshold: RarityId, rarity: RarityId): boolean => RARITY_ORDER.indexOf(rarity) <= RARITY_ORDER.indexOf(threshold);

/** How long a card waits before the machine takes it. */
export const sellerHold = (rarity: RarityId, level: number): number =>
  rarity === "covert" || rarity === "gold" ? SELLER_BIG_HOLD : SELLER_HOLD_SECONDS[Math.min(level, SELLER_SPEED_LEVELS)]!;

export function sellerSpeedCost(level: number): number | null {
  if (level >= SELLER_SPEED_LEVELS) return null;
  return Math.ceil(SELLER_SPEED_COSTS.baseCost * SELLER_SPEED_COSTS.growth ** level);
}
