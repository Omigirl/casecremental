import { describe, expect, it } from "vitest";
import { priceOf } from "./content/cases";
import { DEFAULT_SETUP, Run, type RunSetup } from "./run";
import type { RarityId } from "./types";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};
const setup = (over: Partial<RunSetup>): RunSetup => ({ ...DEFAULT_SETUP, ...over });
function reveal(run: Run, rarity: RarityId | null = null) {
  run.state.cash = Math.max(run.state.cash, 1e6);
  if (rarity) run.forceNextRarity(rarity);
  expect(run.buyCase("bootcamp").ok).toBe(true);
  expect(run.insertKey().ok).toBe(true);
  const b = run.state.bench;
  tickFor(run, (b.phase === "spinning" ? b.fullDuration : 0) + 0.1);
  const r = run.state.bench;
  if (r.phase !== "revealed") throw new Error("expected revealed");
  return r.drop;
}

describe("run setup", () => {
  it("starts from the setup's cash and keeps its own copy of the charm list", () => {
    const charms = ["insider" as const];
    const run = new Run(1, setup({ startCash: 50, charms }));
    charms.length = 0;
    expect(run.state.cash).toBe(50);
    expect(run.setup.charms).toEqual(["insider"]);
  });

  it("pays a drop: value × Appraiser × charms × catch-up, and × combo only by hand", () => {
    const run = new Run(1, setup({ valueBoost: 6 }));
    const d = reveal(run, "milspec");
    expect(run.payout(d, false)).toBeCloseTo(d.value * 6);
    const before = run.state.cash;
    run.sell();
    expect(run.state.cash - before).toBeCloseTo(d.value * 6 * 1.02);
  });

  it("Insider makes cases 30 % cheaper", () => {
    const run = new Run(1, setup({ charms: ["insider"] }));
    expect(run.casePrice("bootcamp")).toBeCloseTo(priceOf("bootcamp") * 0.7);
    const before = run.state.cash;
    run.buyCase("bootcamp");
    expect(before - run.state.cash).toBeCloseTo(priceOf("bootcamp") * 0.7);
  });

  it("Lucky Seven makes every 7th case at least Classified", () => {
    const run = new Run(3, setup({ charms: ["luckySeven"] }));
    for (let i = 1; i <= 21; i++) {
      const d = reveal(run);
      run.sell();
      if (i % 7 === 0) expect(["classified", "covert", "gold"]).toContain(d.rarity);
    }
  });

  it("Pity Jar counts Mil-Specs and resets on a Covert", () => {
    const run = new Run(1, setup({ charms: ["pityJar"] }));
    reveal(run, "milspec");
    run.sell();
    reveal(run, "milspec");
    run.sell();
    expect(run.state.pity).toBe(2);
    reveal(run, "covert");
    expect(run.state.pity).toBe(0);
  });

  it("Ricochet: a Covert puts a free case of the same type on the bench once it is clear", () => {
    const run = new Run(1, setup({ charms: ["ricochet"] }));
    reveal(run, "covert");
    run.sell();
    run.tick(DT);
    expect(run.state.bench).toEqual({ phase: "locked", caseId: "bootcamp", free: true });
  });

  it("Gold Rush starts a Golden Hour on a ★", () => {
    const run = new Run(1, setup({ charms: ["goldRush"] }));
    reveal(run, "gold");
    expect(run.state.goldenHourUntil).toBeCloseTo(run.state.revealedAt + 5);
  });

  it("a sale says where it came from", () => {
    const run = new Run(1);
    reveal(run, "milspec");
    run.drainEvents();
    run.sell();
    expect(run.drainEvents().find((e) => e.type === "sold")).toMatchObject({ source: "bench" });
  });
});
