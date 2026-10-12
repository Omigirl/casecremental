import { describe, expect, it } from "vitest";
import { CASES } from "../../sim/content/cases";
import type { PatternKind, PatternSpec } from "../../sim/types";
import { hexToRgb, renderPattern } from "./patterns";

const KINDS: PatternKind[] = ["camo", "digital", "tiger", "leaves", "bark", "moss", "marble", "granite", "crystal", "lava"];
const PALETTE = ["#101010", "#808080", "#f0f0f0", "#ff0000"];
const spec = (kind: PatternKind, seed = 1): PatternSpec => ({ kind, palette: PALETTE, scale: 4, seed });

function colors(px: Uint8ClampedArray): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < px.length; i += 4) out.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
  return out;
}

describe("patterns", () => {
  it("hexToRgb parses #rrggbb", () => {
    expect(hexToRgb("#ff8000")).toEqual([255, 128, 0]);
  });

  it("renders opaque RGBA of the requested size", () => {
    const px = renderPattern(spec("camo"), 64, 32);
    expect(px).toHaveLength(64 * 32 * 4);
    for (let i = 3; i < px.length; i += 4) expect(px[i]).toBe(255);
  });

  it.each(KINDS)("%s is deterministic and not a flat color", (kind) => {
    const a = renderPattern(spec(kind), 64, 32);
    expect(renderPattern(spec(kind), 64, 32)).toEqual(a);
    expect(colors(a).size).toBeGreaterThanOrEqual(2);
  });

  it.each(["camo", "digital", "tiger", "leaves", "granite", "crystal"] as PatternKind[])("%s uses only palette colors", (kind) => {
    const allowed = new Set(PALETTE.map((h) => hexToRgb(h).join(",")));
    for (const c of colors(renderPattern(spec(kind), 64, 32))) expect(allowed).toContain(c);
  });

  it("changes with the seed", () => {
    expect(renderPattern(spec("camo", 1), 32, 16)).not.toEqual(renderPattern(spec("camo", 2), 32, 16));
  });

  it("paints cases 1-3 exactly as before cases 4-7 arrived", () => {
    // FNV-1a over every pixel of every skin of the first three cases at the in-game size, pinned before the
    // pattern code was split: any change to those finishes shows up here.
    let h = 0x811c9dc5;
    for (const c of CASES.filter((x) => ["bootcamp", "wildwood", "bedrock"].includes(x.id)))
      for (const s of c.skins) for (const b of renderPattern(s.pattern, 26, 10)) h = Math.imul(h ^ b, 16777619) >>> 0;
    expect(h).toBe(2021169458);
  });

  it("renders every skin of every case", () => {
    for (const c of CASES) for (const s of c.skins) expect(() => renderPattern(s.pattern, 40, 16)).not.toThrow();
  });
});
