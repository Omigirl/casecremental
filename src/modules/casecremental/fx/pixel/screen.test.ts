import { describe, expect, it } from "vitest";
import { canvasResolution, hdFontSize, toScreen, toWorld } from "./screen";

describe("screen ↔ world", () => {
  it("keeps the canvas at a whole device-pixel ratio", () => {
    expect([1, 1.25, 1.5, 2, 2.75, 3, 0].map(canvasResolution)).toEqual([1, 1, 1, 2, 2, 2, 1]);
  });

  it("maps CSS px to whole world px and back", () => {
    expect(toWorld({ scale: 4 }, 123, 47)).toEqual({ x: 30, y: 11 });
    expect(toScreen({ scale: 4 }, 30, 11)).toEqual({ x: 120, y: 44 });
  });

  it("sizes text in multiples of 8 px", () => {
    expect([1, 2, 3, 4, 6, 8].map((s) => hdFontSize(s))).toEqual([8, 8, 8, 16, 24, 32]);
  });
});
