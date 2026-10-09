import { describe, expect, it } from "vitest";
import { breath, dueBeats } from "./beats";
import { INTRO_HITS, VAULT_CUES } from "./cues";

/** The beats' names, in order. */
const due = (prevT: number, t: number) => dueBeats(prevT, t).map((b) => b.beat);
const END = 17.4;

describe("the opening's beats", () => {
  it("fires the key turn on the first frame of a live opening", () => {
    expect(due(-1e-6, 0)).toEqual(["keyTurn"]);
    expect(due(-1e-6, 0.016)).toEqual(["keyTurn"]);
  });

  it("fires the impact (and its firework kick) when t crosses 3.40, once", () => {
    expect(due(3.38, 3.4)).toEqual(["impact", "firework"]);
    expect(due(3.4, 3.42)).toEqual([]);
    expect(due(3.31, 3.39)).toEqual([]);
  });

  it("fires a firework at each of VAULT_CUES.fireworks", () => {
    for (const at of VAULT_CUES.fireworks) expect(due(at - 0.01, at + 0.01)).toContain("firework");
    expect(due(5.9, 6.89)).toEqual([]);
    expect(due(5.9, 6.9)).toEqual(["firework"]);
  });

  it("starts the celebration at 11.4, ticks while counting, and dings once at 13.9", () => {
    expect(due(11.39, 11.4)).toEqual(["firework", "celebrate"]); // the volley's first kick opens the count-up
    expect(due(11.47, 11.49)).toEqual(["tick"]);
    expect(due(11.49, 11.55)).toEqual([]);
    expect(due(13.89, 13.91)).toEqual(["countDone"]);
    expect(due(13.91, END)).toEqual([]);
  });

  it("collapses the ticks a long frame crosses into one (the other beats each fire)", () => {
    expect(due(12.46, 13.0)).toEqual(["tick"]);
    const kicks = VAULT_CUES.fireworks.length;
    const all = due(-1e-6, END);
    expect(all.filter((b) => b === "firework")).toHaveLength(kicks);
    expect(all.filter((b) => b !== "firework" && b !== "introHit")).toEqual(["keyTurn", "impact", "celebrate", "tick", "countDone"]);
  });

  it("replays nothing on a restore (prevT = t)", () => {
    for (const t of [0, 0.45, 2.0, 3.4, 5.4, 11.4, 11.48, 13.9, 16]) expect(due(t, t)).toEqual([]);
  });

  it("walks a whole opening frame by frame: every beat once, in order", () => {
    const seen: string[] = [];
    let prev = -1e-6;
    for (let t = 0; t <= END; t += 1 / 60) {
      seen.push(...due(prev, t));
      prev = t;
    }
    const once = seen.filter((b) => b !== "tick");
    expect(once.filter((b) => b === "firework")).toHaveLength(VAULT_CUES.fireworks.length);
    expect(once.filter((b) => b === "introHit")).toHaveLength(INTRO_HITS.length);
    expect(once.filter((b) => b !== "firework" && b !== "introHit")).toEqual(["keyTurn", "impact", "celebrate", "countDone"]);
    const ticks = seen.length - once.length;
    expect(ticks).toBeGreaterThanOrEqual(25); // ~every 0.08 s across 11.4-13.9
    expect(ticks).toBeLessThanOrEqual(32);
  });
});

describe("the intro's hits", () => {
  it("fire once each between the key turn and the impact, carrying their place in INTRO_HITS", () => {
    const hits = dueBeats(-1e-6, END).filter((b) => b.beat === "introHit");
    expect(hits.map((b) => b.at)).toEqual(INTRO_HITS.map((h) => h.at));
    expect(hits.map((b) => b.hit)).toEqual(INTRO_HITS.map((_, i) => i));
    expect(due(0.42, 0.43)).toEqual(["introHit"]);
    expect(due(1.2, 1.97)).toEqual([]); // the held pause
    // a restore part-way: the next hit is still the one at its index
    expect(dueBeats(2.6, 2.7)).toEqual([{ at: 2.625, beat: "introHit", hit: 5 }]);
  });

  it("are not kicks: none is in the audible firework list, and no firework fires before the impact", () => {
    for (const h of INTRO_HITS) expect(VAULT_CUES.fireworks).not.toContain(h.at);
    expect(due(-1e-6, VAULT_CUES.impact - 0.001)).not.toContain("firework");
    for (const b of dueBeats(-1e-6, END)) {
      if (b.beat !== "firework") expect(b.kick).toBeUndefined();
      if (b.beat !== "introHit") expect(b.hit).toBeUndefined();
    }
  });
});

describe("the kicks", () => {
  it("each carries its place in VAULT_CUES.fireworks (where it bursts), the same live or after a reload", () => {
    const kicks = dueBeats(-1e-6, END).filter((b) => b.beat === "firework");
    expect(kicks.map((b) => b.kick)).toEqual(VAULT_CUES.fireworks.map((_, i) => i));
    expect(kicks.map((b) => b.at)).toEqual([...VAULT_CUES.fireworks]);
    // a restore part-way: the next kick is still the one at its index, not the first of the session
    const i = VAULT_CUES.fireworks.indexOf(9.4);
    expect(dueBeats(9.3, 9.41)).toEqual([{ at: 9.4, beat: "firework", kick: i }]);
  });
});

describe("the spin's breathing", () => {
  it("is lighter at 5.9-6.9 than at 4.9-5.9 and 6.9-8.4", () => {
    const quiet = breath(6.4);
    for (const t of [5.2, 5.6, 7.4, 8.2]) expect(breath(t)).toBeGreaterThan(quiet);
    expect(breath(5.4)).toBe(1);
    expect(breath(7.9)).toBe(1);
    expect(quiet).toBeLessThan(0.6);
    expect(quiet).toBeGreaterThan(0);
  });
});
