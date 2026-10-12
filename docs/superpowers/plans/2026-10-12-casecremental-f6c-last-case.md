# Casecremental F6-C — The Last Case, the Credits and THE END — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give The Last Case (Run 4's vault) its own finale — the black-glass-and-gold chest, white/gold/void beams, the densest chaos, the fanfare re-cut +7 semitones, a screen tear at the impact through the flash gate, every reel on screen spinning until the lid opens — then roll the credits (black, the credits track, a slow scroll with the campaign's stats, skippable after 5 s) and end on the prestige screen's "THE END — Run 4 again, boosted"; check the whole of F6 in the browser and write its feature history.

**Architecture:** The Last Case uses the vaults' existing ticket and timeline; everything new is data in `fx/vault/vaultLooks.ts` plus a `finale` flag that switches on two extras, which live in their own files: `fx/vault/finaleRules.ts` (pure: the tear's window and reseeds, the reels' free spin, the intro's dim) and `fx/vault/Finale.ts` (a `GlitchFilter` on the scene and the vault, and the bench's and bot's reels driven from the vault's clock — reload-safe). The credits are a React overlay (`ui/Credits.tsx`, rules in `ui/creditsRules.ts`) shown instead of the prestige screen while `meta.credits` is set (F6-A); the music picks the `credits` track (F5) through `fx/vault/vaultFlow.ts`, falling back to the prestige loop when the track is missing. `fx/World.ts` gets only wiring and stays at its size by moving the vault-sync methods out if needed.

**Tech Stack:** TypeScript (strict), PixiJS 8 + pixi-filters 6 (`GlitchFilter`), React 19, Vitest, Vite 8, ffmpeg (`rubberband`).

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-finish-design.md` §7.4 (binding), with §7 (the replay loop), §1, §6 (the credits track) and §11. Read `docs/feature-history/casecremental-runs-2-3.md` § "The vaults (M3-E)" (looks, density, the fanfare recipe, photosensitivity per vault) and the M3-E plan (`docs/superpowers/plans/2026-10-12-casecremental-m3-e-vaults.md`) before Task 1.

**This plan is the last of three for F6.** It needs F6-A (`2026-10-12-casecremental-f6a-run4-sim.md`: `VaultDef` `lastcase` with an interim look, `meta.credits`, `meta.stats`, the `endCredits` action and `creditsEnded` event, `PrestigeView.credits`/`.stats`) and F6-B (`2026-10-12-casecremental-f6b-run4-screen.md`: the `vault-case-4` chest sheet, `HdLayer.takeFlash()`). F5 added the `credits` track (`assets/audio/credits*.mp3`, probably `TrackId` `"credits"`) and a playlist for the stage loops; before Task 1 re-read `fx/audio/sounds.ts`, `fx/audio/AudioEngine.ts`, `fx/vault/vaultFlow.ts`, `fx/vault/vaultLooks.ts`, `fx/vault/VaultScene.ts`, `fx/World.ts`, `ui/GamePanel.tsx`, `ui/Prestige.tsx`, `ui/prestigeRules.ts` as F5–F6-B left them, and apply each snippet below to the code as it is now.

## Global Constraints

- Every player-facing string exists in EN (`i18n/en.ts`) and RU (`i18n/ru.ts`) and fits its `i18n/budgets.ts` budget; Russian has exactly the English keys. Russian text wraps only at whole words; a single Russian word fits the narrowest column it is shown in.
- **Photosensitivity, hard rules:** every full-screen flash goes through the flash gate (at most 3 a second); the screen tear asks the same gate for every reseed (`HdLayer.takeFlash()`), so the tear, the impact flash and the kicks together never pass 3 a second; a light that pulses on the beat changes by less than 0.1. The vault's flash schedule and beat amplitudes stay global (no look may carry a flash, a kick or a throb). Every rule here has a test.
- Balance numbers live only in `sim/tuning.ts` (this plan adds none). Look numbers live in their `fx/…` rules file as named constants.
- Stations and scenes draw from sim state every frame and take events only for one-shot juice; a reload or a lobby trip lands on the same frame (the tear and the reels' spin are functions of the vault's `t`; the credits restart from the top, held by `meta.credits`).
- File size (IDOS.md): a new responsibility in a file past ~400 lines goes in its own file. `fx/World.ts` (~540) must not grow net (Task 3 says how); `fx/vault/VaultScene.ts` (~430) takes one changed line.
- `ui/` imports from `fx/` only, never the other way; `game/` and `sim/` never import `fx/` or `ui/`.
- Match the module's code style: a header comment per file saying what it is and why, doc comments on exported names, the neighbours' comment density, 2-space Prettier formatting (`npm run format`, print width 140).
- Every commit keeps these green: `npm run typecheck`, `npx vitest run src/modules/casecremental`, `npm run build`.
- Commit messages look like `feat(run4): …` (docs: `docs(feature-history): …`) and end with these two lines (after a blank line):
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```
- Stage files by path. Never stage `docs/todo.md` or the `{…}.png` files in the repo root. Stay on branch `casecremental-finish`. Do not edit `src/modules.ts`, `src/config.ts`, `src/idos.title.ts` or `idos.modules.lock.json`.
- No ElevenLabs credits in this plan: the fanfare is an ffmpeg re-cut; the credits track comes from F5.

## Review Focus

1. **A reload during the credits.** The player expects the credits again (not a jump to the prestige screen, not a fresh run), with the credits music. `meta.credits` holds them; the overlay restarts from the top; `musicPlan` picks the credits track. Tests: Task 5, "picks the credits track while the credits roll, the prestige loop after"; `ui/prestigeRules.test.ts` "shows the credits while they roll".
2. **A reload in the middle of the tear** (between the impact and +1.5 s). The tear continues to the end of its window without a second burst and without replaying the impact; a reload before the impact resumes the reels' spin at the vault's clock. Test: Task 3, "the tear and the reels are functions of the vault's clock".
3. **The credits track is missing** (F5's budget ran out, or a load failed). The prestige loop plays instead; nothing is silent. Test: Task 5, "falls back to the prestige loop without a credits track".
4. **SKIP pressed (or tapped) before 5 s.** Nothing happens; the button is not even shown yet. Test: Task 5, "can be skipped only after 5 s, and ends by itself".
5. **The densest chaos on a weak laptop and its flashes.** The Last Case fires the same gated flash schedule as every vault, the tear's reseeds share the gate, and its extra bursts stay within the pools (`MAX_DENSITY`). Tests: Task 2's photosensitivity tests (they iterate every look) and Task 3, "the tear reseeds at most 3 times a second and asks the gate".

---

## File map

All paths are relative to `src/modules/casecremental/` unless they start with `art/` or `docs/`.

| File | Task | Responsibility |
|---|---|---|
| `assets/audio/vault-fanfare-4.mp3`, `art/manifest.json`, `fx/audio/sounds.ts`, `sounds.test.ts` | 1 | the fanfare re-cut +7 |
| `fx/vault/vaultLooks.ts`, `vaultLooks.test.ts` | 2 | The Last Case's look, `finale`, `MAX_DENSITY` |
| `fx/vault/finaleRules.ts` (create, + test), `fx/vault/Finale.ts` (create), `fx/vault/VaultScene.ts` (one line), `fx/pixel/BenchReels.ts`, `fx/stations/Stations.ts`, `fx/stations/BotStation.ts`, `fx/World.ts`, maybe `fx/vault/vaultSync.ts` (create) | 3 | the tear and the reels |
| `ui/prestigeRules.ts`, `prestigeRules.test.ts`, `ui/Prestige.tsx`, `i18n/*` | 4 | THE END |
| `ui/creditsRules.ts` (create, + test), `ui/Credits.tsx` (create), `ui/GamePanel.tsx`, `fx/vault/vaultFlow.ts`, `vaultFlow.test.ts`, `fx/audio/AudioEngine.ts`, `AudioEngine.test.ts`, `fx/World.ts`, `i18n/*` | 5 | the credits and their music |
| — | 6 | the browser pass of F6 |
| `docs/feature-history/casecremental-finish.md`, `casecremental-runs-2-3.md`, `README.md` | 7 | the notes |

---

### Task 1: The Last Case's fanfare — Vault I's re-cut +7 semitones

`vault-fanfare-2` and `-3` are Vault I's fanfare pitch-shifted +2 and +4 semitones with the tempo kept (13.82 s, mean −17.3/−17.5 dB, at Vault I's `TRACK_GAIN`). The Last Case's is the same re-cut at +7 (a fifth up: the grand ending), no credits.

**Files:**
- Create: `assets/audio/vault-fanfare-4.mp3`
- Modify: `art/manifest.json`, `fx/audio/sounds.ts`, `fx/audio/sounds.test.ts`

**Interfaces:**
- Produces: `FanfareId` gains `"vault-fanfare-4"`; `TRACK_GAIN["vault-fanfare-4"] = TRACK_GAIN["vault-fanfare"]`; `indexAudio` maps `vault-fanfare-4.mp3` to its own track.

- [ ] **Step 1: Write the failing tests** in `fx/audio/sounds.test.ts` (next to the existing fanfare tests):
  ```ts
  it("plays The Last Case's fanfare at Vault I's level, indexed as its own track (not a take of Vault I's)", () => {
    expect(TRACK_GAIN["vault-fanfare-4"]).toBe(TRACK_GAIN["vault-fanfare"]);
    const files = indexAudio({ "a/vault-fanfare-1.mp3": "u1", "a/vault-fanfare-4.mp3": "u4" });
    expect(files.tracks.get("vault-fanfare")).toBe("u1");
    expect(files.tracks.get("vault-fanfare-4")).toBe("u4");
  });
  ```

- [ ] **Step 2: Run it to see it fail.**
  Run: `npx vitest run src/modules/casecremental/fx/audio/sounds.test.ts`
  Expected: FAIL (`vault-fanfare-4` is not a `TrackId`; the file is read as a take of Vault I's).

- [ ] **Step 3: Cut it.** Read the `vault-fanfare-2` manifest entry (its exact recipe). From `src/modules/casecremental/assets/audio/`:
  ```bash
  ffmpeg -i vault-fanfare-1.mp3 -af "rubberband=pitch=1.498307,volume=0.0dB,alimiter=limit=0.89:level=false" -ar 44100 -b:a 192k vault-fanfare-4.mp3
  ```
  (`2^(7/12) = 1.498307`.) Measure both files: `ffprobe -v error -show_entries format=duration -of csv=p=0 <f>` and `ffmpeg -i <f> -af volumedetect -f null - 2>&1 | grep mean_volume`. Expected: duration within ±0.05 s of `vault-fanfare-1.mp3` (13.82 s); mean volume within 1 dB of it (−17.3 dB). If the mean is off, redo it with the `volume=` gain that brings it back (as the -2 recipe did with 0.8 dB). If `rubberband` is missing from this ffmpeg, use `asetrate=44100*1.498307,aresample=44100,atempo=0.667420` (1/1.498307) and say so in the commit body. Someone should listen once: the intro → fanfare hand-off at 3.40 s and the pitch (the automation tab is muted).

- [ ] **Step 4: Register it.**
  - `art/manifest.json` `audio`: `{ "id": "vault-fanfare-4", "kind": "music", "duration": 13.8, "prompt": "The Last Case's fanfare, built (no credits) from assets/audio/vault-fanfare-1.mp3 pitch-shifted +7 semitones with the tempo kept, so it stays on the 17.4 s vault timeline: ffmpeg -i vault-fanfare-1.mp3 -af \"rubberband=pitch=1.498307,volume=<g>dB,alimiter=limit=0.89:level=false\" -ar 44100 -b:a 192k vault-fanfare-4.mp3 (mean <m> dB, Vault I's -17.3)." }` with the real gain and mean.
  - `fx/audio/sounds.ts`: `export type FanfareId = "vault-fanfare" | "vault-fanfare-2" | "vault-fanfare-3" | "vault-fanfare-4";` with the doc comment "…then Vaults II's and III's and The Last Case's (Vault I's re-cut +2, +4 and +7 semitones, plans M3-C and F6-C)"; `TRACK_GAIN` gains `"vault-fanfare-4": 1.5,`; the `indexAudio` regex's `vault-fanfare-[23]` becomes `vault-fanfare-[234]` (and its comment "vault-fanfare-2 / -3 / -4 are Vaults II's, III's and The Last Case's own fanfares…"). If F5 already changed this regex (for `credits`), keep F5's form and add `4`.

- [ ] **Step 5: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/fx/audio`
  Expected: PASS (the manifest test checks every `TRACK_GAIN` id has a manifest entry).

- [ ] **Step 6: Commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/assets/audio/vault-fanfare-4.mp3 art/manifest.json src/modules/casecremental/fx/audio/sounds.ts src/modules/casecremental/fx/audio/sounds.test.ts
  git commit -m "feat(run4): The Last Case's fanfare - the climbing fanfare re-cut +7 semitones, level-matched

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 2: The Last Case's look

Replace F6-A's interim `lastcase` entry: its own chest (`vault-case-4`, black glass with gold glitch seams, built by F6-B Task 2), white/gold/void beams, pale-gold light, its own fanfare, and the densest chaos of all — by count and density only, like every vault: 5 bursts on each kick (×2.5 Vault I's), rain and edge sparks ×2.5, twin items on the beams at 2 (the most the "less than half a spacing per frame" rule allows, as Vault III). `MAX_DENSITY` rises to 2.5 so the pools hold it. A new `finale` flag (true only here) turns on Task 3's extras.

**Files:**
- Modify: `fx/vault/vaultLooks.ts`, `fx/vault/vaultLooks.test.ts`

**Interfaces:**
- Produces: `VaultLook.finale: boolean`; `VAULT_LOOKS.lastcase` final; `MAX_DENSITY = 2.5`.

- [ ] **Step 1: Write the failing tests** in `fx/vault/vaultLooks.test.ts`:
  - "keeps Vault I exactly as it was before M3": add `finale: false,` to the expected object.
  - Add:
  ```ts
  it("gives The Last Case its own chest, fanfare, white/gold/void beams and the finale", () => {
    const l = vaultLook("lastcase");
    expect(l).toMatchObject({ chest: "vault-case-4", fanfare: "vault-fanfare-4", finale: true });
    expect(LOOKS.filter((x) => x.finale).map((x) => x.id)).toEqual(["lastcase"]);
    expect(l.palette).toEqual([0xffffff, 0xffd34d, 0x1a0f2e, 0xffd34d, 0xffffff]);
  });

  it("is the densest vault of all, within the pools' bound", () => {
    const [, , c, d] = LOOKS.map((x) => x.chaos);
    expect(MAX_DENSITY).toBe(2.5);
    expect(d!.burstsPerKick).toBeGreaterThan(c!.burstsPerKick);
    expect(d!.rain).toBeGreaterThan(c!.rain);
    expect(d!.sparks).toBeGreaterThan(c!.sparks);
    expect(d!.stream).toBe(2); // twins on every item: the most the beams' spacing rule allows
    expect(d!.burstsPerKick / LOOKS[0]!.chaos.burstsPerKick).toBeCloseTo(2.5, 9);
  });
  ```
  The existing "gets wilder vault by vault…" loop over `LOOKS` for `≤ MAX_DENSITY` and `burstsPerKick ≤ 2 × MAX_DENSITY` covers the new entry. The photosensitivity tests iterate every look, `lastcase` included.

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/vault/vaultLooks.test.ts`
  Expected: FAIL (no `finale`; the interim chest).

- [ ] **Step 3: The look** in `fx/vault/vaultLooks.ts`:
  - `VaultLook` gains `/** The grand ending (The Last Case): the screen tears at the impact and every reel spins until the lid opens (finale.ts). */ finale: boolean;`; Vaults I–III get `finale: false`.
  - `export const MAX_DENSITY = 2.5;` (its doc comment: "…(× Vault I): The Last Case's; the chaos's and the beams' pools are sized for it once.").
  - Replace the interim entry:
  ```ts
    lastcase: {
      id: "lastcase",
      chest: "vault-case-4", // black glass with gold glitch seams
      palette: [0xffffff, 0xffd34d, 0x1a0f2e, 0xffd34d, 0xffffff], // white, gold, void, gold, white
      light: {
        impactFlash: 0xfffbe8,
        starburst: 0xfff4c8,
        shaft: 0xffffff,
        glow: 0xffd34d,
        tremble: 0xffe08a,
        seam: 0xffd34d,
        open: 0xfff0b0,
      },
      fanfare: "vault-fanfare-4",
      chaos: { burstsPerKick: 5, stream: 2, rain: 2.5, sparks: 2.5, shimmer: { from: 0.12, span: 0.04, sat: 0.15 } },
      finale: true,
    },
  ```
  - Header comment: "…Each vault is wilder than the last through count and density only… The Last Case (Run 4) is the densest and the only `finale`."

- [ ] **Step 4: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/fx/vault`
  Expected: PASS (`VaultBeams` and `chaos` size their pools from `MAX_DENSITY`; their tests read it).

- [ ] **Step 5: Commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/fx/vault/vaultLooks.ts src/modules/casecremental/fx/vault/vaultLooks.test.ts
  git commit -m "feat(run4): The Last Case's look - black glass and gold chest, white/gold/void beams, the densest chaos, its fanfare

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 3: The finale — the screen tears, every reel spins until the lid opens

Two extras when the look is a `finale`, both pure functions of the vault's clock `t` (from the key turn), so a reload lands on the same frame:
- **The tear:** from the impact (`VAULT_CUES.impact`, 3.40 s) for `TEAR_SECONDS` (1.5 s), a `GlitchFilter` on the scene and on the vault's root offsets horizontal slices, its offset fading out. The slices reseed at most `TEAR_RESEEDS_PER_SECOND` (3) times a second, and each reseed asks the flash gate (`HdLayer.takeFlash()`); a refused reseed holds the slices as they are. No colour inversion, no brightness change: the RGB offsets are 3 px.
- **The reels:** from the key turn until the impact, your bench's reel and the bot's reels spin as one long free spin of the vault's source case that lands exactly as the lid opens. The vault's dim is lighter during that intro (`FINALE_INTRO_DIM` 0.55 instead of 0.86) so the table's spinning reels show through.

**Files:**
- Create: `fx/vault/finaleRules.ts`, `fx/vault/finaleRules.test.ts`, `fx/vault/Finale.ts`
- Modify: `fx/vault/VaultScene.ts` (the dim, one line), `fx/pixel/BenchReels.ts` (`freeSpin`), `fx/stations/BotStation.ts` + `fx/stations/Stations.ts` (`finaleSpin`), `fx/World.ts` (wiring; no net growth), maybe create `fx/vault/vaultSync.ts`

**Interfaces:**
- Consumes: `VaultLook.finale`, `VAULT_CUES.impact`, `HdLayer.takeFlash()` (F6-B), `RunState.vault`, `vaultFor`, `caseById`.
- Produces:
  ```ts
  // fx/vault/finaleRules.ts
  export const TEAR_SECONDS = 1.5;
  export const TEAR_RESEEDS_PER_SECOND = 3;
  export const TEAR_OFFSET = 24;          // screen px at pixel scale 4, × strength
  export const FINALE_INTRO_DIM = 0.55;
  export interface Tear { strength: number; slot: number }
  export function tearAt(t: number): Tear | null;
  export function finaleSpin(v: VaultState | null, finale: boolean): { elapsed: number; duration: number } | null;
  export const finaleDim: (finale: boolean, t: number, dimOpen: number) => number;
  // fx/vault/Finale.ts
  export class Finale { constructor(targets: Container[], hd: HdLayer, reels: FinaleReels, rng: Rng); update(run: Run, k: number): void; destroy(): void }
  export interface FinaleReels { benchFreeSpin(c: CaseDef, winner: SkinDef, rng: Rng, start: boolean, elapsed: number, duration: number): void; botFreeSpin(caseId: string, skinIds: string[], start: boolean, elapsed: number, duration: number): void }
  ```

- [ ] **Step 1: Write the failing tests** in `fx/vault/finaleRules.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { FlashGate } from "../hd/flashGate";
  import { VAULT_CUES } from "./cues";
  import { FINALE_INTRO_DIM, finaleDim, finaleSpin, TEAR_RESEEDS_PER_SECOND, TEAR_SECONDS, tearAt } from "./finaleRules";

  const I = VAULT_CUES.impact;
  const opening = (t: number) => ({ phase: "opening" as const, t, drops: [], landed: 0 });

  describe("The Last Case's finale", () => {
    it("tears the screen from the impact for 1.5 s, fading out", () => {
      expect(tearAt(I - 0.01)).toBeNull();
      expect(tearAt(I)).toEqual({ strength: 1, slot: 0 });
      expect(tearAt(I + 0.75)!.strength).toBeGreaterThan(tearAt(I + 1.4)!.strength);
      expect(tearAt(I + TEAR_SECONDS)).toBeNull();
    });

    it("the tear reseeds at most 3 times a second and asks the gate (Review Focus 5)", () => {
      const slots = new Set<number>();
      for (let t = I; t < I + TEAR_SECONDS; t += 1 / 144) slots.add(tearAt(t)!.slot);
      expect(slots.size).toBeLessThanOrEqual(Math.ceil(TEAR_SECONDS * TEAR_RESEEDS_PER_SECOND));
      expect(TEAR_RESEEDS_PER_SECOND).toBeLessThanOrEqual(3);
      // the impact's flash and two kicks take the gate: a reseed in that second is refused, and the slices hold
      const gate = new FlashGate();
      [0, 0.2, 0.4].forEach((t) => gate.take(t));
      expect(gate.take(0.5)).toBe(false);
    });

    it("the tear and the reels are functions of the vault's clock (Review Focus 2)", () => {
      expect(tearAt(I + 0.5)).toEqual(tearAt(I + 0.5));
      expect(finaleSpin(opening(1.2), true)).toEqual({ elapsed: 1.2, duration: I });
      expect(finaleSpin(opening(I), true)).toBeNull(); // the lid is open: they have landed
      expect(finaleSpin(opening(1.2), false)).toBeNull(); // only The Last Case
      expect(finaleSpin({ phase: "key" }, true)).toBeNull();
      expect(finaleSpin(null, true)).toBeNull();
    });

    it("lightens the dim while the reels spin, so they show", () => {
      expect(finaleDim(true, 1, 0.86)).toBe(FINALE_INTRO_DIM);
      expect(finaleDim(true, I, 0.86)).toBe(0.86);
      expect(finaleDim(false, 1, 0.86)).toBe(0.86);
    });
  });
  ```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/vault/finaleRules.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Write `fx/vault/finaleRules.ts`.**
  ```ts
  import type { VaultState } from "../../sim/run";
  import { VAULT_CUES } from "./cues";

  // The Last Case's finale (finish spec §7.4), as pure functions of the vault's clock so a reload lands on the same
  // frame: the screen tears from the impact for TEAR_SECONDS (its slices reseed at most TEAR_RESEEDS_PER_SECOND, each
  // reseed asking the flash gate), and every reel on screen spins one long free spin from the key turn that lands as the
  // lid opens, under a lighter dim so it shows.

  export const TEAR_SECONDS = 1.5;
  export const TEAR_RESEEDS_PER_SECOND = 3;
  /** The slices' largest offset, screen px at pixel scale 4 (scaled by k / 4 and the strength). */
  export const TEAR_OFFSET = 24;
  export const FINALE_INTRO_DIM = 0.55;

  export interface Tear {
    /** 1 at the impact, easing to 0 at the end. */
    strength: number;
    /** Which reseed window this is (the slices reseed when it changes). */
    slot: number;
  }

  export function tearAt(t: number): Tear | null {
    const d = t - VAULT_CUES.impact;
    if (d < 0 || d >= TEAR_SECONDS) return null;
    return { strength: 1 - (d / TEAR_SECONDS) ** 2, slot: Math.floor(d * TEAR_RESEEDS_PER_SECOND) };
  }

  /** The reels' free spin while the intro plays (key turn → impact); null outside it or for an ordinary vault. */
  export function finaleSpin(v: VaultState | null, finale: boolean): { elapsed: number; duration: number } | null {
    if (!finale || v?.phase !== "opening" || v.t >= VAULT_CUES.impact) return null;
    return { elapsed: v.t, duration: VAULT_CUES.impact };
  }

  export const finaleDim = (finale: boolean, t: number, dimOpen: number): number => (finale && t < VAULT_CUES.impact ? FINALE_INTRO_DIM : dimOpen);
  ```

- [ ] **Step 4: Write `fx/vault/Finale.ts`.**
  ```ts
  import { GlitchFilter } from "pixi-filters";
  import type { Container } from "pixi.js";
  import { caseById } from "../../sim/content/cases";
  import { vaultFor } from "../../sim/content/vaults";
  import type { Rng } from "../../sim/rng";
  import type { Run } from "../../sim/run";
  import type { CaseDef, SkinDef } from "../../sim/types";
  import type { HdLayer } from "../hd/HdLayer";
  import { finaleSpin, TEAR_OFFSET, tearAt } from "./finaleRules";
  import { vaultLook } from "./vaultLooks";

  // The Last Case's two extras (finish spec §7.4), driven from the sim every frame: the screen tear (a GlitchFilter on
  // the scene and the vault, off outside its window) and the table's reels spinning until the lid opens. Ordinary vaults
  // never touch either.

  /** What the finale asks of the table's reels (the World's bench reels, the stations' bot reels). */
  export interface FinaleReels {
    benchFreeSpin(c: CaseDef, winner: SkinDef, rng: Rng, start: boolean, elapsed: number, duration: number): void;
    botFreeSpin(caseId: string, skinIds: string[], start: boolean, elapsed: number, duration: number): void;
  }

  export class Finale {
    private readonly tear = new GlitchFilter({ slices: 10, offset: 0, red: [3, 0], blue: [-3, 0] });
    private slot = -1;
    private spinning = false;

    constructor(
      targets: Container[],
      private readonly hd: HdLayer,
      private readonly reels: FinaleReels,
      private readonly rng: Rng,
    ) {
      this.tear.enabled = false;
      for (const c of targets) c.filters = [...(c.filters ?? []), this.tear];
    }

    update(run: Run, k: number): void {
      const s = run.state;
      const def = vaultFor(run.setup.run);
      const finale = vaultLook(def.id).finale;
      const t = s.vault?.phase === "opening" ? s.vault.t : -1;
      const tear = finale ? tearAt(t) : null;
      this.tear.enabled = tear !== null;
      if (tear) {
        this.tear.offset = Math.round(((TEAR_OFFSET * k) / 4) * tear.strength);
        // a new slice pattern at most 3 times a second, and only when the flash gate allows (a refusal holds them)
        if (tear.slot !== this.slot && this.hd.takeFlash()) {
          this.tear.seed = this.rng.next();
          this.tear.refresh();
          this.slot = tear.slot;
        }
      } else this.slot = -1;
      const spin = finaleSpin(s.vault, finale);
      if (spin) {
        const c = caseById(def.sourceCase);
        const start = !this.spinning; // the first frame of the intro, or the first after a reload
        this.reels.benchFreeSpin(c, this.rng.pick(c.skins), this.rng, start, spin.elapsed, spin.duration);
        this.reels.botFreeSpin(c.id, [this.rng.pick(c.skins).id, this.rng.pick(c.skins).id], start, spin.elapsed, spin.duration);
      }
      this.spinning = spin !== null;
    }

    destroy(): void {
      this.tear.destroy();
    }
  }
  ```
  (Check `GlitchFilter`'s API in `node_modules/pixi-filters/lib/glitch/GlitchFilter.d.ts`: if it has no `refresh()`, use `shuffle()` then `redraw()`. The winner skins only matter on `start`; the implementations ignore them otherwise.)

- [ ] **Step 5: The hooks.**
  - `fx/pixel/BenchReels.ts`:
  ```ts
    /** The Last Case's free spin (finale.ts): one reel of the vault's source case, landing as the lid opens. */
    freeSpin(c: CaseDef, winner: SkinDef, rng: Rng, start: boolean, elapsed: number, duration: number): void {
      if (start) this.idle(c, winner, rng);
      this.root.update(0, { elapsed, fullDuration: duration, crawl: 0 });
    }
  ```
  - `fx/stations/BotStation.ts`: `finaleSpin(caseId: string, skinIds: string[], start: boolean, elapsed: number, duration: number): void { if (start) this.reels.start(caseId, skinIds, this.d.rng); this.reels.update({ caseId, drops: [], elapsed, duration }); }` (use the field names BotStation has for its reels and deps); `Stations.finaleSpin(…)` forwards to it.
  - `fx/vault/VaultScene.ts`, the dim line: `const dimTarget = this.phase === "key" ? DIM_KEY : finaleDim(this.look.finale, this.t, DIM_OPEN);` (import `finaleDim`).
  - `fx/World.ts`: a field `private readonly finale: Finale;`, built after the `StageLook` and the vault scene (so its filter goes after theirs):
  ```ts
    this.finale = new Finale([this.scene, this.vault.root], this.hd, {
      benchFreeSpin: (c, w, rng, start, e, d) => this.benchReels.freeSpin(c, w, rng, start, e, d),
      botFreeSpin: (id, skins, start, e, d) => this.stations.finaleSpin(id, skins, start, e, d),
    }, this.rng);
  ```
    `this.finale.update(this.controller.run, this.vp.scale);` as the last line of `updateVault`, and `this.finale.destroy();` in `destroy`.
  - **World's size:** compare `wc -l fx/World.ts` with its count before this task. If it grew, move `syncVault()` and `restoreVault()` (with their doc comments) into a new `fx/vault/vaultSync.ts` as functions taking what they use (`{ vault, vaultBeams, power, controller, audio, running, resumeMusic }`), and call them from World in one line each, until World is back at (or under) its old count. Task 5 adds its lines under the same rule.

- [ ] **Step 6: Run the tests.**
  Run: `npx vitest run src/modules/casecremental`
  Expected: PASS.

- [ ] **Step 7: Commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/fx/vault src/modules/casecremental/fx/pixel/BenchReels.ts src/modules/casecremental/fx/stations src/modules/casecremental/fx/World.ts
  git commit -m "feat(run4): The Last Case's finale - the screen tears at the impact through the flash gate, every reel spins until the lid opens

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 4: THE END — the prestige screen after The Last Case

After The Last Case (once the credits end, Task 5) the prestige screen says what happened and what is next: the title "THE LAST CASE OPENED", the trophy "★ Singularity trophy", the CLOUT it paid, then **"THE END"** and "RUN 4 AGAIN, BOOSTED" (the campaign replays Run 4 with `VAULT_GROWTH` per loop). F6-A's interim numeral ("VAULT IV OPENED") and the stale "RUN 4: IN A LATER UPDATE" go.

**Files:**
- Modify: `ui/prestigeRules.ts`, `ui/prestigeRules.test.ts`, `ui/Prestige.tsx`, `i18n/en.ts`, `i18n/ru.ts`

**Interfaces:**
- Produces: `prestigeTitle(id: VaultDef["id"]): string`, `trophyLine(id: VaultDef["id"]): string`, `endScreen(p: PrestigeView | null): "credits" | "prestige" | null` (replacing `vaultNumeral`).

- [ ] **Step 1: Write the failing tests** in `ui/prestigeRules.test.ts`. Replace "names the vault that just opened, in both languages" with:
  ```ts
  it("names the vault that just opened, and The Last Case, in both languages", () => {
    try {
      setLang("en");
      expect(prestigeTitle("vault1")).toBe("VAULT I OPENED");
      expect(prestigeTitle("vault3")).toBe("VAULT III OPENED");
      expect(trophyLine("vault2")).toBe("★ Vault II trophy");
      expect(prestigeTitle("lastcase")).toBe("THE LAST CASE OPENED");
      expect(trophyLine("lastcase")).toBe("★ Singularity trophy");
      expect(t("prestige.end")).toBe("THE END");
      expect(t("prestige.again", { n: 4 })).toBe("RUN 4 AGAIN, BOOSTED");
      setLang("ru");
      expect(prestigeTitle("vault2")).toBe("СЕЙФ II ВСКРЫТ");
      expect(trophyLine("vault3")).toBe("★ Трофей «Сейф III»");
      expect(prestigeTitle("lastcase")).toBe("ПОСЛЕДНИЙ КЕЙС ВСКРЫТ");
      expect(trophyLine("lastcase")).toBe("★ Трофей «Сингулярность»");
      expect(t("prestige.end")).toBe("КОНЕЦ");
    } finally {
      setLang("en");
    }
  });

  it("shows the credits while they roll, then the prestige screen (Review Focus 1)", () => {
    expect(endScreen(null)).toBeNull();
    expect(endScreen(view({ credits: true }))).toBe("credits");
    expect(endScreen(view({ credits: false }))).toBe("prestige");
  });
  ```
  and give the `view()` helper the new fields' defaults: `nextRun: 2, replay: false, credits: false, stats: { playSeconds: 0, opened: 0, best: null, cloutEarned: 0 },`.

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/ui/prestigeRules.test.ts`
  Expected: FAIL.

- [ ] **Step 3: The rules and strings.**
  - `ui/prestigeRules.ts`:
  ```ts
  const NUMERALS: Readonly<Record<Exclude<VaultDef["id"], "lastcase">, string>> = { vault1: "I", vault2: "II", vault3: "III" };

  /** The prestige screen's title: "VAULT II OPENED", or The Last Case's own. */
  export const prestigeTitle = (id: VaultDef["id"]): string =>
    id === "lastcase" ? t("prestige.lastTitle") : t("prestige.title", { n: NUMERALS[id] });

  /** The trophy the vault left: "★ Vault II trophy", or ★ Singularity. */
  export const trophyLine = (id: VaultDef["id"]): string => (id === "lastcase" ? t("prestige.lastTrophy") : t("prestige.trophy", { n: NUMERALS[id] }));

  /** What the end of a run shows: the credits while they roll (after The Last Case), else the prestige screen. */
  export const endScreen = (p: PrestigeView | null): "credits" | "prestige" | null => (p ? (p.credits ? "credits" : "prestige") : null);
  ```
    and delete `vaultNumeral`.
  - i18n (EN / RU): add `"prestige.lastTitle": "THE LAST CASE OPENED"` / `"ПОСЛЕДНИЙ КЕЙС ВСКРЫТ"`, `"prestige.lastTrophy": "★ Singularity trophy"` / `"★ Трофей «Сингулярность»"`, `"prestige.end": "THE END"` / `"КОНЕЦ"`; delete `"prestige.later"` from both.
  - `ui/Prestige.tsx`: `aria-label={prestigeTitle(vault)}`, the title `{prestigeTitle(vault)}`, the trophy `{trophyLine(vault)}`; the replay branch:
  ```tsx
        {p.replay ? (
          <>
            <div className="cc-title cc-gold" style={{ fontSize: "calc(var(--fs) * 2)" }}>{t("prestige.end")}</div>
            <div>{t("prestige.again", { n: p.nextRun })}</div>
          </>
        ) : ( … the brings, as now … )}
  ```
    The "NEXT: RUN {n}" title line stays above it. Update the header comment: "After the vault (M2b spec §8; after The Last Case: THE END, finish spec §7.4): …".

- [ ] **Step 4: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/ui src/modules/casecremental/i18n`
  Expected: PASS.

- [ ] **Step 5: Commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/ui/prestigeRules.ts src/modules/casecremental/ui/prestigeRules.test.ts src/modules/casecremental/ui/Prestige.tsx src/modules/casecremental/i18n
  git commit -m "feat(run4): THE END - the prestige screen after The Last Case: its title, ★ Singularity, Run 4 again, boosted

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 5: The credits

After the results hold (the blackout and the prestige delay, as for every vault), a black screen and a slow scroll, bottom to top over `CREDITS_SECONDS` (70 s), to the credits track (F5's `credits`; the prestige loop when it is missing):
1. **CASECREMENTAL** (gold, large)
2. MADE BY — **Yerassyl Omirtay** (the git author name)
3. BUILT WITH — iDosGames · PixiJS · ElevenLabs · Claude
4. THANK YOU FOR PLAYING
5. YOUR CAMPAIGN — Time played, Cases opened, Best drop (its name in its rarity colour, and its value), CLOUT earned

A SKIP button appears after 5 s. Skipping, or the end of the scroll, sends `endCredits` (F6-A); the prestige screen (Task 4) follows. A reload during the credits starts them over (`meta.credits` holds them). They roll after every opening of The Last Case, replays included (skippable after 5 s).

**Files:**
- Create: `ui/creditsRules.ts`, `ui/creditsRules.test.ts`, `ui/Credits.tsx`
- Modify: `ui/GamePanel.tsx`, `fx/vault/vaultFlow.ts`, `fx/vault/vaultFlow.test.ts`, `fx/audio/AudioEngine.ts`, `fx/audio/AudioEngine.test.ts`, `fx/audio/sounds.ts` (only if F5 did not add `credits`), `fx/World.ts` (no net growth), `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`

**Interfaces:**
- Consumes: `PrestigeView.credits`, `PrestigeView.stats` (F6-A), the `endCredits` action, the `creditsEnded` event, F5's `credits` track.
- Produces:
  ```ts
  // ui/creditsRules.ts
  export const GAME_NAME = "CASECREMENTAL";
  export const MADE_BY = "Yerassyl Omirtay";
  export const TOOLS: readonly string[]; // ["iDosGames", "PixiJS", "ElevenLabs", "Claude"]
  export const CREDITS_SECONDS = 70;
  export const SKIP_AFTER_SECONDS = 5;
  export type CreditLine = { kind: "title" | "head" | "name" | "stat" | "gap"; text: string; color?: string };
  export function creditLines(stats: CampaignStats, lang: Lang): CreditLine[];
  export function formatDuration(seconds: number): string; // in the current language
  export const canSkip: (elapsed: number) => boolean;
  export const creditsOver: (elapsed: number) => boolean;
  export function scrollY(elapsed: number, contentH: number, viewH: number): number;
  // fx/vault/vaultFlow.ts
  export function afterRunTrack(credits: boolean, hasCredits: boolean): TrackId;
  // musicPlan(s, power, fanfare, afterRun?: TrackId); PowerCycle.blackout(track?: TrackId)
  // fx/audio/AudioEngine.ts
  hasTrack(id: TrackId): boolean;
  ```

- [ ] **Step 1: Write the failing tests.**
  `ui/creditsRules.test.ts`:
  ```ts
  import { afterEach, describe, expect, it } from "vitest";
  import { budgetFor, fitsBudget } from "../i18n/budgets";
  import { setLang } from "../i18n/index";
  import { canSkip, CREDITS_SECONDS, creditLines, creditsOver, formatDuration, GAME_NAME, MADE_BY, scrollY, SKIP_AFTER_SECONDS, TOOLS } from "./creditsRules";

  afterEach(() => setLang("en"));
  const stats = {
    playSeconds: 3725,
    opened: 12345,
    best: { id: 9, caseId: "feverdream", skinId: "fd_knife", rarity: "gold", float: 0.01, wear: "FN", statTrak: true, value: 4.2e12 },
    cloutEarned: 321,
  } as const;

  describe("the credits", () => {
    it("credit the game, its maker, its tools, the player, and show the campaign", () => {
      const text = creditLines(stats, "en").map((l) => l.text);
      expect(text[0]).toBe(GAME_NAME);
      expect(text).toContain(MADE_BY);
      expect(MADE_BY).toBe("Yerassyl Omirtay");
      for (const tool of TOOLS) expect(text).toContain(tool);
      expect(TOOLS).toEqual(["iDosGames", "PixiJS", "ElevenLabs", "Claude"]);
      expect(text).toContain("THANK YOU FOR PLAYING");
      expect(text).toContain("Time played: 1h 2m");
      expect(text).toContain("Cases opened: 12,345");
      expect(text).toContain("CLOUT earned: 321");
      expect(text.some((s) => s.includes("Daydream"))).toBe(true);
      expect(creditLines({ ...stats, best: null }, "en").some((l) => l.text.startsWith("Best drop"))).toBe(false);
    });

    it("write time in both languages", () => {
      expect(formatDuration(3725)).toBe("1h 2m");
      expect(formatDuration(125)).toBe("2m");
      setLang("ru");
      expect(formatDuration(3725)).toBe("1 ч 2 мин");
      expect(formatDuration(30)).toBe("0 мин");
    });

    it("can be skipped only after 5 s, and end by themselves (Review Focus 4)", () => {
      expect(SKIP_AFTER_SECONDS).toBe(5);
      expect(canSkip(4.99)).toBe(false);
      expect(canSkip(5)).toBe(true);
      expect(creditsOver(CREDITS_SECONDS - 0.01)).toBe(false);
      expect(creditsOver(CREDITS_SECONDS)).toBe(true);
    });

    it("scroll up from below the screen until the last line has left it", () => {
      expect(scrollY(0, 900, 400)).toBe(400);
      expect(scrollY(CREDITS_SECONDS, 900, 400)).toBe(-900);
      expect(scrollY(CREDITS_SECONDS * 2, 900, 400)).toBe(-900);
      for (let e = 1; e <= CREDITS_SECONDS; e++) expect(scrollY(e, 900, 400)).toBeLessThan(scrollY(e - 1, 900, 400));
    });

    it.each(["en", "ru"] as const)("fit their lines (%s)", (lang) => {
      setLang(lang);
      for (const l of creditLines(stats, lang)) if (l.kind === "head" || l.kind === "stat") expect(fitsBudget(l.text, budgetFor("credits.x")), l.text).toBe(true);
    });
  });
  ```
  `fx/vault/vaultFlow.test.ts`:
  ```ts
  it("picks the credits track while the credits roll, the prestige loop after (Review Focus 1)", () => {
    const over = { vault: null, over: true };
    expect(musicPlan(over, "dark", "vault-fanfare", "credits").track).toBe("credits");
    expect(musicPlan(over, "dark").track).toBe("prestige");
    expect(musicPlan(over, "blackout", "vault-fanfare", "credits")).toMatchObject({ track: "credits", musicOn: false });
  });

  it("falls back to the prestige loop without a credits track (Review Focus 3)", () => {
    expect(afterRunTrack(true, true)).toBe("credits");
    expect(afterRunTrack(true, false)).toBe("prestige");
    expect(afterRunTrack(false, true)).toBe("prestige");
  });

  it("fades to black, then starts the run's after-track in the dark", () => {
    const rec = recorder(); // the existing PowerCycle test's audio recorder
    const p = new PowerCycle(rec);
    p.blackout("credits");
    p.update(BLACKOUT_SECONDS + 0.01);
    expect(rec.tracks.at(-1)).toMatchObject({ id: "credits", loop: true });
  });
  ```
  (Use the recorder the existing "fades to black, then starts the prestige loop in the dark" test builds; match its field names.)
  `fx/audio/AudioEngine.test.ts`: `it("knows which named tracks it has", …)`: an engine built with `{ "a/prestige.mp3": "p" }` → `hasTrack("prestige") === true`, `hasTrack("credits") === false`.

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/ui/creditsRules.test.ts src/modules/casecremental/fx/vault/vaultFlow.test.ts src/modules/casecremental/fx/audio/AudioEngine.test.ts`
  Expected: FAIL.

- [ ] **Step 3: The strings.** `i18n/budgets.ts`: `["credits.", 24],`. EN / RU:

  | key | EN | RU |
  |---|---|---|
  | `credits.madeby` | MADE BY | АВТОР |
  | `credits.tools` | BUILT WITH | СДЕЛАНО НА |
  | `credits.thanks` | THANK YOU FOR PLAYING | СПАСИБО ЗА ИГРУ |
  | `credits.stats` | YOUR CAMPAIGN | ВАША КАМПАНИЯ |
  | `credits.time` | Time played: {t} | Время в игре: {t} |
  | `credits.opened` | Cases opened: {n} | Открыто кейсов: {n} |
  | `credits.best` | Best drop: | Лучший дроп: |
  | `credits.clout` | CLOUT earned: {n} | Получено CLOUT: {n} |
  | `credits.hm` | {h}h {m}m | {h} ч {m} мин |
  | `credits.m` | {m}m | {m} мин |
  | `btn.skip` | SKIP | ДАЛЕЕ |

- [ ] **Step 4: Write `ui/creditsRules.ts`.**
  ```ts
  import { rarityName, skinName, weaponName } from "../i18n/content";
  import { t, type Lang } from "../i18n/index";
  import { skinById } from "../sim/content/cases";
  import { formatCash } from "../sim/format";
  import type { CampaignStats } from "../sim/meta";
  import { RARITY_INFO } from "../sim/rarity";

  // The credits after The Last Case (finish spec §7.4): the lines of the scroll, how far it has scrolled, when it can be
  // skipped and when it ends. Pure, so the overlay (Credits.tsx) only draws.

  export const GAME_NAME = "CASECREMENTAL";
  /** The game's maker: the git author of the project. */
  export const MADE_BY = "Yerassyl Omirtay";
  export const TOOLS: readonly string[] = ["iDosGames", "PixiJS", "ElevenLabs", "Claude"];
  export const CREDITS_SECONDS = 70;
  export const SKIP_AFTER_SECONDS = 5;

  export type CreditLine = { kind: "title" | "head" | "name" | "stat" | "gap"; text: string; color?: string };

  const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

  /** Whole minutes, with hours from 60 min ("1h 2m", «1 ч 2 мин»), in the current language. */
  export function formatDuration(seconds: number): string {
    const m = Math.floor(Math.max(0, seconds) / 60);
    return m >= 60 ? t("credits.hm", { h: Math.floor(m / 60), m: m % 60 }) : t("credits.m", { m });
  }

  export function creditLines(stats: CampaignStats, lang: Lang): CreditLine[] {
    const gap: CreditLine = { kind: "gap", text: "" };
    const lines: CreditLine[] = [
      { kind: "title", text: GAME_NAME, color: "#ffd34d" },
      gap,
      { kind: "head", text: t("credits.madeby") },
      { kind: "name", text: MADE_BY },
      gap,
      { kind: "head", text: t("credits.tools") },
      ...TOOLS.map((text): CreditLine => ({ kind: "name", text })),
      gap,
      { kind: "head", text: t("credits.thanks") },
      gap,
      { kind: "head", text: t("credits.stats") },
      { kind: "stat", text: t("credits.time", { t: formatDuration(stats.playSeconds) }) },
      { kind: "stat", text: t("credits.opened", { n: stats.opened.toLocaleString(lang === "ru" ? "ru-RU" : "en-US") }) },
    ];
    const best = stats.best;
    if (best) {
      const s = skinById(best.skinId);
      lines.push(
        { kind: "stat", text: t("credits.best") },
        { kind: "name", text: `${weaponName(s.weapon)} | ${skinName(s.id)}`, color: hex(RARITY_INFO[best.rarity].color) },
        { kind: "name", text: `${rarityName(best.rarity)} · ${formatCash(best.value, lang)}` },
      );
    }
    lines.push({ kind: "stat", text: t("credits.clout", { n: stats.cloutEarned }) });
    return lines;
  }

  export const canSkip = (elapsed: number): boolean => elapsed >= SKIP_AFTER_SECONDS;
  export const creditsOver = (elapsed: number): boolean => elapsed >= CREDITS_SECONDS;

  /** The column's top, px from the screen's top: just below the screen at 0, the last line gone at CREDITS_SECONDS. */
  export function scrollY(elapsed: number, contentH: number, viewH: number): number {
    const k = Math.min(1, Math.max(0, elapsed / CREDITS_SECONDS));
    return viewH - (viewH + contentH) * k;
  }
  ```
  (`toLocaleString("ru-RU")` uses a narrow no-break space; the RU budget test measures characters, so it fits. If the test environment lacks ICU data for ru-RU, format the thousands by hand with a space.)

- [ ] **Step 5: Write `ui/Credits.tsx`.**
  ```tsx
  import { useEffect, useRef, useState, type ReactNode } from "react";
  import type { Action } from "../game/controller";
  import type { PrestigeView } from "../game/view";
  import { getLang, t } from "../i18n/index";
  import { PxButton } from "./parts";
  import { creditLines, creditsOver, scrollY, SKIP_AFTER_SECONDS } from "./creditsRules";

  // The credits after The Last Case (finish spec §7.4): black, a slow scroll over CREDITS_SECONDS, SKIP after 5 s; the
  // end (or SKIP) sends endCredits and the prestige screen follows. The scroll moves by a requestAnimationFrame loop on a
  // ref (no React render per frame). A reload starts them over: the meta holds them until they end.

  export function Credits({ p, act }: { p: PrestigeView; act: (a: Action) => void }): ReactNode {
    const col = useRef<HTMLDivElement>(null);
    const box = useRef<HTMLDivElement>(null);
    const [skippable, setSkippable] = useState(false);
    const lang = getLang();
    useEffect(() => {
      const start = performance.now();
      let raf = 0;
      let done = false;
      const frame = () => {
        const elapsed = (performance.now() - start) / 1000;
        if (col.current && box.current) col.current.style.transform = `translateY(${scrollY(elapsed, col.current.offsetHeight, box.current.offsetHeight)}px)`;
        if (creditsOver(elapsed) && !done) {
          done = true;
          act({ type: "endCredits" });
          return;
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      const timer = setTimeout(() => setSkippable(true), SKIP_AFTER_SECONDS * 1000); // canSkip's 5 s
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }, [act]);
    return (
      <div ref={box} className="cc-modal" style={{ background: "#000", overflow: "hidden", pointerEvents: "auto" }} role="dialog" aria-label={t("credits.thanks")}>
        <div ref={col} lang={lang} style={{ position: "absolute", left: 0, right: 0, top: 0, display: "grid", justifyItems: "center", gap: "calc(var(--fs) * 0.8)", textAlign: "center" }}>
          {creditLines(p.stats, lang).map((l, i) =>
            l.kind === "gap" ? (
              <div key={i} style={{ height: "calc(var(--fs) * 3)" }} />
            ) : (
              <div
                key={i}
                className={l.kind === "head" ? "cc-dim" : undefined}
                style={{ color: l.color, fontSize: l.kind === "title" ? "calc(var(--fs) * 3)" : undefined }}
              >
                {l.text}
              </div>
            ),
          )}
        </div>
        {skippable ? (
          <PxButton style={{ position: "absolute", right: "calc(var(--px) * 6px)", bottom: "calc(var(--px) * 6px)" }} onClick={() => act({ type: "endCredits" })}>
            {t("btn.skip")}
          </PxButton>
        ) : null}
      </div>
    );
  }
  ```
  `ui/GamePanel.tsx`: replace the prestige block with
  ```tsx
            {prestigeShown && view.prestige ? (
              endScreen(view.prestige) === "credits" ? (
                <Credits p={view.prestige} act={act} />
              ) : (
                <Prestige p={view.prestige} vault={view.vault.id} act={act} onSettings={openSettings} />
              )
            ) : null}
  ```
  (`act` is the module-level function in `makeGamePanel`, stable across renders.)

- [ ] **Step 6: The music.**
  - `fx/audio/sounds.ts`: if F5 did not add it, add `"credits"` to `TrackId`, `credits: 1` to `TRACK_GAIN` (F5's measured level if it set one), and `credits` to the track regex; else nothing.
  - `fx/audio/AudioEngine.ts`: `/** The named track has a file (a credits track may be missing). */ hasTrack(id: TrackId): boolean { return this.files.tracks.has(id); }`.
  - `fx/vault/vaultFlow.ts`:
  ```ts
  /** What plays in the dark after a run: the credits track while the credits roll (when it exists), else the prestige loop. */
  export const afterRunTrack = (credits: boolean, hasCredits: boolean): TrackId => (credits && hasCredits ? "credits" : "prestige");
  ```
    `musicPlan(s, power, fanfare = "vault-fanfare", afterRun: TrackId = "prestige")` uses `afterRun` where it says `"prestige"` today; `PowerCycle.blackout(track: TrackId = "prestige")` stores it and `update` starts it instead of the literal; the header comment says "the credits or the prestige loop".
  - `fx/World.ts` (no net growth, Task 3's rule):
    - `resumeMusic`: `applyMusic(this.audio, musicPlan(this.controller.run.state, this.power.phase, this.vault.fanfare, this.afterRun()));` with a one-line private `private afterRun = (): TrackId => afterRunTrack(this.controller.meta.credits, this.audio.hasTrack("credits"));` (import `TrackId`);
    - `case "vaultOpened": this.power.blackout(this.afterRun()); break;` (the controller ran `completeVault` before emitting, so `meta.credits` is already set);
    - `case "creditsEnded":` as a label on the line above an existing case whose body calls `this.resumeMusic()` only — if there is none, add `case "creditsEnded": this.resumeMusic(); break;` and pay for the lines by Task 3's extraction.

- [ ] **Step 7: Run the tests.**
  Run: `npx vitest run src/modules/casecremental`
  Expected: PASS.

- [ ] **Step 8: Commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/ui src/modules/casecremental/fx/vault src/modules/casecremental/fx/audio src/modules/casecremental/fx/World.ts src/modules/casecremental/i18n
  git commit -m "feat(run4): the credits after The Last Case - the maker, the tools, the campaign's stats, SKIP after 5 s, the credits track

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 6: The browser pass of F6

**Files:** none unless a check fails; a fix goes in the owning file (with a test where one fits), committed on its own as `fix(run4): …`.

- [ ] **Step 1: The checks pass.** `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
- [ ] **Step 2: Start the game.** `npm run dev` in the background; the scratch harness `http://localhost:5180/.superpowers/harness/index.html?state=empty&cash=500` (`&save=1` for reloads, `&lang=ru`), `window.cc.controller`. Load the browser tools in one call (`ToolSearch` → `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__resize_window,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__gif_creator`); check the open tabs and work in a new one. No browser connected → headless Chrome over CDP (`--remote-debugging-port=9222`, `Runtime.evaluate`), as M3's final pass did; say which in the report.
- [ ] **Step 3: Vault III leads into Run 4.** `devStartRun(3)`, unlock and buy Vault III (`devAddCash`). The prestige screen: "NEXT: RUN 4" and its brings (Glitch, Fever Dream, The Upgrader, Evolutions, bot speed x100, the bot opens x3) — no "later update" line. Start Run 4.
- [ ] **Step 4: Run 4 to The Last Case** (1920×1080). Buy the shelf; The Last Case shows on the shelf once all nine cases are unlocked (its name, its price, the HUD goal). With the Upgrader spinning, buy The Last Case: the spin settles (a win is cashed in). Turn the devil key and record a GIF (`gif_creator`) of the whole opening:
  - from the key turn the bench's and the bot's reels spin under a lighter dim and land as the lid snaps open;
  - the chest is black glass with gold seams; the beams white / gold / void; the most fireworks of any vault;
  - at the impact the screen tears for ~1.5 s (slices offset, fading), with no more than 3 changes in any second (count the flashes and tear reseeds in the GIF frames);
  - the fifth beam's legend is ★ Singularity, animated (its hues turning, the knife flipping);
  - the fanfare is higher than Vault III's (someone listens, if possible).
  Reload at 2 s (`&save=1`): the reels resume mid-spin and land at the impact. Reload at impact + 0.5 s: the tear finishes its window, no impact replays.
- [ ] **Step 5: The credits.** After the results hold and the blackout: black, the credits track (or the prestige loop if F5 has no `credits` file — check `cc` audio or the network tab), the scroll: CASECREMENTAL, MADE BY Yerassyl Omirtay, BUILT WITH iDosGames · PixiJS · ElevenLabs · Claude, THANK YOU FOR PLAYING, the campaign stats (time, opens, the best drop in its colour, CLOUT). No SKIP before 5 s; SKIP after. Reload during the credits: they start over with their music. Let one run to the end by itself: the prestige screen follows.
- [ ] **Step 6: THE END.** The prestige screen: "THE LAST CASE OPENED", "★ Singularity trophy", the CLOUT, "THE END", "RUN 4 AGAIN, BOOSTED"; Loaded Dice can be among the offered charms (Run 4's pool). Start the next run: Run 4 again, The Last Case's price × `VAULT_GROWTH`. Open it again: the credits roll again (skippable after 5 s).
- [ ] **Step 7: Russian and portrait.** RU: ПОСЛЕДНИЙ КЕЙС ВСКРЫТ, ★ Трофей «Сингулярность», КОНЕЦ, СНОВА ЗАБЕГ 4, СИЛЬНЕЕ, the credits' Russian lines, ДАЛЕЕ — no word broken across lines, nothing clipped. 390×844 and 820×1180: the vault, the tear, the credits' column centred and readable, SKIP inside the screen.
- [ ] **Step 8: Frame times.** During The Last Case's opening at 1920×1080 (the densest chaos plus the tear), sample frame times as in F6-B Task 6 Step 7: p95 ≤ 20 ms. If not: lower `MAX_DENSITY`'s rain/spark share for The Last Case (2.5 → 2.25) or the tear's slices — never the flash schedule.
- [ ] **Step 9: The console is clean.** `read_console_messages` with `error|warn|casecremental`: no errors; no `sprite "vault-case-4" not built`; no missing-track warning (a missing `credits` file is expected only if F5 has none, and then the prestige loop must be playing).
- [ ] **Step 10: Report** the GIF and screenshot paths, the frame times, and what was found and fixed.

---

### Task 7: The feature history for F6

**Files:**
- Modify: `docs/feature-history/casecremental-finish.md` (created by F2), `docs/feature-history/casecremental-runs-2-3.md`, `docs/feature-history/README.md`

- [ ] **Step 1: Write the notes.** Add a section `## F6 — Run 4, The Last Case, the credits` to `casecremental-finish.md` with what the code does not show (short bullets, the file's voice):
  - Run 4's content (`RUN_CONTENT[3]`), and that every case has 13 skins (5/3/2/2/1): the spec's "14" was resolved to the count every case has.
  - The six finishes and their motions (`glitch` holds then jumps, 4 steps; `drip` runs down through the noise's period); F6-A shipped an interim finish for one plan.
  - The Upgrader's choices: the stake is the **whole** locker stack of a rarity; a win's rarity is 1/2/3 steps up by multiplier; its value is the inputs' base value × the multiplier; outcome and skin rolled at GO; it shares the locker's press (no trade-up or auto contract while it spins); a vault bought mid-spin settles it (a win cashed in, a loss gone).
  - Evolutions: Hot Hand's recipe reads the run's best combo (never drops); Cartel's double roll counts as one open; Money Printer only multiplies the auto-seller; Assembly Line's free case is one case (not the multi-open width) one tier up the unlocked shelf, the top case staying itself; Slot Machine raised the bench limit to 10 (`BENCH_OPEN_MAX`).
  - Why the new actions are not `Run` methods (the file-size rule on `sim/run.ts`): the controller, the agent and the greedy player call the sim functions with the run.
  - The save stayed at version 5 (new fields default in `normalize`); the campaign stats live in the meta (`meta.stats`) and `meta.credits` holds the credits across a reload; F7 mirrors the meta.
  - Stage 5's layers did not exist before F6 and were built minimal (warp, gold rain, glitch bursts, strobe), all through the flash gate; the measured frame times (F6-B Task 6, this plan's Task 6).
  - The art: generated (credits spent, takes chosen) or derived with ffmpeg (the recipes), from F6-B Task 2; the fanfare's +7 recipe and its measured level.
  - The finale: the tear's 3 reseeds a second share the flash gate; the reels' free spin is the vault's clock; the dim lightens to 0.55 for the intro.
  - The credits: every Last Case, skippable after 5 s, a reload starts them over; the maker's name is the git author's, a constant in `ui/creditsRules.ts`; the credits track falls back to the prestige loop.
  - Run 4's pacing medians (F6-A Task 8) and anything the browser pass found.
- [ ] **Step 2: Point the old notes forward.** In `casecremental-runs-2-3.md`, the line "After Vault III the campaign replays Run 3 … Run 4 is a later update." becomes "After Vault III comes Run 4; The Last Case replays Run 4 (see `casecremental-finish.md`, F6)." In `README.md`, extend the Finish entry's gist with "F6: Run 4 — Glitch and Fever Dream, the Upgrader, evolutions, The Last Case and the credits".
- [ ] **Step 3: Commit.**
  ```bash
  git add docs/feature-history
  git commit -m "docs(feature-history): F6 - Run 4, the Upgrader, evolutions, The Last Case and the credits

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

## Self-review notes (spec §7.4 coverage)

| Spec item | Covered in |
|---|---|
| The Last Case on the shelf once Run 4's cases are unlocked; Run 4's vault `lastcase`, trophy ★ Singularity | F6-A Task 2; checked here in Task 6 |
| Same ticket and timeline, own look: black glass with gold glitch seams, new chest sheet, white/gold/void beams, densest chaos | Task 2 (the sheet: F6-B Task 2) |
| Fanfare re-cut +7 semitones (ffmpeg rubberband, like -2/-3) | Task 1 |
| Screen tear at the impact ~1.5 s, gated by the flash rules | Task 3 |
| Every reel on screen spins at once until the lid opens | Task 3 |
| Fifth beam's legend ★ Singularity, animated | F6-A Task 2 (the legend's motion); checked in Task 6 |
| Credits after the results hold: black, credits track (fallback), slow scroll, game name, made by, tools, thank-you, stats; skippable after 5 s | Task 5 |
| Then the prestige screen: "THE END — Run 4 again, boosted" | Task 4 |
| Campaign stats in the meta | F6-A Task 5 |
| Browser pass, feature history | Tasks 6, 7 |
