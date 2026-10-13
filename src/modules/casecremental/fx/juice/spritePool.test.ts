import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { SpritePool } from "./spritePool";

describe("SpritePool", () => {
  it("hands a released sprite back out instead of making a new one", () => {
    const pool = new SpritePool(new Texture({ source: new TextureSource({ width: 1, height: 1 }) }));
    const a = pool.take();
    pool.release(a);
    expect(pool.take()).toBe(a);
    pool.take();
    expect(pool.made).toBe(2);
  });
});
