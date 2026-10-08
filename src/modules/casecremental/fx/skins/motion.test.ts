import { describe, expect, it } from "vitest";
import { CASES } from "../../sim/content/cases";
import type { PatternMotion, SkinDef, SkinMotion, WeaponMotion } from "../../sim/types";
import { frameAt, frameSize, motionFrames, renderSkinFrame, renderSkinFrames, SKIN_H, SKIN_W } from "./motion";
import type { PixelImage } from "./pixelSkin";

const rifle = CASES[0]!.skins.find((s) => s.weapon === "rifle")!;
const knife = CASES[0]!.skins.find((s) => s.weapon === "knife")!;
const moving = (motion: SkinMotion, base: SkinDef = rifle): SkinDef => ({ ...base, id: `${base.id}-m`, motion });
const same = (a: PixelImage, b: PixelImage) => a.w === b.w && a.h === b.h && a.data.every((v, i) => v === b.data[i]);
const isOutline = (img: PixelImage, i: number) =>
  img.data[i] === 18 && img.data[i + 1] === 14 && img.data[i + 2] === 16 && img.data[i + 3] === 255;

describe("loop timing", () => {
  it("picks the frame by elapsed time and never divides by an empty loop", () => {
    expect(frameAt(0, 8, 8)).toBe(0);
    expect(frameAt(125, 8, 8)).toBe(1);
    expect(frameAt(1000, 8, 8)).toBe(0);
    expect(frameAt(999, 8, 1)).toBe(0);
    expect(frameAt(-50, 8, 8)).toBe(0);
  });

  it("a still skin is one frame; a moving one defaults to 8", () => {
    expect(motionFrames({ ...rifle, motion: undefined })).toBe(1);
    expect(motionFrames(moving({ pattern: "pulse" }))).toBe(8);
    expect(motionFrames(moving({ pattern: "pulse", frames: 6 }))).toBe(6);
  });
});

describe("renderSkinFrames", () => {
  it("bakes every frame at one size: the plain box, a margin for a moving weapon, a square for a flip", () => {
    for (const f of renderSkinFrames(moving({ pattern: "shimmer" }))) expect([f.w, f.h]).toEqual([SKIN_W, SKIN_H]);
    const bob = renderSkinFrames(moving({ pattern: "shimmer", weapon: "bob", frames: 6 }));
    expect(bob).toHaveLength(6);
    for (const f of bob) expect([f.w, f.h]).toEqual([SKIN_W + 4, SKIN_H + 4]);
    const flip = frameSize({ weapon: "flip" });
    expect(flip.w).toBe(flip.h);
    // a spinning knife is drawn smaller so its square fits a card (reveal card inside: 40 × 26)
    for (const f of renderSkinFrames(moving({ pattern: "shimmer", weapon: "flip" }, knife))) {
      expect(f.w).toBe(f.h);
      expect(f.h).toBeLessThanOrEqual(26);
    }
  });

  it.each<PatternMotion>(["flow", "shimmer", "pulse", "sparkle"])("%s moves the finish but never the outline", (kind) => {
    const frames = renderSkinFrames(moving({ pattern: kind }));
    expect(frames.some((f) => !same(f, frames[0]!))).toBe(true);
    for (let i = 0; i < frames[0]!.data.length; i += 4) {
      if (!isOutline(frames[0]!, i)) continue;
      for (const f of frames) expect(isOutline(f, i)).toBe(true);
    }
  });

  it.each<[WeaponMotion, SkinDef]>([
    ["bob", rifle],
    ["recoil", rifle],
    ["bolt", rifle],
    ["flip", knife],
  ])("%s moves the weapon", (kind, base) => {
    const frames = renderSkinFrames(moving({ weapon: kind }, base));
    expect(frames.some((f) => !same(f, frames[0]!))).toBe(true);
  });

  it("closes every loop: phase 1 draws exactly phase 0", () => {
    const kinds: SkinMotion[] = [
      { pattern: "flow" },
      { pattern: "shimmer" },
      { pattern: "pulse" },
      { pattern: "sparkle" },
      { weapon: "bob" },
      { weapon: "recoil" },
      { weapon: "bolt" },
    ];
    for (const m of kinds) expect(same(renderSkinFrame(moving(m), 1), renderSkinFrame(moving(m), 0))).toBe(true);
    expect(same(renderSkinFrame(moving({ weapon: "flip" }, knife), 1), renderSkinFrame(moving({ weapon: "flip" }, knife), 0))).toBe(true);
  });
});
