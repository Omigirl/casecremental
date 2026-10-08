import { FillGradient, type TextStyleOptions } from "pixi.js";
import "@fontsource/press-start-2p/latin-400.css";
import "@fontsource/press-start-2p/cyrillic-400.css";

// Press Start 2P, bundled with the game (the embedded game may only reach platform hosts). Pixi
// draws text on a canvas, so the font must be loaded before the first Text is created.

export const PIXEL_FONT = '"Press Start 2P", monospace';

export async function loadPixelFont(): Promise<void> {
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (!fonts) return;
  try {
    await Promise.all([fonts.load('8px "Press Start 2P"', "A$1"), fonts.load('8px "Press Start 2P"', "Ж")]);
  } catch {
    // the monospace fallback still renders every string
  }
}

/** Money and big pops: gold gradient fill, 2 px dark drop shadow (spec §7). */
export function moneyStyle(size: number): Partial<TextStyleOptions> {
  return {
    fontFamily: PIXEL_FONT,
    fontSize: size,
    fill: new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      textureSpace: "local",
      colorStops: [
        { offset: 0, color: 0xfff3b0 },
        { offset: 0.55, color: 0xffd34d },
        { offset: 1, color: 0xc98a12 },
      ],
    }),
    dropShadow: { color: 0x120e10, alpha: 1, angle: Math.PI / 2, distance: Math.max(2, size / 8), blur: 0 },
  };
}

/** Plain pixel text with the same hard shadow. */
export function pixelStyle(size: number, color: number): Partial<TextStyleOptions> {
  return {
    fontFamily: PIXEL_FONT,
    fontSize: size,
    fill: color,
    dropShadow: { color: 0x120e10, alpha: 1, angle: Math.PI / 2, distance: Math.max(2, size / 8), blur: 0 },
  };
}
