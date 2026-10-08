import { describe, expect, it } from "vitest";
import { Run } from "../sim/run";
import { DAY_JOB_SECONDS } from "../sim/tuning";
import { buildView } from "../game/view";
import { dayJobButton } from "./dayJob";

describe("the day-job button", () => {
  it("shows only when broke with an empty bench, and while working", () => {
    const run = new Run(1);
    expect(dayJobButton(buildView(run))).toBeNull();
    run.state.cash = 0;
    expect(dayJobButton(buildView(run))).toEqual({ enabled: true, progress: 0 });
    run.startDayJob();
    run.tick(DAY_JOB_SECONDS / 2);
    const b = dayJobButton(buildView(run))!;
    expect(b.enabled).toBe(false);
    expect(b.progress).toBeCloseTo(0.5, 1);
  });
});
