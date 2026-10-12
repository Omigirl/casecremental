import { describe, expect, it } from "vitest";
import { UPGRADER_SPIN_SECONDS } from "../../sim/tuning";
import {
  DIAL_SECTORS,
  DIAL_TICKS_PER_SECOND,
  DIAL_TURNS,
  DIAL_WIN_FADE_SECONDS,
  dialAlpha,
  dialCentre,
  dialTexts,
  landsInArc,
  needleAngle,
  tickDue,
  ticksCrossed,
  winArc,
} from "./upgraderRules";

const TAU = Math.PI * 2;

describe("the Upgrader's dial", () => {
  it("lands the needle on the roll, inside the win arc exactly when the roll wins", () => {
    for (const [roll, chance] of [
      [0.1, 0.6],
      [0.59, 0.6],
      [0.61, 0.6],
      [0.005, 0.009],
      [0.5, 0.009],
    ] as const) {
      const end = needleAngle({ roll, elapsed: UPGRADER_SPIN_SECONDS });
      expect(end).toBeCloseTo((DIAL_TURNS + roll) * TAU, 9);
      const a = winArc(chance);
      const inside = end % TAU >= a.from && end % TAU < a.to;
      expect(inside, `${roll} ${chance}`).toBe(landsInArc(roll, chance));
      expect(landsInArc(roll, chance)).toBe(roll < chance);
    }
  });

  it("the needle is a pure function of the spin; a reload crosses no ticks (Review Focus 3)", () => {
    const at = (e: number) => needleAngle({ roll: 0.3, elapsed: e });
    expect(at(0)).toBe(0);
    expect(at(1.2)).toBe(at(1.2));
    for (let e = 0.05; e <= UPGRADER_SPIN_SECONDS; e += 0.05) expect(at(e)).toBeGreaterThanOrEqual(at(e - 0.05)); // never backwards
    expect(ticksCrossed(null, at(1.2))).toBe(0);
    expect(ticksCrossed(0, TAU)).toBe(DIAL_SECTORS);
    expect(ticksCrossed(at(1), at(1))).toBe(0);
  });

  it("stands over the locker", () => {
    const c = dialCentre({ x: 100, y: 80, w: 24, h: 30 });
    expect(c.x).toBe(112);
    expect(c.y).toBeLessThan(80);
  });

  it("shows while it spins, fades after it lands, and is hidden otherwise (no pulsing)", () => {
    expect(dialAlpha(true, Infinity)).toBe(1);
    expect(dialAlpha(false, 0)).toBe(1);
    expect(dialAlpha(false, 0.3)).toBeCloseTo(0.5, 5);
    expect(dialAlpha(false, 0.6)).toBe(0);
    expect(dialAlpha(false, Infinity)).toBe(0);
    // a win clears the way for the won card fast
    expect(dialAlpha(false, DIAL_WIN_FADE_SECONDS / 2, true)).toBeCloseTo(0.5, 5);
    expect(dialAlpha(false, DIAL_WIN_FADE_SECONDS, true)).toBe(0);
    expect(dialAlpha(true, Infinity, true)).toBe(1);
  });

  it("ticks at most DIAL_TICKS_PER_SECOND a second, however fast the needle runs", () => {
    let since = Infinity;
    let ticks = 0;
    let prev = 0;
    for (let i = 1; i <= 144 * UPGRADER_SPIN_SECONDS; i++) {
      since += 1 / 144;
      const a = needleAngle({ roll: 0.9, elapsed: i / 144 });
      if (tickDue(ticksCrossed(prev, a), since)) {
        ticks++;
        since = 0;
      }
      prev = a;
    }
    expect(ticks).toBeGreaterThan(0);
    expect(ticks).toBeLessThanOrEqual(Math.ceil(DIAL_TICKS_PER_SECOND * UPGRADER_SPIN_SECONDS));
    expect(tickDue(0, Infinity)).toBe(false);
  });

  it("writes the target and the chance, with a decimal comma in Russian", () => {
    expect(dialTexts(10, 0.09, "en")).toEqual({ mult: "x10", chance: "9%" });
    expect(dialTexts(1.5, 0.6, "en")).toEqual({ mult: "x1.5", chance: "60%" });
    expect(dialTexts(100, 0.009, "ru")).toEqual({ mult: "x100", chance: "0,9%" });
    expect(dialTexts(1.5, 0.6, "ru").mult).toBe("x1,5");
  });
});
