import { describe, expect, it, vi } from "vitest";
import { CASES } from "../sim/content/cases";
import { freshMeta } from "../sim/meta";
import { Run, type SimEvent } from "../sim/run";
import { FINALE_SECONDS } from "../sim/tuning";
import { GameController, MAX_FRAME_SECONDS } from "./controller";
import { SaveSlot } from "./save";

describe("GameController", () => {
  it("advances the sim in fixed steps", () => {
    const c = new GameController(1);
    for (let i = 0; i < 60; i++) c.step(1 / 60);
    expect(c.run.state.time).toBeGreaterThan(0.95);
    expect(c.run.state.time).toBeLessThan(1.05);
  });

  it("clamps a huge frame (tab was hidden) to MAX_FRAME_SECONDS", () => {
    const c = new GameController(1);
    c.act({ type: "buyCase", caseId: "bootcamp" });
    c.act({ type: "insertKey" });
    c.step(30);
    expect(c.run.state.time).toBeLessThanOrEqual(MAX_FRAME_SECONDS);
    expect(c.run.state.bench.phase).toBe("spinning");
  });

  it("freezes the sim at timeScale 0 (hit-stop)", () => {
    const c = new GameController(1);
    c.timeScale = 0;
    c.step(0.1);
    expect(c.run.state.time).toBe(0);
  });

  it("routes actions to the run and events to listeners", () => {
    const c = new GameController(1);
    const seen: SimEvent[] = [];
    const off = c.onEvent((e) => seen.push(e));
    expect(c.act({ type: "buyCase", caseId: "bootcamp" }).ok).toBe(true);
    expect(c.act({ type: "sell" }).ok).toBe(false);
    off();
    c.act({ type: "insertKey" });
    expect(seen.map((e) => e.type)).toEqual(["caseBought"]);
  });

  it("refreshes the view and notifies subscribers on act", () => {
    const c = new GameController(1);
    let calls = 0;
    c.subscribe(() => calls++);
    const before = c.getView();
    c.act({ type: "buyCase", caseId: "bootcamp" });
    expect(calls).toBe(1);
    expect(c.getView()).not.toBe(before);
    expect(c.getView().phase).toBe("locked");
  });
});

const memorySlot = () => {
  const m = new Map<string, string>();
  return new SaveSlot({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) });
};
function openVault(c: GameController) {
  c.run.state.unlocked = CASES.map((x) => x.id);
  c.run.state.cash = 1e9;
  expect(c.act({ type: "buyVault" }).ok).toBe(true);
  for (let t = 0; t < FINALE_SECONDS + 1; t += 0.2) c.step(0.2);
}

describe("GameController — the campaign", () => {
  it("routes the new actions", () => {
    const c = new GameController(1);
    c.run.state.cash = 1e6;
    expect(c.act({ type: "wakeBot" }).ok).toBe(true);
    expect(c.act({ type: "buyBotSpeed" }).ok).toBe(true);
    expect(c.act({ type: "setBotThreshold", rarity: "covert" }).ok).toBe(true);
    expect(c.act({ type: "claim", index: 0 }).ok).toBe(false);
    expect(c.act({ type: "startDayJob" }).ok).toBe(false);
  });

  it("pays the vault into the meta exactly once, then prestiges into a fresh boosted run", () => {
    const c = new GameController(1);
    const events: string[] = [];
    c.onEvent((e) => events.push(e.type));
    openVault(c);
    c.step(1);
    expect(c.meta.loops).toBe(1);
    expect(c.meta.trophies).toEqual(["vault1"]);
    expect(c.meta.offer).toHaveLength(3);
    expect(c.act({ type: "pickCharm", id: c.meta.offer![0]! }).ok).toBe(true);
    c.meta.clout = 50;
    expect(c.act({ type: "buyPerk", id: "botAwake" }).ok).toBe(true);
    const old = c.run;
    expect(c.act({ type: "startNextRun" }).ok).toBe(true);
    expect(c.run).not.toBe(old);
    expect(c.run.state.over).toBe(false);
    expect(c.run.state.bot.awake).toBe(true);
    expect(c.run.setup.charms).toHaveLength(1);
    expect(c.run.setup.valueBoost).toBeGreaterThan(1);
    expect(c.meta.offer).toBeNull();
    expect(events).toContain("runStarted");
    expect(c.act({ type: "startNextRun" })).toEqual({ ok: false, reason: "the run is still going" });
    expect(c.meta.loops).toBe(1);
  });

  it("refuses perks during a run", () => {
    const c = new GameController(1);
    c.meta.clout = 50;
    expect(c.act({ type: "buyPerk", id: "luck" })).toEqual({ ok: false, reason: "perks are bought between runs" });
  });

  it("saves and restores the run and the meta — prestige included — through its slot", () => {
    const slot = memorySlot();
    const a = new GameController(1, slot);
    a.act({ type: "buyCase", caseId: "bootcamp" });
    openVaultAfterUnlock(a);
    const b = new GameController(999, slot);
    expect(b.meta.loops).toBe(1);
    expect(b.meta.offer).toEqual(a.meta.offer);
    expect(b.run.state.over).toBe(true);
    expect(b.run.state.cash).toBeCloseTo(a.run.state.cash);
  });

  it("starts fresh when the save is broken, and resetProgress forgets everything", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const slot = memorySlot();
    slot.save({ v: 1, meta: { clout: 5 } as never, run: {} as never });
    const c = new GameController(1, slot);
    expect(c.meta.clout).toBe(0);
    c.meta.clout = 9;
    c.resetProgress(2);
    expect(c.meta.clout).toBe(0);
    expect(new GameController(3, slot).meta.clout).toBe(0);
    vi.restoreAllMocks();
  });

  it("starts fresh instead of crashing on a save that passes the check but cannot run", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const slot = memorySlot();
    const run = new Run(1).snapshot();
    run.state.unlocked = ["nope"];
    slot.save({ v: 1, meta: freshMeta(), run });
    let c: GameController | null = null;
    expect(() => (c = new GameController(1, slot))).not.toThrow();
    expect(c!.run.state.unlocked).toEqual(["bootcamp"]);
    vi.restoreAllMocks();
  });
});

function openVaultAfterUnlock(c: GameController) {
  c.run.state.bench = { phase: "empty" };
  openVault(c);
  c.step(1);
}
