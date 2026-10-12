# Casecremental M3-D — Runs 2 and 3 on screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything Runs 2 and 3 add, drawn and playable: the bot's second reel and its pair of cards, the locker
station (lamps, counts, drag-in, the trade-up press, its result cards), the auto-buyer grid (cells that fill, flicker
open and flash, coin sparks, a stalled grid, Covert/★ breakouts), the case shelf's tick boxes and seven cases, the
Upgrades board's Run 2/3 rows, the prestige screen's "NEXT: RUN N", and the run number in the HUD — in English and
Russian, landscape and portrait.

**Architecture:** The new stations live in `fx/stations/` behind one `Stations` object that `World` composes: each
station draws itself from the sim's state every frame (so a reload or a lobby trip redraws it as it is) and plays
its own juice from the sim's events. A shared `CardStation` (built on the bench's `BenchCards`) gives the bot's pair
and the locker's results drag, tap, hold, glow and the ★ knife flight per card. `fx/pixel/layout.ts` gains the
locker's and the grid's rects and the new card spots, all checked over the existing viewport sweep. The React
panels get the new rows from the view fields Plan M3-A built. Pure rules (`*Rules.ts`) carry the logic the tests pin.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), PixiJS 8, React 19, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-m3-runs-2-3-design.md` (§2 machines dark before their
run, §4–§6, §8, §11, §13 rendering). It consumes the sim of Plan M3-A
(`docs/superpowers/plans/2026-10-12-casecremental-m3-a-sim.md`, its Interfaces blocks are the contract) and the art
and sounds of Plan M3-C. Plan M3-E draws Vaults II and III and owns the prestige screen's title and trophy line.

## Global Constraints

- **Photosensitivity (hard rule):** at most 3 full-screen flashes in any one second; any light that throbs on a beat
  changes by less than 0.1. Every full-screen flash on the table goes through `HdLayer.flash`, which this plan gates
  (Task 3). A grid cell's flash and flicker are small (one cell), not full-screen.
- Pixel sprites never scale or rotate inside the pixel world (the camera and a lifted card are the only exceptions);
  code-drawn rectangles (cells, chips) and nine-sliced frames (the reel window, the tray) are fine.
- Every input goes through `controller.act` (the single input path). The renderer never writes sim state.
- Missing art renders as the magenta placeholder and a missing sound is silent, so code never waits on assets: ask
  the sprite library with the built art's size as the fallback (`locker` 32×44 ×4, `auto-buyer` 57×32 ×2).
- English and Russian for every new player-visible string, within `i18n/budgets.ts`. Parody names only.
- A file past ~400 lines that gains a new responsibility gets split. `fx/World.ts` (529 lines) must not grow: the
  bot moves out of it in Task 4, the new stations live in `fx/stations/`.
- Leave `fx/vault/` alone (Plan M3-E's); importing `stackedReels.ts` from it is fine. Leave `sim/` and `game/` alone
  (Plan M3-A's): if a field or event this plan names is missing or shaped differently, stop and report it — do not
  patch the sim from here.
- Run 1 must look and play as before, except: the claim tray gives its right end to the (dark) locker, and the dark
  locker and the dark grid machine stand on the table.
- The grid's frame cost: no allocation per cell per frame — cells and flashes come from pools made once; sounds and
  coin sparks that a machine can fire ten times a second are throttled (`grid-buy` ≤ 4/s, `grid-open` ≤ 5/s, coin
  sparks ≤ ~7/s, machine `tray-store`/`locker-store` ≤ 4–5/s).
- Commands: `npm run typecheck`, `npx vitest run src/modules/casecremental`, `npm run build`. The pre-commit hook runs
  Prettier. Each task ends with all three green.
- Other agents commit on this branch in parallel: stage only your own files by explicit path (never `git add -A`,
  `git add .` or `commit -a`); on an `index.lock` error wait a few seconds and retry.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```
  An implementer on another model uses its own model name in the first line.

## What this plan consumes from Plan M3-A (and M3-C)

Literal in M3-A's Interfaces blocks (already landed for the bot and the locker when this plan was written):
`BotState.cards`, `BotSpin.drops`, `botWaiting`, `botSpeed`, `botSpeedLevels`; events `botSpinStarted { caseId, drops,
duration }`, `botRevealed { drops }`, `botMultiBought`, `lockerBought`, `lockerUpgraded`, `lockerStored { drop, from,
slot, byHand }`, `pressStarted`, `pressDone { results }`, `autoContractBought`, `gridBought`, `gridUpgraded`,
`gridFilled { cell, caseId }`, `gridOpened { cell, drop }`, `setCompleted { caseId }`; `LockerState`
(`on, items, sizeLevel, collect, press { rarity, inputs, results, elapsed }, cards, auto`), `lockerCounts`,
`lockerWaiting`, `GridState` (`on, cells, …`), `GridCell { caseId, t, drop }`, `gridStalled`; views `GameView.run`,
`GameView.locker: LockerView`, `GameView.grid: GridView`, `GameView.vault.id`, `CaseView.ticked`,
`UpgradeView.nextRun`, `BotView.{cards, speedNextRun, multiAvailable, multiLevel, multiCost, canBuyMulti}`,
`PrestigeView.{nextRun, replay}`; actions `sellBot { slot }`, `buyBotMulti`, `holdCard { spot: "bot" | "locker", slot }`,
`storeCard { from, slot }`, `tradeUp`, `sellLocker { slot }`, `setCollect`, `buyLocker`, `buyLockerSize`,
`buyAutoContract`, `buyGrid`, `buyGridRate`, `buyGridSize`, `setGridReserve { reserve }`, `toggleGridTick { caseId }`;
`runContent`, `runCaseIds`, `LAST_RUN`, `vaultFor`, `TRADE_UP_COUNT`, `TRADE_UP_SECONDS`, `GRID_SIZES`,
`GRID_RESERVES`, `GRID_OPEN_SECONDS`; the dev `devStartRun` / `devAddCash` buttons (Settings: RUN 2, RUN 3, +CASH).
M3-C: the eight `SOUNDS` ids (`locker-power-on`, `locker-store`, `tradeup-press`, `tradeup-reveal`, `grid-power-on`,
`grid-buy`, `grid-open`, `grid-breakout`) and the sprites `case-mainframe|neon|deepspace|inferno`, `locker`,
`auto-buyer` (all landed).

**Assumed, not spelled out in M3-A's blocks** (check each when you reach it; if one is wrong, stop and report):
1. `SimEvent "sold".from` is `CardSpot | "grid" | null` and a grid drop the auto-seller sells is
   `{ source: "seller", from: "grid", slot: cell }`; a stalled grid drop cashed in by the vault may have
   `source: "grid"`. `SimEvent "stored".from` is `CardSpot | "grid"` (a grid drop set aside in the tray).
2. A hand sale of a locker result is `sold { source: "locker", from: "locker", slot }` (true in the landed code).
3. `pressDone` fires after `locker.cards` holds the results and `locker.press` is null (true in the landed code).
4. A grid cell that has not opened has `drop: null` and `t < GRID_OPEN_SECONDS`; once open it is either emptied
   (`null`) or keeps its undelivered drop (stalled). `grid.cells.length` is the grid's current size (`gridSize`).
5. `GridView.needsSeller` means "the auto-seller is off" (the BUY row shows the hint while it is true).
6. `run.state.locker` and `run.state.grid` exist in every run (fresh, off, in Run 1), so the dark machines can be
   drawn from them.
7. `GRID_SIZES` ends with the largest size (50) and `GRID_RESERVES` is `[0.25, 0.5, 0.75]`.

## Review Focus

1. **A card dropped on the locker that refuses it** (off in Run 1, full, or the vault is out) → nothing is stored, the
   card goes back to its spot and stays sellable; a bench card is never cleared from the screen without a sim
   event. Pinned in Task 2 (`dropTarget` off → no target) and Task 5 (a refused store emits nothing).
2. **Reload or lobby trip mid-anything new** (a double bot spin, two bot cards with one sold, a press half done,
   results waiting on the locker, cells mid-open, a stalled grid) → everything is redrawn from the sim at the same
   moment; no stamp sound or breakout replays. Pinned in Task 4 (`restorePlan.botReels`), Task 5 (`pressPose` is a
   function of `elapsed`, `stampCrossed(null, …)` is quiet) and Task 6 (the board is drawn from `grid.cells`).
3. **A burst of grid drops** (Run 3 at full rate, several Coverts in a second, the vault cashing in a stalled grid) →
   one breakout at a time, none waits more than 3 s, at most 3 full-screen flashes a second, throttled sounds and
   sparks, no frame-time spike from allocation. Pinned in Task 3 (`FlashGate`, `Throttle`), Task 6 (pools made once)
   and Task 7 (`BreakoutQueue`).
4. **Small and odd screens, and Russian** (2732×2048's 138-px table, 1084×749, 820×1180 portrait, 800×450) → the
   locker, the grid, every card spot and both reel windows stay on the table and clear of each other; the shelf's
   longest names (Мейнфрейм, Сейф-кейс III) fit beside their icons. Pinned in Task 2 (layout sweep) and Task 9
   (shelf fit sweep).
5. **Holding one bot card while the auto-seller takes its partner** → the held card stays put and draggable, the
   other slot clears, the glows follow. Pinned in Task 4 (`syncPlan`).

---

## File Structure (paths relative to `src/modules/casecremental/`)

| File | Change |
|---|---|
| `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`, `i18n/i18n.test.ts` | Task 1: every new string, new budget prefixes, filled-in fit tests |
| `fx/pixel/layout.ts` (+ test) | Task 2: `TableLayout.locker`, `TableLayout.grid`, `ITEM_SIZE.locker/grid`, the tray's right end, `botRevealSpots`, `botReelArea`, `lockerCardSpots` |
| `fx/pixel/dropTargets.ts` (new, + test) | Task 2: where a dragged card lands: bin, locker or nowhere |
| `fx/pixel/Bench.ts`, `fx/pixel/Tray.ts` | Task 2: drop onto the locker → `storeCard` |
| `fx/pixel/Room.ts` | Task 2: the tray's art nine-sliced to its (narrower) rect |
| `fx/throttle.ts` (new, + test) | Task 3: `Throttle` |
| `fx/hd/flashGate.ts` (new, + test), `fx/hd/HdLayer.ts` | Task 3: at most 3 full-screen flashes a second; `glowTexture` |
| `fx/juice/spritePool.ts` (new, + test), `fx/juice/coins.ts` | Task 3: pooled coins, `Coins.spark` |
| `fx/hd/cardGlows.ts` (new, + test) | Task 3: one soft glow per station card |
| `fx/juice/bigReveal.ts` (new), `fx/benchFx.ts` | Task 3: the Covert/★ juice shared by the bench, the locker and the grid |
| `fx/stations/deps.ts` (new) | Task 4: `StationDeps` |
| `fx/pixel/CardStation.ts` (new, + test) | Task 4: a station's waiting cards (bot, locker) |
| `fx/pixel/BotReels.ts` (new) | Task 4: the bot's stacked reels |
| `fx/stations/BotStation.ts` (new), `fx/stations/Stations.ts` (new) | Task 4 (grows in 5–7) |
| `fx/restore.ts` (+ test) | Task 4: `botReels` |
| `fx/World.ts` | Task 4: the bot moves to `Stations`; Tasks 5–7: a few call sites |
| `fx/pixel/BotCard.ts` | Task 4: deleted |
| `fx/stations/lockerRules.ts` (new, + test), `fx/stations/LockerStation.ts` (new), `fx/labels.ts` (+ test) | Task 5 |
| `fx/stations/gridRules.ts` (new, + test), `fx/pixel/GridBoard.ts` (new, + test), `fx/stations/GridStation.ts` (new) | Task 6 |
| `fx/hd/breakout.ts` (new, + test) | Task 7 |
| `ui/machineRules.ts` (new, + test), `ui/BotPanel.tsx` (new), `ui/MachinesPanel.tsx` (new), `ui/LockerRows.tsx` (new), `ui/GridRows.tsx` (new), `ui/UpgradesBoard.tsx` | Task 8 |
| `ui/shelfFit.ts` (new, + test), `ui/CaseShelf.tsx`, `ui/parts.tsx` | Task 9 |
| `ui/prestigeRules.ts` (+ test), `ui/Prestige.tsx`, `ui/Hud.tsx` | Task 10 |
| `docs/feature-history/casecremental-runs-2-3.md`, `docs/feature-history/README.md` | Task 11 |

---

### Task 1: Every new string, in English and Russian

**Files:**
- Modify: `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`
- Test: `i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `caseName` (`i18n/content.ts`, knows `vault2`/`vault3` and cases 4–7 after M3-A Task 3), `CASES`.
- Produces: the keys below (later tasks use exactly these names). New budget prefixes: `cap.` 11, `locker.` 20,
  `grid.` 20, `brings.` 24, `shelf.` 20. The prestige title and trophy are **not** touched (Plan M3-E Task 7 owns them).

| key | EN | RU |
|---|---|---|
| `hud.run` | `RUN {n}` | `ЗАБЕГ {n}` |
| `cap.nextrun` | `NEXT RUN` | `СЛЕД. ЗАБЕГ` |
| `btn.tradeup` | `TRADE UP` | `ОБМЕН` |
| `bot.multi` | `Multi-open x2` | `Мультиоткрытие x2` |
| `bot.multidesc` | `Two cases a spin` | `Два кейса за спин` |
| `locker.name` | `Locker` | `Шкафчик` |
| `locker.desc` | `Keeps skins to trade` | `Копит скины на обмен` |
| `locker.count` | `Holds {n}/{max}` | `Внутри {n}/{max}` |
| `locker.size` | `Size LV {n}` | `Размер УР {n}` |
| `locker.collect` | `Collects:` | `Собирает:` |
| `locker.off` | `Off` | `Выкл.` |
| `locker.pressing` | `Pressing...` | `Прессует...` |
| `locker.auto` | `Auto contract` | `Автоконтракт` |
| `locker.autodesc` | `Presses on its own` | `Жмёт пресс сам` |
| `locker.autoon` | `ON` | `ВКЛ` |
| `grid.name` | `Auto-buyer` | `Автозакупщик` |
| `grid.desc` | `Opens ticked cases` | `Открывает отмеченные` |
| `grid.needs` | `Needs auto-seller` | `Нужен автопродавец` |
| `grid.rate` | `Rate LV {n}` | `Темп УР {n}` |
| `grid.size` | `Cells: {n}` | `Ячеек: {n}` |
| `grid.reserve` | `Keeps {n}% cash` | `Резерв {n}% денег` |
| `shelf.tick` | `Auto-buyer buys it` | `Берёт автозакупщик` |
| `float.set` | `FULL SET x2` | `НАБОР! x2` |
| `prestige.nextrun` | `NEXT: RUN {n}` | `ДАЛЕЕ: ЗАБЕГ {n}` |
| `prestige.later` | `RUN 4: IN A LATER UPDATE` | `ЗАБЕГ 4 — В ОБНОВЛЕНИИ` |
| `prestige.again` | `RUN {n} AGAIN, BOOSTED` | `СНОВА ЗАБЕГ {n}, СИЛЬНЕЕ` |
| `brings.case` | `New case: {name}` | `Новый кейс: {name}` |
| `brings.botMulti` | `Bot opens x2` | `Бот открывает x2` |
| `brings.locker` | `Locker & trade-ups` | `Шкафчик и контракты` |
| `brings.grid` | `Auto-buyer grid` | `Сетка автозакупа` |
| `brings.autoContract` | `Auto contract` | `Автоконтракт` |
| `brings.multiOpen` | `Multi-open up to x{n}` | `Мультиоткрытие до x{n}` |
| `brings.botSpeed` | `Bot speed up to x{n}` | `Скорость бота до x{n}` |

- [ ] **Step 1: Write the failing test.** The existing `it.each(Object.keys(EN))` budget test already covers every new
  key once it exists (it throws `no budget for …` on an unknown prefix). Add the filled-in checks to `i18n/i18n.test.ts`
  (add `import { CASES } from "../sim/content/cases";` and `import { caseName } from "./content";`):

```ts
describe("M3 strings with their values filled in", () => {
  const fits = (key: keyof typeof EN, vars: Record<string, string | number>) => fitsBudget(t(key, vars), budgetFor(key));

  it.each(["en", "ru"] as const)("the run lines fit with every run number and cap (%s)", (lang) => {
    setLang(lang);
    for (const n of [1, 2, 3]) for (const key of ["hud.run", "prestige.nextrun", "prestige.again"] as const) expect(fits(key, { n }), `${key} ${n}`).toBe(true);
    for (const n of [3, 5, 20, 50]) for (const key of ["brings.multiOpen", "brings.botSpeed"] as const) expect(fits(key, { n }), `${key} ${n}`).toBe(true);
    expect(fits("locker.count", { n: 50, max: 50 })).toBe(true);
    for (const n of [9, 12]) for (const key of ["locker.size", "grid.rate"] as const) expect(fits(key, { n }), key).toBe(true);
    expect(fits("grid.size", { n: 50 })).toBe(true);
    for (const n of [25, 50, 75]) expect(fits("grid.reserve", { n })).toBe(true);
  });

  it.each(["en", "ru"] as const)("every case fits the prestige screen's new-case line (%s)", (lang) => {
    setLang(lang);
    for (const c of CASES) expect(fits("brings.case", { name: caseName(c.id) }), c.id).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to see it fail.**
  Run: `npx vitest run src/modules/casecremental/i18n`
  Expected: FAIL — TypeScript/Vitest reports the unknown keys (`"hud.run"` is not a key of `EN`).

- [ ] **Step 3: Add the strings and budgets.**
  - `i18n/budgets.ts` — add to `BY_PREFIX` (anywhere; none of them is a prefix of another):
```ts
  ["cap.", 11], // a maxed button's NEXT RUN (an 11-character panel line)
  ["locker.", 20],
  ["grid.", 20],
  ["brings.", 24], // the prestige screen's "what the next run brings" lines
  ["shelf.", 20],
```
  - `i18n/en.ts` — add every EN value of the table above (group them after their neighbours: `hud.run` after
    `hud.settings`, `cap.nextrun` after `btn.max`, `btn.tradeup` after `btn.picked`, `bot.multi*` after `bot.best`,
    `locker.*` and `grid.*` after `seller.speed`, `shelf.tick` after them, `float.set` after `float.total`,
    `prestige.nextrun/later/again` after `prestige.next`, `brings.*` last).
  - `i18n/ru.ts` — the same keys with the RU values (the `Record<StringKey, string>` type makes a missing key a
    compile error).

- [ ] **Step 4: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/i18n && npm run typecheck`
  Expected: PASS. If a budget test fails, shorten that string (keep the meaning), never raise a budget.

- [ ] **Step 5: Commit.**
```bash
git add src/modules/casecremental/i18n/en.ts src/modules/casecremental/i18n/ru.ts src/modules/casecremental/i18n/budgets.ts src/modules/casecremental/i18n/i18n.test.ts
git commit -m "feat(i18n): the strings of Runs 2 and 3 on screen - locker, grid, bot multi-open, NEXT RUN, the next run's list

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 2: The layout — the locker, the grid zone, the new card spots, drop targets

**Files:**
- Modify: `fx/pixel/layout.ts`, `fx/pixel/Bench.ts`, `fx/pixel/Tray.ts`, `fx/pixel/Room.ts`
- Create: `fx/pixel/dropTargets.ts`
- Test: `fx/pixel/layout.test.ts`, `fx/pixel/dropTargets.test.ts` (new)

**Layout decisions** (world px; the numbers are 1920×1080 → world 320×180, table x 68–252):
- **Locker** `l.locker` (24×30, the built art's body is 22×30): on the front edge, its bottom level with the bin's
  (`bin.y + binR`), its right edge 3 px left of the bin's circle: `x = bin.x − binR − 3 − 24` → 199–223, y 144–174.
- **Tray** keeps its x but gives up its right end: `w = min(round(table.w × 0.46), locker.x − 2 − tray.x)` → 118–197
  (was 118–203). Its art is nine-sliced to `tray.w + 2` so it never reaches the locker or the seller.
- **Bot's pair** `botRevealSpots(l, 2)`: the first on `bot.reveal`; the second `step = clamp(table right − 1 − 22 −
  bot.reveal.x, 6, 46)` to its right (1920: +40, so 167–211 and 207–251), overlapping only on narrow tables.
- **Bot's double-reel window** `botReelArea(l, 2)`: the bot's reel window grown down to 2 px above its cards' top
  (`bot.reveal.y − 15 − 2`; 1920: y 22–53, two 14-px reels) — no card waits while it spins. `null` in portrait.
- **Locker results** `lockerCardSpots(l, n)`: centred on the locker, the card's bottom 6 px into the cabinet's top
  (sitting on the press), but never above `bot.spot.y + 1`; a pair fans 8 px apart (1920: one at (211, 135),
  a pair at 207 and 215). They may overlap the cabinet, the tray's end and the bin's rim, nothing else.
- **Grid machine** `l.grid` (54×18, the art's body 53×19): in the table's middle, in front of your mat and the bot,
  behind the tray. Its zone: y from 2 px below the lowest of the mat, the case and the bot (`max(mat bottom,
  bot.spot.y, caseSpot.y) + 2`) down to 2 px above the front row; landscape x from `table.x + 2` to 2 px left of the
  bin's circle and of the locker's results, front row = `min(seller top, locker top, tray top)`; portrait x from 2 px
  right of the seller to 2 px left of the locker and its results, front row = the tray. The machine sits centred
  between your mat and the bot, clamped into the zone, at most 4 px below the zone's top. 1920: x 129–183,
  y 122–140; 390×844 portrait: x 68–122, y 118–136; 1084×749: x 80–134, y 124–142.

**Interfaces:**
- Produces:
```ts
// fx/pixel/layout.ts
export interface TableLayout { /* … */ locker: Rect; grid: Rect; }
export const ITEM_SIZE = { /* … */ locker: { w: 24, h: 30 }, grid: { w: 54, h: 18 } } as const;
export function botRevealSpots(l: Pick<TableLayout, "bot" | "table">, n: number): Pt[];
export function botReelArea(l: Pick<TableLayout, "bot">, n: number): Rect | null;
export function lockerCardSpots(l: Pick<TableLayout, "locker" | "bot">, n: number): Pt[];
// fx/pixel/dropTargets.ts
export type DropTarget = "bin" | "locker";
export const BIN_SLOP = 8;
export const LOCKER_SLOP = 3;
export function dropTarget(l: Pick<TableLayout, "bin" | "binR" | "locker">, at: Pt, lockerOn: boolean): DropTarget | null;
```
- Consumes: `run.state.locker.on` (M3-A), `storeCard { from: "bench" | "tray", slot }`.

- [ ] **Step 1: Write the failing tests.** In `fx/pixel/layout.test.ts`:
  - change the import to
    `import { benchReelArea, botReelArea, botRevealSpots, ITEM_SIZE, lockerCardSpots, PANEL_CHROME, revealSpots, tableLayout, type Pt, type Rect } from "./layout";`
    and add `import { traySlots } from "./traySlots";`;
  - add `const cardBox = (p: Pt): Rect => ({ x: p.x - ITEM_SIZE.reveal.w / 2, y: p.y - ITEM_SIZE.reveal.h / 2, w: ITEM_SIZE.reveal.w, h: ITEM_SIZE.reveal.h });`
    under `inside`;
  - in `describe.each(SIZES)`, add `locker: l.locker,` and `grid: l.grid,` to `items` (the existing "on the table" and
    "never overlap" tests now cover them pairwise), and add these tests inside the same `describe.each`:

```ts
  it("stands the locker on the front edge, between the tray and the bin", () => {
    expect([l.locker.w, l.locker.h]).toEqual([ITEM_SIZE.locker.w, ITEM_SIZE.locker.h]);
    expect(l.locker.x).toBeGreaterThanOrEqual(l.tray.x + l.tray.w + 2);
    expect(l.locker.x + l.locker.w).toBeLessThanOrEqual(l.bin.x - l.binR - 2);
    expect(l.locker.y + l.locker.h).toBe(l.bin.y + l.binR);
  });

  it("keeps every tray slot between the seller and the locker, even at the widest capacity", () => {
    const seller = items.seller!;
    for (const capacity of [12, 18, 24])
      for (const s of traySlots(l.tray, capacity)) {
        expect(s.x).toBeGreaterThanOrEqual(seller.x + seller.w);
        expect(s.x + s.w).toBeLessThanOrEqual(l.locker.x);
      }
  });

  it("puts the grid machine in the table's middle, clear of every card spot and both reel windows", () => {
    const g = l.grid;
    expect([g.w, g.h]).toEqual([ITEM_SIZE.grid.w, ITEM_SIZE.grid.h]);
    expect(overlap(g, items.case!)).toBe(false);
    const spots = [1, 2].flatMap((n) => [...revealSpots(l, n), ...botRevealSpots(l, n), ...lockerCardSpots(l, n)]);
    for (const p of spots) expect(overlap(g, cardBox(p)), `card at ${p.x},${p.y}`).toBe(false);
    for (const r of [l.you.reel, benchReelArea(l, 2, true), botReelArea(l, 2)]) if (r) expect(overlap(g, r)).toBe(false);
  });

  it("sets the locker's results on the locker, on the table, clear of the stations and of the other cards", () => {
    const others = [1, 2].flatMap((n) => [...revealSpots(l, n), ...botRevealSpots(l, n)]).map(cardBox);
    for (const n of [1, 2])
      for (const p of lockerCardSpots(l, n)) {
        const c = cardBox(p);
        expect(c.x).toBeGreaterThanOrEqual(l.table.x);
        expect(c.x + c.w).toBeLessThanOrEqual(l.table.x + l.table.w);
        expect(overlap(c, l.locker)).toBe(true); // it sits on the cabinet
        for (const name of ["bot", "seller", "mat", "key", "case", "grid"]) expect(overlap(c, items[name]!), name).toBe(false);
        for (const o of others) expect(overlap(c, o)).toBe(false);
      }
  });

  it("gives the bot a second card to the right of its first, never past the table or onto your cards", () => {
    const [a, b] = botRevealSpots(l, 2) as [Pt, Pt];
    expect(botRevealSpots(l, 1)).toEqual([l.bot.reveal]);
    expect(a).toEqual(l.bot.reveal);
    expect(b.y).toBe(a.y);
    expect(b.x - a.x).toBeGreaterThanOrEqual(6);
    expect(b.x - a.x).toBeLessThanOrEqual(ITEM_SIZE.reveal.w + 2);
    expect(b.x + ITEM_SIZE.reveal.w / 2).toBeLessThanOrEqual(l.table.x + l.table.w - 1);
    for (const q of [...revealSpots(l, 1), ...revealSpots(l, 2)]) expect(overlap(cardBox(b), cardBox(q))).toBe(false);
  });

  it("stacks the bot's double spin above its cards' spot, clear of your cards (no reel in portrait)", () => {
    const area = botReelArea(l, 2);
    if (vp.portrait) {
      expect(area).toBeNull();
      return;
    }
    expect(botReelArea(l, 1)).toEqual(l.bot.reel);
    expect(area!.y).toBe(l.bot.reel!.y);
    expect(area!.h).toBeGreaterThanOrEqual(l.bot.reel!.h);
    expect(area!.y + area!.h).toBeLessThanOrEqual(l.bot.reveal.y - ITEM_SIZE.reveal.h / 2 - 2);
    for (const q of [...revealSpots(l, 1), ...revealSpots(l, 2)]) expect(overlap(area!, cardBox(q))).toBe(false);
  });
```

  Create `fx/pixel/dropTargets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BIN_SLOP, dropTarget } from "./dropTargets";
import { tableLayout } from "./layout";
import { pixelViewport } from "./viewport";

describe("dropTarget", () => {
  for (const [w, h] of [
    [1920, 1080],
    [390, 844],
    [1084, 749],
  ] as const) {
    const l = tableLayout(pixelViewport(w, h));
    const lockerMid = { x: l.locker.x + l.locker.w / 2, y: l.locker.y + l.locker.h / 2 };

    it(`a card let go over the bin is sold (${w}×${h})`, () => {
      expect(dropTarget(l, l.bin, true)).toBe("bin");
      expect(dropTarget(l, { x: l.bin.x, y: l.bin.y - l.binR - BIN_SLOP }, false)).toBe("bin");
    });

    it(`a card let go over the locker is stored once it is on, and goes home while it is dark (${w}×${h})`, () => {
      expect(dropTarget(l, lockerMid, true)).toBe("locker");
      expect(dropTarget(l, lockerMid, false)).toBeNull(); // Review Focus 1: Run 1's dark cabinet takes nothing
    });

    it(`where the bin's reach and the locker's meet, the nearer centre wins (${w}×${h})`, () => {
      const edge = { x: l.locker.x + l.locker.w + 1, y: lockerMid.y };
      const dBin = Math.hypot(edge.x - l.bin.x, edge.y - l.bin.y);
      const dLocker = Math.hypot(edge.x - lockerMid.x, edge.y - lockerMid.y);
      expect(dropTarget(l, edge, true)).toBe(dLocker < dBin ? "locker" : "bin");
    });

    it(`a card let go on the open table goes home (${w}×${h})`, () => {
      expect(dropTarget(l, { x: l.table.x + 2, y: l.table.y + 2 }, true)).toBeNull();
    });
  }
});
```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/pixel/layout.test.ts src/modules/casecremental/fx/pixel/dropTargets.test.ts`
  Expected: FAIL — `botReelArea` / `dropTargets` missing, `l.locker` undefined.

- [ ] **Step 3: Implement the layout.** In `fx/pixel/layout.ts`:
  - `TableLayout` gains, after `binR`:
```ts
  /** The locker's cabinet (spec §5; dark before Run 2): the front edge, between the tray and the bin. */
  locker: Rect;
  /** The auto-buyer machine (spec §6; dark before Run 3): the table's middle, in front of the stations, behind the tray. */
  grid: Rect;
```
  - `ITEM_SIZE` gains `locker: { w: 24, h: 30 },` and `grid: { w: 54, h: 18 },`.
  - Rename the current body of `tableLayout` to `function baseLayout(vp: Pick<PixelViewport, "worldW" | "worldH" | "portrait">): Base`
    with `type Base = Omit<TableLayout, "locker" | "grid">;` (its two `return { … }` objects are unchanged), and make
    `tableLayout` place the machines:
```ts
type Base = Omit<TableLayout, "locker" | "grid">;

export function tableLayout(vp: Pick<PixelViewport, "worldW" | "worldH" | "portrait">): TableLayout {
  const b = baseLayout(vp);
  const { w: lw, h: lh } = ITEM_SIZE.locker;
  const locker: Rect = { x: b.bin.x - b.binR - 3 - lw, y: b.bin.y + b.binR - lh, w: lw, h: lh };
  // the tray gives its right end to the locker (since M3)
  const tray: Rect = { ...b.tray, w: Math.min(b.tray.w, locker.x - 2 - b.tray.x) };
  const withLocker = { ...b, tray, locker };
  return { ...withLocker, grid: gridRect(withLocker) };
}

/** The auto-buyer's machine: centred between your mat and the bot, in the band in front of them and behind the
 *  front row (the seller, the tray, the locker), clear of the bin and of the locker's results. */
function gridRect(l: Omit<TableLayout, "grid">): Rect {
  const { w, h } = ITEM_SIZE.grid;
  const sellerLeft = l.seller.x - ITEM_SIZE.seller.w / 2;
  const sellerTop = l.seller.y - ITEM_SIZE.seller.h;
  const results = Math.min(...lockerCardSpots(l, 2).map((p) => p.x - ITEM_SIZE.reveal.w / 2));
  const top = Math.max(l.you.mat.y + l.you.mat.h, l.bot.spot.y, l.you.caseSpot.y) + 2;
  const zone = l.portrait
    ? { x0: sellerLeft + ITEM_SIZE.seller.w + 2, x1: Math.min(l.locker.x, results) - 2, y1: l.tray.y - 2 }
    : { x0: l.table.x + 2, x1: Math.min(l.bin.x - l.binR, results) - 2, y1: Math.min(sellerTop, l.locker.y, l.tray.y) - 2 };
  const between = Math.round((l.you.mat.x + l.you.mat.w + l.bot.spot.x - ITEM_SIZE.bot.w / 2) / 2 - w / 2);
  const x = clamp(between, zone.x0, zone.x1 - w);
  const y = top + Math.max(0, Math.min(4, Math.floor((zone.y1 - top - h) / 2)));
  return { x, y, w, h };
}
```
  - Add, after `revealSpots`:
```ts
/** Where the bot's n cards wait (spec §4): the first on bot.reveal, a second to its right — overlapping it where the
 *  table is narrow, never by more than 38 px (6 px of it always shows to grab) and never past the table's edge. */
export function botRevealSpots(l: Pick<TableLayout, "bot" | "table">, n: number): Pt[] {
  if (n <= 1) return [l.bot.reveal];
  const w = ITEM_SIZE.reveal.w;
  const room = l.table.x + l.table.w - 1 - w / 2 - l.bot.reveal.x;
  const step = Math.round(clamp(room / (n - 1), 6, w + 2));
  return Array.from({ length: n }, (_, i) => ({ x: l.bot.reveal.x + i * step, y: l.bot.reveal.y }));
}

/** The bot's reel window: its one reel, or — for a double spin — a window reaching down to just above its cards'
 *  spot (no card waits there while it spins). Null where the bot has no reel (portrait). */
export function botReelArea(l: Pick<TableLayout, "bot">, n: number): Rect | null {
  const r = l.bot.reel;
  if (!r || n <= 1) return r;
  return { ...r, h: Math.max(r.h, l.bot.reveal.y - ITEM_SIZE.reveal.h / 2 - 2 - r.y) };
}

/** Where n contract results wait (spec §5: "on the locker"): centred on the cabinet, the card's bottom 6 px into its
 *  top, but never up into the bot's station; a Contract Killer pair fans 8 px apart. */
export function lockerCardSpots(l: Pick<TableLayout, "locker" | "bot">, n: number): Pt[] {
  const { h } = ITEM_SIZE.reveal;
  const cx = l.locker.x + l.locker.w / 2;
  const y = Math.max(l.locker.y + 6 - h, l.bot.spot.y + 1) + h / 2;
  return Array.from({ length: Math.max(1, n) }, (_, i) => ({ x: cx + Math.round((i - (Math.max(1, n) - 1) / 2) * 8), y }));
}
```

- [ ] **Step 4: Implement the drop targets.** Create `fx/pixel/dropTargets.ts`:
```ts
import type { Pt, TableLayout } from "./layout";

// Where a dragged card lands when it is let go (spec §5: any waiting card — yours, the bot's, a tray item, a locker
// result — can be dropped on the SELL bin or, once it is on, the locker). Nowhere: it goes back to its spot.

export type DropTarget = "bin" | "locker";

/** How far past the bin's rim a card still drops in (world px). */
export const BIN_SLOP = 8;
/** And around the locker's cabinet. */
export const LOCKER_SLOP = 3;

/** The target under `at`: the bin, the locker (only when it is on), or null. Where both reach, the nearer centre wins. */
export function dropTarget(l: Pick<TableLayout, "bin" | "binR" | "locker">, at: Pt, lockerOn: boolean): DropTarget | null {
  const dBin = Math.hypot(at.x - l.bin.x, at.y - l.bin.y);
  const onBin = dBin <= l.binR + BIN_SLOP;
  const r = l.locker;
  const onLocker =
    lockerOn && at.x >= r.x - LOCKER_SLOP && at.x < r.x + r.w + LOCKER_SLOP && at.y >= r.y - LOCKER_SLOP && at.y < r.y + r.h + LOCKER_SLOP;
  if (onBin && onLocker) return Math.hypot(at.x - (r.x + r.w / 2), at.y - (r.y + r.h / 2)) < dBin ? "locker" : "bin";
  return onBin ? "bin" : onLocker ? "locker" : null;
}
```
  - `fx/pixel/Bench.ts`: add `import { dropTarget } from "./dropTargets";` and in `pointerUp` replace
    `if (slot !== null && dist(end.at, l.bin) <= l.binR + 8) this.controller.act({ type: "sell", slot });` with:
```ts
      if (slot !== null) {
        const target = dropTarget(l, end.at, this.controller.run.state.locker.on);
        if (target === "bin") this.controller.act({ type: "sell", slot });
        if (target === "locker") this.controller.act({ type: "storeCard", from: "bench", slot }); // the card leaves on lockerStored
      }
```
  - `fx/pixel/Tray.ts`: add `import { dropTarget } from "./dropTargets";` and in `pointerUp` replace the `onBin` lines with:
```ts
    const target = end.kind === "drop" ? dropTarget(l, end.at, this.controller.run.state.locker.on) : null;
    if (end.kind === "tap" || target === "bin") this.controller.act({ type: "claim", index });
    if (target === "locker") this.controller.act({ type: "storeCard", from: "tray", slot: index });
```
    and update the header comment ("Drag one to the SELL bin (or tap it) to claim it, or onto the locker to keep it").
  - `fx/pixel/Room.ts`: the tray becomes a nine-slice sized to its rect (the locker stands at its old right end):
    - `private readonly tray: NineSliceSprite;`
    - in the constructor:
      `this.tray = new NineSliceSprite({ texture: lib.get("tray", { w: 100, h: 18 }).frames[0]!, leftWidth: 12, topHeight: 4, rightWidth: 12, bottomHeight: 4 });`
    - in `layout`, replace the tray's `position.set(…)` with:
```ts
    // the tray's art stretches to its rect (+1 px each side): since M3 the locker stands at its right end
    this.tray.width = l.tray.w + 2;
    this.tray.position.set(l.tray.x - 1, Math.round(l.tray.y + (l.tray.h - this.tray.height) / 2));
```

- [ ] **Step 5: Run the tests and the checks.**
  Run: `npx vitest run src/modules/casecremental/fx && npm run typecheck`
  Expected: PASS. If a layout test fails at one size, print that size's rects (a scratch test, not committed), fix the
  rule in `tableLayout`/`gridRect`/`lockerCardSpots` — never drop a size from `SIZES` or loosen an assertion.

- [ ] **Step 6: Commit.**
```bash
git add src/modules/casecremental/fx/pixel/layout.ts src/modules/casecremental/fx/pixel/layout.test.ts src/modules/casecremental/fx/pixel/dropTargets.ts src/modules/casecremental/fx/pixel/dropTargets.test.ts src/modules/casecremental/fx/pixel/Bench.ts src/modules/casecremental/fx/pixel/Tray.ts src/modules/casecremental/fx/pixel/Room.ts
git commit -m "feat(layout): the locker and the grid on the table, the bot's pair, the locker's results - swept over every viewport

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 3: Effects plumbing — throttles, the flash gate, pooled coins, card glows, the shared big reveal

**Files:**
- Create: `fx/throttle.ts`, `fx/hd/flashGate.ts`, `fx/juice/spritePool.ts`, `fx/hd/cardGlows.ts`, `fx/juice/bigReveal.ts`
- Modify: `fx/hd/HdLayer.ts`, `fx/juice/coins.ts`, `fx/benchFx.ts`
- Test: `fx/throttle.test.ts`, `fx/hd/flashGate.test.ts`, `fx/juice/spritePool.test.ts`, `fx/hd/cardGlows.test.ts` (all new)

**Interfaces:**
- Produces:
```ts
// fx/throttle.ts
export class Throttle { constructor(gap: number); ready(now: number): boolean; reset(): void; }
// fx/hd/flashGate.ts
export const MAX_FLASHES_PER_SECOND = 3;
export class FlashGate { take(now: number): boolean; }
// fx/juice/spritePool.ts
export class SpritePool { constructor(texture: Texture); readonly made: number; take(): Sprite; release(s: Sprite): void; destroy(): void; }
// fx/juice/coins.ts
Coins.spark(from: Pt, to: Pt): void        // one pooled coin
// fx/hd/HdLayer.ts
HdLayer.glowTexture: Texture                // the soft radial dot (glows, flashes)
HdLayer.flash(color, strength)              // now refused past 3 a second
// fx/hd/cardGlows.ts
export class CardGlows { readonly root: Container; constructor(texture: Texture, count: number);
  set(i: number, at: Pt, color: number | null, size: number): void; update(dt: number, t: number): void; clear(): void; }
// fx/juice/bigReveal.ts
export function bigReveal(j: Juice, rarity: RarityId, zoom: boolean): void
```

- [ ] **Step 1: Write the failing tests.**

`fx/throttle.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { Throttle } from "./throttle";

describe("Throttle", () => {
  it("lets one through per gap, and starts over after a reset", () => {
    const th = new Throttle(0.25);
    expect(th.ready(0)).toBe(true);
    expect(th.ready(0.1)).toBe(false);
    expect(th.ready(0.25)).toBe(true);
    expect(th.ready(0.3)).toBe(false);
    th.reset();
    expect(th.ready(0.31)).toBe(true);
  });

  it("keeps a machine firing ten times a second to at most four sounds a second", () => {
    const th = new Throttle(0.25);
    let n = 0;
    for (let i = 0; i < 100; i++) if (th.ready(i / 10)) n++;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(41);
  });
});
```

`fx/hd/flashGate.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { FlashGate, MAX_FLASHES_PER_SECOND } from "./flashGate";

describe("FlashGate (photosensitivity: at most 3 full-screen flashes a second)", () => {
  it("lets a lone flash through", () => {
    expect(new FlashGate().take(5)).toBe(true);
  });

  it("never lets more than three start in any one second, however often they are asked for", () => {
    const g = new FlashGate();
    const starts: number[] = [];
    for (let i = 0; i < 600; i++) if (g.take(i / 60)) starts.push(i / 60); // asked every frame for 10 s
    expect(MAX_FLASHES_PER_SECOND).toBe(3);
    for (const t of starts) expect(starts.filter((u) => u >= t && u < t + 1).length).toBeLessThanOrEqual(3);
    expect(starts.length).toBeGreaterThan(20);
  });
});
```

`fx/juice/spritePool.test.ts`:
```ts
import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { SpritePool } from "./spritePool";

describe("SpritePool", () => {
  it("hands a released sprite back out instead of making a new one", () => {
    const pool = new SpritePool(new Texture({ source: new TextureSource({ width: 1, height: 1 }) }));
    const a = pool.take();
    pool.release(a);
    expect(pool.take()).toBe(a);
    pool.take();
    expect(pool.made).toBe(2);
  });
});
```

`fx/hd/cardGlows.test.ts`:
```ts
import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import { CardGlows } from "./cardGlows";

describe("CardGlows", () => {
  const tex = new Texture({ source: new TextureSource({ width: 4, height: 4 }) });

  it("fades a slot's glow in under its card and out when the card goes", () => {
    const g = new CardGlows(tex, 2);
    g.set(1, { x: 10, y: 20 }, 0xeb4b4b, 50);
    for (let i = 0; i < 60; i++) g.update(1 / 60, i / 60);
    const s = g.root.children[1]!;
    expect(s.alpha).toBeGreaterThan(0.5);
    expect([s.x, s.y]).toEqual([10, 20]);
    expect(g.root.children[0]!.alpha).toBe(0);
    g.set(1, { x: 10, y: 20 }, null, 50);
    for (let i = 0; i < 60; i++) g.update(1 / 60, 1 + i / 60);
    expect(s.alpha).toBeLessThan(0.05);
  });

  it("goes dark at once on clear (a new run)", () => {
    const g = new CardGlows(tex, 2);
    g.set(0, { x: 0, y: 0 }, 0xffd700, 50);
    g.update(1, 0);
    g.clear();
    expect(g.root.children.every((c) => c.alpha === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/throttle.test.ts src/modules/casecremental/fx/hd src/modules/casecremental/fx/juice/spritePool.test.ts`
  Expected: FAIL — the modules don't exist.

- [ ] **Step 3: Implement.**

`fx/throttle.ts`:
```ts
// A gate for an effect a machine can fire ten times a second (the grid's buys and opens, its coin sparks, a stream
// of machine stores): at most one per `gap` seconds of the clock it is given.

export class Throttle {
  private last = -Infinity;

  constructor(private readonly gap: number) {}

  /** True — and a new gap starts — when `now` is at least `gap` after the last one it let through. */
  ready(now: number): boolean {
    if (now - this.last < this.gap) return false;
    this.last = now;
    return true;
  }

  reset(): void {
    this.last = -Infinity;
  }
}
```

`fx/hd/flashGate.ts`:
```ts
// Photosensitivity is a hard rule (spec §7, M2b): at most three full-screen flashes in any one second. The table's
// full-screen flash (HdLayer.flash) asks this gate first, so a ★ on your bench, a stage-up, a station's power-on
// and a grid breakout can never stack past the limit.

export const MAX_FLASHES_PER_SECOND = 3;

export class FlashGate {
  private starts: number[] = [];

  /** True (and counted) when a flash may start at `now` (seconds). */
  take(now: number): boolean {
    this.starts = this.starts.filter((t) => now - t < 1);
    if (this.starts.length >= MAX_FLASHES_PER_SECOND) return false;
    this.starts.push(now);
    return true;
  }
}
```

`fx/juice/spritePool.ts`:
```ts
import { Sprite, type Texture } from "pixi.js";

// Sprites handed out and taken back, so an effect that fires every frame (coins, sparks) makes no garbage.

export class SpritePool {
  private readonly free: Sprite[] = [];
  private count = 0;

  constructor(private readonly texture: Texture) {}

  /** How many sprites it has ever made. */
  get made(): number {
    return this.count;
  }

  take(): Sprite {
    const s = this.free.pop();
    if (s) return s;
    this.count++;
    return new Sprite(this.texture);
  }

  release(s: Sprite): void {
    s.removeFromParent();
    this.free.push(s);
  }

  destroy(): void {
    for (const s of this.free) s.destroy();
    this.free.length = 0;
  }
}
```

`fx/juice/coins.ts` — pool the coins and add a one-coin spark:
  - add `import { SpritePool } from "./spritePool";`, a field `private readonly pool: SpritePool;` and in a new
    constructor body `this.pool = new SpritePool(frames[0]!);` (keep `private readonly frames` as a parameter property);
  - add a helper and use it in `burst` instead of `new Sprite(this.frames[0])`:
```ts
  private take(): Sprite {
    const s = this.pool.take();
    s.anchor.set(0.5);
    s.scale.set(this.pixelScale);
    s.visible = false;
    this.container.addChild(s);
    return s;
  }

  /** One coin from `from` to `to` (a machine's sale — cheap enough for ten a second). */
  spark(from: Pt, to: Pt): void {
    const k = this.pixelScale;
    this.flights.push({
      s: this.take(),
      from,
      ctrl: { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 12 * k },
      to,
      delay: 0,
      dur: 0.5,
      age: 0,
    });
  }
```
  - in `update`, replace `f.s.destroy();` with `this.pool.release(f.s);`;
  - in `destroy`, add `for (const f of this.flights) this.pool.release(f.s);` before `this.flights = [];` and
    `this.pool.destroy();` after it.

`fx/hd/HdLayer.ts`:
  - add `import { FlashGate } from "./flashGate";`, fields `readonly glowTexture: Texture;` and
    `private readonly flashGate = new FlashGate();`; in the constructor after `const soft = radial(…)`:
    `this.glowTexture = soft;`;
  - `flash` becomes:
```ts
  /** A full-screen flash that fades out (★ drops, stage-ups, power-ons). Refused past three a second (photosensitivity). */
  flash(color: number, strength = 0.8): void {
    if (!this.flashGate.take(this.t)) return;
    this.flashRect.tint = color;
    this.flashAlpha = Math.max(this.flashAlpha, strength);
  }
```

`fx/hd/cardGlows.ts`:
```ts
import { Container, Sprite, type Texture } from "pixi.js";
import type { Pt } from "../pixel/layout";

// A soft glow under each of a station's cards (the bot's pair, the locker's results), in its card's rarity colour,
// fading in and out on its own. Screen px (the HD layer). The same gentle 0.8 Hz breathing as your bench's glow.

export class CardGlows {
  readonly root = new Container();
  private readonly targets: number[] = [];

  constructor(texture: Texture, count: number) {
    for (let i = 0; i < count; i++) {
      this.root.addChild(new Sprite({ texture, anchor: 0.5, blendMode: "add", alpha: 0 }));
      this.targets.push(0);
    }
  }

  /** Slot `i` glows `color` at `at`, `size` px across — or fades out (null). */
  set(i: number, at: Pt, color: number | null, size: number): void {
    const s = this.root.children[i] as Sprite | undefined;
    if (!s) return;
    s.position.set(at.x, at.y);
    s.width = s.height = size;
    if (color !== null) s.tint = color;
    this.targets[i] = color === null ? 0 : 0.7;
  }

  update(dt: number, t: number): void {
    this.root.children.forEach((s, i) => {
      const target = this.targets[i]! * (0.85 + 0.15 * Math.sin(t * 5));
      s.alpha += (target - s.alpha) * Math.min(1, dt * 6);
    });
  }

  clear(): void {
    this.root.children.forEach((s, i) => {
      this.targets[i] = 0;
      s.alpha = 0;
    });
  }
}
```

`fx/juice/bigReveal.ts` (moved out of `BenchFx.revealed`, behaviour unchanged for the bench):
```ts
import type { RarityId } from "../../sim/types";
import type { Juice } from "./juice";

/** The once-only juice of a big card coming up — your bench's best card, a contract's result, a grid breakout:
 *  Classified shakes; Covert hits (hit-stop, impact, duck); ★ slows time and flashes. `zoom` punches the camera in —
 *  only your bench asks for it (the camera centres there). */
export function bigReveal(j: Juice, rarity: RarityId, zoom: boolean): void {
  switch (rarity) {
    case "classified":
      j.shake.add(0.2);
      break;
    case "covert":
      j.time.hitStop(0.08);
      if (zoom) j.zoom.punch(1.1, 0.15);
      j.shake.add(0.55);
      j.audio.play("covert-impact");
      j.audio.duck(1.2);
      break;
    case "gold":
      j.time.slowMo(0.2, 2.2, 0.7);
      if (zoom) j.zoom.punch(1.3, 1.8);
      j.shake.add(0.8);
      j.hd.flash(0xffd700, 0.7);
      j.audio.play("jackpot-swell");
      j.audio.duck(2.6, 0.2);
      break;
  }
}
```
  In `fx/benchFx.ts`: add `import { bigReveal } from "./juice/bigReveal";`, replace the whole `switch (best.rarity) { … }`
  at the end of `revealed` with `bigReveal(this.juice, best.rarity, true);`, and drop `shake`, `zoom`, `time` from that
  method's `const { hd, audio, shake, zoom, time } = this.juice;` if they are no longer read (keep `shake` — it is used
  for the landing shake).

- [ ] **Step 4: Run the tests and the checks.**
  Run: `npx vitest run src/modules/casecremental/fx && npm run typecheck`
  Expected: PASS (the bench's reveal tests unchanged).

- [ ] **Step 5: Commit.**
```bash
git add src/modules/casecremental/fx/throttle.ts src/modules/casecremental/fx/throttle.test.ts src/modules/casecremental/fx/hd/flashGate.ts src/modules/casecremental/fx/hd/flashGate.test.ts src/modules/casecremental/fx/juice/spritePool.ts src/modules/casecremental/fx/juice/spritePool.test.ts src/modules/casecremental/fx/hd/cardGlows.ts src/modules/casecremental/fx/hd/cardGlows.test.ts src/modules/casecremental/fx/juice/bigReveal.ts src/modules/casecremental/fx/juice/coins.ts src/modules/casecremental/fx/hd/HdLayer.ts src/modules/casecremental/fx/benchFx.ts
git commit -m "feat(fx): throttles, a 3-a-second flash gate, pooled coins and sparks, card glows, the shared big-reveal juice

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 4: The bot's second reel and its pair of cards (and `Stations`)

**Files:**
- Create: `fx/stations/deps.ts`, `fx/pixel/CardStation.ts`, `fx/pixel/BotReels.ts`, `fx/stations/BotStation.ts`,
  `fx/stations/Stations.ts`
- Modify: `fx/restore.ts`, `fx/World.ts`
- Delete: `fx/pixel/BotCard.ts`
- Test: `fx/pixel/cardStation.test.ts` (new), `fx/restore.test.ts`

**Interfaces:**
- Consumes: `botRevealSpots`, `botReelArea` (Task 2); `dropTarget` (Task 2); `CardGlows`, `HdLayer.glowTexture`
  (Task 3); `BenchCards`, `knifeSlot`, `bestSlot` (existing); `StackedReels`, `stackRects` (`fx/vault/stackedReels.ts`,
  read-only); `BotSpin`, `BotState.cards`, `sellBot { slot }`, `holdCard { spot, slot }`, `storeCard`.
- Produces:
```ts
// fx/stations/deps.ts
export interface StationDeps {
  readonly lib: SpriteLibrary; readonly skins: SkinTextures; readonly controller: GameController;
  readonly bake: (c: Container) => Texture; readonly juice: Juice; readonly reelFrame: SpriteSet; readonly rng: Rng;
  readonly scale: () => number; readonly hud: () => Pt;
}
// fx/pixel/CardStation.ts
export interface CardStationConfig { spot: "bot" | "locker"; spots: (l: TableLayout, n: number) => Pt[];
  sell: (slot: number) => Action; burst: (rarity: RarityId) => { count: number; speed: number } }
export function syncPlan(shown: readonly (number | null)[], cards: readonly (Drop | null)[]): { show: number[]; clear: number[] };
export function sameIds(shown: readonly (number | null)[], cards: readonly (Drop | null)[]): boolean;
export class CardStation { readonly root: Container; readonly hdRoot: Container;
  layout(l): void; centre(slot): Pt; update(ms, dt, cards): void; revealed(drops): void;
  pointerDown(p): boolean; pointerMove(p): void; pointerUp(p): void; lifted(): LiftInfo | null;
  cancelDrag(): void; cancelKnife(): void; clearAll(): void; destroy(): void }
// fx/pixel/BotReels.ts
export class BotReels { readonly root: StackedReels; layout(l): void; setOnline(on: boolean): void;
  start(caseId: string, skinIds: readonly string[], rng: Rng, landed?: boolean): void; update(spin: BotSpin | null): void }
// fx/restore.ts
RestorePlan.botReels: { caseId: string; skinIds: string[]; landed: boolean } | null   // replaces botReel
// fx/stations/Stations.ts
export class Stations { readonly under; readonly reels; readonly over; readonly hd: Container;
  constructor(d: StationDeps); layout(l): void; update(dt: number, ms: number, s: RunState): void;
  restore(plan: RestorePlan): void; onEvent(e: SimEvent): void; grabCard(p: Pt): boolean;
  pointerMove(p: Pt): void; pointerUp(p: Pt): void; lifted(): LiftInfo | null; cancelDrags(): void;
  cardCentre(spot: "bot" | "locker", slot: number): Pt; destroy(): void }
```

- [ ] **Step 1: Write the failing tests.**

`fx/pixel/cardStation.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { Drop } from "../../sim/types";
import { sameIds, syncPlan } from "./CardStation";

// A station's cards follow the sim slot by slot (matched by drop id), so a reload, a machine taking one card, or a
// new pair all come out right.

const d = (id: number): Drop => ({ id, caseId: "bootcamp", skinId: "bc_woodland", rarity: "milspec", float: 0.2, wear: "FT", statTrak: false, value: 1 });

describe("syncPlan", () => {
  it("shows a new pair", () => {
    expect(syncPlan([], [d(1), d(2)])).toEqual({ show: [0, 1], clear: [] });
  });

  it("clears only the slot that went, keeping a held partner (Review Focus 5)", () => {
    expect(syncPlan([1, 2], [d(1), null])).toEqual({ show: [], clear: [1] });
    expect(syncPlan([1, 2], [null, d(2)])).toEqual({ show: [], clear: [0] });
  });

  it("clears everything when the last card goes (the sim empties the list)", () => {
    expect(syncPlan([1, null], [])).toEqual({ show: [], clear: [0] });
  });

  it("swaps every slot for the next spin's pair", () => {
    expect(syncPlan([1, 2], [d(3), d(4)])).toEqual({ show: [0, 1], clear: [0, 1] });
  });

  it("does nothing when nothing changed", () => {
    expect(syncPlan([1, 2], [d(1), d(2)])).toEqual({ show: [], clear: [] });
    expect(sameIds([1, null], [d(1), null])).toBe(true);
    expect(sameIds([1], [d(1), d(2)])).toBe(false);
    expect(sameIds([], [])).toBe(true);
  });
});
```

`fx/restore.test.ts` — in "is empty for a fresh run" change `botReel: null` to `botReels: null`, and replace the
test "restores the bot's reel: …" with:
```ts
  it("restores the bot's reels: a double spin under way, or landed on its cards (a sold slot shows its partner)", () => {
    const run = new Run(1);
    const s = run.state;
    s.bot.spin = { caseId: "bootcamp", drops: [{ ...DROP, id: 7 }, { ...DROP, id: 8, skinId: "bc_desert" }], elapsed: 1, duration: 3 };
    expect(restorePlan(s).botReels).toEqual({ caseId: "bootcamp", skinIds: ["bc_woodland", "bc_desert"], landed: false });
    s.bot.spin = null;
    s.bot.cards = [null, { ...DROP, id: 9, skinId: "bc_desert" }];
    expect(restorePlan(s).botReels).toEqual({ caseId: "bootcamp", skinIds: ["bc_desert", "bc_desert"], landed: true });
    s.bot.cards = [];
    expect(restorePlan(s).botReels).toBeNull();
  });
```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/pixel/cardStation.test.ts src/modules/casecremental/fx/restore.test.ts`
  Expected: FAIL — `./CardStation` missing; `botReels` undefined.

- [ ] **Step 3: Restore plan.** In `fx/restore.ts`: rename the field and the helper —
```ts
  /** The bot's reels: its spin under way (one reel per case it opened), or — while its cards wait — stopped on each
   *  card's skin (a slot already sold shows its partner's, so the window keeps its shape). */
  botReels: { caseId: string; skinIds: string[]; landed: boolean } | null;
```
```ts
function botReels(s: RunState): RestorePlan["botReels"] {
  const { spin, cards } = s.bot;
  if (spin) return { caseId: spin.caseId, skinIds: spin.drops.map((d) => d.skinId), landed: false };
  const first = cards.find((d): d is Drop => d !== null);
  if (!first) return null;
  return { caseId: first.caseId, skinIds: cards.map((d) => (d ?? first).skinId), landed: true };
}
```
  and `botReels: botReels(s),` in `restorePlan`.

- [ ] **Step 4: The station deps and the card station.**

`fx/stations/deps.ts`:
```ts
import type { Container, Texture } from "pixi.js";
import type { GameController } from "../../game/controller";
import type { Rng } from "../../sim/rng";
import type { Juice } from "../juice/juice";
import type { Pt } from "../pixel/layout";
import type { SpriteLibrary, SpriteSet } from "../pixel/sprites";
import type { SkinTextures } from "../skins/pixelSkin";

/** What the World lends the stations. */
export interface StationDeps {
  readonly lib: SpriteLibrary;
  readonly skins: SkinTextures;
  readonly controller: GameController;
  /** Renders a container into a 1:1 nearest-sampled texture (cards). */
  readonly bake: (c: Container) => Texture;
  readonly juice: Juice;
  /** The reel window's frame (drawn in code). */
  readonly reelFrame: SpriteSet;
  /** Visual-only randomness (reel strips) — never the outcome. */
  readonly rng: Rng;
  /** The pixel scale now (it changes on resize). */
  readonly scale: () => number;
  /** Where coins fly: the HUD's cash, screen px. */
  readonly hud: () => Pt;
}
```

`fx/pixel/CardStation.ts`:
```ts
import { Container } from "pixi.js";
import type { Action } from "../../game/controller";
import { skinById } from "../../sim/content/cases";
import { RARITY_INFO } from "../../sim/rarity";
import type { Drop, RarityId } from "../../sim/types";
import { CardGlows } from "../hd/cardGlows";
import { KnifeFlight } from "../hd/knifeFlight";
import type { LiftInfo } from "../hd/Lifted";
import type { StationDeps } from "../stations/deps";
import { BenchCards, knifeSlot } from "./BenchCards";
import { DragTracker, type Grabbable } from "./drag";
import { dropTarget } from "./dropTargets";
import { ITEM_SIZE, type Pt, type TableLayout } from "./layout";

// A station's waiting cards (spec §4–§5: the bot's pair, the locker's contract results): side by side at their spots,
// each dragged to the SELL bin or the locker, or tapped to sell — hand actions, so they feed the combo — or left for
// the auto-seller. They follow the sim every frame (a reload redraws them); the reveal juice — sparks, a glow per
// card, the ★ knife's showcase — comes from the station's events.

export interface CardStationConfig {
  spot: "bot" | "locker";
  /** Where n cards sit (layout.ts). */
  spots: (l: TableLayout, n: number) => Pt[];
  /** The hand sale of one card. */
  sell: (slot: number) => Action;
  /** Sparks per card as it comes up. */
  burst: (rarity: RarityId) => { count: number; speed: number };
}

/** Glows: one per slot (a pair at most — a contract's Contract Killer double, the bot's ×2). */
const SLOTS = 2;

/** The slots on screen still match the sim's cards (by drop id). Allocates nothing: it runs every frame. */
export function sameIds(shown: readonly (number | null)[], cards: readonly (Drop | null)[]): boolean {
  if (shown.length !== cards.length) return false;
  for (let i = 0; i < cards.length; i++) if ((cards[i]?.id ?? null) !== shown[i]) return false;
  return true;
}

/** The slots to clear and to show so the cards on screen match the sim's. */
export function syncPlan(shown: readonly (number | null)[], cards: readonly (Drop | null)[]): { show: number[]; clear: number[] } {
  const show: number[] = [];
  const clear: number[] = [];
  for (let i = 0; i < Math.max(shown.length, cards.length); i++) {
    const want = cards[i]?.id ?? null;
    const have = shown[i] ?? null;
    if (want === have) continue;
    if (have !== null) clear.push(i);
    if (want !== null) show.push(i);
  }
  return { show, clear };
}

/** A drag id `bot:1` → slot 1. */
const slotOf = (id: string | null): number | null => (id === null ? null : Number(id.slice(id.indexOf(":") + 1)));

export class CardStation {
  readonly root: Container;
  /** Its glows and its knife's showcase (HD layer, screen px). */
  readonly hdRoot = new Container();
  private readonly cards: BenchCards;
  private readonly glows: CardGlows;
  private readonly knife: KnifeFlight;
  private readonly drag = new DragTracker();
  private shown: (number | null)[] = [];
  private last: readonly (Drop | null)[] = [];
  private l: TableLayout | null = null;
  private placedN = 0;
  private t = 0;

  constructor(
    private readonly cfg: CardStationConfig,
    private readonly d: StationDeps,
  ) {
    this.cards = new BenchCards(d.skins, d.bake);
    this.root = this.cards.root;
    this.glows = new CardGlows(d.juice.hd.glowTexture, SLOTS);
    this.hdRoot.addChild(this.glows.root);
    this.knife = new KnifeFlight(this.hdRoot);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.cancelKnife(); // the screen changed: a knife in the air goes straight back
    this.placedN = 0;
    this.place(Math.max(1, this.shown.length));
    this.refreshGlows();
  }

  /** World centre of one card (coins and sparks start here). */
  centre(slot: number): Pt {
    return this.cards.centre(slot);
  }

  /** Follow the sim: new cards appear (no juice — a reload, a quiet arrival), gone ones clear. */
  update(ms: number, dt: number, cards: readonly (Drop | null)[]): void {
    this.t += dt;
    this.knife.update(dt);
    this.sync(cards);
    this.cards.update(ms, slotOf(this.drag.dragging));
    this.glows.update(dt, this.t);
  }

  /** Cards just came up (the bot's reels landed, a contract's results popped): sparks per card, the ★ knife. */
  revealed(drops: readonly Drop[]): void {
    this.sync(drops);
    const hd = this.d.juice.hd;
    drops.forEach((drop, i) => {
      const b = this.cfg.burst(drop.rarity);
      hd.particles.burst(hd.toScreen(this.centre(i)), RARITY_INFO[drop.rarity].color, b.count, b.speed);
    });
    const k = knifeSlot(drops, (x) => skinById(x.skinId).motion?.weapon === "flip");
    if (k !== null) this.launchKnife(k, drops[k]!);
  }

  pointerDown(p: Pt): boolean {
    const items: Grabbable[] = [];
    // where cards overlap, the one drawn on top (the later slot) is grabbed first; a ★ is not, while its knife is out
    for (const slot of this.cards.waiting().reverse())
      if (this.cards.knifeOut !== slot) items.push({ id: `${this.cfg.spot}:${slot}`, rect: this.cards.rect(slot) });
    const slot = slotOf(this.drag.down(p, items));
    if (slot === null) return false;
    this.d.controller.act({ type: "holdCard", spot: this.cfg.spot, slot }); // the auto-seller leaves it be
    return true;
  }

  pointerMove(p: Pt): void {
    this.drag.move(p);
  }

  pointerUp(p: Pt): void {
    const slot = slotOf(this.drag.dragging);
    if (slot === null) return;
    const end = this.drag.up(p);
    const c = this.d.controller;
    if (end.kind === "tap") c.act(this.cfg.sell(slot));
    if (end.kind === "drop" && this.l) {
      const target = dropTarget(this.l, end.at, c.run.state.locker.on);
      if (target === "bin") c.act(this.cfg.sell(slot));
      if (target === "locker") c.act({ type: "storeCard", from: this.cfg.spot, slot });
    }
    c.act({ type: "holdCard", spot: null });
  }

  /** The card being dragged, for the HD layer to draw lifted. */
  lifted(): LiftInfo | null {
    const p = this.drag.exactPosition;
    const id = this.drag.dragging;
    const slot = slotOf(id);
    const texture = slot === null ? null : this.cards.texture(slot);
    if (!p || !id || !texture) return null;
    const { w, h } = ITEM_SIZE.reveal;
    return { id, texture, center: { x: p.x + w / 2, y: p.y + h / 2 } };
  }

  /** The viewport changed under a drag (or the vault slammed in): the card goes home and nothing fires. */
  cancelDrag(): void {
    if (this.drag.dragging) this.d.controller.act({ type: "holdCard", spot: null });
    this.drag.cancel();
  }

  cancelKnife(): void {
    if (!this.knife.flying) return;
    this.knife.cancel();
    this.cards.endKnifeFlight();
  }

  /** Every card leaves at once (a new run). */
  clearAll(): void {
    this.cancelKnife();
    this.drag.cancel();
    this.cards.clearAll();
    this.shown = [];
    this.last = [];
    this.glows.clear();
  }

  destroy(): void {
    this.cards.destroy();
  }

  private sync(cards: readonly (Drop | null)[]): void {
    this.last = cards;
    if (sameIds(this.shown, cards)) return;
    if (cards.length) this.place(cards.length);
    const { show, clear } = syncPlan(this.shown, cards);
    const held = slotOf(this.drag.dragging);
    for (const i of clear) {
      if (this.cards.knifeOut === i) this.cancelKnife();
      if (held === i) this.drag.cancel(); // the sim took it (the vault's cash-in): nothing to drop
      this.cards.clear(i);
    }
    for (const i of show) this.cards.show(i, skinById(cards[i]!.skinId), cards[i]!);
    this.shown = cards.map((x) => x?.id ?? null);
    this.refreshGlows();
  }

  private place(n: number): void {
    if (!this.l || n === this.placedN) return;
    this.placedN = n;
    this.cards.layout(this.cfg.spots(this.l, n));
  }

  private refreshGlows(): void {
    const hd = this.d.juice.hd;
    const size = 50 * this.d.scale();
    for (let i = 0; i < SLOTS; i++) {
      const drop = this.last[i] ?? null;
      this.glows.set(i, hd.toScreen(this.centre(i)), drop ? RARITY_INFO[drop.rarity].color : null, size);
    }
  }

  /** The ★ knife's b-roll shot out of its card and back (as on your bench). */
  private launchKnife(slot: number, drop: Drop): void {
    const { hd, shake, audio } = this.d.juice;
    const at = hd.toScreen(this.centre(slot));
    this.cards.beginKnifeFlight(slot);
    this.knife.start(this.d.skins.frames(skinById(drop.skinId))[0]!, at, this.d.scale(), () => {
      this.cards.endKnifeFlight();
      shake.add(0.3);
      audio.play("coin-clink", { rate: 0.75 });
      hd.particles.burst(at, 0xffd700, 50, (260 * this.d.scale()) / 6);
    });
  }
}
```

- [ ] **Step 5: The bot's reels and its station.**

`fx/pixel/BotReels.ts`:
```ts
import type { BotSpin } from "../../sim/botOpener";
import { caseById, skinById } from "../../sim/content/cases";
import type { Rng } from "../../sim/rng";
import type { SkinTextures } from "../skins/pixelSkin";
import { StackedReels, stackRects } from "../vault/stackedReels";
import { botReelArea, type TableLayout } from "./layout";
import type { SpriteSet } from "./sprites";

// The bot's reel window (spec §4): one reel, or — for a double spin (Run 2+) — two stacked in a window that reaches
// down to just above its cards' spot. Every reel lands with the spin (the bot never teases). None in portrait.

/** The tallest one reel gets in the bot's stack. */
const REEL_MAX_H = 26;
/** A reel shown already stopped (a reload while its cards wait). */
const LANDED = { elapsed: 1, fullDuration: 1, crawl: 0 };

export class BotReels {
  readonly root: StackedReels;
  private l: TableLayout | null = null;
  private n = 1;
  private online = false;
  /** Ticks are muted while a reload sets the reels straight onto their drops. */
  private quiet = false;

  constructor(frameSet: SpriteSet, skins: SkinTextures, onTick: (i: number) => void) {
    this.root = new StackedReels(frameSet, skins, (i) => {
      if (!this.quiet) onTick(i);
    });
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.apply();
  }

  /** The reels show once the bot is awake (and there is a window for them). */
  setOnline(on: boolean): void {
    if (on === this.online) return;
    this.online = on;
    this.apply();
  }

  /** A new spin (or a reload): one reel per case, each landing on its skin; `landed`: already stopped there. */
  start(caseId: string, skinIds: readonly string[], rng: Rng, landed = false): void {
    const n = Math.max(1, skinIds.length);
    if (n !== this.n) {
      this.n = n;
      this.apply();
    }
    const c = caseById(caseId);
    skinIds.forEach((id, i) => this.root.start(i, c, skinById(id), rng));
    if (!landed) return;
    this.quiet = true;
    skinIds.forEach((_, i) => this.root.update(i, LANDED));
    this.quiet = false;
  }

  update(spin: BotSpin | null): void {
    if (!spin) return;
    for (let i = 0; i < this.n; i++) this.root.update(i, { elapsed: spin.elapsed, fullDuration: spin.duration, crawl: 0 });
  }

  private apply(): void {
    const area = this.l ? botReelArea(this.l, this.n) : null;
    this.root.visible = this.online && !!area;
    if (area) this.root.layout(stackRects(area, this.n, REEL_MAX_H));
  }
}
```

`fx/stations/BotStation.ts`:
```ts
import { caseById } from "../../sim/content/cases";
import { RARITY_ORDER } from "../../sim/rarity";
import type { RunState, SimEvent } from "../../sim/run";
import { bestSlot } from "../pixel/BenchCards";
import { BotReels } from "../pixel/BotReels";
import { BotSprite } from "../pixel/BotSprite";
import { CardStation } from "../pixel/CardStation";
import { botRevealSpots, type TableLayout } from "../pixel/layout";
import type { RestorePlan } from "../restore";
import type { StationDeps } from "./deps";

// The bot's station (spec §4): its reel window (two stacked reels for a double spin), the bot hopping as it opens, and
// its cards side by side — each sold by hand (drag or tap: the combo) or left for the auto-seller.

export class BotStation {
  readonly sprite: BotSprite;
  readonly reels: BotReels;
  readonly cards: CardStation;

  constructor(private readonly d: StationDeps) {
    this.sprite = new BotSprite(d.lib);
    // its second reel ticks more quietly, so a double spin never sounds like a doubled click
    this.reels = new BotReels(d.reelFrame, d.skins, (i) => d.juice.audio.play("reel-tick", { gain: i === 0 ? 0.35 : 0.18, rate: 1.2 }));
    this.cards = new CardStation(
      {
        spot: "bot",
        spots: botRevealSpots,
        sell: (slot) => ({ type: "sellBot", slot }),
        burst: () => ({ count: 18, speed: (160 * d.scale()) / 6 }),
      },
      d,
    );
  }

  layout(l: TableLayout): void {
    this.sprite.layout(l);
    this.reels.layout(l);
    this.cards.layout(l);
  }

  update(dt: number, ms: number, s: RunState): void {
    this.sprite.update(ms, s.bot);
    this.reels.setOnline(s.bot.awake);
    this.reels.update(s.bot.spin);
    this.cards.update(ms, dt, s.bot.cards);
  }

  /** A fresh World or a new run: its reels where the sim is, or one idle Boot Camp reel. */
  restore(plan: RestorePlan): void {
    const r = plan.botReels;
    if (r) return this.reels.start(r.caseId, r.skinIds, this.d.rng, r.landed);
    const first = caseById("bootcamp");
    this.reels.start(first.id, [this.d.rng.pick(first.skins).id], this.d.rng);
  }

  onEvent(e: SimEvent): void {
    const { hd, audio } = this.d.juice;
    switch (e.type) {
      case "botWoke":
        this.sprite.wake();
        hd.flash(0xffd28a, 0.15); // the station's lamp flickers on
        audio.play("bot-wake");
        break;
      case "botUpgraded":
        audio.play("bot-servo", { rate: 1.2 });
        break;
      case "botMultiBought":
        audio.play("bot-servo", { rate: 0.9 });
        audio.play("seller-power-on", { rate: 1.3, gain: 0.5 });
        break;
      case "botSpinStarted":
        this.sprite.open();
        this.reels.start(e.caseId, e.drops.map((x) => x.skinId), this.d.rng);
        audio.play("bot-reel-spin");
        break;
      case "botRevealed": {
        this.cards.revealed(e.drops);
        const best = e.drops[bestSlot(e.drops) ?? 0];
        if (best) audio.play("reveal-chime", { gain: 0.5, rate: 2 ** (RARITY_ORDER.indexOf(best.rarity) / 6) });
        break;
      }
    }
  }
}
```

`fx/stations/Stations.ts`:
```ts
import { Container } from "pixi.js";
import type { RunState, SimEvent } from "../../sim/run";
import type { LiftInfo } from "../hd/Lifted";
import type { Pt, TableLayout } from "../pixel/layout";
import type { RestorePlan } from "../restore";
import { BotStation } from "./BotStation";
import type { StationDeps } from "./deps";

// The stations beside your bench (M3: the bot's pair, the locker, the auto-buyer grid): drawn from the sim every
// frame, so a reload or a lobby trip redraws them as they are, each with its own event juice. The World owns your
// bench, the room and the camera, and asks the stations about their cards and sales.

export class Stations {
  /** Pixel world, just over the table and under the tray: the grid machine, the locker's cabinet. */
  readonly under = new Container();
  /** Pixel world, the reel row: the bot's reels. */
  readonly reels = new Container();
  /** Pixel world, over your bench: the bot, its cards, the locker's results. */
  readonly over = new Container();
  /** HD layer: glows, lamps and counts, flashes, knives, breakouts. */
  readonly hd = new Container();
  private readonly bot: BotStation;

  constructor(d: StationDeps) {
    this.bot = new BotStation(d);
    this.reels.addChild(this.bot.reels.root);
    this.over.addChild(this.bot.sprite.root, this.bot.cards.root);
    this.hd.addChild(this.bot.cards.hdRoot);
  }

  layout(l: TableLayout): void {
    this.bot.layout(l);
  }

  update(dt: number, ms: number, s: RunState): void {
    this.bot.update(dt, ms, s);
  }

  /** A fresh World (a reload, a lobby trip) or a new run: redraw what the sim holds. */
  restore(plan: RestorePlan): void {
    this.bot.restore(plan);
  }

  onEvent(e: SimEvent): void {
    if (e.type === "runStarted") this.clearAll();
    if (e.type === "vaultBought") this.cancelDrags();
    this.bot.onEvent(e);
  }

  /** Pick up a waiting card under the pointer (the locker's results first: they sit over the tray's end). */
  grabCard(p: Pt): boolean {
    return this.bot.cards.pointerDown(p);
  }

  pointerMove(p: Pt): void {
    this.bot.cards.pointerMove(p);
  }

  pointerUp(p: Pt): void {
    this.bot.cards.pointerUp(p);
  }

  lifted(): LiftInfo | null {
    return this.bot.cards.lifted();
  }

  /** Every drag goes home and every knife lands at once (a resize, the vault, a lobby trip). */
  cancelDrags(): void {
    this.bot.cards.cancelDrag();
    this.bot.cards.cancelKnife();
  }

  /** Where a station's card is (coins start there). */
  cardCentre(_spot: "bot" | "locker", slot: number): Pt {
    return this.bot.cards.centre(slot);
  }

  destroy(): void {
    this.bot.cards.destroy();
  }

  private clearAll(): void {
    this.bot.cards.clearAll();
  }
}
```

- [ ] **Step 6: Wire the World.** In `fx/World.ts`:
  - imports: remove `BotCardView`, `BotSprite` and `Reel`; add `import { Stations } from "./stations/Stations";`; remove
    `skinById` and `RARITY_ORDER` if nothing else uses them any more.
  - fields: remove `bot`, `botReel`, `botCard`; add `private readonly stations: Stations;`.
  - constructor: delete the `this.botReel = new Reel(…)`, `this.bot = new BotSprite(lib)` and
    `this.botCard = new BotCardView(…)` lines; right after `this.benchFx = new BenchFx(…)` add:
```ts
    this.stations = new Stations({
      lib,
      skins,
      controller,
      bake,
      juice,
      reelFrame: this.reelFrame,
      rng: this.rng,
      scale: () => this.vp.scale,
      hud: () => ({ x: this.screen.w / 2, y: (this.l.hudH / 2) * this.vp.scale }),
    });
```
    and change the two `addChild` lists to
```ts
    this.pixel.world.addChild(
      this.room.back,
      this.room.front,
      this.stations.under,
      this.tray.root,
      this.benchReels.root,
      this.stations.reels,
      this.bench.root,
      this.stations.over,
    );
    this.hd.root.addChild(this.hint, ...this.label, this.offline, this.trayFullLabel, this.stations.hd, this.lifted.root);
```
    In the move/up listeners replace `this.botCard.pointerMove(p)` / `this.botCard.pointerUp(p)` with
    `this.stations.pointerMove(p)` / `this.stations.pointerUp(p)`. Delete the line
    `this.botReel.start(first, this.rng.pick(first.skins), this.rng);` (the stations' `restore` does it).
  - `restore()`: replace the two `br` lines with `this.stations.restore(plan);`.
  - `update()`: replace the block from `const bot = run.state.bot;` to `this.hd.setBotAsleep(!bot.awake);` with:
```ts
    const bot = run.state.bot;
    this.stations.update(realSeconds, gameMs, run.state);
    this.room.setBotOnline(bot.awake);
    this.offline.visible = !!this.l.bot.reel && !bot.awake;
    this.hd.setBotAsleep(!bot.awake);
```
    and `this.lifted.update(this.tray.lifted() ?? this.stations.lifted() ?? this.bench.lifted(), k, realSeconds);`.
  - `destroy()`: `this.botCard.destroy();` → `this.stations.destroy();`.
  - `pointerDown()`: the last line becomes
    `if (!this.stations.grabCard(p) && !this.tray.pointerDown(p)) void this.bench.pointerDown(p);`.
  - `updateVault()`: `this.botReel.tint = reels;` → `this.stations.reels.tint = reels;`.
  - `cancelDrags()`: `for (const d of [this.bench, this.tray]) d.cancelDrag();` then `this.stations.cancelDrags();`.
  - `applyLayout()`: replace `this.bot.layout(this.l);`, `if (this.l.bot.reel) this.botReel.layout(…)` and
    `this.botCard.layout(this.l);` with `this.stations.layout(this.l);`.
  - `onEvent()`: first line of the method `this.stations.onEvent(e);`; delete the cases `botWoke`, `botUpgraded`,
    `botSpinStarted` and `botRevealed`; in `case "sold"` replace `this.botCard.centre()` with
    `this.stations.cardCentre("bot", e.slot)`.
  - Delete `fx/pixel/BotCard.ts` (`git rm`).

- [ ] **Step 7: Run the tests and the checks.**
  Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build && wc -l src/modules/casecremental/fx/World.ts`
  Expected: PASS; `World.ts` shorter than before (≈ 500 lines).

- [ ] **Step 8: Commit.**
```bash
git rm src/modules/casecremental/fx/pixel/BotCard.ts
git add src/modules/casecremental/fx/stations/deps.ts src/modules/casecremental/fx/stations/Stations.ts src/modules/casecremental/fx/stations/BotStation.ts src/modules/casecremental/fx/pixel/CardStation.ts src/modules/casecremental/fx/pixel/cardStation.test.ts src/modules/casecremental/fx/pixel/BotReels.ts src/modules/casecremental/fx/restore.ts src/modules/casecremental/fx/restore.test.ts src/modules/casecremental/fx/World.ts
git commit -m "feat(bot): the bot's second reel and its pair of cards - stacked reels, drag, hold, glow and knife per card, restore

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 5: The locker station — cabinet, lamps and counts, drag-in, the press, its results

**Files:**
- Create: `fx/stations/lockerRules.ts`, `fx/stations/LockerStation.ts`
- Modify: `fx/stations/Stations.ts`, `fx/World.ts`, `fx/labels.ts`
- Test: `fx/stations/lockerRules.test.ts` (new), `fx/labels.test.ts`

**Interfaces:**
- Consumes: `l.locker`, `lockerCardSpots` (Task 2); `CardStation` (Task 4); `bigReveal`, `Throttle` (Task 3);
  `LockerState`, `lockerCounts`, `lockerWaiting` (`sim/locker.ts`); events `lockerBought`, `lockerUpgraded`,
  `lockerStored`, `pressDone`, `autoContractBought`; actions `tradeUp`, `sellLocker { slot }`, `storeCard`;
  `TRADE_UP_COUNT`, `TRADE_UP_SECONDS`; sprite `locker` (frames: 0 dark, 1 lit, 2 press down, 3 door open).
- Produces:
```ts
// fx/stations/lockerRules.ts
export const DOOR_OPEN_SECONDS = 0.35;
export const POWER_LAMP_STEP = 0.1;
export const PRESS: { readonly flyIn: 0.9; readonly chipFlight: 0.45; readonly stampAt: 1.0; readonly liftAt: 1.6 };
export const pressStamped: (elapsed: number) => boolean;
export function lockerFrame(on: boolean, pressElapsed: number | null, doorLeft: number): 0 | 1 | 2 | 3;
export function chipProgress(i: number, count: number, elapsed: number): number;
export const stampCrossed: (from: number | null, to: number) => boolean;
export function lampRows(r: Rect): Array<{ lamp: Pt; text: Pt }>;
export const lampFontSize: (scale: number) => number;
// Stations: tap(p: Pt): boolean; cardCentre handles "locker"
// fx/labels.ts: binCalling(state: { bench; bot: Pick<…, "cards">; locker: Pick<LockerState, "cards"> }): boolean
```

- [ ] **Step 1: Write the failing tests.** `fx/stations/lockerRules.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { GameController } from "../../game/controller";
import type { SimEvent } from "../../sim/run";
import { lockerCapacity } from "../../sim/locker";
import { TRADE_UP_SECONDS } from "../../sim/tuning";
import type { Drop } from "../../sim/types";
import { ITEM_SIZE } from "../pixel/layout";
import { chipProgress, lampFontSize, lampRows, lockerFrame, PRESS, stampCrossed } from "./lockerRules";

const drop = (id: number): Drop => ({ id, caseId: "bootcamp", skinId: "bc_woodland", rarity: "milspec", float: 0.2, wear: "FT", statTrak: false, value: 1 });

describe("the locker's cabinet", () => {
  it("is dark until bought, stamps while pressing, opens its door just after a store, else glows", () => {
    expect(lockerFrame(false, null, 0)).toBe(0);
    expect(lockerFrame(false, PRESS.stampAt, 0.2)).toBe(0);
    expect(lockerFrame(true, null, 0)).toBe(1);
    expect(lockerFrame(true, null, 0.1)).toBe(3);
    expect(lockerFrame(true, PRESS.stampAt, 0)).toBe(2);
    expect(lockerFrame(true, PRESS.stampAt, 0.2)).toBe(2); // the stamp beats the door
    expect(lockerFrame(true, PRESS.liftAt, 0)).toBe(1);
    expect(lockerFrame(true, 0.2, 0)).toBe(1);
  });

  it("flies the ten cards in one after another before the stamp, and lifts the press before the result pops", () => {
    expect(chipProgress(0, 10, 0)).toBe(0);
    expect(chipProgress(0, 10, PRESS.chipFlight)).toBe(1);
    expect(chipProgress(9, 10, PRESS.flyIn)).toBe(1);
    expect(chipProgress(9, 10, PRESS.flyIn - 0.01)).toBeLessThan(1);
    for (let i = 1; i < 10; i++) expect(chipProgress(i, 10, 0.3)).toBeLessThanOrEqual(chipProgress(i - 1, 10, 0.3));
    expect(PRESS.flyIn).toBeLessThanOrEqual(PRESS.stampAt);
    expect(PRESS.liftAt).toBeLessThan(TRADE_UP_SECONDS);
  });

  it("stamps once; a reload past the stamp stays quiet (Review Focus 2)", () => {
    expect(stampCrossed(0.9, 1.05)).toBe(true);
    expect(stampCrossed(1.05, 1.1)).toBe(false);
    expect(stampCrossed(null, 1.05)).toBe(false);
    expect(stampCrossed(0.9, -1)).toBe(false);
  });

  it("lays five lamp rows down the cabinet's face, Mil-Spec at the top", () => {
    const r = { x: 100, y: 50, w: ITEM_SIZE.locker.w, h: ITEM_SIZE.locker.h };
    const rows = lampRows(r);
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.lamp.x).toBeGreaterThan(r.x);
      expect(row.text.x).toBeGreaterThan(row.lamp.x);
      expect(row.lamp.y).toBeGreaterThan(r.y);
      expect(row.lamp.y).toBeLessThan(r.y + r.h);
      expect(row.text.y).toBe(row.lamp.y);
    }
    for (let i = 1; i < 5; i++) expect(rows[i]!.lamp.y).toBeGreaterThan(rows[i - 1]!.lamp.y);
  });

  it.each([2, 3, 4, 5, 6, 8, 10])("sizes the counts to one lamp row and the cabinet's width at scale %i", (k) => {
    const fs = lampFontSize(k);
    expect(fs % 8).toBe(0);
    const rowH = Math.floor((ITEM_SIZE.locker.h - 2) / 5);
    expect(fs / k).toBeLessThanOrEqual(rowH - 1); // a line's height, world px
    const r = { x: 0, y: 0, w: ITEM_SIZE.locker.w, h: ITEM_SIZE.locker.h };
    expect(lampRows(r)[0]!.text.x + 2 * (fs / k)).toBeLessThanOrEqual(r.w); // "50" fits after the lamp
  });
});

describe("a store the locker refuses (Review Focus 1)", () => {
  it("emits nothing, so the card stays where it was", () => {
    const c = new GameController(3);
    c.devStartRun(2);
    c.devAddCash(1e9);
    expect(c.act({ type: "buyLocker" }).ok).toBe(true);
    c.run.state.locker.items.push(...Array.from({ length: lockerCapacity(0) }, (_, i) => drop(100 + i)));
    c.run.state.tray.push(drop(1));
    const events: SimEvent[] = [];
    c.onEvent((e) => events.push(e));
    expect(c.act({ type: "storeCard", from: "tray", slot: 0 }).ok).toBe(false);
    expect(events.some((e) => e.type === "lockerStored")).toBe(false);
    expect(c.run.state.tray.map((d) => d.id)).toEqual([1]);
  });
});
```
  In `fx/labels.test.ts`'s `binCalling` test: add `locker: { cards: [] }` to each existing call and add
  `expect(binCalling({ bench: empty, bot: { cards: [] }, locker: { cards: [null, DROP] } })).toBe(true);`.

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/stations src/modules/casecremental/fx/labels.test.ts`
  Expected: FAIL — `./lockerRules` missing; `binCalling` ignores the locker.

- [ ] **Step 3: The rules.** `fx/stations/lockerRules.ts`:
```ts
import type { Pt, Rect } from "../pixel/layout";

// The locker's look, as pure functions of the sim's state (spec §5), so a reload mid-press resumes the same picture.
// Cabinet frames: 0 dark (before it is bought), 1 lit, 2 press down, 3 door open.

/** The door stays open this long after a card goes in. */
export const DOOR_OPEN_SECONDS = 0.35;
/** The power-on lights the five lamps one after another, this far apart. */
export const POWER_LAMP_STEP = 0.1;

/** The press (TRADE_UP_SECONDS long): the ten cards fly in over the first 0.9 s, staggered; it stamps down at 1.0 s
 *  and stays down to 1.6 s; then it hums until the result pops (pressDone). */
export const PRESS = { flyIn: 0.9, chipFlight: 0.45, stampAt: 1.0, liftAt: 1.6 } as const;

export const pressStamped = (elapsed: number): boolean => elapsed >= PRESS.stampAt && elapsed < PRESS.liftAt;

export function lockerFrame(on: boolean, pressElapsed: number | null, doorLeft: number): 0 | 1 | 2 | 3 {
  if (!on) return 0;
  if (pressElapsed !== null && pressStamped(pressElapsed)) return 2;
  return doorLeft > 0 ? 3 : 1;
}

/** Card i's (of `count`) flight from the cabinet's door into the press, 0–1, at `elapsed` into the press. */
export function chipProgress(i: number, count: number, elapsed: number): number {
  const stagger = count > 1 ? (PRESS.flyIn - PRESS.chipFlight) / (count - 1) : 0;
  return Math.min(1, Math.max(0, (elapsed - i * stagger) / PRESS.chipFlight));
}

/** The stamp landed between two frames (its sound and shake fire once). `from` null = the first frame after a
 *  reload or a new World: nothing fires. */
export const stampCrossed = (from: number | null, to: number): boolean => from !== null && from < PRESS.stampAt && to >= PRESS.stampAt;

/** The five lamp rows on the cabinet's face (world px), Mil-Spec at the top to ★ at the bottom: a lamp, then its count. */
export function lampRows(r: Rect): Array<{ lamp: Pt; text: Pt }> {
  const rowH = Math.floor((r.h - 2) / 5);
  return Array.from({ length: 5 }, (_, i) => {
    const y = r.y + 1 + i * rowH + rowH / 2;
    return { lamp: { x: r.x + 4, y }, text: { x: r.x + 7, y } };
  });
}

/** The counts' text size (CSS px, a multiple of 8): one lamp row tall at most. */
export const lampFontSize = (scale: number): number => 8 * Math.max(1, Math.floor((scale * 7) / 16));
```

- [ ] **Step 4: The station.** `fx/stations/LockerStation.ts`:
```ts
import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { lockerCounts, tradeUpRarity, type LockerState } from "../../sim/locker";
import { RARITY_INFO, RARITY_ORDER } from "../../sim/rarity";
import type { RunState, SimEvent } from "../../sim/run";
import { TRADE_UP_COUNT } from "../../sim/tuning";
import type { RarityId } from "../../sim/types";
import { cardBurst } from "../benchFx";
import { pixelStyle } from "../hd/font";
import { bigReveal } from "../juice/bigReveal";
import { Actor } from "../pixel/Actor";
import { bestSlot } from "../pixel/BenchCards";
import { CardStation } from "../pixel/CardStation";
import { lockerCardSpots, type Pt, type TableLayout } from "../pixel/layout";
import type { Pose } from "../pixel/timeline";
import { Throttle } from "../throttle";
import type { StationDeps } from "./deps";
import { chipProgress, DOOR_OPEN_SECONDS, lampFontSize, lampRows, lockerFrame, POWER_LAMP_STEP, stampCrossed } from "./lockerRules";

// The locker (spec §5, Run 2+; an unlit cabinet before): five rarity lamps with counts on its face, a drop target for
// any waiting card, a tap to press a trade-up, the press (ten cards fly in, it stamps), and its results waiting on
// top — sold, held or dragged back in like the bot's cards. Drawn from the sim every frame.

const DIM = 0x8a8a9a;
const POSE: Pose = { frame: 0, dx: 0, dy: 0, bodyDy: 0, headDy: 0, eyes: "open", look: 0 };

export class LockerStation {
  /** The cabinet and the flying chips (pixel world, under the tray). */
  readonly under = new Container();
  /** Its waiting results (pixel world, over the bench). */
  readonly over: Container;
  /** Lamps, counts, glows, the knife (HD). */
  readonly hd = new Container();
  private readonly cabinet: Actor;
  private readonly chips: Sprite[] = [];
  private readonly lamps = new Graphics();
  private readonly counts: Text[] = [];
  private readonly cards: CardStation;
  private readonly storeSound = new Throttle(0.2);
  private l: TableLayout | null = null;
  private frame = -1;
  private doorLeft = 0;
  private powerT = Infinity;
  private lastPress: number | null = null;
  private countsKey = "";
  private lampsKey = "";
  private tally: Record<RarityId, number> = lockerCounts([]);
  /** The rarity a press would take now (the lowest with ten in, never ★), or null. */
  private ready: RarityId | null = null;
  private t = 0;

  constructor(private readonly d: StationDeps) {
    this.cabinet = new Actor(d.lib.get("locker", { w: 32, h: 44, frames: 4 }));
    this.under.addChild(this.cabinet);
    for (let i = 0; i < TRADE_UP_COUNT; i++) {
      const s = new Sprite(Texture.WHITE);
      s.width = 4;
      s.height = 3;
      s.visible = false;
      this.chips.push(s);
      this.under.addChild(s);
    }
    for (let i = 0; i < RARITY_ORDER.length; i++) {
      const txt = new Text({ text: "", style: pixelStyle(8, 0xf2e9dc) });
      txt.anchor.set(0, 0.5);
      this.counts.push(txt);
    }
    this.cards = new CardStation(
      { spot: "locker", spots: lockerCardSpots, sell: (slot) => ({ type: "sellLocker", slot }), burst: (r) => cardBurst(r, d.scale()) },
      d,
    );
    this.over = this.cards.root;
    this.hd.addChild(this.lamps, ...this.counts, this.cards.hdRoot);
  }

  get results(): CardStation {
    return this.cards;
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.cabinet.place(l.locker.x + l.locker.w / 2, l.locker.y + l.locker.h);
    this.frame = -1;
    this.lampsKey = "";
    this.cards.layout(l);
    const k = this.d.scale();
    const rows = lampRows(l.locker);
    this.counts.forEach((txt, i) => {
      txt.style.fontSize = lampFontSize(k);
      txt.position.set(rows[i]!.text.x * k, rows[i]!.text.y * k);
    });
  }

  update(dt: number, ms: number, s: RunState): void {
    this.t += dt;
    this.powerT += dt;
    this.doorLeft = Math.max(0, this.doorLeft - dt);
    const k = s.locker;
    const press = k.press?.elapsed ?? null;
    if (stampCrossed(this.lastPress, press ?? -1)) this.stamp();
    this.lastPress = press;
    const frame = lockerFrame(k.on, press, this.doorLeft);
    if (frame !== this.frame) {
      this.frame = frame;
      POSE.frame = frame;
      this.cabinet.show(POSE);
      this.cabinet.tint = k.on ? 0xffffff : DIM;
    }
    this.drawChips(k);
    this.drawLamps(k);
    this.cards.update(ms, dt, k.cards);
  }

  /** A tap on the cabinet presses a trade-up (the sim refuses when none is ready). True when the tap was on it. */
  tap(p: Pt, on: boolean): boolean {
    const r = this.l?.locker;
    if (!on || !r || p.x < r.x || p.y < r.y || p.x >= r.x + r.w || p.y >= r.y + r.h) return false;
    this.d.controller.act({ type: "tradeUp" });
    return true;
  }

  onEvent(e: SimEvent): void {
    const { hd, audio } = this.d.juice;
    switch (e.type) {
      case "lockerBought": {
        // the station's reveal: a cold-blue light, the lamps coming on one by one, its hum
        this.powerT = 0;
        hd.flash(0x6ab0ff, 0.2);
        hd.particles.burst(this.screenCentre(), 0x6ab0ff, 30, (180 * this.d.scale()) / 6);
        audio.play("locker-power-on");
        break;
      }
      case "lockerUpgraded":
        audio.play("seller-power-on", { rate: 1.3, gain: 0.5 });
        break;
      case "autoContractBought":
        audio.play("seller-power-on", { rate: 1.5, gain: 0.5 });
        hd.particles.burst(this.screenCentre(), 0xffd34d, 24, (160 * this.d.scale()) / 6);
        break;
      case "lockerStored":
        this.doorLeft = DOOR_OPEN_SECONDS;
        if (e.byHand || this.storeSound.ready(this.t)) audio.play("locker-store", { gain: e.byHand ? 1 : 0.5 });
        break;
      case "pressDone": {
        this.cards.revealed(e.results);
        audio.play("tradeup-reveal");
        const best = e.results[bestSlot(e.results) ?? 0];
        if (best) bigReveal(this.d.juice, best.rarity, false); // Covert: the red hit; ★: the slow-mo and the knife
        break;
      }
      case "runStarted":
        this.cards.clearAll();
        this.doorLeft = 0;
        this.powerT = Infinity;
        this.lastPress = null;
        break;
    }
  }

  destroy(): void {
    this.cards.destroy();
  }

  private stamp(): void {
    const { hd, audio, shake } = this.d.juice;
    audio.play("tradeup-press");
    shake.add(0.25);
    hd.particles.burst(this.screenCentre(-12), 0xf2e9dc, 16, (120 * this.d.scale()) / 6, -300); // a puff of steam
  }

  /** The cabinet's middle (or `dy` world px above it), screen px. */
  private screenCentre(dy = 0): Pt {
    const r = this.l?.locker ?? { x: 0, y: 0, w: 0, h: 0 };
    return this.d.juice.hd.toScreen({ x: r.x + r.w / 2, y: r.y + r.h / 2 + dy });
  }

  /** The ten inputs fly from the cabinet's door up into the press on its top. */
  private drawChips(k: LockerState): void {
    const r = this.l?.locker;
    const press = k.press;
    this.chips.forEach((s, i) => {
      const p = press && r ? chipProgress(i, this.chips.length, press.elapsed) : 0;
      s.visible = !!press && !!r && p > 0 && p < 1;
      if (!s.visible || !press || !r) return;
      s.tint = RARITY_INFO[press.rarity].color;
      const from = { x: r.x + 5 + (i % 5) * 3, y: r.y + 18 + Math.floor(i / 5) * 3 };
      const to = { x: r.x + r.w / 2 - 2, y: r.y + 1 };
      s.position.set(Math.round(from.x + (to.x - from.x) * p), Math.round(from.y + (to.y - from.y) * p - 8 * Math.sin(Math.PI * p)));
    });
  }

  /** Five lamps and their counts; the rarity ready to press blinks (2 Hz, one small lamp). The counts are recounted
   *  only when the items change, and the lamps redrawn only when something they show changed. */
  private drawLamps(k: LockerState): void {
    const l = this.l;
    if (!l) return;
    const itemsKey = `${k.items.length}:${k.items[0]?.id ?? ""}:${k.items.at(-1)?.id ?? ""}`;
    if (itemsKey !== this.countsKey) {
      this.countsKey = itemsKey;
      this.tally = lockerCounts(k.items);
      this.ready = tradeUpRarity(k.items);
      RARITY_ORDER.forEach((r, i) => {
        const text = String(this.tally[r]);
        if (this.counts[i]!.text !== text) this.counts[i]!.text = text;
        this.counts[i]!.alpha = this.tally[r] > 0 ? 1 : 0.45;
      });
    }
    const lit = k.on ? Math.min(5, Math.floor(this.powerT / POWER_LAMP_STEP) + 1) : 0;
    const blink = this.ready ? Math.floor(this.t * 4) % 2 : 0;
    const s = this.d.scale();
    const key = `${lit}|${itemsKey}|${blink}|${s}`;
    if (key === this.lampsKey) return;
    this.lampsKey = key;
    const rows = lampRows(l.locker);
    this.lamps.clear();
    RARITY_ORDER.forEach((r, i) => {
      this.counts[i]!.visible = i < lit;
      if (i >= lit) return;
      const on = this.tally[r] > 0 && !(r === this.ready && blink === 1);
      this.lamps.circle(rows[i]!.lamp.x * s, rows[i]!.lamp.y * s, Math.max(1.5, s * 0.8)).fill({ color: RARITY_INFO[r].color, alpha: on ? 1 : 0.25 });
    });
  }
}
```

- [ ] **Step 5: Wire it.**
  - `fx/stations/Stations.ts`: add `import { LockerStation } from "./LockerStation";`, a field
    `private readonly locker: LockerStation;`, and in the constructor after the bot:
```ts
    this.locker = new LockerStation(d);
    this.under.addChild(this.locker.under);
    this.over.addChild(this.locker.over);
    this.hd.addChild(this.locker.hd);
```
    then: `layout` → also `this.locker.layout(l);`; `update` → also `this.locker.update(dt, ms, s);`; `onEvent` → also
    `this.locker.onEvent(e);`; `grabCard` → `return this.locker.results.pointerDown(p) || this.bot.cards.pointerDown(p);`;
    `pointerMove`/`pointerUp` → also `this.locker.results.pointerMove(p)` / `.pointerUp(p)`; `lifted` →
    `return this.locker.results.lifted() ?? this.bot.cards.lifted();`; `cancelDrags` → also
    `this.locker.results.cancelDrag(); this.locker.results.cancelKnife();`; `cardCentre` →
    `return (spot === "locker" ? this.locker.results : this.bot.cards).centre(slot);` (rename `_spot` to `spot`);
    `destroy` → also `this.locker.destroy();`; and add
```ts
  /** A tap on a machine (the locker presses a trade-up); true when one took it. */
  tap(p: Pt, s: RunState): boolean {
    return this.locker.tap(p, s.locker.on);
  }
```
  - `fx/World.ts`:
    - `pointerDown()`: the last line becomes
```ts
    if (this.stations.grabCard(p) || this.tray.pointerDown(p) || this.bench.pointerDown(p)) return;
    this.stations.tap(p, run.state);
```
    - `case "sold"`: the source chain uses
      `e.source === "bot" || e.source === "locker" ? this.stations.cardCentre(e.source, e.slot) : …` and the swallow
      line becomes `if (e.source === "tray" || e.source === "bot" || e.source === "locker") this.bench.swallow();`.
    - add a case: `case "lockerStored": if (e.from === "bench") this.benchFx.left(e.slot, false, this.controller.run.state.bench); break;`
      (the station plays the door and the sound; a refused store emits nothing, so the card stays).
  - `fx/labels.ts`: `binCalling` also calls for the locker's results:
```ts
/** The sell bin's light calls while a card waits to be sold: on your bench, at the bot's station or on the locker. */
export function binCalling(state: { bench: Bench; bot: Pick<RunState["bot"], "cards">; locker: Pick<LockerState, "cards"> }): boolean {
  return state.bench.phase === "revealed" || botWaiting(state.bot) || lockerWaiting(state.locker);
}
```
    with `import { lockerWaiting, type LockerState } from "../sim/locker";`.

- [ ] **Step 6: Run the tests and the checks.**
  Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
  Expected: PASS.

- [ ] **Step 7: Commit.**
```bash
git add src/modules/casecremental/fx/stations/lockerRules.ts src/modules/casecremental/fx/stations/lockerRules.test.ts src/modules/casecremental/fx/stations/LockerStation.ts src/modules/casecremental/fx/stations/Stations.ts src/modules/casecremental/fx/World.ts src/modules/casecremental/fx/labels.ts src/modules/casecremental/fx/labels.test.ts
git commit -m "feat(locker): the locker on the table - lamps and counts, drag-in, tap to trade up, the press, its result cards

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 6: The auto-buyer grid — machine, cells, flicker, flashes, sparks, the stall

**Files:**
- Create: `fx/stations/gridRules.ts`, `fx/pixel/GridBoard.ts`, `fx/stations/GridStation.ts`
- Modify: `fx/stations/Stations.ts`, `fx/World.ts`
- Test: `fx/stations/gridRules.test.ts`, `fx/pixel/gridBoard.test.ts` (new)

**Interfaces:**
- Consumes: `l.grid` (Task 2); `Throttle`, `Coins.spark`, `HdLayer.glowTexture` (Task 3); `GridState`, `GridCell`,
  `gridStalled` (`sim/grid.ts`); `GRID_SIZES`, `GRID_OPEN_SECONDS`; events `gridBought`, `gridUpgraded`,
  `gridFilled { cell, caseId }`, `gridOpened { cell, drop }`, `sold`/`stored` from `"grid"`; sprite `auto-buyer`
  (57×32 frames, ground 30, body 53×19; frame 0 off, 1 on); string `float.trayfull`.
- Produces:
```ts
// fx/stations/gridRules.ts
export const GRID_COLS = 10;
export const GRID_MAX_CELLS: number;                       // the largest of GRID_SIZES (50)
export const BOARD_IN_FRAME: { x: 15; y: 17; w: 37; h: 13 } // measured from the auto-buyer art: the pigeonholes
export const FLICKER_SECONDS = 0.4;
export const SWEEP_STEP = 0.05;
export const CELL_EMPTY = 0, CELL_FILLED = 1, CELL_FLICKER = 2, CELL_STALLED = 3;
export function boardRect(g: Rect, frame: { frameW: number; ground: number }): Rect;
export function gridCells(board: Rect, n: number): Rect[];
export function cellKind(c: GridCell | null, openSeconds: number): 0 | 1 | 2 | 3;
export function lighten(color: number, t: number): number;
export function caseColor(caseId: string): number;          // the case's colour lightened, cached
// fx/pixel/GridBoard.ts
export class GridBoard { readonly cells: Container; readonly flashes: Container;
  constructor(cellTexture: Texture, glowTexture: Texture); layout(rects: Rect[], scale: number): void;
  filled(i: number): void; opened(i: number, color: number, big: boolean): void;
  update(dt: number, cells: readonly (GridCell | null)[], on: boolean, sweep: number, colorOf: (caseId: string) => number): void;
  clear(): void }
// fx/stations/GridStation.ts
export class GridStation { readonly under: Container; readonly hd: Container; layout(l): void;
  update(dt: number, s: RunState): void; onEvent(e: SimEvent): void; sold(e: SoldEvent): boolean;
  cellCentre(i: number): Pt; destroy(): void }
// Stations.machineSale(e: SoldEvent): boolean
```

- [ ] **Step 1: Write the failing tests.**

`fx/stations/gridRules.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { GRID_SIZES } from "../../sim/tuning";
import {
  BOARD_IN_FRAME,
  boardRect,
  CELL_EMPTY,
  CELL_FILLED,
  CELL_FLICKER,
  CELL_STALLED,
  cellKind,
  FLICKER_SECONDS,
  GRID_COLS,
  GRID_MAX_CELLS,
  gridCells,
  lighten,
} from "./gridRules";

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("the auto-buyer's board", () => {
  const board = { x: 10, y: 20, w: BOARD_IN_FRAME.w, h: BOARD_IN_FRAME.h };

  it("holds the largest grid", () => {
    expect(GRID_MAX_CELLS).toBe(Math.max(...GRID_SIZES));
  });

  it.each([...GRID_SIZES])("lays %i cells in rows of ten inside the board, none overlapping", (n) => {
    const cells = gridCells(board, n);
    expect(cells).toHaveLength(n);
    for (const c of cells) {
      expect(c.w).toBeGreaterThanOrEqual(1);
      expect(c.h).toBeGreaterThanOrEqual(1);
      expect(c.x).toBeGreaterThanOrEqual(board.x);
      expect(c.y).toBeGreaterThanOrEqual(board.y);
      expect(c.x + c.w).toBeLessThanOrEqual(board.x + board.w);
      expect(c.y + c.h).toBeLessThanOrEqual(board.y + board.h);
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlap(cells[i]!, cells[j]!)).toBe(false);
    expect(cells.slice(0, GRID_COLS).every((c) => c.y === cells[0]!.y)).toBe(true);
    if (n > GRID_COLS) expect(cells[GRID_COLS]!.y).toBeGreaterThan(cells[0]!.y);
  });

  it("puts the board inside the machine's frame (the pigeonholes right of the hopper)", () => {
    const g = { x: 100, y: 120, w: 54, h: 18 };
    const b = boardRect(g, { frameW: 57, ground: 30 });
    const frame = { x: g.x + g.w / 2 - 28, y: g.y + g.h - 30, w: 57, h: 32 };
    expect(b.x).toBeGreaterThanOrEqual(frame.x);
    expect(b.y).toBeGreaterThanOrEqual(frame.y);
    expect(b.x + b.w).toBeLessThanOrEqual(frame.x + frame.w);
    expect(b.y + b.h).toBeLessThanOrEqual(g.y + g.h);
  });

  it("knows a cell's look: an empty socket, its case, a flicker just before it opens, a stalled drop", () => {
    expect(cellKind(null, 1.5)).toBe(CELL_EMPTY);
    expect(cellKind({ caseId: "bootcamp", t: 0.2, drop: null }, 1.5)).toBe(CELL_FILLED);
    expect(cellKind({ caseId: "bootcamp", t: 1.5 - FLICKER_SECONDS, drop: null }, 1.5)).toBe(CELL_FLICKER);
    const drop = { id: 1, caseId: "bootcamp", skinId: "bc_warlord", rarity: "covert" as const, float: 0.2, wear: "FT" as const, statTrak: false, value: 1 };
    expect(cellKind({ caseId: "bootcamp", t: 2, drop }, 1.5)).toBe(CELL_STALLED);
  });

  it("lightens a case's dark colour so its tiny cell reads on the dark board", () => {
    expect(lighten(0x000000, 0.5)).toBe(0x808080);
    expect(lighten(0xffffff, 0.5)).toBe(0xffffff);
    expect(lighten(0x204060, 0)).toBe(0x204060);
  });
});
```

`fx/pixel/gridBoard.test.ts`:
```ts
import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { GridCell } from "../../sim/grid";
import { GRID_MAX_CELLS, gridCells } from "../stations/gridRules";
import { GridBoard } from "./GridBoard";

// The grid's frame budget (spec §6, Review Focus 3): every cell and every flash comes from pools made once, so a busy
// Run 3 grid (ten opens a second, flashes, fills) adds nothing to the scene while it runs.

const tex = () => new Texture({ source: new TextureSource({ width: 4, height: 4 }) });
const cell = (t: number, drop: GridCell["drop"] = null): GridCell => ({ caseId: "bootcamp", t, drop });

describe("GridBoard", () => {
  it("draws a busy minute from pools made once", () => {
    const b = new GridBoard(tex(), tex());
    b.layout(gridCells({ x: 0, y: 0, w: 37, h: 13 }, GRID_MAX_CELLS), 6);
    const sizes = () => [b.cells.children.length, b.flashes.children.length];
    expect(sizes()).toEqual([GRID_MAX_CELLS, GRID_MAX_CELLS]);
    const cells: (GridCell | null)[] = Array.from({ length: GRID_MAX_CELLS }, () => null);
    for (let f = 0; f < 3600; f++) {
      const i = f % GRID_MAX_CELLS;
      cells[i] = f % 7 === 0 ? null : cell((f % 90) / 60);
      if (f % 4 === 0) b.filled(i);
      if (f % 5 === 0) b.opened(i, 0xeb4b4b, f % 10 === 0);
      b.update(1 / 60, cells, true, Infinity, () => 0xffffff);
    }
    expect(sizes()).toEqual([GRID_MAX_CELLS, GRID_MAX_CELLS]);
  });

  it("shows only the grid's own cells, and none while it is off", () => {
    const b = new GridBoard(tex(), tex());
    b.layout(gridCells({ x: 0, y: 0, w: 37, h: 13 }, 10), 2);
    const cells: (GridCell | null)[] = Array.from({ length: 10 }, (_, i) => (i < 3 ? cell(0.1) : null));
    b.update(0.016, cells, true, Infinity, () => 0x123456);
    expect(b.cells.children.filter((c) => c.visible)).toHaveLength(10); // 3 cases + 7 empty sockets
    b.update(0.016, cells, false, Infinity, () => 0x123456);
    expect(b.cells.children.filter((c) => c.visible)).toHaveLength(0);
  });

  it("sweeps on from left to right when it powers on", () => {
    const b = new GridBoard(tex(), tex());
    b.layout(gridCells({ x: 0, y: 0, w: 37, h: 13 }, 10), 2);
    const cells: (GridCell | null)[] = Array.from({ length: 10 }, () => null);
    b.update(0.016, cells, true, 0.12, () => 0);
    const lit = b.cells.children.slice(0, 10).map((c) => c.visible);
    expect(lit.slice(0, 3)).toEqual([true, true, true]);
    expect(lit.slice(3).every((v) => !v)).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/stations/gridRules.test.ts src/modules/casecremental/fx/pixel/gridBoard.test.ts`
  Expected: FAIL — the modules don't exist.

- [ ] **Step 3: The rules.** `fx/stations/gridRules.ts`:
```ts
import { caseById } from "../../sim/content/cases";
import type { GridCell } from "../../sim/grid";
import { GRID_SIZES } from "../../sim/tuning";
import type { Rect } from "../pixel/layout";

// The auto-buyer grid's look (spec §6), pure: its board of tiny code-drawn case cells in rows of ten over the
// machine's pigeonholes, and each cell's state.

export const GRID_COLS = 10;
export const GRID_MAX_CELLS = Math.max(...GRID_SIZES);
/** The cells' board inside the auto-buyer's frame (frame px): its pigeonholes, right of the hopper — measured from
 *  the built art (assets/sprites/auto-buyer.png). Re-measure if the art is rebuilt. */
export const BOARD_IN_FRAME = { x: 15, y: 17, w: 37, h: 13 } as const;
/** A filled cell flickers this long before it opens. */
export const FLICKER_SECONDS = 0.4;
/** The power-on lights the columns left to right, this far apart. */
export const SWEEP_STEP = 0.05;

export const CELL_EMPTY = 0;
export const CELL_FILLED = 1;
export const CELL_FLICKER = 2;
export const CELL_STALLED = 3;

/** The board in world px, for the machine's footprint `g` (layout.grid; the frame is placed by its ground). */
export function boardRect(g: Rect, frame: { frameW: number; ground: number }): Rect {
  const left = g.x + g.w / 2 - Math.floor(frame.frameW / 2);
  const top = g.y + g.h - frame.ground;
  const w = Math.min(BOARD_IN_FRAME.w, frame.frameW - BOARD_IN_FRAME.x);
  return { x: left + BOARD_IN_FRAME.x, y: top + BOARD_IN_FRAME.y, w, h: BOARD_IN_FRAME.h };
}

/** n cells in rows of ten, left to right then top to bottom, as big as the board allows (at most 3 px each way, 1 px
 *  apart), centred on it. */
export function gridCells(board: Rect, n: number): Rect[] {
  const rows = Math.max(1, Math.ceil(n / GRID_COLS));
  const w = Math.max(1, Math.min(3, Math.floor((board.w + 1) / GRID_COLS) - 1));
  const h = Math.max(1, Math.min(3, Math.floor((board.h + 1) / rows) - 1));
  const x0 = board.x + Math.floor((board.w - (GRID_COLS * (w + 1) - 1)) / 2);
  const y0 = board.y + Math.floor((board.h - (rows * (h + 1) - 1)) / 2);
  return Array.from({ length: n }, (_, i) => ({ x: x0 + (i % GRID_COLS) * (w + 1), y: y0 + Math.floor(i / GRID_COLS) * (h + 1), w, h }));
}

/** A cell's look: an empty socket, filled with its case, flickering just before it opens, or stalled — still lit,
 *  holding a drop the full tray can't take. */
export function cellKind(c: GridCell | null, openSeconds: number): 0 | 1 | 2 | 3 {
  if (!c) return CELL_EMPTY;
  if (c.drop) return CELL_STALLED;
  return c.t >= openSeconds - FLICKER_SECONDS ? CELL_FLICKER : CELL_FILLED;
}

/** Mix each channel toward white by `t` (0–1). */
export function lighten(color: number, t: number): number {
  const ch = (shift: number) => {
    const v = (color >> shift) & 0xff;
    return Math.round(v + (255 - v) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const colors = new Map<string, number>();
/** A case's cell colour: its (dark) box colour, lightened so a 2-px cell reads on the board. */
export function caseColor(caseId: string): number {
  let c = colors.get(caseId);
  if (c === undefined) {
    c = lighten(Number.parseInt(caseById(caseId).color.slice(1), 16), 0.45);
    colors.set(caseId, c);
  }
  return c;
}
```

- [ ] **Step 4: The board.** `fx/pixel/GridBoard.ts`:
```ts
import { Container, Sprite, type Texture } from "pixi.js";
import { RARITY_INFO } from "../../sim/rarity";
import type { GridCell } from "../../sim/grid";
import { GRID_OPEN_SECONDS } from "../../sim/tuning";
import { CELL_EMPTY, CELL_FLICKER, CELL_STALLED, cellKind, GRID_COLS, GRID_MAX_CELLS, SWEEP_STEP } from "../stations/gridRules";
import type { Rect } from "./layout";

// The grid's cells (pixel world) and their flashes (HD): one sprite each, made once for the largest grid, so a busy
// grid costs no allocation per frame (spec §6, Review Focus 3). A cell shows its case's colour, flickers before it
// opens, and keeps a stalled drop's rarity colour; an opened cell flashes in its drop's colour (bigger for Classified).

const SOCKET = 0x2a2226;
const DROP_IN_SECONDS = 0.12;
const FLASH_FADE = 3;

export class GridBoard {
  /** Pixel world. */
  readonly cells = new Container();
  /** HD layer. */
  readonly flashes = new Container();
  private readonly cellSprites: Sprite[] = [];
  private readonly flashSprites: Sprite[] = [];
  private readonly tints = new Int32Array(GRID_MAX_CELLS).fill(-1);
  private readonly dropIn = new Float32Array(GRID_MAX_CELLS);
  private readonly flash = new Float32Array(GRID_MAX_CELLS);
  private rects: Rect[] = [];
  private scale = 1;

  constructor(cellTexture: Texture, glowTexture: Texture) {
    for (let i = 0; i < GRID_MAX_CELLS; i++) {
      const c = new Sprite(cellTexture);
      c.visible = false;
      this.cellSprites.push(c);
      this.cells.addChild(c);
      const f = new Sprite({ texture: glowTexture, anchor: 0.5, blendMode: "add" });
      f.visible = false;
      this.flashSprites.push(f);
      this.flashes.addChild(f);
    }
  }

  /** The cells' rects (world px) at pixel scale `scale`. */
  layout(rects: Rect[], scale: number): void {
    this.rects = rects;
    this.scale = scale;
    this.cellSprites.forEach((s, i) => {
      const r = rects[i];
      if (!r) return;
      s.position.set(r.x, r.y);
      s.width = r.w;
      s.height = r.h;
      this.flashSprites[i]!.position.set((r.x + r.w / 2) * scale, (r.y + r.h / 2) * scale);
    });
  }

  /** A case dropped into cell i: it lands with a 1-px hop. */
  filled(i: number): void {
    if (i < GRID_MAX_CELLS) this.dropIn[i] = DROP_IN_SECONDS;
  }

  /** Cell i opened: a flash in its drop's colour (`big` for a Classified, or a breakout that waited too long). */
  opened(i: number, color: number, big: boolean): void {
    const f = this.flashSprites[i];
    if (!f) return;
    this.flash[i] = 1;
    f.tint = color;
    f.width = f.height = (big ? 18 : 9) * this.scale;
  }

  /** `sweep`: seconds since it powered on (Infinity once done). Allocates nothing. */
  update(dt: number, cells: readonly (GridCell | null)[], on: boolean, sweep: number, colorOf: (caseId: string) => number): void {
    for (let i = 0; i < GRID_MAX_CELLS; i++) {
      const s = this.cellSprites[i]!;
      const r = this.rects[i];
      this.dropIn[i] = Math.max(0, this.dropIn[i]! - dt);
      if (!r || i >= cells.length || !on || sweep < (i % GRID_COLS) * SWEEP_STEP) s.visible = false;
      else {
        const c = cells[i] ?? null;
        const kind = cellKind(c, GRID_OPEN_SECONDS);
        const tint = kind === CELL_EMPTY ? SOCKET : kind === CELL_STALLED ? RARITY_INFO[c!.drop!.rarity].color : colorOf(c!.caseId);
        if (this.tints[i] !== tint) {
          this.tints[i] = tint;
          s.tint = tint;
        }
        s.alpha = kind === CELL_FLICKER && Math.floor(c!.t * 20) % 2 === 1 ? 0.35 : 1;
        s.y = r.y - (this.dropIn[i]! > DROP_IN_SECONDS / 2 ? 1 : 0);
        s.visible = true;
      }
      const f = (this.flash[i] = Math.max(0, this.flash[i]! - dt * FLASH_FADE));
      const fs = this.flashSprites[i]!;
      fs.visible = f > 0;
      fs.alpha = f;
    }
  }

  /** A new run: every timer back to rest. */
  clear(): void {
    this.dropIn.fill(0);
    this.flash.fill(0);
  }
}
```

- [ ] **Step 5: The station.** `fx/stations/GridStation.ts`:
```ts
import { Container, Graphics, Text, Texture } from "pixi.js";
import { t } from "../../i18n/index";
import { gridStalled } from "../../sim/grid";
import { RARITY_INFO } from "../../sim/rarity";
import type { RunState, SimEvent } from "../../sim/run";
import { pixelStyle } from "../hd/font";
import { Actor } from "../pixel/Actor";
import { GridBoard } from "../pixel/GridBoard";
import type { Pt, Rect, TableLayout } from "../pixel/layout";
import { hdFontSize } from "../pixel/screen";
import type { Pose } from "../pixel/timeline";
import { Throttle } from "../throttle";
import type { StationDeps } from "./deps";
import { boardRect, caseColor, gridCells } from "./gridRules";

// The auto-buyer grid (spec §6, Run 3+; a dark machine before): a board of tiny case cells over the machine's
// pigeonholes. Bought cases drop in, flicker and open; each opened cell flashes in its drop's colour and a sold drop
// sends one coin spark to the HUD; a stalled grid keeps its cells lit with a TRAY FULL hint. Covert and ★ break out
// over the table (Task 7). Machines fire ten times a second here, so every sound and spark is throttled.

const DIM = 0x8a8a9a;
const POSE: Pose = { frame: 0, dx: 0, dy: 0, bodyDy: 0, headDy: 0, eyes: "open", look: 0 };
type SoldEvent = Extract<SimEvent, { type: "sold" }>;

export class GridStation {
  /** The machine, its board's backing and the cells (pixel world, under the tray). */
  readonly under = new Container();
  /** Flashes, the stall hint (HD). */
  readonly hd = new Container();
  private readonly machine: Actor;
  private readonly backing = new Graphics();
  private readonly board: GridBoard;
  private readonly stall = new Text({ text: "", style: pixelStyle(8, 0xffb020) });
  private readonly buySound = new Throttle(0.25);
  private readonly openSound = new Throttle(0.2);
  private readonly spark = new Throttle(0.15);
  private readonly storeSound = new Throttle(0.25);
  private l: TableLayout | null = null;
  private rects: Rect[] = [];
  private size = -1;
  private frame = -1;
  private powerT = Infinity;
  private t = 0;

  constructor(private readonly d: StationDeps) {
    this.machine = new Actor(d.lib.get("auto-buyer", { w: 57, h: 32, frames: 2 }));
    this.board = new GridBoard(Texture.WHITE, d.juice.hd.glowTexture);
    this.under.addChild(this.machine, this.backing, this.board.cells);
    this.stall.anchor.set(0.5, 1);
    this.stall.visible = false;
    this.hd.addChild(this.board.flashes, this.stall);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.machine.place(l.grid.x + l.grid.w / 2, l.grid.y + l.grid.h);
    this.frame = -1;
    this.size = -1; // re-lay the cells on the next update
    const k = this.d.scale();
    this.stall.style.fontSize = hdFontSize(k);
    this.stall.position.set((l.grid.x + l.grid.w / 2) * k, (l.grid.y - 1) * k);
  }

  /** World centre of cell i, screen px (sparks and breakouts start there). */
  cellCentre(i: number): Pt {
    const r = this.rects[i] ?? this.l?.grid ?? { x: 0, y: 0, w: 0, h: 0 };
    return this.d.juice.hd.toScreen({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  }

  update(dt: number, s: RunState): void {
    this.t += dt;
    this.powerT += dt;
    const g = s.grid;
    if (!this.l) return;
    if (g.cells.length !== this.size) this.relayout(g.cells.length);
    const frame = g.on ? 1 : 0;
    if (frame !== this.frame) {
      this.frame = frame;
      POSE.frame = frame;
      this.machine.show(POSE);
      this.machine.tint = g.on ? 0xffffff : DIM;
      this.backing.visible = g.on;
    }
    this.board.update(dt, g.cells, g.on, this.powerT, caseColor);
    const stalled = g.on && gridStalled(g);
    this.stall.visible = stalled && Math.floor(this.t * 4) % 2 === 0; // ~2 Hz, like the tray's
    if (stalled) {
      const text = t("float.trayfull");
      if (this.stall.text !== text) this.stall.text = text;
    }
  }

  onEvent(e: SimEvent): void {
    const { hd, audio } = this.d.juice;
    switch (e.type) {
      case "gridBought":
        // the station's reveal: a warm light, its relays sweeping on left to right, its hum
        this.powerT = 0;
        hd.flash(0xffb020, 0.2);
        audio.play("grid-power-on");
        break;
      case "gridUpgraded":
        audio.play("seller-power-on", { rate: 1.4, gain: 0.4 });
        break;
      case "gridFilled":
        this.board.filled(e.cell);
        if (this.buySound.ready(this.t)) audio.play("grid-buy");
        break;
      case "gridOpened":
        this.board.opened(e.cell, RARITY_INFO[e.drop.rarity].color, e.drop.rarity === "classified");
        if (this.openSound.ready(this.t)) audio.play("grid-open");
        break;
      case "stored":
        if (e.from === "grid" && this.storeSound.ready(this.t)) audio.play("tray-store", { gain: 0.4 });
        break;
      case "runStarted":
        this.board.clear();
        this.powerT = Infinity;
        break;
    }
  }

  /** A grid drop sold by the auto-seller (or cashed in by the vault): one coin spark from its cell, at most ~7 a
   *  second, no text and no till. True when it was the grid's. */
  sold(e: SoldEvent): boolean {
    if (e.from !== "grid" && e.source !== "grid") return false;
    if (this.spark.ready(this.t)) {
      this.d.juice.hd.coins.spark(this.cellCentre(e.slot), this.d.hud());
      this.d.juice.audio.play("coin-clink", { gain: 0.3, rate: 1.4 });
    }
    return true;
  }

  destroy(): void {
    this.board.clear();
  }

  private relayout(size: number): void {
    const l = this.l!;
    this.size = size;
    const board = boardRect(l.grid, this.machine.meta);
    this.rects = gridCells(board, size);
    this.board.layout(this.rects, this.d.scale());
    this.backing
      .clear()
      .rect(board.x - 1, board.y - 1, board.w + 2, board.h + 2)
      .fill({ color: 0x120e10 });
  }
}
```

- [ ] **Step 6: Wire it.**
  - `fx/stations/Stations.ts`: add `import { GridStation } from "./GridStation";`, a field `private readonly grid: GridStation;`;
    in the constructor (before the locker, so the cabinet draws over the table's middle row in the same layer):
```ts
    this.grid = new GridStation(d);
    this.under.addChild(this.grid.under);
    this.hd.addChild(this.grid.hd);
```
    `layout` → also `this.grid.layout(l);`; `update` → also `this.grid.update(dt, s);`; `onEvent` → also
    `this.grid.onEvent(e);`; `destroy` → also `this.grid.destroy();`; and add
```ts
  /** A sale the stations draw themselves (a grid drop's throttled spark): true when they did. */
  machineSale(e: Extract<SimEvent, { type: "sold" }>): boolean {
    return this.grid.sold(e);
  }
```
  - `fx/World.ts`: `case "sold": {` gets as its first line `if (this.stations.machineSale(e)) break; // a grid drop: its own spark, no text, no till`;
    `case "stored":` gets as its first line `if (e.from === "grid") break; // the grid's station plays its own (throttled) sound`.

- [ ] **Step 7: Run the tests and the checks.**
  Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
  Expected: PASS. (If TypeScript says `"grid"` does not overlap `e.from`'s type, the sim's `SimEvent` lacks the grid
  sources — Assumption 1 — stop and report.)

- [ ] **Step 8: Commit.**
```bash
git add src/modules/casecremental/fx/stations/gridRules.ts src/modules/casecremental/fx/stations/gridRules.test.ts src/modules/casecremental/fx/pixel/GridBoard.ts src/modules/casecremental/fx/pixel/gridBoard.test.ts src/modules/casecremental/fx/stations/GridStation.ts src/modules/casecremental/fx/stations/Stations.ts src/modules/casecremental/fx/World.ts
git commit -m "feat(grid): the auto-buyer grid on the table - cells drop in, flicker, flash open, spark coins, stall with TRAY FULL

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 7: Covert and ★ break out of the grid; the full-set pop

**Files:**
- Create: `fx/hd/breakout.ts`
- Modify: `fx/stations/GridStation.ts`, `fx/stations/Stations.ts` (only if a call site moves), `fx/World.ts`
- Test: `fx/hd/breakout.test.ts` (new)

**Interfaces:**
- Consumes: `GridStation.cellCentre` (Task 6); `bigReveal` (Task 3); `KnifeFlight`, `FLIGHT_SECONDS`; `cardFace`;
  `gridOpened`; `setCompleted { caseId }`; strings `float.set`.
- Produces:
```ts
// fx/hd/breakout.ts
export const BREAKOUT_MAX_WAIT = 3;
export const POP_SECONDS = 0.25;
export const AWAY_SECONDS = 0.35;
export const breakoutSeconds: (rarity: RarityId) => number;      // Covert 2.0, ★ 3.0
export interface Waiting { drop: Drop; cell: number; at: number }
export class BreakoutQueue { push(w: Waiting): void; step(now: number): { start: Waiting | null; expired: Waiting[] }; clear(): void }
export function breakoutPose(t: number, total: number): { leg: 0 | 1 | 2; mix: number; scale: number };
export function breakoutTarget(s: { tray: readonly Drop[]; locker: { items: readonly Drop[] }; grid: { cells: readonly ({ drop: Drop | null } | null)[] } },
  dropId: number, cell: number, l: Pick<TableLayout, "tray" | "locker" | "seller">, cellPt: Pt): Pt;
export const breakoutPeak: (l: Pick<TableLayout, "grid">) => Pt;
export class BreakoutCard { readonly root: Container; constructor(glowTexture: Texture); get playing(): boolean;
  start(s: BreakoutShow): void; update(dt: number): void; stop(): void }
```

- [ ] **Step 1: Write the failing tests.** `fx/hd/breakout.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { Drop, RarityId } from "../../sim/types";
import { tableLayout } from "../pixel/layout";
import { pixelViewport } from "../pixel/viewport";
import { AWAY_SECONDS, BREAKOUT_MAX_WAIT, BreakoutQueue, breakoutPeak, breakoutPose, breakoutSeconds, breakoutTarget, POP_SECONDS } from "./breakout";
import { FLIGHT_SECONDS } from "./knifeFlight";

let n = 1;
const drop = (rarity: RarityId): Drop => ({ id: n++, caseId: "bootcamp", skinId: "bc_warlord", rarity, float: 0.2, wear: "FT", statTrak: false, value: 1 });

describe("the grid's breakouts (spec §6's visual budget)", () => {
  it("lasts long enough for a Covert's hit and a ★'s whole knife showcase", () => {
    expect(breakoutSeconds("covert")).toBeCloseTo(2, 9);
    expect(breakoutSeconds("gold")).toBeCloseTo(POP_SECONDS + FLIGHT_SECONDS + AWAY_SECONDS, 9);
  });

  it("plays one at a time, in order", () => {
    const q = new BreakoutQueue();
    q.push({ drop: drop("covert"), cell: 0, at: 0 });
    q.push({ drop: drop("covert"), cell: 1, at: 0 });
    expect(q.step(0).start?.cell).toBe(0);
    expect(q.step(1).start).toBeNull();
    expect(q.step(breakoutSeconds("covert")).start?.cell).toBe(1);
  });

  it("shows one that waited longer than BREAKOUT_MAX_WAIT as a flash instead", () => {
    const q = new BreakoutQueue();
    q.push({ drop: drop("gold"), cell: 0, at: 0 });
    q.push({ drop: drop("covert"), cell: 1, at: 0 });
    q.push({ drop: drop("covert"), cell: 2, at: 0.1 });
    expect(q.step(0).start?.cell).toBe(0); // the ★ plays for 3 s
    const later = q.step(BREAKOUT_MAX_WAIT + 0.01);
    expect(later.expired.map((w) => w.cell)).toEqual([1]);
    expect(later.start?.cell).toBe(2); // waited 2.91 s: still in time
  });

  it("never starts more than one every two seconds however many arrive, and nobody waits past the limit (Review Focus 3)", () => {
    const q = new BreakoutQueue();
    const starts: number[] = [];
    const waits: number[] = [];
    for (let i = 0; i < 1200; i++) {
      const now = i / 60;
      if (i % 3 === 0) q.push({ drop: drop(i % 2 ? "gold" : "covert"), cell: i % 50, at: now });
      const r = q.step(now);
      if (r.start) {
        starts.push(now);
        waits.push(now - r.start.at);
      }
    }
    for (let i = 1; i < starts.length; i++) expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(breakoutSeconds("covert") - 1e-9);
    for (const w of waits) expect(w).toBeLessThanOrEqual(BREAKOUT_MAX_WAIT);
  });

  it("pops out of its cell, holds at the peak, then shrinks away", () => {
    const total = breakoutSeconds("covert");
    expect(breakoutPose(0, total)).toMatchObject({ leg: 0, mix: 0 });
    expect(breakoutPose(0, total).scale).toBeCloseTo(0.2, 9);
    expect(breakoutPose(POP_SECONDS, total)).toEqual({ leg: 1, mix: 1, scale: 1 });
    expect(breakoutPose(total - AWAY_SECONDS / 2, total).leg).toBe(2);
    expect(breakoutPose(total, total)).toMatchObject({ leg: 2, mix: 1 });
    expect(breakoutPose(total, total).scale).toBeCloseTo(0.2, 9);
  });

  it("sends the card where its drop went: the tray, the locker, back to a stalled cell, else the seller", () => {
    const l = tableLayout(pixelViewport(1920, 1080));
    const d = drop("covert");
    const cellPt = { x: 1, y: 2 };
    const empty = { tray: [], locker: { items: [] }, grid: { cells: [] } };
    expect(breakoutTarget({ ...empty, tray: [d] }, d.id, 0, l, cellPt)).toEqual({ x: l.tray.x + l.tray.w / 2, y: l.tray.y + l.tray.h / 2 });
    expect(breakoutTarget({ ...empty, locker: { items: [d] } }, d.id, 0, l, cellPt).x).toBe(l.locker.x + l.locker.w / 2);
    expect(breakoutTarget({ ...empty, grid: { cells: [{ drop: d }] } }, d.id, 0, l, cellPt)).toEqual(cellPt);
    expect(breakoutTarget(empty, d.id, 0, l, cellPt).x).toBe(l.seller.x);
    expect(breakoutPeak(l).y).toBeLessThan(l.grid.y);
  });
});
```

- [ ] **Step 2: Run it to see it fail.**
  Run: `npx vitest run src/modules/casecremental/fx/hd/breakout.test.ts`
  Expected: FAIL — `./breakout` missing.

- [ ] **Step 3: Implement** `fx/hd/breakout.ts`:
```ts
import { Container, Sprite, Texture } from "pixi.js";
import type { Drop, RarityId } from "../../sim/types";
import { ITEM_SIZE, type Pt, type TableLayout } from "../pixel/layout";
import { FLIGHT_SECONDS, KnifeFlight } from "./knifeFlight";

// Covert and ★ grid drops break out (spec §6): a full-size card pops out of its cell to a spot over the table, holds
// there with the big reveal's juice (a ★ plays its knife showcase), then shrinks away to where the drop went. At most
// one plays at a time; the others wait their turn but never longer than BREAKOUT_MAX_WAIT — past that they show as a
// big flash in their cell. One breakout every 2 s at most keeps their full-screen ★ flashes far under 3 a second.

export const BREAKOUT_MAX_WAIT = 3;
export const POP_SECONDS = 0.25;
export const AWAY_SECONDS = 0.35;
const COVERT_HOLD = 1.4;

export const breakoutSeconds = (rarity: RarityId): number => POP_SECONDS + (rarity === "gold" ? FLIGHT_SECONDS : COVERT_HOLD) + AWAY_SECONDS;

export interface Waiting {
  drop: Drop;
  cell: number;
  /** When it opened (the station's clock, seconds). */
  at: number;
}

export class BreakoutQueue {
  private queue: Waiting[] = [];
  private busyUntil = -Infinity;

  push(w: Waiting): void {
    this.queue.push(w);
  }

  /** At `now`: the ones that waited too long (show them as flashes), and the next to play if none is playing. */
  step(now: number): { start: Waiting | null; expired: Waiting[] } {
    const expired: Waiting[] = [];
    while (this.queue.length && now - this.queue[0]!.at > BREAKOUT_MAX_WAIT) expired.push(this.queue.shift()!);
    let start: Waiting | null = null;
    if (now >= this.busyUntil && this.queue.length) {
      start = this.queue.shift()!;
      this.busyUntil = now + breakoutSeconds(start.drop.rarity);
    }
    return { start, expired };
  }

  clear(): void {
    this.queue = [];
    this.busyUntil = -Infinity;
  }
}

const backOut = (u: number): number => {
  const c = 1.70158;
  return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2;
};

/** Where the card is at `t` of `total`: popping out of its cell toward the peak (leg 0), holding at the peak (1), then
 *  shrinking away to its target (2). `mix` 0–1 along the leg; `scale` of the card's own size. */
export function breakoutPose(t: number, total: number): { leg: 0 | 1 | 2; mix: number; scale: number } {
  if (t < POP_SECONDS) {
    const u = Math.max(0, t) / POP_SECONDS;
    return { leg: 0, mix: 1 - (1 - u) ** 3, scale: 0.2 + 0.8 * backOut(u) };
  }
  if (t < total - AWAY_SECONDS) return { leg: 1, mix: 1, scale: 1 };
  const u = Math.min(1, (t - (total - AWAY_SECONDS)) / AWAY_SECONDS);
  return { leg: 2, mix: u * u, scale: 1 - 0.8 * u };
}

/** The spot over the table where a breakout holds: just above the grid's machine (world px). */
export const breakoutPeak = (l: Pick<TableLayout, "grid">): Pt => ({ x: l.grid.x + l.grid.w / 2, y: l.grid.y - ITEM_SIZE.reveal.h / 2 - 2 });

/** Where the drop went (world px; `cellPt` is its cell): the tray, the locker (Collect), still in its cell (a stalled
 *  grid), else the seller (sold). */
export function breakoutTarget(
  s: { tray: readonly Drop[]; locker: { items: readonly Drop[] }; grid: { cells: readonly ({ drop: Drop | null } | null)[] } },
  dropId: number,
  cell: number,
  l: Pick<TableLayout, "tray" | "locker" | "seller">,
  cellPt: Pt,
): Pt {
  if (s.tray.some((d) => d.id === dropId)) return { x: l.tray.x + l.tray.w / 2, y: l.tray.y + l.tray.h / 2 };
  if (s.locker.items.some((d) => d.id === dropId)) return { x: l.locker.x + l.locker.w / 2, y: l.locker.y + 6 };
  if (s.grid.cells[cell]?.drop?.id === dropId) return cellPt;
  return { x: l.seller.x, y: l.seller.y - 15 };
}

export interface BreakoutShow {
  /** The card with its art, and (★) without it while the knife is out. Owned: destroyed when it ends. */
  full: Texture;
  empty: Texture | null;
  /** The ★'s knife frame for its showcase, or null. */
  knife: Texture | null;
  color: number;
  /** Screen px. */
  from: Pt;
  peak: Pt;
  to: Pt;
  total: number;
  /** The pixel scale. */
  scale: number;
}

/** One breakout on screen (HD layer). */
export class BreakoutCard {
  readonly root = new Container();
  private readonly glow: Sprite;
  private readonly card = new Sprite({ anchor: 0.5 });
  private readonly knife: KnifeFlight;
  private show: BreakoutShow | null = null;
  private t = 0;
  private knifeOut = false;

  constructor(glowTexture: Texture) {
    this.glow = new Sprite({ texture: glowTexture, anchor: 0.5, blendMode: "add", alpha: 0.8 });
    this.root.addChild(this.glow, this.card);
    this.knife = new KnifeFlight(this.root);
    this.root.visible = false;
  }

  get playing(): boolean {
    return this.show !== null;
  }

  start(s: BreakoutShow): void {
    this.stop();
    this.show = s;
    this.t = 0;
    this.knifeOut = false;
    this.card.texture = s.empty ?? s.full;
    this.glow.tint = s.color;
    this.root.visible = true;
    this.place(s);
  }

  update(dt: number): void {
    const s = this.show;
    if (!s) return;
    this.t += dt;
    this.knife.update(dt);
    if (!this.knifeOut && s.knife && this.t >= POP_SECONDS) {
      this.knifeOut = true;
      this.knife.start(s.knife, s.peak, s.scale, () => (this.card.texture = s.full));
    }
    if (this.t >= s.total) return this.stop();
    this.place(s);
  }

  /** It ends (or the screen changed, the vault slammed in): gone at once, its textures with it. */
  stop(): void {
    const s = this.show;
    this.show = null;
    this.knife.cancel();
    this.root.visible = false;
    this.card.texture = Texture.EMPTY; // never left pointing at a destroyed texture
    s?.full.destroy(true);
    s?.empty?.destroy(true);
  }

  private place(s: BreakoutShow): void {
    const p = breakoutPose(this.t, s.total);
    const [a, b] = p.leg === 2 ? [s.peak, s.to] : [s.from, s.peak];
    const x = a.x + (b.x - a.x) * p.mix;
    const y = a.y + (b.y - a.y) * p.mix;
    this.card.position.set(x, y);
    this.card.scale.set(s.scale * 1.15 * p.scale);
    this.glow.position.set(x, y);
    this.glow.width = this.glow.height = 60 * s.scale * p.scale;
  }
}
```

- [ ] **Step 4: Wire it into the grid.** In `fx/stations/GridStation.ts`:
  - imports: `import { skinById } from "../../sim/content/cases";`, `import type { Drop } from "../../sim/types";`,
    `import { BreakoutCard, BreakoutQueue, breakoutPeak, breakoutSeconds, breakoutTarget } from "../hd/breakout";`,
    `import { bigReveal } from "../juice/bigReveal";`, `import { cardBurst } from "../benchFx";`,
    `import { cardFace } from "../pixel/cardFace";`;
  - fields `private readonly queue = new BreakoutQueue();`, `private readonly card: BreakoutCard;`,
    `private state: RunState | null = null;`; in the constructor `this.card = new BreakoutCard(d.juice.hd.glowTexture);`
    and add `this.card.root` to `this.hd` after the stall text;
  - `layout`: add `this.card.stop();` (screen px changed);
  - `update`: after `this.board.update(…)`, add
```ts
    this.state = s;
    const { start, expired } = this.queue.step(this.t);
    for (const w of expired) this.board.opened(w.cell, RARITY_INFO[w.drop.rarity].color, true); // waited too long: a big flash
    if (start) this.breakOut(start.drop, start.cell);
    this.card.update(dt);
```
  - `onEvent`, `case "gridOpened"`: a Covert or ★ goes to the queue instead of the cell flash:
```ts
      case "gridOpened":
        if (e.drop.rarity === "covert" || e.drop.rarity === "gold") this.queue.push({ drop: e.drop, cell: e.cell, at: this.t });
        else this.board.opened(e.cell, RARITY_INFO[e.drop.rarity].color, e.drop.rarity === "classified");
        if (this.openSound.ready(this.t)) audio.play("grid-open");
        break;
```
    add `this.queue.clear(); this.card.stop();` to the `runStarted` case, and a case of its own:
```ts
      case "vaultBought": // the vault takes the screen: nothing breaks out over it
        this.queue.clear();
        this.card.stop();
        break;
```
  - `destroy`: add `this.card.stop();`;
  - add the method:
```ts
  /** A Covert or ★ from cell `cell` bursts out over the table: the breakout sound, then the big reveal's juice
   *  (Covert's hit, ★'s slow-mo, flash — through the flash gate — and its knife showcase). No camera zoom: it centres
   *  on your bench. */
  private breakOut(drop: Drop, cell: number): void {
    const l = this.l;
    const s = this.state;
    if (!l || !s) return;
    const { hd, audio } = this.d.juice;
    const k = this.d.scale();
    const art = this.d.skins.frames(skinById(drop.skinId))[0] ?? null;
    const gold = drop.rarity === "gold";
    const from = this.cellCentre(cell);
    const peak = hd.toScreen(breakoutPeak(l));
    const cellWorld = { x: from.x / k, y: from.y / k };
    this.card.start({
      full: this.bake(art, drop),
      empty: gold ? this.bake(null, drop) : null,
      knife: gold ? art : null,
      color: RARITY_INFO[drop.rarity].color,
      from,
      peak,
      to: hd.toScreen(breakoutTarget(s, drop.id, cell, l, cellWorld)),
      total: breakoutSeconds(drop.rarity),
      scale: k,
    });
    audio.play("grid-breakout");
    const b = cardBurst(drop.rarity, k);
    hd.particles.burst(peak, RARITY_INFO[drop.rarity].color, b.count, b.speed);
    bigReveal(this.d.juice, drop.rarity, false);
  }

  private bake(art: Texture | null, drop: Drop): Texture {
    const face = cardFace(art, drop);
    const tex = this.d.bake(face);
    face.destroy({ children: true });
    return tex;
  }
```
- [ ] **Step 5: The full-set pop** (Collector's Eye, spec §8). In `fx/World.ts`'s `onEvent`, add:
```ts
      case "setCompleted": {
        // Collector's Eye: every skin of a case revealed this run — its drops pay x2 from now on
        const tb = this.l.table;
        const at = this.hd.toScreen({ x: tb.x + tb.w / 2, y: tb.y + 12 });
        this.hd.coins.floatText(at, t("float.set"));
        this.audio.play("reward-chime");
        break;
      }
```

- [ ] **Step 6: Run the tests and the checks.**
  Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build && wc -l src/modules/casecremental/fx/stations/*.ts src/modules/casecremental/fx/World.ts`
  Expected: PASS; every file under ~400 lines.

- [ ] **Step 7: Commit.**
```bash
git add src/modules/casecremental/fx/hd/breakout.ts src/modules/casecremental/fx/hd/breakout.test.ts src/modules/casecremental/fx/stations/GridStation.ts src/modules/casecremental/fx/World.ts
git commit -m "feat(grid): Covert and ★ break out over the table one at a time (the rest flash after 3 s); the full-set pop

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 8: The Upgrades board — NEXT RUN, the bot's multi-open, the locker and grid rows

**Files:**
- Create: `ui/machineRules.ts`, `ui/BotPanel.tsx`, `ui/MachinesPanel.tsx`, `ui/LockerRows.tsx`, `ui/GridRows.tsx`
- Modify: `ui/UpgradesBoard.tsx`
- Test: `ui/machineRules.test.ts` (new)

**Interfaces:**
- Consumes: `UpgradeView.nextRun`, `BotView.{speedNextRun, multiAvailable, multiLevel, multiCost, canBuyMulti}`,
  `GameView.locker: LockerView`, `GameView.grid: GridView`; actions `buyBotMulti`, `buyLocker`, `buyLockerSize`,
  `setCollect`, `tradeUp`, `buyAutoContract`, `buyGrid`, `buyGridRate`, `buyGridSize`, `setGridReserve`;
  `GRID_RESERVES`, `TRADE_UP_COUNT`; Task 1's strings.
- Produces:
```ts
// ui/machineRules.ts
export type Act = (a: Action) => void;
export const boardOpen: (view: GameView) => boolean;              // the vault is not out and the run not over
export const capKey: (nextRun: boolean) => "cap.nextrun" | "btn.max";
export const COLLECT_CYCLE: readonly (RarityId | null)[];          // off, Mil-Spec, Restricted, Classified, Covert
export function nextCollect(r: RarityId | null): RarityId | null;
export function nextReserve(r: number): number;
export function tradeUpProgress(counts: Record<RarityId, number>, collect: RarityId | null, ready: RarityId | null): { rarity: RarityId; n: number; of: number };
export const percent: (share: number) => number;
// ui/BotPanel.tsx: BotPanel({ view, act }); ui/MachinesPanel.tsx: MachinesPanel({ view, act })
```

- [ ] **Step 1: Write the failing test.** `ui/machineRules.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { GRID_RESERVES, TRADE_UP_COUNT } from "../sim/tuning";
import type { RarityId } from "../sim/types";
import { capKey, COLLECT_CYCLE, nextCollect, nextReserve, percent, tradeUpProgress } from "./machineRules";

const counts = (c: Partial<Record<RarityId, number>>): Record<RarityId, number> => ({ milspec: 0, restricted: 0, classified: 0, covert: 0, gold: 0, ...c });

describe("the Machines tab's helpers", () => {
  it("cycles Collect through off and every rarity a contract takes, never ★", () => {
    let r: RarityId | null = null;
    const seen = [r];
    for (let i = 0; i < COLLECT_CYCLE.length; i++) seen.push((r = nextCollect(r)));
    expect(seen).toEqual([null, "milspec", "restricted", "classified", "covert", null]);
    expect(COLLECT_CYCLE).not.toContain("gold");
  });

  it("cycles the grid's reserve 25 → 50 → 75 → 25 %", () => {
    expect(GRID_RESERVES).toEqual([0.25, 0.5, 0.75]);
    expect([0.25, 0.5, 0.75].map(nextReserve)).toEqual([0.5, 0.75, 0.25]);
    expect(nextReserve(0.4)).toBe(0.25); // an unknown value starts the cycle over
    expect(percent(0.75)).toBe(75);
  });

  it("counts TRADE UP toward the ready rarity, else the Collect one, else the fullest below ★", () => {
    expect(tradeUpProgress(counts({ milspec: 12, restricted: 3 }), "restricted", "milspec")).toEqual({ rarity: "milspec", n: TRADE_UP_COUNT, of: TRADE_UP_COUNT });
    expect(tradeUpProgress(counts({ milspec: 7, restricted: 3 }), "restricted", null)).toEqual({ rarity: "restricted", n: 3, of: TRADE_UP_COUNT });
    expect(tradeUpProgress(counts({ milspec: 2, classified: 6, gold: 9 }), null, null)).toEqual({ rarity: "classified", n: 6, of: TRADE_UP_COUNT });
    expect(tradeUpProgress(counts({}), null, null).rarity).toBe("milspec");
  });

  it("says NEXT RUN on a cap a later run lifts, MAX otherwise", () => {
    expect(capKey(true)).toBe("cap.nextrun");
    expect(capKey(false)).toBe("btn.max");
  });
});
```

- [ ] **Step 2: Run it to see it fail.**
  Run: `npx vitest run src/modules/casecremental/ui/machineRules.test.ts`
  Expected: FAIL — `./machineRules` missing.

- [ ] **Step 3: The rules.** `ui/machineRules.ts`:
```ts
import type { Action } from "../game/controller";
import type { GameView } from "../game/view";
import { RARITY_ORDER } from "../sim/rarity";
import { GRID_RESERVES, TRADE_UP_COUNT } from "../sim/tuning";
import type { RarityId } from "../sim/types";

// The Upgrades board's small rules (spec §2, §5, §6): which label a maxed button shows, and how the Machines tab's
// settings cycle.

export type Act = (a: Action) => void;

/** The vault is not out and the run is not over: the board's switches work. */
export const boardOpen = (view: GameView): boolean => view.vault.phase === null && !view.over;

/** A maxed button: NEXT RUN when a later run lifts the cap, MAX when none does (spec §2). */
export const capKey = (nextRun: boolean): "cap.nextrun" | "btn.max" => (nextRun ? "cap.nextrun" : "btn.max");

/** Collect cycles: off, then each rarity a contract takes (never ★). */
export const COLLECT_CYCLE: readonly (RarityId | null)[] = [null, "milspec", "restricted", "classified", "covert"];

export function nextCollect(r: RarityId | null): RarityId | null {
  return COLLECT_CYCLE[(COLLECT_CYCLE.indexOf(r) + 1) % COLLECT_CYCLE.length]!;
}

/** The grid's reserve cycles 25 → 50 → 75 → 25 %. */
export function nextReserve(r: number): number {
  const i = (GRID_RESERVES as readonly number[]).indexOf(r);
  return GRID_RESERVES[(i + 1) % GRID_RESERVES.length]!;
}

/** What the TRADE UP button counts toward: the rarity ready to press, else the Collect rarity, else the fullest one
 *  below ★ (ties: the lowest). */
export function tradeUpProgress(counts: Record<RarityId, number>, collect: RarityId | null, ready: RarityId | null): { rarity: RarityId; n: number; of: number } {
  const pool = RARITY_ORDER.filter((r) => r !== "gold");
  const rarity = ready ?? collect ?? pool.reduce((best, r) => (counts[r] > counts[best] ? r : best), pool[0]!);
  return { rarity, n: Math.min(counts[rarity], TRADE_UP_COUNT), of: TRADE_UP_COUNT };
}

export const percent = (share: number): number => Math.round(share * 100);
```

- [ ] **Step 4: The panels.**

`ui/BotPanel.tsx` (the Bot tab, moved out of `UpgradesBoard.tsx` and extended):
```tsx
import type { ReactNode } from "react";
import type { GameView } from "../game/view";
import { caseName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { formatSpeed, nextBotCase } from "./botBoard";
import { boardOpen, capKey, type Act } from "./machineRules";
import { PxButton } from "./parts";

// The Bot tab (rework spec §1, M3 spec §4): wake it, its Speed (NEXT RUN at this run's cap), its multi-open ×2
// (Run 2+), and the case it opens.

export function BotPanel({ view, act }: { view: GameView; act: Act }): ReactNode {
  const b = view.bot;
  const lang = getLang();
  const open = boardOpen(view);
  const unlocked = view.cases.filter((c) => c.unlocked).map((c) => c.id);
  if (!b.awake)
    return (
      <div className="cc-row">
        <div>{t("bot.asleep")}</div>
        <div className="cc-dim">{t("bot.awake")}</div>
        <PxButton disabled={!b.canWake} onClick={() => act({ type: "wakeBot" })}>
          {t("btn.wake")}
          <span className="cc-btn-sub">{formatCash(b.wakeCost, lang)}</span>
        </PxButton>
      </div>
    );
  return (
    <>
      <div className="cc-row">
        <div>{t("bot.speed", { n: formatSpeed(b.speed, lang) })}</div>
        <div className="cc-dim">{t("label.level", { n: b.speedLevel })}</div>
        {b.speedCost === null ? (
          <PxButton disabled>{t(capKey(b.speedNextRun))}</PxButton>
        ) : (
          <PxButton disabled={!b.canBuySpeed} onClick={() => act({ type: "buyBotSpeed" })}>
            {formatCash(b.speedCost, lang)}
          </PxButton>
        )}
      </div>
      {b.multiAvailable ? (
        <div className="cc-row">
          <div>{t("bot.multi")}</div>
          <div className="cc-dim">{t("bot.multidesc")}</div>
          {b.multiLevel > 0 ? (
            <PxButton disabled>{t("btn.max")}</PxButton>
          ) : (
            <PxButton disabled={!b.canBuyMulti} onClick={() => act({ type: "buyBotMulti" })}>
              {t("btn.buy")}
              <span className="cc-btn-sub">{formatCash(b.multiCost, lang)}</span>
            </PxButton>
          )}
        </div>
      ) : null}
      <div className="cc-row">
        <div>{t("bot.opens")}</div>
        <div className="cc-dim">{b.caseChoice === null ? t("bot.best") : caseName(b.caseChoice)}</div>
        <PxButton disabled={!open} onClick={() => act({ type: "setBotCase", caseId: nextBotCase(b.caseChoice, unlocked) })}>
          {t("btn.change")}
        </PxButton>
      </div>
    </>
  );
}
```

`ui/LockerRows.tsx`:
```tsx
import type { ReactNode } from "react";
import type { GameView } from "../game/view";
import { rarityName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { RARITY_INFO } from "../sim/rarity";
import { cssColor } from "./botBoard";
import { boardOpen, nextCollect, tradeUpProgress, type Act } from "./machineRules";
import { Bar, PxButton } from "./parts";

// The locker's rows on the Machines tab (spec §5, Run 2+; hidden before): buy it; its size; what the auto-seller
// collects into it; TRADE UP with its n/10 (a bar while the press runs); Run 3's auto contract.

export function LockerRows({ view, act }: { view: GameView; act: Act }): ReactNode {
  const k = view.locker;
  const lang = getLang();
  if (!k.available) return null;
  if (!k.on)
    return (
      <div className="cc-row">
        <div>{t("locker.name")}</div>
        <div className="cc-dim">{t("locker.desc")}</div>
        <PxButton disabled={!k.canBuy} onClick={() => act({ type: "buyLocker" })}>
          {t("btn.buy")}
          <span className="cc-btn-sub">{formatCash(k.cost, lang)}</span>
        </PxButton>
      </div>
    );
  const p = tradeUpProgress(k.counts, k.collect, k.tradeUp);
  return (
    <>
      <div className="cc-row">
        <div>{t("locker.name")}</div>
        <div className="cc-dim">{t("locker.count", { n: k.count, max: k.capacity })}</div>
        <div className="cc-dim">{t("locker.size", { n: k.sizeLevel })}</div>
        {k.sizeCost === null ? (
          <PxButton disabled>{t("btn.max")}</PxButton>
        ) : (
          <PxButton disabled={!k.canBuySize} onClick={() => act({ type: "buyLockerSize" })}>
            {formatCash(k.sizeCost, lang)}
          </PxButton>
        )}
      </div>
      <div className="cc-row">
        <div>{t("locker.collect")}</div>
        {k.collect ? <div style={{ color: cssColor(RARITY_INFO[k.collect].color) }}>{rarityName(k.collect)}</div> : <div className="cc-dim">{t("locker.off")}</div>}
        <PxButton disabled={!boardOpen(view)} onClick={() => act({ type: "setCollect", rarity: nextCollect(k.collect) })}>
          {t("btn.change")}
        </PxButton>
      </div>
      <div className="cc-row">
        {k.pressing ? (
          <>
            <div>{t("locker.pressing")}</div>
            <Bar progress={k.pressProgress} />
          </>
        ) : (
          <PxButton disabled={!k.canTradeUp} onClick={() => act({ type: "tradeUp" })}>
            {t("btn.tradeup")}
            <span className="cc-btn-sub" style={{ color: cssColor(RARITY_INFO[p.rarity].color) }}>{`${p.n}/${p.of}`}</span>
          </PxButton>
        )}
      </div>
      {k.autoAvailable ? (
        <div className="cc-row">
          <div>{t("locker.auto")}</div>
          <div className="cc-dim">{t("locker.autodesc")}</div>
          {k.auto ? (
            <PxButton disabled on>
              {t("locker.autoon")}
            </PxButton>
          ) : (
            <PxButton disabled={!k.canBuyAuto} onClick={() => act({ type: "buyAutoContract" })}>
              {t("btn.buy")}
              <span className="cc-btn-sub">{formatCash(k.autoCost, lang)}</span>
            </PxButton>
          )}
        </div>
      ) : null}
    </>
  );
}
```

`ui/GridRows.tsx`:
```tsx
import type { ReactNode } from "react";
import type { GameView } from "../game/view";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { boardOpen, nextReserve, percent, type Act } from "./machineRules";
import { PxButton } from "./parts";

// The auto-buyer's rows on the Machines tab (spec §6, Run 3+; hidden before): buy it (only once the auto-seller is
// on — its drops need an output), its Rate and Size, and the share of your cash it never spends.

export function GridRows({ view, act }: { view: GameView; act: Act }): ReactNode {
  const g = view.grid;
  const lang = getLang();
  if (!g.available) return null;
  if (!g.on)
    return (
      <div className="cc-row">
        <div>{t("grid.name")}</div>
        <div className="cc-dim">{g.needsSeller ? t("grid.needs") : t("grid.desc")}</div>
        <PxButton disabled={!g.canBuy} onClick={() => act({ type: "buyGrid" })}>
          {t("btn.buy")}
          <span className="cc-btn-sub">{formatCash(g.cost, lang)}</span>
        </PxButton>
      </div>
    );
  return (
    <>
      <div className="cc-row">
        <div>{t("grid.name")}</div>
        <div className="cc-dim">{t("grid.rate", { n: g.rateLevel })}</div>
        {g.rateCost === null ? (
          <PxButton disabled>{t("btn.max")}</PxButton>
        ) : (
          <PxButton disabled={!g.canBuyRate} onClick={() => act({ type: "buyGridRate" })}>
            {formatCash(g.rateCost, lang)}
          </PxButton>
        )}
      </div>
      <div className="cc-row">
        <div className="cc-dim">{t("grid.size", { n: g.size })}</div>
        {g.sizeCost === null ? (
          <PxButton disabled>{t("btn.max")}</PxButton>
        ) : (
          <PxButton disabled={!g.canBuySize} onClick={() => act({ type: "buyGridSize" })}>
            {formatCash(g.sizeCost, lang)}
          </PxButton>
        )}
      </div>
      <div className="cc-row">
        <div>{t("grid.reserve", { n: percent(g.reserve) })}</div>
        <PxButton disabled={!boardOpen(view)} onClick={() => act({ type: "setGridReserve", reserve: nextReserve(g.reserve) })}>
          {t("btn.change")}
        </PxButton>
      </div>
    </>
  );
}
```

`ui/MachinesPanel.tsx` (the seller rows moved verbatim from `UpgradesBoard.tsx`'s `SellerPanel`, then the locker and
the grid):
```tsx
import type { ReactNode } from "react";
import type { GameView } from "../game/view";
import { rarityName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import { RARITY_INFO } from "../sim/rarity";
import { cssColor, nextThreshold } from "./botBoard";
import { GridRows } from "./GridRows";
import { LockerRows } from "./LockerRows";
import { boardOpen, type Act } from "./machineRules";
import { PxButton } from "./parts";

// The Machines tab: the auto-seller (Run 1), the locker (Run 2+), the auto-buyer grid (Run 3+). A machine of a later
// run has no rows until its run (spec §2).

/** The auto-seller (moved from UpgradesBoard.tsx's SellerPanel; only the open check is renamed). */
function SellerRows({ view, act }: { view: GameView; act: Act }): ReactNode {
  const s = view.seller;
  const lang = getLang();
  if (!s.on)
    return (
      <div className="cc-row">
        <div>{t("seller.name")}</div>
        <div className="cc-dim">{t("seller.desc")}</div>
        <PxButton disabled={!s.canBuy} onClick={() => act({ type: "buySeller" })}>
          {t("btn.buy")}
          <span className="cc-btn-sub">{formatCash(s.cost, lang)}</span>
        </PxButton>
      </div>
    );
  return (
    <>
      <div className="cc-row">
        <div>{t("seller.name")}</div>
        <div className="cc-dim">{t("seller.speed", { n: s.speedLevel })}</div>
        {s.speedCost === null ? (
          <PxButton disabled>{t("btn.max")}</PxButton>
        ) : (
          <PxButton disabled={!s.canBuySpeed} onClick={() => act({ type: "buySellerSpeed" })}>
            {formatCash(s.speedCost, lang)}
          </PxButton>
        )}
      </div>
      <div className="cc-row">
        <div>{t("seller.sells")}</div>
        <div style={{ color: cssColor(RARITY_INFO[s.threshold].color) }}>{rarityName(s.threshold)}</div>
        <PxButton disabled={!boardOpen(view)} onClick={() => act({ type: "setSellerThreshold", rarity: nextThreshold(s.threshold) })}>
          {t("btn.change")}
        </PxButton>
      </div>
    </>
  );
}

export function MachinesPanel({ view, act }: { view: GameView; act: Act }): ReactNode {
  return (
    <>
      <SellerRows view={view} act={act} />
      <LockerRows view={view} act={act} />
      <GridRows view={view} act={act} />
    </>
  );
}
```
  (If M3-A changed the seller's rows in `UpgradesBoard.tsx` since this plan was written — e.g. a Collect line — move
  its current JSX instead of the block above; the only intended change is `isOpen` → `boardOpen`.)

`ui/UpgradesBoard.tsx`: delete `BotPanel`, `SellerPanel`, `isOpen` and their now-unused imports; import
`{ BotPanel } from "./BotPanel"`, `{ MachinesPanel } from "./MachinesPanel"`, `{ capKey, type Act } from "./machineRules"`
(drop the local `type Act`); `UpgradeRow`'s maxed button becomes `<PxButton disabled>{t(capKey(u.nextRun))}</PxButton>`;
the tab body becomes `… : tab === "bot" ? <BotPanel view={view} act={act} /> : <MachinesPanel view={view} act={act} />`;
update the header comment ("Tabs You / Bot / Machines: … the Machines tab holds the auto-seller, the locker and the grid").

- [ ] **Step 5: Run the tests and the checks.**
  Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build && wc -l src/modules/casecremental/ui/*.tsx`
  Expected: PASS; every `ui/*.tsx` under ~400 lines.

- [ ] **Step 6: Commit.**
```bash
git add src/modules/casecremental/ui/machineRules.ts src/modules/casecremental/ui/machineRules.test.ts src/modules/casecremental/ui/BotPanel.tsx src/modules/casecremental/ui/MachinesPanel.tsx src/modules/casecremental/ui/LockerRows.tsx src/modules/casecremental/ui/GridRows.tsx src/modules/casecremental/ui/UpgradesBoard.tsx
git commit -m "feat(ui): the Upgrades board of Runs 2 and 3 - NEXT RUN caps, bot multi-open, locker and auto-buyer rows

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 9: The case shelf — seven cases, tick boxes, gold frames, the run's vault

**Files:**
- Create: `ui/shelfFit.ts`
- Modify: `ui/CaseShelf.tsx`, `ui/parts.tsx`
- Test: `ui/shelfFit.test.ts` (new)

**Interfaces:**
- Consumes: `CaseView.ticked`, `GameView.grid.on`, `GameView.vault.id`, `GameView.run`; `toggleGridTick { caseId }`;
  `vaultFor(run).sourceCase`; `boardOpen`, `Act` (Task 8); `shelf.tick` (Task 1); `PANEL_CHROME`, `hdFontSize`,
  `spriteIndex`.
- Produces:
```ts
// ui/shelfFit.ts
export const shelfIconK: (scale: number) => number;           // CSS px per sprite px of a shelf icon
export const ROW_TEXT_CHROME: number;                          // PANEL_CHROME − 2
export const ROW_GAP = 2;
export function charsBesideIcon(panelW: number, scale: number, iconW: number): number;
export function wrapLines(text: string, perLine: number): { lines: number; spills: boolean };
// ui/parts.tsx
export function PixelTick({ on }: { on: boolean }): ReactNode;
```

**Why the smaller icon:** with the icon at `floor(scale / 2)` CSS px per sprite px, only 8 characters fit beside it at
1920×1080 — "Mainframe" / «Мейнфрейм» (9) would spill out of the panel. At `floor(scale / 3)` at least 9 fit at every
swept size (the test pins it), and the rows stay as short as Run 1's.

- [ ] **Step 1: Write the failing test.** `ui/shelfFit.test.ts`:
```ts
import { afterEach, describe, expect, it } from "vitest";
import { tableLayout } from "../fx/pixel/layout";
import { hdFontSize } from "../fx/pixel/screen";
import { spriteIndex } from "../fx/pixel/sprites";
import { pixelViewport } from "../fx/pixel/viewport";
import { caseName } from "../i18n/content";
import { setLang } from "../i18n/index";
import { CASES } from "../sim/content/cases";
import { charsBesideIcon, ROW_GAP, ROW_TEXT_CHROME, wrapLines } from "./shelfFit";

afterEach(() => setLang("en"));

// The landscape sizes of fx/pixel/layout.test.ts (portrait has no side panel: the drawer is the screen's width).
const SIZES: Array<[number, number]> = [
  [1024, 768], [1280, 1024], [2732, 2048], [1000, 1000], [1312, 1080], [900, 860], [1920, 1080], [1280, 720],
  [3440, 1440], [800, 450], [1366, 768], [1084, 749], [1159, 777], [1440, 900], [2560, 1440],
];
const ICON_W = Math.max(27, ...[...spriteIndex().entries()].filter(([id]) => id.startsWith("case-")).map(([, e]) => e.meta.frameW));
const NAMES = [...CASES.map((c) => c.id), "vault1", "vault2", "vault3"];

describe("wrapLines", () => {
  it("wraps at spaces and after hyphens, and knows a word that is too long", () => {
    expect(wrapLines("Vault Case III", 9)).toEqual({ lines: 2, spills: false });
    expect(wrapLines("Сейф-кейс III", 9)).toEqual({ lines: 2, spills: false });
    expect(wrapLines("Mainframe", 8)).toEqual({ lines: 1, spills: true });
    expect(wrapLines("Boot Camp", 12)).toEqual({ lines: 1, spills: false });
  });
});

describe.each(SIZES)("the case shelf at %i×%i (Review Focus 4)", (w, h) => {
  const vp = pixelViewport(w, h);
  const l = tableLayout(vp);
  const panelW = l.panelR!.w;

  it.each(["en", "ru"] as const)("fits every case's and vault's name beside its icon in two lines (%s)", (lang) => {
    setLang(lang);
    const per = charsBesideIcon(panelW, vp.scale, ICON_W);
    for (const id of NAMES) {
      const fit = wrapLines(caseName(id), per);
      expect(fit.spills, `${caseName(id)} in ${per}`).toBe(false);
      expect(fit.lines, caseName(id)).toBeLessThanOrEqual(2);
    }
  });

  it("fits the widest BUY (×5) and the tick box on one line", () => {
    const charW = hdFontSize(vp.scale) / vp.scale;
    const button = "КУПИТЬ ×5".length * charW + 2; // its text and its padding (1 + 1)
    const tick = (7 / 8) * charW + 2;
    expect(button + ROW_GAP + tick).toBeLessThanOrEqual(panelW - ROW_TEXT_CHROME);
  });
});
```
  (Format the `SIZES` literal however Prettier likes it.)

- [ ] **Step 2: Run it to see it fail.**
  Run: `npx vitest run src/modules/casecremental/ui/shelfFit.test.ts`
  Expected: FAIL — `./shelfFit` missing.

- [ ] **Step 3: Implement.** `ui/shelfFit.ts`:
```ts
import { PANEL_CHROME } from "../fx/pixel/layout";
import { hdFontSize } from "../fx/pixel/screen";

// How the case shelf's rows fit (Press Start 2P is monospaced: a character is the font size wide). The panels are at
// least 64 world px wide (fx/pixel/layout.ts); these numbers keep seven cases' names and the vault's on two lines
// beside their icons, in both languages (spec §3: names up to 12 characters, the vault's up to 14).

/** A shelf icon's CSS px per sprite px. */
export const shelfIconK = (scale: number): number => Math.max(1, Math.floor(scale / 3));

/** World px a row's text loses across a panel: the frame (6 + 6), the panel padding (1 + 1), the row padding (1 + 1). */
export const ROW_TEXT_CHROME = PANEL_CHROME - 2;
/** `.cc-row-line`'s gap (ui/styles.ts): 2 world px. */
export const ROW_GAP = 2;

/** Characters that fit beside an icon `iconW` sprite px wide, in a panel `panelW` world px wide at pixel scale `scale`. */
export function charsBesideIcon(panelW: number, scale: number, iconW: number): number {
  const charW = hdFontSize(scale) / scale;
  return Math.floor((panelW - ROW_TEXT_CHROME - (iconW * shelfIconK(scale)) / scale - ROW_GAP) / charW);
}

/** How `text` wraps into lines of `perLine` characters, breaking at spaces and after hyphens (as the browser does);
 *  `spills` when one piece is longer than a line. */
export function wrapLines(text: string, perLine: number): { lines: number; spills: boolean } {
  const pieces: Array<{ text: string; space: boolean }> = [];
  text.split(" ").forEach((word, wi) => word.split(/(?<=-)/).forEach((part, pi) => pieces.push({ text: part, space: wi > 0 && pi === 0 })));
  let lines = 1;
  let used = 0;
  let spills = false;
  for (const p of pieces) {
    const need = (used > 0 && p.space ? 1 : 0) + p.text.length;
    if (used > 0 && used + need > perLine) {
      lines++;
      used = p.text.length;
    } else used += need;
    if (p.text.length > perLine) spills = true;
  }
  return { lines, spills };
}
```
  `ui/parts.tsx` — one glyph renderer for the gear and the new tick box:
```tsx
type Run = { x: number; y: number; w: number };
const glyphRuns = (rows: readonly string[]): Run[] => rows.flatMap((row, y) => [...row.matchAll(/#+/g)].map((m) => ({ x: m.index ?? 0, y, w: m[0].length })));

/** A pixel glyph in the text colour, one cell per font pixel (the text size is a multiple of 8, so n/8 em keeps
 *  every cell whole). */
function PixelGlyph({ runs, size }: { runs: readonly Run[]; size: number }): ReactNode {
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={`${size / 8}em`} height={`${size / 8}em`} shapeRendering="crispEdges" aria-hidden="true" style={{ display: "block" }}>
      {runs.map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill="currentColor" />
      ))}
    </svg>
  );
}

const GEAR_RUNS = glyphRuns(GEAR);
const TICK_OFF = glyphRuns(["#######", "#.....#", "#.....#", "#.....#", "#.....#", "#.....#", "#######"]);
const TICK_ON = glyphRuns(["#######", "#....##", "#...#.#", "##.#..#", "#.#...#", "#.....#", "#######"]);

export function PixelGear(): ReactNode {
  return <PixelGlyph runs={GEAR_RUNS} size={9} />;
}

/** The shelf's tick box (the auto-buyer buys a ticked case). */
export function PixelTick({ on }: { on: boolean }): ReactNode {
  return <PixelGlyph runs={on ? TICK_ON : TICK_OFF} size={7} />;
}
```
  (Replace the old `GEAR_RUNS` constant and `PixelGear` body; keep the `GEAR` rows and its comment.)

  `ui/CaseShelf.tsx`:
  - imports: add `import { vaultFor } from "../sim/content/vaults";`, `import { boardOpen, type Act } from "./machineRules";`
    (drop the local `type Act`), `import { shelfIconK } from "./shelfFit";`, and `PixelTick` from `./parts`;
  - `CaseIcon` and `VaultRow`: `const k = shelfIconK(scale);`;
  - `VaultRow`'s icon is the run's vault source case:
    `stripFrameCss(spriteIndex().get(\`case-${vaultFor(view.run).sourceCase}\`), 0, k, CASE_ICON_ROWS)`, and its name
    `caseName(view.vault.id)` (M3-A Task 3 already made that change; keep it);
  - the tick box and the gold frame:
```tsx
/** Run 3+: the auto-buyer buys ticked cases, round-robin (spec §6); a gold frame marks them (campaign spec §3.1). */
function TickBox({ c, act, open }: { c: CaseView; act: Act; open: boolean }): ReactNode {
  return (
    <PxButton on={c.ticked} disabled={!open} title={t("shelf.tick")} onClick={() => act({ type: "toggleGridTick", caseId: c.id })} style={{ flex: "none", lineHeight: 1 }}>
      <PixelTick on={c.ticked} />
    </PxButton>
  );
}

function CaseRow({ c, act, grid, open }: { c: CaseView; act: Act; grid: boolean; open: boolean }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  return (
    <div className="cc-row" style={grid && c.ticked ? { boxShadow: `0 0 0 ${scale}px #ffd34d inset` } : undefined}>
      <div className="cc-row-line">
        <CaseIcon c={c} />
        <span style={{ flex: 1 }}>{caseName(c.id)}</span>
      </div>
      {c.unlocked ? (
        <div className="cc-row-line">
          <PxButton style={{ flex: 1 }} disabled={!c.canBuy} onClick={() => act({ type: "buyCase", caseId: c.id })}>
            {t("btn.buy")}
            {c.count > 1 ? ` ×${c.count}` : ""}
            <span className="cc-btn-sub">{formatCash(c.price * c.count, getLang())}</span>
          </PxButton>
          {grid ? <TickBox c={c} act={act} open={open} /> : null}
        </div>
      ) : (
        <PxButton disabled={!c.canUnlock} onClick={() => act({ type: "unlockCase", caseId: c.id })}>
          {t("btn.unlock")}
          <span className="cc-btn-sub">{formatCash(c.unlockCost, getLang())}</span>
        </PxButton>
      )}
    </div>
  );
}
```
    and in `CaseShelf`: `<CaseRow key={c.id} c={c} act={act} grid={view.grid.on} open={boardOpen(view)} />`. The
    `.cc-scroll` list already scrolls when seven cases, the vault and the day job overflow the panel.

- [ ] **Step 4: Run the tests and the checks.**
  Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
  Expected: PASS. If a name spills at a size, do not shorten the content name (M3-A owns it) — report the size and
  the name.

- [ ] **Step 5: Commit.**
```bash
git add src/modules/casecremental/ui/shelfFit.ts src/modules/casecremental/ui/shelfFit.test.ts src/modules/casecremental/ui/CaseShelf.tsx src/modules/casecremental/ui/parts.tsx
git commit -m "feat(shelf): seven cases fit, tick boxes and gold frames for the auto-buyer, the run's vault icon

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 10: The prestige screen's next run, and the run number in the HUD

**Files:**
- Modify: `ui/prestigeRules.ts`, `ui/Prestige.tsx`, `ui/Hud.tsx`
- Test: `ui/prestigeRules.test.ts`

Plan M3-E Task 7 owns the prestige title and the trophy line (`vaultNumeral`, a `vault` prop). This task adds only
the block under the trophy line; if both plans edit `Prestige.tsx`, keep both changes.

**Interfaces:**
- Consumes: `PrestigeView.{nextRun, replay}`, `GameView.run`; `runContent`, `runCaseIds` (`sim/campaign.ts`),
  `botSpeed`; strings `prestige.nextrun/later/again`, `brings.*`, `hud.run` (Task 1).
- Produces:
```ts
// ui/prestigeRules.ts
export type Bring =
  | { kind: "case"; caseId: string }
  | { kind: "machine"; id: "botMulti" | "locker" | "grid" | "autoContract" }
  | { kind: "cap"; id: "multiOpen" | "botSpeed"; value: number };
export function runBrings(run: number): Bring[];
export function bringText(b: Bring): string;
```

- [ ] **Step 1: Write the failing test.** In `ui/prestigeRules.test.ts` add `runBrings`, `bringText` to the
  `./prestigeRules` import, `import { budgetFor, fitsBudget } from "../i18n/budgets";`,
  `import { setLang } from "../i18n/index";`, and:
```ts
describe("what the next run brings (spec §8)", () => {
  afterEach(() => setLang("en"));

  it("Run 2: Mainframe and Neon Nights, the bot's x2, the locker, multi-open to x3, bot speed to x20", () => {
    expect(runBrings(2)).toEqual([
      { kind: "case", caseId: "mainframe" },
      { kind: "case", caseId: "neon" },
      { kind: "machine", id: "botMulti" },
      { kind: "machine", id: "locker" },
      { kind: "cap", id: "multiOpen", value: 3 },
      { kind: "cap", id: "botSpeed", value: 20 },
    ]);
  });

  it("Run 3: Deep Space and Inferno, the grid, the auto contract, multi-open to x5, bot speed to x50", () => {
    expect(runBrings(3)).toEqual([
      { kind: "case", caseId: "deepspace" },
      { kind: "case", caseId: "inferno" },
      { kind: "machine", id: "grid" },
      { kind: "machine", id: "autoContract" },
      { kind: "cap", id: "multiOpen", value: 5 },
      { kind: "cap", id: "botSpeed", value: 50 },
    ]);
  });

  it("Run 1 brings nothing new", () => {
    expect(runBrings(1)).toEqual([]);
  });

  it.each(["en", "ru"] as const)("every line fits the prestige screen (%s)", (lang) => {
    setLang(lang);
    for (const b of [...runBrings(2), ...runBrings(3)]) expect(fitsBudget(bringText(b), budgetFor("brings.case")), bringText(b)).toBe(true);
  });
});
```
  (Add `afterEach` to the file's `vitest` import if it is not there.)

- [ ] **Step 2: Run it to see it fail.**
  Run: `npx vitest run src/modules/casecremental/ui/prestigeRules.test.ts`
  Expected: FAIL — `runBrings` is not exported.

- [ ] **Step 3: Implement.** `ui/prestigeRules.ts` — add:
```ts
import { caseName } from "../i18n/content";
import { t } from "../i18n/index";
import { botSpeed } from "../sim/botOpener";
import { runCaseIds, runContent } from "../sim/campaign";

export type Bring =
  | { kind: "case"; caseId: string }
  | { kind: "machine"; id: "botMulti" | "locker" | "grid" | "autoContract" }
  | { kind: "cap"; id: "multiOpen" | "botSpeed"; value: number };

/** What run `run` adds over the one before it (spec §8): its new cases, its new machines, its raised caps. */
export function runBrings(run: number): Bring[] {
  if (run <= 1) return [];
  const now = runContent(run);
  const before = runContent(run - 1);
  const out: Bring[] = runCaseIds(run)
    .slice(before.cases)
    .map((caseId) => ({ kind: "case", caseId }));
  if (now.botMultiOpen > before.botMultiOpen) out.push({ kind: "machine", id: "botMulti" });
  if (now.locker && !before.locker) out.push({ kind: "machine", id: "locker" });
  if (now.grid && !before.grid) out.push({ kind: "machine", id: "grid" });
  if (now.autoContract && !before.autoContract) out.push({ kind: "machine", id: "autoContract" });
  if (now.multiOpen > before.multiOpen) out.push({ kind: "cap", id: "multiOpen", value: now.multiOpen });
  if (now.botSpeedLevels > before.botSpeedLevels) out.push({ kind: "cap", id: "botSpeed", value: Math.round(botSpeed(now.botSpeedLevels)) });
  return out;
}

export function bringText(b: Bring): string {
  if (b.kind === "case") return t("brings.case", { name: caseName(b.caseId) });
  if (b.kind === "cap") return t(b.id === "multiOpen" ? "brings.multiOpen" : "brings.botSpeed", { n: b.value });
  return t(`brings.${b.id}` as const);
}
```
  `ui/Prestige.tsx` — import `bringText, runBrings` from `./prestigeRules`; directly under the trophy line add:
```tsx
        <div className="cc-title">{t("prestige.nextrun", { n: p.nextRun })}</div>
        {p.replay ? (
          <>
            <div className="cc-dim">{t("prestige.later")}</div>
            <div>{t("prestige.again", { n: p.nextRun })}</div>
          </>
        ) : (
          <div style={{ display: "grid", gap: scale }}>
            {runBrings(p.nextRun).map((b) => (
              <div key={b.kind === "case" ? b.caseId : b.id} className="cc-dim">
                {bringText(b)}
              </div>
            ))}
          </div>
        )}
```
  and update the header comment ("…the Vault trophy, what the next run brings, three charms…").
  `ui/Hud.tsx` — the run number, small, under the stage name in the top-right (the top-left is under the platform's
  back button at 800×450). Replace the right-hand cell (the last child of the HUD's grid, the `div` with
  `justifyContent: "flex-end"`) with:
```tsx
      <div style={{ display: "grid", justifyItems: "end", gap: scale }}>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "start", gap: 2 * scale }}>
          <span style={{ color: view.stage >= 2 ? "#ff7ad9" : "#a89a8c" }}>{stageName(view.stage)}</span>
          {view.combo > 1 ? (
            <span style={{ color: "#7affc1" }}>
              {t("hud.combo", { mult: view.comboMult.toFixed(2).replace(".", lang === "ru" ? "," : ".") })}
            </span>
          ) : null}
          <span style={{ pointerEvents: "auto" }}>
            <PxButton onClick={onSettings} title={t("hud.settings")} style={{ lineHeight: 1 }}>
              <PixelGear />
            </PxButton>
          </span>
        </div>
        <span className="cc-dim">{t("hud.run", { n: view.run })}</span>
      </div>
```
  (The HUD band is 18 world px: the stage line and this one fit in it at every scale — two lines of 4 world px text.)

- [ ] **Step 4: Run the tests and the checks.**
  Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
  Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/modules/casecremental/ui/prestigeRules.ts src/modules/casecremental/ui/prestigeRules.test.ts src/modules/casecremental/ui/Prestige.tsx src/modules/casecremental/ui/Hud.tsx
git commit -m "feat(prestige): NEXT: RUN N and what it brings, the replay line after Vault III; the run number in the HUD

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```

### Task 11: In the browser — every station's reveal, a trade-up, the double spin, the full grid; EN and RU; then the notes

**Files:**
- Create or modify: `docs/feature-history/casecremental-runs-2-3.md`, `docs/feature-history/README.md`
- No product code unless a check fails (then fix it in the owning task's files, with a test where one fits, and
  commit that fix on its own).

- [ ] **Step 1: The checks pass.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build`
  Expected: PASS.

- [ ] **Step 2: Start the game.** Run `npm run dev` in the background (Vite, port 5180). Load the browser tools in
  one call (`ToolSearch` → `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__resize_window,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__javascript_tool`),
  check the open tabs, open a new tab at `http://localhost:5180/`. If the sign-in screen blocks you, use the scratch
  harness instead — `http://localhost:5180/.superpowers/harness/index.html?state=empty&cash=500` mounts the scene and
  the panels without sign-in (it is never committed; it is served by the same Vite). If no browser is connected,
  say so in the report and do Steps 3–8 with headless screenshots (`.superpowers/harness/shot.sh`) instead.
  Known: at 800×450 the platform's back button covers the Upgrades title — not a bug of this plan.

- [ ] **Step 3: Run 1 still looks like Run 1** (1920×1080, then 1280×720 and 800×450 via `resize_window`): the dark
  locker cabinet stands between the (slightly shorter) tray and the bin; the dark auto-buyer sits in the table's
  middle; nothing overlaps; a bench card dropped on the dark locker goes home; the tray's art ends before the locker.
  Screenshot each size.

- [ ] **Step 4: Run 2** (Settings → RUN 2, then +CASH a few times): the shelf lists five cases with their box icons;
  the HUD says RUN 2. Wake the bot; Bot tab: the multi-open row → BUY → its next spin shows two stacked reels in the
  bot's window and lands two cards side by side, each with its glow; sell one by tap, drag the other to the bin; hold
  one while the auto-seller takes the other (buy the seller first). Machines tab: the locker's BUY → the power-on
  (blue light, five lamps coming on one by one, its sound); drag a bench card, a bot card and a tray item onto it —
  each goes in (door frame, `locker-store`), the lamp counts rise; set Collect to Mil-Spec and let the seller fill it
  to ten; TRADE UP lights with 10/10 → tap the cabinet: ten chips fly into the press, it stamps (`tradeup-press`, a
  puff), the result pops on top of the locker (`tradeup-reveal`); sell it by dragging to the bin; press another and
  drag its result back into the locker. Reload mid-press and with a result waiting: both resume as they were, no
  stamp replays. Use the sound board's forced Covert/★ on your bench while the locker shows results — the camera and
  every card stay put.

- [ ] **Step 5: Run 3** (Settings → RUN 3, +CASH): seven cases (scroll the shelf), the vault row names the run's
  vault once every case is unlocked. Machines tab: the grid's BUY is disabled with "Needs auto-seller" until the
  seller is bought; buy it → the power-on sweep (`grid-power-on`), the shelf grows tick boxes; tick two cases (gold
  frames); cells drop in, flicker, open with flashes; coin sparks fly to the HUD; buy Rate to the top and Size to 50
  cells — the board is full and the frame rate holds (watch for a minute). Fill the tray (seller threshold Mil-Spec):
  stalled cells stay lit and TRAY FULL blinks over the grid; claim a tray item → it resumes. Wait for a Covert from
  the grid (or several): one card breaks out over the table at a time (`grid-breakout`, the red hit), then shrinks
  away to the tray or the seller; a ★ shows its knife showcase. Buy the auto contract: presses start on their own.
  Reload with the grid stalled and with cells mid-open: the board is redrawn as it was.

- [ ] **Step 6: The prestige screen** (+CASH until the vault is affordable, buy it, turn the key, let it open): after
  Vault II the screen says NEXT: RUN 3 and lists Deep Space, Inferno, the auto-buyer grid, the auto contract,
  multi-open to x5, bot speed to x50; after Vault III it says NEXT: RUN 3 with "RUN 4: IN A LATER UPDATE" and
  "RUN 3 AGAIN, BOOSTED".

- [ ] **Step 7: Russian, and portrait.** Settings → language RU; repeat the key screens of Steps 4–6 (the Machines
  tab's rows, the shelf with Мейнфрейм and Сейф-кейс III, the prestige list, the HUD's ЗАБЕГ). Resize to 390×844 and
  820×1180: the bot has no reel there — its two cards only; the locker, its results and the grid fit the table; the
  drawer's tabs hold the shelf and the board.

- [ ] **Step 8: The console is clean.** `read_console_messages` (pattern `error|warn|casecremental`): no errors; no
  "sprite … not built" warning for `locker`, `auto-buyer` or the four new cases.

- [ ] **Step 9: Write the notes.** In `docs/feature-history/casecremental-runs-2-3.md` (create it with the title
  `# Casecremental — Runs 2 and 3 (M3)` and a one-line pointer to the M3 spec if Plan M3-A has not) add a section
  `## On screen (M3-D)` with what the code does not show: the stations live in `fx/stations/` and draw from the sim
  every frame (why: reload and lobby trips); the layout decisions of Task 2 (the locker between the tray and the bin,
  the tray giving up its right end and nine-sliced, the grid machine in the band in front of the stations, the
  locker's results sitting on the cabinet and allowed over the tray's end and the bin's rim); the board drawn over
  the art's pigeonholes (`BOARD_IN_FRAME`, measured — re-measure if the art is rebuilt); the visual budget (one
  breakout at a time, 3 s wait then a flash, throttles, the flash gate for every table flash); the shelf icon at
  `floor(scale / 3)` (why: Мейнфрейм); and anything the browser checks turned up. If the file is new, add one line to
  `docs/feature-history/README.md`:
  `- [Casecremental Runs 2 and 3 (M3)](casecremental-runs-2-3.md) — cases 4–7, the bot's second reel, locker and trade-ups, the auto-buyer grid, Vaults II and III`.

- [ ] **Step 10: Commit the notes.**
```bash
git add docs/feature-history/casecremental-runs-2-3.md docs/feature-history/README.md
git commit -m "docs(feature-history): Runs 2 and 3 on screen - stations from the sim, the layout, the grid's visual budget

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
```
  (Stage `README.md` only if you changed it.)

- [ ] **Step 11: Report** to the controller: the screenshots taken (sizes, languages), every check of Steps 3–8 with
  pass/fail, any fix committed and why, and the final test count.
