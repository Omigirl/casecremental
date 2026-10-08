import { describe, expect, it } from "vitest";
import { formatCash } from "./format";

describe("formatCash", () => {
  it.each([
    [0, "$0.00"],
    [0.004, "$0.00"],
    [1.5, "$1.50"],
    [9.999, "$10.00"],
    [12.4, "$12"],
    [999, "$999"],
    [1_000, "$1.00K"],
    [12_345, "$12.3K"],
    [999_499, "$999K"],
    [1_500_000, "$1.50M"],
    [2.5e9, "$2.50B"],
    [7.25e12, "$7.25T"],
    [1e33, "$1.00Dc"],
    [1e36, "$1.00e36"],
    [-12.4, "-$12"],
  ])("formats %s as %s", (n, text) => {
    expect(formatCash(n)).toBe(text);
  });

  it.each([NaN, Infinity, -Infinity])("never prints %s", (n) => {
    const text = formatCash(n);
    expect(text).not.toMatch(/NaN|Infinity/);
  });
});

describe("formatCash at rounding boundaries (deferred minor fix)", () => {
  it.each([
    [999.6, "$1.00K"],
    [999_500, "$1.00M"],
    [999_999, "$1.00M"],
    [999_999_999, "$1.00B"],
  ])("rounds %s up into the next suffix: %s", (n, text) => {
    expect(formatCash(n)).toBe(text);
  });

  it("never prints a minus sign on an amount that rounds to zero", () => {
    expect(formatCash(-0.004)).toBe("$0.00");
    expect(formatCash(-0.006)).toBe("-$0.01");
  });
});
describe("formatCash in Russian", () => {
  it.each([
    [12_345, "$12,3K"],
    [1.5, "$1,50"],
    [999, "$999"],
    [2.5e9, "$2,50B"],
  ])("formats %s as %s", (n, text) => {
    expect(formatCash(n, "ru")).toBe(text);
  });
});
