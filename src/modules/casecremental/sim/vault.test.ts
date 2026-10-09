import { describe, expect, it } from "vitest";
import { CASES, VAULT_LEGEND } from "./content/cases";
import { STAGE_NAMES } from "./intensity";
import { DEFAULT_SETUP, Run } from "./run";
import { VAULT_LAND_TIMES, VAULT_OPENING_SECONDS, VAULT_REEL_RARITIES, VAULT_REEL_SHARES, VAULT_TROPHY } from "./tuning";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};
const allUnlocked = (run: Run) => {
  run.state.unlocked = CASES.map((c) => c.id);
};
const openVault = (run: Run) => {
  allUnlocked(run);
  run.state.cash = 1e9;
  expect(run.buyVault().ok).toBe(true);
};

describe("Vault Case I", () => {
  it("shows once every case is unlocked, and costs the setup's vault price", () => {
    const run = new Run(1);
    run.state.cash = 1e9;
    expect(run.vaultShown()).toBe(false);
    expect(run.buyVault()).toEqual({ ok: false, reason: "unlock every case first" });
    allUnlocked(run);
    expect(run.vaultShown()).toBe(true);
    const cash = run.state.cash;
    expect(run.buyVault().ok).toBe(true);
    expect(cash - run.state.cash).toBe(DEFAULT_SETUP.vaultPrice);
    expect(run.drainEvents().map((e) => e.type)).toContain("vaultBought");
  });

  it("needs a clear bench and the cash", () => {
    const run = new Run(1);
    allUnlocked(run);
    run.state.cash = 10;
    expect(run.buyVault()).toEqual({ ok: false, reason: "not enough cash" });
    run.state.cash = 1e9;
    run.buyCase("bootcamp");
    expect(run.buyVault()).toEqual({ ok: false, reason: "bench is busy" });
  });

  it("waits for the key: nothing else can be done, and nothing happens on its own", () => {
    const run = new Run(1);
    openVault(run);
    expect(run.state.vault).toEqual({ phase: "key" });
    expect(run.locked()).toBe(true);
    expect(run.buyCase("bootcamp")).toEqual({ ok: false, reason: "the vault is open" });
    tickFor(run, 60);
    expect(run.state.vault).toEqual({ phase: "key" });
    expect(run.state.over).toBe(false);
  });

  it("turns the key once, rolls five drops rarer each time ending on the legendary, and lands them on time (Review Focus 3)", () => {
    const run = new Run(1);
    openVault(run);
    expect(run.turnVaultKey().ok).toBe(true);
    expect(run.turnVaultKey()).toEqual({ ok: false, reason: "the key has turned" });
    const v = run.state.vault;
    if (v?.phase !== "opening") throw new Error("expected opening");
    expect(v.drops.map((d) => d.rarity)).toEqual([...VAULT_REEL_RARITIES]);
    expect(v.drops[4]!.skinId).toBe(VAULT_LEGEND.id);
    expect(run.drainEvents().map((e) => e.type)).toContain("vaultKeyTurned");
    const landed: number[] = [];
    for (let t = 0; t < VAULT_OPENING_SECONDS + 1; t += DT) {
      run.tick(DT);
      for (const e of run.drainEvents()) if (e.type === "vaultReelLanded") landed.push(run.state.time);
    }
    expect(landed).toHaveLength(5);
    landed.forEach((at, i) => expect(at - landed[0]!).toBeCloseTo(VAULT_LAND_TIMES[i]! - VAULT_LAND_TIMES[0]!, 1));
  });

  it("pays each reel its share once, sells the tray, ends the run on the legendary trophy (Review Focus 2)", () => {
    const run = new Run(1);
    run.state.tray.push({
      id: 99,
      caseId: "bootcamp",
      skinId: "bc_woodland",
      rarity: "covert",
      float: 0.2,
      wear: "FT",
      statTrak: false,
      value: 50,
    });
    openVault(run);
    const earned = run.state.lifetimeEarnings;
    run.turnVaultKey();
    tickFor(run, VAULT_LAND_TIMES[2]! + 0.1);
    // a reload in the middle: the landings so far are paid, the rest still to come
    const b = Run.fromSnapshot(JSON.parse(JSON.stringify(run.snapshot())));
    tickFor(b, VAULT_OPENING_SECONDS);
    const price = DEFAULT_SETUP.vaultPrice;
    const reels = VAULT_REEL_SHARES.reduce((a, s) => a + s * price, 0);
    expect(b.state.lifetimeEarnings - earned).toBeCloseTo(reels + b.payout(run.state.tray[0]!, false), 0);
    expect(b.state.over).toBe(true);
    expect(b.state.tray).toHaveLength(0);
    const opened = b.drainEvents().filter((e) => e.type === "vaultOpened");
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ trophy: VAULT_TROPHY, drop: { skinId: VAULT_LEGEND.id } });
  });

  it("cashes in the bot's card and its spin when the vault is bought, then freezes the bot", () => {
    const run = new Run(1, { ...DEFAULT_SETUP, botAwake: true });
    allUnlocked(run);
    run.state.cash = 1e9;
    for (let i = 0; i < 900 && !run.state.bot.card; i++) run.tick(DT);
    const card = run.state.bot.card!;
    const earned = run.state.lifetimeEarnings;
    expect(run.buyVault().ok).toBe(true);
    expect(run.state.bot.card).toBeNull();
    expect(run.state.bot.spin).toBeNull();
    expect(run.state.lifetimeEarnings - earned).toBeCloseTo(run.payout(card, false));
    tickFor(run, 10);
    expect(run.state.bot.spin).toBeNull(); // frozen
  });

  it("clears a running day job when the vault is bought", () => {
    const run = new Run(1);
    allUnlocked(run);
    run.state.cash = 0;
    expect(run.startDayJob().ok).toBe(true);
    run.state.cash = 1e9;
    expect(run.buyVault().ok).toBe(true);
    expect(run.state.dayJob).toBeNull();
    run.drainEvents();
    tickFor(run, 5);
    expect(run.drainEvents().map((e) => e.type)).not.toContain("dayJobDone");
  });

  it("never drops a Ricochet case on the bench while the vault is out (review minor)", () => {
    const run = new Run(1, { ...DEFAULT_SETUP, charms: ["ricochet"] });
    allUnlocked(run);
    run.state.cash = 1e9;
    run.forceNextRarity("covert");
    run.buyCase("bootcamp");
    run.insertKey();
    for (let i = 0; i < 900 && run.state.bench.phase !== "revealed"; i++) run.tick(DT);
    expect(run.sell().ok).toBe(true);
    expect(run.state.freeCases).toEqual(["bootcamp"]); // queued, not yet on the bench
    expect(run.buyVault().ok).toBe(true);
    tickFor(run, 1);
    expect(run.state.bench.phase).toBe("empty");
  });

  it("holds the top stage from the purchase to the end", () => {
    const run = new Run(1);
    run.state.stage = 2;
    openVault(run);
    expect(run.state.stage).toBe(STAGE_NAMES.length);
    run.turnVaultKey();
    tickFor(run, VAULT_OPENING_SECONDS + 1);
    expect(run.state.stage).toBe(STAGE_NAMES.length);
  });
});
