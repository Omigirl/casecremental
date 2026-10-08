import { describe, expect, it } from "vitest";
import { cssColor, formatSpeed, nextThreshold, SELL_THRESHOLDS } from "./botBoard";

describe("the Bot tab helpers", () => {
  it("cycles the sell threshold through every rarity and back", () => {
    let r = SELL_THRESHOLDS[0]!;
    const seen = [r];
    for (let i = 0; i < SELL_THRESHOLDS.length; i++) seen.push((r = nextThreshold(r)));
    expect(seen.slice(0, SELL_THRESHOLDS.length)).toEqual([...SELL_THRESHOLDS]);
    expect(seen[SELL_THRESHOLDS.length]).toBe(SELL_THRESHOLDS[0]);
  });

  it("writes the speed with one decimal at most, in the player's language", () => {
    expect(formatSpeed(1, "en")).toBe("1");
    expect(formatSpeed(8, "en")).toBe("8");
    expect(formatSpeed(1.5157, "en")).toBe("1.5");
    expect(formatSpeed(1.5157, "ru")).toBe("1,5");
  });

  it("turns a Pixi colour into CSS", () => {
    expect(cssColor(0xffd700)).toBe("#ffd700");
    expect(cssColor(0x0000ff)).toBe("#0000ff");
  });
});
