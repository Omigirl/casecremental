import { describe, expect, it } from "vitest";
import { effectsOf, upgradeCost, UPGRADE_IDS } from "./upgrades";

const zero = { luck: 0, appraiser: 0, quickHands: 0 };

describe("upgradeCost", () => {
  it("grows geometrically from the base cost", () => {
    expect(upgradeCost("luck", 0)).toBe(15);
    expect(upgradeCost("luck", 1)).toBe(24);
    expect(upgradeCost("appraiser", 2)!).toBeGreaterThan(upgradeCost("appraiser", 1)!);
  });

  it("is null at max level", () => {
    expect(upgradeCost("quickHands", 10)).toBeNull();
  });

  it("covers every upgrade", () => {
    for (const id of UPGRADE_IDS) expect(upgradeCost(id, 0)).toBeGreaterThan(0);
  });
});

describe("effectsOf", () => {
  it("starts at the base values", () => {
    expect(effectsOf(zero)).toEqual({ luckLevel: 0, sellMult: 1, spinSeconds: 6 });
  });

  it("applies each upgrade", () => {
    const e = effectsOf({ luck: 3, appraiser: 2, quickHands: 1 });
    expect(e.luckLevel).toBe(3);
    expect(e.sellMult).toBeCloseTo(1.5);
    expect(e.spinSeconds).toBeCloseTo(4.8);
  });

  it("never spins faster than the minimum", () => {
    expect(effectsOf({ ...zero, quickHands: 10 }).spinSeconds).toBeGreaterThanOrEqual(0.6);
  });
});
