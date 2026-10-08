import { describe, expect, it } from "vitest";
import { CASES, unlockCostOf } from "../sim/content/cases";
import { completeVault, freshMeta } from "../sim/meta";
import { DEFAULT_SETUP, Run } from "../sim/run";
import { BOT_WAKE_COST, CLOUT_DIVISOR, DAY_JOB_SECONDS, START_CASH } from "../sim/tuning";
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
    expect(v.upgrades.map((u) => u.id)).toEqual(["luck", "appraiser", "quickHands"]);
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
  it("shows the bot asleep and wakeable", () => {
    const run = new Run(1);
    run.state.cash = BOT_WAKE_COST;
    const v = buildView(run);
    expect(v.bot).toMatchObject({ awake: false, canWake: true, wakeCost: BOT_WAKE_COST, speed: 1, step: null, waiting: false });
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

  it("makes the vault the goal once every case is unlocked, and shows the finale", () => {
    const run = new Run(1);
    run.state.unlocked = CASES.map((c) => c.id);
    run.state.cash = DEFAULT_SETUP.vaultPrice / 2;
    let v = buildView(run);
    expect(v.vault).toEqual({ shown: true, price: DEFAULT_SETUP.vaultPrice, canBuy: false });
    expect(v.nextGoal).toEqual({ kind: "vault", progress: 0.5 });
    run.state.cash = DEFAULT_SETUP.vaultPrice;
    run.buyVault();
    run.tick(5);
    v = buildView(run);
    expect(v.finale).toBeCloseTo(0.25);
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
});
