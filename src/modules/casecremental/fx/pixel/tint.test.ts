import { describe, expect, it } from "vitest";
import { scaleTint } from "./tint";

describe("scaleTint", () => {
  it("keeps the tint at full light and goes black at none", () => {
    expect(scaleTint(0xa8a8b8, 1)).toBe(0xa8a8b8);
    expect(scaleTint(0xa8a8b8, 0)).toBe(0x000000);
  });
  it("scales each channel", () => {
    expect(scaleTint(0xffffff, 0.5)).toBe(0x808080);
    expect(scaleTint(0x444455, 0.5)).toBe(0x22222b);
  });
  it("clamps the level", () => {
    expect(scaleTint(0x102030, 2)).toBe(0x102030);
    expect(scaleTint(0x102030, -1)).toBe(0);
  });
});
