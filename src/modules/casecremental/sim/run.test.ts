import { describe, expect, it } from "vitest";
import { priceOf } from "./content/cases";
import { Run, type SimEvent } from "./run";
import { FREE_CASE_SECONDS, SPIN_BASE_SECONDS, START_CASH, TEASE_CRAWL } from "./tuning";

const DT = 1 / 30;
function tickFor(run: Run, seconds: number) {
  for (let t = 0; t < seconds; t += DT) run.tick(DT);
}
function revealOne(run: Run, caseId = "bootcamp") {
  expect(run.buyCase(caseId).ok).toBe(true);
  expect(run.insertKey().ok).toBe(true);
  const spin = run.state.bench;
  tickFor(run, (spin.phase === "spinning" ? spin.fullDuration : 0) + 0.1); // a tease stretches the spin
  const b = run.state.bench;
  if (b.phase !== "revealed") throw new Error(`expected revealed, got ${b.phase}`);
  return b.drop;
}
const types = (events: SimEvent[]) => events.map((e) => e.type);
/** Tick until the spinning reel lands, tease crawl included. */
function spinOut(run: Run) {
  const b = run.state.bench;
  tickFor(run, (b.phase === "spinning" ? b.fullDuration : 0) + 0.05);
}

describe("Run", () => {
  it("starts with cash, the first case unlocked and an empty bench", () => {
    const run = new Run(1);
    expect(run.state.cash).toBe(START_CASH);
    expect(run.state.unlocked).toEqual(["bootcamp"]);
    expect(run.state.bench.phase).toBe("empty");
  });

  it("buys a case once — a second buy on a busy bench is refused", () => {
    const run = new Run(1);
    expect(run.buyCase("bootcamp")).toEqual({ ok: true });
    expect(run.buyCase("bootcamp")).toEqual({ ok: false, reason: "bench is busy" });
    expect(run.state.cash).toBe(START_CASH - priceOf("bootcamp"));
    expect(run.state.bench).toEqual({ phase: "locked", caseId: "bootcamp", free: false });
  });

  it("refuses locked cases and empty wallets", () => {
    const run = new Run(1);
    expect(run.buyCase("wildwood").ok).toBe(false);
    run.state.cash = 0;
    expect(run.buyCase("bootcamp")).toEqual({ ok: false, reason: "not enough cash" });
  });

  it("a forced rarity (dev board) applies to the next drop only", () => {
    const run = new Run(1);
    run.forceNextRarity("gold");
    expect(revealOne(run).rarity).toBe("gold");
    run.sell();
    run.forceNextRarity("covert");
    expect(revealOne(run).rarity).toBe("covert");
    run.sell();
    const rest = Array.from({ length: 5 }, () => {
      const d = revealOne(run);
      run.sell();
      return d.rarity;
    });
    expect(rest.filter((r) => r === "covert" || r === "gold").length).toBeLessThan(5);
  });

  it("a knife on its way stretches the spin by the tease crawl and says so", () => {
    const run = new Run(1);
    run.forceNextRarity("gold");
    run.buyCase("bootcamp");
    run.insertKey();
    const b = run.state.bench;
    if (b.phase !== "spinning") throw new Error("expected spinning");
    expect(b.tease).toEqual({ strength: 1, fake: null, extraSeconds: TEASE_CRAWL * SPIN_BASE_SECONDS });
    expect(b.fullDuration).toBeCloseTo(SPIN_BASE_SECONDS * (1 + TEASE_CRAWL));
    const started = run.drainEvents().find((e) => e.type === "spinStarted");
    expect(started && started.type === "spinStarted" && started.tease).toEqual(b.tease);
  });

  it("the dev board can force a fake tease: an ordinary drop with a decoy beside it", () => {
    const run = new Run(1);
    run.forceFakeTease();
    run.buyCase("bootcamp");
    run.insertKey();
    const b = run.state.bench;
    if (b.phase !== "spinning") throw new Error("expected spinning");
    expect(b.drop.rarity).toBe("milspec");
    expect(b.tease?.fake).not.toBeNull();
    spinOut(run);
    expect(run.state.bench.phase).toBe("revealed");
  });

  it("a tease never costs the combo: its crawl doesn't count against the combo window", () => {
    const run = new Run(1);
    run.state.cash = 1000;
    revealOne(run);
    run.sell();
    expect(run.state.combo).toBe(1);
    run.forceNextRarity("gold"); // a full tease: SPIN_BASE × (1 + TEASE_CRAWL) ≈ 5.4 s, past the 4 s window
    revealOne(run);
    run.sell();
    expect(run.state.combo).toBe(2);
  });

  it("insertKey rolls the drop and spins; a second key is refused", () => {
    const run = new Run(1);
    expect(run.insertKey().ok).toBe(false);
    run.buyCase("bootcamp");
    expect(run.insertKey().ok).toBe(true);
    expect(run.insertKey().ok).toBe(false);
    const b = run.state.bench;
    expect(b.phase).toBe("spinning");
    if (b.phase === "spinning") {
      expect(b.fullDuration).toBe(SPIN_BASE_SECONDS);
      expect(b.drop.caseId).toBe("bootcamp");
    }
  });

  it("reveals after the full spin", () => {
    const run = new Run(1);
    run.buyCase("bootcamp");
    run.insertKey();
    tickFor(run, SPIN_BASE_SECONDS - 0.1);
    expect(run.state.bench.phase).toBe("spinning");
    tickFor(run, 0.2);
    expect(run.state.bench.phase).toBe("revealed");
    expect(types(run.drainEvents())).toEqual(["caseBought", "spinStarted", "revealed"]);
  });

  it("always runs the full spin - there is no brake; Quick Hands is what makes it faster", () => {
    const run = new Run(1);
    expect("brake" in run).toBe(false);
    run.buyCase("bootcamp");
    run.insertKey();
    tickFor(run, SPIN_BASE_SECONDS - 0.1);
    expect(run.state.bench.phase).toBe("spinning");
    tickFor(run, 0.2);
    expect(run.state.bench.phase).toBe("revealed");
  });

  it("sells once, paying value × appraiser × combo", () => {
    const run = new Run(2);
    const drop = revealOne(run);
    const before = run.state.cash;
    expect(run.sell().ok).toBe(true);
    expect(run.sell()).toEqual({ ok: false, reason: "nothing to sell" });
    expect(run.state.combo).toBe(1);
    expect(run.state.cash - before).toBeCloseTo(drop.value * 1.02, 6);
    expect(run.state.lifetimeEarnings).toBeCloseTo(drop.value * 1.02, 6);
  });

  it("grows the combo for quick sells and drops it after the window", () => {
    const run = new Run(3);
    run.state.cash = 1000;
    run.state.upgrades.quickHands = 5;
    for (let i = 0; i < 3; i++) {
      run.buyCase("bootcamp");
      run.insertKey();
      spinOut(run);
      run.sell();
    }
    expect(run.state.combo).toBe(3);
    tickFor(run, 4.5);
    expect(run.state.combo).toBe(0);
  });

  it("unlocks cases in ladder order, once", () => {
    const run = new Run(1);
    run.state.cash = 10_000;
    expect(run.unlockCase("bedrock")).toEqual({ ok: false, reason: "unlock the previous case first" });
    expect(run.unlockCase("wildwood").ok).toBe(true);
    expect(run.unlockCase("wildwood")).toEqual({ ok: false, reason: "already unlocked" });
    expect(run.unlockCase("bedrock").ok).toBe(true);
    expect(run.unlockCase("nope").ok).toBe(false);
    expect(run.state.unlocked).toEqual(["bootcamp", "wildwood", "bedrock"]);
  });

  it("buys upgrade levels until max", () => {
    const run = new Run(1);
    run.state.cash = 1e9;
    for (let i = 0; i < 10; i++) expect(run.buyUpgrade("quickHands").ok).toBe(true);
    expect(run.buyUpgrade("quickHands")).toEqual({ ok: false, reason: "max level" });
    expect(run.state.upgrades.quickHands).toBe(10);
    expect(run.effects().spinSeconds).toBeLessThan(1);
  });

  it("gives a free case when broke with an empty bench", () => {
    const run = new Run(1);
    run.state.cash = 0;
    tickFor(run, FREE_CASE_SECONDS - 0.5);
    expect(run.state.bench.phase).toBe("empty");
    tickFor(run, 1);
    expect(run.state.bench).toEqual({ phase: "locked", caseId: "bootcamp", free: true });
  });

  it("does not give free cases to a player who can pay", () => {
    const run = new Run(1);
    tickFor(run, FREE_CASE_SECONDS * 2);
    expect(run.state.bench.phase).toBe("empty");
  });

  it("climbs to stage 2 with fast, combo-heavy play", () => {
    const run = new Run(4);
    run.state.cash = 1e6;
    run.state.upgrades.quickHands = 5;
    const seen: SimEvent[] = [];
    for (let i = 0; i < 25; i++) {
      run.buyCase("bootcamp");
      run.insertKey();
      spinOut(run);
      run.sell();
      seen.push(...run.drainEvents());
    }
    expect(run.state.stage).toBeGreaterThanOrEqual(2);
    expect(seen.some((e) => e.type === "stageChanged" && e.stage === 2)).toBe(true);
  });

  it("is reproducible from the seed", () => {
    const a = new Run(99);
    const b = new Run(99);
    expect(revealOne(a)).toEqual(revealOne(b));
  });
});

describe("Run intensity after a pause (review fix)", () => {
  function fastCycles(run: Run, n: number) {
    run.state.upgrades.quickHands = 5;
    for (let i = 0; i < n; i++) {
      run.buyCase("bootcamp");
      run.insertKey();
      spinOut(run);
      run.sell();
    }
  }

  it("keeps the stage through a short pause — the combo's share fades instead of snapping", () => {
    const run = new Run(4);
    run.state.cash = 1e6;
    fastCycles(run, 25);
    expect(run.state.stage).toBeGreaterThanOrEqual(2);
    tickFor(run, 5);
    expect(run.state.combo).toBe(0);
    expect(run.state.stage).toBeGreaterThanOrEqual(2);
  });

  it("still comes down after a long pause", () => {
    const run = new Run(4);
    run.state.cash = 1e6;
    fastCycles(run, 25);
    tickFor(run, 60);
    expect(run.state.stage).toBe(1);
  });
});
