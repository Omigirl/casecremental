import { describe, expect, it } from "vitest";
import { columnMotion, columnRects } from "./columnMotion";

describe("a vault column's motion", () => {
  const start = 1.5;
  const land = 6;
  const target = 60;
  const at = (t: number) => columnMotion(t, start, land, target);

  it("lands exactly on its target cell at its landing time", () => {
    expect(at(land)).toBeCloseTo(target, 9);
  });

  it("overshoots a little just after landing", () => {
    expect(at(land + 0.08)).toBeGreaterThan(target);
    expect(at(land + 0.08)).toBeLessThan(target + 0.4);
  });

  it("has settled back on its target by 0.25 s after landing", () => {
    for (const dt of [0.25, 0.3, 1, 5]) expect(at(land + dt)).toBe(target);
  });

  it("only moves forward from its start to its landing", () => {
    let prev = at(start);
    for (let t = start + 0.01; t <= land + 1e-9; t += 0.01) {
      const p = at(t);
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
  });

  it("decelerates through at least `slowCells` cells in its last second", () => {
    for (const slowCells of [4, 6]) {
      const travelled = columnMotion(land, start, land, target, { slowCells }) - columnMotion(land - 1, start, land, target, { slowCells });
      expect(travelled).toBeGreaterThanOrEqual(slowCells);
    }
  });

  it("puts two columns with different starts out of phase", () => {
    const frac = (x: number) => x - Math.floor(x);
    const a = columnMotion(4, 1.5, land, target);
    const b = columnMotion(4, 1.6, land, target);
    expect(Math.abs(frac(a) - frac(b))).toBeGreaterThan(0.05);
  });
});

describe("the vault columns' rects", () => {
  it("lays n equal whole-pixel columns side by side inside the area, never overlapping", () => {
    const area = { x: 12, y: 6, w: 168, h: 80 };
    for (const [n, gap] of [
      [5, 3],
      [5, 2],
      [3, 4],
    ] as const) {
      const rs = columnRects(area, n, gap);
      expect(rs).toHaveLength(n);
      for (const r of rs) {
        expect([r.x, r.y, r.w, r.h].every(Number.isInteger)).toBe(true);
        expect(r.w).toBe(rs[0]!.w);
        expect(r.x).toBeGreaterThanOrEqual(area.x);
        expect(r.x + r.w).toBeLessThanOrEqual(area.x + area.w);
        expect(r.y).toBeGreaterThanOrEqual(area.y);
        expect(r.y + r.h).toBeLessThanOrEqual(area.y + area.h);
      }
      for (let i = 1; i < n; i++) expect(rs[i]!.x).toBeGreaterThanOrEqual(rs[i - 1]!.x + rs[i - 1]!.w + gap);
      const left = rs[0]!.x - area.x;
      const right = area.x + area.w - (rs[n - 1]!.x + rs[n - 1]!.w);
      expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    }
  });
});
