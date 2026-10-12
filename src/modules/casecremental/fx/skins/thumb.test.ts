import { describe, expect, it } from "vitest";
import { fallbackBase, type PixelImage } from "./pixelSkin";
import { fitArt, shrinkImage } from "./thumb";

// Skin art shrunk for short reels and tray slots: an area average with crisp edges, never nearest-neighbour noise.

const img = (w: number, h: number, px: number[][]): PixelImage => ({ w, h, data: new Uint8ClampedArray(px.flat()) });
const T = [0, 0, 0, 0];
const OUT = [18, 14, 16, 255];

describe("fitArt", () => {
  it("keeps art that fits, and shrinks the rest to the box keeping its shape", () => {
    expect(fitArt(26, 10, { w: 28, h: 18 })).toEqual({ w: 26, h: 10 }); // the 26-px reel: full art, as before
    expect(fitArt(26, 10, { w: 22, h: 8 })).toEqual({ w: 20, h: 8 }); // ×5 tall, desktop
    expect(fitArt(26, 10, { w: 22, h: 6 })).toEqual({ w: 15, h: 6 }); // ×5 tall, portrait
    expect(fitArt(26, 10, { w: 8, h: 5 })).toEqual({ w: 8, h: 3 }); // a tray slot (10×7)
    expect(fitArt(30, 14, { w: 28, h: 11 })).toEqual({ w: 23, h: 11 }); // an animated skin's frame in a 15-px reel
  });

  it("never shrinks to nothing", () => {
    expect(fitArt(26, 10, { w: 1, h: 1 })).toEqual({ w: 1, h: 1 });
  });
});

describe("shrinkImage", () => {
  it("makes a w×h image", () => {
    const out = shrinkImage(fallbackBase("rifle"), 13, 5);
    expect([out.w, out.h, out.data.length]).toEqual([13, 5, 13 * 5 * 4]);
  });

  it("averages the area a new pixel covers, solid when at least a third of it is drawn", () => {
    expect(
      Array.from(
        shrinkImage(
          img(2, 2, [
            [200, 100, 0, 255],
            [100, 50, 0, 255],
            [200, 100, 0, 255],
            [100, 50, 0, 255],
          ]),
          1,
          1,
        ).data,
      ),
    ).toEqual([150, 75, 0, 255]);
    expect(shrinkImage(img(2, 2, [[200, 100, 0, 255], T, T, T]), 1, 1).data[3]).toBe(0); // a quarter: empty
    expect(shrinkImage(img(2, 2, [[200, 100, 0, 255], [200, 100, 0, 255], T, T]), 1, 1).data[3]).toBe(255); // a half: solid
  });

  it("takes its colour from the coloured pixels, the dark outline only where nothing else is", () => {
    expect(Array.from(shrinkImage(img(2, 2, [OUT, [200, 100, 0, 255], [100, 50, 0, 255], T]), 1, 1).data)).toEqual([150, 75, 0, 255]);
    expect(Array.from(shrinkImage(img(2, 2, [OUT, OUT, T, T]), 1, 1).data)).toEqual(OUT);
  });

  it("keeps edges crisp (every pixel solid or empty) and a weapon still reads at half size", () => {
    const out = shrinkImage(fallbackBase("rifle"), 13, 5);
    let solid = 0;
    for (let i = 3; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i]);
      if (out.data[i]) solid++;
    }
    expect(solid).toBeGreaterThanOrEqual(20);
  });
});
