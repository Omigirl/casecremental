import { describe, expect, it } from "vitest";
import { Run } from "../sim/run";
import type { Drop } from "../sim/types";
import { restorePlan } from "./restore";

// Review fix: the host's Mode Router destroys a suspended scene; when the player comes back from
// the lobby, a fresh World must redraw the bench from the run instead of a blank default.

const DROP: Drop = {
  id: 1,
  caseId: "bootcamp",
  skinId: "bc_woodland",
  rarity: "milspec",
  float: 0.1,
  wear: "MW",
  statTrak: false,
  value: 1,
};

const tick = (run: Run, s: number) => {
  for (let t = 0; t < s; t += 1 / 30) run.tick(1 / 30);
};

/** A run with Multi-open ×2 bought and cash for two cases. */
const multi = () => {
  const run = new Run(9);
  run.state.upgrades.multiOpen = 1;
  run.state.cash = 1000;
  return run;
};

describe("restorePlan", () => {
  it("is empty for a fresh run", () => {
    expect(restorePlan(new Run(1).state)).toEqual({ caseId: null, spinning: null, revealed: null, stage: 1, botReel: null });
  });

  it("restores a locked case", () => {
    const run = new Run(1);
    run.buyCase("bootcamp");
    expect(restorePlan(run.state)).toMatchObject({ caseId: "bootcamp", spinning: null, revealed: null });
  });

  it("restores a spin with its real winner", () => {
    const run = new Run(1);
    run.buyCase("bootcamp");
    run.insertKey();
    const b = run.state.bench;
    if (b.phase !== "spinning") throw new Error("expected spinning");
    expect(restorePlan(run.state)).toMatchObject({ caseId: "bootcamp", spinning: b.reels, revealed: null });
    expect(b.reels).toHaveLength(1);
  });

  it("restores a revealed skin and the current stage", () => {
    const run = new Run(1);
    run.buyCase("bootcamp");
    run.insertKey();
    tick(run, 6.1);
    run.state.stage = 2;
    const b = run.state.bench;
    if (b.phase !== "revealed") throw new Error("expected revealed");
    expect(restorePlan(run.state)).toMatchObject({ caseId: "bootcamp", spinning: null, revealed: b.cards, stage: 2 });
  });

  it("restores a two-reel spin and a half-sold pair (Review Focus 3)", () => {
    const run = multi();
    run.buyCase("bootcamp");
    run.insertKey();
    tick(run, 1);
    const b = run.state.bench;
    if (b.phase !== "spinning") throw new Error("expected spinning");
    const plan = restorePlan(run.state);
    expect(plan.spinning).toHaveLength(2);
    expect(plan.spinning!.map((r) => [r.drop.id, r.tease, r.duration])).toEqual(b.reels.map((r) => [r.drop.id, r.tease, r.duration]));
    expect(plan.revealed).toBeNull();

    tick(run, b.fullDuration);
    const r = run.state.bench;
    if (r.phase !== "revealed") throw new Error("expected revealed");
    const second = r.cards[1]!;
    expect(run.sell(0).ok).toBe(true);
    expect(restorePlan(run.state)).toMatchObject({ caseId: "bootcamp", spinning: null, revealed: [null, second] });
  });

  it("restores the bot's reel: its spin under way, or landed on the drop its waiting card shows", () => {
    const run = new Run(1);
    const s = run.state;
    s.bot.spin = { caseId: "bootcamp", drops: [{ ...DROP, id: 7 }], elapsed: 1, duration: 3 };
    expect(restorePlan(s).botReel).toEqual({ caseId: "bootcamp", skinId: DROP.skinId, landed: false });
    s.bot.spin = null;
    s.bot.cards = [{ ...DROP, id: 8, caseId: "bootcamp" }];
    expect(restorePlan(s).botReel).toEqual({ caseId: "bootcamp", skinId: DROP.skinId, landed: true });
    s.bot.cards = [];
    expect(restorePlan(s).botReel).toBeNull();
  });
});
