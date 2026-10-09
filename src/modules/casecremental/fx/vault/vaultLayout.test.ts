import { describe, expect, it } from "vitest";
import type { Rect } from "../pixel/layout";
import { pixelViewport } from "../pixel/viewport";
import { OPEN_H, VAULT_FRAME, vaultLayout } from "./vaultLayout";

const SCREENS = [
  { w: 1920, h: 1080 },
  { w: 1324, h: 824 },
  { w: 1324, h: 768 },
  { w: 390, h: 844 },
];

function layoutFor(screen: { w: number; h: number }) {
  const vp = pixelViewport(screen.w, screen.h);
  return { vp, v: vaultLayout(screen, vp.scale) };
}

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("the vault's layout (chest at lower centre, the beams out of it, the total above the lid)", () => {
  it.each(SCREENS)("puts everything on screen at $w×$h", (screen) => {
    const { v } = layoutFor(screen);
    const c = v.chest;
    expect(c.x).toBe(screen.w / 2);
    expect(c.top).toBeGreaterThanOrEqual(0);
    expect(c.bottom).toBeLessThanOrEqual(screen.h);
    expect((VAULT_FRAME.w * c.S) / 2).toBeLessThanOrEqual(screen.w / 2);
    expect(v.beams).toHaveLength(5);
    expect(v.totalAt.x).toBe(screen.w / 2);
    expect(v.totalAt.y).toBeGreaterThan(0);
    expect(v.totalAt.y).toBeLessThan(screen.h);
    // the key phase's vault and key are on screen too
    expect(v.key.bottom.y).toBeLessThanOrEqual(screen.h);
    expect(v.key.bottom.y - OPEN_H * v.key.S).toBeGreaterThanOrEqual(0);
    expect(v.key.home.x).toBeGreaterThan(0);
  });

  it.each(SCREENS)("fans the beams out of the open chest, its rewards above the lid, at $w×$h", (screen) => {
    const { v } = layoutFor(screen);
    for (const b of v.beams) {
      expect(b.origin.x).toBe(v.chest.x);
      expect(b.origin.y).toBeGreaterThan(v.chest.top);
      expect(b.origin.y).toBeLessThan(v.chest.bottom);
      expect(b.spot.y + v.icon / 2).toBeLessThan(v.chest.top);
      expect(b.label.y + b.label.h).toBeLessThan(v.chest.top);
    }
  });

  it.each(SCREENS)("keeps the total between the lid and the rewards, clear of every icon and label, at $w×$h", (screen) => {
    const { v } = layoutFor(screen);
    // the widest total, "ИТОГО +$999.9Qa": 15 characters of a monospaced font, at its count-up pop (×1.25)
    const size = 1.25 * v.totalSize;
    const total: Rect = { x: v.totalAt.x - 7.5 * size, y: v.totalAt.y - size / 2, w: 15 * size, h: size };
    expect(total.y + total.h).toBeLessThan(v.chest.top);
    for (const b of v.beams) {
      const icon = { x: b.spot.x - v.icon / 2, y: b.spot.y - v.icon / 2, w: v.icon, h: v.icon };
      expect(hit(total, icon)).toBe(false);
      expect(hit(total, b.label)).toBe(false);
    }
  });

  it.each(SCREENS)("sizes the open chest to ~28 % of the height with a whole-number scale, at $w×$h", (screen) => {
    const { v } = layoutFor(screen);
    expect(Number.isInteger(v.chest.S)).toBe(true);
    const share = (OPEN_H * v.chest.S) / screen.h;
    expect(share).toBeGreaterThan(0.22);
    expect(share).toBeLessThan(0.34);
  });

  it("sits the chest's bottom at ~88 % of the height in landscape and ~80 % in portrait", () => {
    expect(layoutFor(SCREENS[0]!).v.chest.bottom / 1080).toBeCloseTo(0.88, 2);
    expect(layoutFor(SCREENS[2]!).v.chest.bottom / 768).toBeCloseTo(0.88, 2);
    expect(layoutFor(SCREENS[3]!).v.chest.bottom / 844).toBeCloseTo(0.8, 2);
  });
});
