import { Container, Sprite, type Texture } from "pixi.js";
import type { Pt } from "../pixel/layout";

// Pooled sprite sparks: bursts on reveals, tinted by rarity, falling with gravity and fading out.

interface Spark {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  age: number;
}

const GRAVITY = 600;

export class Particles {
  readonly container = new Container();
  private readonly pool: Sprite[] = [];
  private live: Spark[] = [];

  constructor(
    private readonly texture: Texture,
    private readonly max = 1500,
  ) {}

  burst(at: Pt, color: number, count: number, speed: number): void {
    for (let i = 0; i < count && this.live.length < this.max; i++) {
      const s = this.pool.pop() ?? new Sprite(this.texture);
      s.anchor.set(0.5);
      s.tint = color;
      s.alpha = 1;
      s.position.set(at.x, at.y);
      s.scale.set(0.4 + Math.random() * 0.8);
      this.container.addChild(s);
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      this.live.push({ s, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 0.6 + Math.random() * 0.6, age: 0 });
    }
  }

  update(dt: number): void {
    this.live = this.live.filter((p) => {
      p.age += dt;
      if (p.age >= p.life) {
        this.container.removeChild(p.s);
        this.pool.push(p.s);
        return false;
      }
      p.vy += GRAVITY * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.alpha = 1 - p.age / p.life;
      return true;
    });
  }
}
