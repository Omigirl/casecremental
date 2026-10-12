import { Container, Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { createRng } from "../../sim/rng";
import { caseById, skinById } from "../../sim/content/cases";
import type { SkinTextures } from "../skins/pixelSkin";
import type { SpriteSet } from "./sprites";
import { WIN_INDEX } from "../reel/strip";
import { CARD_W, Reel, reelPosition } from "./Reel";

describe("reelPosition", () => {
  it("starts with the strip flush left and moves in whole pixels, never backwards", () => {
    expect(reelPosition(0, 120, 0.2).x).toBe(0);
    let last = Infinity;
    for (let i = 0; i <= 100; i++) {
      const { x } = reelPosition(i / 100, 120, 0.2);
      expect(Number.isInteger(x)).toBe(true);
      expect(x).toBeLessThanOrEqual(last);
      last = x;
    }
  });

  it("lands with the winning card under the marker, off by the jitter", () => {
    for (const jitter of [-0.35, 0, 0.3]) {
      const { x, index } = reelPosition(1, 120, jitter);
      expect(index).toBe(WIN_INDEX);
      const winnerCentre = x + WIN_INDEX * CARD_W + CARD_W / 2;
      expect(Math.abs(winnerCentre - (60 - jitter * CARD_W))).toBeLessThanOrEqual(0.5);
    }
  });
});

describe("Reel landed look", () => {
  const tex = new Texture({ source: new TextureSource({ width: 4, height: 4 }) });
  const skins = { texture: () => tex, size: () => ({ w: 26, h: 10 }), thumb: () => tex } as unknown as SkinTextures;

  it("clears the winner outline and the dimming when the same reel starts its next spin", () => {
    const reel = new Reel({ frames: [tex] } as unknown as SpriteSet, skins, () => {});
    reel.layout({ x: 0, y: 0, w: 120, h: 26 });
    const c = caseById("bootcamp");
    reel.start(c, skinById("bc_woodland"), createRng(1), null, true);
    const strip = reel.children[3] as Container;
    const edge = () => strip.children[strip.children.length - 1] as unknown as { context: { instructions: unknown[] } };
    expect(edge().context.instructions.length).toBeGreaterThan(0);
    expect(strip.children.some((ch) => ch.alpha < 1)).toBe(true);
    reel.start(c, skinById("bc_desert"), createRng(2));
    expect(edge().context.instructions.length).toBe(0);
    expect(strip.children.every((ch) => ch.alpha === 1)).toBe(true);
  });
});
