import { describe, expect, it } from "vitest";
import { reelFraction, type ReelMotion } from "./motion";

const spin = (elapsed: number): ReelMotion => ({ elapsed, fullDuration: 6 });

describe("reelFraction", () => {
  it("runs 0 → 1 over the full spin", () => {
    expect(reelFraction(spin(0))).toBe(0);
    expect(reelFraction(spin(6))).toBe(1);
    expect(reelFraction(spin(9))).toBe(1);
  });

  it("never moves backwards", () => {
    let prev = -1;
    for (let t = 0; t <= 6; t += 0.01) {
      const f = reelFraction(spin(t));
      expect(f).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = f;
    }
  });
});
