import { describe, expect, it } from "vitest";
import { eyeRects, visorPatch } from "./eyes";

describe("code eyes", () => {
  it("draws a 5×5 visor patch centred on the eye", () => {
    expect(visorPatch(10, 20)).toEqual({ x: 8, y: 18, w: 5, h: 5 });
  });

  it("has four states", () => {
    expect(eyeRects("open", 10, 20)).toEqual([{ x: 9, y: 19, w: 2, h: 3 }]);
    expect(eyeRects("half", 10, 20)).toEqual([{ x: 9, y: 20, w: 2, h: 2 }]);
    expect(eyeRects("closed", 10, 20)).toEqual([{ x: 9, y: 21, w: 3, h: 1 }]);
    expect(eyeRects("happy", 10, 20)).toHaveLength(3);
  });
});
