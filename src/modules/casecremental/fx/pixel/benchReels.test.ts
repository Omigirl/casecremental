import { describe, expect, it } from "vitest";
import type { BenchReel } from "../../sim/run";
import type { Drop } from "../../sim/types";
import { leanReel } from "./BenchReels";

// Multi-open's stacked reels each carry their own tease; the camera leans toward the strongest one.

const reel = (strength: number | null): BenchReel => ({
  drop: { id: 1, caseId: "bootcamp", skinId: "x", rarity: "milspec", float: 0.1, wear: "MW", statTrak: false, value: 1 } as Drop,
  tease: strength === null ? null : { strength, fake: null, extraSeconds: 1 },
  duration: 3,
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
