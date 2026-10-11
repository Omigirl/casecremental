# Casecremental — M3: Runs 2 and 3 (design)

- **Date:** 2026-10-12 · **Status:** written by the agent; per the user's standing rule, specs and plans are not
  sent for approval ("just finish M3 fully").
- **Builds on:** base spec `2026-10-07-casecremental-design.md`, campaign spec
  `2026-10-08-casecremental-campaign-and-table-design.md`, M2b spec + rework spec (`2026-10-09-…-rework-design.md`),
  vault jackpot spec. Where they disagree, this document wins for Runs 2 and 3.
- **Assets:** the user approved ~4,000 ElevenLabs credits for M3 (§11).

## 1. Goal

The campaign stops being "Run 1 again, boosted". Vault I leads into **Run 2**, Vault II into **Run 3**. Each run
keeps everything earlier runs had and adds its own share of new things, ends with its own vault, and plays in
~1–2 min of catch-up plus ~5–9 min of new content. M3 ends at Vault III: until M4 brings Run 4, the run after
Vault III is **Run 3 again**, boosted, and the prestige screen says Run 4 comes later.

## 2. The campaign

- The run number is derived, not stored: `runNumber = min(loops + 1, LAST_RUN)` with `LAST_RUN = 3` in M3
  (M4 raises it to 4). A run keeps its number in its `RunSetup` (`setup.run`), like its vault price.
- What a run has is one table, `RUN_CONTENT` in `sim/tuning.ts`, read by the sim, the view and the greedy player:

| | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Cases on the shelf | Boot Camp, Wildwood, Bedrock | + Mainframe, Neon Nights | + Deep Space, Inferno |
| Vault | Vault Case I | Vault Case II | Vault Case III |
| Your multi-open cap | ×2 | ×3 | ×5 |
| Bot Speed cap | ×8 (5 levels) | ×20 (8 levels) | ×50 (11 levels) |
| Bot multi-open | — | ×2 | ×2 |
| Machines | day job, auto-seller + tray | + locker & trade-ups | + auto-buyer grid, auto contract |
| Charm pool (offered for that run) | 8 (as now) | + Chain Reaction, Contract Killer, Hoarder | + Fever, Collector's Eye |

- **Caps per run** (M2b spec §2): a level beyond this run's cap shows **NEXT RUN** instead of a price when a later
  run raises it, and **MAX** when no run does.
- **Machines of later runs** sit dark on the table before their run (campaign spec §3.6): the locker is an unlit
  cabinet in Run 1; the grid zone is dark in Runs 1–2. Their Machines-tab rows are hidden until their run.
- The rework spec's "Run 3: the bot is fed by the auto-buyer" is dropped: the grid opens its own cases, and the
  bot keeps buying its own (the grid does the "fed" job better).
- The Upgrader and Loaded Dice stay out (M4).

## 3. Cases 4–7

Thirteen skins each (5 Mil-Spec, 3 Restricted, 2 Classified, 2 Covert, 1 ★), original parody names, each case a
**richer technique** than the one before (base spec §4.3), and more of each case **moves** (spec: animated skins —
motion plays on the reveal card, never on the reel):

| # | Case | Patterns (new kinds) | Motion |
|---|---|---|---|
| 4 | Mainframe | `circuit` (traces + pads), `hex` (hex grid, lit cells), `carbon` (woven fibre) | Classified+ `pulse` (traces light up) |
| 5 | Neon Nights | `synthgrid` (perspective grid + sun), `neonline` (glowing strokes on black), `hueflow` (flowing hue bands) | Restricted+ `flow` |
| 6 | Deep Space | `starfield`, `nebula`, `aurora`, `iridescent` | every skin `sparkle`; Restricted+ `flow` / `shimmer` |
| 7 | Inferno | `flame` (rising fbm tongues), `ember` (glowing specks on char), `molten` (flowing cracks) | every skin moves: new `rise` (pattern scrolls upward) or `flow` |

★ knives: Mainframe "Blue Screen", Neon Nights "Prism", Deep Space "Starforged", Inferno "Forgeheart" — all with
`flip`. Full skin lists are in plan M3-A. Prices follow the ladder (×10 per case, unlock ≈ 8–10× price, tuned by
pacing): Mainframe ~$1.5K, Neon Nights ~$15K, Deep Space ~$150K, Inferno ~$1.5M. Case boxes get sprite sheets like
cases 1–3 (§11).

## 4. The bot's second reel (Run 2+)

- **Bot multi-open ×2** (Bot tab, one level, Run 2+): one bot spin buys up to two of its case (as many as you can
  afford, like yours) and spins them on **two stacked reels** in its window (the bench's stacked-reel code). Two
  cards land side by side at its station; you sell them by hand one by one (combo), or the auto-seller takes them.
  It opens again once both are gone.
- Sim: `bot.card` becomes `bot.cards: (Drop | null)[]`; a held bot card has a slot like a bench card.
- **Speed** continues its table: ×1, 1.5, 2.3, 3.5, 5.3, **8** (Run 1 cap), 11, 15, **20** (Run 2 cap), 28, 38,
  **50** (Run 3 cap). The bot keeps no tease crawl.

## 5. The locker and trade-ups (Run 2+)

**The locker** is a station bought on the Machines tab (Run 2+, ~when Mainframe is in reach; tuned). It stands on
the table's front edge between the claim tray and the SELL bin; a powered-on reveal (light + sound) like the
auto-seller's. Its front shows five rarity lamps with counts (HD text). Capacity: 20 skins, "Bigger locker" +10 per
level (3 levels).

- **In:** drag any waiting card — yours, the bot's, a tray item — onto the locker: it is kept (a hand action, so it
  feeds the combo like a sale). The auto-seller gains a **Collect** setting (Machines tab: off / Mil-Spec /
  Restricted / Classified / Covert): cards of exactly that rarity go to the locker instead of being sold or trayed,
  while it has room; when it is full the usual rule applies.
- **Trade-up contract** (base spec §8.3, CS rules): ten skins of one rarity (not ★) → one skin of the next rarity.
  - The result's case is drawn from the ten inputs weighted by count (nine Boot Camp + one Neon: 10 % Neon), the
    skin uniformly among that case's skins of the next rarity; float = the mean of the inputs' floats (so Factory
    New in, Factory New out); StatTrak only if all ten were StatTrak.
  - It pays its normal value × `TRADE_UP_BONUS`, tuned so a contract returns ~1.5× what its inputs would have sold
    for on average (a test pins the ratio in 1.3–1.8 for every rarity step).
  - **Pressing it:** a TRADE UP button lights on the Machines tab (and a tap on the locker does it) when ten of a
    rarity are in; the oldest ten of the lowest such rarity go in. The press runs `TRADE_UP_SECONDS` (~2.5 s): the
    cards fly in, the press stamps, and the result pops up as a card **on the locker** — a third card spot
    (`CardSpot = "bench" | "bot" | "locker"`). Covert gets the red reveal, ★ the knife showcase. Sell it by hand
    (combo), drag it back into the locker, or the auto-seller takes it after its hold.
  - Contract Killer (charm): 20 % of contracts give two results (both on the locker, side by side).
- **Run 3: Auto contract** (Machines tab, one purchase): the press runs on its own whenever ten of the Collect
  rarity are in and its spot is clear.
- At the vault, whatever is in the locker is auto-sold with the tray (counts toward CLOUT).

## 6. The auto-buyer grid (Run 3+)

- Bought on the Machines tab (Run 3+, only once the auto-seller is on — its drops need an output). Lives in the
  dark **grid zone** in the middle of the table, between and behind the two benches: a board of tiny code-drawn case
  cells (each in its case's colour), 10 columns. Powered-on reveal.
- **Ticks:** on the case shelf each unlocked case gets a tick box; a gold frame marks the ticked ones (campaign spec
  §3.1). The buyer fills empty cells with ticked cases, round-robin. With nothing ticked it buys the dearest case
  it may.
- **Budget:** it buys only while the case costs at most `(1 − reserve) × cash`; Reserve is a free setting
  (25 / 50 / 75 %, default 50 %), so it never empties your cash or blocks your bench or the vault.
- **Rate:** one purchase every `GRID_BUY_INTERVAL[level]` s (Rate upgrade, 4 levels). A filled cell flickers open
  `GRID_OPEN_SECONDS` later, rolling its drop with Luck and charms (no tease). **Size** upgrade: 10 → 20 → 30 → 50
  cells (rows of ten).
- **Output:** each drop goes straight through the auto-seller's rules (sell ≤ threshold, Collect → locker, else the
  tray). Tray full → that cell keeps its drop and stays lit, and the grid stops buying until the tray has room.
- **Visual budget** (base spec §9.3): an ordinary drop is a rarity-coloured flash in its cell and a coin spark to the
  HUD; a Classified a bigger flash; **Covert and ★ break out** into a full-size card reveal over the table (the red
  reveal / the knife showcase), at most one at a time, the rest queued for at most a few seconds then shown as
  flashes.
- Grid drops never feed the combo; they count as reveals for heat (that is how Run 3 reaches Tripping).

## 7. Vaults II and III

Same last-chance ticket and the same 17.4 s timeline (the intro and fanfare are cut to it), parametrised by a
`VaultDef` per run (`sim/content/vaults.ts`):

| | Vault I | Vault II | Vault III |
|---|---|---|---|
| Rewards from | Bedrock | Neon Nights | Inferno |
| Legend ★ (animated) | Event Horizon | **Overdrive** (neon `hueflow` + flip) | **Supernova** (`nebula` flow + flip) |
| Chest art | `vault-case` | `vault-case-2` (chrome + neon seams) | `vault-case-3` (obsidian + molten seams) |
| Beam colours | yellow / orange / red | cyan / magenta / violet | white-gold / orange / blue |
| Fanfare | `vault-fanfare-1` | re-cut +2 semitones | re-cut +4 semitones |
| Chaos | as now | ×1.5 fireworks, denser streams | ×2 fireworks, densest streams |

- **Each one wilder** comes from count and density only. The photosensitivity rules are hard limits and are
  unchanged: at most three full-screen flashes a second, every beat-throbbing light changes by less than 0.1.
- The fanfares are built with ffmpeg from the existing take (recipe in `art/manifest.json`), no credits; the
  user's intro is reused unchanged.
- Vault price per run (`VAULT_PRICE` by run) and growth on replays are tuned by pacing.

## 8. Prestige and the next run

- The prestige screen names the next run ("NEXT: RUN 2") and lists what it brings (new cases, machines). After
  Vault III: "RUN 4 COMES IN A LATER UPDATE — RUN 3 AGAIN, BOOSTED".
- Charm offers come from the coming run's pool. Charm slot perk: max level 2 (3 slots).
- New charms (base spec §8.1): **Chain Reaction** (each Classified+ has a 25 % chance to open a free case of the
  same type, queued for your bench like Ricochet's), **Contract
  Killer** (§5), **Hoarder** (+1 % sell value per skin in the locker), **Fever** (intensity stage +1; all payouts
  ×1.5), **Collector's Eye** (once you have revealed every skin of a case this run, that case's skins pay ×2).

## 9. Saving

`SAVE_VERSION` 4: `setup.run`, `bot.cards`, the locker, the press, the grid. A version-3 save migrates: its run in
progress is a Run 1 (the only run that existed), the bot's single card becomes `cards: [card]`, and there is no
locker or grid; the next run's number then follows from the meta's loops.

## 10. Pacing (tests, base spec §13 extended)

The greedy player learns the new machines (wakes and upgrades the bot incl. its multi-open, buys the locker, sets
Collect to Mil-Spec, presses trade-ups, buys the grid, ticks every unlocked case). Medians of five seeds; the runs
chain (Run 2 starts from a meta that opened Vault I with Run 1's earnings, cheapest perk bought; Run 3 likewise).

| | Target |
|---|---|
| Run 1 | unchanged (every current pacing test stays green) |
| Run 2 | Run 1's cases all unlocked in 1–2 min; locker by ~2–4 min; Vault II bought at 6–10 min; reaches stage 3 |
| Run 3 | Run 2's cases all unlocked in 1–2 min; grid by ~2–4 min; Vault III bought at 6–10 min; reaches stage 4 |
| Replay of Run 3 | catches up in 1–2 min, vaults again by 5–7 min |
| Tray | never stuck full for more than 10 s in any run |

## 11. Assets (approved ~4,000 credits)

- **Art** (ElevenLabs `gpt-image-2` with `art/style/bot-reference.png` wired in; ~185 credits per image, about two
  takes each), built by `npm run art`:
  `case-mainframe`, `case-neon`, `case-deepspace`, `case-inferno` (4-frame sheets like cases 1–3), `locker`
  (4 frames: dark, lit, press down, door open), `auto-buyer` (the grid's hopper/frame, 2 frames: off, on),
  `vault-case-2`, `vault-case-3` (4 frames like `vault-case`).
- **Sounds** (~50 credits each, two variants): `locker-power-on`, `locker-store`, `tradeup-press`,
  `tradeup-reveal`, `grid-power-on`, `grid-buy`, `grid-open`, `grid-breakout`.
- No new music: the stage loops 1–5 already exist; the vault fanfares are re-cut (§7).
- Missing art still renders as the magenta placeholder (never a crash), so code never waits for assets.

## 12. Dev tools

Settings → dev only: **START RUN 2 / START RUN 3** (sets the meta's loops and starts that run fresh, keeping CLOUT
and perks) and a cash cheat, so each run can be tried without playing the ones before it.

## 13. Testing

Sim (Vitest): run content gating and caps per run; each new case's table; bot ×2 (two cards, afford-limited,
one-by-one sales, waits for both); locker in/out, capacity, Collect routing, full-locker fallback; contract rules
(case weighting, float mean, StatTrak, bonus ratio over a seeded sample, Contract Killer); auto contract; grid
(ticks round-robin, reserve, rate, size, tray-full stall, heat); each new charm; vault defs per run (drops from the
run's top case, the run's trophy); save v3 → v4 migration and v4 round-trip; pacing for Runs 2, 3 and a Run 3 replay.
Rendering: unit tests for the new pattern kinds (deterministic, in palette, the `rise` loop seamless), layout tests
for the locker and grid rects over the existing viewport sweep (no overlap with reels, mats, cards, tray, bin;
portrait included), vault beam colours per vault, photosensitivity tests over every vault def. Browser checks with
the dev buttons: each run's new station reveal, a trade-up, the grid at full size, Vaults II and III.

## 14. Out of scope

Run 4, The Last Case, evolutions, the Upgrader and Loaded Dice, server meta (CLOUT, trophies, leaderboard),
Solana — M4.
