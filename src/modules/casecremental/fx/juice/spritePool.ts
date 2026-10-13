import { Sprite, type Texture } from "pixi.js";

// Sprites handed out and taken back, so an effect that fires every frame (coins, sparks) makes no garbage.

export class SpritePool {
  private readonly free: Sprite[] = [];
  private count = 0;

  constructor(private readonly texture: Texture) {}

  /** How many sprites it has ever made. */
  get made(): number {
    return this.count;
  }

  take(): Sprite {
    const s = this.free.pop();
    if (s) return s;
    this.count++;
    return new Sprite(this.texture);
  }

  release(s: Sprite): void {
    s.removeFromParent();
    this.free.push(s);
  }

  destroy(): void {
    for (const s of this.free) s.destroy();
    this.free.length = 0;
  }
}
