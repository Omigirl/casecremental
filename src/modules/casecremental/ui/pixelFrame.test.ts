import { describe, expect, it } from "vitest";
import { frameCss, stripFrameCss } from "./pixelFrame";

describe("pixel frames", () => {
  it("9-slices the frame art at the pixel scale", () => {
    const css = frameCss("/f.png", 4);
    expect(css.borderImage).toBe('url("/f.png") 6 fill / 24px stretch');
    expect(css.borderWidth).toBe(24);
    expect(css.imageRendering).toBe("pixelated");
  });

  it("falls back to a flat pixel bevel without the art", () => {
    const css = frameCss(null, 2);
    expect(css.borderImage).toBeUndefined();
    expect(css.border).toBe("4px solid #4a3328");
  });

  it("shows one frame of a strip", () => {
    const meta = { id: "case", frames: 4, frameW: 26, frameH: 34, ground: 32, eyes: null };
    expect(stripFrameCss({ meta, url: "/c.png" }, 2, 3)).toMatchObject({
      width: 78,
      height: 102,
      backgroundSize: "312px 102px",
      backgroundPosition: "-156px 0",
    });
    expect(stripFrameCss(undefined, 0, 3)).toBeNull();
  });
});
