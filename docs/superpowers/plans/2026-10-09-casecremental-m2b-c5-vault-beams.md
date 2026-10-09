# Casecremental M2b-C5 — the vault's reels as endless beams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vault's five framed vertical columns with five wide coloured beams that fan out of the
chest's mouth and run past the screen edge. Skin icons and coins stream along them endlessly until each reward
locks in at its spot on its beam.

**Architecture:**
- A pure `beamLayout` (geometry, tested) and a pure `itemDistance` (where each streamed item is, built on the
  existing `columnMotion`, tested) feed a new `VaultBeams` renderer.
- `VaultBeams` keeps `VaultColumns`' public API, so the World and VaultScene wiring hardly change.
- The rays' fan is removed (the beams are the rainbow); the starburst stays.

**Tech Stack:** TypeScript strict, Vitest, PixiJS 8.

**Spec:** `docs/superpowers/specs/2026-10-09-casecremental-vault-jackpot-design.md` §5 (addendum). §1–4 still
hold (timeline, lock-in times and order, audio, reload rules).

## Global Constraints

- Lock-in times `[6, 6.5, 7, 7.5, 8.5]`, left to right. Cascade from 1.5, 100 ms apart. Celebration pulse at 9.
- Rewards are decided by the sim. Each beam always stops on its drop; landing juice fires once; restore replays
  nothing.
- Beams reach past every screen edge they point at. Reward spots, icons and labels sit fully on screen and never
  overlap one another, on 1920×1080, 1324×824, 1324×768 and 390×844 (portrait).
- Visual-only randomness. Never call `caseById` on a vault drop.
- Files stay ≤ ~400 lines. `World.ts` does not grow.
- Commit trailer:
  ```
  Co-Authored-By: Claude <model> <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013MA8Fp47Lkjiuq8tVoGPyt
  ```
  Stage files by path.

## Review Focus

1. **Portrait phone.** The fan is narrower and the outer beams leave by the sides. The spots and labels are still
   on screen and apart.
2. **A reload between two lock-ins.** Landed beams show their reward at rest and no streamed items; the others
   stream on.
3. **The fifth** (★ animated) is on the rightmost beam. Its label doesn't collide with the 4th's.
4. **Performance.** A bounded number of streamed sprites per beam (pooled, not created per frame).
5. **Second vault in a session.** No leftover sprites.

---

### Task 1: Beam geometry and the stream (pure)

**Files:** create `fx/vault/beams.ts` and `fx/vault/beams.test.ts` (in `src/modules/casecremental/`)

**Interfaces — Produces:**
```ts
export interface Beam {
  /** The chest mouth, screen px. */
  origin: Pt;
  /** Radians from straight up; negative leans left. */
  angle: number;
  /** Screen px. */
  width: number;
  /** Screen px: reaches past the screen edge the beam points at. */
  length: number;
  /** Where the reward stops, and its distance from the origin along the beam. */
  spot: Pt;
  spotDist: number;
  /** The reward's label box (screen px), beside or below its icon. */
  label: Rect;
}
/** Degrees from straight up, left to right. */
export const BEAM_ANGLES_LANDSCAPE: readonly number[]; // e.g. [-52, -26, 0, 26, 52]
export const BEAM_ANGLES_PORTRAIT: readonly number[]; // e.g. [-34, -17, 0, 17, 34]
/** Yellow, orange, red, orange, yellow. */
export const BEAM_PALETTE: readonly number[];
/** icon: the streamed icon's box size (screen px); labelH: a label's height (screen px). */
export function beamLayout(screen: { w: number; h: number }, mouth: Pt, icon: number, labelH: number): Beam[];
/** Item j's distance from the origin along its beam when the strip is at p (cells, from columnMotion), so that
 *  item `target` sits at spotDist when p = target: (p − target) × spacing + spotDist + (target − j) × spacing.
 *  Items with a distance < 0 are still inside the chest (hidden). */
export function itemDistance(p: number, j: number, target: number, spacing: number, spotDist: number): number;
```

- [ ] **Step 1: Failing tests** (for each of the four screen sizes):
  - five beams, symmetric about the mouth's x;
  - each beam's end (origin + length along the angle) is outside the screen;
  - every spot (± icon/2) and every label box is inside the screen with a ≥ 4 px margin;
  - no two spots' icon boxes overlap, and no label box overlaps another label or icon box;
  - every spot is above the mouth;
  - `itemDistance(target, target, …) === spotDist`; items with larger `j` are closer to the chest; items with
    smaller `j` are further out.
- [ ] **Step 2: Watch them fail. Step 3: Implement.**
  - Choose `spotDist` per beam as ~60 % of the distance to where the beam exits the screen.
  - Stagger spots so the label boxes clear one another.
  - If a pair still collides, nudge along the beam until the tests pass.
- [ ] **Step 4: Run** `npx vitest run src/modules/casecremental/fx/vault`. **Commit:**
  `feat(vault): beam geometry - five endless beams out of the chest`.

### Task 2: `VaultBeams` replaces `VaultColumns`

**Files:**
- create `fx/vault/VaultBeams.ts` (≤ 400 lines; split a pooled `beamStream.ts` if needed);
- delete `fx/vault/VaultColumns.ts`, and `columnRects` if nothing else uses it;
- modify `fx/vault/rays.ts` (remove the ray fan, keep the starburst and glow), `fx/vault/vaultLayout.ts` (beams
  instead of `columnsArea`), `fx/vault/VaultScene.ts` and `fx/World.ts` (wiring only).

**Interfaces:**
- Consumes `beamLayout`, `itemDistance`, `columnMotion`, `vaultCues(t)` (`columnIn`, `pulse`, `density`),
  `fitLabel`, and the sounds `reward-chime`, `legendary-choir`, `firework` and `reel-tick`.
- Produces the same public API as `VaultColumns`: `layout`, `start`, `restore`, `update(t)`,
  `landed(i, drop, amount)`, `pulse(v)`, `hide`, `render`, `tint`, `destroy`. It draws in the vault scene's
  screen space: the beams as `Graphics` quads behind; the streamed icons as pooled sprites (integer scale,
  upright) and coins.

- [ ] Steps:
  - **Beams:** draw them back to front (outer first, centre last) at ~0.8 alpha. Each beam grows from the
    mouth with `columnIn[i]`.
  - **Streaming:** each beam's strip position comes from `columnMotion`. For every item index whose
    `itemDistance` is between 0 and `length`, place a pooled sprite at
    `origin + dir × distance + perpendicular jitter` (seeded per item, ≤ width/3), alternating skin icons and
    coins (1 coin per 3 items).
  - **Landing (once per beam, from the sim event):**
    - a scale pulse on the reward;
    - a rarity frame (1-px outline at integer scale);
    - a star burst;
    - `reward-chime` at a rising pitch;
    - the label in its box (`fitLabel`);
    - the other items fade out over 0.3 s;
    - the fifth: animated ★ frames, a halo, `legendary-choir`, a `firework` and shake.
  - **`restore`:** landed beams show their reward at rest with its label and no stream; the unlanded beams'
    streams are at their positions.
  - **`pulse(v)`:** brighten the beams and the reward frames.
  - **`destroy` / `hide`:** release every pooled sprite.
  - **Rays:** keep the starburst rotating and the glow; delete the fan.
  - **Tests:** pure helpers only (e.g. the pool-size bound `maxVisibleItems(beam, spacing)`).
  - **Run:** `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`.
  - **Commit:** `feat(vault): the reels pour out of the chest as endless beams`.

### Task 3: Play it (controller)

- [ ] Browser check on a crafted save: back up the player's save and restore it after (Storage.setItem patched
  during the reload). Check:
  - landscape and portrait;
  - Russian;
  - a reload mid-stream.
- [ ] Feature history: update the vault bullet (beams instead of columns). Commit.
