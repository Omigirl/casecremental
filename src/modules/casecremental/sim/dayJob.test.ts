import { describe, expect, it } from "vitest";
import { Run } from "./run";
import { DAY_JOB_PAY, DAY_JOB_SECONDS } from "./tuning";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};

describe("the day job", () => {
  it("is offered only when broke with an empty bench, once at a time", () => {
    const run = new Run(1);
    expect(run.dayJobAvailable()).toBe(false); // can afford a case
    expect(run.startDayJob().ok).toBe(false);
    run.state.cash = 0;
    expect(run.dayJobAvailable()).toBe(true);
    expect(run.startDayJob().ok).toBe(true);
    expect(run.startDayJob()).toEqual({ ok: false, reason: "already working" });
    expect(run.dayJobAvailable()).toBe(false);
  });

  it("pays $2 nine times in ten after a ~3 s shift", () => {
    let paid = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const run = new Run(seed);
      run.state.cash = 0;
      run.startDayJob();
      tickFor(run, DAY_JOB_SECONDS - 0.1);
      expect(run.state.dayJob).not.toBeNull();
      tickFor(run, 0.2);
      expect(run.state.dayJob).toBeNull();
      const done = run.drainEvents().find((e) => e.type === "dayJobDone");
      expect(done && done.type === "dayJobDone" && [0, DAY_JOB_PAY].includes(done.amount)).toBe(true);
      if (run.state.cash === DAY_JOB_PAY) paid++;
    }
    expect(paid / 400).toBeGreaterThan(0.85);
    expect(paid / 400).toBeLessThan(0.95);
  });

  it("never hands out free cases any more", () => {
    const run = new Run(1);
    run.state.cash = 0;
    tickFor(run, 30);
    expect(run.state.bench.phase).toBe("empty");
  });
});
