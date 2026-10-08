import { describe, expect, it } from "vitest";
import { unlockCostOf } from "../sim/content/cases";
import { Run } from "../sim/run";
import { START_CASH } from "../sim/tuning";
import { buildView } from "./view";

describe("buildView", () => {
  it("shows a fresh run", () => {
    const v = buildView(new Run(1));
    expect(v.cash).toBe(START_CASH);
    expect(v.phase).toBe("empty");
    expect(v.stageName).toBe("Sober");
    expect(v.cases.map((c) => [c.id, c.unlocked, c.canBuy])).toEqual([
      ["bootcamp", true, true],
      ["wildwood", false, false],
      ["bedrock", false, false],
    ]);
    expect(v.upgrades.map((u) => u.id)).toEqual(["luck", "appraiser", "quickHands"]);
    expect(v.nextGoal).toEqual({
      kind: "unlock",
      caseId: "wildwood",
      progress: START_CASH / unlockCostOf("wildwood"),
    });
  });

  it("can't buy while the bench is busy", () => {
    const run = new Run(1);
    run.buyCase("bootcamp");
    expect(buildView(run).cases[0]!.canBuy).toBe(false);
  });

  it("only offers the next case in the ladder to unlock", () => {
    const run = new Run(1);
    run.state.cash = 100_000;
    const v = buildView(run);
    expect(v.cases[1]!.canUnlock).toBe(true);
    expect(v.cases[2]!.canUnlock).toBe(false);
    expect(v.nextGoal!.progress).toBe(1);
  });

  it("falls back to the cheapest upgrade once every case is unlocked (review fix)", () => {
    const run = new Run(1);
    run.state.cash = 1e12;
    run.unlockCase("wildwood");
    run.unlockCase("bedrock");
    run.state.cash = 4;
    expect(buildView(run).nextGoal).toEqual({ kind: "upgrade", upgradeId: "quickHands", level: 1, progress: 0.5 });
  });

  it("has no goal only when everything is unlocked and maxed; maxed upgrades can't be bought", () => {
    const run = new Run(1);
    run.state.cash = 1e15;
    run.unlockCase("wildwood");
    run.unlockCase("bedrock");
    for (const id of ["luck", "appraiser", "quickHands"] as const) while (run.buyUpgrade(id).ok) {}
    const v = buildView(run);
    expect(v.nextGoal).toBeNull();
    const qh = v.upgrades.find((u) => u.id === "quickHands")!;
    expect(qh.cost).toBeNull();
    expect(qh.canBuy).toBe(false);
  });
});
