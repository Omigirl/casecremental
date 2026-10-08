import { Sprite, type Container, type Texture } from "pixi.js";
import type { Pt } from "../pixel/layout";

// The ★ knife's entrance: the moment the card comes up, the knife leaves it — lifted into the HD layer,
// it rises, grows to about twice its size, spins and flips edge-on (2.5D), then arcs back down into the
// card, where it keeps spinning in its pixel loop. Real time, so it plays through the ★ slow-mo.

export const FLIGHT_SECONDS = 1.2;
const TAU = Math.PI * 2;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

export interface FlightPose {
  /** Offset from the card centre, screen px. */
  x: number;
  y: number;
  scale: number;
  /** Radians; two full turns over the flight, upright at both ends. */
  rotation: number;
  /** Horizontal scale sign/size of the 3D flip: 1 face-on, 0 edge-on, −1 its back. */
  flip: number;
}

export function flightPose(t: number, rise: number): FlightPose {
  const u = clamp01(t);
  return {
    x: 0,
    y: -rise * 4 * u * (1 - u),
    scale: 1 + Math.sin(Math.PI * u),
    rotation: 2 * TAU * easeInOut(u),
    flip: Math.cos(2 * TAU * u),
  };
}

export class KnifeFlight {
  private readonly sprite = new Sprite({ anchor: 0.5 });
  private t = -1;
  private home: Pt = { x: 0, y: 0 };
  private size = 1;
  private rise = 0;
  private onLand: (() => void) | null = null;

  constructor(parent: Container) {
    this.sprite.visible = false;
    parent.addChild(this.sprite);
  }

  get flying(): boolean {
    return this.t >= 0;
  }

  /** Lift `texture` (the knife's still frame) out of the card at `at` (screen px), drawn at `size`× scale. */
  start(texture: Texture, at: Pt, size: number, rise: number, onLand: () => void): void {
    this.sprite.texture = texture;
    this.home = at;
    this.size = size;
    this.rise = rise;
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
    const p = flightPose(this.t, this.rise);
    this.sprite.position.set(this.home.x + p.x, this.home.y + p.y);
    this.sprite.scale.set(this.size * p.scale * p.flip, this.size * p.scale);
    this.sprite.rotation = p.rotation;
  }
}
