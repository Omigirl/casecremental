import { describe, expect, it } from "vitest";
import { CASES, caseById, priceOf, skinById, unlockCostOf } from "./cases";
import { RARITY_ORDER } from "../rarity";
import type { RarityId } from "../types";

describe("cases", () => {
  it("has nine cases in ladder order", () => {
    expect(CASES.map((c) => c.id)).toEqual([
      "bootcamp",
      "wildwood",
      "bedrock",
      "mainframe",
      "neon",
      "deepspace",
      "inferno",
      "glitch",
      "feverdream",
    ]);
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

  it("has a skin of every rarity in every case (the Upgrader picks its target skin from the case)", () => {
    for (const c of CASES)
      for (const r of RARITY_ORDER)
        expect(
          c.skins.some((s) => s.rarity === r),
          `${c.id} ${r}`,
        ).toBe(true);
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

  it("every ★ knife of cases 1-3 shimmers and flips; every other skin there is still", () => {
    for (const c of CASES.slice(0, 3))
      for (const s of c.skins) expect(s.motion).toEqual(s.rarity === "gold" ? { pattern: "shimmer", weapon: "flip", fps: 5 } : undefined);
  });

  it("never reuses a pattern technique from an earlier case (each case is richer)", () => {
    const seen = new Set<string>();
    for (const c of CASES.slice(3)) {
      const kinds = new Set(c.skins.map((s) => s.pattern.kind));
      for (const k of kinds) expect(seen.has(k), `${c.id} reuses ${k}`).toBe(false);
      for (const k of kinds) seen.add(k);
    }
  });

  it("moves more in each later case", () => {
    const moving = (id: string) => caseById(id).skins.filter((s) => s.motion).length;
    expect(moving("mainframe")).toBeGreaterThanOrEqual(5); // Classified+
    expect(moving("neon")).toBeGreaterThanOrEqual(8); // Restricted+
    expect(moving("deepspace")).toBe(13);
    expect(moving("inferno")).toBe(13);
    expect(moving("glitch")).toBe(13);
    expect(moving("feverdream")).toBe(13);
  });

  it("gives Glitch and Fever Dream their own finishes and motions", () => {
    const kinds = (id: string) => new Set(caseById(id).skins.map((s) => s.pattern.kind));
    expect(kinds("glitch")).toEqual(new Set(["datamosh", "scanline", "rgbsplit"]));
    expect(kinds("feverdream")).toEqual(new Set(["melt", "kaleido", "huecycle"]));
    for (const s of caseById("glitch").skins) expect(s.motion?.pattern, s.id).toBe("glitch");
    for (const s of caseById("feverdream").skins) expect(["drip", "flow"], s.id).toContain(s.motion?.pattern);
    for (const id of ["glitch", "feverdream"]) expect(caseById(id).skins.find((x) => x.rarity === "gold")?.motion?.weapon).toBe("flip");
  });

  it("prices every case ten times the one before", () => {
    for (let i = 1; i < CASES.length; i++) expect(priceOf(CASES[i]!.id) / priceOf(CASES[i - 1]!.id)).toBeGreaterThanOrEqual(7);
  });

  it("each case holds 5 Mil-Spec, 3 Restricted, 2 Classified, 2 Covert and a knife", () => {
    for (const c of CASES) {
      const n = (r: RarityId) => c.skins.filter((s) => s.rarity === r).length;
      expect([n("milspec"), n("restricted"), n("classified"), n("covert"), n("gold")], c.id).toEqual([5, 3, 2, 2, 1]);
    }
  });
});
