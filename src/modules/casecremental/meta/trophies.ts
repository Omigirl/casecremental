import { runCaseIds } from "../sim/campaign";
import { CASES } from "../sim/content/cases";
import { VAULTS } from "../sim/content/vaults";
import type { SimEvent } from "../sim/run";
import { LAST_RUN } from "../sim/tuning";
import type { Drop, SkinDef } from "../sim/types";

// The Trophies catalog (plan F7): one server item per Covert and ★ skin of every case, plus each vault's legend.
// Built from the content tables, so a new case or vault brings its trophies along. Case trophies are reported when
// they drop; a vault's legend is granted by endRun with the vault itself.

/** The Title's item catalog id. */
export const TROPHY_CATALOG = "Trophies";

export interface TrophyDef {
  /** The catalog ItemID: the skin's id. */
  id: string;
  skin: SkinDef;
  rarity: "covert" | "gold";
  /** The case it drops from, or the vault's id for a legend. */
  source: string;
  /** Vaults opened before it can drop: its case's first run − 1, or the vault's run − 1. */
  minLoops: number;
  /** A vault legend (granted by endRun, never by reportTrophy). */
  vault: boolean;
}

const firstRunOf = (caseId: string): number => {
  for (let run = 1; run <= LAST_RUN; run++) if (runCaseIds(run).includes(caseId)) return run;
  return LAST_RUN;
};

export const TROPHIES: readonly TrophyDef[] = [
  ...CASES.flatMap((c) =>
    c.skins
      .filter((s) => s.rarity === "covert" || s.rarity === "gold")
      .map((s) => ({
        id: s.id,
        skin: s,
        rarity: s.rarity as "covert" | "gold",
        source: c.id,
        minLoops: firstRunOf(c.id) - 1,
        vault: false,
      })),
  ),
  ...VAULTS.map((v) => ({ id: v.legend.id, skin: v.legend, rarity: "gold" as const, source: v.id, minLoops: v.run - 1, vault: true })),
];

const BY_ID = new Map(TROPHIES.map((t) => [t.id, t]));

export const trophyById = (id: string): TrophyDef | undefined => BY_ID.get(id);

/** A case trophy — a vault legend is not reported, endRun pays it. */
export const isTrophyDrop = (d: Drop): boolean => BY_ID.get(d.skinId)?.vault === false;

/** The case trophies an event shows the player. */
export function trophyDropsOf(e: SimEvent): Drop[] {
  switch (e.type) {
    case "revealed":
    case "botRevealed":
      return e.drops.filter(isTrophyDrop);
    case "pressDone":
      return e.results.filter(isTrophyDrop);
    case "vaultReelLanded":
      return isTrophyDrop(e.drop) ? [e.drop] : [];
    default:
      return [];
  }
}
