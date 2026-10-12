import type { AutoSpinState } from "./autoSpin";
import type { BotState, CardSpot } from "./botOpener";
import type { CharmId } from "./charms";
import type { EvolutionId, EvolutionState } from "./evolved";
import type { LockerState } from "./locker";
import type { Rng } from "./rng";
import type { SellerState } from "./autoSeller";
import type { Tease } from "./tease";
import { START_CASH, TRAY_BASE_CAPACITY, VAULT_PRICES } from "./tuning";
import type { Drop, RarityId } from "./types";
import type { UpgradeId } from "./upgrades";
import type { UpgraderState } from "./upgrader";

// The run's shared types and the RunCtx the machines (bot, auto-seller, locker, auto-spin, Upgrader, vault, day job) are functions over.

/** One of your bench's reels: its drop, its own tease, and how long it runs (its crawl included). */
export interface BenchReel {
  drop: Drop;
  tease: Tease | null;
  duration: number;
}

export type Bench =
  | { phase: "empty" }
  | { phase: "locked"; caseId: string; free: boolean; /** Cases this open holds (multi-open). */ count: number }
  | {
      phase: "spinning";
      caseId: string;
      reels: BenchReel[];
      elapsed: number;
      /** The longest reel: the cards come up when it lands. There is no brake. */
      fullDuration: number;
    }
  | { phase: "revealed"; caseId: string; /** Side by side, left to right; null once sold or taken. */ cards: (Drop | null)[] };

export type VaultState = { phase: "key" } | { phase: "opening"; t: number; drops: Drop[]; landed: number };

export type SaleSource = "bench" | "bot" | "tray" | "seller" | "locker";

/** What the prestige meta hands a new run (M2b spec §8). */
export interface RunSetup {
  /** The campaign run this is (1 to LAST_RUN). */
  run: number;
  startCash: number;
  /** Extra Luck levels (meta perk). */
  luckBonus: number;
  /** Charms picked on the prestige screen for this run. */
  charms: CharmId[];
  botAwake: boolean;
  trayCapacity: number;
  /** Catch-up boost: every sale is multiplied by this. */
  valueBoost: number;
  vaultPrice: number;
}

export const DEFAULT_SETUP: RunSetup = {
  run: 1,
  startCash: START_CASH,
  luckBonus: 0,
  charms: [],
  botAwake: false,
  trayCapacity: TRAY_BASE_CAPACITY,
  valueBoost: 1,
  vaultPrice: VAULT_PRICES[0],
};

/** Everything needed to rebuild a run exactly (the local save, M2b spec §9). */
export interface RunSnapshot {
  seed: number;
  rng: number;
  setup: RunSetup;
  state: RunState;
}

export type SimEvent =
  | { type: "caseBought"; caseId: string; free: boolean; count: number }
  | { type: "spinStarted"; caseId: string; reels: BenchReel[]; fullDuration: number }
  | { type: "revealed"; drops: Drop[] }
  | { type: "sold"; drop: Drop; amount: number; combo: number; source: SaleSource; from: CardSpot | null; slot: number }
  | { type: "caseUnlocked"; caseId: string }
  /** Collector's Eye: every non-★ skin of this case has shown up. */
  | { type: "setCompleted"; caseId: string }
  | { type: "upgradeBought"; id: UpgradeId; level: number }
  | { type: "stageChanged"; stage: number }
  | { type: "dayJobStarted" }
  | { type: "dayJobDone"; amount: number }
  | { type: "stored"; drop: Drop; from: CardSpot; slot: number }
  | { type: "sellerBought" }
  | { type: "sellerUpgraded"; level: number }
  | { type: "botWoke" }
  | { type: "botUpgraded"; level: number }
  | { type: "botSpinStarted"; caseId: string; drops: Drop[]; duration: number }
  | { type: "botRevealed"; drops: Drop[] }
  | { type: "botMultiBought" }
  | { type: "lockerBought" }
  | { type: "lockerUpgraded"; level: number }
  | { type: "lockerStored"; drop: Drop; from: CardSpot | "tray"; slot: number; byHand: boolean }
  | { type: "pressStarted"; rarity: RarityId; inputs: Drop[]; results: Drop[] }
  | { type: "pressDone"; results: Drop[] }
  | { type: "autoContractBought" }
  | { type: "autoSpinBought" }
  | { type: "autoSpinUpgraded"; level: number }
  /** Switched on or off; `first` is the run's first switch-on (the machine's power-on). */
  | { type: "autoSpinToggled"; on: boolean; first: boolean }
  /** It bought a case (its arm pulls); caseBought comes first. */
  | { type: "autoSpinPulled"; caseId: string; count: number }
  /** It turned the key (its arm swings); spinStarted comes first. */
  | { type: "autoSpinKeyed" }
  | { type: "upgraderBought" }
  /** GO: the stake left the locker and the dial spins; the outcome is already rolled (`roll` < `chance` wins). */
  | { type: "upgraderStarted"; rarity: RarityId; inputs: Drop[]; mult: number; chance: number; roll: number; win: boolean }
  /** The dial landed: a win's skin waits on the locker, a loss shreds the stake. */
  | { type: "upgraderDone"; win: boolean; result: Drop | null; inputs: Drop[] }
  | { type: "evolved"; id: EvolutionId }
  | { type: "vaultBought"; price: number }
  | { type: "vaultKeyTurned"; drops: Drop[] }
  | { type: "vaultReelLanded"; index: number; drop: Drop; amount: number }
  | { type: "vaultOpened"; trophy: string; drop: Drop; lifetimeEarnings: number }
  /** Emitted by the controller when a new run begins. */
  | { type: "runStarted" }
  /** Emitted by the controller (prestige screen). */
  | { type: "charmPicked" }
  | { type: "perkBought" }
  /** Emitted by the controller: the credits ended (skipped or run out). */
  | { type: "creditsEnded" };

export type ActionResult = { ok: true } | { ok: false; reason: string };

export interface RunState {
  time: number;
  cash: number;
  lifetimeEarnings: number;
  unlocked: string[];
  upgrades: Record<UpgradeId, number>;
  bench: Bench;
  combo: number;
  /** The combo's share of intensity: jumps up with the combo, fades smoothly after it breaks. */
  comboHeat: number;
  /** When the combo window started: the last sell, pushed forward by every spin since (the reel
   *  turning is never the player being slow — only buying, keying and selling count). */
  lastSellAt: number;
  /** Seconds into a day-job shift, or null when not working. */
  dayJob: number | null;
  heat: number;
  lastTier: number;
  stage: number;
  nextDropId: number;
  opened: number;
  /** When the card on the bench was revealed. */
  revealedAt: number;
  /** Pity Jar: Mil-Specs since the last Covert or ★. */
  pity: number;
  /** Gold Rush: the Golden Hour lasts until this time. */
  goldenHourUntil: number;
  /** Ricochet: free cases waiting for the bench. */
  freeCases: string[];
  /** Collector's Eye: skin ids revealed this run, by case. */
  seen: Record<string, string[]>;
  /** Drops the auto-seller set aside for the player to claim (above its threshold). */
  tray: Drop[];
  bot: BotState;
  seller: SellerState;
  locker: LockerState;
  /** Auto-spin: your bench's machine (Run 1+). */
  autoSpin: AutoSpinState;
  /** Run 4: the Upgrader on the locker. */
  upgrader: UpgraderState;
  /** Run 4: the evolutions bought, Hot Hand's best combo, Assembly Line's count. */
  evolutions: EvolutionState;
  /** The card the player is dragging, if any: machines leave it alone. */
  held: CardSpot | null;
  /** Which card is held (a bench, bot or locker slot). */
  heldSlot: number;
  /** Vault Case I is out (rework spec §4), or null. */
  vault: VaultState | null;
  /** The vault has opened: the run is over. */
  over: boolean;
  /** The highest-value skin revealed this run (bench, bot, contracts, Upgrader); the vault's rewards don't count. */
  best: Drop | null;
}

/** Where a reveal happened; the charms that react to it care. */
export type RevealSpot = CardSpot;

export const OK: ActionResult = { ok: true };
export const fail = (reason: string): ActionResult => ({ ok: false, reason });

/** What a machine may touch of the run: its state and the few shared operations. Implemented by `Run`. */
export interface RunCtx {
  readonly state: RunState;
  readonly setup: RunSetup;
  readonly rng: Rng;
  emit(e: SimEvent): void;
  /** Adds to cash and to lifetime earnings. */
  earn(amount: number): void;
  payout(d: Drop, byHand: boolean): number;
  casePrice(caseId: string): number;
  /** Rolls one case's drop with Luck (+ `extraLuck` levels: Hot Hand), Pity, the Golden Hour and the charms; counts the open. */
  rollFor(caseId: string, forced?: RarityId | null, extraLuck?: number): Drop;
  /** The charms that react to a reveal; `spot` "bench" also stamps revealedAt. */
  onReveal(d: Drop, spot: RevealSpot): void;
  /** Reveals this tick, for heat. */
  countReveals(n: number): void;
  bumpCombo(): void;
  /** Nobody holds a card any more. */
  release(): void;
  takeBenchCard(slot: number): void;
  /** Pays for one BUY of a case (multi-open: as many as you can afford) and locks it on the empty bench; returns how
   *  many. The caller has checked the bench, the shelf and the cash. */
  placeCase(caseId: string): number;
  insertKey(): ActionResult;
  locked(): boolean;
}
