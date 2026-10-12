import { describe, expect, it } from "vitest";
import type { Drop } from "../../sim/types";
import { sameIds, syncPlan } from "./CardStation";

// A station's cards follow the sim slot by slot (matched by drop id), so a reload, a machine taking one card, or a
// new pair all come out right.

const d = (id: number): Drop => ({
  id,
  caseId: "bootcamp",
  skinId: "bc_woodland",
  rarity: "milspec",
  float: 0.2,
  wear: "FT",
  statTrak: false,
  value: 1,
});

describe("syncPlan", () => {
  it("shows a new pair", () => {
    expect(syncPlan([], [d(1), d(2)])).toEqual({ show: [0, 1], clear: [] });
  });

  it("clears only the slot that went, keeping a held partner (Review Focus 5)", () => {
    expect(syncPlan([1, 2], [d(1), null])).toEqual({ show: [], clear: [1] });
    expect(syncPlan([1, 2], [null, d(2)])).toEqual({ show: [], clear: [0] });
  });

  it("clears everything when the last card goes (the sim empties the list)", () => {
    expect(syncPlan([1, null], [])).toEqual({ show: [], clear: [0] });
  });

  it("swaps every slot for the next spin's pair", () => {
    expect(syncPlan([1, 2], [d(3), d(4)])).toEqual({ show: [0, 1], clear: [0, 1] });
  });

  it("does nothing when nothing changed", () => {
    expect(syncPlan([1, 2], [d(1), d(2)])).toEqual({ show: [], clear: [] });
    expect(sameIds([1, null], [d(1), null])).toBe(true);
    expect(sameIds([1], [d(1), d(2)])).toBe(false);
    expect(sameIds([], [])).toBe(true);
  });
});
