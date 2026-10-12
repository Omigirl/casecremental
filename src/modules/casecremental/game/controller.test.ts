import { botWaiting } from "../sim/botOpener";
import { describe, expect, it, vi } from "vitest";
import { CASES } from "../sim/content/cases";
import { runCaseIds } from "../sim/campaign";
import { freshMeta } from "../sim/meta";
import { Run, type SimEvent } from "../sim/run";
import { VAULT_OPENING_SECONDS } from "../sim/tuning";
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
  c.act({ type: "turnVaultKey" });
  for (let t = 0; t < VAULT_OPENING_SECONDS + 1; t += 0.2) c.step(0.2);
}

describe("GameController — the campaign", () => {
  it("saves on demand (the page is closing) — even between autosaves", () => {
    const slot = memorySlot();
    const a = new GameController(1, slot);
    a.run.state.cash = 77;
    a.saveNow();
    expect(new GameController(2, slot).run.state.cash).toBe(77);
  });

  it("routes the new actions", () => {
    const c = new GameController(1);
    c.run.state.cash = 1e6;
    expect(c.act({ type: "wakeBot" }).ok).toBe(true);
    expect(c.act({ type: "buyBotSpeed" }).ok).toBe(true);
    expect(c.act({ type: "setBotCase", caseId: "bootcamp" }).ok).toBe(true);
    expect(c.act({ type: "sellBot" }).ok).toBe(false); // nothing landed yet
    expect(c.act({ type: "buySeller" }).ok).toBe(true);
    expect(c.act({ type: "buySellerSpeed" }).ok).toBe(true);
    expect(c.act({ type: "setSellerThreshold", rarity: "covert" }).ok).toBe(true);
    expect(c.act({ type: "holdCard", spot: null }).ok).toBe(true);
    expect(c.act({ type: "claim", index: 0 }).ok).toBe(false);
    expect(c.act({ type: "startDayJob" }).ok).toBe(false);
  });

  it("routes holdCard to the bench and sellBot to a waiting bot card", () => {
    const c = new GameController(1);
    c.run.state.cash = 1e6;
    c.act({ type: "buyCase", caseId: "bootcamp" });
    c.act({ type: "insertKey" });
    for (let i = 0; i < 300 && c.run.state.bench.phase !== "revealed"; i++) c.run.tick(1 / 30);
    expect(c.act({ type: "holdCard", spot: "bench" }).ok).toBe(true);
    expect(c.run.state.held).toBe("bench");
    expect(c.act({ type: "holdCard", spot: null }).ok).toBe(true);
    expect(c.act({ type: "wakeBot" }).ok).toBe(true);
    for (let i = 0; i < 900 && !botWaiting(c.run.state.bot); i++) c.run.tick(1 / 30);
    expect(botWaiting(c.run.state.bot)).toBe(true);
    expect(c.act({ type: "sellBot" }).ok).toBe(true);
    expect(botWaiting(c.run.state.bot)).toBe(false);
  });

  it("routes the locker's actions", () => {
    const c = new GameController(1);
    c.devStartRun(2);
    c.devAddCash(1e9);
    expect(c.act({ type: "buyLocker" }).ok).toBe(true);
    expect(c.act({ type: "buyLockerSize" }).ok).toBe(true);
    expect(c.act({ type: "setCollect", rarity: "milspec" }).ok).toBe(true);
    expect(c.act({ type: "setCollect", rarity: "gold" }).ok).toBe(false);
    for (let i = 0; i < 10; i++) c.run.state.tray.push(c.run.rollFor("bootcamp", "milspec"));
    for (let i = 0; i < 10; i++) expect(c.act({ type: "storeCard", from: "tray", slot: 0 }).ok).toBe(true);
    expect(c.act({ type: "tradeUp" }).ok).toBe(true);
    for (let i = 0; i < 90; i++) c.run.tick(1 / 30);
    expect(c.act({ type: "holdCard", spot: "locker", slot: 0 }).ok).toBe(true);
    expect(c.run.state.held).toBe("locker");
    expect(c.act({ type: "sellLocker" }).ok).toBe(true);
    expect(c.run.state.held).toBeNull();
    expect(c.act({ type: "buyAutoContract" })).toEqual({ ok: false, reason: "not in this run" });
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

  it("emits sounds' events for picking a charm and buying a perk", () => {
    const c = new GameController(1);
    const events: string[] = [];
    c.onEvent((e) => events.push(e.type));
    openVault(c);
    c.step(1);
    expect(c.act({ type: "pickCharm", id: c.meta.offer![0]! }).ok).toBe(true);
    c.meta.clout = 50;
    expect(c.act({ type: "buyPerk", id: "botAwake" }).ok).toBe(true);
    expect(events).toContain("charmPicked");
    expect(events).toContain("perkBought");
  });

  it("emits charmPicked on a pick, not on an un-pick", () => {
    const c = new GameController(1);
    const events: string[] = [];
    c.onEvent((e) => events.push(e.type));
    openVault(c);
    c.step(1);
    const id = c.meta.offer![0]!;
    expect(c.act({ type: "pickCharm", id }).ok).toBe(true);
    expect(events.filter((e) => e === "charmPicked")).toHaveLength(1);
    expect(c.act({ type: "pickCharm", id }).ok).toBe(true); // un-pick
    expect(c.meta.picked).toEqual([]);
    expect(events.filter((e) => e === "charmPicked")).toHaveLength(1);
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

  it("sells and holds a bench card by its slot", () => {
    const c = new GameController(1);
    c.run.state.upgrades.multiOpen = 1;
    c.run.state.cash = 1000;
    c.act({ type: "buyCase", caseId: "bootcamp" });
    c.act({ type: "insertKey" });
    for (let i = 0; i < 2000 && c.run.state.bench.phase !== "revealed"; i++) c.run.tick(1 / 30);
    c.act({ type: "holdCard", spot: "bench", slot: 1 });
    expect(c.run.state.heldSlot).toBe(1);
    expect(c.act({ type: "sell", slot: 1 }).ok).toBe(true);
    expect(c.act({ type: "sell" }).ok).toBe(true); // slot 0 by default
    expect(c.run.state.bench.phase).toBe("empty");
  });

  it("dev: devStartRun(3) starts Run 3 keeping the meta, devAddCash adds cash but not earnings", () => {
    const c = new GameController(1);
    c.meta.clout = 7;
    c.meta.offer = [];
    c.devStartRun(3);
    expect(c.run.setup.run).toBe(3);
    expect(c.getView().cases.length).toBe(runCaseIds(3).length);
    expect(c.meta.loops).toBe(2);
    expect(c.meta.clout).toBe(7);
    expect(c.meta.offer).toBeNull();
    const cash = c.run.state.cash;
    const life = c.run.state.lifetimeEarnings;
    c.devAddCash(1000);
    expect(c.run.state.cash).toBe(cash + 1000);
    expect(c.run.state.lifetimeEarnings).toBe(life);
  });

  it("routes auto-spin's actions", () => {
    const c = new GameController(1);
    c.devAddCash(1e6);
    expect(c.act({ type: "buyAutoSpin" })).toEqual({ ok: false, reason: "buy the auto-seller first" });
    expect(c.act({ type: "buySeller" }).ok).toBe(true);
    expect(c.act({ type: "buyAutoSpin" }).ok).toBe(true);
    expect(c.act({ type: "buyAutoSpinDelay" }).ok).toBe(true);
    expect(c.act({ type: "setAutoSpin", on: true }).ok).toBe(true);
    expect(c.act({ type: "setAutoSpinCase", caseId: "bootcamp" }).ok).toBe(true);
    expect(c.run.state.autoSpin).toMatchObject({ owned: true, on: true, delayLevel: 1, pick: "bootcamp" });
  });

  it("keeps auto-spin's switch across a reload (Review Focus 2)", () => {
    const m = new Map<string, string>();
    const store = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
    const a = new GameController(1, new SaveSlot(store));
    a.devAddCash(1e6);
    a.act({ type: "buySeller" });
    a.act({ type: "buyAutoSpin" });
    a.act({ type: "setAutoSpin", on: true });
    const b = new GameController(2, new SaveSlot(store));
    expect(b.run.state.autoSpin).toMatchObject({ owned: true, on: true, powered: true });
  });
});

function openVaultAfterUnlock(c: GameController) {
  c.run.state.bench = { phase: "empty" };
  openVault(c);
  c.step(1);
}

describe("GameController — the credits", () => {
  it("keeps the campaign stats, rolls the credits after The Last Case and ends them on endCredits", () => {
    const c = new GameController(1);
    c.devStartRun(4);
    const run = c.run;
    run.state.opened = 77;
    run.state.cash = 1e30;
    for (const id of run.runCases().slice(1)) run.unlockCase(id);
    expect(c.act({ type: "buyVault" }).ok).toBe(true);
    c.act({ type: "turnVaultKey" });
    for (let i = 0; i < 20 * 30; i++) c.step(1 / 30);
    expect(c.meta.credits).toBe(true);
    expect(c.meta.stats.opened).toBeGreaterThanOrEqual(77);
    expect(c.act({ type: "startNextRun" })).toEqual({ ok: false, reason: "the credits are rolling" });
    const seen: string[] = [];
    c.onEvent((e) => seen.push(e.type));
    expect(c.act({ type: "endCredits" }).ok).toBe(true);
    expect(seen).toContain("creditsEnded");
    expect(c.act({ type: "startNextRun" }).ok).toBe(true);
    expect(c.run.setup.run).toBe(4); // THE END: Run 4 again, boosted
  });
});
