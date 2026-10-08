import { Sprite, type Container, type Texture } from "pixi.js";
import type { Pt } from "../pixel/layout";

// The ★ knife's showcase: the moment the card comes up, the knife is lifted into the HD layer and shot like
// product b-roll — it stays over the card and slowly comes toward the viewer, growing well past the card's
// edges while it turns once on a turntable (edge-on, its back, face-on again) with a gentle tilt, then eases
// back into the card, where it keeps spinning in its pixel loop. Real time, so it plays through the slow-mo.

export const FLIGHT_SECONDS = 2.4;
/** How much closer it comes: its size at the middle of the shot. */
const PEAK_SCALE = 3.5;
/** The gentle tilt (radians) it rocks through while turning. */
const TILT = 0.22;
const TAU = Math.PI * 2;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

export interface FlightPose {
  /** Offset from the card centre, screen px (the shot stays put: always 0). */
  x: number;
  y: number;
  scale: number;
  /** Radians: a gentle rock, upright at both ends. */
  rotation: number;
  /** The turntable turn as a horizontal scale: 1 face-on, 0 edge-on, −1 its back. */
  flip: number;
}

export function flightPose(t: number): FlightPose {
  const u = clamp01(t);
  const swell = Math.sin(Math.PI * u) ** 2; // eases in and out, no jolt at either end
  return {
    x: 0,
    y: 0,
    scale: 1 + (PEAK_SCALE - 1) * swell,
    rotation: TILT * Math.sin(TAU * u),
    flip: Math.cos(TAU * easeInOut(u)),
  };
}

export class KnifeFlight {
  private readonly sprite = new Sprite({ anchor: 0.5 });
  private t = -1;
  private home: Pt = { x: 0, y: 0 };
  private size = 1;
  private onLand: (() => void) | null = null;
  /** An animated skin's loop plays through the shot. */
  private frames: readonly Texture[] = [];
  private fps = 8;

  constructor(parent: Container) {
    this.sprite.visible = false;
    parent.addChild(this.sprite);
  }

  get flying(): boolean {
    return this.t >= 0;
  }

  /** Lift `texture` (the knife's still frame, or an animated skin's frames played at `fps`) out of the card at
   *  `at` (screen px), drawn at `size`× scale. */
  start(texture: Texture | readonly Texture[], at: Pt, size: number, onLand: () => void, fps = 8): void {
    this.frames = Array.isArray(texture) ? texture : [texture as Texture];
    this.fps = fps;
    this.sprite.texture = this.frames[0]!;
    this.home = at;
    this.size = size;
    this.onLand = onLand;
    this.t = 0;
    this.sprite.visible = true;
    this.place();
  }

  update(realSeconds: number): void {
    if (this.t < 0) return;
    this.t = Math.min(1, this.t + realSeconds / FLIGHT_SECONDS);
    this.place();
    if (this.t < 1) return;
    const land = this.onLand;
    this.cancel();
    land?.();
  }

  /** Stop without landing (the card was sold, or the screen changed under it). */
  cancel(): void {
    this.t = -1;
    this.onLand = null;
    this.sprite.visible = false;
  }

  private place(): void {
    const p = flightPose(this.t);
    if (this.frames.length > 1) this.sprite.texture = this.frames[Math.floor(this.t * FLIGHT_SECONDS * this.fps) % this.frames.length]!;
    this.sprite.position.set(this.home.x + p.x, this.home.y + p.y);
    this.sprite.scale.set(this.size * p.scale * p.flip, this.size * p.scale);
    this.sprite.rotation = p.rotation;
  }
}
