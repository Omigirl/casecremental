import { Texture } from "pixi.js";
import type { SkinDef, WeaponId } from "../../sim/types";
import { renderPattern } from "./patterns";
import { SILHOUETTE_BOX, SILHOUETTES } from "./silhouettes";

// A skin in the pixel world (spec §5): the weapon's greyscale base sprite shades the skin's
// procedural pattern; outline pixels stay as drawn. Falls back to the old polygon silhouettes
// when the weapon art isn't built yet.

export interface PixelImage {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

export function tintWeapon(base: PixelImage, pattern: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(base.data.length);
  for (let i = 0; i < base.data.length; i += 4) {
    if (base.data[i + 3]! < 128) continue;
    const lum = (base.data[i]! + base.data[i + 1]! + base.data[i + 2]!) / 3;
    if (lum < 40) {
      out.set(base.data.subarray(i, i + 4), i);
      continue;
    }
    const k = 0.35 + 0.9 * (lum / 255);
    out[i] = pattern[i]! * k;
    out[i + 1] = pattern[i + 1]! * k;
    out[i + 2] = pattern[i + 2]! * k;
    out[i + 3] = 255;
  }
  return out;
}

export function fallbackBase(weapon: WeaponId, w = 26, h = 10): PixelImage {
  const data = new Uint8ClampedArray(w * h * 4);
  const pts = SILHOUETTES[weapon];
  const inside = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]!,
        [xj, yj] = pts[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const sx = SILHOUETTE_BOX.w / w,
    sy = SILHOUETTE_BOX.h / h;
  const fill = (x: number, y: number) => inside((x + 0.5) * sx, (y + 0.5) * sy);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (fill(x, y)) {
        const v = 200 - y * 10;
        data.set([v, v, v, 255], i);
      } else if (fill(x - 1, y) || fill(x + 1, y) || fill(x, y - 1) || fill(x, y + 1)) data.set([18, 14, 16, 255], i);
    }
  return { w, h, data };
}

async function loadPixelImage(url: string): Promise<PixelImage> {
  const img = await new Promise<HTMLImageElement>((ok, bad) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = bad;
    i.src = url;
  });
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  return { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data };
}

/** The greyscale weapon bases; one that fails to load is left out, so its silhouette is used instead. */
export async function loadWeaponBases(
  index: Map<string, { url: string }>,
  load: (url: string) => Promise<PixelImage> = loadPixelImage,
): Promise<Map<WeaponId, PixelImage>> {
  const out = new Map<WeaponId, PixelImage>();
  for (const w of ["rifle", "sniper", "pistol", "heavyPistol", "smg", "shotgun", "mg", "knife"] as const) {
    const entry = index.get(`weapon-${w}`);
    if (!entry) continue;
    try {
      out.set(w, await load(entry.url));
    } catch (err) {
      console.warn(`[casecremental] weapon "${w}" failed to load — using its silhouette`, err);
    }
  }
  return out;
}

export class SkinTextures {
  private readonly cache = new Map<string, Texture>();
  constructor(private readonly bases: Map<WeaponId, PixelImage>) {}

  texture(skin: SkinDef): Texture {
    const hit = this.cache.get(skin.id);
    if (hit) return hit;
    const base = this.bases.get(skin.weapon) ?? fallbackBase(skin.weapon);
    const pixels = tintWeapon(base, renderPattern(skin.pattern, base.w, base.h));
    const c = document.createElement("canvas");
    c.width = base.w;
    c.height = base.h;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels), base.w, base.h), 0, 0);
    const tex = Texture.from(c);
    tex.source.scaleMode = "nearest";
    this.cache.set(skin.id, tex);
    return tex;
  }

  destroy(): void {
    for (const t of this.cache.values()) t.destroy(true);
    this.cache.clear();
  }
}
