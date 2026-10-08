import type { CSSProperties } from "react";
import { spriteIndex, type SpriteMeta } from "../fx/pixel/sprites";

// Pixel-art 9-slice frames for the DOM panels (spec §2): the ui-frame sprite as a CSS border-image
// at the pixel world's integer scale, and the 3-state ui-button sheet sliced into per-state images.
// Without the art, a flat pixel bevel in the same palette stands in.

export const FRAME_SLICE = 6;
export const BUTTON_SLICE = 4;

export function frameCss(url: string | null, scale: number): CSSProperties {
  if (!url)
    return {
      background: "#1d1517",
      border: `${2 * scale}px solid #4a3328`,
      boxShadow: `0 0 0 ${scale}px #120e10, inset 0 0 0 ${scale}px #120e10`,
    };
  return {
    borderStyle: "solid",
    borderWidth: FRAME_SLICE * scale,
    borderImage: `url("${url}") ${FRAME_SLICE} fill / ${FRAME_SLICE * scale}px stretch`,
    imageRendering: "pixelated",
  };
}

export const uiSpriteUrl = (id: string): string | null => spriteIndex().get(id)?.url ?? null;

/** One frame of a sprite strip as CSS background (the case icons on the shelf). */
export function stripFrameCss(entry: { meta: SpriteMeta; url: string } | undefined, frame: number, scale: number): CSSProperties | null {
  if (!entry) return null;
  const { meta, url } = entry;
  return {
    width: meta.frameW * scale,
    height: meta.frameH * scale,
    backgroundImage: `url("${url}")`,
    backgroundSize: `${meta.frames * meta.frameW * scale}px ${meta.frameH * scale}px`,
    backgroundPosition: `${-frame * meta.frameW * scale}px 0`,
    imageRendering: "pixelated",
  };
}

/** Slice the ui-button sheet (normal / hover / pressed) into data URLs for border-image. */
export async function buttonImages(): Promise<string[] | null> {
  const entry = spriteIndex().get("ui-button");
  if (!entry || typeof document === "undefined") return null;
  const img = new Image();
  img.src = entry.url;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const { frameW, frameH, frames } = entry.meta;
  return Array.from({ length: frames }, (_, i) => {
    const c = document.createElement("canvas");
    c.width = frameW;
    c.height = frameH;
    c.getContext("2d")!.drawImage(img, i * frameW, 0, frameW, frameH, 0, 0, frameW, frameH);
    return c.toDataURL();
  });
}
