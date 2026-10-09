import { Container, Sprite, Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { VaultFx } from "./vaultFx";

const tex = () => new Texture({ source: new TextureSource({ width: 1, height: 1 }) });

/** Sprites still showing under a layer (particles and coins). */
const live = (c: Container): number => c.children.reduce((n, ch) => n + (ch instanceof Sprite ? 1 : live(ch as Container)), 0);

describe("VaultFx.clear", () => {
  it("leaves no particle or coin behind for the next vault", () => {
    const fx = new VaultFx(tex(), tex(), [tex(), tex()]);
    fx.layout({ w: 800, h: 600 }, 4);
    fx.firework({ x: 100, y: 100 }, 0xff0000, true);
    fx.impact({ x: 400, y: 400 });
    fx.shower(10);
    expect(live(fx.back)).toBeGreaterThan(0);
    expect(live(fx.front)).toBeGreaterThan(0);
    fx.clear();
    expect(live(fx.back)).toBe(0);
    expect(live(fx.front)).toBe(0);
  });
});
