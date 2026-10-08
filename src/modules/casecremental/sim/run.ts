import { freshSeller, sellerHold, sellerSpeedCost, sellsAt, type SellerState } from "./autoSeller";
import { botCaseFor, botSpeedCost, botSpinSeconds, freshBot, type BotState, type CardSpot } from "./botOpener";
import { charmMinRarity, charmPriceMult, charmStatTrakChance, charmValueMult, isBigRarity, type CharmId } from "./charms";
import { CASES, caseById, priceOf, unlockCostOf } from "./content/cases";
import { intensityLevel, nextStage, STAGE_NAMES, updateHeat } from "./intensity";
import { createRng, type Rng } from "./rng";
import { rollDrop } from "./roll";
import { rollTease, type Tease } from "./tease";
import {
  BOT_WAKE_COST,
  COMBO_CAP,
  COMBO_HEAT_DECAY_SECONDS,
  COMBO_STEP,
  COMBO_WINDOW_SECONDS,
  DAY_JOB_PAY,
  DAY_JOB_PAY_CHANCE,
  DAY_JOB_SECONDS,
  FINALE_SECONDS,
  GOLDEN_HOUR_LUCK,
  GOLDEN_HOUR_SECONDS,
  PITY_LUCK_LEVELS,
  SELLER_COST,
  START_CASH,
  TRAY_BASE_CAPACITY,
  VAULT_BASE_PRICE,
  VAULT_TROPHY,
} from "./tuning";
import type { Drop, RarityId } from "./types";
export type { CardSpot } from "./botOpener";
import { effectsOf, upgradeCost, type Effects, type UpgradeId } from "./upgrades";

// One run of the game: cash, the bench (where a case is bought → keyed → spun → revealed → sold),
// upgrades, combo and intensity. Pure and deterministic from its seed; the renderer and the UI read
// `state` and consume `drainEvents()`. Milestone 1 has one bench; later milestones add more.

export type Bench =
  | { phase: "empty" }
  | { phase: "locked"; caseId: string; free: boolean }
  | {
      phase: "spinning";
      caseId: string;
      drop: Drop;
      elapsed: number;
      /** The reel always runs this long (Quick Hands shortens it); there is no brake. */
      fullDuration: number;
      /** A red or a knife on its way (or a fake one): the crawl is part of fullDuration. */
      tease: Tease | null;
    }
  | { phase: "revealed"; caseId: string; drop: Drop };

export type SaleSource = "bench" | "bot" | "tray" | "seller";

/** What the prestige meta hands a new run (M2b spec §8). */
export interface RunSetup {
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
  startCash: START_CASH,
  luckBonus: 0,
  charms: [],
  botAwake: false,
  trayCapacity: TRAY_BASE_CAPACITY,
  valueBoost: 1,
  vaultPrice: VAULT_BASE_PRICE,
};

/** Everything needed to rebuild a run exactly (the local save, M2b spec §9). */
export interface RunSnapshot {
  seed: number;
  rng: number;
  setup: RunSetup;
  state: RunState;
}

export type SimEvent =
  | { type: "caseBought"; caseId: string; free: boolean }
  | { type: "spinStarted"; caseId: string; drop: Drop; fullDuration: number; tease: Tease | null }
  | { type: "revealed"; drop: Drop }
  | { type: "sold"; drop: Drop; amount: number; combo: number; source: SaleSource; from: CardSpot | null }
  | { type: "caseUnlocked"; caseId: string }
  | { type: "upgradeBought"; id: UpgradeId; level: number }
  | { type: "stageChanged"; stage: number }
  | { type: "dayJobStarted" }
  | { type: "dayJobDone"; amount: number }
  | { type: "stored"; drop: Drop; from: CardSpot }
  | { type: "sellerBought" }
  | { type: "sellerUpgraded"; level: number }
  | { type: "botWoke" }
  | { type: "botUpgraded"; level: number }
  | { type: "botSpinStarted"; caseId: string; drop: Drop; duration: number }
  | { type: "botRevealed"; drop: Drop }
  | { type: "vaultBought"; price: number }
  | { type: "vaultOpened"; trophy: string; drop: Drop; lifetimeEarnings: number }
  /** Emitted by the controller when a new run begins. */
  | { type: "runStarted" };

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
  /** Drops the auto-seller set aside for the player to claim (above its threshold). */
  tray: Drop[];
  bot: BotState;
  seller: SellerState;
  /** The card the player is dragging, if any: machines leave it alone. */
  held: CardSpot | null;
  /** Seconds into the vault finale, or null. */
  finale: number | null;
  /** The vault has opened: the run is over. */
  over: boolean;
}

const OK: ActionResult = { ok: true };
const fail = (reason: string): ActionResult => ({ ok: false, reason });

export class Run {
  readonly state: RunState;
  readonly seed: number;
  readonly setup: RunSetup;
  private readonly rng: Rng;
  private events: SimEvent[] = [];
  private revealsThisTick = 0;
  private forcedRarity: RarityId | null = null;
  private forcedFake = false;

  constructor(seed: number, setup: RunSetup = DEFAULT_SETUP, resume?: RunSnapshot) {
    this.seed = seed;
    this.setup = { ...setup, charms: [...setup.charms] };
    this.rng = createRng(seed, resume?.rng);
    if (resume) {
      this.state = structuredClone(resume.state);
      return;
    }
    this.state = {
      time: 0,
      cash: this.setup.startCash,
      lifetimeEarnings: 0,
      unlocked: [CASES[0]!.id],
      upgrades: { luck: 0, appraiser: 0, quickHands: 0 },
      bench: { phase: "empty" },
      combo: 0,
      comboHeat: 0,
      lastSellAt: -1e9,
      dayJob: null,
      heat: 0,
      lastTier: 1,
      stage: 1,
      nextDropId: 1,
      opened: 0,
      revealedAt: 0,
      pity: 0,
      goldenHourUntil: -1,
      freeCases: [],
      tray: [],
      bot: freshBot(this.setup.botAwake),
      seller: freshSeller(),
      held: null,
      finale: null,
      over: false,
    };
  }

  static fromSnapshot(snap: RunSnapshot): Run {
    return new Run(snap.seed, snap.setup, snap);
  }

  snapshot(): RunSnapshot {
    return { seed: this.seed, rng: this.rng.state(), setup: structuredClone(this.setup), state: structuredClone(this.state) };
  }

  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  effects(): Effects {
    return effectsOf(this.state.upgrades);
  }

  comboMultiplier(): number {
    return 1 + COMBO_STEP * Math.min(this.state.combo, COMBO_CAP);
  }

  intensity(): number {
    return intensityLevel(this.state.heat, this.state.lastTier, this.state.comboHeat);
  }

  /** A case's price this run (Insider). */
  casePrice(caseId: string): number {
    return priceOf(caseId) * charmPriceMult(this.setup.charms);
  }

  cheapestPrice(): number {
    return Math.min(...this.state.unlocked.map((id) => this.casePrice(id)));
  }

  /** What a drop pays: value × Appraiser × charms × catch-up, and × combo when sold by hand. */
  payout(d: Drop, byHand: boolean): number {
    const combo = byHand ? this.comboMultiplier() : 1;
    return d.value * this.effects().sellMult * charmValueMult(this.setup.charms, d) * this.setup.valueBoost * combo;
  }

  private bumpCombo(): void {
    const s = this.state;
    s.combo = s.time - s.lastSellAt <= COMBO_WINDOW_SECONDS ? s.combo + 1 : 1;
    s.lastSellAt = s.time;
  }

  buyCase(caseId: string): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    if (s.bench.phase !== "empty") return fail("bench is busy");
    if (!s.unlocked.includes(caseId)) return fail(`case ${caseId} is locked`);
    const price = this.casePrice(caseId);
    if (s.cash < price) return fail("not enough cash");
    s.cash -= price;
    s.bench = { phase: "locked", caseId, free: false };
    this.events.push({ type: "caseBought", caseId, free: false });
    return OK;
  }

  /** Dev board only: the next opened case drops this rarity. */
  forceNextRarity(rarity: RarityId | null): void {
    this.forcedRarity = rarity;
    this.forcedFake = false;
  }

  /** Dev board only: the next opened case drops an ordinary skin with a fake tease. */
  forceFakeTease(): void {
    this.forcedRarity = "milspec";
    this.forcedFake = true;
  }

  /** Roll one case's drop with Luck, Pity, the Golden Hour and the charms; counts the open. */
  private rollFor(caseId: string): Drop {
    const s = this.state;
    const c = caseById(caseId);
    s.opened++;
    const luck = this.effects().luckLevel + this.setup.luckBonus + s.pity * PITY_LUCK_LEVELS;
    const drop = rollDrop(c, priceOf(c.id), luck, this.rng, s.nextDropId++, this.forcedRarity, {
      luckMult: s.time < s.goldenHourUntil ? GOLDEN_HOUR_LUCK : 1,
      statTrakChance: charmStatTrakChance(this.setup.charms),
      minRarity: charmMinRarity(this.setup.charms, s.opened),
    });
    this.forcedRarity = null;
    return drop;
  }

  insertKey(): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    const b = s.bench;
    if (b.phase !== "locked") return fail("no locked case on the bench");
    const c = caseById(b.caseId);
    const fx = this.effects();
    const drop = this.rollFor(c.id);
    const topTier = Math.max(...s.unlocked.map((id) => caseById(id).tier));
    const tease = rollTease(drop.rarity, c.tier, topTier, fx.spinSeconds, this.rng, this.forcedFake);
    this.forcedFake = false;
    const fullDuration = fx.spinSeconds + (tease?.extraSeconds ?? 0);
    s.lastSellAt += fullDuration; // the spin (tease crawl included) never counts against the combo
    s.bench = { phase: "spinning", caseId: c.id, drop, elapsed: 0, fullDuration, tease };
    s.lastTier = c.tier;
    this.events.push({ type: "spinStarted", caseId: c.id, drop, fullDuration, tease });
    return OK;
  }

  sell(): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    const b = s.bench;
    if (b.phase !== "revealed") return fail("nothing to sell");
    this.bumpCombo();
    const amount = this.payout(b.drop, true);
    s.cash += amount;
    s.lifetimeEarnings += amount;
    s.bench = { phase: "empty" };
    s.held = null;
    this.events.push({ type: "sold", drop: b.drop, amount, combo: s.combo, source: "bench", from: "bench" });
    return OK;
  }

  unlockCase(caseId: string): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    const index = CASES.findIndex((c) => c.id === caseId);
    if (index < 0) return fail(`unknown case: ${caseId}`);
    if (s.unlocked.includes(caseId)) return fail("already unlocked");
    if (!s.unlocked.includes(CASES[index - 1]!.id)) return fail("unlock the previous case first");
    const cost = unlockCostOf(caseId);
    if (s.cash < cost) return fail("not enough cash");
    s.cash -= cost;
    s.unlocked.push(caseId);
    this.events.push({ type: "caseUnlocked", caseId });
    return OK;
  }

  buyUpgrade(id: UpgradeId): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    const cost = upgradeCost(id, s.upgrades[id]);
    if (cost === null) return fail("max level");
    if (s.cash < cost) return fail("not enough cash");
    s.cash -= cost;
    s.upgrades[id] += 1;
    this.events.push({ type: "upgradeBought", id, level: s.upgrades[id] });
    return OK;
  }

  tick(dt: number): void {
    const s = this.state;
    s.time += dt;
    if (s.over) return;

    const b = s.bench;
    if (b.phase === "spinning") {
      b.elapsed += dt;
      if (b.elapsed >= b.fullDuration) {
        s.bench = { phase: "revealed", caseId: b.caseId, drop: b.drop };
        this.onReveal(b.drop, "bench");
        this.revealsThisTick++;
        this.events.push({ type: "revealed", drop: b.drop });
      }
    }

    // a Ricochet case takes the bench as soon as it is clear
    if (s.bench.phase === "empty" && s.freeCases.length > 0 && !this.locked()) {
      const caseId = s.freeCases.shift()!;
      s.bench = { phase: "locked", caseId, free: true };
      this.events.push({ type: "caseBought", caseId, free: true });
    }

    if (s.combo > 0 && s.time - s.lastSellAt > COMBO_WINDOW_SECONDS) s.combo = 0;
    s.comboHeat = s.combo >= s.comboHeat ? s.combo : s.comboHeat * Math.exp(-dt / COMBO_HEAT_DECAY_SECONDS);

    this.tickBot(dt);
    this.tickSeller();
    this.tickDayJob(dt);
    this.tickFinale(dt);

    s.heat = updateHeat(s.heat, this.revealsThisTick, dt);
    this.revealsThisTick = 0;
    const stage = this.locked() ? s.stage : nextStage(s.stage, this.intensity());
    if (stage !== s.stage) {
      s.stage = stage;
      this.events.push({ type: "stageChanged", stage });
    }
  }

  /** Broke with an empty bench and not already working (campaign spec §6.1). */
  dayJobAvailable(): boolean {
    const s = this.state;
    return s.dayJob === null && s.bench.phase === "empty" && s.cash < this.cheapestPrice();
  }

  startDayJob(): ActionResult {
    if (this.locked()) return fail("the vault is open");
    if (this.state.dayJob !== null) return fail("already working");
    if (!this.dayJobAvailable()) return fail("no day job: you can afford a case or the bench is busy");
    this.state.dayJob = 0;
    this.events.push({ type: "dayJobStarted" });
    return OK;
  }

  /** The vault is open (finale running) or the run has ended: nothing else can be done. */
  locked(): boolean {
    return this.state.finale !== null || this.state.over;
  }

  vaultShown(): boolean {
    return CASES.every((c) => this.state.unlocked.includes(c.id));
  }

  buyVault(): ActionResult {
    const s = this.state;
    if (this.locked()) return fail("the vault is open");
    if (!this.vaultShown()) return fail("unlock every case first");
    if (s.bench.phase !== "empty") return fail("bench is busy");
    if (s.cash < this.setup.vaultPrice) return fail("not enough cash");
    s.cash -= this.setup.vaultPrice;
    s.finale = 0;
    this.events.push({ type: "vaultBought", price: this.setup.vaultPrice });
    // the finale is the top stage from its first frame to the end (M2b spec §7)
    s.stage = STAGE_NAMES.length;
    this.events.push({ type: "stageChanged", stage: s.stage });
    return OK;
  }

  private tickFinale(dt: number): void {
    const s = this.state;
    if (s.finale === null) return;
    s.finale += dt;
    if (s.finale < FINALE_SECONDS) return;
    for (const d of s.tray) {
      const amount = this.payout(d, false);
      s.cash += amount;
      s.lifetimeEarnings += amount;
    }
    s.tray = [];
    s.over = true;
    const top = CASES[CASES.length - 1]!;
    const drop = rollDrop(top, priceOf(top.id), 0, this.rng, s.nextDropId++, "gold");
    this.events.push({ type: "vaultOpened", trophy: VAULT_TROPHY, drop, lifetimeEarnings: s.lifetimeEarnings });
  }

  wakeBot(): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    if (s.bot.awake) return fail("the bot is already awake");
    if (s.cash < BOT_WAKE_COST) return fail("not enough cash");
    s.cash -= BOT_WAKE_COST;
    s.bot.awake = true;
    this.events.push({ type: "botWoke" });
    return OK;
  }

  buyBotSpeed(): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    if (!s.bot.awake) return fail("wake the bot first");
    const cost = botSpeedCost(s.bot.speedLevel);
    if (cost === null) return fail("max level for this run");
    if (s.cash < cost) return fail("not enough cash");
    s.cash -= cost;
    s.bot.speedLevel += 1;
    this.events.push({ type: "botUpgraded", level: s.bot.speedLevel });
    return OK;
  }

  /** The player picks a waiting card up (bench or bot) or lets go (null): machines leave a held card alone. */
  setHeld(spot: CardSpot | null): ActionResult {
    const s = this.state;
    const waiting = spot === "bench" ? s.bench.phase === "revealed" : spot === "bot" ? s.bot.card !== null : true;
    s.held = waiting ? spot : null;
    return OK;
  }

  /** The case the bot opens (null = the dearest you can afford). */
  setBotCase(caseId: string | null): ActionResult {
    if (caseId !== null && !CASES.some((c) => c.id === caseId)) return fail(`unknown case: ${caseId}`);
    this.state.bot.caseChoice = caseId;
    return OK;
  }

  /** Sell the bot's card by hand (feeds the combo). */
  sellBotCard(): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    const d = s.bot.card;
    if (!d) return fail("the bot has nothing to sell");
    this.bumpCombo();
    const amount = this.payout(d, true);
    s.cash += amount;
    s.lifetimeEarnings += amount;
    s.bot.card = null;
    if (s.held === "bot") s.held = null;
    this.events.push({ type: "sold", drop: d, amount, combo: s.combo, source: "bot", from: "bot" });
    return OK;
  }

  /** Sell a tray item by hand (feeds the combo). */
  claim(index: number): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    const d = s.tray[index];
    if (!d) return fail("nothing in that tray slot");
    s.tray.splice(index, 1);
    this.bumpCombo();
    const amount = this.payout(d, true);
    s.cash += amount;
    s.lifetimeEarnings += amount;
    this.events.push({ type: "sold", drop: d, amount, combo: s.combo, source: "tray", from: null });
    return OK;
  }

  buySeller(): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    if (s.seller.on) return fail("the auto-seller is already on");
    if (s.cash < SELLER_COST) return fail("not enough cash");
    s.cash -= SELLER_COST;
    s.seller.on = true;
    this.events.push({ type: "sellerBought" });
    return OK;
  }

  buySellerSpeed(): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    if (!s.seller.on) return fail("buy the auto-seller first");
    const cost = sellerSpeedCost(s.seller.speedLevel);
    if (cost === null) return fail("max level for this run");
    if (s.cash < cost) return fail("not enough cash");
    s.cash -= cost;
    s.seller.speedLevel += 1;
    this.events.push({ type: "sellerUpgraded", level: s.seller.speedLevel });
    return OK;
  }

  setSellerThreshold(rarity: RarityId): ActionResult {
    this.state.seller.threshold = rarity;
    return OK;
  }

  /** The auto-seller takes cards left waiting (rework spec §1). */
  private tickSeller(): void {
    const s = this.state;
    const seller = s.seller;
    if (!seller.on || this.locked()) return;
    const b = s.bench;
    if (b.phase === "revealed" && s.held !== "bench" && s.time - s.revealedAt >= sellerHold(b.drop.rarity, seller.speedLevel))
      if (this.autoTake(b.drop, "bench")) s.bench = { phase: "empty" };
    const d = s.bot.card;
    if (d && s.held !== "bot" && s.time - s.bot.cardAt >= sellerHold(d.rarity, seller.speedLevel))
      if (this.autoTake(d, "bot")) s.bot.card = null;
  }

  /** Sell it (at or below the threshold) or set it aside in the tray; false when the tray is full. */
  private autoTake(d: Drop, from: CardSpot): boolean {
    const s = this.state;
    if (sellsAt(s.seller.threshold, d.rarity)) {
      const amount = this.payout(d, false);
      s.cash += amount;
      s.lifetimeEarnings += amount;
      this.events.push({ type: "sold", drop: d, amount, combo: s.combo, source: "seller", from });
      return true;
    }
    if (s.tray.length >= this.setup.trayCapacity) return false;
    s.tray.push(d);
    this.events.push({ type: "stored", drop: d, from });
    return true;
  }

  /** The bot's own reel (rework spec §1): finish a spin into its card, or start the next one. */
  private tickBot(dt: number): void {
    const s = this.state;
    const bot = s.bot;
    if (!bot.awake) return;
    if (bot.spin) {
      bot.spin.elapsed += dt;
      if (bot.spin.elapsed < bot.spin.duration) return;
      const d = bot.spin.drop;
      bot.spin = null;
      bot.card = d;
      bot.cardAt = s.time;
      this.onReveal(d, "bot");
      this.revealsThisTick++;
      this.events.push({ type: "botRevealed", drop: d });
      return;
    }
    if (bot.card || this.locked()) return;
    const caseId = botCaseFor(bot.caseChoice, s.unlocked, s.cash, (id) => this.casePrice(id));
    if (!caseId) return;
    s.cash -= this.casePrice(caseId);
    const drop = this.rollFor(caseId);
    const duration = botSpinSeconds(bot.speedLevel);
    bot.spin = { caseId, drop, elapsed: 0, duration };
    this.events.push({ type: "botSpinStarted", caseId, drop, duration });
  }

  private tickDayJob(dt: number): void {
    const s = this.state;
    if (s.dayJob === null) return;
    s.dayJob += dt;
    if (s.dayJob < DAY_JOB_SECONDS) return;
    s.dayJob = null;
    const amount = this.rng.next() < DAY_JOB_PAY_CHANCE ? DAY_JOB_PAY : 0;
    s.cash += amount;
    s.lifetimeEarnings += amount;
    this.events.push({ type: "dayJobDone", amount });
  }

  /** The charms that react to what was just revealed. */
  private onReveal(d: Drop, spot: CardSpot): void {
    const s = this.state;
    const charms = this.setup.charms;
    if (spot === "bench") s.revealedAt = s.time;
    if (s.held === spot) s.held = null;
    if (charms.includes("pityJar")) s.pity = d.rarity === "milspec" ? s.pity + 1 : isBigRarity(d.rarity) ? 0 : s.pity;
    if (charms.includes("ricochet") && d.rarity === "covert") s.freeCases.push(d.caseId);
    if (charms.includes("goldRush") && d.rarity === "gold") s.goldenHourUntil = s.time + GOLDEN_HOUR_SECONDS;
  }
}
