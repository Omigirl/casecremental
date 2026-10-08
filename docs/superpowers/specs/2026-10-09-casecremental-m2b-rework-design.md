# Casecremental — M2b rework: bot opens, auto-seller sells, a real vault (design)

- **Date:** 2026-10-09 · **Status:** approved in chat (user, after playing M2b-A/B)
- **Amends:** `2026-10-08-casecremental-m2b-run1-design.md` (§2–§4, §7) and restores the campaign spec's
  §3.5 (auto-seller + claim tray in run 1). Where they disagree, this document wins.
- **Why:** in play, "the bot sells" read wrong — the bot has its own reel above its station, so it should open
  cases; selling belongs to the auto-seller machine left of the tray. And the vault finale was underwhelming:
  it just started on its own, looked "down to earth" and had no music.

## 1. Who opens, who sells (Run 1)

- **You** open your own cases and sell your drops by hand (drag to the SELL bin) — hand sales feed the combo.
- **The bot opens its own cases** once woken (Bot tab, ~$22, tuned by pacing): idle and with nothing waiting at
  its station, it buys a case (the best one you can afford, or the one chosen on the Bot tab), pays from your
  cash, and spins it on **its own reel** above its station. Its drop lands as a card at its station. Until the
  auto-seller is on, **you sell the bot's card by hand** (drag it to the bin; feeds the combo); the bot does not
  open again while its card waits. Bot **Speed** (×1 → ×8 over 5 levels in Run 1) makes its spin faster.
  The bot uses Luck and charms like you do; it has no tease crawl (its reel is the background show).
- **The auto-seller** (the machine left of the claim tray) is **unlocked in Run 1** on the Machines tab
  (~$150, tuned by pacing; the Machines tab opens for it). Once on, any card left waiting — yours on the bench
  or the bot's at its station — is taken after a short hold (longer for Covert/★ so their reveal plays) and:
  sold if it is at or below the auto-seller's **threshold** (no combo), else put in the **claim tray** (you claim
  it by hand: drag to the bin or tap). Tray full → the card stays where it is. Grabbing a card stops the
  auto-seller from taking it. Auto-seller **Speed** (4 levels) shortens the hold.
- Hand-selling is still worth it: the combo only grows from your own sales and claims.
- The bot no longer walks or carries anything.

## 2. Content across the runs (replaces M2b spec §2)

| | Run 1 | Run 2 | Run 3 | Run 4 |
|---|---|---|---|---|
| Bot | opens its own cases, Speed ×1 → ×8 | Speed → ×20, multi-open ×2 on its reel | fed by the auto-buyer, → ×50 | evolutions |
| Your multi-open | ×2 | ×3 | ×5 | — |
| Machines | day job, auto-seller + claim tray | locker + trade-ups | auto-buyer grid (10 × 5) | — |

Everything else in that table (cases, charms) is unchanged.

## 3. Intensity stages and music

- Stage 5 is renamed **"Unhinged" / «Без тормозов»** ("Cyberpsychosis" didn't fit the game).
- **A music loop for every stage** (1–5), same tempo and key so they crossfade on bar lines; the vault has its
  own suspense loop and fanfare; the prestige screen its own loop. A **stage-up** sound plays on every rise.

## 4. Vault Case I — the last-chance ticket (replaces M2b spec §7)

1. **Buying it takes the screen** (like Scritchy Scratchy's last-chance ticket): every panel and the HUD fade
   out, the room dims, the bot freezes, the music drops to a dark **suspense loop**. The vault's price is paid.
2. **The vault slams into the centre** of the screen — big (HD-scaled art), heavy, glowing at its seams, with a
   rumble. Beside it floats the **devilish key** (its own animated sheet: pulsing runes, flames, embers, a
   whisper and a wicked laugh). The player **opens it by hand**: drag the key into the lock (no timer; a tap
   on the key does it too). A reload here waits for the key again.
3. **It opens like a legendary chest** (Vampire Survivors): the lock spins, chains snap, light bursts through
   the cracks, a golden column of light rises, coins fountain up, fireworks go off, and the **fanfare** plays.
   **Five reels** spin stacked in the centre and land one by one on the fanfare's beats, each drop rarer than the
   last; the **fifth is the legendary** — Vault I's own ★ with an **animated texture** (a flowing pattern plus
   the knife's turn), shown with the b-roll showcase. It becomes the **Vault I ★ trophy**.
4. **Payout:** the five drops pay into the run (counted for CLOUT), and the claim tray is sold.
5. **Then a smooth blackout** (~2.5 s fade to black, a deep boom fading out) and the **prestige screen** over
   the black, with its own music.
6. **Start next run → the room powers back up like an old workshop:** from black, the light sources come on one
   by one with flickers — the lamp first, then the reel windows, the bin glow, the station lights — over ~4 s,
   with flicker and breaker sounds, and then the music.

Sim: the vault has a phase — `key` (waiting for the player) → `opening` (a fixed ~24 s timeline whose reel
landings are sim events at fixed times, so the canvas syncs to them and a reload resumes) → run over. Every
action except turning the key is refused while the vault is out.

## 5. Multi-open ×2 (your bench) — unchanged from M2b spec §5, built on the same stacked reels as the vault.

## 6. Saving

The save format changes (the bot and auto-seller state): `SAVE_VERSION` 2; an older save starts fresh with
the usual warning (dev builds only so far).

## 7. Pacing (tests)

- Bot awake by ~2–2.5 min; auto-seller on by ~3–5 min; first vault bought at 6–10 min (aim ~8);
  a boosted second run catches up in 1–2 min and vaults again by 5–7 min.

## 8. Assets (ElevenLabs, approved by the user: up to ~18k credits)

- Art: `vault-case` (4 frames: locked, glowing, bursting, open), `devil-key` (4-frame pulse).
- Music: `music-3`, `music-4`, `music-5`, `vault-suspense` (loop), `vault-fanfare` (~30 s one-shot), `prestige`
  (loop).
- Sounds: bot-reel-spin, bot-wake, seller-power-on, seller-sell, dayjob-work/pay/nopay, tray-store,
  vault-slam, vault-rumble, devil-key-whisper/laugh, vault-lock-spin, chain-snap, light-burst, coin-fountain,
  firework, vault-reel-land, legendary-choir, blackout, light-flicker, light-on, charm-pick, perk-buy, run-start,
  stage-up, reel-spinup.
