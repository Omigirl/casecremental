import { botSpeed, botSpeedCost, BOT_STEP_SECONDS, freshBot, revealHold, sellsAt, type BotState } from "./botSeller";
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
  START_CASH,
  TRAY_BASE_CAPACITY,
  VAULT_BASE_PRICE,
  VAULT_TROPHY,
} from "./tuning";
import type { Drop, RarityId } from "./types";
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

export type SaleSource = "bench" | "tray" | "bot";

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
  | { type: "sold"; drop: Drop; amount: number; combo: number; source: SaleSource }
  | { type: "caseUnlocked"; caseId: string }
  | { type: "upgradeBought"; id: UpgradeId; level: number }
  | { type: "stageChanged"; stage: number }
  | { type: "dayJobStarted" }
  | { type: "dayJobDone"; amount: number }
  | { type: "stored"; drop: Drop }
  | { type: "botWoke" }
  | { type: "botUpgraded"; level: number }
  | { type: "botPickedUp"; drop: Drop; dest: "bin" | "tray" }
  | { type: "botWaiting" }
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
  /** Drops the bot set aside for the player to claim (above its threshold). */
  tray: Drop[];
  bot: BotState;
  /** The player is dragging the revealed card: the bot leaves it alone (M2b spec §3). */
  held: boolean;
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
      held: false,
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

  insertKey(): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    const b = s.bench;
    if (b.phase !== "locked") return fail("no locked case on the bench");
    const c = caseById(b.caseId);
    const fx = this.effects();
    const opened = s.opened + 1;
    const luck = fx.luckLevel + this.setup.luckBonus + s.pity * PITY_LUCK_LEVELS;
    const drop = rollDrop(c, priceOf(c.id), luck, this.rng, s.nextDropId++, this.forcedRarity, {
      luckMult: s.time < s.goldenHourUntil ? GOLDEN_HOUR_LUCK : 1,
      statTrakChance: charmStatTrakChance(this.setup.charms),
      minRarity: charmMinRarity(this.setup.charms, opened),
    });
    this.forcedRarity = null;
    const topTier = Math.max(...s.unlocked.map((id) => caseById(id).tier));
    const tease = rollTease(drop.rarity, c.tier, topTier, fx.spinSeconds, this.rng, this.forcedFake);
    this.forcedFake = false;
    const fullDuration = fx.spinSeconds + (tease?.extraSeconds ?? 0);
    s.lastSellAt += fullDuration; // the spin (tease crawl included) never counts against the combo
    s.bench = { phase: "spinning", caseId: c.id, drop, elapsed: 0, fullDuration, tease };
    s.lastTier = c.tier;
    s.opened++;
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
    s.held = false;
    this.events.push({ type: "sold", drop: b.drop, amount, combo: s.combo, source: "bench" });
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
        this.onReveal(b.drop);
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

  /** The player picks the revealed card up (true) or lets go of it (false). */
  setHeld(held: boolean): ActionResult {
    this.state.held = held && this.state.bench.phase === "revealed";
    return OK;
  }

  setBotThreshold(rarity: RarityId): ActionResult {
    this.state.bot.threshold = rarity;
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
    this.events.push({ type: "sold", drop: d, amount, combo: s.combo, source: "tray" });
    return OK;
  }

  /** The bot's job loop (M2b spec §3). */
  private tickBot(dt: number): void {
    const s = this.state;
    const bot = s.bot;
    if (!bot.awake) return;
    const speed = botSpeed(bot.speedLevel);
    if (!bot.job) {
      const b = s.bench;
      if (b.phase === "revealed" && !s.held && s.time - s.revealedAt >= revealHold(b.drop.rarity, speed))
        bot.job = { step: "toBench", t: 0, drop: null, dest: null };
      return;
    }
    const job = bot.job;
    // the card is grabbed or gone before the bot has it: it turns back
    if ((job.step === "toBench" || job.step === "wait" || job.step === "pickUp") && (s.held || s.bench.phase !== "revealed")) {
      Object.assign(job, { step: "back", t: 0, dest: null });
      return;
    }
    if (job.step === "wait") {
      if (s.bench.phase !== "revealed") Object.assign(job, { step: "back", t: 0 });
      else if (s.tray.length < this.setup.trayCapacity) Object.assign(job, { step: "pickUp", t: 0 });
      return;
    }
    job.t += dt * speed;
    if (job.t < BOT_STEP_SECONDS[job.step]) return;
    job.t = 0;
    switch (job.step) {
      case "toBench": {
        const b = s.bench;
        if (b.phase !== "revealed") {
          job.step = "back";
          break;
        }
        job.dest = sellsAt(bot.threshold, b.drop.rarity) ? "bin" : "tray";
        if (job.dest === "tray" && s.tray.length >= this.setup.trayCapacity) {
          job.step = "wait";
          this.events.push({ type: "botWaiting" });
        } else job.step = "pickUp";
        break;
      }
      case "pickUp": {
        const b = s.bench;
        if (b.phase !== "revealed") {
          job.step = "back";
          break;
        }
        job.drop = b.drop;
        s.bench = { phase: "empty" };
        this.events.push({ type: "botPickedUp", drop: b.drop, dest: job.dest! });
        job.step = "carry";
        break;
      }
      case "carry":
        job.step = "drop";
        break;
      case "drop": {
        const d = job.drop!;
        if (job.dest === "bin") {
          const amount = this.payout(d, false);
          s.cash += amount;
          s.lifetimeEarnings += amount;
          this.events.push({ type: "sold", drop: d, amount, combo: s.combo, source: "bot" });
        } else {
          s.tray.push(d);
          this.events.push({ type: "stored", drop: d });
        }
        job.drop = null;
        job.step = "back";
        break;
      }
      case "back":
        bot.job = null;
        break;
    }
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
  private onReveal(d: Drop): void {
    const s = this.state;
    const charms = this.setup.charms;
    s.revealedAt = s.time;
    s.held = false;
    if (charms.includes("pityJar")) s.pity = d.rarity === "milspec" ? s.pity + 1 : isBigRarity(d.rarity) ? 0 : s.pity;
    if (charms.includes("ricochet") && d.rarity === "covert") s.freeCases.push(d.caseId);
    if (charms.includes("goldRush") && d.rarity === "gold") s.goldenHourUntil = s.time + GOLDEN_HOUR_SECONDS;
  }
}
