import { describe, expect, it } from "vitest";
import {
  charmMinRarity,
  charmPool,
  charmPriceMult,
  charmStatTrakChance,
  charmValueMult,
  RUN1_CHARMS,
  RUN2_CHARMS,
  RUN3_CHARMS,
} from "./charms";
import { caseById } from "./content/cases";
import { offerCharms } from "./meta";
import { Run } from "./run";
import { DEFAULT_SETUP } from "./runTypes";
import { FREE_CASE_QUEUE_MAX, STATTRAK_CHANCE } from "./tuning";
import type { Drop } from "./types";

const drop = (over: Partial<Drop>): Drop => ({
  id: 1,
  caseId: "bootcamp",
  skinId: "bc_woodland",
  rarity: "milspec",
  float: 0.2,
  wear: "FT",
  statTrak: false,
  value: 1,
  ...over,
});

describe("Run 1 charms", () => {
  it("has the eight charms that work with Run 1's systems", () => {
    expect([...RUN1_CHARMS].sort()).toEqual(
      ["doubleTap", "goldRush", "insider", "luckySeven", "milSpecManiac", "pityJar", "ricochet", "rustBucket"].sort(),
    );
  });

  it("Rust Bucket pays Battle-Scarred at Factory New price", () => {
    expect(charmValueMult(["rustBucket"], drop({ wear: "BS" }))).toBeCloseTo(1.5 / 0.7);
    expect(charmValueMult(["rustBucket"], drop({ wear: "FT" }))).toBe(1);
  });

  it("Gold Rush pays ★ ×10; Mil-Spec Maniac ×4 Mil-Spec and ×0.5 everything else", () => {
    expect(charmValueMult(["goldRush"], drop({ rarity: "gold" }))).toBe(10);
    expect(charmValueMult(["milSpecManiac"], drop({ rarity: "milspec" }))).toBe(4);
    expect(charmValueMult(["milSpecManiac"], drop({ rarity: "covert" }))).toBe(0.5);
    expect(charmValueMult([], drop({ rarity: "gold" }))).toBe(1);
  });

  it("Insider, Double Tap and Lucky Seven", () => {
    expect(charmPriceMult(["insider"])).toBe(0.7);
    expect(charmPriceMult([])).toBe(1);
    expect(charmStatTrakChance(["doubleTap"])).toBeCloseTo(STATTRAK_CHANCE * 3);
    expect(charmMinRarity(["luckySeven"], 7)).toBe("classified");
    expect(charmMinRarity(["luckySeven"], 8)).toBeNull();
    expect(charmMinRarity([], 7)).toBeNull();
  });
});

const lockerFill = (r: Run, n: number, base: Drop, from = 100) =>
  r.state.locker.items.push(...Array.from({ length: n }, (_, i) => ({ ...base, id: from + i })));

describe("Run 2 and 3 charms", () => {
  it("each run offers its own pool", () => {
    expect(charmPool(1)).toBe(RUN1_CHARMS);
    expect(charmPool(2)).toBe(RUN2_CHARMS);
    expect(charmPool(3)).toBe(RUN3_CHARMS);
    expect([...RUN2_CHARMS]).toEqual([...RUN1_CHARMS, "chainReaction", "contractKiller", "hoarder"]);
    expect([...RUN3_CHARMS]).toEqual([...RUN2_CHARMS, "fever", "collectorsEye"]);
    expect(new Set(Array.from({ length: 60 }, (_, i) => offerCharms(i, 1, 2)).flat()).size).toBe(RUN2_CHARMS.length);
    expect(offerCharms(5, 2, 3).every((c) => RUN3_CHARMS.includes(c))).toBe(true);
    expect(
      Array.from({ length: 60 }, (_, i) => offerCharms(i, 1, 1))
        .flat()
        .every((c) => RUN1_CHARMS.includes(c)),
    ).toBe(true);
  });

  it("Chain Reaction queues free cases from Classified+ reveals, capped", () => {
    const r = new Run(2, { ...DEFAULT_SETUP, run: 2, charms: ["chainReaction"], startCash: 1e9 });
    let queued = 0;
    for (let i = 0; i < 200; i++) {
      r.forceNextRarity("classified");
      r.state.bench = { phase: "empty" };
      r.buyCase("bootcamp");
      r.insertKey();
      for (let k = 0; k < 120; k++) r.tick(1 / 30);
      queued = Math.max(queued, r.state.freeCases.length);
      r.state.freeCases = [];
    }
    expect(queued).toBeGreaterThan(0);
    expect(queued).toBeLessThanOrEqual(FREE_CASE_QUEUE_MAX);
  });

  it("Chain Reaction fires on Classified, Covert and ★ at the bench and the bot, never on a contract result or a Restricted", () => {
    const hits = (rarity: Drop["rarity"], spot: "bench" | "bot" | "locker"): number => {
      const r = new Run(3, { ...DEFAULT_SETUP, run: 2, charms: ["chainReaction"] });
      for (let i = 0; i < 200; i++) r.onReveal(drop({ rarity, caseId: "wildwood" }), spot);
      return r.state.freeCases.length;
    };
    for (const spot of ["bench", "bot"] as const) {
      for (const rarity of ["classified", "covert", "gold"] as const)
        expect(hits(rarity, spot), `${rarity} ${spot}`).toBe(FREE_CASE_QUEUE_MAX);
      expect(hits("restricted", spot)).toBe(0);
    }
    expect(hits("classified", "locker")).toBe(0);
    const r = new Run(3, { ...DEFAULT_SETUP, run: 2, charms: ["chainReaction"] });
    for (let i = 0; i < 200; i++) r.onReveal(drop({ rarity: "covert", caseId: "wildwood" }), "bench");
    expect(new Set(r.state.freeCases)).toEqual(new Set(["wildwood"]));
  });

  it("Ricochet shares the free-case queue cap", () => {
    const r = new Run(3, { ...DEFAULT_SETUP, run: 3, charms: ["ricochet"] });
    for (let i = 0; i < 20; i++) r.onReveal(drop({ rarity: "covert" }), "bot");
    expect(r.state.freeCases).toHaveLength(FREE_CASE_QUEUE_MAX);
  });

  it("Hoarder pays +1 % per skin in the locker", () => {
    const r = new Run(2, { ...DEFAULT_SETUP, run: 2, charms: ["hoarder"] });
    const d = drop({ value: 10 });
    const base = r.payout(d, false);
    lockerFill(r, 20, d, 10);
    expect(r.payout(d, false)).toBeCloseTo(base * 1.2, 9);
    const plain = new Run(2, { ...DEFAULT_SETUP, run: 2 });
    lockerFill(plain, 20, d, 10);
    expect(plain.payout(d, false)).toBeCloseTo(base, 9);
  });

  it("Fever pays x1.5 and shows one stage higher", () => {
    const plain = new Run(2, { ...DEFAULT_SETUP, run: 3 });
    const fever = new Run(2, { ...DEFAULT_SETUP, run: 3, charms: ["fever"] });
    const d = drop({ value: 10 });
    expect(fever.payout(d, false)).toBeCloseTo(plain.payout(d, false) * 1.5, 9);
    plain.tick(1 / 30);
    fever.tick(1 / 30);
    expect(plain.state.stage).toBe(1);
    expect(fever.state.stage).toBe(2);
    for (let i = 0; i < 10; i++) fever.tick(1 / 30);
    expect(fever.state.stage).toBe(2); // steady, no flicker
  });

  it("Fever never shows past stage 5", () => {
    const fever = new Run(2, { ...DEFAULT_SETUP, run: 3, charms: ["fever"] });
    fever.state.heat = 1000;
    for (let i = 0; i < 5; i++) fever.tick(1 / 30);
    expect(fever.state.stage).toBe(5);
  });

  it("Collector's Eye doubles a case once every non-★ skin of it has shown up", () => {
    const r = new Run(2, { ...DEFAULT_SETUP, run: 3, charms: ["collectorsEye"] });
    const bc = caseById("bootcamp").skins.filter((s) => s.rarity !== "gold");
    r.state.seen.bootcamp = bc.slice(1).map((s) => s.id);
    const d = drop({ skinId: bc[0]!.id, rarity: bc[0]!.rarity, value: 10 });
    const before = r.payout(d, false);
    r.onReveal(d, "bench");
    const completed = r.drainEvents().filter((e) => e.type === "setCompleted");
    expect(completed).toEqual([{ type: "setCompleted", caseId: "bootcamp" }]);
    expect(r.payout(d, false)).toBeCloseTo(before * 2, 9);
    expect(r.payout({ ...d, caseId: "wildwood" }, false)).toBeCloseTo(before, 9);
    r.onReveal(d, "bench"); // once only
    expect(r.drainEvents().some((e) => e.type === "setCompleted")).toBe(false);
  });

  it("Collector's Eye records skins from every reveal source, and does nothing without the charm", () => {
    const r = new Run(2, { ...DEFAULT_SETUP, run: 3, charms: ["collectorsEye"] });
    r.onReveal(drop({ skinId: "a" }), "bot");
    r.onReveal(drop({ skinId: "a" }), "bench");
    r.onReveal(drop({ skinId: "b" }), "locker");
    expect(r.state.seen.bootcamp).toEqual(["a", "b"]);
    const plain = new Run(2, { ...DEFAULT_SETUP, run: 3 });
    plain.onReveal(drop({ skinId: "a" }), "bench");
    expect(plain.state.seen).toEqual({});
  });

  it("Contract Killer sometimes gives two results", () => {
    const r = new Run(4, { ...DEFAULT_SETUP, run: 2, charms: ["contractKiller"], startCash: 1e9 });
    r.buyLocker();
    let doubles = 0;
    for (let i = 0; i < 100; i++) {
      r.state.locker.items = [];
      lockerFill(r, 10, drop({ caseId: "wildwood", skinId: "ww_fern", value: 1 }), 1000 * i);
      r.state.locker.cards = [];
      r.state.locker.press = null;
      expect(r.tradeUp().ok).toBe(true);
      if (r.state.locker.press!.results.length === 2) doubles++;
    }
    expect(doubles).toBeGreaterThan(8);
    expect(doubles).toBeLessThan(35);
  });

  it("without Contract Killer a press has one result", () => {
    const a = new Run(4, { ...DEFAULT_SETUP, run: 2, startCash: 1e9 });
    a.buyLocker();
    lockerFill(a, 10, drop({ caseId: "wildwood", skinId: "ww_fern" }));
    a.tradeUp();
    expect(a.state.locker.press!.results).toHaveLength(1);
  });

  it("two contract results: hand sales and the auto-seller each take their own, slot 0 or not", () => {
    const setupRun = (): Run => {
      const r = new Run(4, { ...DEFAULT_SETUP, run: 2, charms: ["contractKiller"], startCash: 1e9 });
      r.buyLocker();
      r.state.locker.cards = [drop({ id: 1, value: 5 }), drop({ id: 2, value: 7 })];
      return r;
    };
    const hand = setupRun();
    expect(hand.sellLockerCard(0).ok).toBe(true);
    expect(hand.state.locker.cards.map((c) => c?.id ?? null)).toEqual([null, 2]);
    expect(hand.sellLockerCard().ok).toBe(true); // default picks the card that is left
    expect(hand.state.locker.cards).toEqual([]);

    const auto = setupRun();
    auto.buySeller();
    const before = auto.state.cash;
    auto.state.locker.cardAt = auto.state.time;
    for (let i = 0; i < 300; i++) auto.tick(1 / 30);
    expect(auto.state.locker.cards).toEqual([]);
    expect(auto.state.cash - before).toBeGreaterThanOrEqual(12 * 0.99);
  });
});
