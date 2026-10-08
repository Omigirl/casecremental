import { describe, expect, it } from "vitest";
import { botSpeed, botSpeedCost, revealHold, sellsAt } from "./botSeller";
import { DEFAULT_SETUP, Run, type RunSetup } from "./run";
import { BOT_REVEAL_HOLD, BOT_STEP_SECONDS, BOT_WAKE_COST } from "./tuning";
import type { RarityId } from "./types";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};
const awake = (over: Partial<RunSetup> = {}) => new Run(1, { ...DEFAULT_SETUP, botAwake: true, ...over });
function reveal(run: Run, rarity: RarityId) {
  run.state.cash = Math.max(run.state.cash, 1e6);
  run.forceNextRarity(rarity);
  run.buyCase("bootcamp");
  run.insertKey();
  const b = run.state.bench;
  tickFor(run, (b.phase === "spinning" ? b.fullDuration : 0) + DT);
  expect(run.state.bench.phase).toBe("revealed");
  run.drainEvents();
}
const S = BOT_STEP_SECONDS;

describe("bot helpers", () => {
  it("speeds up ×1 → ×8 over five levels, then caps", () => {
    expect(botSpeed(0)).toBe(1);
    expect(botSpeed(5)).toBeCloseTo(8);
    expect(botSpeed(9)).toBeCloseTo(8);
    expect(botSpeedCost(0)).toBe(60);
    expect(botSpeedCost(5)).toBeNull();
  });

  it("routes by threshold and lets big reveals play first", () => {
    expect(sellsAt("classified", "restricted")).toBe(true);
    expect(sellsAt("classified", "covert")).toBe(false);
    expect(revealHold("milspec", 2)).toBeCloseTo(BOT_REVEAL_HOLD / 2);
    expect(revealHold("gold", 8)).toBeGreaterThan(2);
  });
});

describe("the bot as a seller", () => {
  it("sleeps until woken, and waking costs once", () => {
    const run = new Run(1);
    reveal(run, "milspec");
    tickFor(run, 10);
    expect(run.state.bench.phase).toBe("revealed");
    run.state.cash = 100;
    expect(run.wakeBot().ok).toBe(true);
    expect(run.state.cash).toBe(100 - BOT_WAKE_COST);
    expect(run.wakeBot()).toEqual({ ok: false, reason: "the bot is already awake" });
  });

  it("walks over, picks the card up, sells it without combo, and walks back", () => {
    const run = awake();
    reveal(run, "milspec");
    const b = run.state.bench;
    const drop = b.phase === "revealed" ? b.drop : null;
    tickFor(run, BOT_REVEAL_HOLD + S.toBench + S.pickUp + 0.1);
    expect(run.state.bench.phase).toBe("empty");
    expect(run.drainEvents().map((e) => e.type)).toContain("botPickedUp");
    const cash = run.state.cash;
    tickFor(run, S.carry + S.drop + 0.1);
    const sold = run.drainEvents().find((e) => e.type === "sold");
    expect(sold).toMatchObject({ source: "bot" });
    expect(run.state.cash - cash).toBeCloseTo(run.payout(drop!, false));
    expect(run.state.combo).toBe(0);
    tickFor(run, S.back + 0.1);
    expect(run.state.bot.job).toBeNull();
  });

  it("goes back empty-handed when the player sells first — one sale only", () => {
    const run = awake();
    reveal(run, "milspec");
    tickFor(run, BOT_REVEAL_HOLD + 0.5); // on its way
    run.sell();
    tickFor(run, 6);
    const sales = run.drainEvents().filter((e) => e.type === "sold");
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({ source: "bench" });
    expect(run.state.bot.job).toBeNull();
  });

  it("carries anything above its threshold to the claim tray; a claim sells it with combo", () => {
    const run = awake();
    reveal(run, "covert");
    tickFor(run, 10);
    expect(run.state.tray).toHaveLength(1);
    expect(run.drainEvents().map((e) => e.type)).toContain("stored");
    const d = run.state.tray[0]!;
    const cash = run.state.cash;
    expect(run.claim(0).ok).toBe(true);
    expect(run.state.cash - cash).toBeCloseTo(run.payout(d, false) * 1.02);
    expect(run.state.tray).toHaveLength(0);
    expect(run.claim(0)).toEqual({ ok: false, reason: "nothing in that tray slot" });
  });

  it("waits by a full tray — the card stays sellable by hand, and the day job still comes when broke", () => {
    const run = awake({ trayCapacity: 1 });
    reveal(run, "covert");
    tickFor(run, 10);
    reveal(run, "covert");
    tickFor(run, 10);
    expect(run.state.bench.phase).toBe("revealed"); // it waited
    expect(run.state.bot.job?.step).toBe("wait");
    run.state.cash = 0;
    expect(run.sell().ok).toBe(true);
    run.state.cash = 0; // still broke after the sale
    tickFor(run, 4);
    expect(run.dayJobAvailable()).toBe(true);
  });

  it("picks the waiting card up once a tray slot frees", () => {
    const run = awake({ trayCapacity: 1 });
    reveal(run, "covert");
    tickFor(run, 10);
    reveal(run, "covert");
    tickFor(run, 10);
    run.claim(0);
    tickFor(run, 6);
    expect(run.state.bench.phase).toBe("empty");
    expect(run.state.tray).toHaveLength(1);
  });

  it("gets faster with Speed and obeys a new threshold", () => {
    const run = awake();
    run.state.cash = 1e9;
    for (let i = 0; i < 5; i++) expect(run.buyBotSpeed().ok).toBe(true);
    expect(run.buyBotSpeed()).toEqual({ ok: false, reason: "max level for this run" });
    expect(run.setBotThreshold("covert").ok).toBe(true);
    reveal(run, "covert");
    tickFor(run, 2.6 + (S.toBench + S.pickUp + S.carry + S.drop) / 8 + 0.2);
    expect(run.drainEvents().find((e) => e.type === "sold")).toMatchObject({ source: "bot" });
  });

  it("turns back when the player grabs the card, and comes again once it is let go (spec §3)", () => {
    const run = awake();
    reveal(run, "milspec");
    tickFor(run, BOT_REVEAL_HOLD + 0.5); // on its way
    expect(run.state.bot.job?.step).toBe("toBench");
    run.setHeld(true);
    tickFor(run, 6);
    expect(run.state.bench.phase).toBe("revealed");
    expect(run.state.bot.job).toBeNull();
    expect(run.drainEvents().map((e) => e.type)).not.toContain("botPickedUp");
    run.setHeld(false);
    tickFor(run, 6);
    expect(run.state.bench.phase).toBe("empty");
    expect(run.drainEvents().find((e) => e.type === "sold")).toMatchObject({ source: "bot" });
  });
});
