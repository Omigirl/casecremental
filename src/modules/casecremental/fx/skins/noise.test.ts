import { describe, expect, it } from "vitest";
import { fbm, hash2, valueNoise, voronoi, wrapRow } from "./noise";

describe("noise", () => {
  it("wrapRow folds a lattice row into the period and leaves it alone without one", () => {
    expect([-1, 0, 4, 5, 9].map((y) => wrapRow(y, 5))).toEqual([4, 0, 4, 0, 4]);
    expect(wrapRow(-7)).toBe(-7);
  });

  it("with a period, value noise, fbm and voronoi repeat along y (the seamless rise)", () => {
    for (let i = 0; i < 64; i++) {
      const x = i * 0.37;
      const y = (i % 16) * 0.25;
      expect(valueNoise(x, y + 5, 3, 5)).toBe(valueNoise(x, y, 3, 5));
      expect(fbm(x, y + 4, 3, 4, 4)).toBe(fbm(x, y, 3, 4, 4));
      const a = voronoi(x, y + 3, 3, 3);
      const b = voronoi(x, y, 3, 3);
      expect(a.cell).toBe(b.cell);
      expect(a.f1).toBeCloseTo(b.f1, 9);
      expect(a.f2).toBeCloseTo(b.f2, 9);
    }
  });

  it("without a period nothing changes (cases 1-3 keep their exact pixels)", () => {
    expect(fbm(1.3, 2.7, 9, 4, undefined)).toBe(fbm(1.3, 2.7, 9));
    expect(valueNoise(1.3, 2.7, 9, undefined)).toBe(valueNoise(1.3, 2.7, 9));
    expect(fbm(1.3, 2.7, 9)).not.toBe(fbm(1.3, 2.7 + 4, 9));
  });

  it("hash2 is deterministic and in [0, 1)", () => {
    expect(hash2(3, 4, 5)).toBe(hash2(3, 4, 5));
    expect(hash2(3, 4, 5)).not.toBe(hash2(4, 3, 5));
    for (let i = 0; i < 1000; i++) {
      const h = hash2(i, -i, 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it("valueNoise and fbm stay in [0, 1] and are smooth", () => {
    for (let i = 0; i < 500; i++) {
      const x = i * 0.137;
      const y = i * 0.071;
      for (const n of [valueNoise(x, y, 1), fbm(x, y, 1)]) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(valueNoise(x, y, 1) - valueNoise(x + 0.001, y, 1))).toBeLessThan(0.01);
    }
  });

  it("voronoi gives f1 <= f2", () => {
    for (let i = 0; i < 200; i++) {
      const v = voronoi(i * 0.31, i * 0.17, 3);
      expect(v.f1).toBeGreaterThanOrEqual(0);
      expect(v.f1).toBeLessThanOrEqual(v.f2);
    }
  });
});
