import { Container, Sprite, type Texture } from "pixi.js";
import type { Pt } from "../pixel/layout";
import { Lean } from "./lean";

// A dragged item lifted out of the pixel world into the HD layer (2.5D): drawn a bit larger at the
// world scale, moving smoothly with the pointer, leaning into the drag, with a soft shadow below.

export interface LiftInfo {
  id: string;
  texture: Texture;
  /** Centre in world px (fractional — the lifted item moves smoothly). */
  center: Pt;
}

const LIFT = 1.15;

export class Lifted {
  readonly root = new Container();
  private readonly shadow = new Sprite();
  private readonly item = new Sprite();
  private readonly lean = new Lean();
  private id: string | null = null;

  constructor() {
    this.shadow.anchor.set(0.5);
    this.item.anchor.set(0.5);
    this.shadow.tint = 0x000000;
    this.shadow.alpha = 0.35;
    this.root.visible = false;
    this.root.addChild(this.shadow, this.item);
  }

  update(info: LiftInfo | null, scale: number, dt: number): void {
    if (!info) {
      this.root.visible = false;
      this.id = null;
      return;
    }
    const x = info.center.x * scale;
    const y = info.center.y * scale;
    if (info.id !== this.id) {
      this.id = info.id;
      this.lean.reset(x);
    }
    const angle = this.lean.update(x, dt);
    this.item.texture = this.shadow.texture = info.texture;
    this.item.position.set(x, y - 2 * scale);
    this.item.scale.set(scale * LIFT);
    this.item.rotation = angle;
    this.shadow.position.set(x + scale, y + 3 * scale);
    this.shadow.scale.set(scale * LIFT * 0.95);
    this.shadow.rotation = angle;
    this.root.visible = true;
  }
}
