import { describe, expect, it } from "vitest";
import {
  barSeconds,
  comboPitch,
  crossfade,
  FINALE_RUN,
  jitter,
  LOOP_PLAYS,
  musicFor,
  nextBar,
  nextReady,
  pickVariant,
  playlistFor,
  swapTime,
} from "./schedule";

describe("mixer schedule", () => {
  it("never repeats a variant back to back", () => {
    let r = 0;
    const random = () => (r = (r + 0.37) % 1);
    let last = -1;
    for (let i = 0; i < 200; i++) {
      const v = pickVariant(4, last, random);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
      expect(v).not.toBe(last);
      last = v;
    }
    expect(pickVariant(1, 0, Math.random)).toBe(0);
  });

  it("jitters pitch by at most 4 % and level by at most 2 dB", () => {
    for (const x of [0, 0.5, 0.999]) {
      const j = jitter(() => x);
      expect(Math.abs(j.rate - 1)).toBeLessThanOrEqual(0.04 + 1e-9);
      expect(Math.abs(20 * Math.log10(j.gain))).toBeLessThanOrEqual(2.0001);
    }
  });

  it("raises the pitch with the combo, capped at an octave", () => {
    expect(comboPitch(1)).toBe(1);
    expect(comboPitch(5)).toBeCloseTo(2 ** (1 / 12));
    expect(comboPitch(1000)).toBeCloseTo(2);
  });

  it("changes music on bar lines", () => {
    expect(barSeconds()).toBe(2);
    expect(nextBar(10, 3)).toBe(11);
    expect(nextBar(11, 3)).toBe(11);
    expect(nextBar(1, 3)).toBe(3);
  });

  it("crossfades at equal power", () => {
    expect(crossfade(0)).toEqual([1, 0]);
    const [a, b] = crossfade(0.5);
    expect(a * a + b * b).toBeCloseTo(1);
  });

  it("uses the nearest lower stage loop until a stage has its own", () => {
    expect(musicFor(1, [1, 2])).toBe(1);
    expect(musicFor(4, [1, 2])).toBe(2);
    expect(musicFor(1, [])).toBeNull();
  });
});

describe("stage playlists (finish spec §6)", () => {
  it("plays a stage's own loops, plus Run 4's finale in stage 5 from Run 4 on", () => {
    expect(playlistFor(["a", "b", "c"], 5, 3, "f")).toEqual(["a", "b", "c"]);
    expect(playlistFor(["a", "b", "c"], 5, FINALE_RUN, "f")).toEqual(["a", "b", "c", "f"]);
    expect(playlistFor(["a", "b", "c"], 5, FINALE_RUN + 1, "f")).toEqual(["a", "b", "c", "f"]);
    expect(playlistFor(["a", "b", "c"], 4, FINALE_RUN, "f")).toEqual(["a", "b", "c"]);
    expect(playlistFor(["a"], 5, FINALE_RUN, null)).toEqual(["a"]);
  });

  it("hands a loop over after it has played twice, on the bar line nearest that end", () => {
    expect(LOOP_PLAYS).toBe(2);
    expect(swapTime(0, 32)).toBe(64);
    expect(swapTime(3, 32)).toBe(67); // on the grid the loop started on
    expect(swapTime(0, 32.04)).toBe(64); // an mp3 a few ms long stays on its grid
    expect(swapTime(0, 31.97)).toBe(64);
    expect(swapTime(0, 10)).toBe(20);
    expect(swapTime(5, 0.2)).toBe(7); // at least one bar
  });

  it("skips loops that are not ready, wrapping, and gives up when none is", () => {
    expect(nextReady(1, 3, (i) => i !== 1)).toBe(2);
    expect(nextReady(2, 3, (i) => i === 0)).toBe(0);
    expect(nextReady(0, 3, () => false)).toBeNull();
    expect(nextReady(4, 3, () => true)).toBe(1); // a cursor past a shorter playlist wraps
    expect(nextReady(0, 0, () => true)).toBeNull();
  });
});
