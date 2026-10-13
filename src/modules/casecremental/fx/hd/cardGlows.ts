import { Container, Sprite, type Texture } from "pixi.js";
import type { Pt } from "../pixel/layout";

// A soft glow under each of a station's cards (the bot's pair, the locker's results), in its card's rarity colour,
// fading in and out on its own. Screen px (the HD layer). The same gentle 0.8 Hz breathing as your bench's glow.

export class CardGlows {
  readonly root = new Container();
  private readonly targets: number[] = [];

  constructor(texture: Texture, count: number) {
    for (let i = 0; i < count; i++) {
      this.root.addChild(new Sprite({ texture, anchor: 0.5, blendMode: "add", alpha: 0 }));
      this.targets.push(0);
    }
  }

  /** Slot `i` glows `color` at `at`, `size` px across — or fades out (null). */
  set(i: number, at: Pt, color: number | null, size: number): void {
    const s = this.root.children[i] as Sprite | undefined;
    if (!s) return;
    s.position.set(at.x, at.y);
    s.width = s.height = size;
    if (color !== null) s.tint = color;
    this.targets[i] = color === null ? 0 : 0.7;
  }

  update(dt: number, t: number): void {
    this.root.children.forEach((s, i) => {
      const target = this.targets[i]! * (0.85 + 0.15 * Math.sin(t * 5));
      s.alpha += (target - s.alpha) * Math.min(1, dt * 6);
    });
  }

  clear(): void {
    this.root.children.forEach((s, i) => {
      this.targets[i] = 0;
      s.alpha = 0;
    });
  }
}
