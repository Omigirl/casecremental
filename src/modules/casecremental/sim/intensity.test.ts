import { describe, expect, it } from "vitest";
import { intensityLevel, nextStage, updateHeat } from "./intensity";

describe("updateHeat", () => {
  it("converges to the reveal rate", () => {
    let heat = 0;
    // one reveal every 2 s for 2 minutes, ticking at 30 Hz
    for (let t = 0; t < 3600; t++) heat = updateHeat(heat, t % 60 === 0 ? 1 : 0, 1 / 30);
    expect(heat).toBeGreaterThan(0.4);
    expect(heat).toBeLessThan(0.6);
  });

  it("decays without reveals and ignores dt <= 0", () => {
    expect(updateHeat(1, 0, 10)).toBeLessThan(0.5);
    expect(updateHeat(1, 5, 0)).toBe(1);
  });
});

describe("intensityLevel", () => {
  it("rises with heat, tier and combo", () => {
    expect(intensityLevel(1, 2, 0)).toBeGreaterThan(intensityLevel(1, 1, 0));
    expect(intensityLevel(1, 1, 25)).toBeCloseTo(2);
  });
});

describe("nextStage", () => {
  it("climbs to the highest reached threshold", () => {
    expect(nextStage(1, 0)).toBe(1);
    expect(nextStage(1, 0.8)).toBe(2);
    expect(nextStage(1, 12)).toBe(4);
    expect(nextStage(1, 1000)).toBe(5);
  });

  it("holds a stage until intensity falls 20% under its threshold", () => {
    expect(nextStage(2, 0.7)).toBe(2);
    expect(nextStage(2, 0.63)).toBe(1);
    expect(nextStage(3, 2.5)).toBe(3);
    expect(nextStage(3, 2)).toBe(2);
  });
});
