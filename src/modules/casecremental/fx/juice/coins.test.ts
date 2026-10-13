import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { Coins } from "./coins";

// F1 #3: the sale coins (12×22 spinning frames, the "golden bullets" at ×5) fly in the pixel world, in a layer the World
// puts under the reels, so a stream of sales never covers a reel's window.

// the floating amounts are pixi Text, whose measuring needs a canvas: a stand-in 10 px wide a character
vi.mock("pixi.js", async (importOriginal) => {
  const pixi = await importOriginal<typeof import("pixi.js")>();
  class Text extends pixi.Container {
    readonly anchor = { set: () => {} };
    tint = 0xffffff;
    constructor(readonly opts: { text: string }) {
      super();
    }
    override get width(): number {
      return this.opts.text.length * 10 * this.scale.x;
    }
  }
  return { ...pixi, Text };
});
vi.mock("../hd/font", () => ({ moneyStyle: (fontSize: number) => ({ fontSize }) }));

const frame = () => new Texture({ source: new TextureSource({ width: 12, height: 22 }) });

describe("Coins", () => {
  it("fly in the pixel-world layer at 1:1 world px, never in the HD layer", () => {
    const c = new Coins([frame(), frame()]);
    c.burst({ x: 40, y: 150 }, { x: 160, y: 9 }, 500);
    c.spark({ x: 80, y: 120 }, { x: 160, y: 9 });
    expect(c.flyers.children.length).toBeGreaterThan(1);
    expect(c.container.children).toHaveLength(0);
    for (const s of c.flyers.children) expect(s.scale.x).toBe(1);
  });

  it("leave from within 6 world px of the sale, move in whole px, and are gone once landed", () => {
    const c = new Coins([frame()]);
    const rnd = vi.spyOn(Math, "random").mockReturnValue(0.5); // fixed scatter: the bound has no slack
    c.burst({ x: 40, y: 150 }, { x: 160, y: 9 }, 1); // one coin
    c.update(0.001);
    const s = c.flyers.children[0]!;
    expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
    expect(Math.abs(s.x - 40)).toBeLessThanOrEqual(6);
    expect(Math.abs(s.y - 150)).toBeLessThanOrEqual(6);
    c.update(2);
    expect(c.flyers.children).toHaveLength(0);
    rnd.mockRestore();
  });

  it("keep their path in world px when the text size changes (a resize mid-flight)", () => {
    const c = new Coins([frame()]);
    c.spark({ x: 80, y: 120 }, { x: 160, y: 9 });
    c.update(0.25);
    const s = c.flyers.children[0]!;
    const at = { x: s.x, y: s.y };
    c.setTextSize(48);
    c.update(0);
    expect({ x: s.x, y: s.y }).toEqual(at);
  });

  it("keep a floating amount inside the table's span (F9: the seller's sales ran under the left panel)", () => {
    const c = new Coins([frame()]);
    c.setSpan(300, 1600);
    c.floatText({ x: 310, y: 900 }, "+$19.6K");
    c.floatText({ x: 1595, y: 900 }, "+$19.6K");
    c.floatText({ x: 900, y: 900 }, "+$19.6K");
    const [left, right, mid] = c.container.children as unknown as { x: number; y: number; width: number; scale: { x: number } }[];
    for (const t of [left!, right!, mid!]) {
      const w = t.width / t.scale.x; // pop() scales it up from 0.6
      expect(w).toBeGreaterThan(0);
      expect(t.x - w / 2).toBeGreaterThanOrEqual(300);
      expect(t.x + w / 2).toBeLessThanOrEqual(1600);
      expect(t.y).toBe(900);
    }
    expect(mid!.x).toBe(900);
    c.destroy();
  });
});
