import { describe, expect, it } from "vitest";
import { formatCash } from "../sim/format";
import { fromCents, toCents } from "./cash";

// The SDK's useAnimatedNumber rounds to whole numbers; the HUD feeds it cents.
const wholeNumberCounter = (n: number) => Math.round(n);

describe("HUD cash counter", () => {
  it("keeps the cents a whole-number counter would drop", () => {
    expect(formatCash(fromCents(wholeNumberCounter(toCents(8.49))))).toBe("$8.49");
    expect(formatCash(fromCents(wholeNumberCounter(toCents(0.07))))).toBe("$0.07");
  });

  it("shows big amounts the same as before", () => {
    expect(formatCash(fromCents(wholeNumberCounter(toCents(12_345.6))))).toBe(formatCash(12_345.6));
    expect(formatCash(fromCents(wholeNumberCounter(toCents(Infinity))))).toBe("$∞");
  });
});
