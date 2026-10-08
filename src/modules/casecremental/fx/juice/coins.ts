import { gsap } from "gsap";
import { Container, Sprite, Text, type Texture } from "pixi.js";
import { moneyStyle } from "../hd/font";
import { floatAway, pop } from "../hd/tween";
import type { Pt } from "../pixel/layout";

// Money you can see: spinning pixel coins arc from the sold skin to the cash counter, and the
// amount pops and floats up in gold. Lives in the HD layer (screen px); coins are drawn at the
// pixel world's integer scale.

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
  readonly container = new Container();
  private flights: Flight[] = [];
  private readonly texts = new Set<Text>();
  private pixelScale = 1;
  private textSize = 16;

  constructor(private readonly frames: readonly Texture[]) {}

  setScale(pixelScale: number, textSize: number): void {
    this.pixelScale = pixelScale;
    this.textSize = textSize;
  }

  burst(from: Pt, to: Pt, amount: number): void {
    const k = this.pixelScale;
    const n = Math.min(24, Math.max(1, Math.round(Math.log10(amount + 1) * 4)));
    for (let i = 0; i < n; i++) {
      const s = new Sprite(this.frames[0]);
      s.anchor.set(0.5);
      s.scale.set(k);
      s.visible = false;
      this.container.addChild(s);
      this.flights.push({
        s,
        from: { x: from.x + (Math.random() - 0.5) * 10 * k, y: from.y + (Math.random() - 0.5) * 10 * k },
        ctrl: { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 40 * k, y: Math.min(from.y, to.y) - (8 + Math.random() * 30) * k },
        to,
        delay: i * 0.025,
        dur: 0.55 + Math.random() * 0.25,
        age: 0,
      });
    }
  }

  floatText(at: Pt, text: string): void {
    const t = new Text({ text, style: moneyStyle(this.textSize) });
    t.anchor.set(0.5);
    t.position.set(at.x, at.y);
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
        f.s.destroy();
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
    this.flights = [];
  }
}
