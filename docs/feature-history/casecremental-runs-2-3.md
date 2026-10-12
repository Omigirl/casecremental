# Casecremental — Runs 2 and 3 (M3)

Spec: `docs/superpowers/specs/2026-10-12-casecremental-m3-runs-2-3-design.md`. Plans M3-A (sim), M3-B (skin
patterns, see `casecremental-look.md`), M3-D (on screen) and M3-E (vaults) in `docs/superpowers/plans/`.

## The sim (M3-A)

- **The run number is derived, never stored on its own:** `runNumber(loops) = min(loops + 1, LAST_RUN)`
  (`sim/campaign.ts`). After Vault III comes Run 4; The Last Case replays Run 4 (see `casecremental-finish.md`, F6).
  The run's `setup.run` is written when the run starts, so a save knows which run it is.
- **`RUN_CONTENT` (`sim/tuning.ts`) is the one table of what each run has:** the number of cases on the shelf (3/5/7),
  multi-open cap (×2/×3/×5), bot speed levels (5/8/11 → ×8/×20/×50), bot multi-open, locker, auto contract.
  - Every run starts with all upgrades at level 0 (sim/run.ts); only the level cap is per run.
  - A row at its run's cap shows "NEXT RUN" instead of MAX, so the player sees there is more later.
  - The prestige screen lists what the next run brings from the same table (`ui/prestigeRules.ts`).
- **The locker presses ten skins of one rarity into one of the next, by CS trade-up rules** (`sim/locker.ts`):
  - the case is drawn from the inputs weighted by count;
  - the float is the inputs' mean; StatTrak only if all ten were;
  - the value is the normal value × `TRADE_UP_BONUS[input rarity]`. The bonus is tuned so a contract returns about
    1.5× what its inputs would sell for; without it a contract loses money and nobody presses.
  - Results are rolled when the press starts, so a reload mid-press ends the same way.
  - The auto-seller's Collect setting routes one rarity into the locker (never ★).
  - Run 3's auto contract presses on its own.
- **The auto-buyer grid was removed in F2; auto-spin replaced it (see `casecremental-finish.md`).**
- **Charm pools are per run** (`CHARM_POOLS` in `sim/charms.ts`):
  - Run 1 offers only charms that work with Run 1's systems;
  - Chain Reaction, Contract Killer and Hoarder come with Run 2; Fever and Collector's Eye with Run 3.
- **Pacing targets** (spec §10, `sim/pacing.test.ts` with the greedy player, 5 seeds) (F4 replaced these with spec §5's GREEDY/CASUAL targets and the 90 s rule, see `casecremental-finish.md`):
  - catching up to the previous run's shelf takes 1–2 min;
  - Vaults II and III open at 6–10 min.
- **`VAULT_GROWTH` is 3.25, not 4:**
  - a replay sells ×3 (`CATCH_UP_PER_VAULT`), and by Run 3 every upgrade is cheap but bought one click at a time, so
    a ×4 vault made the replay slower than the run it replays;
  - so each replay loop is only slightly harder than the last;
  - getting 4 back would need run-scaled upgrade costs.
  - Vault prices: see `casecremental-finish.md` for the current prices.
- **The save is version 4** (F2 moved it to 5, see `casecremental-finish.md`). A v3 save is migrated: the bot's
  single card becomes `cards: [card]`, and the setup gets `run: 1`. Older saves go through v2 → v3 first.

## On screen (M3-D)

- **The stations live in `fx/stations/`** (bot, locker; `Stations.ts` owns them).
  - Each draws from the sim's state every frame and takes events only for one-shot juice (a stamp, a power-on). The
    reason is reloads and lobby trips: the picture must come back from the save alone.
  - The rules are pure functions (`lockerRules.ts`), so a reload mid-press or mid-open lands on the
    same frame, and a beat that already happened does not replay. `stampCrossed(null, …)` is false after a reload.
- **The layout (Task 2):**
  - The locker stands on the front edge, between the tray and the bin. The tray gave up its right end for it and is
    nine-sliced, so its art ends cleanly before the locker.
  - The locker's results wait on top of the cabinet (`lockerCardSpots`, the card's bottom 6 px into the cabinet). They
    are allowed over the tray's end and the bin's rim, never up into the bot's station.
  - Every viewport is swept in the layout tests.
- **The locker's five lamp rows sit on the cabinet's body**, starting 10 px below the rect's top (`LAMPS_TOP` in
  `lockerRules.ts`).
  - The built art has the press head in the rect's top 12 px. The first layout started the rows at the top: the
    Mil-Spec lamp hung beside the press knob, off the cabinet, and a waiting result covered its count. This was fixed
    in the final browser pass.
  - Re-measure if `locker.png` is rebuilt.
- **The auto-buyer grid was removed in F2; auto-spin replaced it (see `casecremental-finish.md`).**
- **The visual budget.**
  - Coins and sparks are pooled and throttled.
  - **Every full-screen table flash asks the flash gate** (`fx/hd/flashGate.ts`, at most 3 a second). The vault's
    flashes go through the same gate.
- **The shelf's case icon is drawn at `floor(scale / 3)`** (`shelfIconK`). At the full scale, «Мейнфрейм» and
  «Сейф-кейс III» did not fit beside the icon. Since F2, auto-spin's pick box takes its own line under each
  unlocked case.
- **The bot's second reel.** The window holds two stacked reels. The room's bot-reel backdrop is hidden while the bot
  is awake, so no stray frame edge shows behind the stack. In portrait the bot has no reel, only its pair of cards.
- **What the final browser pass found** (2026-10-12, a scratch harness without sign-in plus headless Chrome over CDP):
  - The two fixes: the locker's lamp rows (above), and the prestige charm cards. A word wider than the 10em column
    (Барахольщик, Classified+:) spilled into the next card. The card now hyphenates in the player's language, and
    breaks the word where Chrome has no dictionary.
  - A vault cash-in plays the locker's results into the bin with a swallow and the till. This was accepted.
  - On a window resize PixiJS warns "textureSource destroyed while still bound". This comes from its own filter
    texture pool and happens in Run 1 too, so it is not from M3.

## The vaults (M3-E)

- **Vaults II and III use the same ticket and timeline as Vault I, each in its own look.** The looks are one table,
  `fx/vault/vaultLooks.ts`, keyed by the run's `VaultDef` id (`vaultFor(setup.run)`). Each look holds:
  - the chest sheet: `vault-case-2` is chrome with neon seams, `vault-case-3` is obsidian with molten seams;
  - the beam palette: II is cyan/magenta/violet, III is white-gold/orange/blue;
  - the light tints;
  - the fanfare: `vault-fanfare-2` and `-3` are Vault I's re-cut +2 and +4 semitones. All three are 13.82 s, mean
    -17.3/-17.5/-17.5 dB, and play at Vault I's `TRACK_GAIN`;
  - the chaos density.
- **Each vault is wilder by count and density only:**
  - 2/3/4 firework bursts on the same 14 kicks. More kicks would add full-screen flashes and kick sounds, because the
    flash schedule is built from the kick times. Measured in the browser: every vault fires the same 13 gated
    flashes, none refused, at most 3 in any second;
  - twin items on the beams: 1/1.5/2 per slot. A tighter spacing would break the "less than half a spacing per frame"
    rule;
  - rain and edge sparks ×1/1.5/2.
- **Photosensitivity is tested per vault.**
- **The World sets the vault every frame and before a restore**, so a reload lands in the right look. Checked in the
  browser:
  - a reload at 8 s into Vault II resumes with cyan/magenta/violet beams from the first frame and the landed rewards
    labelled, with no impact replay;
  - a reload at 1.9 s into Vault III picks the intro up and snaps the lid on time.
- **The beam filler is the vault's `sourceCase`, never the last case.** Vault II streams Neon Nights, Vault III
  streams Inferno. The legends are Overdrive (II) and Supernova (III), on the fifth beam.
- **The fanfares were never heard in automation** (the tab is muted). Someone has to listen for each vault's pitch,
  the intro → fanfare hand-off at 3.40 s, and the level match.
