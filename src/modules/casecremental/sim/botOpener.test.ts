import { describe, expect, it } from "vitest";
import { botCaseFor, botWaiting, botSpeed, botSpeedCost, botSpinSeconds } from "./botOpener";
import { CASES, priceOf } from "./content/cases";
import { DEFAULT_SETUP, Run } from "./run";
import { BOT_MULTI_COST, BOT_SPIN_SECONDS, BOT_WAKE_COST, BOT_WAKE_SECONDS, COMBO_STEP } from "./tuning";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};
const awake = () => new Run(1, { ...DEFAULT_SETUP, botAwake: true });
const untilCard = (run: Run) => {
  for (let i = 0; i < 900 && !botWaiting(run.state.bot); i++) run.tick(DT);
  expect(botWaiting(run.state.bot)).toBe(true);
};

describe("bot opener helpers", () => {
  it("speeds up ×1 → ×8 over five levels; a spin shrinks with it", () => {
    expect(botSpeed(0)).toBe(1);
    expect(botSpeed(5)).toBeCloseTo(8);
    expect(botSpinSeconds(5)).toBeCloseTo(BOT_SPIN_SECONDS / 8);
    expect(botSpeedCost(5, 1)).toBeNull();
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

  it("rests BOT_WAKE_SECONDS after waking before its first spin", () => {
    const run = new Run(1);
    run.state.cash = 1e6;
    expect(run.wakeBot().ok).toBe(true);
    tickFor(run, BOT_WAKE_SECONDS - 0.15);
    expect(run.state.bot.spin).toBeNull();
    tickFor(run, 0.3);
    expect(run.state.bot.spin).not.toBeNull();
  });

  it("an awake bot spinning first does not consume the dev board's forced rarity", () => {
    const run = awake();
    run.state.cash = 1e6;
    run.forceNextRarity("gold");
    run.tick(DT);
    expect(run.state.bot.spin).not.toBeNull();
    expect(run.state.bot.spin!.drops[0]!.rarity).not.toBe("gold");
    run.buyCase("bootcamp");
    run.insertKey();
    const b = run.state.bench;
    expect(b.phase === "spinning" && b.reels[0]!.drop.rarity).toBe("gold");
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
    const d = run.state.bot.cards[0]!;
    const cash = run.state.cash;
    expect(run.sellBotCard().ok).toBe(true);
    expect(run.state.cash - cash).toBeCloseTo(run.payout(d, false) * (1 + COMBO_STEP)); // a hand sale: combo
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

  it("cashes in a spin still in flight when the vault is bought, as a machine sale", () => {
    const run = awake();
    run.state.unlocked = CASES.map((c) => c.id);
    run.state.cash = 1e9;
    run.tick(DT);
    const spin = run.state.bot.spin!;
    expect(spin).not.toBeNull();
    run.drainEvents();
    const cash = run.state.cash;
    expect(run.buyVault().ok).toBe(true);
    const sold = run.drainEvents().find((e) => e.type === "sold");
    expect(sold).toMatchObject({ source: "seller", from: "bot", amount: run.payout(spin.drops[0]!, false) });
    expect(run.state.cash - cash).toBeCloseTo(run.payout(spin.drops[0]!, false) - run.setup.vaultPrice);
    expect(run.state.bot.spin).toBeNull();
  });

  it("counts its opens (Lucky Seven) and its reveals heat the room", () => {
    const run = awake();
    run.state.cash = 1e6;
    untilCard(run);
    expect(run.state.opened).toBe(1);
    expect(run.state.heat).toBeGreaterThan(0);
  });
});

describe("the bot's second reel (Run 2)", () => {
  const awakeRun = (run: number, cash = 1e6) => new Run(3, { ...DEFAULT_SETUP, run, startCash: cash, botAwake: true });

  it("bot multi-open is a Run 2 machine", () => {
    expect(awakeRun(1).buyBotMulti().ok).toBe(false);
    const r = awakeRun(2);
    expect(r.buyBotMulti().ok).toBe(true);
    expect(r.buyBotMulti().ok).toBe(false); // one level
  });

  it("opens two cases per spin, pays for both, and lands two cards", () => {
    const r = awakeRun(2);
    r.buyBotMulti();
    const cash = r.state.cash;
    tickFor(r, 1.2);
    expect(r.state.bot.spin?.drops).toHaveLength(2);
    expect(cash - r.state.cash).toBeCloseTo(2 * r.casePrice(r.state.bot.spin!.caseId), 6);
    tickFor(r, 5);
    expect(r.state.bot.cards.filter(Boolean)).toHaveLength(2);
  });

  it("opens only what you can afford", () => {
    const r = awakeRun(2, BOT_MULTI_COST + 3); // $3 left after the upgrade: one Boot Camp case
    r.buyBotMulti();
    tickFor(r, 1.2);
    expect(r.state.bot.spin?.drops).toHaveLength(1);
  });

  it("sells the cards one by one by hand and waits for both before the next spin", () => {
    const r = awakeRun(2);
    r.buyBotMulti();
    tickFor(r, 6);
    expect(r.sellBotCard(1).ok).toBe(true);
    expect(r.state.bot.cards[1]).toBeNull();
    tickFor(r, 6);
    expect(r.state.bot.spin).toBeNull(); // card 0 still waits
    expect(r.sellBotCard(0).ok).toBe(true);
    expect(r.state.bot.cards).toEqual([]);
  });

  it("the auto-seller leaves a held bot card and takes the other", () => {
    const r = awakeRun(2);
    r.buyBotMulti();
    r.buySeller();
    r.setSellerThreshold("gold");
    tickFor(r, 5.5);
    r.setHeld("bot", 0);
    tickFor(r, 3);
    expect(r.state.bot.cards[0]).not.toBeNull();
    expect(r.state.bot.cards[1] ?? null).toBeNull();
  });

  it("a snapshot mid double spin resumes the same", () => {
    const r = awakeRun(2);
    r.buyBotMulti();
    tickFor(r, 2);
    const back = Run.fromSnapshot(structuredClone(r.snapshot()));
    tickFor(r, 3);
    tickFor(back, 3);
    expect(back.state.bot).toEqual(r.state.bot);
  });
});
