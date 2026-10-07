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
