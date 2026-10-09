import { describe, expect, it } from "vitest";
import { chestFrame, snapStretch } from "./chest";
import { VAULT_CUES } from "./cues";

const shut = { lid: 0, seam: 0 };
const { impact } = VAULT_CUES;

describe("the vault's frame", () => {
  it("is closed while the key waits, its seam lit when the key is over the lock", () => {
    expect(chestFrame(null, false, shut)).toBe(0);
    expect(chestFrame(null, true, shut)).toBe(1);
  });

  it("lights its seam once the tremble has widened it a little", () => {
    expect(chestFrame(0.5, false, { lid: 0, seam: 0.1 })).toBe(0);
    expect(chestFrame(0.8, false, { lid: 0, seam: 0.5 })).toBe(1);
  });

  it("shows the in-between frame for a moment after the impact, then stays open", () => {
    expect(chestFrame(impact, false, { lid: 1.1, seam: 0 })).toBe(2);
    expect(chestFrame(impact + 0.04, false, { lid: 1.1, seam: 0 })).toBe(2);
    expect(chestFrame(impact + 0.06, false, { lid: 1, seam: 0 })).toBe(3);
    expect(chestFrame(9, false, { lid: 1, seam: 0 })).toBe(3);
  });
});

describe("the lid's overshoot", () => {
  it("leaves the vault alone until the lid goes past open", () => {
    expect(snapStretch(0)).toEqual({ sx: 1, sy: 1 });
    expect(snapStretch(1)).toEqual({ sx: 1, sy: 1 });
  });

  it("stretches the open frame up while it narrows", () => {
    const s = snapStretch(1.1);
    expect(s.sy).toBeCloseTo(1.25);
    expect(s.sx).toBeCloseTo(0.9);
  });
});
