import { describe, expect, it } from "vitest";
import type { WeaponId } from "../../sim/types";
import { SILHOUETTE_BOX, SILHOUETTES } from "./silhouettes";

const WEAPONS: WeaponId[] = ["rifle", "sniper", "pistol", "heavyPistol", "smg", "shotgun", "mg", "knife"];

const area = (pts: readonly (readonly [number, number])[]) =>
  Math.abs(pts.reduce((a, [x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length]!;
    return a + x * ny - nx * y;
  }, 0)) / 2;

describe.each(WEAPONS)("silhouette %s", (weapon) => {
  const pts = SILHOUETTES[weapon];

  it("is a real polygon inside the 100 × 40 box", () => {
    expect(pts.length).toBeGreaterThanOrEqual(6);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(SILHOUETTE_BOX.w);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(SILHOUETTE_BOX.h);
    }
    expect(area(pts)).toBeGreaterThan(150);
  });
});
