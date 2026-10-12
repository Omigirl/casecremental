import { AUTOSPIN_DELAY_LEVELS } from "../sim/autoSpin";
import { botWaiting } from "../sim/botOpener";
import { describe, expect, it } from "vitest";
import { CASES, unlockCostOf } from "../sim/content/cases";
import { completeVault, freshMeta } from "../sim/meta";
import { DEFAULT_SETUP, Run } from "../sim/run";
import {
  AUTOSPIN_COST,
  AUTOSPIN_DELAY_COSTS,
  AUTOSPIN_DELAYS,
  BOT_WAKE_COST,
  CLOUT_DIVISOR,
  DAY_JOB_SECONDS,
  LOCKER_BASE_CAPACITY,
  LOCKER_COST,
  SELLER_COST,
  START_CASH,
  VAULT_OPENING_SECONDS,
} from "../sim/tuning";
import { buildView } from "./view";

describe("buildView", () => {
  it("shows a fresh run", () => {
    const v = buildView(new Run(1));
    expect(v.cash).toBe(START_CASH);
    expect(v.phase).toBe("empty");
    expect(v.stageName).toBe("Sober");
    expect(v.cases.map((c) => [c.id, c.unlocked, c.canBuy])).toEqual([
      ["bootcamp", true, true],
      ["wildwood", false, false],
      ["bedrock", false, false],
    ]);
    expect(v.upgrades.map((u) => u.id)).toEqual(["luck", "appraiser", "quickHands", "multiOpen"]);
    expect(v.nextGoal).toEqual({
      kind: "unlock",
      caseId: "wildwood",
      progress: START_CASH / unlockCostOf("wildwood"),
    });
  });

  it("can't buy while the bench is busy", () => {
    const run = new Run(1);
    run.buyCase("bootcamp");
    expect(buildView(run).cases[0]!.canBuy).toBe(false);
  });

  it("only offers the next case in the ladder to unlock", () => {
    const run = new Run(1);
    run.state.cash = 100_000;
    const v = buildView(run);
    expect(v.cases[1]!.canUnlock).toBe(true);
    expect(v.cases[2]!.canUnlock).toBe(false);
    expect(v.nextGoal!.progress).toBe(1);
  });

  it("makes the vault the goal once every case is unlocked (M2b; was the cheapest upgrade)", () => {
    const run = new Run(1);
    run.state.cash = 1e12;
    run.unlockCase("wildwood");
    run.unlockCase("bedrock");
    run.state.cash = 4;
    expect(buildView(run).nextGoal).toEqual({ kind: "vault", progress: 4 / DEFAULT_SETUP.vaultPrice });
  });

  it("keeps the vault as the goal when everything is maxed; maxed upgrades can't be bought", () => {
    const run = new Run(1);
    run.state.cash = 1e15;
    run.unlockCase("wildwood");
    run.unlockCase("bedrock");
    for (const id of ["luck", "appraiser", "quickHands"] as const) while (run.buyUpgrade(id).ok) {}
    const v = buildView(run);
    expect(v.nextGoal?.kind).toBe("vault");
    const qh = v.upgrades.find((u) => u.id === "quickHands")!;
    expect(qh.cost).toBeNull();
    expect(qh.canBuy).toBe(false);
  });
});

describe("buildView — M2b", () => {
  it("says which bench cards wait and which card is held (F3: the tutorial points at them)", () => {
    const run = new Run(1);
    expect(buildView(run)).toMatchObject({ held: null, benchCards: [] });
    run.buyCase("bootcamp");
    run.insertKey();
    for (let i = 0; i < 600 && run.state.bench.phase === "spinning"; i++) run.tick(1 / 30);
    expect(buildView(run).benchCards).toEqual([true]);
    run.setHeld("bench", 0);
    expect(buildView(run).held).toBe("bench");
    run.sell(0);
    expect(buildView(run)).toMatchObject({ held: null, benchCards: [] });
  });

  it("shows the bot asleep and wakeable, then spinning and its card", () => {
    const run = new Run(1);
    run.state.cash = BOT_WAKE_COST;
    let v = buildView(run);
    expect(v.bot).toMatchObject({
      awake: false,
      canWake: true,
      wakeCost: BOT_WAKE_COST,
      speed: 1,
      spinning: false,
      cards: [],
      caseChoice: null,
    });
    run.state.cash = 1e6;
    run.wakeBot();
    for (let i = 0; i < 40; i++) run.tick(1 / 30); // the bot rests a moment after waking
    expect(buildView(run).bot.spinning).toBe(true);
    for (let i = 0; i < 900 && !botWaiting(run.state.bot); i++) run.tick(1 / 30);
    v = buildView(run);
    expect(v.bot.cards[0]).toMatchObject({ skinId: run.state.bot.cards[0]!.skinId });
  });

  it("shows the auto-seller to buy, then its speed and threshold", () => {
    const run = new Run(1);
    run.state.cash = SELLER_COST;
    let v = buildView(run);
    expect(v.seller).toMatchObject({ on: false, cost: SELLER_COST, canBuy: true });
    run.buySeller();
    run.state.cash = 1e6;
    v = buildView(run);
    expect(v.seller).toMatchObject({ on: true, canBuy: false, speedLevel: 0, canBuySpeed: true, threshold: "classified" });
  });

  it("shows the locker from Run 2: to buy, then what a press would take, the press, and its result", () => {
    expect(buildView(new Run(1)).locker).toMatchObject({ available: false, canBuy: false, autoAvailable: false });
    const run = new Run(1, { ...DEFAULT_SETUP, run: 2, startCash: 1e9 });
    let v = buildView(run);
    expect(v.locker).toMatchObject({ available: true, on: false, cost: LOCKER_COST, canBuy: true, autoAvailable: false });
    run.buyLocker();
    for (let i = 0; i < 10; i++) run.state.locker.items.push(run.rollFor("bootcamp", "milspec"));
    v = buildView(run);
    expect(v.locker).toMatchObject({
      on: true,
      canBuy: false,
      count: 10,
      capacity: LOCKER_BASE_CAPACITY,
      tradeUp: "milspec",
      canTradeUp: true,
    });
    expect(v.locker.counts.milspec).toBe(10);
    run.tradeUp();
    run.tick(1);
    v = buildView(run);
    expect(v.locker).toMatchObject({ pressing: true, tradeUp: null, canTradeUp: false, count: 0 });
    expect(v.locker.pressProgress).toBeCloseTo(0.4, 5);
    run.tick(2);
    expect(buildView(run).locker.cards).toEqual([expect.objectContaining({ rarity: "restricted" })]);
  });

  it("shows the tray and the day job", () => {
    const run = new Run(1, { ...DEFAULT_SETUP, trayCapacity: 12 });
    run.state.tray.push({
      id: 1,
      caseId: "bootcamp",
      skinId: "bc_woodland",
      rarity: "covert",
      float: 0.2,
      wear: "FT",
      statTrak: false,
      value: 40,
    });
    run.state.cash = 0;
    let v = buildView(run);
    expect(v.tray.capacity).toBe(12);
    expect(v.tray.items[0]).toMatchObject({ skinId: "bc_woodland", rarity: "covert" });
    expect(v.dayJob).toEqual({ available: true, working: false, progress: 0 });
    run.startDayJob();
    run.tick(DAY_JOB_SECONDS / 2);
    v = buildView(run);
    expect(v.dayJob.working).toBe(true);
    expect(v.dayJob.progress).toBeCloseTo(0.5, 1);
  });

  it("makes the vault the goal once every case is unlocked, and shows the key and the opening", () => {
    const run = new Run(1);
    run.state.unlocked = CASES.map((c) => c.id);
    run.state.cash = DEFAULT_SETUP.vaultPrice / 2;
    let v = buildView(run);
    expect(v.vault).toEqual({
      id: "vault1",
      shown: true,
      price: DEFAULT_SETUP.vaultPrice,
      canBuy: false,
      blockedBy: null,
      phase: null,
      progress: 0,
    });
    expect(v.nextGoal).toEqual({ kind: "vault", progress: 0.5 });
    run.state.cash = DEFAULT_SETUP.vaultPrice;
    run.buyVault();
    expect(buildView(run).vault.phase).toBe("key");
    run.turnVaultKey();
    run.tick(VAULT_OPENING_SECONDS / 4);
    expect(buildView(run).vault.progress).toBeCloseTo(0.25, 1);
  });

  it("says why the vault is blocked when it is affordable but the bench is busy", () => {
    const run = new Run(1);
    run.state.unlocked = CASES.map((c) => c.id);
    run.state.cash = DEFAULT_SETUP.vaultPrice + 100;
    expect(buildView(run).vault).toMatchObject({ canBuy: true, blockedBy: null });
    run.buyCase("bootcamp");
    expect(buildView(run).vault).toMatchObject({ canBuy: false, blockedBy: "bench" });
    run.state.cash = 10; // not affordable: no reason to show
    expect(buildView(run).vault.blockedBy).toBeNull();
  });

  it("shows the prestige screen once the run is over", () => {
    const run = new Run(1);
    run.state.over = true;
    const meta = freshMeta();
    completeVault(meta, (10 * CLOUT_DIVISOR) ** 2, "vault1", 1); // 10 CLOUT
    const v = buildView(run, meta);
    expect(v.over).toBe(true);
    expect(v.prestige).toMatchObject({ clout: 10, gained: 10, loops: 1, slots: 1, picked: [] });
    expect(v.prestige!.offer).toHaveLength(3);
    expect(v.prestige!.perks.map((p) => p.id)).toEqual(["startCash", "luck", "charmSlot", "botAwake", "biggerTray"]);
    expect(buildView(new Run(1)).prestige).toBeNull();
  });

  it("turns every buy button off while the vault is open and after the run (review minor)", () => {
    const run = new Run(1);
    run.state.unlocked = CASES.map((c) => c.id);
    run.state.cash = DEFAULT_SETUP.vaultPrice + 1e6;
    run.buyVault();
    const v = buildView(run);
    expect(v.cases.some((c) => c.canBuy || c.canUnlock)).toBe(false);
    expect(v.upgrades.some((u) => u.canBuy)).toBe(false);
    expect(v.vault.canBuy).toBe(false);
  });

  it("shows how many cases a BUY opens", () => {
    const run = new Run(3);
    run.state.upgrades.multiOpen = 1;
    run.state.cash = 1000;
    expect(buildView(run).cases[0]!.count).toBe(2);
    run.state.cash = run.casePrice("bootcamp");
    expect(buildView(run).cases[0]!.count).toBe(1);
  });

  it("shows auto-spin on the Machines tab from Run 1: it needs the auto-seller, then its switch, status, delay and pick", () => {
    const run = new Run(1);
    run.state.cash = 1e6;
    expect(buildView(run).autoSpin).toMatchObject({ owned: false, needsSeller: true, canBuy: false, cost: AUTOSPIN_COST });
    run.buySeller();
    expect(buildView(run).autoSpin).toMatchObject({ needsSeller: false, canBuy: true });
    run.buyAutoSpin();
    expect(buildView(run).autoSpin).toMatchObject({
      owned: true,
      canBuy: false,
      on: false,
      canToggle: true,
      status: "off",
      delay: AUTOSPIN_DELAYS[0],
      delayLevel: 0,
      maxLevel: AUTOSPIN_DELAY_LEVELS,
      delayCost: AUTOSPIN_DELAY_COSTS.baseCost,
      canBuyDelay: true,
      pick: null,
    });
    run.setAutoSpinCase("bootcamp");
    expect(buildView(run).cases.some((c) => c.buys)).toBe(false); // OFF: nothing is about to be bought, so nothing is framed as such
    run.setAutoSpin(true);
    const v = buildView(run);
    expect(v.autoSpin).toMatchObject({ on: true, status: "on", pick: "bootcamp" });
    expect(v.cases.find((c) => c.id === "bootcamp")!.picked).toBe(true);
    expect(v.cases.filter((c) => c.buys).map((c) => c.id)).toEqual(["bootcamp"]); // the case it would buy now
    run.state.cash = 0;
    expect(buildView(run).cases.some((c) => c.buys)).toBe(false); // nothing affordable: nothing to frame
    expect(buildView(run).autoSpin.status).toBe("broke");
    run.state.vault = { phase: "key" };
    expect(buildView(run).autoSpin.canToggle).toBe(false);
  });
});
