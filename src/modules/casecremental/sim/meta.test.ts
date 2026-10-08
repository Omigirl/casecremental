import { describe, expect, it } from "vitest";
import { RUN1_CHARMS } from "./charms";
import { buyPerk, charmSlots, cloutFor, completeVault, freshMeta, offerCharms, perkCost, pickCharm, setupFor } from "./meta";
import {
  CATCH_UP_PER_VAULT,
  CLOUT_DIVISOR,
  PERK_START_CASH,
  START_CASH,
  TRAY_BASE_CAPACITY,
  TRAY_PER_PERK,
  VAULT_BASE_PRICE,
  VAULT_GROWTH,
} from "./tuning";

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
    for (const c of m.offer!) expect(RUN1_CHARMS).toContain(c);
    expect(offerCharms(42, 2)).toEqual(m.offer); // same seed and loop → same offer
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
      startCash: START_CASH + 2 * PERK_START_CASH,
      luckBonus: 3,
      charms: ["insider"],
      botAwake: true,
      trayCapacity: TRAY_BASE_CAPACITY + TRAY_PER_PERK,
      valueBoost: CATCH_UP_PER_VAULT ** 2,
      vaultPrice: VAULT_BASE_PRICE * VAULT_GROWTH ** 2,
    });
  });
});
