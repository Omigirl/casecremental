import { describe, expect, it } from "vitest";
import type { PatternKind, PatternSpec } from "../../sim/types";
import { hexToRgb, OWN_MOTION, patternColor, renderPattern, type Rgb } from "./patterns";

// The finishes of cases 4–7 (spec: M3 §3). Every kind is checked for the same contract as cases 1–3 plus
// what makes it richer; the kind-specific tests sit below.

const LATE: PatternKind[] = ["circuit", "hex", "carbon", "synthgrid", "neonline", "hueflow"];
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

describe("the finishes of cases 4-7", () => {
  it.each(LATE)("%s is deterministic, seeded and richer than a flat fill", (kind) => {
    const a = renderPattern(spec(kind), 64, 32);
    expect(renderPattern(spec(kind), 64, 32)).toEqual(a);
    expect(colors(a).size).toBeGreaterThanOrEqual(4);
    expect(renderPattern(spec(kind, 8), 64, 32)).not.toEqual(a);
  });

  it.each(LATE)("%s still shows at least 3 colours at the in-game size (26 x 10)", (kind) => {
    expect(colors(renderPattern(spec(kind), 26, 10)).size).toBeGreaterThanOrEqual(3);
  });

  it.each(LATE)("%s paints only palette colours and blends of two of them, still and moving", (kind) => {
    for (const t of [undefined, 0.25, 0.6])
      for (let j = 0; j < 32; j++)
        for (let i = 0; i < 64; i++) {
          const c = patternColor(spec(kind), RGB, i / 64, j / 32, t);
          expect(isBlend(c, RGB), `${kind} t=${t} (${i},${j}) = ${c.join(",")}`).toBe(true);
        }
  });

  it.each(LATE)("%s takes a one-colour palette, a two-colour one and points pushed off the texture", (kind) => {
    const one = hexToRgb("#336699");
    const two = ["#000000", "#ffffff"].map(hexToRgb);
    for (const [u, v] of [
      [0, 0],
      [0.5, 0.5],
      [-0.1, 1.1],
      [1.08, -0.08],
    ] as const) {
      expect(patternColor(spec(kind, 7, ["#336699"]), [one], u, v)).toEqual(one);
      for (const ch of patternColor(spec(kind, 7, ["#000000", "#ffffff"]), two, u, v, 0.3)) {
        expect(Number.isInteger(ch)).toBe(true);
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(255);
      }
    }
  });

  it.each(Object.keys(OWN_MOTION) as PatternKind[])("%s's own motion moves and has no seam: phase 1 paints phase 0", (kind) => {
    expect(changed(kind, 0, 1 / 16)).toBeGreaterThan(0);
    // patternColor does not wrap the phase itself, so this holds only if the motion really is periodic
    expect(changed(kind, 0, 1)).toBe(0);
  });
});

const d2 = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
/** Index of the palette colour nearest to c. */
const nearest = (c: Rgb) => RGB.reduce((best, p, i) => (d2(c, p) < d2(c, RGB[best]!) ? i : best), 0);
const lum = (c: Rgb) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const same = (a: Rgb, b: Rgb) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
/** Every pixel of a 64 × 32 render as [u, v, colour]. */
function pixels(kind: PatternKind, t?: number, seed = 7): [number, number, Rgb][] {
  const out: [number, number, Rgb][] = [];
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++) out.push([i / 64, j / 32, patternColor(spec(kind, seed), RGB, i / 64, j / 32, t)]);
  return out;
}
/** Share of pixels whose nearest palette colour is one of `idx`. */
const share = (px: [number, number, Rgb][], idx: number[]) => px.filter(([, , c]) => idx.includes(nearest(c))).length / px.length;
/** Mean brightness of the rows with v in [from, to). */
const band = (px: [number, number, Rgb][], from: number, to: number) => {
  const rows = px.filter(([, v]) => v >= from && v < to);
  return rows.reduce((s, [, , c]) => s + lum(c), 0) / rows.length;
};

describe("Mainframe", () => {
  it.each<PatternKind>(["circuit", "hex"])("%s's pulse lights the traces or cells and leaves the dark board dark", (kind) => {
    const still = pixels(kind);
    let moved = 0;
    for (const t of [0, 0.25, 0.5, 0.75]) {
      const lit = pixels(kind, t);
      still.forEach(([, , c], n) => {
        if (same(c, RGB[0]!)) expect(lit[n]![2]).toEqual(RGB[0]);
        else if (!same(c, lit[n]![2])) moved++;
      });
    }
    expect(moved).toBeGreaterThan(0);
  });

  it("circuit is mostly bare board with traces on it", () => {
    for (const seed of [7, 8, 9]) expect(share(pixels("circuit", undefined, seed), [0, 1])).toBeGreaterThan(0.5);
  });

  it("carbon is a ramp: every colour sits between two neighbouring palette colours", () => {
    for (const [, , c] of pixels("carbon")) {
      const ok = RGB.slice(1).some((b, i) => {
        const a = RGB[i]!;
        return isBlend(c, [a, b]);
      });
      expect(ok, c.join(",")).toBe(true);
    }
  });
});

describe("Neon Nights", () => {
  it("synthgrid: dark sky on top, and its flow rolls the grid in while the sky above the sun stays", () => {
    const still = pixels("synthgrid");
    expect(band(still, 0, 0.1)).toBeLessThan(band(still, 0.4, 0.7));
    const later = pixels("synthgrid", 0.5);
    still.forEach(([, v, c], n) => {
      if (v < 0.05) expect(later[n]![2]).toEqual(c);
    });
    expect(later.some(([, v, c], n) => v > 0.75 && !same(c, still[n]![2]))).toBe(true);
  });

  it("neonline: tubes on black - most of the texture stays near the darkest colours", () => {
    for (const seed of [7, 8, 9]) expect(share(pixels("neonline", undefined, seed), [0, 1])).toBeGreaterThan(0.5);
  });

  it("hueflow goes all the way round the palette", () => {
    const px = [7, 8, 9].flatMap((seed) => pixels("hueflow", undefined, seed));
    for (let i = 0; i < RGB.length; i++) expect(share(px, [i]), `colour ${i}`).toBeGreaterThan(0.02);
  });
});
