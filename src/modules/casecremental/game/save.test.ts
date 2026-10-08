import { afterEach, describe, expect, it, vi } from "vitest";
import { freshMeta } from "../sim/meta";
import { Run } from "../sim/run";
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
});
