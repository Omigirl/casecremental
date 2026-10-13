import { describe, expect, it } from "vitest";
import { tableLayout, type Rect } from "../fx/pixel/layout";
import { hdFontSize } from "../fx/pixel/screen";
import { pixelViewport } from "../fx/pixel/viewport";
import { arrowLook, BUBBLE_CHARS, placeBubble, samePlace } from "./tutorialPlace";
import { worldTargetRect, worldToOverlay } from "./tutorialTargets";

const VIEWS: Array<[number, number]> = [
  [1920, 1080],
  [1280, 720],
  [1024, 768],
  [390, 844],
  [360, 640],
  [820, 1180],
];
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const STILL = { focusX: 0, focusY: 0, dx: 0, dy: 0, zoom: 1 };

/** The overlay's own numbers for a screen (Tutorial.tsx): the bubble at its widest and three lines tall. */
function setup(W: number, H: number) {
  const vp = pixelViewport(W, H);
  const k = vp.scale;
  const fs = hdFontSize(k);
  const arrow = (fs * 7) / 8;
  return {
    vp,
    bubble: { w: Math.min(BUBBLE_CHARS * fs + 18 * k, W - 4 * k), h: 5 * fs + 18 * k },
    o: { gap: arrow + 2 * k, arrow, margin: 2 * k, portrait: vp.portrait },
  };
}

describe("placeBubble", () => {
  it("never covers its target or lets its arrow touch either, on any screen, wherever the target is (spec §4, Review Focus 4)", () => {
    for (const [W, H] of VIEWS) {
      const { vp, bubble, o } = setup(W, H);
      const l = tableLayout(vp);
      const world = (["world:bench", "world:card", "world:bin"] as const).map((id) =>
        worldToOverlay(worldTargetRect(id, l, [])!, vp.scale, STILL),
      );
      const targets: Rect[] = [
        ...world,
        { x: 0, y: 0, w: 40, h: 20 },
        { x: W - 40, y: H - 20, w: 40, h: 20 },
        { x: W / 2 - 20, y: H / 2 - 10, w: 40, h: 20 },
        { x: 0, y: H - 30, w: W, h: 30 }, // a full-width drawer tab row
        { x: W / 2 - 10, y: 0, w: 20, h: H }, // taller than the screen: no side fits
      ];
      for (const t of targets) {
        const p = placeBubble(t, bubble, { w: W, h: H }, o);
        const box = { x: p.x, y: p.y, ...bubble };
        const a = { x: p.arrowX, y: p.arrowY, w: o.arrow, h: o.arrow };
        const at = `${W}x${H} ${JSON.stringify(t)}`;
        expect(overlaps(box, t), at).toBe(false);
        expect(overlaps(a, t), at).toBe(false);
        expect(overlaps(a, box), at).toBe(false);
        if (vp.portrait) expect(["above", "below"], at).toContain(p.side);
      }
    }
  });

  it("prefers above, then below, and stays inside the overlay when it fits", () => {
    const { bubble, o } = setup(1920, 1080);
    const area = { w: 1920, h: 1080 };
    const mid = placeBubble({ x: 900, y: 500, w: 120, h: 60 }, bubble, area, o);
    expect(mid.side).toBe("above");
    expect(mid.y + bubble.h).toBe(500 - o.gap);
    const top = placeBubble({ x: 900, y: 10, w: 120, h: 60 }, bubble, area, o);
    expect(top.side).toBe("below");
    for (const p of [mid, top]) {
      expect(p.x).toBeGreaterThanOrEqual(o.margin);
      expect(p.x + bubble.w).toBeLessThanOrEqual(area.w - o.margin);
    }
    // a target at the right edge: the bubble slides left to fit, the arrow still under the target
    const edge = placeBubble({ x: 1880, y: 500, w: 40, h: 40 }, bubble, area, o);
    expect(edge.x + bubble.w).toBeLessThanOrEqual(area.w - o.margin);
    expect(edge.arrowX + o.arrow / 2).toBeGreaterThan(edge.x + bubble.w - o.arrow * 1.5);
  });

  it("turns to the sides on landscape when above and below are full, never on portrait", () => {
    const { bubble, o } = setup(1920, 1080);
    const tall = { x: 900, y: 0, w: 120, h: 1080 };
    expect(["left", "right"]).toContain(placeBubble(tall, bubble, { w: 1920, h: 1080 }, o).side);
    const phone = setup(390, 844);
    expect(["above", "below"]).toContain(placeBubble({ x: 180, y: 0, w: 30, h: 844 }, phone.bubble, { w: 390, h: 844 }, phone.o).side);
  });
});

describe("the arrow", () => {
  it("turns its down-pointing glyph toward the target and bobs one world pixel toward it", () => {
    expect(arrowLook("above", 6)).toEqual({ rotate: "0deg", bobX: 0, bobY: 6 });
    expect(arrowLook("below", 6)).toEqual({ rotate: "180deg", bobX: 0, bobY: -6 });
    expect(arrowLook("left", 6)).toEqual({ rotate: "-90deg", bobX: 6, bobY: 0 });
    expect(arrowLook("right", 6)).toEqual({ rotate: "90deg", bobX: -6, bobY: 0 });
  });

  it("re-places only when something moved a whole pixel", () => {
    const p = { x: 10.2, y: 20, side: "above" as const, arrowX: 30, arrowY: 40 };
    expect(samePlace(p, { ...p, x: 10.4 })).toBe(true);
    expect(samePlace(p, { ...p, x: 11 })).toBe(false);
    expect(samePlace(p, { ...p, side: "below" })).toBe(false);
    expect(samePlace(null, null)).toBe(true);
    expect(samePlace(p, null)).toBe(false);
  });
});
