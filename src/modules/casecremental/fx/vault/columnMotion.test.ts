import { describe, expect, it } from "vitest";
import { columnMotion } from "./columnMotion";

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
