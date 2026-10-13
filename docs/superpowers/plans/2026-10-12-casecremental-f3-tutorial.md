# Casecremental F3 — Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A coach for first-time players: nine speech bubbles with a pixel arrow, each pointing at the thing to touch and ending when the player does it, plus a one-tap "what's new" card the first time Runs 2, 3 and 4 start. EN and RU, skippable, replayable from Settings, remembered per browser.

**Architecture:** One pure step machine, `ui/tutorialRules.ts`. Given the `GameView`, the stored progress and the sim events, it says what shows (a card, a step with its target chain, or nothing) and when a step ends. Progress is a new `tutorial` field in `ui/prefs.ts`, so it lives per browser, never in the run save. Two more pure modules find the target and place the bubble. `ui/tutorialTargets.ts` turns a world prop into a rect with the same maths the canvas already uses: world px × the pixel scale (`fx/pixel/screen.ts` `toScreen`), then the camera (a new `cameraPoint` in `fx/camera.ts`, the point form of `cameraCss`). DOM targets are elements marked `data-tut`. `ui/tutorialPlace.ts` puts the bubble beside its target and never over it. The React overlay `ui/Tutorial.tsx` only measures, every animation frame, and draws.

**Tech Stack:** TypeScript (strict), React 19, PixiJS 8 (untouched), Vitest (`npx vitest run <path>`), `npm run typecheck`, `npm run build`.

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-finish-design.md` §4 (F3, binding), with §1 (phases) and §11 (testing). Before starting, also read the F2 plan's header and Task 5 (`docs/superpowers/plans/2026-10-12-casecremental-f2-autospin.md`). It names auto-spin's rows and the shelf's switch.

**Order: F2 lands before this plan.** When F3 starts, the auto-buyer grid is gone. `GameView.autoSpin: AutoSpinView` exists (`owned`, `canBuy`, `needsSeller`, …). `ui/AutoSpinRows.tsx` holds auto-spin's Machines rows, and `ui/CaseShelf.tsx` has an `AutoSpinRow` (the switch) at the top of the shelf and `PickBox`es on its case rows. Before Task 1, re-read `game/view.ts`, `ui/CaseShelf.tsx`, `ui/MachinesPanel.tsx`, `ui/AutoSpinRows.tsx`, `ui/GamePanel.tsx` and `ui/styles.ts` as F1 and F2 left them. If F2 named something differently from what is written here, follow the code and say so in your report.

All paths below are relative to `src/modules/casecremental/` unless they start with `docs/` or `.superpowers/`.

## Decisions taken where the spec is open

- **Steps 1–3 (the bench loop) run in order.** Nothing later shows until they are done. **Steps 4–9 are independent:** each waits until it can be done (the spec's "once affordable", "when it appears"), and the first one ready, in spec order, shows. A strict 1→9 chain would stall. A player who has not bought the auto-seller when the vault appears would never see step 9, and someone who can afford to wake the bot before the next case would see nothing.
- **"Advance on the player's action" means an event or the state.** Each step ends either on the sim event that is the action (step 3: a card leaves the bench; step 9: `vaultBought`), or when the state shows it done (step 6: `bot.awake`). The state check also passes a step the player did before its bubble came up, so it never shows. No step ends on a timer.
- **Step 3 ends however the card leaves the bench.** That can be a hand sale or a tap, the auto-seller's sale, or a store to the tray or the locker. The tutorial cannot get stuck when a machine takes the card (Review Focus 3).
- **Step 9 has an OK button.** "This is the run's goal" has no action of its own, and buying the vault can be many minutes away. OK ends it, and so does buying the vault. It is the only bubble with OK.
- **Steps whose action sits behind a tab point at the tab first.** Each step carries a **target chain**, deepest first. Step 4 is `upgrade:<id>` → `tab:you` → `drawer:upgrades`. The overlay points at the first one on screen. A row inside a closed tab is not rendered, so the arrow lands on the tab, and on the row once the tab opens. That covers desktop (the left panel's YOU / BOT / MACHINES tabs) and portrait (the drawer's CASES / UPGRADES tabs) with one rule.
- **"Wake the bot → the bot" points at the bot's WAKE button.** Waking happens only there (Bot tab), so the arrow goes `wake` → `tab:bot` → `drawer:upgrades`. Tapping the bot on the table does nothing, so an arrow at the sprite would send the player to a dead end.
- **Players with progress skip what they have done.** `prefs.tutorial` starts as `null`. The first time F3 runs in a browser, the overlay seeds it from the save. A save that has played past the bench loop marks steps 1–3 done. "Played past" means any of: Run 2+, an upgrade bought, a second case unlocked, the bot awake, the seller on. Every step the state shows done is marked too, and the new-run cards for runs up to the current one count as seen. So a Run 2 player with the bot awake sees no intro, no Run 2 card and no "Wake the bot" (Review Focus 1). A brand-new player gets nothing marked. Seeding happens only while the field is `null`. **Replay tutorial** sets `done: []` and `off: false` (the cards seen are kept), so the bench loop is taught again. Steps the state shows done (an awake bot) pass at once, because they cannot be done again.
- **Skip tutorial hides the bubbles, not the new-run cards.** A card announces content and closes with one tap.
- **New-run cards:** a card shows when `view.run ∈ {2, 3, 4}` and that run is not in `cards`. It shows before any bubble and closes with one tap anywhere. Run 4's text is written now. Until F6 sets `LAST_RUN = 4`, `view.run` never reaches 4, so that card cannot trigger. The Run 4 card's Russian case names (Глитч, Горячка) are F3's guess. **F6 must make `card.run4` match the names it gives cases 8 and 9 in `i18n/content.ts`.**
- **Nothing shows** while the vault is out or after the run (`vault.phase !== null || over`), while Settings or the dev sound board is open, or while the panels are still fading back in after a vault (the same `UI_BACK_S` delay, plus 0.6 s).
- **The bubble lets drags through.** Only its buttons take the pointer. Dragging a card to the bin under the bubble still works.
- **Placement:** the bubble goes above the target, else below, else (landscape only) left, else right, at the first side where it fits inside the overlay. When none fits, it takes the side with the most room and may run off-screen, but never over the target. On portrait it is only ever above or below (spec). The arrow sits in the gap between the bubble and the target, points at the target's centre (clamped to the bubble's span) and bobs one world pixel toward it each second. The bob is motion only: no light change, and it stops under `prefers-reduced-motion`.
- **A target row scrolled out of its list** (a short landscape screen with seven cases and the vault) is scrolled into view once, when the arrow first moves to it. The scroll uses its `.cc-scroll` list's `scrollTop`, never `scrollIntoView`, which would also scroll the `overflow: hidden` panels.

## Global Constraints

- Every player-facing string exists in EN (`i18n/en.ts`) and RU (`i18n/ru.ts`) and fits its `i18n/budgets.ts` budget. Russian has exactly the English keys (`i18n.test.ts`). F3's bubble lines also wrap into at most 3 lines of 24 characters (Task 1's test).
- Photosensitivity is a hard rule. No flashing. Any throbbing or pulsing light changes by less than 0.1 in alpha from peak to peak (`BEAT_LIGHT_AMPLITUDES` in `fx/vault/beat.ts`). Every full-screen flash goes through the flash gate (`hd.flash`). F3 adds no flash and no light pulse: the arrow's bob is a 1-world-pixel move.
- File size (IDOS.md): when a change adds a new responsibility to a file past ~400 lines, that part goes in its own file. `fx/World.ts` is already ~540 lines, and F3 does not touch it. The only fx change is `cameraPoint` in `fx/camera.ts`.
- Module boundaries: `ui/` may import `fx/`, but `fx/` never imports `ui/`. `sim/` stays pure. Nothing imports another module.
- Match the surrounding style. Each file opens with a short `//` paragraph saying why it exists, and exported names get one-line `/** */` docs in the same plain voice. Prettier `printWidth: 140` (`npm run format` is available). Comment density matches the neighbouring code.
- The checks stay green at every commit: `npx vitest run src/modules/casecremental`, `npm run typecheck`, `npm run build`.
- Commits look like `feat(tutorial): …` (`docs(…)` for docs) and stage only the task's files. Never stage `docs/todo.md` or the `{…}.png` screenshots in the repo root, which are the user's untracked files. Every commit message ends with these two lines, after a blank line:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```
- Stay on branch `casecremental-finish`. Do not edit `src/modules.ts`, `src/config.ts`, `src/idos.title.ts` or `idos.modules.lock.json`. F3 needs no SDK API.

## Review Focus

The five conditions most likely to bite a player that the spec does not spell out, most likely first. Each one has its test in the owning task.

1. **A returning player opens the game after F3 ships** (a save in Run 2, the bot awake, the seller on). They expect no "Tap a case to buy it", no Run 2 card and no bubble for what they already own. Test: Task 2, "seeds a returning player's progress from the save".
2. **The player gets ahead of the coach** (wakes the bot or buys the seller before that bubble comes up). The step is passed and never shows. Test: Task 2, "passes a step the player did before its bubble came up".
3. **A bench card leaves without a hand sale while step 3 shows** (the auto-seller sells it, or it goes to the tray). Step 3 must still end. Test: Task 2, "ends step 3 however the card leaves the bench".
4. **A resize or rotation while a bubble shows.** In portrait the chain falls back to the drawer's tab, and on every screen size the bubble and its arrow never cover the target. Tests: Task 3, the placement sweep over six viewports and the `firstPresent` chain test.
5. **The target row is scrolled out of a short shelf** (1024×768, seven cases + the vault). The list scrolls it into view, and the arrow never points outside the panel. Test: Task 3, `scrollDelta`.

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `game/view.ts`, `game/view.test.ts` | 1 | `GameView.held`, `GameView.benchCards` |
| `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`, `i18n/i18n.test.ts` | 1 | the bubbles', the cards' and Settings' strings |
| `ui/tutorialRules.ts` (+ test) | 2 | the step machine: steps, targets, progress, seeding, cards |
| `ui/prefs.ts`, `ui/prefs.test.ts` | 2 | `Prefs.tutorial` |
| `fx/camera.ts`, `fx/camera.test.ts` | 3 | `cameraPoint` |
| `ui/tutorialTargets.ts` (+ test) | 3 | world target rects, world → overlay, the target chain, list scrolling |
| `ui/tutorialPlace.ts` (+ test) | 3 | bubble and arrow placement, the arrow's turn and bob |
| `ui/Tutorial.tsx`, `ui/NewRunCard.tsx` | 4 | the overlay |
| `ui/parts.tsx` | 4 | `PxButton`'s `tut` prop, `PixelArrow` |
| `ui/CaseShelf.tsx`, `ui/Drawer.tsx`, `ui/UpgradesBoard.tsx`, `ui/BotPanel.tsx`, `ui/MachinesPanel.tsx`, `ui/AutoSpinRows.tsx`, `ui/tutorialMarks.test.ts` | 4 | `data-tut` marks, and a test that keeps them in step with the rules |
| `ui/Settings.tsx`, `ui/GamePanel.tsx`, `ui/styles.ts`, `ui/styles.test.ts` | 4 | Replay, wiring, CSS |
| `.superpowers/harness/harness.tsx` (scratch, not committed) | 5 | `?tut=` presets |
| `docs/feature-history/casecremental-finish.md`, `docs/feature-history/README.md` | 5 | notes |

---

### Task 1: The view's held card and bench cards, and every F3 string (EN + RU)

**Files:**
- Modify: `game/view.ts`, `game/view.test.ts`, `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`, `i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `RunState.held: CardSpot | null`, `Bench` (`sim/run.ts`).
- Produces:
  ```ts
  // game/view.ts, GameView
  /** The card the player holds (picked up to drag), or null. */
  held: CardSpot | null;
  /** Your bench's card slots while revealed: true = a card waits there. [] otherwise. */
  benchCards: boolean[];
  // i18n keys: tut.buy tut.key tut.sell tut.upgrades tut.unlock tut.bot tut.seller tut.autospin tut.vault
  //            tut.skip tut.ok tut.replay card.title card.tap card.run2 card.run3 card.run4
  // ui/tutorialPlace.ts does not exist yet; the wrap test below hard-codes 24 (Task 3 adds BUBBLE_CHARS = 24)
  ```

Strings (budgets in brackets):

| key | EN | RU |
|---|---|---|
| `tut.buy` [60] | Tap a case to buy it | Нажми на кейс, чтобы купить его |
| `tut.key` [60] | Turn the key: drag it to the case, or tap the case | Поверни ключ: перетащи его к кейсу или нажми на кейс |
| `tut.sell` [60] | Drag the skin to SELL, or just tap it | Перетащи скин в корзину SELL или просто нажми на него |
| `tut.upgrades` [60] | Spend cash on upgrades | Трать деньги на улучшения |
| `tut.unlock` [60] | Unlock the next case | Открой следующий кейс |
| `tut.bot` [60] | Wake the bot: it opens cases on its own | Разбуди бота: он сам открывает кейсы |
| `tut.seller` [60] | The auto-seller sells for you; good drops wait in the tray | Автопродавец продаёт за тебя, а хорошие дропы ждут в лотке |
| `tut.autospin` [60] | Auto-spin opens your cases while you watch | Автоспин открывает твои кейсы, пока ты смотришь |
| `tut.vault` [60] | This is the run's goal | Это цель забега |
| `tut.skip` [20] | Skip tutorial | Пропустить обучение |
| `tut.ok` [8] | OK | ОК |
| `tut.replay` [16] | REPLAY TUTORIAL | ОБУЧЕНИЕ ЗАНОВО |
| `card.title` [24] | RUN {n}: WHAT'S NEW | ЗАБЕГ {n}: ЧТО НОВОГО |
| `card.tap` [24] | Tap to continue | Нажми, чтобы продолжить |
| `card.run2` [150] | The bot gets a second reel: two cases a spin. The locker keeps your skins and trades 10 of one rarity up for a rarer skin. | У бота второй барабан: два кейса за спин. Шкафчик хранит скины и меняет 10 одной редкости на более редкий. |
| `card.run3` [150] | Multi-open goes up to x5. The auto contract presses trade-ups on its own. | Мультиоткрытие до x5. Автоконтракт сам жмёт пресс обмена. |
| `card.run4` [150] | Two new cases, Glitch and Fever Dream. The Upgrader stakes skins for bigger ones, maxed upgrades evolve, and The Last Case waits at the end. | Два новых кейса: Глитч и Горячка. Апгрейдер ставит скины на крупный выигрыш, прокачанные улучшения эволюционируют, а в конце ждёт Последний кейс. |

These were measured when the plan was written. The longest `tut.*` line is 58 characters (RU `tut.seller`), and every one wraps into at most 3 lines of 24. The text avoids em dashes (the EN table has none; the pixel font's coverage is untested).

- [ ] **Step 1: Write the failing tests.**

  `game/view.test.ts`, inside `describe("buildView — M2b", …)`:
  ```ts
  it("says which bench cards wait and which card is held (F3: the tutorial points at them)", () => {
    const run = new Run(1);
    expect(buildView(run)).toMatchObject({ held: null, benchCards: [] });
    run.buyCase("bootcamp");
    run.insertKey();
    for (let i = 0; i < 600 && run.state.bench.phase === "spinning"; i++) run.tick(1 / 30);
    expect(buildView(run).benchCards).toEqual([true]);
    run.setHeld("bench", 0);
    expect(buildView(run).held).toBe("bench");
    run.sell(0);
    expect(buildView(run)).toMatchObject({ held: null, benchCards: [] });
  });
  ```
  `i18n/i18n.test.ts`: add `import { wrapLines } from "../ui/shelfFit";` and a new block at the end:
  ```ts
  describe("F3 strings", () => {
    const fits = (key: keyof typeof EN, vars: Record<string, string | number>) => fitsBudget(t(key, vars), budgetFor(key));
    const BUBBLE_KEYS = ["tut.buy", "tut.key", "tut.sell", "tut.upgrades", "tut.unlock", "tut.bot", "tut.seller", "tut.autospin", "tut.vault"] as const;

    it.each(["en", "ru"] as const)("every bubble wraps into at most 3 lines of 24 characters (%s)", (lang) => {
      setLang(lang);
      for (const key of BUBBLE_KEYS) {
        const w = wrapLines(t(key), 24);
        expect(w.lines, key).toBeLessThanOrEqual(3);
        expect(w.spills, key).toBe(false);
      }
    });

    it.each(["en", "ru"] as const)("the new-run card's title fits for Runs 2, 3 and 4 (%s)", (lang) => {
      setLang(lang);
      for (const n of [2, 3, 4]) expect(fits("card.title", { n }), `run ${n}`).toBe(true);
    });
  });
  ```
  The `it.each(Object.keys(EN))` budget test already covers every new key once the budgets exist.

- [ ] **Step 2: Run the tests to see them fail.**
  Run: `npx vitest run src/modules/casecremental/game/view.test.ts src/modules/casecremental/i18n`
  Expected: FAIL. `held` and `benchCards` are undefined, and the `tut.*` keys are missing.

- [ ] **Step 3: The view.** In `game/view.ts`:
  - Change the run import to `import type { Bench, CardSpot, Run } from "../sim/run";`.
  - Add to `GameView`, after `phase`:
  ```ts
    /** The card the player holds (picked up to drag), or null. */
    held: CardSpot | null;
    /** Your bench's card slots while revealed: true = a card waits there. [] otherwise. */
    benchCards: boolean[];
  ```
  - In `buildView`'s returned object, after `phase: s.bench.phase,`:
  ```ts
      held: s.held,
      benchCards: s.bench.phase === "revealed" ? s.bench.cards.map((c) => c !== null) : [],
  ```

- [ ] **Step 4: The strings.** Add the table's keys to `i18n/en.ts` after `"brings.botSpeed"` (with a `// the tutorial (finish spec §4)` comment line above them) and the same keys to `i18n/ru.ts`. In `i18n/budgets.ts`, after `["shelf.", 20],`:
  ```ts
    ["tut.skip", 20],
    ["tut.ok", 8],
    ["tut.replay", 16], // a Settings button
    ["tut.", 60], // a bubble: at most 3 lines of 24 characters (ui/tutorialPlace.ts BUBBLE_CHARS)
    ["card.title", 24],
    ["card.tap", 24],
    ["card.", 150], // a new-run card's paragraph wraps inside the card
  ```
  The specific `tut.`/`card.` keys must come before their group (`budgetFor` takes the first match).

- [ ] **Step 5: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/game/view.test.ts src/modules/casecremental/i18n`
  Expected: PASS.

- [ ] **Step 6: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/game/view.ts src/modules/casecremental/game/view.test.ts src/modules/casecremental/i18n
  git commit -m "feat(tutorial): the view's held card and bench cards, and the tutorial's strings (EN + RU)

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 2: The step machine and its progress in prefs

**Files:**
- Create: `ui/tutorialRules.ts`, `ui/tutorialRules.test.ts`
- Modify: `ui/prefs.ts`, `ui/prefs.test.ts`

**Interfaces:**
- Consumes: `GameView` (with Task 1's `held`, `benchCards`, and F2's `autoSpin`), `SimEvent` (`sim/run.ts`), Task 1's string keys.
- Produces (`ui/tutorialRules.ts`):
  ```ts
  export const STEP_IDS: readonly ["buy", "key", "sell", "upgrades", "unlock", "bot", "seller", "autospin", "vault"];
  export type StepId = (typeof STEP_IDS)[number];
  export const NEW_RUN_CARDS: readonly number[]; // [2, 3, 4]
  export function cardText(run: number): StringKey;
  export interface TutorialProgress { done: StepId[]; off: boolean; cards: number[] }
  export const FRESH_TUTORIAL: TutorialProgress;
  export type TargetId = `case:${string}` | `upgrade:${string}` | "vault" | "wake" | "seller" | "autospin"
    | "tab:you" | "tab:bot" | "tab:machines" | "drawer:cases" | "drawer:upgrades" | "world:bench" | "world:card" | "world:bin";
  export interface ShownStep { id: StepId; text: StringKey; targets: TargetId[]; ok: boolean }
  export type Showing = { kind: "card"; run: number } | { kind: "step"; step: ShownStep };
  export function parseTutorial(raw: unknown): TutorialProgress | null;
  export function settle(p: TutorialProgress, v: GameView): TutorialProgress;     // same object when nothing changes
  export function afterEvent(p: TutorialProgress, e: SimEvent): TutorialProgress; // same object when nothing changes
  export function currentStep(p: TutorialProgress, v: GameView): ShownStep | null;
  export function whatToShow(p: TutorialProgress, v: GameView): Showing | null;
  export function acknowledge(p: TutorialProgress, id: StepId): TutorialProgress;
  export function skip(p: TutorialProgress): TutorialProgress;
  export function replay(p: TutorialProgress | null): TutorialProgress;
  export function closeCard(p: TutorialProgress, run: number): TutorialProgress;
  export function seed(v: GameView): TutorialProgress;
  ```
  `ui/prefs.ts`: `Prefs.tutorial: TutorialProgress | null` (`DEFAULT_PREFS.tutorial = null`).

- [ ] **Step 1: Write the failing tests.**

  `ui/tutorialRules.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { buildView } from "../game/view";
  import { freshMeta, setupFor } from "../sim/meta";
  import { Run } from "../sim/run";
  import {
    acknowledge,
    afterEvent,
    cardText,
    closeCard,
    currentStep,
    FRESH_TUTORIAL,
    NEW_RUN_CARDS,
    parseTutorial,
    replay,
    seed,
    settle,
    skip,
    whatToShow,
    type StepId,
    type TutorialProgress,
  } from "./tutorialRules";

  const P = (done: StepId[] = [], more: Partial<TutorialProgress> = {}): TutorialProgress => ({ done, off: false, cards: [], ...more });
  const step = (p: TutorialProgress, run: Run) => currentStep(p, buildView(run));
  const INTRO: StepId[] = ["buy", "key", "sell"];
  const reveal = (run: Run) => {
    run.buyCase("bootcamp");
    run.insertKey();
    for (let i = 0; i < 600 && run.state.bench.phase === "spinning"; i++) run.tick(1 / 30);
  };
  const runOf = (n: number) => new Run(1, setupFor({ ...freshMeta(), loops: n - 1 }));
  /** Every event so far, through afterEvent. */
  const feed = (p: TutorialProgress, run: Run) => run.drainEvents().reduce(afterEvent, p);

  describe("the tutorial's bench loop", () => {
    it("walks a new player through buy, key and sell, in order, each ending on the player's action", () => {
      const run = new Run(1);
      let p = seed(buildView(run));
      expect(p).toEqual(FRESH_TUTORIAL);
      expect(step(p, run)).toEqual({ id: "buy", text: "tut.buy", targets: ["case:bootcamp", "drawer:cases"], ok: false });
      run.buyCase("bootcamp");
      p = settle(p, buildView(run));
      expect(step(p, run)).toMatchObject({ id: "key", targets: ["world:bench"] });
      run.insertKey();
      p = settle(p, buildView(run));
      expect(step(p, run)).toBeNull(); // spinning: the sell bubble waits for the card
      for (let i = 0; i < 600 && run.state.bench.phase === "spinning"; i++) run.tick(1 / 30);
      expect(step(p, run)).toMatchObject({ id: "sell", targets: ["world:card"] });
      run.setHeld("bench", 0);
      expect(step(p, run)!.targets).toEqual(["world:bin"]); // the card is up: point at the bin
      run.sell(0);
      p = feed(p, run);
      expect(p.done).toEqual(INTRO);
    });

    it("holds every later step until the bench loop is done", () => {
      const run = new Run(1);
      run.state.cash = 1e12;
      expect(step(P(), run)).toMatchObject({ id: "buy" });
      expect(step(P(["buy"]), run)).toBeNull(); // the bench is empty: no key to turn, and nothing jumps the queue
    });

    it("ends step 3 however the card leaves the bench: the auto-seller's sale or a store to the tray (Review Focus 3)", () => {
      const run = new Run(1);
      run.state.cash = 1e12;
      run.buySeller();
      let p = P(["buy", "key"]);
      reveal(run); // no hand sale anywhere in this test: only the machine moves the card
      for (let i = 0; i < 900 && run.state.bench.phase === "revealed"; i++) run.tick(1 / 30);
      expect(run.state.bench.phase).not.toBe("revealed");
      p = feed(p, run);
      expect(p.done).toContain("sell");
    });
  });

  describe("the later steps", () => {
    it("wait until they can be done, then show in the spec's order, each pointing through its tab", () => {
      const run = new Run(1);
      run.state.cash = 0;
      const intro = P(INTRO);
      expect(step(intro, run)).toBeNull();
      run.state.cash = 1e12;
      const v = buildView(run);
      const cheapest = v.upgrades.filter((u) => u.canBuy).sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))[0]!;
      expect(step(intro, run)).toEqual({
        id: "upgrades",
        text: "tut.upgrades",
        targets: [`upgrade:${cheapest.id}`, "tab:you", "drawer:upgrades"],
        ok: false,
      });
      expect(step(P([...INTRO, "upgrades"]), run)).toMatchObject({ id: "unlock", targets: [`case:${v.cases[1]!.id}`, "drawer:cases"] });
      expect(step(P([...INTRO, "upgrades", "unlock"]), run)).toMatchObject({ id: "bot", targets: ["wake", "tab:bot", "drawer:upgrades"] });
      const toSeller = P([...INTRO, "upgrades", "unlock", "bot"]);
      expect(step(toSeller, run)).toMatchObject({ id: "seller", targets: ["seller", "tab:machines", "drawer:upgrades"] });
      // auto-spin needs the seller first (F2): with the seller's step passed but no seller, nothing is ready
      expect(step(P([...toSeller.done, "seller"]), run)).toBeNull();
      run.buySeller();
      expect(step(P([...toSeller.done, "seller"]), run)).toMatchObject({ id: "autospin", targets: ["autospin", "tab:machines", "drawer:upgrades"] });
      run.state.unlocked = [...run.runCases()];
      expect(step(P([...toSeller.done, "seller", "autospin"]), run)).toEqual({
        id: "vault",
        text: "tut.vault",
        targets: ["vault", "drawer:cases"],
        ok: true,
      });
    });

    it("shows a later step while earlier ones still wait for their condition", () => {
      const run = new Run(1);
      run.state.unlocked = [...run.runCases()]; // the vault is out
      run.state.cash = 0; // nothing affordable: upgrades, bot, seller and auto-spin all wait
      const p = P(INTRO);
      expect(step(p, run)).toMatchObject({ id: "vault" });
      run.state.cash = 1e12; // now the upgrades can be bought: the earlier step comes first again
      expect(step(p, run)).toMatchObject({ id: "upgrades" });
    });

    it("passes a step the player did before its bubble came up (Review Focus 2)", () => {
      const run = new Run(1);
      run.state.cash = 1e12;
      run.wakeBot();
      run.buySeller();
      const p = settle(P(INTRO), buildView(run));
      expect(p.done).toEqual([...INTRO, "bot", "seller"]);
      expect(settle(p, buildView(run))).toBe(p); // nothing new: the same object, so the overlay writes nothing
    });

    it("ends the vault's step on OK, or on buying the vault", () => {
      const p = P([...INTRO, "upgrades", "unlock", "bot", "seller", "autospin"]);
      expect(acknowledge(p, "vault").done).toContain("vault");
      expect(afterEvent(p, { type: "vaultBought", price: 1 }).done).toContain("vault");
    });

    it("shows nothing while the vault is out, after the run, or once skipped", () => {
      const run = new Run(1);
      run.state.cash = 1e15;
      run.state.unlocked = [...run.runCases()];
      expect(step(P(), run)).toMatchObject({ id: "buy" });
      expect(step(skip(P()), run)).toBeNull();
      run.buyVault();
      expect(buildView(run).vault.phase).toBe("key");
      expect(whatToShow(P(), buildView(run))).toBeNull();
      const over = new Run(1);
      over.state.over = true;
      expect(whatToShow(P(), buildView(over))).toBeNull();
    });
  });

  describe("progress", () => {
    it("seeds a returning player's progress from the save: no bench loop, no steps they did, no card for runs reached (Review Focus 1)", () => {
      const run = runOf(2);
      run.state.cash = 1e12;
      run.wakeBot();
      run.buySeller();
      const v = buildView(run);
      const p = seed(v);
      expect(p).toEqual({ done: [...INTRO, "bot", "seller"], off: false, cards: [2] });
      expect(whatToShow(p, v)).toMatchObject({ kind: "step", step: { id: "upgrades" } });
    });

    it("seeds a fresh save with nothing done", () => {
      expect(seed(buildView(new Run(1)))).toEqual(FRESH_TUTORIAL);
    });

    it("shows each new run's card once, before any bubble, even after Skip; Run 1 has none", () => {
      const v2 = buildView(runOf(2));
      expect(whatToShow(P(INTRO), v2)).toEqual({ kind: "card", run: 2 });
      expect(whatToShow(skip(P(INTRO)), v2)).toEqual({ kind: "card", run: 2 });
      expect(whatToShow(closeCard(P(INTRO), 2), v2)?.kind).not.toBe("card");
      expect(whatToShow(P(INTRO), buildView(runOf(3)))).toEqual({ kind: "card", run: 3 });
      expect(whatToShow(P(), buildView(new Run(1)))?.kind).toBe("step");
      expect(NEW_RUN_CARDS).toEqual([2, 3, 4]);
      expect([2, 3, 4].map(cardText)).toEqual(["card.run2", "card.run3", "card.run4"]); // Run 4's waits for F6
    });

    it("replays from the start but keeps the cards seen", () => {
      expect(replay({ done: [...INTRO, "bot"], off: true, cards: [2] })).toEqual({ done: [], off: false, cards: [2] });
      expect(replay(null)).toEqual(FRESH_TUTORIAL);
    });

    it("cleans up whatever prefs held", () => {
      expect(parseTutorial(undefined)).toBeNull();
      expect(parseTutorial("x")).toBeNull();
      expect(parseTutorial({ done: ["sell", "nope", "buy"], off: "yes", cards: [3, "x", 2, 2, -1, 1.5] })).toEqual({
        done: ["buy", "sell"],
        off: false,
        cards: [2, 3],
      });
      expect(parseTutorial({})).toEqual(FRESH_TUTORIAL);
    });
  });
  ```
  If `run.buyVault()` refuses (the bench must be empty, and the price must be affordable), check `sim/run.ts` and set up what it needs. The point of the test is that `vault.phase === "key"` hides everything.

  `ui/prefs.test.ts`:
  - Add `tutorial: null` to the two literal expectations: `{ lang: null, music: 1, sfx: DEFAULT_PREFS.sfx, tutorial: null }` and `{ lang: "ru", music: 0.2, sfx: 0, tutorial: null }`, and to the one in "remembers changes".
  - Add:
  ```ts
  it("remembers the tutorial's progress, cleaned up, and keeps it in memory when storage is blocked", () => {
    const s = memory();
    initPrefs(s, ["en"]);
    expect(getPrefs().tutorial).toBeNull(); // never stored: the overlay seeds it from the save
    setPrefs({ tutorial: { done: ["buy"], off: false, cards: [2] } });
    expect(parsePrefs(s.getItem(PREFS_KEY)).tutorial).toEqual({ done: ["buy"], off: false, cards: [2] });
    expect(parsePrefs('{"tutorial":{"done":["key","bogus"],"off":true}}').tutorial).toEqual({ done: ["key"], off: true, cards: [] });
    initPrefs(broken, ["en"]);
    setPrefs({ tutorial: { done: ["buy", "key"], off: false, cards: [] } });
    expect(getPrefs().tutorial?.done).toEqual(["buy", "key"]);
  });
  ```

- [ ] **Step 2: Run the tests to see them fail.**
  Run: `npx vitest run src/modules/casecremental/ui/tutorialRules.test.ts src/modules/casecremental/ui/prefs.test.ts`
  Expected: FAIL. `./tutorialRules` is missing, and prefs has no `tutorial`.

- [ ] **Step 3: Write `ui/tutorialRules.ts`.**
  ```ts
  import type { GameView, UpgradeView } from "../game/view";
  import type { StringKey } from "../i18n/en";
  import type { SimEvent } from "../sim/run";

  // The tutorial's coach (finish spec §4) as pure rules: nine steps, each a speech bubble pointing at the thing to
  // touch. A step ends when the player does it (an event, or the state shows it done), never on a timer. The bench loop
  // (buy, key, sell) runs in order; the later steps each wait until they can be done (affordable, the vault out) and the
  // first ready one shows. A new run's "what's new" card comes before any bubble. Progress lives in prefs (per browser),
  // not in the run save. The overlay (Tutorial.tsx) asks what to show and reports what happened.

  export const STEP_IDS = ["buy", "key", "sell", "upgrades", "unlock", "bot", "seller", "autospin", "vault"] as const;
  export type StepId = (typeof STEP_IDS)[number];

  /** The bench loop: in order, and nothing later shows before it is done. */
  const INTRO: readonly StepId[] = ["buy", "key", "sell"];

  /** Runs whose first start shows a "what's new" card. Run 4's can only trigger once F6 sets LAST_RUN = 4. */
  export const NEW_RUN_CARDS: readonly number[] = [2, 3, 4];

  const CARD_TEXT: Record<number, StringKey> = { 2: "card.run2", 3: "card.run3", 4: "card.run4" };

  /** A new run's card text. */
  export const cardText = (run: number): StringKey => CARD_TEXT[run] ?? "card.run2";

  export interface TutorialProgress {
    /** Steps finished, in STEP_IDS order. */
    done: StepId[];
    /** "Skip tutorial" was pressed: no more bubbles (the new-run cards still show). */
    off: boolean;
    /** Runs whose new-run card was closed. */
    cards: number[];
  }

  export const FRESH_TUTORIAL: TutorialProgress = { done: [], off: false, cards: [] };

  /** Where a bubble can point. DOM targets are elements marked `data-tut="<id>"`; world targets are props on the table. */
  export type TargetId =
    | `case:${string}`
    | `upgrade:${string}`
    | "vault"
    | "wake"
    | "seller"
    | "autospin"
    | "tab:you"
    | "tab:bot"
    | "tab:machines"
    | "drawer:cases"
    | "drawer:upgrades"
    | "world:bench"
    | "world:card"
    | "world:bin";

  export interface ShownStep {
    id: StepId;
    text: StringKey;
    /** Deepest first: the overlay points at the first one on screen (a row in a closed tab is not, so then its tab). */
    targets: TargetId[];
    /** The bubble has an OK button (the vault's step: buying the vault can be far off). */
    ok: boolean;
  }

  export type Showing = { kind: "card"; run: number } | { kind: "step"; step: ShownStep };

  interface StepDef {
    text: StringKey;
    /** It can be done now: show it. */
    ready(v: GameView): boolean;
    /** The state shows it done (a returning player, or one ahead of the coach). */
    doneBy?(v: GameView): boolean;
    /** This event is the player doing it. */
    doneOn?(e: SimEvent): boolean;
    targets(v: GameView): TargetId[];
  }

  const cheapestAffordable = (v: GameView): UpgradeView | null =>
    v.upgrades.reduce<UpgradeView | null>((best, u) => (u.canBuy && (best === null || (u.cost ?? 0) < (best.cost ?? 0)) ? u : best), null);
  const nextLocked = (v: GameView) => v.cases.find((c) => !c.unlocked) ?? null;
  const UPGRADES_TAB: TargetId[] = ["tab:you", "drawer:upgrades"];
  const MACHINES_TAB: TargetId[] = ["tab:machines", "drawer:upgrades"];

  const STEPS: Record<StepId, StepDef> = {
    buy: {
      text: "tut.buy",
      ready: (v) => v.phase === "empty" && v.cases.some((c) => c.canBuy),
      doneBy: (v) => v.phase !== "empty",
      targets: (v) => [`case:${(v.cases.find((c) => c.canBuy) ?? v.cases[0]!).id}`, "drawer:cases"],
    },
    key: {
      text: "tut.key",
      ready: (v) => v.phase === "locked",
      doneBy: (v) => v.phase === "spinning" || v.phase === "revealed",
      targets: () => ["world:bench"],
    },
    sell: {
      text: "tut.sell",
      ready: (v) => v.phase === "revealed",
      // sold by hand or by the auto-seller, or stored (the tray, the locker): the card left the bench
      doneOn: (e) => (e.type === "sold" || e.type === "stored" || e.type === "lockerStored") && e.from === "bench",
      targets: (v) => [v.held === "bench" ? "world:bin" : "world:card"],
    },
    upgrades: {
      text: "tut.upgrades",
      ready: (v) => cheapestAffordable(v) !== null,
      doneBy: (v) => v.upgrades.some((u) => u.level > 0),
      targets: (v) => {
        const u = cheapestAffordable(v);
        return u ? [`upgrade:${u.id}`, ...UPGRADES_TAB] : UPGRADES_TAB;
      },
    },
    unlock: {
      text: "tut.unlock",
      ready: (v) => nextLocked(v)?.canUnlock === true,
      doneBy: (v) => v.cases.filter((c) => c.unlocked).length > 1,
      targets: (v) => [`case:${(nextLocked(v) ?? v.cases[0]!).id}`, "drawer:cases"],
    },
    bot: { text: "tut.bot", ready: (v) => v.bot.canWake, doneBy: (v) => v.bot.awake, targets: () => ["wake", "tab:bot", "drawer:upgrades"] },
    seller: { text: "tut.seller", ready: (v) => v.seller.canBuy, doneBy: (v) => v.seller.on, targets: () => ["seller", ...MACHINES_TAB] },
    autospin: {
      text: "tut.autospin",
      ready: (v) => v.autoSpin.canBuy,
      doneBy: (v) => v.autoSpin.owned,
      targets: () => ["autospin", ...MACHINES_TAB],
    },
    vault: { text: "tut.vault", ready: (v) => v.vault.shown, doneOn: (e) => e.type === "vaultBought", targets: () => ["vault", "drawer:cases"] },
  };

  /** `p` with these steps done (in STEP_IDS order); `p` itself when none is new, so a caller can skip the write. */
  function withDone(p: TutorialProgress, ids: readonly StepId[]): TutorialProgress {
    const fresh = ids.filter((id) => !p.done.includes(id));
    if (!fresh.length) return p;
    const done = new Set([...p.done, ...fresh]);
    return { ...p, done: STEP_IDS.filter((id) => done.has(id)) };
  }

  /** Whatever prefs held → valid progress, or null (never stored: the overlay seeds it from the save). */
  export function parseTutorial(raw: unknown): TutorialProgress | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
    const done = list(o.done);
    const cards = list(o.cards).filter((n): n is number => Number.isInteger(n) && (n as number) > 0);
    return { done: STEP_IDS.filter((id) => done.includes(id)), off: o.off === true, cards: [...new Set(cards)].sort((a, b) => a - b) };
  }

  /** Steps the state already shows done join `done`. */
  export const settle = (p: TutorialProgress, v: GameView): TutorialProgress => withDone(p, STEP_IDS.filter((id) => STEPS[id].doneBy?.(v) === true));

  /** The player did something: the steps it completes join `done`. */
  export const afterEvent = (p: TutorialProgress, e: SimEvent): TutorialProgress => withDone(p, STEP_IDS.filter((id) => STEPS[id].doneOn?.(e) === true));

  /** The step's OK button. */
  export const acknowledge = (p: TutorialProgress, id: StepId): TutorialProgress => withDone(p, [id]);

  /** "Skip tutorial". */
  export const skip = (p: TutorialProgress): TutorialProgress => (p.off ? p : { ...p, off: true });

  /** Settings' "Replay tutorial": the coach from the start; the new-run cards seen stay seen. */
  export const replay = (p: TutorialProgress | null): TutorialProgress => ({ done: [], off: false, cards: [...(p?.cards ?? [])] });

  /** The new-run card was tapped away. */
  export const closeCard = (p: TutorialProgress, run: number): TutorialProgress =>
    p.cards.includes(run) ? p : { ...p, cards: [...p.cards, run].sort((a, b) => a - b) };

  /** A save that has played past the bench loop. */
  const experienced = (v: GameView): boolean =>
    v.run > 1 || v.upgrades.some((u) => u.level > 0) || v.cases.filter((c) => c.unlocked).length > 1 || v.bot.awake || v.seller.on;

  /** F3's first load in this browser: a save that has played on skips the bench loop and every step it shows done, and
   *  the runs it has reached have no card. A fresh save starts from nothing. */
  export function seed(v: GameView): TutorialProgress {
    const p = withDone(settle(FRESH_TUTORIAL, v), experienced(v) ? INTRO : []);
    return { ...p, cards: NEW_RUN_CARDS.filter((n) => n <= v.run) };
  }

  /** The bubble to show now, or null: the first bench-loop step not done (if it can be done now), else the first later
   *  step that is ready. Nothing while the vault is out, after the run, or once skipped. */
  export function currentStep(p: TutorialProgress, v: GameView): ShownStep | null {
    if (p.off || v.vault.phase !== null || v.over) return null;
    for (const id of STEP_IDS) {
      if (p.done.includes(id)) continue;
      const s = STEPS[id];
      if (s.ready(v)) return { id, text: s.text, targets: s.targets(v), ok: id === "vault" };
      if (INTRO.includes(id)) return null; // the bench loop goes in order
    }
    return null;
  }

  /** What the overlay shows: a new run's card first (once per run, even after Skip), else the current bubble. */
  export function whatToShow(p: TutorialProgress, v: GameView): Showing | null {
    if (v.vault.phase !== null || v.over) return null;
    if (NEW_RUN_CARDS.includes(v.run) && !p.cards.includes(v.run)) return { kind: "card", run: v.run };
    const step = currentStep(p, v);
    return step ? { kind: "step", step } : null;
  }
  ```
  If the TypeScript narrowing on `e.from` fails for an event type whose `from` is not a string union, write `"from" in e && e.from === "bench"`. If F2 renamed a view field (`autoSpin.canBuy`/`owned`), use F2's name.

- [ ] **Step 4: Prefs.** In `ui/prefs.ts`:
  - Add `import { parseTutorial, type TutorialProgress } from "./tutorialRules";`.
  - Header: "Per-player conveniences remembered in this browser (spec §8): language, the two volumes, and the tutorial's progress (finish spec §4)."
  - `Prefs` gains:
  ```ts
    /** The tutorial's progress; null = never stored (the overlay seeds it from the save). */
    tutorial: TutorialProgress | null;
  ```
  - `DEFAULT_PREFS = { lang: null, music: 0.6, sfx: 0.8, tutorial: null }`.
  - In `parsePrefs`'s returned object: `tutorial: parseTutorial(o.tutorial),`.

  `tutorialRules.ts` imports only types from `game/view`, `i18n/en` and `sim/run`, so the new import makes no cycle.

- [ ] **Step 5: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/ui`
  Expected: PASS.

- [ ] **Step 6: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/ui/tutorialRules.ts src/modules/casecremental/ui/tutorialRules.test.ts src/modules/casecremental/ui/prefs.ts src/modules/casecremental/ui/prefs.test.ts
  git commit -m "feat(tutorial): the step machine - nine steps, new-run cards, skip, replay, progress in prefs

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 3: Finding the target and placing the bubble (pure)

**Files:**
- Modify: `fx/camera.ts`, `fx/camera.test.ts`
- Create: `ui/tutorialTargets.ts`, `ui/tutorialTargets.test.ts`, `ui/tutorialPlace.ts`, `ui/tutorialPlace.test.ts`

**Interfaces:**
- Consumes: `TargetId` (Task 2), `tableLayout`, `revealSpots`, `ITEM_SIZE`, `Rect` (`fx/pixel/layout.ts`), `toScreen` (`fx/pixel/screen.ts`), `CameraState` (`fx/camera.ts`).
- Produces:
  ```ts
  // fx/camera.ts
  export function cameraPoint(s: CameraState, p: { x: number; y: number }): { x: number; y: number };
  // ui/tutorialTargets.ts
  export const isWorldTarget: (id: TargetId) => boolean;
  export function worldTargetRect(id: TargetId, l: TableLayout, benchCards: readonly boolean[]): Rect | null;
  export function worldToOverlay(r: Rect, scale: number, cam: CameraState): Rect;
  export function firstPresent(targets: readonly TargetId[], present: (id: TargetId) => boolean): TargetId | null;
  export function scrollDelta(row: { top: number; bottom: number }, box: { top: number; bottom: number }): number;
  // ui/tutorialPlace.ts
  export const BUBBLE_CHARS = 24;
  export type Side = "above" | "below" | "left" | "right";
  export interface Size { w: number; h: number }
  export interface PlaceOptions { gap: number; arrow: number; margin: number; portrait: boolean }
  export interface Placement { x: number; y: number; side: Side; arrowX: number; arrowY: number }
  export function placeBubble(target: Rect, bubble: Size, area: Size, o: PlaceOptions): Placement;
  export function arrowLook(side: Side, k: number): { rotate: string; bobX: number; bobY: number };
  export function samePlace(a: Placement | null, b: Placement | null): boolean;
  ```

How the existing UI anchors to the world: every DOM panel is placed at world px × `vp.scale` (`ui/parts.tsx` `Panel`, `ui/hooks.ts` `usePixelUi` → the same `tableLayout` the canvas uses). The canvas' HD layer uses the same mapping (`HdLayer.toScreen`, `fx/pixel/screen.ts` `toScreen`). The HUD and the panels sit in a "lens" div that the camera moves with `cameraCss` (zoom around a focus, then the shake). The tutorial's overlay sits outside the lens, because its DOM targets are measured with `getBoundingClientRect`, which already includes the camera. So a world target needs the camera applied by hand, and `cameraPoint` is that transform for a single point.

- [ ] **Step 1: Write the failing tests.**

  `fx/camera.test.ts`: import `cameraPoint` and add:
  ```ts
  it("puts a canvas point where the camera shows it, the same transform cameraCss gives the DOM (F3: the tutorial's arrow)", () => {
    expect(cameraPoint({ focusX: 0, focusY: 0, dx: 0, dy: 0, zoom: 1 }, { x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
    // translate(4px, -2px) scale(1.5) around (400, 300)
    expect(cameraPoint({ focusX: 400, focusY: 300, dx: 4, dy: -2, zoom: 1.5 }, { x: 500, y: 200 })).toEqual({ x: 554, y: 148 });
  });
  ```

  `ui/tutorialTargets.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { ITEM_SIZE, revealSpots, tableLayout, type Pt } from "../fx/pixel/layout";
  import { pixelViewport } from "../fx/pixel/viewport";
  import { firstPresent, isWorldTarget, scrollDelta, worldTargetRect, worldToOverlay } from "./tutorialTargets";
  import type { TargetId } from "./tutorialRules";

  const VIEWS: Array<[number, number]> = [[1920, 1080], [1280, 720], [1024, 768], [390, 844], [360, 640], [820, 1180]];
  const cardAt = (p: Pt) => ({ x: p.x - ITEM_SIZE.reveal.w / 2, y: p.y - ITEM_SIZE.reveal.h / 2, w: ITEM_SIZE.reveal.w, h: ITEM_SIZE.reveal.h });

  describe("world targets", () => {
    it.each(VIEWS)("sit on the table's props at %ix%i", (W, H) => {
      const l = tableLayout(pixelViewport(W, H));
      const c = l.you.caseSpot;
      expect(worldTargetRect("world:bench", l, [])).toEqual({ x: c.x - ITEM_SIZE.case.w / 2, y: c.y - ITEM_SIZE.case.h, w: ITEM_SIZE.case.w, h: ITEM_SIZE.case.h });
      expect(worldTargetRect("world:card", l, [])).toEqual(cardAt(l.you.reveal));
      expect(worldTargetRect("world:card", l, [true])).toEqual(cardAt(revealSpots(l, 1)[0]!));
      expect(worldTargetRect("world:card", l, [false, true])).toEqual(cardAt(revealSpots(l, 2)[1]!)); // the first card still waiting
      expect(worldTargetRect("world:bin", l, [])).toEqual({ x: l.bin.x - l.binR, y: l.bin.y - l.binR, w: 2 * l.binR, h: 2 * l.binR });
      expect(worldTargetRect("vault", l, [])).toBeNull();
    });

    it("tells world targets from DOM ones", () => {
      expect(isWorldTarget("world:bin")).toBe(true);
      expect(isWorldTarget("tab:you")).toBe(false);
    });

    it("maps a world rect onto the overlay through the pixel scale and the camera", () => {
      const r = { x: 10, y: 20, w: 4, h: 6 };
      expect(worldToOverlay(r, 6, { focusX: 0, focusY: 0, dx: 0, dy: 0, zoom: 1 })).toEqual({ x: 60, y: 120, w: 24, h: 36 });
      expect(worldToOverlay(r, 6, { focusX: 60, focusY: 120, dx: 3, dy: 0, zoom: 2 })).toEqual({ x: 63, y: 120, w: 48, h: 72 });
    });
  });

  describe("the target chain", () => {
    const chain: TargetId[] = ["upgrade:luck", "tab:you", "drawer:upgrades"];

    it("points at the deepest target on screen: the row, else its tab, else the drawer's tab (Review Focus 4)", () => {
      expect(firstPresent(chain, () => true)).toBe("upgrade:luck"); // the YOU tab is open
      expect(firstPresent(chain, (id) => id.startsWith("tab:"))).toBe("tab:you"); // desktop, the BOT tab open
      expect(firstPresent(chain, (id) => id === "drawer:upgrades")).toBe("drawer:upgrades"); // portrait, the CASES tab open
      expect(firstPresent(chain, () => false)).toBeNull();
    });
  });

  describe("scrollDelta", () => {
    it("scrolls a list just enough to show a row whole (Review Focus 5)", () => {
      const box = { top: 100, bottom: 300 };
      expect(scrollDelta({ top: 120, bottom: 160 }, box)).toBe(0);
      expect(scrollDelta({ top: 60, bottom: 100 }, box)).toBe(-40);
      expect(scrollDelta({ top: 290, bottom: 330 }, box)).toBe(30);
      expect(scrollDelta({ top: 250, bottom: 500 }, box)).toBe(150); // taller than the list: its top comes to the list's top
    });
  });
  ```

  `ui/tutorialPlace.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { tableLayout, type Rect } from "../fx/pixel/layout";
  import { hdFontSize } from "../fx/pixel/screen";
  import { pixelViewport } from "../fx/pixel/viewport";
  import { arrowLook, BUBBLE_CHARS, placeBubble, samePlace } from "./tutorialPlace";
  import { worldTargetRect, worldToOverlay } from "./tutorialTargets";

  const VIEWS: Array<[number, number]> = [[1920, 1080], [1280, 720], [1024, 768], [390, 844], [360, 640], [820, 1180]];
  const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const STILL = { focusX: 0, focusY: 0, dx: 0, dy: 0, zoom: 1 };

  /** The overlay's own numbers for a screen (Tutorial.tsx): the bubble at its widest and three lines tall. */
  function setup(W: number, H: number) {
    const vp = pixelViewport(W, H);
    const k = vp.scale;
    const fs = hdFontSize(k);
    const arrow = (fs * 7) / 8;
    return {
      vp,
      bubble: { w: Math.min(BUBBLE_CHARS * fs + 18 * k, W - 4 * k), h: 5 * fs + 18 * k },
      o: { gap: arrow + 2 * k, arrow, margin: 2 * k, portrait: vp.portrait },
    };
  }

  describe("placeBubble", () => {
    it("never covers its target or lets its arrow touch either, on any screen, wherever the target is (spec §4, Review Focus 4)", () => {
      for (const [W, H] of VIEWS) {
        const { vp, bubble, o } = setup(W, H);
        const l = tableLayout(vp);
        const world = (["world:bench", "world:card", "world:bin"] as const).map((id) => worldToOverlay(worldTargetRect(id, l, [])!, vp.scale, STILL));
        const targets: Rect[] = [
          ...world,
          { x: 0, y: 0, w: 40, h: 20 },
          { x: W - 40, y: H - 20, w: 40, h: 20 },
          { x: W / 2 - 20, y: H / 2 - 10, w: 40, h: 20 },
          { x: 0, y: H - 30, w: W, h: 30 }, // a full-width drawer tab row
          { x: W / 2 - 10, y: 0, w: 20, h: H }, // taller than the screen: no side fits
        ];
        for (const t of targets) {
          const p = placeBubble(t, bubble, { w: W, h: H }, o);
          const box = { x: p.x, y: p.y, ...bubble };
          const a = { x: p.arrowX, y: p.arrowY, w: o.arrow, h: o.arrow };
          const at = `${W}x${H} ${JSON.stringify(t)}`;
          expect(overlaps(box, t), at).toBe(false);
          expect(overlaps(a, t), at).toBe(false);
          expect(overlaps(a, box), at).toBe(false);
          if (vp.portrait) expect(["above", "below"], at).toContain(p.side);
        }
      }
    });

    it("prefers above, then below, and stays inside the overlay when it fits", () => {
      const { bubble, o } = setup(1920, 1080);
      const area = { w: 1920, h: 1080 };
      const mid = placeBubble({ x: 900, y: 500, w: 120, h: 60 }, bubble, area, o);
      expect(mid.side).toBe("above");
      expect(mid.y + bubble.h).toBe(500 - o.gap);
      const top = placeBubble({ x: 900, y: 10, w: 120, h: 60 }, bubble, area, o);
      expect(top.side).toBe("below");
      for (const p of [mid, top]) {
        expect(p.x).toBeGreaterThanOrEqual(o.margin);
        expect(p.x + bubble.w).toBeLessThanOrEqual(area.w - o.margin);
      }
      // a target at the right edge: the bubble slides left to fit, the arrow still under the target
      const edge = placeBubble({ x: 1880, y: 500, w: 40, h: 40 }, bubble, area, o);
      expect(edge.x + bubble.w).toBeLessThanOrEqual(area.w - o.margin);
      expect(edge.arrowX + o.arrow / 2).toBeGreaterThan(edge.x + bubble.w - o.arrow * 1.5);
    });

    it("turns to the sides on landscape when above and below are full, never on portrait", () => {
      const { bubble, o } = setup(1920, 1080);
      const tall = { x: 900, y: 0, w: 120, h: 1080 };
      expect(["left", "right"]).toContain(placeBubble(tall, bubble, { w: 1920, h: 1080 }, o).side);
      const phone = setup(390, 844);
      expect(["above", "below"]).toContain(placeBubble({ x: 180, y: 0, w: 30, h: 844 }, phone.bubble, { w: 390, h: 844 }, phone.o).side);
    });
  });

  describe("the arrow", () => {
    it("turns its down-pointing glyph toward the target and bobs one world pixel toward it", () => {
      expect(arrowLook("above", 6)).toEqual({ rotate: "0deg", bobX: 0, bobY: 6 });
      expect(arrowLook("below", 6)).toEqual({ rotate: "180deg", bobX: 0, bobY: -6 });
      expect(arrowLook("left", 6)).toEqual({ rotate: "-90deg", bobX: 6, bobY: 0 });
      expect(arrowLook("right", 6)).toEqual({ rotate: "90deg", bobX: -6, bobY: 0 });
    });

    it("re-places only when something moved a whole pixel", () => {
      const p = { x: 10.2, y: 20, side: "above" as const, arrowX: 30, arrowY: 40 };
      expect(samePlace(p, { ...p, x: 10.4 })).toBe(true);
      expect(samePlace(p, { ...p, x: 11 })).toBe(false);
      expect(samePlace(p, { ...p, side: "below" })).toBe(false);
      expect(samePlace(null, null)).toBe(true);
      expect(samePlace(p, null)).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run the tests to see them fail.**
  Run: `npx vitest run src/modules/casecremental/fx/camera.test.ts src/modules/casecremental/ui/tutorialTargets.test.ts src/modules/casecremental/ui/tutorialPlace.test.ts`
  Expected: FAIL. The modules and `cameraPoint` are missing.

- [ ] **Step 3: `cameraPoint`.** In `fx/camera.ts`, after `cameraCss`:
  ```ts
  /** A canvas point (screen px) where the camera shows it: the transform cameraCss gives the DOM, for one point
   *  (finish spec §4: the tutorial points at props on the table from outside the camera's lens). */
  export function cameraPoint(s: CameraState, p: { x: number; y: number }): { x: number; y: number } {
    return { x: s.focusX + (p.x - s.focusX) * s.zoom + s.dx, y: s.focusY + (p.y - s.focusY) * s.zoom + s.dy };
  }
  ```

- [ ] **Step 4: `ui/tutorialTargets.ts`.**
  ```ts
  import { cameraPoint, type CameraState } from "../fx/camera";
  import { ITEM_SIZE, revealSpots, type Rect, type TableLayout } from "../fx/pixel/layout";
  import { toScreen } from "../fx/pixel/screen";
  import type { TargetId } from "./tutorialRules";

  // Finding the tutorial's target on the overlay (finish spec §4). A prop on the table is a world rect from the table
  // layout, where fx/pixel/Bench.ts draws it, mapped like everything on the canvas: world px × the pixel scale
  // (fx/pixel/screen.ts toScreen), then the camera's zoom and shake (fx/camera.ts cameraPoint, the transform the HUD and
  // panels get through cameraCss). A DOM target is an element marked data-tut; its list scrolls to show it.

  export const isWorldTarget = (id: TargetId): boolean => id.startsWith("world:");

  /** The prop a world target means, in world px: the case on your mat (its lock takes the key), the first bench card
   *  still waiting, or the sell bin's mouth (its drop circle). Null for a DOM target. */
  export function worldTargetRect(id: TargetId, l: TableLayout, benchCards: readonly boolean[]): Rect | null {
    switch (id) {
      case "world:bench": {
        const c = l.you.caseSpot; // actors stand on their spot: the case's bottom centre
        const { w, h } = ITEM_SIZE.case;
        return { x: c.x - w / 2, y: c.y - h, w, h };
      }
      case "world:card": {
        const slot = Math.max(0, benchCards.indexOf(true));
        const p = revealSpots(l, Math.max(1, benchCards.length))[slot] ?? l.you.reveal;
        const { w, h } = ITEM_SIZE.reveal;
        return { x: p.x - w / 2, y: p.y - h / 2, w, h };
      }
      case "world:bin":
        return { x: l.bin.x - l.binR, y: l.bin.y - l.binR, w: 2 * l.binR, h: 2 * l.binR };
      default:
        return null;
    }
  }

  /** A world rect on the overlay (CSS px from its top-left), through the pixel scale and the camera. */
  export function worldToOverlay(r: Rect, scale: number, cam: CameraState): Rect {
    const a = toScreen({ scale }, r.x, r.y);
    const b = toScreen({ scale }, r.x + r.w, r.y + r.h);
    const p = cameraPoint(cam, a);
    const q = cameraPoint(cam, b);
    return { x: p.x, y: p.y, w: q.x - p.x, h: q.y - p.y };
  }

  /** The first target on screen, deepest first: a row inside a closed tab is not rendered, so its tab is next. */
  export function firstPresent(targets: readonly TargetId[], present: (id: TargetId) => boolean): TargetId | null {
    return targets.find(present) ?? null;
  }

  /** How far to scroll a list so a row shows whole (0 = it does; negative scrolls up). A row taller than the list
   *  brings its top to the list's top. */
  export function scrollDelta(row: { top: number; bottom: number }, box: { top: number; bottom: number }): number {
    if (row.top < box.top) return row.top - box.top;
    if (row.bottom > box.bottom) return Math.min(row.bottom - box.bottom, row.top - box.top);
    return 0;
  }
  ```

- [ ] **Step 5: `ui/tutorialPlace.ts`.**
  ```ts
  import type { Rect } from "../fx/pixel/layout";

  // Where the tutorial's bubble and arrow go (finish spec §4): beside the target, never over it, inside the overlay
  // where they fit; on portrait only above or below. Overlay CSS px throughout. Pure: Tutorial.tsx measures, this places.

  /** A bubble's text is at most this many characters wide (Press Start 2P: a character is the font size wide), so every
   *  tutorial line wraps into 3 lines (i18n.test.ts); ui/styles.ts .cc-tut uses the same number. */
  export const BUBBLE_CHARS = 24;

  export type Side = "above" | "below" | "left" | "right";
  export interface Size {
    w: number;
    h: number;
  }
  export interface PlaceOptions {
    /** Space between the bubble and its target; the arrow sits in it. */
    gap: number;
    /** The arrow's square box (smaller than the gap). */
    arrow: number;
    /** Kept clear at the overlay's edges. */
    margin: number;
    portrait: boolean;
  }
  export interface Placement {
    x: number;
    y: number;
    side: Side;
    /** The arrow box's top-left. */
    arrowX: number;
    arrowY: number;
  }

  /** v within [lo, hi]; lo when the range is empty (a bubble wider than the overlay keeps its margin). */
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

  /** Above, else below, else (landscape) left, else right: the first side where the bubble fits inside the overlay; if
   *  none fits, the side with the most room. The cross axis only slides, so the bubble never comes over the target. */
  export function placeBubble(target: Rect, bubble: Size, area: Size, o: PlaceOptions): Placement {
    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;
    const across = (c: number, size: number, room: number) => clamp(c - size / 2, o.margin, room - o.margin - size);
    const at = (side: Side): { x: number; y: number } => {
      switch (side) {
        case "above":
          return { x: across(cx, bubble.w, area.w), y: target.y - o.gap - bubble.h };
        case "below":
          return { x: across(cx, bubble.w, area.w), y: target.y + target.h + o.gap };
        case "left":
          return { x: target.x - o.gap - bubble.w, y: across(cy, bubble.h, area.h) };
        case "right":
          return { x: target.x + target.w + o.gap, y: across(cy, bubble.h, area.h) };
      }
    };
    const fits = (q: { x: number; y: number }) =>
      q.x >= o.margin - 0.5 && q.y >= o.margin - 0.5 && q.x + bubble.w <= area.w - o.margin + 0.5 && q.y + bubble.h <= area.h - o.margin + 0.5;
    const sides: Side[] = o.portrait ? ["above", "below"] : ["above", "below", "left", "right"];
    const room: Record<Side, number> = { above: target.y, below: area.h - target.y - target.h, left: target.x, right: area.w - target.x - target.w };
    const side = sides.find((s) => fits(at(s))) ?? sides.reduce((a, b) => (room[b] > room[a] ? b : a));
    const p = at(side);
    const mid = (o.gap - o.arrow) / 2; // the arrow centred in the gap
    const along = (c: number, start: number, size: number) => clamp(c - o.arrow / 2, start, start + size - o.arrow);
    const arrow =
      side === "above"
        ? { arrowX: along(cx, p.x, bubble.w), arrowY: target.y - o.gap + mid }
        : side === "below"
          ? { arrowX: along(cx, p.x, bubble.w), arrowY: target.y + target.h + mid }
          : side === "left"
            ? { arrowX: target.x - o.gap + mid, arrowY: along(cy, p.y, bubble.h) }
            : { arrowX: target.x + target.w + mid, arrowY: along(cy, p.y, bubble.h) };
    return { ...p, side, ...arrow };
  }

  /** The arrow glyph points down: how each side turns it toward the target, and its bob (one world px, k CSS px, toward
   *  the target; motion only, no light change). */
  export function arrowLook(side: Side, k: number): { rotate: string; bobX: number; bobY: number } {
    switch (side) {
      case "above":
        return { rotate: "0deg", bobX: 0, bobY: k };
      case "below":
        return { rotate: "180deg", bobX: 0, bobY: -k };
      case "left":
        return { rotate: "-90deg", bobX: k, bobY: 0 };
      case "right":
        return { rotate: "90deg", bobX: -k, bobY: 0 };
    }
  }

  /** Two placements that draw the same (to the whole pixel): the overlay re-renders only when one moved. */
  export function samePlace(a: Placement | null, b: Placement | null): boolean {
    if (!a || !b) return a === b;
    const r = Math.round;
    return a.side === b.side && r(a.x) === r(b.x) && r(a.y) === r(b.y) && r(a.arrowX) === r(b.arrowX) && r(a.arrowY) === r(b.arrowY);
  }
  ```
  The 0.5 px tolerance in `fits` absorbs fractional DOM rects. The arrow ends `mid` (one world px) short of the target, and its bob covers exactly that, so it touches but never overlaps.

- [ ] **Step 6: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/fx/camera.test.ts src/modules/casecremental/ui`
  Expected: PASS. If the "taller than the screen" case fails the arrow test on a side, check `mid > 0`: `gap` must exceed `arrow`.

- [ ] **Step 7: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/fx/camera.ts src/modules/casecremental/fx/camera.test.ts src/modules/casecremental/ui/tutorialTargets.ts src/modules/casecremental/ui/tutorialTargets.test.ts src/modules/casecremental/ui/tutorialPlace.ts src/modules/casecremental/ui/tutorialPlace.test.ts
  git commit -m "feat(tutorial): find the target (table props through the scale and camera, data-tut marks) and place the bubble beside it

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 4: The overlay — marks, bubble, arrow, new-run card, Replay

**Files:**
- Create: `ui/Tutorial.tsx`, `ui/NewRunCard.tsx`, `ui/tutorialMarks.test.ts`
- Modify: `ui/parts.tsx`, `ui/CaseShelf.tsx`, `ui/Drawer.tsx`, `ui/UpgradesBoard.tsx`, `ui/BotPanel.tsx`, `ui/MachinesPanel.tsx`, `ui/AutoSpinRows.tsx`, `ui/Settings.tsx`, `ui/GamePanel.tsx`, `ui/styles.ts`, `ui/styles.test.ts`

**Interfaces:**
- Consumes: everything Tasks 1–3 produce; `usePrefs` (`ui/hooks.ts`), `getPrefs`/`setPrefs` (`ui/prefs.ts`), `PixelUi` (`ui/hooks.ts`), `Camera` (`fx/camera.ts`), `popElement` (`fx/hd/tween.ts`), `frameCss`/`uiSpriteUrl` (`ui/pixelFrame.ts`), `GameController.onEvent`.
- Produces: `PxButton`'s `tut?: string` prop (renders `data-tut`); `PixelArrow()`; `Tutorial({ view, ui, camera, root, onEvent, visible })`; `NewRunCard({ run, onClose })`.

- [ ] **Step 1: Write the failing tests.**

  `ui/tutorialMarks.test.ts` keeps the rules' target ids and the panels' marks in step:
  ```ts
  import { describe, expect, it } from "vitest";

  // The tutorial finds its DOM targets by data-tut (ui/tutorialRules.ts TargetId); a mark lost in a panel edit would
  // leave a bubble with nothing to point at, so the panels' sources must keep every mark.
  const SOURCES = import.meta.glob("./*.tsx", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
  const all = Object.values(SOURCES).join("\n");

  describe("the tutorial's marks in the panels", () => {
    it.each([
      'tut="vault"',
      'tut="wake"',
      'tut="seller"',
      'tut="autospin"',
      'tut="drawer:cases"',
      'tut="drawer:upgrades"',
      "tut={`tab:${id}`}",
      "tut={`case:${c.id}`}",
      "tut={`upgrade:${u.id}`}",
    ])("%s", (mark) => expect(all).toContain(mark));

    it("renders a mark as data-tut", () => expect(SOURCES["./parts.tsx"]).toContain("data-tut={props.tut}"));
  });
  ```
  `ui/styles.test.ts`, add:
  ```ts
  it("gives the tutorial a bubble that lets drags through and an arrow that only moves (F3, photosensitivity)", () => {
    const bubble = rule(".cc-tut");
    expect(bubble).toContain("pointer-events: none");
    expect(bubble).toContain(`${BUBBLE_CHARS}em`);
    expect(rule(".cc-tut .cc-btn")).toContain("pointer-events: auto");
    const arrow = rule(".cc-tut-arrow");
    expect(arrow).not.toContain("opacity");
    expect(arrow).toContain("animation: cc-tut-bob");
    const bob = UI_CSS.slice(UI_CSS.indexOf("@keyframes cc-tut-bob"), UI_CSS.indexOf("@media (prefers-reduced-motion"));
    expect(bob).toContain("translate:");
    expect(bob).not.toMatch(/opacity|filter|background|color/);
    expect(UI_CSS).toContain("@media (prefers-reduced-motion: reduce) { .cc-tut-arrow { animation: none; } }");
  });
  ```
  (with `import { BUBBLE_CHARS } from "./tutorialPlace";`).

- [ ] **Step 2: Run the tests to see them fail.**
  Run: `npx vitest run src/modules/casecremental/ui/tutorialMarks.test.ts src/modules/casecremental/ui/styles.test.ts`
  Expected: FAIL. No marks yet, and no `.cc-tut` rule.

- [ ] **Step 3: `parts.tsx`.**
  - `PxButton`'s props gain `/** A tutorial target id (ui/tutorialRules.ts TargetId): rendered as data-tut. */ tut?: string;`, and the `<button>` gets `data-tut={props.tut}` (after `title`).
  - After `PixelTick`:
  ```tsx
  const ARROW_RUNS = glyphRuns(["..###..", "..###..", "..###..", "#######", ".#####.", "..###..", "...#..."]);

  /** The tutorial's arrow, pointing down (Tutorial.tsx turns it toward its target). */
  export function PixelArrow(): ReactNode {
    return <PixelGlyph runs={ARROW_RUNS} size={7} />;
  }
  ```
  Update the header's list: "…a framed panel placed over a world-pixel rect, the settings gear and the tutorial's arrow."

- [ ] **Step 4: The marks.** One prop on each existing `PxButton`:
  - `ui/CaseShelf.tsx` `CaseRow`: the BUY button and the UNLOCK button both get ``tut={`case:${c.id}`}``. `VaultRow`'s BUY gets `tut="vault"`.
  - `ui/Drawer.tsx`: the CASES tab gets `tut="drawer:cases"`, the UPGRADES tab `tut="drawer:upgrades"`.
  - `ui/UpgradesBoard.tsx`: the tab buttons get ``tut={`tab:${id}`}``. `UpgradeRow`'s buy button (the non-null cost branch) gets ``tut={`upgrade:${u.id}`}``.
  - `ui/BotPanel.tsx`: the WAKE button gets `tut="wake"`.
  - `ui/MachinesPanel.tsx` `SellerRows`: the BUY button (the `!s.on` branch) gets `tut="seller"`.
  - `ui/AutoSpinRows.tsx` (F2): the BUY button (the `!a.owned` branch) gets `tut="autospin"`.

- [ ] **Step 5: The CSS.** In `ui/styles.ts`, import `BUBBLE_CHARS` from `./tutorialPlace` and append inside `UI_CSS`. The bubble's border-box adds 18 world px of frame and padding (6 + 3 per side), so the text gets its full `BUBBLE_CHARS` characters:
  ```ts
  .cc-tut { position: absolute; display: grid; width: max-content; max-width: min(calc(${BUBBLE_CHARS}em + var(--px) * 18px), calc(100% - var(--px) * 4px)); pointer-events: none; }
  .cc-tut .cc-btn { pointer-events: auto; }
  .cc-tut .cc-row-line { flex-wrap: wrap; justify-content: flex-end; }
  .cc-tut-arrow { position: absolute; pointer-events: none; color: #ffd34d; line-height: 0; animation: cc-tut-bob 1s step-end infinite; }
  @keyframes cc-tut-bob { 50% { translate: var(--bob-x) var(--bob-y); } }
  @media (prefers-reduced-motion: reduce) { .cc-tut-arrow { animation: none; } }
  ```
  Add to the header: "The tutorial's bubble lets drags through (only its buttons take the pointer); its arrow bobs a world pixel, motion only."

- [ ] **Step 6: `ui/NewRunCard.tsx`.**
  ```tsx
  import { useContext, useEffect, useRef, type ReactNode } from "react";
  import { popElement } from "../fx/hd/tween";
  import { t } from "../i18n/index";
  import { UiEnvContext } from "./parts";
  import { frameCss, uiSpriteUrl } from "./pixelFrame";
  import { cardText } from "./tutorialRules";

  // The first time Run 2, 3 or 4 starts (finish spec §4): one card says what is new. One tap anywhere closes it.

  export function NewRunCard({ run, onClose }: { run: number; onClose: () => void }): ReactNode {
    const { scale, click } = useContext(UiEnvContext);
    const box = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (box.current) popElement(box.current);
    }, []);
    return (
      <div
        className="cc-modal"
        onClick={() => {
          click();
          onClose();
        }}
      >
        <div
          ref={box}
          role="dialog"
          aria-label={t("card.title", { n: run })}
          style={{ display: "grid", gap: 3 * scale, padding: 4 * scale, width: "min(92vw, 30em)", ...frameCss(uiSpriteUrl("ui-frame"), scale) }}
        >
          <div className="cc-title">{t("card.title", { n: run })}</div>
          <div>{t(cardText(run))}</div>
          <div className="cc-dim" style={{ textAlign: "center" }}>
            {t("card.tap")}
          </div>
        </div>
      </div>
    );
  }
  ```
  `onClick`, not `onPointerDown`: the press lands on the modal, and the canvas under it never sees a pointerdown.

- [ ] **Step 7: `ui/Tutorial.tsx`.**
  ```tsx
  import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
  import type { Camera } from "../fx/camera";
  import { popElement } from "../fx/hd/tween";
  import type { Rect } from "../fx/pixel/layout";
  import type { GameView } from "../game/view";
  import { t } from "../i18n/index";
  import type { SimEvent } from "../sim/run";
  import { usePrefs, type PixelUi } from "./hooks";
  import { NewRunCard } from "./NewRunCard";
  import { PixelArrow, PxButton } from "./parts";
  import { frameCss, uiSpriteUrl } from "./pixelFrame";
  import { getPrefs, setPrefs } from "./prefs";
  import { arrowLook, placeBubble, samePlace, type Placement } from "./tutorialPlace";
  import { acknowledge, afterEvent, closeCard, seed, settle, skip, whatToShow, type ShownStep, type TargetId, type TutorialProgress } from "./tutorialRules";
  import { firstPresent, isWorldTarget, scrollDelta, worldTargetRect, worldToOverlay } from "./tutorialTargets";

  // The tutorial on screen (finish spec §4): a speech bubble with a pixel arrow at the thing to touch, or a new run's
  // "what's new" card. tutorialRules decides what shows and when a step ends; this finds the target every frame (a DOM
  // element marked data-tut, or a prop on the table through the pixel scale and the camera) and places the bubble
  // beside it, never over it. It sits outside the camera's lens: DOM rects already include the camera.

  type OnEvent = (fn: (e: SimEvent) => void) => () => void;

  /** Change the stored progress; no write when nothing changed. */
  function update(change: (p: TutorialProgress) => TutorialProgress): void {
    const cur = getPrefs().tutorial;
    if (!cur) return;
    const next = change(cur);
    if (next !== cur) setPrefs({ tutorial: next });
  }

  export function Tutorial({
    view,
    ui,
    camera,
    root,
    onEvent,
    visible,
  }: {
    view: GameView;
    ui: PixelUi;
    camera: Camera;
    root: RefObject<HTMLDivElement | null>;
    onEvent: OnEvent;
    /** False while Settings is open or the panels are fading back in. */
    visible: boolean;
  }): ReactNode {
    const p = usePrefs().tutorial;
    useEffect(() => {
      if (getPrefs().tutorial === null) setPrefs({ tutorial: seed(view) }); // F3's first load in this browser: from the save
    }, []);
    useEffect(() => update((cur) => settle(cur, view)), [view]);
    useEffect(() => onEvent((e) => update((cur) => afterEvent(cur, e))), []);
    if (!p || !visible) return null;
    const show = whatToShow(p, view);
    if (!show) return null;
    if (show.kind === "card") return <NewRunCard run={show.run} onClose={() => update((cur) => closeCard(cur, show.run))} />;
    return <Bubble key={show.step.id} step={show.step} view={view} ui={ui} camera={camera} root={root} />;
  }

  /** The arrow's box: 7/8 of a character (the glyph is 7 cells of an 8-px font cell). */
  const arrowSize = (ui: PixelUi) => (ui.fs * 7) / 8;

  /** The DOM target's element if it is on screen (a closed tab's rows are not rendered; a hidden one has no size). */
  function shownMark(host: HTMLElement, id: TargetId): HTMLElement | null {
    const el = host.querySelector<HTMLElement>(`[data-tut="${id}"]`);
    return el && el.offsetWidth > 0 && el.offsetHeight > 0 ? el : null;
  }

  /** Scroll the row's list (never the overflow-hidden panels, as scrollIntoView would) so the row shows whole. */
  function showInList(el: HTMLElement): void {
    const list = el.closest<HTMLElement>(".cc-scroll");
    if (!list) return;
    const a = el.getBoundingClientRect();
    const b = list.getBoundingClientRect();
    list.scrollTop += scrollDelta({ top: a.top, bottom: a.bottom }, { top: b.top, bottom: b.bottom });
  }

  function Bubble({
    step,
    view,
    ui,
    camera,
    root,
  }: {
    step: ShownStep;
    view: GameView;
    ui: PixelUi;
    camera: Camera;
    root: RefObject<HTMLDivElement | null>;
  }): ReactNode {
    const box = useRef<HTMLDivElement>(null);
    const latest = useRef({ step, view, ui });
    latest.current = { step, view, ui };
    const [place, setPlace] = useState<Placement | null>(null);
    useEffect(() => {
      if (box.current) popElement(box.current);
    }, []);
    // every frame: the target moves with the camera, a resize, a scroll, a tab switch or a language switch
    useEffect(() => {
      let raf = 0;
      let scrolledTo: TargetId | null = null;
      const frame = () => {
        raf = requestAnimationFrame(frame);
        const host = root.current;
        const el = box.current;
        if (!host || !el) return;
        const { step, view, ui } = latest.current;
        const origin = host.getBoundingClientRect();
        const id = firstPresent(step.targets, (x) => isWorldTarget(x) || shownMark(host, x) !== null);
        let target: Rect | null = null;
        if (id && isWorldTarget(id)) {
          const r = worldTargetRect(id, ui.l, view.benchCards);
          target = r && worldToOverlay(r, ui.vp.scale, camera.current);
        } else if (id) {
          const mark = shownMark(host, id)!;
          if (scrolledTo !== id) {
            scrolledTo = id; // once per target: the player may scroll the list themselves afterwards
            showInList(mark);
          }
          const r = mark.getBoundingClientRect();
          target = { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
        }
        const k = ui.vp.scale;
        const next = target
          ? placeBubble(
              target,
              { w: el.offsetWidth, h: el.offsetHeight },
              { w: origin.width, h: origin.height },
              { gap: arrowSize(ui) + 2 * k, arrow: arrowSize(ui), margin: 2 * k, portrait: ui.vp.portrait },
            )
          : null;
        setPlace((prev) => (samePlace(prev, next) ? prev : next));
      };
      frame();
      return () => cancelAnimationFrame(raf);
    }, []);
    const k = ui.vp.scale;
    const look = place ? arrowLook(place.side, k) : null;
    return (
      <>
        <div
          ref={box}
          className="cc-tut"
          role="status"
          style={{
            left: place?.x ?? 0,
            top: place?.y ?? 0,
            visibility: place ? "visible" : "hidden", // measured before it is placed
            gap: 2 * k,
            padding: 3 * k,
            ...frameCss(uiSpriteUrl("ui-frame"), k),
          }}
        >
          <div>{t(step.text)}</div>
          <div className="cc-row-line">
            <PxButton onClick={() => update(skip)}>{t("tut.skip")}</PxButton>
            {step.ok ? <PxButton onClick={() => update((cur) => acknowledge(cur, step.id))}>{t("tut.ok")}</PxButton> : null}
          </div>
        </div>
        {place && look ? (
          <div
            className="cc-tut-arrow"
            style={
              {
                left: place.arrowX,
                top: place.arrowY,
                width: arrowSize(ui),
                height: arrowSize(ui),
                rotate: look.rotate,
                "--bob-x": `${look.bobX}px`,
                "--bob-y": `${look.bobY}px`,
              } as CSSProperties
            }
          >
            <PixelArrow />
          </div>
        ) : null}
      </>
    );
  }
  ```
  Notes for the implementer:
  - The rAF loop and `latest` keep a single effect alive for the bubble's life. `view` changes ten times a second, and restarting the loop on each change would be waste.
  - `offsetWidth`/`offsetHeight` are layout sizes, so the pop's scale tween does not skew the measurement.
  - The arrow is a sibling of the bubble in the overlay, not its child, so the bubble's border never offsets it.
  - Keep the file under ~200 lines. If it grows past that, move `shownMark`/`showInList` into `ui/tutorialTargets.ts` (they touch the DOM, so they stay untested there).

- [ ] **Step 8: Wire it into `ui/GamePanel.tsx`.**
  - Imports: `import type { SimEvent } from "../sim/run";` and `import { Tutorial } from "./Tutorial";`.
  - In `makeGamePanel`, next to `act`: `const onEvent = (fn: (e: SimEvent) => void) => controller.onEvent(fn);`
  - In `GamePanel`, after `const hidden = …`:
  ```tsx
      // the tutorial comes back after the panels do (a new run's lights), at once on a reload
      const tutorialBack = useDelayedFlag(!hidden, (wasOff) => (wasOff ? (UI_BACK_S + 0.6) * 1000 : 0));
  ```
  - Render it right after the lens `<div ref={lens} …>…</div>` closes and before `{prestigeShown && …}`, so Prestige and Settings draw over it:
  ```tsx
            <Tutorial view={view} ui={ui} camera={camera} root={root} onEvent={onEvent} visible={tutorialBack && !settings && !soundBoard} />
  ```
  - Header: add "the tutorial's bubbles and new-run cards over everything but Settings".

- [ ] **Step 9: Replay in `ui/Settings.tsx`.** Import `getPrefs` beside `setPrefs` from `./prefs`, and `replay` from `./tutorialRules`. Add before the dev buttons:
  ```tsx
        <PxButton
          onClick={() => {
            setPrefs({ tutorial: replay(getPrefs().tutorial) });
            onClose();
          }}
        >
          {t("tut.replay")}
        </PxButton>
  ```
  Header: "Settings: language (EN / RU, remembered), the music and sound volumes, and Replay tutorial."

- [ ] **Step 10: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/ui`
  Expected: PASS.

- [ ] **Step 11: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS). If `rotate` or the CSS custom properties fail the `CSSProperties` type, keep the `as CSSProperties` cast on the whole object as written. If `import.meta.glob` with `?raw` is not picked up by Vitest, read the files with `node:fs` (`readFileSync(new URL("./CaseShelf.tsx", import.meta.url), "utf8")` per file) instead.
  ```bash
  git add src/modules/casecremental/ui
  git commit -m "feat(tutorial): the coach on screen - bubbles with a pixel arrow, new-run cards, Skip and Replay (EN + RU)

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 5: In the browser, then the notes

This is the browser check at the end of the phase (spec §11), done with the scratch harness in `.superpowers/harness/` as in F1's Task 7. Everything under `.superpowers/` is gitignored scratch. Only the feature-history docs are committed.

**Files:**
- Modify (scratch, not committed): `.superpowers/harness/harness.tsx`
- Use (scratch): `.superpowers/harness/cdp.mjs`, `h.sh` (`E` eval, `S` shot, `Z` zoomed shot, `P` phone shot, into `.superpowers/harness/shots/`). `cdp.mjs` needs Node ≥ 22.
- Modify: `docs/feature-history/casecremental-finish.md` (created by F1 Task 7, extended by F2), `docs/feature-history/README.md`
- No product code unless a check fails. A fix goes into the owning task's files, with a test where the rule is pure, and is committed on its own as `fix(tutorial): …`.

- [ ] **Step 1: The checks pass.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build`
  Expected: PASS.

- [ ] **Step 2: Tutorial presets in the harness (scratch).** The harness calls `initPrefs(null, …)`, so the prefs start fresh on every load and the tutorial seeds from the run the harness builds. Right after its `if (q.get("lang") === "ru") setPrefs({ lang: "ru" });` line, add:
  ```ts
  // F3: ?tut=off, or ?tut=buy,key,sell (steps already done); without it the tutorial seeds from the fresh run
  const tut = q.get("tut");
  if (tut === "off") setPrefs({ tutorial: { done: [], off: true, cards: [2, 3, 4] } });
  else if (tut) setPrefs({ tutorial: { done: tut.split(",") as never, off: false, cards: [] } });
  ```
  Keep the harness's other parameters (`state`, `cash`, `n`, `seller`, `tray`, `freeze`) as F1 and F2 left them.

- [ ] **Step 3: Start the dev server and Chrome (Bash).**
  ```bash
  cd /c/Users/rainbow/dev/hackatons/solanaidos
  npm run dev   # run_in_background: true; serves on port 5180
  "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9333 \
    --user-data-dir="$(cygpath -w "$TEMP")\\cc-f3-chrome" --use-angle=swiftshader --enable-unsafe-swiftshader \
    --window-size=1920,1080 "http://localhost:5180/.superpowers/harness/index.html?state=empty"   # run_in_background: true
  source .superpowers/harness/h.sh
  H="http://localhost:5180/.superpowers/harness/index.html"
  ```
  Wait until `E "window.done"` prints `true`. If `$D size` does not take in headless mode, use `P <name> 390 844 1500` for the portrait shots (`pshot` resizes the viewport, and the live overlay re-places the bubble).

- [ ] **Step 4: Every step, EN and RU, desktop and portrait.** Define the states, then loop:
  ```bash
  I="buy,key,sell"
  shoot() { # $1 name, $2 query, $3 optional js to run before the shot
    $D nav "$H?$2" 3000; [ -n "$3" ] && E "$3" >/dev/null && sleep 0.5; S "f3-$1"
  }
  UNLOCK_ALL="cc.controller.run.state.unlocked = cc.controller.run.runCases(); cc.controller.devAddCash(0)"
  for lang in en ru; do for sz in "1920 1080" "390 844"; do
    $D size $sz; tag="$lang-${sz/ /x}"
    shoot "1-buy-$tag"      "lang=$lang&state=empty"
    shoot "2-key-$tag"      "lang=$lang&state=locked&tut=buy"
    shoot "3-card-$tag"     "lang=$lang&state=revealed&tut=buy,key"
    shoot "3-bin-$tag"      "lang=$lang&state=revealed&tut=buy,key" "cc.controller.act({type:'holdCard',spot:'bench',slot:0})"
    shoot "4-upgrades-$tag" "lang=$lang&state=empty&cash=1000000000&tut=$I"
    shoot "5-unlock-$tag"   "lang=$lang&state=empty&cash=1000000000&tut=$I,upgrades"
    shoot "6-bot-$tag"      "lang=$lang&state=empty&cash=1000000000&tut=$I,upgrades,unlock"
    shoot "7-seller-$tag"   "lang=$lang&state=empty&cash=1000000000&tut=$I,upgrades,unlock,bot"
    shoot "8-autospin-$tag" "lang=$lang&state=empty&cash=1000000000&seller=milspec&tut=$I,upgrades,unlock,bot,seller"
    shoot "9-vault-$tag"    "lang=$lang&state=empty&cash=1000000000&seller=milspec&tut=$I,upgrades,unlock,bot,seller,autospin" "$UNLOCK_ALL"
  done; done
  $D size 1920 1080
  ```
  For the steps behind a tab, also shoot the second hop. On desktop, step 6 first points at the BOT tab: `E "document.querySelector('[data-tut=\"tab:bot\"]').click()"`, then shoot again, and the arrow should be on WAKE. Do the same for step 7 with `tab:machines`. On portrait, step 4 first points at the drawer's UPGRADES tab: click `drawer:upgrades`, and the arrow moves to the upgrade row.

  For every DOM step, measure that the bubble does not cover its target:
  ```bash
  E "(() => { const b = document.querySelector('.cc-tut').getBoundingClientRect(); const a = document.querySelector('.cc-tut-arrow').getBoundingClientRect(); const hit = (r) => r.left < b.right && b.left < r.right && r.top < b.bottom && b.top < r.bottom; const marks = [...document.querySelectorAll('[data-tut]')].filter((e) => e.offsetWidth && hit(e.getBoundingClientRect())).map((e) => e.dataset.tut); return JSON.stringify({ bubble: [b.left, b.top, b.width, b.height].map(Math.round), arrow: [a.left, a.top].map(Math.round), covers: marks }); })()"
  ```
  Expected: `covers` never contains the step's current target (other marks may be covered).

  Pass criteria. Look at every PNG with the Read tool:
  - Each bubble shows its step's text in the right language, wraps into at most 3 lines and has a Skip button (step 9 also has OK).
  - The gold pixel arrow sits between the bubble and the target and points at it: the shelf's first case, the case on the mat, the card, then the bin, the upgrade row or its tab, the next case's UNLOCK, WAKE or the BOT tab, the seller's BUY or the MACHINES tab, auto-spin's BUY, and the vault row.
  - On portrait every bubble is above or below its target.
  - No bubble runs off the screen where there is room.
  - The world-target bubbles track their prop during a camera move. Shoot step 3 again 0.1 s after the reveal (a Covert drop zooms the camera), or force one with `cc.controller.run.forceNextRarity('covert')` before `state=revealed` if the harness exposes it.

- [ ] **Step 5: The actions advance it, never a timer.** At 1920×1080, on a fresh `?state=empty&cash=500` load, play the loop by hand through the harness:
  1. Click the shelf's BUY. The bubble moves to the case on the mat.
  2. `E "cc.controller.act({type:'insertKey'})"`. The bubble disappears while the reel spins, then points at the card.
  3. Sell it with `cc.controller.act({type:'sell'})`. The bubble goes away (no upgrade is affordable at $500).
  4. Wait 10 s. Nothing appears on its own.
  5. `devAddCash` past the cheapest upgrade. The upgrades bubble appears; buy it and the bubble moves on.

  Then check the controls:
  - Press **Skip tutorial**. Every bubble is gone.
  - Open Settings and press **REPLAY TUTORIAL**. Settings closes and "Tap a case to buy it" comes back on an empty bench.
  - Switch to RU in Settings with a bubble up. The text changes, and the bubble re-places to its new width.
  - Resize 1920×1080 → 390×844 → 1280×720 with the upgrades bubble up. It follows the target: the left panel's row on desktop, the drawer's UPGRADES tab on portrait.
  - Drag a card to the bin under a bubble. The drag works (the bubble lets it through).

- [ ] **Step 6: New-run cards.** On `?state=empty&tut=buy,key,sell`:
  1. `E "cc.controller.devStartRun(2)"`. The Run 2 card shows; shoot it in EN and RU at both sizes.
  2. One click anywhere closes it. `devStartRun(2)` again does not show it a second time.
  3. Do the same with `devStartRun(3)`.

  Run 4's card cannot trigger before F6 (`LAST_RUN = 3`). Its strings are covered by the i18n tests; say so in the notes.

  Then a returning player. Reload with `?save=1`, play into Run 2 with the bot awake (`devStartRun(2)`, `devAddCash`, Bot tab → WAKE), then clear only the tutorial with `localStorage.removeItem('casecremental:prefs')` and reload with `?save=1`. Expected: no "Tap a case", no Run 2 card and no wake bubble. The harness's `initPrefs(null)` means the seed reads the save's run; if `save=1` short-circuits the state setup, that is what you want here.

- [ ] **Step 7: The console is clean.** Run `$D console` (or `E "JSON.stringify(window.ccLogs)"`). Expected: no new errors and no React warnings about keys or effects. The PixiJS "textureSource destroyed while still bound" warning on a resize predates M3.

- [ ] **Step 8: Write the notes.** In `docs/feature-history/casecremental-finish.md`, add a section `## F3 — tutorial (2026-10-12)` (with this plan in the header's Plans list) holding what the code does not show:
  - progress lives in prefs, per browser, so a new browser or a cleared storage teaches again; the run save is untouched;
  - the bench loop runs in order, and steps 4–9 are independent, each waiting for its condition; why (a strict chain stalls when a player skips the auto-seller before the vault);
  - a step ends on an event or the state, never a timer; step 3 ends however the card leaves the bench; step 9 has OK because the vault can be far off;
  - "Wake the bot" points at WAKE, not the sprite (tapping the bot does nothing);
  - the target chain (row → tab → drawer tab), and that the DOM marks are `data-tut` on `PxButton` (`tut` prop), kept in step by `tutorialMarks.test.ts`;
  - world targets: `tableLayout` × scale × `cameraPoint`. The overlay sits outside the camera's lens because DOM rects already include the camera;
  - seeding on F3's first load (returning players skip what they did), Skip vs Replay (Skip keeps the cards; Replay keeps the cards seen);
  - Run 4's card text is written, and F6 must keep `card.run4`'s RU case names in step with `content.ts`;
  - anything the browser pass turned up.

  In `docs/feature-history/README.md`, extend the existing `casecremental-finish.md` line's gist with "; F3: tutorial (coach bubbles, new-run cards)".

- [ ] **Step 9: Commit the notes.**
  ```bash
  git add docs/feature-history/casecremental-finish.md docs/feature-history/README.md
  git commit -m "docs(feature-history): F3 - tutorial

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

## Self-review notes (spec §4 coverage)

| Spec §4 item | Covered in |
|---|---|
| A coach for first-time players, EN and RU | Tasks 1 (strings), 2 (rules), 4 (overlay) |
| Skippable | Task 2 `skip`, Task 4 the bubble's Skip button |
| Replayable from Settings ("Replay tutorial") | Task 2 `replay`, Task 4 Settings |
| Stored in prefs (per browser), not the run save | Task 2 `Prefs.tutorial` |
| Steps 1–9 with their targets | Task 2 `STEPS` (targets), Task 3 (world rects, chain), Task 4 (marks) |
| Advance on the player's action, never a timer | Task 2 `settle`/`afterEvent` (no clock anywhere), Task 5 Step 5 |
| Later steps wait for their condition | Task 2 `ready`, "wait until they can be done…" |
| Speech bubble with a pixel arrow at the target | Task 3 `placeBubble`/`arrowLook`, Task 4 `Bubble`/`PixelArrow` |
| New-run cards for Runs 2, 3, 4; one tap closes | Task 1 strings, Task 2 `whatToShow`/`closeCard`, Task 4 `NewRunCard` |
| A bubble never covers its target; portrait above/below | Task 3 placement sweep, Task 5 the DOM measurement |
| Players with progress skip done steps (planner's brief) | Task 2 `seed`, Review Focus 1 |
| Photosensitivity | Task 4 the CSS test (motion only, reduced-motion off) |
