import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { SpritePool } from "../juice/spritePool";
import type { Pt } from "../pixel/layout";
import { BILL_FLIGHT_SECONDS, billsToLaunch, FLAME_TONGUES, flameTongues } from "./evolutionRules";

// The two evolution looks that are streams of sprites, pooled and capped so Run 4's top rate never makes one sprite
// per sale: Money Printer's bills flying from the seller to the HUD's cash, and Hot Hand's flames standing on the
// pointer. Both live in the HD layer (screen px) and are visual only.

const BILL = 0x3fae5a;
const BILL_BAND = 0x2a7a3e;
/** One tongue of fire, drawn in pixels from its tip down: red rim, orange body, yellow and white-hot core. */
const FLAME_ART = [
  "....R....",
  "....R....",
  "...RR....",
  "...ROR...",
  "..RROR...",
  "..ROOOR..",
  ".RROYOR..",
  ".ROOYOOR.",
  ".ROYYYOR.",
  "RROYWYORR",
  "ROOYWWYOR",
  "ROYYWWYOR",
  ".ROYYYOR.",
  "..RROORR.",
];
const FLAME_COLORS: Record<string, number> = { R: 0xe8362a, O: 0xff8a1e, Y: 0xffd34d, W: 0xfff4c0 };
/** World px the flames' feet sit below the pointer, so the fire wraps the hand rather than floating over it. */
const FLAME_FOOT = 4;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

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
    const g = new Graphics().rect(0, 0, 6, 3).fill(BILL).rect(0, 1, 6, 1).fill(BILL_BAND).rect(2, 0, 2, 3).fill(BILL_BAND);
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

/** Hot Hand: FLAME_TONGUES pixel flames standing on the pointer while it burns (flameTongues: their sway, their size,
 *  an opacity that barely moves; still under reduced motion), hidden the moment it stops or the pointer goes. */
export class FlameTrail {
  readonly root = new Container();
  private readonly texture: Texture;
  private readonly tongues: Sprite[] = [];
  private readonly reduced = typeof matchMedia === "function" ? matchMedia(REDUCED_MOTION) : null;
  private t = 0;

  constructor(bake: (c: Container) => Texture) {
    const g = new Graphics();
    FLAME_ART.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = FLAME_COLORS[row[x]!];
        if (c !== undefined) g.rect(x, y, 1, 1).fill(c);
      }
    });
    this.texture = bake(g);
    g.destroy();
    for (let i = 0; i < FLAME_TONGUES; i++) {
      this.tongues.push(this.root.addChild(new Sprite({ texture: this.texture, anchor: { x: 0.5, y: 1 } })));
    }
    this.root.visible = false;
  }

  /** `at` the pointer (screen px) while Hot Hand burns, else null; `k` the pixel scale. */
  update(dt: number, at: Pt | null, k: number): void {
    this.root.visible = at !== null;
    if (!at) return;
    this.t += dt;
    flameTongues(this.t, this.reduced?.matches ?? false).forEach((f, i) => {
      const s = this.tongues[i]!;
      s.position.set(at.x + f.dx * k, at.y + FLAME_FOOT * k);
      s.scale.set(f.sx * k, f.sy * k);
      s.alpha = f.alpha;
    });
  }

  destroy(): void {
    this.root.destroy({ children: true });
    this.texture.destroy(true);
  }
}
