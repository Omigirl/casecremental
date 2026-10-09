# Casecremental M2b-C8 — the vault's intro and a rising chiptune fanfare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal (user, 2026-10-09):**
- "what is missing in vault fanfare: the notes progression — every iteration of the melody should go higher and
  higher; length and finale are good; we are missing note progression and intro."
- "For intro use art/source/audio/vault-fanfare-intro.mp3; put effects on its kick timings before the case opens
  and the reels come out."
- "After the intro, a new take" in the style of the chiptune `art/source/audio/vault-fanfare-take-3.mp3`.

The user chose: a new chiptune take with a rising melody; ~600 credits approved for three takes.

**Architecture:**
- **The intro** (3.396 s; kicks measured from its < 140 Hz energy) plays from the key turn.
- **Its eight hits** drive the chest and screen:
  - build at 0.45, 0.80, 1.15;
  - a held pause 1.40–1.95;
  - a run-up at 2.00, 2.30, 2.65, 2.95, 3.30.
- **The impact** (lid snap and fanfare drop) moves from 1.0 to `VAULT_INTRO_SECONDS = 3.40`. Everything after it
  shifts by +2.4 s:
  - lock-ins at `[8.4, 8.9, 9.4, 9.9, 10.9]`;
  - celebration at 11.4–13.9;
  - the end at 16.9.
- **The fanfare** is a new chiptune take at 120 BPM, written with an ElevenLabs composition plan so each repeat
  of the melody climbs.

**Tech Stack:** TypeScript strict, Vitest, PixiJS 8, ElevenLabs MCP, ffmpeg (for analysis only).

**Spec:** `docs/superpowers/specs/2026-10-09-casecremental-vault-jackpot-design.md` (§1 timeline shape, §5 beams);
this plan's goal paragraph is the user's addendum.

## Global Constraints

- **ElevenLabs:** ~600 credits approved (three takes). Downloads only into
  `src/modules/casecremental/assets/audio/` and `art/source/audio/`. Never sign in.
- **One clock:** the sim owns the opening (`VAULT_LAND_TIMES`, `VAULT_OPENING_SECONDS` in `sim/tuning.ts`).
  Presentation timings are derived from `VAULT_CUES.impact = VAULT_INTRO_SECONDS` in one place. A reload or lobby
  trip resumes at `t` with no beat replayed.
- **Music:** the intro plays from the key turn (offset `t`); the fanfare from the impact (offset `t − impact`).
- **The intro's kicks get visuals only.** Their sound is in the intro itself; no extra kick SFX on them. The
  `vault-riser` SFX at the key turn goes (the intro replaces it).
- **Photosensitivity:** ≤ 3 full-screen flashes per second; beat throb amplitudes < 0.1. The intro's run-up hits
  are 0.30–0.35 s apart, so they can't all be full-screen flashes: use jolts, punches and local bursts instead.
- **Files:** ≤ ~400 lines each; `World.ts` does not grow.
- **Commit trailer:**
  ```
  Co-Authored-By: Claude <model> <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013MA8Fp47Lkjiuq8tVoGPyt
  ```
  LF endings.

## Review Focus

1. **The intro → fanfare hand-off at 3.40:** no gap, no overlap clash, the lid snap on the drop.
2. **Reload during the intro, the pause, or just after the impact:** the right track at the right offset, and no
   replayed hits.
3. **The flash budget** with the run-up hits.
4. **Every timing test** follows the shift (sim, cues, chaos, beats, musicPlan).
5. **A second vault** in the session.

---

### Task 1: The rising chiptune fanfare and the intro file (ElevenLabs)

**Files:** `assets/audio/vault-fanfare-1.mp3` (replaced), `assets/audio/vault-intro-1.mp3` (the user's intro,
copied), `art/source/audio/` (spare takes; the DnB take in use kept as `vault-fanfare-dnb-take-3.mp3`, which is
already there), `art/manifest.json`

- [ ] **Read the ElevenLabs music model guide** for composition plans (sections with their own styles, lines and
  durations), and set the duration through flow nodes with `model_parameters`.
- [ ] **Generate three takes, ~13 s each,** with this composition:
  - **Global style:** 8-bit chiptune jackpot fanfare, 120 BPM, square and pulse leads, triangle bass,
    noise-channel drums, euphoric, no vocals.
  - **Sections:**
    1. 0–2 s, the drop: a huge hit and crash, full drums.
    2. 2–4 s: the main melody motif, in A major.
    3. 4–6 s: the same motif a whole step higher (B major).
    4. 6–8 s: higher again (C♯ major), with more layers.
    5. 8–10 s: the highest repeat (D or E major) at full energy.
    6. 10–13 s: the final big chord and a crash, then a short sparkling ring-out.

  No fade before 10 s.
- [ ] **Pick the take:**
  - measure its level per second (no second below about −20 dB before 10 s);
  - estimate the climb from the spectral centroid of each 2 s section (it should rise across sections 2–5).

  Choose the take that climbs most clearly and holds energy. It becomes `assets/audio/vault-fanfare-1.mp3`; the
  others go to `art/source/audio/vault-fanfare-rising-take-<n>.mp3`.
- [ ] **The intro:**
  - copy `art/source/audio/vault-fanfare-intro.mp3` to `assets/audio/vault-intro-1.mp3`;
  - give it a manifest entry (`kind: music`, `id: vault-intro`, no stage, duration 3.4, prompt "user-supplied
    intro").
- [ ] **Commit.** Report the credits spent, the per-second levels, the centroids, and the choice.

### Task 2: The intro's hits and the shifted timeline

**Files:**
- `sim/tuning.ts` (+ tests that hard-code vault times);
- `fx/vault/cues.ts`, `beat.ts`, `chaosPlan.ts`, `vaultFlow.ts`, `VaultScene.ts`, `chest.ts`, `chaos.ts`,
  `beats.ts`, and their tests;
- `fx/audio/sounds.ts` (the new `vault-intro` `TrackId`, its `indexAudio` pattern and `TRACK_GAIN`);
- `fx/World.ts`, wiring only.

- [ ] **Failing tests first:**
  - `VAULT_INTRO_SECONDS = 3.40`; `VAULT_CUES.impact === VAULT_INTRO_SECONDS`;
  - `VAULT_LAND_TIMES` is `[8.4, 8.9, 9.4, 9.9, 10.9]`; `VAULT_OPENING_SECONDS` is 16.9;
  - `INTRO_HITS` lists the 8 times, typed `build` or `run`, with the pause 1.40–1.95;
  - `vaultCues(t)` gives the anticipation phase until the impact, a `hit` pulse at each intro hit, and stillness
    in the pause;
  - `musicPlan`:
    - `vault-intro` at offset `t` before the impact;
    - the fanfare at `t − 3.40` after it;
    - the boundaries at 3.39 and 3.40;
  - `beat.ts` runs at 120 BPM from the impact;
  - `flashTimes` stays within budget, including the run-up;
  - the fireworks schedule shifts by +2.4 s (the kicks stay on lock-ins and the celebration);
  - the intro hits are not in the audible kick list.
- [ ] **Implement.**
  - **The chest on intro hits:**
    - build hits: a short jolt, a seam flash and a few sparks, growing with each hit;
    - the pause: the chest holds still and the seam glows steadily;
    - run-up hits: bigger jolts, a zoom punch, a local spark burst at the chest, and a small kick burst at a
      varied screen spot;
    - one full-screen flash only on the last run-up hit, if the budget allows.
  - **The tremble** is now driven by the hits, not a smooth ramp.
  - **Key turn:** remove the `vault-riser` play; start `vault-intro`.
  - **Impact:** `applyMusic` switches to the fanfare. The dimming overlay and the rest of the spec stay as they
    are.
- [ ] **Run** `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`, then commit.

### Task 3: Controller browser check, review and docs
