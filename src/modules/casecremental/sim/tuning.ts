import type { RarityId, WearId } from "./types";

// Every balance number of a run. sim/pacing.test.ts checks the result: when it fails, tune these
// numbers — never the logic.

export const START_CASH = 6;

/** Price and one-time unlock cost per case id, in ladder order. */
export const CASE_ECONOMY: Readonly<Record<string, { price: number; unlockCost: number }>> = {
  bootcamp: { price: 2, unlockCost: 0 },
  wildwood: { price: 15, unlockCost: 40 },
  bedrock: { price: 150, unlockCost: 1200 },
};

export const RARITY_BASE_WEIGHT: Readonly<Record<RarityId, number>> = {
  milspec: 79.92,
  restricted: 15.98,
  classified: 3.2,
  covert: 0.64,
  gold: 0.26,
};

/** A skin's base value as a multiple of its case's price. */
export const RARITY_VALUE_MULT: Readonly<Record<RarityId, number>> = {
  milspec: 0.55,
  restricted: 2.2,
  classified: 8,
  covert: 40,
  gold: 200,
};

/** Per-case changes to RARITY_VALUE_MULT. Boot Camp jump-starts a run: its Mil-Specs nearly pay the
 *  case back and its knife is smaller, for a slightly higher average than the base table. */
export const CASE_VALUE_MULT: Readonly<Record<string, Partial<Record<RarityId, number>>>> = {
  bootcamp: { milspec: 0.95, gold: 120 },
};

/** Each Luck level multiplies the weight of every rarity above Mil-Spec by (1 + this). */
export const LUCK_PER_LEVEL = 0.15;

export const WEAR_TABLE: ReadonlyArray<{
  id: WearId;
  name: string;
  /** Exclusive upper bound of the float range. */
  maxFloat: number;
  mult: number;
}> = [
  { id: "FN", name: "Factory New", maxFloat: 0.07, mult: 1.5 },
  { id: "MW", name: "Minimal Wear", maxFloat: 0.15, mult: 1.2 },
  { id: "FT", name: "Field-Tested", maxFloat: 0.38, mult: 1 },
  { id: "WW", name: "Well-Worn", maxFloat: 0.45, mult: 0.85 },
  { id: "BS", name: "Battle-Scarred", maxFloat: Number.POSITIVE_INFINITY, mult: 0.7 },
];

export const STATTRAK_CHANCE = 0.1;
export const STATTRAK_MULT = 2;

export const SPIN_BASE_SECONDS = 3;
export const SPIN_MIN_SECONDS = 0.6;
/** Each Quick Hands level multiplies the spin duration by this. */
export const QUICK_HANDS_FACTOR = 0.8;

/** Teasing spin: how much a red or a knife on its way slows the reel's last stretch, by rarity… */
export const TEASE_RARITY: Readonly<Partial<Record<RarityId, number>>> = { covert: 0.6, gold: 1 };
/** …and by how far below the player's top unlocked case it is (0 = the top case, then 1, 2+ below). */
export const TEASE_PROGRESS: readonly number[] = [1, 0.3, 0.1];
/** Extra crawl at full strength, as a share of the spin time (so Quick Hands shortens it too). */
export const TEASE_CRAWL = 0.8;
/** An ordinary drop sometimes gets a fake tease: a red or a knife lands right next to it. */
export const FAKE_TEASE_CHANCE = 1 / 40;
/** Share of fake teases whose decoy is a knife rather than a red. */
export const FAKE_TEASE_GOLD_SHARE = 0.25;

export const APPRAISER_PER_LEVEL = 0.25;

export const UPGRADE_COSTS = {
  luck: { baseCost: 15, growth: 1.6, maxLevel: 25 },
  appraiser: { baseCost: 10, growth: 1.55, maxLevel: 25 },
  quickHands: { baseCost: 8, growth: 1.7, maxLevel: 10 },
} as const;

/** Sells closer together than this keep the combo going. */
export const COMBO_WINDOW_SECONDS = 4;
/** Sell multiplier per combo step: 1 + COMBO_STEP × min(combo, COMBO_CAP). */
export const COMBO_STEP = 0.02;
export const COMBO_CAP = 50;

/** Broke with an empty bench → a free first-tier case after this long. */
export const FREE_CASE_SECONDS = 10;

/** Heat = exponential moving average of reveals per second, with this time constant. */
export const HEAT_TAU_SECONDS = 10;
/** Intensity bonus per case tier above the first. */
export const TIER_HEAT_BONUS = 0.5;
/** Combo adds comboHeat / this to intensity. */
export const COMBO_HEAT_DIVISOR = 25;
/** comboHeat follows the combo up at once but fades with this time constant once the combo breaks. */
export const COMBO_HEAT_DECAY_SECONDS = 15;
/** Intensity needed for stages 2, 3, 4, 5. */
export const STAGE_THRESHOLDS = [0.8, 3, 10, 40] as const;
/** A stage is kept until intensity falls below its threshold × this. */
export const STAGE_HYSTERESIS = 0.8;

// ── M2b: charms, the bot, the tray, the day job, the vault, prestige ─────────────────────────────

export const GOLD_RUSH_MULT = 10;
export const GOLDEN_HOUR_SECONDS = 5;
export const GOLDEN_HOUR_LUCK = 3;
/** Pity Jar: Luck levels added per Mil-Spec since the last Covert or ★ (+1 % Luck each). */
export const PITY_LUCK_LEVELS = 1 / 15;
export const INSIDER_PRICE_MULT = 0.7;
export const DOUBLE_TAP_MULT = 3;
export const LUCKY_SEVEN_EVERY = 7;
export const MANIAC_MILSPEC_MULT = 4;
export const MANIAC_OTHER_MULT = 0.5;

export const TRAY_BASE_CAPACITY = 12;
export const VAULT_BASE_PRICE = 20_000;
