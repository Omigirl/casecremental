# Casecremental — core loop (milestone 1)

Spec: `docs/superpowers/specs/2026-10-07-casecremental-design.md`. Plan: `docs/superpowers/plans/2026-10-07-casecremental-m1-core.md`.

## What exists
- `src/modules/casecremental/` — the only game module.
- `sim/` — pure, seeded simulation: cases 1–3 (39 skins), rarity/wear/StatTrak rolls, Luck / Appraiser / Quick Hands, case unlocks, combo, anti-softlock free case, heat → intensity stages with hysteresis.
- `game/` — `GameController` (fixed 30 Hz step, frame clamp 0.25 s, `act()` as the single input path), the UI view model and the agent surface.
- `fx/` — Pixi v8 scene: reel with near-miss strips and a brake, bench with drag-the-key / drag-to-sell (taps work too), procedural skin textures, juice (sparks, coins, synth sfx, shake, hit-stop on Covert, slow-mo + zoom on ★, stage 1–2 look).
- `ui/` — React HUD (cash, stage, combo, next-goal bar) and shop panel.

## Decisions the code doesn't show
- The run is simulated in the browser (spec §10.1); nothing persists yet — a reload starts over until milestone 4.
- Every balance number is in `sim/tuning.ts`; `sim/pacing.test.ts` (greedy bot, median of 5 seeds) guards the first-run timeline. Tune numbers, not logic.
- Near misses are visual only: the sim rolls first, the strip is built around the result.
- All names are original parodies; no Valve/CS marks.
- `package.json` pins `viem` to 2.55.19 via `overrides`: the scaffold's wagmi 3.7.2 imports `viem/tempo/zones`, which later viem releases removed. Lift the pin only together with a wagmi upgrade.
- The game loop pauses while the tab is hidden (scene suspend / RAF); there is no offline progress yet.
