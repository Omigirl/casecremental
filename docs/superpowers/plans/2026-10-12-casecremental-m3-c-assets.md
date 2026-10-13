# Casecremental M3-C — Assets for Runs 2 and 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The art and sounds M3 needs: four case sheets, the locker, the auto-buyer frame, Vaults II and III, eight
sound effects, and the two re-cut vault fanfares. Every file is built into the game's asset folders and registered,
so the code plans (M3-D, M3-E) only reference ids.

**Architecture:** Images are generated in ElevenLabs (`gpt-image-2`, the style reference `art/style/bot-reference.png`
wired in), downloaded to `art/source/`, listed in `art/manifest.json`, and built by `npm run art` into
`src/modules/casecremental/assets/sprites/` (the sprite library picks them up by glob — no code change). Sounds are
generated as ElevenLabs sfx flow nodes with `duration_seconds` passed in the node's model parameters (the plain call
drops it), saved as `assets/audio/<id>-<n>.mp3`, and registered in `fx/audio/sounds.ts` + `art/manifest.json` (the
manifest test requires both). The fanfares are cut with ffmpeg from the existing take — no credits.

**Tech Stack:** ElevenLabs MCP (`creative_generate_image`, `creative_generate_in_flow`, `creative_get_flow_run_status`,
`creative_create_asset_upload` / `creative_finalize_asset_upload` for the reference), curl, ffmpeg, Node (`npm run art`).

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-m3-runs-2-3-design.md` §7 and §11.

## Global Constraints

- **Credit budget: ≤ 4,000 ElevenLabs credits in total, approved by the user.** Run every generation with
  `estimate_only` first; keep a running tally; stop and report before the tally would pass 4,000. Never call a
  generation tool a second time to retry a failure (it charges again) — poll its status instead.
- Images: about two takes per asset (`generations_count: 2`, ~185 credits each take ≈ 370 per asset), model
  `gpt-image-2`, the reference image wired in, transparent background; if a take comes back on a solid background,
  remove it with `birefnet-v2-bg-removal` (priced first). Sounds: two variants each (~50 credits each).
- Art style and prompt rules: `art/PROMPTS.md` (shared style line, sprite-sheet rules, "shape matters, the canvas
  doesn't"). Every prompt appends the shared style line; every sheet prompt appends the sheet rules.
- Sound style (from the existing manifest prompts): crisp, close-miked, tactile foley for a cozy, well-made desktop
  game; clean and dry; no music, no voice; not retro, not 8-bit, not chiptune.
- Downloads go only into `art/source/` (images) and `art/source/audio/` (raw takes), then the chosen files are
  copied to `src/modules/casecremental/assets/audio/`. The user approved downloading the generated outputs.
- No code outside `art/`, `src/modules/casecremental/assets/`, `src/modules/casecremental/fx/audio/sounds.ts`
  (SOUNDS entries only) and `src/modules/casecremental/fx/audio/sounds.test.ts`/`manifest.test.ts` if a count there
  must change.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```
  Stage files by path.

## Review Focus

1. **A sheet whose frames touch or differ in size** → `npm run art` mis-slices it; check `art/preview/` for every
   sheet and re-cut by hand (crop/space the frames in the source) rather than paying for another take.
2. **A sound much quieter or louder than its neighbours** → measure mean volume (ffmpeg `volumedetect`) and match
   within ~3 dB of `seller-power-on` / `tray-store` with a gain in SOUNDS, not by re-encoding.
3. **A generated sound longer than asked** → set `maxSeconds` in SOUNDS (the engine fades it), as the existing ones do.
4. **The fanfare re-cuts drifting off the 17.4 s timeline** → same length as `vault-fanfare-1.mp3` (13.8 s) ±0.05 s.
5. **The credit tally** → reported per asset in the final report.

---

## File Structure

| File | Change |
|---|---|
| `art/source/case-mainframe.png`, `case-neon.png`, `case-deepspace.png`, `case-inferno.png` | new 4-frame sheets |
| `art/source/locker-sheet-1x4.png` | new 4-frame sheet |
| `art/source/auto-buyer-sheet-1x2.png` | new 2-frame sheet |
| `art/source/vault-case-2-sheet-1x4.png`, `vault-case-3-sheet-1x4.png` | new 4-frame sheets |
| `art/source/audio/*` | raw takes |
| `art/manifest.json` | 8 asset entries, 8 sfx entries, 2 music entries (the re-cuts, with their recipe) |
| `src/modules/casecremental/assets/sprites/*` | built by `npm run art` |
| `src/modules/casecremental/assets/audio/<id>-<n>.mp3` | chosen variants; `vault-fanfare-2.mp3`, `vault-fanfare-3.mp3` |
| `src/modules/casecremental/fx/audio/sounds.ts` | 8 SOUNDS entries |

---

### Task 1: The reference on a flow, and the four case sheets

**Files:** `art/source/case-*.png`, `art/manifest.json`, `src/modules/casecremental/assets/sprites/case-{mainframe,neon,deepspace,inferno}.*`

- [ ] **Step 1:** Read `art/PROMPTS.md` and the existing `case-bedrock` entry in `art/manifest.json`
  (`kind: "sheet", frames: 4, targetH: 20`). Look at `art/preview/` for how cases 1–3 came out.
- [ ] **Step 2:** Create one flow (`creative_create_flow`) for all M3 images. Upload `art/style/bot-reference.png`
  (`creative_create_asset_upload` with its exact byte size, PUT the bytes with curl, `creative_finalize_asset_upload`
  with the flow id) and keep the returned node id as `connect_from` for every image.
- [ ] **Step 3:** For each case, estimate then generate (`generations_count: 2`) with this prompt + the shared style
  line + the sheet rules (all four cases share the composition of `case-bootcamp.png`'s prompt):
  - `case-mainframe.png`: "Sprite sheet, 1 row × 4 frames, same weapon case each frame (each case slightly wider than
    tall): 1) closed, 2) lid lifting a little, 3) lid half open with a cool cyan glow inside, 4) fully open, glow
    inside. A dark gunmetal high-tech case with glowing cyan circuit traces on its sides, a small status LED and a
    hex-pattern grille."
  - `case-neon.png`: same frames; "A glossy black case outlined in hot-pink and cyan neon tubes, a synthwave sunset
    decal on the lid; the glow inside is magenta."
  - `case-deepspace.png`: same frames; "A deep navy case whose surface shows a starry nebula, brass corners, a
    small planet emblem on the lid; the glow inside is violet-white starlight."
  - `case-inferno.png`: same frames; "A charred black-iron case with glowing orange cracks and rivets, flames licking
    up its edges; the glow inside is molten orange."
  Poll `creative_get_flow_run_status` until done; download both takes to `art/source/` (`case-<id>-take-<n>.png`),
  look at them (Read the PNGs), pick the one whose four frames are evenly spaced and match the closed→open sequence,
  and copy it to `art/source/case-<id>.png`.
- [ ] **Step 4:** Add the four entries to `art/manifest.json` `assets` (`{"id":"case-mainframe","source":"case-mainframe.png","kind":"sheet","frames":4,"targetH":20}`, likewise `case-neon`, `case-deepspace`, `case-inferno`), run `npm run art`, check `art/preview/` and the built `assets/sprites/case-*.json` (4 frames, frameH ≈ 20).
- [ ] **Step 5:** `npx vitest run tools src/modules/casecremental/fx/pixel/sprites.test.ts` → PASS. Commit
  `assets(art): case sheets for Mainframe, Neon Nights, Deep Space, Inferno - ElevenLabs, built by npm run art`
  staging the sources, the takes, the manifest and the built sprites.

### Task 2: The locker, the auto-buyer, Vaults II and III

**Files:** `art/source/locker-sheet-1x4.png`, `auto-buyer-sheet-1x2.png`, `vault-case-2-sheet-1x4.png`, `vault-case-3-sheet-1x4.png`, `art/manifest.json`, built sprites

- [ ] **Step 1:** Same flow and reference. Estimate, then generate two takes each:
  - `locker` (sheet 1 × 4, each frame about 4:5, a bit taller than wide): "A small steel workshop locker cabinet with
    brass trim and a stamping press built into its top, five small round indicator lamps in a row on its front door:
    1) powered off, lamps dark; 2) powered on, lamps glowing softly in blue, purple, pink, red and gold; 3) the press
    stamped down with a puff of steam; 4) the door swung open showing shelves of folded items."
  - `auto-buyer` (sheet 1 × 2, each frame very wide ~3:1): "A long low brass-framed rack machine with a hopper on its
    left end feeding a conveyor slot, rows of empty pigeonholes along its front: 1) powered off, dark; 2) powered on,
    warm amber status lights lit." (The grid's cells are drawn in code over the pigeonholes.)
  - `vault-case-2` (sheet 1 × 4, same frame sequence and composition as `art/source/vault-case-sheet-1x4.png` — attach
    that file too as a second reference): "the same heavy vault chest rebuilt in polished chrome with hot-pink and
    cyan neon seams: 1) locked, 2) seams glowing, 3) bursting with light, 4) open."
  - `vault-case-3` (same): "the same vault chest in black obsidian with glowing molten-orange cracks and gold
    corners: 1) locked, 2) cracks glowing, 3) bursting with fire and light, 4) open."
  Download, pick, copy as for Task 1.
- [ ] **Step 2:** Manifest entries: `{"id":"locker","source":"locker-sheet-1x4.png","kind":"sheet","frames":4,"rows":1,"targetH":30}`,
  `{"id":"auto-buyer","source":"auto-buyer-sheet-1x2.png","kind":"sheet","frames":2,"rows":1,"targetH":18}`,
  `{"id":"vault-case-2","source":"vault-case-2-sheet-1x4.png","kind":"sheet","frames":4,"rows":1,"targetH":64}`,
  `{"id":"vault-case-3",…same…}`. `npm run art`, check the previews.
- [ ] **Step 3:** Tests as Task 1 → PASS. Commit `assets(art): locker, auto-buyer, Vault Case II and III - ElevenLabs, built by npm run art`.

### Task 3: Eight sounds

**Files:** `art/manifest.json`, `assets/audio/<id>-1.mp3`, `<id>-2.mp3`, `fx/audio/sounds.ts`, `art/source/audio/`

- [ ] **Step 1:** For each sound, an sfx flow node (`creative_generate_in_flow`, `node_type: "sfx"`,
  `model_id: "eleven_text_to_sound_v2"`, `generations_count: 2`) with `duration_seconds` set through the node's model
  parameters (see `docs/feature-history/casecremental-run1.md`, "ElevenLabs sound effects need duration_seconds…" —
  use `creative_update_node` / the flow node parameters as the C-plans did; check `git log --all --oneline -- art/manifest.json`
  and the M2b-C1/C2 plans for the exact recipe). Estimate first. Prompts (append the sound style line from Global Constraints):
  | id | s | prompt |
  |---|---|---|
  | `locker-power-on` | 2 | A steel locker cabinet powering on: a relay clunk, five small lamps clicking on one after another, a soft electrical hum |
  | `locker-store` | 1 | An item slid onto a steel shelf and a locker door latch clicking shut |
  | `tradeup-press` | 2 | A small hydraulic stamping press: a hiss, a heavy stamp thud, a short steam release |
  | `tradeup-reveal` | 1.5 | A bright mechanical ding with a short sparkle, a reward popping out of a machine |
  | `grid-power-on` | 2 | A long rack of machinery waking up: a row of relays clicking on in a rapid sweep left to right, then a steady hum |
  | `grid-buy` | 0.5 | A tiny coin-op click and a small box dropping into a slot |
  | `grid-open` | 0.5 | A tiny soft latch pop of a small box opening |
  | `grid-breakout` | 1.5 | A sharp whoosh and a glassy burst as something precious bursts out of a machine |
- [ ] **Step 2:** Download both variants to `art/source/audio/`, convert/copy to `assets/audio/<id>-1.mp3` and
  `<id>-2.mp3` (mp3, 96–192 kbps as the others). Measure each with `ffmpeg -i f -af volumedetect -f null -` and the
  duration with `ffprobe`; drop a broken variant (keep at least one).
- [ ] **Step 3:** Add the 8 entries to `art/manifest.json` `audio` (`{"id":"locker-store","kind":"sfx","variants":2,"duration":1,"prompt":"…"}`)
  and to `SOUNDS` in `fx/audio/sounds.ts` (bus `sfx`; gains matched to the neighbours by the measured levels:
  `grid-buy` and `grid-open` low, ~0.3–0.4, since they fire often; `maxSeconds` where a take ran long).
- [ ] **Step 4:** `npx vitest run src/modules/casecremental/fx/audio && npm run typecheck` → PASS. Commit
  `assets(audio): locker, trade-up and auto-buyer sounds - ElevenLabs` (manifest, sounds.ts, mp3s, takes).

### Task 4: The fanfares for Vaults II and III (ffmpeg, no credits)

**Files:** `assets/audio/vault-fanfare-2.mp3`, `vault-fanfare-3.mp3`, `art/manifest.json`

- [ ] **Step 1:** Read the `vault-fanfare` manifest entry and commit `0364003` (how `vault-fanfare-1.mp3` was built).
  Build each re-cut by pitch-shifting the finished `vault-fanfare-1.mp3` with tempo kept:
  `ffmpeg -i vault-fanfare-1.mp3 -af "rubberband=pitch=2^(2/12)" -b:a 192k vault-fanfare-2.mp3` (+2 semitones) and
  `pitch=2^(4/12)` for `vault-fanfare-3.mp3` (+4). If `rubberband` is unavailable in this ffmpeg build, use
  `asetrate=44100*2^(n/12),aresample=44100,atempo=1/2^(n/12)` and say so in the report.
- [ ] **Step 2:** Check: duration within ±0.05 s of `vault-fanfare-1.mp3`; mean volume within 1 dB of it.
- [ ] **Step 3:** Manifest `audio` entries `vault-fanfare-2` / `vault-fanfare-3` (`kind: "music"`, `duration`, a
  `prompt` field holding the recipe text, no `stage`). Do not add them to `TRACK_GAIN` (Plan M3-E wires them). Run
  `npx vitest run src/modules/casecremental/fx/audio` → PASS (the manifest test checks only TRACK_GAIN ids and the
  stage loops). Commit `feat(audio): Vault II and III fanfares - the climbing fanfare re-cut +2 and +4 semitones`.

### Task 5: Report

- [ ] Report to the controller: credits spent per asset and in total, the chosen take per asset and why, the
  previews you looked at, each sound's duration and mean volume, the fanfare durations, and anything that came out
  weak (with its spare take's path).
