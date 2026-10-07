import { describe, expect, it } from "vitest";
import { fbm, hash2, valueNoise, voronoi } from "./noise";

describe("noise", () => {
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
