import { describe, expect, it } from "vitest";
import { WIN_INDEX } from "../reel/strip";
import { CARD_W, reelPosition } from "./Reel";

describe("reelPosition", () => {
  it("starts with the strip flush left and moves in whole pixels, never backwards", () => {
    expect(reelPosition(0, 120, 0.2).x).toBe(0);
    let last = Infinity;
    for (let i = 0; i <= 100; i++) {
      const { x } = reelPosition(i / 100, 120, 0.2);
      expect(Number.isInteger(x)).toBe(true);
      expect(x).toBeLessThanOrEqual(last);
      last = x;
    }
  });

  it("lands with the winning card under the marker, off by the jitter", () => {
    for (const jitter of [-0.35, 0, 0.3]) {
      const { x, index } = reelPosition(1, 120, jitter);
      expect(index).toBe(WIN_INDEX);
      const winnerCentre = x + WIN_INDEX * CARD_W + CARD_W / 2;
      expect(Math.abs(winnerCentre - (60 - jitter * CARD_W))).toBeLessThanOrEqual(0.5);
    }
  });
});
