# Casecremental F2 — Auto-spin Replaces the Auto-buyer Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the auto-buyer grid out of the game completely, and add **auto-spin**: a Run 1 machine with an ON/OFF switch that buys and opens your own cases while you watch and sell.

**Architecture:** Auto-spin is one more machine written as functions over `RunCtx`, in its own file (`sim/autoSpin.ts`, like `sim/autoSeller.ts`). It ticks after the locker. It buys through a new `Run.placeCase` and turns the key with the existing `Run.insertKey`. The save goes to version 5. The view, controller and agent get its state and four actions. On screen it gets Machines rows, a switch and a pick box on the case shelf, and a small motorised arm bolted to the mat. The arm is drawn in code and owned by `fx/stations/Stations.ts`; it reads the sim every frame and takes events only for its one-shot juice. The greedy pacing player buys auto-spin after the seller, keeps it on, and then leaves the bench to it.

**Tech Stack:** TypeScript (strict), React 19, PixiJS 8, Vitest, Vite 8.

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-finish-design.md` §3 (binding), with §1 (phases), §5 (F4 will retune) and §11 (testing). Read `docs/feature-history/casecremental-runs-2-3.md` and `casecremental-run1.md` before Task 1.

**Order and why.** The grid goes first (Task 1). Removing it frees the layout band, the shelf's tick-box slot, the Machines rows and four sim events. The save migration (Task 3) can then drop the grid and add auto-spin in one version bump. Auto-spin then never coexists with the grid's code paths, such as `autoTake(…, "grid")` or the seller's grid routing. The grid's sim and its screen side must leave in the same commit. GridStation reads `s.grid`, and World/Stations type against `"grid"` sources, so splitting them would leave a commit that does not typecheck.

**Phase F1 lands before this plan.** F1 covers the tray animations, multi-open reels, the drawer scrollbar and text selection. Before Task 1, re-read `fx/World.ts`, `fx/pixel/Tray.ts`, `fx/pixel/traySlots.ts`, `ui/styles.ts` and `fx/stations/Stations.ts` as F1 left them. If F1 added a tray slide-in that maps a `from: "grid"` source to a spot, remove that branch in Task 1 too. Do not touch F1's tray, reel or style work otherwise.

## Global Constraints

- Every player-facing string exists in EN (`i18n/en.ts`) and RU (`i18n/ru.ts`) and fits its `i18n/budgets.ts` budget. Russian has exactly the English keys (`i18n.test.ts`).
- Balance numbers live only in `sim/tuning.ts` (spec §5). Auto-spin's cost and Delay numbers below are F2's starting point; F4 tunes them.
- Stations draw from sim state every frame and take events only for one-shot juice (a pull, a key swing, a power-on). A reload or a lobby trip must show the same picture from the save alone, and a beat that already happened does not replay.
- File size: when a change adds a new responsibility to a file past ~400 lines, that part goes in its own file. `sim/run.ts` (~522 lines) and `fx/World.ts` (~538) must not grow net: auto-spin's logic lives in `sim/autoSpin.ts`, its fx in `fx/stations/AutoSpinStation.ts`.
- Match the module's code style: comment density (a header comment per file saying what it is and why, doc comments on exported names), `ActionResult` with `fail("reason")` messages in lowercase, `OK`, and 2-space Prettier formatting (`npm run format` is available).
- Photosensitivity: every full-screen flash goes through `hd.flash` (the flash gate). Light that pulses changes by less than 0.1 per beat.
- Every commit keeps these green: `npm run typecheck`, `npx vitest run src/modules/casecremental`, `npm run build`.
- Commit messages look like `feat(autospin): …` and end with these two lines (after a blank line):
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```
- Stay on branch `casecremental-finish`. Do not edit `src/modules.ts`, `src/config.ts`, `src/idos.title.ts` or `idos.modules.lock.json`.
- The SDK is npm packages: never invent an SDK API. This plan needs none.

## Review Focus

These are the five conditions most likely to bite a player that the spec does not spell out. Each one has its test in the owning task.

1. **The vault is affordable while auto-spin runs.** A player expects auto-spin not to spend the vault's cash and not to keep the bench busy, since BUY on the vault needs an empty bench. So auto-spin buys nothing while the vault is shown and affordable, and its status is `"vault"`. Test: Task 2, "buys nothing while the vault is shown and affordable".
2. **A reload mid-delay or mid key beat.** The run must resume on the same tick, and the power-on must not replay. The clock and the `powered` flag are saved. Tests: Task 2, "picks up mid-delay after a reload"; Task 3, the v5 round-trip and "keeps auto-spin's switch across a reload".
3. **Dragging a card (any held card) while auto-spin wants to act.** It waits and never buys or keys under your hand. Test: Task 2, "leaves the bench alone while you hold a card…".
4. **The picked case gets too dear, then affordable again.** Auto-spin falls back to the dearest affordable case without changing your pick, then returns to the pick. Test: Task 2, "falls back to the dearest case it can afford…".
5. **An old v4 save with a busy grid** (cells holding drops, ticks, levels). It must load into v5 with no grid, no crash and no refund, and with auto-spin fresh. Test: Task 3, "migrates a version-4 save".

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `sim/grid.ts`, `sim/grid.test.ts` | 1 (delete) | the grid's sim |
| `fx/stations/GridStation.ts`, `gridStation.test.ts`, `gridRules.ts`, `gridRules.test.ts`, `fx/pixel/GridBoard.ts`, `gridBoard.test.ts`, `fx/hd/breakout.ts`, `breakout.test.ts`, `ui/GridRows.tsx` | 1 (delete) | the grid's screen |
| `assets/sprites/auto-buyer.{png,json}`, `assets/audio/grid-*.mp3`, `art/preview/auto-buyer.png`, `art/source/auto-buyer-sheet-1x2.png`, `art/source/audio/grid-*-take-*.mp3` | 1 (delete) | the grid's art and sound |
| `sim/autoSpin.ts` (+ test) | 2 | the machine: state, actions, status, tick |
| `sim/run.ts`, `sim/runTypes.ts`, `sim/tuning.ts` | 1, 2, 4 | wiring, events, numbers |
| `game/save.ts` (+ test) | 1, 2, 3 | v5 migration |
| `game/view.ts`, `game/viewMachines.ts`, `game/controller.ts`, `game/agent.ts` (+ tests) | 1, 3 | the surface |
| `sim/bot.ts`, `sim/pacing.test.ts` | 1, 4 | the greedy player |
| `ui/AutoSpinRows.tsx`, `ui/autoSpinRules.ts` (+ test), `ui/MachinesPanel.tsx`, `ui/CaseShelf.tsx`, `ui/shelfFit.ts`, `i18n/*` | 1, 5 | rows, switch, pick |
| `fx/pixel/armArt.ts` (+ test), `fx/stations/autoSpinRules.ts` (+ test), `fx/stations/AutoSpinStation.ts`, `fx/stations/Stations.ts`, `fx/pixel/layout.ts` (+ test), `fx/labels.ts` (+ test), `fx/World.ts` | 1, 6 | the arm |
| `docs/feature-history/casecremental-finish.md`, `casecremental-runs-2-3.md`, `casecremental-run1.md`, `README.md` | 7 | notes |

All paths below are relative to `src/modules/casecremental/` unless they start with `docs/`, `art/` or `.superpowers/`.

---

### Task 1: Remove the auto-buyer grid

Remove all of it: sim, events, the `RUN_CONTENT` flag, tuning, view, controller, agent, save defaults, the greedy player, the station, the board, the breakouts, the layout band, the sounds, the sprite, the art entries, the i18n keys and the tests. Run 3 keeps multi-open ×5, bot speed to ×50 and the auto contract. Without the grid the greedy player reaches Vault III sooner, so `VAULT_PRICES[2]` goes 420B → 450B (measured below).

**Files:**
- Delete: `sim/grid.ts`, `sim/grid.test.ts`, `fx/stations/GridStation.ts`, `fx/stations/gridStation.test.ts`, `fx/stations/gridRules.ts`, `fx/stations/gridRules.test.ts`, `fx/pixel/GridBoard.ts`, `fx/pixel/gridBoard.test.ts`, `fx/hd/breakout.ts`, `fx/hd/breakout.test.ts` (only the grid uses breakouts), `ui/GridRows.tsx`, `assets/sprites/auto-buyer.png`, `assets/sprites/auto-buyer.json`, `assets/audio/grid-breakout-1.mp3`, `grid-breakout-2.mp3`, `grid-buy-1.mp3`, `grid-open-1.mp3`, `grid-power-on-1.mp3`, `grid-power-on-2.mp3`; repo root: `art/preview/auto-buyer.png`, `art/source/auto-buyer-sheet-1x2.png`, `art/source/audio/grid-{breakout,buy,open,power-on}-take-{1,2}.mp3`.
- Modify (sim): `sim/runTypes.ts`, `sim/run.ts`, `sim/tuning.ts`, `sim/vault.ts`, `sim/autoSeller.ts`, `sim/locker.ts`, `sim/bot.ts`, `sim/pacing.test.ts`, `sim/charms.test.ts`.
- Modify (game): `game/view.ts`, `game/viewMachines.ts`, `game/controller.ts`, `game/agent.ts`, `game/save.ts` and their tests `game/view.test.ts`, `game/controller.test.ts`, `game/agent.test.ts`, `game/save.test.ts`.
- Modify (fx): `fx/stations/Stations.ts`, `fx/stations/deps.ts`, `fx/World.ts`, `fx/pixel/layout.ts`, `fx/pixel/layout.test.ts`, `fx/audio/sounds.ts`, and the comments in `fx/hd/flashGate.ts`, `fx/juice/bigReveal.ts`, `fx/throttle.ts`.
- Modify (ui, i18n): `ui/MachinesPanel.tsx`, `ui/CaseShelf.tsx`, `ui/shelfFit.ts`, `ui/shelfFit.test.ts`, `ui/machineRules.ts`, `ui/machineRules.test.ts`, `ui/prestigeRules.ts`, `ui/prestigeRules.test.ts`, the comments in `ui/parts.tsx` and `ui/UpgradesBoard.tsx`, `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`, `i18n/i18n.test.ts`.
- Modify (art): `art/manifest.json` (remove the `auto-buyer` sheet entry and the four `grid-*` sfx entries; keep the JSON valid).

**Interfaces:**
- Produces:
  - `SaleSource = "bench" | "bot" | "tray" | "seller" | "locker"`.
  - `RevealSpot = CardSpot`.
  - `sold.from: CardSpot | null`, `stored.from: CardSpot`, `lockerStored.from: CardSpot | "tray"`.
  - `autoTake(ctx, d, from: CardSpot, slot?)`, `collectInto(ctx, d, from: CardSpot, slot)`.
  - `RunContent` without `grid`; `TableLayout` without `grid`; `StationDeps` without `knifeFlying`.
  - `PacingReport` without `gridAt`.
  - No `GridView`, `CaseView.ticked`, `GameView.grid` or `ticksShown`.
  - No grid actions on the controller or the agent.

- [ ] **Step 1: Rewrite the tests that pin the new shape (they fail first).**

  `ui/prestigeRules.test.ts`: Run 3 no longer brings the grid.
  ```ts
  it("Run 3: Deep Space and Inferno, the auto contract, multi-open to x5, bot speed to x50", () => {
    expect(runBrings(3)).toEqual([
      { kind: "case", caseId: "deepspace" },
      { kind: "case", caseId: "inferno" },
      { kind: "machine", id: "autoContract" },
      { kind: "cap", id: "multiOpen", value: 5 },
      { kind: "cap", id: "botSpeed", value: 50 },
    ]);
  });
  ```
  `sim/pacing.test.ts`: rename the Run 3 test to `"Run 3 catches up to Run 2's shelf in 1–2 min, Vault III at 6–10 min, reaching Tripping"` and delete its line `expect(med(1, (r) => r.gridAt)).toBeLessThan(240);`.

  `sim/charms.test.ts`: the reveal spots are only `"bench" | "bot" | "locker"`.
  - In "Chain Reaction fires…", rename the test to `"Chain Reaction fires on Classified, Covert and ★ at the bench and the bot, never on a contract result or a Restricted"`. Type `spot` as `"bench" | "bot" | "locker"` and loop `for (const spot of ["bench", "bot"] as const)`.
  - In "Ricochet shares the free-case queue cap", reveal at `"bot"` instead of `"grid"`.
  - In "Collector's Eye records skins from every reveal source…", replace the `"grid"` reveal with `"bench"`. The expectation `["a", "b"]` stays.

  Delete these tests:
  - `game/view.test.ts`: "shows the auto-buyer grid from Run 3…" (and drop `GRID_COST` from its imports).
  - `game/controller.test.ts`: "routes the auto-buyer grid's actions".
  - `game/agent.test.ts`: "reports the auto-buyer grid and checks its reserve".
  - `game/save.test.ts`: "gives a v4 save from before the auto-buyer grid a fresh one".
  - `ui/shelfFit.test.ts`: the `ticksShown` describe (and its import).
  - `ui/machineRules.test.ts`: "cycles the grid's reserve…" (and drop `GRID_RESERVES`, `nextReserve` and `percent` from its imports).
  - `fx/pixel/layout.test.ts`: the `grid: l.grid` entry of `items`, the test "puts the grid machine in the table's middle…", and `"grid"` from the name list in "sets the locker's results on the locker…".
  - `i18n/i18n.test.ts`: lines 61–63 become:
  ```ts
  for (const n of [9, 12]) expect(fits("locker.size", { n }), "locker.size").toBe(true);
  ```

- [ ] **Step 2: Run the tests to see them fail.**
  Run: `npx vitest run src/modules/casecremental/ui/prestigeRules.test.ts`
  Expected: FAIL. `runBrings(3)` still contains `{ kind: "machine", id: "grid" }`.

- [ ] **Step 3: Delete the files listed above** with `git rm` (assets and art included).

- [ ] **Step 4: Take the grid out of the sim.**
  - `sim/runTypes.ts`:
    - Drop the `GridState` import, `"grid"` from `SaleSource`, `| "grid"` from the `sold`, `stored` and `lockerStored` `from` types, and the four `grid*` events.
    - Drop `RunState.grid` and its doc comment.
    - Change `export type RevealSpot = CardSpot;` (keep the alias and its comment "Where a reveal happened; the charms that react to it care.").
    - Header comment: "(bot, auto-seller, locker, vault, day job)".
  - `sim/run.ts`:
    - Drop the two `grid` imports, `grid: freshGrid(),`, `grid.tickGrid(this, dt);` and the five grid methods (`buyGrid` … `toggleGridTick`, lines ~474–495).
    - The header comment lists "The bot, auto-seller, locker, vault and day job".
  - `sim/tuning.ts`:
    - Drop `grid: boolean;` from `RunContent` and `grid: …,` from each `RUN_CONTENT` row, and the whole `GRID_*` block (lines ~240–251).
    - Set `export const VAULT_PRICES = [1_200_000, 2_000_000_000, 450_000_000_000] as const;`.
  - `sim/vault.ts`: drop `import { cashInGrid } from "./grid";`, the call and its comment line.
  - `sim/autoSeller.ts`: `export function autoTake(ctx: RunCtx, d: Drop, from: CardSpot, slot = 0): boolean`.
  - `sim/locker.ts`: `export function collectInto(ctx: RunCtx, d: Drop, from: CardSpot, slot: number): boolean`.
  - `sim/bot.ts`:
    - Drop `gridRateCost, gridSizeCost`, `GRID_COST`, `gridAt` (and its doc line), the `toggleGridTick` line in the `caseUnlocked` handler, the `gridBought` line, the `content.grid` purchase block and the two grid `offer` lines.
    - Header comment: "…the locker (Run 2+, collecting Mil-Specs) and the bot's multi-open; it buys the cheapest remaining upgrade (bot and seller Speed, locker size, the auto contract included)…".

- [ ] **Step 5: Take the grid out of the game layer.**
  - `game/viewMachines.ts`: drop the `sim/grid` import, `GRID_COST`, `GridView`, `gridView`. The header comment lists "the bot, the auto-seller, the locker".
  - `game/view.ts`: drop `gridView`/`GridView` from the imports and the re-export, `CaseView.ticked` (and `ticked:` in `buildView`) and `GameView.grid` / `grid: gridView(run),`.
  - `game/controller.ts`: drop the five grid `Action` members and their `dispatch` cases.
  - `game/agent.ts`: drop the `sim/grid` and `GRID_RESERVES` imports, `state().grid`, the five grid actions and their `describeActions` lines.
  - `game/save.ts`: drop `import { freshGrid } …` and `grid: { ...freshGrid(), ...d.run.state.grid },`. A v4 save's leftover `grid` key rides along unread until Task 3's migration drops it.

- [ ] **Step 6: Take the grid off the screen.**
  - `fx/stations/Stations.ts`:
    - Drop the `GridStation` import and field, and its lines in the constructor, `layout`, `update`, `onEvent` and `destroy`.
    - Drop `knifeFlying()` and `machineSale()`; the grid was their only reason.
    - Header: "The stations beside your bench (M3: the bot's pair, the locker)". The `under` doc: "Pixel world, just over the table and under the tray: the locker's cabinet."
  - `fx/stations/deps.ts`: drop `knifeFlying` and its doc comment.
  - `fx/World.ts`:
    - Drop the `knifeFlying:` line from the `Stations` deps, `if (this.stations.machineSale(e)) break; …` in `"sold"`, and `if (e.from === "grid") break; …` in `"stored"`.
    - `spotOf` becomes:
    ```ts
    /** Where a card waiting at `from` sits (world px). */
    private spotOf(from: "bench" | "bot" | "locker" | "tray", slot: number): Pt {
      if (from === "bench") return this.bench.cardCentre(slot);
      if (from === "bot" || from === "locker") return this.stations.cardCentre(from, slot);
      const r = this.l.tray;
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    ```
  - `fx/pixel/layout.ts`:
    - Drop `grid: Rect` (and its doc), `ITEM_SIZE.grid`, `gridRect`, and the `"grid"` part of `type Base = Omit<TableLayout, "locker" | "grid">`. That becomes `Omit<TableLayout, "locker">`.
    - `tableLayout` returns `{ ...b, tray, locker }`.
  - `fx/audio/sounds.ts`: drop the four `grid-*` entries.
  - Comments: `fx/hd/flashGate.ts` line 3 says "…a station's power-on and the vault's flashes can never stack past the limit."; `fx/juice/bigReveal.ts` drops "a grid breakout" (twice); `fx/throttle.ts` says "(a stream of machine stores, a machine's sound)".

- [ ] **Step 7: Take the grid out of the panels and strings.**
  - `ui/MachinesPanel.tsx`: drop the `GridRows` import and element. Header: "The Machines tab: the auto-seller (Run 1), the locker (Run 2+)."
  - `ui/CaseShelf.tsx`: drop `TickBox`, the `grid`/`open` props of `CaseRow` (it takes `{ c, act }`), its gold-frame style, and the now unused `PixelTick`, `boardOpen` and `ticksShown` imports.
  - `ui/shelfFit.ts`: drop `ticksShown`.
  - `ui/machineRules.ts`: drop `nextReserve`, `percent` and the `GRID_RESERVES` import. The header comment says "…and how the Machines tab's settings cycle."
  - `ui/prestigeRules.ts`: `Bring`'s machine ids are `"botMulti" | "locker" | "autoContract"`, and the `now.grid` line goes.
  - `ui/parts.tsx`: the `PixelTick` doc becomes `/** A pixel tick box (a shelf pick box). */`; keep the component.
  - `ui/UpgradesBoard.tsx` header: "the Machines tab holds the auto-seller and the locker".
  - `i18n/en.ts` and `i18n/ru.ts`: delete `grid.name`, `grid.desc`, `grid.needs`, `grid.rate`, `grid.size`, `grid.reserve`, `shelf.tick` and `brings.grid`.
  - `i18n/budgets.ts`: delete the `["grid.", 20]` row (keep `["shelf.", 20]`; Task 5 uses it).
  - `art/manifest.json`: delete line 27 (`auto-buyer`) and lines 78–81 (`grid-*`), then check that the JSON still parses:
  ```bash
  node -e "JSON.parse(require('fs').readFileSync('art/manifest.json','utf8')); console.log('ok')"
  ```

- [ ] **Step 8: Check that nothing refers to the grid any more.**
  Run (or the same search with the Grep tool): `rg -n -i "grid|auto-buyer|autoBuyer" src/modules/casecremental --glob '!**/patterns*' --glob '!**/casesRun2.ts' --glob '!**/content.ts'`
  Expected: only CSS layout hits (`display: "grid"`, `gridTemplateColumns`, `.cc-row { display: grid`) and `gridFont` in `fx/vault/`.

- [ ] **Step 9: Run everything.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build`
  Expected: PASS. Measured with the grid gone and `VAULT_PRICES[2] = 450B` (5 seeds, medians):
  - Run 1 and its replay are unchanged.
  - Run 3: Vault III at ~380 s (360–600).
  - Run 3 replay: vault at ~409 s (300–420).

  If either Run 3 median falls outside its band, nudge only `VAULT_PRICES[2]`. At 420B the Run 3 vault came in at 360 s, a fail by a hair.

- [ ] **Step 10: Commit.**
  ```bash
  git add -A src/modules/casecremental art/manifest.json art/preview art/source
  git commit -m "feat(autospin): remove the auto-buyer grid - Run 3 keeps x5, bot x50 and the auto contract

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 2: The auto-spin machine in the sim

**Files:**
- Create: `sim/autoSpin.ts`, `sim/autoSpin.test.ts`
- Modify: `sim/runTypes.ts` (state, events, two `RunCtx` members), `sim/run.ts` (`placeCase`, the pick on a hand buy, tick, four delegating methods), `sim/tuning.ts` (constants), `game/save.ts` (a default for saves without auto-spin, so this commit is reload-safe before Task 3's version bump)

**Interfaces:**
- Produces (`sim/autoSpin.ts`):
  ```ts
  export interface AutoSpinState { owned: boolean; on: boolean; delayLevel: number; pick: string | null; clock: number; powered: boolean }
  export type AutoSpinStatus = "off" | "on" | "broke" | "vault";
  export const freshAutoSpin: () => AutoSpinState;
  export const AUTOSPIN_DELAY_LEVELS: number; // 5
  export const autoSpinDelay: (level: number) => number;
  export function autoSpinDelayCost(level: number): number | null;
  export function buyAutoSpin(ctx: RunCtx): ActionResult;
  export function buyAutoSpinDelay(ctx: RunCtx): ActionResult;
  export function setAutoSpin(ctx: RunCtx, on: boolean): ActionResult;
  export function setAutoSpinCase(ctx: RunCtx, caseId: string): ActionResult;
  export function autoSpinCase(ctx: RunCtx): string | null;
  export function autoSpinStatus(ctx: RunCtx): AutoSpinStatus;
  export function tickAutoSpin(ctx: RunCtx, dt: number): void;
  ```
- Produces (`Run`): `placeCase(caseId: string): number`, `buyAutoSpin()`, `buyAutoSpinDelay()`, `setAutoSpin(on: boolean)`, `setAutoSpinCase(caseId: string)`. `RunCtx` gains `placeCase(caseId: string): number` and `insertKey(): ActionResult`. `RunState.autoSpin: AutoSpinState`.
- Produces (`SimEvent`): `autoSpinBought`, `autoSpinUpgraded { level }`, `autoSpinToggled { on; first }`, `autoSpinPulled { caseId; count }`, `autoSpinKeyed`.
- Produces (`sim/tuning.ts`): `AUTOSPIN_COST`, `AUTOSPIN_DELAYS`, `AUTOSPIN_DELAY_COSTS`, `AUTOSPIN_KEY_SECONDS`.

**Behaviour, exactly** (spec §3, with the ambiguities resolved):
- **Buying.** It needs the auto-seller on ("buy the auto-seller first") and can be bought once ("auto-spin is already bought"). It costs `AUTOSPIN_COST`, arrives OFF and emits `autoSpinBought`. Like every buy, it is refused while the run is locked ("the vault is open").
- **The switch.** `setAutoSpin(on)` needs it bought ("buy auto-spin first") and an unlocked run. It is idempotent: the same value returns OK with no event. It emits `autoSpinToggled { on, first }`, where `first` is true only on the run's first switch-on. `powered` remembers that, so the power-on never replays after a reload. The switch keeps its state for the rest of the run.
- **The pick.** Every successful hand `buyCase` sets `autoSpin.pick = caseId`, even before auto-spin is owned. `setAutoSpinCase(caseId)` sets it from the shelf: the case must be on this run's shelf ("not in this run") and unlocked ("case <id> is locked"). It does not need auto-spin owned. A machine buy never changes the pick.
- **Which case.** The pick, when it is on this shelf, unlocked and affordable. Otherwise the dearest unlocked shelf case it can afford. Otherwise none, which is the "broke" status.
- **The tick** runs after the locker, before the day job. It does nothing unless the machine is owned and on, the run is not locked (vault out or run over) and nobody holds a card (`state.held === null`).
  - **Bench `locked`:** the clock counts up, and at `AUTOSPIN_KEY_SECONDS` it turns the key with `insertKey()` (any locked case: one it bought, one you bought, a Ricochet free case). Then `clock = 0` and it emits `autoSpinKeyed` after `spinStarted`.
  - **Bench `spinning` / `revealed`:** `clock = 0`.
  - **Bench `empty`:** if the vault is shown and affordable, it does nothing. Otherwise `clock = min(clock + dt, delay)`. Once the clock reaches the delay, it buys the chosen case with `placeCase` at full multi-open width (as many as affordable, like BUY), resets the clock and emits `autoSpinPulled` after `caseBought`.
  - With nothing affordable the clock stays due, so it buys the moment cash arrives (a tray claim, the bot, the seller, the day job). It stays ON; the day job appears as today.
- **It never sells.** Your hand sales keep feeding the combo, and auto-spin never builds combo by itself.
- **The delay** is set by the Delay level: `AUTOSPIN_DELAYS[level]`, 1.5 s → 0.2 s over 5 levels. The last level's cost is `null` ("max level").

- [ ] **Step 1: Write the failing tests** in `sim/autoSpin.test.ts`.

```ts
import { describe, expect, it } from "vitest";
import { AUTOSPIN_DELAY_LEVELS, autoSpinDelay, autoSpinDelayCost, autoSpinStatus } from "./autoSpin";
import { priceOf } from "./content/cases";
import { DEFAULT_SETUP, Run, type RunSetup, type SimEvent } from "./run";
import { AUTOSPIN_COST, AUTOSPIN_DELAY_COSTS, AUTOSPIN_DELAYS, AUTOSPIN_KEY_SECONDS, SELLER_COST } from "./tuning";

const DT = 1 / 30;
const tickFor = (r: Run, s: number) => {
  for (let i = 0; i < Math.round(s / DT); i++) r.tick(DT);
};
const types = (es: SimEvent[]) => es.map((e) => e.type);
/** A run with the auto-seller and auto-spin bought and switched on, its events drained. */
function spinning(over: Partial<RunSetup> = {}, cash = 1e6): Run {
  const r = new Run(1, { ...DEFAULT_SETUP, ...over });
  r.state.cash = cash;
  expect(r.buySeller().ok).toBe(true);
  expect(r.buyAutoSpin().ok).toBe(true);
  expect(r.setAutoSpin(true).ok).toBe(true);
  r.drainEvents();
  return r;
}

describe("buying auto-spin", () => {
  it("needs the auto-seller, costs AUTOSPIN_COST once, and arrives switched off", () => {
    const r = new Run(1);
    r.state.cash = SELLER_COST + AUTOSPIN_COST;
    expect(r.buyAutoSpin()).toEqual({ ok: false, reason: "buy the auto-seller first" });
    r.buySeller();
    expect(r.buyAutoSpin()).toEqual({ ok: true });
    expect(r.state.cash).toBe(0);
    expect(r.state.autoSpin).toMatchObject({ owned: true, on: false, delayLevel: 0, powered: false });
    expect(types(r.drainEvents())).toContain("autoSpinBought");
    r.state.cash = 1e9;
    expect(r.buyAutoSpin()).toEqual({ ok: false, reason: "auto-spin is already bought" });
    const poor = new Run(1);
    poor.state.cash = SELLER_COST;
    poor.buySeller();
    expect(poor.buyAutoSpin()).toEqual({ ok: false, reason: "not enough cash" });
  });

  it("prices five Delay levels from AUTOSPIN_DELAY_COSTS, down to the last delay", () => {
    expect(AUTOSPIN_DELAY_LEVELS).toBe(5);
    expect(autoSpinDelayCost(0)).toBe(AUTOSPIN_DELAY_COSTS.baseCost);
    expect(autoSpinDelayCost(1)).toBe(Math.ceil(AUTOSPIN_DELAY_COSTS.baseCost * AUTOSPIN_DELAY_COSTS.growth));
    expect(autoSpinDelayCost(5)).toBeNull();
    expect(autoSpinDelay(0)).toBe(1.5);
    expect(autoSpinDelay(5)).toBe(0.2);
    expect(autoSpinDelay(99)).toBe(0.2);
    expect(new Run(1).buyAutoSpinDelay()).toEqual({ ok: false, reason: "buy auto-spin first" });
    const r = spinning({}, 1e9);
    for (let i = 0; i < 5; i++) expect(r.buyAutoSpinDelay().ok).toBe(true);
    expect(r.buyAutoSpinDelay()).toEqual({ ok: false, reason: "max level" });
    expect(r.drainEvents().filter((e) => e.type === "autoSpinUpgraded")).toHaveLength(5);
  });

  it("switches on and off; only the run's first switch-on is the power-on; the same value changes nothing", () => {
    const r = new Run(1);
    r.state.cash = 1e6;
    expect(r.setAutoSpin(true)).toEqual({ ok: false, reason: "buy auto-spin first" });
    r.buySeller();
    r.buyAutoSpin();
    r.drainEvents();
    r.setAutoSpin(true);
    r.setAutoSpin(false);
    r.setAutoSpin(true);
    expect(r.drainEvents().filter((e) => e.type === "autoSpinToggled")).toEqual([
      { type: "autoSpinToggled", on: true, first: true },
      { type: "autoSpinToggled", on: false, first: false },
      { type: "autoSpinToggled", on: true, first: false },
    ]);
    expect(r.setAutoSpin(true)).toEqual({ ok: true });
    expect(r.drainEvents()).toEqual([]);
    r.state.vault = { phase: "key" };
    expect(r.setAutoSpin(false)).toEqual({ ok: false, reason: "the vault is open" });
  });
});

describe("auto-spin's pick", () => {
  it("is the case you buy by hand or pick on the shelf; the shelf pick checks the case", () => {
    const r = new Run(1);
    r.state.cash = 100;
    r.unlockCase("wildwood");
    r.buyCase("wildwood");
    expect(r.state.autoSpin.pick).toBe("wildwood");
    expect(r.setAutoSpinCase("bootcamp")).toEqual({ ok: true });
    expect(r.state.autoSpin.pick).toBe("bootcamp");
    expect(r.setAutoSpinCase("bedrock")).toEqual({ ok: false, reason: "case bedrock is locked" });
    expect(r.setAutoSpinCase("inferno")).toEqual({ ok: false, reason: "not in this run" });
  });
});

describe("auto-spin at work", () => {
  it("buys the picked case at full multi-open width once the bench has stood empty for its delay, then turns the key", () => {
    const r = spinning();
    r.state.upgrades.multiOpen = 1; // x2
    r.unlockCase("wildwood");
    r.setAutoSpinCase("wildwood");
    r.drainEvents();
    const cash = r.state.cash;
    tickFor(r, AUTOSPIN_DELAYS[0] - 0.1);
    expect(r.state.bench.phase).toBe("empty");
    tickFor(r, 0.2);
    expect(r.state.bench).toMatchObject({ phase: "locked", caseId: "wildwood", count: 2 });
    expect(r.state.cash).toBe(cash - 2 * priceOf("wildwood"));
    const bought = r.drainEvents();
    expect(types(bought).indexOf("caseBought")).toBeLessThan(types(bought).indexOf("autoSpinPulled"));
    expect(bought.find((e) => e.type === "autoSpinPulled")).toEqual({ type: "autoSpinPulled", caseId: "wildwood", count: 2 });
    tickFor(r, AUTOSPIN_KEY_SECONDS - 0.2); // up to 0.1 s of the beat already ran inside the 0.2 s window above
    expect(r.state.bench.phase).toBe("locked");
    tickFor(r, 0.2);
    expect(r.state.bench.phase).toBe("spinning");
    const keyed = types(r.drainEvents());
    expect(keyed.indexOf("spinStarted")).toBeLessThan(keyed.indexOf("autoSpinKeyed"));
  });

  it("turns the key of a case you bought by hand after its beat", () => {
    const r = spinning();
    r.buyCase("bootcamp");
    tickFor(r, AUTOSPIN_KEY_SECONDS - 0.1);
    expect(r.state.bench.phase).toBe("locked");
    tickFor(r, 0.2);
    expect(r.state.bench.phase).toBe("spinning");
  });

  it("falls back to the dearest case it can afford without changing your pick, and goes back to the pick when it can", () => {
    const r = spinning();
    r.unlockCase("wildwood");
    r.setAutoSpinCase("wildwood");
    r.state.cash = priceOf("wildwood") - 1;
    tickFor(r, AUTOSPIN_DELAYS[0] + 0.1);
    expect(r.state.bench).toMatchObject({ phase: "locked", caseId: "bootcamp" });
    expect(r.state.autoSpin.pick).toBe("wildwood");
    r.state.bench = { phase: "empty" }; // as if the seller took the card
    r.state.cash = 1e6;
    tickFor(r, AUTOSPIN_DELAYS[0] + 0.1);
    expect(r.state.bench).toMatchObject({ phase: "locked", caseId: "wildwood" });
  });

  it("waits ON when it can afford nothing (BROKE), leaves the day job to you, and buys the moment it can", () => {
    const r = spinning();
    r.state.cash = 0;
    tickFor(r, AUTOSPIN_DELAYS[0] + 0.5);
    expect(r.state.bench.phase).toBe("empty");
    expect(r.state.autoSpin.on).toBe(true);
    expect(autoSpinStatus(r)).toBe("broke");
    expect(r.dayJobAvailable()).toBe(true);
    r.state.cash = priceOf("bootcamp");
    r.tick(DT);
    expect(r.state.bench).toMatchObject({ phase: "locked", caseId: "bootcamp" });
    expect(autoSpinStatus(r)).toBe("on");
  });

  it("leaves the bench alone while you hold a card, while the vault is out, after the run, and when switched off (Review Focus 3)", () => {
    const held = spinning();
    held.state.held = "bot";
    const vault = spinning();
    vault.state.vault = { phase: "key" };
    const over = spinning();
    over.state.over = true;
    const off = spinning();
    off.setAutoSpin(false);
    for (const r of [held, vault, over, off]) {
      tickFor(r, AUTOSPIN_DELAYS[0] + 1);
      expect(r.state.bench.phase).toBe("empty");
    }
    expect(autoSpinStatus(off)).toBe("off");
    expect(autoSpinStatus(new Run(1))).toBe("off");
  });

  it("buys nothing while the vault is shown and affordable (Review Focus 1)", () => {
    const r = spinning({ vaultPrice: 100 });
    r.state.unlocked = r.runCases();
    r.state.cash = 1000;
    tickFor(r, AUTOSPIN_DELAYS[0] + 1);
    expect(r.state.bench.phase).toBe("empty");
    expect(autoSpinStatus(r)).toBe("vault");
    expect(r.buyVault().ok).toBe(true);
  });

  it("never builds combo by itself: with the auto-seller selling, the combo stays 0", () => {
    const r = spinning();
    tickFor(r, 40);
    expect(r.state.opened).toBeGreaterThanOrEqual(4);
    expect(r.state.combo).toBe(0);
  });

  it("picks up mid-delay after a reload, on the same tick (Review Focus 2)", () => {
    const a = spinning();
    tickFor(a, 1);
    const b = Run.fromSnapshot(a.snapshot());
    tickFor(a, 0.6);
    tickFor(b, 0.6);
    expect(b.state.bench.phase).toBe("locked");
    expect(b.state.bench).toEqual(a.state.bench);
    expect(b.state.autoSpin).toEqual(a.state.autoSpin);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail.**
  Run: `npx vitest run src/modules/casecremental/sim/autoSpin.test.ts`
  Expected: FAIL, because `./autoSpin` does not exist.

- [ ] **Step 3: Add the numbers** to `sim/tuning.ts`, after the auto contract:

```ts
/** Auto-spin (finish spec §3): your own bench's machine, bought in Run 1 once the auto-seller is on, then switched
 *  ON/OFF. F2's starting numbers; F4 tunes them for real players. */
export const AUTOSPIN_COST = 40_000;
/** Seconds the bench stands empty before it buys, per Delay level (5 upgrades: 1.5 s → 0.2 s). */
export const AUTOSPIN_DELAYS = [1.5, 1.1, 0.8, 0.55, 0.35, 0.2] as const;
export const AUTOSPIN_DELAY_COSTS = { baseCost: 20_000, growth: 2.5 } as const;
/** A case left locked on the bench is keyed this long after it landed: the case drops in, then its arm turns the key. */
export const AUTOSPIN_KEY_SECONDS = 0.5;
```

- [ ] **Step 4: Write `sim/autoSpin.ts`.**

```ts
import { botCaseFor } from "./botOpener";
import { runCaseIds } from "./campaign";
import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
import { AUTOSPIN_COST, AUTOSPIN_DELAY_COSTS, AUTOSPIN_DELAYS, AUTOSPIN_KEY_SECONDS } from "./tuning";
import { vaultShown } from "./vault";

// Auto-spin (finish spec §3): a machine for your own bench, bought on the Machines tab once the auto-seller is on, then
// switched ON/OFF (off after purchase; it keeps its state for the run). While it is on, nobody holds a card and the vault
// is not out, it buys the case you picked last (the last one you bought by hand or picked on the shelf; the dearest you
// can afford when that one is too dear) at your full multi-open width once the bench has stood empty for its delay, and
// turns the key of any case left locked on the bench after a short beat. It never sells, so it never builds combo. With
// nothing affordable it waits ON ("BROKE": the day job is yours); with the vault affordable it buys nothing, so it never
// spends the vault's cash or keeps the bench busy under the vault's BUY.

export interface AutoSpinState {
  owned: boolean;
  on: boolean;
  delayLevel: number;
  /** The case it buys: the last one you bought by hand or picked on the shelf (null = the dearest you can afford). */
  pick: string | null;
  /** Seconds the bench has stood empty (toward the delay) or locked (toward the key beat). */
  clock: number;
  /** Switched on before this run: only the first switch-on is the machine's power-on. */
  powered: boolean;
}

/** What it is doing, for its rows and its lamp: off, at work, broke, or waiting for you to buy the vault. */
export type AutoSpinStatus = "off" | "on" | "broke" | "vault";

export const freshAutoSpin = (): AutoSpinState => ({ owned: false, on: false, delayLevel: 0, pick: null, clock: 0, powered: false });

/** The Delay levels after the first. */
export const AUTOSPIN_DELAY_LEVELS = AUTOSPIN_DELAYS.length - 1;

/** Seconds the bench stands empty before it buys, at this Delay level. */
export const autoSpinDelay = (level: number): number => AUTOSPIN_DELAYS[Math.min(Math.max(level, 0), AUTOSPIN_DELAY_LEVELS)]!;

/** Price of the next Delay level, or null at the last. */
export function autoSpinDelayCost(level: number): number | null {
  if (level >= AUTOSPIN_DELAY_LEVELS) return null;
  return Math.ceil(AUTOSPIN_DELAY_COSTS.baseCost * AUTOSPIN_DELAY_COSTS.growth ** level);
}

export function buyAutoSpin(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (s.autoSpin.owned) return fail("auto-spin is already bought");
  if (!s.seller.on) return fail("buy the auto-seller first");
  if (s.cash < AUTOSPIN_COST) return fail("not enough cash");
  s.cash -= AUTOSPIN_COST;
  s.autoSpin.owned = true;
  ctx.emit({ type: "autoSpinBought" });
  return OK;
}

export function buyAutoSpinDelay(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!s.autoSpin.owned) return fail("buy auto-spin first");
  const cost = autoSpinDelayCost(s.autoSpin.delayLevel);
  if (cost === null) return fail("max level");
  if (s.cash < cost) return fail("not enough cash");
  s.cash -= cost;
  s.autoSpin.delayLevel += 1;
  ctx.emit({ type: "autoSpinUpgraded", level: s.autoSpin.delayLevel });
  return OK;
}

/** The switch (on the bench beside BUY and on its Machines row); the same value changes nothing. */
export function setAutoSpin(ctx: RunCtx, on: boolean): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const a = ctx.state.autoSpin;
  if (!a.owned) return fail("buy auto-spin first");
  if (a.on === on) return OK;
  a.on = on;
  a.clock = 0;
  const first = on && !a.powered;
  if (on) a.powered = true;
  ctx.emit({ type: "autoSpinToggled", on, first });
  return OK;
}

/** Pick the case it buys from the shelf: an unlocked case on this run's shelf (buying one by hand picks it too). */
export function setAutoSpinCase(ctx: RunCtx, caseId: string): ActionResult {
  if (!runCaseIds(ctx.setup.run).includes(caseId)) return fail("not in this run");
  if (!ctx.state.unlocked.includes(caseId)) return fail(`case ${caseId} is locked`);
  ctx.state.autoSpin.pick = caseId;
  return OK;
}

/** The vault is out on the shelf and you can pay for it: auto-spin leaves the cash and the bench to you. */
const vaultReady = (ctx: RunCtx): boolean => vaultShown(ctx) && ctx.state.cash >= ctx.setup.vaultPrice;

/** The case it would buy now: the pick when it is on this shelf, unlocked and affordable, else the dearest it can
 *  afford; null when it can afford none. */
export function autoSpinCase(ctx: RunCtx): string | null {
  const s = ctx.state;
  const shelf = runCaseIds(ctx.setup.run).filter((id) => s.unlocked.includes(id));
  const price = (id: string) => ctx.casePrice(id);
  const pick = s.autoSpin.pick;
  if (pick && shelf.includes(pick) && price(pick) <= s.cash) return pick;
  return botCaseFor(null, shelf, s.cash, price);
}

export function autoSpinStatus(ctx: RunCtx): AutoSpinStatus {
  const a = ctx.state.autoSpin;
  if (!a.owned || !a.on) return "off";
  if (vaultReady(ctx)) return "vault";
  if (ctx.state.bench.phase === "empty" && autoSpinCase(ctx) === null) return "broke";
  return "on";
}

export function tickAutoSpin(ctx: RunCtx, dt: number): void {
  const s = ctx.state;
  const a = s.autoSpin;
  if (!a.owned || !a.on || ctx.locked() || s.held !== null) return;
  const b = s.bench;
  if (b.phase === "locked") {
    a.clock += dt;
    if (a.clock >= AUTOSPIN_KEY_SECONDS && ctx.insertKey().ok) {
      a.clock = 0;
      ctx.emit({ type: "autoSpinKeyed" });
    }
    return;
  }
  if (b.phase !== "empty") {
    a.clock = 0;
    return;
  }
  if (vaultReady(ctx)) return;
  const delay = autoSpinDelay(a.delayLevel);
  a.clock = Math.min(a.clock + dt, delay); // broke, it stays due: it buys the moment it can afford a case
  if (a.clock < delay) return;
  const caseId = autoSpinCase(ctx);
  if (!caseId) return;
  a.clock = 0;
  const count = ctx.placeCase(caseId);
  ctx.emit({ type: "autoSpinPulled", caseId, count });
}
```

- [ ] **Step 5: Wire it into the run.**
  - `sim/runTypes.ts`:
    - Import `type AutoSpinState` from `./autoSpin`.
    - Add `/** Auto-spin: your bench's machine (Run 1+). */ autoSpin: AutoSpinState;` to `RunState` after `locker`.
    - Add the events after `autoContractBought`:
    ```ts
    | { type: "autoSpinBought" }
    | { type: "autoSpinUpgraded"; level: number }
    /** Switched on or off; `first` is the run's first switch-on (the machine's power-on). */
    | { type: "autoSpinToggled"; on: boolean; first: boolean }
    /** It bought a case (its arm pulls); caseBought comes first. */
    | { type: "autoSpinPulled"; caseId: string; count: number }
    /** It turned the key (its arm swings); spinStarted comes first. */
    | { type: "autoSpinKeyed" }
    ```
    - Add to `RunCtx`:
    ```ts
    /** Pays for one BUY of a case (multi-open: as many as you can afford) and locks it on the empty bench; returns how
     *  many. The caller has checked the bench, the shelf and the cash. */
    placeCase(caseId: string): number;
    insertKey(): ActionResult;
    ```
    - Header comment: "(bot, auto-seller, locker, auto-spin, vault, day job)".
  - `sim/run.ts`:
    - Import `* as autoSpin` and `{ freshAutoSpin }` from `./autoSpin`. Add `autoSpin: freshAutoSpin(),` after `locker:` in the constructor, and `autoSpin.tickAutoSpin(this, dt);` right after `locker.tickLocker(this, dt);`.
    - The header comment lists "auto-spin".
    - Replace the tail of `buyCase` (from `const count = …`) with:
    ```ts
        this.placeCase(caseId);
        s.autoSpin.pick = caseId; // auto-spin buys the case you bought last
        return OK;
      }

      /** Pays for one BUY of a case (multi-open: as many as you can afford) and locks it on the empty bench; returns how
       *  many. buyCase and auto-spin check the bench, the shelf and the cash first. */
      placeCase(caseId: string): number {
        const count = this.openCount(caseId);
        this.state.cash -= this.casePrice(caseId) * count;
        this.state.bench = { phase: "locked", caseId, free: false, count };
        this.emit({ type: "caseBought", caseId, free: false, count });
        return count;
      }
    ```
    - Add after `buyAutoContract`:
    ```ts
      /** Auto-spin (needs the auto-seller): it buys and opens your cases while it is on. */
      buyAutoSpin(): ActionResult {
        return autoSpin.buyAutoSpin(this);
      }

      buyAutoSpinDelay(): ActionResult {
        return autoSpin.buyAutoSpinDelay(this);
      }

      /** Switch auto-spin on or off; it keeps its state for the rest of the run. */
      setAutoSpin(on: boolean): ActionResult {
        return autoSpin.setAutoSpin(this, on);
      }

      /** The case auto-spin buys, picked on the shelf. */
      setAutoSpinCase(caseId: string): ActionResult {
        return autoSpin.setAutoSpinCase(this, caseId);
      }
    ```
    - Check the length: `wc -l sim/run.ts` must be at most the ~522 lines it had before Task 1. Task 1 removed ~25 lines.
  - `game/save.ts`: import `freshAutoSpin` from `../sim/autoSpin` and add `autoSpin: { ...freshAutoSpin(), ...d.run.state.autoSpin },` in `normalize` after `locker:`. A save from before auto-spin then reloads safely in this commit.

- [ ] **Step 6: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/sim`
  Expected: PASS, the pacing tests included. The greedy player does not use auto-spin yet, so pacing is unchanged from Task 1.

- [ ] **Step 7: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/sim src/modules/casecremental/game/save.ts
  git commit -m "feat(autospin): the auto-spin machine - picks your last case, full multi-open width, a delay, the key

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 3: Save v5, and the view, controller and agent surface

**Files:**
- Modify: `game/save.ts`, `game/save.test.ts`, `game/viewMachines.ts`, `game/view.ts`, `game/view.test.ts`, `game/controller.ts`, `game/controller.test.ts`, `game/agent.ts`, `game/agent.test.ts`

**Interfaces:**
- Consumes: everything Task 2 produces.
- Produces:
  ```ts
  // game/viewMachines.ts (re-exported from game/view.ts)
  export interface AutoSpinView {
    owned: boolean; cost: number; canBuy: boolean; needsSeller: boolean;
    on: boolean; canToggle: boolean; status: AutoSpinStatus;
    delay: number; delayLevel: number; maxLevel: number; delayCost: number | null; canBuyDelay: boolean;
    pick: string | null;
  }
  export function autoSpinView(run: Run): AutoSpinView;
  // GameView.autoSpin: AutoSpinView; CaseView.picked: boolean
  // Action: { type: "buyAutoSpin" } | { type: "buyAutoSpinDelay" } | { type: "setAutoSpin"; on: boolean } | { type: "setAutoSpinCase"; caseId: string }
  // agent: state().autoSpin = { owned, on, delayLevel, delay, pick, status }; actions buyAutoSpin, buyAutoSpinDelay, setAutoSpin, setAutoSpinCase
  // save: SAVE_VERSION = 5
  ```

- [ ] **Step 1: Write the failing tests.**

  `game/save.test.ts`:
  - Add `import { freshAutoSpin } from "../sim/autoSpin";`.
  - In "migrates a version-3 save…" and "migrates a version-2 save…", change `.toBe(4)` to `.toBe(5)`.
  - Replace "round-trips a version-4 save with a double spin and two cards" with the same test renamed `"round-trips a version-5 save with a double spin and two cards"`, ending in `expect(SAVE_VERSION).toBe(5);`.
  - Add:
  ```ts
  it("migrates a version-4 save: the grid is dropped (its spent cash is not refunded) and auto-spin is fresh (Review Focus 5)", () => {
    const drop = { id: 1, skinId: CASES[0]!.skins[0]!.id, caseId: "bootcamp", rarity: "covert", float: 0.2, statTrak: false, value: 1 };
    const d = JSON.parse(encodeSave(data()));
    d.v = 4;
    delete d.run.state.autoSpin;
    d.run.state.grid = {
      on: true,
      rateLevel: 2,
      sizeLevel: 1,
      reserve: 0.5,
      ticks: ["bootcamp"],
      cells: [{ caseId: "bootcamp", t: 0.4, drop }, null],
      buyClock: 0.3,
      next: 1,
    };
    const cash = d.run.state.cash;
    const loaded = decodeSave(JSON.stringify(d))!;
    expect(loaded.v).toBe(5);
    expect(loaded.run.state).not.toHaveProperty("grid");
    expect(loaded.run.state.autoSpin).toEqual({ owned: false, on: false, delayLevel: 0, pick: null, clock: 0, powered: false });
    expect(loaded.run.state.cash).toBe(cash);
    expect(() => Run.fromSnapshot(loaded.run).tick(1 / 30)).not.toThrow();
  });

  it("round-trips a version-5 save with auto-spin on mid-delay; the reloaded run buys on the same tick (Review Focus 2)", () => {
    const r = new Run(3, { ...DEFAULT_SETUP, startCash: 1e6 });
    r.buySeller();
    r.buyAutoSpin();
    r.setAutoSpin(true);
    r.setAutoSpinCase("bootcamp");
    for (let i = 0; i < 30; i++) r.tick(1 / 30);
    const d: SaveData = { v: SAVE_VERSION, meta: freshMeta(), run: r.snapshot() };
    const loaded = decodeSave(encodeSave(d))!;
    expect(loaded).toEqual(d);
    const again = Run.fromSnapshot(loaded.run);
    for (let i = 0; i < 20; i++) {
      r.tick(1 / 30);
      again.tick(1 / 30);
    }
    expect(again.state.bench.phase).toBe("locked");
    expect(again.state.bench).toEqual(r.state.bench);
  });

  it("gives a v5 save that lacks auto-spin a fresh one", () => {
    const d = JSON.parse(encodeSave(data()));
    delete d.run.state.autoSpin;
    expect(decodeSave(JSON.stringify(d))!.run.state.autoSpin).toEqual(freshAutoSpin());
  });
  ```

  `game/view.test.ts`: add `AUTOSPIN_COST, AUTOSPIN_DELAY_COSTS, AUTOSPIN_DELAYS` to the tuning import, and:
  ```ts
  it("shows auto-spin on the Machines tab from Run 1: it needs the auto-seller, then its switch, status, delay and pick", () => {
    const run = new Run(1);
    run.state.cash = 1e6;
    expect(buildView(run).autoSpin).toMatchObject({ owned: false, needsSeller: true, canBuy: false, cost: AUTOSPIN_COST });
    run.buySeller();
    expect(buildView(run).autoSpin).toMatchObject({ needsSeller: false, canBuy: true });
    run.buyAutoSpin();
    expect(buildView(run).autoSpin).toMatchObject({
      owned: true,
      canBuy: false,
      on: false,
      canToggle: true,
      status: "off",
      delay: AUTOSPIN_DELAYS[0],
      delayLevel: 0,
      maxLevel: 5,
      delayCost: AUTOSPIN_DELAY_COSTS.baseCost,
      canBuyDelay: true,
      pick: null,
    });
    run.setAutoSpin(true);
    run.setAutoSpinCase("bootcamp");
    const v = buildView(run);
    expect(v.autoSpin).toMatchObject({ on: true, status: "on", pick: "bootcamp" });
    expect(v.cases.find((c) => c.id === "bootcamp")!.picked).toBe(true);
    run.state.cash = 0;
    expect(buildView(run).autoSpin.status).toBe("broke");
    run.state.vault = { phase: "key" };
    expect(buildView(run).autoSpin.canToggle).toBe(false);
  });
  ```

  `game/controller.test.ts`: add `import { SaveSlot } from "./save";` (if not imported yet), and:
  ```ts
  it("routes auto-spin's actions", () => {
    const c = new GameController(1);
    c.devAddCash(1e6);
    expect(c.act({ type: "buyAutoSpin" })).toEqual({ ok: false, reason: "buy the auto-seller first" });
    expect(c.act({ type: "buySeller" }).ok).toBe(true);
    expect(c.act({ type: "buyAutoSpin" }).ok).toBe(true);
    expect(c.act({ type: "buyAutoSpinDelay" }).ok).toBe(true);
    expect(c.act({ type: "setAutoSpin", on: true }).ok).toBe(true);
    expect(c.act({ type: "setAutoSpinCase", caseId: "bootcamp" }).ok).toBe(true);
    expect(c.run.state.autoSpin).toMatchObject({ owned: true, on: true, delayLevel: 1, pick: "bootcamp" });
  });

  it("keeps auto-spin's switch across a reload (Review Focus 2)", () => {
    const m = new Map<string, string>();
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
    const a = new GameController(1, new SaveSlot(store));
    a.devAddCash(1e6);
    a.act({ type: "buySeller" });
    a.act({ type: "buyAutoSpin" });
    a.act({ type: "setAutoSpin", on: true });
    const b = new GameController(2, new SaveSlot(store));
    expect(b.run.state.autoSpin).toMatchObject({ owned: true, on: true, powered: true });
  });
  ```

  `game/agent.test.ts`:
  ```ts
  it("reports auto-spin and checks its switch's argument", async () => {
    const c = new GameController(1);
    const api = createAgentApi(c);
    expect((api.state() as { autoSpin: unknown }).autoSpin).toEqual({ owned: false, on: false, delayLevel: 0, delay: 1.5, pick: null, status: "off" });
    c.devAddCash(1e6);
    await api.actions!.buySeller!({});
    expect(await api.actions!.buyAutoSpin!({})).toEqual({ ok: true });
    await expect(api.actions!.setAutoSpin!({ on: "yes" })).rejects.toThrow(/on must be true or false/);
    expect(await api.actions!.setAutoSpin!({ on: true })).toEqual({ ok: true });
    expect(await api.actions!.setAutoSpinCase!({ caseId: "bootcamp" })).toEqual({ ok: true });
    expect((api.state() as { autoSpin: { on: boolean; pick: string; status: string } }).autoSpin).toMatchObject({
      on: true,
      pick: "bootcamp",
      status: "on",
    });
  });
  ```

- [ ] **Step 2: Run the tests to see them fail.**
  Run: `npx vitest run src/modules/casecremental/game`
  Expected: FAIL, because `SAVE_VERSION` is 4, there is no `autoSpin` view, and the actions are unknown.

- [ ] **Step 3: Save version 5.** In `game/save.ts`:
  - Add a header line: "Version 5 (finish F2): the auto-buyer grid is gone and auto-spin arrives; a version-4 save is migrated."
  - Set `SAVE_VERSION = 5`.
  - Add, after `migrateV3`:
  ```ts
  /** A version-4 save had the auto-buyer grid (gone from every run; its spent cash is not refunded) and no auto-spin. */
  function migrateV4(d: unknown): unknown {
    if (!isObj(d) || d.v !== 4 || !isObj(d.run) || !isObj(d.run.state)) return d;
    const { grid, ...state } = d.run.state;
    void grid;
    return { ...d, v: 5, run: { ...d.run, state: { ...state, autoSpin: freshAutoSpin() } } };
  }
  ```
  - In `decodeSave`: `const d: unknown = migrateV4(migrateV3(migrateV2(JSON.parse(raw))));`.

- [ ] **Step 4: The view.**
  - In `game/viewMachines.ts`, import `autoSpinDelay, autoSpinDelayCost, autoSpinStatus, AUTOSPIN_DELAY_LEVELS, type AutoSpinStatus` from `../sim/autoSpin` and `AUTOSPIN_COST` from tuning, and add the interface (with doc comments) and:
  ```ts
  export function autoSpinView(run: Run): AutoSpinView {
    const s = run.state;
    const open = !run.locked();
    const a = s.autoSpin;
    const delayCost = autoSpinDelayCost(a.delayLevel);
    return {
      owned: a.owned,
      cost: AUTOSPIN_COST,
      canBuy: open && !a.owned && s.seller.on && s.cash >= AUTOSPIN_COST,
      needsSeller: !s.seller.on,
      on: a.on,
      canToggle: open && a.owned,
      status: autoSpinStatus(run),
      delay: autoSpinDelay(a.delayLevel),
      delayLevel: a.delayLevel,
      maxLevel: AUTOSPIN_DELAY_LEVELS,
      delayCost,
      canBuyDelay: open && a.owned && delayCost !== null && s.cash >= delayCost,
      pick: a.pick,
    };
  }
  ```
  - In `game/view.ts`:
    - Import and re-export `autoSpinView` / `AutoSpinView`.
    - Add `/** Auto-spin buys this one: the case you bought last or picked on the shelf. */ picked: boolean;` to `CaseView`, with `picked: s.autoSpin.pick === c.id,` in `buildView`.
    - Add `autoSpin: AutoSpinView;` to `GameView` after `seller`, with `autoSpin: autoSpinView(run),`.
    - The viewMachines header lists "the auto-spin".

- [ ] **Step 5: The controller.** In `game/controller.ts`, add the four `Action` members after `buyAutoContract`, and these dispatch cases:
  ```ts
      case "buyAutoSpin":
        return run.buyAutoSpin();
      case "buyAutoSpinDelay":
        return run.buyAutoSpinDelay();
      case "setAutoSpin":
        return run.setAutoSpin(a.on);
      case "setAutoSpinCase":
        return run.setAutoSpinCase(a.caseId);
  ```

- [ ] **Step 6: The agent.** In `game/agent.ts`:
  - Import `autoSpinDelay, autoSpinStatus` from `../sim/autoSpin`.
  - Add this to `state()` after `locker`:
  ```ts
        autoSpin: {
          owned: s.autoSpin.owned,
          on: s.autoSpin.on,
          delayLevel: s.autoSpin.delayLevel,
          delay: autoSpinDelay(s.autoSpin.delayLevel),
          pick: s.autoSpin.pick,
          status: autoSpinStatus(c.run),
        },
  ```
  - Add these actions after `buyAutoContract`:
  ```ts
      buyAutoSpin: () => run({ type: "buyAutoSpin" }),
      buyAutoSpinDelay: () => run({ type: "buyAutoSpinDelay" }),
      setAutoSpin: async (args: Args) => {
        if (typeof args?.on !== "boolean") throw new Error(`on must be true or false (got ${JSON.stringify(args?.on)})`);
        return c.act({ type: "setAutoSpin", on: args.on });
      },
      setAutoSpinCase: (args: Args) => run({ type: "setAutoSpinCase", caseId: String(args?.caseId ?? "") }),
  ```
  - Add these to `describeActions`:
  ```ts
      buyAutoSpin: "Buy auto-spin (needs the auto-seller; it starts OFF): while on, it buys the case you picked last at full multi-open width and turns the key.",
      buyAutoSpinDelay: "Buy one auto-spin Delay level (it buys sooner after the bench empties: 1.5 s -> 0.2 s).",
      setAutoSpin: "Switch auto-spin: { on: true|false }.",
      setAutoSpinCase: "The case auto-spin buys: { caseId } (an unlocked case on this run's shelf; buying a case by hand picks it too).",
  ```

- [ ] **Step 7: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/game`
  Expected: PASS.

- [ ] **Step 8: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/game
  git commit -m "feat(autospin): save v5 (the grid dropped, auto-spin fresh), its view, actions and agent surface

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 4: The greedy pacing player uses auto-spin

The greedy player buys auto-spin after the seller, at twice its price like every other machine, and switches it on. From then on it **leaves the bench to the machine**: it never buys or keys by hand again, it sells and claims as before, and it looks at the shop (`spend`) whenever it has a free moment. It also picks each newly unlocked case on the shelf, as a player would.

This is the model of "keeps it on" (spec §3). Auto-spin at its top Delay (0.2 s plus the 0.5 s key beat) works the bench faster than the HUMAN timings (0.3 s buy plus 0.4 s key), and the player now shops at once instead of only on an empty bench. So the runs get faster, and the vault prices and one unlock cost move to keep the pacing tests green. F4 then retunes everything for real players.

A scratch prototype of exactly these rules was measured over 5 seeds. These are the starting numbers:

| constant | before | after |
|---|---|---|
| `VAULT_PRICES` | `[1_200_000, 2_000_000_000, 450_000_000_000]` | `[1_200_000, 2_400_000_000, 800_000_000_000]` |
| `CASE_ECONOMY.neon.unlockCost` | `800_000` | `2_000_000` |
| `AUTOSPIN_COST`, `AUTOSPIN_DELAY_COSTS`, `AUTOSPIN_DELAYS`, `AUTOSPIN_KEY_SECONDS`, `VAULT_GROWTH` | as Task 2 / 3.25 | unchanged |

Prototype medians:

| | measured | band |
|---|---|---|
| Run 1: bot awake | 132 s | ≤ 150 s |
| Run 1: seller | 193 s | 180–300 s |
| Run 1: vault | ~455 s | 360–600 s |
| Run 1 replay: catch-up | 73 s | 60–120 s |
| Run 1 replay: vault | ~327 s | 300–420 s |
| Run 2: catch-up | 73 s | 60–120 s |
| Run 2: locker | ~90 s | ≤ 240 s |
| Run 2: vault | ~386 s | 360–600 s |
| Run 2: top stage | 4 | ≥ 3 |
| Run 2: contracts | ~32 | > 0 |
| Run 3: catch-up | ~72 s | 60–120 s |
| Run 3: vault | ~388 s | 360–600 s |
| Run 3: top stage | 5 | ≥ 4 |
| Run 3 replay: catch-up | ~65 s | 60–120 s |
| Run 3 replay: vault | ~384 s | 300–420 s |
| tray | never stuck full | — |

Without the unlock-cost change, the Run 3 catch-up was 56 s (a fail).

**Files:**
- Modify: `sim/bot.ts`, `sim/pacing.test.ts`, `sim/tuning.ts`

**Interfaces:**
- Consumes: `Run.buyAutoSpin`, `setAutoSpin`, `setAutoSpinCase`, `buyAutoSpinDelay`, `autoSpinDelayCost`, `AUTOSPIN_COST`.
- Produces: `PacingReport.autoSpinAt?: number`, the time it was switched on.

- [ ] **Step 1: Write the failing test.** In `sim/pacing.test.ts`, in "pacing — the whole of Run 1 and a boosted Run 1 replay", after the seller test:
  ```ts
  it("buys auto-spin after the auto-seller and before the vault, and keeps it on", () => {
    const t = med((r) => r.autoSpinAt);
    expect(t).toBeGreaterThan(med((r) => r.sellerAt));
    expect(t).toBeLessThan(med((r) => r.vaultAt));
  });
  ```

- [ ] **Step 2: Run it to see it fail.**
  Run: `npx vitest run src/modules/casecremental/sim/pacing.test.ts`
  Expected: FAIL. `autoSpinAt` is undefined, so the median is `Infinity`.

- [ ] **Step 3: Teach the greedy player.** In `sim/bot.ts`:
  - Import `autoSpinDelayCost` from `./autoSpin` and `AUTOSPIN_COST` from `./tuning`.
  - Add `/** When auto-spin was bought and switched on. */ autoSpinAt?: number;` to `PacingReport`.
  - In the event loop, add `if (e.type === "autoSpinToggled" && e.on) report.autoSpinAt ??= s.time;`, and in the `caseUnlocked` branch add `run.setAutoSpinCase(e.caseId); // a player picks the new case for auto-spin`.
  - In the action chain, insert between the `tradeUp` branch and the `b.phase === "locked"` branch:
  ```ts
      } else if (s.autoSpin.on) {
        spend(run); // the bench is the machine's: shop whenever free
        busyUntil = s.time + timings.buy;
  ```
  - In `spend`, right after the seller block:
  ```ts
    if (s.seller.on && !s.autoSpin.owned && s.cash >= AUTOSPIN_COST * 2) {
      run.buyAutoSpin();
      run.setAutoSpin(true);
      return;
    }
  ```
  - With the other offers, add `if (s.autoSpin.owned) offer(autoSpinDelayCost(s.autoSpin.delayLevel), () => run.buyAutoSpinDelay());`.
  - Update the header comment:
    - after "buys the auto-seller", add ", then auto-spin (switched on: from then on it leaves the bench to the machine, picks each new case for it and shops whenever free)";
    - add "auto-spin's Delay" to the upgrade list.

- [ ] **Step 4: Retune** `sim/tuning.ts` to the "after" column above.
  - Add a comment over `VAULT_PRICES`: "F2: raised with auto-spin (the greedy player's bench runs on the machine); F4 retunes for real players."
  - Add a comment on `neon`: "unlock 2M (F2: Run 3's catch-up stays above 1 min with auto-spin)".

- [ ] **Step 5: Run the pacing tests.**
  Run: `npx vitest run src/modules/casecremental/sim/pacing.test.ts`
  Expected: PASS, with medians near the table above.

  If one median falls outside its band, the implementation differs from the prototype, or seeds moved. First check the rules against Task 2 and Step 3: they must match. Then adjust only `sim/tuning.ts`, in this order, keeping every median at least 5 s inside its band:
  - Run 1 vault: `VAULT_PRICES[0]`.
  - Run 1 replay vault too fast: `AUTOSPIN_COST` up (auto-spin bought later), then `AUTOSPIN_DELAY_COSTS.baseCost` up.
  - Run 2 vault: `VAULT_PRICES[1]`.
  - Run 3 catch-up: `neon.unlockCost`.
  - Run 3 vault: `VAULT_PRICES[2]`.
  - Run 3 replay: `VAULT_PRICES[2]` or `VAULT_GROWTH`. Note that `VAULT_GROWTH` also moves the Run 1 replay test's price.

  Report the final medians. A scratch test that prints them helps; do not commit it.

- [ ] **Step 6: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/sim
  git commit -m "feat(autospin): the greedy pacing player buys auto-spin after the seller and keeps it on; vaults retuned

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 5: Machines rows, the shelf's switch and pick boxes (EN + RU)

The spec wants "an ON/OFF switch on the bench beside BUY". BUY lives on the **case shelf**: the right panel, or the drawer's Cases tab on phones. So the switch is a row at the top of the shelf, shown once auto-spin is owned, in reach whenever BUY is. The same switch sits on its Machines row. The arm on the table (Task 6) also switches it on a tap.

The pick needs its own affordance: while auto-spin runs, the bench is busy, so the shelf's BUY buttons are mostly disabled. Each unlocked case row therefore gets a pick box once auto-spin is owned: the tick box the grid used, now one-of-many, with a gold frame on the picked case. A hand BUY moves the pick too.

**Files:**
- Create: `ui/AutoSpinRows.tsx`, `ui/autoSpinRules.ts`, `ui/autoSpinRules.test.ts`
- Modify: `ui/MachinesPanel.tsx`, `ui/CaseShelf.tsx`, `ui/shelfFit.ts`, `ui/shelfFit.test.ts`, `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`, `i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `GameView.autoSpin: AutoSpinView`, `CaseView.picked`, the four actions.
- Produces:
  - `statusKey(s: AutoSpinStatus): StringKey`;
  - `delaySeconds(s: number, lang: Lang): string`;
  - `picksShown(view: { autoSpin: { owned: boolean } }): boolean`;
  - `AutoSpinRows`, `AutoSpinSwitch({ a, act })`.

Strings (the `autospin.` budget is 20 characters, `shelf.` 20):

| key | EN | RU |
|---|---|---|
| `autospin.name` | Auto-spin | Автоспин |
| `autospin.desc` | Opens your cases | Крутит твои кейсы |
| `autospin.needs` | Needs auto-seller | Нужен автопродавец |
| `autospin.on` | ON | ВКЛ |
| `autospin.off` | OFF | ВЫКЛ |
| `autospin.idle` | Switched off | Выключен |
| `autospin.running` | Opening cases | Открывает кейсы |
| `autospin.broke` | BROKE | НА МЕЛИ |
| `autospin.vault` | Waits: vault | Ждёт: сейф |
| `autospin.delay` | Delay {s} s | Пауза {s} с |
| `shelf.pick` | Auto-spin opens it | Его крутит автоспин |

- [ ] **Step 1: Write the failing tests.**

  `ui/autoSpinRules.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { AUTOSPIN_DELAYS } from "../sim/tuning";
  import { delaySeconds, statusKey } from "./autoSpinRules";

  describe("auto-spin's rows", () => {
    it("say what it is doing", () => {
      expect(statusKey("off")).toBe("autospin.idle");
      expect(statusKey("on")).toBe("autospin.running");
      expect(statusKey("broke")).toBe("autospin.broke");
      expect(statusKey("vault")).toBe("autospin.vault");
    });

    it("print each delay short, with a decimal comma in Russian", () => {
      expect(AUTOSPIN_DELAYS.map((s) => delaySeconds(s, "en"))).toEqual(["1.5", "1.1", "0.8", "0.55", "0.35", "0.2"]);
      expect(delaySeconds(0.55, "ru")).toBe("0,55");
      expect(delaySeconds(1.5, "ru")).toBe("1,5");
    });
  });
  ```
  `ui/shelfFit.test.ts`: import `picksShown` and add:
  ```ts
  describe("picksShown", () => {
    it("shows the shelf's pick boxes once auto-spin is bought", () => {
      expect(picksShown({ autoSpin: { owned: false } })).toBe(false);
      expect(picksShown({ autoSpin: { owned: true } })).toBe(true);
    });
  });
  ```
  `i18n/i18n.test.ts`: import `AUTOSPIN_DELAYS` from `../sim/tuning` and `delaySeconds` from `../ui/autoSpinRules`, and add this inside the "the run lines fit…" test:
  ```ts
  for (const s of AUTOSPIN_DELAYS) expect(fits("autospin.delay", { s: delaySeconds(s, lang) }), `delay ${s}`).toBe(true);
  ```

- [ ] **Step 2: Run the tests to see them fail.**
  Run: `npx vitest run src/modules/casecremental/ui src/modules/casecremental/i18n`
  Expected: FAIL. The modules and keys are missing.

- [ ] **Step 3: The strings.** Add the table's keys to `i18n/en.ts` and `i18n/ru.ts`. Put them after `locker.autoon`; `shelf.pick` goes where `shelf.tick` was. Add `["autospin.", 20],` to `i18n/budgets.ts` after `["locker.", 20]`.

- [ ] **Step 4: The rules.** Create `ui/autoSpinRules.ts`:
  ```ts
  import type { StringKey } from "../i18n/en";
  import type { Lang } from "../i18n/index";
  import type { AutoSpinStatus } from "../sim/autoSpin";

  // Auto-spin's rows (finish spec §3): what the status line says, and how a delay prints.

  /** What auto-spin's rows say it is doing. */
  export function statusKey(s: AutoSpinStatus): StringKey {
    return s === "on" ? "autospin.running" : s === "broke" ? "autospin.broke" : s === "vault" ? "autospin.vault" : "autospin.idle";
  }

  /** A delay as the rows print it: "1.5", "0.55", with a decimal comma in Russian. */
  export function delaySeconds(s: number, lang: Lang): string {
    const text = String(Math.round(s * 100) / 100);
    return lang === "ru" ? text.replace(".", ",") : text;
  }
  ```
  In `ui/shelfFit.ts`, add:
  ```ts
  /** The shelf shows auto-spin's pick boxes once auto-spin is bought (the sim takes a pick earlier; the UI hides it). */
  export const picksShown = (view: { autoSpin: { owned: boolean } }): boolean => view.autoSpin.owned;
  ```

- [ ] **Step 5: The rows.** Create `ui/AutoSpinRows.tsx`:
  ```tsx
  import type { ReactNode } from "react";
  import type { AutoSpinView, GameView } from "../game/view";
  import { getLang, t } from "../i18n/index";
  import { formatCash } from "../sim/format";
  import { delaySeconds, statusKey } from "./autoSpinRules";
  import type { Act } from "./machineRules";
  import { PxButton } from "./parts";

  // Auto-spin's rows on the Machines tab (finish spec §3, Run 1+): buy it once the auto-seller is on ("Needs
  // auto-seller" before), then its ON/OFF switch with what it is doing, and its Delay. The case shelf shows the same
  // switch beside BUY (AutoSpinSwitch).

  /** ON/OFF: lit while on; disabled while the vault is out or the run is over. */
  export function AutoSpinSwitch({ a, act }: { a: AutoSpinView; act: Act }): ReactNode {
    return (
      <PxButton on={a.on} disabled={!a.canToggle} onClick={() => act({ type: "setAutoSpin", on: !a.on })}>
        {t(a.on ? "autospin.on" : "autospin.off")}
      </PxButton>
    );
  }

  export function AutoSpinRows({ view, act }: { view: GameView; act: Act }): ReactNode {
    const a = view.autoSpin;
    const lang = getLang();
    if (!a.owned)
      return (
        <div className="cc-row">
          <div>{t("autospin.name")}</div>
          <div className="cc-dim">{a.needsSeller ? t("autospin.needs") : t("autospin.desc")}</div>
          <PxButton disabled={!a.canBuy} onClick={() => act({ type: "buyAutoSpin" })}>
            {t("btn.buy")}
            <span className="cc-btn-sub">{formatCash(a.cost, lang)}</span>
          </PxButton>
        </div>
      );
    return (
      <>
        <div className="cc-row">
          <div>{t("autospin.name")}</div>
          <div className="cc-dim">{t(statusKey(a.status))}</div>
          <AutoSpinSwitch a={a} act={act} />
        </div>
        <div className="cc-row">
          <div className="cc-dim">{t("autospin.delay", { s: delaySeconds(a.delay, lang) })}</div>
          {a.delayCost === null ? (
            <PxButton disabled>{t("btn.max")}</PxButton>
          ) : (
            <PxButton disabled={!a.canBuyDelay} onClick={() => act({ type: "buyAutoSpinDelay" })}>
              {formatCash(a.delayCost, lang)}
            </PxButton>
          )}
        </div>
      </>
    );
  }
  ```
  In `ui/MachinesPanel.tsx`, render `<AutoSpinRows view={view} act={act} />` between `SellerRows` and `LockerRows`. Header: "The Machines tab: the auto-seller and auto-spin (Run 1), the locker (Run 2+)."

- [ ] **Step 6: The shelf.** In `ui/CaseShelf.tsx`:
  - Import `AutoSpinSwitch`, `statusKey`, `picksShown`, `boardOpen` and `PixelTick`.
  - Add:
  ```tsx
  /** Auto-spin buys the case picked here (a hand BUY picks too); a gold frame marks it (finish spec §3). */
  function PickBox({ c, act, open }: { c: CaseView; act: Act; open: boolean }): ReactNode {
    return (
      <PxButton
        on={c.picked}
        disabled={!open}
        title={t("shelf.pick")}
        onClick={() => act({ type: "setAutoSpinCase", caseId: c.id })}
        style={{ flex: "none", lineHeight: 1 }}
      >
        <PixelTick on={c.picked} />
      </PxButton>
    );
  }

  /** Auto-spin's switch beside the BUY buttons (finish spec §3), and BROKE or "Waits: vault" under it. */
  function AutoSpinRow({ view, act }: { view: GameView; act: Act }): ReactNode {
    const a = view.autoSpin;
    if (!a.owned) return null;
    return (
      <div className="cc-row">
        <div>{t("autospin.name")}</div>
        <AutoSpinSwitch a={a} act={act} />
        {a.status === "broke" || a.status === "vault" ? <div className="cc-dim">{t(statusKey(a.status))}</div> : null}
      </div>
    );
  }
  ```
  - `CaseRow` takes `{ c, act, picks, open }`. It frames the picked case gold when `picks && c.picked` (the same `boxShadow` the tick frame used), and renders `{picks ? <PickBox c={c} act={act} open={open} /> : null}` after BUY.
  - `CaseShelf` renders `<AutoSpinRow view={view} act={act} />` first inside `.cc-scroll`, and passes `picks={picksShown(view)} open={boardOpen(view)}` to each row.
  - The switch and the pick box each take their own line (`.cc-row` is a grid). So no width fit is needed beyond the existing shelf tests; the pick box is the same glyph the grid's tick box used there.

- [ ] **Step 7: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/ui src/modules/casecremental/i18n`
  Expected: PASS.

- [ ] **Step 8: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/ui src/modules/casecremental/i18n
  git commit -m "feat(autospin): Machines rows, the ON/OFF switch beside BUY and the shelf's pick boxes (EN + RU)

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 6: The arm by the bench

The spec offers "pixel art, or drawn". **Decision: drawn in code**, following `fx/pixel/drawn.ts` (the user chose code over art for machine chrome), so no image generation is needed. The arm is 10 × 18 px, bolted to the mat's right end. It has a gunmetal motor housing with brass rivets and a lamp window, and a lever with a red knob, in three frames:
- 0: at rest;
- 1: lever pulled (it bought a case);
- 2: a brass arm out toward the lock (it turned the key).

The station draws the 2 × 2 lamp over the housing's window from the sim every frame:
- green with a soft HD glow while on;
- dark red when off;
- amber blinking at 2 Hz when BROKE;
- steady amber while it waits for you to buy the vault.

The arm is hidden until auto-spin is bought, so early Run 1's bench stays as it is.

One-shot juice:
- **Bought:** green sparks and the seller's power-on at a higher pitch.
- **First switch-on of the run:** the power-on, a green full-screen flash at 0.2 strength through the flash gate, a spark burst and `seller-power-on`.
- **Other toggles:** a small `bot-servo`.
- **Pull:** frame 1 for 0.25 s and a throttled `bot-servo`.
- **Key:** frame 2 for 0.3 s. The World already plays `key-turn`.

A tap on the arm flips the switch. While auto-spin is on, the bench's "Buy a case" and "Drag the key" hints stay quiet; they would flash every open.

**Files:**
- Create: `fx/pixel/armArt.ts`, `fx/pixel/armArt.test.ts`, `fx/stations/autoSpinRules.ts`, `fx/stations/autoSpinRules.test.ts`, `fx/stations/AutoSpinStation.ts`
- Modify: `fx/pixel/layout.ts`, `fx/pixel/layout.test.ts`, `fx/stations/Stations.ts`, `fx/labels.ts`, `fx/labels.test.ts`, `fx/World.ts` (one line)

**Interfaces:**
- Consumes: `RunState.autoSpin`, `autoSpinStatus(ctx)`, the events `autoSpinBought`, `autoSpinUpgraded`, `autoSpinToggled`, `autoSpinPulled`, `autoSpinKeyed`, and `StationDeps` (`lib`, `juice`, `controller`, `scale`).
- Produces:
  - `TableLayout.you.arm: Rect`, `ITEM_SIZE.arm = { w: 10, h: 18 }`;
  - `armPixels(frame)`, `armFrames()`, `ARM_ART`, `ARM_LAMP`;
  - `armFrame(sincePull, sinceKey)`, `lampColor(status, t)`, `armHit(r, p)`;
  - `hintKey(b, portrait?, auto?)`.

- [ ] **Step 1: Write the failing tests.**

  `fx/pixel/armArt.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { ARM_ART, ARM_LAMP, armPixels } from "./armArt";
  import { ITEM_SIZE } from "./layout";

  const at = (img: ReturnType<typeof armPixels>, x: number, y: number) => [...img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4)];
  const RED = [0xd8, 0x43, 0x3a, 255];
  const BRASS = [0xc9, 0xa2, 0x4a, 255];

  describe("auto-spin's arm, drawn in code", () => {
    it("is ITEM_SIZE.arm big, a housing with an outline, rivets and the lamp's dark window", () => {
      expect([ARM_ART.w, ARM_ART.h]).toEqual([ITEM_SIZE.arm.w, ITEM_SIZE.arm.h]);
      for (const f of [0, 1, 2] as const) {
        const img = armPixels(f);
        expect([img.w, img.h]).toEqual([ARM_ART.w, ARM_ART.h]);
        expect(at(img, 0, 17)).toEqual([0x12, 0x0e, 0x10, 255]);
        expect(at(img, 2, 15)).toEqual(BRASS);
        expect(at(img, ARM_LAMP.x, ARM_LAMP.y)).toEqual([0x07, 0x08, 0x0c, 255]);
      }
    });

    it("holds its knob up at rest, pulls it down to the left, and swings a brass arm out to the lock", () => {
      const rest = armPixels(0);
      expect(at(rest, 4, 1)).toEqual(RED);
      expect(at(rest, 0, 6)[3]).toBe(0);
      const pulled = armPixels(1);
      expect(at(pulled, 4, 1)[3]).toBe(0);
      expect(at(pulled, 2, 6)).toEqual(RED);
      const turn = armPixels(2);
      expect(at(turn, 1, 6)).toEqual(BRASS);
      expect(at(turn, 4, 1)).toEqual(RED);
    });
  });
  ```
  `fx/stations/autoSpinRules.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { ARM_PULL_SECONDS, ARM_TURN_SECONDS, armFrame, armHit, LAMP_OFF, LAMP_ON, LAMP_WAIT, lampColor } from "./autoSpinRules";

  describe("the arm's rules", () => {
    it("rests after a reload (never), pulls after a buy, swings after the key; the latest wins", () => {
      expect(armFrame(Infinity, Infinity)).toBe(0);
      expect(armFrame(0.1, Infinity)).toBe(1);
      expect(armFrame(ARM_PULL_SECONDS, Infinity)).toBe(0);
      expect(armFrame(Infinity, 0.1)).toBe(2);
      expect(armFrame(Infinity, ARM_TURN_SECONDS)).toBe(0);
      expect(armFrame(0.2, 0.05)).toBe(2);
      expect(armFrame(0.05, 0.2)).toBe(1);
    });

    it("lights its lamp from the status; BROKE blinks at 2 Hz", () => {
      expect(lampColor("on", 0)).toBe(LAMP_ON);
      expect(lampColor("off", 0)).toBe(LAMP_OFF);
      expect(lampColor("vault", 0.3)).toBe(LAMP_WAIT);
      expect(lampColor("broke", 0)).toBe(LAMP_WAIT);
      expect(lampColor("broke", 0.3)).toBe(LAMP_OFF);
      expect(lampColor("broke", 0.5)).toBe(LAMP_WAIT);
    });

    it("takes a tap on the arm or 1 px around it", () => {
      const r = { x: 10, y: 20, w: 10, h: 18 };
      expect(armHit(r, { x: 9, y: 19 })).toBe(true);
      expect(armHit(r, { x: 20.5, y: 38.5 })).toBe(true);
      expect(armHit(r, { x: 8.9, y: 25 })).toBe(false);
      expect(armHit(r, { x: 15, y: 39.1 })).toBe(false);
    });
  });
  ```
  `fx/pixel/layout.test.ts`, inside `describe.each(SIZES)`:
  ```ts
  it("bolts auto-spin's arm to the mat's right end: on the mat, clear of the case, the cards, the reels and the stations", () => {
    const a = l.you.arm;
    expect([a.w, a.h]).toEqual([ITEM_SIZE.arm.w, ITEM_SIZE.arm.h]);
    expect(inside(a, l.you.mat)).toBe(true);
    expect(overlap(a, box(l.you.caseSpot.x, l.you.caseSpot.y, 26, 34))).toBe(false); // the case sprite's frame, lid open
    for (const n of [1, 2, 3, 5]) for (const p of [...revealSpots(l, n), ...botRevealSpots(l, n)]) expect(overlap(a, cardBox(p))).toBe(false);
    for (const r of [l.you.reel, benchReelArea(l, 5, true), botReelArea(l, 2)]) if (r) expect(overlap(a, r)).toBe(false);
    for (const name of ["bot", "key", "tray", "seller", "bin", "locker"]) expect(overlap(a, items[name]!), name).toBe(false);
  });
  ```
  `fx/labels.test.ts`, in "hints at the next step…":
  ```ts
  expect(hintKey({ phase: "empty" }, false, true)).toBeNull(); // auto-spin buys and keys: no hint flashing every open
  expect(hintKey({ phase: "locked", caseId: "bootcamp", free: false, count: 1 }, false, true)).toBeNull();
  expect(hintKey({ phase: "revealed", caseId: "bootcamp", cards: [DROP] }, false, true)).toBe("hint.sell");
  ```

- [ ] **Step 2: Run the tests to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/pixel/armArt.test.ts src/modules/casecremental/fx/stations/autoSpinRules.test.ts src/modules/casecremental/fx/pixel/layout.test.ts src/modules/casecremental/fx/labels.test.ts`
  Expected: FAIL. The modules, `l.you.arm` and the third parameter are missing.

- [ ] **Step 3: The layout.** In `fx/pixel/layout.ts`:
  - Add `arm: { w: 10, h: 18 }` to `ITEM_SIZE`.
  - Add `/** Auto-spin's arm (finish spec §3): bolted to the mat's right end, clear of the case. */ arm: Rect;` to `you`.
  - Add `arm: armRect(mat),` to both branches' `you` in `baseLayout`, with:
  ```ts
  /** Auto-spin's arm stands on the mat's right end, its foot on the mat's bottom row; the mat is at least 48 px wide, so
   *  it always clears the case (26 px, centred). */
  const armRect = (mat: Rect): Rect => ({
    x: mat.x + mat.w - 1 - ITEM_SIZE.arm.w,
    y: mat.y + mat.h - ITEM_SIZE.arm.h,
    w: ITEM_SIZE.arm.w,
    h: ITEM_SIZE.arm.h,
  });
  ```

- [ ] **Step 4: The art.** Create `fx/pixel/armArt.ts`:
  ```ts
  import { Texture } from "pixi.js";
  import type { PixelImage } from "../skins/pixelSkin";

  // Auto-spin's arm, drawn in code like the reel frame (fx/pixel/drawn.ts): a gunmetal motor housing with brass rivets and
  // a lamp window, and a lever with a red knob. Frames: 0 at rest, 1 the lever pulled (it bought a case), 2 a brass arm out
  // to the lock (it turned the key). The station draws the lamp over ARM_LAMP, so its colour follows the sim.

  export const ARM_ART = { w: 10, h: 18 } as const;
  /** The lamp's window on the housing (art px). */
  export const ARM_LAMP = { x: 6, y: 12, w: 2, h: 2 } as const;

  type Rgb = readonly [number, number, number];
  const OUTLINE: Rgb = [0x12, 0x0e, 0x10];
  const METAL: Rgb = [0x3a, 0x42, 0x50];
  const METAL_LIGHT: Rgb = [0x56, 0x60, 0x70];
  const ROD: Rgb = [0x8a, 0x93, 0xa3];
  const BRASS: Rgb = [0xc9, 0xa2, 0x4a];
  const KNOB: Rgb = [0xd8, 0x43, 0x3a];
  const WINDOW: Rgb = [0x07, 0x08, 0x0c];

  export function armPixels(frame: 0 | 1 | 2): PixelImage {
    const { w, h } = ARM_ART;
    const data = new Uint8ClampedArray(w * h * 4);
    const rect = (x0: number, y0: number, x1: number, y1: number, c: Rgb) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) data.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    };
    // the housing (rows 10-17): outline, body, a lit top row, two rivets, the lamp's window
    rect(0, 10, 9, 17, OUTLINE);
    rect(1, 11, 8, 16, METAL);
    rect(1, 11, 8, 11, METAL_LIGHT);
    rect(2, 15, 2, 15, BRASS);
    rect(7, 15, 7, 15, BRASS);
    rect(ARM_LAMP.x - 1, ARM_LAMP.y - 1, ARM_LAMP.x + ARM_LAMP.w, ARM_LAMP.y + ARM_LAMP.h, OUTLINE);
    rect(ARM_LAMP.x, ARM_LAMP.y, ARM_LAMP.x + ARM_LAMP.w - 1, ARM_LAMP.y + ARM_LAMP.h - 1, WINDOW);
    if (frame === 1) {
      rect(4, 7, 5, 9, ROD); // pulled: a short rod, the knob down to the left
      rect(1, 5, 4, 7, KNOB);
    } else {
      rect(4, 3, 5, 9, ROD);
      rect(3, 0, 6, 2, KNOB);
    }
    if (frame === 2) {
      rect(0, 6, 3, 6, BRASS); // the arm out to the lock, with its gripper
      rect(0, 5, 0, 7, BRASS);
    }
    return { w, h, data };
  }

  /** The three frames as nearest-sampled textures (needs a document). */
  export function armFrames(): Texture[] {
    return ([0, 1, 2] as const).map((f) => {
      const img = armPixels(f);
      const c = document.createElement("canvas");
      c.width = img.w;
      c.height = img.h;
      const g = c.getContext("2d")!;
      const id = g.createImageData(img.w, img.h);
      id.data.set(img.data);
      g.putImageData(id, 0, 0);
      const tex = Texture.from(c);
      tex.source.scaleMode = "nearest";
      return tex;
    });
  }
  ```

- [ ] **Step 5: The rules.** Create `fx/stations/autoSpinRules.ts`:
  ```ts
  import type { AutoSpinStatus } from "../../sim/autoSpin";
  import type { Pt, Rect } from "../pixel/layout";

  // Auto-spin's arm (finish spec §3), as pure rules so a reload lands on the same picture: its frame from how long ago it
  // last bought and turned the key, its lamp from the sim's status, and where a tap switches it.

  /** How long the lever stays pulled after a buy, and the arm out after the key (seconds). */
  export const ARM_PULL_SECONDS = 0.25;
  export const ARM_TURN_SECONDS = 0.3;
  export const LAMP_ON = 0x3ddc84;
  export const LAMP_OFF = 0x5a1a1a;
  export const LAMP_WAIT = 0xffb020;

  /** The arm's frame from the seconds since its last buy and its last key turn (Infinity = not this session). */
  export function armFrame(sincePull: number, sinceKey: number): 0 | 1 | 2 {
    const pulling = sincePull < ARM_PULL_SECONDS;
    const turning = sinceKey < ARM_TURN_SECONDS;
    if (pulling && turning) return sinceKey <= sincePull ? 2 : 1;
    return turning ? 2 : pulling ? 1 : 0;
  }

  /** Green at work, dark red when off, amber waiting for the vault, amber blinking at 2 Hz when BROKE (a 2 px lamp: far
   *  under the full-screen flash rule). */
  export function lampColor(status: AutoSpinStatus, t: number): number {
    if (status === "on") return LAMP_ON;
    if (status === "off") return LAMP_OFF;
    if (status === "vault") return LAMP_WAIT;
    return Math.floor(t * 4) % 2 === 0 ? LAMP_WAIT : LAMP_OFF;
  }

  /** A tap on the arm, or 1 px around it (it is small), switches it. */
  export const armHit = (r: Rect, p: Pt): boolean => p.x >= r.x - 1 && p.y >= r.y - 1 && p.x < r.x + r.w + 1 && p.y < r.y + r.h + 1;
  ```

- [ ] **Step 6: The station.** Create `fx/stations/AutoSpinStation.ts`:
  ```ts
  import { Container, Graphics, Sprite, type Texture } from "pixi.js";
  import { autoSpinStatus } from "../../sim/autoSpin";
  import type { RunState, SimEvent } from "../../sim/run";
  import { ARM_LAMP, armFrames } from "../pixel/armArt";
  import type { Pt, TableLayout } from "../pixel/layout";
  import { Throttle } from "../throttle";
  import { armFrame, armHit, LAMP_ON, lampColor } from "./autoSpinRules";
  import type { StationDeps } from "./deps";

  // Auto-spin's arm (finish spec §3): a small motorised lever bolted to your mat's right end, drawn in code. Hidden until
  // bought; its lamp and visibility come from the sim every frame, so a reload shows it as it is. Events are only its
  // juice: the lever pulls when it buys, the arm swings when it turns the key, and the run's first switch-on is its
  // power-on (a green light, sparks, the seller's power-on sound). A tap on it flips the switch.

  /** The lamp's glow while lit (HD). */
  const LAMP_GLOW = 0.6;

  export class AutoSpinStation {
    /** The arm and its lamp (pixel world, on the table under your bench's cards). */
    readonly under = new Container();
    /** The lamp's glow (HD). */
    readonly hd = new Container();
    private readonly frames: Texture[] = armFrames();
    private readonly arm = new Sprite();
    private readonly lamp = new Graphics();
    private readonly glow: Sprite;
    private readonly servo = new Throttle(0.15);
    private l: TableLayout | null = null;
    private sincePull = Infinity;
    private sinceKey = Infinity;
    private lampColor = -1;
    private t = 0;

    constructor(private readonly d: StationDeps) {
      this.arm.texture = this.frames[0]!;
      this.glow = new Sprite({ texture: d.juice.hd.glowTexture, anchor: 0.5, blendMode: "add" });
      this.under.addChild(this.arm, this.lamp);
      this.hd.addChild(this.glow);
    }

    layout(l: TableLayout): void {
      this.l = l;
      const r = l.you.arm;
      this.arm.position.set(r.x, r.y);
      this.lamp.position.set(r.x + ARM_LAMP.x, r.y + ARM_LAMP.y);
      const k = this.d.scale();
      this.glow.position.set((r.x + ARM_LAMP.x + ARM_LAMP.w / 2) * k, (r.y + ARM_LAMP.y + ARM_LAMP.h / 2) * k);
      this.glow.width = this.glow.height = 10 * k;
    }

    update(dt: number, s: RunState): void {
      this.t += dt;
      this.sincePull += dt;
      this.sinceKey += dt;
      const owned = s.autoSpin.owned;
      this.under.visible = this.hd.visible = owned;
      if (!owned) return;
      this.arm.texture = this.frames[armFrame(this.sincePull, this.sinceKey)]!;
      const status = autoSpinStatus(this.d.controller.run);
      const color = lampColor(status, this.t);
      if (color !== this.lampColor) {
        this.lampColor = color;
        this.lamp.clear().rect(0, 0, ARM_LAMP.w, ARM_LAMP.h).fill(color);
      }
      this.glow.tint = color;
      this.glow.alpha = status === "off" ? 0 : LAMP_GLOW;
    }

    /** A tap on the arm flips its switch; true when the tap was on it. */
    tap(p: Pt, s: RunState): boolean {
      const r = this.l?.you.arm;
      if (!r || !s.autoSpin.owned || !armHit(r, p)) return false;
      this.d.controller.act({ type: "setAutoSpin", on: !s.autoSpin.on });
      return true;
    }

    onEvent(e: SimEvent): void {
      const { hd, audio } = this.d.juice;
      const k = this.d.scale();
      switch (e.type) {
        case "autoSpinBought":
          hd.particles.burst(this.screenCentre(), LAMP_ON, 16, (120 * k) / 6);
          audio.play("seller-power-on", { rate: 1.3, gain: 0.5 });
          break;
        case "autoSpinUpgraded":
          audio.play("seller-power-on", { rate: 1.3, gain: 0.5 });
          break;
        case "autoSpinToggled":
          if (e.on && e.first) {
            hd.flash(LAMP_ON, 0.2); // the machine's power-on: once a run, never after a reload
            hd.particles.burst(this.screenCentre(), LAMP_ON, 30, (180 * k) / 6);
            audio.play("seller-power-on");
          } else audio.play("bot-servo", { rate: 1.6, gain: 0.4 });
          break;
        case "autoSpinPulled":
          this.sincePull = 0;
          if (this.servo.ready(this.t)) audio.play("bot-servo", { rate: 1.4, gain: 0.5 });
          break;
        case "autoSpinKeyed":
          this.sinceKey = 0;
          break;
        case "runStarted":
          this.sincePull = this.sinceKey = Infinity;
          break;
      }
    }

    destroy(): void {
      for (const tex of this.frames) tex.destroy(true);
    }

    /** The arm's middle, screen px. */
    private screenCentre(): Pt {
      const r = this.l?.you.arm ?? { x: 0, y: 0, w: 0, h: 0 };
      return this.d.juice.hd.toScreen({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    }
  }
  ```
  Check `hd.particles.burst`, `hd.flash`, `hd.toScreen` and `glowTexture` against `LockerStation.ts` and `HdLayer.ts` before writing; the signatures above match their current use. If PixiJS 8's `Graphics` chain differs, follow `LockerStation.drawLamps`.

- [ ] **Step 7: Wire it in.**
  - `fx/stations/Stations.ts`:
    - Add a field `private readonly autoSpin: AutoSpinStation;`. In the constructor: `this.autoSpin = new AutoSpinStation(d); this.under.addChild(this.autoSpin.under); this.hd.addChild(this.autoSpin.hd);`.
    - Call `this.autoSpin.layout(l)` in `layout`, `this.autoSpin.update(dt, s)` in `update`, `this.autoSpin.onEvent(e)` in `onEvent`, and `this.autoSpin.destroy()` in `destroy`.
    - `tap` returns `this.autoSpin.tap(p, s) || this.locker.tap(p, s.locker.on)`.
    - The header lists "auto-spin's arm".
  - `fx/labels.ts`: `export function hintKey(b: Bench, portrait = false, auto = false): StringKey | null`, with `case "empty": return auto ? null : "hint.buy";` and `case "locked": return auto ? null : "hint.key";`. Add the doc line "quiet while auto-spin buys and keys for you (`auto`): it would flash every open."
  - `fx/World.ts` `updateText`: `hintKey(b, this.l.portrait, this.controller.run.state.autoSpin.on)`, one changed line. World.ts must not grow.

- [ ] **Step 8: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/fx`
  Expected: PASS. The layout sweep shows the arm clear of everything at every viewport.

- [ ] **Step 9: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/fx
  git commit -m "feat(autospin): the motorised arm by the bench - drawn in code, its lamp from the sim, pull, key swing, power-on

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 7: In the browser, then the notes

**Files:**
- Create: `docs/feature-history/casecremental-finish.md`
- Modify: `docs/feature-history/casecremental-runs-2-3.md`, `docs/feature-history/casecremental-run1.md`, `docs/feature-history/README.md`
- No product code unless a check fails. If one does, fix it in the owning task's files (with a test where one fits) and commit that fix on its own as `fix(autospin): …`.

- [ ] **Step 1: The checks pass.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build`
  Expected: PASS.

- [ ] **Step 2: Start the game.**
  Run `npm run dev` in the background (Vite, port 5180). Use the scratch harness, which mounts the scene and the panels without sign-in. It is never committed and is served by the same Vite:
  - `http://localhost:5180/.superpowers/harness/index.html?state=empty&cash=500`;
  - `&save=1` keeps a localStorage save for the reload checks;
  - `&lang=ru` for Russian.

  The harness exposes `window.cc.controller`, so `cc.controller.act({ type: "buySeller" })`, `cc.controller.devAddCash(1e6)`, `cc.controller.devStartRun(3)` and `cc.controller.run.state` drive and read the game.

  Load the browser tools in one call:
  `ToolSearch` → `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__resize_window,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__javascript_tool`.
  Check the open tabs and work in a new one.

  If no browser is connected, use headless Chrome instead. `.superpowers/harness/shot.sh <name> <WxH> "<query>"` writes screenshots to `.superpowers/harness/shots/`. For scripted steps, add a `?script=` hook to the scratch harness or drive it over CDP: Chrome with `--remote-debugging-port=9222`, then `Runtime.evaluate`. This is how M3's final pass was done. Say which way you went in the report.

- [ ] **Step 3: Machines tab, Run 1** (1920×1080). Screenshot each state:
  1. Fresh run, Upgrades → MACHINES: the auto-spin row says "Needs auto-seller", with BUY disabled.
  2. `devAddCash(1e6)`, buy the seller: the row says "Opens your cases", with BUY enabled at the cost.
  3. BUY: the row changes to "Auto-spin / Switched off / OFF" and "Delay 1.5 s" with its price. The arm appears on the mat's right end with a dark red lamp. The shelf shows the AUTO-SPIN switch at the top and a pick box on each unlocked case.

- [ ] **Step 4: The bench switch and the power-on.**
  1. Press the shelf's OFF → ON. Expected: a green flash, sparks and `seller-power-on`; the lamp turns green and glows. Screenshot just after.
  2. Switch off and on again. Expected: only a servo click, no flash.
  3. Tap the arm on the table. Expected: it switches. Reload with `&save=1`. Expected: the switch is still in its state and no power-on replays.

- [ ] **Step 5: The arm at work.** With auto-spin on and the seller on:
  1. Watch several cycles: the bench stands empty ~1.5 s, the lever pulls (frame 1), the case drops, ~0.5 s later the arm swings out (frame 2) and the key turns. The reel spins with its tease, and the seller takes the cards.
  2. Capture frames 1 and 2. Use `javascript_tool` to sample `cc.controller.run.state.bench.phase` and take a screenshot right after `caseBought` and right after `spinStarted`, or use a short GIF.
  3. Pick Wildwood on the shelf (the gold frame moves), and check that the next buy is Wildwood.
  4. Set `cc.controller.run.state.cash = 0` with an empty bench. Expected: the lamp blinks amber, the shelf says BROKE, and DAY JOB appears. Claim a tray item, and auto-spin resumes.
  5. Hold a card (drag one and keep the mouse down). Expected: it never buys under your hand.
  6. Buy Delay levels to MAX. Expected: the delay row reads 0.2 s, then MAX.

- [ ] **Step 6: The vault with auto-spin on.** Unlock every Run 1 case and add cash past the vault price. Expected: auto-spin stops buying, the shelf says "Waits: vault", the lamp is steady amber, and the vault's BUY is enabled. Buy and open the vault. Expected: the switch is disabled while the vault is out, and the next run starts with auto-spin not owned.

- [ ] **Step 7: Run 3 without the grid.**
  1. `devStartRun(3)`, then `devAddCash` a few times.
  2. The table's middle band in front of the stations is empty: no dark auto-buyer.
  3. The Machines tab lists the seller, auto-spin, the locker and the auto contract; no auto-buyer.
  4. The shelf shows seven cases, with pick boxes only once auto-spin is owned.
  5. Multi-open ×5 still opens five reels, and bot speed reaches ×50.
  6. Screenshot 1920×1080 and 1280×720.
  7. Open Vault II from Run 2 (`devStartRun(2)` → vault). The prestige list for Run 3 reads Deep Space, Inferno, auto contract, multi-open x5, bot speed x50, with no grid line.

- [ ] **Step 8: Russian and portrait.**
  1. Settings → RU. Screenshot the Machines rows (Автоспин, Нужен автопродавец / Выключен / ВКЛ / ВЫКЛ, Пауза 1,5 с) and the shelf (НА МЕЛИ, Ждёт: сейф).
  2. Resize to 390×844 and 820×1180. Expected: the arm sits on the mat clear of the case, the cards and the bot; the drawer's Cases tab holds the switch and the pick boxes.

- [ ] **Step 9: The console is clean.** Run `read_console_messages` with pattern `error|warn|casecremental`. Expected: no errors, and no `sprite "auto-buyer" not built` or missing-sound warnings.

- [ ] **Step 10: Write the notes.**
  - **Create `docs/feature-history/casecremental-finish.md`.** Start it with `# Casecremental — Finish (M4 + M5)`, a pointer to the finish spec, and a section `## F2 — auto-spin replaces the auto-buyer grid` with what the code does not show:
    - why the grid went (the user: the auto-buyer felt unconfigurable; spec §3);
    - the order of auto-spin's beats: the delay counts from the bench emptying to the buy, and a fixed 0.5 s key beat follows so the case visibly lands before the arm turns the key. The spec's two phrasings of the delay ("waits its delay, and turns the key" vs "Delay between the bench emptying and the next buy") were reconciled this way;
    - it keys any locked case, including hand-bought and Ricochet ones;
    - it stays ON when broke and buys the moment it can;
    - it holds off while the vault is affordable (otherwise it would eat the vault's cash and keep the bench busy under the vault's BUY);
    - the pick: a hand BUY or the shelf's pick box; machine buys never change it. The pick box exists because the BUY buttons are disabled while the machine keeps the bench busy;
    - the switch is on the shelf because BUY lives there; the arm takes a tap too;
    - `powered` makes the power-on once a run and reload-safe, and `clock` makes a reload resume mid-delay;
    - the arm is drawn in code (no image generation), bolted on the mat's right end because the mat is at least 48 px wide (it always clears the case);
    - save v5: the grid is dropped with no refund;
    - the greedy model: once auto-spin is on, the bench is the machine's and the player shops whenever free, and the retune that followed (`VAULT_PRICES` 1.2M / 2.4B / 800B, Neon Nights' unlock 2M, with the measured medians). F4 retunes for real players;
    - anything the browser checks turned up.
  - **Edit `docs/feature-history/casecremental-runs-2-3.md`:**
    - drop "grid" from the `RUN_CONTENT` list;
    - replace the "The grid (Run 3) buys ticked cases…" bullet block, the layout line about the grid machine, the `BOARD_IN_FRAME` bullet and the grid parts of "The visual budget" and of "What the final browser pass found" with one line: "The auto-buyer grid was removed in F2; auto-spin replaced it (see `casecremental-finish.md`)";
    - update "Vault prices are 1.2M / 2B / 420B" to point at the F2 retune.
  - **Edit `casecremental-run1.md`:** change "Later runs bring the locker and the auto-buyer grid" to "Later runs bring the locker; auto-spin (F2) arrives in late Run 1", and change its `VAULT_PRICES` aside to "see casecremental-finish.md".
  - **README:** add `- [Casecremental Finish (M4 + M5)](casecremental-finish.md) — F2: auto-spin replaces the auto-buyer grid (save v5)`, and drop "the auto-buyer grid" from the Runs 2–3 line.

- [ ] **Step 11: Commit the notes.**
  ```bash
  git add docs/feature-history
  git commit -m "docs(feature-history): F2 - auto-spin replaces the auto-buyer grid

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

## Self-review notes (spec §3 coverage)

| Spec §3 item | Covered in |
|---|---|
| Grid removed: station, rows, shelf ticks, sim, events, sounds, art, tests | Task 1 |
| Run 3 keeps ×5, bot ×50, auto contract | Task 1 Step 1 (`runBrings`) and Task 7 Step 7 |
| Unlock: Machines tab, Run 1, after the seller; "Needs auto-seller" | Tasks 2, 3, 5 |
| Later runs buy it again (machines start off); perks granting it | Fresh state per run (Task 2). Perks are left to F4, as the spec says |
| Switch on the bench beside BUY and on its Machines row; off after purchase; remembered for the run | Tasks 2, 5, 6 |
| Picked case, full width, delay, key; Quick Hands spin with its tease | Task 2 (`insertKey` gives the tease) |
| Fallback to the dearest affordable case; BROKE; the day job as today | Tasks 2, 5, 6 |
| Delay upgrade, 1.5 → 0.2 s over 5 levels, numbers in tuning | Tasks 2, 5 |
| Never builds combo | Task 2 |
| Arm that pulls and turns the key; ON/OFF lamp; first-on power-on | Task 6 |
| Save v5, the grid dropped with no refund, auto-spin fresh | Task 3 |
| The greedy player buys auto-spin like the seller and keeps it on | Task 4 |
| The agent sees and drives it | Task 3 |
