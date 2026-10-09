import type { Graphics, Text } from "pixi.js";
import type { Beam } from "./beams";
import { beamWidthAt } from "./beamStream";
import { fitLabel, LABEL_MIN_SHARE } from "./fitLabel";

// How a vault beam, a landed reward's frames and its label's lines are drawn (spec 2026-10-09 §5): flat pixel-art
// shapes in Pixi Graphics and fitted text, built once per layout or landing, never per frame. VaultBeams places,
// rotates and fades them.

const BEAM_ALPHA = 0.8;
/** The bright core down a beam's middle, as a share of its width. */
const CORE = 0.35;
const GOLD = 0xffd34d;

const lighten = (c: number, f: number) =>
  (Math.round(((c >> 16) & 255) + (255 - ((c >> 16) & 255)) * f) << 16) |
  (Math.round(((c >> 8) & 255) + (255 - ((c >> 8) & 255)) * f) << 8) |
  Math.round((c & 255) + (255 - (c & 255)) * f);

/** A `th`-px outline of the w×h box at (x, y). */
const outline = (g: Graphics, x: number, y: number, w: number, h: number, th: number, color: number) =>
  g
    .rect(x, y, w, th)
    .rect(x, y + h - th, w, th)
    .rect(x, y, th, h)
    .rect(x + w - th, y, th, h)
    .fill({ color });

/** A quad from the origin straight up to `len`, `w0` wide at the bottom and `w1` at the top. */
const quad = (g: Graphics, w0: number, w1: number, len: number, color: number, alpha = 1) =>
  g.poly([-w0 / 2, 0, w0 / 2, 0, w1 / 2, -len, -w1 / 2, -len]).fill({ color, alpha });

/** The beam pointing straight up from (0, 0): a translucent quad in its colour with an `edge`-px lighter line
 *  down each side (body), and a white core down its middle (core, whose alpha is its brightness). */
export function drawBeam(body: Graphics, core: Graphics, b: Beam, color: number, edge: number): void {
  const w0 = beamWidthAt(b, 0);
  const w1 = beamWidthAt(b, b.length);
  const len = b.length;
  const light = lighten(color, 0.45);
  quad(body.clear(), w0, w1, len, color, BEAM_ALPHA);
  body.poly([-w0 / 2, 0, -w0 / 2 + edge, 0, -w1 / 2 + edge, -len, -w1 / 2, -len]).fill({ color: light, alpha: 0.9 });
  body.poly([w0 / 2 - edge, 0, w0 / 2, 0, w1 / 2, -len, w1 / 2 - edge, -len]).fill({ color: light, alpha: 0.9 });
  quad(core.clear(), w0 * CORE, w1 * CORE, len, 0xffffff);
}

/** A landed reward's frames around its w×h sprite drawn at scale s (local px from the sprite's top-left): a
 *  1-sprite-px outline in its rarity's colour a pixel out (frame), and a gold one around that (flash). */
export function drawRewardFrames(frame: Graphics, flash: Graphics, w: number, h: number, s: number, rarity: number): void {
  outline(frame.clear(), -2 * s, -2 * s, w + 4 * s, h + 4 * s, s, rarity);
  outline(flash.clear(), -3 * s, -3 * s, w + 6 * s, h + 6 * s, s, GOLD);
}

/** One line of a reward's label (its name, or its +$): `s` on a single line `font` px tall, shrunk to fit
 *  `width` on the font's grid and cut short with "…" past the floor, so it never spills off its plaque. */
export function setLabelLine(t: Text, s: string, width: number, font: number): void {
  const fit = fitLabel([s], width, 1, font, font * LABEL_MIN_SHARE);
  t.style.fontSize = fit.size;
  t.text = fit.lines.join("\n");
}
