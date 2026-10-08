import { describe, expect, it } from "vitest";
import { REEL_FRAME, reelFramePixels } from "./drawn";

const at = (img: ReturnType<typeof reelFramePixels>, x: number, y: number) => [
  ...img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4),
];

describe("code-drawn reel frame", () => {
  it("is a 9-slice square: outline, metal border, brass corner rivets, black window", () => {
    const img = reelFramePixels();
    expect([img.w, img.h]).toEqual([REEL_FRAME.size, REEL_FRAME.size]);
    expect(at(img, 0, 0)).toEqual([0x12, 0x0e, 0x10, 255]); // outline
    expect(at(img, 2, 2)).toEqual([0xc9, 0xa2, 0x4a, 255]); // rivet, top-left
    expect(at(img, img.w - 3, img.h - 3)).toEqual([0xc9, 0xa2, 0x4a, 255]); // rivet, bottom-right
    expect(at(img, Math.floor(img.w / 2), 2)[3]).toBe(255); // metal border, opaque
    expect(at(img, Math.floor(img.w / 2), Math.floor(img.h / 2))).toEqual([0x07, 0x08, 0x0c, 255]); // the window
  });

  it("keeps the corners within the 9-slice border so they never stretch", () => {
    expect(REEL_FRAME.border * 2).toBeLessThan(REEL_FRAME.size);
  });
});
