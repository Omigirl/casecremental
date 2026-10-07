# Casecremental — Design Spec

- **Date:** 2026-10-07
- **Status:** Draft for review
- **iDosGames Title:** `ZVKC34TR` (live) / `ZVKC34TR-DEV` (config sandbox)
- **Purpose:** Hackathon demo. Judges play for a few minutes — the first 5–10 minutes must be spectacular. Light Solana integration.

---

## 1. Pitch

A Scritchy Scratchy-style incremental game where the scratch ticket is a **CS-style weapon case**. You open cases by hand, sell the skins, automate the chores, unlock better cases — and the game escalates from a calm, grounded case opening into a **casino-on-drugs sensory overload** ("cyberpsychosis"): jackpots every second, screen shake, gold everywhere, dozens of reels from every direction, like the last minutes of a Vampire Survivors run.

**Genre feel to preserve** (inspirations and what we take from each):

| Game | What we take |
|---|---|
| Scritchy Scratchy | Tactile manual chores that get automated away one by one; short, finishable game |
| Tower Wizard | Starts nearly empty; new systems revealed one at a time; a real ending |
| Megabonk | Stacking items that synergize into absurd late-run scaling |
| CloverPit | Charms that bend the machine's rules — build-crafting, not just +10% |
| Coal LLC | A satisfying manual job that grows into a company of machines |

## 2. Goals and non-goals

**Goals**
- A first run that reaches "cyberpsychosis" and the finale in **~10–12 minutes**.
- Something new revealed roughly **every 2 minutes**.
- Meaningful decisions (charms, trade-ups, Upgrader, bot allocation, prestige timing), not just number-go-up.
- Persistent progress on iDosGames: prestige currency, Trophy Case, leaderboard.
- Solana wallet sign-in; ★ trophy → Solana NFT as a stretch.

**Non-goals**
- Real-money or crypto purchase of cases (legal guardrail — see §11).
- Cheat-proof in-run economy (accepted trade-off of the chosen architecture).
- Multiplayer, chat, trading between players.
- Real Valve/CS names, logos, or skin names — everything is an original parody.

## 3. Core loop

1. **Buy** a case with cash.
2. **Drag the key** into the case lock.
3. **The reel spins** — a horizontal CS-style strip decelerating to a skin. **Click to slam the brakes**: skips the wait; the outcome was already rolled, so stopping never changes it.
4. **Drag the skin** to the **sell bin** (cash) or to the **locker** (keep it for trade-ups / Upgrader).
5. Spend cash on upgrades and new cases. Repeat.

Every manual step (2–4, and buying) has an upgrade that automates it (§6).

**Anti-softlock:** if cash < cheapest case price and the locker is empty, a free Boot Camp case drops every 10 s.

## 4. Skins

### 4.1 Rarity

| Rarity | Color | Base weight | Persists? |
|---|---|---|---|
| Mil-Spec | blue | 79.92% | no |
| Restricted | purple | 15.98% | no |
| Classified | pink | 3.20% | no |
| Covert | red | 0.64% | **yes** (Trophy Case) |
| ★ (knife) | gold | 0.26% | **yes** (Trophy Case) |

Luck upgrades and charms shift weight from lower to higher rarities.

### 4.2 Modifiers
- **Wear (float 0–1):** Factory New (<0.07, ×1.5), Minimal Wear (<0.15, ×1.2), Field-Tested (<0.38, ×1.0), Well-Worn (<0.45, ×0.85), Battle-Scarred (×0.7).
- **StatTrak™:** 10% chance, ×2 value.
- **Value** = case base value × rarity multiplier × wear × StatTrak × upgrades × charms.

### 4.3 Visuals
- **Weapon silhouettes:** 8 hand-made vector shapes (rifle, sniper, pistol, heavy pistol, SMG, shotgun, machine gun, knife). A skin = silhouette + pattern shader + palette.
- **Pattern shaders:** procedural fragment shaders, parameterized per skin (palette, scale, seed, animation speed). Hundreds of distinct skins from a small shader library.
- **Escalation rule:** every new case uses a more sophisticated pattern technique than the previous one, so a later case's Mil-Spec looks better than an earlier case's Covert. Within a case, higher rarity = the theme's showpiece version (more layers, glow, animation).

## 5. Cases

Ten cases; each later case costs ~8–10× the previous one (initial tuning, refined by the pacing test, §13). Each case has ~12 skins (5 Mil-Spec, 3 Restricted, 2 Classified, 2 Covert) plus a case-exclusive ★ knife finish.

| # | Case | Theme | Pattern technique |
|---|---|---|---|
| 1 | Boot Camp | Army | Flat 2–3 color camo: woodland, desert, urban, digital. Static. |
| 2 | Wildwood | Forest | Layered noise: leaves, bark, moss, fern fronds. |
| 3 | Bedrock | Rocks | Marble, granite, crystal veins, lava cracks — first emissive glow. |
| 4 | Mainframe | High tech | Circuit traces, hex grid, carbon fiber — first animated pulses. |
| 5 | Neon Nights | Neon | Synthwave grid, glowing outlines, flowing hue, bloom. |
| 6 | Deep Space | Cosmic | Nebula, parallax starfield, aurora, iridescence. |
| 7 | Inferno | Fire / molten | Animated flame, heat distortion, molten metal. |
| 8 | Glitch | Glitch / vaporwave | Datamosh, RGB split, pixel sorting; the skin itself flickers. |
| 9 | Fever Dream | Psychedelic | Kaleidoscope, fractals, melting; reacts to the current intensity. |
| 10 | **The Last Case** | Everything | The finale (§9). Single purchase per run. |

Case art (the case box itself) follows the theme. ~10 hero images (case boxes, ★ knives, The Last Case) may be generated via the platform's image generation — **price quoted to the user before any generation**.

## 6. Upgrades (cash, in-run)

| Upgrade | Effect | Automates |
|---|---|---|
| Luck | Shifts rarity weights upward | — |
| Appraiser | +% sell value | — |
| Quick Hands | Reel spin 6 s → near-instant | — |
| Multi-open | Reels per open: 1 → 2 → 3 → 5 → 10 → 25 → 50 | — |
| Conveyor | Auto-buys cases of a chosen type | Buying |
| Key Turner | Auto-inserts keys | Opening |
| Auto-seller | Sells everything below a chosen rarity | Selling |
| Locker | Capacity of kept skins | — |
| Bots | Each bot opens cases on its own; **assign bots to cases** (Tower Wizard-style allocation) | Whole loop |
| Charm Slots | 1 → 5 charm slots | — |
| Case unlocks | One-time purchase per case | — |

Costs follow geometric curves. Exact numbers live in a single tuning table in `sim/` and are tuned by the pacing test.

## 7. Stations and the reveal

The screen starts with **one case and a sell bin**. Stations unlock in a fixed sequence, each with a reveal moment (camera pulls back, the new station powers on with sound):

> Sell bin → Upgrades → Locker → Conveyor → Bots → Charms → Trade-ups & Upgrader → Evolutions (first one) → **The Last Case**

Each station is a physical area of the same scene, so mid-game the screen fills with machines (conveyors carrying cases, bots at benches, skins flying into the bin) — the Coal LLC "company" feel.

## 8. Depth systems

### 8.1 Charms (CloverPit / Megabonk)
Limited slots (1→5). Sources: a **charm shop** with 3 rotating offers and a cash reroll, plus a rare **charm drop on the reel** (~0.5% of slots on the strip from case 3 onward). Charms bend rules; synergies drive the absurd late scaling. Initial set (~14):

| Charm | Rule |
|---|---|
| Lucky Seven | Every 7th case opened is Classified or better |
| Rust Bucket | Battle-Scarred sells at Factory New price |
| Pity Jar | Each Mil-Spec gives +1% Luck until a Covert drops, then resets |
| Double Tap | StatTrak chance ×3 |
| Ricochet | Each Covert opens a free case of the same type |
| Chain Reaction | Each Classified+ has 25% chance to open another case (can chain) |
| Gold Rush | ★ drops pay ×10 and trigger a 5 s Golden Hour (all luck ×3) |
| Insider | Cases cost 30% less |
| Loaded Dice | Upgrader win chance +10 percentage points |
| Contract Killer | Trade-ups return two results 20% of the time |
| Fever | Intensity stage +1; all payouts ×1.5 |
| Collector's Eye | Completing a case's skin set this run → that case's skins ×2 value |
| Mil-Spec Maniac | Mil-Spec ×4 value, everything else ×0.5 (build-around) |
| Hoarder | +1% sell value per skin in the locker |

### 8.2 Evolutions (Vampire Survivors)
Maxing two specific upgrades (or one upgrade plus a feat) fuses them into an evolution — a big power jump **and** a visual transformation.

| Evolution | Recipe | Effect |
|---|---|---|
| Slot Machine | Quick Hands + Multi-open | Reels become vertical slot columns; ×3 reels |
| Cartel | Bots + Luck | Bots roll twice and keep the better result |
| Money Printer | Appraiser + Auto-seller | Sales ×3; cash sprays out as a particle torrent |
| Assembly Line | Conveyor + Key Turner | Cases stream continuously; every 100th is a free next-tier case |
| Hot Hand | Luck + manual combo ≥ 50 | Manual combo also boosts rarity |

### 8.3 Trade-ups and the Upgrader
- **Trade-up:** 10 locker skins of one rarity → 1 skin of the next rarity (from the same cases' pools). Automatable later with an upgrade.
- **Upgrader:** stake locker skins worth V, pick a target multiplier ×1.5–×100; win chance = (1 / multiplier) × 0.9. All or nothing. Charms can modify it.

### 8.4 Manual combo
Fast manual opens build a combo multiplier (pitch rises, screen tints). Bots never build combo, so hands-on play stays valuable all run.

## 9. Escalation, prestige and the finale

### 9.1 Intensity
A smoothed value from opens/second, current case tier, and active evolutions. Five stages turn on visual and audio layers:

| Stage | Name | Layers |
|---|---|---|
| 1 | Sober | One quiet reel, tick sounds, muted colors |
| 2 | Buzzed | Glow, particle bursts per drop, rolling coin counter |
| 3 | High | Screen shake, coin fountains, multiple reels, bass thump on Covert |
| 4 | Tripping | Chromatic aberration, hue drift, reels flying in from every edge, slamming "JACKPOT" text |
| 5 | Cyberpsychosis | Warping screen, constant gold rain, glitch overlays, strobe, particle storms from hundreds of drops/s |

### 9.2 Juice (always on)
- **Near-miss creep:** strip composition often makes the reel creep past a ★ by one slot (outcome unchanged — visual only).
- **Hit-stop** (80 ms freeze + bass drop) on Covert; **slow-mo** (world at 20%, camera zoom, the knife fills the screen) on ★.
- Sale values pop off each skin and fly into the cash counter, which pulses.
- A **next-unlock progress bar** is always visible.

### 9.3 Visual budget
The sim rolls every case, but the renderer shows at most **12 live reels**. Everything beyond that becomes particle streams, flying coins and the counter. Every ★ always gets its own reel and a screen-wide moment.

### 9.4 The Last Case (finale)
Unlocked after case 9. Absurdly expensive. Opening it triggers a ~20 s finale: every reel on screen spins at once, the screen tears, everything resolves into one drop — the unique **★ Singularity** trophy (persistent). Then credits, a CLOUT payout, and the run ends.

### 9.5 Prestige ("Come down")
Available any time after case 4. Resets cash, upgrades, bots, charms, locker. Pays **CLOUT** (server currency) based on the run's lifetime earnings. CLOUT buys permanent **perks**: starting cash, start with Conveyor, +Luck, +1 charm slot, faster intensity ramp, keep one charm.

### 9.6 Pacing targets (first run, greedy play)
| Milestone | Target |
|---|---|
| Stage 2 (Buzzed) | ~1 min |
| Stage 3 (High) | ~3 min |
| Stage 4 (Tripping) | ~6 min |
| Stage 5 (Cyberpsychosis) | ~8–9 min |
| The Last Case opened | ~10–12 min |

Later runs reach each milestone faster thanks to perks.

## 10. Architecture

### 10.1 Approach
**Client-simulated run, server-side meta.** The run economy is simulated in the browser at any speed (required for hundreds of opens per second). iDosGames holds only what persists across runs, validated by CloudCode with plausibility caps.

### 10.2 Project layout
Standard iDosGames project: host scaffold (sign-in + lobby) + one game module.

- **Lobby tabs:** Trophy Case (stock `inventory` module), Leaderboard (stock `leaderboard` module), Profile (stock `profile` module). Other base systems are not installed.
- **Play** launches the game full-screen.

`src/modules/casecremental/`:

| Unit | Responsibility | Depends on |
|---|---|---|
| `sim/` | Pure TypeScript, no DOM. Content tables (cases, skins, rarities, wear, charms, evolutions, tuning), seeded RNG, `RunState`, `tick(dt)`, actions (`buyCase`, `openCase`, `brake`, `sell`, `keep`, `buyUpgrade`, `assignBot`, `equipCharm`, `tradeUp`, `upgrader`, `prestige`, `openLastCase`), drop-event queue, intensity. | nothing |
| `fx/` | PixiJS v8 + pixi-filters renderer: stations, reels (pooled), skin pattern shaders, particles, post-processing stack driven by intensity (bloom, RGB split, glitch, shockwave, zoom blur, CRT), WebAudio sound. | reads sim state/events |
| `ui/` | React panels over the canvas: HUD, upgrade shop, charm shop, bots, trade-up/Upgrader, prestige/perks, settings. | calls sim actions |
| `meta/` | Server bridge: run snapshot save/load, CloudCode calls, perks/CLOUT. | `@idosgames/core` |

**Data flow:** sim ticks at a fixed 30 Hz, decoupled from 60+ fps rendering. Drop events go to a queue that `fx/` and `ui/` consume. The module publishes state and actions via `ctx.exposeToAgent` (canvas-module requirement) for agent-driven verification.

### 10.3 Persistence
- **Run snapshot:** `userCustomData` Private key `run`, saved every 15 s and on `visibilitychange`; loaded on start. Lets a reload or another device resume the run.
- **Perks:** `userCustomData` ReadOnly, written only by CloudCode.
- **CLOUT, trophies:** server currency and items.

### 10.4 Server (iDosGames Title)
Replace the idle-RPG seed on `ZVKC34TR-DEV` (heroes, gear items, `gear_summon`, stage quests, shop offers, idle accrual, GOLD/GEMS) with:
- **Currency:** `CLOUT` (initial deposit 0).
- **Item catalog `Trophies`:** one item per Covert and ★ skin (~2 Covert + 1 ★ per case × 9) + ★ Singularity ≈ 28 items, rarity in metadata.
- **Leaderboard `best_run`:** score = `floor(log10(lifetimeEarnings) × 1000)` (lifetime earnings outgrow safe integers, so the board stores a log score; the UI converts it back for display).
- **CloudCode handlers:**
  - `reportTrophy { skinId, runId, elapsedSec }` → validates the skin exists and is Covert/★, rate-limits (≤ 1 per 2 s and ≤ 30 per run-minute), grants the item.
  - `endRun { runId, lifetimeEarnings, elapsedSec, finaleReached }` → caps earnings by a max-plausible curve over elapsed time, grants CLOUT, submits the leaderboard score.
  - `buyPerk { perkId }` → spends CLOUT, writes the perk level to ReadOnly data.

Config goes to the DEV Title first; the live Title gets it once verified.

## 11. Solana (light touch)

- **Must:** Sign in with a Solana wallet via the base's `LazySolanaWalletLogin` (works inside the idosgames.com frame through the platform wallet). Wallet-linked players show on the leaderboard.
- **Stretch:** withdraw a ★ trophy as a Solana NFT through `client.blockchain.requestNFTWithdrawal` + `@idosgames/wallet`. Requires a Solana network + NFT collection bound to the `Trophies` catalog in the Title's blockchain config. **Validated by a throwaway spike in milestone 4 on devnet; cut if it doesn't work.**
- **Guardrail:** cases are bought only with free in-game cash, never with crypto or real money. Randomized boxes paid with real value that pay out tradeable NFTs would be gambling.

## 12. Accessibility and settings
- First-launch **photosensitivity warning**; **Reduce flashing** toggle caps strobe/glitch/shake (also honors the platform's motion preference).
- Volume controls; numbers formatted with suffixes (K, M, B, … then scientific).

## 13. Testing
- **Unit tests (Vitest) on `sim/`:** drop distribution within tolerance over a seeded large sample, wear/StatTrak math, cost curves, each charm and evolution rule, trade-up and Upgrader odds, anti-softlock.
- **Pacing test:** a headless greedy bot plays a whole run on the sim at accelerated time and asserts the §9.6 milestones within ±30%. Doubles as the balancing tool.
- **CloudCode:** handlers exercised against `ZVKC34TR-DEV`, including rejected (implausible) reports.
- **Visual/integration:** live preview driven through the agent surface; screenshots at each intensity stage; FPS check at stage 5.

## 14. Milestones (each ends with a demoable build)
1. **Core** — scaffold, sim core, one reel, sell, basic upgrades, juice; Sober → Buzzed. Cases 1–3.
2. **Machine** — automation chores, stations/reveal, bots, intensity layers 1–5, cases 4–9 with pattern shaders.
3. **Depth** — charms, evolutions, trade-ups, Upgrader, locker.
4. **Meta** — Title config, CloudCode, Trophy Case, leaderboard, prestige + perks, run snapshot; Solana NFT spike.
5. **Finale & ship** — The Last Case, Solana sign-in (+ NFT if the spike passed), polish, deploy to `ZVKC34TR`.

## 15. Risks
| Risk | Mitigation |
|---|---|
| Pixi or pixi-filters fails to resolve in the iDosGames live preview | Spike at milestone 1 start; fall back to Phaser postFX if needed |
| Stage 5 FPS on weak laptops | Visual budget (§9.3), particle caps scaled by measured FPS |
| Solana NFT binding setup is heavy or unsupported for this Title | Stretch only; spike decides |
| Balance off (too slow/fast) | Single tuning table + automated pacing test |
| IP / trademark | Original names, silhouettes and patterns only; no Valve marks |
| CloudCode report spoofing | Accepted for a hackathon; plausibility caps limit leaderboard damage |
