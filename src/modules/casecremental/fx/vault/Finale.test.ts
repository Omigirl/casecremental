import { describe, expect, it } from "vitest";
import { createRng } from "../../sim/rng";
import type { Run } from "../../sim/run";
import type { HdLayer } from "../hd/HdLayer";
import { VAULT_CUES } from "./cues";
import { Finale, type FinaleBench, type FinaleBot, type TearFx } from "./Finale";
import { TEAR_SECONDS } from "./finaleRules";

// Finale.ts driven headless at 144 fps over the opening: the tear's window and its flash gate, the reels' start/landing.

const I = VAULT_CUES.impact;
const DT = 1 / 144;

function setup(run = 4, takeFlash: (t: number) => boolean = () => true) {
  let now = 0;
  const calls = { flash: 0 };
  const hd = { takeFlash: () => (calls.flash++, takeFlash(now)) } as unknown as HdLayer;
  const tear = {
    enabled: false,
    offset: 0,
    seeds: [] as number[],
    reseed(seed: number) {
      this.seeds.push(seed);
    },
  } satisfies TearFx & { seeds: number[] };
  const freeSpins: Array<{ start: boolean; elapsed: number; duration: number }> = [];
  const bench: FinaleBench = { freeSpin: (_c, _w, _r, start, elapsed, duration) => void freeSpins.push({ start, elapsed, duration }) };
  const botSpins: Array<{ ids: number; start: boolean; elapsed: number; duration: number }> = [];
  const bot: FinaleBot = {
    finaleSpin: (_c, ids, start, elapsed, duration) => void botSpins.push({ ids: ids.length, start, elapsed, duration }),
  };
  const make = () => new Finale([], hd, createRng(7), bench, bot, tear);
  const runAt = (t: number) => ({ setup: { run }, state: { vault: { phase: "opening", t, drops: [], landed: 0 } } }) as unknown as Run;
  const drive = (f: Finale, from: number, to: number, each?: (t: number) => void) => {
    for (let t = from; t < to; t += DT) {
      now = t;
      f.update(runAt(t), 6);
      each?.(t);
    }
  };
  return { make, drive, tear, calls, freeSpins, botSpins };
}

describe("Finale", () => {
  it("reseeds the tear at most 5 times over its 1.5 s, one per window, and only while it is on", () => {
    const s = setup();
    s.drive(s.make(), 0, I + TEAR_SECONDS + 0.5);
    expect(s.tear.seeds.length).toBeGreaterThan(0);
    expect(s.tear.seeds.length).toBeLessThanOrEqual(5);
    expect(s.calls.flash).toBe(s.tear.seeds.length); // a window asks once while the gate lets it
  });

  it("holds the slices and retries next frame when the gate refuses", () => {
    let open = false;
    const s = setup(4, () => open);
    const f = s.make();
    s.drive(f, 0, I + 0.2);
    expect(s.tear.seeds).toEqual([]); // refused: the seed is untouched
    expect(s.calls.flash).toBeGreaterThan(1); // and it asks again each frame
    open = true;
    s.drive(f, I + 0.2, I + 0.25);
    expect(s.tear.seeds.length).toBe(1);
    const asked = s.calls.flash;
    s.drive(f, I + 0.25, I + 0.3);
    expect(s.calls.flash).toBe(asked); // same window: no more asks
  });

  it("is on only in [3.40, 4.90)", () => {
    const s = setup();
    const f = s.make();
    const on: number[] = [];
    s.drive(f, 0, 6, (t) => {
      if (s.tear.enabled) on.push(t);
    });
    expect(on[0]!).toBeGreaterThanOrEqual(I - 1e-9);
    expect(on[on.length - 1]!).toBeLessThan(I + TEAR_SECONDS);
    expect(on[0]! - I).toBeLessThan(DT);
    expect(I + TEAR_SECONDS - on[on.length - 1]!).toBeLessThan(DT * 1.01);
    expect(I).toBeCloseTo(3.4, 5);
  });

  it("starts the reels once, spins them through the intro, and lands them exactly once", () => {
    const s = setup();
    s.drive(s.make(), 0, I + 0.5);
    expect(s.freeSpins.filter((c) => c.start)).toHaveLength(1);
    expect(s.freeSpins[0]!.start).toBe(true);
    expect(s.botSpins.filter((c) => c.start)).toEqual([expect.objectContaining({ ids: 3 })]);
    const lands = s.freeSpins.filter((c) => c.elapsed === 1 && c.duration === 1);
    expect(lands).toHaveLength(1);
    expect(s.botSpins.filter((c) => c.elapsed === 1 && c.duration === 1)).toHaveLength(1);
    expect(s.freeSpins[s.freeSpins.length - 1]).toEqual(lands[0]); // the landing is the last call
  });

  it("starts again when rebuilt mid-intro (a reload)", () => {
    const s = setup();
    s.drive(s.make(), 0, 1);
    s.drive(s.make(), 2, 2.1);
    expect(s.freeSpins.filter((c) => c.start)).toHaveLength(2);
    expect(s.freeSpins[s.freeSpins.length - 1]!.elapsed).toBeGreaterThanOrEqual(2);
  });

  it("does nothing for an ordinary vault", () => {
    const s = setup(3);
    s.drive(s.make(), 0, 6);
    expect(s.freeSpins).toEqual([]);
    expect(s.tear.seeds).toEqual([]);
    expect(s.tear.enabled).toBe(false);
  });
});
