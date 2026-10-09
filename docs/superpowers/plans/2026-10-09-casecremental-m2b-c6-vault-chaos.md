# Casecremental M2b-C6 — DnB fanfare, kick volleys, total chaos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal (user, 2026-10-09):**
- **Fanfare:** "the song is too calm" → a techno drum-and-bass fanfare with synths.
- **Kicks:** "more of that kick explosions, they appear only twice".
- **Motion:** "make everything more crazy, so there is no space on screen which is not moving shaking reeling".

The user chose to keep the beams (C5).

**Architecture:**
- **Beat clock:** a pure `beatClock(t)` locked to the fanfare (174 BPM from the impact at t = 1.0) drives every pulse.
- **Kicks:** a longer `VAULT_CUES.fireworks` schedule gives ~13 kick explosions.
- **Chaos layer:** a new `fx/vault/chaos.ts` fills the whole screen with motion behind the rewards. It never covers icons, labels or the total.

**Tech Stack:** TypeScript strict, Vitest, PixiJS 8, ElevenLabs MCP.

**Spec:** `docs/superpowers/specs/2026-10-09-casecremental-vault-jackpot-design.md` (§1 timeline and §5 beams still hold). This plan's goal paragraph is the user's addendum.

## Global Constraints

- **ElevenLabs:** ~600 credits approved: three DnB fanfare takes plus two extra `firework` variants. Downloads go
  only into `src/modules/casecremental/assets/audio/` and `art/source/audio/`. Never sign in.
- **Timeline unchanged:**
  - impact 1.0 (the fanfare's drop);
  - lock-ins at `[6, 6.5, 7, 7.5, 8.5]`;
  - celebration 9–11.5;
  - end at 14.5.
- **Readability:** chaos stays behind the rewards. Icons, labels and the total stay readable and still enough to
  read: a gentle wobble only, ≤ 2 px at scale.
- **Photosensitivity:** no full-screen flash or strobe faster than 3 per second. Colour cycling is fine; big
  white or red flashes are limited.
- **Reload and lobby trip:** a restore mid-opening jumps to the state at `t` with no beat replayed. Chaos derives
  from `t`, not from accumulated state.
- **Performance:** pooled sprites only, bounded counts, nothing allocated per frame in the hot loops.
- **Files:** ≤ ~400 lines each. `World.ts` does not grow.
- **Commit trailer:**
  ```
  Co-Authored-By: Claude <model> <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013MA8Fp47Lkjiuq8tVoGPyt
  ```
  Stage files by path, LF line endings.

## Review Focus

1. **Lock-ins stay readable mid-chaos** (icons, labels, total), on landscape and portrait.
2. **No beat replays after a reload.** The kick schedule and volleys stay derived from `t`.
3. **Photosensitivity:** count full-screen flashes per second; there must be none above 3.
4. **A second vault in the session** leaves nothing over.
5. **Frame cost:** the bounded pools hold, with no per-frame allocations.

---

### Task 1: DnB fanfare and kick variants (ElevenLabs)

**Files:** `assets/audio/vault-fanfare-1.mp3` (replaced), `assets/audio/firework-4.mp3`, `firework-5.mp3`,
`art/source/audio/` (the spare takes, plus the old chiptune kept as `vault-fanfare-chiptune.mp3`),
`art/manifest.json`

- [ ] **Generate the fanfare.** Use flow nodes with `model_parameters`: `creative_generate_in_flow` drops the
  duration (see the feature history). Three takes, 13 s each:
  > High-energy techno drum and bass jackpot drop, not a loop, 174 BPM, 13 seconds: it opens on a massive
  > sub-bass drop with a huge kick and crash, then rolling breakbeat drums with fast hi-hats, a driving reese bass
  > and bright detuned supersaw synth stabs and arpeggios, euphoric and relentless, building to a big final synth
  > chord with a crash at about 11 seconds and a short tail to silence. No vocals.
- [ ] **Generate two more `firework` variants** (1.5 s), with the same prompt as the current three (in
  `art/manifest.json`).
- [ ] **Measure every file with ffprobe.** Pick the take whose drop starts hardest at 0 s and whose length is
  closest to 13 s, judged by level in its first 0.5 s and its tail. It becomes `vault-fanfare-1.mp3`; keep the
  others and the old chiptune under `art/source/audio/`.
- [ ] **Update `art/manifest.json`** (the fanfare prompt; `firework` variants: 5).
- [ ] **Run** `npx vitest run src/modules/casecremental/fx/audio`.
- [ ] **Commit:** `feat(audio): a drum and bass jackpot drop, two more kick explosions`.
- [ ] **Report:** credits spent, every file's length, and the choice of take.

### Task 2: Kick volleys and the chaos layer

**Files:**
- create `fx/vault/beat.ts` (+ test), `fx/vault/chaos.ts`, and `fx/vault/chaosPlan.ts` (pure, + test);
- modify `fx/vault/cues.ts` (+ test), `fx/vault/VaultScene.ts`, `fx/vault/VaultBeams.ts`, `fx/vault/rays.ts`,
  `fx/vault/chest.ts`, and `fx/World.ts` (wiring only).

**Interfaces — Produces:**
```ts
// beat.ts — the fanfare's clock: 174 BPM from the impact (t = 1.0)
export const VAULT_BPM = 174;
/** Beat index (float) since the impact; negative before it. */
export function beatAt(t: number): number;
/** 1 at each beat, decaying to 0 by the next (pow curve); 0 before the impact. */
export function beatPulse(t: number): number;
/** The same for bars (4 beats). */
export function barPulse(t: number): number;
// cues.ts
// VAULT_CUES.fireworks becomes ~13 kick times: 1.0 (impact), each second of the spin (2.5, 3.5, 4.5, 5.5), one on
// each lock-in (6, 6.5, 7, 7.5, 8.5), and a volley at 9.0, 9.35, 9.7, 10.05.
// chaosPlan.ts — pure: how intense each chaos channel is at time t (0–1), from the phase and the beat
export interface ChaosLevels { shake: number; zoom: number; hue: number; rain: number; sparks: number; wobble: number; background: number; }
export function chaosLevels(t: number): ChaosLevels;
```

- [ ] **Step 1: Failing tests.**
  - `beatAt` is 0 at 1.0 and 1 at `1 + 60/174`.
  - `beatPulse` is 1 just after each beat, < 0.2 just before the next, and 0 before 1.0.
  - `fireworks` contains 13 sorted times within `[1, 11.5]`, including every lock-in time.
  - `chaosLevels`:
    - 0 everywhere before 0.9;
    - high (≥ 0.7) in shake, rain and sparks between 2.5 and 9;
    - easing toward ≤ 0.3 by 13;
    - a function of `t` alone, so the same `t` always gives the same result.
  - A photosensitivity helper `flashTimes(from, to)` lists the scheduled full-screen flashes; no 1-second window
    contains more than 3.
- [ ] **Step 2: Watch them fail. Step 3: Implement the pure parts.**
- [ ] **Step 4: The chaos layer.** Everything below is driven by `chaosLevels(t)` and `beatPulse`/`barPulse`,
  using the vault scene's existing layers (behind rewards and labels):
  - **Camera:**
    - a constant beat-synced shake on the whole vault scene: a small amplitude every beat, bigger on bars;
    - zoom punches on every kick;
    - a slow sway, ±1.5° max, on the scene root behind the rewards layer (the rewards layer counter-rotates or
      sits outside it).
  - **Background:**
    - the dimmed room behind wobbles and zooms to the bar;
    - a scrolling diagonal stripe or checker pattern across the whole screen at low alpha, hue-cycling;
    - the starburst spins faster and pulses to the beat.
  - **Beams:**
    - hue-shimmer within their palette;
    - width pulse on the beat;
    - the stream runs ~1.5× faster and denser while spinning, within the pool bound.
  - **Rain:** coins, pixel stars and confetti falling across the whole screen width, plus side sparks bursting
    from both screen edges on bars. Pooled.
  - **Kicks:** every `fireworks` time gets a colourful firework burst at a varied screen position (corners and
    sides included, not only above the beams), a zoom punch and a `firework` kick (5 variants, random).
  - **Chest:** bounces on the beat; its inner glow throbs.
  - **Rewards:**
    - landed icons bob gently on the beat;
    - labels and the total get a tiny wobble only (≤ 2 px);
    - the total's count-up text pulses in scale to the beat.
  - **Flashes:** keep them within the `flashTimes` budget.
- [ ] **Step 5: Run** `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`, and
  report line counts.
- [ ] **Commit:** `feat(vault): drum and bass chaos - beat-locked shake, rain, kicks everywhere`.

### Task 3: Play it (controller)

- [ ] Browser check on a crafted save. Back up the player's save and restore it after, checking every field.
- [ ] Update the feature history and commit.
