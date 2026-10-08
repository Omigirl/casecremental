import { describe, expect, it } from "vitest";
import { fallbackBase, tintWeapon } from "./pixelSkin";

describe("pixel skins", () => {
  it("keeps outline pixels dark, transparent pixels empty, and shades the pattern by the base", () => {
    const base = { w: 3, h: 1, data: new Uint8ClampedArray([18, 14, 16, 255, 60, 60, 60, 255, 220, 220, 220, 255]) };
    const pattern = new Uint8ClampedArray([200, 100, 0, 255, 200, 100, 0, 255, 200, 100, 0, 255]);
    const out = tintWeapon(base, pattern);
    expect(Array.from(out.slice(0, 4))).toEqual([18, 14, 16, 255]);
    expect(out[4]!).toBeLessThan(out[8]!);
    expect(out[7]).toBe(255);
    const empty = tintWeapon({ w: 1, h: 1, data: new Uint8ClampedArray(4) }, new Uint8ClampedArray([255, 0, 0, 255]));
    expect(empty[3]).toBe(0);
  });

  it("draws a fallback base for every weapon when no art is built", () => {
    for (const w of ["rifle", "sniper", "pistol", "heavyPistol", "smg", "shotgun", "mg", "knife"] as const) {
      const b = fallbackBase(w);
      let opaque = 0;
      for (let i = 3; i < b.data.length; i += 4) if (b.data[i]) opaque++;
      expect(opaque, w).toBeGreaterThan(30);
    }
  });
});
