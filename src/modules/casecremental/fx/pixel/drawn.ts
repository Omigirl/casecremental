import { Texture } from "pixi.js";
import type { PixelImage } from "../skins/pixelSkin";
import { placeholderMeta, type SpriteSet } from "./sprites";

// Pixel art drawn in code instead of generated: the reel's 9-slice window frame (dark gunmetal,
// brass rivets at the corners, a black window). The user chose code over art for the UI chrome.

export const REEL_FRAME = { size: 18, border: 6 } as const;

const OUTLINE = [0x12, 0x0e, 0x10];
const METAL = [0x3a, 0x42, 0x50];
const METAL_LIGHT = [0x56, 0x60, 0x70];
const RIVET = [0xc9, 0xa2, 0x4a];
const WINDOW = [0x07, 0x08, 0x0c];

export function reelFramePixels(): PixelImage {
  const { size, border } = REEL_FRAME;
  const data = new Uint8ClampedArray(size * size * 4);
  const rivets = [2, size - 3];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const inner = x >= border - 1 && y >= border - 1 && x <= size - border && y <= size - border;
      const lip = inner && (x === border - 1 || y === border - 1 || x === size - border || y === size - border);
      const rivet = rivets.includes(x) && rivets.includes(y);
      const c = edge || lip ? OUTLINE : rivet ? RIVET : inner ? WINDOW : y === 1 || x === 1 ? METAL_LIGHT : METAL;
      data.set([c[0]!, c[1]!, c[2]!, 255], (y * size + x) * 4);
    }
  return { w: size, h: size, data };
}

/** The drawn reel frame as a sprite set for a NineSliceSprite (borders = REEL_FRAME.border). */
export function reelFrameSet(): SpriteSet {
  const img = reelFramePixels();
  const c = document.createElement("canvas");
  c.width = img.w;
  c.height = img.h;
  const g = c.getContext("2d")!;
  const id = g.createImageData(img.w, img.h);
  id.data.set(img.data);
  g.putImageData(id, 0, 0);
  const tex = Texture.from(c);
  tex.source.scaleMode = "nearest";
  return { meta: { ...placeholderMeta("reel-frame", img.w, img.h), ground: img.h - 1 }, frames: [tex], placeholder: false };
}
