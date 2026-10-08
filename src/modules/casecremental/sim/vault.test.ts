import { describe, expect, it } from "vitest";
import { CASES } from "./content/cases";
import { STAGE_NAMES } from "./intensity";
import { DEFAULT_SETUP, Run } from "./run";
import { FINALE_SECONDS, VAULT_TROPHY } from "./tuning";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};
const allUnlocked = (run: Run) => {
  run.state.unlocked = CASES.map((c) => c.id);
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

  it("runs the finale, sells the tray into the earnings, and ends the run", () => {
    const run = new Run(1);
    allUnlocked(run);
    run.state.cash = 1e9;
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
    run.buyVault();
    expect(run.locked()).toBe(true);
    expect(run.buyCase("bootcamp")).toEqual({ ok: false, reason: "the vault is open" });
    tickFor(run, FINALE_SECONDS - 0.5);
    expect(run.state.over).toBe(false);
    const earned = run.state.lifetimeEarnings;
    tickFor(run, 1);
    expect(run.state.over).toBe(true);
    expect(run.state.tray).toHaveLength(0);
    expect(run.state.lifetimeEarnings).toBeGreaterThan(earned);
    const opened = run.drainEvents().filter((e) => e.type === "vaultOpened");
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ trophy: VAULT_TROPHY });
    const legendary = opened[0]!.type === "vaultOpened" ? opened[0]!.drop : null;
    expect(legendary?.rarity).toBe("gold"); // exactly one legendary drop, the trophy's showcase
    tickFor(run, 5);
    expect(run.drainEvents()).toHaveLength(0); // an ended run stays still
  });

  it("never drops a Ricochet case on the bench during the finale (review minor)", () => {
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

  it("holds the top stage through the whole finale, from any stage (final review)", () => {
    for (const from of [1, 2, 3, 4]) {
      const run = new Run(1);
      allUnlocked(run);
      run.state.cash = 1e9;
      run.state.stage = from;
      run.buyVault();
      expect(run.state.stage).toBe(STAGE_NAMES.length);
      expect(run.drainEvents()).toContainEqual({ type: "stageChanged", stage: STAGE_NAMES.length });
      tickFor(run, FINALE_SECONDS + 1);
      expect(run.state.stage).toBe(STAGE_NAMES.length);
      expect(run.drainEvents().filter((e) => e.type === "stageChanged")).toHaveLength(0);
    }
  });
});
