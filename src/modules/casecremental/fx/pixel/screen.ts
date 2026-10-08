import type { Pt } from "./layout";
import type { PixelViewport } from "./viewport";

// Screen (CSS px) ↔ world px, and sizes for full-resolution text. The pixel world's view sits at
// the top-left of the canvas.

/** Canvas backing resolution: a whole device-pixel ratio (so each world pixel stays square), at most 2. */
export const canvasResolution = (dpr: number): number => Math.min(2, Math.max(1, Math.floor(dpr || 1)));

export const toWorld = (vp: Pick<PixelViewport, "scale">, sx: number, sy: number): Pt => ({
  x: Math.floor(sx / vp.scale),
  y: Math.floor(sy / vp.scale),
});

export const toScreen = (vp: Pick<PixelViewport, "scale">, wx: number, wy: number): Pt => ({ x: wx * vp.scale, y: wy * vp.scale });

/** Press Start 2P in multiples of 8 px, growing with the pixel scale. */
export const hdFontSize = (scale: number, base = 8): number => base * Math.max(1, Math.floor(scale / 2));
