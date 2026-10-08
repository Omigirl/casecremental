import { describe, expect, it } from "vitest";
import { FLIGHT_SECONDS, flightPose } from "./knifeFlight";

const poses = Array.from({ length: 401 }, (_, i) => flightPose(i / 400));

describe("the ★ knife's showcase (a slow b-roll shot out of the card and back)", () => {
  it("starts and settles exactly in the card, upright, face-on, at its own size", () => {
    for (const t of [0, 1]) {
      const p = flightPose(t);
      expect(p.x).toBe(0);
      expect(p.y).toBe(0);
      expect(p.scale).toBeCloseTo(1, 9);
      expect(p.flip).toBeCloseTo(1, 9);
      expect(Math.abs(p.rotation)).toBeLessThan(1e-9);
    }
  });

  it("comes toward the viewer: grows well past the card, without jumping anywhere", () => {
    expect(Math.max(...poses.map((p) => p.scale))).toBeGreaterThanOrEqual(3);
    for (const p of poses) expect([p.x, p.y]).toEqual([0, 0]);
  });

  it("turns slowly like on a turntable — through edge-on to its back — with only a gentle tilt", () => {
    expect(poses.some((p) => Math.abs(p.flip) < 0.05)).toBe(true);
    expect(poses.some((p) => p.flip < -0.95)).toBe(true);
    expect(Math.max(...poses.map((p) => Math.abs(p.rotation)))).toBeLessThanOrEqual(0.3);
  });

  it("is slow: well over two seconds", () => {
    expect(FLIGHT_SECONDS).toBeGreaterThanOrEqual(2.2);
  });

  it("clamps outside 0–1", () => {
    expect(flightPose(-1)).toEqual(flightPose(0));
    expect(flightPose(2)).toEqual(flightPose(1));
  });
});
