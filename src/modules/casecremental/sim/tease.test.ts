import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import { rollTease, teaseStrength } from "./tease";
import { FAKE_TEASE_CHANCE, TEASE_CRAWL } from "./tuning";
import type { RarityId } from "./types";

describe("teaseStrength", () => {
  it("is full for a knife in the top case and fades for cheaper cases and reds", () => {
    expect(teaseStrength("gold", 3, 3)).toBe(1);
    expect(teaseStrength("covert", 3, 3)).toBeCloseTo(0.6);
    expect(teaseStrength("gold", 2, 3)).toBeCloseTo(0.3);
    expect(teaseStrength("gold", 1, 3)).toBeCloseTo(0.1);
    expect(teaseStrength("covert", 1, 3)).toBeCloseTo(0.06);
    expect(teaseStrength("milspec", 3, 3)).toBe(0);
  });
});

describe("rollTease", () => {
  const roll = (rarity: RarityId, spin = 3, seed = 1) => rollTease(rarity, 1, 1, spin, createRng(seed));

  it("always teases a red or a knife, longer for a slower reel (Quick Hands shortens it)", () => {
    const gold = roll("gold", 3)!;
    expect(gold.fake).toBeNull();
    expect(gold.strength).toBe(1);
    expect(gold.extraSeconds).toBeCloseTo(TEASE_CRAWL * 3);
    expect(roll("gold", 1.5)!.extraSeconds).toBeCloseTo(TEASE_CRAWL * 1.5);
    expect(roll("covert")!.strength).toBeCloseTo(0.6);
  });

  it("a forced fake (dev board) always fakes an ordinary drop, and leaves a real one real", () => {
    for (let s = 0; s < 50; s++) {
      expect(rollTease("milspec", 1, 1, 3, createRng(s), true)!.fake).not.toBeNull();
      expect(rollTease("gold", 1, 1, 3, createRng(s), true)!.fake).toBeNull();
    }
  });

  it("fakes one now and then on an ordinary drop, never on a red or a knife", () => {
    const rng = createRng(7);
    let fakes = 0;
    const decoys = new Set<RarityId>();
    for (let i = 0; i < 24_000; i++) {
      const t = rollTease("milspec", 1, 1, 3, rng);
      if (t) {
        fakes++;
        expect(t.fake).not.toBeNull();
        decoys.add(t.fake!);
        expect(t.strength).toBeCloseTo(0.6); // teased as if it were a red
      }
    }
    expect(fakes / 24_000).toBeGreaterThan(FAKE_TEASE_CHANCE * 0.85);
    expect(fakes / 24_000).toBeLessThan(FAKE_TEASE_CHANCE * 1.15);
    expect([...decoys].sort()).toEqual(["covert", "gold"]);
    for (let s = 0; s < 200; s++) {
      expect(rollTease("covert", 1, 1, 3, createRng(s))!.fake).toBeNull();
      expect(rollTease("gold", 1, 1, 3, createRng(s))!.fake).toBeNull();
    }
  });
});
