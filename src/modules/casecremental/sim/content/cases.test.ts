import { describe, expect, it } from "vitest";
import { CASES, caseById, priceOf, skinById, unlockCostOf } from "./cases";

describe("cases", () => {
  it("has the first three cases in ladder order", () => {
    expect(CASES.map((c) => c.id)).toEqual(["bootcamp", "wildwood", "bedrock"]);
    CASES.forEach((c, i) => expect(c.tier).toBe(i + 1));
  });

  it("gets pricier up the ladder", () => {
    for (let i = 1; i < CASES.length; i++) {
      expect(priceOf(CASES[i]!.id)).toBeGreaterThan(priceOf(CASES[i - 1]!.id));
      expect(unlockCostOf(CASES[i]!.id)).toBeGreaterThan(unlockCostOf(CASES[i - 1]!.id));
    }
  });

  it.each(CASES.map((c) => [c.id, c] as const))("%s has 5 / 3 / 2 / 2 / 1 skins by rarity", (_id, c) => {
    const count = (r: string) => c.skins.filter((s) => s.rarity === r).length;
    expect([count("milspec"), count("restricted"), count("classified"), count("covert"), count("gold")]).toEqual([5, 3, 2, 2, 1]);
    expect(c.skins.find((s) => s.rarity === "gold")?.weapon).toBe("knife");
  });

  it("uses globally unique skin ids and valid palettes", () => {
    const ids = CASES.flatMap((c) => c.skins.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CASES)
      for (const s of c.skins) {
        expect(s.pattern.palette.length).toBeGreaterThanOrEqual(2);
        for (const hex of s.pattern.palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      }
  });

  it("looks up by id and refuses unknown ids", () => {
    expect(caseById("wildwood").name).toBe("Wildwood Case");
    expect(skinById(CASES[0]!.skins[0]!.id)).toBe(CASES[0]!.skins[0]);
    expect(() => caseById("nope")).toThrow(/nope/);
    expect(() => priceOf("nope")).toThrow(/nope/);
  });

  it("every ★ knife shimmers and flips; every other skin in cases 1–3 is still", () => {
    for (const c of CASES)
      for (const s of c.skins) expect(s.motion).toEqual(s.rarity === "gold" ? { pattern: "shimmer", weapon: "flip" } : undefined);
  });
});
