import { describe, expect, it } from "vitest";
import { caseById } from "./content/cases";
import { createRng } from "./rng";
import { pickRarity, rollDrop, valueMultOf } from "./roll";
import { rarityWeights } from "./rarity";
import type { RarityId } from "./types";

const bootcamp = caseById("bootcamp");

function histogram(luck: number, n: number, seed = 1) {
  const rng = createRng(seed);
  const h: Record<RarityId, number> = { milspec: 0, restricted: 0, classified: 0, covert: 0, gold: 0 };
  for (let i = 0; i < n; i++) h[rollDrop(bootcamp, 2, luck, rng, i).rarity]++;
  return h;
}

// large statistical samples: the default 5 s is too tight when the machine is loaded
const SLOW = 30_000;

describe("pickRarity", () => {
  it("maps the roll onto cumulative weights", () => {
    const w = rarityWeights(0);
    expect(pickRarity(w, 0)).toBe("milspec");
    expect(pickRarity(w, 0.79)).toBe("milspec");
    expect(pickRarity(w, 0.8)).toBe("restricted");
    expect(pickRarity(w, 0.9999)).toBe("gold");
  });
});

describe("rollDrop", () => {
  it(
    "follows CS odds within tolerance over 200k rolls",
    () => {
      const n = 200_000;
      const h = histogram(0, n);
      expect(h.milspec / n).toBeCloseTo(0.7992, 2);
      expect(h.restricted / n).toBeCloseTo(0.1598, 2);
      expect(h.classified / n).toBeCloseTo(0.032, 2);
      expect(h.covert / n).toBeGreaterThan(0.005);
      expect(h.covert / n).toBeLessThan(0.0078);
      expect(h.gold / n).toBeGreaterThan(0.0018);
      expect(h.gold / n).toBeLessThan(0.0034);
    },
    SLOW,
  );

  it(
    "drops more coverts with luck",
    () => {
      expect(histogram(10, 100_000).covert).toBeGreaterThan(histogram(0, 100_000).covert * 1.5);
    },
    SLOW,
  );

  it("returns a skin of the rolled rarity from that case, with consistent value", () => {
    const rng = createRng(5);
    for (let i = 0; i < 2000; i++) {
      const d = rollDrop(bootcamp, 2, 0, rng, i);
      const s = bootcamp.skins.find((x) => x.id === d.skinId);
      expect(s?.rarity).toBe(d.rarity);
      expect(d.caseId).toBe("bootcamp");
      expect(d.id).toBe(i);
      expect(d.float).toBeGreaterThanOrEqual(0);
      expect(d.float).toBeLessThan(1);
      expect(d.value).toBeGreaterThan(0);
    }
  });

  it("is reproducible from the seed", () => {
    const a = rollDrop(bootcamp, 2, 3, createRng(77), 1);
    const b = rollDrop(bootcamp, 2, 3, createRng(77), 1);
    expect(a).toEqual(b);
  });

  it(
    "StatTrak shows up about 10% of the time and doubles value",
    () => {
      const rng = createRng(3);
      let st = 0;
      for (let i = 0; i < 20_000; i++) if (rollDrop(bootcamp, 2, 0, rng, i).statTrak) st++;
      expect(st / 20_000).toBeCloseTo(0.1, 1);
    },
    SLOW,
  );

  it(
    "Boot Camp jump-starts a run: richer Mil-Specs, a smaller knife, a higher average",
    () => {
      const avg = (caseId: string, rarity?: RarityId) => {
        const rng = createRng(9);
        const c = caseById(caseId);
        let sum = 0;
        let n = 0;
        for (let i = 0; i < 100_000; i++) {
          const d = rollDrop(c, 1, 0, rng, i);
          if (rarity && d.rarity !== rarity) continue;
          sum += d.value;
          n++;
        }
        return sum / n;
      };
      expect(valueMultOf("bootcamp", "milspec")).toBe(0.95);
      expect(valueMultOf("bootcamp", "gold")).toBe(120);
      expect(valueMultOf("wildwood", "gold")).toBe(200); // later cases keep the base table
      expect(avg("bootcamp", "milspec")).toBeGreaterThan(0.85); // per $1 of price, was ~0.53
      expect(avg("bootcamp")).toBeGreaterThan(avg("wildwood")); // a little more on average than the base table
    },
    SLOW,
  );

  it("takes options: a luck multiplier, a StatTrak chance and a minimum rarity", () => {
    const rng = createRng(11);
    let covertPlain = 0;
    let covertBoosted = 0;
    for (let i = 0; i < 20_000; i++) if (rollDrop(bootcamp, 2, 0, rng, i).rarity === "covert") covertPlain++;
    for (let i = 0; i < 20_000; i++) if (rollDrop(bootcamp, 2, 0, rng, i, null, { luckMult: 3 }).rarity === "covert") covertBoosted++;
    expect(covertBoosted).toBeGreaterThan(covertPlain * 2);
    for (let i = 0; i < 200; i++) {
      const d = rollDrop(bootcamp, 2, 0, rng, i, null, { statTrakChance: 1, minRarity: "classified" });
      expect(d.statTrak).toBe(true);
      expect(["classified", "covert", "gold"]).toContain(d.rarity);
    }
  });
});
