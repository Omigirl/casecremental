import { Texture } from "pixi.js";
import type { SkinDef } from "../../sim/types";
import { renderPattern } from "./patterns";
import { SILHOUETTE_BOX, SILHOUETTES } from "./silhouettes";

// A skin = its pattern clipped to its weapon's silhouette, with a dark outline. Rendered once per
// skin on a 2D canvas and cached as a Pixi texture.

export const SKIN_TEX_W = 200;
export const SKIN_TEX_H = 80;
const PAD = 4;
const cache = new Map<string, Texture>();

function weaponPath(skin: SkinDef): Path2D {
  const sx = (SKIN_TEX_W - PAD * 2) / SILHOUETTE_BOX.w;
  const sy = (SKIN_TEX_H - PAD * 2) / SILHOUETTE_BOX.h;
  const path = new Path2D();
  SILHOUETTES[skin.weapon].forEach(([x, y], i) => {
    if (i === 0) path.moveTo(PAD + x * sx, PAD + y * sy);
    else path.lineTo(PAD + x * sx, PAD + y * sy);
  });
  path.closePath();
  return path;
}

export function skinCanvas(skin: SkinDef): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SKIN_TEX_W;
  canvas.height = SKIN_TEX_H;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  g.putImageData(new ImageData(renderPattern(skin.pattern, SKIN_TEX_W, SKIN_TEX_H), SKIN_TEX_W, SKIN_TEX_H), 0, 0);
  const path = weaponPath(skin);
  g.globalCompositeOperation = "destination-in";
  g.fill(path);
  g.globalCompositeOperation = "source-over";
  g.lineWidth = 2;
  g.strokeStyle = "rgba(0,0,0,0.85)";
  g.stroke(path);
  return canvas;
}

export function skinTexture(skin: SkinDef): Texture {
  let t = cache.get(skin.id);
  if (!t) {
    t = Texture.from(skinCanvas(skin));
    cache.set(skin.id, t);
  }
  return t;
}

export function clearSkinTextures(): void {
  for (const t of cache.values()) t.destroy(true);
  cache.clear();
}
