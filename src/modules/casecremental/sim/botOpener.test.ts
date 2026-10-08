import { describe, expect, it } from "vitest";
import { botCaseFor, botSpeed, botSpeedCost, botSpinSeconds } from "./botOpener";
import { priceOf } from "./content/cases";
import { DEFAULT_SETUP, Run } from "./run";
import { BOT_SPIN_SECONDS, BOT_WAKE_COST } from "./tuning";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};
const awake = () => new Run(1, { ...DEFAULT_SETUP, botAwake: true });
const untilCard = (run: Run) => {
  for (let i = 0; i < 900 && !run.state.bot.card; i++) run.tick(DT);
  expect(run.state.bot.card).not.toBeNull();
};

describe("bot opener helpers", () => {
  it("speeds up ×1 → ×8 over five levels; a spin shrinks with it", () => {
    expect(botSpeed(0)).toBe(1);
    expect(botSpeed(5)).toBeCloseTo(8);
    expect(botSpinSeconds(5)).toBeCloseTo(BOT_SPIN_SECONDS / 8);
    expect(botSpeedCost(5)).toBeNull();
  });

  it("opens the dearest case you can afford, or its chosen one when you can", () => {
    const price = priceOf;
    expect(botCaseFor(null, ["bootcamp", "wildwood"], 20, price)).toBe("wildwood");
    expect(botCaseFor(null, ["bootcamp", "wildwood"], 5, price)).toBe("bootcamp");
    expect(botCaseFor(null, ["bootcamp"], 1, price)).toBeNull();
    expect(botCaseFor("bootcamp", ["bootcamp", "wildwood"], 20, price)).toBe("bootcamp");
    expect(botCaseFor("wildwood", ["bootcamp", "wildwood"], 5, price)).toBeNull(); // waits for its case
    expect(botCaseFor("bedrock", ["bootcamp"], 1e6, price)).toBe("bootcamp"); // not unlocked: back to the best
  });
});

describe("the bot opens its own cases", () => {
  it("sleeps until woken, and waking costs once", () => {
    const run = new Run(1);
    tickFor(run, 5);
    expect(run.state.bot.spin).toBeNull();
    run.state.cash = 100;
    expect(run.wakeBot().ok).toBe(true);
    expect(run.state.cash).toBe(100 - BOT_WAKE_COST);
    expect(run.wakeBot()).toEqual({ ok: false, reason: "the bot is already awake" });
  });

  it("buys a case with your cash and spins it on its own reel, leaving your bench alone", () => {
    const run = awake();
    run.state.cash = 20;
    run.state.unlocked = ["bootcamp", "wildwood"];
    run.tick(DT);
    expect(run.state.bot.spin?.caseId).toBe("wildwood");
    expect(run.state.cash).toBe(20 - priceOf("wildwood"));
    expect(run.state.bench.phase).toBe("empty");
    expect(run.drainEvents().map((e) => e.type)).toContain("botSpinStarted");
  });

  it("lands its drop at its station and waits for you to sell it, then opens again", () => {
    const run = awake();
    run.state.cash = 1e6;
    untilCard(run);
    expect(run.drainEvents().map((e) => e.type)).toContain("botRevealed");
    tickFor(run, 10);
    expect(run.state.bot.spin).toBeNull(); // waits while its card waits
    const d = run.state.bot.card!;
    const cash = run.state.cash;
    expect(run.sellBotCard().ok).toBe(true);
    expect(run.state.cash - cash).toBeCloseTo(run.payout(d, false) * 1.02); // a hand sale: combo
    const sold = run.drainEvents().find((e) => e.type === "sold");
    expect(sold).toMatchObject({ source: "bot", from: "bot" });
    expect(run.sellBotCard()).toEqual({ ok: false, reason: "the bot has nothing to sell" });
    run.tick(DT);
    expect(run.state.bot.spin).not.toBeNull();
  });

  it("opens its chosen case, and waits while you can't afford it", () => {
    const run = awake();
    run.state.unlocked = ["bootcamp", "wildwood"];
    expect(run.setBotCase("wildwood").ok).toBe(true);
    expect(run.setBotCase("nope")).toEqual({ ok: false, reason: "unknown case: nope" });
    run.state.cash = 5;
    tickFor(run, 1);
    expect(run.state.bot.spin).toBeNull();
    run.state.cash = 20;
    run.tick(DT);
    expect(run.state.bot.spin?.caseId).toBe("wildwood");
    expect(run.setBotCase(null).ok).toBe(true);
  });

  it("gets faster with Speed", () => {
    const run = awake();
    run.state.cash = 1e9;
    for (let i = 0; i < 5; i++) expect(run.buyBotSpeed().ok).toBe(true);
    expect(run.buyBotSpeed()).toEqual({ ok: false, reason: "max level for this run" });
    run.tick(DT);
    expect(run.state.bot.spin?.duration).toBeCloseTo(BOT_SPIN_SECONDS / 8);
  });

  it("never stops you: broke with an empty bench, the day job still comes, whatever the bot holds (Review Focus 1)", () => {
    const run = awake();
    run.state.cash = 2;
    untilCard(run); // spent your last $2
    run.state.cash = 0;
    expect(run.dayJobAvailable()).toBe(true);
    expect(run.sellBotCard().ok).toBe(true);
  });

  it("counts its opens (Lucky Seven) and its reveals heat the room", () => {
    const run = awake();
    run.state.cash = 1e6;
    untilCard(run);
    expect(run.state.opened).toBe(1);
    expect(run.state.heat).toBeGreaterThan(0);
  });
});
