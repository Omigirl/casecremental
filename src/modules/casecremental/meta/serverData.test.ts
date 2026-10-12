import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { charmPool } from "../sim/charms";
import { cloutFor, perkCost, PERK_IDS } from "../sim/meta";
import { LAST_RUN } from "../sim/tuning";
import { buildServerData, buildTrophyItems } from "./serverData";
import { TROPHIES } from "./trophies";

// cloudcode/data.json and cloudcode/config/trophies.items.json are generated from the content tables.
// Regenerate: UPDATE_CLOUD=1 npx vitest run src/modules/casecremental/meta/serverData.test.ts
// (PowerShell: $env:UPDATE_CLOUD=1; npx vitest run …; Remove-Item Env:UPDATE_CLOUD), then `npm run cloud`.
const DATA_FILE = new URL("../../../../cloudcode/data.json", import.meta.url);
const ITEMS_FILE = new URL("../../../../cloudcode/config/trophies.items.json", import.meta.url);

function synced(file: URL, value: unknown): void {
  if (process.env.UPDATE_CLOUD) writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
  expect(JSON.parse(readFileSync(file, "utf8")), `${file.pathname} is stale — regenerate it (see the header)`).toEqual(value);
}

describe("server data", () => {
  it("is in sync with cloudcode/data.json", () => synced(DATA_FILE, buildServerData()));
  it("is in sync with cloudcode/config/trophies.items.json", () => synced(ITEMS_FILE, buildTrophyItems()));

  it("carries the client's perk costs, CLOUT rule and charms", () => {
    const d = buildServerData();
    for (const id of PERK_IDS) {
      const p = d.perks[id]!;
      for (let lv = 0; lv <= p.maxLevel; lv++) {
        const server = lv >= p.maxLevel ? null : Math.ceil(p.baseCost * p.growth ** lv);
        expect(server).toBe(perkCost(id, lv));
      }
    }
    for (const e of [0, 1, 99, 1.2e6, 4.2e11, 1e18]) expect(Math.floor(Math.sqrt(e) / d.cloutDivisor)).toBe(cloutFor(e));
    expect(d.charms).toEqual([...charmPool(LAST_RUN)]);
  });

  it("makes one non-stackable, non-tradable Trophies item per trophy", () => {
    const items = buildTrophyItems().Catalogs.Trophies!.Items;
    expect(Object.keys(items).sort()).toEqual(TROPHIES.map((t) => t.id).sort());
    expect(items.bc_knife).toMatchObject({
      ItemID: "bc_knife",
      CatalogID: "Trophies",
      IsStackable: false,
      IsTradable: false,
      Metadata: { RarityID: "Star", CollectionID: "bootcamp" },
    });
  });
});
