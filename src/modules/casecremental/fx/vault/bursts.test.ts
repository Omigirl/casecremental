import { describe, expect, it } from "vitest";
import { RARITY_INFO } from "../../sim/rarity";
import type { Drop } from "../../sim/types";
import { burstColor, FIREWORK_COLORS, introSpot, kickSpot } from "./bursts";
import { INTRO_HITS } from "./cues";

const screen = { w: 1000, h: 500 };
const still = () => 0.5;

describe("where the vault's bursts go off", () => {
  it("puts the same kick on the same spot, wrapping, jittered a little", () => {
    expect(kickSpot(0, screen, still)).toEqual({ x: 500, y: 70 });
    expect(kickSpot(10, screen, still)).toEqual(kickSpot(0, screen, still));
    const lo = kickSpot(0, screen, () => 0);
    const hi = kickSpot(0, screen, () => 0.999);
    expect(lo.x).toBeCloseTo(440, 6);
    expect(hi.x).toBeLessThan(560);
  });

  it("gives each run-up hit a spot of its own, swinging from side to side", () => {
    const run = INTRO_HITS.flatMap((h, i) => (h.kind === "run" ? [introSpot(i, screen, still)] : []));
    expect(run).toHaveLength(5);
    expect(new Set(run.map((p) => `${p.x},${p.y}`)).size).toBe(5);
    for (let i = 1; i < run.length; i++) expect(Math.abs(run[i]!.x - run[i - 1]!.x), `hit ${i}`).toBeGreaterThanOrEqual(0.3 * screen.w);
    for (const p of run) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(screen.w);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(screen.h);
    }
  });

  it("colours a burst mostly by what has landed, else festively", () => {
    expect(FIREWORK_COLORS).toContain(burstColor([], () => 0));
    const gold = [{ rarity: "gold" } as Drop];
    expect(burstColor(gold, () => 0.1)).toBe(RARITY_INFO.gold.color);
    expect(FIREWORK_COLORS).toContain(burstColor(gold, () => 0.7));
  });
});
