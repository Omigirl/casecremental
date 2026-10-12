import type { RarityId, WearId } from "./types";

// Every balance number of a run. sim/pacing.test.ts checks the result: when it fails, tune these
// numbers — never the logic.

export const START_CASH = 6;

/** The campaign has this many runs; after the last, a vault replays it. */
export const LAST_RUN = 3;

/** What each run (index = run - 1) offers: the shelf, the caps and the machines that arrive with it. */
export interface RunContent {
  /** How many cases of the ladder this run's shelf has. */
  cases: number;
  /** Your widest multi-open. */
  multiOpen: number;
  /** The bot's Speed levels this run. */
  botSpeedLevels: number;
  /** Cases one bot spin opens at most (1 = no bot multi-open). */
  botMultiOpen: number;
  locker: boolean;
  grid: boolean;
  autoContract: boolean;
}
export const RUN_CONTENT: readonly RunContent[] = [
  { cases: 3, multiOpen: 2, botSpeedLevels: 5, botMultiOpen: 1, locker: false, grid: false, autoContract: false },
  { cases: 5, multiOpen: 3, botSpeedLevels: 8, botMultiOpen: 2, locker: true, grid: false, autoContract: false },
  { cases: 7, multiOpen: 5, botSpeedLevels: 11, botMultiOpen: 2, locker: true, grid: true, autoContract: true },
];

/** Price and one-time unlock cost per case id, in ladder order. */
export const CASE_ECONOMY: Readonly<Record<string, { price: number; unlockCost: number }>> = {
  bootcamp: { price: 2, unlockCost: 0 },
  wildwood: { price: 15, unlockCost: 30 },
  bedrock: { price: 150, unlockCost: 1200 },
  mainframe: { price: 1_500, unlockCost: 12_000 },
  neon: { price: 15_000, unlockCost: 150_000 },
  deepspace: { price: 150_000, unlockCost: 1_500_000 },
  inferno: { price: 1_500_000, unlockCost: 15_000_000 },
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
  /** Each level opens one more case; the run caps it (RUN_CONTENT.multiOpen: x2, x3, x5). */
  multiOpen: { baseCost: 500, growth: 25, maxLevel: 4 },
} as const;

/** The widest multi-open in the campaign (×5 in Run 3, rework spec §2): a bench of more is a corrupt save. */
export const MULTI_OPEN_MAX = 5;

/** Sells closer together than this keep the combo going. */
export const COMBO_WINDOW_SECONDS = 4;
/** Sell multiplier per combo step: 1 + COMBO_STEP × min(combo, COMBO_CAP). */
export const COMBO_STEP = 0.02;
export const COMBO_CAP = 50;

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

// Run 2 and 3 charms
export const CHAIN_REACTION_CHANCE = 0.25;
/** Ricochet and Chain Reaction free cases waiting for the bench never pile up past this. */
export const FREE_CASE_QUEUE_MAX = 5;
export const CONTRACT_KILLER_CHANCE = 0.2;
export const HOARDER_PER_SKIN = 0.01;
export const FEVER_PAY_MULT = 1.5;
export const FEVER_STAGE_BONUS = 1;
export const COLLECTOR_MULT = 2;

export const TRAY_BASE_CAPACITY = 12;

/** Broke with an empty bench: a day job (campaign spec §6.1). */
export const DAY_JOB_SECONDS = 3;
export const DAY_JOB_PAY = 2;
export const DAY_JOB_PAY_CHANCE = 0.9;

/** The bot opens its own cases (rework spec §1): one spin on its reel takes this long at Speed ×1. */
export const BOT_SPIN_SECONDS = 4;
export const BOT_WAKE_COST = 22;
/** A bot just woken rests this long before its first spin, so its waking-up plays out: at least the length of
 *  fx/pixel/anims.ts `botWake` (1.11 s; anims.test.ts pins it), else its first spin cuts the hop's end. */
export const BOT_WAKE_SECONDS = 1.15;
/** The bot's speed at these levels; geometric in between (Run 1's x1 to x8 over 5 levels is unchanged). */
export const BOT_SPEED_ANCHORS: ReadonlyArray<readonly [level: number, speed: number]> = [
  [0, 1],
  [5, 8],
  [8, 20],
  [11, 50],
];
/** Run 2: the bot opens two cases per spin on stacked reels. */
export const BOT_MULTI_COST = 4_000;
export const BOT_SPEED_COSTS = { baseCost: 60, growth: 2.3 } as const;

/** Each run's vault price the first time it is reached; a replay of the last run multiplies it by VAULT_GROWTH. */
export const VAULT_PRICES = [1_000_000, 50_000_000, 2_500_000_000] as const;
/** A replay of the last run: its vault price grows this much per completed loop. */
export const VAULT_GROWTH = 4;
/** Vault Case I's intro (plan M2b-C8): the key turns, the intro track plays, and its end is the impact, where
 *  the lid snaps open on the fanfare's drop. Every vault time after it counts from here. */
export const VAULT_INTRO_SECONDS = 3.4;
/** Vault Case I (rework spec §4): after the key turns, five reels land at these seconds (5-7.5 s after the impact,
 *  on the fanfare's 120 BPM beats); the scene ends once the 13.8 s fanfare has rung out; each reel pays this share of
 *  the vault's price, rarer each time. */
export const VAULT_LAND_TIMES = [8.4, 8.9, 9.4, 9.9, 10.9] as const;
export const VAULT_OPENING_SECONDS = 17.4;
export const VAULT_REEL_SHARES = [0.03, 0.06, 0.08, 0.13, 0.3] as const;
export const VAULT_REEL_RARITIES = ["classified", "covert", "covert", "gold", "gold"] as const;

/** CLOUT = floor(√(lifetime earnings) / this). */
export const CLOUT_DIVISOR = 105;
/** Each opened vault multiplies every later sale by this (the catch-up boost). */
export const CATCH_UP_PER_VAULT = 3;
export const CHARM_OFFER_SIZE = 3;
export const PERK_START_CASH = 20;
export const TRAY_PER_PERK = 4;
/** Meta perks, bought with CLOUT on the prestige screen. */
export const PERK_COSTS = {
  startCash: { baseCost: 3, growth: 1.8, maxLevel: 5 },
  luck: { baseCost: 5, growth: 2, maxLevel: 5 },
  charmSlot: { baseCost: 15, growth: 2, maxLevel: 2 },
  botAwake: { baseCost: 8, growth: 1, maxLevel: 1 },
  biggerTray: { baseCost: 4, growth: 2, maxLevel: 3 },
} as const;

/** The auto-seller machine (rework spec §1): unlocked in Run 1, then it takes any waiting card. */
export const SELLER_COST = 300;
/** Seconds a card waits before the machine takes it, per Speed level (Run 1: 4 levels). */
export const SELLER_HOLD_SECONDS = [2.5, 1.8, 1.2, 0.8, 0.5] as const;
/** A Covert or ★ waits this long, so its reveal (the knife's showcase) plays first. */
export const SELLER_BIG_HOLD = 2.6;
export const SELLER_SPEED_COSTS = { baseCost: 120, growth: 2.4 } as const;

/** The locker (Run 2): keeps skins, by hand or through the auto-seller's Collect setting. */
export const LOCKER_COST = 6_000;
export const LOCKER_BASE_CAPACITY = 20;
export const LOCKER_SIZE_STEP = 10;
export const LOCKER_SIZE_LEVELS = 3;
export const LOCKER_SIZE_COSTS = { baseCost: 10_000, growth: 3 } as const;
/** A trade-up contract presses this many skins of one rarity into one of the next. */
export const TRADE_UP_COUNT = 10;
export const TRADE_UP_SECONDS = 2.5;
/** A contract pays its normal value × this (by its inputs' rarity), so it returns ~1.5× what its inputs would sell for. */
export const TRADE_UP_BONUS: Readonly<Record<Exclude<RarityId, "gold">, number>> = {
  milspec: 4.5,
  restricted: 5,
  classified: 3.6,
  covert: 3.6,
};
/** Run 3: the locker presses on its own. */
export const AUTO_CONTRACT_COST = 250_000_000;

/** The auto-buyer grid (Run 3, spec §6): buys ticked cases into a board of cells and opens each after a delay. */
export const GRID_COST = 40_000_000;
/** Cells per Size level (rows of ten). */
export const GRID_SIZES = [10, 20, 30, 50] as const;
export const GRID_SIZE_COSTS = { baseCost: 100_000_000, growth: 4 } as const;
/** Seconds between purchases, per Rate level. */
export const GRID_BUY_INTERVALS = [1, 0.6, 0.35, 0.2, 0.12] as const;
export const GRID_RATE_COSTS = { baseCost: 60_000_000, growth: 3 } as const;
/** A filled cell opens this long after it was bought. */
export const GRID_OPEN_SECONDS = 1.5;
/** The share of your cash the grid never spends (a free setting; spec §6 default 50 %). */
export const GRID_RESERVES = [0.25, 0.5, 0.75] as const;
