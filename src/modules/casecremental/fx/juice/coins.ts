import { gsap } from "gsap";
import { Container, Sprite, Text, type Texture } from "pixi.js";
import { moneyStyle } from "../hd/font";
import { fitCentre } from "../labels";
import { floatAway, pop } from "../hd/tween";
import type { Pt } from "../pixel/layout";
import { SpritePool } from "./spritePool";

// Money you can see: spinning pixel coins arc from the sold skin to the cash counter, and the amount pops and floats up
// in gold. The coins fly in the pixel world (world px, whole pixels), in a layer the World puts under the reels and the
// bench's cards, so a stream of sales passes behind a reel's window instead of covering it (F1: at ×5 a column of them
// hid all five markers). The amounts are HD text (screen px), kept inside the table's width: the seller and the bin stand
// near its ends, where an amount centred on them ran under a side panel.

interface Flight {
  s: Sprite;
  from: Pt;
  ctrl: Pt;
  to: Pt;
  delay: number;
  dur: number;
  age: number;
}

export class Coins {
  /** The flying coins: pixel world, world px. */
  readonly flyers = new Container();
  /** The amounts that pop and float up (HD, screen px). */
  readonly container = new Container();
  private flights: Flight[] = [];
  private readonly texts = new Set<Text>();
  private textSize = 16;
  /** The screen-px span the amounts stay within (the table between the side panels); null = anywhere. */
  private span: { lo: number; hi: number } | null = null;
  private readonly pool: SpritePool;

  constructor(private readonly frames: readonly Texture[]) {
    this.pool = new SpritePool(frames[0]!);
  }

  setTextSize(textSize: number): void {
    this.textSize = textSize;
  }

  /** Keep the floating amounts between `lo` and `hi` (screen px). */
  setSpan(lo: number, hi: number): void {
    this.span = { lo, hi };
  }

  /** Coins from `from` to `to`, world px; more for a bigger amount. */
  burst(from: Pt, to: Pt, amount: number): void {
    const n = Math.min(24, Math.max(1, Math.round(Math.log10(amount + 1) * 4)));
    for (let i = 0; i < n; i++) {
      this.flights.push({
        s: this.take(),
        from: { x: from.x + (Math.random() - 0.5) * 10, y: from.y + (Math.random() - 0.5) * 10 },
        ctrl: { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 40, y: Math.min(from.y, to.y) - (8 + Math.random() * 30) },
        to,
        delay: i * 0.025,
        dur: 0.55 + Math.random() * 0.25,
        age: 0,
      });
    }
  }

  /** One coin from `from` to `to`, world px (a machine's sale — cheap enough for ten a second). */
  spark(from: Pt, to: Pt): void {
    this.flights.push({
      s: this.take(),
      from,
      ctrl: { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 12 },
      to,
      delay: 0,
      dur: 0.5,
      age: 0,
    });
  }

  /** A gold word floating up from `at` (screen px); `tint` dims it to another colour (a loss). */
  floatText(at: Pt, text: string, tint = 0xffffff): void {
    const t = new Text({ text, style: moneyStyle(this.textSize) });
    t.tint = tint;
    t.anchor.set(0.5);
    t.position.set(this.span ? fitCentre(at.x, t.width, this.span.lo, this.span.hi) : at.x, at.y);
    this.container.addChild(t);
    this.texts.add(t);
    pop(t);
    floatAway(t, this.textSize * 3).eventCallback("onComplete", () => {
      this.texts.delete(t);
      t.destroy();
    });
  }

  update(dt: number): void {
    this.flights = this.flights.filter((f) => {
      f.age += dt;
      const t = (f.age - f.delay) / f.dur;
      if (t < 0) return true;
      if (t >= 1) {
        this.pool.release(f.s);
        return false;
      }
      const u = 1 - t;
      f.s.visible = true;
      f.s.texture = this.frames[Math.floor(f.age * 12) % this.frames.length]!;
      f.s.x = Math.round(u * u * f.from.x + 2 * u * t * f.ctrl.x + t * t * f.to.x);
      f.s.y = Math.round(u * u * f.from.y + 2 * u * t * f.ctrl.y + t * t * f.to.y);
      return true;
    });
  }

  /** Stop the text tweens before the display objects go away with the layer. */
  destroy(): void {
    for (const t of this.texts) {
      gsap.killTweensOf(t);
      gsap.killTweensOf(t.scale);
    }
    this.texts.clear();
    for (const f of this.flights) this.pool.release(f.s);
    this.flights = [];
    this.pool.destroy();
  }

  private take(): Sprite {
    const s = this.pool.take();
    s.anchor.set(0.5);
    s.scale.set(1);
    s.visible = false;
    this.flyers.addChild(s);
    return s;
  }
}
