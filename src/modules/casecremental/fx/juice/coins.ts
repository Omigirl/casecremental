import { Container, Sprite, Text, type Texture } from "pixi.js";
import type { Point } from "../layout";

// Money you can see: coins arc from the sold skin to the cash counter, and the amount floats up.

interface Flight {
  s: Sprite;
  from: Point;
  ctrl: Point;
  to: Point;
  delay: number;
  dur: number;
  age: number;
}
interface Floater {
  t: Text;
  age: number;
  y0: number;
}

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

export class Coins {
  readonly container = new Container();
  private flights: Flight[] = [];
  private floaters: Floater[] = [];

  constructor(private readonly coinTexture: Texture) {}

  burst(from: Point, to: Point, amount: number): void {
    const n = Math.min(24, Math.max(1, Math.round(Math.log10(amount + 1) * 4)));
    for (let i = 0; i < n; i++) {
      const s = new Sprite(this.coinTexture);
      s.anchor.set(0.5);
      s.visible = false;
      this.container.addChild(s);
      this.flights.push({
        s,
        from: { x: from.x + (Math.random() - 0.5) * 30, y: from.y + (Math.random() - 0.5) * 30 },
        ctrl: { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 120, y: Math.min(from.y, to.y) - 40 - Math.random() * 120 },
        to,
        delay: i * 0.025,
        dur: 0.55 + Math.random() * 0.25,
        age: 0,
      });
    }
  }

  floatText(at: Point, text: string, color = 0xffe27a): void {
    const t = new Text({ text, style: { fontFamily: FONT, fontSize: 22, fontWeight: "900", fill: color, stroke: { color: 0x000000, width: 4 } } });
    t.anchor.set(0.5);
    t.position.set(at.x, at.y);
    this.container.addChild(t);
    this.floaters.push({ t, age: 0, y0: at.y });
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
      f.s.x = u * u * f.from.x + 2 * u * t * f.ctrl.x + t * t * f.to.x;
      f.s.y = u * u * f.from.y + 2 * u * t * f.ctrl.y + t * t * f.to.y;
      f.s.scale.set(1 - 0.4 * t);
      return true;
    });
    this.floaters = this.floaters.filter((f) => {
      f.age += dt;
      const k = f.age / 0.9;
      if (k >= 1) {
        f.t.destroy();
        return false;
      }
      f.t.y = f.y0 - 60 * k;
      f.t.alpha = 1 - k * k;
      return true;
    });
  }
}
