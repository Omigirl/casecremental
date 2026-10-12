import { describe, expect, it } from "vitest";
import { CASES } from "../../sim/content/cases";
import type { PatternKind, PatternSpec } from "../../sim/types";
import { hexToRgb, OWN_MOTION, patternColor, renderPattern, type Rgb } from "./patterns";
import { GLITCH_STEPS, glitchStep } from "./patternsRun4";

// The finishes of cases 8–9 (finish spec §7.1), held to the same contract as M3-B's: palette colours or blends of
// two, every kind distinct, each one's own motion moving and closing its loop.

const RUN4: PatternKind[] = ["datamosh", "scanline", "rgbsplit", "melt", "kaleido", "huecycle"];
/** Five unrelated hues, darkest first: a blend of two of them can't pass for a third by accident. */
const PALETTE = ["#05040a", "#2a1450", "#d02870", "#30c8f0", "#fff4c0"];
const RGB = PALETTE.map(hexToRgb);
const spec = (kind: PatternKind, seed = 7, palette: readonly string[] = PALETTE, scale = 4): PatternSpec => ({
  kind,
  palette,
  scale,
  seed,
});

function colors(px: Uint8ClampedArray): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < px.length; i += 4) out.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
  return out;
}

/** One palette colour, or a blend of two: every channel on the line between them, give or take rounding. */
function isBlend(c: readonly number[], pal: readonly Rgb[]): boolean {
  for (const a of pal)
    for (const b of pal) {
      let k = 0;
      for (let i = 1; i < 3; i++) if (Math.abs(b[i]! - a[i]!) > Math.abs(b[k]! - a[k]!)) k = i;
      const span = b[k]! - a[k]!;
      const f = span === 0 ? 0 : (c[k]! - a[k]!) / span;
      if (f < -0.01 || f > 1.01) continue;
      if ([0, 1, 2].every((i) => Math.abs(a[i]! + (b[i]! - a[i]!) * f - c[i]!) <= 1.5)) return true;
    }
  return false;
}

/** Pixels (of 64 × 32) that differ between two phases of a kind's own motion. */
function changed(kind: PatternKind, t0: number, t1: number): number {
  let n = 0;
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) {
      const a = patternColor(spec(kind), RGB, i / 64, j / 32, t0);
      const b = patternColor(spec(kind), RGB, i / 64, j / 32, t1);
      if (a.some((x, k) => x !== b[k])) n++;
    }
  return n;
}

describe("Run 4's finishes", () => {
  it.each(RUN4)("%s paints only palette colours or blends of two, still and moving", (kind) => {
    for (const t of [undefined, 0.3, 0.8])
      for (let j = 0; j < 32; j++)
        for (let i = 0; i < 64; i++) {
          const c = patternColor(spec(kind), RGB, i / 64, j / 32, t);
          expect(isBlend(c, RGB), `${kind} ${c.join()} at t=${t}`).toBe(true);
        }
  });

  it.each(RUN4)("%s uses at least three colours at the in-game size", (kind) => {
    expect(colors(renderPattern(spec(kind), 26, 10)).size).toBeGreaterThanOrEqual(3);
  });

  it("no two kinds paint the same texture", () => {
    const prints = RUN4.map((k) => Array.from(renderPattern(spec(k), 32, 16)).join());
    expect(new Set(prints).size).toBe(RUN4.length);
  });

  it("each kind draws its own motion: Glitch stutters, melt drips, kaleido and huecycle turn", () => {
    expect(Object.fromEntries(RUN4.map((k) => [k, OWN_MOTION[k]]))).toEqual({
      datamosh: "glitch",
      scanline: "glitch",
      rgbsplit: "glitch",
      melt: "drip",
      kaleido: "flow",
      huecycle: "flow",
    });
  });

  it.each(RUN4)("%s moves with its phase and closes its loop", (kind) => {
    expect(changed(kind, 0, 0.5)).toBeGreaterThan(64 * 32 * 0.05);
    expect(changed(kind, 0, 1)).toBe(0);
    expect(changed(kind, 0.25, 1.25)).toBe(0);
  });

  it("the glitch motion holds, then jumps: four steps a loop", () => {
    expect(GLITCH_STEPS).toBe(4);
    expect([0, 0.1, 0.24, 0.25, 0.6, 0.99, 1].map(glitchStep)).toEqual([0, 0, 0, 1, 2, 3, 0]);
    for (const kind of ["datamosh", "scanline", "rgbsplit"] as const) {
      expect(changed(kind, 0.02, 0.2), `${kind} holds within a step`).toBe(0);
      expect(changed(kind, 0.2, 0.3), `${kind} jumps between steps`).toBeGreaterThan(0);
    }
  });

  it("melt runs downward: a row's colours reappear lower a moment later", () => {
    const at = (v: number, t: number) => patternColor(spec("melt"), RGB, 0.37, v, t);
    let same = 0;
    for (let j = 0; j < 20; j++) if (at(j / 32, 0).join() === at(j / 32 + 1 / 32, 1 / 32).join()) same++;
    expect(same).toBeGreaterThanOrEqual(16);
  });

  it("every Run 4 skin that moves on its own draws that motion itself", () => {
    for (const c of CASES.slice(7))
      for (const s of c.skins)
        if (s.motion?.pattern === "glitch" || s.motion?.pattern === "drip") expect(OWN_MOTION[s.pattern.kind], s.id).toBe(s.motion.pattern);
  });
});
