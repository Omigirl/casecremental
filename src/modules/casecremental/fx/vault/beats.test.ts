import { describe, expect, it } from "vitest";
import { breath, dueBeats } from "./beats";
import { VAULT_CUES } from "./cues";

describe("the opening's beats", () => {
  it("fires the key turn on the first frame of a live opening", () => {
    expect(dueBeats(-1e-6, 0)).toEqual(["keyTurn"]);
    expect(dueBeats(-1e-6, 0.016)).toEqual(["keyTurn"]);
  });

  it("fires the impact (and its firework kick) when t crosses 1.0, once", () => {
    expect(dueBeats(0.98, 1.0)).toEqual(["impact", "firework"]);
    expect(dueBeats(1.0, 1.02)).toEqual([]);
    expect(dueBeats(0.9, 0.99)).toEqual([]);
  });

  it("fires a firework at each of VAULT_CUES.fireworks", () => {
    for (const at of VAULT_CUES.fireworks) expect(dueBeats(at - 0.01, at + 0.01)).toContain("firework");
    expect(dueBeats(3.5, 4.49)).toEqual([]);
    expect(dueBeats(3.5, 4.5)).toEqual(["firework"]);
  });

  it("starts the celebration at 9.0, ticks while counting, and dings once at 11.5", () => {
    expect(dueBeats(8.99, 9.0)).toEqual(["firework", "celebrate"]); // the volley's first kick opens the count-up
    expect(dueBeats(9.07, 9.09)).toEqual(["tick"]);
    expect(dueBeats(9.09, 9.15)).toEqual([]);
    expect(dueBeats(11.49, 11.51)).toEqual(["countDone"]);
    expect(dueBeats(11.51, 14.5)).toEqual([]);
  });

  it("collapses the ticks a long frame crosses into one (the other beats each fire)", () => {
    expect(dueBeats(10.06, 10.6)).toEqual(["tick"]);
    const kicks = VAULT_CUES.fireworks.length;
    const all = dueBeats(-1e-6, 14.5);
    expect(all.filter((b) => b === "firework")).toHaveLength(kicks);
    expect(all.filter((b) => b !== "firework")).toEqual(["keyTurn", "impact", "celebrate", "tick", "countDone"]);
  });

  it("replays nothing on a restore (prevT = t)", () => {
    for (const t of [0, 1.0, 3.0, 9.0, 9.08, 11.5, 14]) expect(dueBeats(t, t)).toEqual([]);
  });

  it("walks a whole opening frame by frame: every beat once, in order", () => {
    const seen: string[] = [];
    let prev = -1e-6;
    for (let t = 0; t <= 14.5; t += 1 / 60) {
      seen.push(...dueBeats(prev, t));
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
