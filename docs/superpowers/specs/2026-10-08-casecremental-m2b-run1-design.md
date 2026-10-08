# Casecremental — M2b: Run 1 complete (design)

- **Date:** 2026-10-08 · **Status:** approved in chat, for written review
- **Builds on:** base spec `2026-10-07-casecremental-design.md`, campaign amendment
  `2026-10-08-casecremental-campaign-and-table-design.md` (§6.0 review changes, §6.1 day job), M2a look spec.
- **Amends the campaign spec:** the run-1 "auto-seller" machine becomes **the bot as a seller** (§3 here);
  multi-open grows per run ×2 / ×3 / ×5 (§5 here). Where this document and the campaign spec disagree, this
  document wins.

## 1. Goal

A complete, replayable **Run 1** (6–10 min): open cases by hand, wake the bot to carry drops to the bin, claim
the good ones from the tray, unlock all three cases, buy **Vault Case I**, watch its finale, and go through a
real **prestige** into a fresh, boosted Run 1. Progress survives a reload. Content is **divided across the four
runs** (user): Run 1 gets only its share, so later runs still bring new things.

## 2. Content across the runs

| | Run 1 (M2b) | Run 2 (M3) | Run 3 (M3) | Run 4 (M4) |
|---|---|---|---|---|
| Bot | wakes as **seller**, Speed ×1 → ×8, Threshold | its own reel (second opener), Speed → ×20 | fed by the auto-buyer, → ×50 | evolutions |
| Multi-open (your bench) | ×2 | ×3 | ×5 | — |
| Charms | pool of 8, 1–2 slots | more | more | all 14 |
| Machines | day job, claim tray | locker + trade-ups | auto-buyer grid (10 × 5) | — |
| Cases | Boot Camp, Wildwood, Bedrock + Vault I | + Mainframe, Neon Nights | + Deep Space, Inferno | + Glitch, Fever Dream |

Upgrade caps are per run: a level beyond the run's cap is shown locked ("next run").

## 3. The bot as a seller

- **Asleep at the start** of a fresh campaign (as now). **Wake** it in the Bot tab (~$80, tuned by pacing) — a
  station reveal: lamp flicker, eyes open, a stretch, a beep; its reel stays OFFLINE until Run 2.
- **Job loop** (a state machine in the sim, so it is deterministic, pacing-tested and saved):
  `idle → toBench → pickUp → toBin | toTray → drop → back → idle`. It starts when a revealed card waits on
  your bench and you haven't taken it. Each step's duration = base duration ÷ Speed.
- **Threshold** (Bot tab setting): the rarities it may sell — default Mil-Spec … Classified. Anything above (Covert,
  ★) it carries to the **claim tray**.
- **Speed** upgrade: 6 levels in Run 1, ×1 → ×8 (geometric).
- **You still win by hand:** a card you drag to the bin sells instantly and feeds the combo; the bot's sales don't
  feed the combo. If you grab the card while the bot is walking, it turns back.
- **Tray full:** the bot puts the card back on the bench, stops and taps its foot until a slot frees.
- Visuals: the bot walks along the table front (whole-pixel steps, `bot-open` frames + walk timing), carries the
  card above its head, drops it in the bin (bin swallow) or the tray.

## 4. Claim tray

- 12 slots along the front edge (the existing tray sprite); each held skin shows as a small card.
- Drag a tray item to the SELL bin to sell it (feeds the combo); drag it back onto the bench does nothing.
- Capacity: 12 base, +4 per "Bigger tray" perk level.
- Tray items survive into the vault finale and are auto-sold at prestige (their value counts toward CLOUT).

## 5. Multi-open ×2 (your bench)

- "Multi-open" upgrade on the You tab (Run 1 cap: ×2). One purchase buys and opens 2 cases together.
- The reel window grows taller and shows **stacked reels** (2 in Run 1), each landing its own drop with its own
  tease. Cards pop up side by side; you drag them, or the bot carries them off one at a time.
- Price of an open = price × count. Multi-open never applies to the vault.

## 6. Day job

As campaign spec §6.1: broke with an empty bench → a DAY JOB button (≈3 s shift: 90 % +$2, 10 % "NO PAY"),
replacing the free-case timer.

## 7. Vault Case I

- Appears on the shelf once Bedrock is unlocked. Price: the run's last goal, tuned so a first Run 1 reaches it at
  about minute 8–9; every completed loop raises it (×`VAULT_GROWTH`).
- **Finale (cinematic, ~20 s, hands-off):** full Cyberpsychosis — every effect at once (stacked reels spinning,
  cases raining onto the table, the bot frenzied, chromatic tear, music to the max). The player's clicks only
  add sparks; nothing depends on input. It ends in silence, the vault opens on **one legendary drop** shown with
  the b-roll showcase, which becomes the **Vault I ★ trophy** (kept forever).
- Then the prestige screen.

## 8. Prestige

1. **Payout:** CLOUT = f(lifetime earnings of the run) (base spec §9.5; tuned so a first vault pays enough for
   1–2 perk levels).
2. **Charms for the next run:** offered 3 at random from the Run-1 pool, pick 1 (2 with the slot perk):
   Lucky Seven, Rust Bucket, Pity Jar, Double Tap, Ricochet, Gold Rush, Insider, Mil-Spec Maniac (rules: base
   spec §8.1). Held back for later runs: Chain Reaction, Fever, Collector's Eye, Loaded Dice, Contract Killer,
   Hoarder.
3. **Meta perks (CLOUT):** Starting cash, +Luck, +1 charm slot (max 2 in M2b), Bot starts awake, Bigger tray.
4. **Catch-up boost (automatic):** each completed vault multiplies all sell values permanently, so the next Run 1
   reaches the previous end state in 1–2 minutes.
5. "Start next run" → a fresh Run 1 (cash, upgrades, bot level, combo, intensity reset; perks, charms for this
   run, trophies, CLOUT, loop count kept).

## 9. Saving

- A versioned local save (`localStorage`, one key) of the **meta** (CLOUT, perks, trophies, loop count, charms
  chosen for the coming run) and the **run in progress** (sim state incl. RNG state, bench, bot, tray).
- Written ~once a second and on key events (sell, unlock, vault, prestige); restored on start. A broken or
  older save never crashes the game: it is discarded with a console warning (versions migrate where cheap).
- Settings → "Reset progress" (dev builds only in M2b). M4 moves the same data to the server.

## 10. Pacing (tests, base spec §13 extended)

- First Run 1 (greedy human-speed bot player, reveal reaction 0.25 s): vault bought at 6–10 min.
- Bot awake by ~2 min; with the bot at ×8 and a human-speed player, the tray never stays full for long.
- A boosted second Run 1 (one perk + catch-up): reaches the previous end state in 1–2 min, vault again by ~5–7 min.

## 11. Testing

Sim (Vitest, pure): the bot state machine (each transition, speed scaling, threshold routing, tray-full wait,
hand-grab cancels), tray capacity and claims, multi-open (2 drops, price × 2, independent teases), day job odds
and the shift timer, vault availability and price growth, finale producing exactly one legendary drop, prestige
(CLOUT formula, resets vs keeps, charm offer 3-pick-1 from the pool, perk effects, catch-up multiplier), each of
the 8 charms' rules, save/load round-trip and a corrupt/old save being discarded safely, pacing. Rendering:
browser checks (bot walk + carry, stacked reels, tray drag, finale, prestige screen) with the dev board.

## 12. Out of scope (later runs)

The bot's own reel, locker, trade-ups, Upgrader, auto-buyer grid, cases 4–9, evolutions, server save and CLOUT,
leaderboard, the remaining 6 charms.
