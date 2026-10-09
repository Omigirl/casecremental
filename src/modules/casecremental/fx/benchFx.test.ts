import { describe, expect, it } from "vitest";
import { RARITY_INFO } from "../sim/rarity";
import type { Drop, RarityId } from "../sim/types";
import { cardBurst, glowColor } from "./benchFx";

// The bench's reveal juice: each card's sparks by rarity and pixel scale, and the glow under the best card left.

const drop = (rarity: RarityId, value = 1): Drop => ({
  id: 1,
  caseId: "bootcamp",
  skinId: "x",
  rarity,
  float: 0.1,
  wear: "MW",
  statTrak: false,
  value,
});

describe("cardBurst", () => {
  it("throws more and faster sparks for a rarer card", () => {
    const order: RarityId[] = ["milspec", "restricted", "classified", "covert", "gold"];
    const bursts = order.map((r) => cardBurst(r, 6));
    for (let i = 1; i < bursts.length; i++) {
      expect(bursts[i]!.count).toBeGreaterThan(bursts[i - 1]!.count);
      expect(bursts[i]!.speed).toBeGreaterThan(bursts[i - 1]!.speed);
    }
  });

  it("scales the speed with the pixel scale (tuned at 6), never the count", () => {
    expect(cardBurst("covert", 3)).toEqual({ count: cardBurst("covert", 6).count, speed: cardBurst("covert", 6).speed / 2 });
  });
});

describe("glowColor", () => {
  it("is the best waiting card's colour, and goes out with the last card", () => {
    expect(glowColor([drop("milspec"), drop("covert")])).toBe(RARITY_INFO.covert.color);
    expect(glowColor([null, drop("restricted")])).toBe(RARITY_INFO.restricted.color);
    expect(glowColor([null, null])).toBeNull();
    expect(glowColor([])).toBeNull();
  });
});
