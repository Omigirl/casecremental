import { describe, expect, it } from "vitest";
import { CASES } from "../sim/content/cases";
import { VAULTS } from "../sim/content/vaults";
import { LAST_RUN } from "../sim/tuning";
import type { Drop } from "../sim/types";
import { TROPHIES, isTrophyDrop, trophyById, trophyDropsOf } from "./trophies";

const drop = (skinId: string, rarity: Drop["rarity"]): Drop => ({
  id: 1,
  caseId: "x",
  skinId,
  rarity,
  float: 0.1,
  wear: "FN",
  statTrak: false,
  value: 1,
});

describe("trophies", () => {
  it("has every Covert and ★ skin of every case, then one legend per vault", () => {
    for (const c of CASES) {
      const mine = TROPHIES.filter((t) => t.source === c.id);
      const big = c.skins.filter((s) => s.rarity === "covert" || s.rarity === "gold");
      expect(mine.map((t) => t.id).sort()).toEqual(big.map((s) => s.id).sort());
      expect(big.length).toBe(3); // 2 Covert + 1 ★ per case
    }
    expect(TROPHIES.filter((t) => t.vault).map((t) => t.id)).toEqual(VAULTS.map((v) => v.legend.id));
    expect(TROPHIES.length).toBe(CASES.length * 3 + VAULTS.length); // F6: 9 × 3 + Vaults I–III + ★ Singularity
    expect(new Set(TROPHIES.map((t) => t.id)).size).toBe(TROPHIES.length);
    const last = VAULTS[VAULTS.length - 1]!;
    expect(trophyById(last.legend.id)).toMatchObject({ vault: true, minLoops: last.run - 1 });
  });

  it("knows the run a case first shows up in", () => {
    expect(trophyById("bc_knife")!.minLoops).toBe(0);
    const late = TROPHIES.filter((t) => t.source === CASES[CASES.length - 1]!.id);
    for (const t of late) expect(t.minLoops).toBe(LAST_RUN - 1);
  });

  it("finds the case trophies in reveal, bot, contract and vault-reel events — never a vault legend", () => {
    expect(trophyDropsOf({ type: "revealed", drops: [drop("bc_knife", "gold"), drop("bc_x", "milspec")] }).map((d) => d.skinId)).toEqual([
      "bc_knife",
    ]);
    expect(trophyDropsOf({ type: "botRevealed", drops: [drop("bc_warlord", "covert")] })).toHaveLength(1);
    expect(trophyDropsOf({ type: "pressDone", results: [drop("bc_commander", "covert")] })).toHaveLength(1);
    expect(trophyDropsOf({ type: "vaultReelLanded", index: 4, drop: drop("vault1_legend", "gold"), amount: 1 })).toEqual([]);
    expect(trophyDropsOf({ type: "vaultReelLanded", index: 1, drop: drop("bc_knife", "gold"), amount: 1 })).toHaveLength(1);
    expect(isTrophyDrop(drop("vault1_legend", "gold"))).toBe(false);
  });

  it("finds a case trophy the Upgrader pops out (Run 4), none on a loss", () => {
    const inputs = [drop("bc_x", "milspec")];
    expect(trophyDropsOf({ type: "upgraderDone", win: true, result: drop("bc_knife", "gold"), inputs })).toHaveLength(1);
    expect(trophyDropsOf({ type: "upgraderDone", win: true, result: drop("bc_x", "restricted"), inputs })).toEqual([]);
    expect(trophyDropsOf({ type: "upgraderDone", win: false, result: null, inputs })).toEqual([]);
  });
});
