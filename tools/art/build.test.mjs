import { describe, expect, it } from "vitest";
import { buildAsset } from "./build.mjs";
import { createImage, fillRect } from "./ops.mjs";

const G = { posterize: 48, outline: [18, 14, 16] };

/** A synthetic 2×2 sheet of 4 "robots" 40×80 source px (cyan eyes on a dark visor). */
function sheet() {
  const img = createImage(200, 220);
  [
    [10, 10],
    [110, 10],
    [10, 120],
    [110, 120],
  ].forEach(([x, y], i) => {
    const hop = i === 2 ? 10 : 0;
    fillRect(img, x, y + 10 - hop, 40, 80, [96, 96, 144, 255]);
    fillRect(img, x + 6, y + 18 - hop, 28, 16, [0, 16, 32, 255]);
    fillRect(img, x + 10, y + 22 - hop, 6, 6, [80, 240, 240, 255]);
    fillRect(img, x + 24, y + 22 - hop, 6, 6, [80, 240, 240, 255]);
  });
  return img;
}

describe("buildAsset", () => {
  it("turns a 2×2 character sheet into 4 aligned 48 px frames with level eyes", () => {
    const { strip, meta } = buildAsset(
      { id: "t", source: "x.png", kind: "sheet", frames: 4, rows: 2, targetH: 48, eyes: true },
      sheet(),
      G,
    );
    expect(meta.frames).toBe(4);
    expect(strip.w).toBe(meta.frameW * 4);
    expect(strip.h).toBe(meta.frameH);
    expect(meta.eyes).toHaveLength(4);
    for (const e of meta.eyes) {
      expect(e).toHaveLength(2);
      expect(e[0][1]).toBe(e[1][1]);
    }
    // the hop frame (index 2) sits higher than the others
    expect(meta.eyes[2][0][1]).toBeLessThan(meta.eyes[0][0][1]);
  });

  it("builds a static asset to its target width with no eyes", () => {
    const img = createImage(400, 100);
    fillRect(img, 0, 0, 400, 100, [120, 80, 40, 255]);
    const { strip, meta } = buildAsset({ id: "table", source: "t.png", kind: "static", targetW: 200, outline: false }, img, G);
    expect([strip.w, strip.h]).toEqual([200, 50]);
    expect(meta.eyes).toBeNull();
    expect(meta.frames).toBe(1);
  });

  it("gives wide props (a case box) a cell wide enough that no frame is clipped", () => {
    const img = createImage(400, 60);
    for (let i = 0; i < 4; i++) fillRect(img, 10 + i * 100, 10, 80, 40, [140, 90, 40, 255]);
    const { strip, meta } = buildAsset({ id: "case", source: "c.png", kind: "sheet", frames: 4, targetH: 10 }, img, G);
    const cols = [];
    for (let x = 0; x < meta.frameW; x++) {
      let any = false;
      for (let y = 0; y < strip.h; y++) if (strip.data[(y * strip.w + x) * 4 + 3]) any = true;
      cols.push(any);
    }
    // ~20 px box + outline, and the cell's edge columns stay empty (nothing cut off)
    expect(cols.filter(Boolean).length).toBeGreaterThanOrEqual(22);
    expect(cols[0]).toBe(false);
    expect(cols[meta.frameW - 1]).toBe(false);
  });
});
