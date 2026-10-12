import * as autoSpin from "./autoSpin";
import { freshAutoSpin } from "./autoSpin";
import * as seller from "./autoSeller";
import { freshSeller } from "./autoSeller";
import * as bot from "./botOpener";
import { freshBot, type CardSpot } from "./botOpener";
import { runCaseIds } from "./campaign";
import {
  charmMinRarity,
  charmPriceMult,
  charmStatTrakChance,
  charmValueMult,
  isBigRarity,
  queueFreeCase,
  reactToReveal,
  setCollected,
} from "./charms";
import { CASES, caseById, priceOf, unlockCostOf } from "./content/cases";
import * as dayJob from "./dayJob";
import { intensityLevel, nextStage, updateHeat } from "./intensity";
import * as locker from "./locker";
import { freshLocker } from "./locker";
import { createRng, type Rng } from "./rng";
import { rollDrop } from "./roll";
import {
  DEFAULT_SETUP,
  fail,
  OK,
  type ActionResult,
  type BenchReel,
  type RevealSpot,
  type RunCtx,
  type RunSetup,
  type RunSnapshot,
  type RunState,
  type SimEvent,
} from "./runTypes";
import { rollTease } from "./tease";
import {
  COMBO_CAP,
  COMBO_HEAT_DECAY_SECONDS,
  COMBO_STEP,
  COMBO_WINDOW_SECONDS,
  FEVER_STAGE_BONUS,
  GOLDEN_HOUR_LUCK,
  GOLDEN_HOUR_SECONDS,
  PITY_LUCK_LEVELS,
} from "./tuning";
import type { Drop, RarityId } from "./types";
import { effectsOf, upgradeCost, type Effects, type UpgradeId } from "./upgrades";
import * as vault from "./vault";

export type { CardSpot } from "./botOpener";
export * from "./runTypes";

// One run of the game: cash, the bench (where a case is bought → keyed → spun → revealed → sold),
// upgrades, combo and intensity. Pure and deterministic from its seed; the renderer and the UI read
// `state` and consume `drainEvents()`. The bot, auto-seller, locker, auto-spin, vault and day job are functions over this
// run as a `RunCtx` (their own files); the bench, upgrades and the tick order live here.

export class Run implements RunCtx {
  readonly state: RunState;
  readonly seed: number;
  readonly setup: RunSetup;
  readonly rng: Rng;
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
      upgrades: { luck: 0, appraiser: 0, quickHands: 0, multiOpen: 0 },
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
      seen: {},
      tray: [],
      bot: freshBot(this.setup.botAwake),
      seller: freshSeller(),
      locker: freshLocker(),
      autoSpin: freshAutoSpin(),
      held: null,
      heldSlot: 0,
      vault: null,
      over: false,
    };
  }

  static fromSnapshot(snap: RunSnapshot): Run {
    return new Run(snap.seed, snap.setup, snap);
  }

  snapshot(): RunSnapshot {
    return { seed: this.seed, rng: this.rng.state(), setup: structuredClone(this.setup), state: structuredClone(this.state) };
  }

  emit(e: SimEvent): void {
    this.events.push(e);
  }

  /** Adds to cash and to lifetime earnings. */
  earn(amount: number): void {
    this.state.cash += amount;
    this.state.lifetimeEarnings += amount;
  }

  /** Reveals this tick, for heat. */
  countReveals(n: number): void {
    this.revealsThisTick += n;
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
    const s = this.state;
    const charms = charmValueMult(this.setup.charms, d, {
      lockerCount: s.locker.items.length,
      collected: (id) => setCollected(s.seen, id),
    });
    return d.value * this.effects().sellMult * charms * this.setup.valueBoost * combo;
  }

  bumpCombo(): void {
    const s = this.state;
    s.combo = s.time - s.lastSellAt <= COMBO_WINDOW_SECONDS ? s.combo + 1 : 1;
    s.lastSellAt = s.time;
  }

  /** How many cases one BUY opens: the Multi-open level, but only as many as you can afford (never 0 - the
   *  shelf only offers BUY at one price). Multi-open never applies to the vault. */
  openCount(caseId: string): number {
    const price = this.casePrice(caseId);
    return Math.max(1, Math.min(this.effects().openCount, Math.floor(this.state.cash / price)));
  }

  /** The case ids on this run's shelf, cheapest first. */
  runCases(): string[] {
    return runCaseIds(this.setup.run);
  }

  buyCase(caseId: string): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    if (!this.runCases().includes(caseId)) return fail("not in this run");
    if (s.bench.phase !== "empty") return fail("bench is busy");
    if (!s.unlocked.includes(caseId)) return fail(`case ${caseId} is locked`);
    if (s.cash < this.casePrice(caseId)) return fail("not enough cash");
    this.placeCase(caseId);
    Object.assign(s.autoSpin, { pick: caseId, clock: 0 }); // auto-spin buys the case you bought last; its key waits a beat
    return OK;
  }

  /** Pays for one multi-open BUY, locking it on the empty bench (callers check first); returns the count. */
  placeCase(caseId: string): number {
    const count = this.openCount(caseId);
    this.state.cash -= this.casePrice(caseId) * count;
    this.state.bench = { phase: "locked", caseId, free: false, count };
    this.emit({ type: "caseBought", caseId, free: false, count });
    return count;
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

  /** Roll one case's drop with Luck, Pity, the Golden Hour and the charms; counts the open.
   *  `forced` is the dev board's rarity, which only your bench's open passes in. */
  rollFor(caseId: string, forced: RarityId | null = null): Drop {
    const s = this.state;
    const c = caseById(caseId);
    s.opened++;
    const luck = this.effects().luckLevel + this.setup.luckBonus + s.pity * PITY_LUCK_LEVELS;
    const drop = rollDrop(c, priceOf(c.id), luck, this.rng, s.nextDropId++, forced, {
      luckMult: s.time < s.goldenHourUntil ? GOLDEN_HOUR_LUCK : 1,
      statTrakChance: charmStatTrakChance(this.setup.charms),
      minRarity: charmMinRarity(this.setup.charms, s.opened),
    });
    return drop;
  }

  insertKey(): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    const b = s.bench;
    if (b.phase !== "locked") return fail("no locked case on the bench");
    const c = caseById(b.caseId);
    const fx = this.effects();
    const topTier = Math.max(...s.unlocked.map((id) => caseById(id).tier));
    const reels: BenchReel[] = [];
    const forced = this.forcedRarity; // the dev board's rarity is for your bench's next open alone
    this.forcedRarity = null;
    for (let i = 0; i < b.count; i++) {
      const drop = this.rollFor(c.id, i === 0 ? forced : null);
      const tease = rollTease(drop.rarity, c.tier, topTier, fx.spinSeconds, this.rng, this.forcedFake);
      this.forcedFake = false;
      reels.push({ drop, tease, duration: fx.spinSeconds + (tease?.extraSeconds ?? 0) });
    }
    const fullDuration = Math.max(...reels.map((r) => r.duration));
    s.lastSellAt += fullDuration; // the spin (tease crawls included) never counts against the combo
    s.bench = { phase: "spinning", caseId: c.id, reels, elapsed: 0, fullDuration };
    s.lastTier = c.tier;
    this.emit({ type: "spinStarted", caseId: c.id, reels, fullDuration });
    return OK;
  }

  /** Nobody holds a card any more. */
  release(): void {
    this.state.held = null;
    this.state.heldSlot = 0;
  }

  /** A bench card leaves (sold or taken); the bench empties with the last one. */
  takeBenchCard(slot: number): void {
    const s = this.state;
    const b = s.bench;
    if (b.phase !== "revealed") return;
    b.cards[slot] = null;
    if (s.held === "bench" && s.heldSlot === slot) this.release();
    if (b.cards.every((d) => d === null)) s.bench = { phase: "empty" };
  }

  sell(slot = 0): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    const b = s.bench;
    if (b.phase !== "revealed") return fail("nothing to sell");
    const d = b.cards[slot];
    if (!d) return fail("nothing in that spot");
    this.bumpCombo();
    const amount = this.payout(d, true);
    this.earn(amount);
    this.takeBenchCard(slot);
    this.emit({ type: "sold", drop: d, amount, combo: s.combo, source: "bench", from: "bench", slot });
    return OK;
  }

  unlockCase(caseId: string): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    const index = CASES.findIndex((c) => c.id === caseId);
    if (index < 0) return fail(`unknown case: ${caseId}`);
    if (!this.runCases().includes(caseId)) return fail("not in this run");
    if (s.unlocked.includes(caseId)) return fail("already unlocked");
    if (!s.unlocked.includes(CASES[index - 1]!.id)) return fail("unlock the previous case first");
    const cost = unlockCostOf(caseId);
    if (s.cash < cost) return fail("not enough cash");
    s.cash -= cost;
    s.unlocked.push(caseId);
    this.emit({ type: "caseUnlocked", caseId });
    return OK;
  }

  buyUpgrade(id: UpgradeId): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    const cost = upgradeCost(id, s.upgrades[id], this.setup.run);
    if (cost === null) return fail("max level");
    if (s.cash < cost) return fail("not enough cash");
    s.cash -= cost;
    s.upgrades[id] += 1;
    this.emit({ type: "upgradeBought", id, level: s.upgrades[id] });
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
        const drops = b.reels.map((r) => r.drop);
        s.bench = { phase: "revealed", caseId: b.caseId, cards: [...drops] };
        for (const d of drops) this.onReveal(d, "bench");
        this.countReveals(drops.length);
        this.emit({ type: "revealed", drops });
      }
    }

    if (s.bench.phase === "empty" && s.freeCases.length > 0 && !this.locked()) {
      const caseId = s.freeCases.shift()!;
      s.bench = { phase: "locked", caseId, free: true, count: 1 };
      s.autoSpin.clock = 0; // a Ricochet case takes the bench once clear; auto-spin's key waits a beat for it
      this.emit({ type: "caseBought", caseId, free: true, count: 1 });
    }

    if (s.combo > 0 && s.time - s.lastSellAt > COMBO_WINDOW_SECONDS) s.combo = 0;
    s.comboHeat = s.combo >= s.comboHeat ? s.combo : s.comboHeat * Math.exp(-dt / COMBO_HEAT_DECAY_SECONDS);

    bot.tickBot(this, dt);
    seller.tickSeller(this);
    locker.tickLocker(this, dt);
    autoSpin.tickAutoSpin(this, dt);
    dayJob.tickDayJob(this, dt);
    vault.tickVault(this, dt);

    s.heat = updateHeat(s.heat, this.revealsThisTick, dt);
    this.revealsThisTick = 0;
    // Fever shows one stage higher; the hysteresis runs on the stage underneath
    const bonus = this.setup.charms.includes("fever") ? FEVER_STAGE_BONUS : 0;
    const stage = this.locked() ? s.stage : Math.min(5, nextStage(s.stage - bonus, this.intensity()) + bonus);
    if (stage !== s.stage) {
      s.stage = stage;
      this.emit({ type: "stageChanged", stage });
    }
  }

  /** Broke with an empty bench and not already working (campaign spec §6.1). */
  dayJobAvailable(): boolean {
    return dayJob.dayJobAvailable(this, this.cheapestPrice());
  }

  startDayJob(): ActionResult {
    return dayJob.startDayJob(this, this.cheapestPrice());
  }

  /** The vault is out (waiting for its key, or opening) or the run has ended: nothing else can be done. */
  locked(): boolean {
    return this.state.vault !== null || this.state.over;
  }

  vaultShown(): boolean {
    return vault.vaultShown(this);
  }

  buyVault(): ActionResult {
    return vault.buyVault(this);
  }

  /** The player turns the devil key: five drops are rolled and the opening timeline starts. */
  turnVaultKey(): ActionResult {
    return vault.turnVaultKey(this);
  }

  wakeBot(): ActionResult {
    return bot.wakeBot(this);
  }

  buyBotSpeed(): ActionResult {
    return bot.buyBotSpeed(this);
  }

  /** The case the bot opens (null = the dearest you can afford). */
  setBotCase(caseId: string | null): ActionResult {
    return bot.setBotCase(this, caseId);
  }

  /** Run 2: the bot opens two cases per spin. */
  buyBotMulti(): ActionResult {
    return bot.buyBotMulti(this);
  }

  /** Sell one of the bot's cards by hand (feeds the combo). */
  sellBotCard(slot = 0): ActionResult {
    return bot.sellBotCard(this, slot);
  }

  buySeller(): ActionResult {
    return seller.buySeller(this);
  }

  buySellerSpeed(): ActionResult {
    return seller.buySellerSpeed(this);
  }

  setSellerThreshold(rarity: RarityId): ActionResult {
    return seller.setSellerThreshold(this, rarity);
  }

  /** The player picks a waiting card up (bench, bot or locker) or lets go (null): machines leave a held card alone. */
  setHeld(spot: CardSpot | null, slot = 0): ActionResult {
    const s = this.state;
    const b = s.bench;
    const waiting =
      spot === "bench"
        ? b.phase === "revealed" && !!b.cards[slot]
        : spot === "bot"
          ? !!s.bot.cards[slot]
          : spot === "locker"
            ? !!s.locker.cards[slot]
            : true;
    s.held = waiting ? spot : null;
    s.heldSlot = waiting && spot !== null ? slot : 0;
    return OK;
  }

  buyLocker(): ActionResult {
    return locker.buyLocker(this);
  }

  buyLockerSize(): ActionResult {
    return locker.buyLockerSize(this);
  }

  /** The rarity the auto-seller sends to the locker (null = off). */
  setCollect(rarity: RarityId | null): ActionResult {
    return locker.setCollect(this, rarity);
  }

  /** Drag a waiting card or a tray item into the locker by hand (feeds the combo). */
  storeCard(from: CardSpot | "tray", slot: number): ActionResult {
    return locker.storeCard(this, from, slot);
  }

  /** Press the oldest ten of the lowest ready rarity into one of the next. */
  tradeUp(): ActionResult {
    return locker.tradeUp(this);
  }

  /** Sell a contract result waiting on the locker by hand (feeds the combo). */
  sellLockerCard(slot?: number): ActionResult {
    return locker.sellLockerCard(this, slot);
  }

  /** Run 3: the locker presses on its own. */
  buyAutoContract(): ActionResult {
    return locker.buyAutoContract(this);
  }

  /** Auto-spin (needs the auto-seller); it keeps its switch for the run. */
  buyAutoSpin(): ActionResult {
    return autoSpin.buyAutoSpin(this);
  }

  buyAutoSpinDelay(): ActionResult {
    return autoSpin.buyAutoSpinDelay(this);
  }

  setAutoSpin(on: boolean): ActionResult {
    return autoSpin.setAutoSpin(this, on);
  }

  setAutoSpinCase(caseId: string): ActionResult {
    return autoSpin.setAutoSpinCase(this, caseId);
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
    this.earn(amount);
    this.emit({ type: "sold", drop: d, amount, combo: s.combo, source: "tray", from: null, slot: 0 });
    return OK;
  }

  /** The charms that react to what was just revealed. */
  onReveal(d: Drop, spot: RevealSpot): void {
    const s = this.state;
    const charms = this.setup.charms;
    if (spot === "bench") s.revealedAt = s.time;
    if (s.held === spot) this.release();
    if (charms.includes("pityJar")) s.pity = d.rarity === "milspec" ? s.pity + 1 : isBigRarity(d.rarity) ? 0 : s.pity;
    if (charms.includes("ricochet") && d.rarity === "covert") queueFreeCase(s, d.caseId);
    if (charms.includes("goldRush") && d.rarity === "gold") s.goldenHourUntil = s.time + GOLDEN_HOUR_SECONDS;
    reactToReveal(this, d, spot);
  }
}
