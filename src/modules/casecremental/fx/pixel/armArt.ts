import { Texture } from "pixi.js";
import type { PixelImage } from "../skins/pixelSkin";

// Auto-spin's arm, drawn in code like the reel frame (fx/pixel/drawn.ts): a gunmetal motor housing with brass rivets and
// a lamp window, and a lever with a red knob. Frames: 0 at rest, 1 the lever pulled (it bought a case), 2 a brass arm out
// to the lock (it turned the key). The station draws the lamp over ARM_LAMP, so its colour follows the sim.

export const ARM_ART = { w: 10, h: 18 } as const;
/** The lamp's window on the housing (art px). */
export const ARM_LAMP = { x: 6, y: 12, w: 2, h: 2 } as const;

type Rgb = readonly [number, number, number];
const OUTLINE: Rgb = [0x12, 0x0e, 0x10];
const METAL: Rgb = [0x3a, 0x42, 0x50];
const METAL_LIGHT: Rgb = [0x56, 0x60, 0x70];
const ROD: Rgb = [0x8a, 0x93, 0xa3];
const BRASS: Rgb = [0xc9, 0xa2, 0x4a];
const KNOB: Rgb = [0xd8, 0x43, 0x3a];
const WINDOW: Rgb = [0x07, 0x08, 0x0c];

export function armPixels(frame: 0 | 1 | 2): PixelImage {
  const { w, h } = ARM_ART;
  const data = new Uint8ClampedArray(w * h * 4);
  const rect = (x0: number, y0: number, x1: number, y1: number, c: Rgb) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) data.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
  };
  // the housing (rows 10-17): outline, body, a lit top row, two rivets, the lamp's window
  rect(0, 10, 9, 17, OUTLINE);
  rect(1, 11, 8, 16, METAL);
  rect(1, 11, 8, 11, METAL_LIGHT);
  rect(2, 15, 2, 15, BRASS);
  rect(7, 15, 7, 15, BRASS);
  rect(ARM_LAMP.x - 1, ARM_LAMP.y - 1, ARM_LAMP.x + ARM_LAMP.w, ARM_LAMP.y + ARM_LAMP.h, OUTLINE);
  rect(ARM_LAMP.x, ARM_LAMP.y, ARM_LAMP.x + ARM_LAMP.w - 1, ARM_LAMP.y + ARM_LAMP.h - 1, WINDOW);
  if (frame === 1) {
    rect(4, 7, 5, 9, ROD); // pulled: a short rod, the knob down to the left
    rect(1, 5, 4, 7, KNOB);
  } else {
    rect(4, 3, 5, 9, ROD);
    rect(3, 0, 6, 2, KNOB);
  }
  if (frame === 2) {
    rect(0, 6, 3, 6, BRASS); // the arm out to the lock, with its gripper
    rect(0, 5, 0, 7, BRASS);
  }
  return { w, h, data };
}

/** The three frames as nearest-sampled textures (needs a document). */
export function armFrames(): Texture[] {
  return ([0, 1, 2] as const).map((f) => {
    const img = armPixels(f);
    const c = document.createElement("canvas");
    c.width = img.w;
    c.height = img.h;
    const g = c.getContext("2d")!;
    const id = g.createImageData(img.w, img.h);
    id.data.set(img.data);
    g.putImageData(id, 0, 0);
    const tex = Texture.from(c);
    tex.source.scaleMode = "nearest";
    return tex;
  });
}
