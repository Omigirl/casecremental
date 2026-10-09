import { describe, expect, it } from "vitest";
import type { Bench, BenchReel } from "../../sim/run";
import type { Drop } from "../../sim/types";
import { earlyLandings, leanHeld, leanReel, tallWindow } from "./BenchReels";

// Multi-open's stacked reels each carry their own tease; the camera leans toward the strongest one.

const reel = (strength: number | null, duration = 3): BenchReel => ({
  drop: { id: 1, caseId: "bootcamp", skinId: "x", rarity: "milspec", float: 0.1, wear: "MW", statTrak: false, value: 1 } as Drop,
  tease: strength === null ? null : { strength, fake: null, extraSeconds: 1 },
  duration,
});

describe("leanReel", () => {
  it("is null when no reel teases", () => {
    expect(leanReel([])).toBeNull();
    expect(leanReel([reel(null), reel(null)])).toBeNull();
  });

  it("is the reel with the strongest tease, the first among equals", () => {
    expect(leanReel([reel(null), reel(0.4)])).toBe(1);
    expect(leanReel([reel(0.9), reel(0.4)])).toBe(0);
    expect(leanReel([reel(0.4), reel(0.9)])).toBe(1);
    expect(leanReel([reel(0.5), reel(0.5)])).toBe(0);
  });
});

describe("earlyLandings", () => {
  // a plain reel lands at 3 s; its teasing partner crawls on to 5 s and lands with the reveal
  const pair = [reel(null, 3), reel(0.8, 5)];

  it("is the reels that land between two frames, before the last one (the reveal's own landing)", () => {
    expect(earlyLandings(pair, 2.9, 3.05)).toEqual([0]);
    expect(earlyLandings(pair, 2.5, 2.9)).toEqual([]); // not yet
    expect(earlyLandings(pair, 3.05, 3.1)).toEqual([]); // once only
    expect(earlyLandings(pair, 4.9, 5.1)).toEqual([]); // the last lands with the reveal
  });

  it("lands every reel of the same frame together, and none when they all land at once", () => {
    expect(earlyLandings([reel(null, 3), reel(null, 3), reel(0.5, 6)], 2.9, 3)).toEqual([0, 1]);
    expect(earlyLandings([reel(null, 3), reel(null, 3)], 2.9, 3.1)).toEqual([]);
    expect(earlyLandings([reel(null, 3)], 2.9, 3.1)).toEqual([]);
  });
});

describe("leanHeld", () => {
  it("keeps the camera on the leaned-to reel until that reel lands", () => {
    const pair = [reel(0.9, 6), reel(null, 3)];
    expect(leanHeld(pair, 0, 5.9)).toBe(0);
    expect(leanHeld(pair, 0, 6)).toBeNull();
    expect(leanHeld(pair, null, 1)).toBeNull();
  });

  it("lets go of a teasing reel that lands before a slower partner", () => {
    const pair = [reel(0.4, 4), reel(null, 7)];
    expect(leanHeld(pair, 0, 3.9)).toBe(0);
    expect(leanHeld(pair, 0, 4.5)).toBeNull();
  });
});

describe("tallWindow", () => {
  it("is tall only while more than one reel spins, and snaps back to compact once they land", () => {
    const spinning = (n: number): Bench => ({
      phase: "spinning",
      caseId: "bootcamp",
      reels: Array.from({ length: n }, () => reel(null)),
      elapsed: 1,
      fullDuration: 3,
    });
    expect(tallWindow(spinning(2))).toBe(true);
    expect(tallWindow(spinning(1))).toBe(false);
    expect(tallWindow({ phase: "revealed", caseId: "bootcamp", cards: [reel(null).drop, reel(null).drop] })).toBe(false);
    expect(tallWindow({ phase: "locked", caseId: "bootcamp", free: false, count: 2 })).toBe(false);
    expect(tallWindow({ phase: "empty" })).toBe(false);
  });
});
