# Casecremental — Run 1 complete (M2b)

What a full Run 1 is and the calls behind it. Spec: `docs/superpowers/specs/2026-10-08-casecremental-m2b-run1-design.md`;
plans M2b-A (logic) and M2b-B (on screen). Rework plans M2b-C1 (roles), C2 (the vault) and C3 (multi-open ×2).

## The loop
Open by hand → wake the bot (it opens its own cases on its own reel with your cash; the auto-seller machine
sells the ordinary drops and sets the good ones aside in the claim tray) → unlock Wildwood and Bedrock → Vault Case I → the player turns the devil key → the vault opens like a legendary chest on five reels, the fifth its animated ★ (the Vault I trophy) → blackout → prestige: CLOUT, pick a charm (3 offered from 8), buy perks → a fresh, boosted Run 1.

## Decisions worth knowing
- **Roles (rework, user after playing M2b):** the bot opens its own cases on its own reel with your cash; you
  sell its card by hand. The auto-seller machine (bought in Run 1) takes any waiting card after a short hold:
  sells it up to its threshold (no combo) or sets it aside in the claim tray. Hand sales are the only combo.
  The first M2b had the bot walking over to sell — it read wrong next to the bot's own reel, so it was replaced.
- **Stage 5 is "Unhinged"** (was "Cyberpsychosis" — it didn't fit the game).
- **Content is split across the four runs** (user): Run 1 has the bot opening its own cases (Speed ×1 → ×8) and the auto-seller, the tray, 8 of
  14 charms, multi-open ×2 (plan M2b-C). Later runs bring the locker and the auto-buyer grid.
- **The vault is a last-chance ticket, opened like a jackpot** (user, after the first finale felt "down to
  earth", then a Vampire Survivors legendary-chest guide — its animation and music parts, no skip): buying it
  takes the screen (UI hidden) and the player turns a devilish key by hand. Then a fixed 14.5 s sim timeline
  (spec `2026-10-09-casecremental-vault-jackpot-design.md`): the chest trembles with a widening gold seam, snaps
  open at 1.0 s (flash, shake, light shaft, the jackpot hit, the chiptune fanfare's first downbeat), then five
  wide coloured beams (yellow, orange, red, orange, yellow) fan out of the chest's mouth and run past the screen
  edge — skins and coins stream along them as if endless (the user's Vampire Survivors screenshot; they replaced
  framed vertical columns) — and each reward rides out and stops on its beam, left to right on the beat
  (6, 6.5, 7, 7.5, 8.5 s) with rising chimes — the fifth is Vault I's animated ★ "Event Horizon" — then the
  total counts up and the results hold until the blackout (auto-continue, the user's choice). Prestige follows
  over black and the next run's lights stutter back on. A reload or lobby trip resumes at the same moment with
  no beat replayed; the fanfare plays from `t − 1` (silent before the impact). Russian names wrap at whole words
  and shrink to fit their label boxes. The beam layout (`fx/vault/beams.ts`) is solved and sweep-tested over
  ~50 screen sizes: beam ends always past the edge, rewards and labels never overlapping one another or the
  total. The UI fades back 3.4 s into the next run.
- **The vault is chaos on purpose** (user: "no space on screen which is not moving"): the fanfare is a 174 BPM
  drum-and-bass drop (the chiptune and spare takes are in `art/source/audio/`; a take that faded from 6 s was
  replaced — check a generated track's level per second, not just its length). Everything pulses off one beat clock
  from the impact (`fx/vault/beat.ts`): beat-locked shake and zoom, a swaying striped backdrop, full-screen rain,
  edge sparks, 14 kick explosions (`VAULT_CUES.fireworks`). Rewards, labels and the total sit outside the cameras
  so they stay readable. Photosensitivity is a hard rule: at most 3 full-screen flashes a second, and every
  light that throbs on the beat changes by less than 0.1 (`BEAT_LIGHT_AMPLITUDES`, tested).
- **Music is boosted in code, not in the files** (user: "make music louder"): the music bus runs at
  `MUSIC_BOOST` (1.6×) its slider and each named track has a `TRACK_GAIN` (the DnB drop 1.5×) — re-encoding the
  loops would add mp3 padding at their loop points, and the peaky DnB track barely gains from compression. The
  five kick variants were level-matched with ffmpeg (within ~3 dB).
- **The bot rests `BOT_WAKE_SECONDS` after waking** so its wake-up animation plays out before its first spin
  (pinned to the animation's length in a test).
- **ElevenLabs sound effects need `duration_seconds` passed through a flow node's model parameters** — the
  plain generate-in-flow call drops it and returns whole seconds, which is why the first batch came back short.
- **The day job replaced the free case** (user): broke with an empty bench → a 3 s shift, 90 % +$2.
- **The prestige screen** waits for the blackout only when the player watched the run end; after a reload it is
  up at once, over black. It has its own ⚙ (the HUD is hidden there), so the music can be muted.
- **Multi-open ×2** (Run 1 cap; spec §5): one BUY opens up to two cases — only as many as you can afford, so it
  never locks you out of BUY or the day job. Each reel lands its own drop and tease; the reel window is tall while
  they spin and snaps back to compact when they land (re-laying a reel rebuilds its strip, so no glide). The cards
  sit side by side and are sold, held or taken by the auto-seller one by one (each hand sale feeds the combo); the
  big reveal effects play once, for the best card, and the label shows the best waiting card. No "Drag to sell"
  hint over two cards — it covered their tops. Saves went to version 3 (a version-2 save is migrated).
- **Tuning (pacing tests, medians of 5 greedy players):** bot awake ~2.2 min (132 s), auto-seller ~3.2 min
  (~193 s, SELLER_COST $300 — raised from $150 so it lands in the spec's 3–5 min), first vault ~8.1 min (487 s, VAULT_BASE_PRICE $1M), a boosted second run unlocks everything in
  ~67 s and vaults again at ~375 s. A first vault pays ~13–15 CLOUT (CLOUT_DIVISOR 105). Wildwood's unlock
  went $40 → $30 so the bot can be woken right after it. Change numbers only in `sim/tuning.ts`.
- **Saving:** one versioned localStorage key, written about once a second, after every action and when the
  page closes; a bad save is dropped or filled in from defaults, never thrown; a held card is never restored
  as held. A run keeps the setup it started with (vault price, boost), so a save from before a retune keeps
  its old prices until the next run.
- **Russian:** CLOUT is «ХАЙП», charms are «талисманы», the day job is «ШАБАШКА».
