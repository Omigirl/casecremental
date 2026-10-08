import { Container, Sprite, type Texture } from "pixi.js";

// Cases raining onto the table during the vault finale: HD sprites that fall, tumble, land on the
// table and fade. stepRain is the pure part.

export interface RainDrop {
  x: number;
  y: number;
  /** Where this one lands (screen px). */
  floorY: number;
  vy: number;
  rot: number;
  vr: number;
  age: number;
  landed: boolean;
}

/** Seconds a raining case lives (falling, then lying there fading). */
export const RAIN_LIFE = 1.6;

export function stepRain<T extends RainDrop>(drops: T[], dt: number, gravity: number): T[] {
  for (const d of drops) {
    d.age += dt;
    if (d.landed) continue;
    d.vy += gravity * dt;
    d.y += d.vy * dt;
    d.rot += d.vr * dt;
    if (d.y >= d.floorY) {
      d.y = d.floorY;
      d.vy = 0;
      d.landed = true;
    }
  }
  return drops.filter((d) => d.age < RAIN_LIFE);
}

export class CaseRain {
  readonly container = new Container();
  private drops: Array<RainDrop & { s: Sprite }> = [];

  spawn(texture: Texture, x: number, floorY: number, scale: number, random: () => number): void {
    const s = new Sprite(texture);
    s.anchor.set(0.5, 1);
    s.scale.set(scale);
    this.container.addChild(s);
    this.drops.push({
      s,
      x,
      y: -texture.height * scale,
      floorY,
      vy: 0,
      rot: (random() - 0.5) * 0.6,
      vr: (random() - 0.5) * 6,
      age: 0,
      landed: false,
    });
  }

  update(dt: number, gravity: number): void {
    const alive = stepRain(this.drops, dt, gravity);
    for (const d of this.drops) if (!alive.includes(d)) d.s.destroy();
    this.drops = alive;
    for (const d of this.drops) {
      d.s.position.set(d.x, d.y);
      d.s.rotation = d.rot;
      d.s.alpha = Math.min(1, (RAIN_LIFE - d.age) / 0.4);
    }
  }

  clear(): void {
    for (const d of this.drops) d.s.destroy();
    this.drops = [];
  }
}
