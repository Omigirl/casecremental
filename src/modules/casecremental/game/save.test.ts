import { afterEach, describe, expect, it, vi } from "vitest";
import { CASES } from "../sim/content/cases";
import { freshAutoSpin } from "../sim/autoSpin";
import { freshEvolutions } from "../sim/evolved";
import { vaultFor } from "../sim/content/vaults";
import { LAST_RUN } from "../sim/tuning";
import { freshMeta } from "../sim/meta";
import { freshUpgrader } from "../sim/upgrader";
import { DEFAULT_SETUP, Run } from "../sim/run";
import { browserSlot, decodeSave, encodeSave, SAVE_KEY, SAVE_VERSION, SaveSlot, type SaveData } from "./save";

afterEach(() => vi.restoreAllMocks());

const data = (): SaveData => ({ v: SAVE_VERSION, meta: freshMeta(), run: new Run(3).snapshot() });
const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
};

describe("the local save", () => {
  it("round-trips the meta and the run", () => {
    const d = data();
    d.meta.clout = 12;
    expect(decodeSave(encodeSave(d))).toEqual(d);
  });

  it("keeps a run's own prices across a retune (finish spec §5: saves keep their run's setup)", () => {
    const d = data();
    d.run.setup = { ...d.run.setup, vaultPrice: 1_234_567, valueBoost: 9 };
    expect(decodeSave(encodeSave(d))!.run.setup).toMatchObject({ vaultPrice: 1_234_567, valueBoost: 9 });
  });

  it("rolls a Run 3 replay save back so it plays a first Run 4, but leaves Run 4 players alone", () => {
    // on the prestige screen (over) loops already counts the run just ended: Run 3's end is 3, a replay's end is 4
    const ended = data();
    ended.run.state.over = true;
    ended.meta.trophies = ["vault1", "vault2", "vault3"];
    ended.meta.loops = 4;
    expect(decodeSave(encodeSave(ended))!.meta.loops).toBe(3); // the next run is Run 4's first
    ended.meta.loops = 2;
    expect(decodeSave(encodeSave(ended))!.meta.loops).toBe(2);
    // mid-run loops counts the runs before this one: a legacy Run 3 replay (setup.run 3, loops 3) rolls back to 2, so
    // finishing it makes loops 3 and the next run Run 4's first
    const replay = data();
    replay.run.state.over = false;
    replay.run.setup = { ...replay.run.setup, run: 3 };
    replay.meta.trophies = ["vault1", "vault2", "vault3"];
    replay.meta.loops = 3;
    expect(decodeSave(encodeSave(replay))!.meta.loops).toBe(2);
    // a real first Run 4 mid-run (setup.run 4, loops 3, trophy not earned yet) is untouched
    const first = data();
    first.run.state.over = false;
    first.run.setup = { ...first.run.setup, run: 4 };
    first.meta.trophies = ["vault1", "vault2", "vault3"];
    first.meta.loops = 3;
    expect(decodeSave(encodeSave(first))!.meta.loops).toBe(3);
    const done = data();
    done.meta.loops = 6;
    done.meta.trophies = [vaultFor(LAST_RUN).trophy];
    expect(decodeSave(encodeSave(done))!.meta.loops).toBe(6);
  });

  it("drops a missing, broken, foreign or old save — with a warning, never a throw", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(decodeSave(null)).toBeNull();
    expect(decodeSave("{not json")).toBeNull();
    expect(decodeSave(JSON.stringify({ hello: 1 }))).toBeNull();
    expect(decodeSave(JSON.stringify({ ...data(), v: 0 }))).toBeNull();
    const noTray = data() as unknown as { run: { state: Record<string, unknown> } };
    delete noTray.run.state.tray;
    expect(decodeSave(JSON.stringify(noTray))).toBeNull();
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it("saves, loads and clears through a slot; a broken store never throws", () => {
    const store = memory();
    const slot = new SaveSlot(store);
    slot.save(data());
    expect(store.m.has(SAVE_KEY)).toBe(true);
    expect(slot.load()).toEqual(data());
    slot.clear();
    expect(slot.load()).toBeNull();
    const broken = new SaveSlot({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(() => broken.save(data())).not.toThrow();
    expect(broken.load()).toBeNull();
    expect(() => broken.clear()).not.toThrow();
    expect(new SaveSlot(null).load()).toBeNull();
  });

  it("keeps one save per account, and the first account adopts an older build's unkeyed save", () => {
    const store = memory();
    store.setItem(SAVE_KEY, encodeSave(data()));
    vi.stubGlobal("localStorage", store);
    try {
      expect(browserSlot("A").load()).toEqual(data());
      expect(store.m.has(SAVE_KEY)).toBe(false);
      expect(store.m.has(`${SAVE_KEY}.A`)).toBe(true);
      expect(browserSlot("B").load()).toBeNull(); // another account starts its own campaign
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fills in what an older or partial save leaves out, so nothing turns into NaN or crashes", () => {
    const d = data() as unknown as { meta: { perks: Record<string, number> }; run: { setup: unknown; state: Record<string, unknown> } };
    delete d.meta.perks.luck;
    d.run.setup = {};
    d.run.state.held = "bench";
    const loaded = decodeSave(JSON.stringify(d))!;
    expect(loaded.meta.perks.luck).toBe(0);
    expect(loaded.run.setup).toEqual(DEFAULT_SETUP);
    expect(loaded.run.state.held).toBeNull(); // nobody is holding a card after a reload
  });

  it("gives a v4 save from before the locker a fresh one", () => {
    const run = new Run(3);
    run.state.cash = 1e6;
    run.unlockCase("wildwood");
    run.buyCase("wildwood"); // a case on the bench, so the survival checks below see more than defaults
    const d = JSON.parse(encodeSave({ v: SAVE_VERSION, meta: freshMeta(), run: run.snapshot() }));
    delete d.run.state.locker;
    const loaded = decodeSave(JSON.stringify(d))!;
    expect(loaded.run.state.locker).toEqual(new Run(3).state.locker);
    expect(loaded.run.state.bench).toEqual(d.run.state.bench);
    expect(loaded.run.state.tray).toEqual(d.run.state.tray);
    expect(loaded.run.state.unlocked).toEqual(d.run.state.unlocked);
    expect(loaded.run.state.bench).toMatchObject({ phase: "locked", caseId: "wildwood" });
    expect(loaded.run.state.unlocked).toContain("wildwood");
  });

  it("merges the bot and seller defaults into a v3 save that lacks fields, so none becomes NaN", () => {
    const d = JSON.parse(encodeSave(data()));
    delete d.run.state.bot.speedLevel;
    delete d.run.state.bot.wakeLeft;
    delete d.run.state.seller.speedLevel;
    d.run.state.bot.awake = true;
    const loaded = decodeSave(JSON.stringify(d))!;
    expect(loaded.run.state.bot.speedLevel).toBe(0);
    expect(loaded.run.state.bot.wakeLeft).toBe(0);
    expect(loaded.run.state.bot.awake).toBe(true);
    expect(loaded.run.state.seller.speedLevel).toBe(0);
    const run = Run.fromSnapshot(loaded.run);
    run.state.cash = 100;
    run.tick(1 / 30);
    expect(run.state.bot.spin?.duration).toBe(4);
  });

  it("drops a version-1 save (the M2b bot) with a warning (Review Focus 4)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(decodeSave(JSON.stringify({ ...data(), v: 1 }))).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("drops a save whose bench it cannot draw", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = (bench: unknown) => {
      const d = data() as unknown as { run: { state: Record<string, unknown> } };
      d.run.state.bench = bench;
      return decodeSave(JSON.stringify(d));
    };
    expect(bad({ phase: "locked" })).toBeNull();
    expect(bad({ phase: "weird", caseId: "bootcamp" })).toBeNull();
    expect(bad({ phase: "revealed", caseId: "bootcamp" })).toBeNull();
    expect(bad({ phase: "revealed", caseId: "bootcamp", cards: [] })).toBeNull();
    expect(bad({ phase: "spinning", caseId: "bootcamp", elapsed: 0, fullDuration: 3 })).toBeNull();
    expect(bad({ phase: "empty" })).not.toBeNull();
  });

  it("drops a locked bench whose count no BUY could make — one would build millions of reels", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const locked = (count: unknown) => {
      const d = data() as unknown as { run: { state: Record<string, unknown> } };
      d.run.state.bench = { phase: "locked", caseId: "bootcamp", free: false, count };
      return decodeSave(JSON.stringify(d));
    };
    expect(locked(1e7)).toBeNull();
    expect(locked(1.5)).toBeNull();
    expect(locked(0)).toBeNull();
    expect(locked(2)).not.toBeNull();
    expect(locked(5)).not.toBeNull();
  });

  it("migrates a version-3 save: the bot's card and spin become lists, multi-open is off, the run is 1", () => {
    const drop = { id: 1, skinId: CASES[0]!.skins[0]!.id, caseId: "bootcamp", rarity: "milspec", float: 0.2, statTrak: false, value: 1 };
    const v3 = (bot: Record<string, unknown>) => {
      const d = JSON.parse(encodeSave(data()));
      d.v = 3;
      delete d.run.setup.run;
      const { cards, multiLevel, ...rest } = d.run.state.bot;
      void cards;
      void multiLevel;
      d.run.state.bot = { ...rest, ...bot };
      return JSON.stringify(d);
    };
    const waiting = decodeSave(v3({ card: drop, spin: null }))!;
    expect(waiting.v).toBe(5);
    expect(waiting.run.state.bot.cards).toEqual([drop]);
    expect(waiting.run.state.bot.multiLevel).toBe(0);
    expect(waiting.run.state.bot).not.toHaveProperty("card");
    expect(waiting.run.setup.run).toBe(1);
    expect(decodeSave(v3({ card: null, spin: null }))!.run.state.bot.cards).toEqual([]);
    const spinning = decodeSave(v3({ card: null, spin: { caseId: "bootcamp", drop, elapsed: 1, duration: 3 } }))!;
    expect(spinning.run.state.bot.spin).toEqual({ caseId: "bootcamp", drops: [drop], elapsed: 1, duration: 3 });
  });

  it("round-trips a version-5 save with a double spin and two cards", () => {
    const r = new Run(3, { ...DEFAULT_SETUP, run: 2, startCash: 1e6, botAwake: true });
    r.buyBotMulti();
    for (let i = 0; i < 60; i++) r.tick(1 / 30);
    expect(r.state.bot.spin?.drops).toHaveLength(2);
    const d: SaveData = { v: SAVE_VERSION, meta: freshMeta(), run: r.snapshot() };
    expect(decodeSave(encodeSave(d))).toEqual(d);
    expect(SAVE_VERSION).toBe(5);
  });

  it("migrates a version-4 save: the grid is dropped (its spent cash is not refunded) and auto-spin is fresh (Review Focus 5)", () => {
    const drop = { id: 1, skinId: CASES[0]!.skins[0]!.id, caseId: "bootcamp", rarity: "covert", float: 0.2, statTrak: false, value: 1 };
    const d = JSON.parse(encodeSave(data()));
    d.v = 4;
    delete d.run.state.autoSpin;
    d.run.state.grid = {
      on: true,
      rateLevel: 2,
      sizeLevel: 1,
      reserve: 0.5,
      ticks: ["bootcamp"],
      cells: [{ caseId: "bootcamp", t: 0.4, drop }, null],
      buyClock: 0.3,
      next: 1,
    };
    const cash = d.run.state.cash;
    const loaded = decodeSave(JSON.stringify(d))!;
    expect(loaded.v).toBe(5);
    expect(loaded.run.state).not.toHaveProperty("grid");
    expect(loaded.run.state.autoSpin).toEqual({ owned: false, on: false, delayLevel: 0, pick: null, clock: 0, powered: false });
    expect(loaded.run.state.cash).toBe(cash);
    expect(() => Run.fromSnapshot(loaded.run).tick(1 / 30)).not.toThrow();
  });

  it("round-trips a version-5 save with auto-spin on mid-delay; the reloaded run buys on the same tick (Review Focus 2)", () => {
    const r = new Run(3, { ...DEFAULT_SETUP, startCash: 1e6 });
    r.buySeller();
    r.buyAutoSpin();
    r.setAutoSpin(true);
    r.setAutoSpinCase("bootcamp");
    for (let i = 0; i < 30; i++) r.tick(1 / 30);
    const d: SaveData = { v: SAVE_VERSION, meta: freshMeta(), run: r.snapshot() };
    const loaded = decodeSave(encodeSave(d))!;
    expect(loaded).toEqual(d);
    const again = Run.fromSnapshot(loaded.run);
    for (let i = 0; i < 20; i++) {
      r.tick(1 / 30);
      again.tick(1 / 30);
    }
    expect(again.state.bench.phase).toBe("locked");
    expect(again.state.bench).toEqual(r.state.bench);
  });

  it("gives a v5 save from before the Upgrader a fresh one", () => {
    const d = JSON.parse(encodeSave(data()));
    delete d.run.state.upgrader;
    expect(decodeSave(JSON.stringify(d))!.run.state.upgrader).toEqual(freshUpgrader());
  });

  it("gives a v5 save from before evolutions a fresh one", () => {
    const d = JSON.parse(encodeSave(data()));
    delete d.run.state.evolutions;
    expect(decodeSave(JSON.stringify(d))!.run.state.evolutions).toEqual(freshEvolutions());
  });

  it("a ten-case bench survives the save (Review Focus 4)", () => {
    const r = new Run(5, { ...DEFAULT_SETUP, run: 4, startCash: 1e18 });
    r.state.evolutions.owned.push("slotMachine");
    r.buyCase("bootcamp");
    const back = decodeSave(encodeSave({ v: SAVE_VERSION, meta: freshMeta(), run: r.snapshot() }));
    expect(back?.run.state.bench).toMatchObject({ phase: "locked", count: 10 });
  });

  it("gives a v5 save from before the campaign stats fresh ones, and no best drop", () => {
    const d = JSON.parse(encodeSave(data()));
    delete d.meta.stats;
    delete d.meta.credits;
    delete d.run.state.best;
    const loaded = decodeSave(JSON.stringify(d))!;
    expect(loaded.meta.stats).toEqual(freshMeta().stats);
    expect(loaded.meta.credits).toBe(false);
    expect(loaded.run.state.best).toBeNull();
  });

  it("gives a v5 save that lacks auto-spin a fresh one", () => {
    const d = JSON.parse(encodeSave(data()));
    delete d.run.state.autoSpin;
    expect(decodeSave(JSON.stringify(d))!.run.state.autoSpin).toEqual(freshAutoSpin());
  });

  it("migrates a version-2 save: a single card, a single reel, no multi-open (Review Focus 3)", () => {
    const v3 = data();
    const drop = { id: 1, skinId: CASES[0]!.skins[0]!.id, caseId: "bootcamp", rarity: "milspec", float: 0.2, statTrak: false, value: 1 };
    const v2 = (bench: unknown) => {
      const d = JSON.parse(encodeSave(v3));
      d.v = 2;
      d.run.state.bench = bench;
      delete d.run.state.heldSlot;
      delete d.run.state.upgrades.multiOpen;
      return JSON.stringify(d);
    };
    const revealed = decodeSave(v2({ phase: "revealed", caseId: "bootcamp", drop }))!;
    expect(revealed.v).toBe(5);
    expect(revealed.run.state.bench).toEqual({ phase: "revealed", caseId: "bootcamp", cards: [drop] });
    expect(revealed.run.state.upgrades.multiOpen).toBe(0);
    expect(revealed.run.state.heldSlot).toBe(0);
    const spinning = decodeSave(v2({ phase: "spinning", caseId: "bootcamp", drop, elapsed: 1, fullDuration: 3, tease: null }))!;
    expect(spinning.run.state.bench).toEqual({
      phase: "spinning",
      caseId: "bootcamp",
      elapsed: 1,
      fullDuration: 3,
      reels: [{ drop, tease: null, duration: 3 }],
    });
    expect(decodeSave(v2({ phase: "locked", caseId: "bootcamp", free: false }))!.run.state.bench).toMatchObject({ count: 1 });
  });

  it("drops a revealed bench with no real card (a v2 one without drop, or only nulls/junk)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const withBench = (v: number, bench: unknown) => {
      const d = JSON.parse(encodeSave(data()));
      d.v = v;
      d.run.state.bench = bench;
      return decodeSave(JSON.stringify(d));
    };
    expect(withBench(2, { phase: "revealed", caseId: "bootcamp" })).toBeNull();
    expect(withBench(3, { phase: "revealed", caseId: "bootcamp", cards: [null, null] })).toBeNull();
    expect(withBench(3, { phase: "revealed", caseId: "bootcamp", cards: [42] })).toBeNull();
  });
});
