import { describe, expect, it } from "vitest";
import { countUp } from "./countUp";
import { VAULT_LAND_TIMES } from "../../sim/tuning";
import { VAULT_CUES, vaultCues } from "./cues";

describe("the jackpot opening's cues", () => {
  it("walks the phases", () => {
    const at = (t: number) => vaultCues(t).phase;
    expect([0.5, 0.95, 1.2, 2.0, 4.0, 7.0, 10, 12].map(at)).toEqual([
      "anticipation",
      "anticipation",
      "impact",
      "rays",
      "spin",
      "lockins",
      "celebrate",
      "hold",
    ]);
  });

  it("trembles harder up to 0.9, then holds still", () => {
    expect(vaultCues(0).tremble).toBeCloseTo(0.1, 5);
    expect(vaultCues(0.89).tremble).toBeGreaterThan(0.8);
    expect(vaultCues(0.89).tremble).toBeLessThanOrEqual(0.85);
    expect(vaultCues(0.95).tremble).toBe(0);
    expect(vaultCues(1.2).tremble).toBe(0);
  });

  it("slams the lid open at the impact with an overshoot, settling at 1", () => {
    expect(vaultCues(0.99).lid).toBe(0);
    expect(vaultCues(1.08).lid).toBeGreaterThan(1);
    expect(vaultCues(1.5).lid).toBe(1);
    expect(vaultCues(3).lid).toBe(1);
  });

  it("cascades the columns in 100 ms apart", () => {
    for (let i = 0; i < 5; i++) {
      const start = VAULT_CUES.columnsFrom + VAULT_CUES.columnStagger * i;
      expect(vaultCues(start - 0.01).columnIn[i]).toBe(0);
      expect(vaultCues(start + 0.25).columnIn[i]).toBe(1);
    }
  });

  it("holds the fan at full through the spin and softens it in the celebration", () => {
    for (const t of [3, 5, 8]) expect(vaultCues(t).rays).toBe(1);
    expect(vaultCues(12).rays).toBeLessThan(0.5);
    expect(vaultCues(1.4).rays).toBe(0);
  });

  it("kicks on the impact, every second of the spin, every lock-in and in a volley as the count-up starts", () => {
    const kicks = VAULT_CUES.fireworks;
    expect([...kicks]).toEqual([1.0, 2.5, 3.5, 4.5, 5.5, 6, 6.5, 7, 7.5, 8.5, 9.0, 9.35, 9.7, 10.05]);
    expect([...kicks].sort((a, b) => a - b)).toEqual([...kicks]);
    for (const at of kicks) {
      expect(at).toBeGreaterThanOrEqual(1);
      expect(at).toBeLessThanOrEqual(11.5);
    }
    for (const at of VAULT_LAND_TIMES) expect(kicks).toContain(at);
  });

  it("pulses gold once at 9.0", () => {
    expect(vaultCues(8.9).pulse).toBe(0);
    expect(vaultCues(9.3).pulse).toBeGreaterThan(0.9);
    expect(vaultCues(10).pulse).toBe(0);
  });
});

describe("countUp", () => {
  it("is 0 before 9.0, climbs, and rests on the total from 11.5", () => {
    expect(countUp(8.9, 1000)).toBe(0);
    const mid = countUp(10, 1000);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1000);
    expect(countUp(11.5, 1000)).toBe(1000);
    expect(countUp(14, 1000)).toBe(1000);
  });
});
