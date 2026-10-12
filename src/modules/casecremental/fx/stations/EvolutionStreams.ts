import { Container, Graphics, type Sprite, type Texture } from "pixi.js";
import { SpritePool } from "../juice/spritePool";
import type { Particles } from "../juice/particles";
import type { Pt } from "../pixel/layout";
import { BILL_FLIGHT_SECONDS, billsToLaunch, FLAME_LIFE, flamesToEmit } from "./evolutionRules";

// The two evolution looks that are streams of sprites, pooled and capped so Run 4's top rate never makes one sprite
// per sale: Money Printer's bills flying from the seller to the HUD's cash, and Hot Hand's flames rising from the
// pointer. Both live in the HD layer (screen px) and are visual only.

const BILL = 0x3fae5a;
const BILL_BAND = 0x2a7a3e;
const FLAMES = [0xffd34d, 0xff8a1e, 0xe8362a] as const;

interface Bill {
  s: Sprite;
  from: Pt;
  ctrl: Pt;
  to: Pt;
  age: number;
  spin: number;
}

/** Money Printer: a few green bills per seller sale on a slight arc to the cash, spinning flat; never more than
 *  BILLS_MAX in the air. */
export class BillStream {
  readonly root = new Container();
  private readonly texture: Texture;
  private readonly pool: SpritePool;
  private bills: Bill[] = [];

  constructor(bake: (c: Container) => Texture) {
    const g = new Graphics().rect(0, 0, 4, 2).fill(BILL).rect(1, 0, 2, 1).fill(BILL_BAND);
    this.texture = bake(g);
    g.destroy();
    this.pool = new SpritePool(this.texture);
  }

  /** One seller sale: bills from `from` toward `to` (screen px), `k` the pixel scale. */
  launch(from: Pt, to: Pt, k: number): void {
    const n = billsToLaunch(this.bills.length, 1);
    for (let i = 0; i < n; i++) {
      const s = this.pool.take();
      s.anchor.set(0.5);
      s.scale.set(k);
      s.position.set(from.x, from.y);
      this.root.addChild(s);
      const j = () => 1 + (Math.random() - 0.5) * 0.5; // ±25 %
      const end = { x: to.x + (Math.random() - 0.5) * 8 * k, y: to.y };
      const ctrl = { x: ((from.x + end.x) / 2) * j(), y: Math.min(from.y, end.y) - 20 * k * j() };
      this.bills.push({ s, from, ctrl, to: end, age: -i * 0.05, spin: 8 + Math.random() * 8 });
    }
  }

  update(dt: number, k: number): void {
    this.bills = this.bills.filter((b) => {
      b.age += dt;
      const t = b.age / BILL_FLIGHT_SECONDS;
      if (t >= 1) {
        this.pool.release(b.s);
        return false;
      }
      const u = Math.max(0, t);
      const v = 1 - u;
      b.s.visible = t >= 0;
      b.s.x = v * v * b.from.x + 2 * v * u * b.ctrl.x + u * u * b.to.x;
      b.s.y = v * v * b.from.y + 2 * v * u * b.ctrl.y + u * u * b.to.y;
      b.s.scale.set(k * Math.cos(b.age * b.spin), k);
      return true;
    });
  }

  clear(): void {
    for (const b of this.bills) this.pool.release(b.s);
    this.bills = [];
  }

  destroy(): void {
    this.clear();
    this.pool.destroy();
    this.texture.destroy(true);
  }
}

/** Hot Hand: flames rising from a point while it burns, FLAMES_PER_SECOND through the shared sparks, never more than
 *  FLAMES_MAX counted alive (each for FLAME_LIFE s). */
export class FlameTrail {
  private carry = 0;
  private t = 0;
  private emitted: Array<{ t: number; n: number }> = [];

  constructor(private readonly particles: Particles) {}

  /** `at` the pointer (screen px) while Hot Hand burns, else null. */
  update(dt: number, at: Pt | null, k: number): void {
    this.t += dt;
    this.emitted = this.emitted.filter((e) => this.t - e.t < FLAME_LIFE);
    if (!at) {
      this.carry = 0;
      return;
    }
    const alive = this.emitted.reduce((a, e) => a + e.n, 0);
    const r = flamesToEmit(alive, dt, this.carry);
    this.carry = r.carry;
    if (r.n <= 0) return;
    this.emitted.push({ t: this.t, n: r.n });
    for (let i = 0; i < r.n; i++)
      this.particles.burst(at, FLAMES[Math.floor(this.t * 30 + i) % FLAMES.length]!, 1, (40 * k) / 6, (-400 * k) / 6);
  }
}
