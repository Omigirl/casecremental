import { describe, expect, it } from "vitest";
import {
  areaDownscale, createImage, eraseEyes, fillRect, hardAlpha, hstack, opaqueBounds,
  outline, ownFrames, placeInCell, posterize, reflowRows,
} from "./ops.mjs";

const px = (img, x, y) => Array.from(img.data.slice((y * img.w + x) * 4, (y * img.w + x) * 4 + 4));

describe("basic ops", () => {
  it("fillRect + opaqueBounds", () => {
    const img = createImage(10, 8);
    expect(opaqueBounds(img)).toBeNull();
    fillRect(img, 2, 3, 4, 2, [255, 0, 0, 255]);
    expect(opaqueBounds(img)).toEqual({ x0: 2, y0: 3, x1: 5, y1: 4 });
  });

  it("areaDownscale averages colour weighted by alpha", () => {
    const img = createImage(4, 4);
    fillRect(img, 0, 0, 2, 2, [200, 0, 0, 255]);
    fillRect(img, 2, 0, 2, 2, [0, 0, 200, 255]);
    const out = areaDownscale(img, 2);
    expect([out.w, out.h]).toEqual([2, 2]);
    expect(px(out, 0, 0)).toEqual([200, 0, 0, 255]);
    expect(px(out, 1, 0)).toEqual([0, 0, 200, 255]);
    expect(px(out, 0, 1)[3]).toBe(0); // empty half stays transparent
  });

  it("hardAlpha and posterize", () => {
    const img = createImage(2, 1);
    fillRect(img, 0, 0, 1, 1, [100, 30, 250, 200]);
    fillRect(img, 1, 0, 1, 1, [10, 10, 10, 90]);
    hardAlpha(img); posterize(img, 48);
    expect(px(img, 0, 0)).toEqual([96, 48, 240, 255]);
    expect(px(img, 1, 0)[3]).toBe(0);
  });

  it("outline adds a 1 px ring around opaque pixels only", () => {
    const img = createImage(5, 5);
    fillRect(img, 2, 2, 1, 1, [255, 255, 255, 255]);
    outline(img, [18, 14, 16]);
    expect(px(img, 1, 2)).toEqual([18, 14, 16, 255]);
    expect(px(img, 2, 1)).toEqual([18, 14, 16, 255]);
    expect(px(img, 1, 1)[3]).toBe(0); // 4-neighbour ring, corners stay empty
    expect(px(img, 2, 2)).toEqual([255, 255, 255, 255]);
  });

  it("hstack places images side by side", () => {
    const a = createImage(2, 3), b = createImage(3, 3);
    fillRect(b, 0, 0, 1, 1, [1, 2, 3, 255]);
    const s = hstack([a, b]);
    expect([s.w, s.h]).toEqual([5, 3]);
    expect(px(s, 2, 0)).toEqual([1, 2, 3, 255]);
  });
});

describe("sheets", () => {
  it("reflowRows puts rows side by side, each on its own ground line", () => {
    const img = createImage(20, 30);
    fillRect(img, 2, 2, 4, 6, [255, 0, 0, 255]);   // row 1, ground y=7
    fillRect(img, 2, 20, 4, 9, [0, 255, 0, 255]);  // row 2, taller, ground y=28
    const out = reflowRows(img, { minRowH: 4 });
    expect([out.w, out.h]).toEqual([40, 9]);
    expect(px(out, 3, 8)).toEqual([255, 0, 0, 255]);  // row 1 bottom sits on the last line
    expect(px(out, 23, 0)).toEqual([0, 255, 0, 255]); // row 2 starts at the top
  });

  it("ownFrames splits n columns, keeping a shape that leans over a boundary whole", () => {
    const img = createImage(40, 10);
    fillRect(img, 2, 2, 6, 6, [255, 0, 0, 255]);
    fillRect(img, 14, 2, 8, 6, [0, 255, 0, 255]); // crosses x=20 a bit, mostly in column 1
    fillRect(img, 32, 2, 4, 6, [0, 0, 255, 255]);
    const frames = ownFrames(img, 3);
    expect(frames.map((f) => f && f.x0)).toEqual([2, 14, 32]);
    expect(frames[1].img.w).toBe(8);
  });

  it("ownFrames returns null for an empty column", () => {
    const img = createImage(30, 10);
    fillRect(img, 2, 2, 5, 5, [255, 0, 0, 255]);
    expect(ownFrames(img, 3).slice(1)).toEqual([null, null]);
  });
});

describe("eyes", () => {
  function robotWithEyes(eyeY1, eyeY2) {
    const img = createImage(20, 20);
    fillRect(img, 2, 2, 16, 16, [96, 96, 144, 255]); // body
    fillRect(img, 5, 4, 10, 5, [0, 16, 32, 255]);    // dark visor
    fillRect(img, 6, eyeY1, 2, 2, [80, 240, 240, 255]);
    fillRect(img, 11, eyeY2, 2, 2, [80, 240, 240, 255]);
    return img;
  }

  it("finds two eyes, levels them, and paints them with the visor colour", () => {
    const img = robotWithEyes(5, 6);
    const r = eraseEyes(img);
    expect(r.eyes.length).toBe(2);
    expect(r.eyes[0][1]).toBe(r.eyes[1][1]);
    expect(r.level).toBeCloseTo(6, 0);
    expect(px(img, 6, 5)).toEqual([0, 16, 32, 255]);
  });

  it("returns null when there are no eyes", () => {
    const img = createImage(10, 10);
    fillRect(img, 1, 1, 8, 8, [96, 96, 144, 255]);
    expect(eraseEyes(img)).toBeNull();
  });

  it("placeInCell anchors the feet centre and keeps the sheet ground line", () => {
    const frame = createImage(6, 10);
    fillRect(frame, 0, 0, 6, 10, [255, 255, 255, 255]);
    const { cell, ox, oy } = placeInCell({ img: frame, x0: 100, y0: 20 }, { cellW: 20, cellH: 16, ground: 14, sheetGround: 29 });
    expect([cell.w, cell.h]).toEqual([20, 16]);
    expect(ox).toBe(8);           // round(cell centre 10 − feet centre 2.5) = 8
    expect(oy).toBe(5);           // y0 20 + (ground 14 − sheetGround 29) = 5
    expect(px(cell, 8, 14)[3]).toBe(255);
    expect(px(cell, 8, 15)[3]).toBe(0);
  });
});
