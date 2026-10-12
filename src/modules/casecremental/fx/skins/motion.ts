import type { PatternSpec, SkinDef, SkinMotion } from "../../sim/types";
import { hash2 } from "./noise";
import { hexToRgb, OWN_MOTION, patternColor, type Rgb } from "./patterns";
import type { PixelImage } from "./pixelSkin";
import { SILHOUETTE_BOX, SILHOUETTES } from "./silhouettes";

// Animated skins (spec: 2026-10-08-casecremental-animated-skins-design.md). A skin's `motion` is baked
// into a short loop of whole-pixel frames. Every motion is a function of the loop phase t ∈ [0, 1), so
// the loop closes. Pattern motions recolour the finish; weapon motions move or turn the code-drawn
// silhouette before it is rasterised, so every frame stays crisp.

export const SKIN_W = 26;
export const SKIN_H = 10;
const DEFAULT_FRAMES = 8;
const DEFAULT_FPS = 8;
const SPARKLES = 10;
const TAU = Math.PI * 2;
const OUTLINE: Rgb = [18, 14, 16];
const BOLT: Rgb = [205, 205, 215];
const FLASH: Rgb = [255, 214, 120];

export const motionFrames = (skin: SkinDef): number => (skin.motion ? Math.max(1, skin.motion.frames ?? DEFAULT_FRAMES) : 1);
export const motionFps = (skin: SkinDef): number => skin.motion?.fps ?? DEFAULT_FPS;

/** Which loop frame to show after `elapsedMs` of playing. */
export function frameAt(elapsedMs: number, fps: number, frames: number): number {
  if (frames <= 1) return 0;
  return Math.floor((Math.max(0, elapsedMs) / 1000) * fps) % frames;
}

/** A moving weapon gets 2 px of room on every side; a flipping knife a square it can turn in. */
export function frameSize(motion: SkinMotion, w = SKIN_W, h = SKIN_H): { w: number; h: number } {
  if (motion.weapon === "flip") {
    const s = Math.ceil(Math.hypot(w, h)) + 2;
    return { w: s, h: s };
  }
  return motion.weapon ? { w: w + 4, h: h + 4 } : { w, h };
}

export interface Pose {
  dx: number;
  dy: number;
  angle: number;
  flash: boolean;
  bolt: number;
}

export function weaponPose(kind: SkinMotion["weapon"], t: number): Pose {
  const pose: Pose = { dx: 0, dy: 0, angle: 0, flash: false, bolt: 0 };
  switch (kind) {
    case "bob":
      pose.dy = Math.round(Math.sin(TAU * t));
      break;
    case "recoil":
      pose.dx = t < 0.125 ? -2 : t < 0.25 ? -1 : 0;
      pose.flash = t < 0.125;
      break;
    case "bolt":
      pose.bolt = Math.round(2 * Math.sin(Math.PI * t));
      break;
    case "flip":
      pose.angle = TAU * t;
      break;
  }
  return pose;
}

const mix = (c: Rgb, to: number, k: number): Rgb => [c[0] + (to - c[0]) * k, c[1] + (to - c[1]) * k, c[2] + (to - c[2]) * k];

/** The finish at (u, v) ∈ [0,1)² of the weapon at loop phase t. `sweep` (0–1) is where the pixel sits along
 *  the frame's diagonal on screen — the shimmer crosses the screen, not the weapon, so a turning knife
 *  still catches it left to right. */
export function finishAt(
  spec: PatternSpec,
  pal: readonly Rgb[],
  kind: SkinMotion["pattern"],
  u: number,
  v: number,
  t: number,
  sweep = (u + 0.4 * v) / 1.4,
): Rgb {
  let uu = u;
  let vv = v;
  // a kind that draws this motion itself (OWN_MOTION) gets the phase, and nothing generic goes on top
  const own = kind !== undefined && OWN_MOTION[spec.kind] === kind;
  if (!own && (kind === "flow" || kind === "rise" || kind === "glitch" || kind === "drip")) {
    // a small closed drift, so the loop returns to where it started; a finish that cannot scroll up
    // seamlessly drifts instead of rising
    uu += 0.08 * Math.cos(TAU * t);
    vv += 0.08 * Math.sin(TAU * t);
  }
  let c = patternColor(spec, pal, uu, vv, own ? t : undefined);
  if (kind === "pulse" && !own) {
    const f = 1 + 0.12 * Math.sin(TAU * t);
    c = [c[0] * f, c[1] * f, c[2] * f];
  }
  if (kind === "shimmer") {
    // a bright diagonal band sweeping the middle of the frame, where the weapon always is (a thin, turning
    // knife included); it starts over at the left each loop, like a fresh glint
    const d = Math.abs(sweep - (0.2 + 0.6 * t));
    if (d < 0.12) c = mix(c, 255, 0.75 * (1 - d / 0.12));
  }
  if (kind === "sparkle") {
    for (let i = 0; i < SPARKLES; i++) {
      const su = hash2(i, 1, spec.seed);
      const sv = hash2(i, 2, spec.seed);
      if (Math.abs(u - su) > 0.5 / SKIN_W || Math.abs(v - sv) > 0.5 / SKIN_H) continue;
      c = mix(c, 255, Math.max(0, Math.sin(TAU * (t - hash2(i, 3, spec.seed)))) ** 6);
    }
  }
  return c;
}

function inPolygon(pts: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** One frame of a skin at loop phase t, drawn from the weapon's silhouette (a still skin: t is ignored). */
export function renderSkinFrame(skin: SkinDef, t: number, w = SKIN_W, h = SKIN_H): PixelImage {
  const motion = skin.motion ?? {};
  const phase = t - Math.floor(t);
  const size = frameSize(motion, w, h);
  const pose = weaponPose(motion.weapon, phase);
  const pal = skin.pattern.palette.map(hexToRgb);
  const pts = SILHOUETTES[skin.weapon];
  const sx = SILHOUETTE_BOX.w / w;
  const sy = SILHOUETTE_BOX.h / h;
  const ox = (size.w - w) / 2 + pose.dx;
  const oy = (size.h - h) / 2 + pose.dy;
  const cos = Math.cos(-pose.angle);
  const sin = Math.sin(-pose.angle);
  /** Output pixel → the matching point in the weapon's own pixel space. */
  const local = (x: number, y: number): [number, number] => {
    let px = x + 0.5 - ox;
    let py = y + 0.5 - oy;
    if (pose.angle) {
      const cx = px - w / 2;
      const cy = py - h / 2;
      px = w / 2 + cx * cos - cy * sin;
      py = h / 2 + cx * sin + cy * cos;
    }
    return [px, py];
  };
  const fill = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= size.w || y >= size.h) return false;
    const [px, py] = local(x, y);
    return inPolygon(pts, px * sx, py * sy);
  };
  const data = new Uint8ClampedArray(size.w * size.h * 4);
  for (let y = 0; y < size.h; y++)
    for (let x = 0; x < size.w; x++) {
      const i = (y * size.w + x) * 4;
      if (fill(x, y)) {
        const [px, py] = local(x, y);
        const lum = Math.max(0, 200 - Math.floor(py) * 10); // the same top-lit shading as the still skins
        const k = 0.35 + 0.9 * (lum / 255);
        const sweep = (x + 0.5 + 0.4 * (y + 0.5)) / (size.w + 0.4 * size.h);
        const c = finishAt(skin.pattern, pal, motion.pattern, px / w, py / h, phase, sweep);
        data.set([c[0] * k, c[1] * k, c[2] * k, 255], i);
      } else if (fill(x - 1, y) || fill(x + 1, y) || fill(x, y - 1) || fill(x, y + 1)) data.set([...OUTLINE, 255], i);
    }
  const put = (x: number, y: number, c: Rgb, onWeapon: boolean) => {
    if (x < 0 || y < 0 || x >= size.w || y >= size.h) return;
    const i = (y * size.w + x) * 4;
    if (onWeapon && data[i + 3] === 0) return;
    data.set([...c, 255], i);
  };
  if (motion.weapon === "bolt") {
    const by = Math.round(oy + h * 0.3);
    const bx = Math.round(ox + w * 0.55) - pose.bolt;
    for (let x = bx; x < bx + 3; x++) put(x, by, BOLT, true);
  }
  if (pose.flash) {
    const fy = Math.round(oy + h * 0.4);
    put(Math.round(ox + w), fy, FLASH, false);
    put(Math.round(ox + w) + 1, fy, FLASH, false);
  }
  return { w: size.w, h: size.h, data };
}

/** A spinning knife is drawn a little smaller, so its square frame (24 px) fits inside a card. */
const FLIP_W = 20;
const FLIP_H = 8;

/** The whole loop: frame n at phase n / frames. */
export function renderSkinFrames(skin: SkinDef, w?: number, h?: number): PixelImage[] {
  const flip = skin.motion?.weapon === "flip";
  const ww = w ?? (flip ? FLIP_W : SKIN_W);
  const hh = h ?? (flip ? FLIP_H : SKIN_H);
  const n = motionFrames(skin);
  return Array.from({ length: n }, (_, i) => renderSkinFrame(skin, i / n, ww, hh));
}
