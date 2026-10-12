import { describe, expect, it } from "vitest";
import { RUN1_CHARMS, RUN3_CHARMS } from "./charms";
import { buyPerk, charmSlots, cloutFor, completeVault, endCredits, freshMeta, offerCharms, perkCost, pickCharm, setupFor } from "./meta";
import { CATCH_UP_PER_VAULT, CLOUT_DIVISOR, PERK_START_CASH, START_CASH, TRAY_BASE_CAPACITY, TRAY_PER_PERK, VAULT_PRICES } from "./tuning";

/** Lifetime earnings that pay exactly 10 CLOUT. */
const TEN_CLOUT = (10 * CLOUT_DIVISOR) ** 2;

describe("prestige meta", () => {
  it("pays CLOUT by the run's earnings", () => {
    expect(cloutFor(0)).toBe(0);
    expect(cloutFor(TEN_CLOUT)).toBe(10);
    expect(cloutFor(TEN_CLOUT * 4)).toBeGreaterThan(cloutFor(TEN_CLOUT));
  });

  it("completes a vault once per call: CLOUT, the trophy (kept once), the loop, a 3-charm offer", () => {
    const m = freshMeta();
    completeVault(m, TEN_CLOUT, "vault1", 42);
    completeVault(m, TEN_CLOUT, "vault1", 42);
    expect(m.clout).toBe(20);
    expect(m.lastGain).toBe(10);
    expect(m.loops).toBe(2);
    expect(m.trophies).toEqual(["vault1"]);
    expect(m.offer).toHaveLength(3);
    expect(new Set(m.offer).size).toBe(3);
    for (const c of m.offer!) expect(RUN3_CHARMS).toContain(c);
    expect(offerCharms(42, 2, 3)).toEqual(m.offer); // same seed and loop → same offer
  });

  it("picks charms up to the slot count; picking again un-picks", () => {
    const m = freshMeta();
    completeVault(m, 0, "vault1", 1);
    const [a, b] = m.offer!;
    expect(pickCharm(m, a!).ok).toBe(true);
    expect(pickCharm(m, b!)).toEqual({ ok: false, reason: "no free charm slot" });
    m.perks.charmSlot = 1;
    expect(charmSlots(m)).toBe(2);
    expect(pickCharm(m, b!).ok).toBe(true);
    expect(pickCharm(m, a!).ok).toBe(true);
    expect(m.picked).toEqual([b]);
    const outside = RUN1_CHARMS.find((c) => !m.offer!.includes(c))!;
    expect(pickCharm(m, outside)).toEqual({ ok: false, reason: "not offered" });
  });

  it("a second charm slot costs 15 CLOUT and a third 30", () => {
    expect([perkCost("charmSlot", 0), perkCost("charmSlot", 1), perkCost("charmSlot", 2)]).toEqual([15, 30, null]);
  });

  it("buys perks with CLOUT up to their max", () => {
    const m = freshMeta();
    m.clout = 100;
    expect(buyPerk(m, "botAwake").ok).toBe(true);
    expect(buyPerk(m, "botAwake")).toEqual({ ok: false, reason: "max level" });
    expect(m.clout).toBe(100 - perkCost("botAwake", 0)!);
    m.clout = 0;
    expect(buyPerk(m, "luck")).toEqual({ ok: false, reason: "not enough CLOUT" });
  });

  it("sets up the next run from perks, picked charms and loops", () => {
    const m = freshMeta();
    m.perks = { startCash: 2, luck: 3, charmSlot: 0, botAwake: 1, biggerTray: 1 };
    m.loops = 2;
    m.offer = ["insider", "doubleTap", "ricochet"];
    m.picked = ["insider"];
    expect(setupFor(m)).toEqual({
      run: 3,
      startCash: START_CASH + 2 * PERK_START_CASH,
      luckBonus: 3,
      charms: ["insider"],
      botAwake: true,
      trayCapacity: TRAY_BASE_CAPACITY + TRAY_PER_PERK,
      valueBoost: CATCH_UP_PER_VAULT ** 2,
      vaultPrice: VAULT_PRICES[2],
    });
  });

  it("adds each run's time, opens and best drop to the campaign stats, and the CLOUT it paid", () => {
    const m = freshMeta();
    expect(m.stats).toEqual({ playSeconds: 0, opened: 0, best: null, cloutEarned: 0 });
    const a = {
      id: 1,
      caseId: "bootcamp",
      skinId: "bc_knife",
      rarity: "gold",
      float: 0.1,
      wear: "MW",
      statTrak: false,
      value: 500,
    } as const;
    const b = { ...a, id: 2, value: 90 };
    completeVault(m, 1e8, "vault1", 1, { time: 400, opened: 300, best: a });
    completeVault(m, 1e10, "vault2", 1, { time: 500, opened: 900, best: b });
    expect(m.stats).toMatchObject({ playSeconds: 900, opened: 1200, best: a });
    expect(m.stats.cloutEarned).toBe(cloutFor(1e8) + cloutFor(1e10));
  });

  it("rolls the credits after The Last Case, and only then; ending them twice is refused", () => {
    const m = freshMeta();
    completeVault(m, 1e9, "vault3", 1);
    expect(m.credits).toBe(false);
    completeVault(m, 1e9, "lastcase", 1);
    expect(m.credits).toBe(true);
    expect(endCredits(m).ok).toBe(true);
    expect(m.credits).toBe(false);
    expect(endCredits(m)).toEqual({ ok: false, reason: "no credits rolling" });
  });
});
