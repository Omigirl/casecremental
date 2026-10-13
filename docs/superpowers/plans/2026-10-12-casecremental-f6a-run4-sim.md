# Casecremental F6-A — Run 4: the Sim, the Content and the Machines rows — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Run 4 playable in the sim and on the Machines tab: cases 8–9 (Glitch, Fever Dream), `LAST_RUN = 4` with its content row, The Last Case as Run 4's vault, the Loaded Dice charm, the Upgrader, the five evolutions, the campaign stats the credits need, and Run 4's pacing.

**Architecture:** Everything new in the sim lives in new files written as functions over `RunCtx`, like the bot, the seller and auto-spin: `sim/content/casesRun4.ts`, `sim/upgrader.ts`, `sim/evolved.ts` (the evolution state and the small effect hooks other machines call) and `sim/evolutions.ts` (recipes, purchase, the tick). `sim/run.ts` only gets wiring lines: state fields, two tick calls, the Slot Machine width, the Hot Hand luck and the best drop. To keep `run.ts` from growing, the new actions are **not** `Run` methods; the controller, the agent and the greedy player call the sim functions with the `Run` as the `RunCtx`. The view gets its own file (`game/viewRun4.ts`), and the Machines tab gets `ui/UpgraderRows.tsx` and `ui/EvolutionRows.tsx`. The save stays at F2's version 5: every new field has a safe default filled in by `normalize`.

**Tech Stack:** TypeScript (strict), React 19, Vitest, Vite 8.

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-finish-design.md` §7 (binding), with §1 (phases), §5 (pacing targets, the 90 s rule), §6 (the credits track comes from F5) and §11 (testing). Before Task 1 read `docs/feature-history/casecremental-runs-2-3.md` (how Runs 2–3 were added: `RUN_CONTENT`, the locker, charm pools, `VAULT_GROWTH`) and the F2 plan's header (`docs/superpowers/plans/2026-10-12-casecremental-f2-autospin.md`).

**This plan is the first of three for F6.** F6-B (`2026-10-12-casecremental-f6b-run4-screen.md`) draws the new finishes, the case art, the Upgrader's dial, the evolutions' looks and stage 5. F6-C (`2026-10-12-casecremental-f6c-last-case.md`) draws The Last Case, the credits and the end of the prestige screen. Two things in this plan are **interim on purpose** and are replaced by those plans; each is marked "interim" where it is written:
- the six new pattern kinds share one plain finish until F6-B Task 1;
- The Last Case uses Vault III's chest and fanfare, and its prestige title reads "VAULT IV OPENED", until F6-C.

**F2–F5 land before this plan.** F2 removed the auto-buyer grid and added auto-spin (`sim/autoSpin.ts`, `RunState.autoSpin`, save v5). F3 added the tutorial (its Run 4 new-run card is F3's). F4 retuned every run (new numbers in `sim/tuning.ts`, a CASUAL timing profile in `sim/bot.ts`, new pacing tests). F5 added music loops and a `credits` track. Before Task 1, re-read these files as they are now: `sim/tuning.ts`, `sim/run.ts`, `sim/runTypes.ts`, `sim/autoSpin.ts`, `sim/bot.ts`, `sim/pacing.test.ts`, `game/save.ts`, `game/view.ts`, `game/viewMachines.ts`, `game/controller.ts`, `game/agent.ts`, `ui/MachinesPanel.tsx`. **Keep F4's numbers**: where this plan shows a whole `RUN_CONTENT` row or tuning block for Runs 1–3, copy F4's values and change only what the step names. Where a snippet below quotes code that F2–F5 changed, apply the same change to the code as it is now.

## Global Constraints

- Every player-facing string exists in EN (`i18n/en.ts`) and RU (`i18n/ru.ts`), or in both halves of a `content.ts` pair, and fits its `i18n/budgets.ts` budget. Russian has exactly the English keys (`i18n.test.ts`). Russian text wraps only at whole words: a single Russian word must fit the narrowest column it is shown in (11 characters on a panel row, `upgrade.name.` 12), and no string relies on a break inside a word.
- Photosensitivity hard rules: every full-screen flash goes through the flash gate (`FlashGate`, at most 3 a second); a light that pulses on the beat changes by less than 0.1. (This plan draws nothing; the rule binds F6-B and F6-C.)
- Balance numbers live only in `sim/tuning.ts`. The numbers below are starting points; Task 8 tunes them against the pacing tests.
- Stations draw from sim state every frame and take events only for one-shot juice. Every new sim state that the screen will draw (the Upgrader's spin, the evolutions) is in `RunState` and saved, so a reload shows the same picture and never replays a beat.
- File size (IDOS.md): when a change adds a new responsibility to a file past ~400 lines, that part goes in its own file. `sim/run.ts` (~520 lines after F2) gets wiring lines only, no new methods; `fx/World.ts` (~540) is not touched by this plan.
- `ui/` imports from `fx/` only (never the other way); `sim/` imports nothing from `fx/`, `ui/` or `game/`.
- Match the module's code style: a header comment per file saying what it is and why, doc comments on exported names, the same comment density as the neighbours, `ActionResult` with lowercase `fail("reason")` messages and `OK`, 2-space Prettier formatting (`npm run format`).
- Every commit keeps these green: `npm run typecheck`, `npx vitest run src/modules/casecremental`, `npm run build`.
- Commit messages look like `feat(run4): …` and end with these two lines (after a blank line):
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```
- Stage files by path. Never stage `docs/todo.md` or the `{…}.png` files in the repo root. Stay on branch `casecremental-finish`. Do not edit `src/modules.ts`, `src/config.ts`, `src/idos.title.ts` or `idos.modules.lock.json`.
- The SDK is npm packages: never invent an SDK API. This plan needs none.

## Review Focus

The five conditions most likely to bite a player that the spec does not spell out. Each one has its test in the owning task.

1. **A reload in the middle of an Upgrader spin.** The player expects the same outcome, never a reroll. The roll and the result are made at GO and saved. Test: Task 3, "ends a spin the same way after a reload".
2. **Buying The Last Case while the Upgrader spins.** The vault takes the screen; a won skin must not vanish and the run must not break. `buyVault` settles the spin: a win is cashed in like the locker's waiting results, a loss is gone. Test: Task 3, "settles a running spin when the vault is bought".
3. **The staked rarity empties before GO** (the auto contract pressed it, or the player dragged it out). GO refuses with "nothing to stake" and keeps the stake picked. Test: Task 3, "refuses an empty stake and keeps it picked".
4. **Slot Machine with little cash, then a reload.** A BUY opens as many as you can afford (at least one), and a save holding a ten-case bench loads (a bench of 10 was a "corrupt save" before). Tests: Task 4, "opens ten per BUY, or as many as you can afford" (`sim/evolutions.test.ts`) and "a ten-case bench survives the save" (`game/save.test.ts`).
5. **An F2-era v5 save** (no `upgrader`, `evolutions`, `best`, `meta.stats`, `meta.credits`). It loads with fresh defaults and no crash. Tests: Task 3, Task 4 and Task 5 each add their fields' default test in `game/save.test.ts`.

---

## File map

All paths are relative to `src/modules/casecremental/` unless they start with `docs/`.

| File | Task | Responsibility |
|---|---|---|
| `sim/types.ts` | 1 | six pattern kinds, two pattern motions |
| `sim/content/casesRun4.ts` (create), `sim/content/cases.ts`, `cases.test.ts` | 1 | Glitch and Fever Dream |
| `fx/skins/patterns.ts`, `fx/skins/motion.ts`, `fx/skins/motion.test.ts` | 1 | interim finish for the new kinds; the two motions drift |
| `i18n/content.ts`, `i18n/content.test.ts` | 1, 2 | case, skin, charm and vault names |
| `sim/tuning.ts` | 1–4, 8 | every number |
| `sim/campaign.test.ts`, `sim/content/vaults.ts`, `vaults.test.ts` | 2 | `LAST_RUN = 4`, The Last Case |
| `sim/charms.ts`, `charms.test.ts` | 2 | Loaded Dice, the Run 4 pool |
| `fx/vault/vaultLooks.ts`, `vaultLooks.test.ts` | 2 | interim look for `lastcase` (the type requires one) |
| `ui/prestigeRules.ts`, `prestigeRules.test.ts`, `ui/Settings.tsx`, `game/controller.ts` | 2 | Run 4's brings, the dev Run 4 button |
| `sim/upgrader.ts` (create, + test), `sim/locker.ts`, `sim/vault.ts` | 3 | the Upgrader |
| `sim/evolved.ts`, `sim/evolutions.ts` (create, + tests), `sim/botOpener.ts`, `sim/autoSeller.ts`, `sim/autoSpin.ts` | 4 | evolutions and their effects |
| `sim/run.ts`, `sim/runTypes.ts`, `game/save.ts`, `save.test.ts` | 3, 4, 5 | wiring, state, events, defaults |
| `sim/meta.ts`, `meta.test.ts`, `game/controller.ts` | 5 | campaign stats, the credits flag |
| `game/viewRun4.ts` (create), `game/view.ts`, `game/controller.ts`, `game/agent.ts` (+ tests) | 6 | the surface |
| `ui/UpgraderRows.tsx`, `ui/EvolutionRows.tsx`, `ui/run4Rules.ts` (create, + test), `ui/MachinesPanel.tsx`, `i18n/en.ts`, `ru.ts`, `budgets.ts` | 7 | the Machines rows |
| `sim/bot.ts`, `sim/pacing.test.ts` | 2, 8 | the pacing players and Run 4's targets |

---

### Task 1: Glitch and Fever Dream (cases 8 and 9)

Two new cases on the ladder, 13 skins each like every other case (5 Mil-Spec, 3 Restricted, 2 Classified, 2 Covert, a ★ knife; the spec's "14 skins" is resolved to the 13 every case has and `cases.test.ts` pins). Every skin moves, like Run 3's. Each case uses three new pattern kinds that no earlier case uses: Glitch `datamosh`, `scanline`, `rgbsplit`; Fever Dream `melt`, `kaleido`, `huecycle`. Two new pattern motions name what F6-B draws: `glitch` (stutters: holds, then jumps) and `drip` (runs downward). `LAST_RUN` is still 3 after this task, so no run's shelf changes yet (`runCaseIds(3)` takes the first seven).

**Files:**
- Create: `sim/content/casesRun4.ts`
- Modify: `sim/types.ts`, `sim/content/cases.ts`, `sim/content/cases.test.ts`, `sim/tuning.ts` (`CASE_ECONOMY`), `fx/skins/patterns.ts`, `fx/skins/motion.ts`, `fx/skins/motion.test.ts`, `i18n/content.ts`, `i18n/i18n.test.ts` (only if it pins the case count)

**Interfaces:**
- Produces: `PatternKind` gains `"datamosh" | "scanline" | "rgbsplit" | "melt" | "kaleido" | "huecycle"`; `PatternMotion` gains `"glitch" | "drip"`; `RUN4_CASES: readonly CaseDef[]` (ids `glitch`, tier 8, and `feverdream`, tier 9); skin ids `gl_*`, `fd_*`.
- F6-B Task 1 consumes the kinds and motions and replaces the interim finish.

- [ ] **Step 1: Write the failing tests** in `sim/content/cases.test.ts`.
  - "has seven cases in ladder order" becomes:
  ```ts
  it("has nine cases in ladder order", () => {
    expect(CASES.map((c) => c.id)).toEqual([
      "bootcamp", "wildwood", "bedrock", "mainframe", "neon", "deepspace", "inferno", "glitch", "feverdream",
    ]);
    CASES.forEach((c, i) => expect(c.tier).toBe(i + 1));
  });
  ```
  - In "moves more in each later case" add:
  ```ts
    expect(moving("glitch")).toBe(13);
    expect(moving("feverdream")).toBe(13);
  ```
  - Add:
  ```ts
  it("gives Glitch and Fever Dream their own finishes and motions", () => {
    const kinds = (id: string) => new Set(caseById(id).skins.map((s) => s.pattern.kind));
    expect(kinds("glitch")).toEqual(new Set(["datamosh", "scanline", "rgbsplit"]));
    expect(kinds("feverdream")).toEqual(new Set(["melt", "kaleido", "huecycle"]));
    for (const s of caseById("glitch").skins) expect(s.motion?.pattern, s.id).toBe("glitch");
    for (const s of caseById("feverdream").skins) expect(["drip", "flow"], s.id).toContain(s.motion?.pattern);
    for (const id of ["glitch", "feverdream"]) expect(caseById(id).skins.find((x) => x.rarity === "gold")?.motion?.weapon).toBe("flip");
  });
  ```
  In `fx/skins/motion.test.ts`, extend the list in "%s moves the finish but never the outline" to `["flow", "shimmer", "pulse", "sparkle", "rise", "glitch", "drip"]`.

- [ ] **Step 2: Run the tests to see them fail.**
  Run: `npx vitest run src/modules/casecremental/sim/content/cases.test.ts`
  Expected: FAIL (seven cases; `caseById("glitch")` throws "unknown case: glitch").

- [ ] **Step 3: Add the kinds and motions to `sim/types.ts`.** After the Inferno block of `PatternKind`:
  ```ts
    // Glitch
    | "datamosh"
    | "scanline"
    | "rgbsplit"
    // Fever Dream
    | "melt"
    | "kaleido"
    | "huecycle";
  ```
  and change `PatternMotion`, with its doc comment:
  ```ts
  /** A moving finish (spec: animated skins §4; `rise`: M3 spec §3; `glitch` and `drip`: finish spec §7.1). */
  export type PatternMotion = "flow" | "shimmer" | "pulse" | "sparkle" | "rise" | "glitch" | "drip";
  ```

- [ ] **Step 4: Write `sim/content/casesRun4.ts`.**
  ```ts
  import type { CaseDef } from "../types";
  import { p, skin } from "./skinHelpers";

  // Run 4: cases 8–9 (glitch, fever dream), finish spec §7.1 — every skin moves. Glitch stutters (`glitch`: holds,
  // then jumps); Fever Dream melts (`drip`) or turns (`flow`).

  const gl = { pattern: "glitch", fps: 8 } as const;
  const drip = { pattern: "drip", fps: 6 } as const;
  const flow = { pattern: "flow", fps: 6 } as const;

  const glitch: CaseDef = {
    id: "glitch",
    name: "Glitch Case",
    theme: "glitch",
    tier: 8,
    color: "#0b0f14",
    skins: [
      skin("gl_deadpixel", "Dead Pixel", "rifle", "milspec", p("datamosh", ["#05070a", "#1c2430", "#3a6a7a", "#d0f0ff"], 5, 711), gl),
      skin("gl_compression", "Compression", "pistol", "milspec", p("datamosh", ["#0a0a0a", "#2b2b38", "#6a5acd", "#e6e6fa"], 6, 712), gl),
      skin("gl_static", "Static", "smg", "milspec", p("scanline", ["#080808", "#303030", "#8a8a8a", "#f0f0f0"], 6, 713), gl),
      skin("gl_buffer", "Buffer Underrun", "shotgun", "milspec", p("scanline", ["#050510", "#14143a", "#3f51b5", "#c5cae9"], 5, 714), gl),
      skin("gl_404", "Error 404", "mg", "milspec", p("rgbsplit", ["#0a0a0a", "#262626", "#ff0040", "#00e5ff"], 5, 715), gl),
      skin("gl_vhs", "VHS Rewind", "rifle", "restricted", p("scanline", ["#0d0221", "#3b0a57", "#ff2a6d", "#05d9e8"], 6, 721), gl),
      skin("gl_tear", "Screen Tear", "heavyPistol", "restricted", p("rgbsplit", ["#000000", "#1b1b2f", "#e43f5a", "#00fff0"], 6, 722), gl),
      skin("gl_corrupt", "Corrupted", "sniper", "restricted", p("datamosh", ["#020202", "#0f3d0f", "#39ff14", "#e6ffe6"], 5, 723), gl),
      skin("gl_chroma", "Chromatic", "smg", "classified", p("rgbsplit", ["#000000", "#2d0036", "#ff00c8", "#00ffea", "#ffffff"], 5, 731), gl),
      skin("gl_mosh", "Datamosh", "shotgun", "classified", p("datamosh", ["#000000", "#3a0ca3", "#f72585", "#4cc9f0", "#ffffff"], 4, 732), gl),
      skin("gl_fatal", "Fatal Exception", "rifle", "covert", p("scanline", ["#000428", "#0040ff", "#00b4ff", "#e0f7ff", "#ffffff"], 5, 741), gl),
      skin("gl_null", "Null Pointer", "sniper", "covert", p("rgbsplit", ["#000000", "#140014", "#ff1744", "#00e676", "#ffffff"], 6, 742), gl),
      skin("gl_knife", "Segfault", "knife", "gold", p("datamosh", ["#0a0014", "#4a00e0", "#00f0ff", "#ffd700", "#ffffff"], 6, 751), {
        ...gl,
        weapon: "flip",
        fps: 6,
      }),
    ],
  };

  const feverdream: CaseDef = {
    id: "feverdream",
    name: "Fever Dream Case",
    theme: "fever",
    tier: 9,
    color: "#2a0a3a",
    skins: [
      skin("fd_lullaby", "Lullaby", "rifle", "milspec", p("melt", ["#1a0b2e", "#4a2a6a", "#b892ff", "#ffe6fa"], 5, 811), drip),
      skin("fd_wax", "Candle Wax", "pistol", "milspec", p("melt", ["#1a0f05", "#5a3410", "#ffb347", "#fff4d6"], 6, 812), drip),
      skin("fd_glass", "Stained Glass", "smg", "milspec", p("kaleido", ["#0a0a1a", "#1f4e79", "#c0392b", "#f1c40f"], 5, 813), flow),
      skin("fd_sherbet", "Sherbet", "shotgun", "milspec", p("huecycle", ["#ff9a8b", "#ffd36e", "#a8e6cf", "#c3aed6"], 4, 814), flow),
      skin("fd_softclock", "Soft Clock", "mg", "milspec", p("melt", ["#2b1b0e", "#8c5a2b", "#e8c07d", "#fdf3e1"], 5, 815), drip),
      skin("fd_mirrors", "Hall of Mirrors", "rifle", "restricted", p("kaleido", ["#05050f", "#2e1a47", "#9b59b6", "#f5e6ff"], 6, 821), flow),
      skin("fd_lavalamp", "Lava Lamp", "heavyPistol", "restricted", p("melt", ["#14001f", "#5c0f4a", "#ff4f9a", "#ffd166"], 5, 822), drip),
      skin("fd_halo", "Halo", "sniper", "restricted", p("huecycle", ["#ffd6e0", "#c1fba4", "#7bf1a8", "#90f1ef"], 5, 823), flow),
      skin("fd_kaleido", "Kaleidoscope", "smg", "classified", p("kaleido", ["#0b0033", "#ff006e", "#ffbe0b", "#3a86ff", "#ffffff"], 5, 831), flow),
      skin("fd_rainbow", "Rainbow Road", "shotgun", "classified", p("huecycle", ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"], 5, 832), flow),
      skin("fd_lucid", "Lucid Dream", "rifle", "covert", p("kaleido", ["#000000", "#3c096c", "#ff4d6d", "#ffd60a", "#ffffff"], 6, 841), flow),
      skin("fd_feverpitch", "Fever Pitch", "sniper", "covert", p("huecycle", ["#ff0054", "#ff5400", "#ffbd00", "#00f5d4", "#9b5de5"], 6, 842), flow),
      skin("fd_knife", "Daydream", "knife", "gold", p("kaleido", ["#1a0033", "#ff77e9", "#7af8ff", "#fff59d", "#ffffff"], 6, 851), {
        ...flow,
        weapon: "flip",
      }),
    ],
  };

  export const RUN4_CASES: readonly CaseDef[] = [glitch, feverdream];
  ```

- [ ] **Step 5: Register them.**
  - `sim/content/cases.ts`: import `RUN4_CASES` from `./casesRun4`; `export const CASES = [...RUN1_CASES, ...RUN2_CASES, ...RUN3_CASES, ...RUN4_CASES];`; the header comment says "Cases per run: casesRun1/2/3/4."
  - `sim/tuning.ts` `CASE_ECONOMY`, after `inferno` (starting values; Task 8 tunes them, each price at least 7× the one before as `cases.test.ts` requires):
  ```ts
    glitch: { price: 15_000_000, unlockCost: 6_000_000_000 },
    feverdream: { price: 150_000_000, unlockCost: 150_000_000_000 },
  ```
  - `fx/skins/patterns.ts`: import nothing new. In `patternColor`'s switch add, after `case "molten"`:
  ```ts
      // interim (plan F6-A): Run 4's six kinds share a plain finish until plan F6-B draws their own
      case "datamosh":
      case "scanline":
      case "rgbsplit":
      case "melt":
      case "kaleido":
      case "huecycle":
        return pick(pal, spread(fbm(x, y, seed)));
  ```
  - `fx/skins/motion.ts` `finishAt`: the drift branch covers the new motions until F6-B gives the kinds their own:
  ```ts
    if (!own && (kind === "flow" || kind === "rise" || kind === "glitch" || kind === "drip")) {
  ```
  - `i18n/content.ts`: add to `CASES` `glitch: { en: "Glitch", ru: "Глитч" }, feverdream: { en: "Fever Dream", ru: "Бредовый сон" },` and to `SKINS`:
  ```ts
    gl_deadpixel: { en: "Dead Pixel", ru: "Битый пиксель" },
    gl_compression: { en: "Compression", ru: "Сжатие" },
    gl_static: { en: "Static", ru: "Помехи" },
    gl_buffer: { en: "Buffer Underrun", ru: "Пустой буфер" },
    gl_404: { en: "Error 404", ru: "Ошибка 404" },
    gl_vhs: { en: "VHS Rewind", ru: "Перемотка VHS" },
    gl_tear: { en: "Screen Tear", ru: "Разрыв кадра" },
    gl_corrupt: { en: "Corrupted", ru: "Повреждённый" },
    gl_chroma: { en: "Chromatic", ru: "Хроматика" },
    gl_mosh: { en: "Datamosh", ru: "Датамош" },
    gl_fatal: { en: "Fatal Exception", ru: "Фатальная ошибка" },
    gl_null: { en: "Null Pointer", ru: "Нулевой указатель" },
    gl_knife: { en: "Segfault", ru: "Сегфолт" },
    fd_lullaby: { en: "Lullaby", ru: "Колыбельная" },
    fd_wax: { en: "Candle Wax", ru: "Свечной воск" },
    fd_glass: { en: "Stained Glass", ru: "Витраж" },
    fd_sherbet: { en: "Sherbet", ru: "Щербет" },
    fd_softclock: { en: "Soft Clock", ru: "Мягкие часы" },
    fd_mirrors: { en: "Hall of Mirrors", ru: "Зеркальный зал" },
    fd_lavalamp: { en: "Lava Lamp", ru: "Лава-лампа" },
    fd_halo: { en: "Halo", ru: "Нимб" },
    fd_kaleido: { en: "Kaleidoscope", ru: "Калейдоскоп" },
    fd_rainbow: { en: "Rainbow Road", ru: "Радужная дорога" },
    fd_lucid: { en: "Lucid Dream", ru: "Осознанный сон" },
    fd_feverpitch: { en: "Fever Pitch", ru: "Пик лихорадки" },
    fd_knife: { en: "Daydream", ru: "Грёза" },
  ```
  (`case.` budget 12: «Бредовый сон» is 12. Every skin name is within `skin.` 22.)

- [ ] **Step 6: Run the tests.**
  Run: `npx vitest run src/modules/casecremental`
  Expected: PASS. If `i18n/i18n.test.ts` or `fx/skins/patterns.test.ts` pins seven cases or a pixel checksum of all cases, extend it to nine (the checksum pins cases 1–3 only and must not change). `tools/skins` previews render the new skins with the interim finish; that is expected.

- [ ] **Step 7: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/sim/types.ts src/modules/casecremental/sim/content src/modules/casecremental/sim/tuning.ts src/modules/casecremental/fx/skins/patterns.ts src/modules/casecremental/fx/skins/motion.ts src/modules/casecremental/fx/skins/motion.test.ts src/modules/casecremental/i18n
  git commit -m "feat(run4): Glitch and Fever Dream - cases 8 and 9, thirteen moving skins each, six new pattern kinds

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 2: Run 4 in the campaign — `LAST_RUN = 4`, The Last Case, Loaded Dice

**Files:**
- Modify: `sim/tuning.ts`, `sim/campaign.ts` (header comment only), `sim/campaign.test.ts`, `sim/content/vaults.ts`, `sim/content/vaults.test.ts`, `sim/charms.ts`, `sim/charms.test.ts`, `fx/vault/vaultLooks.ts`, `fx/vault/vaultLooks.test.ts`, `ui/prestigeRules.ts`, `ui/prestigeRules.test.ts`, `ui/Settings.tsx`, `game/controller.ts` (the dev comment), `i18n/content.ts`, `i18n/content.test.ts`, `i18n/en.ts`, `i18n/ru.ts`, `sim/pacing.test.ts`

**Interfaces:**
- Produces:
  - `LAST_RUN = 4`; `RunContent` gains `upgrader: boolean; evolutions: boolean`; `RUN_CONTENT[3]`; `BOT_SPEED_ANCHORS` ends `[14, 100]`; `VAULT_PRICES` has four entries.
  - `VaultDef.id: "vault1" | "vault2" | "vault3" | "lastcase"`; `vaultFor(4).id === "lastcase"`, trophy `"lastcase"`, legend skin id `"lastcase_legend"` (★ Singularity).
  - `CharmId` gains `"loadedDice"`; `RUN4_CHARMS`; `CHARM_POOLS[4]`.
  - `Bring` = `{ kind: "case"; caseId } | { kind: "machine"; id: "locker" | "autoContract" | "upgrader" | "evolutions" } | { kind: "cap"; id: "multiOpen" | "botSpeed" | "botMulti"; value: number }`.
  - `VAULT_LOOKS.lastcase` (interim chest and fanfare; F6-C replaces the whole entry).

- [ ] **Step 1: Write the failing tests.**
  `sim/campaign.test.ts`:
  ```ts
  it("numbers runs by vaults opened, staying on the last run after it", () => {
    expect([0, 1, 2, 3, 4, 9].map(runNumber)).toEqual([1, 2, 3, 4, 4, 4]);
  });

  it("prices each run's vault, and replays of the last run grow", () => {
    for (let i = 0; i < 4; i++) expect(vaultPriceFor(i)).toBe(VAULT_PRICES[i]);
    expect(vaultPriceFor(5)).toBe(VAULT_PRICES[3] * VAULT_GROWTH ** 2);
  });

  it("Run 4: nine cases, multi-open x5, bot speed to x100, the bot opens three, the Upgrader and evolutions", () => {
    expect(runCaseIds(4)).toHaveLength(9);
    expect(runCaseIds(4).slice(-2)).toEqual(["glitch", "feverdream"]);
    expect(runContent(4)).toMatchObject({ multiOpen: 5, botMultiOpen: 3, locker: true, autoContract: true, upgrader: true, evolutions: true });
    expect([1, 2, 3].every((r) => !runContent(r).upgrader && !runContent(r).evolutions)).toBe(true);
    expect(botSpeed(14)).toBeCloseTo(100, 9);
    expect(botSpeedCost(11, 3)).toBeNull();
    expect(botSpeedCost(11, 4)).not.toBeNull();
    expect(capRaisedLater((r) => botSpeedLevels(r), 11, 3)).toBe(true); // Run 3's top bot speed says NEXT RUN
  });
  ```
  Replace the existing "keeps Run 1's bot speeds…" expectation `expect(BOT_SPEED_ANCHORS.at(-1)).toEqual([11, 50]);` with `expect(BOT_SPEED_ANCHORS.at(-1)).toEqual([14, 100]);`. Import `runContent` and `botSpeedLevels` where missing.

  `sim/content/vaults.test.ts`:
  ```ts
  it("one per run, its legend an animated knife, its rewards from the run's top case", () => {
    expect(VAULTS.map((v) => [v.id, v.run, v.sourceCase])).toEqual([
      ["vault1", 1, "bedrock"],
      ["vault2", 2, "neon"],
      ["vault3", 3, "inferno"],
      ["lastcase", 4, "feverdream"],
    ]);
    // …the loop over VAULTS stays as it is…
    expect(vaultFor(9).id).toBe("lastcase");
  });

  it("The Last Case pays out Fever Dream drops and ★ Singularity", () => {
    const run = new Run(7, { ...DEFAULT_SETUP, run: 4, startCash: 1e18, vaultPrice: 1e6 });
    for (const id of runCaseIds(4).slice(1)) expect(run.unlockCase(id).ok).toBe(true);
    expect(run.buyVault().ok).toBe(true);
    expect(run.turnVaultKey().ok).toBe(true);
    const drops = run.state.vault!.phase === "opening" ? run.state.vault!.drops : [];
    expect(drops.slice(0, 4).every((d) => d.caseId === "feverdream")).toBe(true);
    expect(drops[4]).toMatchObject({ skinId: "lastcase_legend", caseId: "lastcase" });
    for (let i = 0; i < 18 * 30; i++) run.tick(1 / 30);
    expect(run.drainEvents().find((e) => e.type === "vaultOpened")).toMatchObject({ trophy: "lastcase" });
  });
  ```
  (import `runCaseIds` from `../campaign`).

  `sim/charms.test.ts`, in the pools test:
  ```ts
    expect(charmPool(4)).toBe(RUN4_CHARMS);
    expect(charmPool(9)).toBe(RUN4_CHARMS);
    expect([...RUN4_CHARMS]).toEqual([...RUN3_CHARMS, "loadedDice"]);
    expect(RUN3_CHARMS.includes("loadedDice")).toBe(false);
  ```

  `ui/prestigeRules.test.ts`: the Run 2 test becomes
  ```ts
  it("Run 2: Mainframe and Neon Nights, the locker, multi-open to x3, bot speed to x20, the bot opens x2", () => {
    expect(runBrings(2)).toEqual([
      { kind: "case", caseId: "mainframe" },
      { kind: "case", caseId: "neon" },
      { kind: "machine", id: "locker" },
      { kind: "cap", id: "multiOpen", value: 3 },
      { kind: "cap", id: "botSpeed", value: 20 },
      { kind: "cap", id: "botMulti", value: 2 },
    ]);
  });
  ```
  Keep F2's Run 3 test as F2 left it (no grid). Add:
  ```ts
  it("Run 4: Glitch and Fever Dream, the Upgrader, evolutions, bot speed to x100, the bot opens x3", () => {
    expect(runBrings(4)).toEqual([
      { kind: "case", caseId: "glitch" },
      { kind: "case", caseId: "feverdream" },
      { kind: "machine", id: "upgrader" },
      { kind: "machine", id: "evolutions" },
      { kind: "cap", id: "botSpeed", value: 100 },
      { kind: "cap", id: "botMulti", value: 3 },
    ]);
  });
  ```
  and in "every line fits the prestige screen" loop over `[...runBrings(2), ...runBrings(3), ...runBrings(4)]`. In "names the vault that just opened", change the first line to `expect(VAULTS.map((v) => vaultNumeral(v.id))).toEqual(["I", "II", "III", "IV"]);` (interim: F6-C gives The Last Case its own title).

  `fx/vault/vaultLooks.test.ts`: in "gives Vaults II and III their own chest, fanfare, beams and light", change both `.toBe(3)` to `.toBe(VAULTS.length)`.

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/sim/campaign.test.ts src/modules/casecremental/ui/prestigeRules.test.ts`
  Expected: FAIL (`runNumber(3)` is 3; no `upgrader` in `RunContent`; `runBrings(2)` still has the botMulti machine).

- [ ] **Step 3: The tuning.** In `sim/tuning.ts`:
  - `export const LAST_RUN = 4;`
  - `RunContent` gains, after `autoContract`:
  ```ts
    /** Run 4: stake a locker rarity stack on a multiplier (finish spec §7.2). */
    upgrader: boolean;
    /** Run 4: a completed recipe can be bought as a big power jump (finish spec §7.3). */
    evolutions: boolean;
  ```
  - `RUN_CONTENT`: add `upgrader: false, evolutions: false` to F4's three rows, and a fourth row:
  ```ts
    { cases: 9, multiOpen: 5, botSpeedLevels: 14, botMultiOpen: 3, locker: true, autoContract: true, upgrader: true, evolutions: true },
  ```
  - `BOT_SPEED_ANCHORS`: append `[14, 100],`.
  - `VAULT_PRICES`: append a fourth price, starting at `100_000_000_000_000` (100T; Task 8 tunes it). Update its doc comment: "Each run's vault price (The Last Case is Run 4's) the first time it is reached; …".
  - After `COLLECTOR_MULT`: `/** Loaded Dice (Run 4): the Upgrader's win chance + this. */ export const LOADED_DICE_BONUS = 0.1;`
  - `sim/campaign.ts` header comment: "Vault I leads into Run 2, Vault II into Run 3, Vault III into Run 4, and The Last Case replays Run 4."

- [ ] **Step 4: The Last Case** in `sim/content/vaults.ts`:
  - `id: "vault1" | "vault2" | "vault3" | "lastcase";` (doc: "Also the vault's case id on its drops, and its name key (`vault1`…, `lastcase`).")
  - Append:
  ```ts
    {
      id: "lastcase",
      run: 4,
      trophy: "lastcase",
      sourceCase: "feverdream",
      // black glass and gold (finish spec §7.4): the legend's hues turn through white, gold and the void
      legend: skin(
        "lastcase_legend",
        "Singularity",
        "knife",
        "gold",
        p("huecycle", ["#000000", "#1a1a1a", "#ffd700", "#fff6d5", "#ffffff"], 5, 404),
        flipFlow,
      ),
    },
  ```
  - Header comment: "One vault per run (rework spec §4); Run 4's is The Last Case (finish spec §7.4)."
  - `i18n/content.ts`: `CASES` gains `lastcase: { en: "The Last Case", ru: "Последний кейс" },`; `SKINS` gains `lastcase_legend: { en: "Singularity", ru: "Сингулярность" },`. In `i18n/budgets.ts` add `["case.lastcase", 14],` right before `["case.vault", 14],` («Последний кейс» is 14, over `case.` 12).
  - `i18n/content.test.ts` "names every charm and perk, and the vault": loop over `RUN4_CHARMS` (import it instead of `RUN3_CHARMS`), and add `expect(caseName("lastcase")).not.toBe("");`.

- [ ] **Step 5: The interim look** in `fx/vault/vaultLooks.ts` (the `Record<VaultId, VaultLook>` type requires an entry). Append to `VAULT_LOOKS`:
  ```ts
    // interim (plan F6-A): Vault III's chest, fanfare and chaos until plan F6-C builds The Last Case's own look
    lastcase: {
      id: "lastcase",
      chest: "vault-case-3",
      palette: [0xffffff, 0xffd34d, 0x1a0f2e, 0xffd34d, 0xffffff], // white, gold, void, gold, white
      light: {
        impactFlash: 0xfffbe8,
        starburst: 0xfff4c8,
        shaft: 0xffffff,
        glow: 0xffd34d,
        tremble: 0xffe08a,
        seam: 0xffd34d,
        open: 0xfff0b0,
      },
      fanfare: "vault-fanfare-3",
      chaos: { burstsPerKick: 4, stream: 2, rain: 2, sparks: 2, shimmer: { from: 0.12, span: 0.04, sat: 0.15 } },
    },
  ```

- [ ] **Step 6: Loaded Dice** in `sim/charms.ts`:
  - `CharmId` gains `| "loadedDice"`.
  - `export const RUN4_CHARMS: readonly CharmId[] = [...RUN3_CHARMS, "loadedDice"];`
  - `CHARM_POOLS = { 1: RUN1_CHARMS, 2: RUN2_CHARMS, 3: RUN3_CHARMS, 4: RUN4_CHARMS };`
  - Header comment: "…the rest come with later runs (Loaded Dice with Run 4's Upgrader)."
  - `i18n/content.ts` `CHARMS`:
  ```ts
    loadedDice: {
      name: { en: "Loaded Dice", ru: "Шулерские кости" },
      desc: { en: "Upgrader: +10% win chance", ru: "Апгрейдер: +10% к шансу" },
    },
  ```
  The Upgrader reads it in Task 3 (`LOADED_DICE_BONUS`).

- [ ] **Step 7: What Run 4 brings** in `ui/prestigeRules.ts`:
  ```ts
  const NUMERALS = { vault1: "I", vault2: "II", vault3: "III", lastcase: "IV" } as const; // lastcase: interim (plan F6-C)

  export type Bring =
    | { kind: "case"; caseId: string }
    | { kind: "machine"; id: "locker" | "autoContract" | "upgrader" | "evolutions" }
    | { kind: "cap"; id: "multiOpen" | "botSpeed" | "botMulti"; value: number };

  /** What run `run` adds over the one before it (spec §8): its new cases, its new machines, its raised caps. */
  export function runBrings(run: number): Bring[] {
    if (run <= 1) return [];
    const now = runContent(run);
    const before = runContent(run - 1);
    const out: Bring[] = runCaseIds(run)
      .slice(before.cases)
      .map((caseId) => ({ kind: "case", caseId }));
    for (const id of ["locker", "autoContract", "upgrader", "evolutions"] as const) if (now[id] && !before[id]) out.push({ kind: "machine", id });
    if (now.multiOpen > before.multiOpen) out.push({ kind: "cap", id: "multiOpen", value: now.multiOpen });
    if (now.botSpeedLevels > before.botSpeedLevels)
      out.push({ kind: "cap", id: "botSpeed", value: Math.round(botSpeed(now.botSpeedLevels)) });
    if (now.botMultiOpen > before.botMultiOpen) out.push({ kind: "cap", id: "botMulti", value: now.botMultiOpen });
    return out;
  }

  export function bringText(b: Bring): string {
    if (b.kind === "case") return t("brings.case", { name: caseName(b.caseId) });
    if (b.kind === "cap") return t(`brings.${b.id}` as const, { n: b.value });
    return t(`brings.${b.id}` as const);
  }
  ```
  i18n (EN / RU): change `"brings.botMulti"` to `"Bot opens x{n}"` / `"Бот открывает x{n}"`; add `"brings.upgrader": "The Upgrader"` / `"Апгрейдер"`, `"brings.evolutions": "Evolutions"` / `"Эволюции"`; add `"settings.devRun4": "RUN 4"` / `"ЗАБЕГ 4"`.
  `ui/Settings.tsx`: add `<PxButton onClick={() => onDevRun(4)}>{t("settings.devRun4")}</PxButton>` after the Run 3 button. `game/controller.ts`: the `devStartRun` doc comment says "(1-4)".

- [ ] **Step 8: Keep the pacing tests honest.** Vault III now leads into Run 4, not a Run 3 replay. In `sim/pacing.test.ts`, F4's chain through `["vault1", "vault2", "vault3"]` now plays Run 4 third. Shorten that chain to `["vault1", "vault2"]` (Run 2 and Run 3) and delete the "Run 3 replay" assertions (both profiles), with a one-line comment: `// Run 3 is no longer the last run; the last run's replay is tested with Run 4 (plan F6-A Task 8)`. Task 8 adds Run 4 and its replay. The Run 3 assertions that read the Run 3 report keep their index.

- [ ] **Step 9: Run the tests.**
  Run: `npx vitest run src/modules/casecremental`
  Expected: PASS. `game/view.test.ts` and `fx/vault/*` tests that iterate `VAULTS` now include `lastcase`; the interim look passes them (its chest is a built sheet; its chaos is within `MAX_DENSITY`).

- [ ] **Step 10: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/sim src/modules/casecremental/fx/vault/vaultLooks.ts src/modules/casecremental/fx/vault/vaultLooks.test.ts src/modules/casecremental/ui/prestigeRules.ts src/modules/casecremental/ui/prestigeRules.test.ts src/modules/casecremental/ui/Settings.tsx src/modules/casecremental/game/controller.ts src/modules/casecremental/i18n
  git commit -m "feat(run4): LAST_RUN is 4 - Run 4's content row, The Last Case as its vault, Loaded Dice, what Run 4 brings

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 3: The Upgrader

A machine on the locker (Run 4+, after the locker is bought): pick a rarity stack from the locker as the stake (all of that rarity), pick a multiplier, press GO. The outcome is rolled at GO and saved, so a reload ends the same way. The locker's press runs the dial: while the Upgrader spins the press is busy (no trade-up, no auto contract), and the press or waiting results block GO. A win puts its skin on top of the locker like a contract result; a loss is just gone.

**Behaviour, exactly** (spec §7.2, with the ambiguities resolved):
- **Bought once**, `UPGRADER_COST`, needs this run (`runContent(run).upgrader`, "not in this run") and the locker on ("buy the locker first"); "the upgrader is already bought"; refused while locked ("the vault is open").
- **Stake** `setUpgraderStake(ctx, r | null)`: any rarity or none; no checks, like Collect. It stays picked across spins.
- **Target** `setUpgraderTarget(ctx, i)`: an index into `UPGRADER_MULTS` (`[1.5, 2, 5, 10, 25, 100]`); out of range → "unknown target".
- **GO** `upgraderGo(ctx)`: refusals in this order: "the vault is open", "buy the upgrader first", "the upgrader is spinning", "the press is busy", "take the results first", "pick a stake first", "nothing to stake". Then every locker item of the stake rarity leaves the locker. Win chance = `min(UPGRADER_MAX_CHANCE, UPGRADER_WIN_BASE / mult + (Loaded Dice ? LOADED_DICE_BONUS : 0))`. `roll = rng.next()`; a win is `roll < chance`. A win's skin is rolled at GO too.
- **The won skin** (`upgraderResult`): a rarity `UPGRADER_RARITY_STEPS` above the stake's (1 step up to ×2, 2 up to ×10, 3 beyond; capped at ★); its case drawn from the inputs weighted by count (a random input); a random skin of that rarity from it; the inputs' mean float and its wear; StatTrak only if all were; value = the inputs' summed base value × the multiplier ("worth about V × multiplier").
- **The tick** (after the locker's): `elapsed += dt`; at `UPGRADER_SPIN_SECONDS` the spin ends. A win's skin goes to `locker.cards` with `cardAt = time`, counts as a reveal at `"locker"` (no Chain Reaction, like contracts) and emits `upgraderDone`. Nothing ticks while the run is locked.
- **The vault**: `buyVault` settles a running spin (`settleUpgrader`): a win's skin is cashed in at once as a machine sale (`source: "locker"`, `from: "locker"`), like the locker's waiting results; a loss is gone.

**Files:**
- Create: `sim/upgrader.ts`, `sim/upgrader.test.ts`
- Modify: `sim/tuning.ts`, `sim/runTypes.ts`, `sim/run.ts` (state + one tick line), `sim/locker.ts` (`pressBlocked`), `sim/vault.ts` (`buyVault`), `game/save.ts` (default), `game/save.test.ts`

**Interfaces:**
- Produces (`sim/upgrader.ts`):
  ```ts
  export interface UpgraderSpin { rarity: RarityId; inputs: Drop[]; mult: number; chance: number; roll: number; result: Drop | null; elapsed: number }
  export interface UpgraderState { on: boolean; stake: RarityId | null; target: number; spin: UpgraderSpin | null }
  export const freshUpgrader: () => UpgraderState;
  export function upgraderChance(mult: number, charms: readonly CharmId[]): number;
  export function rarityStepsFor(mult: number): number;
  export function upgraderResult(inputs: readonly Drop[], mult: number, rng: Rng, nextId: () => number): Drop;
  export function stakeItems(ctx: RunCtx): Drop[];
  export function buyUpgrader(ctx: RunCtx): ActionResult;
  export function setUpgraderStake(ctx: RunCtx, r: RarityId | null): ActionResult;
  export function setUpgraderTarget(ctx: RunCtx, index: number): ActionResult;
  export function upgraderGo(ctx: RunCtx): ActionResult;
  export function settleUpgrader(ctx: RunCtx): void;
  export function tickUpgrader(ctx: RunCtx, dt: number): void;
  ```
- Produces (`RunState.upgrader: UpgraderState`; `SimEvent`): `upgraderBought`; `upgraderStarted { rarity; inputs; mult; chance; roll; win }`; `upgraderDone { win; result: Drop | null; inputs: Drop[] }`.
- Produces (`sim/tuning.ts`): `UPGRADER_COST`, `UPGRADER_MULTS`, `UPGRADER_WIN_BASE`, `UPGRADER_MAX_CHANCE`, `UPGRADER_SPIN_SECONDS`, `UPGRADER_RARITY_STEPS`.
- F6-B Task 5 consumes the spin (`roll`, `chance`, `elapsed`) for the dial; Task 6 of this plan consumes everything for the view.

- [ ] **Step 1: Write the failing tests** in `sim/upgrader.test.ts`.
  ```ts
  import { describe, expect, it } from "vitest";
  import { runCaseIds } from "./campaign";
  import { Run } from "./run";
  import { DEFAULT_SETUP, type RunSnapshot } from "./runTypes";
  import { LOADED_DICE_BONUS, UPGRADER_COST, UPGRADER_MULTS, UPGRADER_SPIN_SECONDS } from "./tuning";
  import type { Drop, RarityId } from "./types";
  import {
    buyUpgrader,
    rarityStepsFor,
    setUpgraderStake,
    setUpgraderTarget,
    upgraderChance,
    upgraderGo,
    upgraderResult,
  } from "./upgrader";
  import { createRng } from "./rng";

  const DT = 1 / 30;
  const drop = (id: number, rarity: RarityId, over: Partial<Drop> = {}): Drop => ({
    id,
    caseId: "feverdream",
    skinId: rarity === "milspec" ? "fd_lullaby" : "fd_mirrors",
    rarity,
    float: 0.1,
    wear: "MW",
    statTrak: false,
    value: 100,
    ...over,
  });

  /** A Run 4 with the locker and the Upgrader bought, and `items` in the locker. */
  function run4(items: Drop[] = [], charms: Run["setup"]["charms"] = []): Run {
    const r = new Run(11, { ...DEFAULT_SETUP, run: 4, startCash: 1e18, charms });
    expect(r.buyLocker().ok).toBe(true);
    expect(buyUpgrader(r).ok).toBe(true);
    r.state.locker.items = items;
    r.drainEvents();
    return r;
  }
  const spinOut = (r: Run) => {
    for (let t = 0; t < UPGRADER_SPIN_SECONDS + 0.1; t += DT) r.tick(DT);
  };

  describe("the Upgrader's odds", () => {
    it("wins 0.9 / multiplier, +10 points with Loaded Dice, never past 0.95", () => {
      expect(UPGRADER_MULTS).toEqual([1.5, 2, 5, 10, 25, 100]);
      expect(upgraderChance(1.5, [])).toBeCloseTo(0.6, 9);
      expect(upgraderChance(100, [])).toBeCloseTo(0.009, 9);
      expect(upgraderChance(2, ["loadedDice"])).toBeCloseTo(0.45 + LOADED_DICE_BONUS, 9);
      expect(upgraderChance(1, ["loadedDice"])).toBe(0.95);
    });

    it("pays a skin one rarity up to x2, two up to x10, three beyond, never past ★", () => {
      expect([1.5, 2, 5, 10, 25, 100].map(rarityStepsFor)).toEqual([1, 1, 2, 2, 3, 3]);
      const inputs = [drop(1, "restricted"), drop(2, "restricted", { statTrak: true })];
      const won = upgraderResult(inputs, 25, createRng(3), () => 99);
      expect(won).toMatchObject({ id: 99, rarity: "gold", caseId: "feverdream", value: 200 * 25, statTrak: false });
      expect(won.float).toBeCloseTo(0.1, 9);
      expect(upgraderResult([drop(1, "covert")], 100, createRng(3), () => 1).rarity).toBe("gold");
    });
  });

  describe("the Upgrader", () => {
    it("is Run 4's, needs the locker, and is bought once", () => {
      const r3 = new Run(1, { ...DEFAULT_SETUP, run: 3, startCash: 1e18 });
      r3.buyLocker();
      expect(buyUpgrader(r3)).toEqual({ ok: false, reason: "not in this run" });
      const r = new Run(1, { ...DEFAULT_SETUP, run: 4, startCash: 1e18 });
      expect(buyUpgrader(r)).toEqual({ ok: false, reason: "buy the locker first" });
      r.buyLocker();
      const cash = r.state.cash;
      expect(buyUpgrader(r).ok).toBe(true);
      expect(r.state.cash).toBe(cash - UPGRADER_COST);
      expect(buyUpgrader(r)).toEqual({ ok: false, reason: "the upgrader is already bought" });
      expect(r.drainEvents().some((e) => e.type === "upgraderBought")).toBe(true);
    });

    it("stakes the whole rarity stack at GO and rolls the outcome then", () => {
      const r = run4([drop(1, "milspec"), drop(2, "restricted"), drop(3, "milspec")]);
      setUpgraderStake(r, "milspec");
      expect(setUpgraderTarget(r, 1).ok).toBe(true);
      expect(setUpgraderTarget(r, 6)).toEqual({ ok: false, reason: "unknown target" });
      expect(upgraderGo(r).ok).toBe(true);
      expect(r.state.locker.items.map((d) => d.id)).toEqual([2]);
      const spin = r.state.upgrader.spin!;
      expect(spin).toMatchObject({ rarity: "milspec", mult: 2, chance: 0.45, elapsed: 0 });
      expect(spin.inputs.map((d) => d.id)).toEqual([1, 3]);
      expect(spin.result !== null).toBe(spin.roll < spin.chance);
      expect(r.drainEvents().find((e) => e.type === "upgraderStarted")).toMatchObject({ win: spin.result !== null, mult: 2 });
    });

    it("blocks the press while it spins, and is blocked by the press and by waiting results", () => {
      const ten = Array.from({ length: 10 }, (_, i) => drop(i + 1, "milspec"));
      const r = run4([...ten, drop(50, "covert")]);
      setUpgraderStake(r, "covert");
      expect(upgraderGo(r).ok).toBe(true);
      expect(r.tradeUp()).toEqual({ ok: false, reason: "the upgrader is spinning" });
      expect(upgraderGo(r)).toEqual({ ok: false, reason: "the upgrader is spinning" });
      spinOut(r);
      r.state.locker.cards = [];
      expect(r.tradeUp().ok).toBe(true);
      r.state.locker.items.push(drop(51, "covert"));
      expect(upgraderGo(r)).toEqual({ ok: false, reason: "the press is busy" });
      r.state.locker.press = null;
      r.state.locker.cards = [drop(60, "classified")];
      expect(upgraderGo(r)).toEqual({ ok: false, reason: "take the results first" });
    });

    it("refuses an empty stake and keeps it picked (Review Focus 3)", () => {
      const r = run4([drop(1, "milspec")]);
      expect(upgraderGo(r)).toEqual({ ok: false, reason: "pick a stake first" });
      setUpgraderStake(r, "classified");
      expect(upgraderGo(r)).toEqual({ ok: false, reason: "nothing to stake" });
      expect(r.state.upgrader.stake).toBe("classified");
      expect(r.state.locker.items).toHaveLength(1);
    });

    it("puts a win on top of the locker like a contract result, and a loss is gone", () => {
      // find a seed of each outcome at x1.5 (60 % to win)
      const outcome = (seed: number) => {
        const r = run4([drop(1, "restricted")]);
        (r as unknown as { rng: ReturnType<typeof createRng> }).rng = createRng(seed);
        setUpgraderStake(r, "restricted");
        upgraderGo(r);
        return r;
      };
      let win: Run | null = null;
      let loss: Run | null = null;
      for (let seed = 1; (!win || !loss) && seed < 50; seed++) {
        const r = outcome(seed);
        if (r.state.upgrader.spin!.result) win ??= r;
        else loss ??= r;
      }
      spinOut(win!);
      expect(win!.state.upgrader.spin).toBeNull();
      expect(win!.state.locker.cards).toHaveLength(1);
      expect(win!.state.locker.cards[0]!.rarity).toBe("classified");
      expect(win!.drainEvents().find((e) => e.type === "upgraderDone")).toMatchObject({ win: true });
      spinOut(loss!);
      expect(loss!.state.locker.cards).toEqual([]);
      expect(loss!.state.locker.items).toEqual([]);
      expect(loss!.drainEvents().find((e) => e.type === "upgraderDone")).toMatchObject({ win: false, result: null });
    });

    it("ends a spin the same way after a reload (Review Focus 1)", () => {
      const r = run4([drop(1, "restricted"), drop(2, "restricted")]);
      setUpgraderStake(r, "restricted");
      setUpgraderTarget(r, 2);
      upgraderGo(r);
      for (let i = 0; i < 30; i++) r.tick(DT);
      const back = Run.fromSnapshot(JSON.parse(JSON.stringify(r.snapshot())) as RunSnapshot); // what the save stores
      expect(back.state.upgrader.spin).toEqual(r.state.upgrader.spin);
      spinOut(r);
      spinOut(back);
      expect(back.state.locker.cards).toEqual(r.state.locker.cards);
    });

    it("settles a running spin when the vault is bought (Review Focus 2)", () => {
      const r = run4([drop(1, "restricted")]);
      for (const id of runCaseIds(4).slice(1)) r.unlockCase(id);
      r.setup.vaultPrice = 1;
      setUpgraderStake(r, "restricted");
      upgraderGo(r);
      const won = r.state.upgrader.spin!.result;
      r.drainEvents();
      expect(r.buyVault().ok).toBe(true);
      expect(r.state.upgrader.spin).toBeNull();
      const sold = r.drainEvents().filter((e) => e.type === "sold");
      expect(sold.some((e) => e.type === "sold" && e.drop === won)).toBe(won !== null);
    });
  });
  ```
  (`r.setup` is `readonly` as a property but its object is mutable, so `r.setup.vaultPrice = 1` works in a test; if strict typing refuses it, build the run with `vaultPrice: 1` in the setup instead.)
  In `game/save.test.ts` add (import `freshUpgrader` from `../sim/upgrader`):
  ```ts
  it("gives a v5 save from before the Upgrader a fresh one", () => {
    const d = JSON.parse(encodeSave(data()));
    delete d.run.state.upgrader;
    expect(decodeSave(JSON.stringify(d))!.run.state.upgrader).toEqual(freshUpgrader());
  });
  ```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/sim/upgrader.test.ts`
  Expected: FAIL, because `./upgrader` does not exist.

- [ ] **Step 3: The numbers** in `sim/tuning.ts`, after `AUTO_CONTRACT_COST` (starting values; Task 8 tunes the cost):
  ```ts
  /** The Upgrader (Run 4, finish spec §7.2): stake a locker rarity stack on a multiplier. */
  export const UPGRADER_COST = 2_000_000_000_000;
  export const UPGRADER_MULTS = [1.5, 2, 5, 10, 25, 100] as const;
  /** Win chance = this / multiplier (+ Loaded Dice), never past UPGRADER_MAX_CHANCE. */
  export const UPGRADER_WIN_BASE = 0.9;
  export const UPGRADER_MAX_CHANCE = 0.95;
  /** The dial's spin on the locker; the outcome is rolled at GO. */
  export const UPGRADER_SPIN_SECONDS = 3;
  /** A win pays a skin this many rarities above the stake's (up to ★): the steps of the first row whose multiplier
   *  covers the target. */
  export const UPGRADER_RARITY_STEPS: ReadonlyArray<readonly [maxMult: number, steps: number]> = [
    [2, 1],
    [10, 2],
    [100, 3],
  ];
  ```

- [ ] **Step 4: Write `sim/upgrader.ts`.**
  ```ts
  import { runContent } from "./campaign";
  import type { CharmId } from "./charms";
  import { caseById } from "./content/cases";
  import { lockerWaiting } from "./locker";
  import { RARITY_ORDER } from "./rarity";
  import type { Rng } from "./rng";
  import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
  import {
    LOADED_DICE_BONUS,
    UPGRADER_COST,
    UPGRADER_MAX_CHANCE,
    UPGRADER_MULTS,
    UPGRADER_RARITY_STEPS,
    UPGRADER_SPIN_SECONDS,
    UPGRADER_WIN_BASE,
  } from "./tuning";
  import type { Drop, RarityId } from "./types";
  import { wearOf } from "./wear";

  // The Upgrader (Run 4, finish spec §7.2): a machine on the locker. Pick a rarity stack from the locker as the
  // stake, a multiplier, and press GO: the whole stack leaves, and the dial spins on the locker's press. The outcome
  // and a win's skin are rolled at GO, so a reload mid-spin ends the same way. A win's skin waits on top of the
  // locker like a contract result; a loss is just gone. While it spins the press is busy (locker.ts).

  export interface UpgraderSpin {
    rarity: RarityId;
    inputs: Drop[];
    mult: number;
    chance: number;
    /** Rolled at GO in [0, 1): a win when below `chance`. The dial's needle lands here. */
    roll: number;
    /** The skin a win pays (rolled at GO too); null on a loss. */
    result: Drop | null;
    elapsed: number;
  }

  export interface UpgraderState {
    on: boolean;
    /** The locker rarity staked at GO; null = none picked. It stays picked across spins. */
    stake: RarityId | null;
    /** Index into UPGRADER_MULTS. */
    target: number;
    spin: UpgraderSpin | null;
  }

  export const freshUpgrader = (): UpgraderState => ({ on: false, stake: null, target: 0, spin: null });

  /** 0.9 / multiplier, +10 points with Loaded Dice, never past 0.95. */
  export function upgraderChance(mult: number, charms: readonly CharmId[]): number {
    const bonus = charms.includes("loadedDice") ? LOADED_DICE_BONUS : 0;
    return Math.min(UPGRADER_MAX_CHANCE, UPGRADER_WIN_BASE / mult + bonus);
  }

  /** How many rarities above the stake's a win pays at this multiplier. */
  export function rarityStepsFor(mult: number): number {
    return (UPGRADER_RARITY_STEPS.find(([max]) => mult <= max) ?? UPGRADER_RARITY_STEPS[UPGRADER_RARITY_STEPS.length - 1]!)[1];
  }

  /** A win's skin: `rarityStepsFor` above the stake's (up to ★), from a case drawn from the inputs weighted by count,
   *  the inputs' mean float, StatTrak only if all were; worth the inputs' summed value × the multiplier. */
  export function upgraderResult(inputs: readonly Drop[], mult: number, rng: Rng, nextId: () => number): Drop {
    const from = RARITY_ORDER.indexOf(inputs[0]!.rarity);
    const rarity = RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, from + rarityStepsFor(mult))]!;
    const caseId = rng.pick(inputs).caseId; // a random input: weighted by count
    const skin = rng.pick(caseById(caseId).skins.filter((s) => s.rarity === rarity));
    const float = inputs.reduce((a, d) => a + d.float, 0) / inputs.length;
    const statTrak = inputs.every((d) => d.statTrak);
    const value = inputs.reduce((a, d) => a + d.value, 0) * mult;
    return { id: nextId(), caseId, skinId: skin.id, rarity, float, wear: wearOf(float).id, statTrak, value };
  }

  /** The locker items GO would stake now (all of the stake rarity; none when no stake is picked). */
  export const stakeItems = (ctx: RunCtx): Drop[] => {
    const stake = ctx.state.upgrader.stake;
    return stake ? ctx.state.locker.items.filter((d) => d.rarity === stake) : [];
  };

  export function buyUpgrader(ctx: RunCtx): ActionResult {
    if (ctx.locked()) return fail("the vault is open");
    const s = ctx.state;
    if (!runContent(ctx.setup.run).upgrader) return fail("not in this run");
    if (!s.locker.on) return fail("buy the locker first");
    if (s.upgrader.on) return fail("the upgrader is already bought");
    if (s.cash < UPGRADER_COST) return fail("not enough cash");
    s.cash -= UPGRADER_COST;
    s.upgrader.on = true;
    ctx.emit({ type: "upgraderBought" });
    return OK;
  }

  /** The rarity stack to stake (null = none). Any rarity; GO checks the locker holds some. */
  export function setUpgraderStake(ctx: RunCtx, r: RarityId | null): ActionResult {
    ctx.state.upgrader.stake = r;
    return OK;
  }

  /** The target multiplier, as an index into UPGRADER_MULTS. */
  export function setUpgraderTarget(ctx: RunCtx, index: number): ActionResult {
    if (!Number.isInteger(index) || index < 0 || index >= UPGRADER_MULTS.length) return fail("unknown target");
    ctx.state.upgrader.target = index;
    return OK;
  }

  export function upgraderGo(ctx: RunCtx): ActionResult {
    if (ctx.locked()) return fail("the vault is open");
    const s = ctx.state;
    const u = s.upgrader;
    if (!u.on) return fail("buy the upgrader first");
    if (u.spin) return fail("the upgrader is spinning");
    if (s.locker.press) return fail("the press is busy");
    if (lockerWaiting(s.locker)) return fail("take the results first");
    if (!u.stake) return fail("pick a stake first");
    const inputs = stakeItems(ctx);
    if (inputs.length === 0) return fail("nothing to stake");
    const rarity = u.stake;
    s.locker.items = s.locker.items.filter((d) => d.rarity !== rarity);
    const mult = UPGRADER_MULTS[u.target]!;
    const chance = upgraderChance(mult, ctx.setup.charms);
    const roll = ctx.rng.next();
    const result = roll < chance ? upgraderResult(inputs, mult, ctx.rng, () => s.nextDropId++) : null;
    u.spin = { rarity, inputs, mult, chance, roll, result, elapsed: 0 };
    ctx.emit({ type: "upgraderStarted", rarity, inputs, mult, chance, roll, win: result !== null });
    return OK;
  }

  /** The vault was bought mid-spin: a win's skin is cashed in at once (like the locker's waiting results), a loss
   *  is gone. */
  export function settleUpgrader(ctx: RunCtx): void {
    const s = ctx.state;
    const spin = s.upgrader.spin;
    if (!spin) return;
    s.upgrader.spin = null;
    if (!spin.result) return;
    const amount = ctx.payout(spin.result, false);
    ctx.earn(amount);
    ctx.emit({ type: "sold", drop: spin.result, amount, combo: s.combo, source: "locker", from: "locker", slot: 0 });
  }

  /** The dial: a win's skin pops onto the locker when the spin ends. */
  export function tickUpgrader(ctx: RunCtx, dt: number): void {
    const s = ctx.state;
    const spin = s.upgrader.spin;
    if (!spin || ctx.locked()) return;
    spin.elapsed += dt;
    if (spin.elapsed < UPGRADER_SPIN_SECONDS) return;
    s.upgrader.spin = null;
    if (spin.result) {
      s.locker.cards = [spin.result];
      s.locker.cardAt = s.time;
      ctx.onReveal(spin.result, "locker");
      ctx.countReveals(1);
    }
    ctx.emit({ type: "upgraderDone", win: spin.result !== null, result: spin.result, inputs: spin.inputs });
  }
  ```

- [ ] **Step 5: Wire it in.**
  - `sim/runTypes.ts`: import `type UpgraderState` from `./upgrader`; add to `RunState` after `autoSpin`: `/** Run 4: the Upgrader on the locker. */ upgrader: UpgraderState;`. Add the events after F2's auto-spin events:
  ```ts
    | { type: "upgraderBought" }
    /** GO: the stake left the locker and the dial spins; the outcome is already rolled (`roll` < `chance` wins). */
    | { type: "upgraderStarted"; rarity: RarityId; inputs: Drop[]; mult: number; chance: number; roll: number; win: boolean }
    /** The dial landed: a win's skin waits on the locker, a loss shreds the stake. */
    | { type: "upgraderDone"; win: boolean; result: Drop | null; inputs: Drop[] }
  ```
    Header comment: "(bot, auto-seller, locker, auto-spin, Upgrader, vault, day job)".
  - `sim/run.ts`: import `* as upgrader` and `{ freshUpgrader }` from `./upgrader`; `upgrader: freshUpgrader(),` after `autoSpin:` in the constructor; `upgrader.tickUpgrader(this, dt);` right after `locker.tickLocker(this, dt);`. No new `Run` methods (the file-size rule): the controller and the greedy player call the functions with the run.
  - `sim/locker.ts` `pressBlocked`: first line `if (ctx.state.upgrader.spin) return "the upgrader is spinning";`. The header comment adds: "In Run 4 the Upgrader's dial runs on the press (upgrader.ts)."
  - `sim/vault.ts` `buyVault`: import `settleUpgrader` from `./upgrader`; call it right after the locker's cash-in block, with the comment `// a running Upgrader spin settles: a win is cashed in, a loss is gone`.
  - `game/save.ts`: import `freshUpgrader`; in `normalize` add `upgrader: { ...freshUpgrader(), ...d.run.state.upgrader },` after `autoSpin:`.

- [ ] **Step 6: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/sim src/modules/casecremental/game`
  Expected: PASS.

- [ ] **Step 7: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/sim src/modules/casecremental/game/save.ts src/modules/casecremental/game/save.test.ts
  git commit -m "feat(run4): the Upgrader - stake a locker rarity stack on x1.5 to x100, rolled at GO, the dial runs on the press

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 4: Evolutions

Five evolutions (spec §7.3). Each unlocks in Run 4+ when its recipe is complete, then costs one purchase ("EVOLVE"). The state and the small effect hooks live in `sim/evolved.ts`, which imports only types, tuning and the campaign, so the bot, the seller and auto-spin can call it without an import cycle. The recipes, the purchase and the tick live in `sim/evolutions.ts`, which imports those machines.

**Behaviour, exactly** (spec §7.3, with the ambiguities resolved):
- **Recipes** ("max" = this run's cap): Slot Machine = Quick Hands max + Multi-open max; Cartel = Bot Speed max + Luck max; Money Printer = Appraiser max + Seller Speed max; Assembly Line = Auto-spin Delay max + Multi-open max; Hot Hand = Luck max + a hand combo of 50 (the run's best combo, tracked every tick in `evolutions.bestCombo`; it never drops).
- **Buying** `buyEvolution(ctx, id)`: "the vault is open"; "not in this run" (`runContent(run).evolutions`); "unknown evolution: <id>"; "already evolved"; "finish the recipe first"; "not enough cash". Costs `EVOLUTION_COSTS[id]`, emits `evolved { id }`. A run starts with none (like every machine).
- **Slot Machine:** a BUY opens `SLOT_MACHINE_OPEN` (10) cases, as many as you can afford, at least 1. `BENCH_OPEN_MAX` (10) replaces `MULTI_OPEN_MAX` as the save's bench limit.
- **Cartel:** the bot rolls each case twice and keeps the higher value; it counts as one open.
- **Money Printer:** the auto-seller's sales pay ×`MONEY_PRINTER_MULT` (3). Hand sales, tray claims and the vault's cash-in are unchanged.
- **Assembly Line:** auto-spin's delay is 0. Every `ASSEMBLY_FREE_EVERY`-th (25th) auto-spin buy is instead one free case of the next tier up the run's unlocked shelf (the top case stays itself), locked on the bench like a Ricochet case.
- **Hot Hand:** while the combo is at least `HOT_HAND_MIN_COMBO` (25), your bench's rolls get `HOT_HAND_LUCK` (5) extra Luck levels.

**Files:**
- Create: `sim/evolved.ts`, `sim/evolutions.ts`, `sim/evolutions.test.ts`
- Modify: `sim/tuning.ts`, `sim/runTypes.ts` (state, event, `RunCtx.rollFor`), `sim/run.ts` (state, `openCount`, `rollFor`, `insertKey`, one tick line), `sim/botOpener.ts`, `sim/autoSeller.ts`, `sim/autoSpin.ts`, `game/save.ts` (default, the bench limit), `game/save.test.ts`

**Interfaces:**
- Produces (`sim/evolved.ts`):
  ```ts
  export type EvolutionId = "slotMachine" | "cartel" | "moneyPrinter" | "assemblyLine" | "hotHand";
  export const EVOLUTION_IDS: readonly EvolutionId[];
  export interface EvolutionState { owned: EvolutionId[]; bestCombo: number; pulls: number }
  export const freshEvolutions: () => EvolutionState;
  export const evolved: (s: Pick<RunState, "evolutions">, id: EvolutionId) => boolean;
  export const benchWidth: (s: Pick<RunState, "evolutions">, multiOpenWidth: number) => number;
  export const hotHandLuck: (s: Pick<RunState, "evolutions" | "combo">) => number;
  export const sellerMult: (s: Pick<RunState, "evolutions">) => number;
  export function botRoll(ctx: RunCtx, caseId: string): Drop;
  export function assemblyFree(ctx: RunCtx, caseId: string): string | null;
  export function placeFreeCase(ctx: RunCtx, caseId: string): void;
  ```
- Produces (`sim/evolutions.ts`):
  ```ts
  export type RecipePart =
    | { kind: "upgrade"; id: UpgradeId }
    | { kind: "botSpeed" }
    | { kind: "sellerSpeed" }
    | { kind: "autoSpinDelay" }
    | { kind: "combo"; n: number };
  export const RECIPES: Readonly<Record<EvolutionId, readonly RecipePart[]>>;
  export function partDone(ctx: Pick<RunCtx, "state" | "setup">, p: RecipePart): boolean;
  export function recipeDone(ctx: Pick<RunCtx, "state" | "setup">, id: EvolutionId): boolean;
  export function buyEvolution(ctx: RunCtx, id: EvolutionId): ActionResult;
  export function tickEvolutions(ctx: RunCtx): void;
  ```
- Produces: `RunState.evolutions: EvolutionState`; `SimEvent` `{ type: "evolved"; id: EvolutionId }`; `RunCtx.rollFor(caseId, forced?, extraLuck?)`; tuning `EVOLUTION_COSTS`, `SLOT_MACHINE_OPEN`, `BENCH_OPEN_MAX`, `MONEY_PRINTER_MULT`, `ASSEMBLY_FREE_EVERY`, `HOT_HAND_RECIPE_COMBO`, `HOT_HAND_MIN_COMBO`, `HOT_HAND_LUCK`.
- F6-B Tasks 3–4 read `RunState.evolutions.owned` every frame for the looks and take `evolved` for the one-shot reveal.

- [ ] **Step 1: Write the failing tests** in `sim/evolutions.test.ts`.
  ```ts
  import { describe, expect, it } from "vitest";
  import { AUTOSPIN_DELAY_LEVELS } from "./autoSpin";
  import { SELLER_SPEED_LEVELS } from "./autoSeller";
  import { botSpeedLevels } from "./botOpener";
  import { runCaseIds } from "./campaign";
  import { buyEvolution, recipeDone, RECIPES } from "./evolutions";
  import { Run } from "./run";
  import { DEFAULT_SETUP } from "./runTypes";
  import {
    ASSEMBLY_FREE_EVERY,
    EVOLUTION_COSTS,
    HOT_HAND_LUCK,
    MONEY_PRINTER_MULT,
    SLOT_MACHINE_OPEN,
  } from "./tuning";
  import { upgradeCap } from "./upgrades";

  const DT = 1 / 30;
  const rich = (run = 4) => new Run(5, { ...DEFAULT_SETUP, run, startCash: 1e18 });
  const maxUpgrade = (r: Run, id: "luck" | "appraiser" | "quickHands" | "multiOpen") => {
    r.state.upgrades[id] = upgradeCap(id, r.setup.run);
  };

  describe("evolution recipes", () => {
    it("are the spec's pairs", () => {
      expect(RECIPES).toEqual({
        slotMachine: [{ kind: "upgrade", id: "quickHands" }, { kind: "upgrade", id: "multiOpen" }],
        cartel: [{ kind: "botSpeed" }, { kind: "upgrade", id: "luck" }],
        moneyPrinter: [{ kind: "upgrade", id: "appraiser" }, { kind: "sellerSpeed" }],
        assemblyLine: [{ kind: "autoSpinDelay" }, { kind: "upgrade", id: "multiOpen" }],
        hotHand: [{ kind: "upgrade", id: "luck" }, { kind: "combo", n: 50 }],
      });
    });

    it("complete at this run's caps, and Hot Hand on the run's best hand combo", () => {
      const r = rich();
      expect(recipeDone(r, "slotMachine")).toBe(false);
      maxUpgrade(r, "quickHands");
      maxUpgrade(r, "multiOpen");
      expect(recipeDone(r, "slotMachine")).toBe(true);
      r.state.bot.speedLevel = botSpeedLevels(4);
      maxUpgrade(r, "luck");
      expect(recipeDone(r, "cartel")).toBe(true);
      maxUpgrade(r, "appraiser");
      r.state.seller.speedLevel = SELLER_SPEED_LEVELS;
      expect(recipeDone(r, "moneyPrinter")).toBe(true);
      r.state.autoSpin.delayLevel = AUTOSPIN_DELAY_LEVELS;
      expect(recipeDone(r, "assemblyLine")).toBe(true);
      expect(recipeDone(r, "hotHand")).toBe(false);
      r.state.combo = 50;
      r.tick(DT); // the tick records the best combo
      r.state.combo = 0;
      expect(r.state.evolutions.bestCombo).toBe(50);
      expect(recipeDone(r, "hotHand")).toBe(true);
    });
  });

  describe("buying an evolution", () => {
    it("needs Run 4, a complete recipe and the cash, once", () => {
      const r3 = rich(3);
      maxUpgrade(r3, "quickHands");
      maxUpgrade(r3, "multiOpen");
      expect(buyEvolution(r3, "slotMachine")).toEqual({ ok: false, reason: "not in this run" });
      const r = rich();
      expect(buyEvolution(r, "slotMachine")).toEqual({ ok: false, reason: "finish the recipe first" });
      maxUpgrade(r, "quickHands");
      maxUpgrade(r, "multiOpen");
      const cash = r.state.cash;
      expect(buyEvolution(r, "slotMachine").ok).toBe(true);
      expect(r.state.cash).toBe(cash - EVOLUTION_COSTS.slotMachine);
      expect(buyEvolution(r, "slotMachine")).toEqual({ ok: false, reason: "already evolved" });
      expect(r.drainEvents().find((e) => e.type === "evolved")).toEqual({ type: "evolved", id: "slotMachine" });
    });
  });

  describe("what evolutions do", () => {
    it("Slot Machine opens ten per BUY, or as many as you can afford (Review Focus 4)", () => {
      const r = rich();
      maxUpgrade(r, "quickHands");
      maxUpgrade(r, "multiOpen");
      expect(r.openCount("bootcamp")).toBe(5);
      buyEvolution(r, "slotMachine");
      expect(r.openCount("bootcamp")).toBe(SLOT_MACHINE_OPEN);
      r.state.cash = r.casePrice("bootcamp") * 3.5;
      expect(r.openCount("bootcamp")).toBe(3);
      r.state.cash = r.casePrice("bootcamp") * 20;
      expect(r.buyCase("bootcamp").ok).toBe(true);
      r.insertKey();
      expect(r.state.bench.phase === "spinning" && r.state.bench.reels.length).toBe(10);
    });

    it("Cartel keeps the better of two rolls for each of the bot's cases, as one open", () => {
      const plain = rich();
      const cartel = rich();
      cartel.state.evolutions.owned.push("cartel");
      let plainValue = 0;
      let cartelValue = 0;
      for (const r of [plain, cartel]) {
        r.wakeBot();
        r.state.bot.wakeLeft = 0;
        r.state.bot.speedLevel = 14;
      }
      for (let i = 0; i < 3000; i++) {
        for (const r of [plain, cartel]) {
          r.tick(DT);
          for (const e of r.drainEvents()) {
            if (e.type !== "botSpinStarted") continue;
            if (r === plain) plainValue += e.drops[0]!.value;
            else cartelValue += e.drops[0]!.value;
          }
          r.state.bot.cards = [];
        }
      }
      expect(cartelValue).toBeGreaterThan(plainValue * 1.2);
      expect(cartel.state.opened).toBeLessThanOrEqual(plain.state.opened + 5); // one open per case, not two
    });

    it("Money Printer triples the auto-seller's sales, never a hand sale", () => {
      const r = rich();
      r.buySeller();
      r.setSellerThreshold("gold");
      r.state.evolutions.owned.push("moneyPrinter");
      r.buyCase("bootcamp");
      r.insertKey();
      for (let i = 0; i < 300 && r.state.bench.phase !== "empty"; i++) r.tick(DT);
      const sale = r.drainEvents().find((e) => e.type === "sold");
      expect(sale?.type === "sold" && sale.source).toBe("seller");
      if (sale?.type === "sold") expect(sale.amount).toBeCloseTo(r.payout(sale.drop, false) * MONEY_PRINTER_MULT, 6);
    });

    it("Assembly Line: no delay, and every 25th auto-spin buy is a free case one tier up (the top case stays itself)", () => {
      const r = rich();
      for (const id of runCaseIds(4).slice(1, 3)) r.unlockCase(id); // bootcamp, wildwood, bedrock
      r.buySeller();
      r.buyAutoSpin();
      r.setAutoSpin(true);
      r.setAutoSpinCase("wildwood");
      r.state.evolutions.owned.push("assemblyLine");
      r.drainEvents();
      const bought: Array<{ caseId: string; free: boolean }> = [];
      for (let i = 0; bought.length < ASSEMBLY_FREE_EVERY && i < 200_000; i++) {
        r.tick(DT);
        for (const e of r.drainEvents()) if (e.type === "caseBought") bought.push({ caseId: e.caseId, free: e.free });
        const b = r.state.bench;
        if (b.phase === "revealed") b.cards.forEach((d, slot) => d && r.sell(slot));
      }
      expect(bought.slice(0, ASSEMBLY_FREE_EVERY - 1).every((b) => b.caseId === "wildwood" && !b.free)).toBe(true);
      expect(bought[ASSEMBLY_FREE_EVERY - 1]).toEqual({ caseId: "bedrock", free: true });
      r.setAutoSpinCase("bedrock");
      r.state.evolutions.pulls = ASSEMBLY_FREE_EVERY - 1;
      bought.length = 0;
      for (let i = 0; bought.length < 1 && i < 10_000; i++) {
        r.tick(DT);
        for (const e of r.drainEvents()) if (e.type === "caseBought") bought.push({ caseId: e.caseId, free: e.free });
        const b = r.state.bench;
        if (b.phase === "revealed") b.cards.forEach((d, slot) => d && r.sell(slot));
      }
      expect(bought[0]).toEqual({ caseId: "bedrock", free: true });
    });

    it("Hot Hand adds five Luck levels to your bench's rolls while the combo is 25 or more", () => {
      const seen: number[] = [];
      const r = rich();
      r.state.evolutions.owned.push("hotHand");
      const orig = r.rollFor.bind(r);
      r.rollFor = (caseId, forced, extra) => {
        seen.push(extra ?? 0);
        return orig(caseId, forced, extra);
      };
      r.state.combo = 24;
      r.buyCase("bootcamp");
      r.insertKey();
      r.state.bench = { phase: "empty" };
      r.state.combo = 25;
      r.buyCase("bootcamp");
      r.insertKey();
      expect(seen).toEqual([0, HOT_HAND_LUCK]);
    });
  });
  ```
  In `game/save.test.ts` add (import `freshEvolutions` from `../sim/evolved`, `DEFAULT_SETUP` and `Run` are already imported):
  ```ts
  it("gives a v5 save from before evolutions a fresh one", () => {
    const d = JSON.parse(encodeSave(data()));
    delete d.run.state.evolutions;
    expect(decodeSave(JSON.stringify(d))!.run.state.evolutions).toEqual(freshEvolutions());
  });

  it("a ten-case bench survives the save (Review Focus 4)", () => {
    const r = new Run(5, { ...DEFAULT_SETUP, run: 4, startCash: 1e18 });
    r.state.evolutions.owned.push("slotMachine");
    r.buyCase("bootcamp");
    const back = decodeSave(encodeSave({ v: SAVE_VERSION, meta: freshMeta(), run: r.snapshot() }));
    expect(back?.run.state.bench).toMatchObject({ phase: "locked", count: 10 });
  });
  ```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/sim/evolutions.test.ts`
  Expected: FAIL, because `./evolved` and `./evolutions` do not exist.

- [ ] **Step 3: The numbers** in `sim/tuning.ts`. Replace `MULTI_OPEN_MAX`'s doc comment so it reads "The widest multi-open in the campaign (×5 from Run 3)." Then after the Upgrader block (starting values; Task 8 tunes the costs):
  ```ts
  /** Evolutions (Run 4, finish spec §7.3): each costs one purchase once its recipe is complete. */
  export const EVOLUTION_COSTS = {
    slotMachine: 5_000_000_000_000,
    cartel: 8_000_000_000_000,
    moneyPrinter: 12_000_000_000_000,
    assemblyLine: 20_000_000_000_000,
    hotHand: 30_000_000_000_000,
  } as const;
  /** Slot Machine: one BUY opens this many cases. */
  export const SLOT_MACHINE_OPEN = 10;
  /** The widest bench (Slot Machine): a save with more is corrupt. */
  export const BENCH_OPEN_MAX = SLOT_MACHINE_OPEN;
  /** Money Printer: the auto-seller's sales × this. */
  export const MONEY_PRINTER_MULT = 3;
  /** Assembly Line: every this-many-th auto-spin buy is a free case one tier up. */
  export const ASSEMBLY_FREE_EVERY = 25;
  /** Hot Hand: its recipe's hand combo; while the combo is at least HOT_HAND_MIN_COMBO the bench rolls with
   *  HOT_HAND_LUCK more Luck levels. */
  export const HOT_HAND_RECIPE_COMBO = 50;
  export const HOT_HAND_MIN_COMBO = 25;
  export const HOT_HAND_LUCK = 5;
  ```

- [ ] **Step 4: Write `sim/evolved.ts`.**
  ```ts
  import { runCaseIds } from "./campaign";
  import type { RunCtx, RunState } from "./runTypes";
  import { ASSEMBLY_FREE_EVERY, HOT_HAND_LUCK, HOT_HAND_MIN_COMBO, MONEY_PRINTER_MULT, SLOT_MACHINE_OPEN } from "./tuning";
  import type { Drop } from "./types";

  // The evolutions a run has bought (finish spec §7.3) and the small hooks the machines call for their effects. This
  // file imports no machine, so the bot, the auto-seller and auto-spin can use it without an import cycle; the
  // recipes and the purchase are in evolutions.ts.

  export type EvolutionId = "slotMachine" | "cartel" | "moneyPrinter" | "assemblyLine" | "hotHand";
  export const EVOLUTION_IDS: readonly EvolutionId[] = ["slotMachine", "cartel", "moneyPrinter", "assemblyLine", "hotHand"];

  export interface EvolutionState {
    owned: EvolutionId[];
    /** The run's best combo so far (Hot Hand's recipe); it never drops. */
    bestCombo: number;
    /** Auto-spin buys counted for Assembly Line's free case. */
    pulls: number;
  }

  export const freshEvolutions = (): EvolutionState => ({ owned: [], bestCombo: 0, pulls: 0 });

  export const evolved = (s: Pick<RunState, "evolutions">, id: EvolutionId): boolean => s.evolutions.owned.includes(id);

  /** Cases one BUY opens before cash limits it: Slot Machine's ten, else the Multi-open width. */
  export const benchWidth = (s: Pick<RunState, "evolutions">, multiOpenWidth: number): number =>
    evolved(s, "slotMachine") ? SLOT_MACHINE_OPEN : multiOpenWidth;

  /** Hot Hand: extra Luck levels for your bench's rolls while the combo is high. */
  export const hotHandLuck = (s: Pick<RunState, "evolutions" | "combo">): number =>
    evolved(s, "hotHand") && s.combo >= HOT_HAND_MIN_COMBO ? HOT_HAND_LUCK : 0;

  /** Money Printer: the auto-seller's sales × this. */
  export const sellerMult = (s: Pick<RunState, "evolutions">): number => (evolved(s, "moneyPrinter") ? MONEY_PRINTER_MULT : 1);

  /** The bot's roll for one case. Cartel rolls it twice and keeps the higher value: still one open. */
  export function botRoll(ctx: RunCtx, caseId: string): Drop {
    if (!evolved(ctx.state, "cartel")) return ctx.rollFor(caseId);
    const a = ctx.rollFor(caseId);
    const b = ctx.rollFor(caseId);
    ctx.state.opened--; // one case, rolled twice
    return b.value > a.value ? b : a;
  }

  /** Assembly Line counts an auto-spin buy: every ASSEMBLY_FREE_EVERY-th is a free case of the next tier up the run's
   *  unlocked shelf (the top case stays itself), returned here; null for an ordinary buy (and without Assembly Line). */
  export function assemblyFree(ctx: RunCtx, caseId: string): string | null {
    if (!evolved(ctx.state, "assemblyLine")) return null;
    const e = ctx.state.evolutions;
    e.pulls++;
    if (e.pulls % ASSEMBLY_FREE_EVERY !== 0) return null;
    const shelf = runCaseIds(ctx.setup.run).filter((id) => ctx.state.unlocked.includes(id));
    const i = shelf.indexOf(caseId);
    return i < 0 ? caseId : shelf[Math.min(shelf.length - 1, i + 1)]!;
  }

  /** A free case locks on the empty bench (like a Ricochet case). */
  export function placeFreeCase(ctx: RunCtx, caseId: string): void {
    ctx.state.bench = { phase: "locked", caseId, free: true, count: 1 };
    ctx.emit({ type: "caseBought", caseId, free: true, count: 1 });
  }
  ```

- [ ] **Step 5: Write `sim/evolutions.ts`.**
  ```ts
  import { AUTOSPIN_DELAY_LEVELS } from "./autoSpin";
  import { SELLER_SPEED_LEVELS } from "./autoSeller";
  import { botSpeedLevels } from "./botOpener";
  import { runContent } from "./campaign";
  import { EVOLUTION_IDS, evolved, type EvolutionId } from "./evolved";
  import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
  import { EVOLUTION_COSTS, HOT_HAND_RECIPE_COMBO } from "./tuning";
  import { upgradeCap, type UpgradeId } from "./upgrades";

  // Evolutions (Run 4, finish spec §7.3): each unlocks when its recipe is complete (two upgrades at this run's cap,
  // or Luck plus a hand combo of 50), then costs one purchase. Their effects are hooks in evolved.ts that the bench,
  // the bot, the auto-seller and auto-spin call.

  /** One line of a recipe: an upgrade at this run's cap, a machine's top level, or a hand combo reached this run. */
  export type RecipePart =
    | { kind: "upgrade"; id: UpgradeId }
    | { kind: "botSpeed" }
    | { kind: "sellerSpeed" }
    | { kind: "autoSpinDelay" }
    | { kind: "combo"; n: number };

  export const RECIPES: Readonly<Record<EvolutionId, readonly RecipePart[]>> = {
    slotMachine: [{ kind: "upgrade", id: "quickHands" }, { kind: "upgrade", id: "multiOpen" }],
    cartel: [{ kind: "botSpeed" }, { kind: "upgrade", id: "luck" }],
    moneyPrinter: [{ kind: "upgrade", id: "appraiser" }, { kind: "sellerSpeed" }],
    assemblyLine: [{ kind: "autoSpinDelay" }, { kind: "upgrade", id: "multiOpen" }],
    hotHand: [{ kind: "upgrade", id: "luck" }, { kind: "combo", n: HOT_HAND_RECIPE_COMBO }],
  };

  export function partDone(ctx: Pick<RunCtx, "state" | "setup">, p: RecipePart): boolean {
    const s = ctx.state;
    const run = ctx.setup.run;
    switch (p.kind) {
      case "upgrade":
        return s.upgrades[p.id] >= upgradeCap(p.id, run);
      case "botSpeed":
        return s.bot.speedLevel >= botSpeedLevels(run);
      case "sellerSpeed":
        return s.seller.speedLevel >= SELLER_SPEED_LEVELS;
      case "autoSpinDelay":
        return s.autoSpin.delayLevel >= AUTOSPIN_DELAY_LEVELS;
      case "combo":
        return s.evolutions.bestCombo >= p.n;
    }
  }

  export const recipeDone = (ctx: Pick<RunCtx, "state" | "setup">, id: EvolutionId): boolean => RECIPES[id].every((p) => partDone(ctx, p));

  export function buyEvolution(ctx: RunCtx, id: EvolutionId): ActionResult {
    if (ctx.locked()) return fail("the vault is open");
    const s = ctx.state;
    if (!runContent(ctx.setup.run).evolutions) return fail("not in this run");
    if (!EVOLUTION_IDS.includes(id)) return fail(`unknown evolution: ${id}`);
    if (evolved(s, id)) return fail("already evolved");
    if (!recipeDone(ctx, id)) return fail("finish the recipe first");
    const cost = EVOLUTION_COSTS[id];
    if (s.cash < cost) return fail("not enough cash");
    s.cash -= cost;
    s.evolutions.owned.push(id);
    ctx.emit({ type: "evolved", id });
    return OK;
  }

  /** Remembers the run's best combo (Hot Hand's recipe). */
  export function tickEvolutions(ctx: RunCtx): void {
    const e = ctx.state.evolutions;
    e.bestCombo = Math.max(e.bestCombo, ctx.state.combo);
  }
  ```

- [ ] **Step 6: Wire the effects in.**
  - `sim/runTypes.ts`: import `type EvolutionId, type EvolutionState` from `./evolved`; `RunState` gains `/** Run 4: the evolutions bought, Hot Hand's best combo, Assembly Line's count. */ evolutions: EvolutionState;` after `upgrader`; the event `| { type: "evolved"; id: EvolutionId }` after the Upgrader events; `RunCtx.rollFor` becomes
  ```ts
    /** Rolls one case's drop with Luck (+ `extraLuck` levels: Hot Hand), Pity, the Golden Hour and the charms; counts the open. */
    rollFor(caseId: string, forced?: RarityId | null, extraLuck?: number): Drop;
  ```
  - `sim/run.ts`:
    - import `* as evolutions` from `./evolutions` and `{ benchWidth, freshEvolutions, hotHandLuck }` from `./evolved`;
    - `evolutions: freshEvolutions(),` after `upgrader:` in the constructor;
    - `openCount`: `return Math.max(1, Math.min(benchWidth(this.state, this.effects().openCount), Math.floor(this.state.cash / price)));` and its doc comment says "the Multi-open level (Slot Machine: ten)";
    - `rollFor(caseId: string, forced: RarityId | null = null, extraLuck = 0)`, with `const luck = this.effects().luckLevel + this.setup.luckBonus + s.pity * PITY_LUCK_LEVELS + extraLuck;`;
    - `insertKey`: `const drop = this.rollFor(c.id, i === 0 ? forced : null, hotHandLuck(s));`;
    - `tick`: `evolutions.tickEvolutions(this);` right after the `s.comboHeat = …` line.
    - Check `wc -l sim/run.ts`: it may grow by at most ~12 lines in this plan (Tasks 3–5 together).
  - `sim/botOpener.ts`: import `botRoll` from `./evolved`; in `tickBot` replace `drops.push(ctx.rollFor(caseId));` with `drops.push(botRoll(ctx, caseId)); // Cartel: the better of two`.
  - `sim/autoSeller.ts`: import `sellerMult` from `./evolved`; in `autoTake` the sale becomes `const amount = ctx.payout(d, false) * sellerMult(s); // Money Printer: x3`.
  - `sim/autoSpin.ts`: import `assemblyFree, evolved, placeFreeCase` from `./evolved`. In `tickAutoSpin`:
  ```ts
    const delay = evolved(s, "assemblyLine") ? 0 : autoSpinDelay(a.delayLevel); // Assembly Line: no delay
    …
    const caseId = autoSpinCase(ctx);
    if (!caseId) return;
    a.clock = 0;
    const free = assemblyFree(ctx, caseId); // Assembly Line: every 25th buy is a free case one tier up
    if (free) {
      placeFreeCase(ctx, free);
      ctx.emit({ type: "autoSpinPulled", caseId: free, count: 1 });
      return;
    }
    const count = ctx.placeCase(caseId);
    ctx.emit({ type: "autoSpinPulled", caseId, count });
  ```
  and add a sentence to its header comment: "With Assembly Line (Run 4) it has no delay, and every 25th buy is a free case one tier up."
  - `game/save.ts`: import `freshEvolutions` from `../sim/evolved` and `BENCH_OPEN_MAX` (instead of `MULTI_OPEN_MAX`) from `../sim/tuning`; `isBench` checks `(b.count as number) <= BENCH_OPEN_MAX`; `normalize` adds `evolutions: { ...freshEvolutions(), ...d.run.state.evolutions },` after `upgrader:`.

- [ ] **Step 7: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/sim src/modules/casecremental/game`
  Expected: PASS. If the Cartel test's 1.2× margin is flaky across seeds, keep the seed fixed (it is) and widen the loop, never the margin below 1.1.

- [ ] **Step 8: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/sim src/modules/casecremental/game/save.ts src/modules/casecremental/game/save.test.ts
  git commit -m "feat(run4): evolutions - Slot Machine, Cartel, Money Printer, Assembly Line, Hot Hand: recipes, EVOLVE, effects

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 5: Campaign stats and the credits flag

The credits (F6-C) show the campaign's stats: time played over all runs, cases opened, the best drop, CLOUT earned. They are kept in the meta (spec §7.4) so they outlive each run; F7 will mirror the meta to the server. The run remembers its best drop (`RunState.best`, the highest base value revealed by an open, a contract or the Upgrader; vault rewards are priced off the vault and do not count). `completeVault` adds the run's time, opens and best into the meta. The Last Case raises `meta.credits`, which keeps the credits up (across a reload) until the player ends them.

**Files:**
- Modify: `sim/runTypes.ts`, `sim/run.ts` (state, `onReveal`), `sim/meta.ts`, `sim/meta.test.ts`, `game/controller.ts`, `game/controller.test.ts`, `game/save.ts`, `game/save.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // sim/meta.ts
  export interface CampaignStats { playSeconds: number; opened: number; best: Drop | null; cloutEarned: number }
  // MetaState gains: stats: CampaignStats; credits: boolean
  export function completeVault(m: MetaState, lifetimeEarnings: number, trophy: string, seed: number, run?: Pick<RunState, "time" | "opened" | "best">): void;
  export function endCredits(m: MetaState): ActionResult;
  // RunState gains: best: Drop | null
  // controller Action: { type: "endCredits" }; SimEvent: { type: "creditsEnded" } (emitted by the controller)
  ```
- F6-C consumes `meta.credits`, `meta.stats`, the `endCredits` action and the `creditsEnded` event.

- [ ] **Step 1: Write the failing tests.**
  `sim/meta.test.ts`:
  ```ts
  it("adds each run's time, opens and best drop to the campaign stats, and the CLOUT it paid", () => {
    const m = freshMeta();
    expect(m.stats).toEqual({ playSeconds: 0, opened: 0, best: null, cloutEarned: 0 });
    const a = { id: 1, caseId: "bootcamp", skinId: "bc_knife", rarity: "gold", float: 0.1, wear: "MW", statTrak: false, value: 500 } as const;
    const b = { ...a, id: 2, value: 90 };
    completeVault(m, 1e8, "vault1", 1, { time: 400, opened: 300, best: a });
    completeVault(m, 1e10, "vault2", 1, { time: 500, opened: 900, best: b });
    expect(m.stats).toMatchObject({ playSeconds: 900, opened: 1200, best: a });
    expect(m.stats.cloutEarned).toBe(cloutFor(1e8) + cloutFor(1e10));
  });

  it("rolls the credits after The Last Case, and only then; ending them twice is refused", () => {
    const m = freshMeta();
    completeVault(m, 1e9, "vault3", 1);
    expect(m.credits).toBe(false);
    completeVault(m, 1e9, "lastcase", 1);
    expect(m.credits).toBe(true);
    expect(endCredits(m).ok).toBe(true);
    expect(m.credits).toBe(false);
    expect(endCredits(m)).toEqual({ ok: false, reason: "no credits rolling" });
  });
  ```
  `sim/run.test.ts` (or a new `describe` in `sim/runSetup.test.ts`, whichever holds reveal tests):
  ```ts
  it("remembers the run's best drop by value, from the bench, the bot and the locker", () => {
    const r = new Run(3, { ...DEFAULT_SETUP, startCash: 1e6 });
    expect(r.state.best).toBeNull();
    for (let i = 0; i < 40; i++) {
      if (r.state.bench.phase === "empty") r.buyCase("bootcamp");
      if (r.state.bench.phase === "locked") r.insertKey();
      r.tick(5);
      const b = r.state.bench;
      if (b.phase === "revealed") b.cards.forEach((d, slot) => d && r.sell(slot));
    }
    const all = r.drainEvents().flatMap((e) => (e.type === "revealed" ? e.drops : []));
    expect(r.state.best?.value).toBe(Math.max(...all.map((d) => d.value)));
  });
  ```
  `game/controller.test.ts`:
  ```ts
  it("keeps the campaign stats, rolls the credits after The Last Case and ends them on endCredits", () => {
    const c = new GameController(1);
    c.devStartRun(4);
    const run = c.run;
    run.state.opened = 77;
    run.state.cash = 1e30;
    for (const id of run.runCases().slice(1)) run.unlockCase(id);
    expect(c.act({ type: "buyVault" }).ok).toBe(true);
    c.act({ type: "turnVaultKey" });
    for (let i = 0; i < 20 * 30; i++) c.step(1 / 30);
    expect(c.meta.credits).toBe(true);
    expect(c.meta.stats.opened).toBeGreaterThanOrEqual(77);
    expect(c.act({ type: "startNextRun" })).toEqual({ ok: false, reason: "the credits are rolling" });
    const seen: string[] = [];
    c.onEvent((e) => seen.push(e.type));
    expect(c.act({ type: "endCredits" }).ok).toBe(true);
    expect(seen).toContain("creditsEnded");
    expect(c.act({ type: "startNextRun" }).ok).toBe(true);
    expect(c.run.setup.run).toBe(4); // THE END: Run 4 again, boosted
  });
  ```
  `game/save.test.ts`:
  ```ts
  it("gives a v5 save from before the campaign stats fresh ones, and no best drop", () => {
    const d = JSON.parse(encodeSave(data()));
    delete d.meta.stats;
    delete d.meta.credits;
    delete d.run.state.best;
    const loaded = decodeSave(JSON.stringify(d))!;
    expect(loaded.meta.stats).toEqual(freshMeta().stats);
    expect(loaded.meta.credits).toBe(false);
    expect(loaded.run.state.best).toBeNull();
  });
  ```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/sim/meta.test.ts src/modules/casecremental/game/controller.test.ts`
  Expected: FAIL (no `stats`, no `endCredits`).

- [ ] **Step 3: The run's best drop.**
  - `sim/runTypes.ts` `RunState`: `/** The highest-value skin revealed this run (bench, bot, contracts, Upgrader); the vault's rewards don't count. */ best: Drop | null;`
  - `sim/run.ts`: `best: null,` in the constructor; first line of `onReveal`'s body after `const charms = …`: `if (!s.best || d.value > s.best.value) s.best = d;`.

- [ ] **Step 4: The meta** in `sim/meta.ts`:
  - import `type Drop` from `./types`, `type RunState` from `./runTypes`, `vaultFor` from `./content/vaults`, `LAST_RUN` from `./tuning`.
  - Add, with the header comment gaining "the campaign's stats for the credits":
  ```ts
  /** What the credits show (finish spec §7.4): kept across runs, added up at each vault. */
  export interface CampaignStats {
    /** Seconds played over every completed run. */
    playSeconds: number;
    /** Cases opened over every completed run. */
    opened: number;
    /** The highest-value skin of any run. */
    best: Drop | null;
    /** CLOUT paid by every vault. */
    cloutEarned: number;
  }
  ```
  - `MetaState` gains `stats: CampaignStats;` and `/** The Last Case opened: the credits roll until the player ends them. */ credits: boolean;`; `freshMeta()` gains `stats: { playSeconds: 0, opened: 0, best: null, cloutEarned: 0 }, credits: false,`.
  - `completeVault`:
  ```ts
  /** A vault opened: pay CLOUT, keep the trophy, add the run to the campaign's stats, count the loop, offer the next
   *  run's charms; The Last Case rolls the credits. */
  export function completeVault(
    m: MetaState,
    lifetimeEarnings: number,
    trophy: string,
    seed: number,
    run?: Pick<RunState, "time" | "opened" | "best">,
  ): void {
    const gain = cloutFor(lifetimeEarnings);
    m.clout += gain;
    m.lastGain = gain;
    m.stats.cloutEarned += gain;
    if (run) {
      m.stats.playSeconds += run.time;
      m.stats.opened += run.opened;
      if (run.best && (!m.stats.best || run.best.value > m.stats.best.value)) m.stats.best = run.best;
    }
    m.credits = trophy === vaultFor(LAST_RUN).trophy;
    m.loops += 1;
    if (!m.trophies.includes(trophy)) m.trophies.push(trophy);
    m.offer = offerCharms(seed, m.loops, runNumber(m.loops));
    m.picked = [];
  }

  /** The player ends the credits (or they ran out): the prestige screen comes up. */
  export function endCredits(m: MetaState): ActionResult {
    if (!m.credits) return fail("no credits rolling");
    m.credits = false;
    return OK;
  }
  ```

- [ ] **Step 5: The controller and the save.**
  - `game/controller.ts`: import `endCredits`; add `| { type: "endCredits" }` to `Action`; in `dispatch`: `case "endCredits": return this.emitOnOk(endCredits(this.meta), { type: "creditsEnded" });`; in `startNextRun`, after the `over` check: `if (this.meta.credits) return { ok: false, reason: "the credits are rolling" };`; in `flush`: `completeVault(this.meta, e.lifetimeEarnings, e.trophy, this.current.seed, this.current.state);`.
  - `sim/runTypes.ts` `SimEvent`: after `perkBought`, `/** Emitted by the controller: the credits ended (skipped or run out). */ | { type: "creditsEnded" }`.
  - `game/save.ts` `normalize`: `const meta: MetaState = { ...fresh, ...d.meta, perks: { ...fresh.perks, ...d.meta.perks }, stats: { ...fresh.stats, ...d.meta.stats } };` and in the state `best: d.run.state.best ?? null,`. The header comment adds: "F6 added the Upgrader, evolutions, the best drop and the campaign stats as fields with defaults; the version stays 5."

- [ ] **Step 6: Run the tests.**
  Run: `npx vitest run src/modules/casecremental`
  Expected: PASS.

- [ ] **Step 7: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/sim src/modules/casecremental/game
  git commit -m "feat(run4): campaign stats in the meta - play time, opens, best drop, CLOUT - and the credits flag after The Last Case

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 6: The surface — view, controller and agent

**Files:**
- Create: `game/viewRun4.ts`
- Modify: `game/view.ts`, `game/view.test.ts`, `game/controller.ts`, `game/controller.test.ts`, `game/agent.ts`, `game/agent.test.ts`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces (`game/viewRun4.ts`):
  ```ts
  export interface UpgraderView {
    available: boolean; on: boolean; cost: number; canBuy: boolean; needsLocker: boolean;
    stake: RarityId | null; stakeCount: number; stakeValue: number;
    /** Rarities the locker holds now, lowest first (what CHANGE cycles through). */
    stakes: RarityId[];
    target: number; mult: number; chance: number;
    spinning: boolean; progress: number; canGo: boolean;
  }
  export interface EvolutionView {
    id: EvolutionId; owned: boolean; cost: number; ready: boolean; canBuy: boolean;
    parts: Array<{ part: RecipePart; done: boolean; have: number | null }>;
  }
  export interface EvolutionsView { available: boolean; list: EvolutionView[] }
  export function upgraderView(run: Run): UpgraderView;
  export function evolutionsView(run: Run): EvolutionsView;
  ```
  `GameView` gains `upgrader: UpgraderView; evolutions: EvolutionsView;`; `PrestigeView` gains `credits: boolean; stats: CampaignStats;`.
- Produces (controller `Action`): `{ type: "buyUpgrader" } | { type: "setUpgraderStake"; rarity: RarityId | null } | { type: "setUpgraderTarget"; index: number } | { type: "upgraderGo" } | { type: "buyEvolution"; id: EvolutionId }` (and Task 5's `endCredits`).
- Produces (agent): `state().upgrader`, `state().evolutions`, `state().meta.credits`; actions `buyUpgrader`, `setUpgraderStake`, `setUpgraderTarget`, `upgraderGo`, `buyEvolution`, `endCredits`.

- [ ] **Step 1: Write the failing tests.**
  `game/view.test.ts`:
  ```ts
  it("shows the Upgrader in Run 4: it needs the locker, then the stake, the target and the chance", () => {
    const run = new Run(1, { ...DEFAULT_SETUP, run: 4, startCash: 1e18 });
    expect(buildView(run).upgrader).toMatchObject({ available: true, on: false, needsLocker: true, canBuy: false, cost: UPGRADER_COST });
    run.buyLocker();
    expect(buildView(run).upgrader).toMatchObject({ needsLocker: false, canBuy: true });
    buyUpgrader(run);
    const d = (id: number, rarity: RarityId) => ({ id, caseId: "bootcamp", skinId: "bc_woodland", rarity, float: 0.2, wear: "FT" as const, statTrak: false, value: 10 });
    run.state.locker.items = [d(1, "restricted"), d(2, "milspec"), d(3, "restricted")];
    setUpgraderStake(run, "restricted");
    setUpgraderTarget(run, 3);
    const v = buildView(run).upgrader;
    expect(v).toMatchObject({ on: true, stake: "restricted", stakeCount: 2, stakes: ["milspec", "restricted"], target: 3, mult: 10, canGo: true, spinning: false });
    expect(v.chance).toBeCloseTo(0.09, 9);
    expect(v.stakeValue).toBeCloseTo(2 * run.payout(d(1, "restricted"), false), 6);
    upgraderGo(run);
    expect(buildView(run).upgrader).toMatchObject({ spinning: true, canGo: false, progress: 0 });
    expect(buildView(new Run(1, { ...DEFAULT_SETUP, run: 3 })).upgrader.available).toBe(false);
  });

  it("shows the evolutions in Run 4 with their recipes, what is done and what each costs", () => {
    const run = new Run(1, { ...DEFAULT_SETUP, run: 4, startCash: 1e18 });
    run.state.upgrades.quickHands = 10;
    const ev = buildView(run).evolutions;
    expect(ev.available).toBe(true);
    expect(ev.list.map((e) => e.id)).toEqual(["slotMachine", "cartel", "moneyPrinter", "assemblyLine", "hotHand"]);
    const slot = ev.list[0]!;
    expect(slot.parts.map((p) => p.done)).toEqual([true, false]);
    expect(slot).toMatchObject({ ready: false, canBuy: false, owned: false, cost: EVOLUTION_COSTS.slotMachine });
    run.state.evolutions.bestCombo = 31;
    expect(buildView(run).evolutions.list[4]!.parts[1]).toMatchObject({ done: false, have: 31 });
    expect(buildView(new Run(1, { ...DEFAULT_SETUP, run: 3 })).evolutions.available).toBe(false);
  });
  ```
  In "shows the prestige screen once the run is over", add `expect(v.prestige).toMatchObject({ credits: false, stats: freshMeta().stats });`.
  `game/controller.test.ts`:
  ```ts
  it("routes the Upgrader's and the evolutions' actions", () => {
    const c = new GameController(1);
    c.devStartRun(4);
    c.devAddCash(1e18);
    expect(c.act({ type: "buyUpgrader" })).toEqual({ ok: false, reason: "buy the locker first" });
    c.act({ type: "buyLocker" });
    expect(c.act({ type: "buyUpgrader" }).ok).toBe(true);
    expect(c.act({ type: "setUpgraderStake", rarity: "milspec" }).ok).toBe(true);
    expect(c.act({ type: "setUpgraderTarget", index: 5 }).ok).toBe(true);
    expect(c.act({ type: "upgraderGo" })).toEqual({ ok: false, reason: "nothing to stake" });
    expect(c.act({ type: "buyEvolution", id: "cartel" })).toEqual({ ok: false, reason: "finish the recipe first" });
    expect(c.run.state.upgrader).toMatchObject({ on: true, stake: "milspec", target: 5 });
  });
  ```
  `game/agent.test.ts`:
  ```ts
  it("reports the Upgrader and the evolutions, and checks their arguments", async () => {
    const c = new GameController(1);
    c.devStartRun(4);
    const api = createAgentApi(c);
    const s = api.state() as { upgrader: unknown; evolutions: unknown; meta: { credits: boolean } };
    expect(s.upgrader).toEqual({ on: false, stake: null, target: 0, mult: 1.5, spinning: false });
    expect(s.evolutions).toEqual({ owned: [], ready: [], bestCombo: 0 });
    expect(s.meta.credits).toBe(false);
    await expect(api.actions.setUpgraderTarget!({ index: 9 })).resolves.toEqual({ ok: false, reason: "unknown target" });
    await expect(api.actions.buyEvolution!({ id: "nope" })).rejects.toThrow(/unknown evolution "nope"/);
    await expect(api.actions.setUpgraderStake!({ rarity: "shiny" })).rejects.toThrow(/unknown rarity "shiny"/);
  });
  ```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/game`
  Expected: FAIL (no `upgrader` view, unknown actions).

- [ ] **Step 3: Write `game/viewRun4.ts`.**
  ```ts
  import { runContent } from "../sim/campaign";
  import { EVOLUTION_IDS, evolved, type EvolutionId } from "../sim/evolved";
  import { partDone, RECIPES, recipeDone, type RecipePart } from "../sim/evolutions";
  import { RARITY_ORDER } from "../sim/rarity";
  import type { Run } from "../sim/run";
  import { EVOLUTION_COSTS, UPGRADER_COST, UPGRADER_MULTS, UPGRADER_SPIN_SECONDS } from "../sim/tuning";
  import type { RarityId } from "../sim/types";
  import { stakeItems, upgraderChance } from "../sim/upgrader";
  import { lockerWaiting } from "../sim/locker";

  // Run 4's machines in the view (finish spec §7.2, §7.3): the Upgrader on the locker and the evolutions — derived
  // from the run, never stored separately. buildView (view.ts) puts them in the GameView.

  export interface UpgraderView {
    /** This run has the Upgrader. */
    available: boolean;
    on: boolean;
    cost: number;
    canBuy: boolean;
    /** It can't be bought before the locker (its stakes come from there). */
    needsLocker: boolean;
    stake: RarityId | null;
    /** Skins GO would stake now, and what they would sell for. */
    stakeCount: number;
    stakeValue: number;
    /** Rarities the locker holds now, lowest first (what CHANGE cycles through). */
    stakes: RarityId[];
    target: number;
    mult: number;
    /** The win chance at this target (Loaded Dice included). */
    chance: number;
    spinning: boolean;
    /** The dial's progress 0–1. */
    progress: number;
    canGo: boolean;
  }

  export interface EvolutionView {
    id: EvolutionId;
    owned: boolean;
    cost: number;
    /** Its recipe is complete. */
    ready: boolean;
    canBuy: boolean;
    /** Each line of the recipe; `have` is the best hand combo for the combo line, else null. */
    parts: Array<{ part: RecipePart; done: boolean; have: number | null }>;
  }

  export interface EvolutionsView {
    /** This run has evolutions. */
    available: boolean;
    list: EvolutionView[];
  }

  export function upgraderView(run: Run): UpgraderView {
    const s = run.state;
    const u = s.upgrader;
    const open = !run.locked();
    const available = runContent(run.setup.run).upgrader;
    const items = stakeItems(run);
    const mult = UPGRADER_MULTS[u.target]!;
    return {
      available,
      on: u.on,
      cost: UPGRADER_COST,
      canBuy: open && available && s.locker.on && !u.on && s.cash >= UPGRADER_COST,
      needsLocker: !s.locker.on,
      stake: u.stake,
      stakeCount: items.length,
      stakeValue: items.reduce((a, d) => a + run.payout(d, false), 0),
      stakes: RARITY_ORDER.filter((r) => s.locker.items.some((d) => d.rarity === r)),
      target: u.target,
      mult,
      chance: upgraderChance(mult, run.setup.charms),
      spinning: u.spin !== null,
      progress: u.spin ? Math.min(1, u.spin.elapsed / UPGRADER_SPIN_SECONDS) : 0,
      canGo: open && u.on && !u.spin && !s.locker.press && !lockerWaiting(s.locker) && items.length > 0,
    };
  }

  export function evolutionsView(run: Run): EvolutionsView {
    const s = run.state;
    const open = !run.locked();
    const available = runContent(run.setup.run).evolutions;
    return {
      available,
      list: EVOLUTION_IDS.map((id) => {
        const owned = evolved(s, id);
        const ready = recipeDone(run, id);
        const cost = EVOLUTION_COSTS[id];
        return {
          id,
          owned,
          cost,
          ready,
          canBuy: open && available && !owned && ready && s.cash >= cost,
          parts: RECIPES[id].map((part) => ({ part, done: partDone(run, part), have: part.kind === "combo" ? s.evolutions.bestCombo : null })),
        };
      }),
    };
  }
  ```

- [ ] **Step 4: Wire the view, the controller and the agent.**
  - `game/view.ts`: import and re-export `UpgraderView`, `EvolutionView`, `EvolutionsView`, `upgraderView`, `evolutionsView` from `./viewRun4`; import `type CampaignStats`; `GameView` gains `upgrader: UpgraderView; evolutions: EvolutionsView;` after `locker`; `PrestigeView` gains `/** The Last Case opened: the credits roll first. */ credits: boolean; stats: CampaignStats;`; `buildView` sets `upgrader: upgraderView(run), evolutions: evolutionsView(run),` and in the prestige object `credits: meta.credits, stats: meta.stats,`.
  - `game/controller.ts`: import `* as upgrader` from `../sim/upgrader`, `buyEvolution` from `../sim/evolutions`, `type EvolutionId` from `../sim/evolved`; add the five actions to `Action` and to `dispatch` (the Run is the `RunCtx`; no `Run` methods, the file-size rule):
  ```ts
      case "buyUpgrader":
        return upgrader.buyUpgrader(run);
      case "setUpgraderStake":
        return upgrader.setUpgraderStake(run, a.rarity);
      case "setUpgraderTarget":
        return upgrader.setUpgraderTarget(run, a.index);
      case "upgraderGo":
        return upgrader.upgraderGo(run);
      case "buyEvolution":
        return buyEvolution(run, a.id);
  ```
  - `game/agent.ts`: import `EVOLUTION_IDS, type EvolutionId` and `recipeDone`; `state()` gains
  ```ts
        upgrader: {
          on: s.upgrader.on,
          stake: s.upgrader.stake,
          target: s.upgrader.target,
          mult: UPGRADER_MULTS[s.upgrader.target],
          spinning: s.upgrader.spin !== null,
        },
        evolutions: {
          owned: [...s.evolutions.owned],
          ready: EVOLUTION_IDS.filter((id) => !s.evolutions.owned.includes(id) && recipeDone(c.run, id)),
          bestCombo: s.evolutions.bestCombo,
        },
  ```
    and `meta: { …, credits: c.meta.credits }`. Actions (with the same argument checks the others use):
  ```ts
      buyUpgrader: () => run({ type: "buyUpgrader" }),
      setUpgraderStake: async (args: Args) => {
        if (args?.rarity == null) return c.act({ type: "setUpgraderStake", rarity: null });
        const r = String(args.rarity);
        if (!RARITY_ORDER.includes(r as RarityId)) throw new Error(`unknown rarity "${r}"; valid: ${RARITY_ORDER.join(", ")} or null`);
        return c.act({ type: "setUpgraderStake", rarity: r as RarityId });
      },
      setUpgraderTarget: (args: Args) => run({ type: "setUpgraderTarget", index: Number(args?.index ?? 0) }),
      upgraderGo: () => run({ type: "upgraderGo" }),
      buyEvolution: async (args: Args) => {
        const id = String(args?.id ?? "");
        if (!EVOLUTION_IDS.includes(id as EvolutionId)) throw new Error(`unknown evolution "${id}"; valid: ${EVOLUTION_IDS.join(", ")}`);
        return c.act({ type: "buyEvolution", id: id as EvolutionId });
      },
      endCredits: () => run({ type: "endCredits" }),
  ```
    and their descriptions in the descriptions map, in the file's voice: "Run 4: buy the Upgrader (needs the locker): stake a locker rarity stack on a multiplier."; "The rarity stack the Upgrader stakes: { rarity } or { rarity: null }."; "The Upgrader's target: { index } into x1.5, x2, x5, x10, x25, x100."; "GO: stake the whole stack; the dial spins 3 s; a win's skin waits on the locker."; "Run 4: buy an evolution whose recipe is complete: { id: slotMachine|cartel|moneyPrinter|assemblyLine|hotHand }."; "End the credits after The Last Case (the prestige screen follows).".

- [ ] **Step 5: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/game`
  Expected: PASS.

- [ ] **Step 6: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/game
  git commit -m "feat(run4): the Upgrader, the evolutions and the credits in the view, the controller and the agent

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 7: The Machines rows (EN + RU)

Two row groups under the locker on the Machines tab, shown only in Run 4+ (a machine of a later run has no rows until its run).
- **Upgrader:** before purchase one row "Upgrader / Stake skins, go big / BUY $…" ("Needs the locker" before the locker). After: a **stake** row (the rarity in its colour, "{n} for {$}", CHANGE cycles the rarities the locker holds and then none); a **target** row ("x{m}", CHANGE cycles the six multipliers); a **GO** row (GO with "Win {p}%" under it; "ROLLING..." with a bar while it spins; "Locker is empty" when nothing can be staked).
- **Evolutions:** a title row, then one row per evolution: its name, its effect line, its recipe lines (each ✓ when done, the combo line as "Hand combo 31/50"), and EVOLVE with the price (disabled until the recipe is complete), or EVOLVED once bought.

**Files:**
- Create: `ui/run4Rules.ts`, `ui/run4Rules.test.ts`, `ui/UpgraderRows.tsx`, `ui/EvolutionRows.tsx`
- Modify: `ui/MachinesPanel.tsx` (the header comment and two lines), `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`, `i18n/content.ts` (evolution names and effects), `i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `GameView.upgrader`, `GameView.evolutions`, the Task 6 actions.
- Produces:
  ```ts
  // ui/run4Rules.ts
  export function nextStake(stakes: readonly RarityId[], current: RarityId | null): RarityId | null;
  export const nextTarget: (target: number) => number;
  export const percent: (chance: number) => string; // "60", "0.9", "11"
  export function partText(p: RecipePart, have: number | null): string;
  // i18n/content.ts
  export const evolutionName: (id: EvolutionId) => string;
  export const evolutionDesc: (id: EvolutionId) => string;
  ```

- [ ] **Step 1: Write the failing tests** in `ui/run4Rules.test.ts`.
  ```ts
  import { afterEach, describe, expect, it } from "vitest";
  import { budgetFor, fitsBudget } from "../i18n/budgets";
  import { evolutionDesc, evolutionName } from "../i18n/content";
  import { setLang } from "../i18n/index";
  import { EVOLUTION_IDS } from "../sim/evolved";
  import { RECIPES } from "../sim/evolutions";
  import { nextStake, nextTarget, partText, percent } from "./run4Rules";

  afterEach(() => setLang("en"));

  describe("the Upgrader's rows", () => {
    it("cycles the stake through the rarities the locker holds, then none", () => {
      expect(nextStake(["milspec", "covert"], null)).toBe("milspec");
      expect(nextStake(["milspec", "covert"], "milspec")).toBe("covert");
      expect(nextStake(["milspec", "covert"], "covert")).toBeNull();
      expect(nextStake(["milspec", "covert"], "restricted")).toBe("covert"); // a stake that emptied moves on up
      expect(nextStake([], "gold")).toBeNull();
    });

    it("cycles the six targets and prints chances to two significant digits", () => {
      expect([0, 1, 2, 3, 4, 5].map(nextTarget)).toEqual([1, 2, 3, 4, 5, 0]);
      expect([0.6, 0.45, 0.18, 0.109, 0.009, 0.95].map(percent)).toEqual(["60", "45", "18", "11", "0.9", "95"]);
    });
  });

  describe("the evolutions' rows", () => {
    it("writes each recipe line", () => {
      expect(partText({ kind: "upgrade", id: "quickHands" }, null)).toBe("Quick Hands MAX");
      expect(partText({ kind: "botSpeed" }, null)).toBe("Bot Speed MAX");
      expect(partText({ kind: "combo", n: 50 }, 31)).toBe("Hand combo 31/50");
      setLang("ru");
      expect(partText({ kind: "combo", n: 50 }, 31)).toBe("Комбо руками 31/50");
    });

    it.each(["en", "ru"] as const)("fits every name, effect and recipe line (%s)", (lang) => {
      setLang(lang);
      for (const id of EVOLUTION_IDS) {
        expect(fitsBudget(evolutionName(id), budgetFor("evo.name.x")), evolutionName(id)).toBe(true);
        expect(fitsBudget(evolutionDesc(id), budgetFor("evo.desc.x")), evolutionDesc(id)).toBe(true);
        for (const p of RECIPES[id]) expect(fitsBudget(partText(p, 50), budgetFor("evo.part.x")), partText(p, 50)).toBe(true);
      }
    });

    it("never needs a Russian word longer than a panel line", () => {
      setLang("ru");
      for (const id of EVOLUTION_IDS)
        for (const w of [evolutionName(id), evolutionDesc(id)].join(" ").split(/\s+/)) expect([...w].length, w).toBeLessThanOrEqual(11);
    });
  });
  ```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/ui/run4Rules.test.ts`
  Expected: FAIL, because `./run4Rules` does not exist.

- [ ] **Step 3: The strings.**
  - `i18n/budgets.ts`: add `["upgrader.", 20],` and `["evo.", 24],` (after `["locker.", 20],`).
  - `i18n/en.ts` / `i18n/ru.ts` (same keys):

  | key | EN | RU |
  |---|---|---|
  | `upgrader.name` | Upgrader | Апгрейдер |
  | `upgrader.desc` | Stake skins, go big | Ставь скины на рост |
  | `upgrader.needs` | Needs the locker | Нужен шкафчик |
  | `upgrader.stake` | Stake: | Ставка: |
  | `upgrader.stakeOf` | {n} for {v} | {n} за {v} |
  | `upgrader.none` | None | Нет |
  | `upgrader.empty` | Locker is empty | Шкафчик пуст |
  | `upgrader.target` | Target: | Цель: |
  | `upgrader.chance` | Win {p}% | Шанс {p}% |
  | `upgrader.rolling` | ROLLING... | КРУТИТСЯ... |
  | `btn.go` | GO | ВПЕРЁД |
  | `btn.evolve` | EVOLVE | РАЗВИТЬ |
  | `btn.evolved` | EVOLVED | РАЗВИТО |
  | `evo.title` | EVOLUTIONS | ЭВОЛЮЦИИ |
  | `evo.part.max` | {name} MAX | {name}: МАКС |
  | `evo.part.combo` | Hand combo {n}/{max} | Комбо руками {n}/{max} |
  | `evo.part.botSpeed` | Bot Speed | Скорость бота |
  | `evo.part.sellerSpeed` | Seller Speed | Скорость продавца |
  | `evo.part.autoSpinDelay` | Auto-spin Delay | Пауза автоспина |

  - `i18n/content.ts`: add a table and getters (and their rows in `CONTENT_KEYS`, prefixed `evo.name.` / `evo.desc.`):
  ```ts
  const EVOLUTIONS: Record<EvolutionId, { name: Pair; desc: Pair }> = {
    slotMachine: { name: { en: "Slot Machine", ru: "Игровой автомат" }, desc: { en: "BUY opens x10", ru: "BUY открывает x10" } },
    cartel: { name: { en: "Cartel", ru: "Картель" }, desc: { en: "Bot keeps the best of 2", ru: "Бот берёт лучший из 2" } },
    moneyPrinter: { name: { en: "Money Printer", ru: "Денежный станок" }, desc: { en: "Auto-seller sales x3", ru: "Автопродажи x3" } },
    assemblyLine: { name: { en: "Assembly Line", ru: "Конвейер" }, desc: { en: "No delay, 25th is free", ru: "Без паузы, 25-й даром" } },
    hotHand: { name: { en: "Hot Hand", ru: "Горячая рука" }, desc: { en: "Combo 25+: +5 Luck", ru: "Комбо 25+: +5 удачи" } },
  };
  export const evolutionName = (id: EvolutionId): string => pick(EVOLUTIONS[id]?.name);
  export const evolutionDesc = (id: EvolutionId): string => pick(EVOLUTIONS[id]?.desc);
  ```

- [ ] **Step 4: Write `ui/run4Rules.ts`.**
  ```ts
  import { upgradeName } from "../i18n/content";
  import { t } from "../i18n/index";
  import type { RecipePart } from "../sim/evolutions";
  import { RARITY_ORDER } from "../sim/rarity";
  import { UPGRADER_MULTS } from "../sim/tuning";
  import type { RarityId } from "../sim/types";

  // Run 4's Machines rows (finish spec §7.2, §7.3), as pure rules: what CHANGE picks next, how a chance and a recipe
  // line are written.

  /** The next stake: the next rarity up that the locker holds, then none, then the lowest again. */
  export function nextStake(stakes: readonly RarityId[], current: RarityId | null): RarityId | null {
    if (current === null) return stakes[0] ?? null;
    const from = RARITY_ORDER.indexOf(current);
    return stakes.find((r) => RARITY_ORDER.indexOf(r) > from) ?? null;
  }

  export const nextTarget = (target: number): number => (target + 1) % UPGRADER_MULTS.length;

  /** A chance as a percentage with two significant digits at most ("60", "11", "0.9"). */
  export const percent = (chance: number): string => String(Number((chance * 100).toPrecision(2)));

  /** One recipe line ("Quick Hands MAX", "Hand combo 31/50"). */
  export function partText(p: RecipePart, have: number | null): string {
    if (p.kind === "combo") return t("evo.part.combo", { n: Math.min(have ?? 0, p.n), max: p.n });
    const name = p.kind === "upgrade" ? upgradeName(p.id) : t(`evo.part.${p.kind}` as const);
    return t("evo.part.max", { name });
  }
  ```
  (Russian decimals: `percent` returns a dot; the rows pass it through `formatPercent` = `getLang() === "ru" ? s.replace(".", ",") : s` inline, as `formatCash` does.)

- [ ] **Step 5: Write the rows.** `ui/UpgraderRows.tsx` (same parts and layout as `LockerRows.tsx`):
  ```tsx
  import type { ReactNode } from "react";
  import type { GameView } from "../game/view";
  import { rarityName } from "../i18n/content";
  import { getLang, t } from "../i18n/index";
  import { formatCash } from "../sim/format";
  import { RARITY_INFO } from "../sim/rarity";
  import { cssColor } from "./botBoard";
  import { boardOpen, type Act } from "./machineRules";
  import { Bar, PxButton } from "./parts";
  import { nextStake, nextTarget, percent } from "./run4Rules";

  // The Upgrader's rows on the Machines tab (finish spec §7.2, Run 4+; hidden before): buy it (after the locker);
  // the stake (a locker rarity stack, CHANGE cycles what the locker holds); the target multiplier; GO with its win
  // chance, or the dial's bar while it spins.

  export function UpgraderRows({ view, act }: { view: GameView; act: Act }): ReactNode {
    const u = view.upgrader;
    const lang = getLang();
    if (!u.available) return null;
    if (!u.on)
      return (
        <div className="cc-row">
          <div>{t("upgrader.name")}</div>
          <div className="cc-dim">{u.needsLocker ? t("upgrader.needs") : t("upgrader.desc")}</div>
          <PxButton disabled={!u.canBuy} onClick={() => act({ type: "buyUpgrader" })}>
            {t("btn.buy")}
            <span className="cc-btn-sub">{formatCash(u.cost, lang)}</span>
          </PxButton>
        </div>
      );
    const pct = lang === "ru" ? percent(u.chance).replace(".", ",") : percent(u.chance);
    return (
      <>
        <div className="cc-row">
          <div>{t("upgrader.stake")}</div>
          {u.stake ? (
            <div style={{ color: cssColor(RARITY_INFO[u.stake].color) }}>
              {rarityName(u.stake)} {t("upgrader.stakeOf", { n: u.stakeCount, v: formatCash(u.stakeValue, lang) })}
            </div>
          ) : (
            <div className="cc-dim">{u.stakes.length ? t("upgrader.none") : t("upgrader.empty")}</div>
          )}
          <PxButton disabled={!boardOpen(view)} onClick={() => act({ type: "setUpgraderStake", rarity: nextStake(u.stakes, u.stake) })}>
            {t("btn.change")}
          </PxButton>
        </div>
        <div className="cc-row">
          <div>{t("upgrader.target")}</div>
          <div className="cc-gold">{`x${u.mult}`}</div>
          <PxButton disabled={!boardOpen(view) || u.spinning} onClick={() => act({ type: "setUpgraderTarget", index: nextTarget(u.target) })}>
            {t("btn.change")}
          </PxButton>
        </div>
        <div className="cc-row">
          {u.spinning ? (
            <>
              <div>{t("upgrader.rolling")}</div>
              <Bar progress={u.progress} />
            </>
          ) : (
            <PxButton disabled={!u.canGo} onClick={() => act({ type: "upgraderGo" })}>
              {t("btn.go")}
              <span className="cc-btn-sub">{t("upgrader.chance", { p: pct })}</span>
            </PxButton>
          )}
        </div>
      </>
    );
  }
  ```
  `ui/EvolutionRows.tsx`:
  ```tsx
  import type { ReactNode } from "react";
  import type { GameView } from "../game/view";
  import { evolutionDesc, evolutionName } from "../i18n/content";
  import { getLang, t } from "../i18n/index";
  import { formatCash } from "../sim/format";
  import type { Act } from "./machineRules";
  import { PxButton } from "./parts";
  import { partText } from "./run4Rules";

  // The evolutions' rows on the Machines tab (finish spec §7.3, Run 4+; hidden before): each evolution's effect and
  // recipe (a line per part, ticked when done), EVOLVE once the recipe is complete, EVOLVED once bought.

  export function EvolutionRows({ view, act }: { view: GameView; act: Act }): ReactNode {
    const ev = view.evolutions;
    const lang = getLang();
    if (!ev.available) return null;
    return (
      <>
        <div className="cc-title">{t("evo.title")}</div>
        {ev.list.map((e) => (
          <div key={e.id} className="cc-row" lang={lang}>
            <div>{evolutionName(e.id)}</div>
            <div className="cc-dim">{evolutionDesc(e.id)}</div>
            {e.parts.map((p, i) => (
              <div key={i} className={p.done ? "cc-gold" : "cc-dim"}>
                {`${p.done ? "✓" : "·"} ${partText(p.part, p.have)}`}
              </div>
            ))}
            {e.owned ? (
              <PxButton disabled on>
                {t("btn.evolved")}
              </PxButton>
            ) : (
              <PxButton disabled={!e.canBuy} onClick={() => act({ type: "buyEvolution", id: e.id })}>
                {t("btn.evolve")}
                <span className="cc-btn-sub">{formatCash(e.cost, lang)}</span>
              </PxButton>
            )}
          </div>
        ))}
      </>
    );
  }
  ```
  (If Press Start 2P lacks "✓", the build's font test or a browser look shows a box: then use "+" for done and "-" for not done. Check `fx/hd/font.ts` / the bundled font's glyph list before choosing.)
  `ui/MachinesPanel.tsx`: render `<UpgraderRows view={view} act={act} />` and `<EvolutionRows view={view} act={act} />` after `<LockerRows …/>`; the header comment lists "the Upgrader and evolutions (Run 4+)".

- [ ] **Step 6: Run the tests.**
  Run: `npx vitest run src/modules/casecremental/ui src/modules/casecremental/i18n`
  Expected: PASS (the budget test covers every new key in both languages).

- [ ] **Step 7: Run everything, then commit.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS).
  ```bash
  git add src/modules/casecremental/ui src/modules/casecremental/i18n
  git commit -m "feat(run4): Machines rows for the Upgrader and the evolutions - stake, target, GO, recipes, EVOLVE (EN + RU)

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 8: Run 4's pacing

The pacing players play Run 4: they buy the Upgrader like any machine (they never gamble with it) and an evolution once its recipe is complete and it costs at most a quarter of their cash. Run 4 and its replay get spec §5's targets for both timing profiles, Run 4 must reach Unhinged, and the 90 s rule holds for Run 4. Then tune `sim/tuning.ts` until they pass.

**Targets (spec §5, median of 5 seeds):**

| | GREEDY | CASUAL |
|---|---|---|
| Run 4 catch-up to Run 3's shelf | 0.5–1.5 min | 1–2 min |
| Run 4 vault (The Last Case) | 4–6 min | 5–8 min |
| A replay of Run 4's vault | 3–5 min | 4–7 min |
| The 90 s rule (CASUAL) | — | The Last Case ≤ 90 s of income once everything is bought |
| Stage | Run 4 reaches 5 (Unhinged) | — |

**Files:**
- Modify: `sim/bot.ts`, `sim/pacing.test.ts`, `sim/tuning.ts`

**Interfaces:**
- Consumes: F4's `CASUAL` timing profile and F4's "fully bought" / 90 s helpers in `sim/bot.ts` (use F4's names; the code below assumes `playGreedy(seed, seconds, timings, setup)` and the report fields F4 left). If F4 did not leave a "fully bought" helper, add the one in Step 3.
- Produces: the greedy and casual players buy the Upgrader and evolutions; Run 4's pacing tests.

- [ ] **Step 1: Write the failing tests** in `sim/pacing.test.ts`. If F4's test already builds a per-profile chain through the vaults (it should: spec §5 has Runs 2–4 targets), extend that chain's trophy list with `"vault3", "lastcase"` and add these assertions to it instead of building a second chain. The stand-alone form:
  ```ts
  describe("pacing — Run 4 and its replay (finish spec §5, §7)", () => {
    const TROPHIES = ["vault1", "vault2", "vault3", "lastcase"] as const;
    /** Run 1 → … → Run 4 → the Run 4 replay, the cheapest perk after each vault; returns [Run 4, its replay]. */
    function chain(seed: number, timings: BotTimings): PacingReport[] {
      const meta = freshMeta();
      let earnings = playGreedy(seed, 900, timings).lifetimeEarnings;
      const out: PacingReport[] = [];
      for (const trophy of TROPHIES) {
        completeVault(meta, earnings, trophy, seed);
        const cheapest = [...PERK_IDS].sort(
          (a, b) => (perkCost(a, meta.perks[a]) ?? Infinity) - (perkCost(b, meta.perks[b]) ?? Infinity),
        )[0]!;
        buyPerk(meta, cheapest);
        const r = playGreedy(seed + 100 * meta.loops, 900, timings, setupFor(meta));
        out.push(r);
        earnings = r.lifetimeEarnings;
      }
      return out.slice(2);
    }
    const greedy = SEEDS.map((s) => chain(s, HUMAN));
    const casual = SEEDS.map((s) => chain(s, CASUAL));
    const med = (rs: PacingReport[][], i: number, pick: (r: PacingReport) => number | undefined) =>
      median(rs.map((c) => pick(c[i]!) ?? Infinity));

    it("GREEDY: Run 4 catches up to Run 3's shelf in 0.5–1.5 min and opens The Last Case at 4–6 min, reaching Unhinged", () => {
      const t = med(greedy, 0, (r) => r.runCasesAt[3]);
      expect(t).toBeGreaterThan(30);
      expect(t).toBeLessThan(90);
      const v = med(greedy, 0, (r) => r.vaultAt);
      expect(v).toBeGreaterThan(240);
      expect(v).toBeLessThan(360);
      expect(median(greedy.map((c) => c[0]!.topStage))).toBe(5);
    });

    it("CASUAL: Run 4 catches up in 1–2 min and opens The Last Case at 5–8 min", () => {
      const t = med(casual, 0, (r) => r.runCasesAt[3]);
      expect(t).toBeGreaterThan(60);
      expect(t).toBeLessThan(120);
      const v = med(casual, 0, (r) => r.vaultAt);
      expect(v).toBeGreaterThan(300);
      expect(v).toBeLessThan(480);
    });

    it("a Run 4 replay opens The Last Case again at 3–5 min (GREEDY) and 4–7 min (CASUAL)", () => {
      const g = med(greedy, 1, (r) => r.vaultAt);
      expect(g).toBeGreaterThan(180);
      expect(g).toBeLessThan(300);
      const c = med(casual, 1, (r) => r.vaultAt);
      expect(c).toBeGreaterThan(240);
      expect(c).toBeLessThan(420);
    });

    it("the 90 s rule: once everything of Run 4 is bought, The Last Case costs at most 90 s of CASUAL income", () => {
      for (const c of casual) {
        const r = c[0]!;
        expect(r.fullAt, "Run 4 never had everything bought").toBeDefined();
        expect(r.fullIncome!).toBeGreaterThan(0);
        expect(r.vaultPrice / r.fullIncome!).toBeLessThanOrEqual(90);
      }
    });

    it("never leaves the tray stuck full for long in Run 4", () => {
      for (const c of [...greedy, ...casual]) for (const r of c) expect(r.longestTrayFull).toBeLessThan(10);
    });

    it("buys the Upgrader in Run 4", () => {
      expect(median(greedy.map((c) => c[0]!.upgraderAt ?? Infinity))).toBeLessThan(Infinity);
    });
  });
  ```
  (Import `CASUAL` and `BotTimings` from `./bot`. If F4 already added `fullAt`/`fullIncome`/`vaultPrice` under other names, use those names and delete Step 3's additions.)

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/sim/pacing.test.ts`
  Expected: FAIL (no `upgraderAt`; the medians are off target).

- [ ] **Step 3: The players buy Run 4's machines.** In `sim/bot.ts`:
  - import `buyUpgrader` from `./upgrader`, `buyEvolution, recipeDone` from `./evolutions`, `EVOLUTION_IDS` from `./evolved`, `EVOLUTION_COSTS, UPGRADER_COST` from `./tuning`;
  - `PacingReport` gains `/** When the Upgrader (Run 4) was bought. */ upgraderAt?: number;` and, unless F4 has them: `/** When every case, upgrade and machine of the run was first bought (evolutions excluded: a recipe may never complete). */ fullAt?: number; /** Earnings per second over the 20 s after fullAt. */ fullIncome?: number; vaultPrice: number;`;
  - in the event loop: `if (e.type === "upgraderBought") report.upgraderAt ??= s.time;`;
  - in `spend`, before the cheapest-quarter block, with the other machines:
  ```ts
    if (content.upgrader && s.locker.on && !s.upgrader.on && s.cash >= UPGRADER_COST * 2) {
      buyUpgrader(run); // it never gambles with it
      return;
    }
  ```
    and with the offers: `for (const id of EVOLUTION_IDS) if (content.evolutions && !s.evolutions.owned.includes(id) && recipeDone(run, id)) offer(EVOLUTION_COSTS[id], () => buyEvolution(run, id));`;
  - unless F4 has one, a `fullyBought(run)` check after each `spend`, and the income window:
  ```ts
  /** Every case of the shelf unlocked, every upgrade and machine at this run's cap (evolutions excluded). */
  function fullyBought(run: Run): boolean {
    const s = run.state;
    const content = runContent(run.setup.run);
    const r = run.setup.run;
    return (
      run.vaultShown() &&
      UPGRADE_IDS.every((id) => upgradeCost(id, s.upgrades[id], r) === null) &&
      s.bot.awake && botSpeedCost(s.bot.speedLevel, r) === null && (content.botMultiOpen <= 1 || s.bot.multiLevel > 0) &&
      s.seller.on && sellerSpeedCost(s.seller.speedLevel) === null &&
      s.autoSpin.owned && autoSpinDelayCost(s.autoSpin.delayLevel) === null &&
      (!content.locker || (s.locker.on && lockerSizeCost(s.locker.sizeLevel) === null)) &&
      (!content.autoContract || s.locker.auto) &&
      (!content.upgrader || s.upgrader.on)
    );
  }
  ```
    In the main loop, once per tick: `if (report.fullAt === undefined && fullyBought(run)) { report.fullAt = s.time; fullFrom = s.lifetimeEarnings; }` and `if (report.fullAt !== undefined && report.fullIncome === undefined && s.time >= report.fullAt + 20) report.fullIncome = (s.lifetimeEarnings - fullFrom) / 20;` with `let fullFrom = 0;` beside `busyUntil`; set `report.vaultPrice = setup.vaultPrice` at the start. (`playGreedy` keeps playing after `fullAt` until the vault, so the window fills.)
  - Update the file's header comment: "…the auto contract, and in Run 4 the Upgrader (it never gambles) and each evolution once its recipe is complete…".

- [ ] **Step 4: Tune.** Run the test, read the medians, change only `sim/tuning.ts`:
  - To print the medians while tuning, add a temporary `console.log` inside the test file (never committed), e.g. `console.log("run4", greedy.map((c) => [c[0]!.runCasesAt[3], c[0]!.vaultAt, c[1]!.vaultAt]))`.
  - Levers, in this order: `CASE_ECONOMY.glitch.unlockCost` and `CASE_ECONOMY.feverdream.unlockCost` (catch-up and the run's middle), `VAULT_PRICES[3]` (the vault time; it also moves the 90 s rule), `VAULT_GROWTH` only if the replay is off while Run 4 is on target (it changes every replay — re-run the whole pacing file), `UPGRADER_COST` and `EVOLUTION_COSTS` (they must stay buyable before the vault in a greedy run, or `fullAt` never comes).
  - The 90 s rule and the vault window pull against each other: if the vault is on time but the rule fails, the run's middle is too fast (raise the unlock costs) and the vault too dear for its income (lower `VAULT_PRICES[3]`).
  - Keep every price at least 7× the one below (`cases.test.ts`).
  - Earlier runs' tests (F4's) must stay green: none of these levers touch Runs 1–3 except `VAULT_GROWTH`.

- [ ] **Step 5: Run the whole pacing file and the suite.**
  Run: `npx vitest run src/modules/casecremental/sim/pacing.test.ts` (PASS), then `npm run typecheck && npx vitest run src/modules/casecremental && npm run build` (PASS). Remove the temporary `console.log`.

- [ ] **Step 6: Commit,** with the measured medians in the message body.
  ```bash
  git add src/modules/casecremental/sim/bot.ts src/modules/casecremental/sim/pacing.test.ts src/modules/casecremental/sim/tuning.ts
  git commit -m "feat(run4): Run 4's pacing - catch-up, The Last Case and its replay for both profiles, Unhinged, the 90 s rule

  Medians (5 seeds): GREEDY catch-up <t>s, Last Case <t>s, replay <t>s; CASUAL <t>s / <t>s / <t>s; 90 s rule max <x>s.

  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```
  (Write the real numbers in place of `<t>`/`<x>`.)

---

## Self-review notes (spec §7 coverage, sim side)

| Spec item | Covered in |
|---|---|
| `LAST_RUN` 4; replays of Run 4, `VAULT_GROWTH` per loop | Task 2 (campaign test: `vaultPriceFor(5)`) |
| Cases 8–9, 14 skins → 13 like every case, new finishes | Task 1 (finishes drawn in F6-B Task 1) |
| `RUN_CONTENT[3]`: 9 cases, ×5, bot ×100, bot ×3, locker, auto contract, Upgrader, evolutions | Task 2 |
| Loaded Dice in Run 4's pool, +10 points | Tasks 2, 3 |
| Upgrader: stake, ×1.5…×100, 0.9/m (+0.10, cap 0.95), rolled at GO, reload-safe, win → skin ≈ V×m, loss gone | Task 3 (dial and pop/shred: F6-B Task 5) |
| Evolutions: recipes, one purchase, effects | Task 4 (looks: F6-B Tasks 3–4) |
| The Last Case as Run 4's vault, `lastcase`, ★ Singularity | Task 2 (look, tear, fanfare: F6-C) |
| Campaign stats in the meta for the credits | Task 5 (credits screen: F6-C) |
| Save migration if needed | Tasks 3–5: defaults in `normalize`, no version bump |
| Run 4 pacing (spec §5), 90 s rule, Unhinged | Task 8 |
| Machines rows | Task 7 |
