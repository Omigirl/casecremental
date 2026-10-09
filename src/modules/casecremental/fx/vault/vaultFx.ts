import { Container, Sprite, type Texture } from "pixi.js";
import { Particles } from "../juice/particles";
import type { Pt } from "../pixel/layout";

// The vault's particles (spec 2026-10-09 §1-2), in screen px. Both layers sit under the columns, their labels and
// the total (a particle never covers a label). Behind the chest: fireworks, star glints, rising light motes and
// gold coins arcing out of it and falling. In front of the chest: its own bursts (the slam's dust, the seam's
// sparks, the impact), the key's embers and a click's sparks. All randomness here is visual only.

const GOLD = 0xffd34d;
const PALE = 0xfff2c0;

interface Coin {
  s: Sprite;
  vx: number;
  vy: number;
  age: number;
}

export class VaultFx {
  readonly back = new Container();
  readonly front = new Container();
  /** In front of the chest (still under the labels): sparks and pixel stars. */
  readonly sparks: Particles;
  readonly stars: Particles;
  private readonly sky: Particles;
  private readonly glints: Particles;
  private readonly coinLayer = new Container();
  private coins: Coin[] = [];
  private screen = { w: 1, h: 1 };
  /** Screen px per world px (the bursts' speeds scale with it). */
  private k = 1;
  private coinScale = 1;
  private coinT = 0;
  private moteT = 0;
  private glintT = 0;

  constructor(
    dot: Texture,
    star: Texture,
    private readonly coinFrames: readonly Texture[],
  ) {
    this.sparks = new Particles(dot);
    this.stars = new Particles(star);
    this.sky = new Particles(dot);
    this.glints = new Particles(star, 300);
    this.back.addChild(this.sky.container, this.glints.container, this.coinLayer);
    this.front.addChild(this.sparks.container, this.stars.container);
  }

  layout(screen: { w: number; h: number }, k: number): void {
    this.screen = screen;
    this.k = k;
    this.coinScale = Math.max(1, Math.round(k * 0.6));
  }

  private get v(): number {
    return this.k / 6;
  }

  /** A firework: a ring of colour with a white core (behind the columns). */
  firework(at: Pt, color: number, big = false): void {
    const v = this.v;
    this.sky.burst(at, color, big ? 140 : 70, (big ? 520 : 360) * v, 260 * v);
    this.sky.burst(at, 0xffffff, big ? 40 : 18, 160 * v, 120 * v);
    this.glints.burst(at, color, big ? 24 : 10, (big ? 380 : 260) * v, 200 * v);
  }

  /** The lid snaps open: a dense burst of gold sparks and pixel stars, white at the core. */
  impact(at: Pt): void {
    const v = this.v;
    this.sparks.burst(at, GOLD, 160, 620 * v, 420 * v);
    this.sparks.burst(at, 0xffffff, 50, 300 * v, 200 * v);
    this.stars.burst(at, PALE, 40, 520 * v, 300 * v);
    this.coinArc(at, 16);
  }

  /** Light escaping through the seam while the vault trembles: a few sparks, rising. */
  seamSparks(at: Pt, width: number, n: number): void {
    const v = this.v;
    for (let i = 0; i < n; i++)
      this.sparks.burst({ x: at.x + (Math.random() - 0.5) * width, y: at.y }, Math.random() < 0.5 ? GOLD : PALE, 1, 90 * v, -260 * v);
  }

  /** Coins thrown up out of the mouth, arcing out to either side and falling. */
  coinArc(at: Pt, n: number): void {
    const v = this.v;
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.addCoin(at.x + (Math.random() - 0.5) * 20 * v, at.y, side * (60 + Math.random() * 300) * v, -(520 + Math.random() * 360) * v);
    }
  }

  /** The celebration's shower: coins and sparkles falling across the whole screen. */
  shower(n: number): void {
    const v = this.v;
    for (let i = 0; i < n; i++)
      this.addCoin(
        Math.random() * this.screen.w,
        -20 - Math.random() * 200 * v,
        (Math.random() - 0.5) * 80 * v,
        (60 + Math.random() * 200) * v,
      );
    for (let i = 0; i < 24; i++)
      this.glints.burst(
        { x: Math.random() * this.screen.w, y: Math.random() * this.screen.h * 0.4 },
        Math.random() < 0.5 ? GOLD : 0xffffff,
        2,
        60 * v,
        120 * v,
      );
  }

  /** The spin's steady life at `density` (0-1): coins out of the mouth, rising motes, star glints in `sky`. */
  emit(dt: number, mouth: Pt, density: number, sky: { top: number; bottom: number }): void {
    const v = this.v;
    if (density <= 0) return;
    for (this.coinT += dt * 10 * density; this.coinT >= 1; this.coinT--) this.coinArc(mouth, 1);
    for (this.moteT += dt * 14 * density; this.moteT >= 1; this.moteT--) {
      const at = { x: mouth.x + (Math.random() - 0.5) * this.screen.w * 0.4, y: mouth.y - Math.random() * 40 * v };
      this.sky.burst(at, Math.random() < 0.6 ? GOLD : PALE, 1, 25 * v, -140 * v);
    }
    for (this.glintT += dt * 8 * density; this.glintT >= 1; this.glintT--) {
      const at = { x: this.screen.w * (0.08 + Math.random() * 0.84), y: sky.top + Math.random() * (sky.bottom - sky.top) };
      this.glints.burst(at, Math.random() < 0.7 ? 0xffffff : GOLD, 1, 12 * v, 0);
    }
  }

  update(dt: number): void {
    this.sparks.update(dt);
    this.stars.update(dt);
    this.sky.update(dt);
    this.glints.update(dt);
    const g = 1500 * this.v;
    this.coins = this.coins.filter((c) => {
      c.age += dt;
      c.vy += g * dt;
      c.s.x += c.vx * dt;
      c.s.y += c.vy * dt;
      c.s.texture = this.coinFrames[Math.floor(c.age * 14) % this.coinFrames.length]!;
      if (c.s.y < this.screen.h + 40) return true;
      c.s.destroy();
      return false;
    });
  }

  /** The vault is gone: drop every particle and coin in flight (frozen while hidden, they would reappear). */
  clear(): void {
    for (const p of [this.sparks, this.stars, this.sky, this.glints]) p.clear();
    for (const c of this.coins) c.s.destroy();
    this.coins = [];
  }

  private addCoin(x: number, y: number, vx: number, vy: number): void {
    const s = new Sprite({ texture: this.coinFrames[0], anchor: 0.5 });
    s.scale.set(this.coinScale);
    s.position.set(x, y);
    this.coinLayer.addChild(s);
    this.coins.push({ s, vx, vy, age: Math.random() });
  }
}
