# Casecremental F6-B — Run 4 on Screen: Finishes, Case Art, the Upgrader's Dial, the Evolutions' Looks, Stage 5 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw what F6-A put in the sim: the six new skin finishes of Glitch and Fever Dream, their case boxes (and The Last Case's chest sheet for F6-C), the Upgrader's dial on the locker with its win pop and loss shred, a visible change on the table for each of the five evolutions, and stage 5's layers checked at Run 4's top rate (p95 ≤ 20 ms).

**Architecture:** Every new look is a pure rule file plus a thin Pixi class, as in M3-D: the rules (`fx/skins/patternsRun4.ts`, `fx/reel/slotLayout.ts`, `fx/stations/evolutionRules.ts`, `fx/stations/upgraderRules.ts`, `fx/juice/stageFive.ts`) are tested; the classes (`fx/stations/EvolutionLooks.ts`, `fx/stations/UpgraderDial.ts`, the stage-5 layers inside `fx/juice/stageLook.ts`) draw from `RunState` every frame and take events only for one-shot juice, so a reload lands on the same frame. The stations hang off `fx/stations/Stations.ts`; `fx/World.ts` (~540 lines) gets no net lines. Images are generated with the ElevenLabs MCP (`creative_generate_image`, model `gpt-image-2`) and built by `npm run art` — **behind an explicit approval gate for the credits** (Task 2), with a free ffmpeg fallback.

**Tech Stack:** TypeScript (strict), PixiJS 8 + pixi-filters 6 (`GlitchFilter`, `BulgePinchFilter`), React 19, Vitest, Vite 8, ElevenLabs MCP, ffmpeg, Node (`npm run art`, `tools/art`).

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-finish-design.md` §7.1–§7.3 and §7.5 (binding), with §1, §6 (the credit budget rule) and §11. Read `docs/feature-history/casecremental-look.md` (finishes, the art pipeline, budgets), `casecremental-runs-2-3.md` (stations, the visual budget, the flash gate) and the M3-C plan (`docs/superpowers/plans/2026-10-12-casecremental-m3-c-assets.md`: how case sheets and chest sheets were generated and built) before Task 1.

**This plan is the second of three for F6.** It needs F6-A (`2026-10-12-casecremental-f6a-run4-sim.md`) done: the pattern kinds and motions, `RunState.upgrader` and `.evolutions`, the events `upgraderStarted`, `upgraderDone`, `evolved`. F6-C (`2026-10-12-casecremental-f6c-last-case.md`) uses this plan's `vault-case-4` chest sheet (Task 2) and `HdLayer.takeFlash()` (Task 6). Before Task 1, re-read as F2–F6-A left them: `fx/World.ts`, `fx/stations/Stations.ts`, `fx/stations/LockerStation.ts`, `fx/stations/BotStation.ts`, `fx/pixel/BenchReels.ts`, `fx/pixel/layout.ts`, `fx/juice/stageLook.ts`, `fx/hd/HdLayer.ts`, `ui/Hud.tsx`, `fx/audio/sounds.ts`, `art/manifest.json`.

## Global Constraints

- Every player-facing string exists in EN (`i18n/en.ts`) and RU (`i18n/ru.ts`) and fits its `i18n/budgets.ts` budget; Russian has exactly the English keys. Russian text wraps only at whole words; a single Russian word fits the narrowest column it is shown in.
- **Photosensitivity, hard rules:** every full-screen flash goes through the flash gate (`HdLayer.flash` / `FlashGate`, at most 3 a second); anything else that changes the whole screen at once (a glitch burst, a strobe) asks the same gate. A light that pulses on the beat, or flickers, changes by less than 0.1. Every rule here has a test.
- Balance numbers live only in `sim/tuning.ts`. Look numbers (sizes, speeds, caps) live in their `fx/…Rules.ts` file as named constants.
- Stations draw from sim state every frame and take events only for one-shot juice (a pop, a burst, a sound). A reload or a lobby trip shows the same picture from the save alone, and a beat that already happened does not replay.
- File size (IDOS.md): a new responsibility in a file past ~400 lines goes in its own file. `fx/World.ts` (~540) must not grow net; `fx/vault/VaultScene.ts` (~430) and `fx/stations/LockerStation.ts` (~270) take only small hooks; the dial is its own file.
- `ui/` imports from `fx/` only, never the other way; `fx/` never imports `ui/`.
- Match the module's code style: a header comment per file saying what it is and why, doc comments on exported names, the neighbours' comment density, 2-space Prettier formatting (`npm run format`).
- Every commit keeps these green: `npm run typecheck`, `npx vitest run src/modules/casecremental`, `npm run build`.
- Commit messages look like `feat(run4): …` (assets: `assets(art): …`) and end with these two lines (after a blank line):
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```
- Stage files by path. Never stage `docs/todo.md` or the `{…}.png` files in the repo root. Stay on branch `casecremental-finish`. Do not edit `src/modules.ts`, `src/config.ts`, `src/idos.title.ts` or `idos.modules.lock.json`.
- **ElevenLabs credits:** no generation call before the user approves the number in Task 2's gate. Every generation is priced with `estimate_only` first; a failed generation is never retried by calling the tool again (it charges again) — poll its status.

## Review Focus

1. **A new finish paints a colour that is not in its palette** (a three-way blend, an overflow). Every pixel must be one palette colour or a blend of two, like M3-B's finishes. Test: Task 1, "paints only palette colours or blends of two".
2. **Slot Machine's ten reels on a portrait phone** (360×640, 390×844). Every slot window must sit inside the reel area, never overlap, and stay at least a clean tile wide. Test: Task 3, the viewport sweep in `slotLayout.test.ts`.
3. **A reload in the middle of an Upgrader spin.** The dial must come back at the same needle angle, with no start sound and no replayed tick burst. Test: Task 5, "the needle is a pure function of the spin; a reload crosses no ticks".
4. **Money Printer and Hot Hand at Run 4's top rate.** Bills and flames must be pooled and capped, never one sprite per sale. Test: Task 4, "caps the bills and the flames".
5. **Stage 5's strobe and glitch bursts on top of a ★ flash and a stage-up.** They must share the flash gate and never push the screen past 3 changes a second. Test: Task 6, "the strobe and the glitch bursts ask the flash gate".

---

## File map

All paths are relative to `src/modules/casecremental/` unless they start with `art/`, `docs/` or `.superpowers/`.

| File | Task | Responsibility |
|---|---|---|
| `fx/skins/patternsRun4.ts` (create, + test), `fx/skins/patterns.ts`, `fx/skins/motion.test.ts` | 1 | the six finishes and their own motions |
| `art/source/*`, `art/manifest.json`, `assets/sprites/case-glitch.*`, `case-feverdream.*`, `vault-case-4.*`, `assets/audio/upgrader-shred-*.mp3`, `fx/audio/sounds.ts` | 2 | case boxes, The Last Case's chest sheet, the shred sound |
| `fx/reel/slotLayout.ts` (create, + test), `fx/pixel/BenchReels.ts` | 3 | ten reels as five slot columns |
| `fx/stations/evolutionRules.ts` (create, + test), `fx/stations/EvolutionLooks.ts` (create), `fx/stations/Stations.ts`, `fx/stations/deps.ts` | 3, 4 | the evolutions' looks |
| `game/view.ts`, `game/view.test.ts`, `ui/Hud.tsx`, `ui/styles.ts`, `i18n/*` | 4, 5 | Hot Hand's combo flames; the floats |
| `fx/stations/upgraderRules.ts` (create, + test), `fx/stations/UpgraderDial.ts` (create), `fx/stations/LockerStation.ts` | 5 | the dial, win pop, loss shred |
| `fx/juice/stageFive.ts` (create, + test), `fx/juice/stageLook.ts`, `fx/hd/HdLayer.ts`, `fx/World.ts` (two changed lines) | 6 | stage 5's layers, `takeFlash` |
| — | 7 | the browser check of Run 4's table |

---

### Task 1: Six finishes for Glitch and Fever Dream

Replace F6-A's interim finish with six real ones in a new file (`patternsLate.ts` is ~310 lines), in M3-B's style: a pure function of (palette, point[, phase]), every pixel one palette colour or a blend of two, tuned for the 26 × 10 in-game skin at scales 4–7, palettes darkest first.

- **datamosh** (Glitch): macroblocks of a smeared base image; about a third of the blocks are shifted copies of their left neighbour (the "mosh"), a few are the hottest colour. Own motion `glitch`: the block pattern holds, then jumps to a new arrangement (4 steps per loop).
- **scanline** (Glitch): horizontal streaks with every other in-game pixel row darker (a CRT); a two-row tear band shifts sideways, edged in the hottest colour. Own motion `glitch`: the tear jumps to a new row and offset each step.
- **rgbsplit** (Glitch): bold noise shapes drawn three times, a red ghost left and a cyan ghost right, white where all three overlap. Own motion `glitch`: the split width jumps each step.
- **melt** (Fever Dream): noise that sags down each column by its own amount, like wax. Own motion `drip`: the texture runs downward and repeats every texture height (noise `period`, as `rise` does).
- **kaleido** (Fever Dream): six-fold mirrored wedges of noise around the tile's centre. Own motion `flow`: the wedges turn one sixth of a turn per loop (the pattern maps onto itself, so the loop has no seam).
- **huecycle** (Fever Dream): soft swirled bands through the palette as a wheel (the last colour flows back into the first). Own motion `flow`: the wheel turns one full cycle per loop.

**Files:**
- Create: `fx/skins/patternsRun4.ts`, `fx/skins/patternsRun4.test.ts`
- Modify: `fx/skins/patterns.ts` (the switch; the header comment), `fx/skins/motion.test.ts`

**Interfaces:**
- Consumes: F6-A's `PatternKind` and `PatternMotion` additions; `paint.ts` (`at`, `cycle`, `fract`, `mix`, `ramp`, `smoothstep`, `spread`, `PatternPoint`, `Rgb`) and `noise.ts` (`fbm`, `hash2`).
- Produces: `datamosh`, `scanline`, `rgbsplit`, `melt`, `kaleido`, `huecycle` (each `(pal, p, t?) => Rgb`); `RUN4_OWN_MOTION`; `GLITCH_STEPS = 4`; `glitchStep(t: number): number`.

- [ ] **Step 1: Write the failing tests** in `fx/skins/patternsRun4.test.ts` (it reuses the helpers of `patternsLate.test.ts`: copy `PALETTE`, `RGB`, `spec`, `colors`, `isBlend` and `changed` into this file rather than importing a test file).
  ```ts
  import { describe, expect, it } from "vitest";
  import { CASES } from "../../sim/content/cases";
  import type { PatternKind, PatternSpec } from "../../sim/types";
  import { hexToRgb, OWN_MOTION, patternColor, renderPattern, type Rgb } from "./patterns";
  import { GLITCH_STEPS, glitchStep } from "./patternsRun4";

  // The finishes of cases 8–9 (finish spec §7.1), held to the same contract as M3-B's: palette colours or blends of
  // two, every kind distinct, each one's own motion moving and closing its loop.

  const RUN4: PatternKind[] = ["datamosh", "scanline", "rgbsplit", "melt", "kaleido", "huecycle"];
  // PALETTE, RGB, spec(), colors(), isBlend(), changed(): copied from patternsLate.test.ts

  describe("Run 4's finishes", () => {
    it.each(RUN4)("%s paints only palette colours or blends of two", (kind) => {
      const px = renderPattern(spec(kind), 64, 32);
      for (const c of colors(px)) expect(isBlend(c.split(",").map(Number), RGB), `${kind} ${c}`).toBe(true);
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
        for (const s of c.skins) if (s.motion?.pattern === "glitch" || s.motion?.pattern === "drip") expect(OWN_MOTION[s.pattern.kind], s.id).toBe(s.motion.pattern);
    });
  });
  ```
  (The melt check samples one column; `p.v` steps of 1/32 match the 32-row grid: a downward run of 1/32 per 1/32 of phase is a full texture height per loop.)

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/skins/patternsRun4.test.ts`
  Expected: FAIL, because `./patternsRun4` does not exist.

- [ ] **Step 3: Write `fx/skins/patternsRun4.ts`.**
  ```ts
  import type { PatternKind, PatternMotion } from "../../sim/types";
  import { fbm, hash2 } from "./noise";
  import { at, cycle, fract, ramp, smoothstep, spread, type PatternPoint, type Rgb } from "./paint";

  // Six finishes for cases 8–9 (finish spec §7.1): Glitch (datamosh, scanline, rgbsplit) and Fever Dream (melt,
  // kaleido, huecycle). Same contract as patternsLate.ts: a pure function of (palette, point[, phase]); every pixel one
  // palette colour or a blend of two; palettes darkest first; tuned for the 26 × 10 in-game skin at scales 4–7. Glitch's
  // kinds stutter (`glitch`: GLITCH_STEPS held arrangements a loop), melt drips down (`drip`, seamless through the
  // noise's period), kaleido and huecycle turn (`flow`). Every one repeats at phase 1.

  export const RUN4_OWN_MOTION: Partial<Record<PatternKind, PatternMotion>> = {
    datamosh: "glitch",
    scanline: "glitch",
    rgbsplit: "glitch",
    melt: "drip",
    kaleido: "flow",
    huecycle: "flow",
  };

  /** Held arrangements per loop of the `glitch` motion. */
  export const GLITCH_STEPS = 4;

  /** Which held arrangement the loop phase is in (0 for a still skin). */
  export const glitchStep = (t: number): number => Math.floor(fract(t) * GLITCH_STEPS);

  const TAU = Math.PI * 2;
  const hot = (pal: readonly Rgb[]): Rgb => at(pal, pal.length - 1);
  /** In-game pixel rows of the texture (the skin is 10 tall). */
  const SKIN_ROWS = 10;
  /** Whole noise rows per texture height, so a vertical run repeats seamlessly. */
  const rows = (p: PatternPoint): number => Math.max(1, Math.round(p.scale));

  // ── Glitch ──────────────────────────────────────────────────────────────────────────────────────

  /** Macroblocks: a smeared base image in blocks; about a third copy their left neighbour shifted (the mosh), a few
   *  are the hottest colour. Glitch: every step rearranges which blocks mosh. Roles: ramp, last = hot block. */
  export function datamosh(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
    const step = t === undefined ? 0 : glitchStep(t);
    const bw = 1.25;
    const bh = 0.6;
    const bx = Math.floor(p.x / bw);
    const by = Math.floor(p.y / bh);
    const h = hash2(bx, by + 31 * step, p.seed);
    if (h > 0.93) return hot(pal);
    const smear = h < 0.35 ? (1 + Math.floor(hash2(bx, by, p.seed + 7 + step) * 3)) * bw * 0.5 : 0;
    const n = fbm((p.x - smear) * 0.7, Math.floor(p.y / bh) * bh * 0.7, p.seed, 3);
    return ramp(pal.slice(0, Math.max(1, pal.length - 1)), spread(n));
  }

  /** CRT: horizontal streaks, every other in-game row darker; a two-row tear band shifted sideways and edged in the
   *  hottest colour. Glitch: the tear jumps to a new row and offset each step. */
  export function scanline(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
    const step = t === undefined ? 0 : glitchStep(t);
    const row = Math.floor(fract(p.v) * SKIN_ROWS);
    const tearRow = Math.floor(hash2(step, 0, p.seed) * (SKIN_ROWS - 1));
    const inTear = row === tearRow || row === tearRow + 1;
    const shift = inTear ? (hash2(step, 1, p.seed) - 0.5) * p.scale * 0.8 : 0;
    const k = spread(fbm((p.x + shift) * 0.35, p.y * 0.18, p.seed, 3));
    if (inTear && Math.abs(fract((p.x + shift) * 0.5) - 0.5) < 0.04) return hot(pal);
    return ramp(pal, row % 2 === 1 ? k * 0.55 : k);
  }

  /** Bold shapes drawn three times: a red ghost left (role 2), a cyan ghost right (role 3), the shape (role 1) over
   *  the ground (role 0), white where all three overlap (last). Glitch: the split width jumps each step. */
  export function rgbsplit(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
    const step = t === undefined ? 0 : glitchStep(t);
    const shape = (dx: number) => fbm((p.x + dx) * 0.55, p.y * 0.55, p.seed, 3) > 0.52;
    const d = 0.25 + 0.45 * hash2(step, 2, p.seed);
    const c = shape(0);
    const r = shape(-d);
    const b = shape(d);
    if (c && r && b) return hot(pal);
    if (c) return at(pal, 1);
    if (r) return at(pal, 2);
    if (b) return at(pal, 3);
    return at(pal, 0);
  }

  // ── Fever Dream ─────────────────────────────────────────────────────────────────────────────────

  /** Wax: noise that sags down each column by its own amount. Drip: the texture runs down one height a loop (the
   *  noise repeats every height, so the loop has no seam). The phase is wrapped first, so phase 1 is exactly phase 0. */
  export function melt(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
    const P = rows(p);
    const col = Math.floor(p.x * 1.2);
    const sag = 0.35 * P * smoothstep(0, 1, hash2(col, 0, p.seed)) * (0.6 + 0.4 * Math.sin(p.x * 2.1));
    const yy = (p.v - fract(t ?? 0)) * P - sag;
    return ramp(pal, spread(fbm(p.x * 0.6, yy, p.seed, 4, P)));
  }

  /** Six-fold mirrored wedges of noise around each tile's centre. Flow: they turn a sixth of a turn a loop, which maps
   *  the pattern onto itself. */
  export function kaleido(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
    const W = TAU / 6;
    const cx = fract(p.x / 2) * 2 - 1;
    const cy = fract(p.y / 2) * 2 - 1;
    const r = Math.hypot(cx, cy);
    let a = Math.atan2(cy, cx) + W * fract(t ?? 0);
    a = ((a % W) + W) % W;
    if (a > W / 2) a = W - a;
    const n = fbm(r * Math.cos(a) * 1.4 + 3, r * Math.sin(a) * 1.4 + 3, p.seed, 3);
    return cycle(pal, spread(n) * 1.2 + r * 0.35);
  }

  /** Soft swirled bands through the palette as a wheel. Flow: the wheel turns one full cycle a loop. */
  export function huecycle(pal: readonly Rgb[], p: PatternPoint, t?: number): Rgb {
    const warp = fbm(p.x * 0.3, p.y * 0.3, p.seed + 5, 3);
    return cycle(pal, fbm(p.x * 0.35 + 1.5 * warp, p.y * 0.35, p.seed, 3) * 1.4 + fract(t ?? 0));
  }
  ```

- [ ] **Step 4: Route them.** In `fx/skins/patterns.ts`:
  - import the six functions and `RUN4_OWN_MOTION` from `./patternsRun4`; replace F6-A's interim group of six `case` labels with
  ```ts
      case "datamosh":
        return datamosh(pal, p, phase);
      case "scanline":
        return scanline(pal, p, phase);
      case "rgbsplit":
        return rgbsplit(pal, p, phase);
      case "melt":
        return melt(pal, p, phase);
      case "kaleido":
        return kaleido(pal, p, phase);
      case "huecycle":
        return huecycle(pal, p, phase);
  ```
  - `OWN_MOTION` is re-exported from `patternsLate.ts` today. Replace `export { OWN_MOTION } from "./patternsLate";` with
  ```ts
  import { OWN_MOTION as LATE_OWN_MOTION } from "./patternsLate";
  /** The motion each kind draws itself (cases 4–9): finishAt hands it the loop phase and lays nothing generic on top. */
  export const OWN_MOTION: Partial<Record<PatternKind, PatternMotion>> = { ...LATE_OWN_MOTION, ...RUN4_OWN_MOTION };
  ```
    (import `PatternKind`, `PatternMotion` types) and update the header comment: "cases 4-7's thirteen richer ones in patternsLate.ts, cases 8-9's six in patternsRun4.ts".
  - Leave `motion.ts`'s drift fallback for `glitch`/`drip` as F6-A wrote it: it now only applies to a kind that does not draw those motions itself (a test below refuses such case data).
  - `fx/skins/motion.test.ts`: next to the existing "every rise skin draws its own rise" test, nothing changes (the new data test is in `patternsRun4.test.ts`).

- [ ] **Step 5: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/fx/skins`
  Expected: PASS. If a kind fails "moves with its phase" by a few pixels or "at least three colours", tune that kind's constants (block size, threshold, warp) — never relax the test. Then look at them: `SKIN_PREVIEW=1 npx vitest run tools/skins` writes `art/preview/patterns/`; open the Glitch and Fever Dream sheets (Read the PNGs) and check each skin reads at 26 × 10: a skin that is mush, or one colour, gets its palette or scale changed in `sim/content/casesRun4.ts` (data only).

- [ ] **Step 6: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/fx/skins src/modules/casecremental/sim/content/casesRun4.ts
  git commit -m "feat(run4): six finishes - datamosh, scanline tear, RGB split, melting, kaleidoscope, hue-cycling - with their own motions

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 2: Case boxes, The Last Case's chest, the shred sound — **credit approval gate**

Three images and one sound, through the M3-C pipeline:
- **Image A** — the two case boxes as one 2-row grid image (one generation for both cases, as M3 did for its four), reference `art/source/case-bootcamp.png`. Split into `art/source/case-glitch.png` and `case-feverdream.png` (4 frames each: closed, lid lifting, half open with its glow, open).
- **Image B** — The Last Case's chest: a 1 × 4 sheet with the same frames and composition as `art/source/vault-case-sheet-1x4.png` (attached as the reference): black glass with gold glitch seams. Built as `vault-case-4`; F6-C wires it.
- **Sound** — `upgrader-shred`: the Upgrader's loss.

**Tool and cost.** ElevenLabs MCP: `creative_generate_image`, model `gpt-image-2`, two takes per image (`generations_count: 2`), the reference wired in on a flow; the shred sound as an sfx flow node (`eleven_text_to_sound_v2`, 2 variants, `duration_seconds` passed in the node's model parameters — see `docs/feature-history/casecremental-run1.md`). M3-C measured ~185 credits per image take and ~50 per sound variant, so the estimate is **~370 (A) + ~370 (B) + ~100 (sound) ≈ 840 credits**; backgrounds are keyed out locally for free (flood fill from the border, as commit `4475ec0` did) rather than with `birefnet-v2-bg-removal`. F5 spends the rest of the approved 4,000 credits on music (1,378 were left), and spec §6 requires a number from the user before going past it.

**Files:**
- Create: `art/source/case-glitch.png`, `art/source/case-feverdream.png`, `art/source/vault-case-4-sheet-1x4.png` (+ the raw takes beside them), `src/modules/casecremental/assets/sprites/case-glitch.{png,json}`, `case-feverdream.{png,json}`, `vault-case-4.{png,json}` (built), `src/modules/casecremental/assets/audio/upgrader-shred-1.mp3` (`-2` if it is good)
- Modify: `art/manifest.json`, `src/modules/casecremental/fx/audio/sounds.ts`

**Interfaces:**
- Produces: sprite ids `case-glitch`, `case-feverdream` (sheets, 4 frames, the size of the other case sheets), `vault-case-4` (4 frames of `VAULT_FRAME`, 68 × 78 like `vault-case.json`); `SoundId` `"upgrader-shred"` **only if the sound was generated** (Task 5 checks).

- [ ] **Step 1: Price it.** Read `art/PROMPTS.md`, the `case-*` and `vault-case*` entries in `art/manifest.json`, and the M3-C plan. Create one flow (`creative_create_flow`), upload `art/source/case-bootcamp.png` and `art/source/vault-case-sheet-1x4.png` as references (`creative_create_asset_upload` with the exact byte size, PUT the bytes with curl, `creative_finalize_asset_upload`). Call each generation with `estimate_only: true`:
  - Image A prompt (+ the shared style line + the sheet rules from `art/PROMPTS.md`): "Sprite sheet, 2 rows × 4 frames, the same weapon case in each row, each frame slightly wider than tall: 1) closed, 2) lid lifting a little, 3) lid half open with a glow inside, 4) fully open, glow inside. Row 1: a matte black case with glitching RGB-split edges, misaligned scanline stripes across its sides and a cracked pixel-grid lid; the glow inside is electric cyan and magenta. Row 2: a dreamy pastel case melting at its edges like warm wax, a swirling kaleidoscope pattern on its lid and drips running down its sides; the glow inside cycles through rainbow hues." Reference: `case-bootcamp.png`.
  - Image B prompt: "the same heavy vault chest as the reference, rebuilt in black glass with thin glowing gold seams that glitch and offset like a broken screen: 1) locked, 2) seams glowing gold, 3) bursting with white and gold light, 4) open." Reference: `vault-case-sheet-1x4.png`.
  - Sound prompt (+ the sound style line from the M3-C plan): "A short paper shredder chewing through a handful of trading cards, then a small deflating sigh of a machine powering down; disappointed, a little comic." 1.5 s, 2 variants.
  Add the three estimates and read the credits already spent in this finish work from F5's commits and its feature-history notes.

- [ ] **Step 2: GATE — stop and ask the user.** Report: the three estimates, their total, what F5 spent and what is left of the approved 4,000, and the free fallback (Step 6). Ask: "F6 needs about <total> ElevenLabs credits for the Glitch and Fever Dream case boxes, The Last Case's chest and the Upgrader's shred sound. Approve that number? (If not, I'll derive them from existing art with ffmpeg at no cost.)" **Do not call any generation tool until the user answers.** A subagent executing this plan returns to its controller with status `NEEDS_APPROVAL` and the report; the controller asks the user. If the user approves a smaller number, generate in this order until it runs out: Image B, Image A, the sound; build the rest with Step 6.

- [ ] **Step 3 (approved): Generate.** Call each generation once (without `estimate_only`), poll `creative_get_flow_run_status` until done, download both takes to `art/source/` (`cases-run4-take-<n>.png`, `vault-case-4-take-<n>.png`) and the sound variants to `art/source/audio/upgrader-shred-take-<n>.mp3`. Keep a running tally of credits.

- [ ] **Step 4 (approved): Pick, key and cut.** Read each take (the PNGs). Pick per image the take whose frames are evenly spaced, the same size and in the closed → open order. Key a flat background out locally (flood fill from the border, threshold on colour distance; a short Node script in the scratchpad using `tools/art/png.mjs` to read and write). Cut image A's rows into `case-glitch.png` and `case-feverdream.png`. Copy the chosen chest take to `vault-case-4-sheet-1x4.png`. If a sheet's frames touch, space them by hand in the source rather than paying for another take.

- [ ] **Step 5 (approved): The sound.** Convert the chosen variant(s) to `assets/audio/upgrader-shred-1.mp3` (and `-2`), 96–192 kbps like the others. Measure `ffmpeg -i f -af volumedetect -f null -` and `ffprobe` duration; match the level within ~3 dB of `tradeup-press` with the SOUNDS gain. Add `"upgrader-shred": { bus: "sfx", gain: <measured>, maxSeconds: 1.6 },` to `SOUNDS` under a `// Run 4 (F6)` comment, and its manifest `audio` entry `{ "id": "upgrader-shred", "kind": "sfx", "variants": <n>, "duration": 1.5, "prompt": "…" }`.

- [ ] **Step 6 (declined, or the budget ran out): the free fallback with ffmpeg.** No generation. Derive each missing image from existing art, keeping alpha (`format=rgba` in, `format=rgba` out):
  - Glitch from Mainframe (same silhouette, colour-split): `ffmpeg -i art/source/case-mainframe.png -vf "format=rgba,rgbashift=rh=-3:bh=3:edge=wrap,hue=s=0.4,eq=contrast=1.3:brightness=-0.08,format=rgba" art/source/case-glitch.png`
  - Fever Dream from Neon Nights (pastel, hue-turned): `ffmpeg -i art/source/case-neon.png -vf "format=rgba,hue=h=140:s=0.8,eq=brightness=0.1:saturation=0.9,format=rgba" art/source/case-feverdream.png`
  - The Last Case's chest from Vault III (black glass, gold seams): `ffmpeg -i art/source/vault-case-3-sheet-1x4.png -vf "format=rgba,hue=h=-15:s=0.55,eq=contrast=1.4:brightness=-0.12,colorbalance=rh=0.15:gh=0.1:bh=-0.2,format=rgba" art/source/vault-case-4-sheet-1x4.png`
  - No shred sound: Task 5 plays `dayjob-nopay` with a slowed `tradeup-press` instead.
  Read each output PNG; adjust the filter numbers until the box reads as its theme (black/RGB for Glitch, pastel/rainbow for Fever Dream, black-and-gold for the chest). Say in the commit body that these were derived, not generated.

- [ ] **Step 7: Build.** Add to `art/manifest.json` `assets` (keeping the JSON valid):
  ```json
  { "id": "case-glitch", "source": "case-glitch.png", "kind": "sheet", "frames": 4, "targetH": 17 },
  { "id": "case-feverdream", "source": "case-feverdream.png", "kind": "sheet", "frames": 4, "targetH": 17 },
  { "id": "vault-case-4", "source": "vault-case-4-sheet-1x4.png", "kind": "sheet", "frames": 4, "rows": 1, "targetH": 64 }
  ```
  (each with a `"prompt"` field holding the prompt, or the ffmpeg recipe for a derived one). Run `npm run art`. Check `art/preview/` for the three sheets and the built JSON: the cases' closed frame has the footprint of `case-inferno.json` (adjust `targetH` if a generated case came out wider, as M3 did with 17); `vault-case-4.json` is `{ frames: 4, frameW: 68, frameH: 78 }` like `vault-case.json` (the vault layout's constants depend on it — the M3-E commit body explains the one stray pixel that makes targetH 64 give 78).

- [ ] **Step 8: Tests and commit.**
  Run: `npx vitest run tools src/modules/casecremental/fx/pixel/sprites.test.ts src/modules/casecremental/fx/audio && npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add art/manifest.json art/source/case-glitch.png art/source/case-feverdream.png art/source/vault-case-4-sheet-1x4.png art/source/cases-run4-take-*.png art/source/vault-case-4-take-*.png art/preview src/modules/casecremental/assets/sprites/case-glitch.* src/modules/casecremental/assets/sprites/case-feverdream.* src/modules/casecremental/assets/sprites/vault-case-4.*
  # if generated: also art/source/audio/upgrader-shred-take-*.mp3 src/modules/casecremental/assets/audio/upgrader-shred-*.mp3 src/modules/casecremental/fx/audio/sounds.ts
  git commit -m "assets(art): Glitch and Fever Dream case boxes, The Last Case's chest sheet, the Upgrader's shred - built by npm run art

  <generated with ElevenLabs gpt-image-2, take N chosen, <credits> credits | derived with ffmpeg from case-mainframe / case-neon / vault-case-3>

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```
  (Stage only the files that exist; write the real provenance in the body.)

---

### Task 3: Slot Machine and Assembly Line — the bench's evolutions

- **Slot Machine:** ten reels show as **five slot columns of two windows** (one skin per window, scrolling past like a slot drum), inside a gold slot-machine frame with column dividers and a row of small marquee lamps along its top. The frame is up whenever Slot Machine is owned; the windows only while ten reels spin.
- **Assembly Line:** a conveyor belt along the mat's back edge, from the table's left end to the case spot, its rollers turning (stripes sliding at a steady speed) while auto-spin is on; each auto-spin buy slides a case box along it into the bench (a one-shot 0.4 s ride on `autoSpinPulled`). The arm (F2) stays on the mat's right end; the belt never overlaps it.

**Files:**
- Create: `fx/reel/slotLayout.ts`, `fx/reel/slotLayout.test.ts`, `fx/stations/evolutionRules.ts`, `fx/stations/evolutionRules.test.ts`, `fx/stations/EvolutionLooks.ts`
- Modify: `fx/pixel/BenchReels.ts` (`apply`), `fx/stations/Stations.ts` (own `EvolutionLooks`), `fx/pixel/layout.test.ts` (sweep)

**Interfaces:**
- Consumes: `RunState.evolutions.owned`, `RunState.autoSpin.on`, `RunState.bench`, the events `evolved`, `autoSpinPulled`; `benchReelArea`, `TableLayout.you` (`reel`, `mat`, `caseSpot`, `arm` from F2), `MULTI_OPEN_MAX`.
- Produces:
  ```ts
  // fx/reel/slotLayout.ts
  export const SLOT_COLUMNS = 5;
  export function slotRects(area: Rect, n: number, gap?: number): Rect[];
  // fx/stations/evolutionRules.ts
  export const SLOT_FRAME_PAD = 3;
  export function slotFrameRect(l: TableLayout, b: Bench): Rect;
  export function beltRect(l: TableLayout): Rect | null;
  export const BELT_SPEED: number;          // world px / s
  export const BELT_RIDE_SECONDS = 0.4;
  export function rideAt(belt: Rect, to: Pt, t: number): Pt | null;
  // fx/stations/EvolutionLooks.ts
  export class EvolutionLooks { readonly under: Container; readonly over: Container; readonly hd: Container; layout(l); update(dt, s); onEvent(e); pointerMove(p); destroy() }
  ```

- [ ] **Step 1: Write the failing tests.**
  `fx/reel/slotLayout.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { benchReelArea, tableLayout } from "../pixel/layout";
  import { pixelViewport } from "../pixel/viewport";
  import { SMALL_CELL_W } from "./cellLook";
  import { SLOT_COLUMNS, slotRects } from "./slotLayout";

  const VIEWPORTS: Array<[number, number]> = [[1920, 1080], [1280, 720], [1024, 768], [820, 1180], [390, 844], [360, 640]];

  describe("Slot Machine's ten reels", () => {
    it("are five columns of two windows, left to right then top to bottom", () => {
      const r = slotRects({ x: 10, y: 20, w: 150, h: 60 }, 10);
      expect(SLOT_COLUMNS).toBe(5);
      expect(r).toHaveLength(10);
      expect(r[0]!.y).toBe(r[4]!.y);
      expect(r[5]!.y).toBeGreaterThan(r[0]!.y);
      expect(r[1]!.x).toBeGreaterThan(r[0]!.x);
      expect(r[5]!.x).toBe(r[0]!.x);
    });

    it.each(VIEWPORTS)("fit the tall reel window at %ix%i: inside it, apart, at least a clean tile wide (Review Focus 2)", (w, h) => {
      const l = tableLayout(pixelViewport(w, h));
      const area = benchReelArea(l, 10, true);
      const rs = slotRects(area, 10);
      for (const r of rs) {
        expect(r.x).toBeGreaterThanOrEqual(area.x);
        expect(r.y).toBeGreaterThanOrEqual(area.y);
        expect(r.x + r.w).toBeLessThanOrEqual(area.x + area.w);
        expect(r.y + r.h).toBeLessThanOrEqual(area.y + area.h);
        expect(r.w).toBeGreaterThanOrEqual(SMALL_CELL_W);
        expect(r.h).toBeGreaterThanOrEqual(8);
      }
      for (let i = 0; i < rs.length; i++)
        for (let j = i + 1; j < rs.length; j++) {
          const a = rs[i]!;
          const b = rs[j]!;
          const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
          expect(apart, `${i} and ${j}`).toBe(true);
        }
    });
  });
  ```
  (`SMALL_CELL_W` is F1's cell width for short strips, `fx/reel/cellLook.ts`; if a viewport cannot give 24 px a column, `slotRects` must still return ten disjoint windows and the strips show clean rarity tiles — then assert `r.w >= 16` for that viewport and note it.)
  `fx/stations/evolutionRules.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { benchReelArea, tableLayout } from "../pixel/layout";
  import { pixelViewport } from "../pixel/viewport";
  import { BELT_RIDE_SECONDS, beltRect, rideAt, slotFrameRect, SLOT_FRAME_PAD } from "./evolutionRules";

  const VIEWPORTS: Array<[number, number]> = [[1920, 1080], [1280, 720], [820, 1180], [390, 844], [360, 640]];

  describe("the bench's evolutions", () => {
    it("frames the reel window: the one-reel window at rest, the tall one while ten reels spin", () => {
      const l = tableLayout(pixelViewport(1920, 1080));
      const rest = slotFrameRect(l, { phase: "empty" });
      expect(rest).toEqual({
        x: l.you.reel.x - SLOT_FRAME_PAD,
        y: l.you.reel.y - SLOT_FRAME_PAD,
        w: l.you.reel.w + 2 * SLOT_FRAME_PAD,
        h: l.you.reel.h + 2 * SLOT_FRAME_PAD,
      });
      const reels = Array.from({ length: 10 }, () => ({ drop: {} as never, tease: null, duration: 1 }));
      const spin = slotFrameRect(l, { phase: "spinning", caseId: "bootcamp", reels, elapsed: 0, fullDuration: 1 });
      expect(spin.h).toBe(benchReelArea(l, 10, true).h + 2 * SLOT_FRAME_PAD);
    });

    it.each(VIEWPORTS)("lays the belt on the table, left of the case, clear of the arm (%ix%i)", (w, h) => {
      const l = tableLayout(pixelViewport(w, h));
      const b = beltRect(l);
      if (!b) return; // too narrow for a belt: no belt
      expect(b.x).toBeGreaterThanOrEqual(l.table.x);
      expect(b.x + b.w).toBeLessThanOrEqual(l.you.caseSpot.x);
      const arm = l.you.arm;
      expect(b.x + b.w <= arm.x || arm.x + arm.w <= b.x || b.y + b.h <= arm.y || arm.y + arm.h <= b.y).toBe(true);
    });

    it("rides a case from the belt's start into the case spot in 0.4 s, then is gone", () => {
      const belt = { x: 10, y: 50, w: 60, h: 4 };
      const to = { x: 90, y: 48 };
      expect(rideAt(belt, to, 0)).toEqual({ x: 10, y: 48 });
      expect(rideAt(belt, to, BELT_RIDE_SECONDS / 2)!.x).toBeGreaterThan(10);
      expect(rideAt(belt, to, BELT_RIDE_SECONDS)).toBeNull();
    });
  });
  ```
  In `fx/pixel/layout.test.ts`, the viewport sweep needs no change (the belt is derived, not in `TableLayout`).

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/reel/slotLayout.test.ts src/modules/casecremental/fx/stations/evolutionRules.test.ts`
  Expected: FAIL (the files do not exist).

- [ ] **Step 3: Write `fx/reel/slotLayout.ts`.**
  ```ts
  import type { Rect } from "../pixel/layout";

  // Slot Machine's look (finish spec §7.3): its ten reels as five slot columns of two windows each, one skin a window,
  // in whole pixels inside the reel area. The strips inside are ordinary reels (F1's cell look draws clean tiles where a
  // window is too small for art).

  export const SLOT_COLUMNS = 5;
  /** A window's tallest: a slot drum shows one skin, not a strip. */
  const SLOT_MAX_H = 26;

  /** n windows (columns of SLOT_COLUMNS, left to right, then the next row), centred in `area`. */
  export function slotRects(area: Rect, n: number, gap = 2): Rect[] {
    const rowsN = Math.max(1, Math.ceil(n / SLOT_COLUMNS));
    const x0 = Math.ceil(area.x);
    const y0 = Math.ceil(area.y);
    const areaW = Math.floor(area.x + area.w) - x0;
    const areaH = Math.floor(area.y + area.h) - y0;
    const w = Math.max(1, Math.floor((areaW - gap * (SLOT_COLUMNS - 1)) / SLOT_COLUMNS));
    const h = Math.max(1, Math.min(SLOT_MAX_H, Math.floor((areaH - gap * (rowsN - 1)) / rowsN)));
    const left = x0 + Math.floor((areaW - (SLOT_COLUMNS * w + gap * (SLOT_COLUMNS - 1))) / 2);
    const top = y0 + Math.floor((areaH - (rowsN * h + gap * (rowsN - 1))) / 2);
    return Array.from({ length: n }, (_, i) => ({
      x: left + (i % SLOT_COLUMNS) * (w + gap),
      y: top + Math.floor(i / SLOT_COLUMNS) * (h + gap),
      w,
      h,
    }));
  }
  ```
  `fx/pixel/BenchReels.ts` `apply()`:
  ```ts
    private apply(): void {
      if (!this.l) return;
      const area = benchReelArea(this.l, this.n, this.tall);
      // Slot Machine (Run 4): more reels than multi-open's widest are five slot columns
      this.root.layout(this.n > MULTI_OPEN_MAX ? slotRects(area, this.n) : stackRects(area, this.n, REEL_MAX_H));
    }
  ```
  (import `slotRects` and `MULTI_OPEN_MAX` from `../../sim/tuning`).

- [ ] **Step 4: Write `fx/stations/evolutionRules.ts`** (Task 4 adds the bot's, the seller's and the hand's rules to it).
  ```ts
  import type { Bench } from "../../sim/run";
  import { benchReelArea, ITEM_SIZE, type Pt, type Rect, type TableLayout } from "../pixel/layout";

  // The evolutions' looks on the table (finish spec §7.3), as pure functions of the layout and the sim's state, so a
  // reload draws the same picture: Slot Machine's gold frame, Assembly Line's belt (this task); Cartel's shades, Money
  // Printer's bills, Hot Hand's flames (Task 4).

  /** World px the gold frame stands out around the reel window. */
  export const SLOT_FRAME_PAD = 3;

  /** Slot Machine's frame: around the one-reel window, or the tall window while more than one reel spins. */
  export function slotFrameRect(l: TableLayout, b: Bench): Rect {
    const n = b.phase === "spinning" ? b.reels.length : 1;
    const r = benchReelArea(l, n, n > 1);
    return { x: r.x - SLOT_FRAME_PAD, y: r.y - SLOT_FRAME_PAD, w: r.w + 2 * SLOT_FRAME_PAD, h: r.h + 2 * SLOT_FRAME_PAD };
  }

  /** The belt's thickness, world px; a belt shorter than BELT_MIN_W is not drawn. */
  const BELT_H = 4;
  const BELT_MIN_W = 16;
  /** The rollers' stripes slide this fast (world px / s) while auto-spin is on. */
  export const BELT_SPEED = 14;
  export const BELT_RIDE_SECONDS = 0.4;

  /** Assembly Line's belt: on the mat's back edge, from the table's left end to just left of the case; null when the
   *  table leaves no room. */
  export function beltRect(l: TableLayout): Rect | null {
    const right = Math.floor(l.you.caseSpot.x - ITEM_SIZE.case.w / 2) - 1;
    const left = l.table.x + 2;
    if (right - left < BELT_MIN_W) return null;
    return { x: left, y: Math.round(l.you.caseSpot.y) - BELT_H, w: right - left, h: BELT_H };
  }

  /** A case riding the belt `t` s after the buy: from its start into the case spot (ease-out); null once it is in. */
  export function rideAt(belt: Rect, to: Pt, t: number): Pt | null {
    if (t >= BELT_RIDE_SECONDS) return null;
    const k = 1 - (1 - Math.max(0, t / BELT_RIDE_SECONDS)) ** 2;
    return { x: belt.x + (to.x - belt.x) * k, y: to.y };
  }
  ```

- [ ] **Step 5: Write `fx/stations/EvolutionLooks.ts`** (pixel world for the frame and the belt; Task 4 adds the rest):
  - Fields: `under = new Container()` (the belt, under the bench), `over = new Container()` (the gold frame, over the reels), `hd = new Container()`; `private readonly frame = new Graphics()`, `private readonly belt = new Graphics()`, `private readonly rider: Sprite` (frame 0 of `case-<id>` from `d.lib`, hidden), `private rideT = Infinity`, `private rideCase = ""`, `private beltOffset = 0`, `private l: TableLayout | null = null`.
  - `layout(l)`: keeps `l`, redraws the belt's static parts.
  - `update(dt, s)`:
    - `const owned = s.evolutions.owned;`
    - Slot Machine: `this.frame.visible = owned.includes("slotMachine")`; if visible, redraw `slotFrameRect(l, s.bench)` only when the rect changed: a 2-px gold border (`0xffd34d` outer, `0x8a5a12` inner line), four 1-px dividers between the slot columns when `s.bench` spins more than `MULTI_OPEN_MAX` reels (x from `slotRects`), and five 2 × 2 marquee lamps along the top edge in warm white — **static colours, no blinking**.
    - Assembly Line: `this.belt.visible = owned.includes("assemblyLine") && beltRect(l) !== null`; while `s.autoSpin.on`, `beltOffset = (beltOffset + BELT_SPEED * dt) % 4`; redraw the belt: a dark rubber strip, 1-px roller stripes every 4 px offset by `beltOffset`, brass end caps.
    - The rider: `rideT += dt`; `const p = rideAt(belt, l.you.caseSpot, rideT)`; `rider.visible = p !== null`, placed at `p`.
  - `onEvent(e)`: `autoSpinPulled` with Assembly Line owned → `rideT = 0`, `rideCase = e.caseId`, the rider's texture = frame 0 of `case-${e.caseId}`; `evolved` → the reveal (gold particles at the look's spot via `hd.particles.burst`, `hd.flash(0xffd34d, 0.25)` — the gate decides —, `audio.play("stage-up")`, float text `t("float.evolved")` at the table's centre); `runStarted` → `rideT = Infinity`.
  - `destroy()`: destroys its graphics.
  - In `Stations.ts`: field `private readonly evolutions: EvolutionLooks;`; in the constructor `this.evolutions = new EvolutionLooks(d); this.under.addChild(this.evolutions.under); this.reels.addChild(this.evolutions.over); this.hd.addChild(this.evolutions.hd);` (the frame goes in the reel row after the bot's reels, so it draws over your reel window); call it in `layout`, `update`, `onEvent`, `destroy`; the header comment lists "the evolutions' looks (Run 4)".
  - i18n: `"float.evolved": "EVOLVED!"` / `"ЭВОЛЮЦИЯ!"` (float budget 12).

- [ ] **Step 6: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/fx`
  Expected: PASS.

- [ ] **Step 7: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/fx/reel/slotLayout.ts src/modules/casecremental/fx/reel/slotLayout.test.ts src/modules/casecremental/fx/pixel/BenchReels.ts src/modules/casecremental/fx/stations src/modules/casecremental/i18n
  git commit -m "feat(run4): Slot Machine's gold frame and five slot columns, Assembly Line's belt feeding the bench

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 4: Cartel, Money Printer and Hot Hand — the machines' and the hand's evolutions

- **Cartel:** the bot wears shades (a 2-px black bar across its visor with one white glint pixel) and a gold chain (a 1-px gold arc with a 2 × 2 medallion) while Cartel is owned, drawn in code and moving with the bot.
- **Money Printer:** the auto-seller sprays bills: each seller sale shoots a few green bill sprites from the seller to the HUD's cash ("the counter"), a steady torrent at Run 4's rate — pooled and capped.
- **Hot Hand:** while it burns (owned and combo ≥ 25), flames trail your pointer (the hand) on the table, and the HUD's combo meter gets flames (CSS, a small flicker under 0.1).

**Files:**
- Modify: `fx/stations/evolutionRules.ts` (+ test), `fx/stations/EvolutionLooks.ts`, `fx/stations/Stations.ts` (`pointerMove` forwards; `sold` sales), `game/view.ts`, `game/view.test.ts`, `ui/Hud.tsx`, `ui/styles.ts`, `ui/styles.test.ts`

**Interfaces:**
- Consumes: `RunState.evolutions`, `RunState.combo`, `HOT_HAND_MIN_COMBO`, the `sold` event (`source: "seller"`), `l.bot.spot`, `l.seller`, `d.hud()`.
- Produces (`evolutionRules.ts`): `SHADES: { dx: number; dy: number; w: number }`, `CHAIN: { dx: number; dy: number; w: number }` (offsets from the bot's spot, measured from the bot art), `BILLS_MAX = 40`, `BILLS_PER_SALE = 3`, `BILL_FLIGHT_SECONDS = 0.7`, `billsToLaunch(alive: number, sales: number): number`, `FLAMES_MAX = 30`, `FLAMES_PER_SECOND = 40`, `flamesToEmit(alive: number, dt: number, carry: number): { n: number; carry: number }`, `hotHand(s: Pick<RunState, "evolutions" | "combo">): boolean`. `GameView.hotHand: boolean`.

- [ ] **Step 1: Write the failing tests** (add to `fx/stations/evolutionRules.test.ts`):
  ```ts
  describe("the machines' and the hand's evolutions", () => {
    it("caps the bills and the flames (Review Focus 4)", () => {
      expect(billsToLaunch(0, 1)).toBe(BILLS_PER_SALE);
      expect(billsToLaunch(BILLS_MAX - 2, 5)).toBe(2);
      expect(billsToLaunch(BILLS_MAX, 50)).toBe(0);
      let carry = 0;
      let alive = 0;
      for (let i = 0; i < 600; i++) {
        const r = flamesToEmit(alive, 1 / 60, carry);
        carry = r.carry;
        alive = Math.min(FLAMES_MAX, alive + r.n);
        expect(alive).toBeLessThanOrEqual(FLAMES_MAX);
      }
      expect(flamesToEmit(0, 1, 0).n).toBe(Math.min(FLAMES_MAX, FLAMES_PER_SECOND));
    });

    it("Hot Hand burns only while owned and the combo is 25 or more", () => {
      const s = (owned: boolean, combo: number) => ({ evolutions: { owned: owned ? ["hotHand" as const] : [], bestCombo: 0, pulls: 0 }, combo });
      expect(hotHand(s(true, 25))).toBe(true);
      expect(hotHand(s(true, 24))).toBe(false);
      expect(hotHand(s(false, 50))).toBe(false);
    });

    it("puts the shades and the chain on the bot's box", () => {
      const box = ITEM_SIZE.bot;
      for (const part of [SHADES, CHAIN]) {
        expect(Math.abs(part.dx) + part.w / 2).toBeLessThanOrEqual(box.w / 2);
        expect(-part.dy).toBeGreaterThan(0);
        expect(-part.dy).toBeLessThan(box.h);
      }
    });
  });
  ```
  `game/view.test.ts`: `it("says when Hot Hand burns", …)`: a Run 4 run with `evolutions.owned = ["hotHand"]`, combo 24 → `buildView(run).hotHand === false`; combo 25 → `true`.
  `ui/styles.test.ts`: `it("the combo meter's flames flicker by less than 0.1", …)`: parse the `@keyframes cc-flame` block in `UI_CSS` and check every `opacity` value lies within a 0.09 span.

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/stations/evolutionRules.test.ts src/modules/casecremental/game/view.test.ts src/modules/casecremental/ui/styles.test.ts`
  Expected: FAIL.

- [ ] **Step 3: The rules** (append to `fx/stations/evolutionRules.ts`; import `HOT_HAND_MIN_COMBO` from `../../sim/tuning`, `evolved` from `../../sim/evolved`, `type RunState`):
  ```ts
  /** Cartel's shades and chain, world px from the bot's spot (bottom-centre of its 40 × 48 box), measured on the bot's
   *  idle frame. Re-measure if the bot art is rebuilt. */
  export const SHADES = { dx: 4, dy: -36, w: 12 } as const;
  export const CHAIN = { dx: 0, dy: -24, w: 14 } as const;

  /** Money Printer's bills: at most BILLS_MAX in the air, BILLS_PER_SALE per seller sale while there is room. */
  export const BILLS_MAX = 40;
  export const BILLS_PER_SALE = 3;
  export const BILL_FLIGHT_SECONDS = 0.7;
  export const billsToLaunch = (alive: number, sales: number): number => Math.max(0, Math.min(BILLS_MAX - alive, sales * BILLS_PER_SALE));

  /** Hot Hand's flames at the pointer: FLAMES_PER_SECOND, never more than FLAMES_MAX alive; `carry` keeps the fraction. */
  export const FLAMES_MAX = 30;
  export const FLAMES_PER_SECOND = 40;
  export function flamesToEmit(alive: number, dt: number, carry: number): { n: number; carry: number } {
    const want = carry + FLAMES_PER_SECOND * dt;
    const n = Math.max(0, Math.min(FLAMES_MAX - alive, Math.floor(want)));
    return { n, carry: want - Math.floor(want) };
  }

  /** Hot Hand burns: owned, and the combo at least HOT_HAND_MIN_COMBO. */
  export const hotHand = (s: Pick<RunState, "evolutions" | "combo">): boolean => evolved(s, "hotHand") && s.combo >= HOT_HAND_MIN_COMBO;
  ```

- [ ] **Step 4: The looks** in `EvolutionLooks.ts`:
  - **Cartel:** a `Graphics` drawn once (shades bar + glint, chain arc + medallion) added to `over`; each frame `visible = owned.includes("cartel") && s.bot.awake`, positioned at `l.bot.spot + SHADES/CHAIN` plus the bot actor's current offset (read it from `BotStation`'s sprite: give `BotSprite` a getter `offset(): Pt` returning its container position delta if it bobs; if the bot's frames bob inside the frame, add `SHADES_DY[frame]` measured per frame). In portrait the bot has no reel but still stands: the shades follow it there too.
  - **Money Printer:** a `SpritePool` of 4 × 2 green bill sprites (a 1-px darker band) in `hd`; `EvolutionLooks.onEvent` (Stations already forwards every event) handles `sold` with `source === "seller"` while Money Printer is owned → `billsToLaunch(alive, 1)` bills from `hd.toScreen(l.seller)` toward `d.hud()` on a slight arc with ±25 % jitter, each `BILL_FLIGHT_SECONDS`, spinning flat (scale.x = cos), released when they land. Sales keep their own coin juice; the bills are on top.
  - **Hot Hand:** `pointerMove(p)` stores the last pointer (world px; `Stations.pointerMove` forwards it); each frame while `hotHand(s)`: `flamesToEmit` new flame particles at `hd.toScreen(pointer)` through `hd.particles.burst(at, color, n, speed, -400)` with colours from `[0xffd34d, 0xff8a1e, 0xe8362a]` (a negative gravity rises); the alive count is tracked by the look (each flame lives 0.5 s). No pointer seen yet → no flames.
  - `game/view.ts`: `GameView.hotHand: boolean`, computed in `game/viewRun4.ts` as `evolved(s, "hotHand") && s.combo >= HOT_HAND_MIN_COMBO` (from the sim; `game/` never imports `fx/`), set in `buildView` as `hotHand: hotHandView(run)`.
  - `ui/Hud.tsx`: the combo element gets `className={view.hotHand ? "cc-combo cc-hot" : "cc-combo"}`; `ui/styles.ts` adds:
  ```css
  .cc-hot { position: relative; }
  .cc-hot::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: 100%; height: calc(4px * var(--px));
    background: linear-gradient(0deg, #e8362a, #ff8a1e 50%, #ffd34d 80%, transparent);
    clip-path: polygon(0 100%, 8% 30%, 16% 100%, 26% 10%, 36% 100%, 48% 25%, 58% 100%, 70% 5%, 80% 100%, 90% 35%, 100% 100%);
    animation: cc-flame 0.4s steps(2) infinite alternate;
  }
  @keyframes cc-flame { from { opacity: 0.86; transform: scaleY(0.9); } to { opacity: 0.94; transform: scaleY(1.05); } }
  ```
  (Opacity span 0.08 < 0.1; the shape change is motion, not light.)

- [ ] **Step 5: Run the tests.**
  Run: `npx vitest run src/modules/casecremental`
  Expected: PASS.

- [ ] **Step 6: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/fx/stations src/modules/casecremental/fx/pixel src/modules/casecremental/game/view.ts src/modules/casecremental/game/viewRun4.ts src/modules/casecremental/game/view.test.ts src/modules/casecremental/ui/Hud.tsx src/modules/casecremental/ui/styles.ts src/modules/casecremental/ui/styles.test.ts
  git commit -m "feat(run4): Cartel's shades and chain, Money Printer's torrent of bills, Hot Hand's burning hand and combo flames

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 5: The Upgrader's dial — spin, win pop, loss shred

While `s.upgrader.spin` exists, a roulette dial stands over the locker (HD layer): a dark disc, the win arc in gold (from the top, clockwise, `chance` of the circle), the rest dark red, the target ("x10") and the chance ("11%") under it, the stake's pips (one per staked skin, up to ten, in its rarity colour) round the rim, and a white needle that turns `DIAL_TURNS` times and eases to the roll. The needle's angle is a pure function of the spin, so a reload resumes it exactly. Ticks sound as it passes each of the 24 sectors (throttled). On `upgraderDone`: a win pops the skin out like a contract result (the locker's own reveal juice, `tradeup-reveal`, the big-reveal hit for Covert/★) with a gold "UPGRADED!"; a loss shreds the stake (strips in the stake's rarity colour falling from the dial, a small shake, the shred sound, "SHREDDED"). Then the dial fades over 0.6 s.

**Files:**
- Create: `fx/stations/upgraderRules.ts`, `fx/stations/upgraderRules.test.ts`, `fx/stations/UpgraderDial.ts`
- Modify: `fx/stations/LockerStation.ts` (one shared reveal path), `fx/stations/Stations.ts`, `i18n/en.ts`, `i18n/ru.ts`

**Interfaces:**
- Consumes: `RunState.upgrader.spin` (`roll`, `chance`, `mult`, `inputs`, `elapsed`), `UPGRADER_SPIN_SECONDS`, the events `upgraderStarted`, `upgraderDone`; `SoundId` `"upgrader-shred"` if Task 2 generated it.
- Produces:
  ```ts
  export const DIAL_TURNS = 3;
  export const DIAL_SECTORS = 24;
  export const DIAL_FADE_SECONDS = 0.6;
  /** Radians clockwise from the top. */
  export function needleAngle(spin: Pick<UpgraderSpin, "roll" | "elapsed">): number;
  export function winArc(chance: number): { from: number; to: number };
  export function landsInArc(roll: number, chance: number): boolean;
  export function ticksCrossed(from: number | null, to: number): number;
  export function dialCentre(locker: Rect): Pt;
  ```

- [ ] **Step 1: Write the failing tests** in `fx/stations/upgraderRules.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { UPGRADER_SPIN_SECONDS } from "../../sim/tuning";
  import { DIAL_SECTORS, DIAL_TURNS, dialCentre, landsInArc, needleAngle, ticksCrossed, winArc } from "./upgraderRules";

  const TAU = Math.PI * 2;

  describe("the Upgrader's dial", () => {
    it("lands the needle on the roll, inside the win arc exactly when the roll wins", () => {
      for (const [roll, chance] of [[0.1, 0.6], [0.59, 0.6], [0.61, 0.6], [0.005, 0.009], [0.5, 0.009]] as const) {
        const end = needleAngle({ roll, elapsed: UPGRADER_SPIN_SECONDS });
        expect(end).toBeCloseTo((DIAL_TURNS + roll) * TAU, 9);
        const a = winArc(chance);
        const inside = (end % TAU) >= a.from && (end % TAU) < a.to;
        expect(inside, `${roll} ${chance}`).toBe(landsInArc(roll, chance));
        expect(landsInArc(roll, chance)).toBe(roll < chance);
      }
    });

    it("the needle is a pure function of the spin; a reload crosses no ticks (Review Focus 3)", () => {
      const at = (e: number) => needleAngle({ roll: 0.3, elapsed: e });
      expect(at(0)).toBe(0);
      expect(at(1.2)).toBe(at(1.2));
      for (let e = 0.05; e <= UPGRADER_SPIN_SECONDS; e += 0.05) expect(at(e)).toBeGreaterThanOrEqual(at(e - 0.05)); // never backwards
      expect(ticksCrossed(null, at(1.2))).toBe(0);
      expect(ticksCrossed(0, TAU)).toBe(DIAL_SECTORS);
      expect(ticksCrossed(at(1), at(1))).toBe(0);
    });

    it("stands over the locker", () => {
      const c = dialCentre({ x: 100, y: 80, w: 24, h: 30 });
      expect(c.x).toBe(112);
      expect(c.y).toBeLessThan(80);
    });
  });
  ```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/stations/upgraderRules.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Write `fx/stations/upgraderRules.ts`.**
  ```ts
  import type { UpgraderSpin } from "../../sim/upgrader";
  import { UPGRADER_SPIN_SECONDS } from "../../sim/tuning";
  import type { Pt, Rect } from "../pixel/layout";

  // The Upgrader's dial (finish spec §7.2) as pure functions of the sim's spin: the needle turns DIAL_TURNS times and
  // eases onto the roll, measured clockwise from the top as a share of the circle; the win arc runs from the top for
  // `chance` of it, so the needle lands inside the arc exactly when the roll won. A reload resumes at the same angle.

  export const DIAL_TURNS = 3;
  export const DIAL_SECTORS = 24;
  export const DIAL_FADE_SECONDS = 0.6;
  /** The dial's radius and its lift above the cabinet, world px. */
  export const DIAL_R = 13;
  const DIAL_LIFT = 18;
  const TAU = Math.PI * 2;

  const easeOutCubic = (k: number): number => 1 - (1 - k) ** 3;

  /** Radians clockwise from the top. */
  export function needleAngle(spin: Pick<UpgraderSpin, "roll" | "elapsed">): number {
    const k = Math.min(1, Math.max(0, spin.elapsed / UPGRADER_SPIN_SECONDS));
    return (DIAL_TURNS + spin.roll) * TAU * easeOutCubic(k);
  }

  export const winArc = (chance: number): { from: number; to: number } => ({ from: 0, to: chance * TAU });

  export const landsInArc = (roll: number, chance: number): boolean => roll < chance;

  /** Sector lines the needle passed between two frames (its tick sound); `from` null = a reload's first frame: none. */
  export function ticksCrossed(from: number | null, to: number): number {
    if (from === null) return 0;
    const step = TAU / DIAL_SECTORS;
    return Math.max(0, Math.floor(to / step + 1e-9) - Math.floor(from / step + 1e-9));
  }

  export const dialCentre = (locker: Rect): Pt => ({ x: locker.x + locker.w / 2, y: locker.y - DIAL_LIFT });
  ```

- [ ] **Step 4: Write `fx/stations/UpgraderDial.ts`.**
  - `hd = new Container()` holding a `Graphics` (disc, arcs, sector marks, pips, needle) and two `Text`s (the multiplier in gold, the chance dimmed; `pixelStyle` from `../hd/font`, size `hdFontSize(k)`).
  - `update(dt, s)`: if `s.upgrader.spin`, draw it at `hd.toScreen(dialCentre(l.locker))`, radius `DIAL_R * k`; `const a = needleAngle(spin)`; `const n = ticksCrossed(this.lastAngle, a)` → at most one `audio.play("reel-tick", { rate: 1.4, gain: 0.5 })` per frame when `n > 0`; `this.lastAngle = a`. With no spin: `lastAngle = null`, and the dial fades out over `DIAL_FADE_SECONDS` after a `done` event, else it is hidden. Colours: disc `0x14101a`, win arc `0xffd34d` (alpha 0.9, static), lose arc `0x5a1414`, needle `0xffffff`, pips in `RARITY_INFO[r].color`. **Nothing here pulses or flashes.**
  - `onEvent(e)`: `upgraderStarted` → `audio.play("tradeup-press", { rate: 1.2, gain: 0.7 })` (the press closes on the stake), `lastAngle = 0`; `upgraderDone` → start the fade; if `e.win`: a gold float `t("float.upgraded")` at the dial (the card's pop itself is the locker's, below); if not: `hd.particles.burst(centre, RARITY_INFO[e.inputs[0]!.rarity].color, 24, 90 * k / 6, 500)` (strips falling), `shake.add(0.15)`, the shred sound — `audio.play("upgrader-shred")` if Task 2 added that id to `SOUNDS`, else `audio.play("dayjob-nopay"); audio.play("tradeup-press", { rate: 0.6, gain: 0.5 });` — and the float `t("float.shredded")` dimmed red.
  - `LockerStation.onEvent`: factor the `pressDone` branch's body into `private popResults(results: readonly Drop[])` and call it from `case "pressDone": this.popResults(e.results); break;` and `case "upgraderDone": if (e.result) this.popResults([e.result]); break;`. The result already waits in `s.locker.cards`, so after a reload the card is simply there (no pop replays).
  - `Stations.ts`: own `private readonly dial: UpgraderDial` (in `hd`), wired into `layout`, `update`, `onEvent`, `destroy`.
  - i18n: `"float.upgraded": "UPGRADED!"` / `"АПГРЕЙД!"`, `"float.shredded": "SHREDDED"` / `"ИЗМЕЛЬЧЕНО"` (float budget 12).

- [ ] **Step 5: Run the tests.**
  Run: `npx vitest run src/modules/casecremental`
  Expected: PASS.

- [ ] **Step 6: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/fx/stations src/modules/casecremental/i18n
  git commit -m "feat(run4): the Upgrader's dial on the locker - the needle lands on the roll, a win pops out, a loss is shredded

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 6: Stage 5's layers, and the frame budget at Run 4's top rate

Spec §7.5 asks to check that stage 5's layers (warp, gold rain, glitch overlays, strobe under the flash gate) run at Run 4's drop rates within p95 ≤ 20 ms. **The code has none of them yet** (`fx/juice/look.ts`: every stage from 2 up is one saturation-and-bloom look; its comment still says "Stages 3–5 arrive in milestone 2"). So this task builds a minimal stage-5 set first, inside `StageLook` (which already owns the scene's filters and the stage), then measures. Step 1 confirms they are still missing: if F3–F5 added any of them, keep theirs and add only the missing ones.

The layers, on only at stage 5 and never while the vault is out (the vault has its own show), each easing in and out over ~1 s:
- **Warp:** a `BulgePinchFilter` on the scene breathing `±WARP_STRENGTH` (0.05) on a 6 s sine — motion, no light change.
- **Gold rain:** pooled coin sprites falling across the screen; how many follows the heat (reveals per second): `rainCount(heat) = min(RAIN_MAX, round(heat * 2))`, `RAIN_MAX = 48`.
- **Glitch overlays:** a `GlitchFilter` burst (6 slices, small RGB offsets, 0.15 s) every 3–6 s; each burst asks the flash gate.
- **Strobe:** a white full-screen flash at strength 0.12 every 4 beats (2 s at 120 BPM) through `hd.flash` (the gate).

**Files:**
- Create: `fx/juice/stageFive.ts`, `fx/juice/stageFive.test.ts`
- Modify: `fx/juice/stageLook.ts`, `fx/juice/look.ts` (its stale comment), `fx/hd/HdLayer.ts` (`takeFlash`), `fx/World.ts` (two changed lines, no new lines)

**Interfaces:**
- Produces:
  ```ts
  // fx/juice/stageFive.ts
  export const WARP_STRENGTH = 0.05;
  export const RAIN_MAX = 48;
  export const STROBE_EVERY = 2;        // s (4 beats at 120 BPM)
  export const STROBE_STRENGTH = 0.12;
  export const GLITCH_GAP: readonly [number, number]; // [3, 6] s
  export const GLITCH_SECONDS = 0.15;
  export function stageFiveMix(current: number, stage: number, vaultOut: boolean, dt: number): number; // 0..1, eased
  export const warpAt: (t: number, mix: number) => number;
  export const rainCount: (heat: number, mix: number) => number;
  export function strobeDue(prevT: number, t: number): boolean;
  export function nextGlitchAt(t: number, r: number): number;
  // fx/hd/HdLayer.ts
  takeFlash(): boolean; // asks the flash gate (counts as a flash)
  // StageLook: constructor(target: Container, hd: HdLayer); update(dt: number, s: Pick<RunState, "stage" | "heat" | "vault">): void
  ```
- F6-C uses `HdLayer.takeFlash()` for the screen tear.

- [ ] **Step 1: Check what exists.** `grep -rn "BulgePinch\|GlitchFilter\|strobe\|gold rain" src/modules/casecremental/fx`. Expected: nothing (as of F2). If F3–F5 added a layer, drop its part from Steps 3–5 and its test, and say so in the commit body.

- [ ] **Step 2: Write the failing tests** in `fx/juice/stageFive.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { FlashGate, MAX_FLASHES_PER_SECOND } from "../hd/flashGate";
  import { GLITCH_GAP, nextGlitchAt, RAIN_MAX, rainCount, stageFiveMix, STROBE_EVERY, strobeDue, WARP_STRENGTH, warpAt } from "./stageFive";

  describe("stage 5's layers", () => {
    it("come in only at stage 5, never while the vault is out, easing over about a second", () => {
      let m = 0;
      for (let i = 0; i < 15; i++) m = stageFiveMix(m, 5, false, 1 / 30);
      expect(m).toBeGreaterThan(0.4);
      expect(m).toBeLessThan(0.6);
      for (let i = 0; i < 60; i++) m = stageFiveMix(m, 5, false, 1 / 30);
      expect(m).toBeCloseTo(1, 2);
      expect(stageFiveMix(1, 5, true, 1)).toBe(0);
      expect(stageFiveMix(1, 4, false, 1)).toBe(0);
    });

    it("warps gently, rains by the heat up to its cap", () => {
      for (let t = 0; t < 12; t += 0.1) expect(Math.abs(warpAt(t, 1))).toBeLessThanOrEqual(WARP_STRENGTH);
      expect(warpAt(3, 0)).toBe(0);
      expect(rainCount(0, 1)).toBe(0);
      expect(rainCount(10, 1)).toBe(20);
      expect(rainCount(1000, 1)).toBe(RAIN_MAX);
      expect(rainCount(1000, 0.5)).toBe(RAIN_MAX / 2);
    });

    it("the strobe and the glitch bursts ask the flash gate (Review Focus 5)", () => {
      // the strobe fires on every STROBE_EVERY boundary crossed, once
      let due = 0;
      for (let t = 0, prev = 0; t < 10; prev = t, t += 1 / 60) if (strobeDue(prev, t)) due++;
      expect(due).toBe(Math.floor(10 / STROBE_EVERY));
      // glitch gaps stay in range
      for (const r of [0, 0.5, 0.999]) {
        const gap = nextGlitchAt(100, r) - 100;
        expect(gap).toBeGreaterThanOrEqual(GLITCH_GAP[0]);
        expect(gap).toBeLessThanOrEqual(GLITCH_GAP[1]);
      }
      // a ★ flash, a stage-up and a power-on in the same second as a strobe and a burst: the gate refuses the extra
      const gate = new FlashGate();
      const granted = [0, 0.1, 0.2, 0.3, 0.4].filter((t) => gate.take(t)).length;
      expect(granted).toBe(MAX_FLASHES_PER_SECOND);
    });
  });
  ```
  (The last assertion pins the shared-gate contract; StageLook calls `hd.flash` for the strobe and `hd.takeFlash()` before a glitch burst, both of which go through the one `FlashGate`.)

- [ ] **Step 3: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/juice/stageFive.test.ts`
  Expected: FAIL.

- [ ] **Step 4: Write `fx/juice/stageFive.ts`.**
  ```ts
  // Stage 5's layers (Unhinged; finish spec §7.5, base spec §7): a warping screen, gold rain, glitch bursts and a
  // strobe, as pure rules. They mix in only at stage 5 and never while the vault is out (it has its own show). The
  // strobe and every glitch burst go through the flash gate (photosensitivity: at most 3 a second, shared with every
  // other flash); the warp is motion only.

  export const WARP_STRENGTH = 0.05;
  const WARP_PERIOD = 6;
  export const RAIN_MAX = 48;
  export const STROBE_EVERY = 2;
  export const STROBE_STRENGTH = 0.12;
  export const GLITCH_GAP: readonly [number, number] = [3, 6];
  export const GLITCH_SECONDS = 0.15;
  /** The mix moves toward its target at this rate per second: a second in, a second out. */
  const MIX_RATE = 1;

  /** How much of stage 5's layers shows (0–1): toward 1 at stage 5 with no vault out, else toward 0. */
  export function stageFiveMix(current: number, stage: number, vaultOut: boolean, dt: number): number {
    const step = MIX_RATE * dt;
    return stage >= 5 && !vaultOut ? Math.min(1, current + step) : Math.max(0, current - step);
  }

  export const warpAt = (t: number, mix: number): number => WARP_STRENGTH * mix * Math.sin((t / WARP_PERIOD) * Math.PI * 2);

  export const rainCount = (heat: number, mix: number): number => Math.round(Math.min(RAIN_MAX, Math.round(heat * 2)) * mix);

  /** A strobe boundary (every STROBE_EVERY s of the layer's clock) was crossed between two frames. */
  export const strobeDue = (prevT: number, t: number): boolean => Math.floor(t / STROBE_EVERY) > Math.floor(prevT / STROBE_EVERY);

  /** When the next glitch burst is due, from a [0, 1) random draw. */
  export const nextGlitchAt = (t: number, r: number): number => t + GLITCH_GAP[0] + (GLITCH_GAP[1] - GLITCH_GAP[0]) * r;
  ```

- [ ] **Step 5: The layers in `StageLook`.**
  - `fx/hd/HdLayer.ts`: store `screenW`/`screenH` in `layout` behind a `get screen()` getter, and add
  ```ts
    /** Ask the flash gate for a full-screen change that is not a flash (a glitch burst, a screen tear): true when it
     *  may happen now, and it counts toward the three a second. */
    takeFlash(): boolean {
      return this.flashGate.take(this.t);
    }
  ```
  - `fx/juice/stageLook.ts`: constructor `(target: Container, private readonly hd: HdLayer)`; filters become `[this.color, this.bloom, this.warp, this.glitch]` with `warp = new BulgePinchFilter({ center: [0.5, 0.5], radius: 0, strength: 0 })` and `glitch = new GlitchFilter({ slices: 6, offset: 0, red: [2, 0], blue: [-2, 0] })`, both `enabled = false` until mixed in. `update(dt, s)`: `this.mix = stageFiveMix(this.mix, s.stage, s.vault !== null, dt)`; `this.t += dt` while `mix > 0`; warp: `enabled = mix > 0.01`, `strength = warpAt(t, mix)`, `radius = min(hd.screen.w, hd.screen.h) / 1.6` (add a `get screen(): { w: number; h: number }` to `HdLayer`, stored by its `layout` — no new World call); rain: a `SpritePool` of coin sprites from `hd`'s coin frames in `hd.root`, `rainCount(s.heat, mix)` alive, falling 120–220 px/s × `k / 4`, wrapping to the top; strobe: `if (mix > 0.5 && strobeDue(prev, t)) this.hd.flash(0xffffff, STROBE_STRENGTH)`; glitch: when `t >= nextAt` and `mix > 0.5` and `this.hd.takeFlash()`, enable the filter for `GLITCH_SECONDS` with a fresh `seed`, then `nextAt = nextGlitchAt(t, Math.random())` (visual-only randomness); a refused burst waits for the next due time. Update the header comment: "Stages 3–4 keep stage 2's look; stage 5 adds its layers (stageFive.ts)."
  - `fx/juice/look.ts`: fix the stale comment ("Stages 3–5 arrive in milestone 2" → "Stage 5's layers: stageFive.ts").
  - `fx/World.ts`, two changed lines only: `this.look = new StageLook(this.scene, this.hd);` and `this.look.update(realSeconds, run.state);` (the `run` const exists in `update`; if the call sits above it, move the call below `const run = …` rather than adding a line). `wc -l fx/World.ts` must not grow.

- [ ] **Step 6: Run the tests.**
  Run: `npx vitest run src/modules/casecremental`
  Expected: PASS.

- [ ] **Step 7: Measure the frame budget at Run 4's top rate.** `npm run dev` in the background; the scratch harness (`http://localhost:5180/.superpowers/harness/index.html?state=empty&cash=500`, `window.cc.controller`). Load the browser tools in one call (`ToolSearch` → `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__resize_window,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__javascript_tool`); if no browser is connected, use headless Chrome over CDP as M3's final pass did. At 1920×1080 on the dev laptop:
  1. `cc.controller.devStartRun(4)`, then `devAddCash` until everything is bought: every case, every upgrade and machine at its cap, the Upgrader, all five evolutions (set their recipes via the rows; the combo recipe by selling by hand fast, or `cc.controller.run.state.evolutions.bestCombo = 50` for this measurement only), auto-spin on, the seller threshold at Classified.
  2. Wait until `cc.controller.run.state.stage === 5` (read it with `javascript_tool`).
  3. Sample frame times for 60 s: `javascript_tool` runs a `requestAnimationFrame` loop pushing `performance.now()` deltas into `window.__ft`, then reports p50 / p95 / max.
  4. Expected: **p95 ≤ 20 ms.** If not, cut in this order and re-measure: `RAIN_MAX` (48 → 24), the bloom's `quality` at stage 5, `BILLS_MAX` and `FLAMES_MAX` (Task 4), the glitch filter's slices; never the flash gate or the 0.1 rule. Record the numbers.
  5. Watch 30 s with the sound on (if someone can listen; the automation tab is muted): no more than 3 flashes in any second; the strobe reads as a pulse, not a flicker.

- [ ] **Step 8: Commit,** with the measured frame times in the body.
  ```bash
  git add src/modules/casecremental/fx/juice src/modules/casecremental/fx/hd/HdLayer.ts src/modules/casecremental/fx/World.ts
  git commit -m "feat(run4): stage 5's warp, gold rain, glitch bursts and strobe, under the flash gate - p95 <n> ms at Run 4's top rate

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 7: The browser check of Run 4's table

**Files:** none unless a check fails; a fix goes in the owning task's files (with a test where one fits) and is committed on its own as `fix(run4): …`.

- [ ] **Step 1: The checks pass.** `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
- [ ] **Step 2: Start the game** as in Task 6 Step 7 (`&save=1` keeps a save for the reload checks, `&lang=ru` for Russian).
- [ ] **Step 3: The shelf and the finishes** (1920×1080). `devStartRun(4)`, `devAddCash` past Fever Dream's unlock. Screenshot: the shelf with Glitch and Fever Dream (their box icons, «Глитч» and «Бредовый сон» in RU on one line beside the icon); a Glitch and a Fever Dream case on the bench (the box opens through its four frames); a reveal card of each new kind — the Glitch skins stutter (hold, jump), the melt skins run downward, kaleido and huecycle turn. Use the dev board (`SoundBoard` → force rarity) to see a Covert and a ★ of each.
- [ ] **Step 4: The Upgrader.** Buy the locker and the Upgrader; fill the locker (auto-seller Collect a rarity); stake it, pick ×1.5, GO. Expected: the dial over the locker, the gold arc ~60 %, the needle turns three times and lands; a win pops the card on the locker with "UPGRADED!" and `tradeup-reveal`; a loss shreds with "SHREDDED". Pick ×100 and GO again: the arc is a sliver. **Reload mid-spin** (`&save=1`): the needle continues from the same place and the same outcome lands; no start sound replays.
- [ ] **Step 5: The evolutions.** Complete each recipe and EVOLVE each (the rows: recipe lines tick, EVOLVE enables, then EVOLVED). Expected per evolution: the gold flash (gated), `stage-up` and "EVOLVED!"; Slot Machine: the gold frame, a BUY opens ten in five slot columns of two, the cards come up (overlapping where narrow); Cartel: shades and chain on the bot, idle and spinning; Money Printer: a stream of bills from the seller to the cash; Assembly Line: the belt left of the case, rollers moving while auto-spin is on, a case riding in on each buy, every 25th a free case one tier up; Hot Hand: with a hand combo ≥ 25, flames trail the pointer and flicker on the combo meter. Screenshot each. Reload: every look is back at once, and none of the reveals replays.
- [ ] **Step 6: Portrait and Russian.** 390×844 and 360×640: the slot columns inside the reel window (Review Focus 2), the belt or no belt, the dial over the locker, the shades on the bot. Settings → RU: the Machines rows (Апгрейдер, Ставка, Цель, Шанс, ВПЕРЁД; ЭВОЛЮЦИИ, Игровой автомат…, РАЗВИТЬ / РАЗВИТО) — no word broken across lines, nothing spilling out of a row.
- [ ] **Step 7: The console is clean.** `read_console_messages` with `error|warn|casecremental`: no errors, no `sprite "case-glitch" not built`, no missing-sound warnings.
- [ ] **Step 8: Report** the screenshots' paths, the frame times from Task 6, the credits spent (or that the art was derived), and anything that looked weak. F6-C's notes task writes the feature history for all of F6.

---

## Self-review notes (spec coverage, screen side)

| Spec item | Covered in |
|---|---|
| §7.1 new finishes (datamosh, scanline tear, RGB split; melting, kaleidoscope, hue-cycling) | Task 1 |
| §7.1 case box sprites via the M3-C pipeline; tool and cost; approval gate | Task 2 |
| §7.2 dial with the win arc on the locker's press, win pops like a contract result, loss shreds with a sad sound, reload-safe | Task 5 |
| §7.3 each evolution's visible change (gold slot frame and 5 columns; shades and chain; bills to the counter; conveyor; burning hand and combo flames) | Tasks 3, 4 |
| §7.5 stage 5's warp, gold rain, glitch overlays, strobe under the flash gate; p95 ≤ 20 ms | Task 6 |
| The Last Case's chest sheet (used by F6-C) | Task 2 |
