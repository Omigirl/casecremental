import { describe, expect, it } from "vitest";
import { CASES } from "../../sim/content/cases";
import type { PatternKind, PatternMotion, PatternSpec, SkinDef, SkinMotion, WeaponMotion } from "../../sim/types";
import { finishAt, frameAt, frameSize, motionFrames, renderSkinFrame, renderSkinFrames, SKIN_H, SKIN_W } from "./motion";
import { hexToRgb, OWN_MOTION, patternColor } from "./patterns";
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

  it.each<PatternMotion>(["flow", "shimmer", "pulse", "sparkle", "rise"])("%s moves the finish but never the outline", (kind) => {
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
      { pattern: "rise" },
      { weapon: "bob" },
      { weapon: "recoil" },
      { weapon: "bolt" },
    ];
    for (const m of kinds) expect(same(renderSkinFrame(moving(m), 1), renderSkinFrame(moving(m), 0))).toBe(true);
    expect(same(renderSkinFrame(moving({ weapon: "flip" }, knife), 1), renderSkinFrame(moving({ weapon: "flip" }, knife), 0))).toBe(true);
  });

  it("keeps the bolt on the receiver in every frame and slides it back and forth", () => {
    const frames = renderSkinFrames(moving({ weapon: "bolt" }));
    const boltXs = frames.map((f) => {
      for (let i = 0; i < f.data.length; i += 4)
        if (f.data[i] === 205 && f.data[i + 1] === 205 && f.data[i + 2] === 215) return (i / 4) % f.w;
      return -1;
    });
    expect(boltXs.every((x) => x >= 0)).toBe(true); // never pops out
    expect(new Set(boltXs).size).toBeGreaterThan(1); // it slides
  });

  it("sweeps the knife shimmer across the screen so it catches the blade in most frames", () => {
    const knifeSkin = CASES[0]!.skins.find((s) => s.rarity === "gold")!;
    const lit = renderSkinFrames(knifeSkin);
    const plain = renderSkinFrames(moving({ weapon: "flip" }, knifeSkin));
    const caught = lit.filter((f, n) => !same(f, plain[n]!)).length;
    expect(caught).toBeGreaterThanOrEqual(5);
  });
});

describe("finishes that draw their own motion", () => {
  const PAL = ["#05040a", "#2a1450", "#d02870", "#30c8f0", "#fff4c0"];
  const RGB = PAL.map(hexToRgb);
  const spec = (kind: PatternKind): PatternSpec => ({ kind, palette: PAL, scale: 4, seed: 7 });
  const points = [0.1, 0.35, 0.6, 0.85].flatMap((u) => [0.2, 0.5, 0.8].map((v) => [u, v] as const));

  it("a finish without its own rise drifts instead, so its loop never pops", () => {
    for (const t of [0, 0.3, 0.7])
      for (const [u, v] of points)
        expect(finishAt(spec("camo"), RGB, "rise", u, v, t)).toEqual(finishAt(spec("camo"), RGB, "flow", u, v, t));
  });

  it("every skin that rises draws its own rise (content guard)", () => {
    for (const c of CASES) for (const s of c.skins) if (s.motion?.pattern === "rise") expect(OWN_MOTION[s.pattern.kind], s.id).toBe("rise");
  });
});
