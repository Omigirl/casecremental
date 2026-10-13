# Casecremental M3-B — Skin patterns for cases 4–7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thirteen new procedural finishes (`circuit hex carbon synthgrid neonline hueflow starfield nebula aurora
iridescent flame ember molten`) and the `rise` pattern motion, each a richer technique than cases 1–3, ready for the
case data of Plan M3-A.

**Architecture:** The shared colour helpers move out of `fx/skins/patterns.ts` into a small paint kit
(`fx/skins/paint.ts`); the thirteen finishes live in a new `fx/skins/patternsLate.ts` and `patterns.ts` dispatches to
them from its exhaustive `switch`. `patternColor` gains an optional loop phase: a kind listed in `OWN_MOTION` animates
itself for one motion (the circuit's current wave, the synthwave grid rolling in, flames rising), and `finishAt`
(fx/skins/motion.ts) then lays nothing generic on top. Seamless rising comes from noise that repeats along y
(`period` in `fx/skins/noise.ts`).

**Tech Stack:** TypeScript (strict), Vitest, PixiJS 8 (untouched here). Commands: `npm run typecheck`,
`npx vitest run src/modules/casecremental`, `npm run build`. The pre-commit hook formats staged code with Prettier.

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-m3-runs-2-3-design.md` §3 (pattern techniques and motion
only), on top of `docs/superpowers/specs/2026-10-08-casecremental-animated-skins-design.md`. Runs **before** Plan M3-A
(`docs/superpowers/plans/2026-10-12-casecremental-m3-a-sim.md`), whose Task 3 adds the case data that uses these kinds.

## Global Constraints

- A finish is a pure, deterministic function of `(spec, palette, u, v[, phase])`: no `Math.random`, no `Date`, no
  shaders, no DOM. Same input, same pixels.
- Palettes are `'#rrggbb'` strings, **darkest first**. Every pixel a new kind paints is one palette colour or a blend
  of two (the glow look is bright palette colours on dark ones with a soft falloff).
- Cases 1–3 keep their exact pixels: the FNV-1a checksum of their 39 skins at 26 × 10 is `2021169458` (Task 1 pins it).
- A skin without `motion` still renders exactly as before; motion loops close (frame `n` at `t = n / frames`).
- Pattern motions after this plan: `flow`, `shimmer`, `pulse`, `sparkle`, `rise`. `rise` = the pattern scrolls upward
  one texture height per loop, seamless at the loop point.
- The skin is drawn **26 × 10 px** in the game (a spinning knife 20 × 8); the new kinds are tuned for that size at
  scales 4–8 (Plan M3-A's range). Thin lines stay at least one game pixel wide.
- The sim never reads `pattern` or `motion` beyond the types; only `sim/types.ts` changes under `sim/`.
- A file that grows past ~400 lines with a new responsibility gets split.
- Each task ends with `npm run typecheck`, `npx vitest run src/modules/casecremental` and `npm run build` green.
  (`*.test.ts` files are excluded from the typecheck; Vitest runs them.)
- Other agents may commit asset files on this branch in parallel: stage only your own files by explicit path (never
  `git add -A`, `git add .` or `commit -a`); on an `index.lock` error wait a few seconds and retry.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```

## Review Focus

1. **Motion pushes sample points off the texture** (`flow` drifts u, v by ±0.08; a flipping knife samples its local
   space; `rise` adds the phase to v) → every kind still returns whole channels in 0–255, never `NaN`. (A first draft
   of `synthgrid` returned `NaN` above the texture.) Pinned in Tasks 2–5: "takes a one-colour palette, a two-colour one
   and points pushed off the texture".
2. **A short or odd palette in the case data** (Plan M3-A uses 4 colours; a typo could give 1–3) → no crash, no
   `undefined` colour; roles collapse onto the colours there are, and a one-colour palette paints that colour. Pinned
   in the same test (Tasks 2–5).
3. **The loop's seam** — the frame after the last must continue into the first → for every kind in `OWN_MOTION`,
   `patternColor` at phase 1 paints exactly phase 0 (`patternColor` does not wrap the phase, so only a truly periodic
   motion passes). Pinned in Tasks 2–5 ("own motion moves and has no seam"), molten's exact scroll in Task 5.
4. **Players' existing skins change** after the paint-kit split → cases 1–3 checksum pinned before the refactor (Task 1).
5. **Case data asks for a motion its kind does not draw** (`rise` on a non-fire kind, `pulse` on `carbon`) → the loop
   still never pops: a generic `rise` falls back to the closed drift, a generic `pulse` breathes as before; and a content
   guard fails any skin in `CASES` that `rise`s on a kind without its own rise. Pinned in Task 1.

---

## File Structure

- Create `src/modules/casecremental/fx/skins/paint.ts` — the paint kit: `Rgb`, `hexToRgb`, `clamp01`, `spread`,
  `smoothstep`, `fract`, `tail`, `at`, `pick`, `mix`, `ramp`, `cycle`, `PatternPoint`. Pure.
- Create `src/modules/casecremental/fx/skins/paint.test.ts`.
- Create `src/modules/casecremental/fx/skins/patternsLate.ts` — `OWN_MOTION` and the thirteen finishes (~310 lines).
- Create `src/modules/casecremental/fx/skins/patternsLate.test.ts`.
- Create `tools/skins/preview.test.mjs` — dev-only PNG contact sheets into `art/preview/patterns/` (gitignored),
  skipped unless `SKIN_PREVIEW` is set.
- Modify `src/modules/casecremental/sim/types.ts` — `PatternKind` (+13), `PatternMotion` (+`rise`).
- Modify `src/modules/casecremental/fx/skins/noise.ts` (+ test) — optional `period` along y; `wrapRow`.
- Modify `src/modules/casecremental/fx/skins/patterns.ts` (+ test) — helpers come from `paint.ts` (re-exports
  `hexToRgb`, `Rgb`, `OWN_MOTION`), optional `phase`, dispatch to the new kinds.
- Modify `src/modules/casecremental/fx/skins/motion.ts` (+ test) — `finishAt`: own motions, `rise`.
- Modify `docs/feature-history/casecremental-look.md` — one bullet.

## What the case data may rely on (for Plan M3-A)

Roles by palette index (darkest first; `last` = the last colour). Any length ≥ 1 works; 4–6 colours are intended.

| Kind | Technique | Roles | Own motion |
|---|---|---|---|
| `circuit` | PCB trace network on a lattice, pads + vias, ground pour | 0 board, 1 ground pour, 2 trace, 3 pad, last lit | `pulse`: a current wave runs along the traces |
| `hex` | honeycomb, bevelled cells, ~1 in 5 lit | 0 seam, 1–2 cell, second-to-last dimmed light, last light | `pulse`: each lit cell breathes at its own moment |
| `carbon` | 2/2 twill weave + clear-coat streak | ramp, dark → bright | — |
| `synthgrid` | perspective grid, striped sun | 0 night, 1 sky at horizon, 2 grid + sun's foot, 3 horizon glow, last sun top | `flow`: grid rolls in, stripes slide |
| `neonline` | even-width noise contours as tubes, halo + core | 0 black, 1 halo, 2 … second-to-last tubes, last core tint | — |
| `hueflow` | twice domain-warped noise through the palette as a wheel | a wheel: order matters, darkness does not | `flow`: one full turn of the wheel |
| `starfield` | three depths of stars over a dust lane | 0 space, 1 dust, 2 far star, second-to-last mid star, last near star | — |
| `nebula` | domain-warped gas + stars in thin gas | 0 … second-to-last gas (thin → dense), last stars | — |
| `aurora` | ray curtains from a wavy lower edge | ramp, dark → bright | `flow`: curtains sway, rays drift |
| `iridescent` | thin-film bands with bare-metal pools | 0 metal, 1 … last film bands (cycled) | — |
| `flame` | warped fbm tongues over a bottom heat | ramp, dark → bright | `rise`: flames climb, heat stays |
| `ember` | flickering glowing specks on char flakes | 0–1 char, 2 glow, 3 … last hotter | `rise`: specks drift up |
| `molten` | glowing ridge-cracks of warped noise on crust | 0–1 crust, 2 glow, 3 … last hotter | `rise`: the flow creeps up |

- `rise` is drawn only by `flame`, `ember`, `molten`; on any other kind it falls back to the `flow` drift, and the
  content guard in `motion.test.ts` fails a skin in `CASES` that asks for it. `flow` on `molten`, `nebula`, `neonline`
  etc. is the generic closed drift; `shimmer` and `sparkle` are generic for every kind.
- Frames: the default 8 is fine; `frames: 10` makes a rising skin scroll exactly one pixel per frame on a 10 px skin.
- Every palette of Plan M3-A Task 3's tables (all 52 skins + the two vault legends) was rendered at 26 × 10 with this
  plan's code and reads as intended; no palette there needs to change.

---

### Task 1: Paint kit, repeating noise, the phase and `rise`

**Files:**
- Create: `src/modules/casecremental/fx/skins/paint.ts`, `src/modules/casecremental/fx/skins/paint.test.ts`,
  `src/modules/casecremental/fx/skins/patternsLate.ts`
- Modify: `src/modules/casecremental/sim/types.ts`, `src/modules/casecremental/fx/skins/noise.ts`,
  `src/modules/casecremental/fx/skins/noise.test.ts`, `src/modules/casecremental/fx/skins/patterns.ts`,
  `src/modules/casecremental/fx/skins/patterns.test.ts`, `src/modules/casecremental/fx/skins/motion.ts`,
  `src/modules/casecremental/fx/skins/motion.test.ts`

**Interfaces:**
- Consumes: today's `fx/skins/patterns.ts` (`patternColor`, `renderPattern`, `hexToRgb`, `Rgb`), `fx/skins/noise.ts`
  (`hash2`, `valueNoise`, `fbm`, `voronoi`), `fx/skins/motion.ts` (`finishAt(spec, pal, kind, u, v, t, sweep?)`).
- Produces:
  - `sim/types.ts`: `PatternMotion = "flow" | "shimmer" | "pulse" | "sparkle" | "rise"`.
  - `paint.ts`: `type Rgb`, `hexToRgb(hex): Rgb`, `clamp01(t)`, `spread(n)`, `smoothstep(a, b, t)`, `fract(t)`,
    `tail(pal, i): readonly Rgb[]`, `at(pal, i): Rgb`, `pick(pal, t): Rgb`, `mix(a, b, f): Rgb`, `ramp(pal, t): Rgb`,
    `cycle(pal, t): Rgb`, `interface PatternPoint { u; v; x; y; scale; seed }`.
  - `noise.ts`: `wrapRow(y, period?)`, `valueNoise(x, y, seed, period?)`, `fbm(x, y, seed, octaves = 4, period?)`,
    `voronoi(x, y, seed, period?)` — with `period` (whole lattice cells) the function repeats along y.
  - `patternsLate.ts`: `OWN_MOTION: Partial<Record<PatternKind, PatternMotion>>` (empty until Task 2).
  - `patterns.ts`: `patternColor(spec, pal, u, v, phase?: number): Rgb`; re-exports `hexToRgb`, `type Rgb`, `OWN_MOTION`.
  - `motion.ts`: `finishAt` hands the phase to a kind whose `OWN_MOTION` matches the motion and applies nothing generic;
    `rise` on any other kind is the `flow` drift.

- [ ] **Step 1: Pin cases 1–3 before touching anything**

In `src/modules/casecremental/fx/skins/patterns.test.ts`, add this test above `it("renders every skin of every case", …)`:

```ts
  it("paints cases 1-3 exactly as before cases 4-7 arrived", () => {
    // FNV-1a over every pixel of every skin of the first three cases at the in-game size, pinned before the
    // pattern code was split: any change to those finishes shows up here.
    let h = 0x811c9dc5;
    for (const c of CASES.filter((x) => ["bootcamp", "wildwood", "bedrock"].includes(x.id)))
      for (const s of c.skins) for (const b of renderPattern(s.pattern, 26, 10)) h = Math.imul(h ^ b, 16777619) >>> 0;
    expect(h).toBe(2021169458);
  });
```

Run: `npx vitest run src/modules/casecremental/fx/skins/patterns.test.ts`
Expected: PASS (it pins today's pixels; if it fails, stop — the checkout is not the expected base).

- [ ] **Step 2: Write the failing tests**

Create `src/modules/casecremental/fx/skins/paint.test.ts`:

```ts
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
```

In `src/modules/casecremental/fx/skins/noise.test.ts`, change the import to
`import { fbm, hash2, valueNoise, voronoi, wrapRow } from "./noise";` and add inside `describe("noise", …)`:

```ts
  it("wrapRow folds a lattice row into the period and leaves it alone without one", () => {
    expect([-1, 0, 4, 5, 9].map((y) => wrapRow(y, 5))).toEqual([4, 0, 4, 0, 4]);
    expect(wrapRow(-7)).toBe(-7);
  });

  it("with a period, value noise, fbm and voronoi repeat along y (the seamless rise)", () => {
    for (let i = 0; i < 64; i++) {
      const x = i * 0.37;
      const y = (i % 16) * 0.25;
      expect(valueNoise(x, y + 5, 3, 5)).toBe(valueNoise(x, y, 3, 5));
      expect(fbm(x, y + 4, 3, 4, 4)).toBe(fbm(x, y, 3, 4, 4));
      const a = voronoi(x, y + 3, 3, 3);
      const b = voronoi(x, y, 3, 3);
      expect(a.cell).toBe(b.cell);
      expect(a.f1).toBeCloseTo(b.f1, 9);
      expect(a.f2).toBeCloseTo(b.f2, 9);
    }
  });

  it("without a period nothing changes (cases 1-3 keep their exact pixels)", () => {
    expect(fbm(1.3, 2.7, 9, 4, undefined)).toBe(fbm(1.3, 2.7, 9));
    expect(valueNoise(1.3, 2.7, 9, undefined)).toBe(valueNoise(1.3, 2.7, 9));
    expect(fbm(1.3, 2.7, 9)).not.toBe(fbm(1.3, 2.7 + 4, 9));
  });
```

In `src/modules/casecremental/fx/skins/motion.test.ts`:
- replace the two imports from `../../sim/types` and `./motion` with:

```ts
import type { PatternKind, PatternMotion, PatternSpec, SkinDef, SkinMotion, WeaponMotion } from "../../sim/types";
import { finishAt, frameAt, frameSize, motionFrames, renderSkinFrame, renderSkinFrames, SKIN_H, SKIN_W } from "./motion";
import { hexToRgb, OWN_MOTION, patternColor } from "./patterns";
```

- add `"rise"` to the motion list of `it.each<PatternMotion>([...])("%s moves the finish but never the outline", …)`
  (it becomes `["flow", "shimmer", "pulse", "sparkle", "rise"]`) and add `{ pattern: "rise" },` after
  `{ pattern: "sparkle" },` in "closes every loop: phase 1 draws exactly phase 0";
- append at the end of the file:

```ts
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
```

(`patternColor` is imported for the test Task 2 adds to this block.)

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/modules/casecremental/fx/skins`
Expected: FAIL — `paint.test.ts` cannot resolve `./paint`; `noise.test.ts` "wrapRow is not a function"; in
`motion.test.ts` "rise moves the finish…" and "a finish without its own rise drifts instead…" fail (`rise` does
nothing yet). The content guard passes vacuously — no case `rise`s yet.

- [ ] **Step 4: Add `rise` to the types**

In `src/modules/casecremental/sim/types.ts` replace the `PatternMotion` line and its comment with:

```ts
/** A moving finish (spec: animated skins §4; `rise`: M3 spec §3). */
export type PatternMotion = "flow" | "shimmer" | "pulse" | "sparkle" | "rise";
```

and turn `PatternKind` into a multi-line union (Tasks 2–5 append to it):

```ts
export type PatternKind =
  // cases 1-3
  | "camo"
  | "digital"
  | "tiger"
  | "leaves"
  | "bark"
  | "moss"
  | "marble"
  | "granite"
  | "crystal"
  | "lava";
```

- [ ] **Step 5: Create the paint kit**

Create `src/modules/casecremental/fx/skins/paint.ts` (`hexToRgb`, `spread`, `pick` and `ramp` are moved verbatim out of
`patterns.ts`; `ramp` now goes through `mix`, which rounds exactly as before):

```ts
// The paint kit every pattern file shares: palette colours, picking, ramps and blends. Pure.

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
/** fbm bunches around 0.5 — spread it over the whole 0..1 range. */
export const spread = (n: number): number => clamp01((n - 0.25) / 0.5);
/** Hermite ease of t between edges a and b (0 below a, 1 above b). */
export const smoothstep = (a: number, b: number, t: number): number => {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};
/** Fractional part, always in [0, 1). */
export const fract = (t: number): number => t - Math.floor(t);

/** The palette from colour i on — never empty: a short palette keeps at least its last colour. */
export const tail = (pal: readonly Rgb[], i: number): readonly Rgb[] => pal.slice(Math.max(0, Math.min(i, pal.length - 1)));

/** Palette colour i, clamped into the palette (a short palette never reads past its end). */
export const at = (pal: readonly Rgb[], i: number): Rgb => pal[Math.max(0, Math.min(pal.length - 1, i))]!;

export const pick = (pal: readonly Rgb[], t: number): Rgb => pal[Math.min(pal.length - 1, Math.floor(clamp01(t) * pal.length))]!;

/** a → b by f, rounded to whole channels. */
export function mix(a: Rgb, b: Rgb, f: number): Rgb {
  const k = clamp01(f);
  return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
}

/** A smooth walk from the first colour to the last: a blend of two neighbouring palette colours. */
export function ramp(pal: readonly Rgb[], t: number): Rgb {
  if (pal.length === 1) return pal[0]!;
  const x = clamp01(t) * (pal.length - 1);
  const i = Math.min(pal.length - 2, Math.floor(x));
  return mix(pal[i]!, pal[i + 1]!, x - i);
}

/** A ramp that wraps: the last colour flows back into the first, so t and t + 1 give the same colour. */
export function cycle(pal: readonly Rgb[], t: number): Rgb {
  const x = fract(t) * pal.length;
  const i = Math.floor(x) % pal.length;
  return mix(pal[i]!, pal[(i + 1) % pal.length]!, x - Math.floor(x));
}

/** Where a pattern is sampled: (u, v) ∈ [0,1)² of the 2.5 : 1 texture (motion may push it a little
 *  outside), the same point in feature units (x = u·scale·2.5, y = v·scale), and the skin's seed and scale. */
export interface PatternPoint {
  u: number;
  v: number;
  x: number;
  y: number;
  scale: number;
  seed: number;
}
```

- [ ] **Step 6: Let the noise repeat along y**

Replace `src/modules/casecremental/fx/skins/noise.ts` with (`hash2` unchanged; without `period` every function returns
exactly what it did):

```ts
// Small deterministic noise toolkit for the skin patterns: integer hash, value noise, fractal
// noise (fbm) and voronoi cells. Pure functions — same input, same pixels. `period` (optional, a
// whole number of lattice cells) makes a function repeat along y — what lets a finish scroll up
// forever (`rise`) without a seam.

export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Lattice row `y` folded into [0, period) — unchanged without a period. */
export const wrapRow = (y: number, period?: number): number => (period ? ((y % period) + period) % period : y);

const smooth = (t: number) => t * t * (3 - 2 * t);

export function valueNoise(x: number, y: number, seed: number, period?: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const y0 = wrapRow(yi, period);
  const y1 = wrapRow(yi + 1, period);
  const a = hash2(xi, y0, seed);
  const b = hash2(xi + 1, y0, seed);
  const c = hash2(xi, y1, seed);
  const d = hash2(xi + 1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, seed: number, octaves = 4, period?: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 101, period ? period * freq : undefined);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Distance to the nearest (f1) and second-nearest (f2) cell point, and the nearest cell's id. */
export function voronoi(x: number, y: number, seed: number, period?: number): { f1: number; f2: number; cell: number } {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = Number.POSITIVE_INFINITY;
  let f2 = Number.POSITIVE_INFINITY;
  let cell = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx;
      const cy = yi + dy;
      const hy = wrapRow(cy, period);
      const d = Math.hypot(cx + hash2(cx, hy, seed) - x, cy + hash2(cx, hy, seed + 7) - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        cell = hash2(cx, hy, seed + 13);
      } else if (d < f2) {
        f2 = d;
      }
    }
  return { f1, f2, cell };
}
```

- [ ] **Step 7: Create `patternsLate.ts` with an empty `OWN_MOTION`**

Create `src/modules/casecremental/fx/skins/patternsLate.ts`:

```ts
import type { PatternKind, PatternMotion } from "../../sim/types";

// Thirteen finishes for cases 4-7 (spec: M3 §3): Mainframe (circuit, hex, carbon), Neon Nights (synthgrid,
// neonline, hueflow), Deep Space (starfield, nebula, aurora, iridescent), Inferno (flame, ember, molten).
// Each is a richer technique than cases 1-3 (networks, perspective, domain warping, distance-based glow) and
// still a pure function of (palette, point[, phase]). Palettes run darkest first; glow is bright colours on
// dark ones with a soft falloff, and every pixel is one palette colour or a blend of two. They are tuned for
// the in-game skin (26 x 10 px) at scales 4-8: thin lines are kept at least one game pixel wide.

/** The motion each kind draws itself (traces lighting up, a grid rolling in, flames rising...): finishAt hands
 *  it the loop phase and lays nothing generic on top. Every one repeats at phase 1, so its loop has no seam. */
export const OWN_MOTION: Partial<Record<PatternKind, PatternMotion>> = {};
```

- [ ] **Step 8: Point `patterns.ts` at the paint kit and give it a phase**

In `src/modules/casecremental/fx/skins/patterns.ts`:
- replace everything above the line `/** Color at (u, v) ∈ [0,1)² of a 2.5 : 1 texture. */` (imports, the old header
  comment, `Rgb`, `hexToRgb`, `clamp01`, `spread`, `pick`, `ramp`) with:

```ts
import type { PatternSpec } from "../../sim/types";
import { fbm, hash2, voronoi } from "./noise";
import { hexToRgb, pick, ramp, spread, type PatternPoint, type Rgb } from "./paint";

// The skin finishes: each maps a point of the texture to a colour of the skin's palette. Cases 1-3's ten live
// here (army: camo, digital, tiger; forest: leaves, bark, moss; rocks: marble, granite, crystal, lava); cases
// 4-7's thirteen richer ones in patternsLate.ts; the shared colour helpers in paint.ts.

export { hexToRgb, type Rgb } from "./paint";
export { OWN_MOTION } from "./patternsLate";
```

- replace that doc-comment line and the `patternColor` lines down to `switch (spec.kind) {` with:

```ts
/** Color at (u, v) ∈ [0,1)² of a 2.5 : 1 texture. `phase` (the loop phase, not wrapped here) reaches only the
 *  kinds that draw their own motion (OWN_MOTION); every other kind ignores it. */
export function patternColor(spec: PatternSpec, pal: readonly Rgb[], u: number, v: number, phase?: number): Rgb {
  const x = u * spec.scale * 2.5;
  const y = v * spec.scale;
  const seed = spec.seed;
  // the late kinds (Tasks 2-5) take the point as one object, plus `phase`
  const p: PatternPoint = { u, v, x, y, scale: spec.scale, seed };
  switch (spec.kind) {
```

  (The ten `case`s and `renderPattern` stay exactly as they are; `p` and `phase` are used from Task 2 on.)

- [ ] **Step 9: Own motions and `rise` in `finishAt`**

In `src/modules/casecremental/fx/skins/motion.ts`:
- change the import to `import { hexToRgb, OWN_MOTION, patternColor, type Rgb } from "./patterns";`
- in `finishAt`, replace

```ts
  if (kind === "flow") {
    // a small closed drift, so the loop returns to where it started
    uu += 0.08 * Math.cos(TAU * t);
    vv += 0.08 * Math.sin(TAU * t);
  }
  let c = patternColor(spec, pal, uu, vv);
  if (kind === "pulse") {
```

  with

```ts
  // a kind that draws this motion itself (OWN_MOTION) gets the phase, and nothing generic goes on top
  const own = kind !== undefined && OWN_MOTION[spec.kind] === kind;
  if (!own && (kind === "flow" || kind === "rise")) {
    // a small closed drift, so the loop returns to where it started; a finish that cannot scroll up
    // seamlessly drifts instead of rising
    uu += 0.08 * Math.cos(TAU * t);
    vv += 0.08 * Math.sin(TAU * t);
  }
  let c = patternColor(spec, pal, uu, vv, own ? t : undefined);
  if (kind === "pulse" && !own) {
```

- [ ] **Step 10: Run the tests, the typecheck and the build**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS — including "paints cases 1-3 exactly as before" (`2021169458`).

- [ ] **Step 11: Commit**

```bash
git add src/modules/casecremental/sim/types.ts src/modules/casecremental/fx/skins/paint.ts src/modules/casecremental/fx/skins/paint.test.ts src/modules/casecremental/fx/skins/noise.ts src/modules/casecremental/fx/skins/noise.test.ts src/modules/casecremental/fx/skins/patterns.ts src/modules/casecremental/fx/skins/patterns.test.ts src/modules/casecremental/fx/skins/patternsLate.ts src/modules/casecremental/fx/skins/motion.ts src/modules/casecremental/fx/skins/motion.test.ts
git commit -m "feat(skins): paint kit, noise that repeats along y, a phase for finishes that move themselves, and the rise motion

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

---

### Task 2: Mainframe — `circuit`, `hex`, `carbon`

**Files:**
- Modify: `src/modules/casecremental/sim/types.ts`, `src/modules/casecremental/fx/skins/patternsLate.ts`,
  `src/modules/casecremental/fx/skins/patterns.ts`, `src/modules/casecremental/fx/skins/motion.test.ts`
- Create: `src/modules/casecremental/fx/skins/patternsLate.test.ts`

**Interfaces:**
- Consumes: Task 1's paint kit (`at`, `clamp01`, `fract`, `mix`, `ramp`, `smoothstep`, `PatternPoint`, `Rgb`), `fbm`,
  `hash2`, `OWN_MOTION`, `patternColor(spec, pal, u, v, phase?)`.
- Produces: `PatternKind` gains `"circuit" | "hex" | "carbon"`; `patternsLate.ts` exports
  `circuit(pal, p, t?)`, `hex(pal, p, t?)`, `carbon(pal, p)` (all `(readonly Rgb[], PatternPoint, number?) => Rgb`);
  `OWN_MOTION` = `{ circuit: "pulse", hex: "pulse" }`. The test helpers in `patternsLate.test.ts` (`LATE`, `PALETTE`,
  `RGB`, `spec`, `colors`, `isBlend`, `changed`, `nearest`, `lum`, `same`, `pixels`, `share`, `band`) are used by
  Tasks 3–5.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/casecremental/fx/skins/patternsLate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PatternKind, PatternSpec } from "../../sim/types";
import { hexToRgb, OWN_MOTION, patternColor, renderPattern, type Rgb } from "./patterns";

// The finishes of cases 4–7 (spec: M3 §3). Every kind is checked for the same contract as cases 1–3 plus
// what makes it richer; the kind-specific tests sit below.

const LATE: PatternKind[] = ["circuit", "hex", "carbon"];
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
```

(`band` is first used by Task 3's tests.)

In `src/modules/casecremental/fx/skins/motion.test.ts`, add inside `describe("finishes that draw their own motion", …)`,
before "a finish without its own rise drifts instead…":

```ts
  it.each(Object.entries(OWN_MOTION) as [PatternKind, PatternMotion][])(
    "%s draws its own %s: the phase goes in, nothing generic on top",
    (kind, motion) => {
      for (const t of [0, 0.3, 0.7])
        for (const [u, v] of points) expect(finishAt(spec(kind), RGB, motion, u, v, t)).toEqual(patternColor(spec(kind), RGB, u, v, t));
    },
  );
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/modules/casecremental/fx/skins/patternsLate.test.ts src/modules/casecremental/fx/skins/motion.test.ts`
Expected: FAIL — `renderPattern` throws on `circuit` (the `switch` returns `undefined` for an unknown kind). The
`it.each` over `OWN_MOTION` collects no tests yet (Vitest runs an empty table silently); they appear in Step 6.

- [ ] **Step 3: Add the kinds to the type**

In `src/modules/casecremental/sim/types.ts`, end the `PatternKind` union with (replace `  | "lava";`):

```ts
  | "lava"
  // Mainframe
  | "circuit"
  | "hex"
  | "carbon";
```

- [ ] **Step 4: Implement the three finishes**

In `src/modules/casecremental/fx/skins/patternsLate.ts`, add the imports under the existing type import:

```ts
import { fbm, hash2 } from "./noise";
import { at, clamp01, fract, mix, ramp, smoothstep, type PatternPoint, type Rgb } from "./paint";
```

replace the `OWN_MOTION` object with:

```ts
export const OWN_MOTION: Partial<Record<PatternKind, PatternMotion>> = {
  circuit: "pulse",
  hex: "pulse",
};
```

and append:

```ts
const TAU = Math.PI * 2;
const hot = (pal: readonly Rgb[]): Rgb => at(pal, pal.length - 1);
/** One pixel of the in-game skin (10 px tall) in feature units: thin lines stay at least this wide. */
const px = (p: PatternPoint): number => p.scale * 0.1;

// ── Mainframe ───────────────────────────────────────────────────────────────────────────────────

/** PCB: copper traces join cell centres along the lattice; a trace end gets a pad with a drilled via, a
 *  junction a pad, over a board with patches of ground pour. Pulse: a current wave runs along the traces.
 *  Roles: 0 board, 1 ground pour, 2 trace, 3 pad, last = lit. */
export function circuit(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
  const gx = p.x * 0.6;
  const gy = p.y * 0.6;
  const cx = Math.floor(gx);
  const cy = Math.floor(gy);
  const fx = gx - cx - 0.5;
  const fy = gy - cy - 0.5;
  const east = (i: number, j: number) => hash2(i, j, p.seed + 1) < 0.5;
  const south = (i: number, j: number) => hash2(i, j, p.seed + 2) < 0.42;
  const e = east(cx, cy);
  const w = east(cx - 1, cy);
  const s = south(cx, cy);
  const n = south(cx, cy - 1);
  const links = +e + +w + +s + +n;
  const centre = Math.max(Math.abs(fx), Math.abs(fy));
  let d = Number.POSITIVE_INFINITY;
  if (e && fx >= 0) d = Math.min(d, Math.abs(fy));
  if (w && fx <= 0) d = Math.min(d, Math.abs(fy));
  if (s && fy >= 0) d = Math.min(d, Math.abs(fx));
  if (n && fy <= 0) d = Math.min(d, Math.abs(fx));
  if (links) d = Math.min(d, centre);
  const lit = t === undefined ? 0 : Math.max(0, Math.cos(TAU * ((gx + gy) * 0.25 + hash2(0, 0, p.seed) - t))) ** 3;
  const pad = (links === 1 || links >= 3) && centre < 0.3;
  if (pad) {
    if (links === 1 && centre < 0.11) return at(pal, 0);
    return mix(at(pal, 3), hot(pal), lit);
  }
  const hw = Math.max(0.13, 0.33 * px(p));
  if (d < hw) return mix(at(pal, 2), hot(pal), lit);
  const board = fbm(p.x * 0.35, p.y * 0.35, p.seed + 5, 3) > 0.56 ? at(pal, 1) : at(pal, 0);
  if (d < hw + 0.22) return mix(board, at(pal, 2), 0.3 * (1 - (d - hw) / 0.22) + 0.3 * lit);
  return board;
}

/** Honeycomb: bevelled cells in dark seams, about one in five lit from inside. Pulse: each lit cell breathes
 *  at its own moment. Roles: 0 seam, 1-2 cell (top-lit), second-to-last = dimmed light, last = light. */
export function hex(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
  const R = 1;
  const W = Math.sqrt(3) * R;
  const V = 3 * R;
  const ia = Math.round(p.x / W);
  const ja = Math.round(p.y / V);
  const ib = Math.round((p.x - W / 2) / W);
  const jb = Math.round((p.y - V / 2) / V);
  const da = Math.hypot(p.x - ia * W, p.y - ja * V);
  const db = Math.hypot(p.x - (ib * W + W / 2), p.y - (jb * V + V / 2));
  const [ci, cj, dx, dy] =
    da <= db ? [ia, ja * 2, p.x - ia * W, p.y - ja * V] : [ib, jb * 2 + 1, p.x - (ib * W + W / 2), p.y - (jb * V + V / 2)];
  const qx = Math.abs(dx);
  const qy = Math.abs(dy);
  const hd = Math.max(qx, 0.5 * qx + 0.866 * qy) / (0.866 * R);
  if (hd > 0.8) return at(pal, 0);
  const id = hash2(ci, cj, p.seed);
  if (id < 0.22) {
    const k = t === undefined ? 1 : 0.5 + 0.5 * Math.cos(TAU * (t - hash2(ci, cj, p.seed + 3)));
    return mix(at(pal, Math.max(2, pal.length - 2)), hot(pal), k * (0.9 - 0.8 * hd));
  }
  return mix(at(pal, 1), at(pal, 2), clamp01(0.45 - dy / R));
}

/** 2/2 twill carbon fibre: tows go over and under in diagonal steps, each rounded across its width, the two
 *  directions catching the light differently, under a soft clear-coat streak. A ramp of the palette. */
export function carbon(pal: readonly Rgb[], p: PatternPoint): Rgb {
  const i = Math.floor(p.x);
  const j = Math.floor(p.y);
  const flat = (((i + j) % 4) + 4) % 4 < 2;
  const across = flat ? p.y - j : p.x - i;
  const bulge = Math.sin(Math.PI * across);
  const fibre = 0.1 * hash2(flat ? i : Math.floor(p.x * 6), flat ? Math.floor(p.y * 6) : j, p.seed);
  const coat = smoothstep(0.55, 1, 1 - Math.abs(fract((p.u * 2.5 + p.v) * 0.45 + 0.25 * fbm(p.x * 0.2, p.y * 0.2, p.seed, 3)) - 0.5) * 2);
  return ramp(pal, clamp01(bulge * (flat ? 0.62 : 0.4) + fibre + 0.35 * coat));
}
```

- [ ] **Step 5: Dispatch them**

In `src/modules/casecremental/fx/skins/patterns.ts` add `import { carbon, circuit, hex } from "./patternsLate";` under
the paint import, and these cases after `case "lava": { … }` inside the `switch`:

```ts
    case "circuit":
      return circuit(pal, p, phase);
    case "hex":
      return hex(pal, p, phase);
    case "carbon":
      return carbon(pal, p);
```

- [ ] **Step 6: Run the tests, the typecheck and the build**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/casecremental/sim/types.ts src/modules/casecremental/fx/skins/patternsLate.ts src/modules/casecremental/fx/skins/patternsLate.test.ts src/modules/casecremental/fx/skins/patterns.ts src/modules/casecremental/fx/skins/motion.test.ts
git commit -m "feat(skins): Mainframe finishes - circuit traces with a current pulse, a breathing hex grid, carbon twill

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

---

### Task 3: Neon Nights — `synthgrid`, `neonline`, `hueflow`

**Files:**
- Modify: `src/modules/casecremental/sim/types.ts`, `src/modules/casecremental/fx/skins/patternsLate.ts`,
  `src/modules/casecremental/fx/skins/patterns.ts`, `src/modules/casecremental/fx/skins/patternsLate.test.ts`

**Interfaces:**
- Consumes: Task 1's paint kit (+ `cycle`), Task 2's `TAU`, `hot`, test helpers (`LATE`, `pixels`, `share`, `band`, `same`).
- Produces: `PatternKind` gains `"synthgrid" | "neonline" | "hueflow"`; `patternsLate.ts` exports `synthgrid(pal, p, t = 0)`,
  `neonline(pal, p)`, `hueflow(pal, p, t = 0)`; `OWN_MOTION` gains `synthgrid: "flow"`, `hueflow: "flow"`.

- [ ] **Step 1: Write the failing tests**

In `src/modules/casecremental/fx/skins/patternsLate.test.ts`, extend `LATE` to
`["circuit", "hex", "carbon", "synthgrid", "neonline", "hueflow"]` and append:

```ts
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
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/modules/casecremental/fx/skins/patternsLate.test.ts`
Expected: FAIL — `renderPattern` throws on `synthgrid`, `neonline`, `hueflow`.

- [ ] **Step 3: Add the kinds to the type**

In `src/modules/casecremental/sim/types.ts`, replace `  | "carbon";` with:

```ts
  | "carbon"
  // Neon Nights
  | "synthgrid"
  | "neonline"
  | "hueflow";
```

- [ ] **Step 4: Implement the three finishes**

In `src/modules/casecremental/fx/skins/patternsLate.ts`, change the paint import to
`import { at, clamp01, cycle, fract, mix, ramp, smoothstep, type PatternPoint, type Rgb } from "./paint";`, add
`synthgrid: "flow",` and `hueflow: "flow",` to `OWN_MOTION`, and append:

```ts
// ── Neon Nights ─────────────────────────────────────────────────────────────────────────────────

/** Synthwave: a striped sun sinking behind the horizon over a perspective grid. Flow: the grid rolls toward
 *  you by one line and the sun's stripes slide down by one per loop. Roles: 0 night, 1 sky at the horizon,
 *  2 grid and the sun's foot, 3 horizon glow, last = the sun's top. */
export function synthgrid(pal: readonly Rgb[], p: PatternPoint, t = 0): Rgb {
  const X = p.u * 2.5;
  const H = 0.5 + 0.08 * (hash2(1, 2, p.seed) - 0.5);
  if (p.v < H) {
    const sx = 0.55 + 1.4 * hash2(3, 4, p.seed);
    const sy = H - 0.06;
    const r = 0.34;
    const dy = p.v - sy;
    if (Math.hypot(X - sx, dy) < r) {
      const k = (dy + r) / (2 * r);
      const cut = dy > -0.1 && fract((dy + 0.1) / 0.14 - t) < 0.2 + 0.45 * clamp01((dy + 0.1) / r);
      if (!cut) return mix(hot(pal), at(pal, 2), k);
    }
    return mix(at(pal, 0), at(pal, 1), clamp01(p.v / H) ** 1.5);
  }
  const dz = p.v - H;
  const z = 0.25 / (dz + 0.03);
  const D = 0.35 * Math.max(1, p.scale);
  const phase = z * D + t;
  const dH = Math.abs(fract(phase + 0.5) - 0.5) / ((D * 0.25) / (dz + 0.03) ** 2);
  const xw = (X - 1.25) * z * 1.25 * Math.max(1, p.scale);
  const dV = Math.abs(fract(xw + 0.5) - 0.5) / (z * 1.25 * Math.max(1, p.scale));
  const fog = smoothstep(0.06, 0.2, dz);
  const grid = (1 - smoothstep(0.012, 0.045, Math.min(dH, dV))) * fog;
  const glow = 1 - smoothstep(0, 0.09, dz);
  if (glow > grid) return mix(at(pal, 0), at(pal, 3), glow);
  return mix(at(pal, 0), at(pal, 2), grid);
}

/** Neon tubes: contour lines of noise, one tube per middle palette colour, kept an even width by measuring
 *  their distance (value over gradient), with a pale core and a soft halo on black.
 *  Roles: 0 black, 1 halo, 2 .. second-to-last = tubes, last = core tint. */
export function neonline(pal: readonly Rgb[], p: PatternPoint): Rgb {
  const tubes = pal.length >= 4 ? pal.slice(2, pal.length - 1) : [hot(pal)];
  let best = 0;
  let tube = tubes[0]!;
  let core = false;
  for (let k = 0; k < tubes.length; k++) {
    const s = p.seed + 31 * k;
    const ax = p.x * 0.3;
    const ay = p.y * 0.3;
    const n = fbm(ax, ay, s, 3);
    const e = 0.01;
    const g = Math.hypot(fbm(ax + e, ay, s, 3) - n, fbm(ax, ay + e, s, 3) - n) / e + 1e-4;
    const dv = Math.abs(n - 0.5) / g / 0.3 / Math.max(1, p.scale);
    const glow = (1 - clamp01((dv - 0.045) / 0.16)) ** 1.5;
    if (glow > best) {
      best = glow;
      tube = tubes[k]!;
      core = dv < 0.045;
    }
  }
  if (core) return mix(tube, hot(pal), 0.4);
  return ramp([at(pal, 0), at(pal, 1), tube], best);
}

/** Liquid colour: twice domain-warped noise mapped through the palette as a wheel (the last colour flows back
 *  into the first). Flow: the bands march one full turn of the wheel per loop. */
export function hueflow(pal: readonly Rgb[], p: PatternPoint, t = 0): Rgb {
  const ax = p.x * 0.35;
  const ay = p.y * 0.35;
  const qx = fbm(ax, ay, p.seed, 3);
  const qy = fbm(ax + 5.2, ay + 1.3, p.seed, 3);
  const n = fbm(ax + 2.5 * qx, ay + 2.5 * qy, p.seed + 9, 4);
  return cycle(pal, n * 2.2 + p.u * 0.6 - t);
}
```

(`clamp01(p.v / H)` matters: `flow` samples above the texture, and a negative base under `** 1.5` is `NaN`.)

- [ ] **Step 5: Dispatch them**

In `src/modules/casecremental/fx/skins/patterns.ts` make the import `import { carbon, circuit, hex, hueflow, neonline, synthgrid } from "./patternsLate";`
and add after `case "carbon": …`:

```ts
    case "synthgrid":
      return synthgrid(pal, p, phase);
    case "neonline":
      return neonline(pal, p);
    case "hueflow":
      return hueflow(pal, p, phase);
```

- [ ] **Step 6: Run the tests, the typecheck and the build**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS (the own-motion tests in `patternsLate.test.ts` and `motion.test.ts` now also cover `synthgrid`
and `hueflow`).

- [ ] **Step 7: Commit**

```bash
git add src/modules/casecremental/sim/types.ts src/modules/casecremental/fx/skins/patternsLate.ts src/modules/casecremental/fx/skins/patternsLate.test.ts src/modules/casecremental/fx/skins/patterns.ts
git commit -m "feat(skins): Neon Nights finishes - a synthwave grid that rolls in, even-width neon tubes, a flowing hue wheel

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

---

### Task 4: Deep Space — `starfield`, `nebula`, `aurora`, `iridescent`

**Files:**
- Modify: `src/modules/casecremental/sim/types.ts`, `src/modules/casecremental/fx/skins/patternsLate.ts`,
  `src/modules/casecremental/fx/skins/patterns.ts`, `src/modules/casecremental/fx/skins/patternsLate.test.ts`

**Interfaces:**
- Consumes: Task 1's paint kit (+ `spread`, `tail`), Task 2's `TAU`, `hot`, test helpers.
- Produces: `PatternKind` gains `"starfield" | "nebula" | "aurora" | "iridescent"`; `patternsLate.ts` exports
  `starfield(pal, p)`, `nebula(pal, p)`, `aurora(pal, p, t = 0)`, `iridescent(pal, p)`; `OWN_MOTION` gains
  `aurora: "flow"`.

- [ ] **Step 1: Write the failing tests**

In `src/modules/casecremental/fx/skins/patternsLate.test.ts`, extend `LATE` with
`"starfield", "nebula", "aurora", "iridescent"` (after `"hueflow"`) and append:

```ts
describe("Deep Space", () => {
  it.each<PatternKind>(["starfield", "nebula"])("%s: the brightest colour is stars - specks, not a fill", (kind) => {
    for (const seed of [7, 8, 9]) {
      const stars = pixels(kind, undefined, seed).filter(([, , c]) => same(c, RGB[4]!)).length / 2048;
      expect(stars).toBeGreaterThan(0);
      expect(stars).toBeLessThan(0.15);
    }
  });

  it("aurora: curtains hang from a bright lower edge over a dark bottom", () => {
    for (const seed of [7, 8, 9]) {
      const px = pixels("aurora", undefined, seed);
      expect(Math.max(band(px, 0.4, 0.6), band(px, 0.6, 0.8))).toBeGreaterThan(2 * band(px, 0.9, 1));
    }
  });

  it("iridescent: pools of bare dark metal between film bands of every other colour", () => {
    const px = [7, 8, 9].flatMap((seed) => pixels("iridescent", undefined, seed));
    expect(px.filter(([, , c]) => same(c, RGB[0]!)).length).toBeGreaterThan(0);
    for (let i = 1; i < RGB.length; i++) expect(share(px, [i]), `colour ${i}`).toBeGreaterThan(0.02);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/modules/casecremental/fx/skins/patternsLate.test.ts`
Expected: FAIL — `renderPattern` throws on the four new kinds.

- [ ] **Step 3: Add the kinds to the type**

In `src/modules/casecremental/sim/types.ts`, replace `  | "hueflow";` with:

```ts
  | "hueflow"
  // Deep Space
  | "starfield"
  | "nebula"
  | "aurora"
  | "iridescent";
```

- [ ] **Step 4: Implement the four finishes**

In `src/modules/casecremental/fx/skins/patternsLate.ts`, change the paint import to
`import { at, clamp01, cycle, fract, mix, ramp, smoothstep, spread, tail, type PatternPoint, type Rgb } from "./paint";`,
add `aurora: "flow",` to `OWN_MOTION`, and append:

```ts
// ── Deep Space ──────────────────────────────────────────────────────────────────────────────────

/** A star in the cell of size `cell` (texture-height units) around (X, Y), present with probability
 *  `chance`: 2 = its core, 1 = a spike of its cross (when `cross`), 0 = none. */
function star(X: number, Y: number, cell: number, chance: number, r: number, seed: number, cross: boolean): number {
  const i = Math.floor(X / cell);
  const j = Math.floor(Y / cell);
  if (hash2(i, j, seed) >= chance) return 0;
  const sx = (i + 0.25 + 0.5 * hash2(i, j, seed + 1)) * cell;
  const sy = (j + 0.25 + 0.5 * hash2(i, j, seed + 2)) * cell;
  const dx = Math.abs(X - sx);
  const dy = Math.abs(Y - sy);
  if (dx < r && dy < r) return 2;
  if (cross && ((dx < r * 0.6 && dy < r * 3) || (dy < r * 0.6 && dx < r * 3))) return 1;
  return 0;
}

/** Three depths of stars over a faint dust lane: far ones dim and dense, near ones bright with a cross.
 *  Roles: 0 space, 1 dust, 2 far star, second-to-last = mid star, last = near star. */
export function starfield(pal: readonly Rgb[], p: PatternPoint): Rgb {
  const X = p.u * 2.5;
  const k = 4 / Math.max(1, p.scale);
  if (star(X, p.v, 0.42 * k, 0.45, 0.05, p.seed + 10, true)) return hot(pal);
  if (star(X, p.v, 0.22 * k, 0.4, 0.045, p.seed + 20, false)) return at(pal, pal.length - 2);
  if (star(X, p.v, 0.13 * k, 0.35, 0.04, p.seed + 30, false)) return at(pal, 2);
  const lane = smoothstep(0.45, 0.75, fbm(X * 2.2, p.v * 2.2 + X * 0.6, p.seed, 4));
  return mix(at(pal, 0), at(pal, 1), 0.75 * lane);
}

/** Gas clouds: twice domain-warped noise through the palette's dark-to-bright ramp, stars only where the gas
 *  is thin. Roles: 0 .. second-to-last = gas (thin to dense), last = stars. */
export function nebula(pal: readonly Rgb[], p: PatternPoint): Rgb {
  const ax = p.x * 0.4;
  const ay = p.y * 0.4;
  const wx = fbm(ax, ay, p.seed + 3, 3);
  const wy = fbm(ax + 7.1, ay + 2.3, p.seed + 3, 3);
  const d = spread(fbm(ax + 3 * wx, ay + 3 * wy, p.seed, 5));
  if (d < 0.4 && star(p.u * 2.5, p.v, 0.16, 0.25, 0.045, p.seed + 40, false)) return hot(pal);
  return ramp(pal.slice(0, Math.max(1, pal.length - 1)), d ** 1.2);
}

/** Northern lights: curtains of fine vertical rays hanging from a wavy lower edge (sharp at the bottom,
 *  fading upward), a fainter curtain higher up, as a dark-to-bright ramp. Flow: the curtains sway and the
 *  rays drift once round a small circle per loop. */
export function aurora(pal: readonly Rgb[], p: PatternPoint, t = 0): Rgb {
  const X = p.u * 2.5;
  const c = 0.35 * Math.cos(TAU * t);
  const s = 0.35 * Math.sin(TAU * t);
  const k = Math.max(1, p.scale) / 4;
  let I = 0;
  for (let layer = 0; layer < 2; layer++) {
    const seed = p.seed + 50 * layer;
    const edge = 0.7 - 0.28 * layer + 0.3 * (fbm(X * 1.1 * k + c, 3 + s, seed, 3) - 0.5) + 0.07 * Math.sin(X * 3 * k + seed);
    const rays = 0.45 + 0.55 * fbm(X * 10 * k + 2 * c, p.v * 0.8 + s, seed + 7, 3);
    const below = p.v - edge;
    const profile = below > 0 ? Math.exp(-below * 28) : Math.exp(below * 3.5);
    I = Math.max(I, profile * rays * (layer ? 0.6 : 1.1));
  }
  return ramp(pal, clamp01(I));
}

/** Oil slick: swirled film thickness turned into thin interference bands that cycle through the bright
 *  colours, broken by pools of bare dark metal. Roles: 0 metal, 1 .. last = the film's band colours. */
export function iridescent(pal: readonly Rgb[], p: PatternPoint): Rgb {
  const ax = p.x * 0.3;
  const ay = p.y * 0.3;
  const n = fbm(ax, ay, p.seed, 4);
  const w = fbm(ax + 4 * n, ay + 4 * n, p.seed + 17, 4);
  if (w < 0.4) return at(pal, 0);
  return cycle(tail(pal, 1), (w - 0.4) * 3.5 + p.v * 0.6);
}
```

- [ ] **Step 5: Dispatch them**

In `src/modules/casecremental/fx/skins/patterns.ts` make the import
`import { aurora, carbon, circuit, hex, hueflow, iridescent, nebula, neonline, starfield, synthgrid } from "./patternsLate";`
and add after `case "hueflow": …`:

```ts
    case "starfield":
      return starfield(pal, p);
    case "nebula":
      return nebula(pal, p);
    case "aurora":
      return aurora(pal, p, phase);
    case "iridescent":
      return iridescent(pal, p);
```

- [ ] **Step 6: Run the tests, the typecheck and the build**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/casecremental/sim/types.ts src/modules/casecremental/fx/skins/patternsLate.ts src/modules/casecremental/fx/skins/patternsLate.test.ts src/modules/casecremental/fx/skins/patterns.ts
git commit -m "feat(skins): Deep Space finishes - layered stars, warped nebula gas, swaying aurora curtains, oil-slick film

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

---

### Task 5: Inferno — `flame`, `ember`, `molten`, and their seamless rise

**Files:**
- Modify: `src/modules/casecremental/sim/types.ts`, `src/modules/casecremental/fx/skins/patternsLate.ts`,
  `src/modules/casecremental/fx/skins/patterns.ts`, `src/modules/casecremental/fx/skins/patternsLate.test.ts`

**Interfaces:**
- Consumes: Task 1's `fbm(…, period)`, `wrapRow`, paint kit; Task 2's `TAU`; test helpers.
- Produces: `PatternKind` gains `"flame" | "ember" | "molten"` (the union is complete: 23 kinds); `patternsLate.ts`
  exports `flame(pal, p, t = 0)`, `ember(pal, p, t = 0)`, `molten(pal, p, t = 0)`; `OWN_MOTION` gains
  `flame: "rise"`, `ember: "rise"`, `molten: "rise"` — the only kinds that may `rise` in case data.

- [ ] **Step 1: Write the failing tests**

In `src/modules/casecremental/fx/skins/patternsLate.test.ts`, extend `LATE` with `"flame", "ember", "molten"` (after
`"iridescent"`) and append:

```ts
describe("Inferno", () => {
  it("flame is hot at the bottom and dark at the top in every phase of its rise", () => {
    for (const t of [undefined, 0.3, 0.7]) {
      const px = pixels("flame", t);
      expect(band(px, 0.85, 1)).toBeGreaterThan(3 * band(px, 0, 0.15));
    }
  });

  it("ember: glowing specks on char - the char's two colours cover most of it", () => {
    for (const seed of [7, 8, 9]) expect(share(pixels("ember", undefined, seed), [0, 1])).toBeGreaterThan(0.6);
  });

  it("molten rises: phase t paints what sat t lower, and the flow repeats every texture height", () => {
    const s = spec("molten");
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 64; i += 3) {
        const u = i / 64;
        const v = j / 32;
        expect(patternColor(s, RGB, u, v, 0.25)).toEqual(patternColor(s, RGB, u, v + 0.25));
        expect(patternColor(s, RGB, u, v + 1)).toEqual(patternColor(s, RGB, u, v));
      }
  });
});
```

(The seam test of `describe("the finishes of cases 4-7")` now covers all three rises: phase 1 must paint phase 0.
The grid is dyadic — `j / 32`, `0.25` — so the exact `toEqual`s hold bit for bit.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/modules/casecremental/fx/skins/patternsLate.test.ts`
Expected: FAIL — `renderPattern` throws on `flame`, `ember`, `molten`.

- [ ] **Step 3: Add the kinds to the type**

In `src/modules/casecremental/sim/types.ts`, replace `  | "iridescent";` with:

```ts
  | "iridescent"
  // Inferno
  | "flame"
  | "ember"
  | "molten";
```

- [ ] **Step 4: Implement the three finishes**

In `src/modules/casecremental/fx/skins/patternsLate.ts`, change the noise import to
`import { fbm, hash2, wrapRow } from "./noise";`, add `flame: "rise",`, `ember: "rise",`, `molten: "rise",` to
`OWN_MOTION`, add this helper under `const hot = …`:

```ts
/** Lattice rows per texture height for the kinds that rise: whole, so the texture repeats every height. */
const rows = (p: PatternPoint, k = 1): number => Math.max(1, Math.round(p.scale * k));
```

and append:

```ts
// ── Inferno ─────────────────────────────────────────────────────────────────────────────────────

/** Fire: warped noise stretched upward licking into tongues over a heat that grows toward the bottom, as a
 *  dark-to-bright ramp. Rise: the noise scrolls up one texture height per loop (it repeats every height)
 *  while the heat stays put, so the flames climb but never leave. */
export function flame(pal: readonly Rgb[], p: PatternPoint, t = 0): Rgb {
  const P = rows(p);
  const xn = p.u * 2.5 * P;
  const yn = (p.v + t) * P;
  const warp = fbm(xn, yn, p.seed + 3, 3, P);
  const n = fbm(xn * 1.6 + 1.2 * warp, yn, p.seed, 4, P);
  const I = smoothstep(0.15, 1, p.v * 1.2 - 0.1 + (n - 0.5) * 2);
  return ramp(pal, I);
}

/** Embers: glowing specks of different sizes and heat over hard char flakes, each flickering. Rise: the
 *  specks drift up one texture height per loop (their lattice repeats every height); the char stays.
 *  Roles: 0-1 char, 2 glow, 3 .. last = hotter. */
export function ember(pal: readonly Rgb[], p: PatternPoint, t = 0): Rgb {
  const P = rows(p);
  const X = p.u * 2.5 * P;
  const Y = (p.v + t) * P;
  const xi = Math.floor(X);
  const yi = Math.floor(Y);
  let I = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx;
      const cy = yi + dy;
      const hy = wrapRow(cy, P);
      if (hash2(cx, hy, p.seed) >= 0.55) continue;
      const ex = cx + 0.2 + 0.6 * hash2(cx, hy, p.seed + 1);
      const ey = cy + 0.2 + 0.6 * hash2(cx, hy, p.seed + 2);
      const r = 0.3 + 0.25 * hash2(cx, hy, p.seed + 3);
      const heat = (0.65 + 0.35 * hash2(cx, hy, p.seed + 4)) * (0.8 + 0.2 * Math.cos(TAU * (2 * t + hash2(cx, hy, p.seed + 5))));
      I = Math.max(I, heat * clamp01(1 - Math.hypot(X - ex, Y - ey) / r) ** 1.2);
    }
  const char = fbm(p.x * 0.8, p.y * 0.8, p.seed + 9, 4) > 0.52 ? at(pal, 1) : at(pal, 0);
  if (I < 0.3) return mix(char, at(pal, 2), I / 0.3);
  return ramp(tail(pal, 2), (I - 0.3) / 0.7);
}

/** Molten rock: rivers of glow along the ridges of warped noise (flowing, branching cracks) fading into a
 *  dark two-tone crust. Rise: the whole flow creeps up one texture height per loop.
 *  Roles: 0-1 crust, 2 glow, 3 .. last = hotter. */
export function molten(pal: readonly Rgb[], p: PatternPoint, t = 0): Rgb {
  const P = rows(p, 0.5);
  const X = p.u * 2.5 * P;
  const Y = (p.v + t) * P;
  const w1 = fbm(X, Y, p.seed + 5, 3, P);
  const w2 = fbm(X + 3.1, Y, p.seed + 6, 3, P);
  const n = fbm(X + 1.6 * w1, Y + 1.6 * (w2 - 0.5), p.seed, 4, P);
  const ridge = 1 - Math.abs(2 * n - 1);
  const I = smoothstep(0.76, 0.97, ridge);
  const crust = fbm(X * 2, Y * 2, p.seed + 8, 3, P * 2) > 0.5 ? at(pal, 1) : at(pal, 0);
  if (I < 0.35) return mix(crust, at(pal, 2), I / 0.35);
  return ramp(tail(pal, 2), (I - 0.35) / 0.65);
}
```

Why it is seamless: every noise call that sees `Y` passes a `period` equal to the number of lattice cells in one
texture height (`P`, or `2P` for the doubled coordinate), and every `Y` is `(v + t) · P`, so `t = 1` lands on the same
lattice rows as `t = 0`. A noise input scaled by a non-whole factor (say `Y * 1.3`) would break this — keep factors
on `Y` whole and pass `period × factor`.

- [ ] **Step 5: Dispatch them**

In `src/modules/casecremental/fx/skins/patterns.ts` make the import list every late kind (Prettier wraps it):

```ts
import {
  aurora,
  carbon,
  circuit,
  ember,
  flame,
  hex,
  hueflow,
  iridescent,
  molten,
  nebula,
  neonline,
  starfield,
  synthgrid,
} from "./patternsLate";
```

and add after `case "iridescent": …`:

```ts
    case "flame":
      return flame(pal, p, phase);
    case "ember":
      return ember(pal, p, phase);
    case "molten":
      return molten(pal, p, phase);
```

- [ ] **Step 6: Run the tests, the typecheck and the build**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS. The typecheck now proves the `switch` in `patternColor` covers all 23 kinds (a missing `case`
makes the function able to fall off its end: TS2366).

- [ ] **Step 7: Commit**

```bash
git add src/modules/casecremental/sim/types.ts src/modules/casecremental/fx/skins/patternsLate.ts src/modules/casecremental/fx/skins/patternsLate.test.ts src/modules/casecremental/fx/skins/patterns.ts
git commit -m "feat(skins): Inferno finishes - climbing flames, flickering embers, molten cracks; all three rise without a seam

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

---

### Task 6: Eyeball sheets and the feature note

There is no in-app pattern browser, and the scratch harness (`.superpowers/harness/`) mounts the whole scene; the
cheapest look is a skipped-by-default Vitest file that renders PNG contact sheets with the art pipeline's own PNG
writer (`tools/art/png.mjs`) into `art/preview/` (already gitignored).

**Files:**
- Create: `tools/skins/preview.test.mjs`
- Modify: `docs/feature-history/casecremental-look.md`

**Interfaces:**
- Consumes: `CASES` (sim/content/cases.ts), `renderSkinFrames(skin)` (fx/skins/motion.ts), `OWN_MOTION`,
  `renderPattern` (fx/skins/patterns.ts), `writePng(file, { w, h, data })` (tools/art/png.mjs).
- Produces: `art/preview/patterns/kinds.png` (all 23 kinds: in-game size ×6, a large render, on a rifle ×4),
  `loops.png` (every own-motion loop on a rifle, 10 frames), `cases.png` (every skin of every case as the player
  sees it — after Plan M3-A lands this shows cases 4–7 with their real palettes).

- [ ] **Step 1: Write the preview**

Create `tools/skins/preview.test.mjs`:

```js
// Dev-only eyeball check of the skin finishes (Plan M3-B): writes PNG contact sheets to art/preview/patterns/
// (gitignored). Skipped in the normal test run; run it on purpose:
//   bash:        SKIN_PREVIEW=1 npx vitest run tools/skins
//   PowerShell:  $env:SKIN_PREVIEW=1; npx vitest run tools/skins; Remove-Item Env:SKIN_PREVIEW
import fs from "node:fs";
import { describe, it } from "vitest";
import { CASES } from "../../src/modules/casecremental/sim/content/cases";
import { renderSkinFrames } from "../../src/modules/casecremental/fx/skins/motion";
import { OWN_MOTION, renderPattern } from "../../src/modules/casecremental/fx/skins/patterns";
import { writePng } from "../art/png.mjs";

const OUT = "art/preview/patterns";
const BG = [40, 40, 48, 255];
/** Demo palettes for the kinds no case uses yet (the M3-A case data replaces them once it lands). */
const DEMO = {
  circuit: ["#04140c", "#0b2a1a", "#1f9d55", "#c9a227", "#9dffb0"],
  hex: ["#05070d", "#1b2433", "#34465e", "#00c2ff", "#d6f6ff"],
  carbon: ["#050505", "#141414", "#2a2a2e", "#55555c", "#9a9aa3"],
  synthgrid: ["#0b0221", "#3a0c5e", "#ff2a6d", "#ff9e00", "#ffe45e"],
  neonline: ["#06020c", "#1a0630", "#ff2a6d", "#05d9e8", "#fff5fd"],
  hueflow: ["#2b0f54", "#ab1f65", "#ff4f69", "#ff8031", "#ffdf6b"],
  starfield: ["#020208", "#141433", "#5a6a9a", "#b8c6ff", "#ffffff"],
  nebula: ["#030010", "#2a0a4a", "#8a1f7a", "#ff6a3d", "#ffd6a0", "#ffffff"],
  aurora: ["#020617", "#2e1065", "#0f9d6e", "#6dffb5", "#eafff4"],
  iridescent: ["#0a0a12", "#3a0ca3", "#4cc9f0", "#80ffdb", "#f72585", "#ffd166"],
  flame: ["#0a0000", "#5a0a00", "#d62800", "#ff8a00", "#ffd84a", "#fff6c8"],
  ember: ["#070504", "#1c1410", "#7a1a00", "#ff5a00", "#ffb347", "#fff0b0"],
  molten: ["#080404", "#1d0f0c", "#8a1600", "#ff4d00", "#ffb000", "#fff1a8"],
};
const OLD = ["camo", "digital", "tiger", "leaves", "bark", "moss", "marble", "granite", "crystal", "lava"];

const image = (w, h) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(BG, i * 4);
  return { w, h, data };
};
/** Nearest-neighbour copy of src into dst at (ox, oy), k× larger; transparent pixels are skipped. */
function blit(dst, src, ox, oy, k) {
  for (let y = 0; y < src.h * k; y++)
    for (let x = 0; x < src.w * k; x++) {
      const si = (Math.floor(y / k) * src.w + Math.floor(x / k)) * 4;
      if (src.data[si + 3] === 0 || ox + x >= dst.w || oy + y >= dst.h) continue;
      dst.data.set(src.data.subarray(si, si + 4), ((oy + y) * dst.w + ox + x) * 4);
    }
}
const pattern = (spec, w, h) => ({ w, h, data: renderPattern(spec, w, h) });
const specOf = (kind) =>
  CASES.flatMap((c) => c.skins).find((s) => s.pattern.kind === kind)?.pattern ?? { kind, palette: DEMO[kind], scale: 4, seed: 101 };
const demoSkin = (spec, motion) => ({
  id: `preview-${spec.kind}`,
  name: spec.kind,
  weapon: "rifle",
  rarity: "covert",
  pattern: spec,
  ...(motion ? { motion } : {}),
});

describe.skipIf(!process.env.SKIN_PREVIEW)("skin preview sheets", () => {
  it("writes kinds.png, loops.png and cases.png", () => {
    fs.mkdirSync(OUT, { recursive: true });

    // every kind: in-game size ×6, a large render, and on a rifle ×4 (cases 1-3 first, to compare)
    const kinds = [...OLD, ...Object.keys(DEMO)];
    const sheet = image(4 * 330 + 10, Math.ceil(kinds.length / 4) * 150 + 10);
    kinds.forEach((kind, i) => {
      const spec = specOf(kind);
      const ox = 10 + (i % 4) * 330;
      const oy = 10 + Math.floor(i / 4) * 150;
      blit(sheet, pattern(spec, 26, 10), ox, oy, 6);
      blit(sheet, pattern(spec, 156, 60), ox + 165, oy, 1);
      blit(sheet, renderSkinFrames(demoSkin(spec))[0], ox, oy + 70, 4);
    });
    writePng(`${OUT}/kinds.png`, sheet);

    // each kind that draws its own motion: its whole loop on a rifle, ×5, one row per kind
    const own = Object.entries(OWN_MOTION);
    const loops = image(10 * 140 + 10, own.length * 60 + 10);
    own.forEach(([kind, motion], r) =>
      renderSkinFrames(demoSkin(specOf(kind), { pattern: motion, frames: 10 })).forEach((f, n) =>
        blit(loops, f, 10 + n * 140, 10 + r * 60, 5),
      ),
    );
    writePng(`${OUT}/loops.png`, loops);

    // every skin of every case as the player sees it: in-game pattern ×4 and frame 0 on its weapon ×4
    const cases = image(13 * 120 + 10, CASES.length * 120 + 10);
    CASES.forEach((c, r) =>
      c.skins.forEach((s, n) => {
        blit(cases, pattern(s.pattern, 26, 10), 10 + n * 120, 10 + r * 120, 4);
        blit(cases, renderSkinFrames(s)[0], 10 + n * 120, 60 + r * 120, 4);
      }),
    );
    writePng(`${OUT}/cases.png`, cases);
  });
});
```

- [ ] **Step 2: Check it stays out of the normal run, then run it on purpose**

Run: `npx vitest run tools/skins`
Expected: `1 skipped`.

Run (bash): `SKIN_PREVIEW=1 npx vitest run tools/skins` — or (PowerShell):
`$env:SKIN_PREVIEW=1; npx vitest run tools/skins; Remove-Item Env:SKIN_PREVIEW`
Expected: `1 passed`; `art/preview/patterns/kinds.png`, `loops.png`, `cases.png` exist; `git status` shows nothing new
under `art/` (the folder is ignored).

- [ ] **Step 3: Look at the sheets**

Open the three PNGs (the Read tool shows images). Check, at the **in-game size** (the ×6 tiles and the rifles):
each new kind is recognisable — traces with pads, a honeycomb with a few lit cells, a twill weave, a sun over a grid,
neon tubes on black, flowing colour bands, star specks, gas clouds with stars, curtains of light, oil-slick bands with
dark pools, flames hot at the bottom, specks on char, glowing cracks — and reads as richer than the ten kinds of
cases 1–3 in the first rows. In `loops.png`: the circuit's wave travels along the traces, hex cells breathe, the grid
rolls in, the hue bands march, the curtains sway, flames/specks/cracks climb. If something reads badly, tune only
that kind's constants in `patternsLate.ts`, re-run the sheets and `npx vitest run src/modules/casecremental` (the
tests must stay green), and say in the commit which constants changed.

- [ ] **Step 4: Note it in the feature history**

In `docs/feature-history/casecremental-look.md`, add after the "**Animated skins**" bullet:

```markdown
- **Finishes of cases 4–7 (M3-B)** (`fx/skins/patternsLate.ts`, plan `2026-10-12-casecremental-m3-b-skin-patterns.md`):
  thirteen kinds, each a richer technique than cases 1–3 (PCB networks, hex cells, twill, perspective grid,
  even-width neon contours, domain-warped hue wheel, layered stars, nebula gas, aurora curtains, thin-film bands,
  fire, embers, molten ridges). No shaders: glow is bright palette colours on dark ones with a soft falloff, every
  pixel one palette colour or a blend of two, tuned for the 26 × 10 in-game skin at scales 4–8. Some kinds draw
  their own motion (`OWN_MOTION`: circuit/hex pulse, synthgrid/hueflow/aurora flow, flame/ember/molten `rise`);
  `rise` is seamless because their noise repeats every texture height (`period` in `noise.ts`); on any other kind
  `rise` falls back to the drift, and a test refuses such case data. Cases 1–3 pixels are pinned by a checksum.
  Eyeball sheets: `SKIN_PREVIEW=1 npx vitest run tools/skins` → `art/preview/patterns/`.
```

- [ ] **Step 5: Run everything once more**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all PASS (`tools/skins` skipped).

- [ ] **Step 6: Commit**

```bash
git add tools/skins/preview.test.mjs docs/feature-history/casecremental-look.md
git commit -m "chore(skins): PNG eyeball sheets of every finish and loop (SKIN_PREVIEW=1), feature note for the M3 finishes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```
