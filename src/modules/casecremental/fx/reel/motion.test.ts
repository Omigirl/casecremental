import { describe, expect, it } from "vitest";
import { reelFraction, type ReelMotion } from "./motion";

const spin = (elapsed: number, brakedAt: number | null = null, endsAt = 6): ReelMotion => ({
  elapsed,
  fullDuration: 6,
  endsAt,
  brakedAt,
});

describe("reelFraction", () => {
  it("runs 0 → 1 over the full spin", () => {
    expect(reelFraction(spin(0))).toBe(0);
    expect(reelFraction(spin(6))).toBe(1);
    expect(reelFraction(spin(9))).toBe(1);
  });

  it("is continuous at the moment of braking and ends at 1", () => {
    const free = reelFraction(spin(2));
    expect(reelFraction(spin(2, 2, 2.35))).toBeCloseTo(free, 10);
    expect(reelFraction(spin(2.35, 2, 2.35))).toBe(1);
  });

  it("never moves backwards, braked or not", () => {
    for (const brakeAt of [null, 1.5, 3]) {
      let prev = -1;
      for (let t = 0; t <= 6; t += 0.01) {
        const braked = brakeAt !== null && t >= brakeAt;
        const f = reelFraction(
          spin(t, braked ? brakeAt : null, braked ? brakeAt + 0.35 : 6),
        );
        expect(f).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = f;
      }
    }
  });
});
