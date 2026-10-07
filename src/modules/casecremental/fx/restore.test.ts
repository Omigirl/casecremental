import { describe, expect, it } from "vitest";
import { Run } from "../sim/run";
import { restorePlan } from "./restore";

// Review fix: the host's Mode Router destroys a suspended scene; when the player comes back from
// the lobby, a fresh World must redraw the bench from the run instead of a blank default.

const tick = (run: Run, s: number) => {
  for (let t = 0; t < s; t += 1 / 30) run.tick(1 / 30);
};

describe("restorePlan", () => {
  it("is empty for a fresh run", () => {
    expect(restorePlan(new Run(1).state)).toEqual({ caseId: null, spinning: null, revealed: null, stage: 1 });
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
    expect(restorePlan(run.state)).toMatchObject({ caseId: "bootcamp", spinning: b.drop, revealed: null });
  });

  it("restores a revealed skin and the current stage", () => {
    const run = new Run(1);
    run.buyCase("bootcamp");
    run.insertKey();
    tick(run, 6.1);
    run.state.stage = 2;
    const b = run.state.bench;
    if (b.phase !== "revealed") throw new Error("expected revealed");
    expect(restorePlan(run.state)).toEqual({ caseId: "bootcamp", spinning: null, revealed: b.drop, stage: 2 });
  });
});
