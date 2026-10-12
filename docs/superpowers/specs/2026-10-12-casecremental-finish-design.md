# Casecremental — Finish (M4 + M5) design

- **Date:** 2026-10-12
- **Branch:** `casecremental-finish`, off `casecremental-m3`. Both are merged into `master` when everything below
  is done and checked (the user's call, 2026-10-12).
- **Amends:** the base spec (`2026-10-07-casecremental-design.md`), the campaign spec
  (`2026-10-08-casecremental-campaign-and-table-design.md`) and the M3 spec. Where they disagree, this one wins.
- **Origin:** the user's play-test of M3 (2026-10-12): "fix todos… no animations in tray, auto case buyer is
  unconfigurable, no tutorial, runs are too slow… vault cases 2 and 3 are too hard to buy, we need more music for
  later stages, I did not understand the last machine, we need an auto spinner which could be turned on and off for
  the main guy… just finish the game." Scope picked by the user: **full M4 as planned**; auto-spin unlocks in
  **late Run 1**; music credits beyond the remaining 1,378 need the user's number first.

## 1. Phases

Each phase is its own plan in `docs/superpowers/plans/`, built and checked before the next starts.

| Phase | What |
|---|---|
| F1 | Bug fixes: the three todos and the tray's animations |
| F2 | Auto-spin replaces the auto-buyer grid |
| F3 | Tutorial |
| F4 | Pacing retune for real players |
| F5 | Music for the late stages |
| F6 | Run 4: Glitch and Fever Dream, the Upgrader, evolutions, The Last Case and the credits |
| F7 | Server meta on iDosGames: CLOUT, Trophy Case, leaderboard |
| F8 | Solana: wallet sign-in, the ★ NFT spike |
| F9 | Balance across all four runs, the final browser pass, docs, merge |

## 2. F1 — bug fixes

1. **No scrollbar flash on the Upgrades/Machines drawer.** Buying an upgrade must never make the drawer
   scrollable for a frame. Find what grows (a row re-flowing, a longer price or label, an animation overflowing)
   and make it not grow; `scrollbar-gutter: stable` on the scroll container so a real scroll never shifts the rows.
2. **No text selection in the game.** `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout:
   none` on the game root; real text inputs keep selection.
3. **Multi-open reels that read as reels.** At ×3 and ×5 the stacked bench reels showed flat rarity bars with
   smeared pixel noise, and at ×5 a column of large golden sprites flew over all five rows. Every stacked strip
   must show distinct cells with recognisable skin art (scaled down), a clear centre marker and a clean landing.
   When a strip is too short for the art to read, it shows clean rarity tiles with a dark gap between cells, never
   noise. Find the flying golden sprites' source (coins, knife flights or a particle burst aimed at the reel area)
   and keep them out of the reel window. Check ×2, ×3 and ×5 at desktop and portrait sizes.
4. **The claim tray comes alive.** Today a tray slot is a rarity-coloured box, drawn only when the list changes.
   - Each slot shows the drop's skin art (its first frame, scaled to the slot) on its rarity colour.
   - A card arriving slides in from where it came from (the bench, the bot, the locker) and settles with a small
     bounce and the existing `tray-store` sound.
   - A claimed card pops out (scale up and fade) as the sale's coins fly.
   - Covert and ★ slots glow and pulse softly (within the photosensitivity rule: light changes under 0.1 per beat).
   - A full tray pulses its frame red and shows "TRAY FULL" until a card is claimed.

## 3. F2 — auto-spin replaces the auto-buyer grid

The grid is removed: its station, rows, shelf ticks, sim, events, sounds, art and tests. Run 3 keeps its other
content (multi-open ×5, bot speed to ×50, the auto contract).

**Auto-spin** is a machine for your own bench.
- **Unlock:** the Machines tab, Run 1, once the auto-seller is on (its rows say "Needs auto-seller" before). One
  purchase, priced by F4. Every later run has it from its own purchase (a run starts with machines off, like
  today), and perks may grant it at the start (F4 decides; the "Bot awake" perk is the model).
- **Toggle:** an ON/OFF switch on the bench beside BUY, and the same switch on its Machines row. Off by default
  after purchase; the switch remembers its state for the rest of the run.
- **What it does while on:** whenever your bench is empty, nobody holds a card, and the vault is not out, it buys
  the **case you picked last** (the last case you bought by hand or picked on the shelf) at your full multi-open
  width (as many as you can afford, like BUY), waits its **delay**, and turns the key. The reel spins at Quick
  Hands speed with its full tease. The revealed cards are left for the auto-seller, or for your hands — selling by
  hand while auto-spin runs still feeds the combo.
- **When it cannot afford the picked case** it buys the dearest unlocked case it can; with no case affordable it
  stops (shows "BROKE") and the day job appears as today.
- **Delay** between the bench emptying and the next buy: an upgrade on its Machines row, e.g. 1.5 s → 0.2 s over
  5 levels (numbers in `sim/tuning.ts`, tuned by F4).
- **Never builds combo by itself** (base spec §8.4: only hand sales do).
- **Juice:** a small motorised arm/lever by the bench (pixel art, or drawn) that pulls when it buys and turns the
  key; its own lamp shows ON/OFF. A machine reveal: when it turns on for the first time, a short power-on (light +
  existing power-on sound).
- **Save:** save version 5. A v4 save drops the grid (its spent cash is not refunded; the grid is gone from every
  run) and gets `autoSpin: { owned: false, on: false, delayLevel: 0, pick: null }`.
- **The greedy pacing player** buys auto-spin like it buys the auto-seller and keeps it on.

## 4. F3 — tutorial

A short coach for a first-time player, in EN and RU, skippable, replayable from Settings ("Replay tutorial").
Stored in prefs (per browser), not in the run save.

- **Steps,** each a speech bubble with a pixel arrow pointing at the thing to touch, advancing when the player does
  it (never by a timer):
  1. "Tap a case to buy it" → the shelf's first case.
  2. "Turn the key" → the bench.
  3. "Drag the skin to SELL — or just tap it" → the card, then the bin.
  4. "Spend cash on upgrades" → the Upgrades tab (shown once cash can buy the first upgrade).
  5. "Unlock the next case" → the shelf's next case (once affordable).
  6. "Wake the bot — it opens cases on its own" → the bot (once affordable).
  7. "The auto-seller sells for you; good drops wait in the tray" → Machines tab (once affordable).
  8. "Auto-spin opens your cases while you watch" → the auto-spin row (once affordable).
  9. "This is the run's goal" → the vault on the shelf (when it appears).
- **New-run cards:** the first time each run starts, one card says what is new (Run 2: the bot's second reel, the
  locker and trade-ups; Run 3: ×5 and the auto contract; Run 4: Glitch, Fever Dream, the Upgrader, evolutions,
  The Last Case). One tap closes it.
- A bubble never covers its own target; on portrait it sits above or below it.

## 5. F4 — pacing for real players

The pacing test tunes to a perfect greedy player who never pauses; real players are much slower, so Vaults II and
III felt out of reach.

- Add a second timing profile to `sim/bot.ts`, **CASUAL**: slower actions (buy 0.8 s, key 0.8 s, sell 1.2 s,
  reveal 0.8 s), looks at upgrades only every 8 s, and runs auto-spin once owned.
- **Targets (median of 5 seeds):**

  | | GREEDY | CASUAL |
  |---|---|---|
  | Run 1 vault | 4–6 min | 6–9 min |
  | Runs 2–4 catch-up to the previous shelf | 0.5–1.5 min | 1–2 min |
  | Runs 2–4 vault | 4–6 min | 5–8 min |
  | A replay of the last run's vault | 3–5 min | 4–7 min |

- **Hard rule:** once every case and upgrade of a run is bought, the vault costs at most **90 s** of that run's
  CASUAL income. Tested per run.
- The other pacing tests stay (bot by ~2.5 min, seller 3–5 min, the tray never stuck full, contracts in Run 2,
  stage targets: Run 2 reaches High, Run 3 Tripping, Run 4 Unhinged).
- Tune numbers only in `sim/tuning.ts`. Saves keep their run's setup, as today.

## 6. F5 — music for the late stages

Stages 3–5 (High, Tripping, Unhinged) each have one 32 s loop, so the late game repeats itself.
- Generate **two more loops for each of stages 3, 4, 5** (6 loops, 120 BPM, 4/4, A minor, 16 bars, the same
  instrument family as the existing ones so they swap on bar lines), plus a **finale loop for Run 4** (stage 5 in
  Run 4 plays it among the others) and a **credits track** (~60–90 s, warm and triumphant, A major).
- A stage plays its loops as a playlist: a loop plays twice (64 s), then the next one, swapped on a bar line with
  the existing crossfade.
- **Budget:** start with what is left of the approved 4,000 ElevenLabs credits (1,378). Before going over, ask the
  user for a number. If the budget runs out, the remaining variants are built from existing loops with ffmpeg
  (re-cut, octave layer, filter) at no cost.
- Loudness matched to the existing loops (mean within ~1 dB); recipes and prompts go in `art/manifest.json`.

## 7. F6 — Run 4

`LAST_RUN` becomes 4. After The Last Case the campaign replays Run 4 (endless, boosted, `VAULT_GROWTH` per loop),
and the prestige screen after The Last Case says so.

### 7.1 Content
- **Cases 8 and 9: Glitch and Fever Dream** (base spec §5 themes), each with a case box sprite, 14 skins like the
  other cases, and new pattern finishes where the existing ones don't fit (glitch: datamosh, scanline tear, RGB
  split; fever dream: melting, kaleidoscope, hue-cycling). Case art follows the M3-C pipeline.
- `RUN_CONTENT[3]`: 9 cases, multi-open ×5, bot speed to ×100, bot multi-open ×3, locker, auto contract, the
  Upgrader, evolutions.
- **Charms:** Loaded Dice (Upgrader win chance +10 points) joins Run 4's pool.

### 7.2 The Upgrader (base spec §8.3)
- A row group on the Machines tab under the locker (Run 4+): pick a rarity stack from the locker as the stake
  (value V = what those skins would sell for), pick a target multiplier ×1.5 / ×2 / ×5 / ×10 / ×25 / ×100, press
  GO. Win chance = 0.9 / multiplier (+0.10 with Loaded Dice, capped at 0.95). Win → a skin worth about V × multiplier
  from the stake's cases (the next rarities up); lose → the stake is gone.
- On the table: the locker's press runs a roulette needle animation (a dial with the win arc), lands, then a win
  pops the skin out like a contract result; a loss shreds the stake with a sad sound.
- Rolled when GO is pressed (a reload mid-spin ends the same way).

### 7.3 Evolutions (base spec §8.2, adapted to the current upgrades)
An evolution unlocks in Run 4+ when its recipe is complete, then costs one purchase (an "EVOLVE" button with its
recipe shown). Each is a big power jump **and** a visible change on the table.

| Evolution | Recipe | Effect | Look |
|---|---|---|---|
| Slot Machine | Quick Hands max + Multi-open max | Your bench opens ×10 per BUY; reels shown as 5 slot columns | the reel window turns into a gold slot-machine frame |
| Cartel | Bot Speed max + Luck max | The bot rolls each case twice and keeps the better | the bot wears shades and a gold chain |
| Money Printer | Appraiser max + Seller Speed max | The auto-seller's sales ×3 | the seller sprays bills; a cash-torrent particle stream to the counter |
| Assembly Line | Auto-spin Delay max + Multi-open max | Auto-spin has no delay; every 25th auto-spin is a free case one tier up | a conveyor belt feeds cases into your bench |
| Hot Hand | Luck max + a hand combo of 50 | While the combo is ≥ 25, your bench rolls with +5 Luck levels | your hand cursor burns; flames on the combo meter |

### 7.4 The Last Case
- Appears on the shelf once Run 4's cases are unlocked, like a vault; it is Run 4's vault (`VaultDef` id
  `lastcase`, trophy ★ Singularity).
- Opened with the same ticket and timeline as the vaults, in its own look: black glass with gold glitch seams, a
  new chest sheet, white/gold/void beams, the densest chaos of all, the fanfare re-cut +7 semitones. Extra: at the
  impact the screen **tears** (a horizontal slice offset/glitch effect for ~1.5 s, gated by the flash rules) and
  every reel on screen (bench, bot) spins at once until the lid opens. The fifth beam's legend is ★ Singularity
  (animated).
- After the results hold: **the credits.** Black screen, the credits track, a slow scroll: the game's name, "made
  by" the user (git author name), the tools (iDosGames, PixiJS, ElevenLabs, Claude), a thank-you line, then the
  run's stats (time played over all runs, cases opened, best drop, CLOUT earned). Skippable after 5 s. Then the
  prestige screen ("THE END — Run 4 again, boosted").
- Campaign stats needed for the credits are kept in the meta (lifetime opens, total play time, best drop).

### 7.5 Stage 5 in Run 4
Run 4 is where Unhinged is reached by play. Check that stage 5's layers (warp, gold rain, glitch overlays, strobe
under the flash gate) all run at Run 4's drop rates within the frame budget (p95 ≤ 20 ms on the dev laptop).

## 8. F7 — server meta (iDosGames)

The run stays client-simulated (base spec §10.1). The Title holds what lasts across runs, so it survives a new
browser or device and shows in the lobby.
- **Currency `CLOUT`**, **item catalog `Trophies`** (one item per Covert and ★ skin of all 9 cases, the vault
  legends and ★ Singularity), **leaderboard `best_run`** (score = `floor(log10(lifetimeEarnings) × 1000)`).
- **CloudCode:** `reportTrophy`, `endRun` (grants CLOUT, submits the score, plausibility caps), `buyPerk` (spends
  CLOUT, writes perk levels to ReadOnly user data), and `saveMeta`/meta read for loops, charms and campaign stats.
- **Client:** CLOUT and perks come from the server when it answers; the local meta is a cache and the fallback when
  offline (actions queue and retry). A failed call never blocks play.
- **Lobby:** the stock Trophy Case (inventory), Leaderboard and Profile modules, if they install cleanly in this
  project; otherwise a Trophy Case tab inside the game module.
- Configured on `ZVKC34TR-DEV` first, then the live Title once verified. Needs the iDosGames MCP signed in, and the
  matching SDK skills loaded before any SDK code (IDOS.md).

## 9. F8 — Solana

- **Must:** sign in with a Solana wallet (the Title's blockchain config on Solana; the wallet seam in
  `src/walletLogin.tsx`). Wallet-linked players show on the leaderboard.
- **Spike (devnet):** withdraw a ★ trophy as a Solana NFT (`client.blockchain.requestNFTWithdrawal`). Cut if it
  doesn't work in the spike; the reason goes in the feature history.
- Guardrail kept: cases are bought only with in-game cash, never crypto.

## 10. F9 — ship

- Balance across all 4 runs with both timing profiles (§5), the whole campaign under ~45 min CASUAL.
- A final browser pass: every run, each vault and The Last Case, the credits, the tutorial, EN and RU, desktop and
  portrait, frame times at Run 4's top rate.
- Feature history: one file for this work (`casecremental-finish.md`) and its README line; the memory updated.
- Merge `casecremental-m3` and `casecremental-finish` into `master`. No deploy (not asked).

## 11. Testing

As in M1–M3: sim rules test-first (Vitest), pure fx/ui rules tested, layouts swept over viewports, the pacing
tests as the balancing tool, browser checks through the scratch harness at the end of each phase. Typecheck, the
full test suite and the build stay green at every commit.
