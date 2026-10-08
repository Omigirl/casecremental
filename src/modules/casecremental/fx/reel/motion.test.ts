import { describe, expect, it } from "vitest";
import { CRAWL_SHARE, crawlSeconds, reelFraction, type ReelMotion } from "./motion";

const spin = (elapsed: number): ReelMotion => ({ elapsed, fullDuration: 6, crawl: 0 });

describe("reelFraction", () => {
  it("runs 0 → 1 over the full spin", () => {
    expect(reelFraction(spin(0))).toBe(0);
    expect(reelFraction(spin(6))).toBe(1);
    expect(reelFraction(spin(9))).toBe(1);
  });

  it("never moves backwards", () => {
    let prev = -1;
    for (let t = 0; t <= 6; t += 0.01) {
      const f = reelFraction(spin(t));
      expect(f).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = f;
    }
  });
});

describe("reelFraction with a tease crawl", () => {
  const tease = (elapsed: number, crawl = 2.4, fullDuration = 5.4): ReelMotion => ({ elapsed, fullDuration, crawl });

  it("covers all but the last stretch fast, then crawls it, ending exactly at 1", () => {
    expect(reelFraction(tease(0))).toBe(0);
    expect(reelFraction(tease(3))).toBeCloseTo(1 - CRAWL_SHARE, 6);
    expect(reelFraction(tease(5.4))).toBeCloseTo(1, 9);
    expect(reelFraction(tease(7))).toBe(1);
  });

  it("is continuous and never moves backwards, for long and short crawls", () => {
    for (const [crawl, full] of [
      [2.4, 5.4],
      [0.5, 1.2],
      [4, 4.6],
    ] as const) {
      let prev = -1;
      for (let t = 0; t <= full + 0.01; t += 0.001) {
        const f = reelFraction(tease(t, crawl, full));
        expect(f).toBeGreaterThanOrEqual(prev - 1e-12);
        if (prev >= 0) expect(f - prev).toBeLessThan(0.01); // no jumps
        prev = f;
      }
    }
  });

  it("crawls for the tease's extra time plus the last quarter of the normal spin", () => {
    expect(crawlSeconds(null, 3)).toBe(0);
    expect(crawlSeconds({ strength: 1, fake: null, extraSeconds: 2.4 }, 5.4)).toBeCloseTo(2.4 + 0.75);
  });
});
