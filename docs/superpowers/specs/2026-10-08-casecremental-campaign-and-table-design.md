# Casecremental — Campaign & Table Economy (spec amendment)

- **Date:** 2026-10-08
- **Status:** Draft for review
- **Amends:** `docs/superpowers/specs/2026-10-07-casecremental-design.md` (the "base spec"). Where this document and the base spec disagree, this document wins. Sections of the base spec not mentioned here still apply.
- **Origin:** brainstorming session of 2026-10-08 (layout mockups, campaign structure, table economy).

## 1. What changed and why

Milestone 1 shipped the core loop. Playing it showed that the planned late game ("buy ×50 of the most expensive case") would be dull, and that one long run lacks the Scritchy Scratchy rhythm of short runs separated by a prestige moment. This amendment replaces:

| Base spec | Replaced by |
|---|---|
| §5 one ladder of 10 cases in one run | §2 a **campaign of 4 runs**, each run unlocking more cases and ending in a **vault case** |
| §6 Multi-open ×1 → ×50 | Multi-open on **your** bench caps at **×5** (§3.2) |
| §6 Bots (many, assigned to cases) | **One bot** with its own reel, upgraded (§3.3) |
| §6 Conveyor / Key Turner / Auto-seller as separate chores | **Auto-buyer grid** (late) and **auto-seller + claim tray** (early) (§3.4–3.5) |
| §7 station order within one run | Stations spread across the 4 runs (§2.2) |
| §8.1 charms from an in-run shop and reel drops | Charms are picked **on the prestige screen, for the next run only** (§4) |
| §9.4 The Last Case ends the run, §9.5 prestige any time after case 4 | Every run ends with a **vault case**; run 4's vault is **The Last Case** (true ending). Prestige happens only through a vault (§2.3) |
| §9.6 pacing targets for one run | Per-run pacing (§2.1) |

## 2. The campaign

### 2.1 Runs and pacing

| Run | Cases on the shelf | New stations | Ends with | Target length |
|---|---|---|---|---|
| 1 | Boot Camp, Wildwood, Bedrock | your bench, upgrades board, case shelf, auto-seller + claim tray | **Vault Case I** | 6–10 min |
| 2 | + Mainframe, Neon Nights | the bot (own reel), locker + trade-ups | **Vault Case II** | 1–2 min catch-up + 5–9 min |
| 3 | + Deep Space, Inferno | the auto-buyer grid | **Vault Case III** | 1–2 min catch-up + 5–9 min |
| 4 | + Glitch, Fever Dream | evolutions, full Cyberpsychosis | **The Last Case** — credits | 1–2 min catch-up + 5–9 min |

Total game: about 35–40 minutes. "Catch-up" = reaching the end-of-previous-run state; the pacing test (base spec §13) is extended to assert it per run.

### 2.2 Intensity per run

- **Run 1** climbs naturally to Buzzed / High. Vault Case I's finale gives a ~20 s **full Cyberpsychosis taste** (every effect at once), then the prestige screen. This is the hackathon judge's experience.
- Runs 2–4 reach higher stages naturally (run 3: Tripping, run 4: Cyberpsychosis); each vault finale is wilder than the last; run 4's is the grand ending.

### 2.3 Vault cases

- A vault case appears on the shelf once all of a run's cases are unlocked; it is very expensive (tuned so buying it is the run's last goal).
- Opening it plays a scripted finale (everything spins at once, the screen tears, a single legendary drop), grants that run's unique ★ trophy, then opens the prestige screen. Run 4's vault is The Last Case (★ Singularity, base spec §9.4) and rolls credits.

## 3. The table economy

The screen is one wooden workbench (layout: see the 2a spec). Cases flow **right → centre → front**: supply → opening → output.

### 3.1 Supply (right side)
- The **case shelf**: tap a case to put it on your mat. A gold frame marks the case(s) the auto-buyer buys (run 3+).

### 3.2 Your bench (centre-left)
- Big CS-style reel, the key, manual braking, combo (base spec §3, §8.4) — always the most rewarding way to open.
- **Multi-open** upgrade: ×1 → ×2 → ×3 → ×5 cases per open on your mat (cap ×5).

### 3.3 The bot (centre-right, run 2+)
- **One** bot with its **own reel**, so the player watches it work. It opens cases placed on its mat; at first the player drags cases onto it by hand, later the auto-buyer feeds it.
- Upgrades (Bot tab): speed (spin + action timing), luck, brake reflex. Late-game evolution turns its reel into a multi-column slot machine.
- When the claim tray is full, the bot **stops and waits** (taps its foot, looks at the player).

### 3.4 Auto-buyer grid (centre, run 3+)
- Buys a **mix** of the cases ticked on the shelf, within a budget the player sets (% of income, minimum cash reserve) — never "×50 of the top case".
- Bought cases fill a grid on the table and **flicker open in bulk**. Most results never get a reel; Covert and ★ break out into a full-size reveal over the table (visual budget, base spec §9.3).
- Upgrades (Machines tab): rate, grid size, budget cap.

### 3.5 Output: auto-seller + claim tray (front edge, run 1+)
- Every drop (yours, the bot's, the grid's) goes to the output. The **auto-seller** grinds everything at or below a chosen rarity into coins (animated: skins go in, coins fly out).
- Everything above the threshold lands in the **claim tray** for the player to **drag by hand** to SELL, LOCKER (trade-ups) or TROPHY (Covert / ★, persistent). Claiming feeds the combo.
- Tray capacity (upgradeable, starts at 12). **Tray full → the bot and the auto-buyer pause** until the player claims.

### 3.6 Station reveal
Each station appears with its own reveal moment (camera pulls back, the station powers on with light and sound). Before its run, a station's spot on the table shows its dark, powered-off silhouette (e.g. the sleeping bot in run 1).

## 4. Prestige screen

Shown after every vault finale:
1. **Payout:** CLOUT for the run (base spec §9.5).
2. **Charms for the next run only:** pick from offered charms (e.g. 2 of 4); the number of slots grows with meta perks. Charms list: base spec §8.1.
3. **Meta perks:** spend CLOUT on permanent upgrades (starting cash, faster spins, extra charm slot, tray size, …).
4. **Catch-up boost:** each completed run grants a large permanent income multiplier so the next run reaches the previous end in 1–2 minutes.

## 5. Persistence (server)

In addition to base spec §10.3: current run number, chosen charms for the next run, and vault trophies are stored server-side (CloudCode-validated, milestone 4).

## 6. Milestone re-plan

| Milestone | Scope |
|---|---|
| M1 (done) | Core loop, cases 1–3, juice, stages 1–2 |
| **M2a** | Look & layout, art + animation pipeline, fonts, EN/RU, audio — see `2026-10-08-casecremental-m2a-look-design.md` |
| M2b | Run 1 complete: auto-seller + claim tray, Vault Case I + finale, prestige screen (local), multi-open ×5, **Day job** (§6.1) |
| M3 | Runs 2–3: the bot, locker + trade-ups, auto-buyer grid, cases 4–7, charms on prestige |
| M4 | Run 4 + The Last Case, evolutions, stages 3–5 polish, server meta (CLOUT, trophies, leaderboard), Solana |
| M5 | Ship: balance across 4 runs, deploy |

### 6.0 Changes agreed during the M2a review (2026-10-08, built)

- **No brake.** The reel always runs its full spin; Quick Hands is the only way to a faster reel (the brake made it pointless). Base spin 3 s (was 6 s with a brake that cut most spins to ~2 s), which keeps base spec §13's pacing targets. Supersedes the base spec's "manual brake" and its near-miss timing.
- **Boot Camp jump-starts a run:** its Mil-Spec pays 0.95× the case price (was 0.55×) and its knife 120× (was 200×); the average return rises ~6 %. Later cases keep the base table.
- **Teasing spin.** A red (Covert) or knife (★) drop ALWAYS teases: the reel covers all but its last two cards fast, then crawls them, and the camera leans in toward the reel. Strength = rarity (★ 1.0, red 0.6) × progress (the player's top unlocked case 1.0, one cheaper 0.3, two or more cheaper 0.1); the crawl adds up to 0.8 × the spin time (so Quick Hands shortens it), the lean up to 1.15×. **Fake teases** on 1 in 40 ordinary drops only: a red (or, a quarter of the time, a knife) is planted right beside the winner and the reel stops a sliver short of it (undershoot) or creeps a sliver past it (overshoot), teased like a red. A tease's crawl never costs the combo. Replaces the old passive near-miss (a knife one slot past the winner, 35 %).
- **The camera moves the whole screen:** zoom and shake apply to the HUD and side panels too (not to modals or the vignette).

### 6.1 Day job (agreed 2026-10-08, for M2b)

Replaces the base spec's anti-softlock (a free Boot Camp case every 10 s when broke). When cash is below the cheapest unlocked case and the bench is empty, a **DAY JOB** button (RU «Подработка») appears where the hint sits. A click starts a short shift (~3 s, progress bar + small pixel animation), then rolls: **90 % → +$2** (coins, "+$2.00" float), **10 % → $0** ("NO PAY" stamp, a sad sound, a small shake). The shift time is the cost, so spam-clicking can't erase the 10 %; it pays at most one Boot Camp case, so it can't be farmed. Open for the M2b brainstorm: the exact shift length, the animation, and whether the payout scales with the cheapest unlocked case.
