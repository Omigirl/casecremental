// Integer scale for the pixel world. Landscape: the world is 180 px tall (taller on screens that
// don't divide evenly) and as wide as the screen allows. Portrait: the pixel world takes the top
// 60 % of the screen and is ~192 px wide; the panels live in a drawer below it.

export const WORLD_H = 180;
export const PORTRAIT_W = 192;
export const PORTRAIT_AREA = 0.6;

export interface PixelViewport {
  scale: number;
  worldW: number;
  worldH: number;
  portrait: boolean;
  /** CSS pixels covered by the pixel world. */
  areaW: number;
  areaH: number;
}

export function pixelViewport(viewW: number, viewH: number): PixelViewport {
  const portrait = viewH > viewW;
  if (!portrait) {
    const scale = Math.max(1, Math.floor(viewH / WORLD_H));
    return { scale, worldW: Math.ceil(viewW / scale), worldH: Math.ceil(viewH / scale), portrait, areaW: viewW, areaH: viewH };
  }
  const areaH = Math.round(viewH * PORTRAIT_AREA);
  const scale = Math.max(1, Math.floor(viewW / PORTRAIT_W));
  return { scale, worldW: Math.ceil(viewW / scale), worldH: Math.ceil(areaH / scale), portrait, areaW: viewW, areaH };
}
