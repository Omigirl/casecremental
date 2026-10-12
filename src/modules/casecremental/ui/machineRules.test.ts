import { describe, expect, it } from "vitest";
import { GRID_RESERVES, TRADE_UP_COUNT } from "../sim/tuning";
import type { RarityId } from "../sim/types";
import { capKey, COLLECT_CYCLE, nextCollect, nextReserve, percent, tradeUpProgress } from "./machineRules";

const counts = (c: Partial<Record<RarityId, number>>): Record<RarityId, number> => ({
  milspec: 0,
  restricted: 0,
  classified: 0,
  covert: 0,
  gold: 0,
  ...c,
});

describe("the Machines tab's helpers", () => {
  it("cycles Collect through off and every rarity a contract takes, never ★", () => {
    let r: RarityId | null = null;
    const seen = [r];
    for (let i = 0; i < COLLECT_CYCLE.length; i++) seen.push((r = nextCollect(r)));
    expect(seen).toEqual([null, "milspec", "restricted", "classified", "covert", null]);
    expect(COLLECT_CYCLE).not.toContain("gold");
  });

  it("cycles the grid's reserve 25 → 50 → 75 → 25 %", () => {
    expect(GRID_RESERVES).toEqual([0.25, 0.5, 0.75]);
    expect([0.25, 0.5, 0.75].map(nextReserve)).toEqual([0.5, 0.75, 0.25]);
    expect(nextReserve(0.4)).toBe(0.25); // an unknown value starts the cycle over
    expect(percent(0.75)).toBe(75);
  });

  it("counts TRADE UP toward the ready rarity, else the Collect one, else the fullest below ★", () => {
    expect(tradeUpProgress(counts({ milspec: 12, restricted: 3 }), "restricted", "milspec")).toEqual({
      rarity: "milspec",
      n: TRADE_UP_COUNT,
      of: TRADE_UP_COUNT,
    });
    expect(tradeUpProgress(counts({ milspec: 7, restricted: 3 }), "restricted", null)).toEqual({
      rarity: "restricted",
      n: 3,
      of: TRADE_UP_COUNT,
    });
    expect(tradeUpProgress(counts({ milspec: 2, classified: 6, gold: 9 }), null, null)).toEqual({
      rarity: "classified",
      n: 6,
      of: TRADE_UP_COUNT,
    });
    expect(tradeUpProgress(counts({}), null, null).rarity).toBe("milspec");
  });

  it("says NEXT RUN on a cap a later run lifts, MAX otherwise", () => {
    expect(capKey(true)).toBe("cap.nextrun");
    expect(capKey(false)).toBe("btn.max");
  });
});
