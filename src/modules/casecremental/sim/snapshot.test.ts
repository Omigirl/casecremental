import { describe, expect, it } from "vitest";
import { DEFAULT_SETUP, Run } from "./run";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};

describe("run snapshots", () => {
  it("restores a run mid-way — the bot carrying a card — and continues identically", () => {
    const a = new Run(5, { ...DEFAULT_SETUP, botAwake: true, charms: ["doubleTap"] });
    a.state.cash = 1e6;
    a.buyCase("bootcamp");
    a.insertKey();
    for (let i = 0; i < 600 && a.state.bot.job?.step !== "carry"; i++) a.tick(DT); // revealed, picked up, in hand
    expect(a.state.bot.job?.drop).not.toBeNull();
    const snap = JSON.parse(JSON.stringify(a.snapshot())) as ReturnType<Run["snapshot"]>;
    const b = Run.fromSnapshot(snap);
    expect(b.state).toEqual(a.state);
    expect(b.setup).toEqual(a.setup);
    for (const r of [a, b]) {
      r.drainEvents();
      tickFor(r, 5);
      r.buyCase("bootcamp");
      r.insertKey();
      tickFor(r, 4);
    }
    expect(b.state).toEqual(a.state);
  });

  it("restores a finale in progress", () => {
    const a = new Run(2);
    a.state.unlocked = ["bootcamp", "wildwood", "bedrock"];
    a.state.cash = 1e9;
    a.buyVault();
    tickFor(a, 7);
    const b = Run.fromSnapshot(a.snapshot());
    tickFor(b, 14);
    expect(b.state.over).toBe(true);
  });
});
