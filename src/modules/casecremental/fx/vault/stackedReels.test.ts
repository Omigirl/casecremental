import { describe, expect, it } from "vitest";
import { stackRects } from "./stackedReels";

describe("stacked reels", () => {
  it("stacks n whole-pixel reels in the area, centred, never overlapping", () => {
    const area = { x: 10, y: 20, w: 150, h: 140 };
    for (const n of [1, 2, 5]) {
      const rs = stackRects(area, n);
      expect(rs).toHaveLength(n);
      for (const r of rs) {
        expect(Number.isInteger(r.x) && Number.isInteger(r.y) && Number.isInteger(r.h)).toBe(true);
        expect(r.y).toBeGreaterThanOrEqual(area.y);
        expect(r.y + r.h).toBeLessThanOrEqual(area.y + area.h);
        expect(r.w).toBe(area.w);
      }
      for (let i = 1; i < n; i++) expect(rs[i]!.y).toBeGreaterThanOrEqual(rs[i - 1]!.y + rs[i - 1]!.h);
      const top = rs[0]!.y - area.y;
      const bottom = area.y + area.h - (rs[n - 1]!.y + rs[n - 1]!.h);
      expect(Math.abs(top - bottom)).toBeLessThanOrEqual(1);
    }
  });

  it("shrinks the reels to fit a short area", () => {
    const rs = stackRects({ x: 0, y: 0, w: 100, h: 60 }, 5);
    expect(rs[4]!.y + rs[4]!.h).toBeLessThanOrEqual(60);
    expect(rs[0]!.h).toBeGreaterThanOrEqual(8);
  });
});

describe("stackRects in a tiny area", () => {
  const fits = (area: { x: number; y: number; w: number; h: number }, n: number) => {
    const rs = stackRects(area, n);
    expect(rs).toHaveLength(n);
    expect(rs[0]!.y).toBeGreaterThanOrEqual(area.y);
    expect(rs[n - 1]!.y + rs[n - 1]!.h).toBeLessThanOrEqual(area.y + area.h);
    for (let i = 1; i < n; i++) expect(rs[i]!.y).toBeGreaterThanOrEqual(rs[i - 1]!.y + rs[i - 1]!.h);
    return rs;
  };

  it("shrinks the gap, then the 8-px floor, rather than overflow", () => {
    for (const h of [51, 45, 40, 30, 12]) fits({ x: 0, y: 0, w: 100, h }, 5);
    expect(fits({ x: 0, y: 0, w: 100, h: 44 }, 5)[0]!.h).toBe(8); // the floor holds while it fits without gaps
    expect(fits({ x: 0, y: 0, w: 100, h: 30 }, 5)[0]!.h).toBe(6);
  });

  it("rounds a fractional area to whole pixels inside it, its right edge where the area's rounds", () => {
    const area = { x: 10.5, y: 20.4, w: 100.6, h: 60.7 };
    for (const n of [1, 2, 5]) {
      for (const r of fits(area, n)) {
        expect(Number.isInteger(r.x) && Number.isInteger(r.y) && Number.isInteger(r.w) && Number.isInteger(r.h)).toBe(true);
        expect(r.x).toBe(Math.round(area.x));
        expect(r.x + r.w).toBe(Math.round(area.x + area.w));
      }
    }
  });
});
