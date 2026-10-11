import { botWaiting } from "./botOpener";
import { describe, expect, it } from "vitest";
import { sellerHold, sellerSpeedCost, sellsAt } from "./autoSeller";
import { DEFAULT_SETUP, Run, type RunSetup } from "./run";
import { COMBO_STEP, SELLER_BIG_HOLD, SELLER_COST, SELLER_HOLD_SECONDS } from "./tuning";
import type { RarityId } from "./types";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};
const withSeller = (over: Partial<RunSetup> = {}) => {
  const run = new Run(1, { ...DEFAULT_SETUP, ...over });
  run.state.cash = 1e6;
  expect(run.buySeller().ok).toBe(true);
  run.drainEvents();
  return run;
};
function revealOnBench(run: Run, rarity: RarityId) {
  run.forceNextRarity(rarity);
  run.buyCase("bootcamp");
  run.insertKey();
  for (let i = 0; i < 900 && run.state.bench.phase !== "revealed"; i++) run.tick(DT);
  run.drainEvents();
}

describe("auto-seller helpers", () => {
  it("routes by threshold, waits longer for a Covert or ★, and gets faster with Speed", () => {
    expect(sellsAt("classified", "restricted")).toBe(true);
    expect(sellsAt("classified", "covert")).toBe(false);
    expect(sellerHold("milspec", 0)).toBe(SELLER_HOLD_SECONDS[0]);
    expect(sellerHold("milspec", 4)).toBe(SELLER_HOLD_SECONDS[4]);
    expect(sellerHold("gold", 4)).toBe(SELLER_BIG_HOLD);
    expect(sellerSpeedCost(4)).toBeNull();
  });
});

describe("the auto-seller", () => {
  it("is bought once, then sells a card left waiting on your bench, without combo", () => {
    const run = new Run(1);
    run.state.cash = SELLER_COST;
    expect(run.buySeller().ok).toBe(true);
    expect(run.state.cash).toBe(0);
    expect(run.buySeller()).toEqual({ ok: false, reason: "the auto-seller is already on" });
    run.state.cash = 1e6;
    revealOnBench(run, "milspec");
    const b = run.state.bench;
    const d = b.phase === "revealed" ? b.cards[0] : null;
    const cash = run.state.cash;
    tickFor(run, SELLER_HOLD_SECONDS[0] + 0.1);
    expect(run.state.bench.phase).toBe("empty");
    expect(run.state.cash - cash).toBeCloseTo(run.payout(d!, false));
    expect(run.drainEvents().find((e) => e.type === "sold")).toMatchObject({ source: "seller", from: "bench" });
    expect(run.state.combo).toBe(0);
  });

  it("sells the bot's card too", () => {
    const run = withSeller({ botAwake: true });
    for (let i = 0; i < 900 && !botWaiting(run.state.bot); i++) run.tick(DT);
    run.drainEvents();
    tickFor(run, SELLER_HOLD_SECONDS[0] + 0.1);
    expect(botWaiting(run.state.bot)).toBe(false);
    expect(run.drainEvents().find((e) => e.type === "sold")).toMatchObject({ source: "seller", from: "bot" });
  });

  it("sets a card above its threshold aside in the tray; a full tray leaves it, still sellable by hand (Review Focus 2)", () => {
    const run = withSeller({ trayCapacity: 1 });
    revealOnBench(run, "covert");
    tickFor(run, SELLER_BIG_HOLD + 0.1);
    expect(run.state.tray).toHaveLength(1);
    expect(run.drainEvents().find((e) => e.type === "stored")).toMatchObject({ from: "bench" });
    revealOnBench(run, "covert");
    tickFor(run, SELLER_BIG_HOLD + 2);
    expect(run.state.bench.phase).toBe("revealed"); // the tray is full
    expect(run.sell().ok).toBe(true);
  });

  it("takes each of two cards waiting at once exactly once", () => {
    const run = new Run(1, { ...DEFAULT_SETUP, botAwake: true });
    run.state.cash = 1e6;
    revealOnBench(run, "milspec");
    for (let i = 0; i < 900 && !botWaiting(run.state.bot); i++) run.tick(DT);
    expect(run.state.bench.phase).toBe("revealed"); // both are waiting: no seller yet
    expect(botWaiting(run.state.bot)).toBe(true);
    expect(run.buySeller().ok).toBe(true);
    run.drainEvents();
    const events: string[] = [];
    for (let i = 0; i < 300; i++) {
      run.tick(DT);
      for (const e of run.drainEvents()) if (e.type === "sold" && e.source === "seller") events.push(e.from ?? "");
    }
    expect(events.filter((f) => f === "bench")).toHaveLength(1);
    expect(events.filter((f) => f === "bot").length).toBeGreaterThanOrEqual(1); // the bot keeps opening
  });

  it("leaves a card you are holding, and takes it after you let go (Review Focus 3)", () => {
    const run = withSeller();
    revealOnBench(run, "milspec");
    expect(run.setHeld("bench").ok).toBe(true);
    tickFor(run, SELLER_HOLD_SECONDS[0] + 1);
    expect(run.state.bench.phase).toBe("revealed");
    run.setHeld(null);
    run.tick(DT);
    expect(run.state.bench.phase).toBe("empty");
  });

  it("waits longer for a Covert so its reveal plays", () => {
    const run = withSeller();
    revealOnBench(run, "covert");
    tickFor(run, SELLER_HOLD_SECONDS[0] + 0.1);
    expect(run.state.bench.phase).toBe("revealed");
  });

  it("holds a card for a shorter time at a higher Speed level", () => {
    const slow = withSeller();
    revealOnBench(slow, "milspec");
    tickFor(slow, SELLER_HOLD_SECONDS[4] + 0.1);
    expect(slow.state.bench.phase).toBe("revealed"); // level 0 still waits
    const fast = withSeller();
    for (let i = 0; i < 4; i++) fast.buySellerSpeed();
    revealOnBench(fast, "milspec");
    tickFor(fast, SELLER_HOLD_SECONDS[4] + 0.1);
    expect(fast.state.bench.phase).toBe("empty");
  });

  it("gets faster with Speed and obeys a new threshold", () => {
    const run = withSeller();
    for (let i = 0; i < 4; i++) expect(run.buySellerSpeed().ok).toBe(true);
    expect(run.buySellerSpeed()).toEqual({ ok: false, reason: "max level for this run" });
    expect(run.setSellerThreshold("covert").ok).toBe(true);
    revealOnBench(run, "covert");
    tickFor(run, SELLER_BIG_HOLD + 0.1);
    expect(run.state.tray).toHaveLength(0); // sold, not stored
  });

  it("a claim takes the card at its slot even after another is stored", () => {
    const run = withSeller();
    revealOnBench(run, "covert");
    tickFor(run, SELLER_BIG_HOLD + 0.1);
    const first = run.state.tray[0]!;
    revealOnBench(run, "gold");
    tickFor(run, SELLER_BIG_HOLD + 0.1);
    expect(run.state.tray).toHaveLength(2);
    const cash = run.state.cash;
    run.claim(0);
    expect(run.state.cash - cash).toBeCloseTo(run.payout(first, false) * (1 + COMBO_STEP));
    expect(run.state.tray[0]!.rarity).toBe("gold");
  });
});
