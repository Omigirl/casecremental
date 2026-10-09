import { describe, expect, it } from "vitest";
import { tableLayout } from "../pixel/layout";
import { pixelViewport } from "../pixel/viewport";
import { OPEN_H, VAULT_FRAME, vaultLayout } from "./vaultLayout";

const SCREENS = [
  { w: 1920, h: 1080 },
  { w: 1324, h: 768 },
  { w: 390, h: 844 },
];

function layoutFor(screen: { w: number; h: number }) {
  const vp = pixelViewport(screen.w, screen.h);
  const l = tableLayout(vp);
  return { vp, l, v: vaultLayout(screen, l, vp.scale) };
}

describe("the vault's layout (chest at lower centre, the columns above it, the total between)", () => {
  it.each(SCREENS)("puts everything on screen at $w×$h", (screen) => {
    const { l, v } = layoutFor(screen);
    const c = v.chest;
    expect(c.x).toBe(screen.w / 2);
    expect(c.top).toBeGreaterThanOrEqual(0);
    expect(c.bottom).toBeLessThanOrEqual(screen.h);
    expect((VAULT_FRAME.w * c.S) / 2).toBeLessThanOrEqual(screen.w / 2);
    const a = v.columnsArea;
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.x + a.w).toBeLessThanOrEqual(l.worldW);
    expect(a.y + a.h).toBeLessThanOrEqual(l.worldH);
    expect(a.h).toBeGreaterThanOrEqual(40); // room for three cells and their labels
    expect(v.totalAt.x).toBe(screen.w / 2);
    expect(v.totalAt.y).toBeGreaterThan(0);
    expect(v.totalAt.y).toBeLessThan(screen.h);
    // the key phase's vault and key are on screen too
    expect(v.key.bottom.y).toBeLessThanOrEqual(screen.h);
    expect(v.key.bottom.y - OPEN_H * v.key.S).toBeGreaterThanOrEqual(0);
    expect(v.key.home.x).toBeGreaterThan(0);
  });

  it.each(SCREENS)("keeps the columns above the open lid, the total between them, at $w×$h", (screen) => {
    const { vp, v } = layoutFor(screen);
    const columnsBottom = (v.columnsArea.y + v.columnsArea.h) * vp.scale;
    expect(columnsBottom).toBeLessThan(v.chest.top);
    expect(v.totalAt.y - v.totalSize / 2).toBeGreaterThan(columnsBottom);
    expect(v.totalAt.y + v.totalSize / 2).toBeLessThan(v.chest.top);
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
    expect(layoutFor(SCREENS[1]!).v.chest.bottom / 768).toBeCloseTo(0.88, 2);
    expect(layoutFor(SCREENS[2]!).v.chest.bottom / 844).toBeCloseTo(0.8, 2);
  });
});
