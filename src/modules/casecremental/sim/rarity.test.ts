import { describe, expect, it } from "vitest";
import { RARITY_ORDER, rarityWeights } from "./rarity";
import { wearOf } from "./wear";

const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

describe("rarityWeights", () => {
  it("matches CS odds at luck 0", () => {
    const w = rarityWeights(0);
    expect(sum(w)).toBeCloseTo(1, 10);
    expect(w.milspec).toBeCloseTo(0.7992, 4);
    expect(w.gold).toBeCloseTo(0.0026, 4);
  });

  it("moves weight upward with luck", () => {
    const w0 = rarityWeights(0);
    const w5 = rarityWeights(5);
    expect(sum(w5)).toBeCloseTo(1, 10);
    expect(w5.milspec).toBeLessThan(w0.milspec);
    for (const r of RARITY_ORDER.slice(1)) expect(w5[r]).toBeGreaterThan(w0[r]);
  });
});

describe("wearOf", () => {
  it.each([
    [0, "FN"],
    [0.0699, "FN"],
    [0.07, "MW"],
    [0.2, "FT"],
    [0.4, "WW"],
    [0.45, "BS"],
    [0.999, "BS"],
  ])("float %s is %s", (f, id) => {
    expect(wearOf(f).id).toBe(id);
  });
});
