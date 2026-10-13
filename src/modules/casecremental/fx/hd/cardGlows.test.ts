import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { CardGlows } from "./cardGlows";

describe("CardGlows", () => {
  const tex = new Texture({ source: new TextureSource({ width: 4, height: 4 }) });

  it("fades a slot's glow in under its card and out when the card goes", () => {
    const g = new CardGlows(tex, 2);
    g.set(1, { x: 10, y: 20 }, 0xeb4b4b, 50);
    for (let i = 0; i < 60; i++) g.update(1 / 60, i / 60);
    const s = g.root.children[1]!;
    expect(s.alpha).toBeGreaterThan(0.5);
    expect([s.x, s.y]).toEqual([10, 20]);
    expect(g.root.children[0]!.alpha).toBe(0);
    g.set(1, { x: 10, y: 20 }, null, 50);
    for (let i = 0; i < 60; i++) g.update(1 / 60, 1 + i / 60);
    expect(s.alpha).toBeLessThan(0.05);
  });

  it("goes dark at once on clear (a new run)", () => {
    const g = new CardGlows(tex, 2);
    g.set(0, { x: 0, y: 0 }, 0xffd700, 50);
    g.update(1, 0);
    g.clear();
    expect(g.root.children.every((c) => c.alpha === 0)).toBe(true);
  });
});
