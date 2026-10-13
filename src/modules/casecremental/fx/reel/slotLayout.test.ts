import { describe, expect, it } from "vitest";
import { benchReelArea, tableLayout } from "../pixel/layout";
import { pixelViewport } from "../pixel/viewport";
import { SMALL_CELL_W } from "./cellLook";
import { SLOT_COLUMNS, SLOT_MIN_W, slotRects } from "./slotLayout";

const VIEWPORTS: Array<[number, number]> = [
  [1920, 1080],
  [1280, 720],
  [1024, 768],
  [820, 1180],
  [390, 844],
  [360, 640],
];

describe("Slot Machine's ten reels", () => {
  it("are five columns of two windows, left to right then top to bottom", () => {
    const r = slotRects({ x: 10, y: 20, w: 150, h: 60 }, 10);
    expect(SLOT_COLUMNS).toBe(5);
    expect(r).toHaveLength(10);
    expect(r[0]!.y).toBe(r[4]!.y);
    expect(r[5]!.y).toBeGreaterThan(r[0]!.y);
    expect(r[1]!.x).toBeGreaterThan(r[0]!.x);
    expect(r[5]!.x).toBe(r[0]!.x);
  });

  it("closes the gaps to one pixel before a window gets narrower than SLOT_MIN_W", () => {
    const wide = slotRects({ x: 0, y: 0, w: 150, h: 60 }, 10);
    expect(wide[1]!.x - (wide[0]!.x + wide[0]!.w)).toBe(2);
    const tight = slotRects({ x: 0, y: 0, w: 84, h: 60 }, 10);
    expect(tight[1]!.x - (tight[0]!.x + tight[0]!.w)).toBe(1);
    expect(tight[0]!.w).toBeGreaterThanOrEqual(SLOT_MIN_W);
  });

  it.each(VIEWPORTS)("fit the tall reel window at %ix%i: inside it, apart, wide enough (Review Focus 2)", (w, h) => {
    const l = tableLayout(pixelViewport(w, h));
    const area = benchReelArea(l, 10, true);
    const rs = slotRects(area, 10);
    // portrait gives each column a clean small cell; landscape's reel window (~84 px) gives 16 px: the window then
    // shows the middle of a card scrolling past, like a slot drum
    const minW = l.portrait ? SMALL_CELL_W : SLOT_MIN_W;
    for (const r of rs) {
      expect(r.x).toBeGreaterThanOrEqual(area.x);
      expect(r.y).toBeGreaterThanOrEqual(area.y);
      expect(r.x + r.w).toBeLessThanOrEqual(area.x + area.w);
      expect(r.y + r.h).toBeLessThanOrEqual(area.y + area.h);
      expect(r.w).toBeGreaterThanOrEqual(minW);
      expect(r.h).toBeGreaterThanOrEqual(8);
    }
    for (let i = 0; i < rs.length; i++)
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i]!;
        const b = rs[j]!;
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart, `${i} and ${j}`).toBe(true);
      }
  });
});
