import { RARITY_ORDER } from "./rarity";
import { BOT_BIG_REVEAL_HOLD, BOT_MAX_SPEED, BOT_REVEAL_HOLD, BOT_SPEED_COSTS, BOT_SPEED_LEVELS, BOT_STEP_SECONDS } from "./tuning";
import type { Drop, RarityId } from "./types";

// The bot as a seller (M2b spec §3): a small state machine the run ticks. Asleep until woken; then it walks
// to the bench once a revealed card has waited a moment, picks it up and either sells it at the bin or
// carries it to the claim tray. Step times are seconds at speed ×1, divided by its speed.

export { BOT_STEP_SECONDS };

export type BotStep = "toBench" | "wait" | "pickUp" | "carry" | "drop" | "back";

export interface BotJob {
  step: BotStep;
  /** Progress through the step, in speed-scaled seconds. */
  t: number;
  drop: Drop | null;
  dest: "bin" | "tray" | null;
}

export interface BotState {
  awake: boolean;
  speedLevel: number;
  /** The rarest it may sell; anything rarer goes to the claim tray. */
  threshold: RarityId;
  job: BotJob | null;
}

export const freshBot = (awake: boolean): BotState => ({ awake, speedLevel: 0, threshold: "classified", job: null });

/** ×1 at level 0 up to ×BOT_MAX_SPEED at the run's last level, geometric in between. */
export const botSpeed = (level: number): number => BOT_MAX_SPEED ** (Math.min(level, BOT_SPEED_LEVELS) / BOT_SPEED_LEVELS);

/** Price of the next Speed level, or null at this run's cap. */
export function botSpeedCost(level: number): number | null {
  if (level >= BOT_SPEED_LEVELS) return null;
  return Math.ceil(BOT_SPEED_COSTS.baseCost * BOT_SPEED_COSTS.growth ** level);
}

/** May it sell this rarity (else it goes to the tray)? */
export const sellsAt = (threshold: RarityId, rarity: RarityId): boolean => RARITY_ORDER.indexOf(rarity) <= RARITY_ORDER.indexOf(threshold);

/** How long a revealed card is left alone first: big reveals play out; others shrink with speed. */
export const revealHold = (rarity: RarityId, speed: number): number =>
  rarity === "covert" || rarity === "gold" ? BOT_BIG_REVEAL_HOLD : BOT_REVEAL_HOLD / speed;
