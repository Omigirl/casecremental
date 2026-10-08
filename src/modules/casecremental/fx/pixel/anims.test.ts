import { describe, expect, it } from "vitest";
import manifest from "../../../../../art/manifest.json";
import { ANIM_SPRITE, ANIMS, loopLength, type AnimId } from "./anims";

const framesOf = (sprite: string): number => {
  const ids = sprite.endsWith("*") ? manifest.assets.filter((a) => a.id.startsWith(sprite.slice(0, -1))) : manifest.assets.filter((a) => a.id === sprite);
  expect(ids.length, sprite).toBeGreaterThan(0);
  return Math.min(...ids.map((a) => ("frames" in a && a.frames ? a.frames : 1)));
};

describe("prop animations", () => {
  it.each(Object.keys(ANIMS) as AnimId[])("%s only uses frames its sheet has", (id) => {
    const n = framesOf(ANIM_SPRITE[id]);
    for (const k of ANIMS[id]) expect(k.frame).toBeLessThan(n);
  });

  it("gives every idle loop its own length, so nothing moves in sync", () => {
    const idles: AnimId[] = ["caseIdle", "caseOpenIdle", "keyIdle", "binIdle", "botSleep", "lampSway"];
    const lengths = idles.map((id) => loopLength(ANIMS[id]));
    expect(new Set(lengths).size).toBe(lengths.length);
  });

  it("moves only by whole pixels, at most 9 px", () => {
    for (const keys of Object.values(ANIMS))
      for (const k of keys as readonly { dx?: number; dy?: number }[])
        for (const v of [k.dx ?? 0, k.dy ?? 0]) {
          expect(Number.isInteger(v)).toBe(true);
          expect(Math.abs(v)).toBeLessThanOrEqual(9);
        }
  });
});
