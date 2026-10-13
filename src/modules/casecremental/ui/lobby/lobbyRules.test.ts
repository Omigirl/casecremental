import { describe, expect, it } from "vitest";
import { TROPHIES } from "../../meta/trophies";
import { boardRows, ownedTrophyIds, rowLabel, shortAddress, trophyGroups, walletsFrom } from "./lobbyRules";

describe("trophy case", () => {
  it("reads the owned Trophies items, ignoring other catalogs", () => {
    expect([...ownedTrophyIds({ a: { ItemID: "bc_knife", CatalogID: "Trophies" }, b: { ItemID: "x", CatalogID: "Other" } })]).toEqual([
      "bc_knife",
    ]);
    expect(ownedTrophyIds(undefined).size).toBe(0);
  });

  it("adds the trophies the server answered (the client's inventory can lag behind CloudCode), known ids only", () => {
    expect([...ownedTrophyIds({ a: { ItemID: "bc_knife", CatalogID: "Trophies" } }, ["vault1_legend", "bc_knife", "nope"])].sort()).toEqual(
      ["bc_knife", "vault1_legend"],
    );
  });

  it("groups every trophy by case, then the vaults, in content order", () => {
    const groups = trophyGroups(new Set(["bc_knife"]));
    expect(groups.flatMap((g) => g.cells).length).toBe(TROPHIES.length);
    expect(groups[0]!.source).toBe("bootcamp");
    expect(groups[0]!.cells.find((c) => c.id === "bc_knife")!.owned).toBe(true);
    expect(groups[groups.length - 1]!.source).toBe("vaults");
    expect(groups[groups.length - 1]!.cells.every((c) => c.vault)).toBe(true);
  });
});

describe("leaderboard", () => {
  it("ranks rows, turns scores back into earnings, marks me, keeps names and wallets", () => {
    const rows = boardRows(
      [
        { UserID: "b", Score: 9000, Rank: 2, PublicProfile: { Username: "" } },
        { UserID: "a", Score: 12000, Rank: 1, PublicProfile: { Username: "neo" } },
      ],
      { b: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
      "b",
    );
    expect(rows.map((r) => r.userId)).toEqual(["a", "b"]);
    expect(rows[0]).toMatchObject({ rank: 1, name: "neo", wallet: null, me: false });
    expect(rows[0]!.earnings).toBeCloseTo(1e12, -6);
    expect(rows[1]).toMatchObject({ name: null, wallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", me: true });
  });

  it("shortens a wallet address", () => {
    expect(shortAddress("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBe("7xKX…gAsU");
    expect(shortAddress("short")).toBe("short");
  });

  it("copes with an empty board and missing fields", () => {
    expect(boardRows([], {}, null)).toEqual([]);
    expect(boardRows([{ UserID: "x" }], {}, null)[0]).toMatchObject({ rank: 1, earnings: 1 });
  });
});

describe("wallets on the board", () => {
  const wallet = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

  it("shows a wallet only when it looks like a Solana address", () => {
    const w = walletsFrom([
      { UserID: "a", Public: { cc_wallet: { Value: wallet } } },
      { UserID: "b", Public: { cc_wallet: { Value: "<script>" } } },
      { UserID: "c", Public: {} },
      { UserID: "d", Public: { cc_wallet: { Value: "" } } },
      { UserID: "e", Public: null },
      { UserID: null, Public: { cc_wallet: { Value: wallet } } },
    ]);
    expect(w).toEqual({ a: wallet });
    expect(walletsFrom(undefined)).toEqual({});
    expect(walletsFrom(null)).toEqual({});
  });

  it("names a row: name ◎, ◎ short address, the name, or Player", () => {
    expect(rowLabel({ name: "neo", wallet }, "Player")).toBe("neo ◎");
    expect(rowLabel({ name: null, wallet }, "Player")).toBe("◎ 7xKX…gAsU");
    expect(rowLabel({ name: "neo", wallet: null }, "Player")).toBe("neo");
    expect(rowLabel({ name: null, wallet: null }, "Player")).toBe("Player");
  });
});
