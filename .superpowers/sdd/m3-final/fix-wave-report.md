# M3 final fix wave
- Minor 2: bigReveal(j, rarity, zoom, opts?: {time?: boolean}); time:false skips hitStop/slowMo/duck (shake/punch/sound/flash kept). GridStation and LockerStation pass { time: false }; bench call (benchFx) unchanged. New test added; existing order test passes.
- Minor 3: runs-2-3 doc corrected (every run starts at level 0; only the cap is per run).
- Minor 1: run1 doc updated to VAULT_PRICES (1.2M / 2B / 420B, VAULT_GROWTH 3.25) with the 1M -> 1.2M note.
- Minor 6: TICK_CHROME import and export removed.
- Verification: typecheck clean; vitest casecremental 115 files / 1489 tests pass; build ok.
