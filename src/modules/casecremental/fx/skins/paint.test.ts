import { describe, expect, it } from "vitest";
import { at, cycle, fract, hexToRgb, mix, ramp, smoothstep, tail, type Rgb } from "./paint";

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];
const RED: Rgb = [255, 0, 0];

describe("paint kit", () => {
  it("hexToRgb parses #rrggbb", () => {
    expect(hexToRgb("#ff8000")).toEqual([255, 128, 0]);
  });

  it("mix blends to whole channels and clamps its factor", () => {
    expect(mix(BLACK, WHITE, 0.5)).toEqual([128, 128, 128]);
    expect(mix(BLACK, WHITE, -1)).toEqual(BLACK);
    expect(mix(BLACK, WHITE, 2)).toEqual(WHITE);
  });

  it("ramp walks the palette end to end; cycle wraps the last colour back into the first", () => {
    const pal = [BLACK, RED, WHITE];
    expect(ramp(pal, 0)).toEqual(BLACK);
    expect(ramp(pal, 0.5)).toEqual(RED);
    expect(ramp(pal, 1)).toEqual(WHITE);
    expect(ramp([RED], 0.7)).toEqual(RED);
    expect(cycle(pal, 0)).toEqual(BLACK);
    expect(cycle(pal, 1 / 3)).toEqual(RED);
    expect(cycle([BLACK, RED, WHITE, WHITE], 0.875)).toEqual(mix(WHITE, BLACK, 0.5));
    expect(cycle(pal, 1.25)).toEqual(cycle(pal, 0.25));
    expect(cycle(pal, -0.75)).toEqual(cycle(pal, 0.25));
  });

  it("at and tail never read past a short palette", () => {
    expect(at([RED], 3)).toEqual(RED);
    expect(at([BLACK, RED], -1)).toEqual(BLACK);
    expect(tail([BLACK, RED, WHITE], 1)).toEqual([RED, WHITE]);
    expect(tail([BLACK, RED], 5)).toEqual([RED]);
  });

  it("smoothstep and fract", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(fract(2.25)).toBe(0.25);
    expect(fract(-0.25)).toBe(0.75);
  });
});
