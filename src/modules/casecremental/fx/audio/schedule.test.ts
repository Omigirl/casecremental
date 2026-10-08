import { describe, expect, it } from "vitest";
import { barSeconds, comboPitch, crossfade, jitter, musicFor, nextBar, pickVariant } from "./schedule";

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
