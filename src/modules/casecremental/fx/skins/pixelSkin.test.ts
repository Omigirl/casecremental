import { describe, expect, it } from "vitest";
import type { Texture } from "pixi.js";
import { CASES } from "../../sim/content/cases";
import { renderPattern } from "./patterns";
import { loadWeaponBases, fallbackBase, SkinTextures, tintWeapon, type PixelImage } from "./pixelSkin";
import { shrinkImage } from "./thumb";

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

describe("loadWeaponBases", () => {
  it("skips a weapon image that fails to load (its silhouette is used instead)", async () => {
    const index = new Map([["weapon-rifle", { url: "/rifle.png" }]]);
    const bases = await loadWeaponBases(index, async () => {
      throw new Error("404");
    });
    expect(bases.has("rifle")).toBe(false);
  });
});

describe("SkinTextures", () => {
  it("knows a skin's size, and bakes a shrunk still frame once per size (the full one when it fits)", () => {
    const made: PixelImage[] = [];
    let destroyed = 0;
    const fake = (img: PixelImage) => {
      made.push(img);
      return { destroy: () => destroyed++ } as unknown as Texture;
    };
    const st = new SkinTextures(new Map(), fake);
    const still = { ...CASES[0]!.skins.find((s) => s.weapon === "rifle")!, motion: undefined };
    expect(st.size(still)).toEqual({ w: 26, h: 10 });
    expect(st.thumb(still, 26, 10)).toBe(st.texture(still));
    expect(st.thumb(still, 40, 20)).toBe(st.texture(still));
    const small = st.thumb(still, 13, 5);
    expect(made).toHaveLength(2);
    expect(made[1]!).toEqual(shrinkImage(made[0]!, 13, 5));
    expect(st.thumb(still, 13, 5)).toBe(small); // cached
    expect(made).toHaveLength(2);
    st.destroy();
    expect(destroyed).toBe(2);
  });

  it("bakes a still skin exactly as before, and a moving skin's loop once", () => {
    const made: PixelImage[] = [];
    const fake = (img: PixelImage) => {
      made.push(img);
      return { destroy() {} } as unknown as Texture;
    };
    const st = new SkinTextures(new Map(), fake);
    const still = { ...CASES[0]!.skins.find((s) => s.weapon === "rifle")!, motion: undefined };
    expect(st.frames(still)).toHaveLength(1);
    expect(made[0]!.data).toEqual(tintWeapon(fallbackBase(still.weapon), renderPattern(still.pattern, 26, 10)));
    const moving = { ...still, id: "moving", motion: { pattern: "shimmer" as const } };
    const loop = st.frames(moving);
    expect(loop).toHaveLength(8);
    expect(st.frames(moving)).toBe(loop); // cached: baked once
    expect(made).toHaveLength(9);
    expect(st.texture(moving)).toBe(loop[0]);
    expect(st.fps(moving)).toBe(8);
  });
});
