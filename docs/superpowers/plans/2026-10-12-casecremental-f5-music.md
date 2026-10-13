# Casecremental F5 — Music for the Late Stages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the eight newly generated tracks into the game:
- two more loops each for stages 3, 4 and 5;
- a Run 4 finale loop;
- a credits track.

Each stage then plays its loops as a playlist (a loop twice, then the next, swapped on a bar line with the existing crossfade). The finale joins stage 5's playlist in Run 4, and the `credits` track is ready for F6-C.

**Architecture:**
- **Files.** The processed files are copied into `assets/audio` under names `indexAudio` already understands: `music-<stage>-<n>.mp3` for a stage's n-th loop, `music-finale.mp3`, and `credits.mp3`. `AudioFiles.music` becomes a playlist per stage.
- **Pure rules.** The timing rules go in `fx/audio/schedule.ts`: which loops a stage plays in a run, when a loop hands over, and skipping a loop that failed to decode.
- **Playback.** The stage-loop code leaves `AudioEngine.ts`, which is at 385 lines and gets a new responsibility, for a new `fx/audio/stageMusic.ts` (`StageMusic`). That class owns the loop nodes and the playlist cursors.
- **The run.** The engine learns the run through one new per-frame call, `audio.tick(run)`, from `World.update`. That call is also the playlist's clock.
- **Dev tools.** The dev sound board gets audition buttons, so a human can listen to every loop and transition.

**Tech Stack:** TypeScript (strict), Web Audio, Vitest 5, Vite 8, ffmpeg/ffprobe (installed on the dev laptop, `C:\ProgramData\chocolatey\bin`).

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-finish-design.md` §6 (binding), with §1 (phases), §7.4 (the credits play the credits track, built in F6-C) and §11 (testing). Before Task 1, read `docs/feature-history/casecremental-run1.md`, from the bullet "Music is boosted in code, not in the files" on: why loops are never re-encoded in this repo, and how `TRACK_GAIN` and `MUSIC_BOOST` work.

**Where the tracks come from.** A separate agent generates them (`.superpowers/sdd/f5-music-pricing.md` has the prompts and costs). Its raw takes land in `art/source/audio/` (`music-3b-take-1.mp3`, …, `credits-take-1.mp3`). Its processed files land in `.superpowers/f5-music/`, with a `README.md` listing each file's name, source take, prompt, processing recipe, duration and measured level. That folder may not exist yet when this plan is written; it will at F5 build time. If it is missing or incomplete when you start, **stop and report**; do not generate or process audio yourself.

**F1–F4 land before this plan.** F2 removed the grid's sounds from `SOUNDS` and the manifest. F4 touched only the sim. Re-read `fx/audio/AudioEngine.ts`, `fx/audio/sounds.ts`, `fx/audio/schedule.ts`, their tests, `art/manifest.json` and `fx/World.ts`'s `update` as they are now.

## Global Constraints

- Every player-facing string exists in EN (`i18n/en.ts`) and RU (`i18n/ru.ts`). This plan adds none: the dev sound board is English-only and never shown to players.
- Sim numbers live only in `sim/tuning.ts`. This plan touches no sim. The audio constants (`LOOP_PLAYS`, `FINALE_STAGE`, `FINALE_RUN`, `SWAP_LEAD`, `TRACK_GAIN`) are the mixer's and live in `fx/audio/`.
- **Never re-encode a loop in this repo.** Re-encoding adds mp3 padding at the loop point (feature history, run1). Levels are matched by the generator. If a file is off, stop and report rather than fixing it with ffmpeg here.
- File size (IDOS.md): when a change adds a new responsibility to a file past ~400 lines, that part goes in its own file. The playlist is a new responsibility for `AudioEngine.ts` (385 lines), so the loop code moves to `fx/audio/stageMusic.ts`. `fx/World.ts` (~540) gets exactly one line.
- `sim/` imports nothing from `fx/`. `fx/audio/` imports nothing from `sim/` (the run number comes in as a plain `number`).
- Match the module's code style. Each file has a header comment saying what it is and why. Exported names have doc comments. Comment density matches the neighbours. Every Web Audio call that can throw sits in a `try` ("music is optional"). Formatting is 2-space Prettier (`npm run format`).
- Every commit keeps these green: `npm run typecheck`, `npx vitest run src/modules/casecremental`, `npm run build`.
- Commit messages look like `feat(music): …` and end with these two lines (after a blank line):
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```
- Stage files by path. Never stage `docs/todo.md` or the `{…}.png` files in the repo root, and never stage anything under `.superpowers/`. Stay on branch `casecremental-finish`. Do not edit `src/modules.ts`, `src/config.ts`, `src/idos.title.ts` or `idos.modules.lock.json`.
- The SDK is npm packages: never invent an SDK API. This plan needs none.

## Review Focus

The five conditions most likely to bite a player that the spec does not spell out. Each one has its test in the owning task.

1. **A stage change in the moment before a scheduled swap.** The next loop is already scheduled on the audio clock up to `SWAP_LEAD` early. A player expects one clean change to the new stage, never two loops starting together. The scheduled loop is cancelled before it plays, and its stage hears it first next time. Test: Task 2, "a stage change in the moment before a swap cancels it…".
2. **Coming back to a stage** (the hysteresis drops 5 → 4 → 5, or a vault track hands back). A player expects the late game not to restart the same loop every time. Each stage keeps a cursor, and coming back plays its next loop. Tests: Task 2, "a stage change swaps on the next bar line, and coming back brings that stage's next loop" and "a vault track pauses the playlist…".
3. **A hidden tab.** The frames stop, so `tick` stops. The current loop keeps looping, and when frames return the swap lands on the next bar line from now, never in the past. Test: Task 2, "a late frame swaps on the next bar line from now".
4. **One loop that fails to download or decode.** The rest of the playlist plays; that loop is skipped, never silence. Tests: Task 2 (`nextReady` in schedule.test, and "a loop that fails to decode is skipped").
5. **A reload.** Music is not part of the save. A fresh engine plays the sim's stage from its first loop, and the finale never plays outside Run 4. Tests: Task 2, "plays a stage's loops in turn…" (a fresh engine starts at the first loop) and "stage 5 takes the finale only in Run 4".

---

## File map

All paths are relative to `src/modules/casecremental/` unless they start with `art/`, `docs/` or `.superpowers/`.

| File | Task | Responsibility |
|---|---|---|
| `assets/audio/music-{3,4,5}-{2,3}.mp3`, `music-finale.mp3`, `credits.mp3` (add) | 1 | the tracks |
| `art/source/audio/*-take-*.mp3` (add, if untracked) | 1 | the generator's raw takes |
| `art/manifest.json` | 1 | prompts and recipes |
| `fx/audio/sounds.ts` (+ `sounds.test.ts`, `manifest.test.ts`, the `indexAudio` tests in `AudioEngine.test.ts`) | 1 | playlists, the finale and `credits` in the index; `TRACK_GAIN.credits` |
| `fx/audio/schedule.ts` (+ test) | 2 | pure playlist rules |
| `fx/audio/stageMusic.ts` (create) | 2 | the stage loops: nodes, crossfades, cursors |
| `fx/audio/AudioEngine.ts` (+ test) | 1, 2 | uses `StageMusic`; `tick(run)`, audition API |
| `fx/World.ts` | 2 | `this.audio.tick(run.setup.run)` once per frame |
| `ui/SoundBoard.tsx` | 3 | audition buttons, credits |
| `docs/feature-history/casecremental-finish.md`, `README.md` | 3 | notes |

---

### Task 1: The tracks in the game's files

**Files:**
- Add: `assets/audio/music-3-2.mp3`, `music-3-3.mp3`, `music-4-2.mp3`, `music-4-3.mp3`, `music-5-2.mp3`, `music-5-3.mp3`, `music-finale.mp3`, `credits.mp3`; the raw takes in `art/source/audio/`
- Modify: `fx/audio/sounds.ts`, `fx/audio/AudioEngine.ts` (interim: play a stage's first loop), `art/manifest.json`
- Test: `fx/audio/AudioEngine.test.ts` (`indexAudio` describes), `fx/audio/sounds.test.ts`, `fx/audio/manifest.test.ts`

**Interfaces:**
- Produces (`fx/audio/sounds.ts`):
  ```ts
  export type TrackId = "vault-suspense" | "vault-intro" | FanfareId | "prestige" | "credits";
  export const TRACK_GAIN: Readonly<Record<TrackId, number>>; // + credits
  export interface AudioFiles {
    sfx: Map<SoundId, string[]>;
    /** Per stage, its loops in playlist order. */
    music: Map<number, string[]>;
    /** Run 4's finale loop, or null. */
    finale: string | null;
    tracks: Map<TrackId, string>;
  }
  ```
  F6-C plays the credits with `audio.setTrack("credits", { loop: false })`.

**Names.** `indexAudio`'s conventions are `<id>-<n>.mp3` for the n-th variant and `music-<stage>.mp3` for a stage loop. So a stage's n-th loop is `music-<stage>-<n>.mp3`, and the existing `music-<stage>.mp3` is its first. Named tracks are `<track>.mp3` (like `prestige.mp3`).

| Generator name (README) | File in `assets/audio/` | Manifest id | Manifest stage |
|---|---|---|---|
| `music-3b` | `music-3-2.mp3` | `music-3-2` | 3 |
| `music-3c` | `music-3-3.mp3` | `music-3-3` | 3 |
| `music-4b` | `music-4-2.mp3` | `music-4-2` | 4 |
| `music-4c` | `music-4-3.mp3` | `music-4-3` | 4 |
| `music-5b` | `music-5-2.mp3` | `music-5-2` | 5 |
| `music-5c` | `music-5-3.mp3` | `music-5-3` | 5 |
| `music-run4` | `music-finale.mp3` | `music-finale` | 5, with `"fromRun": 4` |
| `music-credits` | `credits.mp3` | `credits` | — (a named track) |

If the README uses other names, map them by stage and variant (b → 2, c → 3).

- [ ] **Step 1: Check the processed files before copying anything.** Read `.superpowers/f5-music/README.md`. Then measure:
  ```bash
  cd /c/Users/rainbow/dev/hackatons/solanaidos
  for f in .superpowers/f5-music/*.mp3; do
    d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
    m=$(ffmpeg -hide_banner -i "$f" -af volumedetect -f null - 2>&1 | grep -o "mean_volume: [-0-9.]* dB\|max_volume: [-0-9.]* dB" | tr '\n' ' ')
    echo "$f  $d s  $m"
  done
  ```
  Expected, against the existing files (measured 2026-10-12):
  - every loop is 32.000 s (±0.03), like `music-1…5`;
  - each new loop's mean is within ~1 dB of its stage's existing loop (stage 3: `music-3` −13.3 dB; stage 4: `music-4` −12.8; stage 5: `music-5` −14.8; the finale against `music-5`);
  - `credits` is 60–90 s with a mean within ~1 dB of `prestige` (−16.1 dB), the other warm named track;
  - no file peaks above 0.0 dB.

  If any file misses, **stop and report** which one and by how much. Do not re-encode it here (Global Constraints).

- [ ] **Step 2: Copy them in under the game's names.** Map with the table above, or with the README's names if they differ:
  ```bash
  cd /c/Users/rainbow/dev/hackatons/solanaidos
  A=src/modules/casecremental/assets/audio
  S=.superpowers/f5-music
  cp "$S/music-3b.mp3" "$A/music-3-2.mp3"; cp "$S/music-3c.mp3" "$A/music-3-3.mp3"
  cp "$S/music-4b.mp3" "$A/music-4-2.mp3"; cp "$S/music-4c.mp3" "$A/music-4-3.mp3"
  cp "$S/music-5b.mp3" "$A/music-5-2.mp3"; cp "$S/music-5c.mp3" "$A/music-5-3.mp3"
  cp "$S/music-run4.mp3" "$A/music-finale.mp3"; cp "$S/music-credits.mp3" "$A/credits.mp3"
  git status --short art/source/audio
  ```
  The raw takes listed as untracked (`?? art/source/audio/*-take-*.mp3`) are added in Step 8, as earlier phases kept theirs.

- [ ] **Step 3: Write the failing tests.**
  - In `fx/audio/AudioEngine.test.ts`, change the two existing playlist-shaped expectations: `expect(files.music.get(1)).toBe("m1")` → `expect(files.music.get(1)).toEqual(["m1"])`. `expect([...files.music.keys()]).toEqual([1, 2])` stays. Add:
    ```ts
    describe("indexAudio playlists (finish spec §6)", () => {
      it("lists a stage's loops in take order, music-<stage> first, whatever order the files come in", () => {
        const files = indexAudio({
          "/a/music-3-3.mp3": "c",
          "/a/music-3.mp3": "a",
          "/a/music-3-10.mp3": "j",
          "/a/music-3-2.mp3": "b",
          "/a/music-1.mp3": "m1",
        });
        expect(files.music.get(3)).toEqual(["a", "b", "c", "j"]); // numeric take order: 10 comes after 3
        expect(files.music.get(1)).toEqual(["m1"]);
        expect(files.sfx.size).toBe(0);
      });

      it("indexes the Run 4 finale loop on its own, never as a stage's loop or an effect", () => {
        const files = indexAudio({ "/a/music-5.mp3": "m5", "/a/music-finale.mp3": "fin" });
        expect(files.music.get(5)).toEqual(["m5"]);
        expect(files.finale).toBe("fin");
        expect(files.sfx.size).toBe(0);
        expect(indexAudio({}).finale).toBeNull();
      });

      it("indexes the credits as a named track", () => {
        expect(indexAudio({ "/a/credits.mp3": "cr" }).tracks.get("credits")).toBe("cr");
      });
    });
    ```
  - In `fx/audio/sounds.test.ts`, inside `describe("the named tracks")`:
    ```ts
    it("finds three loops each for stages 3–5, the Run 4 finale and the credits in assets/audio (finish spec §6)", () => {
      const files = indexAudio(REAL_FILES);
      expect([1, 2, 3, 4, 5].map((s) => files.music.get(s)?.length)).toEqual([1, 1, 3, 3, 3]);
      expect(files.music.get(3)![0]).toMatch(/music-3\.mp3/); // the original loop opens its stage's playlist
      expect(files.finale).toMatch(/music-finale/);
      expect(files.tracks.get("credits")).toMatch(/credits/);
    });
    ```
    (The existing "finds every named track's file" test covers `credits` once it is in `TRACK_GAIN`.)
  - In `fx/audio/manifest.test.ts`, replace the test "has the five stage loops at the shared tempo, and the named tracks" with:
    ```ts
    const FILES = import.meta.glob("../../assets/audio/*.mp3", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
    const hasFile = (id: string) => Object.keys(FILES).some((p) => p.endsWith(`/${id}.mp3`));

    it("has every stage's loops at the shared tempo — three each for stages 3–5 — and Run 4's finale (finish spec §6)", () => {
      const stageLoops = music.filter((a) => a.stage !== undefined && a.fromRun === undefined);
      expect([1, 2, 3, 4, 5].map((s) => stageLoops.filter((a) => a.stage === s).length)).toEqual([1, 1, 3, 3, 3]);
      const finale = music.filter((a) => a.fromRun !== undefined);
      expect(finale.map((a) => [a.id, a.stage, a.fromRun])).toEqual([["music-finale", 5, 4]]);
      for (const a of [...stageLoops, ...finale]) {
        expect(a.prompt, a.id).toContain("120 BPM");
        expect(hasFile(a.id), `${a.id}.mp3 in assets/audio`).toBe(true);
      }
    });

    it("has the named tracks, none of them a stage loop", () => {
      for (const id of Object.keys(TRACK_GAIN)) {
        const track = music.find((a) => a.id === id);
        expect(track, id).toBeDefined();
        expect(track?.stage, id).toBeUndefined();
      }
    });
    ```

- [ ] **Step 4: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/audio`
  Expected: FAIL. The playlist index is not built yet, `finale` and `credits` are unknown, and the manifest has no new entries.

- [ ] **Step 5: The index.** In `fx/audio/sounds.ts`:
  - Header comment: change "music-<stage>.mp3 (loops)" to "music-<stage>.mp3 and music-<stage>-<n>.mp3 (a stage's loops, in playlist order), music-finale.mp3 (Run 4's finale loop)".
  - `TrackId`: add `| "credits"`, and extend its doc comment: "…the prestige loop, and the credits after The Last Case (F6-C)".
  - `TRACK_GAIN`: add `credits: 1,` with the comment `// level-matched to the prestige loop by the generator (F5): it rides at its level`. If Step 1 measured the credits more than 1 dB off prestige and the user accepted it anyway, set `credits` to `Math.round(10 ** ((-16.1 - mean) / 20) * 100) / 100` and say so in the comment.
  - `AudioFiles`:
    ```ts
    export interface AudioFiles {
      /** variant URLs per sound */
      sfx: Map<SoundId, string[]>;
      /** Per intensity stage, its loops in playlist order: music-<stage>.mp3, then music-<stage>-2.mp3, -3… */
      music: Map<number, string[]>;
      /** Run 4's finale loop (music-finale.mp3): it joins stage 5's playlist from Run 4 on (finish spec §6). */
      finale: string | null;
      /** one URL per named track (the first take wins) */
      tracks: Map<TrackId, string>;
    }
    ```
  - `indexAudio`:
    ```ts
    /** Group file URLs by name: "reel-tick-2.mp3" → reel-tick variant, "music-3-2.mp3" → stage 3's second loop. */
    export function indexAudio(urls: Record<string, string>): AudioFiles {
      const sfx = new Map<SoundId, string[]>();
      const loops: Array<{ stage: number; take: number; url: string }> = [];
      let finale: string | null = null;
      const tracks = new Map<TrackId, string>();
      for (const [path, url] of Object.entries(urls).sort(([a], [b]) => a.localeCompare(b))) {
        const name = path
          .split("/")
          .pop()!
          .replace(/\.mp3$/, "");
        // a stage's loops: music-<stage> is its first, music-<stage>-<n> its n-th (ordered by number below, not by name)
        const loop = /^music-(\d+)(?:-(\d+))?$/.exec(name);
        if (loop) {
          loops.push({ stage: Number(loop[1]), take: Number(loop[2] ?? 1), url });
          continue;
        }
        if (name === "music-finale") {
          finale ??= url;
          continue;
        }
        // vault-fanfare-2 / -3 are Vaults II and III's own fanfares (tried before vault-fanfare, so they are never a
        // spare take of Vault I's); a numbered file of any other track is a take of it
        const track = /^(vault-suspense|vault-intro|vault-fanfare-[23]|vault-fanfare|prestige|credits)(?:-(\d+))?$/.exec(name);
        if (track) {
          const trackId = track[1] as TrackId;
          if (!tracks.has(trackId)) tracks.set(trackId, url); // sorted, so a take -1 wins over a spare
          continue;
        }
        const id = name.replace(/-\d+$/, "");
        if (id in SOUNDS) sfx.set(id as SoundId, [...(sfx.get(id as SoundId) ?? []), url]);
      }
      const music = new Map<number, string[]>();
      for (const l of loops.sort((a, b) => a.stage - b.stage || a.take - b.take)) music.set(l.stage, [...(music.get(l.stage) ?? []), l.url]);
      return { sfx, music, finale, tracks };
    }
    ```

- [ ] **Step 6: Keep the engine compiling (interim, replaced in Task 2).** In `fx/audio/AudioEngine.ts`:
  - In `preload`, change the url list's head to `...[...this.files.music.values()].flat(), ...(this.files.finale ? [this.files.finale] : []),`.
  - In `updateMusic`, change `this.buffers.get(this.files.music.get(stage)!)` to `this.buffers.get(this.files.music.get(stage)![0]!)`. The game plays each stage's first loop, as today, until Task 2.

- [ ] **Step 7: The manifest.** In `art/manifest.json`'s `audio` array:
  - Insert the six loops and the finale right after the `music-5` entry, in this order: `music-3-2`, `music-3-3`, `music-4-2`, `music-4-3`, `music-5-2`, `music-5-3`, `music-finale`.
  - Insert `credits` right after `prestige`.
  - Shape: the existing music entries plus a `recipe` field for the processing. The manifest test ignores fields it does not know, and `tools/art` does not read `audio`.
  ```json
  {
    "id": "music-3-2",
    "kind": "music",
    "stage": 3,
    "duration": 32,
    "prompt": "<the prompt the README records for music-3b, verbatim>",
    "recipe": "<the README's processing for music-3b, verbatim (e.g. its ffmpeg trim/fade/loudness command)>; source take art/source/audio/music-3b-take-1.mp3; model <as the README says>"
  },
  {
    "id": "music-finale",
    "kind": "music",
    "stage": 5,
    "fromRun": 4,
    "duration": 32,
    "prompt": "<music-run4's prompt>",
    "recipe": "<music-run4's processing>; source take art/source/audio/music-run4-take-1.mp3"
  },
  {
    "id": "credits",
    "kind": "music",
    "duration": <its ffprobe duration, one decimal>,
    "prompt": "<music-credits' prompt>",
    "recipe": "<its processing>; source take art/source/audio/credits-take-1.mp3"
  }
  ```
  - **The prompts.** Take them from the README. They should match `.superpowers/sdd/f5-music-pricing.md`'s "Prompts" section (e.g. music-3b: "Energetic funk-house for a game getting wild, exactly 120 BPM, 4/4, A minor, 16 bars: … a funky wah guitar lead … loopable start and end, no intro, no outro, no vocals"). Where they differ, the README wins: it records what was actually generated.
  - **A loop built from an existing one.** If the budget ran out and a loop was built with ffmpeg from an existing loop (spec §6's fallback), its `prompt` says so and names its source and filters, e.g. "Built (no credits) from music-3.mp3 (120 BPM): …". It must still contain "120 BPM" (the manifest test checks it).

- [ ] **Step 8: Run everything, then commit.**
  Run: `npx vitest run src/modules/casecremental/fx/audio` (PASS), then `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS). The build copies the eight mp3s into `dist/`: check that they appear in its asset list.
  ```bash
  git add src/modules/casecremental/assets/audio/music-3-2.mp3 src/modules/casecremental/assets/audio/music-3-3.mp3 \
    src/modules/casecremental/assets/audio/music-4-2.mp3 src/modules/casecremental/assets/audio/music-4-3.mp3 \
    src/modules/casecremental/assets/audio/music-5-2.mp3 src/modules/casecremental/assets/audio/music-5-3.mp3 \
    src/modules/casecremental/assets/audio/music-finale.mp3 src/modules/casecremental/assets/audio/credits.mp3 \
    src/modules/casecremental/fx/audio/sounds.ts src/modules/casecremental/fx/audio/AudioEngine.ts \
    src/modules/casecremental/fx/audio/AudioEngine.test.ts src/modules/casecremental/fx/audio/sounds.test.ts \
    src/modules/casecremental/fx/audio/manifest.test.ts art/manifest.json
  git add art/source/audio/music-3b-take-*.mp3 art/source/audio/music-3c-take-*.mp3 art/source/audio/music-4b-take-*.mp3 \
    art/source/audio/music-4c-take-*.mp3 art/source/audio/music-5b-take-*.mp3 art/source/audio/music-5c-take-*.mp3 \
    art/source/audio/music-run4-take-*.mp3 art/source/audio/credits-take-*.mp3
  git commit -m "feat(music): two more loops for stages 3-5, the Run 4 finale loop and the credits track

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```
  (If the generator already committed the raw takes, the second `git add` stages nothing. Adjust its globs to the take names the README lists.)

---

### Task 2: Stage playlists

**Files:**
- Modify: `fx/audio/schedule.ts`, `fx/audio/schedule.test.ts`, `fx/audio/AudioEngine.ts`, `fx/audio/AudioEngine.test.ts`, `fx/World.ts`
- Create: `fx/audio/stageMusic.ts`

**Interfaces:**
- Consumes (Task 1): `AudioFiles.music: Map<number, string[]>`, `AudioFiles.finale`.
- Produces (`fx/audio/schedule.ts`):
  ```ts
  export const LOOP_PLAYS = 2;
  export const FINALE_STAGE = 5;
  export const FINALE_RUN = 4;
  export const SWAP_LEAD = 0.25;
  export function playlistFor<T>(loops: readonly T[], stage: number, run: number, finale: T | null): T[];
  export function swapTime(startedAt: number, duration: number, plays?: number, bpm?: number): number;
  export function nextReady(from: number, count: number, ready: (i: number) => boolean): number | null;
  ```
- Produces (`AudioEngine`), used by Task 3 and F6:
  ```ts
  tick(run: number): void;                       // every frame, from World.update
  auditionLoop(stage: number, index: number): void; // dev sound board
  skipLoop(): void;                               // dev sound board
  loopCount(stage: number): number;               // dev sound board (stage 5 counts the finale)
  ```

**The rules, exactly** (spec §6, with the ambiguities resolved):
- **A stage's playlist:**
  - its own loops in take order (`music-<stage>`, `-2`, `-3`);
  - in stage 5 from Run 4 on, the finale is appended last. Run 4's replays are Run 4, so they get it too;
  - a stage with no loops falls back to the nearest lower stage's playlist (`musicFor`, as today).
- **Swapping:**
  - Each loop plays `LOOP_PLAYS` (2) times, so 64 s for a 32 s loop.
  - The next loop starts on the bar line nearest the end of the second play (`swapTime`), with the existing one-bar equal-power crossfade (8 linear steps, 2 s at 120 BPM). The outgoing loop stops 0.05 s after its fade.
  - The playlist wraps after its last loop.
  - A one-loop playlist (stages 1 and 2) just keeps looping.
- **The clock.** `World.update` calls `audio.tick(run)` every frame. When the playing loop is within `SWAP_LEAD` of its swap, the next loop is scheduled on the audio clock at the swap's exact time.
  - **A late tick:** if the frames stopped (a hidden tab) and the swap time went by, the swap goes on the next bar line from now.
  - **The run** given to `tick` is remembered. It decides the finale at the next swap or the next stage start.
- **A stage change:**
  - As today, the new stage starts on the next bar line of the playing loop, with the one-bar crossfade.
  - A new stage starts at its **cursor**: the entry after the one it last started. The first time a stage plays, that is its first loop.
  - If a playlist swap was already scheduled and has not started, it is cancelled: stopped before it plays. Its stage's cursor goes back to it, and the new stage takes that same bar line.
- **Vault tracks and the lobby:**
  - A named track (the vault, prestige, credits), the lobby (`setMusicOn(false)`) and `dispose` stop the loop with a fade. That cancels its scheduled automation first, and also fades out a loop still fading from a swap.
  - Handing back starts the stage at its cursor. So after the lobby or a vault you hear the stage's next loop.
- **Decode failures.** A loop whose file never decoded is skipped (`nextReady`). If none of a stage's loops are decoded yet, nothing starts: `preload()` asks again when the files are in, as today.
- **A reload.** Nothing is saved. A fresh engine plays the sim's stage from its first loop.

- [ ] **Step 1: Write the failing schedule tests** in `fx/audio/schedule.test.ts`. Add `FINALE_RUN, LOOP_PLAYS, nextReady, playlistFor, swapTime` to the import, and add:
  ```ts
  describe("stage playlists (finish spec §6)", () => {
    it("plays a stage's own loops, plus Run 4's finale in stage 5 from Run 4 on", () => {
      expect(playlistFor(["a", "b", "c"], 5, 3, "f")).toEqual(["a", "b", "c"]);
      expect(playlistFor(["a", "b", "c"], 5, FINALE_RUN, "f")).toEqual(["a", "b", "c", "f"]);
      expect(playlistFor(["a", "b", "c"], 5, FINALE_RUN + 1, "f")).toEqual(["a", "b", "c", "f"]);
      expect(playlistFor(["a", "b", "c"], 4, FINALE_RUN, "f")).toEqual(["a", "b", "c"]);
      expect(playlistFor(["a"], 5, FINALE_RUN, null)).toEqual(["a"]);
    });

    it("hands a loop over after it has played twice, on the bar line nearest that end", () => {
      expect(LOOP_PLAYS).toBe(2);
      expect(swapTime(0, 32)).toBe(64);
      expect(swapTime(3, 32)).toBe(67); // on the grid the loop started on
      expect(swapTime(0, 32.04)).toBe(64); // an mp3 a few ms long stays on its grid
      expect(swapTime(0, 31.97)).toBe(64);
      expect(swapTime(0, 10)).toBe(20);
      expect(swapTime(5, 0.2)).toBe(7); // at least one bar
    });

    it("skips loops that are not ready, wrapping, and gives up when none is", () => {
      expect(nextReady(1, 3, (i) => i !== 1)).toBe(2);
      expect(nextReady(2, 3, (i) => i === 0)).toBe(0);
      expect(nextReady(0, 3, () => false)).toBeNull();
      expect(nextReady(4, 3, () => true)).toBe(1); // a cursor past a shorter playlist wraps
      expect(nextReady(0, 0, () => true)).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Write the failing engine tests** in `fx/audio/AudioEngine.test.ts`. Add a new describe at the end. The fake buffers are 10 s long, so a loop hands over at 20 s, 40 s, … and a bar is 2 s.
  ```ts
  const PLAYLISTS = {
    "/a/music-1.mp3": "m1",
    "/a/music-3.mp3": "m3",
    "/a/music-3-2.mp3": "m3b",
    "/a/music-3-3.mp3": "m3c",
    "/a/music-4.mp3": "m4",
    "/a/music-5.mp3": "m5",
    "/a/music-5-2.mp3": "m5b",
    "/a/music-5-3.mp3": "m5c",
    "/a/music-finale.mp3": "fin",
    "/a/prestige.mp3": "pres",
  };

  /** An engine playing `stage`, with a settable clock; `loops()` lists the stage loops started as [url, when]. */
  async function playing(stage: number, fail: (url: string) => boolean = () => false) {
    const f = fakeContext("running", fail);
    const a = new AudioEngine(PLAYLISTS, deps(f.ctx));
    a.setMusicOn(true);
    a.setStage(stage);
    a.unlock();
    await a.ready;
    const at = (t: number) => void ((f.ctx as unknown as { currentTime: number }).currentTime = t);
    const loops = () => f.started.filter((s) => s.loop && s.url !== "pres").map((s) => [s.url, s.when] as const);
    return { ...f, a, at, loops };
  }

  describe("AudioEngine stage playlists (finish spec §6)", () => {
    it("plays a stage's loops in turn, each twice, from its first, swapped on the bar line where its second play ends", async () => {
      const { a, at, loops } = await playing(3);
      expect(loops()).toEqual([["m3", 0]]); // a fresh engine (a reload) starts at the first loop
      at(19);
      a.tick(1);
      expect(loops()).toHaveLength(1); // not yet: more than SWAP_LEAD before the swap
      at(19.9);
      a.tick(1);
      a.tick(1); // asked again on the next frame: already scheduled
      expect(loops()).toEqual([
        ["m3", 0],
        ["m3b", 20],
      ]);
      at(39.9);
      a.tick(1);
      at(59.9);
      a.tick(1);
      expect(loops()).toEqual([
        ["m3", 0],
        ["m3b", 20],
        ["m3c", 40],
        ["m3", 60],
      ]);
    });

    it("crossfades over one bar: the outgoing loop stops just after the fade", async () => {
      const { a, at, stops } = await playing(3);
      at(19.9);
      a.tick(1);
      expect(stops).toContainEqual({ url: "m3", when: 20 + 2 + 0.05 });
    });

    it("a stage with one loop just keeps looping", async () => {
      const { a, at, loops } = await playing(1);
      for (const t of [19.9, 39.9]) {
        at(t);
        a.tick(1);
      }
      expect(loops()).toEqual([["m1", 0]]);
    });

    it("stage 5 takes the finale only in Run 4, after its own loops", async () => {
      const r3 = await playing(5);
      for (const t of [19.9, 39.9, 59.9]) {
        r3.at(t);
        r3.a.tick(3);
      }
      expect(r3.loops().map(([u]) => u)).toEqual(["m5", "m5b", "m5c", "m5"]);
      const r4 = await playing(5);
      for (const t of [19.9, 39.9, 59.9, 79.9]) {
        r4.at(t);
        r4.a.tick(4);
      }
      expect(r4.loops().map(([u]) => u)).toEqual(["m5", "m5b", "m5c", "fin", "m5"]);
    });

    it("a stage change swaps on the next bar line, and coming back brings that stage's next loop", async () => {
      const { a, at, loops } = await playing(3);
      at(5.3);
      a.setStage(4);
      expect(loops().at(-1)).toEqual(["m4", 6]);
      at(9);
      a.setStage(3);
      expect(loops().at(-1)).toEqual(["m3b", 10]);
    });

    it("a stage change in the moment before a swap cancels it: the new stage takes that bar line", async () => {
      const { a, at, loops, stops } = await playing(3);
      at(19.9);
      a.tick(1); // m3b is scheduled at 20
      a.setStage(4);
      expect(loops().at(-1)).toEqual(["m4", 20]);
      expect(stops).toContainEqual({ url: "m3b", when: undefined }); // stopped before it ever plays
      at(21);
      a.setStage(3);
      expect(loops().at(-1)).toEqual(["m3b", 22]); // it comes first when stage 3 is back
    });

    it("a late frame (a hidden tab) swaps on the next bar line from now, never in the past", async () => {
      const { a, at, loops } = await playing(3);
      at(25.3);
      a.tick(1);
      expect(loops().at(-1)).toEqual(["m3b", 26]);
    });

    it("a vault track pauses the playlist; handing back starts the stage's next loop", async () => {
      const { a, at, loops } = await playing(3);
      a.setTrack("prestige");
      at(19.9);
      a.tick(1);
      expect(loops()).toEqual([["m3", 0]]);
      a.setTrack(null);
      expect(loops().at(-1)).toEqual(["m3b", 19.9]);
    });

    it("a loop that fails to decode is skipped", async () => {
      const { a, at, loops } = await playing(3, (url) => url === "m3b");
      at(19.9);
      a.tick(1);
      expect(loops().at(-1)).toEqual(["m3c", 20]);
    });

    it("the sound board can hold one loop (the finale included) until the game asks for a stage, and skip to the next", async () => {
      const { a, at, loops } = await playing(3);
      expect(a.loopCount(5)).toBe(4); // three loops and the finale
      expect(a.loopCount(2)).toBe(0);
      at(3.1);
      a.auditionLoop(5, 3);
      expect(loops().at(-1)).toEqual(["fin", 4]);
      at(23.9);
      a.tick(1);
      expect(loops().at(-1)).toEqual(["fin", 4]); // held: no swap
      a.setStage(3);
      expect(loops().at(-1)![0]).toBe("m3b");
      at(31.1);
      a.skipLoop();
      expect(loops().at(-1)![0]).toBe("m3c");
    });
  });
  ```
  (In the last test, `setStage(3)` at 23.9 starts `m3b` on the next bar line of the held finale's grid, 24 s. `skipLoop` at 31.1 starts `m3c` on the next bar line, 32 s.)

- [ ] **Step 3: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/audio`
  Expected: FAIL. The schedule functions, `tick`, `auditionLoop`, `skipLoop` and `loopCount` do not exist.

- [ ] **Step 4: The pure rules.** Append to `fx/audio/schedule.ts`, and extend its header comment with ", and the stage playlists' order and hand-overs":
  ```ts
  /** A stage loop plays this many times before its playlist moves on (finish spec §6: a 32 s loop twice, 64 s). */
  export const LOOP_PLAYS = 2;
  /** Stage 5's playlist takes Run 4's finale loop (finish spec §6), from this run on (Run 4's replays too). */
  export const FINALE_STAGE = 5;
  export const FINALE_RUN = 4;
  /** The engine schedules a playlist hand-over on the audio clock this long before its bar line, so a frame's jitter
   *  never misses it. */
  export const SWAP_LEAD = 0.25;

  /** The loops a stage plays in `run`, in order: its own, then the finale in stage 5 from Run 4 on. */
  export function playlistFor<T>(loops: readonly T[], stage: number, run: number, finale: T | null): T[] {
    return finale !== null && stage === FINALE_STAGE && run >= FINALE_RUN ? [...loops, finale] : [...loops];
  }

  /** When a loop that started at `startedAt` hands over: the bar line nearest the end of its LOOP_PLAYS plays (at least
   *  one bar in), so an mp3 a few ms off 32 s still swaps on the grid it started on. */
  export function swapTime(startedAt: number, duration: number, plays = LOOP_PLAYS, bpm = MUSIC_BPM): number {
    const bar = barSeconds(bpm);
    return startedAt + Math.max(1, Math.round((plays * duration) / bar)) * bar;
  }

  /** The first playlist entry from `from` on (wrapping) whose file is ready, or null when none is: a loop that failed to
   *  decode is skipped, never left as silence. */
  export function nextReady(from: number, count: number, ready: (i: number) => boolean): number | null {
    for (let k = 0; k < count; k++) {
      const i = (from + k) % count;
      if (ready(i)) return i;
    }
    return null;
  }
  ```

- [ ] **Step 5: The stage loops' own file.** Create `fx/audio/stageMusic.ts`:
  ```ts
  import { barSeconds, crossfade, FINALE_RUN, musicFor, nextBar, nextReady, playlistFor, swapTime, SWAP_LEAD } from "./schedule";
  import type { AudioFiles } from "./sounds";

  // The stage loops (finish spec §6). Each stage plays its loops as a playlist: a loop twice, then the next, swapped on
  // a bar line with a one-bar equal-power crossfade, wrapping; stage 5 takes Run 4's finale loop from Run 4 on. A stage
  // change swaps to the new stage on the next bar line, and a stage starts at the loop after the one it last started,
  // so coming back to a stage brings its next loop. The timing rules are pure (schedule.ts); this owns the nodes. Music
  // is not saved: a reload starts the sim's stage at its first loop.

  type MusicCtx = Pick<BaseAudioContext, "createGain" | "createBufferSource" | "currentTime">;
  /** A decoded file, or null/undefined while it loads or after it failed to decode. */
  export type BufferOf = (url: string) => AudioBuffer | null | undefined;

  interface Loop {
    stage: number;
    index: number;
    source: AudioBufferSourceNode;
    gain: GainNode;
    startedAt: number;
    duration: number;
    /** The bar line where the playlist's next loop takes over. */
    swapAt: number;
  }

  /** Steps of the linear ramps that draw a crossfade's equal-power curve. */
  const FADE_STEPS = 8;

  export class StageMusic {
    private loop: Loop | null = null;
    /** The loop still fading out after a hand-over (stopped with the playing one). */
    private prev: Loop | null = null;
    /** Per stage, the playlist entry it starts on next: the one after the entry it last started. */
    private readonly cursors = new Map<number, number>();
    /** The dev sound board's audition: hold this loop, never hand over, until a stage is asked for. */
    private held = false;

    constructor(private readonly files: Pick<AudioFiles, "music" | "finale">) {}

    /** Play `stage`'s music in `run`. Already playing that stage: nothing. Else its playlist from its cursor — on the
     *  next bar line with a one-bar crossfade over a playing loop, at once with a short fade-in over silence. */
    want(ctx: MusicCtx, bus: GainNode, buffer: BufferOf, stage: number, run: number): void {
      const list = this.playlist(stage, run);
      if (!list || (this.loop?.stage === list.stage && !this.held)) return;
      const index = nextReady(this.cursors.get(list.stage) ?? 0, list.urls.length, (i) => !!buffer(list.urls[i]!));
      if (index === null) return; // nothing decoded yet: the engine asks again when the files are in
      this.held = false;
      const at = this.loop ? nextBar(ctx.currentTime, this.loop.startedAt) : ctx.currentTime;
      this.start(ctx, bus, buffer(list.urls[index]!)!, list.stage, index, list.urls.length, at);
    }

    /** Every frame: within SWAP_LEAD of the playing loop's hand-over, schedule the playlist's next loop on that bar line
     *  (or on the next bar line from now, when the frames stopped — a hidden tab — and the hand-over went by). */
    tick(ctx: MusicCtx, bus: GainNode, buffer: BufferOf, run: number): void {
      const l = this.loop;
      if (!l || this.held || ctx.currentTime < l.swapAt - SWAP_LEAD) return;
      this.advance(ctx, bus, buffer, run, ctx.currentTime <= l.swapAt ? l.swapAt : nextBar(ctx.currentTime, l.startedAt));
    }

    /** The dev sound board: the playlist's next loop on the next bar line. */
    skip(ctx: MusicCtx, bus: GainNode, buffer: BufferOf, run: number): void {
      const l = this.loop;
      if (!l) return;
      this.held = false;
      this.advance(ctx, bus, buffer, run, nextBar(ctx.currentTime, l.startedAt));
    }

    /** The dev sound board: hold entry `index` of `stage`'s full playlist (stage 5 with the finale last). */
    audition(ctx: MusicCtx, bus: GainNode, buffer: BufferOf, stage: number, index: number): void {
      const loops = this.files.music.get(stage);
      const urls = loops ? playlistFor(loops, stage, FINALE_RUN, this.files.finale) : [];
      const decoded = urls[index] ? buffer(urls[index]!) : null;
      if (!decoded) return;
      this.start(ctx, bus, decoded, stage, index, urls.length, this.loop ? nextBar(ctx.currentTime, this.loop.startedAt) : ctx.currentTime);
      this.held = true;
    }

    /** How many loops `stage`'s full playlist has (stage 5 counts the finale); 0 when it has none of its own. */
    length(stage: number): number {
      const loops = this.files.music.get(stage);
      return loops ? playlistFor(loops, stage, FINALE_RUN, this.files.finale).length : 0;
    }

    /** Fade the music out (a track takes over, the scene leaves, the engine closes). */
    stop(ctx: MusicCtx | null, fade: number): void {
      const l = this.loop;
      const fading = [this.loop, this.prev];
      this.loop = null;
      this.prev = null;
      this.held = false;
      if (!ctx) return;
      if (l && l.startedAt > ctx.currentTime) this.cursors.set(l.stage, l.index); // it never got to play: first next time
      for (const x of fading) {
        if (!x) continue;
        try {
          x.gain.gain.cancelScheduledValues(ctx.currentTime);
          x.gain.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 3));
          x.source.stop(ctx.currentTime + fade + 0.05);
        } catch {
          // already stopped
        }
      }
    }

    /** The stage with loops at or below `stage`, and its playlist in `run`. */
    private playlist(stage: number, run: number): { stage: number; urls: string[] } | null {
      const s = musicFor(stage, [...this.files.music.keys()]);
      return s === null ? null : { stage: s, urls: playlistFor(this.files.music.get(s)!, s, run, this.files.finale) };
    }

    /** Hand the playing loop over to its playlist's next ready loop at `at`; a playlist of one just loops on. */
    private advance(ctx: MusicCtx, bus: GainNode, buffer: BufferOf, run: number, at: number): void {
      const l = this.loop!;
      const list = this.playlist(l.stage, run);
      const count = list?.urls.length ?? 0;
      const index = list ? nextReady((l.index + 1) % count, count, (i) => !!buffer(list.urls[i]!)) : null;
      if (!list || index === null || index === l.index) {
        l.swapAt = swapTime(l.swapAt, l.duration);
        return;
      }
      this.start(ctx, bus, buffer(list.urls[index]!)!, l.stage, index, count, at);
    }

    private start(ctx: MusicCtx, bus: GainNode, buffer: AudioBuffer, stage: number, index: number, count: number, at: number): void {
      try {
        const cur = this.loop;
        const fade = cur ? barSeconds() : 0.5;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.gain.setValueAtTime(0, at);
        source.connect(gain).connect(bus);
        source.start(at);
        for (let i = 1; i <= FADE_STEPS; i++) gain.gain.linearRampToValueAtTime(crossfade(i / FADE_STEPS)[1], at + (fade * i) / FADE_STEPS);
        if (cur && cur.startedAt > ctx.currentTime) {
          // scheduled but not started (a stage change in the moment before a hand-over): it never plays, the loop
          // before it already fades out on this bar line, and it comes first when its stage is back
          cur.source.stop();
          this.cursors.set(cur.stage, cur.index);
        } else if (cur) {
          const g = cur.gain.gain;
          g.setValueAtTime(g.value, at);
          for (let i = 1; i <= FADE_STEPS; i++) g.linearRampToValueAtTime(crossfade(i / FADE_STEPS)[0], at + (fade * i) / FADE_STEPS);
          cur.source.stop(at + fade + 0.05);
          this.prev = cur;
        }
        this.cursors.set(stage, (index + 1) % count);
        this.loop = { stage, index, source, gain, startedAt: at, duration: buffer.duration, swapAt: swapTime(at, buffer.duration) };
      } catch {
        // music is optional
      }
    }
  }
  ```

- [ ] **Step 6: The engine uses it.** In `fx/audio/AudioEngine.ts`:
  - Header comment: change "music that swaps on bar lines when the stage changes" to "the stage music (fx/audio/stageMusic.ts: each stage's loops as a playlist, swapped on bar lines)".
  - Imports: `import { jitter, pickVariant } from "./schedule";` (the loop helpers moved out) and `import { StageMusic, type BufferOf } from "./stageMusic";`.
  - Delete `interface Loop`, the fields `loop` and `loopStartedAt`, and the method `stopLoop`.
  - Add these fields, and in the constructor after `this.files = indexAudio(urls);` add `this.stageMusic = new StageMusic(this.files);`:
    ```ts
      private readonly stageMusic: StageMusic;
      /** The campaign's run, from tick(): stage 5 takes Run 4's finale. */
      private run = 1;
      private readonly bufferOf: BufferOf = (url) => this.buffers.get(url);
    ```
  - `setMusicOn(false)`: `this.stopLoop(0.3)` → `this.stageMusic.stop(this.ctx, 0.3)`. `dispose`: `this.stopLoop(0)` → `this.stageMusic.stop(this.ctx, 0)`.
  - `preload`: the music part of the url list is already Task 1's `...[...this.files.music.values()].flat(), ...(this.files.finale ? [this.files.finale] : []),`.
  - `updateMusic`: in the `wantTrack` branch, `this.stopLoop(0.6)` → `this.stageMusic.stop(ctx, 0.6)`. Replace everything after `this.stopTrack(0.6);` (the `musicFor` lookup through the end of its `try`/`catch`) with:
    ```ts
        this.stageMusic.want(ctx, b.music, this.bufferOf, this.wantStage, this.run);
    ```
  - After `setStage`, add:
    ```ts
      /** Every frame (World.update): the stage playlist's clock — a hand-over is scheduled on the audio clock just before its
       *  bar line — and the campaign's run: stage 5 takes Run 4's finale loop from Run 4 on (finish spec §6). */
      tick(run: number): void {
        this.run = run;
        const ctx = this.ctx;
        const b = this.buses;
        if (!ctx || !b || !this.musicOn || this.wantTrack) return;
        this.stageMusic.tick(ctx, b.music, this.bufferOf, run);
      }

      /** Dev sound board: hold one loop of a stage's playlist (stage 5's last is Run 4's finale) until a stage is asked for. */
      auditionLoop(stage: number, index: number): void {
        const ctx = this.ctx;
        const b = this.buses;
        if (ctx && b && this.musicOn && !this.wantTrack) this.stageMusic.audition(ctx, b.music, this.bufferOf, stage, index);
      }

      /** Dev sound board: the playlist's next loop on the next bar line. */
      skipLoop(): void {
        const ctx = this.ctx;
        const b = this.buses;
        if (ctx && b && this.musicOn && !this.wantTrack) this.stageMusic.skip(ctx, b.music, this.bufferOf, this.run);
      }

      /** Dev sound board: how many loops a stage's playlist has (stage 5 counts the finale). */
      loopCount(stage: number): number {
        return this.stageMusic.length(stage);
      }
    ```
  - Update `setStage`'s doc comment: "The intensity stage changed: its playlist starts on the next bar line (at the loop after the one it last played)."

- [ ] **Step 7: The World sets the clock and the run.** In `fx/World.ts`'s `update`, right after `this.stations.update(realSeconds, gameMs, run.state);`, add:
  ```ts
      this.audio.tick(run.setup.run); // the stage playlist's clock, and the run (Run 4's finale in stage 5)
  ```
  This is the only World change. Check that `this.audio`'s type exposes `tick`: it is the `AudioEngine` itself. If the World holds a narrowed `Pick<…>`, add `"tick"` to it.

- [ ] **Step 8: Run everything, then commit.**
  Run: `npx vitest run src/modules/casecremental/fx/audio` (PASS). The old engine tests must pass unchanged: the stage loop's start, the fallback, music off, tracks handing back. Then run `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS), and `wc -l src/modules/casecremental/fx/audio/AudioEngine.ts` (expect ≤ 385).
  ```bash
  git add src/modules/casecremental/fx/audio/schedule.ts src/modules/casecremental/fx/audio/schedule.test.ts \
    src/modules/casecremental/fx/audio/stageMusic.ts src/modules/casecremental/fx/audio/AudioEngine.ts \
    src/modules/casecremental/fx/audio/AudioEngine.test.ts src/modules/casecremental/fx/World.ts
  git commit -m "feat(music): stage playlists - each loop twice, then the next on a bar line; Run 4's finale joins stage 5

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 3: The sound board, the listening pass and the notes

**Files:**
- Modify: `ui/SoundBoard.tsx`, `docs/feature-history/casecremental-finish.md`, `docs/feature-history/README.md`

**Interfaces:**
- Consumes (Task 2): `AudioEngine.auditionLoop`, `skipLoop`, `loopCount`, `setTrack("credits", { loop: false })`.

Automation cannot hear: the browser tab is muted, and no test decodes an mp3. The playlist's timing is tested; whether it sounds right is a human's call. This task gives that human the controls and a list of what to listen for.

- [ ] **Step 1: Audition controls.** In `ui/SoundBoard.tsx`:
  - Header comment: after "and the stage loops", add "(every loop of every playlist, the finale and the credits, with a skip to hear each hand-over)".
  - Add `const [credits, setCredits] = useState(false);` beside `armed`.
  - `close` becomes:
    ```tsx
      const close = () => {
        if (credits) audio.setTrack(null); // the credits were the board's; hand the music back
        audio.setStage(stage); // back to the game's own loop
        onClose();
      };
      /** One loop of a stage's playlist, held (the credits stop first). */
      const audition = (s: number, i: number) => {
        if (credits) (audio.setTrack(null), setCredits(false));
        audio.setMusicOn(true);
        audio.auditionLoop(s, i);
      };
    ```
  - Extend the Music row's buttons after Buzzed with `High`, `Tripping` and `Unhinged` (`audio.setStage(3)`, `(4)`, `(5)`, each after `audio.setMusicOn(true)`), then `Next loop` (`audio.skipLoop()`) and `Credits`:
    ```tsx
                <PxButton onClick={() => (audio.setMusicOn(true), audio.setStage(3))}>High</PxButton>
                <PxButton onClick={() => (audio.setMusicOn(true), audio.setStage(4))}>Tripping</PxButton>
                <PxButton onClick={() => (audio.setMusicOn(true), audio.setStage(5))}>Unhinged</PxButton>
                <PxButton onClick={() => audio.skipLoop()}>Next loop</PxButton>
                <PxButton on={credits} onClick={() => (audio.setMusicOn(true), audio.setTrack("credits", { loop: false }), setCredits(true))}>
                  Credits
                </PxButton>
    ```
  - Under the Music row, add a Loops row. Stage 5's last button is the finale:
    ```tsx
            <div className="cc-row-line">
              <span>Loops</span>
              <span className="cc-tabs">
                {[3, 4, 5].flatMap((s) =>
                  Array.from({ length: audio.loopCount(s) }, (_, i) => (
                    <PxButton key={`${s}-${i}`} onClick={() => audition(s, i)}>
                      {s === 5 && i === audio.loopCount(5) - 1 ? "5·F" : `${s}·${i + 1}`}
                    </PxButton>
                  )),
                )}
              </span>
            </div>
    ```
  Run `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).

- [ ] **Step 2: A quick automated look.** Start the game with `npm run dev` (in the background; Vite, port 5180). Open a dev build: the game, or the scratch harness `http://localhost:5180/.superpowers/harness/index.html?state=empty&cash=500`, which mounts the scene without sign-in. Load the browser tools in one `ToolSearch` call:
  `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__javascript_tool`.

  Work in a new tab. If no browser is connected, use headless Chrome over CDP (`.superpowers/harness/cdp.mjs`), and say which way you went in the report. Then:
  1. Settings → SOUND BOARD (DEV). Screenshot: the Music row reads Sober…Unhinged, Next loop, Credits, Off. The Loops row reads 3·1 3·2 3·3 4·1 4·2 4·3 5·1 5·2 5·3 5·F.
  2. Press each loop button and Credits.
  3. Run `read_console_messages` with pattern `error|warn|audio|decode`. Expected: no decode errors and no 404s for `music-*`/`credits`.
  4. With `javascript_tool`, check that every new file is served: `await Promise.all(["music-3-2","music-3-3","music-4-2","music-4-3","music-5-2","music-5-3","music-finale","credits"].map(n => fetch(new URL(\`/src/modules/casecremental/assets/audio/${n}.mp3\`, location.origin)).then(r => [n, r.status])))`. Expected: all 200.

- [ ] **Step 3: What a human must listen for.** Automation stops here. Write this list into the notes (Step 4) and hand it to the user in the report as the F5 listening check. Use headphones, a dev build, music at its default level, effects at default.
  1. **Each loop on its own** (Loops buttons):
     - it loops seamlessly: no click, gap or jump at the 32 s seam;
     - it sits in A minor at 120 BPM with the stage's instruments (Rhodes and round bass throughout; High = funk-house, Tripping = psychedelic synth-funk, Unhinged = big-room funk);
     - 5·F sounds like a climax, not a different game.
  2. **Level:** switch between 3·1/3·2/3·3, 4·1/4·2/4·3 and 5·1/5·2/5·3/5·F. No loop jumps out or drops away (the files were matched within ~1 dB).
  3. **The hand-overs:** play High, then press Next loop a few times. Each new loop comes in on a downbeat with a one-bar blend, no flam (two kicks out of step), no tempo wobble, and no key clash in the blend. Repeat for Tripping and Unhinged. Also let one stage run untouched for ~2½ minutes: loop 1 twice, loop 2 twice, then loop 3.
  4. **Stage changes in play:** play into High and Tripping (or use the stage buttons). A stage change still lands on a bar line, and going back to a stage brings a loop you did not just hear.
  5. **The credits:** warm and triumphant in A major. It builds, peaks mid-way and ends cleanly: no cut-off, no loop (it is a one-shot). Its level is close to the prestige loop's (open a vault, or compare by ear).
  6. **The vault hand-back:** open a vault and play into the next run. The intro, fanfare and prestige still play over silence: no stage loop bleeding through for a bar.

- [ ] **Step 4: The notes.** In `docs/feature-history/casecremental-finish.md`, add `## F5 — music for the late stages`, covering what the code does not show:
  - the eight tracks and how they were made (generator, model, credits spent, takes), pointing to `art/manifest.json` for the prompts and recipes; any loop built with ffmpeg instead (the budget fallback); the measured lengths and levels;
  - the naming (`music-<stage>-<n>`, `music-finale`, `credits`) and why: `indexAudio`'s variant convention;
  - the playlist rules as decided:
    - a loop twice, then the bar line nearest its end;
    - the cursor per stage (coming back brings the next loop);
    - a pending hand-over is cancelled by a stage change;
    - a hidden tab keeps looping;
    - nothing saved, so a reload starts at the first loop;
    - the finale is stage 5's last entry from Run 4 on;
  - the seam: `World.update` → `audio.tick(run)` is both the clock and the run, so the engine never imports the sim;
  - `credits` is registered with `TRACK_GAIN` 1, for F6-C's `setTrack("credits", { loop: false })`;
  - the listening checklist from Step 3, and the user's verdict once they have listened. Until then, write "not yet listened to by a human".

  In `README.md`, extend the finish line's gist with "; F5: stage playlists and the late-stage music".

- [ ] **Step 5: Commit.**
  ```bash
  git add src/modules/casecremental/ui/SoundBoard.tsx docs/feature-history/casecremental-finish.md docs/feature-history/README.md
  git commit -m "feat(music): the dev sound board auditions every loop, the finale and the credits; F5 notes

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

## Self-review notes (spec §6 coverage)

| Spec §6 item | Covered in |
|---|---|
| Two more loops each for stages 3, 4, 5 (120 BPM, 4/4, A minor, 16 bars, same instruments) | generated outside this plan; Task 1 checks length and level, indexes, manifests; Task 3's listening checks key, tempo, instruments |
| A finale loop for Run 4: stage 5 in Run 4 plays it among the others | Task 1 (file, `finale`), Task 2 (`playlistFor`, the engine's run via `tick`) |
| A credits track (~60–90 s, A major) | Task 1 (file, `TrackId` `credits`, `TRACK_GAIN`); played by F6-C |
| A stage plays its loops as a playlist: twice (64 s), then the next, on a bar line with the existing crossfade | Task 2 |
| Budget / ffmpeg fallback | generator's job; Task 1 Step 7 records a fallback-built loop's recipe in the manifest |
| Loudness matched (mean within ~1 dB); recipes and prompts in `art/manifest.json` | Task 1, Steps 1 and 7 |
