# Casecremental M2b-C4 — the vault as a jackpot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Vault Case I's opening, from the key turning to the blackout, as a Vampire Survivors-style
legendary chest. The opening becomes a 14.5 s timeline:
- anticipation, then a snap-open impact;
- rainbow rays, then five vertical reel columns that cascade in and spin;
- left-to-right lock-ins with rising chimes;
- a celebration with a counting total, then a short results hold.

It comes with a new 8-bit jackpot sound set and an 8-bit chiptune fanfare.

**Architecture:**
- **The sim** keeps one fixed opening timeline (new land times, new length).
- **The fx side** draws everything from the clock `t`:
  - `fx/vault/cues.ts` turns `t` into phase values (pure, tested);
  - a new `VaultColumns` draws the five vertical reels in the vault's own pixel layer, driven by a pure,
    tested `columnMotion`;
  - `VaultScene` is re-choreographed and split into focused files.
- **Audio** comes from ElevenLabs. The files are measured before they are wired in.

**Tech Stack:** TypeScript strict, Vitest, PixiJS 8, the ElevenLabs MCP (audio only).

**Spec:** `docs/superpowers/specs/2026-10-09-casecremental-vault-jackpot-design.md` (the authority on timings, look
and audio). The key phase, the blackout, prestige and the lights coming back are in
`docs/superpowers/specs/2026-10-09-casecremental-m2b-rework-design.md` §4 and are not changed.

## Global Constraints

- **Timeline** (spec §1):
  - anticipation 0–0.9; held beat 0.9–1.0; impact 1.0;
  - rainbow and column cascade 1.5–2.5 (100 ms apart);
  - spin 2.5–6.0;
  - lock-ins `[6, 6.5, 7, 7.5, 8.5]`;
  - celebration 9.0–11.5; results hold to 14.5.
- **Fanfare timing:** the fanfare starts at the impact (`t = 1.0`). After a reload it resumes at offset `t − 1.0`
  and is silent before 1.0.
- **Drops** are decided by the sim before any animation. The columns always stop on them, and each landing pays
  once.
- **No skip action, no CONTINUE button, no reduced-motion mode.** The bench's multi-open stacked reels are
  untouched.
- **Layout:** the chest is at lower centre with the five columns above it. Rays and particles stay behind the
  icons and labels. Everything fits on landscape and portrait screens.
- **Numbers live in one place:**
  - sim numbers in `sim/tuning.ts`;
  - presentation timings in `fx/vault/cues.ts`;
  - sound levels in `fx/audio/sounds.ts`.
- **Files and input:** a file past ~400 lines that gains a new responsibility is split. Every player input goes
  through `controller.act`.
- **Strings:** English and Russian for any new string, within `i18n/budgets.ts`.
- **ElevenLabs:** the budget is ~4.5k credits (approved). Downloads go only into
  `src/modules/casecremental/assets/audio/` and `art/source/audio/`. Never sign in or create accounts.
- **Commit trailer:**
  ```
  Co-Authored-By: Claude <model> <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013MA8Fp47Lkjiuq8tVoGPyt
  ```
  Stage files by path.

## Review Focus

1. **Reload at any moment of the opening** (anticipation, mid-spin, between two lock-ins, during the count-up,
   in the hold):
   - the columns already landed show their drops and labels;
   - the others spin to their times;
   - the fanfare is at `t − 1` (silent before 1.0);
   - nothing is paid twice;
   - the count-up shows the right partial total.
2. **A lobby trip mid-opening:** the same as 1. The music re-syncs (`resumeMusic` / `bindMusicResync` still
   work).
3. **Portrait phone and wide desktop:** the chest, the five columns, their labels and the total are all on
   screen. Labels never overlap one another or the columns.
4. **The fifth column:** the animated ★ texture plays in its frame, and the strongest accent happens once
   (also after a reload past 8.5, when it shows already landed with no replayed burst).
5. **Audio files:** each one is at least ~80 % of its brief's length. `SOUNDS` and `art/manifest.json` list
   exactly the files on disk. `vault-fanfare-1.mp3` is the chosen take.

---

## File Structure (paths relative to `src/modules/casecremental/` unless they start with `art/` or `docs/`)

| File | Change |
|---|---|
| `sim/tuning.ts` | `VAULT_LAND_TIMES = [6, 6.5, 7, 7.5, 8.5]`, `VAULT_OPENING_SECONDS = 14.5` |
| `sim/vault.test.ts`, `sim/snapshot.test.ts` | Follow the new times |
| `fx/vault/cues.ts` | Rewritten: `VAULT_CUES` constants and `vaultCues(t)` per phase |
| `fx/vault/vaultFlow.ts` | `musicPlan`: fanfare offset `t − VAULT_CUES.impact`, silent before it |
| `fx/vault/columnMotion.ts` (new) | Pure: where a column's strip is at time `t` (spin, decelerate, overshoot, settle) |
| `fx/vault/VaultColumns.ts` (new) | Five clipped vertical reels in a pixel layer; lock-in juice and labels |
| `fx/vault/VaultReels.ts` | Deleted (replaced by `VaultColumns`) |
| `fx/vault/VaultScene.ts` | Re-choreographed; rays/starburst and chest motion split out |
| `fx/vault/rays.ts` (new) | Rainbow fan and starburst layers |
| `fx/vault/chest.ts` (new) | Chest scale-in, tremble, seam light, snap-open with overshoot, recoil, inner glow |
| `fx/vault/countUp.ts` (new, pure) | The displayed total at time `t` |
| `fx/World.ts` | Wiring only: columns instead of `VaultReels`; no growth past its current size |
| `fx/audio/sounds.ts` | New ids, `maxSeconds` where needed |
| `assets/audio/*.mp3`, `art/manifest.json`, `art/source/audio/` | Generated audio |
| `docs/feature-history/casecremental-run1.md` | The vault bullet |

---

### Task 1: The jackpot sound set (ElevenLabs)

**Files:** `assets/audio/` (new and replaced mp3s), `art/manifest.json` (audio entries), `fx/audio/sounds.ts`,
`fx/audio/sounds.test.ts` / `fx/audio/manifest.test.ts` (run), `art/source/audio/` (spare fanfare takes)

**Interfaces:**
- Produces the `SoundId`s `vault-riser`, `vault-open-hit`, `reward-chime`, `count-tick` and `count-ding`. The ids
  `firework`, `coin-fountain`, `legendary-choir`, `blackout`, `devil-key-whisper` and `devil-key-laugh` stay,
  with new files. `TrackId` `vault-fanfare` stays, with a new file.

- [ ] **Step 1: Learn the tools and price them.**
  - Read the ElevenLabs MCP model guide for sound effects and for music (`creative_get_model_guide`), and find
    how to set a sound effect's duration exactly.
  - The last batch came back rounded down to whole seconds and shorter than asked. Find out why: an integer
    duration parameter, or no parameter at all.
  - Price one SFX and one 12 s music take before you start, and keep a running total. The cap is 4,500
    credits. Stop and report if the next generation would cross it.
- [ ] **Step 2: Generate the sound effects.** Every SFX prompt ends with "Clean, punchy, no voice, no music
  bed."

| id | variants | length | prompt core |
|---|---|---|---|
| `vault-riser` | 1 | 1.2 s | A rising arcade jackpot anticipation: an 8-bit pitch riser that speeds up, a tight treasure-chest rattle, and an accelerating magical shimmer, ending on a held breath |
| `vault-open-hit` | 2 | 2 s | A slot-machine JACKPOT hit: a deep bassy 8-bit kick, a bright major chiptune chord stab, a burst of coins spilling and a casino bell ring-out |
| `reward-chime` | 2 | 1 s | A bright 8-bit reward chime: two quick rising square-wave notes with a sparkle tail, satisfying and clean |
| `count-tick` | 1 | 0.3 s | A tiny 8-bit coin counter tick, a short bright blip |
| `count-ding` | 1 | 1.5 s | A cash total resolving: an 8-bit coin-counter finishing ding with a bright chord and a soft sparkle |
| `firework` | 3 | 1.5 s | An 8-bit firework explosion like a huge bassy kick drum: a deep punchy low-end boom with a crunchy bitcrushed crackle tail |
| `coin-fountain` | 1 | 3 s | A long gush of gold coins pouring and cascading in a jackpot payout, clinking endlessly |
| `legendary-choir` | 1 | 3 s | A triumphant angelic choir 'aah' swell with bells and a shimmering harp glissando, resolving on a radiant major chord |
| `blackout` | 1 | 3 s | A deep cinematic boom that slowly fades into silence, like the power going out in a big hall |
| `devil-key-whisper` | 2 | 3 s | Sinister breathy unintelligible demonic whispering circling around, with a faint crackle of fire |
| `devil-key-laugh` | 1 | 1.5 s | A low wicked demonic chuckle with a crackle of fire, short and menacing |

- [ ] **Step 3: Generate the fanfare.** Three takes, 12 s each:
  > 8-bit chiptune JACKPOT fanfare, not a loop, exactly 120 BPM, 4/4, A major, 12 seconds: bar 1 opens on a huge
  > bassy chip kick and a crash with a fast rising square-wave arpeggio run; bars 2 to 4 are an energetic,
  > euphoric arcade fanfare (square and pulse leads, triangle bass, noise-channel drums, quick arpeggios) with
  > strong accents on every beat; bar 5 resolves to a big sustained A major chord; then a short sparkling tail
  > to silence. Retro arcade character.
- [ ] **Step 4: Download and measure.**
  - Download into `assets/audio/` as `<id>-<n>.mp3`; the fanfare goes in as `vault-fanfare-1.mp3`.
  - Measure every file with `ffprobe` and record each length in the report.
  - Re-generate (within budget) any file under 80 % of its target length. If a retry is still short, keep the
    best one and note it.
  - Pick the fanfare take whose length is closest to 12 s and whose ending decays (not cut). It becomes
    `vault-fanfare-1.mp3`; the other two go to `art/source/audio/vault-fanfare-take-<n>.mp3`.
  - Delete the old `vault-fanfare-2.mp3` and any extra old variants beyond the new count (e.g. `firework-3` is
    replaced, not added).
- [ ] **Step 5: Wire.**
  - `art/manifest.json`: an entry per id with `kind`, `variants`, `duration` and the full `prompt` (replace the
    old entries; the fanfare entry gets `variants: 1`).
  - `fx/audio/sounds.ts` gets the new ids:
    - `vault-riser` gain 0.9;
    - `vault-open-hit` gain 1;
    - `reward-chime` gain 0.8;
    - `count-tick` gain 0.35;
    - `count-ding` gain 0.8.
  - Add `maxSeconds` where a file runs longer than its use: riser 1.2, open-hit 2.5, firework 1.8, count-tick
    0.3.
  - Remove ids that nothing plays any more only in Task 4, not here.
  - Run `npx vitest run src/modules/casecremental/fx/audio`: PASS (the manifest test checks SOUNDS against the
    manifest).
- [ ] **Step 6: Commit**
  - Stage `src/modules/casecremental/assets/audio`, `src/modules/casecremental/fx/audio/sounds.ts`,
    `art/manifest.json` and `art/source/audio`.
  - Message: `feat(audio): the vault's jackpot sound set - 8-bit kicks, rising chimes, a chiptune fanfare`.
  - In the report: credits spent, the length of each file, and which takes were chosen and why.

---

### Task 2: The opening's clock — sim times, cues, music plan

**Files:** `sim/tuning.ts`, `sim/vault.test.ts`, `sim/snapshot.test.ts`, `fx/vault/cues.ts` (+ new
`fx/vault/cues.test.ts`), `fx/vault/vaultFlow.ts`, `fx/vault/vaultFlow.test.ts`, `fx/vault/countUp.ts`
(+ test)

**Interfaces:**
- Produces:
  ```ts
  export const VAULT_CUES = {
    riserEnd: 0.9, impact: 1.0, raysFrom: 1.5, raysFull: 2.5, columnsFrom: 1.5, columnStagger: 0.1,
    spinFrom: 2.5, fireworks: [1.0, 3.0, 5.0], celebrateFrom: 9.0, celebrateTo: 11.5,
  } as const;
  export interface VaultCues {
    phase: "anticipation" | "impact" | "rays" | "spin" | "lockins" | "celebrate" | "hold";
    /** 0–1 tremble energy (anticipation), 0 after the impact. */
    tremble: number;
    /** 0–1 seam light width. */
    seam: number;
    /** The lid: 0 closed → 1 open, with an overshoot just after the impact (may exceed 1 briefly). */
    lid: number;
    /** 0–1 rainbow fan strength (rises 1.5–2.5, softens to a glow 9.0–11.5). */
    rays: number;
    /** How far each of the five columns has come in, 0–1 (cascade 100 ms apart from 1.5). */
    columnIn: [number, number, number, number, number];
    /** 0–1 particle density (high while spinning, thinning in the celebration). */
    density: number;
    /** 0–1 the golden pulse across the frames at 9.0. */
    pulse: number;
  }
  export function vaultCues(t: number): VaultCues;
  /** The total shown under the columns: 0 before 9.0, counting up to `total` by 11.5 (ease-out), `total` after. */
  export function countUp(t: number, total: number): number;
  ```
- `musicPlan` for `opening`:
  - `t < VAULT_CUES.impact` → track `"vault-fanfare"`, `loop: false`, `offset: 0`, `musicOn: false` (silent;
    the World switches the music on at the impact cue);
  - `t < VAULT_OPENING_SECONDS` → offset `t − VAULT_CUES.impact`.

- [ ] **Step 1: Failing tests.**
  - `cues.test.ts`:
    - the phase at 0.5 / 0.95 / 1.2 / 2.0 / 4.0 / 7.0 / 10 / 12 (`anticipation`, `anticipation` [held beat:
      tremble 0], `impact`, `rays`, `spin`, `lockins`, `celebrate`, `hold`);
    - tremble grows from 0.1 to 0.85 and is 0 in the held beat;
    - `lid` is 0 before 1.0, > 1 at 1.08 (overshoot) and exactly 1 from 1.5;
    - column `i` is 0 before `1.5 + 0.1 i` and 1 at `1.5 + 0.1 i + 0.25`;
    - `rays` is 1 at 3–8 and < 0.5 at 12.
  - `countUp` is 0 at 8.9, strictly between at 10, `total` at 11.5 and 14.
  - `vaultFlow.test.ts`: silent fanfare at `t = 0.5`; offset 3 at `t = 4`.
  - `sim/vault.test.ts` follows the new land times and length.
- [ ] **Step 2: Watch them fail.** Run `npx vitest run src/modules/casecremental/fx/vault src/modules/casecremental/sim`.
- [ ] **Step 3: Implement.**
  - The tuning constants.
  - `cues.ts`: keep the curves simple (ease-out cubic), with an overshoot `1 + 0.12 * sin(...)` decaying over
    0.5 s.
  - `countUp.ts`.
  - The `musicPlan` change.
  - Keep `VAULT_CUE_TIMES` only if something still imports it; otherwise remove it (Task 4 removes the last
    users).
- [ ] **Step 4: Run the whole module suite** (`npx vitest run src/modules/casecremental`) and
  `npm run typecheck`. VaultReels/VaultScene may still use the old cues; keep them compiling with the smallest
  shim and note it.
- [ ] **Step 5: Commit**
  - Message: `feat(vault): the jackpot opening's clock - 14.5 s, lock-ins on the beat, fanfare from the impact`.

---

### Task 3: Five vertical columns

**Files:** new `fx/vault/columnMotion.ts` (+ test), new `fx/vault/VaultColumns.ts`, delete
`fx/vault/VaultReels.ts`, `fx/World.ts` (wiring only)

**Interfaces:**
- Consumes: `VAULT_LAND_TIMES`, `VAULT_CUES`, `vaultCues(t).columnIn`.
- Produces:
  ```ts
  /** Where column i's strip is at time t, in cells (fractional): fast constant spin from its start, then a
   *  deceleration through the last `slowCells` cells to land exactly on `target` at `land`, an overshoot of
   *  ~0.25 cell and a settle back by `land + 0.25`. Monotonic until the overshoot. */
  export function columnMotion(t: number, start: number, land: number, target: number, opts?: { speed?: number; slowCells?: number }): number;
  export class VaultColumns {
    constructor(frameSet, skins, scene: VaultScene, juice: Juice, rng: Rng);
    layout(l: TableLayout, vp: PixelViewport): void;   // five columns side by side above the chest
    start(drops: readonly Drop[]): void;               // strips built so `target` cell shows each drop
    restore(drops: readonly Drop[], landed: number): void; // landed columns show drop + label, no juice replay
    update(t: number): void;                            // positions + the cascade-in from vaultCues
    landed(index: number, d: Drop, amount: number): void; // the lock-in juice (sim event)
    hide(): void; render(renderer): void; set tint(v: number); destroy(): void;
  }
  ```
  `World` replaces `VaultReels` with `VaultColumns` one for one. World.ts must not grow.

- [ ] **Step 1: Failing tests** for `columnMotion`:
  - it equals `target` at `land`;
  - it is > `target` at `land + 0.08` (overshoot);
  - it equals `target` from `land + 0.25`;
  - it is strictly increasing from `start` to `land`;
  - it moves at least `slowCells` cells in its last second;
  - two columns with different `start` values are out of phase.
- [ ] **Step 2: Watch them fail. Step 3: Implement** `columnMotion` (piecewise: constant speed, then a
  quadratic ease-out over the slow cells; a damped overshoot after).
- [ ] **Step 4: `VaultColumns`.**
  - Each column is a clipped window (a mask or a render texture) in the vault's pixel layer: the scene's
    `reelSlot`, as `VaultReels` did. Each shows ~3 cells, with the centre cell framed.
  - Cells are skin icons from the top case's skins (never `caseById` on a vault drop), the drop at `target`, and
    a different filler order per column (rng).
  - The frame is a 1-px dark border with a rarity-coloured inner line once landed.
  - Layout: five equal columns across the table's width above the chest. Keep each label (name and `+$`) under
    its column, wrapped to the column width in the HD font. Use `stackRects`-like pure geometry
    (`columnRects(area, 5, gap)`) and test it: inside the area, equal widths, no overlap.
  - **Lock-in juice** (`landed`):
    - a 0.15 s scale pulse (1 → 1.15 → 1) on the centre cell;
    - a gold frame flash;
    - a compact star burst (`scene.firework(at, color, false)` or a smaller star burst);
    - `reward-chime` at `rate: 2 ** ((2 * index) / 12)`;
    - the label fades in.
  - **Fifth column:**
    - its centre cell plays the animated ★ frames (`skins.frames(skin)`, `skin.motion.fps`);
    - a halo behind the frame;
    - a bigger burst, `legendary-choir`, a `firework` kick and a 0.25 shake.
    - The old knife b-roll "showcase" is not used.
  - `restore` shows landed columns at rest with their labels, and the fifth animating, with no sounds.
- [ ] **Step 5: Run** `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`.
- [ ] **Step 6: Commit**
  - Message: `feat(vault): five vertical reel columns that lock in one by one`.

---

### Task 4: The choreography

**Files:** `fx/vault/VaultScene.ts` (re-choreographed, ≤ ~400 lines), new `fx/vault/rays.ts`, new
`fx/vault/chest.ts`, `fx/World.ts` (wiring only), `fx/audio/sounds.ts` (remove ids nothing plays any more),
`art/manifest.json` and `assets/audio/` (likewise)

**Interfaces:** consumes `vaultCues(t)`, `VAULT_CUES`, `countUp`, `VaultColumns`, and the Task 1 sound ids.

- [ ] **Step 1: Layout.**
  - The chest sits at lower centre: its bottom at ~88 % of the screen height in landscape, ~80 % in portrait.
  - The integer scale `S` is chosen so the open chest is ~28 % of the screen height.
  - The columns' area spans from the top margin to just above the open lid.
  - Add a pure, tested `vaultLayout(screen, l)` returning `chest`, `columnsArea` and `totalAt` for 3 screen
    sizes (1920×1080, 1324×768, 390×844), asserting:
    - everything is on screen;
    - the columns are above the lid;
    - the total sits between the columns and the chest.
- [ ] **Step 2: `chest.ts`.**
  - From `vaultCues(t)`:
    - scale-in and settle bounce at the key turn;
    - tremble in bursts (offset `±tremble * 2 * S` px at ~18 Hz, gated in 0.15 s bursts);
    - the seam light (a gold line over the lid seam, width `seam`);
    - small sparks escaping during the anticipation.
  - The lid uses the vault-case frames 0 → 3 driven by `lid`. The overshoot is a brief upward stretch of the open
    frame and the body recoils down 2 px, then settles.
  - The inner glow while open.
- [ ] **Step 3: `rays.ts`.**
  - A rainbow fan of 14 rays (7 colours × 2 widths) anchored at the chest mouth: broad dark rays at the back,
    narrow bright rays in the middle, sparse white sparkles in front.
  - A slowly rotating starburst behind them (~6°/s).
  - Strength from `rays`; the slow sweep while spinning; fading to a soft glow in the celebration.
  - Drawn behind the columns (scene order: dim, starburst, rays, chest glow, columns slot, chest, particles that
    must stay behind the labels; labels on top).
- [ ] **Step 4: `VaultScene` beats** (each fired once when `t` crosses its time; on a restore past it, nothing
  replays):
  - **Key turn:** the suspense loop fades out (World: `setTrack(null)`); play `vault-riser`.
  - **Impact (1.0):**
    - `hd.flash(0xfff2c0, 0.35)` (short);
    - `shake.add(0.35)`;
    - a gold spark and star burst;
    - the light shaft;
    - `vault-open-hit` and a `firework` kick;
    - the music on: `applyMusic(musicPlan(...))`.
  - **Fireworks at `VAULT_CUES.fireworks`:** colourful bursts above the columns, each with a `firework` kick.
  - **Spin:** coins arcing out from the chest and falling, star glints and rising motes, with density from
    `density`. Lighter at 3.5–4.5 than at 2.5–3.5 and 4.5–6 (breathing).
  - **Celebration (9.0):**
    - a golden pulse across the frames (`VaultColumns.pulse(v)`);
    - a coin shower (`coin-fountain`);
    - the total label counting up via `countUp`, with `count-tick` every ~0.08 s while it changes and
      `count-ding` once at 11.5.
  - **Hold:** quiet. Particles fade and the chest glows.
  - Remove what the old opening used and nothing plays now: the lock spin, chain snaps, light burst, golden
    column/fountain code, old cue times, unused SOUNDS ids and their files and manifest entries. Keep the slam,
    the devil key, the whispers and laugh.
- [ ] **Step 5: Restore.** `show(phase, t, drops, landed)` after a reload or a lobby trip:
  - jumps to the state at `t` with no replayed beats;
  - the count-up at its value;
  - the fifth showing if `t ≥ 8.5`.

  Add a test for the pure "which beats are due" helper: `dueBeats(prevT, t)` returns the crossed beat ids, and
  `restore` sets `prevT = t`, so none fire.
- [ ] **Step 6: Run** `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`. Report
  every file's line count.
- [ ] **Step 7: Commit**
  - Message: `feat(vault): the legendary-chest choreography - tremble, snap-open, rainbow, lock-ins, count-up`.

---

### Task 5: Play it, write it down (controller)

- [ ] **Browser check:**
  - Buy the vault and turn the key, then screenshot each phase.
  - Reload mid-spin and during the count-up.
  - Portrait.
  - Russian.
- [ ] **Feature history:** update the vault bullet in `docs/feature-history/casecremental-run1.md` (the jackpot
  timeline, the chiptune fanfare, no skip, auto-continue).
- [ ] **Commit:** `docs(feature-history): the vault as a jackpot`.
