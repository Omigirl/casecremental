import { describe, expect, it } from "vitest";
import { pixelViewport } from "./viewport";

describe("pixelViewport", () => {
  it.each([
    [1920, 1080, 6, 320, 180],
    [1280, 720, 4, 320, 180],
    [3440, 1440, 8, 430, 180],
    [800, 450, 2, 400, 225],
    [1366, 768, 4, 342, 192],
  ])("landscape %i×%i → scale %i, world %i×%i", (w, h, scale, ww, wh) => {
    expect(pixelViewport(w, h)).toMatchObject({ scale, worldW: ww, worldH: wh, portrait: false });
  });

  it.each([
    [390, 844, 2, 195, 253],
    [820, 1180, 4, 205, 177],
  ])("portrait %i×%i → scale %i, world %i×%i (top 60 %%)", (w, h, scale, ww, wh) => {
    expect(pixelViewport(w, h)).toMatchObject({ scale, worldW: ww, worldH: wh, portrait: true });
  });

  it("never goes below scale 1", () => {
    expect(pixelViewport(300, 120).scale).toBe(1);
  });
});
