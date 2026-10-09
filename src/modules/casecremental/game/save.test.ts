import { afterEach, describe, expect, it, vi } from "vitest";
import { CASES } from "../sim/content/cases";
import { freshMeta } from "../sim/meta";
import { DEFAULT_SETUP, Run } from "../sim/run";
import { decodeSave, encodeSave, SAVE_KEY, SAVE_VERSION, SaveSlot, type SaveData } from "./save";

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
    expect(revealed.v).toBe(3);
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
