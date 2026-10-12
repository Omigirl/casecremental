import { describe, expect, it } from "vitest";
import { AUTOSPIN_DELAY_LEVELS, autoSpinDelay, autoSpinDelayCost, autoSpinStatus } from "./autoSpin";
import { priceOf } from "./content/cases";
import { DEFAULT_SETUP, Run, type RunSetup, type SimEvent } from "./run";
import { AUTOSPIN_COST, AUTOSPIN_DELAY_COSTS, AUTOSPIN_DELAYS, AUTOSPIN_KEY_SECONDS, SELLER_COST } from "./tuning";

const DT = 1 / 30;
const tickFor = (r: Run, s: number) => {
  for (let i = 0; i < Math.round(s / DT); i++) r.tick(DT);
};
const types = (es: SimEvent[]) => es.map((e) => e.type);
/** A run with the auto-seller and auto-spin bought and switched on, its events drained. */
function spinning(over: Partial<RunSetup> = {}, cash = 1e6): Run {
  const r = new Run(1, { ...DEFAULT_SETUP, ...over });
  r.state.cash = cash;
  expect(r.buySeller().ok).toBe(true);
  expect(r.buyAutoSpin().ok).toBe(true);
  expect(r.setAutoSpin(true).ok).toBe(true);
  r.drainEvents();
  return r;
}

describe("buying auto-spin", () => {
  it("needs the auto-seller, costs AUTOSPIN_COST once, and arrives switched off", () => {
    const r = new Run(1);
    r.state.cash = SELLER_COST + AUTOSPIN_COST;
    expect(r.buyAutoSpin()).toEqual({ ok: false, reason: "buy the auto-seller first" });
    r.buySeller();
    expect(r.buyAutoSpin()).toEqual({ ok: true });
    expect(r.state.cash).toBe(0);
    expect(r.state.autoSpin).toMatchObject({ owned: true, on: false, delayLevel: 0, powered: false });
    expect(types(r.drainEvents())).toContain("autoSpinBought");
    r.state.cash = 1e9;
    expect(r.buyAutoSpin()).toEqual({ ok: false, reason: "auto-spin is already bought" });
    const poor = new Run(1);
    poor.state.cash = SELLER_COST;
    poor.buySeller();
    expect(poor.buyAutoSpin()).toEqual({ ok: false, reason: "not enough cash" });
  });

  it("prices five Delay levels from AUTOSPIN_DELAY_COSTS, down to the last delay", () => {
    expect(AUTOSPIN_DELAY_LEVELS).toBe(5);
    expect(autoSpinDelayCost(0)).toBe(AUTOSPIN_DELAY_COSTS.baseCost);
    expect(autoSpinDelayCost(1)).toBe(Math.ceil(AUTOSPIN_DELAY_COSTS.baseCost * AUTOSPIN_DELAY_COSTS.growth));
    expect(autoSpinDelayCost(5)).toBeNull();
    expect(autoSpinDelay(0)).toBe(1.5);
    expect(autoSpinDelay(5)).toBe(0.2);
    expect(autoSpinDelay(99)).toBe(0.2);
    expect(new Run(1).buyAutoSpinDelay()).toEqual({ ok: false, reason: "buy auto-spin first" });
    const r = spinning({}, 1e9);
    for (let i = 0; i < 5; i++) expect(r.buyAutoSpinDelay().ok).toBe(true);
    expect(r.buyAutoSpinDelay()).toEqual({ ok: false, reason: "max level" });
    expect(r.drainEvents().filter((e) => e.type === "autoSpinUpgraded")).toHaveLength(5);
  });

  it("switches on and off; only the run's first switch-on is the power-on; the same value changes nothing", () => {
    const r = new Run(1);
    r.state.cash = 1e6;
    expect(r.setAutoSpin(true)).toEqual({ ok: false, reason: "buy auto-spin first" });
    r.buySeller();
    r.buyAutoSpin();
    r.drainEvents();
    r.setAutoSpin(true);
    r.setAutoSpin(false);
    r.setAutoSpin(true);
    expect(r.drainEvents().filter((e) => e.type === "autoSpinToggled")).toEqual([
      { type: "autoSpinToggled", on: true, first: true },
      { type: "autoSpinToggled", on: false, first: false },
      { type: "autoSpinToggled", on: true, first: false },
    ]);
    expect(r.setAutoSpin(true)).toEqual({ ok: true });
    expect(r.drainEvents()).toEqual([]);
    r.state.vault = { phase: "key" };
    expect(r.setAutoSpin(false)).toEqual({ ok: false, reason: "the vault is open" });
  });
});

describe("auto-spin's pick", () => {
  it("is the case you buy by hand or pick on the shelf; the shelf pick checks the case", () => {
    const r = new Run(1);
    r.state.cash = 100;
    r.unlockCase("wildwood");
    r.buyCase("wildwood");
    expect(r.state.autoSpin.pick).toBe("wildwood");
    expect(r.setAutoSpinCase("bootcamp")).toEqual({ ok: true });
    expect(r.state.autoSpin.pick).toBe("bootcamp");
    expect(r.setAutoSpinCase("bedrock")).toEqual({ ok: false, reason: "case bedrock is locked" });
    expect(r.setAutoSpinCase("inferno")).toEqual({ ok: false, reason: "not in this run" });
  });
});

describe("auto-spin at work", () => {
  it("buys the picked case at full multi-open width once the bench has stood empty for its delay, then turns the key", () => {
    const r = spinning();
    r.state.upgrades.multiOpen = 1; // x2
    r.unlockCase("wildwood");
    r.setAutoSpinCase("wildwood");
    r.drainEvents();
    const cash = r.state.cash;
    tickFor(r, AUTOSPIN_DELAYS[0] - 0.1);
    expect(r.state.bench.phase).toBe("empty");
    tickFor(r, 0.2);
    expect(r.state.bench).toMatchObject({ phase: "locked", caseId: "wildwood", count: 2 });
    expect(r.state.cash).toBe(cash - 2 * priceOf("wildwood"));
    const bought = r.drainEvents();
    expect(types(bought).indexOf("caseBought")).toBeLessThan(types(bought).indexOf("autoSpinPulled"));
    expect(bought.find((e) => e.type === "autoSpinPulled")).toEqual({ type: "autoSpinPulled", caseId: "wildwood", count: 2 });
    tickFor(r, AUTOSPIN_KEY_SECONDS - 0.2); // up to 0.1 s of the beat already ran inside the 0.2 s window above
    expect(r.state.bench.phase).toBe("locked");
    tickFor(r, 0.2);
    expect(r.state.bench.phase).toBe("spinning");
    const keyed = types(r.drainEvents());
    expect(keyed.indexOf("spinStarted")).toBeLessThan(keyed.indexOf("autoSpinKeyed"));
  });

  it("turns the key of a case you bought by hand after its beat", () => {
    const r = spinning();
    r.buyCase("bootcamp");
    tickFor(r, AUTOSPIN_KEY_SECONDS - 0.1);
    expect(r.state.bench.phase).toBe("locked");
    tickFor(r, 0.2);
    expect(r.state.bench.phase).toBe("spinning");
  });

  it("makes a hand-bought case wait its key beat even when the clock stood past it", () => {
    const r = spinning();
    r.state.autoSpin.clock = AUTOSPIN_KEY_SECONDS + 5; // as if it had stood due on an empty bench
    r.buyCase("bootcamp");
    tickFor(r, AUTOSPIN_KEY_SECONDS - 0.1);
    expect(r.state.bench.phase).toBe("locked");
    tickFor(r, 0.2);
    expect(r.state.bench.phase).toBe("spinning");
  });

  it("falls back to the dearest case it can afford without changing your pick, and goes back to the pick when it can", () => {
    const r = spinning();
    r.unlockCase("wildwood");
    r.setAutoSpinCase("wildwood");
    r.state.cash = priceOf("wildwood") - 1;
    tickFor(r, AUTOSPIN_DELAYS[0] + 0.1);
    expect(r.state.bench).toMatchObject({ phase: "locked", caseId: "bootcamp" });
    expect(r.state.autoSpin.pick).toBe("wildwood");
    r.state.bench = { phase: "empty" }; // as if the seller took the card
    r.state.cash = 1e6;
    tickFor(r, AUTOSPIN_DELAYS[0] + 0.1);
    expect(r.state.bench).toMatchObject({ phase: "locked", caseId: "wildwood" });
  });

  it("waits ON when it can afford nothing (BROKE), leaves the day job to you, and buys the moment it can", () => {
    const r = spinning();
    r.state.cash = 0;
    tickFor(r, AUTOSPIN_DELAYS[0] + 0.5);
    expect(r.state.bench.phase).toBe("empty");
    expect(r.state.autoSpin.on).toBe(true);
    expect(autoSpinStatus(r)).toBe("broke");
    expect(r.dayJobAvailable()).toBe(true);
    r.state.cash = priceOf("bootcamp");
    r.tick(DT);
    expect(r.state.bench).toMatchObject({ phase: "locked", caseId: "bootcamp" });
    expect(autoSpinStatus(r)).toBe("on");
  });

  it("leaves the bench alone while you hold a card, while the vault is out, after the run, and when switched off (Review Focus 3)", () => {
    const held = spinning();
    held.state.held = "bot";
    const vault = spinning();
    vault.state.vault = { phase: "key" };
    const over = spinning();
    over.state.over = true;
    const off = spinning();
    off.setAutoSpin(false);
    for (const r of [held, vault, over, off]) {
      tickFor(r, AUTOSPIN_DELAYS[0] + 1);
      expect(r.state.bench.phase).toBe("empty");
    }
    expect(autoSpinStatus(off)).toBe("off");
    expect(autoSpinStatus(new Run(1))).toBe("off");
  });

  it("buys nothing while the vault is shown and affordable (Review Focus 1)", () => {
    const r = spinning({ vaultPrice: 100 });
    r.state.unlocked = r.runCases();
    r.state.cash = 1000;
    tickFor(r, AUTOSPIN_DELAYS[0] + 1);
    expect(r.state.bench.phase).toBe("empty");
    expect(autoSpinStatus(r)).toBe("vault");
    expect(r.buyVault().ok).toBe(true);
  });

  it("never builds combo by itself: with the auto-seller selling, the combo stays 0", () => {
    const r = spinning();
    tickFor(r, 40);
    expect(r.state.opened).toBeGreaterThanOrEqual(4);
    expect(r.state.combo).toBe(0);
  });

  it("picks up mid-delay after a reload, on the same tick (Review Focus 2)", () => {
    const a = spinning();
    tickFor(a, 1);
    const b = Run.fromSnapshot(a.snapshot());
    tickFor(a, 0.6);
    tickFor(b, 0.6);
    expect(b.state.bench.phase).toBe("locked");
    expect(b.state.bench).toEqual(a.state.bench);
    expect(b.state.autoSpin).toEqual(a.state.autoSpin);
  });
});
