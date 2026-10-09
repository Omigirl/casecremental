import { BOT_MAX_SPEED, BOT_SPEED_COSTS, BOT_SPEED_LEVELS, BOT_SPIN_SECONDS } from "./tuning";
import type { Drop } from "./types";

// The bot as an opener (rework spec §1): once woken it buys a case with your cash and spins it on its own
// reel; its drop waits at its station as a card until it is sold (by you, or by the auto-seller). It does not
// open again while its card waits. Speed makes its spin faster.

/** Where a revealed card waits: your bench or the bot's station. */
export type CardSpot = "bench" | "bot";

export interface BotSpin {
  caseId: string;
  drop: Drop;
  elapsed: number;
  duration: number;
}

export interface BotState {
  awake: boolean;
  speedLevel: number;
  /** The case it opens; null = the dearest one you can afford. */
  caseChoice: string | null;
  spin: BotSpin | null;
  /** Its drop, waiting at its station to be sold. */
  card: Drop | null;
  /** When that card landed. */
  cardAt: number;
  /** Seconds a just-woken bot still rests before its first spin. */
  wakeLeft: number;
}

export const freshBot = (awake: boolean): BotState => ({
  awake,
  speedLevel: 0,
  caseChoice: null,
  spin: null,
  card: null,
  cardAt: 0,
  wakeLeft: 0,
});

/** ×1 at level 0 up to ×BOT_MAX_SPEED at the run's last level, geometric in between. */
export const botSpeed = (level: number): number => BOT_MAX_SPEED ** (Math.min(level, BOT_SPEED_LEVELS) / BOT_SPEED_LEVELS);

/** Price of the next Speed level, or null at this run's cap. */
export function botSpeedCost(level: number): number | null {
  if (level >= BOT_SPEED_LEVELS) return null;
  return Math.ceil(BOT_SPEED_COSTS.baseCost * BOT_SPEED_COSTS.growth ** level);
}

export const botSpinSeconds = (level: number): number => BOT_SPIN_SECONDS / botSpeed(level);

/** The case the bot opens next: its choice (when unlocked) if you can afford it, else the dearest one you can. */
export function botCaseFor(choice: string | null, unlocked: readonly string[], cash: number, price: (id: string) => number): string | null {
  if (choice && unlocked.includes(choice)) return cash >= price(choice) ? choice : null;
  let best: string | null = null;
  for (const id of unlocked) if (price(id) <= cash && (best === null || price(id) > price(best))) best = id;
  return best;
}
