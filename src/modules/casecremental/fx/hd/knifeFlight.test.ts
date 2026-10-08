import { describe, expect, it } from "vitest";
import { flightPose } from "./knifeFlight";

const TAU = Math.PI * 2;
const upright = (r: number) => Math.abs(((r % TAU) + TAU) % TAU) < 1e-9 || Math.abs((((r % TAU) + TAU) % TAU) - TAU) < 1e-9;

describe("the ★ knife's flight out of the card and back", () => {
  it("starts and lands exactly on the card, upright, at its own size", () => {
    for (const t of [0, 1]) {
      const p = flightPose(t, 40);
      expect(p.x).toBe(0);
      expect(Math.abs(p.y)).toBeLessThan(1e-9);
      expect(p.scale).toBeCloseTo(1, 9);
      expect(p.flip).toBeCloseTo(1, 9);
      expect(upright(p.rotation)).toBe(true);
    }
  });

  it("rises well above the card and grows about twice as big on the way", () => {
    const top = Math.min(...Array.from({ length: 101 }, (_, i) => flightPose(i / 100, 40).y));
    expect(top).toBeLessThanOrEqual(-36);
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => flightPose(i / 100, 40).scale))).toBeCloseTo(2, 1);
  });

  it("flips through edge-on and spins while in the air", () => {
    const poses = Array.from({ length: 201 }, (_, i) => flightPose(i / 200, 40));
    expect(poses.some((p) => Math.abs(p.flip) < 0.05)).toBe(true); // edge-on: the 2.5D flip
    expect(poses.some((p) => p.flip < -0.9)).toBe(true); // the back side shows
    expect(poses[100]!.rotation).toBeGreaterThan(Math.PI); // well into its spin by mid-flight
  });

  it("clamps outside 0–1", () => {
    expect(flightPose(-1, 40)).toEqual(flightPose(0, 40));
    expect(flightPose(2, 40)).toEqual(flightPose(1, 40));
  });
});
