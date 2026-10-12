import { charmPool } from "../sim/charms";
import { skinDisplayName } from "../sim/content/cases";
import { VAULTS } from "../sim/content/vaults";
import { PERK_IDS } from "../sim/meta";
import {
  CLOUT_DIVISOR,
  LAST_RUN,
  MAX_OPENS_PER_SECOND,
  PERK_COSTS,
  SERVER_CAP,
  SERVER_FIRST_RUN_MAX_SEC,
  TROPHIES_PER_RUN_MINUTE,
  TROPHY_GAP_SEC,
} from "../sim/tuning";
import { TROPHIES, TROPHY_CATALOG } from "./trophies";

// What the server must know about the game (plan F7), built from the same tables the client plays with:
// cloudcode/data.json (prepended to the CloudCode script by tools/cloud/bundle.mjs) and the Trophies catalog
// payload for the Title (cloudcode/config/trophies.items.json). meta/serverData.test.ts keeps both files in sync.

export interface ServerData {
  v: 1;
  trophies: Record<string, { rarity: "covert" | "gold"; source: string; minLoops: number; vault: boolean }>;
  /** Indexed by loops (clamped to the last): the trophy endRun expects and the legend it grants. */
  vaults: Array<{ trophy: string; legend: string }>;
  perks: Record<string, { baseCost: number; growth: number; maxLevel: number }>;
  charms: string[];
  cloutDivisor: number;
  cap: typeof SERVER_CAP;
  firstRunMaxSec: number;
  trophyGapSec: number;
  trophiesPerRunMinute: number;
  maxOpensPerSecond: number;
}

export function buildServerData(): ServerData {
  return {
    v: 1,
    trophies: Object.fromEntries(TROPHIES.map((t) => [t.id, { rarity: t.rarity, source: t.source, minLoops: t.minLoops, vault: t.vault }])),
    vaults: VAULTS.map((v) => ({ trophy: v.trophy, legend: v.legend.id })),
    perks: Object.fromEntries(PERK_IDS.map((id) => [id, { ...PERK_COSTS[id] }])),
    charms: [...charmPool(LAST_RUN)],
    cloutDivisor: CLOUT_DIVISOR,
    cap: SERVER_CAP,
    firstRunMaxSec: SERVER_FIRST_RUN_MAX_SEC,
    trophyGapSec: TROPHY_GAP_SEC,
    trophiesPerRunMinute: TROPHIES_PER_RUN_MINUTE,
    maxOpensPerSecond: MAX_OPENS_PER_SECOND,
  };
}

/** The Title's Item section with only the Trophies catalog (merged into what the Title has before save_item). */
export function buildTrophyItems(): { Catalogs: Record<string, { Items: Record<string, Record<string, unknown>> }> } {
  const items = TROPHIES.map((t) => [
    t.id,
    {
      ItemID: t.id,
      CatalogID: TROPHY_CATALOG,
      ItemClass: "Trophy",
      DisplayName: skinDisplayName(t.skin),
      Description: t.vault ? `${t.source} legend` : `${t.source} ${t.rarity === "gold" ? "★" : "Covert"}`,
      Tags: ["trophy", t.rarity, t.source],
      IsStackable: false,
      IsTradable: false,
      Weight: 0,
      Metadata: { RarityID: t.rarity === "gold" ? "Star" : "Covert", CollectionID: t.source },
      CustomData: { skinId: t.id, source: t.source },
    },
  ]);
  return { Catalogs: { [TROPHY_CATALOG]: { Items: Object.fromEntries(items) } } };
}
