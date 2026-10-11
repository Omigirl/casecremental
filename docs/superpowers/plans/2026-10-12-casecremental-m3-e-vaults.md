# Casecremental M3-E — Vaults II and III on screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vaults II and III play the same last-chance jackpot as Vault I on the same 17.4 s timeline, but in their
own art, beam colours, light, fanfare and a wilder chaos (count and density only), with the photosensitivity limits
tested for every vault and Vault I unchanged.

**Architecture:** One presentation table, `fx/vault/vaultLooks.ts`, keyed by the sim's `VaultDef["id"]`. It holds
each vault's chest sprite id, beam palette, light tints, fanfare track id and chaos knobs. Vault I's entry is
exactly today's constants. The World reads the run's vault (`vaultFor(run.setup.run)`) every frame and before a
restore, and hands it to `VaultScene.setVault` and `VaultBeams.setVault`. Each of those passes the look to its parts
(chest, rays, chaos, beams), and nothing changes when the vault is the same one. The music plan takes the vault's
fanfare id. "Wilder" means more firework bursts on the same 14 kicks, twin items on the beam streams, and more
rain and edge sparks. The kick schedule is unchanged, and so are the kick sounds and the flash schedule built from
it.

**Tech Stack:** TypeScript strict, Vitest, PixiJS 8. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-m3-runs-2-3-design.md` §7 (Vaults II and III) and §13
("vault beam colours per vault, photosensitivity tests over every vault def", browser check of Vaults II and III).
Background: `docs/superpowers/specs/2026-10-09-casecremental-vault-jackpot-design.md` and
`docs/feature-history/casecremental-run1.md` (the 17.4 s timeline, the intro, the built fanfare, beams, chaos,
photosensitivity).

**Runs after:**
- **Plan M3-A Task 3:** `sim/content/vaults.ts`, `vaultFor`, `GameView.vault.id`, and the fifth drop's
  `caseId = def.id` / `skinId = def.legend.id`.
- **Plan M3-A Task 8:** the dev START RUN 2 / RUN 3 and +CASH buttons.
- **Plan M3-B:** the legends' `hueflow` and `nebula` patterns.
- **Plan M3-C Tasks 2 and 4:** the sprites `vault-case-2`, `vault-case-3`, and `vault-fanfare-2.mp3`,
  `vault-fanfare-3.mp3` with their manifest entries.

Before Task 1, check that they are in:

```bash
ls src/modules/casecremental/sim/content/vaults.ts src/modules/casecremental/assets/sprites/vault-case-2.json src/modules/casecremental/assets/sprites/vault-case-3.json src/modules/casecremental/assets/audio/vault-fanfare-2.mp3 src/modules/casecremental/assets/audio/vault-fanfare-3.mp3
grep -n '"vault-fanfare-2"\|"vault-fanfare-3"' art/manifest.json
```

If any is missing, stop and report which one. Do not create them.

## Global Constraints

- **Vault I renders and sounds exactly as now:**
  - the same sprite, palette, tints, fanfare, bursts per kick, rain and spark counts, stream, shimmer and flash
    colour;
  - `vaultLooks.test.ts` pins its entry to today's literal constants;
  - every existing vault test stays green with no expectation changed, except the ones a task names.
- **One clock and one timeline for all three vaults:**
  - `VAULT_CUES`, `INTRO_HITS`, `VAULT_LAND_TIMES` and `VAULT_OPENING_SECONDS` do not change;
  - the intro (`vault-intro`) is reused unchanged from the key turn (offset `t`);
  - the vault's fanfare starts at offset `t − 3.40` (`t − VAULT_CUES.impact`);
  - a reload or a lobby trip resumes at `t` with no beat replayed (the existing restore path).
- **Photosensitivity is a hard rule for every vault:**
  - at most 3 full-screen flashes in any 1-second window;
  - every light that throbs on the beat changes by less than 0.1 (`BEAT_LIGHT_AMPLITUDES`);
  - the flash schedule (`chaosPlan.ts` `FLASHES`, built from `VAULT_CUES.fireworks`) and the amplitudes are global;
  - no vault look may carry a flash, a kick time or a throb amplitude.
- **"Each one wilder" comes from count and density only** (spec §7):
  - Vault II: ×1.5 firework bursts, denser streams;
  - Vault III: ×2 bursts, the densest streams;
  - rain and edge sparks scale the same way;
  - every pool is sized once, at construction or layout, for `MAX_DENSITY` (2), so a frame allocates nothing new.
- **The beam layout is unchanged:** `beams.ts` (5 beams, the same geometry and its ~50-screen sweep). Only the
  colours and the stream density change.
- **The fifth reward is the vault's own legend:** `skinById(drop.skinId)`. The beam filler is the vault's
  `sourceCase`, never `caseById` on a vault drop and never "the last case".
- **Files:**
  - `VaultScene.ts` (402 lines) and `VaultBeams.ts` (385) may grow by at most ~25 lines each, the look applied by
    delegation;
  - `World.ts` grows by at most ~12;
  - new pure logic goes in `vaultLooks.ts`, `beamStream.ts`, `bursts.ts` and `chaos.ts` helpers.
- English and Russian for every player-visible string, within `i18n/budgets.ts` (`prestige.` ≤ 24).
- **Commands:** `npm run typecheck`, `npx vitest run src/modules/casecremental`, `npm run build`. The pre-commit hook
  runs Prettier. Each task ends with all three green.
- **Committing:**
  - other agents commit on this branch in parallel, so stage only your own files by explicit path (never
    `git add -A`, `git add .` or `commit -a`);
  - on an `index.lock` error, wait a few seconds and retry;
  - commits end with:
    ```
    Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
    ```
    An implementer on another model uses its own model name in the first line.

## Review Focus

1. **A reload in the middle of a Vault II or III opening.**
   - Expected: the chest, beams and stream come straight back in that vault's look. Landed beams rest on their
     rewards, the fanfare is that vault's at `t − 3.40`, and no beat replays.
   - Risk: the World restores the beams before it has told them the vault, which would bring back Vault I's yellow
     beams over Run 3.
   - Pinned in Task 5 ("restore after setVault"), Task 1 (musicPlan per fanfare) and Task 8 (browser reload).
2. **Vault I after M3-A's seven cases.**
   - Risk: the filler today is `CASES[CASES.length - 1]`, which becomes Inferno once M3-A lands, so Run 1's vault
     would stream Inferno skins.
   - Expected: Vault I keeps streaming Bedrock.
   - Pinned in Task 5.
3. **The re-cut fanfare files match the old spare-take pattern.**
   - Risk: `vault-fanfare-2.mp3` and `-3.mp3` are named like spare takes of Vault I's fanfare (`(-\d+)?`), so
     `indexAudio` would file them under `vault-fanfare` and Vaults II and III would have no fanfare at all.
   - Pinned in Task 1, including a test over the real `assets/audio` files.
4. **A chest sheet built at another frame width.**
   - Risk: the build makes the cell `max(68, widest + 6)` wide. The lock, mouth, seam and beam origin are fixed
     frame px (`chest.ts`, `vaultLayout.ts`), so a wider sheet would put the key hole, the light and the beams in
     the wrong place.
   - Pinned in Task 2 (every look's built sheet is 4 × 68×78).
5. **A denser vault adding flashes or throbs.**
   - Expected: extra bursts, twins, rain and sparks never fire `hd.flash` or change an amplitude.
   - Pinned in:
     - Task 2: a frame-by-frame flash count per vault at 30/60/144 fps and through hitches, and the chaos knobs
       pinned to a closed list;
     - Task 3: a per-vault measured chest throb;
     - Task 4: kick bursts are points only.

---

## File Structure (paths relative to `src/modules/casecremental/`)

| File | Change |
|---|---|
| `fx/audio/sounds.ts` | `FanfareId`; `TrackId` + `vault-fanfare-2`, `vault-fanfare-3`; their `TRACK_GAIN`; `indexAudio` files them as their own tracks |
| `fx/audio/sounds.test.ts`, `fx/audio/AudioEngine.test.ts` | the new tracks' tests |
| `fx/vault/vaultFlow.ts` (+ `.test.ts`) | `musicPlan(s, power, fanfare)` |
| `fx/vault/vaultLooks.ts` (new) + `vaultLooks.test.ts` (new) | `VaultLook`, `VAULT_LOOKS`, `vaultLook`, `MAX_DENSITY`; the per-vault photosensitivity tests |
| `fx/vault/chest.ts` (+ `chest.test.ts`) | `Chest.setLook(frames, light)`; tints from the look |
| `fx/vault/rays.ts` | `Rays.setLight(light)`; tints from the look |
| `fx/vault/bursts.ts` (+ `bursts.test.ts`) | `kickBursts(index, n, screen, random)` |
| `fx/vault/chaos.ts` (+ `chaos.test.ts`) | `VaultChaos.setLook`; `rainCount`, `sparkCount`, `rainShow`, `sparkSide`, `shimmerTint`; pools for `MAX_DENSITY` |
| `fx/vault/beamStream.ts` (+ `beamStream.test.ts`) | `hasTwin`, `twinJitter`, `TWIN_SKIN_SHIFT` |
| `fx/vault/beams.ts` (+ `beams.test.ts`) | `BEAM_PALETTE` removed (it is Vault I's look now) |
| `fx/vault/VaultBeams.ts` (+ `VaultBeams.test.ts`) | `setVault(def)`; palette, filler from `sourceCase`, twins |
| `fx/vault/VaultScene.ts` | `setVault(def)`; chest frames by look; kick bursts by look; the impact flash's colour |
| `fx/World.ts` | `syncVault()` every frame and before a restore; the vault's fanfare in `resumeMusic` |
| `ui/prestigeRules.ts` (+ test), `ui/Prestige.tsx`, `ui/GamePanel.tsx`, `i18n/en.ts`, `i18n/ru.ts` | the prestige screen names the vault that opened |
| `docs/feature-history/casecremental-run1.md` | the vaults' looks, and why wilder is density only |

---

### Task 1: The vaults' fanfares in the mixer

**Files:**
- Modify: `fx/audio/sounds.ts:61-120` (`TrackId`, `TRACK_GAIN`, `indexAudio`)
- Modify: `fx/vault/vaultFlow.ts:31-42` (`musicPlan`)
- Test: `fx/audio/sounds.test.ts`, `fx/audio/AudioEngine.test.ts`, `fx/vault/vaultFlow.test.ts`

**Interfaces:**
- Consumes: M3-C's `assets/audio/vault-fanfare-2.mp3` and `vault-fanfare-3.mp3` (no variant suffix), and its
  `art/manifest.json` music entries with ids `vault-fanfare-2` and `vault-fanfare-3`.
- Produces:
```ts
// fx/audio/sounds.ts
export type FanfareId = "vault-fanfare" | "vault-fanfare-2" | "vault-fanfare-3";
export type TrackId = "vault-suspense" | "vault-intro" | FanfareId | "prestige";
// TRACK_GAIN["vault-fanfare-2"] === TRACK_GAIN["vault-fanfare-3"] === TRACK_GAIN["vault-fanfare"] (1.5)
// fx/vault/vaultFlow.ts
export function musicPlan(s: Pick<RunState, "vault" | "over">, power: PowerPhase, fanfare?: FanfareId): MusicPlan; // default "vault-fanfare"
```

- [ ] **Step 1: Write the failing tests.**

  In `fx/audio/AudioEngine.test.ts`, inside `describe("indexAudio tracks", …)`, add:
```ts
  it("indexes Vaults II and III's fanfares as their own tracks, never as spare takes of Vault I's", () => {
    const files = indexAudio({
      "/a/vault-fanfare-1.mp3": "f1",
      "/a/vault-fanfare-2.mp3": "f2",
      "/a/vault-fanfare-3.mp3": "f3",
    });
    expect(files.tracks.get("vault-fanfare")).toBe("f1");
    expect(files.tracks.get("vault-fanfare-2")).toBe("f2");
    expect(files.tracks.get("vault-fanfare-3")).toBe("f3");
    expect(files.sfx.size).toBe(0);
  });
```
  and inside `describe("AudioEngine tracks and caps", …)`:
```ts
  it("plays each vault's own fanfare, at the fanfare's level", async () => {
    const { ctx, started, levels } = fakeContext();
    const a = new AudioEngine({ ...TRACKS, "/a/vault-fanfare-3.mp3": "fan3" }, deps(ctx));
    a.setMusicOn(true);
    a.unlock();
    await a.ready;
    levels.length = 0;
    a.setTrack("vault-fanfare-2", { loop: false, offset: 2 });
    expect(started.find((s) => s.url === "fan2")).toMatchObject({ loop: false, offset: 2 });
    a.setTrack("vault-fanfare-3", { loop: false, offset: 0 });
    expect(started.find((s) => s.url === "fan3")).toMatchObject({ loop: false, offset: 0 });
    expect(started.some((s) => s.url === "fan1")).toBe(false);
    expect(levels.filter((v) => v === TRACK_GAIN["vault-fanfare"]).length).toBeGreaterThanOrEqual(2);
  });
```
  In `fx/audio/sounds.test.ts` (add `indexAudio`, `TRACK_GAIN` and `type TrackId` to its import from `./sounds`):
```ts
const REAL_FILES = import.meta.glob("../../assets/audio/*.mp3", { eager: true, query: "?url", import: "default" }) as Record<
  string,
  string
>;

describe("the named tracks", () => {
  it("plays Vaults II and III's fanfares at Vault I's level (their re-cuts are level-matched, plan M3-C)", () => {
    expect(TRACK_GAIN["vault-fanfare-2"]).toBe(TRACK_GAIN["vault-fanfare"]);
    expect(TRACK_GAIN["vault-fanfare-3"]).toBe(TRACK_GAIN["vault-fanfare"]);
  });

  it("finds every named track's file in assets/audio", () => {
    const files = indexAudio(REAL_FILES);
    for (const id of Object.keys(TRACK_GAIN) as TrackId[]) expect(files.tracks.get(id), id).toBeDefined();
    expect(files.tracks.get("vault-fanfare")).toMatch(/vault-fanfare-1/);
    expect(files.tracks.get("vault-fanfare-2")).toMatch(/vault-fanfare-2/);
    expect(files.tracks.get("vault-fanfare-3")).toMatch(/vault-fanfare-3/);
  });
});
```
  In `fx/vault/vaultFlow.test.ts`, inside `describe("the music after a lobby trip picks up where the vault is", …)`:
```ts
  it("plays the run's own vault's fanfare: the same suspense and intro, the same hand-off at t − 3.40", () => {
    for (const fanfare of ["vault-fanfare-2", "vault-fanfare-3"] as const) {
      expect(musicPlan(at({ phase: "key" }), "lit", fanfare).track).toBe("vault-suspense");
      expect(musicPlan(at(opening(1.6)), "lit", fanfare)).toEqual({ track: "vault-intro", loop: false, offset: 1.6, musicOn: true });
      expect(musicPlan(at(opening(3.4)), "lit", fanfare)).toEqual({ track: fanfare, loop: false, offset: 0, musicOn: true });
      const mid = musicPlan(at(opening(6.4)), "lit", fanfare);
      expect(mid).toMatchObject({ track: fanfare, loop: false, musicOn: true });
      expect(mid.offset).toBeCloseTo(3, 9);
      const ended: VaultState = { phase: "opening", t: VAULT_OPENING_SECONDS, drops: [], landed: 5 };
      expect(musicPlan(at(ended), "lit", fanfare).track).toBeNull();
    }
    expect(musicPlan(at(opening(6.4)), "lit").track).toBe("vault-fanfare"); // Vault I by default
  });
```

- [ ] **Step 2: Run the tests to verify they fail.**

  Run: `npx vitest run src/modules/casecremental/fx/audio src/modules/casecremental/fx/vault/vaultFlow.test.ts`

  Expected: FAIL. `files.tracks.get("vault-fanfare-2")` is undefined, the type errors show in typecheck,
  `TRACK_GAIN["vault-fanfare-2"]` is undefined, and `musicPlan` ignores its third argument.

- [ ] **Step 3: Implement.**

  In `fx/audio/sounds.ts` replace the `TrackId` declaration and `TRACK_GAIN`:
```ts
/** The vaults' fanfares: Vault I's, then Vaults II's and III's (Vault I's re-cut +2 and +4 semitones, plan M3-C). */
export type FanfareId = "vault-fanfare" | "vault-fanfare-2" | "vault-fanfare-3";

/** Named music that replaces the stage loop: the vault's suspense, its intro (from the key turn to the impact) and
 *  the vault's fanfare, the prestige loop. */
export type TrackId = "vault-suspense" | "vault-intro" | FanfareId | "prestige";

/** The music bus runs this much above its slider (user: "make music louder" — the generated music sat well under
 *  the effects); the master compressor keeps the peaks in check. */
export const MUSIC_BOOST = 1.6;
/** Each named track's level on the music bus: the intro and the fanfare's drop ride over everything; the re-cut
 *  fanfares are within 1 dB of Vault I's (plan M3-C), so they ride at its level. */
export const TRACK_GAIN: Readonly<Record<TrackId, number>> = {
  "vault-suspense": 1.2,
  "vault-intro": 1.4,
  "vault-fanfare": 1.5,
  "vault-fanfare-2": 1.5,
  "vault-fanfare-3": 1.5,
  prestige: 1,
};
```
  In `indexAudio`, replace the track regex line and the comment under it:
```ts
    // vault-fanfare-2 / -3 are Vaults II and III's own fanfares (tried before vault-fanfare, so they are never a
    // spare take of Vault I's); a numbered file of any other track is a take of it
    const track = /^(vault-suspense|vault-intro|vault-fanfare-[23]|vault-fanfare|prestige)(?:-(\d+))?$/.exec(name);
    if (track) {
      const trackId = track[1] as TrackId;
      if (!tracks.has(trackId)) tracks.set(trackId, url); // sorted, so a take -1 wins over a spare
      continue;
    }
```
  In `fx/vault/vaultFlow.ts`, change the import to `import type { FanfareId, TrackId } from "../audio/sounds";` and
  `musicPlan`:
```ts
/** What should be playing, read from the sim and the lights (the music engine only remembers where a track
 *  started, not where the vault is): on a reload, back from the lobby, and whenever the World restores a run.
 *  `fanfare`: the run's vault's (vaultLooks), Vault I's by default. */
export function musicPlan(s: Pick<RunState, "vault" | "over">, power: PowerPhase, fanfare: FanfareId = "vault-fanfare"): MusicPlan {
  const plan = (track: TrackId | null, loop = true, offset = 0, musicOn = true): MusicPlan => ({ track, loop, offset, musicOn });
  const v = s.vault;
  if (v?.phase === "key") return plan("vault-suspense");
  if (v?.phase === "opening") {
    // the intro from the key turn; on the impact the scene hands over to the vault's fanfare (its first downbeat)
    if (v.t < VAULT_CUES.impact) return plan("vault-intro", false, v.t);
    return v.t < VAULT_OPENING_SECONDS ? plan(fanfare, false, v.t - VAULT_CUES.impact) : plan(null, true, 0, false);
  }
  // the prestige loop waits for the dark: the PowerCycle turns it on when the blackout has fallen
  if (s.over) return power === "blackout" ? plan("prestige", true, 0, false) : plan("prestige");
  if (power === "powerUp") return plan(null, true, 0, false); // the PowerCycle turns it on when the lights are up
  return plan(null);
}
```

- [ ] **Step 4: Run the tests to verify they pass.**

  Run: `npx vitest run src/modules/casecremental/fx/audio src/modules/casecremental/fx/vault/vaultFlow.test.ts`

  Expected: PASS. `manifest.test.ts` passes as well: it finds M3-C's `vault-fanfare-2` and `vault-fanfare-3` music
  entries.

  Then run `npm run typecheck && npx vitest run src/modules/casecremental && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/modules/casecremental/fx/audio/sounds.ts src/modules/casecremental/fx/audio/sounds.test.ts src/modules/casecremental/fx/audio/AudioEngine.test.ts src/modules/casecremental/fx/vault/vaultFlow.ts src/modules/casecremental/fx/vault/vaultFlow.test.ts
git commit -m "feat(audio): Vaults II and III's fanfares as their own tracks, at Vault I's level; the music plan takes the vault's fanfare

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 2: The vaults' looks, and photosensitivity for every vault

**Files:**
- Create: `fx/vault/vaultLooks.ts`
- Create: `fx/vault/vaultLooks.test.ts`
- Possibly modify: `art/manifest.json` (`cellW` on `vault-case-2` / `vault-case-3`, see Step 4) and the rebuilt
  sprites

**Interfaces:**
- Consumes: `type VaultDef`, `VAULTS` from `sim/content/vaults.ts` (M3-A Task 3); `type FanfareId` (Task 1);
  `flashCrossed` (`chaosPlan.ts`); `BEAT_LIGHT_AMPLITUDES` (`beat.ts`); `VAULT_FRAME` (`vaultLayout.ts`).
- Produces (later tasks import exactly these names):
```ts
export type VaultId = VaultDef["id"];
export interface VaultLight {
  impactFlash: number; starburst: number; shaft: number; glow: number; tremble: number; seam: number; open: number;
}
export interface VaultChaosLook {
  burstsPerKick: number; stream: number; rain: number; sparks: number;
  shimmer: { from: number; span: number; sat: number };
}
export interface VaultLook {
  id: VaultId; chest: string; palette: readonly [number, number, number, number, number];
  light: VaultLight; fanfare: FanfareId; chaos: VaultChaosLook;
}
export const MAX_DENSITY = 2;
export const VAULT_LOOKS: Readonly<Record<VaultId, VaultLook>>;
export function vaultLook(id: VaultId): VaultLook;
```

- [ ] **Step 1: Write the failing test.** Create `fx/vault/vaultLooks.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { VAULTS } from "../../sim/content/vaults";
import { VAULT_OPENING_SECONDS } from "../../sim/tuning";
import { BEAT_LIGHT_AMPLITUDES } from "./beat";
import { flashCrossed } from "./chaosPlan";
import { VAULT_FRAME } from "./vaultLayout";
import { MAX_DENSITY, VAULT_LOOKS, vaultLook, type VaultLook } from "./vaultLooks";

const LOOKS: VaultLook[] = VAULTS.map((v) => vaultLook(v.id));
const SPRITES = import.meta.glob("../../assets/sprites/vault-case*.json", { eager: true, import: "default" }) as Record<
  string,
  { frames: number; frameW: number; frameH: number }
>;
const isColour = (c: number) => Number.isInteger(c) && c >= 0 && c <= 0xffffff;
const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

describe("the vaults' looks", () => {
  it("has one per vault, keyed by its id", () => {
    expect(Object.keys(VAULT_LOOKS).sort()).toEqual(VAULTS.map((v) => v.id).sort());
    for (const v of VAULTS) expect(vaultLook(v.id).id).toBe(v.id);
  });

  it("keeps Vault I exactly as it was before M3", () => {
    expect(vaultLook("vault1")).toEqual({
      id: "vault1",
      chest: "vault-case",
      palette: [0xffd23c, 0xff8a1e, 0xe8362a, 0xff8a1e, 0xffd23c],
      light: { impactFlash: 0xfff2c0, starburst: 0xffe08a, shaft: 0xfff2c0, glow: 0xffd34d, tremble: 0xffb040, seam: 0xffd34d, open: 0xffd34d },
      fanfare: "vault-fanfare",
      chaos: { burstsPerKick: 2, stream: 1, rain: 1, sparks: 1, shimmer: { from: 0.02, span: 0.06, sat: 0.35 } },
    });
  });

  it("gives Vaults II and III their own chest, fanfare, beams and light", () => {
    expect(vaultLook("vault2")).toMatchObject({ chest: "vault-case-2", fanfare: "vault-fanfare-2" });
    expect(vaultLook("vault3")).toMatchObject({ chest: "vault-case-3", fanfare: "vault-fanfare-3" });
    expect(new Set(LOOKS.map((l) => l.palette.join())).size).toBe(3);
    expect(new Set(LOOKS.map((l) => JSON.stringify(l.light))).size).toBe(3);
    for (const l of LOOKS) {
      expect(l.palette).toHaveLength(5);
      for (let i = 0; i < 5; i++) expect(l.palette[i], `${l.id} beam ${i}`).toBe(l.palette[4 - i]); // symmetric
      for (const c of [...l.palette, ...Object.values(l.light)]) expect(isColour(c), `${l.id} ${c.toString(16)}`).toBe(true);
    }
  });

  it("flashes pale, never saturated red, on every vault's impact", () => {
    for (const l of LOOKS) for (const ch of channels(l.light.impactFlash)) expect(ch, l.id).toBeGreaterThanOrEqual(0xc0);
  });

  it("gets wilder vault by vault through count and density only, within the pools' bound", () => {
    const [a, b, c] = LOOKS.map((l) => l.chaos);
    for (const k of ["burstsPerKick", "stream", "rain", "sparks"] as const) {
      expect(b![k], k).toBeGreaterThan(a![k]);
      expect(c![k], k).toBeGreaterThan(b![k]);
    }
    expect(b!.burstsPerKick / a!.burstsPerKick).toBeCloseTo(1.5, 9); // ×1.5 fireworks
    expect(c!.burstsPerKick / a!.burstsPerKick).toBeCloseTo(2, 9); // ×2 fireworks
    for (const l of LOOKS) {
      for (const k of ["stream", "rain", "sparks"] as const) expect(l.chaos[k], `${l.id} ${k}`).toBeLessThanOrEqual(MAX_DENSITY);
      expect(Number.isInteger(l.chaos.burstsPerKick)).toBe(true);
      expect(l.chaos.burstsPerKick).toBeLessThanOrEqual(2 * MAX_DENSITY);
    }
  });

  it("has a built 4-frame chest sheet the size of the vault's frame for every vault (lock, mouth and seam are frame px)", () => {
    for (const l of LOOKS) {
      const meta = SPRITES[`../../assets/sprites/${l.chest}.json`];
      expect(meta, l.chest).toBeDefined();
      expect(meta, l.chest).toMatchObject({ frames: VAULT_FRAME.frames, frameW: VAULT_FRAME.w, frameH: VAULT_FRAME.h });
    }
  });
});

describe("photosensitivity, for every vault (hard limits, the same for all)", () => {
  /** The full-screen flashes the scene fires frame by frame (VaultScene.show: at most one a frame, the last one
   *  crossed), at a steady `dt` or with a 0.25 s hitch every `hitchEvery` frames. */
  function flashesByFrame(dt: number, hitchEvery = 0): number[] {
    const out: number[] = [];
    let prev = -1e-6;
    for (let n = 1, t = 0; t <= VAULT_OPENING_SECONDS + 0.5; n++) {
      t = hitchEvery && n % hitchEvery === 0 ? t + 0.25 : t + dt;
      if (flashCrossed(prev, t) !== null) out.push(t);
      prev = t;
    }
    return out;
  }

  it.each(LOOKS.map((l) => [l.id, l] as const))("%s: no look carries a flash, a kick or a throb — its chaos is counts and density only", (_, look) => {
    // a new knob here that could flash (a kick time, a flash, a light amplitude) must not be added: those are global
    expect(Object.keys(look.chaos).sort()).toEqual(["burstsPerKick", "rain", "shimmer", "sparks", "stream"]);
    expect(Object.keys(look.light).sort()).toEqual(["glow", "impactFlash", "open", "seam", "shaft", "starburst", "tremble"]);
  });

  it.each(LOOKS.map((l) => [l.id] as const))("%s: at most 3 full-screen flashes in any second, at any frame rate and through hitches", () => {
    for (const [dt, hitch] of [
      [1 / 30, 0],
      [1 / 60, 0],
      [1 / 144, 0],
      [1 / 60, 7],
    ] as const) {
      const f = flashesByFrame(dt, hitch);
      expect(f.length).toBeGreaterThan(0);
      for (const from of f) expect(f.filter((x) => x >= from && x < from + 1).length, `${dt} ${hitch} at ${from}`).toBeLessThanOrEqual(3);
    }
  });

  it.each(LOOKS.map((l) => [l.id] as const))("%s: every light that throbs on the beat changes by less than 0.1", () => {
    // a tint only colours a light (each channel ≤ 1), so it never raises a throb above its alpha amplitude
    for (const [name, a] of Object.entries(BEAT_LIGHT_AMPLITUDES)) expect(a, name).toBeLessThan(0.1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

  Run: `npx vitest run src/modules/casecremental/fx/vault/vaultLooks.test.ts`

  Expected: FAIL with "Failed to resolve import ./vaultLooks".

- [ ] **Step 3: Implement.** Create `fx/vault/vaultLooks.ts`:
```ts
import type { VaultDef } from "../../sim/content/vaults";
import type { FanfareId } from "../audio/sounds";

// How each vault looks and sounds (spec M3 §7): the same last-chance ticket on the same 17.4 s timeline,
// parametrised by the run's VaultDef — the chest's art, the beams' colours, the light's tints, the fanfare and how
// dense the chaos is. Each vault is wilder than the last through count and density only: more firework bursts on
// the same kicks, twin items on the beams' streams, more rain and edge sparks. Nothing here can touch the flash
// schedule (chaosPlan FLASHES, from VAULT_CUES.fireworks) or the beat-throb amplitudes (beat.ts
// BEAT_LIGHT_AMPLITUDES): those are the photosensitivity limits, the same for every vault. Vault I's entry is
// exactly the look it had before M3.

export type VaultId = VaultDef["id"];

/** The vault's light: colours only (each light's alpha and throb are global). */
export interface VaultLight {
  /** The impact's full-screen flash (pale: never a saturated red). */
  impactFlash: number;
  /** The rotating starburst once the lid is open, the impact's vertical shaft, the soft glow behind the beams. */
  starburst: number;
  shaft: number;
  glow: number;
  /** The chest: its glow while it trembles in the intro, the seam's line, its glow and inner light once open. */
  tremble: number;
  seam: number;
  open: number;
}

/** How wild the vault's chaos is: counts and densities against Vault I's, nothing else. */
export interface VaultChaosLook {
  /** Firework bursts on each kick (VAULT_CUES.fireworks keeps its 14 kicks, their sound and their flashes). */
  burstsPerKick: number;
  /** Items per slot on a beam's stream: 1 is one an item, 2 gives every item a twin half a step out (beamStream). */
  stream: number;
  /** Rain sprites and edge sparks, × Vault I's (96 and 2 × 22). */
  rain: number;
  sparks: number;
  /** The beams' shimmer: a tint swinging over hues from..from+span (turns), at this saturation at full chaos. */
  shimmer: { from: number; span: number; sat: number };
}

export interface VaultLook {
  id: VaultId;
  /** The chest's sprite sheet: 4 frames of VAULT_FRAME (closed, seam lit, snapping, open). */
  chest: string;
  /** The five beams' colours, left to right (symmetric). */
  palette: readonly [number, number, number, number, number];
  light: VaultLight;
  fanfare: FanfareId;
  chaos: VaultChaosLook;
}

/** The densest any vault gets (× Vault I): the chaos's and the beams' pools are sized for it once. */
export const MAX_DENSITY = 2;

export const VAULT_LOOKS: Readonly<Record<VaultId, VaultLook>> = {
  vault1: {
    id: "vault1",
    chest: "vault-case",
    palette: [0xffd23c, 0xff8a1e, 0xe8362a, 0xff8a1e, 0xffd23c], // yellow, orange, red, orange, yellow
    light: { impactFlash: 0xfff2c0, starburst: 0xffe08a, shaft: 0xfff2c0, glow: 0xffd34d, tremble: 0xffb040, seam: 0xffd34d, open: 0xffd34d },
    fanfare: "vault-fanfare",
    chaos: { burstsPerKick: 2, stream: 1, rain: 1, sparks: 1, shimmer: { from: 0.02, span: 0.06, sat: 0.35 } },
  },
  vault2: {
    id: "vault2",
    chest: "vault-case-2", // chrome with neon seams
    palette: [0x3ce8ff, 0xff3cd2, 0x8a3cff, 0xff3cd2, 0x3ce8ff], // cyan, magenta, violet, magenta, cyan
    light: { impactFlash: 0xe8fbff, starburst: 0xd8b0ff, shaft: 0xe8fbff, glow: 0x7ff7ff, tremble: 0xff6ae6, seam: 0x7ff7ff, open: 0xff6ae6 },
    fanfare: "vault-fanfare-2",
    chaos: { burstsPerKick: 3, stream: 1.5, rain: 1.5, sparks: 1.5, shimmer: { from: 0.78, span: 0.1, sat: 0.3 } },
  },
  vault3: {
    id: "vault3",
    chest: "vault-case-3", // obsidian with molten seams
    palette: [0xfff0b0, 0xff8a1e, 0x3c7bff, 0xff8a1e, 0xfff0b0], // white-gold, orange, blue, orange, white-gold
    light: { impactFlash: 0xfff8e0, starburst: 0xfff0c0, shaft: 0xffffff, glow: 0xffa040, tremble: 0xff6a00, seam: 0xff8a1e, open: 0xffb347 },
    fanfare: "vault-fanfare-3",
    chaos: { burstsPerKick: 4, stream: 2, rain: 2, sparks: 2, shimmer: { from: 0.08, span: 0.05, sat: 0.2 } },
  },
};

export const vaultLook = (id: VaultId): VaultLook => VAULT_LOOKS[id];
```

- [ ] **Step 4: Run the test to verify it passes.**

  Run: `npx vitest run src/modules/casecremental/fx/vault/vaultLooks.test.ts`

  Expected: PASS.

  If **only** the sprite-sheet test fails on `frameW`:
  1. M3-C's sheet came out wider than 68 (the build makes it `max(68, widest + 6)`). Add `"cellW": 68` to that
     sheet's entry in `art/manifest.json` (next to `"targetH": 64`) and run `npm run art`.
  2. Read `art/preview/vault-case-2.png` (and `-3`). Check that no frame is clipped and that the closed frame's body
     sits where `vault-case`'s does: centred on x 34.5, lock at about (35, 64), mouth at y 52, seam at y 59.
  3. If the art is clipped or offset, stop and report it (M3-C re-cuts the source). Do not move the chest
     constants: they are Vault I's.

  Then run `npm run typecheck && npx vitest run src/modules/casecremental && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/modules/casecremental/fx/vault/vaultLooks.ts src/modules/casecremental/fx/vault/vaultLooks.test.ts
# only if Step 4 needed the cellW fix:
# git add art/manifest.json src/modules/casecremental/assets/sprites/vault-case-2.json src/modules/casecremental/assets/sprites/vault-case-2.png src/modules/casecremental/assets/sprites/vault-case-3.json src/modules/casecremental/assets/sprites/vault-case-3.png
git commit -m "feat(vault): a look per vault - chest, beams, light, fanfare, chaos density; photosensitivity tested for every vault

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 3: The chest and the light take the vault's look

**Files:**
- Modify: `fx/vault/chest.ts` (`Chest` constructor, `setLook`, `light()`)
- Modify: `fx/vault/rays.ts` (`Rays` constructor, `setLight`, `update`)
- Test: `fx/vault/chest.test.ts`

**Interfaces:**
- Consumes: `VAULT_LOOKS`, `type VaultLight` (Task 2).
- Produces:
```ts
// chest.ts
constructor(frames: readonly Texture[], soft: Texture, light?: VaultLight); // default VAULT_LOOKS.vault1.light
Chest.setLook(frames: readonly Texture[], light: VaultLight): void;
// rays.ts
constructor(soft: Texture, light?: VaultLight); // default VAULT_LOOKS.vault1.light
Rays.setLight(light: VaultLight): void;
```

- [ ] **Step 1: Write the failing tests.** Append to `fx/vault/chest.test.ts` (merge the imports: add
  `Texture, TextureSource` from `pixi.js`, `Chest` from `./chest`, `vaultCues` from `./cues`, `vaultLayout` from
  `./vaultLayout`, and `VAULT_LOOKS, type VaultLook` from `./vaultLooks`):
```ts
const tex = (w = 68, h = 78) => new Texture({ source: new TextureSource({ width: w, height: h }) });
const sheet = () => [tex(), tex(), tex(), tex()];
const LOOKS: VaultLook[] = Object.values(VAULT_LOOKS);
const OPEN = 9; // the lid long open
const TREMBLING = 2.0; // the intro's run-up: closed, its seam lit

function chestWith(look: VaultLook, frames = sheet()) {
  const chest = new Chest(sheet(), tex(128, 128));
  chest.layout(vaultLayout({ w: 1324, h: 824 }, 4));
  chest.setLook(frames, look.light);
  return chest;
}

describe("the chest's look", () => {
  it("draws the vault's own sheet and lights once its look is set", () => {
    const frames = sheet();
    const look = VAULT_LOOKS.vault2;
    const chest = chestWith(look, frames);
    chest.update(1 / 60, 0, { t: OPEN, cues: vaultCues(OPEN), near: false, beat: 0 });
    expect(chest["sprite"].texture).toBe(frames[3]);
    expect(chest.glow.tint).toBe(look.light.open);
    expect(chest["mouthLight"].tint).toBe(look.light.open);
    chest.update(1 / 60, 0, { t: TREMBLING, cues: vaultCues(TREMBLING), near: false, beat: 0 });
    expect(chest["sprite"].texture).toBe(frames[1]);
    expect(chest.glow.tint).toBe(look.light.tremble);
  });

  it("lights Vault I as before when no look is given", () => {
    const chest = new Chest(sheet(), tex(128, 128));
    chest.layout(vaultLayout({ w: 1324, h: 824 }, 4));
    chest.update(1 / 60, 0, { t: OPEN, cues: vaultCues(OPEN), near: false, beat: 0 });
    expect(chest.glow.tint).toBe(0xffd34d);
    expect(chest["mouthLight"].tint).toBe(0xffd34d);
    chest.update(1 / 60, 0, { t: TREMBLING, cues: vaultCues(TREMBLING), near: false, beat: 0 });
    expect(chest.glow.tint).toBe(0xffb040);
  });

  it("keeps the devil's red around the waiting vault, whatever the vault", () => {
    for (const look of LOOKS) {
      const chest = chestWith(look);
      chest.update(1 / 60, 0, { t: null, cues: vaultCues(-1), near: false, beat: 0 });
      expect(chest.glow.tint, look.id).toBe(0xff2a1a);
    }
  });

  it.each(LOOKS.map((l) => [l.id, l] as const))("%s: the open chest's glow and inner light throb by less than 0.1 on the beat", (_, look) => {
    const at = (beat: number) => {
      const chest = chestWith(look);
      chest.update(1 / 60, 0, { t: OPEN, cues: vaultCues(OPEN), near: false, beat });
      return { glow: chest.glow.alpha, mouth: chest["mouthLight"].alpha };
    };
    const still = at(0);
    const hit = at(1);
    expect(Math.abs(hit.glow - still.glow)).toBeLessThan(0.1);
    expect(Math.abs(hit.mouth - still.mouth)).toBeLessThan(0.1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

  Run: `npx vitest run src/modules/casecremental/fx/vault/chest.test.ts`

  Expected: FAIL with "chest.setLook is not a function".

- [ ] **Step 3: Implement.**

  In `fx/vault/chest.ts`:
  - import `{ VAULT_LOOKS, type VaultLight } from "./vaultLooks"`;
  - delete the `GOLD` constant (keep `RED`);
  - make `frames` mutable and hold the light:
```ts
  private frames: readonly Texture[];
  private look: VaultLight;

  constructor(frames: readonly Texture[], soft: Texture, light: VaultLight = VAULT_LOOKS.vault1.light) {
    this.frames = frames;
    this.look = light;
    this.sprite = new Sprite({ texture: frames[0], anchor: { x: MID_X / VAULT_FRAME.w, y: 1 } });
    this.glow = new Sprite({ texture: soft, anchor: 0.5, blendMode: "add", alpha: 0 });
    this.mouthLight = new Sprite({ texture: soft, anchor: 0.5, blendMode: "add", alpha: 0, tint: light.open });
    this.seam.blendMode = "add";
    this.front.addChild(this.sprite, this.seam, this.mouthLight);
  }

  /** The run's vault: its sheet (same frame, same lock, mouth and seam) and its light. */
  setLook(frames: readonly Texture[], light: VaultLight): void {
    this.frames = frames;
    this.look = light;
    this.sprite.texture = frames[0]!;
    this.mouthLight.tint = light.open;
  }
```
  In `light()`:
  - replace `this.glow.tint = 0xffb040;` with `this.glow.tint = this.look.tremble;`;
  - replace the open branch's `this.glow.tint = GOLD;` with `this.glow.tint = this.look.open;`;
  - replace the seam's `.fill({ color: GOLD })` with `.fill({ color: this.look.seam })`;
  - in the doc comment above `light()`, replace "gold once it is open" with "its vault's light once it is open".

  In `fx/vault/rays.ts`:
  - import `{ VAULT_LOOKS, type VaultLight } from "./vaultLooks"`;
  - add the field `private light: VaultLight;`;
  - change the constructor to `constructor(soft: Texture, light: VaultLight = VAULT_LOOKS.vault1.light)`;
  - create the shaft and the glow without their tints (`tint: 0xfff2c0` and `tint: 0xffd34d` removed) and end the
    constructor with `this.light = light; this.setLight(light);`;
  - add:
```ts
  /** The run's vault's tints (the alphas are global: raysLight). */
  setLight(light: VaultLight): void {
    this.light = light;
    this.shaft.tint = light.shaft;
    this.glow.tint = light.glow;
  }
```
  - in `update`, replace `this.starburst.tint = 0xffe08a;` with `this.starburst.tint = this.light.starburst;` (the
    waiting red `0xff3020` stays).

  TypeScript's definite-assignment check needs `this.light` set before `setLight` reads it, which is why the
  constructor assigns it first.

- [ ] **Step 4: Run the tests to verify they pass.**

  Run: `npx vitest run src/modules/casecremental/fx/vault/chest.test.ts src/modules/casecremental/fx/vault/rays.test.ts`

  Expected: PASS.

  Then run `npm run typecheck && npx vitest run src/modules/casecremental && npm run build`. Expected: PASS.
  VaultScene still builds both with the default Vault I light.

- [ ] **Step 5: Commit**
```bash
git add src/modules/casecremental/fx/vault/chest.ts src/modules/casecremental/fx/vault/chest.test.ts src/modules/casecremental/fx/vault/rays.ts
git commit -m "feat(vault): the chest and the light take the vault's sheet and tints (Vault I's by default)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 4: A wilder chaos — kick bursts, rain, edge sparks, shimmer

**Why no new kicks:** each kick time in `VAULT_CUES.fireworks` (14 on the 120 BPM clock) brings four things:
- a `firework` sound over the fanfare;
- the zoom punch (`kickPulse`);
- the shake;
- a full-screen flash (`chaosPlan` builds `FLASHES` from the kick times, capped at 3 a second).

Densifying that schedule would stay beat-locked, but it would add flashes (up to the cap) and more kick sounds.
So the schedule stays, and a wilder vault gets more bursts on each kick, spread to other spots on screen. Bursts are
particles in the sky layer: no `hd.flash`, no sound, no punch.

**Files:**
- Modify: `fx/vault/bursts.ts` (add `kickBursts`)
- Modify: `fx/vault/chaos.ts` (constructor, `setLook`, `rainAt`, `edgeSparks`, `backdropLook`, exported helpers)
- Test: `fx/vault/bursts.test.ts`, `fx/vault/chaos.test.ts`

**Interfaces:**
- Consumes: `VAULT_LOOKS`, `MAX_DENSITY`, `type VaultChaosLook` (Task 2).
- Produces:
```ts
// bursts.ts
export function kickBursts(index: number, n: number, screen: { w: number; h: number }, random?: () => number): Pt[];
// chaos.ts
export const RAIN = 96; export const EDGE_SPARKS = 22;
export const rainCount: (look: Pick<VaultChaosLook, "rain">) => number;
export const sparkCount: (look: Pick<VaultChaosLook, "sparks">) => number;
export const rainShow: (level: number, count: number, i: number) => number;
export const sparkSide: (i: number) => 1 | -1;
export function shimmerTint(t: number, hue: number, s: VaultChaosLook["shimmer"]): number;
constructor(art: ChaosArt, look?: VaultChaosLook); // default VAULT_LOOKS.vault1.chaos
VaultChaos.setLook(look: VaultChaosLook): void;
```

- [ ] **Step 1: Write the failing tests.**

  In `fx/vault/bursts.test.ts` (add `kickBursts` to the import from `./bursts`):
```ts
describe("a kick's bursts", () => {
  const inside = (p: { x: number; y: number }) => p.x > 0 && p.x < screen.w && p.y > 0 && p.y < screen.h;

  it("bursts twice on the kick's own spot on Vault I, as before", () => {
    for (let index = 0; index < 14; index++)
      expect(kickBursts(index, 2, screen, still)).toEqual([kickSpot(index, screen, still), kickSpot(index, screen, still)]);
  });

  it("adds bursts on spots of their own on a wilder vault, every one on screen", () => {
    for (let index = 0; index < 14; index++)
      for (const n of [3, 4]) {
        const pts = kickBursts(index, n, screen, still);
        expect(pts).toHaveLength(n);
        expect(pts[0]).toEqual(kickSpot(index, screen, still));
        expect(pts[1]).toEqual(pts[0]);
        expect(new Set(pts.slice(1).map((p) => `${p.x},${p.y}`)).size, `kick ${index}, ${n} bursts`).toBe(n - 1);
        for (const p of pts) expect(inside(p), `kick ${index}`).toBe(true);
      }
  });
});
```
  In `fx/vault/chaos.test.ts` (extend the import from `./chaos` with
  `EDGE_SPARKS, RAIN, rainCount, rainShow, shimmerTint, sparkCount, sparkSide`, and import
  `MAX_DENSITY, VAULT_LOOKS` from `./vaultLooks`):
```ts
describe("the chaos per vault", () => {
  const I = VAULT_LOOKS.vault1.chaos;
  const ALL = [VAULT_LOOKS.vault1, VAULT_LOOKS.vault2, VAULT_LOOKS.vault3].map((l) => l.chaos);

  it("rains, sparks and shimmers on Vault I exactly as before", () => {
    expect(rainCount(I)).toBe(96);
    expect(sparkCount(I)).toBe(44);
    for (let i = 0; i < 44; i++) expect(sparkSide(i), `spark ${i}`).toBe(i < 22 ? 1 : -1);
    for (const level of [0, 0.3, 0.75, 1])
      for (let i = 0; i < 96; i++) expect(rainShow(level, 96, i)).toBe(Math.min(1, Math.max(0, level * 96 - i)));
    for (let t = 3.4; t < 17.4; t += 0.13)
      for (const hue of [0, 0.5, 1])
        expect(shimmerTint(t, hue, I.shimmer)).toBe(hsv(0.02 + 0.06 * (0.5 + 0.5 * Math.sin(t * 5.3)), 0.35 * hue, 1));
  });

  it("rains and sparks more on each wilder vault, both edges alike, within the pools", () => {
    for (let n = 1; n < ALL.length; n++) {
      expect(rainCount(ALL[n]!)).toBeGreaterThan(rainCount(ALL[n - 1]!));
      expect(sparkCount(ALL[n]!)).toBeGreaterThan(sparkCount(ALL[n - 1]!));
    }
    for (const c of ALL) {
      expect(rainCount(c)).toBeLessThanOrEqual(RAIN * MAX_DENSITY);
      expect(sparkCount(c)).toBeLessThanOrEqual(2 * EDGE_SPARKS * MAX_DENSITY);
      const sides = Array.from({ length: sparkCount(c) }, (_, i) => sparkSide(i));
      const left = sides.filter((s) => s === 1).length;
      expect(Math.abs(left - (sides.length - left))).toBeLessThanOrEqual(1);
      for (let i = rainCount(c); i < RAIN * MAX_DENSITY; i++) expect(rainShow(1, rainCount(c), i)).toBe(0); // the rest of the pool stays dry
    }
  });

  it("shimmers each vault's beams in hues of its own", () => {
    const at = (look: (typeof ALL)[number]) => shimmerTint(5.1, 1, look.shimmer);
    expect(new Set(ALL.map(at)).size).toBe(3);
    for (const c of ALL) expect(shimmerTint(5.1, 0, c.shimmer)).toBe(0xffffff); // no chaos, no tint
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

  Run: `npx vitest run src/modules/casecremental/fx/vault/bursts.test.ts src/modules/casecremental/fx/vault/chaos.test.ts`

  Expected: FAIL. `kickBursts`, `rainCount` and the other new names are not exported.

- [ ] **Step 3: Implement.**

  In `fx/vault/bursts.ts`, after `introSpot`:
```ts
/** How far along the spots a wilder vault's extra bursts on a kick go: across the screen from the kick's own. */
const EXTRA_STEPS = [5, 3, 7] as const;

/** Kick `index`'s bursts on a `screen` (screen px): `n` of them (vaultLooks burstsPerKick). The first two on the
 *  kick's own spot, as Vault I has always burst; any more each on a spot of its own across the screen. Points only:
 *  a burst is particles, never a flash or a sound (the kick plays its one sound). */
export function kickBursts(index: number, n: number, screen: { w: number; h: number }, random = Math.random): Pt[] {
  const own = kickSpot(index, screen, random);
  const out: Pt[] = n >= 2 ? [own, own] : n === 1 ? [own] : [];
  for (let e = 0; out.length < n; e++) out.push(kickSpot(index + EXTRA_STEPS[e % EXTRA_STEPS.length]!, screen, random));
  return out;
}
```
  In `fx/vault/chaos.ts`:
  - import `{ MAX_DENSITY, VAULT_LOOKS, type VaultChaosLook } from "./vaultLooks"`;
  - export `RAIN` and `EDGE_SPARKS` (`export const RAIN = 96;`, `export const EDGE_SPARKS = 22;`) and add the helpers
    under `rnd`:
```ts
/** Rain sprites showing on a vault: Vault I's 96, more on a wilder one. */
export const rainCount = (look: Pick<VaultChaosLook, "rain">): number => Math.round(RAIN * look.rain);
/** Edge sparks on each bar, both edges together: Vault I's 2 × 22, more on a wilder one. */
export const sparkCount = (look: Pick<VaultChaosLook, "sparks">): number => Math.round(2 * EDGE_SPARKS * look.sparks);
/** How much of rain sprite i shows at the rain's level (0-1) with `count` raining: they join in order as it builds,
 *  and the pool past `count` stays dry. */
export const rainShow = (level: number, count: number, i: number): number => clamp01(level * count - i);
/** Edge spark i's side (1 sprays right from the left edge, -1 left from the right): Vault I's 22 a side, then a
 *  wilder vault's extras alternating. */
export const sparkSide = (i: number): 1 | -1 => (i < 2 * EDGE_SPARKS ? (i < EDGE_SPARKS ? 1 : -1) : i % 2 ? -1 : 1);
/** The beams' shimmer at sim time t: a tint swinging over the vault's hues, as strong as the chaos's hue level. */
export function shimmerTint(t: number, hue: number, s: VaultChaosLook["shimmer"]): number {
  return hsv(s.from + s.span * (0.5 + 0.5 * Math.sin(t * 5.3)), s.sat * hue, 1);
}
```
  - in the class add `private look: VaultChaosLook;`, change the constructor to
    `constructor(private readonly art: ChaosArt, look: VaultChaosLook = VAULT_LOOKS.vault1.chaos)` and set
    `this.look = look;` at its top;
  - size the pools for the densest vault:
```ts
    for (let i = 0; i < RAIN * MAX_DENSITY; i++)
      this.drops.push(this.pooled(i % 3 === 0 ? art.coins[0]! : i % 3 === 1 ? art.star : Texture.WHITE, this.rain));
    for (let i = 0; i < 2 * EDGE_SPARKS * MAX_DENSITY; i++) {
      const s = this.pooled(i % 2 ? art.star : art.dot, this.rain);
      s.blendMode = "add";
      this.sparks.push(s);
    }
```
  - add:
```ts
  /** The run's vault's chaos: how much it rains and sparks, and its beams' shimmer (the pools hold the densest). */
  setLook(look: VaultChaosLook): void {
    this.look = look;
  }
```
  - in `backdropLook`, replace the shimmer line with `this.shimmer = shimmerTint(t, L.hue, this.look.shimmer);` and
    its comment with `// the beams shimmer within their vault's hues (Vault I: yellow leans orange, orange red)`;
  - in `rainAt`:
```ts
    const count = rainCount(this.look);
    for (let i = 0; i < this.drops.length; i++) {
      const s = this.drops[i]!;
      if (i >= count) {
        s.visible = false;
        continue;
      }
      const kind = i % 3;
      // … unchanged down to …
      const show = rainShow(level, count, i);
```
    (only the loop bound, the early `continue` and the `show` line change);
  - in `edgeSparks`:
```ts
    const shown = sparkCount(this.look);
    for (let i = 0; i < this.sparks.length; i++) {
      const s = this.sparks[i]!;
      s.visible = live && i < shown;
      if (!s.visible) continue;
      const side = sparkSide(i); // the left edge sprays right, the right edge left
```
    (the rest of the loop is unchanged).

  Vault I's frames are unchanged:
  - the first 96 rain sprites and the first 44 sparks keep their indices, textures, sides and hashes;
  - sprites past Vault I's counts never show.

- [ ] **Step 4: Run the tests to verify they pass.**

  Run: `npx vitest run src/modules/casecremental/fx/vault/bursts.test.ts src/modules/casecremental/fx/vault/chaos.test.ts`

  Expected: PASS.

  Then run `npm run typecheck && npx vitest run src/modules/casecremental && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/modules/casecremental/fx/vault/bursts.ts src/modules/casecremental/fx/vault/bursts.test.ts src/modules/casecremental/fx/vault/chaos.ts src/modules/casecremental/fx/vault/chaos.test.ts
git commit -m "feat(vault): a wilder chaos by count - more bursts on the same kicks, more rain and edge sparks, the vault's shimmer

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 5: The beams — the vault's colours, its source case's filler, denser streams

**Why twins, not a tighter spacing:** `beamStream.test.ts` pins two things:
- an item moves well under half its spacing per frame at 60 fps, so the stream has no wagon-wheel;
- `STREAM_ITEMS_PER_SECOND` (20) at `STREAM_SPACING` 0.45 (0.33 of a spacing per frame).

Doubling the density by halving the spacing would give 0.67 of a spacing per frame, which breaks the first rule.
Instead, a wilder vault gives each item a twin half a step further out, on a lane of its own across the beam. Each
lane keeps the full spacing, and the beam carries 1.5× or 2× the items.

**Files:**
- Modify: `fx/vault/beamStream.ts` (add `hasTwin`, `twinJitter`, `TWIN_SKIN_SHIFT`)
- Modify: `fx/vault/beams.ts` (remove `BEAM_PALETTE` and its comment)
- Modify: `fx/vault/beams.test.ts` (the palette test reads the looks)
- Modify: `fx/vault/VaultBeams.ts` (`setVault`, layout, start, placeStream, placeItem)
- Test: `fx/vault/beamStream.test.ts`, `fx/vault/VaultBeams.test.ts`

**Interfaces:**
- Consumes:
  - `VAULTS`, `vaultFor`, `type VaultDef` (M3-A);
  - `caseById(def.sourceCase).skins`;
  - `skinById(def.legend.id)` returns the legend (M3-A);
  - `vaultLook`, `MAX_DENSITY`, `VAULT_LOOKS` (Task 2).
- Produces:
```ts
// beamStream.ts
export function hasTwin(seed: number, j: number, density: number): boolean;
export const twinJitter: (seed: number, j: number) => number; // in [-1, 1], its own lane
export const TWIN_SKIN_SHIFT = 5;
// VaultBeams.ts
VaultBeams.setVault(def: VaultDef): void; // no-op for the same id; redraws the beams' colours when laid out
```

- [ ] **Step 1: Write the failing tests.**

  In `fx/vault/beamStream.test.ts` (add `hasTwin, twinJitter` to the import):
```ts
describe("a wilder vault's twins", () => {
  it("never twins on Vault I, always at density 2, about half the items at 1.5, the same after a reload", () => {
    for (let j = -50; j < 50; j++) {
      expect(hasTwin(7, j, 1)).toBe(false);
      expect(hasTwin(7, j, 2)).toBe(true);
      expect(hasTwin(7, j, 1.5)).toBe(hasTwin(7, j, 1.5));
    }
    const share = Array.from({ length: 2000 }, (_, j) => hasTwin(12345, j, 1.5)).filter(Boolean).length / 2000;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
  });

  it("puts a twin on a lane of its own across the beam", () => {
    const xs = Array.from({ length: 500 }, (_, j) => twinJitter(99, j));
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(-1);
      expect(x).toBeLessThanOrEqual(1);
    }
    expect(xs.filter((x, j) => Math.abs(x - itemJitter(99, j)) < 1e-9)).toHaveLength(0);
  });
});
```
  In `fx/vault/beams.test.ts`:
  - drop `BEAM_PALETTE` from the import from `./beams`;
  - add `import { VAULT_LOOKS } from "./vaultLooks";`;
  - replace the first test with:
```ts
  it("has a palette per vault and angles for five beams", () => {
    for (const look of Object.values(VAULT_LOOKS)) expect(look.palette, look.id).toHaveLength(5);
    expect(BEAM_ANGLES_LANDSCAPE).toHaveLength(5);
    expect(BEAM_ANGLES_PORTRAIT).toHaveLength(5);
  });
```
  In `fx/vault/VaultBeams.test.ts`:
  - add the imports: `caseById` from `../../sim/content/cases` (replacing `CASES`), `VAULTS, type VaultDef` from
    `../../sim/content/vaults`, `drawBeam` from `./beamArt`, `beamWidthAt` from `./beamStream`, and
    `VAULT_LOOKS, vaultLook` from `./vaultLooks`;
  - change `const top = CASES[CASES.length - 1]!.skins;` to `const top = caseById("bedrock").skins;` (Vault I's
    source case);
  - add, next to the existing `vi.mock("../hd/font", …)`:
```ts
// drawBeam really draws, and the test reads which colour each beam got
vi.mock("./beamArt", async (importOriginal) => {
  const real = await importOriginal<typeof import("./beamArt")>();
  return { ...real, drawBeam: vi.fn(real.drawBeam) };
});
```
  - add:
```ts
/** A vault's opening as the sim rolls it (plan M3-A): four from its source case, its legend fifth. */
const vaultDrops = (v: VaultDef): Drop[] => [
  ...caseById(v.sourceCase)
    .skins.slice(0, 4)
    .map((s, i) => ({ id: i + 1, caseId: v.sourceCase, skinId: s.id, rarity: s.rarity, float: 0.1, wear: "MW" as const, statTrak: false, value: 1000 * (i + 1) })),
  { id: 5, caseId: v.id, skinId: v.legend.id, rarity: v.legend.rarity, float: 0.01, wear: "FN" as const, statTrak: false, value: 50_000 },
];

describe("VaultBeams per vault", () => {
  /** The colours the last five drawBeam calls gave, beam by beam. */
  const drawn = () => vi.mocked(drawBeam).mock.calls.slice(-5).map((c) => c[3]);

  it("draws the run's vault's colours, redrawn only when the vault changes", () => {
    const h = harness();
    expect(drawn()).toEqual([...VAULT_LOOKS.vault1.palette]);
    for (const v of VAULTS.slice(1)) {
      h.beams.setVault(v);
      expect(drawn(), v.id).toEqual([...vaultLook(v.id).palette]);
    }
    const calls = vi.mocked(drawBeam).mock.calls.length;
    h.beams.setVault(VAULTS[2]!); // the same vault again (the World sets it every frame)
    expect(vi.mocked(drawBeam).mock.calls.length).toBe(calls);
    h.beams.layout(h.L, pixelViewport(1324, 824).scale); // a resize keeps the vault's colours
    expect(drawn()).toEqual([...VAULT_LOOKS.vault3.palette]);
  });

  it("streams the vault's source case and lands its own legend fifth, after a reload too (Review Focus 1, 2)", () => {
    for (const v of VAULTS) {
      const h = harness();
      h.beams.setVault(v); // the World sets the vault before it restores the beams
      h.beams.restore(vaultDrops(v), 2);
      const source = caseById(v.sourceCase).skins;
      for (const lane of lanesOf(h.beams)) for (const s of lane.filler) expect(source, `${v.id} streams ${s.id}`).toContain(s);
      expect(lanesOf(h.beams)[4]!.drop).toBe(v.legend);
      expect(lanesOf(h.beams).map((l) => l.lockedAt !== null)).toEqual([true, true, false, false, false]);
    }
  });

  it("streams denser on a wilder vault", () => {
    const visible = (v: VaultDef) => {
      const h = harness();
      h.beams.setVault(v);
      h.beams.start(vaultDrops(v));
      h.beams.update(SPINNING);
      return lanesOf(h.beams).map((l) => l.pool.filter((s) => s.visible).length);
    };
    const [one, two, three] = VAULTS.map(visible);
    for (let i = 0; i < 5; i++) {
      expect(one![i]!, `beam ${i}`).toBeGreaterThan(3);
      expect(two![i]!, `beam ${i}`).toBeGreaterThan(one![i]! * 1.25);
      expect(three![i]!, `beam ${i}`).toBeGreaterThanOrEqual(one![i]! * 2 - 3);
    }
  });

  it("keeps a wilder vault's twins on their beam, each inside its width", () => {
    const h = harness();
    h.beams.setVault(VAULTS[2]!);
    h.beams.start(vaultDrops(VAULTS[2]!));
    h.beams.update(SPINNING);
    const b = h.L.beams[2]!; // the centre beam points straight up
    const shown = lanesOf(h.beams)[2]!.pool.filter((s) => s.visible);
    expect(shown.length).toBeGreaterThan(0);
    for (const s of shown) {
      const cx = s.x + (s.texture.width * s.scale.x) / 2;
      const cy = s.y + (s.texture.height * s.scale.y) / 2;
      const d = b.origin.y - cy;
      expect(Math.abs(cx - b.origin.x), `${d} px out`).toBeLessThanOrEqual(beamWidthAt(b, d) / 2 + 1);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

  Run: `npx vitest run src/modules/casecremental/fx/vault/beamStream.test.ts src/modules/casecremental/fx/vault/VaultBeams.test.ts src/modules/casecremental/fx/vault/beams.test.ts`

  Expected: FAIL. `hasTwin` is not exported, `h.beams.setVault` is not a function, and once M3-A is in, the filler
  test fails for `vault1` because today's filler is the last case.

- [ ] **Step 3: Implement.**

  In `fx/vault/beamStream.ts`, after `isCoin`:
```ts
/** The hashes' salts for a twin: whether it is there, and its own lane across the beam. */
const TWIN_SALT = 0x7a11c0de;
const TWIN_LANE_SALT = 0x3c6ef372;

/** Whether item j has a twin half a step further out on a wilder vault's beam (`density` items per slot, 1-2,
 *  vaultLooks stream): never at 1 (Vault I), always at 2, else that share of the items by a hash of the opening's
 *  seed, so a reload keeps them. Twins thicken the stream without tightening its spacing (no wagon-wheel). */
export function hasTwin(seed: number, j: number, density: number): boolean {
  if (density <= 1) return false;
  if (density >= 2) return true;
  return (itemJitter(seed ^ TWIN_SALT, j) + 1) / 2 < density - 1;
}

/** A twin's sideways offset, in [-1, 1] like itemJitter's, on a lane of its own. */
export const twinJitter = (seed: number, j: number): number => itemJitter(seed ^ TWIN_LANE_SALT, j);

/** A twin shows the filler this many skins on from its item, so neighbours differ. */
export const TWIN_SKIN_SHIFT = 5;
```
  In `fx/vault/beams.ts`, delete `BEAM_PALETTE` and its comment line (Vault I's colours live in
  `VAULT_LOOKS.vault1.palette`).

  In `fx/vault/VaultBeams.ts`:
  - imports:
    - `import { caseById, skinById } from "../../sim/content/cases";` (no `CASES`);
    - `import { vaultFor, type VaultDef } from "../../sim/content/vaults";`;
    - `import { itemDistance, type Beam } from "./beams";`;
    - add `hasTwin, twinJitter, TWIN_SKIN_SHIFT` to the `./beamStream` import;
    - `import { MAX_DENSITY, vaultLook, type VaultLook } from "./vaultLooks";`.
  - header comment: replace "Vault Case I's five reels" with "The vault's five reels"; after "the fifth (the
    animated ★) the loudest" add " — in its vault's colours, its stream as dense as its vault (vaultLooks)".
  - fields:
```ts
  /** The run's vault (the World sets it every frame and before a restore) and its look. */
  private def: VaultDef = vaultFor(1);
  private look: VaultLook = vaultLook("vault1");
```
  - `layout`: replace `drawBeam(c.body, c.core, b, BEAM_PALETTE[i] ?? GOLD, Math.max(1, k));` with
    `drawBeam(c.body, c.core, b, this.look.palette[i] ?? GOLD, Math.max(1, k));`, and the pool bound with
    `maxVisibleItems(b.length, this.spacing) * MAX_DENSITY` (its comment: "the pool grows to the beam's reach at the
    densest vault's stream here, never in a frame").
  - add after `tint`:
```ts
  /** The run's vault: its beams' colours (redrawn now when laid out), its stream's density, its filler — its source
   *  case's skins. Nothing changes for the same vault. */
  setVault(def: VaultDef): void {
    if (def.id === this.def.id) return;
    this.def = def;
    this.look = vaultLook(def.id);
    this.lanes.forEach((c, i) => {
      if (c.geo) drawBeam(c.body, c.core, c.geo, this.look.palette[i] ?? GOLD, Math.max(1, this.k));
    });
  }
```
  - `start`: replace the two `top` lines with:
```ts
    // the filler is the vault's source case's skins: never caseById on a vault drop (its case is the vault's id),
    // never "the last case" (a later run's)
    const source = caseById(this.def.sourceCase).skins;
    // bake every skin the streams can show now, at the key turn, rather than as each first flies by mid-spin
    for (const skin of source) this.skins.frames(skin);
```
    and `c.filler = this.shuffle(top);` with `c.filler = this.shuffle(source);`.
  - `placeStream`: replace the item loop (from `for (let j = from; …` to its closing brace) with:
```ts
      const density = this.look.chaos.stream;
      for (let j = from; j <= to && n < c.pool.length; j++) {
        if (j === c.target) continue;
        const d = itemDistance(pos, j, c.target, sp, b.spotDist);
        const off = (itemJitter(c.seed, j) * beamWidthAt(b, d)) / 3;
        this.placeItem(c.pool[n++]!, b, d, off, isCoin(j, c.target), c.filler[mod(j, c.filler.length)]!, t, j, fade);
        // a wilder vault's twin: half a step further out on a lane of its own (none next to the reward)
        const d2 = d + sp / 2;
        if (n < c.pool.length && d2 <= reach && j !== c.target + 1 && hasTwin(c.seed, j, density)) {
          const off2 = (twinJitter(c.seed, j) * beamWidthAt(b, d2)) / 3;
          const skin = c.filler[mod(j + TWIN_SKIN_SHIFT, c.filler.length)]!;
          this.placeItem(c.pool[n++]!, b, d2, off2, isCoin(j + 1, c.target), skin, t, j + 1, fade);
        }
      }
```
    Keep the `const dx` / `const dy` lines above the loop: the reward block below it still places the reward with
    them.
  - add under `put`:
```ts
  /** One streamed item `d` px out along beam b and `off` across it: a coin (its spin by `j`) or a filler skin. */
  private placeItem(s: Sprite, b: Beam, d: number, off: number, coin: boolean, skin: SkinDef, t: number, j: number, fade: number): void {
    if (coin) this.put(s, this.coins[mod(Math.floor(t * COIN_FPS) + j, this.coins.length)]!, this.coinScale);
    else {
      const tex = this.skins.frames(skin)[0]!;
      this.put(s, tex, iconScale(tex.width, tex.height, this.icon, this.k));
    }
    const dx = Math.sin(b.angle);
    const dy = -Math.cos(b.angle);
    // perpendicular to the beam is (-dy, dx)
    s.position.set(
      Math.round(b.origin.x + dx * d - dy * off - (s.texture.width * s.scale.x) / 2),
      Math.round(b.origin.y + dy * d + dx * off - (s.texture.height * s.scale.y) / 2),
    );
    s.alpha = fade;
  }
```

  On Vault I (`stream` 1) the loop places the same items into the same pool slots in the same order as before:
  `hasTwin` is false and nothing else in the loop changed.

- [ ] **Step 4: Run the tests to verify they pass.**

  Run: `npx vitest run src/modules/casecremental/fx/vault`

  Expected: PASS, the existing VaultBeams camera, label and lock-in tests included.

  Then run `npm run typecheck && npx vitest run src/modules/casecremental && npm run build`. Expected: PASS.

  Run `wc -l src/modules/casecremental/fx/vault/VaultBeams.ts`. Expected: ≤ 410 lines.

- [ ] **Step 5: Commit**
```bash
git add src/modules/casecremental/fx/vault/beamStream.ts src/modules/casecremental/fx/vault/beamStream.test.ts src/modules/casecremental/fx/vault/beams.ts src/modules/casecremental/fx/vault/beams.test.ts src/modules/casecremental/fx/vault/VaultBeams.ts src/modules/casecremental/fx/vault/VaultBeams.test.ts
git commit -m "feat(vault): the beams in their vault's colours, streaming its source case, denser on a wilder vault

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 6: The scene and the World follow the run's vault

**Files:**
- Modify: `fx/vault/VaultScene.ts`:
  - the header comment;
  - the constructor (lines ~87–125);
  - `show` (the impact flash);
  - `kick`;
  - a new `setVault` and a new `chestFrames`.
- Modify: `fx/World.ts`:
  - imports;
  - a new `syncVault` and a new `vaultDef`;
  - `restoreVault` (line ~208);
  - `resumeMusic` (line ~216);
  - `updateVault` (line ~317);
  - the comment on `vault` (line ~73).

**Interfaces:**
- Consumes:
  - `vaultFor`, `type VaultDef` (M3-A), and `this.controller.run.setup.run` (M3-A Task 2);
  - `vaultLook` (Task 2);
  - `Chest.setLook`, `Rays.setLight` (Task 3);
  - `VaultChaos.setLook`, `kickBursts` (Task 4);
  - `VaultBeams.setVault` (Task 5);
  - `musicPlan(…, fanfare)` (Task 1).
- Produces: `VaultScene.setVault(def: VaultDef): void` (a no-op for the same id).

There is no unit test here: `VaultScene` and `World` need a canvas (`canvasTexture`). Their parts are pinned in
Tasks 2–5, and this wiring is checked in the browser in Task 8.

- [ ] **Step 1: Implement VaultScene.**
  - imports:
    - `import type { VaultDef } from "../../sim/content/vaults";`;
    - `import { vaultLook, type VaultLook } from "./vaultLooks";`;
    - in the `./bursts` import replace `kickSpot` with `kickBursts`.
  - header comment: replace "Vault Case I takes the screen" with "The run's vault takes the screen"; after "and it
    holds." add " Each vault in its own look (vaultLooks: its chest, beams, light and chaos density), on the same
    timeline."
  - constructor: change the parameter `lib: SpriteLibrary,` to `private readonly lib: SpriteLibrary,`; add the field
    `private look: VaultLook = vaultLook("vault1");`; replace
    `const vaultFrames = lib.get("vault-case", VAULT_FRAME).frames;` with
    `const vaultFrames = this.chestFrames(this.look);`, and drop `...vaultFrames` from the `scaleMode` loop
    (`chestFrames` sets it):
```ts
    for (const f of [...keyFrames, ...coinFrames]) f.source.scaleMode = "nearest";
```
    The `Chest`, `Rays` and `VaultChaos` constructors keep their Vault I defaults (Tasks 3–4).
  - add after `slam()`:
```ts
  /** The run's vault (the World, every frame and before a restore): its chest, its light, its chaos. Nothing
   *  changes for the same vault; a new one takes over while the scene is away or waiting. */
  setVault(def: VaultDef): void {
    if (def.id === this.look.id) return;
    this.look = vaultLook(def.id);
    this.chest.setLook(this.chestFrames(this.look), this.look.light);
    this.rays.setLight(this.look.light);
    this.chaos.setLook(this.look.chaos);
  }
```
  - add a private method next to `local`:
```ts
  /** The look's chest sheet, crisp (a sheet not built yet is the magenta placeholder, never a crash). */
  private chestFrames(look: VaultLook): readonly Texture[] {
    const frames = this.lib.get(look.chest, VAULT_FRAME).frames;
    for (const f of frames) f.source.scaleMode = "nearest";
    return frames;
  }
```
  - `show`: replace `this.hd.flash(0xfff2c0, IMPACT_FLASH)` with `this.hd.flash(this.look.light.impactFlash, IMPACT_FLASH)`.
  - `kick`:
```ts
  /** Kick `index` of VAULT_CUES.fireworks: its bursts (bursts.ts kickBursts: two on its own spot, more across the
   *  screen on a wilder vault) and its one explosion — the same spots for the same kick, live or after a reload.
   *  More bursts never mean another flash or another sound: those follow the kick schedule. */
  private kick(index: number): void {
    for (const at of kickBursts(index, this.look.chaos.burstsPerKick, this.screen)) this.firework(at);
    this.audio.play("firework", { gain: 0.7, rate: 0.9 + Math.random() * 0.25 });
  }
```

- [ ] **Step 2: Implement World.**
  - imports:
    - `import { vaultFor, type VaultDef } from "../sim/content/vaults";`;
    - `import { vaultLook } from "./vault/vaultLooks";`.
  - the field comment: `/** The run's vault's scene over everything (screen px), its five reels as beams in its layers. */`.
  - add after `restoreVault`:
```ts
  /** This run's vault: Vault I in Run 1, II in Run 2, III from Run 3 on (sim/content/vaults). */
  private vaultDef(): VaultDef {
    return vaultFor(this.controller.run.setup.run);
  }

  /** The vault's look follows the run (a new run, a reload, a lobby trip): set every frame (a no-op for the same
   *  vault) and before the beams restore, so a reload mid-opening comes back in its own look. */
  private syncVault(): void {
    const def = this.vaultDef();
    this.vault.setVault(def);
    this.vaultBeams.setVault(def);
  }
```
  - `restoreVault`: first line `this.syncVault();`.
  - `resumeMusic`:
```ts
  resumeMusic(): void {
    applyMusic(this.audio, musicPlan(this.controller.run.state, this.power.phase, vaultLook(this.vaultDef().id).fanfare));
  }
```
  - `updateVault`: first line `this.syncVault();`.

- [ ] **Step 3: Verify.** Run `npm run typecheck && npx vitest run src/modules/casecremental && npm run build`.
  Expected: PASS. Then run `wc -l src/modules/casecremental/fx/vault/VaultScene.ts src/modules/casecremental/fx/World.ts`.
  Expected: VaultScene ≤ 427 lines, World ≤ 541 lines.

- [ ] **Step 4: Commit**
```bash
git add src/modules/casecremental/fx/vault/VaultScene.ts src/modules/casecremental/fx/World.ts
git commit -m "feat(vault): the scene and the World follow the run's vault - its chest, light, chaos, bursts and fanfare, set before a restore

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 7: The prestige screen names the vault that opened

Today the screen says "VAULT I OPENED" and "★ Vault I trophy" after any vault. The shelf and the HUD already name
the vault by `view.vault.id` (M3-A Task 3). The prestige screen still shows the run that just ended, so
`view.vault.id` is the vault that opened.

If Plan M3-D also edits `Prestige.tsx` (its next-run lines), keep both: this task touches only the title, the
aria-label, the trophy line and the props.

**Files:**
- Modify: `ui/prestigeRules.ts` (add `vaultNumeral`)
- Modify: `ui/Prestige.tsx` (a `vault` prop; the title, the aria-label and the trophy line)
- Modify: `ui/GamePanel.tsx:104` (pass `vault={view.vault.id}`)
- Modify: `i18n/en.ts`, `i18n/ru.ts` (`prestige.title`, `prestige.trophy`)
- Test: `ui/prestigeRules.test.ts`

**Interfaces:**
- Consumes: `GameView.vault.id: VaultDef["id"]` (M3-A Task 3); `VAULTS` (M3-A).
- Produces: `vaultNumeral(id: VaultDef["id"]): "I" | "II" | "III"`; `Prestige` props
  `{ p: PrestigeView; vault: VaultDef["id"]; act; onSettings }`.

- [ ] **Step 1: Write the failing test.** In `ui/prestigeRules.test.ts`:
  - add `vaultNumeral` to the `./prestigeRules` import;
  - add `import { VAULTS } from "../sim/content/vaults";` and `import { setLang, t } from "../i18n/index";`;
  - add inside `describe("the prestige screen", …)`:
```ts
  it("names the vault that just opened, in both languages", () => {
    expect(VAULTS.map((v) => vaultNumeral(v.id))).toEqual(["I", "II", "III"]);
    try {
      setLang("en");
      expect(t("prestige.title", { n: vaultNumeral("vault1") })).toBe("VAULT I OPENED");
      expect(t("prestige.title", { n: vaultNumeral("vault3") })).toBe("VAULT III OPENED");
      expect(t("prestige.trophy", { n: vaultNumeral("vault2") })).toBe("★ Vault II trophy");
      setLang("ru");
      expect(t("prestige.title", { n: vaultNumeral("vault2") })).toBe("СЕЙФ II ВСКРЫТ");
      expect(t("prestige.trophy", { n: vaultNumeral("vault3") })).toBe("★ Трофей «Сейф III»");
    } finally {
      setLang("en");
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails.**

  Run: `npx vitest run src/modules/casecremental/ui/prestigeRules.test.ts`

  Expected: FAIL. `vaultNumeral` is not exported, and the title has no `{n}`.

- [ ] **Step 3: Implement.**
  - `ui/prestigeRules.ts`:
```ts
import type { VaultDef } from "../sim/content/vaults";

const NUMERALS = { vault1: "I", vault2: "II", vault3: "III" } as const;

/** The vault's number on the prestige screen ("VAULT II OPENED", "★ Vault II trophy"). */
export const vaultNumeral = (id: VaultDef["id"]): (typeof NUMERALS)[VaultDef["id"]] => NUMERALS[id];
```
  - `i18n/en.ts`: `"prestige.title": "VAULT {n} OPENED",` and `"prestige.trophy": "★ Vault {n} trophy",`.
  - `i18n/ru.ts`: `"prestige.title": "СЕЙФ {n} ВСКРЫТ",` and `"prestige.trophy": "★ Трофей «Сейф {n}»",`.
  - `ui/Prestige.tsx`:
    - add `vaultNumeral` to the `./prestigeRules` import and `import type { VaultDef } from "../sim/content/vaults";`;
    - change the header comment's "the Vault I trophy" to "the opened vault's trophy";
    - change the signature to
      `export function Prestige({ p, vault, act, onSettings }: { p: PrestigeView; vault: VaultDef["id"]; act: Act; onSettings: () => void }): ReactNode {`;
    - add `const n = vaultNumeral(vault);` at its top;
    - use `t("prestige.title", { n })` in the `aria-label` and the `.cc-title` div;
    - use `t("prestige.trophy", { n })` in the trophy div.
  - `ui/GamePanel.tsx` line 104:
    `<Prestige p={view.prestige} vault={view.vault.id} act={act} onSettings={openSettings} />`.

- [ ] **Step 4: Run the tests to verify they pass.**

  Run: `npx vitest run src/modules/casecremental/ui src/modules/casecremental/i18n`

  Expected: PASS, including the budgets: "VAULT  OPENED" is measured without its placeholder, ≤ 24.

  Then run `npm run typecheck && npx vitest run src/modules/casecremental && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/modules/casecremental/ui/prestigeRules.ts src/modules/casecremental/ui/prestigeRules.test.ts src/modules/casecremental/ui/Prestige.tsx src/modules/casecremental/ui/GamePanel.tsx src/modules/casecremental/i18n/en.ts src/modules/casecremental/i18n/ru.ts
git commit -m "feat(prestige): the screen names the vault that opened - VAULT II OPENED, the Vault II trophy

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 8: Play Vaults II and III in the browser; the feature history

The browser tab is muted under automation. Check the audio by measurement and timing. The user checks it by ear
later: say so in the report.

**Files:**
- Modify: `docs/feature-history/casecremental-run1.md` (one bullet under "Decisions worth knowing")

- [ ] **Step 1: Measure the fanfares (no browser).**
```bash
for f in vault-fanfare-1 vault-fanfare-2 vault-fanfare-3; do ffprobe -v error -show_entries format=duration -of csv=p=0 src/modules/casecremental/assets/audio/$f.mp3; ffmpeg -hide_banner -i src/modules/casecremental/assets/audio/$f.mp3 -af volumedetect -f null - 2>&1 | grep mean_volume; done
```
  Expected:
  - every duration is 13.8 ± 0.05 s;
  - mean volumes are within 1 dB of `vault-fanfare-1`'s, which justifies `TRACK_GAIN` 1.5 for all three.

  Write the numbers down for the report.

- [ ] **Step 2: Start the game and back up the player's save.**
  1. Run `npm run dev` in the background (port 5180).
  2. Load the Chrome tools in one ToolSearch call: `tabs_context_mcp`, `tabs_create_mcp`, `navigate`, `computer`,
     `read_page`, `javascript_tool`, `read_console_messages`, `resize_window`.
  3. Open `http://localhost:5180` in a new tab and sign in as the dev environment does.
  4. In the page, back up the save:
     `localStorage.setItem("casecremental.save.m3e-backup", localStorage.getItem("casecremental.save") ?? "")`.

- [ ] **Step 3: Vault II end to end.**
  1. Settings (dev) → RUN 2 (`devStartRun(2)`).
  2. Press +CASH until the vault price is reachable; unlock the five Run 2 cases on the shelf (the vault shows only
     when all are unlocked).
  3. Check that the shelf and the HUD say "Vault Case II".
  4. Buy it, wait for the slam, then tap the devil key (a tap in the lock turns it).
  5. Take screenshots at about these times after the key turn:
     - 1.5 s: the `vault-case-2` chrome/neon chest jolting on the intro's hits, the seam cyan;
     - 3.6 s: the impact with one pale flash, the lid open;
     - 5.5 s: cyan/magenta/violet beams with a visibly denser stream than Vault I's, more rain, three bursts a
       kick;
     - 11 s: the fifth reward is **Overdrive** (animated hueflow + flip) with its label and the halo;
     - 13 s: the total;
     - after the blackout: the prestige screen says "VAULT II OPENED" and "★ Vault II trophy".
  6. Note any frame where a reward or label is covered.
  7. Timing: read `JSON.parse(localStorage.getItem("casecremental.save")).run.state.vault?.t` at two moments
     against the wall clock. Expected: it advances in real time, so the fanfare, which follows `t − 3.40`, stays in
     step.

- [ ] **Step 4: Vault II, reload mid-opening.**
  1. Start Run 2 again (dev RUN 2), buy and turn the key again, then reload the page at about 7 s (between the
     second and third lock-ins).
  2. Expected after the reload:
     - the opening resumes at the same moment;
     - the beams are cyan/magenta/violet from the first frame (never yellow), and the two landed beams rest on their
       rewards with labels;
     - no beat replays: no impact flash, no burst of chimes;
     - the third lock-in lands on its time.
  3. Read the console. Expected: no errors and no `sprite "vault-case-2" not built` warning.

- [ ] **Step 5: Vault III end to end, with a reload in the intro.**
  1. Settings (dev) → RUN 3; +CASH; unlock the seven cases. Check the shelf and the HUD say "Vault Case III".
  2. Buy, turn the key, and reload at about 2 s (in the intro's run-up).
  3. Expected after the reload:
     - the obsidian/molten `vault-case-3` chest picks the intro up where it was;
     - the lid snaps at 3.40;
     - the beams are white-gold/orange/blue, the densest stream, four bursts a kick;
     - the fifth reward is **Supernova**;
     - the prestige screen says "VAULT III OPENED".
  4. Measure the frame time during the count-up volley (11.4–12.2 s) with a `requestAnimationFrame` sampler in
     `javascript_tool`:
```js
await new Promise(r => { const d = []; let last = performance.now(); const f = (n) => { d.push(n - last); last = n; d.length < 120 ? requestAnimationFrame(f) : r(d); }; requestAnimationFrame(f); }).then(d => { d.sort((a, b) => a - b); return { p50: d[60], p95: d[114], max: d[119] }; })
```
     Expected on a desktop: p95 under ~25 ms. Report the numbers.
  5. Also take one screenshot in portrait (`resize_window` 390×844) mid-spin. Expected: the chest and all five
     beams fit, labels clear of each other.

- [ ] **Step 6: Vault I unchanged.**
  1. Settings → Reset progress (dev), or `devStartRun(1)`.
  2. Buy Vault I with +CASH and watch one opening. Expected: the yellow/orange/red beams, Bedrock skins in the
     stream, Event Horizon fifth, two bursts a kick, as before.
  3. The console is clean.

- [ ] **Step 7: Restore the player's save.**
  1. Run
     `localStorage.setItem("casecremental.save", localStorage.getItem("casecremental.save.m3e-backup")); localStorage.removeItem("casecremental.save.m3e-backup")`
     (if the backup was `""`, remove `casecremental.save` instead).
  2. Reload, and check that the game shows the player's own run.
  3. Stop the dev server.

- [ ] **Step 8: The feature history.** Add this bullet to `docs/feature-history/casecremental-run1.md` under
  "Decisions worth knowing", after the "The vault is chaos on purpose" bullet:
```markdown
- **Vaults II and III (plan M3-E)** are the same ticket and timeline in their own look: one table,
  `fx/vault/vaultLooks.ts`, keyed by the run's `VaultDef` id (`vaultFor(setup.run)`):
  - what it holds: the chest sheet, the beam palette (II cyan/magenta/violet, III white-gold/orange/blue), the light
    tints, the fanfare (`vault-fanfare-2`/`-3`, Vault I's re-cut +2/+4 semitones, played at its `TRACK_GAIN`) and
    the chaos density;
  - how each vault is wilder, by count and density only:
    - 2/3/4 firework bursts on the same 14 kicks. More kicks would have added full-screen flashes and kick sounds:
      the flash schedule is built from the kick times;
    - twin items on the beams, 1/1.5/2 per slot. A tighter spacing would break the < half-a-spacing-per-frame rule;
    - rain and edge sparks ×1/1.5/2;
  - photosensitivity is tested per vault;
  - the World sets the vault every frame and before a restore, so a reload lands in the right look;
  - the beam filler is the vault's `sourceCase`, never the last case.
```
  Then commit:
```bash
git add docs/feature-history/casecremental-run1.md
git commit -m "docs(feature-history): Vaults II and III - one look table, wilder by density only, photosensitivity per vault

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

- [ ] **Step 9: Report.** Include:
  - the fanfare measurements;
  - the screenshots' findings per vault;
  - the reload results;
  - the frame-time numbers;
  - the console state;
  - anything that looked off (art offsets, a label covered, a colour that reads badly);
  - that the audio has to be checked by ear by the user: the fanfare pitch per vault, the intro → fanfare hand-off
    at 3.40, the level match.
