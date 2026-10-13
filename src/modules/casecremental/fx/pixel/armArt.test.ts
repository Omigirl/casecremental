import { describe, expect, it } from "vitest";
import { ARM_ART, ARM_LAMP, armPixels } from "./armArt";
import { ITEM_SIZE } from "./layout";

const at = (img: ReturnType<typeof armPixels>, x: number, y: number) => [
  ...img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4),
];
const RED = [0xd8, 0x43, 0x3a, 255];
const BRASS = [0xc9, 0xa2, 0x4a, 255];

describe("auto-spin's arm, drawn in code", () => {
  it("is ITEM_SIZE.arm big, a housing with an outline, rivets and the lamp's dark window", () => {
    expect([ARM_ART.w, ARM_ART.h]).toEqual([ITEM_SIZE.arm.w, ITEM_SIZE.arm.h]);
    for (const f of [0, 1, 2] as const) {
      const img = armPixels(f);
      expect([img.w, img.h]).toEqual([ARM_ART.w, ARM_ART.h]);
      expect(at(img, 0, 17)).toEqual([0x12, 0x0e, 0x10, 255]);
      expect(at(img, 2, 15)).toEqual(BRASS);
      expect(at(img, ARM_LAMP.x, ARM_LAMP.y)).toEqual([0x07, 0x08, 0x0c, 255]);
    }
  });

  it("holds its knob up at rest, pulls it down to the left, and swings a brass arm out to the lock", () => {
    const rest = armPixels(0);
    expect(at(rest, 4, 1)).toEqual(RED);
    expect(at(rest, 0, 6)[3]).toBe(0);
    const pulled = armPixels(1);
    expect(at(pulled, 4, 1)[3]).toBe(0);
    expect(at(pulled, 2, 6)).toEqual(RED);
    const turn = armPixels(2);
    expect(at(turn, 1, 6)).toEqual(BRASS);
    expect(at(turn, 4, 1)).toEqual(RED);
  });
});
