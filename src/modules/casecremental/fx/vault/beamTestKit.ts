import type { Beam } from "./beams";
import { beamWidthAt } from "./beamStream";

// Test-only geometry checks shared by the beam and vault-layout tests (no production code imports this file).

/** Both corners of a beam's far end (origin + dir × length ± perp × half its width there) lie beyond one screen
 *  edge: the whole far end, the segment between its corners, is off screen. */
export function endCornersOff(b: Beam, s: { w: number; h: number }): boolean {
  const hw = beamWidthAt(b, b.length) / 2;
  const ex = b.origin.x + Math.sin(b.angle) * b.length;
  const ey = b.origin.y - Math.cos(b.angle) * b.length;
  const corners = [-1, 1].map((side) => ({ x: ex + side * Math.cos(b.angle) * hw, y: ey + side * Math.sin(b.angle) * hw }));
  return (
    corners.every((c) => c.y < 0) || corners.every((c) => c.x < 0) || corners.every((c) => c.x > s.w) || corners.every((c) => c.y > s.h)
  );
}
