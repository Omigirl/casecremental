import { describe, expect, it } from "vitest";
import { DEFAULT_SETUP, Run } from "./run";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};

describe("run snapshots", () => {
  it("restores a run mid-way — the bot mid-spin, your card waiting — and continues identically", () => {
    const a = new Run(5, { ...DEFAULT_SETUP, botAwake: true, charms: ["doubleTap"] });
    a.state.cash = 1e6;
    a.buyCase("bootcamp");
    a.insertKey();
    for (let i = 0; i < 900 && !(a.state.bot.card && a.state.bench.phase === "revealed"); i++) a.tick(DT);
    a.sellBotCard();
    a.tick(DT); // the bot starts its next spin
    expect(a.state.bot.spin).not.toBeNull();
    const snap = JSON.parse(JSON.stringify(a.snapshot())) as ReturnType<Run["snapshot"]>;
    const b = Run.fromSnapshot(snap);
    expect(b.state).toEqual(a.state);
    expect(b.setup).toEqual(a.setup);
    for (const r of [a, b]) {
      r.drainEvents();
      tickFor(r, 5);
      r.sell();
      r.sellBotCard();
      r.buyCase("bootcamp");
      r.insertKey();
      tickFor(r, 4);
    }
    expect(b.state).toEqual(a.state);
  });

  it("restores a vault waiting for its key, and one mid-opening (Review Focus 1)", () => {
    const a = new Run(2);
    a.state.unlocked = ["bootcamp", "wildwood", "bedrock"];
    a.state.cash = 1e9;
    a.buyVault();
    const waiting = Run.fromSnapshot(JSON.parse(JSON.stringify(a.snapshot())));
    expect(waiting.state.vault).toEqual({ phase: "key" });
    expect(waiting.state.cash).toBe(a.state.cash); // charged once
    a.turnVaultKey();
    tickFor(a, 7);
    const b = Run.fromSnapshot(a.snapshot());
    tickFor(b, 20);
    expect(b.state.over).toBe(true);
  });
});
