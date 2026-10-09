import { describe, expect, it } from "vitest";
import type { Rect } from "../pixel/layout";
import { hdFontSize } from "../pixel/screen";
import { pixelViewport } from "../pixel/viewport";
import { BEAM_ANGLES_LANDSCAPE, BEAM_ANGLES_PORTRAIT, BEAM_PALETTE, beamLayout, itemDistance, type Beam } from "./beams";
import { beamWidthAt } from "./beamStream";
import { vaultLayout } from "./vaultLayout";

const SCREENS = [
  { w: 1920, h: 1080 },
  { w: 1324, h: 824 },
  { w: 1324, h: 768 },
  { w: 390, h: 844 },
];
const MARGIN = 4;

function setup(screen: { w: number; h: number }) {
  const vp = pixelViewport(screen.w, screen.h);
  const v = vaultLayout(screen, vp.scale);
  const mouth = { x: v.chest.x, y: v.chest.top + 6 * v.chest.S };
  const icon = 2 * 16 * vp.scale;
  const labelH = 2 * hdFontSize(vp.scale);
  return { beams: beamLayout(screen, mouth, icon, labelH), mouth, icon, labelH };
}

/** Both corners of a beam's far end (origin + dir × length ± perp × half its width there) lie off screen. */
function endCornersOff(b: Beam, s: { w: number; h: number }): boolean {
  // the whole far end (the segment between its corners) lies beyond one screen edge
  const hw = beamWidthAt(b, b.length) / 2;
  const ex = b.origin.x + Math.sin(b.angle) * b.length;
  const ey = b.origin.y - Math.cos(b.angle) * b.length;
  const corners = [-1, 1].map((side) => ({ x: ex + side * Math.cos(b.angle) * hw, y: ey + side * Math.sin(b.angle) * hw }));
  return (
    corners.every((c) => c.y < 0) || corners.every((c) => c.x < 0) || corners.every((c) => c.x > s.w) || corners.every((c) => c.y > s.h)
  );
}

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const iconBox = (b: { spot: { x: number; y: number } }, icon: number): Rect => ({
  x: b.spot.x - icon / 2,
  y: b.spot.y - icon / 2,
  w: icon,
  h: icon,
});
const inside = (r: Rect, s: { w: number; h: number }) =>
  r.x >= MARGIN && r.y >= MARGIN && r.x + r.w <= s.w - MARGIN && r.y + r.h <= s.h - MARGIN;

describe("the vault's beams", () => {
  it("has a palette and angles for five beams", () => {
    expect(BEAM_PALETTE).toHaveLength(5);
    expect(BEAM_ANGLES_LANDSCAPE).toHaveLength(5);
    expect(BEAM_ANGLES_PORTRAIT).toHaveLength(5);
  });

  describe.each(SCREENS)("at $w×$h", (screen) => {
    const { beams, mouth, icon } = setup(screen);

    it("fans five beams symmetrically about the mouth", () => {
      expect(beams).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(beams[i].origin).toEqual(mouth);
        expect(beams[i].angle + beams[4 - i].angle).toBeCloseTo(0, 9);
      }
      expect(beams[2].angle).toBeCloseTo(0, 9);
      expect(beams[0].angle).toBeLessThan(beams[4].angle);
    });

    it("runs each beam past the screen edge, both corners of its far end off screen", () => {
      for (const b of beams) {
        const x = b.origin.x + Math.sin(b.angle) * b.length;
        const y = b.origin.y - Math.cos(b.angle) * b.length;
        expect(x < 0 || x > screen.w || y < 0 || y > screen.h).toBe(true);
        expect(endCornersOff(b, screen)).toBe(true);
      }
    });

    it("keeps every spot and label on screen, above the mouth", () => {
      for (const b of beams) {
        expect(inside(iconBox(b, icon), screen)).toBe(true);
        expect(inside(b.label, screen)).toBe(true);
        expect(b.spot.y).toBeLessThan(mouth.y);
        expect(b.spotDist).toBeCloseTo(Math.hypot(b.spot.x - mouth.x, b.spot.y - mouth.y), 6);
      }
    });

    it("keeps icons and labels from overlapping", () => {
      const boxes = beams.map((b) => ({ icon: iconBox(b, icon), label: b.label }));
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 5; j++) {
          if (i < j) {
            expect(hit(boxes[i].icon, boxes[j].icon)).toBe(false);
            expect(hit(boxes[i].label, boxes[j].label)).toBe(false);
          }
          if (i !== j) expect(hit(boxes[i].label, boxes[j].icon)).toBe(false);
        }
    });
  });
});

describe("itemDistance", () => {
  it("puts the target on the spot when the strip is at the target", () => {
    expect(itemDistance(30, 30, 30, 90, 400)).toBe(400);
  });
  it("puts larger j nearer the chest and smaller j further out", () => {
    expect(itemDistance(30, 31, 30, 90, 400)).toBeLessThan(400);
    expect(itemDistance(30, 29, 30, 90, 400)).toBeGreaterThan(400);
    expect(itemDistance(30, 31, 30, 90, 400)).toBe(310);
  });
  it("moves items outward as the strip advances, and hides items still in the chest", () => {
    expect(itemDistance(10, 5, 30, 90, 400)).toBeGreaterThan(itemDistance(9, 5, 30, 90, 400));
    expect(itemDistance(0, 5, 30, 90, 400)).toBeLessThan(0);
  });
});
