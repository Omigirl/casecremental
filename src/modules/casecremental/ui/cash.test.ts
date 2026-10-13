import { describe, expect, it } from "vitest";
import { formatCash } from "../sim/format";
import { cashTweenAt } from "./cash";

describe("HUD cash counter", () => {
  it("keeps the cents a whole-number counter would drop", () => {
    expect(formatCash(cashTweenAt(0, 8.49, 1))).toBe("$8.49");
    expect(formatCash(cashTweenAt(8.49, 0.07, 1))).toBe("$0.07");
    expect(formatCash(cashTweenAt(0, 8.49, 0.5))).toMatch(/^\$\d\.\d\d$/);
  });

  it("lands on a run's $6 after a huge balance (no float cancellation)", () => {
    for (const from of [1e17, 1e19, 1e22, 9.007e15]) {
      expect(cashTweenAt(from, 6, 1)).toBe(6);
      expect(formatCash(cashTweenAt(from, 6, 1))).toBe("$6.00");
    }
  });

  it("stays between the ends and only falls on the way down from a huge balance", () => {
    let last = Infinity;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const v = cashTweenAt(1e19, 6, p);
      expect(v).toBeGreaterThanOrEqual(6);
      expect(v).toBeLessThanOrEqual(1e19);
      expect(v).toBeLessThanOrEqual(last);
      last = v;
    }
    expect(last).toBe(6);
  });

  it("starts at the old amount and shows big and infinite amounts as they are", () => {
    expect(cashTweenAt(12_345.6, 99, 0)).toBe(12_345.6);
    expect(formatCash(cashTweenAt(1, 12_345.6, 1))).toBe(formatCash(12_345.6));
    expect(formatCash(cashTweenAt(5, Infinity, 0.3))).toBe("$∞");
    expect(cashTweenAt(Infinity, 6, 0.3)).toBe(6);
  });
});
