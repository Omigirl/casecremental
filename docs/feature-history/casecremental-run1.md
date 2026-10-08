# Casecremental — Run 1 complete (M2b)

What a full Run 1 is and the calls behind it. Spec: `docs/superpowers/specs/2026-10-08-casecremental-m2b-run1-design.md`;
plans M2b-A (logic) and M2b-B (on screen). Multi-open ×2 is plan M2b-C.

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
- **The vault is a last-chance ticket** (user, after the first finale felt "down to earth"): buying it takes
  the screen (UI hidden), the player turns a devilish key by hand, the vault opens like a legendary chest
  (fanfare, golden column, coins, fireworks, five reels landing on the fanfare's beats — the fifth is Vault I's
  own animated ★, "Event Horizon"), then a smooth blackout, the prestige screen over black with its own music,
  and the next run's lights stutter back on. The opening is a fixed sim timeline, so a reload resumes it.
  The vault's reels live in their own transparent pixel layer inside the vault scene (the scene's dim would hide
  them in the main world); the UI fades back 3.4 s into the next run, and the power-up is silent until the lights
  are on. After a lobby trip the music is re-derived from the sim (musicPlan), so the fanfare resumes in step with
  the reels.
- **The day job replaced the free case** (user): broke with an empty bench → a 3 s shift, 90 % +$2.
- **The prestige screen** waits for the vault's showcase only when the player watched the run end; after a
  reload it is up at once.
- **Tuning (pacing tests, medians of 5 greedy players):** bot awake ~2.2 min (132 s), auto-seller ~2.7 min
  (162 s), first vault ~8.1 min (487 s, VAULT_BASE_PRICE $1M), a boosted second run unlocks everything in
  ~67 s and vaults again at ~375 s. A first vault pays ~13–15 CLOUT (CLOUT_DIVISOR 105). Wildwood's unlock
  went $40 → $30 so the bot can be woken right after it. Change numbers only in `sim/tuning.ts`.
- **Saving:** one versioned localStorage key, written about once a second, after every action and when the
  page closes; a bad save is dropped or filled in from defaults, never thrown; a held card is never restored
  as held. A run keeps the setup it started with (vault price, boost), so a save from before a retune keeps
  its old prices until the next run.
- **Russian:** CLOUT is «ХАЙП», charms are «талисманы», the day job is «ШАБАШКА».
