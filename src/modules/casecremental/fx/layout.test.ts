import { describe, expect, it } from "vitest";
import { computeLayout, GUTTER, HUD_HEIGHT, KEY_RADIUS } from "./layout";

const SIZES = [
  [360, 640],
  [640, 360],
  [800, 600],
  [1920, 1080],
] as const;

describe.each(SIZES)("computeLayout(%i × %i)", (w, h) => {
  const l = computeLayout(w, h);

  it("keeps the reel inside the gutters, below the HUD", () => {
    expect(l.reel.x).toBeGreaterThanOrEqual(GUTTER);
    expect(l.reel.x + l.reel.w).toBeLessThanOrEqual(w - GUTTER);
    expect(l.reel.y).toBeGreaterThanOrEqual(HUD_HEIGHT);
  });

  it("keeps the case and the reveal card between the reel and the shop panel", () => {
    for (const size of [l.caseSize, l.revealSize]) {
      expect(l.bench.y - size.h / 2).toBeGreaterThanOrEqual(l.reel.y + l.reel.h);
      expect(l.bench.y + size.h / 2).toBeLessThanOrEqual(l.playBottom);
    }
  });

  it("puts the key left and the sell bin right, on screen and clear of the card", () => {
    const half = Math.max(l.caseSize.w, l.revealSize.w) / 2;
    expect(l.keyHome.x - KEY_RADIUS).toBeGreaterThanOrEqual(GUTTER);
    expect(l.keyHome.x + KEY_RADIUS).toBeLessThan(l.bench.x - half);
    expect(l.sellBin.x - l.sellBin.r).toBeGreaterThan(l.bench.x + half);
    expect(l.sellBin.x + l.sellBin.r).toBeLessThanOrEqual(w - GUTTER);
  });
});
