import { describe, expect, it } from "vitest";
import { breath, dueBeats } from "./beats";
import { VAULT_CUES } from "./cues";

/** The beats' names, in order. */
const due = (prevT: number, t: number) => dueBeats(prevT, t).map((b) => b.beat);

describe("the opening's beats", () => {
  it("fires the key turn on the first frame of a live opening", () => {
    expect(due(-1e-6, 0)).toEqual(["keyTurn"]);
    expect(due(-1e-6, 0.016)).toEqual(["keyTurn"]);
  });

  it("fires the impact (and its firework kick) when t crosses 1.0, once", () => {
    expect(due(0.98, 1.0)).toEqual(["impact", "firework"]);
    expect(due(1.0, 1.02)).toEqual([]);
    expect(due(0.9, 0.99)).toEqual([]);
  });

  it("fires a firework at each of VAULT_CUES.fireworks", () => {
    for (const at of VAULT_CUES.fireworks) expect(due(at - 0.01, at + 0.01)).toContain("firework");
    expect(due(3.5, 4.49)).toEqual([]);
    expect(due(3.5, 4.5)).toEqual(["firework"]);
  });

  it("starts the celebration at 9.0, ticks while counting, and dings once at 11.5", () => {
    expect(due(8.99, 9.0)).toEqual(["firework", "celebrate"]); // the volley's first kick opens the count-up
    expect(due(9.07, 9.09)).toEqual(["tick"]);
    expect(due(9.09, 9.15)).toEqual([]);
    expect(due(11.49, 11.51)).toEqual(["countDone"]);
    expect(due(11.51, 14.5)).toEqual([]);
  });

  it("collapses the ticks a long frame crosses into one (the other beats each fire)", () => {
    expect(due(10.06, 10.6)).toEqual(["tick"]);
    const kicks = VAULT_CUES.fireworks.length;
    const all = due(-1e-6, 14.5);
    expect(all.filter((b) => b === "firework")).toHaveLength(kicks);
    expect(all.filter((b) => b !== "firework")).toEqual(["keyTurn", "impact", "celebrate", "tick", "countDone"]);
  });

  it("replays nothing on a restore (prevT = t)", () => {
    for (const t of [0, 1.0, 3.0, 9.0, 9.08, 11.5, 14]) expect(due(t, t)).toEqual([]);
  });

  it("walks a whole opening frame by frame: every beat once, in order", () => {
    const seen: string[] = [];
    let prev = -1e-6;
    for (let t = 0; t <= 14.5; t += 1 / 60) {
      seen.push(...due(prev, t));
      prev = t;
    }
    const once = seen.filter((b) => b !== "tick");
    expect(once.filter((b) => b === "firework")).toHaveLength(VAULT_CUES.fireworks.length);
    expect(once.filter((b) => b !== "firework")).toEqual(["keyTurn", "impact", "celebrate", "countDone"]);
    const ticks = seen.length - once.length;
    expect(ticks).toBeGreaterThanOrEqual(25); // ~every 0.08 s across 9.0-11.5
    expect(ticks).toBeLessThanOrEqual(32);
  });
});

describe("the kicks", () => {
  it("each carries its place in VAULT_CUES.fireworks (where it bursts), the same live or after a reload", () => {
    const kicks = dueBeats(-1e-6, 14.5).filter((b) => b.beat === "firework");
    expect(kicks.map((b) => b.kick)).toEqual(VAULT_CUES.fireworks.map((_, i) => i));
    expect(kicks.map((b) => b.at)).toEqual([...VAULT_CUES.fireworks]);
    // a restore part-way: the next kick is still the one at its index, not the first of the session
    const i = VAULT_CUES.fireworks.indexOf(7);
    expect(dueBeats(6.9, 7.01)).toEqual([{ at: 7, beat: "firework", kick: i }]);
    for (const b of dueBeats(-1e-6, 14.5)) if (b.beat !== "firework") expect(b.kick).toBeUndefined();
  });
});

describe("the spin's breathing", () => {
  it("is lighter at 3.5-4.5 than at 2.5-3.5 and 4.5-6", () => {
    const quiet = breath(4.0);
    for (const t of [2.8, 3.2, 5.0, 5.8]) expect(breath(t)).toBeGreaterThan(quiet);
    expect(breath(3.0)).toBe(1);
    expect(breath(5.5)).toBe(1);
    expect(quiet).toBeLessThan(0.6);
    expect(quiet).toBeGreaterThan(0);
  });
});
