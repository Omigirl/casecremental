# Casecremental animated skins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skins can declare a `motion` (a moving finish and/or a moving weapon) that is baked into a short whole-pixel loop and played on the reveal card and the landed reel card; every case's ★ knife shimmers and flips, every other skin in cases 1–3 stays still.

**Architecture:** A pure module `fx/skins/motion.ts` rasterises a skin at a loop phase `t ∈ [0, 1)` straight from the weapon's silhouette polygon (pattern motions recolour the finish, weapon motions transform the polygon first). `SkinTextures` bakes and caches the loop per skin (still skins keep today's exact path); `Reel` and `Bench` swap textures by elapsed time with `frameAt`.

**Tech Stack:** TypeScript (strict), PixiJS 8, Vitest. Commands: `npx vitest run <path>`, `npm run typecheck`, `npm run build`. The pre-commit hook formats staged code with Prettier.

**Spec:** `docs/superpowers/specs/2026-10-08-casecremental-animated-skins-design.md`

## Global Constraints

- Baked frame loops, whole-pixel frames; no shaders; pixel sprites are never scaled or rotated as images — weapon motion transforms the silhouette polygon before rasterising.
- A skin without `motion` renders exactly as today (same pixels, one frame).
- Defaults: 8 frames per loop, 8 fps. One pattern motion per skin.
- Pattern motions: `flow`, `shimmer`, `pulse`, `sparkle`. Weapon motions: `bob`, `recoil`, `bolt`, `flip`.
- A moving weapon's frames get 2 px of room on every side; a flipping knife gets a square; all frames of one skin share one size.
- Plays on the reveal card and on the winning reel card once the reel has stopped; cards passing during a spin show frame 0.
- Cases 1–3: every ★ knife gets `{ pattern: "shimmer", weapon: "flip" }`; every other skin stays still (richer finishes are for the later cases, M3).
- The sim never reads `motion`.

## Review Focus

1. **The skin is shown while it is still being dragged (lifted card)** → the lifted card shows the current frame and keeps animating; it never shows a destroyed texture. Pinned in Task 3 (`lifted()` returns the card sprite's current texture).
2. **A reel lands on an animated winner, then the next spin starts** → the old winner stops animating at once and the new strip shows frame 0 during the spin. Pinned in Task 3 (`start()` clears the winner player; `update` with a motion never advances frames).
3. **Slow-mo / hit-stop** → the loop follows game time (it slows with the ★ slow-mo, freezes on hit-stop) and never jumps backwards. Pinned in Task 3 (`frameAt` uses accumulated game ms).
4. **A skin whose `frames` is 1 or missing values** → no division by zero, no empty loop: `frameAt` returns 0 for ≤ 1 frame; `motionFrames` defaults to 8. Pinned in Task 1.
5. **Memory over a long session** → each skin's loop is baked once and destroyed with the library. Pinned in Task 2 (cache test).

---

## File Structure

- Create `src/modules/casecremental/fx/skins/motion.ts` — pure: loop timing (`motionFrames`, `motionFps`, `frameAt`), `frameSize`, `weaponPose`, `finishAt`, `renderSkinFrame`, `renderSkinFrames`.
- Create `src/modules/casecremental/fx/skins/motion.test.ts`.
- Modify `src/modules/casecremental/sim/types.ts` — `SkinMotion`, optional `SkinDef.motion`.
- Modify `src/modules/casecremental/fx/skins/pixelSkin.ts` — `SkinTextures.frames/fps`, injectable `toTexture`.
- Modify `src/modules/casecremental/fx/skins/pixelSkin.test.ts`.
- Modify `src/modules/casecremental/fx/pixel/Reel.ts` — `makeCard` exposes `art`; winner card player.
- Modify `src/modules/casecremental/fx/pixel/Bench.ts` — reveal card baked per frame and played.
- Modify `src/modules/casecremental/fx/World.ts` — pass game ms to `reel.update`.
- Modify `src/modules/casecremental/sim/content/cases.ts` and `cases.test.ts` — every ★ knife shimmers and flips.
- Modify `docs/feature-history/casecremental-look.md` — one paragraph.

---

### Task 1: Motion model and the pure skin rasteriser

**Files:**
- Modify: `src/modules/casecremental/sim/types.ts`
- Create: `src/modules/casecremental/fx/skins/motion.ts`
- Test: `src/modules/casecremental/fx/skins/motion.test.ts`

**Interfaces:**
- Consumes: `patternColor(spec, pal, u, v): Rgb`, `hexToRgb`, `type Rgb` (fx/skins/patterns.ts); `hash2(x, y, seed): number` (fx/skins/noise.ts); `SILHOUETTES`, `SILHOUETTE_BOX` (fx/skins/silhouettes.ts); `type PixelImage { w; h; data: Uint8ClampedArray }` (fx/skins/pixelSkin.ts, type-only import).
- Produces:
  - `sim/types.ts`: `export type PatternMotion = "flow" | "shimmer" | "pulse" | "sparkle"`, `export type WeaponMotion = "bob" | "recoil" | "bolt" | "flip"`, `export interface SkinMotion { pattern?: PatternMotion; weapon?: WeaponMotion; frames?: number; fps?: number }`, `SkinDef.motion?: SkinMotion`.
  - `motion.ts`: `SKIN_W = 26`, `SKIN_H = 10`, `motionFrames(skin): number`, `motionFps(skin): number`, `frameAt(elapsedMs, fps, frames): number`, `frameSize(motion, w?, h?): { w; h }`, `weaponPose(kind, t): Pose`, `finishAt(spec, pal, kind, u, v, t): Rgb`, `renderSkinFrame(skin, t, w?, h?): PixelImage`, `renderSkinFrames(skin, w?, h?): PixelImage[]`.

- [ ] **Step 1: Add the motion types to `sim/types.ts`**

After `export type PatternKind = …;` add:

```ts
/** A moving finish (spec: animated skins §4). */
export type PatternMotion = "flow" | "shimmer" | "pulse" | "sparkle";
/** A moving weapon: the code-drawn silhouette is transformed before it is rasterised. */
export type WeaponMotion = "bob" | "recoil" | "bolt" | "flip";

/** Presentation only — the sim never reads it. */
export interface SkinMotion {
  pattern?: PatternMotion;
  weapon?: WeaponMotion;
  /** Frames in the loop (default 8). */
  frames?: number;
  /** Playback speed (default 8). */
  fps?: number;
}
```

and in `SkinDef`, after `pattern: PatternSpec;`:

```ts
  /** Optional animation, baked into a short loop of pixel frames. */
  motion?: SkinMotion;
```

- [ ] **Step 2: Write the failing tests** — `fx/skins/motion.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { CASES } from "../../sim/content/cases";
import type { PatternMotion, SkinDef, SkinMotion, WeaponMotion } from "../../sim/types";
import { frameAt, frameSize, motionFrames, renderSkinFrame, renderSkinFrames, SKIN_H, SKIN_W } from "./motion";
import type { PixelImage } from "./pixelSkin";

const rifle = CASES[0]!.skins.find((s) => s.weapon === "rifle")!;
const knife = CASES[0]!.skins.find((s) => s.weapon === "knife")!;
const moving = (motion: SkinMotion, base: SkinDef = rifle): SkinDef => ({ ...base, id: `${base.id}-m`, motion });
const same = (a: PixelImage, b: PixelImage) => a.w === b.w && a.h === b.h && a.data.every((v, i) => v === b.data[i]);
const isOutline = (img: PixelImage, i: number) => img.data[i] === 18 && img.data[i + 1] === 14 && img.data[i + 2] === 16 && img.data[i + 3] === 255;

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
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx/skins/motion`
Expected: FAIL — `Cannot find module './motion'`.

- [ ] **Step 4: Write `fx/skins/motion.ts`**

```ts
import type { PatternSpec, SkinDef, SkinMotion } from "../../sim/types";
import { hash2 } from "./noise";
import { hexToRgb, patternColor, type Rgb } from "./patterns";
import type { PixelImage } from "./pixelSkin";
import { SILHOUETTE_BOX, SILHOUETTES } from "./silhouettes";

// Animated skins (spec: 2026-10-08-casecremental-animated-skins-design.md). A skin's `motion` is baked
// into a short loop of whole-pixel frames. Every motion is a function of the loop phase t ∈ [0, 1), so
// the loop closes. Pattern motions recolour the finish; weapon motions move or turn the code-drawn
// silhouette before it is rasterised, so every frame stays crisp.

export const SKIN_W = 26;
export const SKIN_H = 10;
const DEFAULT_FRAMES = 8;
const DEFAULT_FPS = 8;
const SPARKLES = 10;
const TAU = Math.PI * 2;
const OUTLINE: Rgb = [18, 14, 16];
const BOLT: Rgb = [205, 205, 215];
const FLASH: Rgb = [255, 214, 120];

export const motionFrames = (skin: SkinDef): number => (skin.motion ? Math.max(1, skin.motion.frames ?? DEFAULT_FRAMES) : 1);
export const motionFps = (skin: SkinDef): number => skin.motion?.fps ?? DEFAULT_FPS;

/** Which loop frame to show after `elapsedMs` of playing. */
export function frameAt(elapsedMs: number, fps: number, frames: number): number {
  if (frames <= 1) return 0;
  return Math.floor((Math.max(0, elapsedMs) / 1000) * fps) % frames;
}

/** A moving weapon gets 2 px of room on every side; a flipping knife a square it can turn in. */
export function frameSize(motion: SkinMotion, w = SKIN_W, h = SKIN_H): { w: number; h: number } {
  if (motion.weapon === "flip") {
    const s = Math.ceil(Math.hypot(w, h)) + 2;
    return { w: s, h: s };
  }
  return motion.weapon ? { w: w + 4, h: h + 4 } : { w, h };
}

export interface Pose {
  dx: number;
  dy: number;
  angle: number;
  flash: boolean;
  bolt: number;
}

export function weaponPose(kind: SkinMotion["weapon"], t: number): Pose {
  const pose: Pose = { dx: 0, dy: 0, angle: 0, flash: false, bolt: 0 };
  switch (kind) {
    case "bob":
      pose.dy = Math.round(Math.sin(TAU * t));
      break;
    case "recoil":
      pose.dx = t < 0.125 ? -2 : t < 0.25 ? -1 : 0;
      pose.flash = t < 0.125;
      break;
    case "bolt":
      pose.bolt = Math.round(2 * Math.sin(Math.PI * t));
      break;
    case "flip":
      pose.angle = TAU * t;
      break;
  }
  return pose;
}

const mix = (c: Rgb, to: number, k: number): Rgb => [c[0] + (to - c[0]) * k, c[1] + (to - c[1]) * k, c[2] + (to - c[2]) * k];

/** The finish at (u, v) ∈ [0,1)² of the weapon at loop phase t. */
export function finishAt(spec: PatternSpec, pal: readonly Rgb[], kind: SkinMotion["pattern"], u: number, v: number, t: number): Rgb {
  let uu = u;
  let vv = v;
  if (kind === "flow") {
    // a small closed drift, so the loop returns to where it started
    uu += 0.08 * Math.cos(TAU * t);
    vv += 0.08 * Math.sin(TAU * t);
  }
  let c = patternColor(spec, pal, uu, vv);
  if (kind === "pulse") {
    const f = 1 + 0.12 * Math.sin(TAU * t);
    c = [c[0] * f, c[1] * f, c[2] * f];
  }
  if (kind === "shimmer") {
    // a bright diagonal band that enters off the left edge and leaves off the right
    const d = Math.abs(u + 0.4 * v - (-0.3 + 2 * t));
    if (d < 0.08) c = mix(c, 255, 0.75 * (1 - d / 0.08));
  }
  if (kind === "sparkle") {
    for (let i = 0; i < SPARKLES; i++) {
      const su = hash2(i, 1, spec.seed);
      const sv = hash2(i, 2, spec.seed);
      if (Math.abs(u - su) > 0.5 / SKIN_W || Math.abs(v - sv) > 0.5 / SKIN_H) continue;
      c = mix(c, 255, Math.max(0, Math.sin(TAU * (t - hash2(i, 3, spec.seed)))) ** 6);
    }
  }
  return c;
}

function inPolygon(pts: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** One frame of a skin at loop phase t, drawn from the weapon's silhouette (a still skin: t is ignored). */
export function renderSkinFrame(skin: SkinDef, t: number, w = SKIN_W, h = SKIN_H): PixelImage {
  const motion = skin.motion ?? {};
  const phase = t - Math.floor(t);
  const size = frameSize(motion, w, h);
  const pose = weaponPose(motion.weapon, phase);
  const pal = skin.pattern.palette.map(hexToRgb);
  const pts = SILHOUETTES[skin.weapon];
  const sx = SILHOUETTE_BOX.w / w;
  const sy = SILHOUETTE_BOX.h / h;
  const ox = (size.w - w) / 2 + pose.dx;
  const oy = (size.h - h) / 2 + pose.dy;
  const cos = Math.cos(-pose.angle);
  const sin = Math.sin(-pose.angle);
  /** Output pixel → the matching point in the weapon's own pixel space. */
  const local = (x: number, y: number): [number, number] => {
    let px = x + 0.5 - ox;
    let py = y + 0.5 - oy;
    if (pose.angle) {
      const cx = px - w / 2;
      const cy = py - h / 2;
      px = w / 2 + cx * cos - cy * sin;
      py = h / 2 + cx * sin + cy * cos;
    }
    return [px, py];
  };
  const fill = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= size.w || y >= size.h) return false;
    const [px, py] = local(x, y);
    return inPolygon(pts, px * sx, py * sy);
  };
  const data = new Uint8ClampedArray(size.w * size.h * 4);
  for (let y = 0; y < size.h; y++)
    for (let x = 0; x < size.w; x++) {
      const i = (y * size.w + x) * 4;
      if (fill(x, y)) {
        const [px, py] = local(x, y);
        const lum = Math.max(0, 200 - Math.floor(py) * 10); // the same top-lit shading as the still skins
        const k = 0.35 + 0.9 * (lum / 255);
        const c = finishAt(skin.pattern, pal, motion.pattern, px / w, py / h, phase);
        data.set([c[0] * k, c[1] * k, c[2] * k, 255], i);
      } else if (fill(x - 1, y) || fill(x + 1, y) || fill(x, y - 1) || fill(x, y + 1)) data.set([...OUTLINE, 255], i);
    }
  const put = (x: number, y: number, c: Rgb, onWeapon: boolean) => {
    if (x < 0 || y < 0 || x >= size.w || y >= size.h) return;
    const i = (y * size.w + x) * 4;
    if (onWeapon && data[i + 3] === 0) return;
    data.set([...c, 255], i);
  };
  if (pose.bolt) {
    const by = Math.round(oy + h * 0.3);
    const bx = Math.round(ox + w * 0.55) - pose.bolt;
    for (let x = bx; x < bx + 3; x++) put(x, by, BOLT, true);
  }
  if (pose.flash) {
    const fy = Math.round(oy + h * 0.4);
    put(Math.round(ox + w), fy, FLASH, false);
    put(Math.round(ox + w) + 1, fy, FLASH, false);
  }
  return { w: size.w, h: size.h, data };
}

/** A spinning knife is drawn a little smaller, so its square frame (24 px) fits inside a card. */
const FLIP_W = 20;
const FLIP_H = 8;

/** The whole loop: frame n at phase n / frames. */
export function renderSkinFrames(skin: SkinDef, w?: number, h?: number): PixelImage[] {
  const flip = skin.motion?.weapon === "flip";
  const ww = w ?? (flip ? FLIP_W : SKIN_W);
  const hh = h ?? (flip ? FLIP_H : SKIN_H);
  const n = motionFrames(skin);
  return Array.from({ length: n }, (_, i) => renderSkinFrame(skin, i / n, ww, hh));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/modules/casecremental/fx/skins/motion`
Expected: PASS (all). If one motion's "moves" test fails because its pixels miss the silhouette (e.g. sparkle points all outside the rifle, or the bolt bar row off the body), adjust that motion's constants (`SPARKLES`, the bolt row `h * 0.3`) — never the test.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck` — Expected: clean.

```bash
git add src/modules/casecremental/sim/types.ts src/modules/casecremental/fx/skins/motion.ts src/modules/casecremental/fx/skins/motion.test.ts
git commit -m "feat(skins): motion model and a pure rasteriser for animated skin loops"
```

### Task 2: Bake and cache loops in `SkinTextures`

**Files:**
- Modify: `src/modules/casecremental/fx/skins/pixelSkin.ts`
- Test: `src/modules/casecremental/fx/skins/pixelSkin.test.ts`

**Interfaces:**
- Consumes: `motionFps`, `renderSkinFrames` (Task 1); existing `tintWeapon`, `fallbackBase`, `renderPattern`.
- Produces: `export type ToTexture = (img: PixelImage) => Texture`; `new SkinTextures(bases, toTexture?)`; `frames(skin): Texture[]` (1 for a still skin, cached); `texture(skin): Texture` (= `frames(skin)[0]`); `fps(skin): number`; `destroy()` destroys every baked frame.

- [ ] **Step 1: Write the failing test** — append to `pixelSkin.test.ts`

```ts
describe("SkinTextures", () => {
  it("bakes a still skin exactly as before, and a moving skin's loop once", () => {
    const made: PixelImage[] = [];
    const fake = (img: PixelImage) => {
      made.push(img);
      return { destroy() {} } as unknown as Texture;
    };
    const st = new SkinTextures(new Map(), fake);
    const still = { ...CASES[0]!.skins.find((s) => s.weapon === "rifle")!, motion: undefined };
    expect(st.frames(still)).toHaveLength(1);
    expect(made[0]!.data).toEqual(tintWeapon(fallbackBase(still.weapon), renderPattern(still.pattern, 26, 10)));
    const moving = { ...still, id: "moving", motion: { pattern: "shimmer" as const } };
    const loop = st.frames(moving);
    expect(loop).toHaveLength(8);
    expect(st.frames(moving)).toBe(loop); // cached: baked once
    expect(made).toHaveLength(9);
    expect(st.texture(moving)).toBe(loop[0]);
    expect(st.fps(moving)).toBe(8);
  });
});
```

and extend the file's imports: `import type { Texture } from "pixi.js";`, `import { CASES } from "../../sim/content/cases";`, `import { renderPattern } from "./patterns";`, and add `SkinTextures, type PixelImage` to the `./pixelSkin` import.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/casecremental/fx/skins/pixelSkin`
Expected: FAIL — `st.frames is not a function` (or the constructor ignores the second argument).

- [ ] **Step 3: Rewrite `SkinTextures` in `pixelSkin.ts`**

Add `import { motionFps, renderSkinFrames } from "./motion";` and replace the class with:

```ts
export type ToTexture = (img: PixelImage) => Texture;

const canvasTexture: ToTexture = (img) => {
  const c = document.createElement("canvas");
  c.width = img.w;
  c.height = img.h;
  const g = c.getContext("2d")!;
  const id = g.createImageData(img.w, img.h);
  id.data.set(img.data);
  g.putImageData(id, 0, 0);
  const tex = Texture.from(c);
  tex.source.scaleMode = "nearest";
  return tex;
};

/** Every skin's frames, baked once: a still skin is one texture (today's exact pixels), a moving one its loop. */
export class SkinTextures {
  private readonly cache = new Map<string, Texture[]>();
  constructor(
    private readonly bases: Map<WeaponId, PixelImage>,
    private readonly toTexture: ToTexture = canvasTexture,
  ) {}

  frames(skin: SkinDef): Texture[] {
    const hit = this.cache.get(skin.id);
    if (hit) return hit;
    let images: PixelImage[];
    if (skin.motion) images = renderSkinFrames(skin);
    else {
      const base = this.bases.get(skin.weapon) ?? fallbackBase(skin.weapon);
      images = [{ w: base.w, h: base.h, data: tintWeapon(base, renderPattern(skin.pattern, base.w, base.h)) }];
    }
    const frames = images.map(this.toTexture);
    this.cache.set(skin.id, frames);
    return frames;
  }

  texture(skin: SkinDef): Texture {
    return this.frames(skin)[0]!;
  }

  fps(skin: SkinDef): number {
    return motionFps(skin);
  }

  destroy(): void {
    for (const frames of this.cache.values()) for (const t of frames) t.destroy(true);
    this.cache.clear();
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/modules/casecremental/fx/skins && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/fx/skins/pixelSkin.ts src/modules/casecremental/fx/skins/pixelSkin.test.ts
git commit -m "feat(skins): SkinTextures bakes and caches a moving skin's loop"
```

### Task 3: Play the loops, and the ★ knives shimmer and flip

**Files:**
- Modify: `src/modules/casecremental/sim/content/cases.ts`, `src/modules/casecremental/sim/content/cases.test.ts`
- Modify: `src/modules/casecremental/fx/pixel/Reel.ts`, `src/modules/casecremental/fx/pixel/Bench.ts`, `src/modules/casecremental/fx/World.ts`
- Modify: `docs/feature-history/casecremental-look.md`

**Interfaces:**
- Consumes: `SkinTextures.frames/fps` (Task 2), `frameAt` (Task 1), `SkinMotion` (Task 1).
- Produces: `makeCard(...): Container & { art: Sprite }`; `Reel.update(motion: ReelMotion | null, ms = 0)`.

- [ ] **Step 1: Write the failing test** — append inside `describe("cases", …)` in `cases.test.ts`

```ts
  it("every ★ knife shimmers and flips; every other skin in cases 1–3 is still", () => {
    for (const c of CASES)
      for (const s of c.skins) expect(s.motion).toEqual(s.rarity === "gold" ? { pattern: "shimmer", weapon: "flip" } : undefined);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/casecremental/sim/content`
Expected: FAIL — `expected undefined to deeply equal { pattern: 'shimmer', weapon: 'flip' }`.

- [ ] **Step 3: Give the knives their motion** — `cases.ts`

Import `SkinMotion` with the other types and replace the `skin` helper with:

```ts
const skin = (id: string, name: string, weapon: WeaponId, rarity: RarityId, pattern: PatternSpec, motion?: SkinMotion): SkinDef => ({
  id,
  name,
  weapon,
  rarity,
  pattern,
  ...(motion ? { motion } : {}),
});

/** The ★ knives are rare: they shimmer and spin. Everything else in cases 1–3 stays still. */
const KNIFE_MOTION: SkinMotion = { pattern: "shimmer", weapon: "flip" };
```

Then add `, KNIFE_MOTION` as the last argument of the three knife lines (`bc_knife`, `ww_knife`, `br_knife`), e.g.:

```ts
    skin("bc_knife", "Field Marshal", "knife", "gold", p("digital", ["#3a2f0b", "#c9a227", "#ffe08a", "#fff6d5"], 9, 51), KNIFE_MOTION),
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/modules/casecremental/sim`
Expected: PASS.

- [ ] **Step 5: The landed reel card plays its loop** — `Reel.ts`

Add `import { frameAt } from "../skins/motion";` and `import type { Texture } from "pixi.js";` (merge into the existing pixi import). Change `makeCard` to expose its art sprite:

```ts
export function makeCard(skins: SkinTextures, skin: SkinDef, w: number, h: number): Container & { art: Sprite } {
  const color = RARITY_INFO[skin.rarity].color;
  const card = new Container();
  card.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x15161d }).rect(0, 0, w, h).fill({ color, alpha: 0.16 }));
  const art = new Sprite(skins.texture(skin));
  art.position.set(Math.floor((w - art.width) / 2), Math.floor((h - 2 - art.height) / 2));
  card.addChild(art, new Graphics().rect(0, h - 2, w, 2).fill({ color }));
  return Object.assign(card, { art });
}
```

Add fields to `Reel`:

```ts
  /** The winning card's loop, played once the reel has stopped (null: a still skin). */
  private winner: { art: Sprite; frames: Texture[]; fps: number } | null = null;
  private settledMs = 0;
```

Replace `update` with:

```ts
  /** While spinning: move the strip (every card shows frame 0). Stopped: play the winner's loop. */
  update(motion: ReelMotion | null, ms = 0): void {
    if (motion) {
      this.fraction = reelFraction(motion);
      this.place(this.fraction, true);
      this.settledMs = 0;
      return;
    }
    if (!this.winner) return;
    this.settledMs += ms;
    this.winner.art.texture = this.winner.frames[frameAt(this.settledMs, this.winner.fps, this.winner.frames.length)]!;
  }
```

In `start()`, add `this.settledMs = 0;` next to `this.fraction = 0;`. In `rebuild()`, set the winner while building cards:

```ts
  private rebuild(): void {
    for (const child of this.strip.removeChildren()) child.destroy({ children: true });
    this.winner = null;
    const h = this.rect.h - 6;
    this.items.forEach((skin, i) => {
      const card = makeCard(this.skins, skin, CARD_W - GAP, h);
      card.position.set(i * CARD_W + GAP / 2, 3);
      this.strip.addChild(card);
      if (i !== WIN_INDEX) return;
      const frames = this.skins.frames(skin);
      if (frames.length > 1) this.winner = { art: card.art, frames, fps: this.skins.fps(skin) };
    });
  }
```

In `World.ts`, pass game time: replace `this.reel.update(b.phase === "spinning" ? { elapsed: b.elapsed, fullDuration: b.fullDuration, crawl } : null);` with `this.reel.update(b.phase === "spinning" ? { elapsed: b.elapsed, fullDuration: b.fullDuration, crawl } : null, gameMs);`.

- [ ] **Step 6: The reveal card plays its loop** — `Bench.ts`

Add `import { frameAt } from "../skins/motion";`. Replace the field `private cardTexture: Texture | null = null;` with:

```ts
  /** The reveal card, baked once per frame of the skin's loop (one frame for a still skin). */
  private cardFrames: Texture[] = [];
  private cardFps = 8;
  private cardMs = 0;
```

Replace the body of `showReveal` from `const art = new Sprite(...)` to `this.card.texture = this.cardTexture;` with:

```ts
    for (const t of this.cardFrames) t.destroy(true);
    this.cardFrames = this.skins.frames(skin).map((tex) => {
      const art = new Sprite(tex);
      art.position.set(Math.floor((w - art.width) / 2), Math.floor((h - art.height) / 2));
      const face = new Container();
      face.addChild(frame.clone(), art);
      if (drop.statTrak) face.addChild(new Graphics().rect(3, 3, 4, 2).fill({ color: 0xff8a00 }));
      const baked = this.bake(face);
      face.destroy({ children: true });
      return baked;
    });
    frame.destroy();
    this.cardFps = this.skins.fps(skin);
    this.cardMs = 0;
    this.card.texture = this.cardFrames[0]!;
```

In `lifted()`, replace the card branch with (the lifted card shows the frame being played — Review Focus 1):

```ts
    if (!this.cardFrames.length) return null;
    const { w, h } = ITEM_SIZE.reveal;
    return { id, texture: this.card.texture, center: { x: p.x + w / 2, y: p.y + h / 2 } };
```

In `update(ms, b)`, after `this.bin.update(ms);` add:

```ts
    if (this.card.visible && this.cardFrames.length > 1) {
      this.cardMs += ms;
      this.card.texture = this.cardFrames[frameAt(this.cardMs, this.cardFps, this.cardFrames.length)]!;
    }
```

Replace `destroy()` with:

```ts
  destroy(): void {
    for (const t of this.cardFrames) t.destroy(true);
    this.cardFrames = [];
  }
```

- [ ] **Step 7: Run every check**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS; typecheck clean; build succeeds.

- [ ] **Step 8: Browser check**

`npm run dev`, open the game. Dev board (⚙ → SOUND BOARD (DEV)) → Next drop ★ → open a case:
- during the spin the knife card scrolls still (frame 0); after the reel stops the winning card's knife spins once a second while a bright band sweeps across its finish (its tips may pass behind the window's edge mid-turn);
- the reveal card does the same, keeps going while dragged (lifted) and while the ★ slow-mo runs (slower);
- every other skin stays still;
- the next spin starts with every card still.

- [ ] **Step 9: Record it and commit**

Add to `docs/feature-history/casecremental-look.md`, under "Why it is built this way":

```markdown
- **Animated skins** (`fx/skins/motion.ts`, spec `2026-10-08-casecremental-animated-skins-design.md`): a skin's
  optional `motion` (pattern: flow / shimmer / pulse / sparkle; weapon: bob / recoil / bolt / flip) is baked
  into a short whole-pixel loop from the weapon's silhouette and played on the reveal card and the landed reel
  card (never while the strip scrolls). Still skins render exactly as before. In cases 1–3 only the ★ knives move (shimmer + flip,
  user: "they are rare anyway"); richer finishes are for the later cases.
```

```bash
git add src/modules/casecremental docs/feature-history/casecremental-look.md
git commit -m "feat(skins): the reveal card and the landed reel card play animated skins; ★ knives shimmer and flip"
```
