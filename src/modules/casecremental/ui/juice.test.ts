import { describe, expect, it } from "vitest";
import { comboTint } from "./juice";

describe("comboTint (review fix: the combo tints the screen, spec §8.4)", () => {
  it("is invisible without a combo", () => {
    expect(comboTint(0).alpha).toBe(0);
    expect(comboTint(1).alpha).toBe(0);
  });

  it("deepens with the combo and caps", () => {
    expect(comboTint(10).alpha).toBeGreaterThan(comboTint(5).alpha);
    expect(comboTint(50).alpha).toBeCloseTo(0.16);
    expect(comboTint(500).alpha).toBeCloseTo(0.16);
  });

  it("shifts hue from cool to hot as the combo grows", () => {
    expect(comboTint(50).hue).toBeLessThan(comboTint(5).hue);
  });
});
