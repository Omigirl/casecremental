# Casecremental M3-A — Runs 2 and 3 in the sim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything Runs 2 and 3 are, in the pure sim and the game layer (controller, view, save, agent): the
campaign's run number and per-run content, cases 4–7 and Vaults II/III as data, the bot's second reel, the locker
and trade-up contracts, the auto-buyer grid, five more charms, dev shortcuts, and pacing for Runs 2 and 3.

**Architecture:** First a pure refactor splits `sim/run.ts` (724 lines): the `Run` class keeps the bench, combo and
heat and implements a small `RunCtx` interface; each machine is a file of functions over `RunCtx` (bot, auto-seller,
vault, day job, then the new locker and grid). Per-run content is one table, `RUN_CONTENT`, read everywhere. The
renderer only gets the minimum changes needed to compile and keep working with one bot card. Plans M3-D/M3-E draw the
new machines from the view and events this plan produces.

**Tech Stack:** TypeScript strict, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-m3-runs-2-3-design.md` (§2–§6, §8–§10, §12, §13). Run
after Plan M3-B (`2026-10-12-casecremental-m3-b-skin-patterns.md`), which adds the pattern kinds and the `rise`
motion that Task 3's case data uses.

## Global Constraints

- The sim stays pure and deterministic: no DOM, no `Date`, no `Math.random` under `sim/`. Run 1 must consume the RNG
  exactly as before, so every existing seeded test keeps its numbers (Tasks 1–2 change no test expectation except
  the ones they name).
- Change balance numbers only in `sim/tuning.ts`. When a pacing test fails, tune numbers, never the logic or the
  greedy player's timings.
- Every input goes through `controller.act` (the single input path); every machine refuses actions while the vault is
  out (`locked()`), as the existing ones do.
- Only hand actions feed the combo: hand sales, hand claims and hand stores into the locker. Machines never do.
- `runNumber = min(loops + 1, LAST_RUN)`, `LAST_RUN = 3`. A run keeps its setup (`setup.run`, prices) for its whole life.
- English and Russian for every new player-visible string, within `i18n/budgets.ts`. Parody names only — no real CS
  names or marks.
- A file that grows past ~400 lines with a new responsibility gets split.
- Commands: `npm run typecheck`, `npx vitest run src/modules/casecremental`, `npm run build`. The pre-commit hook runs
  Prettier. Each task ends with all three green.
- Other agents may commit asset files on this branch in parallel: stage only your own files by explicit path
  (never `git add -A`, `git add .` or `commit -a`); on an `index.lock` error wait and retry.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```
  An implementer on another model uses its own model name in the first line.

## Review Focus

1. **The vault bought while machines hold cards** (two bot cards, a contract pressing, locker cards waiting, grid
   cells mid-open) → every one is cashed in once as a machine sale or refunded, nothing is lost or paid twice, and the
   run still ends at 17.4 s. Pinned in Task 4 (bot), Task 5 (locker, press) and Task 6 (grid).
2. **Reload in the middle of anything new** (a bot double spin, a press running, cells opening, a stalled grid) →
   resumes exactly; a version-3 save loads as version 4. Pinned by snapshot round-trips in Tasks 4–6 and the
   migration test in Task 4.
3. **The locker full, the tray full, or both** → Collect falls back to the normal rule; a stalled grid stops buying
   and keeps its drops; nothing is dropped or duplicated. Pinned in Tasks 5 and 6.
4. **Cash low with the grid on** → the grid never takes cash below its reserve, so BUY, the day job and the vault
   stay reachable. Pinned in Task 6.
5. **Caps across runs** → Run 1 shows multi-open level 2 as NEXT RUN, Run 3 shows MAX; the bot's Speed likewise; a
   Run 1 save never offers a Run 2 case or machine. Pinned in Tasks 2 and 4.

---

## File Structure (paths relative to `src/modules/casecremental/`)

| File | Change |
|---|---|
| `sim/runTypes.ts` (new) | `RunState`, `RunSetup`, `DEFAULT_SETUP`, `RunSnapshot`, `SimEvent`, `ActionResult`, `Bench`, `BenchReel`, `VaultState`, `SaleSource`, `RunCtx`, `OK`, `fail` (moved out of `run.ts`, which re-exports them) |
| `sim/run.ts` | the `Run` class: bench, combo, heat, stage; implements `RunCtx`; thin wrappers over machine functions |
| `sim/botOpener.ts` | + `tickBot`, `wakeBot`, `buyBotSpeed`, `buyBotMulti`, `sellBotCard`, `setBotCase` over `RunCtx`; speed anchors; `cards` |
| `sim/autoSeller.ts` | + `tickSeller`, `autoTake`, `buySeller`, `buySellerSpeed`; Collect routing |
| `sim/vault.ts` (new) | `buyVault`, `turnVaultKey`, `tickVault` over `RunCtx` |
| `sim/dayJob.ts` (new) | `dayJobAvailable`, `startDayJob`, `tickDayJob` |
| `sim/campaign.ts` (new) | `runNumber`, `runContent`, `runCaseIds`, `vaultPriceFor`, `capRaisedLater` |
| `sim/locker.ts` (new) | locker state, capacity, `contractResults`, store / press / auto contract over `RunCtx` |
| `sim/grid.ts` (new) | grid state, buying, opening, routing over `RunCtx` |
| `sim/content/cases.ts` | lookups only; `CASES` assembled from the files below |
| `sim/content/casesRun1.ts`, `casesRun2.ts`, `casesRun3.ts` (new) | case tables |
| `sim/content/vaults.ts` (new) | `VaultDef`, `VAULTS`, `vaultFor`, the three legends |
| `sim/charms.ts` | 5 new charms, `CHARM_POOLS`, `charmPool(run)`; Hoarder, Fever, Collector's Eye helpers |
| `sim/upgrades.ts` | caps per run |
| `sim/meta.ts` | run-aware setup, offers, charm slot ×2 |
| `sim/tuning.ts` | `LAST_RUN`, `RUN_CONTENT`, new case economy, vault prices, bot/locker/grid/charm numbers |
| `sim/bot.ts` | the greedy player learns the new machines |
| `sim/pacing.test.ts` | Runs 2, 3 and a Run 3 replay |
| `game/controller.ts` | new actions; `devStartRun`, `devAddCash` |
| `game/view.ts` (+ `game/viewMachines.ts` new if view.ts passes ~400 lines) | new view fields |
| `game/save.ts` | `SAVE_VERSION` 4, v3 → v4 migration, new defaults |
| `game/agent.ts` | new state and actions |
| `i18n/content.ts`, `i18n/budgets.ts` | case, skin, vault, charm names |
| `fx/World.ts`, `fx/labels.ts`, `fx/pixel/BotCard.ts` | compile fixes only (bot `cards`, `drops`) |
| `ui/Settings.tsx`, `i18n/en.ts`, `i18n/ru.ts` | the dev START RUN 2 / 3 and +CASH buttons |

---

### Task 1: Split `run.ts` behind a `RunCtx` (pure refactor)

**Files:**
- Create: `sim/runTypes.ts`, `sim/vault.ts`, `sim/dayJob.ts`
- Modify: `sim/run.ts`, `sim/botOpener.ts`, `sim/autoSeller.ts`

**Interfaces:**
- Produces (every later task uses it):
```ts
// sim/runTypes.ts
export interface RunCtx {
  readonly state: RunState;
  readonly setup: RunSetup;
  readonly rng: Rng;
  emit(e: SimEvent): void;
  /** Adds to cash and to lifetime earnings. */
  earn(amount: number): void;
  payout(d: Drop, byHand: boolean): number;
  casePrice(caseId: string): number;
  /** Rolls one case's drop with Luck, Pity, the Golden Hour and the charms; counts the open. */
  rollFor(caseId: string, forced?: RarityId | null): Drop;
  /** The charms that react to a reveal; `spot` "bench" also stamps revealedAt. */
  onReveal(d: Drop, spot: RevealSpot): void;
  /** Reveals this tick, for heat. */
  countReveals(n: number): void;
  bumpCombo(): void;
  /** Nobody holds a card any more. */
  release(): void;
  takeBenchCard(slot: number): void;
  locked(): boolean;
}
export type RevealSpot = CardSpot; // widened in Tasks 5 and 6
export const OK: ActionResult = { ok: true };
export const fail = (reason: string): ActionResult => ({ ok: false, reason });
```
- Every public method of `Run` keeps its name and signature (`buyVault`, `turnVaultKey`, `wakeBot`, `buyBotSpeed`,
  `sellBotCard`, `setBotCase`, `buySeller`, `buySellerSpeed`, `setSellerThreshold`, `claim`, `startDayJob`,
  `dayJobAvailable`, `vaultShown`, `locked`, …); `run.ts` re-exports everything from `runTypes.ts`, so no importer
  changes.

- [ ] **Step 1: Baseline.** Run `npx vitest run src/modules/casecremental` and note the count (≈916 passing).
- [ ] **Step 2: Move the types.** Cut `BenchReel`, `Bench`, `VaultState`, `SaleSource`, `RunSetup`, `DEFAULT_SETUP`,
  `RunSnapshot`, `SimEvent`, `ActionResult`, `RunState` from `run.ts` into `runTypes.ts` verbatim, add `RunCtx`,
  `RevealSpot`, `OK`, `fail` as above, and in `run.ts` add `export * from "./runTypes";` (keep `export type { CardSpot }`).
- [ ] **Step 3: Machine functions.** Move each method body to a function taking `ctx: RunCtx` first, replacing
  `this.state` with `ctx.state`, `this.setup` with `ctx.setup`, `this.events.push(e)` with `ctx.emit(e)`, the
  `s.cash += amount; s.lifetimeEarnings += amount;` pairs with `ctx.earn(amount)`, `this.rng` with `ctx.rng`,
  `this.revealsThisTick++` with `ctx.countReveals(1)`, and private calls with the `RunCtx` methods:
  - `sim/botOpener.ts`: `wakeBot(ctx)`, `buyBotSpeed(ctx)`, `sellBotCard(ctx)`, `setBotCase(ctx, caseId)`, `tickBot(ctx, dt)`.
  - `sim/autoSeller.ts`: `buySeller(ctx)`, `buySellerSpeed(ctx)`, `setSellerThreshold(ctx, r)`, `tickSeller(ctx)`,
    `autoTake(ctx, d, from, slot)` (exported; the grid will call it).
  - `sim/vault.ts`: `vaultShown(ctx)`, `buyVault(ctx)`, `turnVaultKey(ctx)`, `tickVault(ctx, dt)`.
  - `sim/dayJob.ts`: `dayJobAvailable(ctx, cheapest: number)`, `startDayJob(ctx, cheapest: number)`, `tickDayJob(ctx, dt)`.
  `Run` keeps `buyCase`, `insertKey`, `sell`, `unlockCase`, `buyUpgrade`, `claim`, `setHeld`, `tick`, the dev forcing
  methods, `snapshot`, `fromSnapshot`, `drainEvents`, `effects`, `comboMultiplier`, `intensity`, `casePrice`,
  `cheapestPrice`, `payout`, `openCount`, and implements `RunCtx` (make `rng`, `emit`, `earn`, `rollFor`, `onReveal`,
  `countReveals`, `bumpCombo`, `release`, `takeBenchCard` public; `rng` becomes `readonly rng: Rng`). Its machine
  methods become one-liners, e.g. `buyVault(): ActionResult { return buyVault(this); }` (import the function under an
  alias, e.g. `import * as vault from "./vault"` → `vault.buyVault(this)`).
  Keep the order of operations inside `tick` exactly: bench → free case → combo → bot → seller → day job → vault →
  heat → stage. Never change the order of RNG draws.
- [ ] **Step 4: Verify the refactor.** `npm run typecheck && npx vitest run src/modules/casecremental` → the same count,
  all green, no test file changed. `wc -l sim/run.ts` → well under 450.
- [ ] **Step 5: Commit.** `refactor(sim): split run.ts - the bot, auto-seller, vault and day job are functions over a RunCtx`
  staging `sim/runTypes.ts sim/run.ts sim/botOpener.ts sim/autoSeller.ts sim/vault.ts sim/dayJob.ts`.

### Task 2: The campaign — run numbers, per-run content and caps

**Files:**
- Create: `sim/campaign.ts`, `sim/campaign.test.ts`
- Modify: `sim/tuning.ts`, `sim/runTypes.ts` (`RunSetup.run`), `sim/run.ts`, `sim/vault.ts`, `sim/upgrades.ts`,
  `sim/botOpener.ts`, `sim/meta.ts`, `game/view.ts`, `game/save.ts` (normalize: `setup.run ?? 1`), `game/agent.ts`,
  `sim/pacing.test.ts`, `sim/upgrades.test.ts`, `sim/meta.test.ts`, `sim/botOpener.test.ts`, `i18n/content.ts`

**Interfaces:**
- Produces:
```ts
// sim/tuning.ts
export const LAST_RUN = 3;
export interface RunContent {
  /** How many cases of the ladder this run's shelf has. */
  cases: number;
  /** Your widest multi-open. */
  multiOpen: number;
  /** The bot's Speed levels this run. */
  botSpeedLevels: number;
  /** Cases one bot spin opens at most (1 = no bot multi-open). */
  botMultiOpen: number;
  locker: boolean;
  grid: boolean;
  autoContract: boolean;
}
export const RUN_CONTENT: readonly RunContent[] = [
  { cases: 3, multiOpen: 2, botSpeedLevels: 5, botMultiOpen: 1, locker: false, grid: false, autoContract: false },
  { cases: 5, multiOpen: 3, botSpeedLevels: 8, botMultiOpen: 2, locker: true, grid: false, autoContract: false },
  { cases: 7, multiOpen: 5, botSpeedLevels: 11, botMultiOpen: 2, locker: true, grid: true, autoContract: true },
];
/** The bot's speed at these levels; geometric in between (Run 1's ×1 → ×8 over 5 levels is unchanged). */
export const BOT_SPEED_ANCHORS: ReadonlyArray<readonly [level: number, speed: number]> = [[0, 1], [5, 8], [8, 20], [11, 50]];
/** Each run's vault price the first time it is reached; a replay of the last run multiplies it by VAULT_GROWTH. */
export const VAULT_PRICES = [1_000_000, 50_000_000, 2_500_000_000] as const;
// UPGRADE_COSTS.multiOpen becomes { baseCost: 500, growth: 25, maxLevel: 4 } (×5 in Run 3)
// PERK_COSTS.charmSlot becomes { baseCost: 15, growth: 2, maxLevel: 2 }
// BOT_SPEED_LEVELS and BOT_MAX_SPEED are removed (RUN_CONTENT and BOT_SPEED_ANCHORS replace them)

// sim/runTypes.ts — RunSetup gains:
  /** The campaign run this is (1–LAST_RUN). */
  run: number;
// DEFAULT_SETUP.run = 1

// sim/campaign.ts
export const runNumber = (loops: number): number => Math.min(loops + 1, LAST_RUN);
export const runContent = (run: number): RunContent => RUN_CONTENT[Math.min(Math.max(run, 1), LAST_RUN) - 1]!;
/** The case ids on this run's shelf, cheapest first. */
export const runCaseIds = (run: number): string[] => CASES.slice(0, runContent(run).cases).map((c) => c.id);
/** The vault price for the run that starts after `loops` vaults. */
export function vaultPriceFor(loops: number): number {
  const run = runNumber(loops);
  return VAULT_PRICES[run - 1]! * VAULT_GROWTH ** Math.max(0, loops - (run - 1));
}
/** A level at this run's cap that a later run (≤ LAST_RUN) lets you go past: the UI says NEXT RUN, not MAX. */
export function capRaisedLater(cap: (run: number) => number, level: number, run: number): boolean {
  for (let r = run + 1; r <= LAST_RUN; r++) if (cap(r) > level) return true;
  return false;
}

// sim/upgrades.ts
export function upgradeCap(id: UpgradeId, run = 1): number  // multiOpen: runContent(run).multiOpen - 1; else UPGRADE_COSTS[id].maxLevel
export function upgradeCost(id: UpgradeId, level: number, run = 1): number | null  // null at the run's cap

// sim/botOpener.ts
export const botSpeed = (level: number): number           // geometric between BOT_SPEED_ANCHORS
export const botSpeedLevels = (run: number): number       // runContent(run).botSpeedLevels
export function botSpeedCost(level: number, run = 1): number | null
export const botSpinSeconds = (level: number): number     // unchanged formula

// sim/run.ts
run.runCases(): string[]          // runCaseIds(this.setup.run)
// vaultShown: every runCases() id unlocked; unlockCase refuses an id not in runCases() ("not in this run")

// sim/meta.ts
export function offerCharms(seed: number, loops: number, run: number): CharmId[]   // draws from charmPool(run)
// completeVault offers for runNumber(m.loops) after the increment
// setupFor: run: runNumber(m.loops), vaultPrice: vaultPriceFor(m.loops)

// sim/charms.ts (Task 7 fills the later pools)
export const CHARM_POOLS: Readonly<Record<number, readonly CharmId[]>> = { 1: RUN1_CHARMS, 2: RUN1_CHARMS, 3: RUN1_CHARMS };
export const charmPool = (run: number): readonly CharmId[] => CHARM_POOLS[Math.min(Math.max(run, 1), LAST_RUN)]!;

// game/view.ts
GameView.run: number;
UpgradeView.nextRun: boolean;    // cost === null && capRaisedLater(...)
BotView.speedNextRun: boolean;
GameView.cases: only runCases(), in ladder order
PrestigeView.nextRun: number;    // runNumber(meta.loops)
PrestigeView.replay: boolean;    // meta.loops >= LAST_RUN (the next run repeats the last one)
```

- [ ] **Step 1: Failing tests** — `sim/campaign.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { botSpeed, botSpeedCost } from "./botOpener";
import { capRaisedLater, runCaseIds, runNumber, vaultPriceFor } from "./campaign";
import { completeVault, freshMeta, setupFor } from "./meta";
import { DEFAULT_SETUP, Run } from "./run";
import { BOT_SPEED_ANCHORS, VAULT_GROWTH, VAULT_PRICES } from "./tuning";
import { upgradeCap, upgradeCost } from "./upgrades";

describe("the campaign", () => {
  it("numbers runs by vaults opened, staying on the last run after it", () => {
    expect([0, 1, 2, 3, 7].map(runNumber)).toEqual([1, 2, 3, 3, 3]);
  });

  it("prices each run's vault, and replays of the last run grow", () => {
    expect(vaultPriceFor(0)).toBe(VAULT_PRICES[0]);
    expect(vaultPriceFor(1)).toBe(VAULT_PRICES[1]);
    expect(vaultPriceFor(2)).toBe(VAULT_PRICES[2]);
    expect(vaultPriceFor(4)).toBe(VAULT_PRICES[2] * VAULT_GROWTH ** 2);
  });

  it("caps multi-open by run: x2, x3, x5", () => {
    expect([1, 2, 3].map((r) => upgradeCap("multiOpen", r))).toEqual([1, 2, 4]);
    expect(upgradeCost("multiOpen", 1, 1)).toBeNull();
    expect(upgradeCost("multiOpen", 1, 2)).not.toBeNull();
    expect(capRaisedLater((r) => upgradeCap("multiOpen", r), 1, 1)).toBe(true);
    expect(capRaisedLater((r) => upgradeCap("multiOpen", r), 4, 3)).toBe(false);
  });

  it("keeps Run 1's bot speeds and reaches x20 and x50 at the later caps", () => {
    expect(botSpeed(0)).toBe(1);
    expect(botSpeed(5)).toBeCloseTo(8, 9);
    expect(botSpeed(3)).toBeCloseTo(8 ** (3 / 5), 9);
    expect(botSpeed(8)).toBeCloseTo(20, 9);
    expect(botSpeed(11)).toBeCloseTo(50, 9);
    expect(BOT_SPEED_ANCHORS.at(-1)).toEqual([11, 50]);
    expect(botSpeedCost(5, 1)).toBeNull();
    expect(botSpeedCost(5, 2)).not.toBeNull();
    expect(botSpeedCost(8, 2)).toBeNull();
  });

  it("a Run 1 shelf has three cases and the vault needs only those", () => {
    expect(runCaseIds(1)).toEqual(["bootcamp", "wildwood", "bedrock"]);
    const run = new Run(1, { ...DEFAULT_SETUP, startCash: 1e9 });
    expect(run.runCases()).toEqual(["bootcamp", "wildwood", "bedrock"]);
    run.unlockCase("wildwood");
    run.unlockCase("bedrock");
    expect(run.vaultShown()).toBe(true);
  });

  it("the run after a vault is Run 2, with its vault price", () => {
    const m = freshMeta();
    completeVault(m, 1e9, "vault1", 1);
    const setup = setupFor(m);
    expect(setup.run).toBe(2);
    expect(setup.vaultPrice).toBe(VAULT_PRICES[1]);
  });
});
```
- [ ] **Step 2:** `npx vitest run src/modules/casecremental/sim/campaign.test.ts` → FAIL (`campaign` module missing).
- [ ] **Step 3: Implement** the interfaces above. Details:
  - `botSpeed(level)`: find the anchor pair `[l0,s0],[l1,s1]` with `l0 ≤ level ≤ l1` (clamp to the last anchor) and
    return `s0 * (s1 / s0) ** ((level - l0) / (l1 - l0))`. For levels 0–5 this equals the old `8 ** (level / 5)`.
  - `botSpeedCost(level, run)`: `level >= botSpeedLevels(run) ? null : Math.ceil(baseCost * growth ** level)` (same
    `BOT_SPEED_COSTS`).
  - `Run.buyUpgrade(id)` and `buyBotSpeed` pass `this.setup.run`. `Run.buyCase` refuses a case not in `runCases()`.
  - `vault.ts`: `vaultShown(ctx)` uses `runCaseIds(ctx.setup.run)`.
  - `meta.ts`: `completeVault` → `m.offer = offerCharms(seed, m.loops, runNumber(m.loops))`; `setupFor` as above.
    `offerCharms` for run 1 draws from exactly `RUN1_CHARMS` with the same RNG calls as before.
  - `i18n/content.ts`: perk `charmSlot` description → `{ en: "+1 charm slot", ru: "+1 слот талисмана" }`.
  - `view.ts`: `cases` from `run.runCases()`; `UpgradeView.maxLevel` = `upgradeCap(id, run)`; `nextRun`;
    `BotView.speedNextRun`; `GameView.run = run.setup.run`; `PrestigeView.nextRun/replay`. `nextGoal` reads only the
    run's cases (it already reads `cases`).
  - `save.ts` `normalize`: the `setup` spread already fills `run: 1` from `DEFAULT_SETUP`.
  - `agent.ts`: `state().run = c.run.setup.run`; the `buyCase` description lists the run's case ids from
    `c.run.runCases()` at call time (or "a case id from cases[]").
  - Existing tests that pinned Run-1-only facts: `upgrades.test.ts` (multiOpen maxLevel 1 → `upgradeCap("multiOpen", 1) === 1`),
    `botOpener.test.ts` (levels via `botSpeedCost(level, 1)`), `meta.test.ts` (charm slot max 2; a vault's setup is
    run 2). Update only those expectations.
  - `pacing.test.ts`, "a boosted second run…": it now means a **Run 1 replay**, so build its setup as
    `{ ...setupFor(meta), run: 1, vaultPrice: VAULT_PRICES[0] * VAULT_GROWTH }` (the old Run-1-replay numbers);
    Task 9 adds the Run 2 and 3 tests.
- [ ] **Step 4:** `npm run typecheck && npx vitest run src/modules/casecremental` → PASS (Run 1 numbers unchanged).
- [ ] **Step 5: Commit** `feat(sim): the campaign - run numbers, per-run content and caps (NEXT RUN), per-run vault prices`.

### Task 3: Cases 4–7 and Vaults II / III as data

**Files:**
- Create: `sim/content/casesRun1.ts`, `sim/content/casesRun2.ts`, `sim/content/casesRun3.ts`, `sim/content/vaults.ts`, `sim/content/vaults.test.ts`
- Modify: `sim/content/cases.ts`, `sim/content/cases.test.ts`, `sim/tuning.ts`, `sim/vault.ts`, `i18n/content.ts`,
  `i18n/budgets.ts`, `ui/CaseShelf.tsx`, `ui/Hud.tsx` (vault name by id), anything importing `VAULT_LEGEND` /
  `VAULT_TROPHY` (`grep -rn "VAULT_LEGEND\|VAULT_TROPHY" src/modules/casecremental`)

**Interfaces:**
- Consumes: the 13 PatternKinds and `rise` from Plan M3-B (`circuit hex carbon synthgrid neonline hueflow starfield
  nebula aurora iridescent flame ember molten`). If M3-B's report changed a name or a palette rule, follow M3-B.
- Produces:
```ts
// sim/content/vaults.ts
export interface VaultDef {
  /** Also the vault's case id on its drops, and its name key ("vault1"…). */
  id: "vault1" | "vault2" | "vault3";
  run: number;
  /** The trophy kept forever. */
  trophy: string;
  /** Its four ordinary rewards come from this case. */
  sourceCase: string;
  /** The fifth reward. */
  legend: SkinDef;
}
export const VAULTS: readonly VaultDef[];
export const vaultFor = (run: number): VaultDef;   // clamps like runContent
// sim/content/cases.ts: CASES = [...RUN1_CASES, ...RUN2_CASES, ...RUN3_CASES]; skinById knows every vault legend.
// SimEvent "vaultOpened".trophy = vaultFor(setup.run).trophy; the fifth drop's caseId = def.id.
// GameView.vault.id: VaultDef["id"]
// i18n: caseName("mainframe"|"neon"|"deepspace"|"inferno"|"vault2"|"vault3")
```
- Case ids and economy (`CASE_ECONOMY`, tuned later in Task 9):
  `mainframe { price: 1_500, unlockCost: 12_000 }`, `neon { price: 15_000, unlockCost: 150_000 }`,
  `deepspace { price: 150_000, unlockCost: 1_500_000 }`, `inferno { price: 1_500_000, unlockCost: 15_000_000 }`.

- [ ] **Step 1: Failing tests.** In `sim/content/cases.test.ts` add:
```ts
it("has seven cases, each 5 Mil-Spec, 3 Restricted, 2 Classified, 2 Covert and a knife", () => {
  expect(CASES.map((c) => c.id)).toEqual(["bootcamp", "wildwood", "bedrock", "mainframe", "neon", "deepspace", "inferno"]);
  for (const c of CASES) {
    const n = (r: RarityId) => c.skins.filter((s) => s.rarity === r).length;
    expect([n("milspec"), n("restricted"), n("classified"), n("covert"), n("gold")], c.id).toEqual([5, 3, 2, 2, 1]);
    expect(c.skins.find((s) => s.rarity === "gold")!.weapon, c.id).toBe("knife");
  }
});

it("never reuses a pattern technique from an earlier case (each case is richer)", () => {
  const seen = new Set<string>();
  for (const c of CASES.slice(3)) {
    const kinds = new Set(c.skins.map((s) => s.pattern.kind));
    for (const k of kinds) expect(seen.has(k), `${c.id} reuses ${k}`).toBe(false);
    for (const k of kinds) seen.add(k);
  }
});

it("moves more in each later case", () => {
  const moving = (id: string) => caseById(id).skins.filter((s) => s.motion).length;
  expect(moving("mainframe")).toBeGreaterThanOrEqual(5); // Classified+
  expect(moving("neon")).toBeGreaterThanOrEqual(8); // Restricted+
  expect(moving("deepspace")).toBe(13);
  expect(moving("inferno")).toBe(13);
});

it("prices every case ten times the one before", () => {
  for (let i = 1; i < CASES.length; i++) expect(priceOf(CASES[i]!.id) / priceOf(CASES[i - 1]!.id)).toBeGreaterThanOrEqual(7);
});
```
  `sim/content/vaults.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { caseById, skinById } from "./cases";
import { VAULTS, vaultFor } from "./vaults";
import { Run, DEFAULT_SETUP } from "../run";

describe("vaults", () => {
  it("one per run, its legend an animated knife, its rewards from the run's top case", () => {
    expect(VAULTS.map((v) => [v.id, v.run, v.sourceCase])).toEqual([
      ["vault1", 1, "bedrock"],
      ["vault2", 2, "neon"],
      ["vault3", 3, "inferno"],
    ]);
    for (const v of VAULTS) {
      expect(skinById(v.legend.id)).toBe(v.legend);
      expect(v.legend.weapon).toBe("knife");
      expect(v.legend.motion?.weapon).toBe("flip");
      expect(caseById(v.sourceCase)).toBeDefined();
    }
    expect(vaultFor(9).id).toBe("vault3");
  });

  it("Vault II pays out Neon Nights drops and its own legend", () => {
    const run = new Run(7, { ...DEFAULT_SETUP, run: 2, startCash: 1e12, vaultPrice: 1e6 });
    for (const id of ["wildwood", "bedrock", "mainframe", "neon"]) expect(run.unlockCase(id).ok).toBe(true);
    expect(run.buyVault().ok).toBe(true);
    expect(run.turnVaultKey().ok).toBe(true);
    const drops = run.state.vault!.phase === "opening" ? run.state.vault!.drops : [];
    expect(drops.slice(0, 4).every((d) => d.caseId === "neon")).toBe(true);
    expect(drops[4]!.skinId).toBe("vault2_legend");
    expect(drops[4]!.caseId).toBe("vault2");
    for (let i = 0; i < 18 * 30; i++) run.tick(1 / 30);
    expect(run.drainEvents().find((e) => e.type === "vaultOpened")).toMatchObject({ trophy: "vault2" });
  });
});
```
  Add i18n coverage: the existing content budget test iterates `CONTENT_KEYS()`; add a test that every `CASES` skin id
  and every vault legend id has a non-empty `skinName` in both languages, and every case id + `vault2`/`vault3` has a
  `caseName`.
- [ ] **Step 2:** Run the three files → FAIL.
- [ ] **Step 3: Implement.**
  - Move `bootcamp`, `wildwood`, `bedrock` (and the `skin`/`p`/`KNIFE_MOTION` helpers into a small
    `content/skinHelpers.ts` they all import) into `casesRun1.ts` verbatim (`export const RUN1_CASES = [bootcamp, wildwood, bedrock]`).
  - `casesRun2.ts` (`RUN2_CASES = [mainframe, neon]`) and `casesRun3.ts` (`RUN3_CASES = [deepspace, inferno]`) from these
    tables (`p(kind, palette, scale, seed)`, motion objects literal):

  **Mainframe** — `{ id: "mainframe", name: "Mainframe Case", theme: "tech", tier: 4, color: "#1c2b3a" }`
  | id | name | weapon | rarity | kind | palette | scale | seed | motion |
  |---|---|---|---|---|---|---|---|---|
  | mf_busline | Bus Line | rifle | milspec | circuit | #0b1a14 #12402b #1f7a4d #7dffb0 | 5 | 311 | — |
  | mf_heatsink | Heatsink | pistol | milspec | hex | #15181c #2c333b #56616e #9aa7b5 | 4 | 312 | — |
  | mf_weave | Carbon Weave | smg | milspec | carbon | #0a0a0c #1d1f24 #3a3e46 #6b717c | 6 | 313 | — |
  | mf_board | Motherboard | shotgun | milspec | circuit | #0a1020 #16305a #2c5fa8 #9cc4ff | 5 | 314 | — |
  | mf_firewall | Firewall | mg | milspec | hex | #1a0b05 #4a1d0a #a84a16 #ffb36b | 4 | 315 | — |
  | mf_overclock | Overclocked | rifle | restricted | circuit | #100818 #3a1260 #8a2be2 #e0b0ff | 6 | 321 | — |
  | mf_hexcore | Hex Core | heavyPistol | restricted | hex | #03141a #06404f #0aa3c2 #a8f4ff | 5 | 322 | — |
  | mf_blackcarbon | Black Carbon | sniper | restricted | carbon | #050505 #141414 #2b2b2b #c9a227 | 7 | 323 | — |
  | mf_panic | Kernel Panic | smg | classified | circuit | #1a0000 #4d0000 #d40000 #ff9090 | 6 | 331 | `{ pattern: "pulse" }` |
  | mf_lattice | Quantum Lattice | shotgun | classified | hex | #05001a #1a0a5c #5b3cff #d6ccff | 6 | 332 | `{ pattern: "pulse" }` |
  | mf_root | Root Access | rifle | covert | circuit | #000a02 #003d10 #00ff41 #d0ffd8 | 7 | 341 | `{ pattern: "pulse" }` |
  | mf_zeroday | Zero Day | sniper | covert | hex | #0d0010 #3d0047 #ff00c8 #ffe0fa | 6 | 342 | `{ pattern: "pulse" }` |
  | mf_knife | Blue Screen | knife | gold | circuit | #000a2e #0033a0 #3d7bff #ffffff | 8 | 351 | `{ pattern: "pulse", weapon: "flip", fps: 5 }` |

  **Neon Nights** — `{ id: "neon", name: "Neon Nights Case", theme: "neon", tier: 5, color: "#2a0a3a" }`
  | id | name | weapon | rarity | kind | palette | scale | seed | motion |
  |---|---|---|---|---|---|---|---|---|
  | nn_drive | Night Drive | pistol | milspec | synthgrid | #0a0014 #2b0a4a #ff2bd6 #ffd36b | 4 | 411 | — |
  | nn_glow | Afterglow | rifle | milspec | neonline | #05000a #1a0630 #ff4fd8 #7ff7ff | 5 | 412 | — |
  | nn_arcade | Arcade | smg | milspec | hueflow | #140028 #ff2b8a #ffcc00 #2bd9ff | 4 | 413 | — |
  | nn_strip | Strip Light | shotgun | milspec | neonline | #020208 #101030 #2b6bff #c8f0ff | 6 | 414 | — |
  | nn_retro | Retrowave | mg | milspec | synthgrid | #05001a #3a0a5c #00e5ff #ff6ad5 | 5 | 415 | — |
  | nn_sunset | Sunset Grid | rifle | restricted | synthgrid | #12001f #5c0a6b #ff5e3a #ffe66b | 5 | 421 | `{ pattern: "flow" }` |
  | nn_lasertag | Laser Tag | heavyPistol | restricted | neonline | #000000 #0a1a0a #39ff14 #e8ffe0 | 6 | 422 | `{ pattern: "flow" }` |
  | nn_vapor | Vaporhaze | sniper | restricted | hueflow | #ff71ce #01cdfe #05ffa1 #b967ff #fffb96 | 3 | 423 | `{ pattern: "flow" }` |
  | nn_hotpink | Hot Pink | smg | classified | neonline | #0a0008 #3d0030 #ff1493 #ffd1ec | 7 | 431 | `{ pattern: "flow" }` |
  | nn_outrun | Outrun | shotgun | classified | synthgrid | #000010 #24004a #ff0080 #00f0ff #fff2a8 | 6 | 432 | `{ pattern: "flow" }` |
  | nn_demon | Neon Demon | rifle | covert | hueflow | #2b0010 #ff003c #ff9e00 #ff00e6 | 5 | 441 | `{ pattern: "flow" }` |
  | nn_racer | Midnight Racer | sniper | covert | synthgrid | #00000a #0a0a3a #7a00ff #00ffd5 #ffffff | 6 | 442 | `{ pattern: "flow" }` |
  | nn_knife | Prism | knife | gold | hueflow | #ff0040 #ffb300 #40ff00 #00c8ff #b000ff | 4 | 451 | `{ pattern: "flow", weapon: "flip", fps: 6 }` |

  **Deep Space** — `{ id: "deepspace", name: "Deep Space Case", theme: "space", tier: 6, color: "#0a0f2a" }`
  | id | name | weapon | rarity | kind | palette | scale | seed | motion |
  |---|---|---|---|---|---|---|---|---|
  | ds_stardust | Stardust | rifle | milspec | starfield | #02030a #0b1030 #8090c0 #ffffff | 6 | 511 | `{ pattern: "sparkle" }` |
  | ds_darkmatter | Dark Matter | pistol | milspec | nebula | #000000 #0d0221 #2a0a4a #7a5cff | 4 | 512 | `{ pattern: "sparkle" }` |
  | ds_orbit | Orbit | smg | milspec | starfield | #05040f #1a1440 #5e60ce #e0e7ff | 7 | 513 | `{ pattern: "sparkle" }` |
  | ds_moonrock | Moonrock | shotgun | milspec | nebula | #111114 #2e2e36 #6e6e80 #d0d0dc | 5 | 514 | `{ pattern: "sparkle" }` |
  | ds_comet | Comet Tail | mg | milspec | aurora | #020414 #06204a #1e90ff #e0f7ff | 5 | 515 | `{ pattern: "sparkle" }` |
  | ds_aurora | Aurora | rifle | restricted | aurora | #00050f #003d3d #00ffa3 #c48dff | 5 | 521 | `{ pattern: "flow" }` |
  | ds_pulsar | Pulsar | heavyPistol | restricted | iridescent | #0a0a1a #3d5afe #00e5ff #ff4081 | 6 | 522 | `{ pattern: "shimmer" }` |
  | ds_redgiant | Red Giant | sniper | restricted | nebula | #0a0000 #4a0a00 #ff4500 #ffd27f | 4 | 523 | `{ pattern: "flow" }` |
  | ds_nebula | Nebula | smg | classified | nebula | #05000f #3a0060 #ff2e97 #40e0ff #fff0ff | 4 | 531 | `{ pattern: "flow" }` |
  | ds_oilslick | Oil Slick | shotgun | classified | iridescent | #0b0b12 #2a1b5c #00b3a4 #e6ff4d #ff5ec4 | 5 | 532 | `{ pattern: "shimmer" }` |
  | ds_cosmicray | Cosmic Ray | rifle | covert | aurora | #000000 #14005c #7a00ff #00ffd0 #ffffff | 6 | 541 | `{ pattern: "flow" }` |
  | ds_blackhole | Black Hole Sun | sniper | covert | nebula | #000000 #1a0a00 #ff7a00 #ffe08a #ffffff | 5 | 542 | `{ pattern: "flow" }` |
  | ds_knife | Starforged | knife | gold | iridescent | #1a0f3d #5b3cff #00e5ff #ffd700 #ffffff | 6 | 551 | `{ pattern: "shimmer", weapon: "flip", fps: 6 }` |

  **Inferno** — `{ id: "inferno", name: "Inferno Case", theme: "fire", tier: 7, color: "#3a0a00" }`
  | id | name | weapon | rarity | kind | palette | scale | seed | motion |
  |---|---|---|---|---|---|---|---|---|
  | in_kindling | Kindling | rifle | milspec | flame | #1a0500 #5c1400 #d94a00 #ffb000 | 5 | 611 | `{ pattern: "rise" }` |
  | in_cinder | Cinder | pistol | milspec | ember | #0a0605 #2a1a14 #ff5a1f #ffd08a | 6 | 612 | `{ pattern: "rise" }` |
  | in_coals | Hot Coals | smg | milspec | ember | #100404 #3a0d0d #c2290a #ff8c42 | 7 | 613 | `{ pattern: "rise" }` |
  | in_firebrand | Firebrand | shotgun | milspec | flame | #140000 #6b0000 #ff3d00 #ffd600 | 4 | 614 | `{ pattern: "rise" }` |
  | in_furnace | Furnace | mg | milspec | molten | #0d0a08 #2e241e #ff6a00 #ffe0a3 | 5 | 615 | `{ pattern: "flow" }` |
  | in_wildfire | Wildfire | rifle | restricted | flame | #0d0200 #7a1f00 #ff6f00 #fff176 | 5 | 621 | `{ pattern: "rise" }` |
  | in_slag | Slag | heavyPistol | restricted | molten | #080808 #262020 #e03c00 #ffd28a | 6 | 622 | `{ pattern: "flow" }` |
  | in_brimstone | Brimstone | sniper | restricted | ember | #0f0700 #3d1f00 #ffae00 #fff3b0 | 6 | 623 | `{ pattern: "rise" }` |
  | in_hellfire | Hellfire | smg | classified | flame | #0a0000 #5c0011 #ff0033 #ff9e80 #ffffff | 5 | 631 | `{ pattern: "rise" }` |
  | in_meltdown | Meltdown | shotgun | classified | molten | #020a02 #0f2e0f #39ff14 #e6ffcc | 5 | 632 | `{ pattern: "flow" }` |
  | in_phoenix | Phoenix | rifle | covert | flame | #1a0033 #ff0055 #ff8800 #ffee00 #ffffff | 5 | 641 | `{ pattern: "rise" }` |
  | in_dragon | Dragon's Breath | sniper | covert | molten | #050008 #2d004d #ff2bd6 #ffb000 #fff6d5 | 6 | 642 | `{ pattern: "flow" }` |
  | in_knife | Forgeheart | knife | gold | molten | #1a0a00 #7a3b00 #ffb000 #fff3b0 #ffffff | 6 | 651 | `{ pattern: "flow", weapon: "flip", fps: 6 }` |

  - `vaults.ts`: `vault1` = the existing `VAULT_LEGEND` "Event Horizon" moved here unchanged (keep
    `export const VAULT_LEGEND = VAULTS[0].legend` for existing importers); `vault2` legend
    `skin("vault2_legend", "Overdrive", "knife", "gold", p("hueflow", ["#ff006e", "#fb5607", "#ffbe0b", "#3a86ff", "#8338ec"], 5, 402), { pattern: "flow", weapon: "flip", frames: 16, fps: 8 })`,
    sourceCase `neon`, trophy `vault2`; `vault3` legend
    `skin("vault3_legend", "Supernova", "knife", "gold", p("nebula", ["#000000", "#3a0060", "#ff4500", "#ffd700", "#ffffff"], 5, 403), { pattern: "flow", weapon: "flip", frames: 16, fps: 8 })`,
    sourceCase `inferno`, trophy `vault3`. Remove `VAULT_TROPHY` from tuning.
  - `vault.ts` `turnVaultKey`: `const def = vaultFor(ctx.setup.run); const top = caseById(def.sourceCase);` — the four
    ordinary drops as before from `top`, the fifth `{ ...d, skinId: def.legend.id, caseId: def.id, value }`;
    `tickVault` emits `trophy: def.trophy`. For Run 1 the RNG draws are unchanged.
  - `view.ts`: `vault.id = vaultFor(run.setup.run).id`. `ui/CaseShelf.tsx` / `ui/Hud.tsx`: `caseName(view.vault.id)`
    instead of `caseName("vault1")`.
  - `i18n/content.ts` CASES: `mainframe { en: "Mainframe", ru: "Мейнфрейм" }`, `neon { en: "Neon Nights", ru: "Ночной неон" }`,
    `deepspace { en: "Deep Space", ru: "Космос" }`, `inferno { en: "Inferno", ru: "Инферно" }`,
    `vault2 { en: "Vault Case II", ru: "Сейф-кейс II" }`, `vault3 { en: "Vault Case III", ru: "Сейф-кейс III" }`.
    `i18n/budgets.ts`: add `["case.vault", 14]` **before** `["case.", 12]` (the vault rows are wider; Plan M3-D checks
    the shelf and HUD fit). SKINS (Russian):
    mf: Шина данных, Радиатор, Карбоновое плетение, Материнская плата, Файрвол, Разгон, Гекс-ядро, Чёрный карбон,
    Паника ядра, Квантовая решётка, Root-доступ, Нулевой день, Синий экран;
    nn: Ночная трасса, Послесвечение, Аркада, Неоновая лента, Ретровейв, Закатная сетка, Лазертаг, Вейпор-дымка,
    Ярко-розовый, Аутран, Неоновый демон, Полуночный гонщик, Призма;
    ds: Звёздная пыль, Тёмная материя, Орбита, Лунный камень, Хвост кометы, Полярное сияние, Пульсар, Красный гигант,
    Туманность, Нефтяная плёнка, Космический луч, Солнце чёрной дыры, Звёздная ковка;
    in: Растопка, Пепел, Горячие угли, Головня, Горн, Лесной пожар, Шлак, Сера, Адское пламя, Расплав, Феникс,
    Дыхание дракона, Сердце горна; legends: `vault2_legend` Овердрайв, `vault3_legend` Сверхновая. (Same order as the
    tables; English = the table's name.)
- [ ] **Step 4:** `npm run typecheck && npx vitest run src/modules/casecremental` → PASS (Run 1 unchanged: the Run 1
  shelf is still three cases).
- [ ] **Step 5: Commit** `feat(sim): cases 4-7 (Mainframe, Neon Nights, Deep Space, Inferno) and Vaults II and III as data`.

### Task 4: The bot's second reel, and save version 4

**Files:**
- Modify: `sim/botOpener.ts`, `sim/botOpener.test.ts`, `sim/runTypes.ts`, `sim/run.ts` (`setHeld`), `sim/autoSeller.ts`,
  `sim/vault.ts`, `sim/tuning.ts`, `sim/bot.ts`, `game/controller.ts`, `game/view.ts`, `game/save.ts`, `game/save.test.ts`,
  `game/agent.ts`, `fx/World.ts`, `fx/labels.ts`, `fx/pixel/BotCard.ts` (compile fixes), `i18n/content.ts` (nothing
  unless a name is needed — the Bot tab string lives in Plan M3-D)

**Interfaces:**
- Produces:
```ts
// sim/botOpener.ts
export interface BotSpin { caseId: string; drops: Drop[]; elapsed: number; duration: number; }
export interface BotState {
  awake: boolean;
  speedLevel: number;
  /** Bot multi-open bought (0/1): one spin opens up to runContent.botMultiOpen cases. */
  multiLevel: number;
  caseChoice: string | null;
  spin: BotSpin | null;
  /** Its drops, side by side at its station; null once sold or taken. Empty when none wait. */
  cards: (Drop | null)[];
  cardAt: number;
  wakeLeft: number;
}
export function buyBotMulti(ctx: RunCtx): ActionResult;   // needs awake, runContent(run).botMultiOpen > 1, BOT_MULTI_COST
export function sellBotCard(ctx: RunCtx, slot?: number): ActionResult;
export const botWaiting = (bot: BotState): boolean => bot.cards.some((d) => d !== null);
// tuning: export const BOT_MULTI_COST = 4_000;
// SimEvents change shape:
//   { type: "botSpinStarted"; caseId: string; drops: Drop[]; duration: number }
//   { type: "botRevealed"; drops: Drop[] }
//   { type: "botMultiBought" }
//   "sold"/"stored" from "bot" carry the card's slot
// Run.setHeld("bot", slot) holds one bot card (heldSlot)
// controller Actions: { type: "buyBotMulti" }, { type: "sellBot"; slot?: number }
// view BotView: cards: (TrayItemView | null)[] (replaces card), multiAvailable, multiLevel, multiCost, canBuyMulti
// save: SAVE_VERSION = 4; migrateV3; decodeSave chains migrateV2 → migrateV3
```
- [ ] **Step 1: Failing tests** in `sim/botOpener.test.ts`:
```ts
const awakeRun = (run: number, cash = 1e6) => {
  const r = new Run(3, { ...DEFAULT_SETUP, run, startCash: cash, botAwake: true });
  return r;
};
const tickFor = (r: Run, s: number) => { for (let i = 0; i < Math.round(s * 30); i++) r.tick(1 / 30); };

it("bot multi-open is a Run 2 machine", () => {
  expect(awakeRun(1).buyBotMulti().ok).toBe(false);
  const r = awakeRun(2);
  expect(r.buyBotMulti().ok).toBe(true);
  expect(r.buyBotMulti().ok).toBe(false); // one level
});

it("opens two cases per spin, pays for both, and lands two cards", () => {
  const r = awakeRun(2);
  r.buyBotMulti();
  const cash = r.state.cash;
  tickFor(r, 1.2); // past the wake rest: the spin starts
  expect(r.state.bot.spin?.drops).toHaveLength(2);
  expect(cash - r.state.cash).toBeCloseTo(2 * r.casePrice(r.state.bot.spin!.caseId), 6);
  tickFor(r, 5);
  expect(r.state.bot.cards.filter(Boolean)).toHaveLength(2);
});

it("opens only what you can afford", () => {
  const r = awakeRun(2, 2 + BOT_MULTI_COST + 2); // one Boot Camp case after buying the upgrade
  r.buyBotMulti();
  tickFor(r, 1.2);
  expect(r.state.bot.spin?.drops).toHaveLength(1);
});

it("sells the cards one by one by hand and waits for both before the next spin", () => {
  const r = awakeRun(2);
  r.buyBotMulti();
  tickFor(r, 6);
  expect(r.sellBotCard(1).ok).toBe(true);
  expect(r.state.bot.cards[1]).toBeNull();
  tickFor(r, 6);
  expect(r.state.bot.spin).toBeNull(); // card 0 still waits
  expect(r.sellBotCard(0).ok).toBe(true);
  expect(r.state.bot.cards).toEqual([]);
});

it("the auto-seller leaves a held bot card and takes the other", () => {
  const r = awakeRun(2);
  r.buyBotMulti();
  r.buySeller();
  r.setSellerThreshold("gold");
  tickFor(r, 5.5);
  r.setHeld("bot", 0);
  tickFor(r, 3);
  expect(r.state.bot.cards[0]).not.toBeNull();
  expect(r.state.bot.cards[1] ?? null).toBeNull();
});

it("a snapshot mid double spin resumes the same", () => {
  const r = awakeRun(2);
  r.buyBotMulti();
  tickFor(r, 2);
  const back = Run.fromSnapshot(structuredClone(r.snapshot()));
  tickFor(r, 3);
  tickFor(back, 3);
  expect(back.state.bot).toEqual(r.state.bot);
});
```
  In `sim/vault.test.ts`: "buying the vault cashes in both bot cards and a double spin in flight, once each" (set up a
  Run 2 with the bot ×2 spinning, `buyVault`, count `sold` events from "bot" = 2 and cash rose by their payouts).
  In `game/save.test.ts`: a version-3 save (`{ v: 3, meta, run: { …, state: { …, bot: { …, card: drop, spin: null } } } }`)
  decodes to `v: 4` with `bot.cards = [drop]`, `bot.multiLevel = 0`, `setup.run = 1`; a v3 bot spin
  `{ caseId, drop, elapsed, duration }` becomes `{ caseId, drops: [drop], … }`; a v4 snapshot round-trips.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.**
  - `tickBot`: on spin end → `bot.cards = [...spin.drops]`, `cardAt = time`, `onReveal` each, `countReveals(n)`, emit
    `botRevealed { drops }`. Before starting a spin require `!botWaiting(bot)`; `count = Math.max(1, Math.min(1 +
    bot.multiLevel * (runContent(run).botMultiOpen - 1), Math.floor(cash / price)))`; pay `price × count`; roll
    `count` drops in order (for count 1 the RNG use is exactly as before); emit `botSpinStarted { caseId, drops, duration }`.
  - `sellBotCard(ctx, slot = 0)`: like `sell` for the bench — null the slot, release if held, and when every card is
    null set `cards = []`. `Run.setHeld("bot", slot)` sets `heldSlot` for the bot too (the waiting check uses
    `bot.cards[slot]`).
  - `tickSeller`: iterate `bot.cards` like bench cards (skip the held slot), each taken with `autoTake(ctx, d, "bot", slot)`
    then nulled; empty the array when all are null.
  - `buyVault`: cash in every non-null `bot.cards` entry and every `bot.spin.drops` entry as machine sales (slot = index).
  - `bot.ts` (greedy player): sells `bot.cards` by hand one at a time (`sellBotCard(firstIndex)`); buys the bot
    multi-open when available and cash ≥ 2 × cost.
  - `save.ts`: `SAVE_VERSION = 4`; `migrateV3(d)` (v3 → v4): `bot.card` → `cards: card ? [card] : []` (drop `card`),
    `bot.spin.drop` → `drops: [drop]`, `bot.multiLevel = 0`, `setup.run = 1`; `decodeSave` runs `migrateV3(migrateV2(raw))`;
    `isSave` additionally requires `Array.isArray(s.bot.cards)`; `normalize` fills the bot from `freshBot(false)`.
  - `view.ts`: `BotView.cards`, `multiAvailable = runContent(run).botMultiOpen > 1`, `multiLevel`, `multiCost: BOT_MULTI_COST`,
    `canBuyMulti`. `controller.ts`: the two actions. `agent.ts`: `bot.cards` (rarities), `sellBot { slot? }`, `buyBotMulti`,
    describe both.
  - Renderer compile fixes only (Plan M3-D draws the second reel and card): `fx/World.ts` reads
    `e.drops[0]` where it read `e.drop` for `botSpinStarted`/`botRevealed`, and `bot.cards[0] ?? null` where it read
    `bot.card`; `fx/labels.ts` uses `botWaiting(state.bot)`; `BotCard.ts` comment. A second card is invisible until
    M3-D but is sold by the auto-seller or by `sellBot { slot: 1 }`.
- [ ] **Step 4:** `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` → PASS.
- [ ] **Step 5: Commit** `feat(sim): the bot's second reel (Run 2 multi-open x2), save version 4`.

### Task 5: The locker and trade-up contracts

**Files:**
- Create: `sim/locker.ts`, `sim/locker.test.ts`
- Modify: `sim/runTypes.ts` (state, events, `RevealSpot`, `SaleSource`), `sim/botOpener.ts` (`CardSpot`), `sim/run.ts`,
  `sim/autoSeller.ts`, `sim/vault.ts`, `sim/tuning.ts`, `sim/snapshot.test.ts`, `game/controller.ts`, `game/view.ts`
  (or new `game/viewMachines.ts`), `game/save.ts`, `game/agent.ts`

**Interfaces:**
- Produces:
```ts
// sim/botOpener.ts
export type CardSpot = "bench" | "bot" | "locker";
// sim/runTypes.ts
export type RevealSpot = CardSpot;           // (Task 6 adds "grid")
export type SaleSource = "bench" | "bot" | "tray" | "seller" | "locker";
// RunState gains: locker: LockerState
// sim/locker.ts
export interface PressState { rarity: RarityId; inputs: Drop[]; results: Drop[]; elapsed: number; }
export interface LockerState {
  on: boolean;
  items: Drop[];            // oldest first
  sizeLevel: number;
  /** The rarity the auto-seller sends here instead of selling; null = off. */
  collect: RarityId | null;
  press: PressState | null;
  /** Contract results waiting on top of the locker (like the bot's cards). */
  cards: (Drop | null)[];
  cardAt: number;
  /** Run 3: presses on its own. */
  auto: boolean;
}
export const freshLocker = (): LockerState;
export const lockerCapacity = (sizeLevel: number): number;     // LOCKER_BASE_CAPACITY + LOCKER_SIZE_STEP × level
export const lockerCounts = (items: readonly Drop[]): Record<RarityId, number>;
/** The rarity a press would take now: the lowest (below ★) with TRADE_UP_COUNT in, or null. */
export const tradeUpRarity = (items: readonly Drop[]): RarityId | null;
/** CS rules: the case drawn from the inputs weighted by count, a skin of the next rarity from it, the mean float,
 *  StatTrak only if all ten were; value × TRADE_UP_BONUS[input rarity]. `two` = Contract Killer's double. */
export function contractResults(inputs: readonly Drop[], rng: Rng, nextId: () => number, two: boolean): Drop[];
export function buyLocker(ctx): ActionResult;          // runContent(run).locker, LOCKER_COST
export function buyLockerSize(ctx): ActionResult;      // LOCKER_SIZE_LEVELS levels
export function setCollect(ctx, r: RarityId | null): ActionResult;   // not "gold" (no contract goes past ★)
export function storeCard(ctx, from: CardSpot | "tray", slot: number): ActionResult;   // by hand: bumps the combo
export function tradeUp(ctx): ActionResult;           // needs a rarity ready, no press running, no cards waiting on the locker
export function sellLockerCard(ctx, slot?: number): ActionResult;   // by hand: combo
export function buyAutoContract(ctx): ActionResult;   // runContent(run).autoContract, AUTO_CONTRACT_COST
export function tickLocker(ctx, dt): void;            // the press; auto contract
/** Collect routing for the auto-seller: true when it stored the drop. */
export function collectInto(ctx, d: Drop, from: CardSpot | "grid", slot: number): boolean;
// tuning
export const LOCKER_COST = 6_000;
export const LOCKER_BASE_CAPACITY = 20;
export const LOCKER_SIZE_STEP = 10;
export const LOCKER_SIZE_LEVELS = 3;
export const LOCKER_SIZE_COSTS = { baseCost: 10_000, growth: 3 } as const;
export const TRADE_UP_COUNT = 10;
export const TRADE_UP_SECONDS = 2.5;
/** A contract pays its normal value × this (by its inputs' rarity), so it returns ~1.5× what its inputs would sell for. */
export const TRADE_UP_BONUS: Readonly<Record<Exclude<RarityId, "gold">, number>> = { milspec: 4.5, restricted: 5, classified: 3.6, covert: 3.6 };
export const AUTO_CONTRACT_COST = 250_000_000;
// SimEvents:
//   { type: "lockerBought" } | { type: "lockerUpgraded"; level: number }
//   { type: "lockerStored"; drop: Drop; from: CardSpot | "tray" | "grid"; slot: number; byHand: boolean }
//   { type: "pressStarted"; rarity: RarityId; inputs: Drop[]; results: Drop[] }
//   { type: "pressDone"; results: Drop[] }
//   { type: "autoContractBought" }
// Run wrappers with the same names; Actions:
//   buyLocker, buyLockerSize, setCollect { rarity: RarityId | null }, storeCard { from: CardSpot | "tray"; slot: number },
//   tradeUp, sellLocker { slot?: number }, buyAutoContract; holdCard accepts spot "locker" with a slot.
// view (GameView.locker):
export interface LockerView {
  available: boolean; on: boolean; cost: number; canBuy: boolean;
  count: number; capacity: number; counts: Record<RarityId, number>;
  sizeLevel: number; sizeCost: number | null; canBuySize: boolean;
  collect: RarityId | null;
  pressing: boolean; pressProgress: number;
  cards: (TrayItemView | null)[];
  tradeUp: RarityId | null; canTradeUp: boolean;
  autoAvailable: boolean; auto: boolean; autoCost: number; canBuyAuto: boolean;
}
```
- Rules (spec §5): a card stored by hand bumps the combo; stores refuse when full ("the locker is full"); the auto-seller
  checks Collect first (`collectInto`) — exactly the Collect rarity, locker on and room — else the threshold rule;
  results on the locker are waiting cards: sold by hand (`sellLockerCard`, combo), stored back (`storeCard("locker", slot)`),
  held (`setHeld("locker", slot)`), or taken by the auto-seller after `sellerHold` (they are machine-taken like bench
  cards; `autoTake(ctx, d, "locker", slot)`); `onReveal(result, "locker")` runs when the press finishes (charms see it;
  Chain Reaction will skip "locker" — Task 7); the press takes the **oldest** ten of `tradeUpRarity(items)`; results are
  rolled when the press starts (deterministic; the renderer may show them at the end); a press in flight or results
  waiting block the next press; auto contract presses the **Collect** rarity only (if none, the lowest ready).
  `buyVault` cashes in the locker's waiting cards and a running press's results as machine sales ("locker" source);
  `tickVault`'s end sells the locker's items with the tray (`payout(d, false)` each, counted toward lifetime earnings).
- [ ] **Step 1: Failing tests** — `sim/locker.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import { caseById, priceOf } from "./content/cases";
import { contractResults, lockerCapacity, tradeUpRarity } from "./locker";
import { rollDrop } from "./roll";
import { DEFAULT_SETUP, Run } from "./run";
import { LOCKER_COST, TRADE_UP_COUNT, TRADE_UP_SECONDS } from "./tuning";
import type { Drop, RarityId } from "./types";

const drop = (id: number, caseId: string, rarity: RarityId, float = 0.2, statTrak = false): Drop => ({
  id, caseId, skinId: caseById(caseId).skins.find((s) => s.rarity === rarity)!.id, rarity, float, wear: "FT", statTrak, value: 1,
});
const ten = (caseId: string, r: RarityId, float = 0.2, st = false) => Array.from({ length: 10 }, (_, i) => drop(i + 1, caseId, r, float, st));
const run2 = (cash = 1e9) => new Run(5, { ...DEFAULT_SETUP, run: 2, startCash: cash });
const tickFor = (r: Run, s: number) => { for (let i = 0; i < Math.round(s * 30); i++) r.tick(1 / 30); };

describe("trade-up contracts", () => {
  it("gives one skin of the next rarity from the inputs' cases, the mean float, StatTrak only if all were", () => {
    let id = 100;
    const [out] = contractResults(ten("wildwood", "restricted", 0.05, true), createRng(1), () => id++, false);
    expect(out!.rarity).toBe("classified");
    expect(out!.caseId).toBe("wildwood");
    expect(out!.float).toBeCloseTo(0.05, 9);
    expect(out!.wear).toBe("FN");
    expect(out!.statTrak).toBe(true);
    const mixed = [...ten("wildwood", "restricted").slice(0, 9), drop(9, "bedrock", "restricted", 0.2, false)];
    expect(contractResults(mixed, createRng(1), () => id++, false)[0]!.statTrak).toBe(false);
  });

  it("weights the result's case by the inputs' count", () => {
    const inputs = [...ten("bootcamp", "milspec").slice(0, 9), drop(10, "neon", "milspec")];
    let neon = 0;
    let id = 1;
    const rng = createRng(42);
    for (let i = 0; i < 4000; i++) if (contractResults(inputs, rng, () => id++, false)[0]!.caseId === "neon") neon++;
    expect(neon / 4000).toBeGreaterThan(0.08);
    expect(neon / 4000).toBeLessThan(0.12);
  });

  it("returns about 1.5x what its inputs would sell for, at every step", () => {
    const rng = createRng(9);
    let id = 1;
    for (const r of ["milspec", "restricted", "classified", "covert"] as const) {
      let paid = 0;
      let got = 0;
      for (let k = 0; k < 400; k++) {
        const inputs: Drop[] = [];
        while (inputs.length < 10) {
          const d = rollDrop(caseById("wildwood"), priceOf("wildwood"), 0, rng, id++, r);
          inputs.push(d);
        }
        paid += inputs.reduce((a, d) => a + d.value, 0);
        got += contractResults(inputs, rng, () => id++, false)[0]!.value;
      }
      expect(got / paid, r).toBeGreaterThan(1.3);
      expect(got / paid, r).toBeLessThan(1.8);
    }
  });

  it("Contract Killer's double gives two results", () => {
    let id = 1;
    expect(contractResults(ten("wildwood", "milspec"), createRng(3), () => id++, true)).toHaveLength(2);
  });

  it("knows which rarity is ready, never ★", () => {
    expect(tradeUpRarity(ten("wildwood", "covert").slice(0, 9))).toBeNull();
    expect(tradeUpRarity([...ten("wildwood", "restricted"), ...ten("wildwood", "milspec")])).toBe("milspec");
  });
});

describe("the locker", () => {
  it("is a Run 2 machine", () => {
    expect(new Run(1, { ...DEFAULT_SETUP, startCash: 1e9 }).buyLocker().ok).toBe(false);
    const r = run2();
    expect(r.buyLocker().ok).toBe(true);
    expect(r.state.cash).toBe(1e9 - LOCKER_COST);
  });

  it("keeps a card dragged in by hand, feeding the combo, until it is full", () => {
    const r = run2();
    r.buyLocker();
    r.state.tray.push(...ten("bootcamp", "milspec"), ...ten("bootcamp", "milspec"), drop(99, "bootcamp", "milspec"));
    for (let i = 0; i < lockerCapacity(0); i++) expect(r.storeCard("tray", 0).ok).toBe(true);
    expect(r.state.combo).toBeGreaterThan(1);
    expect(r.storeCard("tray", 0)).toEqual({ ok: false, reason: "the locker is full" });
  });

  it("collects the chosen rarity from the auto-seller, and sells it again once full", () => {
    const r = run2();
    r.buyLocker();
    r.buySeller();
    r.setCollect("milspec");
    r.state.locker.items.push(...Array.from({ length: lockerCapacity(0) - 1 }, (_, i) => drop(500 + i, "bootcamp", "restricted")));
    r.state.bench = { phase: "revealed", caseId: "bootcamp", cards: [drop(1, "bootcamp", "milspec"), drop(2, "bootcamp", "milspec")] };
    r.state.revealedAt = r.state.time;
    tickFor(r, 3);
    expect(r.state.locker.items).toHaveLength(lockerCapacity(0));
    const events = r.drainEvents();
    expect(events.filter((e) => e.type === "lockerStored")).toHaveLength(1);
    expect(events.filter((e) => e.type === "sold" && e.source === "seller")).toHaveLength(1);
  });

  it("presses the oldest ten, and the result waits on the locker", () => {
    const r = run2();
    r.buyLocker();
    r.state.locker.items.push(...ten("wildwood", "milspec"), drop(77, "wildwood", "milspec"));
    expect(r.tradeUp().ok).toBe(true);
    expect(r.state.locker.items.map((d) => d.id)).toEqual([77]);
    expect(r.tradeUp().ok).toBe(false); // the press is busy
    tickFor(r, TRADE_UP_SECONDS + 0.1);
    expect(r.state.locker.cards.filter(Boolean)).toHaveLength(1);
    expect(r.state.locker.cards[0]!.rarity).toBe("restricted");
    expect(r.sellLockerCard(0).ok).toBe(true);
    expect(r.state.locker.cards).toEqual([]);
  });

  it("auto contract (Run 3) presses the Collect rarity on its own", () => {
    const r = new Run(5, { ...DEFAULT_SETUP, run: 3, startCash: 1e12 });
    r.buyLocker();
    r.buyAutoContract();
    r.setCollect("restricted");
    r.state.locker.items.push(...ten("wildwood", "restricted"));
    tickFor(r, 0.1);
    expect(r.state.locker.press?.rarity).toBe("restricted");
  });

  it("the vault cashes in a running press and waiting results, and sells the locker at the end", () => {
    const r = run2(1e12);
    for (const id of ["wildwood", "bedrock", "mainframe", "neon"]) r.unlockCase(id);
    r.buyLocker();
    r.state.locker.items.push(...ten("wildwood", "milspec"), drop(50, "wildwood", "covert"));
    r.tradeUp();
    r.drainEvents();
    const before = r.state.lifetimeEarnings;
    expect(r.buyVault().ok).toBe(true);
    expect(r.state.locker.press).toBeNull();
    expect(r.drainEvents().filter((e) => e.type === "sold" && e.source === "locker")).toHaveLength(1);
    r.turnVaultKey();
    tickFor(r, 18);
    expect(r.state.locker.items).toEqual([]);
    expect(r.state.lifetimeEarnings).toBeGreaterThan(before);
  });
});
```
  `sim/snapshot.test.ts`: a run with a press half done round-trips through `Run.fromSnapshot` and ends identically.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `sim/locker.ts` and wire it: `RunState.locker = freshLocker()`; `Run.tick` calls
  `tickLocker(ctx, dt)` after `tickSeller`; `tickSeller` also walks `locker.cards` (hold measured from
  `locker.cardAt`); `autoTake` calls `collectInto` first; `setHeld` handles "locker"; `contractResults` picks the case
  with `rng.next()` over the cumulative counts, the skin with `rng.pick` among the case's next-rarity skins, the
  StatTrak as all-inputs, and `value = priceOf(case) × valueMultOf(case, rarity) × wearOf(mean).mult × (ST ? STATTRAK_MULT : 1) × TRADE_UP_BONUS[input]`;
  `two` repeats the draw for a second result. Contract Killer (Task 7) decides `two`; until then pass `false`.
  View, controller, agent and `save.ts` (`normalize` fills `locker` from `freshLocker()`; `isSave` unchanged) as listed.
  If `game/view.ts` passes ~400 lines, move the bot / seller / locker / grid view builders to `game/viewMachines.ts`.
  If the bonus test fails, tune `TRADE_UP_BONUS` (numbers only).
- [ ] **Step 4:** `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` → PASS.
- [ ] **Step 5: Commit** `feat(sim): the locker and trade-up contracts (Run 2), auto contract (Run 3)`.

### Task 6: The auto-buyer grid

**Files:**
- Create: `sim/grid.ts`, `sim/grid.test.ts`
- Modify: `sim/runTypes.ts` (`RevealSpot` adds "grid", `SaleSource` adds "grid", state, events), `sim/run.ts`,
  `sim/autoSeller.ts` (`autoTake` accepts from "grid"), `sim/vault.ts`, `sim/tuning.ts`, `game/controller.ts`,
  `game/view*.ts`, `game/save.ts`, `game/agent.ts`

**Interfaces:**
- Produces:
```ts
// sim/grid.ts
export interface GridCell {
  caseId: string;
  /** Seconds since it was filled. */
  t: number;
  /** Rolled when it opens; kept here while the tray is full (a stalled cell). */
  drop: Drop | null;
}
export interface GridState {
  on: boolean;
  rateLevel: number;
  sizeLevel: number;
  /** The share of your cash it never spends: 0.25 | 0.5 | 0.75. */
  reserve: number;
  /** Case ids ticked on the shelf; empty = the dearest it may buy. */
  ticks: string[];
  cells: (GridCell | null)[];   // length = gridSize(sizeLevel)
  buyClock: number;
  /** Round-robin position in ticks. */
  next: number;
}
export const freshGrid = (): GridState;
export const gridSize = (sizeLevel: number): number;       // GRID_SIZES[sizeLevel]
export const gridStalled = (g: GridState): boolean;         // some cell holds an undelivered drop
export function buyGrid(ctx): ActionResult;                 // runContent(run).grid && seller on; GRID_COST
export function buyGridRate(ctx): ActionResult;
export function buyGridSize(ctx): ActionResult;             // grows cells (keeps the filled ones)
export function setGridReserve(ctx, reserve: number): ActionResult;   // one of GRID_RESERVES
export function toggleGridTick(ctx, caseId: string): ActionResult;    // an unlocked case of this run
export function tickGrid(ctx, dt): void;
// tuning
export const GRID_COST = 40_000_000;
export const GRID_SIZES = [10, 20, 30, 50] as const;
export const GRID_SIZE_COSTS = { baseCost: 100_000_000, growth: 4 } as const;
export const GRID_BUY_INTERVALS = [1, 0.6, 0.35, 0.2, 0.12] as const;
export const GRID_RATE_COSTS = { baseCost: 60_000_000, growth: 3 } as const;
export const GRID_OPEN_SECONDS = 1.5;
export const GRID_RESERVES = [0.25, 0.5, 0.75] as const;
// SimEvents:
//   { type: "gridBought" } | { type: "gridUpgraded"; what: "rate" | "size"; level: number }
//   { type: "gridFilled"; cell: number; caseId: string }
//   { type: "gridOpened"; cell: number; drop: Drop }       // fx: flash, or a breakout for Covert/★
//   "sold" with source "seller" and from "grid", "stored"/"lockerStored" with from "grid", slot = cell
// Actions: buyGrid, buyGridRate, buyGridSize, setGridReserve { reserve: number }, toggleGridTick { caseId }
// view (GameView.grid):
export interface GridView {
  available: boolean; on: boolean; cost: number; canBuy: boolean; needsSeller: boolean;
  size: number; rateLevel: number; rateCost: number | null; canBuyRate: boolean;
  sizeLevel: number; sizeCost: number | null; canBuySize: boolean;
  reserve: number; ticks: string[];
  cells: Array<{ caseId: string; open: boolean; rarity: RarityId | null } | null>;
  stalled: boolean;
}
// CaseView gains ticked: boolean
```
- Rules (spec §6): every `GRID_BUY_INTERVALS[rateLevel]` s, if a cell is empty and the grid is not stalled, it picks
  the next ticked case (round-robin over `ticks` filtered to this run's unlocked cases; none ticked → the dearest
  unlocked case) and buys it only if `casePrice ≤ (1 − reserve) × cash`; otherwise it waits (the clock does not
  bank more than one interval). A cell opens `GRID_OPEN_SECONDS` after filling: `rollFor(caseId)` (Luck, charms, no
  tease), `onReveal(drop, "grid")`, `countReveals(1)`, emit `gridOpened`, then delivers through
  `autoTake(ctx, drop, "grid", cell)`; if that returns false (tray full) the drop stays in the cell (stalled) and is
  retried every tick; a delivered cell empties. Grid drops never bump the combo. The grid and its upgrades refuse
  while the vault is out; `buyVault` refunds unopened cells (their case price, not counted as earnings) and cashes in
  stalled drops as machine sales; the grid then stops.
- [ ] **Step 1: Failing tests** — `sim/grid.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETUP, Run } from "./run";
import { gridSize } from "./grid";
import { GRID_BUY_INTERVALS, GRID_COST, GRID_OPEN_SECONDS } from "./tuning";

const run3 = (cash = 1e12) => {
  const r = new Run(11, { ...DEFAULT_SETUP, run: 3, startCash: cash });
  r.buySeller();
  r.setSellerThreshold("classified");
  return r;
};
const tickFor = (r: Run, s: number) => { for (let i = 0; i < Math.round(s * 30); i++) r.tick(1 / 30); };

describe("the auto-buyer grid", () => {
  it("is a Run 3 machine that needs the auto-seller", () => {
    expect(new Run(1, { ...DEFAULT_SETUP, run: 2, startCash: 1e12 }).buyGrid().ok).toBe(false);
    const r = new Run(1, { ...DEFAULT_SETUP, run: 3, startCash: 1e12 });
    expect(r.buyGrid()).toEqual({ ok: false, reason: "buy the auto-seller first" });
    r.buySeller();
    expect(r.buyGrid().ok).toBe(true);
  });

  it("buys ticked cases round-robin into its cells and opens each after a delay", () => {
    const r = run3();
    r.unlockCase("wildwood");
    r.buyGrid();
    r.toggleGridTick("bootcamp");
    r.toggleGridTick("wildwood");
    tickFor(r, GRID_BUY_INTERVALS[0] * 4 + 0.05);
    const filled = r.state.grid.cells.filter(Boolean).map((c) => c!.caseId);
    expect(filled.slice(0, 4)).toEqual(["bootcamp", "wildwood", "bootcamp", "wildwood"]);
    expect(r.drainEvents().some((e) => e.type === "gridOpened")).toBe(true);
  });

  it("never spends below its reserve", () => {
    const r = run3(GRID_COST + 100);
    r.buyGrid(); // 100 left
    r.setGridReserve(0.75);
    r.toggleGridTick("bootcamp");
    tickFor(r, 30);
    expect(r.state.cash).toBeGreaterThan(0);
    for (const e of r.drainEvents()) if (e.type === "gridFilled") expect(e.caseId).toBe("bootcamp");
  });

  it("stalls with a full tray, keeps its drops, and resumes when the tray has room", () => {
    const r = run3();
    r.setSellerThreshold("milspec");
    r.buyGrid();
    r.toggleGridTick("bootcamp");
    r.state.tray = Array.from({ length: r.setup.trayCapacity }, (_, i) => ({ ...r.state.tray[0]!, id: 9000 + i, caseId: "bootcamp", skinId: "bc_warlord", rarity: "covert", float: 0.2, wear: "FT", statTrak: false, value: 1 }));
    r.forceNextGridRarity?.("covert"); // optional dev hook; otherwise loop until a Restricted+ drop stalls
    tickFor(r, 60);
    if (r.state.grid.cells.some((c) => c?.drop)) {
      const stalled = r.state.grid.cells.filter(Boolean).length;
      tickFor(r, 5);
      expect(r.state.grid.cells.filter(Boolean).length).toBe(stalled); // no new buys while stalled
      r.claim(0);
      tickFor(r, 0.2);
      expect(r.state.grid.cells.some((c) => c?.drop)).toBe(false);
    }
  });

  it("grows its cells and keeps the filled ones", () => {
    const r = run3();
    r.buyGrid();
    r.toggleGridTick("bootcamp");
    tickFor(r, 2.1);
    const filled = r.state.grid.cells.filter(Boolean).length;
    expect(r.buyGridSize().ok).toBe(true);
    expect(r.state.grid.cells).toHaveLength(gridSize(1));
    expect(r.state.grid.cells.filter(Boolean).length).toBe(filled);
  });

  it("its reveals heat the run, and never feed the combo", () => {
    const r = run3();
    r.buyGrid();
    r.buyGridRate();
    r.buyGridRate();
    r.buyGridSize();
    r.toggleGridTick("bootcamp");
    tickFor(r, 40);
    expect(r.state.combo).toBe(0);
    expect(r.state.heat).toBeGreaterThan(1);
  });

  it("the vault refunds unopened cells and cashes in stalled drops", () => {
    const r = run3();
    for (const id of ["wildwood", "bedrock", "mainframe", "neon", "deepspace", "inferno"]) r.unlockCase(id);
    r.buyGrid();
    r.toggleGridTick("bootcamp");
    tickFor(r, GRID_BUY_INTERVALS[0] * 3 + 0.05);
    expect(r.state.grid.cells.some((c) => c && !c.drop && c.t < GRID_OPEN_SECONDS)).toBe(true);
    const cash = r.state.cash;
    expect(r.buyVault().ok).toBe(true);
    expect(r.state.grid.cells.every((c) => c === null)).toBe(true);
    expect(r.state.cash).toBeGreaterThan(cash - r.setup.vaultPrice);
  });

  it("a snapshot mid-run resumes the same", () => {
    const r = run3();
    r.buyGrid();
    r.toggleGridTick("bootcamp");
    tickFor(r, 3.3);
    const back = Run.fromSnapshot(structuredClone(r.snapshot()));
    tickFor(r, 4);
    tickFor(back, 4);
    expect(back.state.grid).toEqual(r.state.grid);
    expect(back.state.cash).toBe(r.state.cash);
  });
});
```
  (Replace the stall test's optional dev hook with a deterministic setup if simpler: fill the tray, set the threshold
  to Mil-Spec and the Collect off, and give the grid a ticked case; tick until a `gridOpened` with a non-Mil-Spec drop
  is seen, then assert the stall as written. The test must assert, not silently skip — if no non-Mil-Spec drop came in
  60 s with that seed, raise the time or change the seed.)
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `sim/grid.ts`; `RunState.grid = freshGrid()`; `Run.tick` calls `tickGrid` after `tickLocker`
  (keep it after the seller so a delivered card is counted the same tick); wire view (`GridView`, `CaseView.ticked`),
  controller actions, agent (state `grid: { on, size, filled, stalled, ticks, reserve }` and the actions), save
  (`normalize` fills `grid` from `freshGrid()`).
- [ ] **Step 4:** `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` → PASS.
- [ ] **Step 5: Commit** `feat(sim): the auto-buyer grid (Run 3) - ticks, reserve, rate, size, stall on a full tray`.

### Task 7: Five more charms and the per-run pools

**Files:**
- Modify: `sim/charms.ts`, `sim/charms.test.ts`, `sim/run.ts` (`onReveal`, `payout`, stage), `sim/locker.ts`
  (Contract Killer), `sim/runTypes.ts` (`RunState.seen`, event `setCompleted`), `sim/tuning.ts`, `sim/meta.test.ts`,
  `i18n/content.ts`, `game/save.ts` (`normalize`: `seen ?? {}`)

**Interfaces:**
- Produces:
```ts
export type CharmId = "luckySeven" | "rustBucket" | "pityJar" | "doubleTap" | "ricochet" | "goldRush" | "insider"
  | "milSpecManiac" | "chainReaction" | "contractKiller" | "hoarder" | "fever" | "collectorsEye";
export const RUN2_CHARMS = [...RUN1_CHARMS, "chainReaction", "contractKiller", "hoarder"];
export const RUN3_CHARMS = [...RUN2_CHARMS, "fever", "collectorsEye"];
// CHARM_POOLS = { 1: RUN1_CHARMS, 2: RUN2_CHARMS, 3: RUN3_CHARMS }
/** Everything that multiplies a drop's value; ctx-dependent charms read the run. */
export function charmValueMult(charms, d: Drop, run?: { lockerCount: number; collected: (caseId: string) => boolean }): number;
// RunState.seen: Record<string, string[]>   — skin ids revealed this run, by case (Collector's Eye)
// SimEvent { type: "setCompleted"; caseId: string }
// tuning: CHAIN_REACTION_CHANCE = 0.25, FREE_CASE_QUEUE_MAX = 5, CONTRACT_KILLER_CHANCE = 0.2,
//         HOARDER_PER_SKIN = 0.01, FEVER_PAY_MULT = 1.5, FEVER_STAGE_BONUS = 1, COLLECTOR_MULT = 2
```
- Rules: **Chain Reaction** — on a Classified, Covert or ★ revealed at the bench, the bot or the grid (not a contract
  result), `rng.next() < 0.25` pushes a free case of its case onto `freeCases` (queue capped at 5; Ricochet shares the
  cap). **Contract Killer** — `two = rng.next() < 0.2` when the press starts (draw only when the charm is equipped).
  **Hoarder** — × (1 + 0.01 × locker items). **Fever** — every payout × 1.5, and the shown stage is the computed stage
  + 1 (max 5): keep hysteresis on the underlying stage (`base = nextStage(s.stage - bonus, intensity)`; `s.stage =
  min(5, base + bonus)` while not locked). **Collector's Eye** — `seen[caseId]` gains each newly revealed skin id (any
  source except vault drops); when it holds every non-★ skin of that case, emit `setCompleted` once and that case's
  drops pay × 2 for the rest of the run. Charms that need nothing new keep their RNG draws, so Run 1 numbers stay.
- [ ] **Step 1: Failing tests** in `sim/charms.test.ts` — one per charm:
```ts
it("Chain Reaction queues free cases from Classified+ reveals, capped", () => {
  const r = new Run(2, { ...DEFAULT_SETUP, run: 2, charms: ["chainReaction"], startCash: 1e9 });
  let queued = 0;
  for (let i = 0; i < 200; i++) {
    r.forceNextRarity("classified");
    r.state.bench = { phase: "empty" };
    r.buyCase("bootcamp"); r.insertKey();
    for (let k = 0; k < 120; k++) r.tick(1 / 30);
    queued = Math.max(queued, r.state.freeCases.length);
    r.state.freeCases = [];
  }
  // ~25 % of 200 reveals: at least one hit, and the queue never exceeds the cap
  expect(queued).toBeGreaterThan(0);
  expect(queued).toBeLessThanOrEqual(5);
});

it("Hoarder pays +1 % per skin in the locker", () => {
  const r = new Run(2, { ...DEFAULT_SETUP, run: 2, charms: ["hoarder"] });
  const d = { id: 1, caseId: "bootcamp", skinId: "bc_woodland", rarity: "milspec" as const, float: 0.2, wear: "FT" as const, statTrak: false, value: 10 };
  const base = r.payout(d, false);
  r.state.locker.items.push(...Array.from({ length: 20 }, (_, i) => ({ ...d, id: 10 + i })));
  expect(r.payout(d, false)).toBeCloseTo(base * 1.2, 9);
});

it("Fever pays x1.5 and shows one stage higher", () => {
  const plain = new Run(2, { ...DEFAULT_SETUP, run: 3 });
  const fever = new Run(2, { ...DEFAULT_SETUP, run: 3, charms: ["fever"] });
  const d = { id: 1, caseId: "bootcamp", skinId: "bc_woodland", rarity: "milspec" as const, float: 0.2, wear: "FT" as const, statTrak: false, value: 10 };
  expect(fever.payout(d, false)).toBeCloseTo(plain.payout(d, false) * 1.5, 9);
  fever.tick(1 / 30);
  expect(fever.state.stage).toBe(2);
});

it("Collector's Eye doubles a case once every non-★ skin of it has shown up", () => {
  const r = new Run(2, { ...DEFAULT_SETUP, charms: ["collectorsEye"] });
  const bc = caseById("bootcamp").skins.filter((s) => s.rarity !== "gold");
  r.state.seen.bootcamp = bc.slice(1).map((s) => s.id);
  const d = { id: 1, caseId: "bootcamp", skinId: bc[0]!.id, rarity: bc[0]!.rarity, float: 0.2, wear: "FT" as const, statTrak: false, value: 10 };
  const before = r.payout(d, false);
  (r as unknown as { onReveal: (d: unknown, s: string) => void }).onReveal(d, "bench");
  expect(r.drainEvents().some((e) => e.type === "setCompleted")).toBe(true);
  expect(r.payout(d, false)).toBeCloseTo(before * 2, 9);
});

it("Contract Killer sometimes gives two results", () => {
  const r = new Run(4, { ...DEFAULT_SETUP, run: 2, charms: ["contractKiller"], startCash: 1e9 });
  r.buyLocker();
  let doubles = 0;
  for (let i = 0; i < 100; i++) {
    r.state.locker.items = Array.from({ length: 10 }, (_, k) => ({ id: 1000 * i + k, caseId: "wildwood", skinId: "ww_fern", rarity: "milspec" as const, float: 0.2, wear: "FT" as const, statTrak: false, value: 1 }));
    r.state.locker.cards = [];
    r.tradeUp();
    if (r.state.locker.press!.results.length === 2) doubles++;
    r.state.locker.press = null;
  }
  expect(doubles).toBeGreaterThan(8);
  expect(doubles).toBeLessThan(35);
});

it("offers each run's pool", () => {
  expect(new Set(Array.from({ length: 60 }, (_, i) => offerCharms(i, 1, 2)).flat()).size).toBe(RUN2_CHARMS.length);
  expect(offerCharms(5, 2, 3).every((c) => RUN3_CHARMS.includes(c))).toBe(true);
});
```
  (Adjust the test helpers to the real API: use `Run` methods; where a test needs `onReveal`, it is public on `Run`
  after Task 1.) i18n: names and descriptions within budgets (`charm.name.` 18, `charm.desc.` 32):
  chainReaction "Chain Reaction" / «Цепная реакция», "Classified+: 25% a free case" / «Засекреч.+: 25% кейс даром»;
  contractKiller "Contract Killer" / «Киллер по контракту», "Trade-ups: 20% two results" / «Контракты: 20% два итога»;
  hoarder "Hoarder" / «Барахольщик», "+1% value per locker skin" / «+1% цены за скин в шкафу»;
  fever "Fever" / «Лихорадка», "Stage +1, all payouts x1.5" / «Стадия +1, выплаты x1,5»;
  collectorsEye "Collector's Eye" / «Глаз коллекционера», "Full set of a case: x2" / «Полный набор кейса: x2».
  (Check the Russian name of Classified used in `RARITIES` and abbreviate consistently; fix any string the budget
  test rejects by shortening it.)
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npm run typecheck && npx vitest run src/modules/casecremental` → PASS.
- [ ] **Step 5: Commit** `feat(sim): Chain Reaction, Contract Killer, Hoarder (Run 2) and Fever, Collector's Eye (Run 3)`.

### Task 8: Dev shortcuts — START RUN 2 / 3 and +CASH

**Files:**
- Modify: `game/controller.ts`, `game/controller.test.ts`, `ui/Settings.tsx`, `i18n/en.ts`, `i18n/ru.ts`, `game/agent.ts`

**Interfaces:**
- Produces: `GameController.devStartRun(run: number): void` — sets `meta.loops = run - 1` (keeps CLOUT, perks, trophies;
  clears offer/picked), starts a fresh run from `setupFor(meta)`, emits `runStarted`, saves; `GameController.devAddCash(amount: number): void`
  adds cash (not lifetime earnings), refreshes the view, saves. Both exist in dev builds' UI only
  (`import.meta.env.DEV`, as the sound board / Reset progress do); the agent gets `devStartRun { run }` and
  `devAddCash { amount }` in dev builds only.
- [ ] **Step 1: Failing test** (`game/controller.test.ts`): `devStartRun(3)` → `c.run.setup.run === 3`, seven-case
  shelf in the view, `meta.loops === 2`, CLOUT unchanged; `devAddCash(1000)` → cash +1000, lifetime unchanged.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; Settings gets, under the existing dev section, three buttons
  `settings.devRun2` "RUN 2" / «ЗАБЕГ 2», `settings.devRun3` "RUN 3" / «ЗАБЕГ 3», `settings.devCash` "+$1M" / «+$1М»
  (`devAddCash(1_000_000)`; the button adds ×10 the current cash when that is more than $1M, so later runs are
  reachable: label stays "+CASH"/"+ДЕНЬГИ" if simpler — pick one and keep the budget, `settings.` ≤ 12).
- [ ] **Step 4:** `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` → PASS.
- [ ] **Step 5: Commit** `feat(dev): start Run 2 or 3 and add cash from Settings (dev builds)`.

### Task 9: The greedy player learns Runs 2 and 3; pacing and tuning

**Files:**
- Modify: `sim/bot.ts`, `sim/pacing.test.ts`, `sim/tuning.ts`

**Interfaces:**
- Consumes: everything above. `PacingReport` gains `lockerAt?`, `gridAt?`, `runCasesAt?: Record<number, number>`
  (when the last case of run N's shelf was unlocked: `runCasesAt[1]` = all of Bedrock's run unlocked), `topStage`,
  `contracts: number`.
- Greedy player additions (in this order inside `spend`, each "when cash ≥ 2 × its price" like the others): unlock the
  next case of the run's shelf; wake the bot; buy the auto-seller; **buy the locker** (Run 2+) and set Collect to
  Mil-Spec; **bot multi-open**; **buy the grid** (Run 3+, seller on) and tick every unlocked case of the run as it
  unlocks (re-tick on each `caseUnlocked`); the cheapest of all remaining upgrades (incl. bot Speed, seller Speed,
  locker size, grid rate/size, auto contract) when it costs ≤ 25 % of cash. Hand actions per idle moment (each costs
  `timings.sell`): claim a tray item → sell a bot card → sell a locker card → sell a bench card → **press a trade-up
  when one is ready** → key / buy as now. The vault as soon as it can.
- [ ] **Step 1: Pacing tests** (append to `sim/pacing.test.ts`):
```ts
describe("pacing — Runs 2 and 3 (spec §10)", () => {
  // chain: Run 1 → Vault I → Run 2 → Vault II → Run 3 → Vault III → Run 3 replay, cheapest perk each time
  const chain = SEEDS.map((s) => {
    const meta = freshMeta();
    const reports = [];
    let earnings = playGreedy(s, 900).lifetimeEarnings;
    for (const trophy of ["vault1", "vault2", "vault3"]) {
      completeVault(meta, earnings, trophy, s);
      const cheapest = [...PERK_IDS].sort((a, b) => (perkCost(a, meta.perks[a]) ?? Infinity) - (perkCost(b, meta.perks[b]) ?? Infinity))[0]!;
      buyPerk(meta, cheapest);
      const r = playGreedy(s + 100 * meta.loops, 900, HUMAN, setupFor(meta));
      reports.push(r);
      earnings = r.lifetimeEarnings;
    }
    return reports; // [run2, run3, run3 replay]
  });
  const med = (i: number, pick: (r: PacingReport) => number | undefined) => median(chain.map((c) => pick(c[i]!) ?? Infinity));

  it("Run 2 catches up to Run 1's shelf in 1–2 min", () => {
    const t = med(0, (r) => r.runCasesAt[1]);
    expect(t).toBeGreaterThan(60);
    expect(t).toBeLessThan(120);
  });
  it("Run 2 buys the locker by about 2–4 min and Vault II at 6–10 min, reaching High", () => {
    expect(med(0, (r) => r.lockerAt)).toBeLessThan(240);
    const v = med(0, (r) => r.vaultAt);
    expect(v).toBeGreaterThan(360);
    expect(v).toBeLessThan(600);
    expect(median(chain.map((c) => c[0]!.topStage))).toBeGreaterThanOrEqual(3);
  });
  it("Run 3 catches up to Run 2's shelf in 1–2 min, buys the grid by 2–4 min, Vault III at 6–10 min, reaching Tripping", () => {
    const t = med(1, (r) => r.runCasesAt[2]);
    expect(t).toBeGreaterThan(60);
    expect(t).toBeLessThan(120);
    expect(med(1, (r) => r.gridAt)).toBeLessThan(240);
    const v = med(1, (r) => r.vaultAt);
    expect(v).toBeGreaterThan(360);
    expect(v).toBeLessThan(600);
    expect(median(chain.map((c) => c[1]!.topStage))).toBeGreaterThanOrEqual(4);
  });
  it("a Run 3 replay catches up in 1–2 min and vaults again by 5–7 min", () => {
    const t = med(2, (r) => r.runCasesAt[3]);
    expect(t).toBeGreaterThan(60);
    expect(t).toBeLessThan(120);
    const v = med(2, (r) => r.vaultAt);
    expect(v).toBeGreaterThan(300);
    expect(v).toBeLessThan(420);
  });
  it("never leaves the tray stuck full for long", () => {
    for (const c of chain) for (const r of c) expect(r.longestTrayFull).toBeLessThan(10);
  });
  it("presses contracts in Run 2", () => {
    expect(median(chain.map((c) => c[0]!.contracts))).toBeGreaterThan(0);
  });
});
```
  (`runCasesAt[n]` for the run's own shelf in a replay means "Run 3's seven cases".)
- [ ] **Step 2:** Run `npx vitest run src/modules/casecremental/sim/pacing.test.ts` → expect failures.
- [ ] **Step 3: Tune** `sim/tuning.ts` only — case economy 4–7, `VAULT_PRICES`, `CATCH_UP_PER_VAULT` (careful: it also
  drives the Run 1 replay test), multi-open and bot costs, `BOT_MULTI_COST`, locker / grid / auto-contract costs,
  grid rate/size numbers — until every pacing test (Run 1's too) passes. Print each run's report while tuning
  (`console.table` in a scratch test, not committed). Never change the greedy player's timings or the assertions'
  targets; if a target looks unreachable without breaking another, stop and report the conflict with numbers.
- [ ] **Step 4:** `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` → PASS.
- [ ] **Step 5: Commit** `tune(sim): Runs 2 and 3 pacing - catch-up 1-2 min, Vaults II and III at 6-10 min`.
