import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { Particles } from "./particles";

const tex = () => new Texture({ source: new TextureSource({ width: 1, height: 1 }) });

describe("Particles.clear", () => {
  it("drops every live spark at once, back into the pool (nothing frozen to reappear later)", () => {
    const p = new Particles(tex());
    p.burst({ x: 0, y: 0 }, 0xffffff, 12, 100);
    expect(p.container.children.length).toBe(12);
    p.clear();
    expect(p.container.children.length).toBe(0);
    p.update(0.016);
    expect(p.container.children.length).toBe(0);
    p.burst({ x: 0, y: 0 }, 0xffffff, 3, 100); // the pool is reused
    expect(p.container.children.length).toBe(3);
  });
});
