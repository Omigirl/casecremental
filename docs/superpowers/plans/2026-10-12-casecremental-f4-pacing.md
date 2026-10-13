# Casecremental F4 — Pacing for Real Players — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tune the campaign for real players. A second, slower timing profile (CASUAL) joins the greedy pacing player. Both profiles get spec §5's targets for Runs 1–3, and a hard 90-second rule caps how long a fully bought run grinds for its vault. Only `sim/tuning.ts` numbers change to meet them.

**Architecture:** `sim/bot.ts` gains the `CASUAL` profile. `BotTimings` gains a shop cadence (`shopEvery`) so CASUAL looks at the shop only every 8 s. Three reusable helpers are added:
- `fullyBought(run)`: every case, upgrade and machine of the run is at its cap.
- `playToFull(seed, timings, setup)`: replays a run with its vault out of reach until it is fully bought, then measures its net income for 60 s.
- `playCampaign(seed, timings)`: chains Run 1 → the next run after each vault → a replay of the last run.

`sim/pacing.test.ts` is rewritten around `playCampaign`. Its targets loop over runs `2…LAST_RUN`, so F6-A's Run 4 inherits them unchanged. Then `sim/tuning.ts` is retuned with a scratch script (never committed) that prints both profiles' medians.

**Tech Stack:** TypeScript (strict), Vitest 5, Vite 8.

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-finish-design.md`. §5 (binding) applies, along with §1 (phases), §3 (auto-spin, its cost and Delay "priced by F4"), §7 (Run 4 comes in F6-A) and §11 (testing). Before Task 1, read `docs/feature-history/casecremental-run1.md` ("Tuning") and `casecremental-runs-2-3.md` ("Pacing targets", "`VAULT_GROWTH` is 3.25, not 4").

**F1, F2 and F3 land before this plan.** F2 removed the grid. F2 also added auto-spin (`sim/autoSpin.ts`, `RunState.autoSpin`, `AUTOSPIN_COST` / `AUTOSPIN_DELAYS` / `AUTOSPIN_DELAY_COSTS` / `AUTOSPIN_KEY_SECONDS`). F2 Task 4 taught the greedy player to buy auto-spin after the seller, keep it on, leave the bench to it and shop whenever free. It also retuned `VAULT_PRICES` to `[1_200_000, 2_400_000_000, 800_000_000_000]` and Neon Nights' unlock to `2_000_000`. Before Task 1, re-read these files as F2 left them: `sim/bot.ts`, `sim/pacing.test.ts`, `sim/tuning.ts`, `sim/autoSpin.ts`, `sim/run.ts`, `sim/runTypes.ts`. The snippets below assume F2's names (`s.autoSpin.owned`, `run.buyAutoSpin()`, `autoSpinDelayCost`, `report.autoSpinAt`). If F2 named something differently, use F2's name.

**F6-A builds on this plan.** F6-A Task 8 (Run 4's pacing) consumes `CASUAL`, `BotTimings`, `fullyBought`, `PacingReport.fullAt` / `fullIncome` / `vaultPrice`, `playToFull` and `playCampaign`. Keep those names and signatures exactly. Task 2's notes say what F6-A gets for free.

## Global Constraints

- Balance numbers live only in `sim/tuning.ts` (spec §5: "Tune numbers only in `sim/tuning.ts`"). The timing profiles and the measuring windows below are the pacing player's, so they live in `sim/bot.ts`. Never change the sim's logic or the players to make a target pass.
- Saves keep their run's setup, as today (spec §5). A run started before the retune keeps its old vault price and boost until its next run.
- Every player-facing string exists in EN (`i18n/en.ts`) and RU (`i18n/ru.ts`). This plan adds none. If tuning changes a number a string quotes, update both.
- File size (IDOS.md): when a change adds a new responsibility to a file past ~400 lines, that part goes in its own file. After this plan `sim/bot.ts` is ~280 lines and `sim/pacing.test.ts` ~170. F6-A adds to both.
- Match the module's code style. Each file has a header comment saying what it is and why. Exported names have doc comments. Comment density matches the neighbours. Formatting is 2-space Prettier (`npm run format` is available).
- Every commit keeps these green: `npm run typecheck`, `npx vitest run src/modules/casecremental`, `npm run build`.
- Commit messages look like `feat(pacing): …` and end with these two lines (after a blank line):
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```
- Stage files by path. Never stage `docs/todo.md`, the `{…}.png` files in the repo root, or `sim/tune.scratch.test.ts`. Stay on branch `casecremental-finish`. Do not edit `src/modules.ts`, `src/config.ts`, `src/idos.title.ts` or `idos.modules.lock.json`.
- The SDK is npm packages: never invent an SDK API. This plan needs none.

## Review Focus

The five conditions most likely to bite a player that the spec does not spell out. Each one has its test in the owning task.

1. **CASUAL's slow hands and a full tray.** CASUAL claims a tray card only every 1.2 s, while the seller sets Coverts aside and the bot (×50 in Run 3) feeds it. A player expects the tray never to jam the machines for long. Test: Task 2, "never leaves the tray stuck full for long" for **both** profiles and every leg.
2. **The vault comes before everything is bought** (the usual CASUAL case). The 90 s rule must still be measured, not skipped. `playToFull` replays the same seed and setup with the vault out of reach. Tests: Task 1, "keeps the vault out of reach, gets the run fully bought…"; Task 2, the 90 s rule's `fullAt` check.
3. **The 8 s shop cadence must not hold back the vault.** The vault is the run's goal, so a CASUAL player buys it the moment it is affordable on an empty bench, not at the next shop look. Test: Task 1, "the vault waits for no look at the shop".
4. **A save from before the retune.** A player mid-run expects their run's prices not to jump under them. The save keeps `setup.vaultPrice` and `setup.valueBoost`, so the new numbers apply from the next run. Test: Task 2, "keeps a run's own prices across a retune" in `game/save.test.ts`.
5. **The first replay after the campaign.** A replay's vault grows ×`VAULT_GROWTH` (3.25) while its sales grow ×`CATCH_UP_PER_VAULT` (3), so its 90 s ratio is about 8 % worse than the last run's. The first replay is tested too. Later loops drift further; Task 3 records that as a known limit for F9. Test: Task 2, "the 90 s rule — the Run 3 replay".

---

## How income is measured (the 90 s rule)

Spec §5: "once every case and upgrade of a run is bought, the vault costs at most 90 s of that run's CASUAL income."

- **Fully bought** (`fullyBought(run)`) means all of these hold:
  - every case of the run's shelf is unlocked (`run.vaultShown()`);
  - every upgrade is at its run's cap (`upgradeCost(…) === null`);
  - the bot is awake and at its Speed cap, with its multi-open bought where the run has one;
  - the seller is bought and at its Speed cap;
  - auto-spin is bought and at its Delay cap;
  - where the run has them, the locker is bought at its Size cap and the auto contract is bought.

  "Upgrade" includes the Machines tab's rows: they are upgrades a player buys. The vault itself is excluded. F6-A adds the Upgrader. Evolutions stay excluded, because a recipe may never complete.
- **Income** is the **net** cash gained per second over `INCOME_WINDOW` (60 s), starting the moment the run became fully bought. It counts every sale (hand, seller, bot, locker, contracts) minus the cases bought (bench, auto-spin, the bot's spins), because nothing else is left to buy. This is the cash a player can actually save toward the vault. Gross earnings would overstate it, since the bench and the bot spend on cases. 60 s keeps one knife from deciding the result.
- **Measured in a probe.** `playToFull(seed, CASUAL, setup)` plays the same seed and setup as the real leg with `vaultPrice = +Infinity`. The sim is deterministic per seed, and an unaffordable vault changes no decision (auto-spin's "vault shown and affordable" check stays false). So the probe is the real run up to the point where the vault would have been bought, then keeps going until everything is bought. It stops `INCOME_WINDOW` seconds after `fullAt`, or at `PROBE_SECONDS` (3600). The report's `vaultPrice` is set back to the real price. The rule is `vaultPrice / fullIncome ≤ 90`.
- **Checked** for every CASUAL seed, not the median (it is a hard rule), for Runs 1…`LAST_RUN` and the first replay.

## Which lever moves which median

All levers are in `sim/tuning.ts`. Change one lever at a time and re-measure with the scratch script (Task 2, Step 2).

| Median off target | Lever | It also moves |
|---|---|---|
| Run 1 vault (either profile) | `VAULT_PRICES[0]` | Run 1's 90 s ratio; CLOUT after Vault I (so which perk Run 2 gets) |
| Run 2 / Run 3 vault | `VAULT_PRICES[1]` / `VAULT_PRICES[2]` | that run's 90 s ratio; `[2]` also sets the replay's price (× `VAULT_GROWTH`) |
| Replay vault, with Run 3 on target | `VAULT_GROWTH` | every replay loop, and after F6-A Run 4's replay |
| Run *n* catch-up | the previous shelf's top unlock: Run 2 → `CASE_ECONOMY.bedrock.unlockCost`, Run 3 → `neon.unlockCost` (Run 4 → `inferno`, F6-A) | that case's own run: Run 1's Bedrock window (150–400 s) for bedrock; Run 2's middle for neon |
| Run *n*'s middle (catch-up fine, vault far off) | the run's new cases' unlocks: Run 2 → `mainframe`, `neon`; Run 3 → `deepspace`, `inferno` | when the vault shows (`vaultShown` needs every case) |
| Every Run 2+ median off in the same direction | `CATCH_UP_PER_VAULT` | all later runs, replays and F6-A's Run 4. Last resort: re-check every row after |
| CASUAL much slower than GREEDY, GREEDY on target | `AUTOSPIN_COST` down (CASUAL's slow bench goes automatic sooner), then `AUTOSPIN_DELAY_COSTS` / `AUTOSPIN_DELAYS`, then `SELLER_HOLD_SECONDS` | auto-spin must stay after the seller and before Vault I for both profiles (spec §1: "late Run 1") |
| Bot awake / seller windows | `BOT_WAKE_COST`, `SELLER_COST` | Run 1's whole opening |
| A run's growth rate; a probe that never gets fully bought | `UPGRADE_COSTS` (luck and appraiser `growth`), `BOT_SPEED_COSTS`, `SELLER_SPEED_COSTS`, `LOCKER_SIZE_COSTS`, `AUTO_CONTRACT_COST` | every run: upgrade costs are not run-scaled |
| 90 s rule fails while the vault time is on target | lower that run's `VAULT_PRICES` entry **and** slow its middle (raise its new cases' unlocks) so the vault time holds | — |
| A stage target missed (Run 2 High, Run 3 Tripping) | a dearer vault within its band (more time at high heat), before touching `STAGE_THRESHOLDS` | thresholds change the stage look for every player |

Do not touch these:
- the case prices (`CASE_ECONOMY.*.price`): skin values are multiples of them, and `cases.test.ts` keeps each at least 7× the one below;
- `RARITY_*`, `LUCK_PER_LEVEL`, `APPRAISER_PER_LEVEL`: they change every value the player sees.

Two cautions:
- If a vault price drops a lot, check that the chain still buys a perk after each vault (CLOUT = `floor(√earnings / 105)`; the cheapest perk costs 3).
- Tune in run order (Run 1, then 2, 3, the replay). A later run depends on the earlier ones only through CLOUT and perks.

---

## File map

All paths are relative to `src/modules/casecremental/` unless they start with `docs/`.

| File | Task | Responsibility |
|---|---|---|
| `sim/bot.ts` | 1 | the CASUAL profile, the shop cadence, `fullyBought`, `playToFull`, `playCampaign`, the report's new fields |
| `sim/bot.test.ts` (create) | 1 | fast tests of the profiles and helpers |
| `sim/pacing.test.ts` | 2 | spec §5's targets for both profiles, the 90 s rule, the kept tests |
| `sim/tuning.ts` | 2 | the retune |
| `game/save.test.ts` | 2 | a pin: a save keeps its run's prices |
| `sim/tune.scratch.test.ts` | 2 | the tuning printout. **Never committed** |
| `docs/feature-history/casecremental-finish.md`, `casecremental-run1.md`, `casecremental-runs-2-3.md`, `README.md` | 3 | notes |

---

### Task 1: The CASUAL profile and the measuring helpers

**Files:**
- Modify: `sim/bot.ts`
- Create: `sim/bot.test.ts`

**Interfaces:**
- Consumes (F2): `Run.buyAutoSpin()`, `setAutoSpin(on)`, `buyAutoSpinDelay()`, `autoSpinDelayCost(level): number | null`, `RunState.autoSpin.{owned, on, delayLevel}`, the `autoSpinBought` / `autoSpinUpgraded` events, `PacingReport.autoSpinAt`.
- Produces (`sim/bot.ts`), used by Task 2 and by F6-A Task 8:
  ```ts
  export interface BotTimings { buy: number; key: number; sell: number; reveal: number; shopEvery: number }
  export const HUMAN: BotTimings;  // the GREEDY profile, shopEvery 0
  export const CASUAL: BotTimings; // { buy: 0.8, key: 0.8, sell: 1.2, reveal: 0.8, shopEvery: 8 }
  export const RUN_SECONDS = 900;
  export const INCOME_WINDOW = 60;
  export const PROBE_SECONDS = 3600;
  export interface PlayOptions { untilIncome?: boolean; onEvent?: (e: SimEvent, time: number) => void }
  // PacingReport gains: fullAt?: number; fullIncome?: number; vaultPrice: number; endedAt: number
  export function playGreedy(seed: number, seconds: number, timings?: BotTimings, setup?: RunSetup, opts?: PlayOptions): PacingReport;
  export function fullyBought(run: Run): boolean;
  export function playToFull(seed: number, timings: BotTimings, setup: RunSetup, seconds?: number): PacingReport;
  export interface Leg { run: number; seed: number; setup: RunSetup; report: PacingReport }
  export function playCampaign(seed: number, timings?: BotTimings, seconds?: number): Leg[];
  ```

The GREEDY player's behaviour must not change in this task. With `shopEvery: 0`, `shop()` calls `spend` at every free moment exactly as before, so every current pacing median stays the same and this commit is green.

- [ ] **Step 1: Write the failing tests** in `sim/bot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CASUAL, fullyBought, HUMAN, INCOME_WINDOW, playCampaign, playGreedy, playToFull, RUN_SECONDS, type BotTimings } from "./bot";
import { VAULTS } from "./content/vaults";
import { DEFAULT_SETUP, Run, type SimEvent } from "./run";
import { LAST_RUN } from "./tuning";
import { UPGRADE_IDS } from "./upgrades";

// The pacing players' own rules (finish spec §5): the two timing profiles, the shop cadence, and the helpers the
// pacing test measures with. The pacing targets themselves are in pacing.test.ts.

/** Every one-time purchase and upgrade the shop sells: not a case on the bench, not the vault. */
const PURCHASES = new Set<SimEvent["type"]>([
  "caseUnlocked",
  "upgradeBought",
  "botWoke",
  "botUpgraded",
  "botMultiBought",
  "sellerBought",
  "sellerUpgraded",
  "lockerBought",
  "lockerUpgraded",
  "autoContractBought",
  "autoSpinBought",
  "autoSpinUpgraded",
]);

/** Buys everything the run sells, with plenty of cash, until nothing more can be bought. */
function buyEverything(run: Run): void {
  run.state.cash = 1e18;
  const buys = [
    ...run.runCases().map((id) => () => run.unlockCase(id)),
    () => run.wakeBot(),
    () => run.buyBotSpeed(),
    () => run.buyBotMulti(),
    () => run.buySeller(),
    () => run.buySellerSpeed(),
    () => run.buyAutoSpin(),
    () => run.buyAutoSpinDelay(),
    () => run.buyLocker(),
    () => run.buyLockerSize(),
    () => run.buyAutoContract(),
    ...UPGRADE_IDS.map((id) => () => run.buyUpgrade(id)),
  ];
  for (let guard = 0; guard < 1000 && buys.some((buy) => buy().ok); guard++);
}

/** Seconds between the shop purchases of a 400 s Run 1. */
function purchaseGaps(timings: BotTimings): number[] {
  const at: number[] = [];
  playGreedy(1, 400, timings, DEFAULT_SETUP, { onEvent: (e, t) => void (PURCHASES.has(e.type) && at.push(t)) });
  return at.slice(1).map((t, i) => t - at[i]!);
}

describe("the timing profiles (finish spec §5)", () => {
  it("CASUAL is the spec's real player: slower hands, a look at the shop every 8 s", () => {
    expect(CASUAL).toEqual({ buy: 0.8, key: 0.8, sell: 1.2, reveal: 0.8, shopEvery: 8 });
  });

  it("GREEDY (HUMAN) keeps M1–M3's hands and shops at every free moment", () => {
    expect(HUMAN).toEqual({ buy: 0.3, key: 0.4, sell: 0.5, reveal: 0.25, shopEvery: 0 });
  });

  it("the CASUAL player buys at most one thing per look at the shop; the GREEDY one never waits", () => {
    const casual = purchaseGaps(CASUAL);
    expect(casual.length).toBeGreaterThan(5);
    expect(Math.min(...casual)).toBeGreaterThanOrEqual(CASUAL.shopEvery - 1e-6);
    expect(Math.min(...purchaseGaps(HUMAN))).toBeLessThan(CASUAL.shopEvery);
  });

  it("the vault waits for no look at the shop: CASUAL buys it as soon as it can", () => {
    const r = playGreedy(1, RUN_SECONDS, CASUAL, { ...DEFAULT_SETUP, vaultPrice: 1 });
    expect(r.vaultAt).toBeDefined();
    expect(r.vaultAt! - r.allUnlockedAt!).toBeLessThan(CASUAL.shopEvery);
  });
});

describe("fully bought (the 90 s rule's starting line)", () => {
  for (let n = 1; n <= LAST_RUN; n++) {
    it(`Run ${n}: not on a fresh run, yes once everything is bought, not with one level short`, () => {
      const r = new Run(1, { ...DEFAULT_SETUP, run: n });
      expect(fullyBought(r)).toBe(false);
      buyEverything(r);
      expect(fullyBought(r)).toBe(true);
      r.state.upgrades.luck -= 1;
      expect(fullyBought(r)).toBe(false);
    });
  }
});

describe("playToFull", () => {
  it("keeps the vault out of reach, gets the run fully bought, and measures its net income over the window", () => {
    const r = playToFull(1, HUMAN, DEFAULT_SETUP);
    expect(r.vaultAt).toBeUndefined();
    expect(r.fullAt).toBeDefined();
    expect(r.fullIncome!).toBeGreaterThan(0);
    expect(r.vaultPrice).toBe(DEFAULT_SETUP.vaultPrice);
    expect(Math.abs(r.endedAt - (r.fullAt! + INCOME_WINDOW))).toBeLessThan(0.1); // it stops once measured
  });
});

describe("playCampaign", () => {
  it("plays Run 1, then a run after each vault, the last a replay of the last run", () => {
    const legs = playCampaign(1, HUMAN, 60); // short legs: only the chain's shape matters here
    expect(legs).toHaveLength(VAULTS.length + 1);
    expect(legs.map((l) => l.run)).toEqual([...Array.from({ length: LAST_RUN }, (_, i) => i + 1), LAST_RUN]);
    expect(legs[0]!.setup).toEqual(DEFAULT_SETUP);
    expect(legs[1]!.setup.valueBoost).toBeGreaterThan(1);
    expect(legs.at(-1)!.setup.vaultPrice).toBeGreaterThan(legs.at(-2)!.setup.vaultPrice);
    expect(new Set(legs.map((l) => l.seed)).size).toBe(legs.length);
  });
});
```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/sim/bot.test.ts`
  Expected: FAIL. `CASUAL`, `fullyBought`, `playToFull`, `playCampaign` and `INCOME_WINDOW` are not exported.

- [ ] **Step 3: The profile and the shop cadence.** In `sim/bot.ts`:
  - Add to `BotTimings`:
    ```ts
      /** Seconds between looks at the shop (unlocks, machines, upgrades); 0 = at every free moment. */
      shopEvery: number;
    ```
  - Replace `HUMAN` and add `CASUAL` and the constants under it:
    ```ts
    /** The GREEDY profile: a perfect player who never pauses (the pacing player of M1–M3). */
    export const HUMAN: BotTimings = { buy: 0.3, key: 0.4, sell: 0.5, reveal: 0.25, shopEvery: 0 };
    /** The CASUAL profile (finish spec §5): a real player's slower hands, and a look at the shop only every 8 s. It runs
     *  auto-spin once owned, like GREEDY. */
    export const CASUAL: BotTimings = { buy: 0.8, key: 0.8, sell: 1.2, reveal: 0.8, shopEvery: 8 };

    /** How long a pacing run plays at most (s). */
    export const RUN_SECONDS = 900;
    /** The 90 s rule's income window (s) after a run is fully bought: long enough that one knife doesn't decide it. */
    export const INCOME_WINDOW = 60;
    /** How long playToFull plays at most to get a run fully bought (s). */
    export const PROBE_SECONDS = 3600;

    export interface PlayOptions {
      /** Stop once the full-income window is measured (playToFull). */
      untilIncome?: boolean;
      /** Sees every sim event with its sim time (the shop-cadence test). */
      onEvent?: (e: SimEvent, time: number) => void;
    }
    ```
  - Add to `PacingReport`:
    ```ts
      /** When every case, upgrade and machine of the run was first bought, each at its run's cap (fullyBought). */
      fullAt?: number;
      /** Net cash per second over the INCOME_WINDOW after fullAt: the 90 s rule's income. Left out when a vault was bought
       *  inside the window (only playToFull, whose vault is out of reach, is sure to measure it). */
      fullIncome?: number;
      /** The run's vault price (playToFull reports the real one, not its out-of-reach stand-in). */
      vaultPrice: number;
      /** Sim seconds played. */
      endedAt: number;
    ```
  - Imports: `import type { SimEvent } from "./run";` (beside the existing `./run` import), `import { VAULTS } from "./content/vaults";`, and `import { buyPerk, completeVault, freshMeta, PERK_IDS, perkCost, setupFor } from "./meta";`. `meta.ts` imports only types from `./run`, so there is no cycle.
  - In `playGreedy`:
    - New signature: `export function playGreedy(seed: number, seconds: number, timings: BotTimings = HUMAN, setup: RunSetup = DEFAULT_SETUP, opts: PlayOptions = {}): PacingReport`.
    - Add `vaultPrice: setup.vaultPrice, endedAt: 0,` to the report literal.
    - Beside `let busyUntil = 0;` add:
      ```ts
        let nextShop = 0;
        let fullCash = 0;
        /** A look at the shop when one is due (CASUAL every shopEvery s, GREEDY at every free moment); the vault is never
         *  part of it (Review Focus 3). */
        const shop = () => {
          if (run.state.time < nextShop) return;
          nextShop = run.state.time + timings.shopEvery;
          spend(run);
          if (report.fullAt === undefined && fullyBought(run)) {
            report.fullAt = run.state.time;
            fullCash = run.state.cash;
          }
        };
      ```
    - The loop condition becomes `while (run.state.time < seconds && !run.state.over && !(opts.untilIncome && report.fullIncome !== undefined))`.
    - First line inside `for (const e of run.drainEvents())`: `opts.onEvent?.(e, s.time);`.
    - Right after the `longestTrayFull` line (before the `busyUntil` check):
      ```ts
          const since = report.fullAt === undefined ? null : s.time - report.fullAt;
          if (since !== null && since >= INCOME_WINDOW && report.fullIncome === undefined && report.vaultAt === undefined)
            report.fullIncome = (s.cash - fullCash) / INCOME_WINDOW;
      ```
    - Replace **every** `spend(run)` call inside `playGreedy` with `shop()`. After F2 there are two: the auto-spin branch and the empty-bench branch. Leave `run.buyVault()` where it is: the vault is bought on an empty bench at once, never through the shop.
    - After the loop: `report.endedAt = run.state.time;`.
  - Under `spend`, add the helpers:
    ```ts
    /** Every case of the shelf unlocked and every upgrade and machine at this run's cap (finish spec §5's "every case and
     *  upgrade of a run is bought"; the Machines rows are upgrades too). The vault is not counted; F6-A adds the
     *  Upgrader; evolutions never count, since a recipe may never complete. */
    export function fullyBought(run: Run): boolean {
      const s = run.state;
      const n = run.setup.run;
      const content = runContent(n);
      return (
        run.vaultShown() &&
        UPGRADE_IDS.every((id) => upgradeCost(id, s.upgrades[id], n) === null) &&
        s.bot.awake &&
        botSpeedCost(s.bot.speedLevel, n) === null &&
        (content.botMultiOpen <= 1 || s.bot.multiLevel > 0) &&
        s.seller.on &&
        sellerSpeedCost(s.seller.speedLevel) === null &&
        s.autoSpin.owned &&
        autoSpinDelayCost(s.autoSpin.delayLevel) === null &&
        (!content.locker || (s.locker.on && lockerSizeCost(s.locker.sizeLevel) === null)) &&
        (!content.autoContract || s.locker.auto)
      );
    }

    /** The 90 s rule's measure (finish spec §5): the same seed and setup with the vault out of reach, played until every
     *  case, upgrade and machine is bought and then INCOME_WINDOW seconds more. An unaffordable vault changes no
     *  decision, so this is the real run up to its vault, carried on. `fullIncome` is the run's net income once there is
     *  nothing left to buy; `vaultPrice` is the real price. */
    export function playToFull(seed: number, timings: BotTimings, setup: RunSetup, seconds = PROBE_SECONDS): PacingReport {
      const report = playGreedy(seed, seconds, timings, { ...setup, vaultPrice: Number.POSITIVE_INFINITY }, { untilIncome: true });
      report.vaultPrice = setup.vaultPrice;
      return report;
    }

    /** One run of a campaign the pacing player played: its seed and setup (to probe it again) and what happened. */
    export interface Leg {
      run: number;
      seed: number;
      setup: RunSetup;
      report: PacingReport;
    }

    /** Run 1, then the next run after each vault (in VAULTS order, so F6-A's Run 4 joins by itself), the last one a replay
     *  of LAST_RUN; the cheapest perk is bought after each vault. legs[0] is Run 1, legs[n - 1] Run n, the last leg the
     *  replay. */
    export function playCampaign(seed: number, timings: BotTimings = HUMAN, seconds = RUN_SECONDS): Leg[] {
      const meta = freshMeta();
      const legs: Leg[] = [{ run: 1, seed, setup: DEFAULT_SETUP, report: playGreedy(seed, seconds, timings) }];
      for (const v of VAULTS) {
        completeVault(meta, legs.at(-1)!.report.lifetimeEarnings, v.trophy, seed);
        const cheapest = [...PERK_IDS].sort(
          (a, b) => (perkCost(a, meta.perks[a]) ?? Infinity) - (perkCost(b, meta.perks[b]) ?? Infinity),
        )[0]!;
        buyPerk(meta, cheapest);
        const setup = setupFor(meta);
        const legSeed = seed + 100 * meta.loops; // the seeds the M3 chain used, so medians stay comparable
        legs.push({ run: setup.run, seed: legSeed, setup, report: playGreedy(legSeed, seconds, timings, setup) });
      }
      return legs;
    }
    ```
    `botSpeedCost`, `sellerSpeedCost`, `lockerSizeCost`, `runContent`, `UPGRADE_IDS` and `upgradeCost` are already imported in `bot.ts`. `autoSpinDelayCost` is imported by F2's Task 4.
  - Run `grep -n "vaultPrice" src/modules/casecremental/sim/*.ts`. Check that nothing in the sim does arithmetic with `setup.vaultPrice` except `buyVault` and auto-spin's affordability check, so that `+Infinity` is safe there. If something else uses it, compute what it needs from `run.state` instead of passing `Infinity` through it, and say so in the report.
  - Update the header comment. After the existing first sentence add: "Two timing profiles (finish spec §5): HUMAN is the GREEDY player, a perfect one who never pauses; CASUAL has a real player's slower hands and looks at the shop only every 8 s, never holding back the vault. `playCampaign` chains the runs and `playToFull` measures the 90 s rule's income." Keep the rest of the comment.

- [ ] **Step 4: Run the new tests and the old pacing tests.**
  Run: `npx vitest run src/modules/casecremental/sim/bot.test.ts src/modules/casecremental/sim/pacing.test.ts`
  Expected: PASS. If `playToFull(1, HUMAN, DEFAULT_SETUP)` never gets fully bought within 3600 s, print `fullyBought`'s terms at the end to find which cap is unreachable, and report it. Task 2's tuning handles it (upgrade cost curves). Do not raise `PROBE_SECONDS`. If `pacing.test.ts` moved at all, the GREEDY player's behaviour changed: re-check that `shop()` with `shopEvery: 0` calls `spend` exactly where `spend(run)` was.

- [ ] **Step 5: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/sim/bot.ts src/modules/casecremental/sim/bot.test.ts
  git commit -m "feat(pacing): the CASUAL timing profile, a shop cadence, and the fully-bought income probe

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 2: Both profiles' targets, the 90 s rule, and the retune

The new targets and the retune land in one commit: the targets fail on F2's numbers, and every commit stays green.

**Files:**
- Modify: `sim/pacing.test.ts` (rewritten), `sim/tuning.ts`, `game/save.test.ts`
- Create, then delete before committing: `sim/tune.scratch.test.ts`

**Interfaces:**
- Consumes (Task 1): `CASUAL`, `HUMAN`, `BotTimings`, `Leg`, `PacingReport`, `playCampaign`, `playToFull`, `PROBE_SECONDS`.
- Produces: `sim/pacing.test.ts` written over runs `2…LAST_RUN` with `STAGE_TARGETS` keyed by run. F6-A Task 8 only adds Run 4's extras: the Upgrader test, and `4: 5` already sits in `STAGE_TARGETS`.

**Targets** (spec §5, medians of 5 seeds, seconds):

| | GREEDY | CASUAL |
|---|---|---|
| Run 1 vault | 240–360 | 360–540 |
| Runs 2–3 catch-up to the previous shelf | 30–90 | 60–120 |
| Runs 2–3 vault | 240–360 | 300–480 |
| The replay of Run 3's vault | 180–300 | 240–420 |
| 90 s rule (every CASUAL seed, Runs 1–3 and the replay) | — | `vaultPrice / fullIncome ≤ 90` |

The tests that stay (spec §5), GREEDY:
- Wildwood 45–150 s, Bedrock 150–400 s, stage 2 within 20–120 s;
- bot awake ≤ 150 s, seller 180–300 s;
- Run 2's locker ≤ 240 s and contracts > 0;
- stages: Run 2 ≥ 3 (High), Run 3 ≥ 4 (Tripping).

Both profiles: auto-spin after the seller and before Vault I (F2's test), and the tray never stuck full ≥ 10 s.

**Tests dropped, with the reason:**
- The synthetic "boosted Run 1 replay". Since M3, Vault I leads to Run 2, so no player ever plays a Run 1 replay. It only pulled `VAULT_GROWTH` and `AUTOSPIN_COST` against the real targets.
- The "Run 3 replay catches up in 1–2 min" test. Spec §5's replay row is the vault time; the replay's "catch-up" is its whole shelf.

The grid test went in F2.

- [ ] **Step 1: Baseline.** Run: `npx vitest run src/modules/casecremental/sim/pacing.test.ts`. Note the reported `Duration`. Before F2 it was 1.0 s for 14 tests on the dev laptop (2026-10-12). The describe-level sims run during collection, so they show under "import", not "tests".

- [ ] **Step 2: Write the scratch printout** `sim/tune.scratch.test.ts`. It is never committed: it is listed in Global Constraints, and Step 8 stages by path.

```ts
// A tuning aid for F4 — NEVER COMMITTED (delete it, or at least never `git add` it). Prints both profiles' pacing
// medians and the 90 s ratios, so a tuning.ts change can be judged in one run:
//   npx vitest run src/modules/casecremental/sim/tune.scratch.test.ts
import { it } from "vitest";
import { CASUAL, HUMAN, playCampaign, playToFull, type BotTimings, type PacingReport } from "./bot";
import { LAST_RUN } from "./tuning";

const SEEDS = [1, 2, 3, 4, 5];
const med = (xs: Array<number | undefined>) => {
  const v = xs.map((x) => x ?? Number.POSITIVE_INFINITY).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)]!;
};
const s = (t: number) => (Number.isFinite(t) ? Math.round(t) : "never");

function table(name: string, timings: BotTimings, probe: boolean): void {
  const campaigns = SEEDS.map((seed) => playCampaign(seed, timings));
  const rows = campaigns[0]!.map((leg, i) => {
    const reports = campaigns.map((c) => c[i]!.report);
    const pick = (f: (r: PacingReport) => number | undefined) => s(med(reports.map(f)));
    const ninety = probe
      ? campaigns.map((c) => {
          const p = playToFull(c[i]!.seed, timings, c[i]!.setup);
          return p.fullIncome ? p.vaultPrice / p.fullIncome : Number.POSITIVE_INFINITY;
        })
      : [];
    return {
      leg: i === LAST_RUN ? `Run ${leg.run} replay` : `Run ${leg.run}`,
      catchUp: i === 0 ? "-" : pick((r) => r.runCasesAt[Math.max(1, leg.run - 1)]),
      bot: pick((r) => r.botAwakeAt),
      seller: pick((r) => r.sellerAt),
      autoSpin: pick((r) => r.autoSpinAt),
      vault: pick((r) => r.vaultAt),
      vaults: reports.map((r) => s(r.vaultAt ?? Number.POSITIVE_INFINITY)).join(" "),
      stage: med(reports.map((r) => r.topStage)),
      trayMax: Math.max(...reports.map((r) => r.longestTrayFull)).toFixed(1),
      "90s max": probe ? Math.max(...ninety).toFixed(0) : "-",
    };
  });
  console.log(name);
  console.table(rows);
}

it("prints the pacing medians", () => {
  table("GREEDY", HUMAN, false);
  table("CASUAL", CASUAL, true);
}, 300_000);
```

  Run it once and keep the printout as the baseline (F2's numbers).

  **Sweeping a lever without editing `tuning.ts`.** Add a second `it` that re-imports the sim with one constant swapped. `vi.resetModules()` makes every module re-read the mocked `tuning`, including `DEFAULT_SETUP` and `RUN_CONTENT`:
  ```ts
  import { vi } from "vitest";
  it("sweeps Run 1's vault price", async () => {
    for (const price of [400_000, 600_000, 800_000, 1_000_000]) {
      vi.resetModules();
      vi.doMock("./tuning", async (importOriginal) => {
        const t = await importOriginal<typeof import("./tuning")>();
        return { ...t, VAULT_PRICES: [price, t.VAULT_PRICES[1], t.VAULT_PRICES[2]] as const };
      });
      const bot = await import("./bot");
      const g = SEEDS.map((seed) => bot.playGreedy(seed, 900, bot.HUMAN).vaultAt);
      const c = SEEDS.map((seed) => bot.playGreedy(seed, 900, bot.CASUAL).vaultAt);
      console.log(price, "GREEDY", s(med(g)), "CASUAL", s(med(c)));
      vi.doUnmock("./tuning");
    }
  }, 300_000);
  ```
  Sweep 3–5 values of one lever, pick the value that lands the median well inside both bands, then write it into `tuning.ts`. Run `npx vitest run …/tune.scratch.test.ts -t "prints"` to re-check the whole table after each change.

- [ ] **Step 3: Rewrite** `sim/pacing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CASUAL, HUMAN, playCampaign, playToFull, PROBE_SECONDS, type BotTimings, type Leg, type PacingReport } from "./bot";
import { LAST_RUN } from "./tuning";

// The pacing targets (finish spec §5). Two players play the whole campaign — Run 1, then the next run after each
// vault, the last a replay of LAST_RUN, the cheapest perk after each vault: GREEDY (the HUMAN timings), a perfect
// player who never pauses, and CASUAL, a real player's slower hands that look at the shop every 8 s. Medians of five
// seeds, so one lucky knife doesn't decide a result. When this fails, tune sim/tuning.ts — never the players or the
// logic. The run rows loop over runs 2…LAST_RUN, so Run 4 (F6-A) is held to the same targets.

const SEEDS = [1, 2, 3, 4, 5];
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

type Profile = "GREEDY" | "CASUAL";
type Band = readonly [min: number, max: number];
const PROFILES: Record<Profile, BotTimings> = { GREEDY: HUMAN, CASUAL };
/** Spec §5's table, in seconds. */
const TARGETS: Record<Profile, { firstVault: Band; catchUp: Band; vault: Band; replay: Band }> = {
  GREEDY: { firstVault: [240, 360], catchUp: [30, 90], vault: [240, 360], replay: [180, 300] },
  CASUAL: { firstVault: [360, 540], catchUp: [60, 120], vault: [300, 480], replay: [240, 420] },
};
/** The stage each run reaches before its vault (spec §5): Run 2 High, Run 3 Tripping, Run 4 Unhinged. */
const STAGE_TARGETS: Readonly<Record<number, number>> = { 2: 3, 3: 4, 4: 5 };
/** The 90 s rule: once a run is fully bought, its vault costs at most this many seconds of CASUAL income. */
const VAULT_INCOME_SECONDS = 90;
/** The replay's leg: legs[0] is Run 1, legs[n - 1] Run n, legs[LAST_RUN] the replay of LAST_RUN. */
const REPLAY = LAST_RUN;

const mins = ([a, b]: Band) => `${a / 60}–${b / 60} min`;
const campaigns: Record<Profile, Leg[][]> = {
  GREEDY: SEEDS.map((s) => playCampaign(s, PROFILES.GREEDY)),
  CASUAL: SEEDS.map((s) => playCampaign(s, PROFILES.CASUAL)),
};
/** One leg's value across the seeds (a time that never came counts as never). */
const values = (p: Profile, leg: number, pick: (r: PacingReport) => number | undefined) =>
  campaigns[p].map((legs) => pick(legs[leg]!.report) ?? Number.POSITIVE_INFINITY);
const med = (p: Profile, leg: number, pick: (r: PacingReport) => number | undefined) => median(values(p, leg, pick));
/** The median within [min, max]; a failure lists every seed's value, for tuning. */
function expectBand(p: Profile, leg: number, pick: (r: PacingReport) => number | undefined, [min, max]: Band, what: string): void {
  const vs = values(p, leg, pick);
  const m = median(vs);
  const msg = `${p} ${what}: median ${m.toFixed(0)} s of [${vs.map((v) => v.toFixed(0)).join(", ")}]`;
  expect(m, msg).toBeGreaterThanOrEqual(min);
  expect(m, msg).toBeLessThanOrEqual(max);
}

describe("pacing — Run 1's opening (GREEDY)", () => {
  it("unlocks Wildwood in about 1–2.5 minutes", () => expectBand("GREEDY", 0, (r) => r.caseUnlockedAt.wildwood, [45, 150], "Wildwood"));
  it("unlocks Bedrock in about 2.5–6.5 minutes", () => expectBand("GREEDY", 0, (r) => r.caseUnlockedAt.bedrock, [150, 400], "Bedrock"));
  it("reaches stage 2 (Buzzed) within 20 s – 2 min", () => expectBand("GREEDY", 0, (r) => r.stageReachedAt[2], [20, 120], "Buzzed"));
  it("wakes the bot by about two and a half minutes", () => expectBand("GREEDY", 0, (r) => r.botAwakeAt, [0, 150], "bot awake"));
  it("buys the auto-seller at about 3–5 minutes", () => expectBand("GREEDY", 0, (r) => r.sellerAt, [180, 300], "seller"));
});

for (const p of ["GREEDY", "CASUAL"] as const) {
  const t = TARGETS[p];
  describe(`pacing — ${p} through the campaign`, () => {
    it("buys auto-spin after the auto-seller and before Vault I, and keeps it on", () => {
      const at = med(p, 0, (r) => r.autoSpinAt);
      expect(at).toBeGreaterThan(med(p, 0, (r) => r.sellerAt));
      expect(at).toBeLessThan(med(p, 0, (r) => r.vaultAt));
    });
    it(`opens Vault I at ${mins(t.firstVault)}`, () => expectBand(p, 0, (r) => r.vaultAt, t.firstVault, "Run 1 vault"));
    for (let n = 2; n <= LAST_RUN; n++) {
      it(`Run ${n} catches up to Run ${n - 1}'s shelf in ${mins(t.catchUp)} and opens its vault at ${mins(t.vault)}`, () => {
        expectBand(p, n - 1, (r) => r.runCasesAt[n - 1], t.catchUp, `Run ${n} catch-up`);
        expectBand(p, n - 1, (r) => r.vaultAt, t.vault, `Run ${n} vault`);
      });
    }
    it(`a replay of Run ${LAST_RUN} vaults again at ${mins(t.replay)}`, () =>
      expectBand(p, REPLAY, (r) => r.vaultAt, t.replay, `Run ${LAST_RUN} replay vault`));
    it("never leaves the tray stuck full for long", () => {
      for (const legs of campaigns[p]) for (const l of legs) expect(l.report.longestTrayFull, `${p} Run ${l.run}`).toBeLessThan(10);
    });
  });
}

describe("pacing — the runs' machines and stages (GREEDY)", () => {
  it("Run 2 buys the locker by about 4 min and presses contracts", () => {
    expect(med("GREEDY", 1, (r) => r.lockerAt)).toBeLessThan(240);
    expect(median(campaigns.GREEDY.map((legs) => legs[1]!.report.contracts))).toBeGreaterThan(0);
  });
  for (let n = 2; n <= LAST_RUN; n++) {
    it(`Run ${n} reaches stage ${STAGE_TARGETS[n]} before its vault`, () => {
      expect(median(campaigns.GREEDY.map((legs) => legs[n - 1]!.report.topStage))).toBeGreaterThanOrEqual(STAGE_TARGETS[n]!);
    });
  }
});

describe("the 90 s rule (spec §5): once a run is fully bought, its vault costs at most 90 s of its CASUAL income", () => {
  // each CASUAL leg again, same seed and setup, with the vault out of reach until everything is bought (bot.ts)
  const probes = campaigns.CASUAL.map((legs) => legs.map((l) => playToFull(l.seed, CASUAL, l.setup)));
  for (let i = 0; i <= LAST_RUN; i++) {
    const name = i === REPLAY ? `the Run ${LAST_RUN} replay` : `Run ${i + 1}`;
    it(name, () => {
      for (const legs of probes) {
        const r = legs[i]!;
        expect(r.fullAt, `${name} never fully bought within ${PROBE_SECONDS} s`).toBeDefined();
        expect(r.fullIncome!, name).toBeGreaterThan(0);
        expect(r.vaultPrice / r.fullIncome!, `${name}: the vault in seconds of income`).toBeLessThanOrEqual(VAULT_INCOME_SECONDS);
      }
    });
  }
});
```

- [ ] **Step 4: Pin the save's prices** in `game/save.test.ts`, inside `describe("the local save")`:
  ```ts
  it("keeps a run's own prices across a retune (finish spec §5: saves keep their run's setup)", () => {
    const d = data();
    d.run.setup = { ...d.run.setup, vaultPrice: 1_234_567, valueBoost: 9 };
    expect(decodeSave(encodeSave(d))!.run.setup).toMatchObject({ vaultPrice: 1_234_567, valueBoost: 9 });
  });
  ```
  This passes at once. It is a pin, so that a later "normalize the setup" change cannot silently reprice a run in progress.

- [ ] **Step 5: Run the pacing tests to see them fail.**
  Run: `npx vitest run src/modules/casecremental/sim/pacing.test.ts`
  Expected: FAIL on F2's numbers. F2's prototype had GREEDY at Run 1 vault ~455 s, Runs 2–3 ~386/388 s and the replay ~384 s. All of these are above the new 240–360 / 180–300 bands. The CASUAL rows and the 90 s rule are unknown until measured. Note which tests fail.

- [ ] **Step 6: Tune `sim/tuning.ts`** with the scratch printout, using "Which lever moves which median" above.
  1. **Run 1.** Bring both profiles' Run 1 vault into its band with `VAULT_PRICES[0]`. GREEDY must fall from ~455 s to ~300 s, so start the sweep at `[400k, 600k, 800k]`. Keep bot, seller and auto-spin in order. If CASUAL is above 540 s while GREEDY is on target, lower `AUTOSPIN_COST` (sweep `[10k, 20k, 30k, 40k]`) before touching anything else.
  2. **Run 2**, then **Run 3**: catch-up first (the previous shelf's top unlock), then the vault (`VAULT_PRICES[1]`, `[2]`).
  3. **The replay**: `VAULT_PRICES[2]` is fixed by Run 3 by now, so use `VAULT_GROWTH`. It must stay ≥ `CATCH_UP_PER_VAULT` or each loop gets easier.
  4. **The 90 s rule.** For each run whose ratio is above 90, lower its vault price and slow its middle (raise its new cases' unlocks) until both the vault time and the ratio pass. If a probe never gets fully bought, the top levels of Luck and Appraiser are too dear for that run: lower their `growth` and re-check Run 1's opening.
  5. **Stages.** If Run 2 no longer reaches High or Run 3 Tripping, take a dearer vault within its band first.

  Keep every median at least 5 s inside its band, so a seed shift doesn't flip a test. Give each changed constant a short comment saying F4 set it and why, e.g. `// F4: Run 1's vault at ~5 min GREEDY / ~7.5 min CASUAL`. Update the existing comments that quote old numbers: `VAULT_GROWTH`, and the `neon` comment from F2.

- [ ] **Step 7: Run everything and check the time.**
  Run: `npx vitest run src/modules/casecremental/sim/pacing.test.ts` (PASS) and note `Duration`.
  - **Budget:** the pacing file finishes in ≤ 10 s on the dev laptop. The sims run once at collection and are shared by every test, and each probe stops 60 s after `fullAt`, so expect a few seconds.
  - If it is over budget, split the CASUAL rows and the 90 s rule into `sim/pacingCasual.test.ts`, with the same helpers copied and only the CASUAL campaigns. Vitest runs test files in parallel workers by default. The repo has no Vitest config (`vite.config.ts` has no `test` block) and none is needed for that.
  - Do not lower `RUN_SECONDS` below the CASUAL vault band's top (540 s) plus margin, or a slow seed reads as "never".

  Then run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS). Other suites that quote a tuning number may fail: case, campaign and prestige tests, and i18n strings that print a price. Update those expectations to the new numbers. Never change a number back to suit a test.

- [ ] **Step 8: Commit**, with the measured medians in the message body. Run `git status` first and confirm `sim/tune.scratch.test.ts` is **not** staged; delete it, or leave it untracked.
  ```bash
  git add src/modules/casecremental/sim/pacing.test.ts src/modules/casecremental/sim/tuning.ts src/modules/casecremental/game/save.test.ts
  git commit -m "feat(pacing): GREEDY and CASUAL targets for Runs 1-3, the 90 s rule, and the retune

  Medians (5 seeds), GREEDY / CASUAL: Run 1 vault <t>/<t> s; Run 2 catch-up <t>/<t>, vault <t>/<t>;
  Run 3 catch-up <t>/<t>, vault <t>/<t>; replay vault <t>/<t>. 90 s rule worst seed: R1 <x>, R2 <x>, R3 <x>, replay <x>.
  Changed: <constant: old -> new, ...>.

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```
  (Write the real numbers in place of `<t>` / `<x>` and the list of changes. If other suites' expectations were updated in Step 7, add those files to the `git add`.)

**What F6-A Task 8 gets from this task.** Once F6-A adds `lastcase` to `VAULTS` and sets `LAST_RUN = 4`, this file automatically does three things:
- plays Run 4 as a leg and its replay as the last leg;
- holds Run 4 to the "Runs 2–4" catch-up and vault rows and to `STAGE_TARGETS[4] = 5`;
- runs the 90 s rule on Run 4 and its replay.

F6-A's stand-alone `chain()` is then unnecessary. Its 90 s test must use `playToFull` (as here), not `fullAt` read off the chain's own runs: a CASUAL player usually buys the vault before everything is bought, so those runs rarely have `fullAt`. F6-A still has three things to do: add the Upgrader clause to `fullyBought`, add `() => buyUpgrader(run)` to `bot.test.ts`'s `buyEverything`, and write its Upgrader test.

---

### Task 3: The notes

**Files:**
- Modify: `docs/feature-history/casecremental-finish.md` (F2 created it; if it is missing, create it with `# Casecremental — Finish (M4 + M5)` and a pointer to the finish spec, and add its README line), `docs/feature-history/casecremental-run1.md`, `docs/feature-history/casecremental-runs-2-3.md`, `docs/feature-history/README.md`

- [ ] **Step 1: Add a section** `## F4 — pacing for real players` to `casecremental-finish.md`. Keep to what the code does not show:
  - **Why:** the user's play-test ("runs are too slow… vault cases 2 and 3 are too hard to buy"). The M1–M3 tests tuned to a perfect player who never pauses.
  - **The two profiles:** GREEDY (`HUMAN`) and CASUAL, with CASUAL's exact timings, the 8 s shop look, and why the vault is outside the shop look.
  - **How the 90 s rule is measured:**
    - fully bought includes the Machines rows;
    - income is net cash over 60 s;
    - it is measured in a probe of the same seed with the vault out of reach, because a CASUAL player usually buys the vault before everything is bought;
    - it is checked on every seed, Runs 1–3 and the first replay.
  - **Decisions:**
    - No auto-spin perk. Spec §3 left it to F4. Run 2+ buys auto-spin within its catch-up, and a perk would need a meta field, a prestige row and EN/RU strings. Revisit in F9 if CASUAL's catch-up needs it.
    - The synthetic Run 1 replay test and the Run 3 replay catch-up test were dropped (Task 2's reasons).
    - The run rows loop to `LAST_RUN`, so Run 4 inherits them.
  - **Known limit:** each replay loop's vault grows ×3.25 against sales ×3, so the 90 s ratio worsens ~8 % per loop. Only the first replay is tested. F9 decides whether later loops need a cap.
  - **The final numbers:** the changed constants (old → new) and the measured medians table for both profiles, copied from Task 2's commit message.
  - **How to retune:** the levers table lives in this plan (`docs/superpowers/plans/2026-10-12-casecremental-f4-pacing.md`). Give its path rather than copying it.

- [ ] **Step 2: Point the old notes at it.**
  - In `casecremental-run1.md`'s "Tuning" bullet, add at its start: "Superseded by F4 (two timing profiles and new targets, see `casecremental-finish.md`); the M2b numbers below are history." Leave the history as is.
  - In `casecremental-runs-2-3.md`'s "Pacing targets" bullet, add: "F4 replaced these with spec §5's GREEDY/CASUAL targets and the 90 s rule (see `casecremental-finish.md`)". Then update "Vault prices are 1.2M / 2B / 420B" to "see `casecremental-finish.md` for the current prices".
  - In `README.md`, extend the finish line's gist with "; F4: GREEDY/CASUAL pacing, the 90 s rule".

- [ ] **Step 3: Commit.**
  ```bash
  git add docs/feature-history
  git commit -m "docs(feature-history): F4 - pacing for real players

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

## Self-review notes (spec §5 coverage)

| Spec §5 item | Covered in |
|---|---|
| CASUAL profile in `sim/bot.ts`: buy 0.8, key 0.8, sell 1.2, reveal 0.8, upgrades every 8 s, runs auto-spin once owned | Task 1 (auto-spin buying and keeping on is F2's `spend`, shared by both profiles) |
| Targets, both profiles: Run 1 vault, Runs 2–4 catch-up and vault, the last run's replay | Task 2, Runs 2–3 here; the loops carry Run 4 into F6-A |
| Hard 90 s rule, tested per run | Task 2 (definition: "How income is measured") |
| Other tests stay: bot ~2.5 min, seller 3–5 min, tray, contracts in Run 2, stage targets | Task 2 (the tray for both profiles; stages for Runs 2–3, Run 4's `5` in `STAGE_TARGETS`) |
| Tune only `sim/tuning.ts`; saves keep their run's setup | Task 2, Steps 4 and 6 |
| Auto-spin price and Delay "priced by F4" (spec §3); perk decision | Task 2 levers; Task 3 records "no perk" |
