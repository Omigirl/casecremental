# Casecremental M2b-C7 — fix everything before the handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal (user, 2026-10-09):** "fix everything so there are no problems before handoff". Clear every deferred
minor still relevant from plans C1–C6 (`.superpowers/handoff-2026-10-09.md`), grouped by area so four batches can
run with no shared files.

**Architecture:** no new systems, only fixes. Each item is either fixed with a test that fails first (behaviour
and pure helpers) or, for renderer-only and hygiene changes, a clean typecheck and suite run.

**Spec:** the specs behind C1–C6 (`docs/superpowers/specs/2026-10-09-*`). Each item names the behaviour a player
or developer should get.

## Global Constraints

- Every change keeps `npx vitest run src/modules/casecremental`, `npm run typecheck` and `npm run build` green.
- Behaviour fixes need a failing test first. Pure refactors and hygiene need no new test.
- Numbers live in `sim/tuning.ts`. Files stay ≤ ~400 lines; `World.ts` (533) does not grow.
- English and Russian for any new string, within budgets. LF line endings; stage files by path.
- A batch only edits its own files (listed per task).
- Commit trailer:
  ```
  Co-Authored-By: Claude <model> <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013MA8Fp47Lkjiuq8tVoGPyt
  ```

## Out of scope (rulings)

- **Obsolete items:** the VaultColumns minors (deleted in C5), the chiptune-era "fifth lock-in vs the resolving
  bar" (the fanfare is DnB now), the one-shot wrap (fixed in 41fcc45), and the stale feature-history line (fixed).
- **Can't be fixed by code:** "fanfare takes picked by level, not by ear".
- **Kept as designed:**
  - the Machines tab showing the auto-seller's disabled BUY row from the start (normal incremental UX: you see
    the price you're working toward);
  - the compact two-reel strips' height (a layout constraint between the reel and the cards).

---

### Task 1: sim, game and UI

**Files:** `sim/*` (except content), `game/*`, `ui/*` (except `Prestige.tsx`), `i18n/*`

- [ ] **Dev board:** the forced rarity and the fake tease apply only to your bench's next open, never to the
  bot's roll. Test: an awake bot spinning first doesn't consume a `forceNextRarity`.
- [ ] **The bot's wake-up plays out:**
  - after `wakeBot`, the bot rests `BOT_WAKE_SECONDS` (0.8, in tuning) before its first spin;
  - a new field defaults on load: `normalize` fills it, and old saves still load;
  - test it.
- [ ] **Vault purchase:** buying the vault clears a running day job. Test it.
- [ ] **`heldSlot`:** reset to 0 wherever `held` becomes null.
- [ ] **Charm events:** `charmPicked` fires only on a pick, not on an un-pick. Test it.
- [ ] **`view.opening`:** remove the field that duplicates `view.vault.progress`, and update its consumers.
- [ ] **Saves:**
  - `normalize` merges `freshBot()` / `freshSeller()` defaults into the loaded bot and seller, so a missing field
    never becomes NaN;
  - `ZERO_UPGRADES` is built from `UPGRADE_IDS`;
  - test a v3 save whose bot lacks `speedLevel`.
- [ ] **AI agent API (`game/agent.ts`):**
  - `sell` rejects a non-integer `slot` with a clear message;
  - the state reports the number of spinning reels, and each case's BUY count and total charge.

  Test both.
- [ ] **Vault blocked by a waiting card:** the view gives a reason when the vault is affordable but the bench is
  busy. The shelf shows a sub-label "Sell your cards first" / «Сначала продай карты» (within budgets). Test the
  view.
- [ ] **Hygiene:**
  - share the `open` computation between BotPanel and SellerPanel;
  - remove the unused `tab.locked` string (en and ru);
  - move `export type { CardSpot }` below the imports in run.ts;
  - fix the garbled comment in `buyVault`;
  - remove the orphaned and stacked doc comments in tuning.ts.
- [ ] **Tests that pin more:**
  - the Speed test goes through `Run` (a shorter hold);
  - the claim test reads the combo multiplier from `COMBO_STEP`;
  - the routing test asserts `holdCard { spot: "bench" }` and a successful `sellBot`;
  - the auto-seller "two cards" test has both waiting at once;
  - the bot's in-flight spin is cashed in at vault purchase (amount and `sold` event).
- [ ] **Pacing:** the spec says the auto-seller is on by ~3–5 min. Raise `SELLER_COST` only, until the pacing
  median is ≥ 180 s, keeping every other window green. Tighten the seller test bound to 180–300 s.
- [ ] **Commit(s):** `fix(sim,game): polish before handoff - ...`

### Task 2: the vault scene, music and chaos

**Files:**
- `fx/vault/VaultScene.ts`, `chaos.ts`, `chaosPlan.ts`, `chest.ts`, `rays.ts`, `vaultFx.ts`, `devilKey.ts`,
  `vaultFlow.ts`, `lights.ts`, `cues.ts`, `countUp.ts`, `beat.ts`, `beats.ts`, `vaultLayout.ts` and their tests;
- `fx/World.ts`, vault wiring only;
- `ui/Prestige.tsx`;
- deleting `fx/hd/rain.ts` (+ test), and `BotSprite.setFrenzy` if unused.

- [ ] **Devil key drag:** track the dragging `pointerId`; another finger can't move or end the drag.
- [ ] **Music state:**
  - `restoreVault` routes through `musicPlan`/`applyMusic`, so a stale named track is always cleared;
  - a lobby trip during the blackout doesn't start the prestige music early;
  - the first mount over an opening vault doesn't start the stage loop for a frame;
  - `applyMusic`'s silent plan passes `loop`/`offset` (no looping fanfare armed).

  Add tests: `musicPlan` at t = 0.99, 1.0 and 14.49; PowerCycle (blackout → dark → powerUp → stage loop back).
- [ ] **Lights:** `lightLevels().room` flickers up instead of a hard step at 1.4 s. Test that its per-frame
  change stays bounded and that it stays in [0, 1].
- [ ] **Bounds tests:**
  - `seam` and `density` stay in [0, 1];
  - `countUp` is monotonic;
  - `vaultLayout` holds on 844×390, 640×360, 568×320, 360×640 and 3440×1440 (everything on screen, nothing
    overlapping).
- [ ] **Kicks:**
  - the kick's spot index comes from its index in `VAULT_CUES.fireworks`, not a session counter;
  - the landing fireworks and `+$` texts don't drift with the shake (spawn in unshaken coordinates).
- [ ] **Chaos:**
  - it keeps moving gently through the "done" hold (no freeze until the blackout);
  - the chest's bounce reads the current frame's beat (no lag);
  - `hsv()` allocates no closure per call;
  - `vaultCues(t)` is computed once per frame and passed down (World / VaultScene).
- [ ] **Hygiene:**
  - `VaultScene.destroy` destroys `rays.root` once;
  - `onReady` listeners fire once per ready transition;
  - the prestige ⚙ uses the pixel font, or a pixel icon, instead of the system font;
  - delete `rain.ts` (+ its test) and `BotSprite.setFrenzy` if nothing uses them.
- [ ] **Commit(s):** `fix(vault): polish before handoff - ...`

### Task 3: the beams and labels

**Files:** `fx/vault/beams.ts`, `VaultBeams.ts`, `beamStream.ts`, `beamArt.ts`, `fitLabel.ts`,
`columnMotion.ts`, `vaultLayout.test.ts` (only the shared helper), and their tests

- [ ] **Labels:**
  - shrunk label sizes snap to Press Start 2P's grid (multiples of 8 where k allows, else whole px);
  - the `+$` line is fitted too;
  - `overflow` is honoured: a label that still can't fit truncates its name with "…" rather than spilling;
  - test all three.
- [ ] **Beam layout:**
  - pick the spots for beams 1 and 3 symmetrically (as a pair) when possible;
  - leave headroom under the money line, so the plaque covers the text's full box;
  - prove the last-resort path unreachable with an exhaustive sweep test (1000+ sizes, fast), or make it
    shrink until it fits;
  - share `endCornersOff` between the two tests.
- [ ] **Stream and landings:**
  - the stream reads visibly ~1.5× faster than before C6, so the item spacing doesn't hide the speed;
  - streamed items stay attached to their beam under the big hits (shake/zoom applied to the beam and its
    items together);
  - `landed()` uses `VAULT_LAND_TIMES[index]`, not `this.t`, so the juice never skips after a start or restore;
  - no per-frame `{ slowCells }` object;
  - `columnMotion` is guarded for target 0.
- [ ] **Commit(s):** `fix(vault): beams and labels polish before handoff - ...`

### Task 4: the bench, the bot and the World (after Task 2, which also edits World.ts)

**Files:** `fx/World.ts`, `fx/benchFx.ts`, `fx/pixel/*` (Bench, BenchCards, BenchReels, BotCard, BotSprite,
layout and their tests), `fx/hd/HdLayer.ts`, `fx/labels.ts`, `fx/vault/stackedReels.ts`, `fx/audio/sounds.ts`,
`art/manifest.json`, `assets/audio` (removals only)

- [ ] **The bin calls for the bot's waiting card** too (`setBinCalling`).
- [ ] **Bot reel after a reload:** with the bot's card waiting, the bot's reel shows the landed drop, not a random
  strip. Test via `restorePlan` / its equivalent.
- [ ] **Bench reels:**
  - each reel that lands before its teasing partner plays its own quieter `reel-stop` and a small shake;
  - the camera lean releases when the leaning reel lands;
  - test the pure parts (which reels landed this frame, which reel leans).
- [ ] **Portrait hint:** the single-card hint no longer overlaps the card's top in portrait (place it above, or
  hide it there). Test it in layout or labels.
- [ ] **`stackRects`:**
  - its 8-px floor can't overflow the area (shrink the gap or the floor for tiny areas);
  - x/w rounding is tested with fractional input.
- [ ] **Hygiene:**
  - BotSprite's leftover `ready` flag goes;
  - BotCardView drops its texture reference when the card clears;
  - the portrait clamp uses `ITEM_SIZE.reveal.w / 2`;
  - HdLayer's LED is drawn once;
  - `revealSpots` stops allocating per frame;
  - `BenchCards.clear` releases its baked textures;
  - the redundant `knifeFlight.cancel()` goes;
  - `layout.test.ts` stops nesting `it.each(SIZES)` inside `describe.each(SIZES)`.
- [ ] **Unused sounds:** remove `bot-beep`, `stage-whoosh` and `reel-spinup` (SOUNDS, files, manifest), after
  grepping that nothing plays them.
- [ ] **Tests:** add tests for benchFx's pure helpers and BenchReels' snap rule.
- [ ] **Commit(s):** `fix(bench): polish before handoff - ...`

### Task 5: final whole-branch review and handoff (controller)

- [ ] Run an Opus review over C7.
- [ ] Fix any Critical or Important finding.
- [ ] Update `.superpowers/handoff-2026-10-09.md` to the final state.
