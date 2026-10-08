# Casecremental — Run 1 complete (M2b)

What a full Run 1 is and the calls behind it. Spec: `docs/superpowers/specs/2026-10-08-casecremental-m2b-run1-design.md`;
plans M2b-A (logic) and M2b-B (on screen). Multi-open ×2 is plan M2b-C.

## The loop
Open by hand → wake the bot (it sells ordinary drops at the bin and sets the good ones aside in the claim
tray) → unlock Wildwood and Bedrock → Vault Case I → a ~20 s hands-off finale → the vault opens on one ★
(the Vault I trophy) → prestige: CLOUT, pick a charm (3 offered from 8), buy perks → a fresh, boosted Run 1.

## Decisions worth knowing
- **The bot is the seller** (user, M2b brainstorm): it walks to the bench, carries the card, and never feeds
  the combo; grabbing the card turns it back. It is a state machine in the sim (deterministic, saved), and the
  canvas only draws it from state — a reload puts it on the same leg with the same card.
- **Content is split across the four runs** (user): Run 1 has the bot as seller (Speed ×1 → ×8), the tray, 8 of
  14 charms, multi-open ×2 (plan M2b-C). Later runs bring the bot's own reel, the locker, the auto-buyer grid.
- **The finale is a cinematic** (user): nothing in it depends on input, so a player who sits back still sees it.
  Its intensity is read from the sim's finale timer each frame, so a reload resumes it where it was.
- **The day job replaced the free case** (user): broke with an empty bench → a 3 s shift, 90 % +$2.
- **The prestige screen** waits for the vault's showcase only when the player watched the run end; after a
  reload it is up at once.
- **Tuning (pacing tests, medians of 5 greedy players):** bot awake ~2.2 min, first vault ~7.9 min, a
  boosted second run unlocks everything in ~1.4 min and vaults again at ~5.9 min. Wildwood's unlock went
  $40 → $30 so the bot can be woken right after it. Change numbers only in `sim/tuning.ts`.
- **Saving:** one versioned localStorage key, written about once a second, after every action and when the
  page closes; a bad save is dropped or filled in from defaults, never thrown; a held card is never restored
  as held. A run keeps the setup it started with (vault price, boost), so a save from before a retune keeps
  its old prices until the next run.
- **Russian:** CLOUT is «ХАЙП», charms are «талисманы», the day job is «ШАБАШКА».
