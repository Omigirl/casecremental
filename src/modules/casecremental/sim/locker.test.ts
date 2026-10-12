import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import { caseById, priceOf } from "./content/cases";
import { contractResults, lockerCapacity, tradeUpRarity } from "./locker";
import { rollDrop } from "./roll";
import { DEFAULT_SETUP, Run } from "./run";
import { LOCKER_COST, TRADE_UP_COUNT, TRADE_UP_SECONDS } from "./tuning";
import type { Drop, RarityId } from "./types";

const drop = (id: number, caseId: string, rarity: RarityId, float = 0.2, statTrak = false): Drop => ({
  id,
  caseId,
  skinId: caseById(caseId).skins.find((s) => s.rarity === rarity)!.id,
  rarity,
  float,
  wear: "FT",
  statTrak,
  value: 1,
});
const ten = (caseId: string, r: RarityId, float = 0.2, st = false) =>
  Array.from({ length: TRADE_UP_COUNT }, (_, i) => drop(i + 1, caseId, r, float, st));
const run2 = (cash = 1e9) => new Run(5, { ...DEFAULT_SETUP, run: 2, startCash: cash });
const tickFor = (r: Run, s: number) => {
  for (let i = 0; i < Math.round(s * 30); i++) r.tick(1 / 30);
};

describe("trade-up contracts", () => {
  it("gives one skin of the next rarity from the inputs' cases, the mean float, StatTrak only if all were", () => {
    let id = 100;
    const [out] = contractResults(ten("wildwood", "restricted", 0.05, true), createRng(1), () => id++, false);
    expect(out!.rarity).toBe("classified");
    expect(out!.caseId).toBe("wildwood");
    expect(out!.float).toBeCloseTo(0.05, 9);
    expect(out!.wear).toBe("FN");
    expect(out!.statTrak).toBe(true);
    const mixed = [...ten("wildwood", "restricted").slice(0, 9), drop(9, "bedrock", "restricted", 0.2, false)];
    expect(contractResults(mixed, createRng(1), () => id++, false)[0]!.statTrak).toBe(false);
  });

  // Task 3's later cases are not in yet: "bedrock" stands in for "neon" (brief ruling)
  it("weights the result's case by the inputs' count", () => {
    const inputs = [...ten("bootcamp", "milspec").slice(0, 9), drop(10, "bedrock", "milspec")];
    let other = 0;
    let id = 1;
    const rng = createRng(42);
    for (let i = 0; i < 4000; i++) if (contractResults(inputs, rng, () => id++, false)[0]!.caseId === "bedrock") other++;
    expect(other / 4000).toBeGreaterThan(0.08);
    expect(other / 4000).toBeLessThan(0.12);
  });

  it("returns about 1.5x what its inputs would sell for, at every step", () => {
    const rng = createRng(9);
    let id = 1;
    for (const r of ["milspec", "restricted", "classified", "covert"] as const) {
      let paid = 0;
      let got = 0;
      for (let k = 0; k < 400; k++) {
        const inputs: Drop[] = [];
        while (inputs.length < 10) {
          const d = rollDrop(caseById("wildwood"), priceOf("wildwood"), 0, rng, id++, r);
          inputs.push(d);
        }
        paid += inputs.reduce((a, d) => a + d.value, 0);
        got += contractResults(inputs, rng, () => id++, false)[0]!.value;
      }
      expect(got / paid, r).toBeGreaterThan(1.3);
      expect(got / paid, r).toBeLessThan(1.8);
    }
  });

  it("Contract Killer's double gives two results", () => {
    let id = 1;
    expect(contractResults(ten("wildwood", "milspec"), createRng(3), () => id++, true)).toHaveLength(2);
  });

  it("knows which rarity is ready, never ★", () => {
    expect(tradeUpRarity(ten("wildwood", "covert").slice(0, 9))).toBeNull();
    expect(tradeUpRarity([...ten("wildwood", "restricted"), ...ten("wildwood", "milspec")])).toBe("milspec");
  });
});

describe("the locker", () => {
  it("is a Run 2 machine", () => {
    expect(new Run(1, { ...DEFAULT_SETUP, startCash: 1e9 }).buyLocker().ok).toBe(false);
    const r = run2();
    expect(r.buyLocker().ok).toBe(true);
    expect(r.state.cash).toBe(1e9 - LOCKER_COST);
  });

  it("keeps a card dragged in by hand, feeding the combo, until it is full", () => {
    const r = run2();
    r.buyLocker();
    r.state.tray.push(...ten("bootcamp", "milspec"), ...ten("bootcamp", "milspec"), drop(99, "bootcamp", "milspec"));
    for (let i = 0; i < lockerCapacity(0); i++) expect(r.storeCard("tray", 0).ok).toBe(true);
    expect(r.state.combo).toBeGreaterThan(1);
    expect(r.storeCard("tray", 0)).toEqual({ ok: false, reason: "the locker is full" });
  });

  it("collects the chosen rarity from the auto-seller, and sells it again once full", () => {
    const r = run2();
    r.buyLocker();
    r.buySeller();
    r.setCollect("milspec");
    r.state.locker.items.push(...Array.from({ length: lockerCapacity(0) - 1 }, (_, i) => drop(500 + i, "bootcamp", "restricted")));
    r.state.bench = { phase: "revealed", caseId: "bootcamp", cards: [drop(1, "bootcamp", "milspec"), drop(2, "bootcamp", "milspec")] };
    r.state.revealedAt = r.state.time;
    tickFor(r, 3);
    expect(r.state.locker.items).toHaveLength(lockerCapacity(0));
    const events = r.drainEvents();
    expect(events.filter((e) => e.type === "lockerStored")).toHaveLength(1);
    expect(events.filter((e) => e.type === "sold" && e.source === "seller")).toHaveLength(1);
  });

  it("presses the oldest ten, and the result waits on the locker", () => {
    const r = run2();
    r.buyLocker();
    r.state.locker.items.push(...ten("wildwood", "milspec"), drop(77, "wildwood", "milspec"));
    expect(r.tradeUp().ok).toBe(true);
    expect(r.state.locker.items.map((d) => d.id)).toEqual([77]);
    expect(r.tradeUp().ok).toBe(false); // the press is busy
    tickFor(r, TRADE_UP_SECONDS + 0.1);
    expect(r.state.locker.cards.filter(Boolean)).toHaveLength(1);
    expect(r.state.locker.cards[0]!.rarity).toBe("restricted");
    expect(r.sellLockerCard(0).ok).toBe(true);
    expect(r.state.locker.cards).toEqual([]);
  });

  it("the auto-seller takes a waiting result after its hold, but not one the player holds", () => {
    const r = run2();
    r.buyLocker();
    r.buySeller();
    r.state.locker.items.push(...ten("wildwood", "milspec"));
    r.tradeUp();
    tickFor(r, TRADE_UP_SECONDS + 0.1);
    expect(r.setHeld("locker", 0).ok).toBe(true);
    tickFor(r, 3);
    expect(r.state.locker.cards).toHaveLength(1);
    r.setHeld(null);
    r.drainEvents();
    tickFor(r, 0.1);
    expect(r.state.locker.cards).toEqual([]);
    expect(r.drainEvents().filter((e) => e.type === "sold" && e.source === "seller" && e.from === "locker")).toHaveLength(1);
  });

  it("auto contract (Run 3) presses the Collect rarity on its own", () => {
    const r = new Run(5, { ...DEFAULT_SETUP, run: 3, startCash: 1e12 });
    r.buyLocker();
    r.buyAutoContract();
    r.setCollect("restricted");
    r.state.locker.items.push(...ten("wildwood", "restricted"));
    tickFor(r, 0.1);
    expect(r.state.locker.press?.rarity).toBe("restricted");
  });

  // unlockCase("mainframe"/"neon") fails on today's 3-case shelf; it matters once Task 3 adds them
  it("the vault cashes in a running press and waiting results, and sells the locker at the end", () => {
    const r = run2(1e12);
    for (const id of ["wildwood", "bedrock", "mainframe", "neon"]) r.unlockCase(id);
    r.buyLocker();
    r.state.locker.items.push(...ten("wildwood", "milspec"), drop(50, "wildwood", "covert"));
    r.tradeUp();
    r.drainEvents();
    const before = r.state.lifetimeEarnings;
    expect(r.buyVault().ok).toBe(true);
    expect(r.state.locker.press).toBeNull();
    expect(r.drainEvents().filter((e) => e.type === "sold" && e.source === "locker")).toHaveLength(1);
    r.turnVaultKey();
    tickFor(r, 18);
    expect(r.state.locker.items).toEqual([]);
    expect(r.state.lifetimeEarnings).toBeGreaterThan(before);
  });
});
