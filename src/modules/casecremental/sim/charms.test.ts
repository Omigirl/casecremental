import { describe, expect, it } from "vitest";
import { charmMinRarity, charmPriceMult, charmStatTrakChance, charmValueMult, RUN1_CHARMS } from "./charms";
import { STATTRAK_CHANCE } from "./tuning";
import type { Drop } from "./types";

const drop = (over: Partial<Drop>): Drop => ({
  id: 1,
  caseId: "bootcamp",
  skinId: "bc_woodland",
  rarity: "milspec",
  float: 0.2,
  wear: "FT",
  statTrak: false,
  value: 1,
  ...over,
});

describe("Run 1 charms", () => {
  it("has the eight charms that work with Run 1's systems", () => {
    expect([...RUN1_CHARMS].sort()).toEqual(
      ["doubleTap", "goldRush", "insider", "luckySeven", "milSpecManiac", "pityJar", "ricochet", "rustBucket"].sort(),
    );
  });

  it("Rust Bucket pays Battle-Scarred at Factory New price", () => {
    expect(charmValueMult(["rustBucket"], drop({ wear: "BS" }))).toBeCloseTo(1.5 / 0.7);
    expect(charmValueMult(["rustBucket"], drop({ wear: "FT" }))).toBe(1);
  });

  it("Gold Rush pays ★ ×10; Mil-Spec Maniac ×4 Mil-Spec and ×0.5 everything else", () => {
    expect(charmValueMult(["goldRush"], drop({ rarity: "gold" }))).toBe(10);
    expect(charmValueMult(["milSpecManiac"], drop({ rarity: "milspec" }))).toBe(4);
    expect(charmValueMult(["milSpecManiac"], drop({ rarity: "covert" }))).toBe(0.5);
    expect(charmValueMult([], drop({ rarity: "gold" }))).toBe(1);
  });

  it("Insider, Double Tap and Lucky Seven", () => {
    expect(charmPriceMult(["insider"])).toBe(0.7);
    expect(charmPriceMult([])).toBe(1);
    expect(charmStatTrakChance(["doubleTap"])).toBeCloseTo(STATTRAK_CHANCE * 3);
    expect(charmMinRarity(["luckySeven"], 7)).toBe("classified");
    expect(charmMinRarity(["luckySeven"], 8)).toBeNull();
    expect(charmMinRarity([], 7)).toBeNull();
  });
});
