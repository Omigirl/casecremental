# Casecremental F7 — Server Meta on iDosGames — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move what outlives a run to the iDosGames Title: CLOUT as a server currency, a `Trophies` item catalog (one item per Covert and ★ skin, the vault legends and ★ Singularity), a `best_run` leaderboard and the perks, validated by CloudCode with plausibility caps. The local meta becomes a cache that works offline, and the lobby gets a Trophy Case tab and a Leaderboard tab.

**Architecture:** The run stays client-simulated (base spec §10.1). A new `meta/` folder in the game module holds the server side of the meta: the trophy list and the caps computed from the content tables (`meta/trophies.ts`, `meta/plausibility.ts`, `meta/serverData.ts`), a persistent FIFO call queue (`meta/queue.ts`), the bridge that drains it (`meta/bridge.ts`), the merge of a server answer into `MetaState` (`meta/merge.ts`) and the only file that touches the SDK (`meta/clientPort.ts`). `game/serverSync.ts` turns sim events into queued calls. The CloudCode lives outside `src/` in `cloudcode/`: hand-written rules in `casecremental.js` (all server API calls behind one `makeIo` adapter), a generated `data.json` (trophies, perks, caps, from the same TypeScript tables), and `tools/cloud/bundle.mjs`, which joins them into the one script that gets published. Vitest runs the rules with a fake `io`. The Title config payloads are committed JSON in `cloudcode/config/`, so promoting DEV to live replays the same files.

**Tech Stack:** TypeScript (strict), React 19, Vitest, Vite 8, `@idosgames/core` 0.21.2 (`client.cloudCode.execute`, `client.leaderboard`, `client.userCustomData`, `client.data.user`), `@idosgames/react` 0.4.4 (`useUserState`, `useIDosGamesClient`), `@idosgames/module-sdk` 0.10.0 (`ctx.features.register`), the idosgames MCP for the Title config, CloudCode (plain JavaScript, `handlers.<name> = function (args, context)`).

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-finish-design.md` §8 (binding), with §1 (phases), §7.4 (campaign stats in the meta, The Last Case trophy) and §11 (testing). The original server design is the base spec `docs/superpowers/specs/2026-10-07-casecremental-design.md` §10.3–10.4 (CLOUT, Trophies, `best_run` with a log score, `reportTrophy` / `endRun` / `buyPerk` with plausibility caps). Where they disagree, the finish spec wins. Before Task 1, read `docs/feature-history/casecremental-run1.md` (meta, prestige and save decisions) and `docs/feature-history/casecremental-finish.md`.

**F1–F6 land before this plan.** F6-A adds cases 8–9 (Glitch, Fever Dream), `LAST_RUN = 4`, The Last Case (`VaultDef` id `lastcase`, trophy `"lastcase"`, legend skin `lastcase_legend`, ★ Singularity), the Upgrader (`upgraderDone { win; result: Drop | null; inputs }`) and the campaign stats (`MetaState.stats: CampaignStats { playSeconds; opened; best: Drop | null; cloutEarned }`, `MetaState.credits`, `completeVault(m, lifetimeEarnings, trophy, seed, run?)`). F2 removed the grid (no more `gridOpened`). F4 retuned `sim/tuning.ts` and may have added a timing profile to `sim/bot.ts`. Before Task 1, re-read as they are now: `sim/meta.ts`, `sim/runTypes.ts` (the `SimEvent` union), `sim/tuning.ts`, `sim/content/cases.ts`, `sim/content/vaults.ts`, `sim/campaign.ts`, `sim/charms.ts`, `sim/bot.ts`, `game/controller.ts`, `game/save.ts`, `module.ts`. Where a snippet below quotes code that F2–F6 changed, apply the same change to the code as it is now.

**What the Title has today (read with the MCP on 2026-10-12):**
- `ZVKC34TR-DEV`: only the idle-rpg seed. Currency `GOLD` (initial 500), `GEMS` (initial 300); item catalog `Item` (12 items: `wooden_sword`, `iron_sword`, `crystal_staff`, `dragon_blade`, `leather_vest`, `chainmail`, `knight_plate`, `dragon_scale`, `copper_ring`, `silver_ring`, `ruby_ring`, `phoenix_ring`); lootbox `gear_summon`; characters `Knight`, `Archer`, `Mage`; store `shop` with offers `free_gems`, `gold_bag_small`, `gold_bag_big`, `starter_sword`; quest cycle `guide` with quests `guide_enhance`, `guide_stages`, `guide_summon`, `guide_spend`, `guide_stages_10`; reward idle accrual `idle_gold`. **No** CloudCode, leaderboard, user-data schema, blockchain config, title data or secrets.
- `ZVKC34TR` (live): the same seed, plus crypto currency `Main` ("FOMO", Solana mint `D3Ca3V8nhwgcHn1dvikjbCTHaQ3zHrQKi1Q7mbaCidos`, protected) with its IOU `Main_IOU`, and a Blockchain section with network `solana` (mainnet, ChainID 0, wallet login off, account safety: 7-day minimum account age). No CloudCode, no leaderboard.
- Nothing in this project uses any seed entity: `src/modules.ts` has only `casecremental`, so no lobby system shows them.

**CloudCode runtime (from the MCP tool descriptions and `@idosgames/core` `.d.ts`):** plain JavaScript filling a global `handlers` object: `handlers.name = function (args, context) { … }`. `args` is the client's `FunctionParameter`; `context.UserID` is the caller. Globals: `log.Info/Warning/Error`, `server.*` (`ReadUserData`, `GetTitleConfig`, `GetUserCustomData`, `SetUserCustomData`, `DeleteUserCustomData`, `BatchSetUserCustomData`, `GetPublicUserCustomDataOf`, `Get/Set/IncrementTitleCustomData`, `GetIntegrationVariable`, `HttpRequest`, and — when `CloudCode.ResourcePolicy.Enabled` — `ApplyResourceOperation`), each returning `{ Success, Error, Data }`. No async, no imports, 10 s per call, a per-execution cap on `server.*` calls. Only CloudCode can write the `ReadOnly` / `Internal` user-data buckets. The client calls `client.cloudCode.execute(name, args)` → `OperationResult<ExecuteCloudCodeResponse>` (`FunctionResult`, `Error: { Error: "None" | "RateLimited" | … }`, `Logs`). **The argument shapes of the `server.*` calls are not documented anywhere we can read** (the catalog MCP with the SDK skills is disconnected this session), so Task 2 runs a probe on DEV first and `makeIo` is written against what it reports.

**Stock lobby modules:** the catalog (`idosgames-registry` MCP) is disconnected and `src/modules.ts` is platform-owned, so a stock inventory / leaderboard module cannot be installed from here. Per spec §8's fallback, the Trophy Case and the Leaderboard are lobby tabs registered by the game module (`ctx.features.register`). The base already draws the profile (`src/base/lobby/Account.tsx`).

## Global Constraints

- Every player-facing string exists in EN (`i18n/en.ts`) and RU (`i18n/ru.ts`) and fits its `i18n/budgets.ts` budget; Russian has exactly the English keys (`i18n.test.ts`); Russian wraps only at whole words. Russian names already fixed: CLOUT is «ХАЙП».
- Never put secrets, keys or tokens in client code or in `cloudcode/` (it ships to the Title as readable config).
- SDK calls return `OperationResult` (`isOk` / `isFail`) and never throw; a CloudCode handler returns `{ ok: false, reason, retry }` instead of throwing. Wrap every SDK call anyway: a failed call never blocks play.
- Use only APIs present in `node_modules/@idosgames/*/dist/*.d.ts` (the names this plan uses were checked there: `client.cloudCode.execute`, `client.leaderboard.getLeaderboard/getMyProgress/submitScore`, `client.userCustomData.batchGetPublicUserCustomDataOf`, `client.data.user.state`, `useUserState`, `useIDosGamesClient`, `ctx.features.register/setAvailable`). Never invent an SDK method.
- Cases are bought only with in-game cash, never crypto (gambling guardrail). Nothing in this plan prices anything in `Main` / FOMO or any crypto.
- IDOS module boundaries: the game module imports only its own folder, `src/shared/` and npm packages; `sim/` imports nothing from `fx/`, `ui/`, `game/` or `meta/`; `meta/` imports from `sim/` only (and `@idosgames/core` in `meta/clientPort.ts` alone); `ui/` may import `fx/` and `meta/`. Do not edit `src/modules.ts`, `src/config.ts`, `src/idos.title.ts` or `idos.modules.lock.json`.
- File size (IDOS.md): when a change adds a new responsibility to a file past ~400 lines, that part goes in its own file. `game/controller.ts` gets one method and one event field, nothing more.
- Balance numbers live only in `sim/tuning.ts` (the caps too).
- Match the module's code style: a header comment per file saying what it is and why, doc comments on exported names, `ActionResult` with lowercase `fail("reason")`, 2-space Prettier formatting (`npm run format`).
- Every commit keeps these green: `npm run typecheck`, `npx vitest run src/modules/casecremental cloudcode`, `npm run build`.
- Commit messages look like `feat(meta): …` and end with these two lines (after a blank line):
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```
- Stage files by path. Never stage `docs/todo.md`, the `{…}.png` files in the repo root, or untracked `art/source/audio/*` files. Stay on branch `casecremental-finish`.
- Title config goes to `ZVKC34TR-DEV` only, until Task 8. Every `save_<field>` call replaces that whole field: always `get_<field>` first and send back everything you are not changing.

## Review Focus

The five conditions most likely to bite a player that no other task's tests exercise. Each has its test in the owning task.

1. **No network at all** (the DNS problem in the memory notes, a train tunnel). The game loads, plays, opens vaults and buys perks exactly as before; calls wait in the queue across reloads and go out when the server answers. Test: Task 4, "keeps calls across a reload and sends them when the port comes back", and Task 5, "never waits for the server".
2. **The queue replays after a long offline stretch:** two `endRun`s back to back, or the same `endRun` twice after a reload. The server pays each run once and does not cap the second run to nothing. Tests: Task 3, "pays a replayed endRun once" and "two queued runs replayed back to back are both paid".
3. **A double-tapped perk, or a `buyPerk` replayed after it already went through.** It is bought once. Test: Task 3, "a stale buyPerk is not bought twice".
4. **The server refuses or caps** (a cheated or broken report). The local meta takes the server's CLOUT and perks once nothing is pending; play goes on. Test: Task 4, "takes the server's CLOUT and perks when nothing is pending".
5. **A new browser or device** with the same account: the local meta is fresh, the server has CLOUT, perks, loops and trophies. They are merged in and the next run's setup uses them. Test: Task 4, "a fresh local meta gets the server's loops, perks and vault trophies".

---

## File map

Paths are relative to `src/modules/casecremental/` unless they start with `cloudcode/`, `tools/`, `docs/` or a dot.

| File | Task | Responsibility |
|---|---|---|
| `sim/tuning.ts` | 1 | the plausibility caps and the trophy rate limits |
| `meta/trophies.ts` (+ test) | 1 | the trophy list from the content tables; which drops in an event are trophies |
| `meta/plausibility.ts` (+ test) | 1 | score from earnings, the max-plausible earnings curve, calibrated against the pacing bot |
| `meta/serverData.ts` (+ test) | 1 | builds `cloudcode/data.json` and `cloudcode/config/trophies.items.json`; the test keeps them in sync |
| `cloudcode/data.json`, `cloudcode/config/trophies.items.json` | 1 | generated |
| `cloudcode/probe.js` | 2 | one-off probe of the `server.*` call shapes |
| `cloudcode/config/*.json` | 2 | the Title config payloads (currency, leaderboard, user data, CloudCode policy) |
| `cloudcode/casecremental.js`, `cloudcode/load.ts`, `cloudcode/casecremental.test.ts` | 3 | the handlers, a test loader, the rules' tests |
| `tools/cloud/bundle.mjs`, `cloudcode/casecremental.bundle.js`, `package.json` | 3 | the published script = data + rules |
| `meta/queue.ts`, `meta/bridge.ts`, `meta/merge.ts`, `meta/clientPort.ts` (+ tests) | 4 | the client bridge |
| `sim/runTypes.ts`, `sim/meta.ts` (only if needed), `game/controller.ts`, `game/serverSync.ts` (+ test), `module.ts` | 5 | wiring the game to the bridge |
| `ui/lobby/lobbyRules.ts` (+ test), `ui/lobby/TrophyCase.tsx`, `ui/lobby/Leaderboard.tsx`, `ui/lobby/features.ts`, `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`, `module.meta.json` | 6 | the two lobby tabs |
| `docs/feature-history/casecremental-finish.md` | 7 | the F7 section |
| `cloudcode/config/*.json` (unchanged), live Title | 8 | promotion |

---

### Task 1: The trophy list, the caps and the generated server data

The server must know exactly the trophies, perks, charms and formulas the client uses. They are computed from the content tables and written to `cloudcode/data.json` by a test, so adding a case or retuning a perk fails the suite until the data is regenerated.

**Files:**
- Create: `meta/trophies.ts`, `meta/trophies.test.ts`, `meta/plausibility.ts`, `meta/plausibility.test.ts`, `meta/serverData.ts`, `meta/serverData.test.ts`, `cloudcode/data.json` (generated), `cloudcode/config/trophies.items.json` (generated)
- Modify: `sim/tuning.ts`

**Interfaces:**
- Produces:
  ```ts
  // meta/trophies.ts
  export const TROPHY_CATALOG = "Trophies";
  export interface TrophyDef { id: string; skin: SkinDef; rarity: "covert" | "gold"; source: string; minLoops: number; vault: boolean }
  export const TROPHIES: readonly TrophyDef[];
  export function trophyById(id: string): TrophyDef | undefined;
  export function isTrophyDrop(d: Drop): boolean;           // a case trophy (not a vault legend)
  export function trophyDropsOf(e: SimEvent): Drop[];
  // meta/plausibility.ts
  export function scoreFor(lifetimeEarnings: number): number;          // floor(log10(e) × 1000), 0 below 1
  export function earningsFromScore(score: number): number;
  export function maxPlausibleLog10(elapsedSec: number, loops: number): number;
  export function cappedEarnings(e: number, elapsedSec: number, loops: number): number;
  // meta/serverData.ts
  export interface ServerData { v: 1; trophies: Record<string, { rarity: "covert" | "gold"; source: string; minLoops: number; vault: boolean }>; vaults: Array<{ trophy: string; legend: string }>; perks: Record<string, { baseCost: number; growth: number; maxLevel: number }>; charms: string[]; cloutDivisor: number; cap: typeof SERVER_CAP; firstRunMaxSec: number; trophyGapSec: number; trophiesPerRunMinute: number; maxOpensPerSecond: number }
  export function buildServerData(): ServerData;
  export function buildTrophyItems(): { Catalogs: Record<string, { Items: Record<string, Record<string, unknown>> }> };
  // sim/tuning.ts
  export const SERVER_CAP: { baseLog10: number; perSqrtSecond: number; perLoop: number; ceilLog10: number };
  export const SERVER_FIRST_RUN_MAX_SEC: number; export const TROPHY_GAP_SEC: number;
  export const TROPHIES_PER_RUN_MINUTE: number; export const MAX_OPENS_PER_SECOND: number;
  ```

- [ ] **Step 1: Write the failing tests.**

  `meta/trophies.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { CASES } from "../sim/content/cases";
  import { VAULTS } from "../sim/content/vaults";
  import type { Drop } from "../sim/types";
  import { TROPHIES, isTrophyDrop, trophyById, trophyDropsOf } from "./trophies";

  const drop = (skinId: string, rarity: Drop["rarity"]): Drop => ({ id: 1, caseId: "x", skinId, rarity, float: 0.1, wear: "FN", statTrak: false, value: 1 });

  describe("trophies", () => {
    it("has every Covert and ★ skin of every case, then one legend per vault", () => {
      for (const c of CASES) {
        const mine = TROPHIES.filter((t) => t.source === c.id);
        expect(mine.map((t) => t.id).sort()).toEqual(c.skins.filter((s) => s.rarity === "covert" || s.rarity === "gold").map((s) => s.id).sort());
      }
      expect(TROPHIES.filter((t) => t.vault).map((t) => t.id)).toEqual(VAULTS.map((v) => v.legend.id));
      expect(TROPHIES.length).toBe(9 * 3 + 4); // 9 cases × (2 Covert + 1 ★) + Vaults I–III + ★ Singularity
      expect(new Set(TROPHIES.map((t) => t.id)).size).toBe(TROPHIES.length);
      expect(trophyById("lastcase_legend")).toMatchObject({ vault: true, minLoops: 3 });
    });

    it("knows the run a case first shows up in", () => {
      expect(trophyById("bc_knife")!.minLoops).toBe(0);
      const late = TROPHIES.filter((t) => t.source === CASES[CASES.length - 1]!.id);
      for (const t of late) expect(t.minLoops).toBe(3);
    });

    it("finds the case trophies in reveal, bot, contract, upgrader and vault-reel events — never a vault legend", () => {
      expect(trophyDropsOf({ type: "revealed", drops: [drop("bc_knife", "gold"), drop("bc_x", "milspec")] }).map((d) => d.skinId)).toEqual(["bc_knife"]);
      expect(trophyDropsOf({ type: "botRevealed", drops: [drop("bc_warlord", "covert")] })).toHaveLength(1);
      expect(trophyDropsOf({ type: "pressDone", results: [drop("bc_commander", "covert")] })).toHaveLength(1);
      expect(trophyDropsOf({ type: "upgraderDone", win: true, result: drop("ww_spirit", "covert"), inputs: [] })).toHaveLength(1);
      expect(trophyDropsOf({ type: "vaultReelLanded", index: 4, drop: drop("vault1_legend", "gold"), amount: 1 })).toEqual([]);
      expect(isTrophyDrop(drop("vault1_legend", "gold"))).toBe(false);
    });
  });
  ```
  (If F2–F6 changed an event's fields, write the literal the way the union has it now; if `SimEvent` has another event carrying case drops, add it to the test and to `trophyDropsOf`.)

  `meta/plausibility.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { HUMAN, playGreedy, type BotTimings } from "../sim/bot";
  import { runNumber } from "../sim/campaign";
  import { vaultFor } from "../sim/content/vaults";
  import { buyPerk, completeVault, freshMeta, PERK_IDS, setupFor } from "../sim/meta";
  import { cappedEarnings, earningsFromScore, maxPlausibleLog10, scoreFor } from "./plausibility";

  /** Faster than any human: every action a twentieth of a second. */
  const FAST: BotTimings = { ...HUMAN, buy: 0.05, key: 0.05, sell: 0.05, reveal: 0.05 };

  describe("plausibility", () => {
    it("scores earnings on a log scale and back", () => {
      expect(scoreFor(1.2e6)).toBe(6079);
      expect(scoreFor(0)).toBe(0);
      expect(scoreFor(1e300)).toBe(300000);
      expect(earningsFromScore(scoreFor(4.2e11))).toBeCloseTo(4.2e11, -9);
    });

    it("lets every fast greedy run of the campaign through with ×3 headroom, perks maxed as they come", () => {
      for (const seed of [1, 2]) {
        const meta = freshMeta();
        for (let i = 0; i < 5; i++) { // Runs 1–4 and one Run 4 replay
          const r = playGreedy(seed + 100 * i, 900, FAST, setupFor(meta));
          expect(r.vaultAt, `run ${i + 1} seed ${seed} never vaulted`).toBeDefined();
          expect(maxPlausibleLog10(r.vaultAt!, meta.loops)).toBeGreaterThanOrEqual(Math.log10(r.lifetimeEarnings) + 0.5);
          completeVault(meta, r.lifetimeEarnings, vaultFor(runNumber(meta.loops)).trophy, seed);
          for (const id of PERK_IDS) while (buyPerk(meta, id).ok);
        }
      }
    }, 120_000);

    it("refuses what no player can earn", () => {
      expect(maxPlausibleLog10(60, 0)).toBeLessThan(6); // $1M in the first minute of Run 1
      expect(maxPlausibleLog10(600, 0)).toBeLessThan(11);
      expect(cappedEarnings(1e40, 600, 0)).toBe(10 ** maxPlausibleLog10(600, 0));
      expect(cappedEarnings(5e6, 600, 0)).toBe(5e6);
      expect(cappedEarnings(-5, 600, 0)).toBe(0);
    });
  });
  ```

  `meta/serverData.test.ts`:
  ```ts
  import { readFileSync, writeFileSync } from "node:fs";
  import { describe, expect, it } from "vitest";
  import { charmPool } from "../sim/charms";
  import { cloutFor, perkCost, PERK_IDS } from "../sim/meta";
  import { LAST_RUN } from "../sim/tuning";
  import { buildServerData, buildTrophyItems } from "./serverData";
  import { TROPHIES } from "./trophies";

  // cloudcode/data.json and cloudcode/config/trophies.items.json are generated from the content tables.
  // Regenerate: UPDATE_CLOUD=1 npx vitest run src/modules/casecremental/meta/serverData.test.ts
  const DATA_FILE = new URL("../../../../cloudcode/data.json", import.meta.url);
  const ITEMS_FILE = new URL("../../../../cloudcode/config/trophies.items.json", import.meta.url);

  function synced(file: URL, value: unknown): void {
    if (process.env.UPDATE_CLOUD) writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
    expect(JSON.parse(readFileSync(file, "utf8")), `${file.pathname} is stale — regenerate it (see the header)`).toEqual(value);
  }

  describe("server data", () => {
    it("is in sync with cloudcode/data.json", () => synced(DATA_FILE, buildServerData()));
    it("is in sync with cloudcode/config/trophies.items.json", () => synced(ITEMS_FILE, buildTrophyItems()));

    it("carries the client's perk costs, CLOUT rule and charms", () => {
      const d = buildServerData();
      for (const id of PERK_IDS) {
        const p = d.perks[id]!;
        for (let lv = 0; lv <= p.maxLevel; lv++) {
          const server = lv >= p.maxLevel ? null : Math.ceil(p.baseCost * p.growth ** lv);
          expect(server).toBe(perkCost(id, lv));
        }
      }
      for (const e of [0, 1, 99, 1.2e6, 4.2e11, 1e18]) expect(Math.floor(Math.sqrt(e) / d.cloutDivisor)).toBe(cloutFor(e));
      expect(d.charms).toEqual([...charmPool(LAST_RUN)]);
    });

    it("makes one non-stackable, non-tradable Trophies item per trophy", () => {
      const items = buildTrophyItems().Catalogs.Trophies!.Items;
      expect(Object.keys(items).sort()).toEqual(TROPHIES.map((t) => t.id).sort());
      expect(items.bc_knife).toMatchObject({ ItemID: "bc_knife", CatalogID: "Trophies", IsStackable: false, IsTradable: false, Metadata: { RarityID: "Star", CollectionID: "bootcamp" } });
    });
  });
  ```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/meta`
  Expected: FAIL — the three modules do not exist.

- [ ] **Step 3: Add the tuning numbers.** Append to `sim/tuning.ts` (starting values; Step 6 calibrates them):
  ```ts
  /**
   * Server plausibility (plan F7): the most a run can earn after `t` seconds with `loops` vaults behind it is
   * 10^min(ceilLog10, baseLog10 + perSqrtSecond·√t + perLoop·loops). Calibrated in meta/plausibility.test.ts against
   * a superhuman greedy player with ×3 headroom; CloudCode applies the same curve (cloudcode/data.json).
   */
  export const SERVER_CAP = { baseLog10: 3, perSqrtSecond: 0.25, perLoop: 2.2, ceilLog10: 300 } as const;
  /** A first run the server never saw start may claim at most this long. */
  export const SERVER_FIRST_RUN_MAX_SEC = 6 * 3600;
  /** Trophy reports: at least this many seconds apart, and at most this many per minute of a run. */
  export const TROPHY_GAP_SEC = 2;
  export const TROPHIES_PER_RUN_MINUTE = 30;
  /** Campaign stats sanity: no one opens more cases a second than this (bench, bot and Slot Machine together). */
  export const MAX_OPENS_PER_SECOND = 2000;
  ```

- [ ] **Step 4: Write `meta/trophies.ts`.**
  ```ts
  import { runCaseIds } from "../sim/campaign";
  import { CASES } from "../sim/content/cases";
  import { VAULTS } from "../sim/content/vaults";
  import type { SimEvent } from "../sim/run";
  import { LAST_RUN } from "../sim/tuning";
  import type { Drop, SkinDef } from "../sim/types";

  // The Trophies catalog (plan F7): one server item per Covert and ★ skin of every case, plus each vault's legend.
  // Built from the content tables, so a new case brings its trophies along. Case trophies are reported when they drop;
  // a vault's legend is granted by endRun with the vault itself.

  /** The Title's item catalog id. */
  export const TROPHY_CATALOG = "Trophies";

  export interface TrophyDef {
    /** The catalog ItemID: the skin's id. */
    id: string;
    skin: SkinDef;
    rarity: "covert" | "gold";
    /** The case it drops from, or the vault's id for a legend. */
    source: string;
    /** Vaults opened before it can drop: its case's first run − 1, or the vault's run − 1. */
    minLoops: number;
    /** A vault legend (granted by endRun, never by reportTrophy). */
    vault: boolean;
  }

  const firstRunOf = (caseId: string): number => {
    for (let run = 1; run <= LAST_RUN; run++) if (runCaseIds(run).includes(caseId)) return run;
    return LAST_RUN;
  };

  export const TROPHIES: readonly TrophyDef[] = [
    ...CASES.flatMap((c) =>
      c.skins
        .filter((s) => s.rarity === "covert" || s.rarity === "gold")
        .map((s) => ({ id: s.id, skin: s, rarity: s.rarity as "covert" | "gold", source: c.id, minLoops: firstRunOf(c.id) - 1, vault: false })),
    ),
    ...VAULTS.map((v) => ({ id: v.legend.id, skin: v.legend, rarity: "gold" as const, source: v.id, minLoops: v.run - 1, vault: true })),
  ];

  const BY_ID = new Map(TROPHIES.map((t) => [t.id, t]));

  export const trophyById = (id: string): TrophyDef | undefined => BY_ID.get(id);

  /** A case trophy — a vault legend is not reported, endRun pays it. */
  export const isTrophyDrop = (d: Drop): boolean => BY_ID.get(d.skinId)?.vault === false;

  /** The case trophies an event shows the player. */
  export function trophyDropsOf(e: SimEvent): Drop[] {
    switch (e.type) {
      case "revealed":
      case "botRevealed":
        return e.drops.filter(isTrophyDrop);
      case "pressDone":
        return e.results.filter(isTrophyDrop);
      case "upgraderDone":
        return e.result && isTrophyDrop(e.result) ? [e.result] : [];
      case "vaultReelLanded":
        return isTrophyDrop(e.drop) ? [e.drop] : [];
      default:
        return [];
    }
  }
  ```

- [ ] **Step 5: Write `meta/plausibility.ts` and `meta/serverData.ts`.**
  ```ts
  // meta/plausibility.ts
  import { SERVER_CAP } from "../sim/tuning";

  // The leaderboard score and the server's plausibility cap (plan F7). Lifetime earnings outgrow safe integers, so the
  // board keeps floor(log10(e) × 1000) and the UI turns it back. The cap is the same curve CloudCode applies.

  export const scoreFor = (lifetimeEarnings: number): number => (lifetimeEarnings > 1 ? Math.floor(Math.log10(lifetimeEarnings) * 1000) : 0);

  export const earningsFromScore = (score: number): number => 10 ** (score / 1000);

  /** log10 of the most a run can have earned after `elapsedSec` with `loops` vaults behind it. */
  export function maxPlausibleLog10(elapsedSec: number, loops: number): number {
    const c = SERVER_CAP;
    return Math.min(c.ceilLog10, c.baseLog10 + c.perSqrtSecond * Math.sqrt(Math.max(0, elapsedSec)) + c.perLoop * Math.max(0, loops));
  }

  export const cappedEarnings = (e: number, elapsedSec: number, loops: number): number =>
    Math.min(Math.max(0, e), 10 ** maxPlausibleLog10(elapsedSec, loops));
  ```
  ```ts
  // meta/serverData.ts
  import { charmPool } from "../sim/charms";
  import { skinDisplayName } from "../sim/content/cases";
  import { VAULTS } from "../sim/content/vaults";
  import { PERK_IDS } from "../sim/meta";
  import {
    CLOUT_DIVISOR, LAST_RUN, MAX_OPENS_PER_SECOND, PERK_COSTS, SERVER_CAP, SERVER_FIRST_RUN_MAX_SEC, TROPHIES_PER_RUN_MINUTE, TROPHY_GAP_SEC,
  } from "../sim/tuning";
  import { TROPHIES, TROPHY_CATALOG } from "./trophies";

  // What the server must know about the game (plan F7), built from the same tables the client plays with:
  // cloudcode/data.json (prepended to the CloudCode script by tools/cloud/bundle.mjs) and the Trophies catalog
  // payload for the Title (cloudcode/config/trophies.items.json). meta/serverData.test.ts keeps both files in sync.

  export interface ServerData {
    v: 1;
    trophies: Record<string, { rarity: "covert" | "gold"; source: string; minLoops: number; vault: boolean }>;
    /** Indexed by loops (clamped to the last): the trophy endRun expects and the legend it grants. */
    vaults: Array<{ trophy: string; legend: string }>;
    perks: Record<string, { baseCost: number; growth: number; maxLevel: number }>;
    charms: string[];
    cloutDivisor: number;
    cap: typeof SERVER_CAP;
    firstRunMaxSec: number;
    trophyGapSec: number;
    trophiesPerRunMinute: number;
    maxOpensPerSecond: number;
  }

  export function buildServerData(): ServerData {
    return {
      v: 1,
      trophies: Object.fromEntries(TROPHIES.map((t) => [t.id, { rarity: t.rarity, source: t.source, minLoops: t.minLoops, vault: t.vault }])),
      vaults: VAULTS.map((v) => ({ trophy: v.trophy, legend: v.legend.id })),
      perks: Object.fromEntries(PERK_IDS.map((id) => [id, { ...PERK_COSTS[id] }])),
      charms: [...charmPool(LAST_RUN)],
      cloutDivisor: CLOUT_DIVISOR,
      cap: SERVER_CAP,
      firstRunMaxSec: SERVER_FIRST_RUN_MAX_SEC,
      trophyGapSec: TROPHY_GAP_SEC,
      trophiesPerRunMinute: TROPHIES_PER_RUN_MINUTE,
      maxOpensPerSecond: MAX_OPENS_PER_SECOND,
    };
  }

  /** The Title's Item section with only the Trophies catalog (Task 2 merges it into what the Title has). */
  export function buildTrophyItems(): { Catalogs: Record<string, { Items: Record<string, Record<string, unknown>> }> } {
    const items = TROPHIES.map((t) => [
      t.id,
      {
        ItemID: t.id,
        CatalogID: TROPHY_CATALOG,
        ItemClass: "Trophy",
        DisplayName: skinDisplayName(t.skin),
        Description: t.vault ? `${t.source} legend` : `${t.source} ${t.rarity === "gold" ? "★" : "Covert"}`,
        Tags: ["trophy", t.rarity, t.source],
        IsStackable: false,
        IsTradable: false,
        Weight: 0,
        Metadata: { RarityID: t.rarity === "gold" ? "Star" : "Covert", CollectionID: t.source },
        CustomData: { skinId: t.id, source: t.source },
      },
    ]);
    return { Catalogs: { [TROPHY_CATALOG]: { Items: Object.fromEntries(items) } } };
  }
  ```
  If `sim/meta.ts` does not re-export `PERK_IDS` as typed here, import it from where it lives now. If F4 changed the shape of `PERK_COSTS` (another field), copy that field too and extend `perkCost` in `cloudcode/casecremental.js` (Task 3) the same way.

- [ ] **Step 6: Generate, calibrate, run.**
  Run: `mkdir -p cloudcode/config && UPDATE_CLOUD=1 npx vitest run src/modules/casecremental/meta/serverData.test.ts` (PowerShell: `$env:UPDATE_CLOUD=1; npx vitest run …; Remove-Item Env:UPDATE_CLOUD`).
  Then: `npx vitest run src/modules/casecremental/meta`
  Expected: PASS. If the calibration test fails, it prints the run that broke the cap: raise `SERVER_CAP.perLoop` first (later runs are where the boosts compound), then `perSqrtSecond`, until every fast run fits with +0.5 headroom **and** "refuses what no player can earn" still passes; regenerate `data.json` after every change (Step 6 again). If no setting satisfies both, loosen the `maxPlausibleLog10(600, 0)` bound to `< 12` and write the reason in the Task 7 feature history.

- [ ] **Step 7: Commit.**
  ```bash
  git add src/modules/casecremental/sim/tuning.ts src/modules/casecremental/meta cloudcode/data.json cloudcode/config/trophies.items.json
  git commit -m "feat(meta): trophy list, plausibility caps and the server data generated from the content tables" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 2: The DEV Title — seed out, CLOUT, Trophies, best_run, user-data keys, CloudCode policy, and the probe

Everything here is MCP calls against `ZVKC34TR-DEV` plus the committed payload files. Load the tools first, in one call:
`ToolSearch` → `select:mcp__idosgames__get_currency,mcp__idosgames__save_currency,mcp__idosgames__get_item,mcp__idosgames__save_item,mcp__idosgames__get_leaderboard,mcp__idosgames__save_leaderboard,mcp__idosgames__get_user_custom_data,mcp__idosgames__save_user_custom_data,mcp__idosgames__get_cloud_code,mcp__idosgames__save_cloud_code,mcp__idosgames__publish_cloud_code,mcp__idosgames__get_quest,mcp__idosgames__save_quest,mcp__idosgames__get_store,mcp__idosgames__save_store,mcp__idosgames__get_lootbox,mcp__idosgames__save_lootbox,mcp__idosgames__get_reward,mcp__idosgames__save_reward,mcp__idosgames__get_character,mcp__idosgames__save_character`.

**Files:**
- Create: `cloudcode/config/currency.clout.json`, `cloudcode/config/leaderboard.json`, `cloudcode/config/userCustomData.json`, `cloudcode/config/cloudcode.policy.json`, `cloudcode/probe.js`

**Interfaces:**
- Produces (on `ZVKC34TR-DEV`): currency `CLOUT`; catalog `Trophies` (31 items, ids = skin ids); leaderboard `best_run`; user-data keys `cc_meta` (ReadOnly, Json), `cc_anti` (Internal, Json), `cc_wallet` (Public, String — F8 fills it); CloudCode enabled with a resource policy that may grant `VirtualCurrency` and `Item` and consume `VirtualCurrency`.
- Produces (for Task 3): the probe's report — which call shapes of `ReadUserData`, `GetUserCustomData`, `SetUserCustomData`, `ApplyResourceOperation` succeed, and whether a leaderboard event-token grant moves `best_run`.

- [ ] **Step 1: Write the payload files.**
  `cloudcode/config/currency.clout.json`:
  ```json
  {
    "CurrencyID": "CLOUT",
    "DisplayName": "Clout",
    "Economy": { "ValueInUSD": 0, "InitialDeposit": 0, "MinBalance": 0, "MaxBalance": 9223372036854775807 },
    "Permissions": { "IsTradable": false, "IsPurchasable": false, "IsRefundable": false },
    "Status": "Active"
  }
  ```
  `cloudcode/config/leaderboard.json`:
  ```json
  {
    "LeaderboardID": "best_run",
    "DisplayName": "Best run",
    "IsEnabled": true,
    "ScoreAggregation": "BestScore",
    "ScoreDisplayName": "log10($) × 1000",
    "BracketSize": 0,
    "TopUsersLimit": 100,
    "MinScoreToEnterTop": 0,
    "Schedule": { "Mode": "AlwaysOn", "IsActive": true }
  }
  ```
  `cloudcode/config/userCustomData.json`:
  ```json
  {
    "DefaultMaxValueLengthBytes": 8192,
    "MaxKeysPerBucket": 128,
    "MaxTotalSizeBytes": 1500000,
    "RejectUnregisteredKeys": false,
    "Keys": {
      "cc_meta": { "KeyID": "cc_meta", "Bucket": "ReadOnly", "ValueType": "Json", "MaxValueLengthBytes": 16384, "Description": "Casecremental meta: perks, loops, campaign stats, charm picks, ended runs (CloudCode writes)" },
      "cc_anti": { "KeyID": "cc_anti", "Bucket": "Internal", "ValueType": "Json", "MaxValueLengthBytes": 8192, "Description": "Casecremental plausibility state: first seen, last run end, trophy pacing" },
      "cc_wallet": { "KeyID": "cc_wallet", "Bucket": "Public", "ValueType": "String", "MaxValueLengthBytes": 64, "Description": "Casecremental: the player's Solana wallet, shown on the leaderboard (plan F8)" }
    }
  }
  ```
  `cloudcode/config/cloudcode.policy.json` (the CloudCode section minus the code; `publish_cloud_code` sets the revision):
  ```json
  {
    "Enabled": true,
    "RevealLogsToClient": false,
    "RevealStackTraceToClient": false,
    "PersistExecutionLog": true,
    "ExecutionLogTtlDays": 7,
    "ResourcePolicy": {
      "Enabled": true,
      "AllowEventTokens": true,
      "AllowedGrantTypes": ["VirtualCurrency", "Item"],
      "AllowedConsumeTypes": ["VirtualCurrency"],
      "Caps": { "VirtualCurrency:CLOUT": { "PerPlayerDaily": 1000000000000 } }
    },
    "RateLimit": {
      "UserLimit": { "MaxRequests": 120, "WindowSeconds": 60, "BlockDurationSeconds": 60 },
      "PerHandlerUserLimit": { "reportTrophy": { "MaxRequests": 40, "WindowSeconds": 60, "BlockDurationSeconds": 30 } }
    }
  }
  ```

- [ ] **Step 2: Take the idle-rpg seed off DEV.** The base spec §10.4 decided this for DEV; nothing in the project references these entities. Go in this order (later sections reference earlier ones' ids), each time `get_<field>` first, then `save_<field>` with the named entries removed and everything else sent back unchanged:
  1. Quest: remove quests `guide_enhance`, `guide_stages`, `guide_summon`, `guide_spend`, `guide_stages_10` and cycle `guide`.
  2. Store: remove store `shop` and offers `free_gems`, `gold_bag_small`, `gold_bag_big`, `starter_sword`.
  3. Lootbox: remove `gear_summon`.
  4. Reward: remove idle accrual `idle_gold` (keep `TierRewards`).
  5. Character: remove `Knight`, `Archer`, `Mage`.
  6. Item: remove catalog `Item` (all 12 items).
  7. Currency: remove `GOLD` and `GEMS`.
  When a section ends up empty, send its empty container (`{ "Definitions": {} }`, `{ "Quests": {}, "Cycles": {} }`, …) rather than `null`. If a save is refused because something still references an id, the refusal names it: remove that reference first and retry. Read each section back to confirm.

- [ ] **Step 3: Add CLOUT, Trophies, best_run and the user-data keys.**
  - `save_currency` (DEV): the section as read, with `VirtualCurrencies.CLOUT` = `currency.clout.json`.
  - `save_item` (DEV): the section as read (now empty), with `Catalogs.Trophies` = the `Trophies` catalog from `cloudcode/config/trophies.items.json`.
  - `save_leaderboard` (DEV): `{ "Definitions": { "best_run": <leaderboard.json> } }`.
  - `save_user_custom_data` (DEV): `userCustomData.json`.
  Read all four back with the `get_` tools; expect CLOUT with initial deposit 0, 31 Trophies items, `best_run` with `BestScore`, the three keys.

- [ ] **Step 4: Turn CloudCode on with the policy.** `get_cloud_code` (DEV) — expect `{ Success: true }` with no data. `save_cloud_code` (DEV) with `cloudcode.policy.json` as the value. Read it back.

- [ ] **Step 5: Write and publish the probe.** `cloudcode/probe.js`:
  ```js
  // Throwaway probe (plan F7 Task 2): learns the server.* call shapes on ZVKC34TR-DEV, because no document we can read
  // gives them. Published once, run from a signed-in dev session, then replaced by casecremental.js (Task 3).
  // The report it returned is pasted at the bottom of this file.
  handlers.probe = function (args, context) {
    var out = { context: Object.keys(context || {}), server: Object.keys(server || {}), tries: {} };
    function attempt(label, fn) {
      try {
        out.tries[label] = { ok: true, result: JSON.stringify(fn()).slice(0, 700) };
      } catch (e) {
        out.tries[label] = { ok: false, error: String(e) };
      }
    }
    var grant1 = { Grant: { Standard: { Entries: [{ Type: "VirtualCurrency", CurrencyID: "CLOUT", Amount: 1 }] } } };
    attempt("ReadUserData()", function () { return server.ReadUserData(); });
    attempt("ReadUserData({Fields})", function () { return server.ReadUserData({ Fields: ["InventoryV2"] }); });
    attempt("GetUserCustomData()", function () { return server.GetUserCustomData(); });
    attempt("GetUserCustomData({Bucket,KeyIDs})", function () { return server.GetUserCustomData({ Bucket: "ReadOnly", KeyIDs: ["cc_probe"] }); });
    attempt("SetUserCustomData({Bucket,KeyID,Value})", function () { return server.SetUserCustomData({ Bucket: "ReadOnly", KeyID: "cc_probe", Value: "{\"n\":1}" }); });
    attempt("SetUserCustomData(bucket,key,value)", function () { return server.SetUserCustomData("ReadOnly", "cc_probe2", "{\"n\":2}"); });
    attempt("GetUserCustomData() after set", function () { return server.GetUserCustomData(); });
    attempt("ApplyResourceOperation({Operation,Source})", function () { return server.ApplyResourceOperation({ Operation: grant1, Source: "probe" }); });
    attempt("ApplyResourceOperation(op)", function () { return server.ApplyResourceOperation(grant1); });
    attempt("ApplyResourceOperation(op,source)", function () { return server.ApplyResourceOperation(grant1, "probe"); });
    attempt("consume more than owned", function () {
      return server.ApplyResourceOperation({ Operation: { Consume: { Standard: { Entries: [{ Type: "VirtualCurrency", CurrencyID: "CLOUT", Amount: 1000000000 }] } } }, Source: "probe" });
    });
    attempt("grant a trophy item", function () {
      return server.ApplyResourceOperation({ Operation: { Grant: { Standard: { Entries: [{ Type: "Item", CatalogID: "Trophies", ItemID: "bc_knife", Amount: 1 }] } } }, Source: "probe" });
    });
    attempt("leaderboard tokens 1234", function () {
      return server.ApplyResourceOperation({ Operation: { Grant: { Standard: { EventTokens: [{ Address: { Type: "Leaderboard", EntityID: "best_run" }, Amount: 1234, Source: "probe" }] } } }, Source: "probe" });
    });
    attempt("ReadUserData after grants", function () { return server.ReadUserData({ Fields: ["InventoryV2"] }); });
    attempt("Date.now / Math.log10", function () { return [Date.now(), Math.log10(1000)]; });
    return out;
  };
  ```
  `publish_cloud_code` (DEV) with `code` = the file, `comment` = "F7 probe", `handlers` = `[{ "Name": "probe" }]`.

- [ ] **Step 6: Run the probe from a signed-in DEV session.** `npm run dev` in the background (Vite on 5180; `.env.local` already has `VITE_IDOS_ENV=dev`, so the app talks to `ZVKC34TR-DEV`). If the page hangs on loading, run `nslookup api.idosgames.com` first (memory note: the router's DNS). Open `http://localhost:5180` (never the LAN IP — guest sign-in needs a secure context), sign in as a guest. In the page (browser tools, or headless Chrome via `.superpowers/harness/cdp.mjs eval`), with the dev-only global `idosClient`:
  ```js
  const r = await idosClient.cloudCode.execute("probe", {});
  JSON.stringify(r.ok ? r.data : r, null, 1);
  ```
  Then `await idosClient.leaderboard.getMyProgress("best_run")` — note `CurrentScore`. Run the probe a second time and read `getMyProgress` again: with `BestScore`, a token grant that **submits** keeps 1234; one that **adds** shows 2468.

- [ ] **Step 7: Record the result.** Paste the probe's JSON (trimmed to the `tries` that matter) as a comment block at the bottom of `cloudcode/probe.js`, followed by a short verdict, e.g.:
  ```js
  /* Verdict (2026-10-1x):
   * ReadUserData({Fields:["InventoryV2"]}) → Data.InventoryV2.{VirtualCurrencies, UnstackableItems}
   * GetUserCustomData({Bucket,KeyIDs}) → Data.ReadOnly["cc_probe"].Value
   * SetUserCustomData({Bucket,KeyID,Value}) → Success
   * ApplyResourceOperation({Operation,Source}) → Success; an over-consume → Success:false, Error "…"
   * Leaderboard tokens: <submits as BestScore | adds | refused> → SERVER_SCORE = <true | false>
   */
  ```
  These lines are what Task 3's `makeIo` and its `SERVER_SCORE` constant follow. If `ApplyResourceOperation` is missing or refused in every shape, stop and report: the plan's grant path needs another route (a Title `Reward` claim, for example) and that is a decision for the user.

- [ ] **Step 8: Commit.**
  ```bash
  git add cloudcode/config/currency.clout.json cloudcode/config/leaderboard.json cloudcode/config/userCustomData.json cloudcode/config/cloudcode.policy.json cloudcode/probe.js
  git commit -m "feat(meta): DEV Title config for the server meta and the CloudCode probe's findings" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 3: The CloudCode handlers

`reportTrophy`, `endRun`, `buyPerk`, `saveMeta` and `loadMeta`, written as rules over an `io` object so Vitest can run them. Only `makeIo` speaks the platform's `server.*` API, in the shapes Task 2's probe confirmed.

**Files:**
- Create: `cloudcode/casecremental.js`, `cloudcode/load.ts`, `cloudcode/casecremental.test.ts`, `tools/cloud/bundle.mjs`, `cloudcode/casecremental.bundle.js` (generated)
- Modify: `package.json` (script `"cloud": "node tools/cloud/bundle.mjs"`)

**Interfaces:**
- Consumes: `cloudcode/data.json` (Task 1); the probe verdict (Task 2).
- Produces — every handler answers a **view** or a refusal:
  ```ts
  type View = { ok: true; clout: number; trophies: string[]; perks: Record<string, number>; loops: number;
                stats: { playSeconds: number; opened: number; best: { skinId: string; value: number } | null; cloutEarned: number };
                picked: string[] };
  type Refusal = { ok: false; reason: string; retry: boolean };
  loadMeta({})                                                     → View
  reportTrophy({ skinId, runId, elapsedSec })                      → View | Refusal
  endRun({ runId, lifetimeEarnings, elapsedSec, endedAt, finaleReached, trophy })
                                                                   → View & { gained: number; score: number; capped: boolean; serverScore: boolean; duplicate?: true } | Refusal
  buyPerk({ perkId, level })                                       → View & { stale?: true } | Refusal
  saveMeta({ stats: { playSeconds, opened, best }, picked })       → View | Refusal
  ```
  `runId` is `"r" + run.seed.toString(36)`; `endedAt` is Unix seconds; `level` is the perk's level **before** the purchase.

- [ ] **Step 1: Write the test loader** `cloudcode/load.ts`:
  ```ts
  import { readFileSync } from "node:fs";

  // Loads the CloudCode the way the platform runs it: DATA prepended (as tools/cloud/bundle.mjs does), `handlers`,
  // `server` and `log` as globals. Returns the handlers plus the internals the tests reach for.
  export interface Loaded {
    handlers: Record<string, (args: unknown, context: unknown) => any>;
    RULES: Record<string, (io: FakeIo["io"], args: any) => any>;
    makeIo: (server: unknown, context: unknown) => FakeIo["io"];
  }

  export function loadCloud(server: unknown = {}, log = { Info() {}, Warning() {}, Error() {} }): Loaded {
    const data = readFileSync(new URL("./data.json", import.meta.url), "utf8");
    const code = readFileSync(new URL("./casecremental.js", import.meta.url), "utf8");
    const handlers = {};
    const inner = new Function("handlers", "server", "log", `var DATA = ${data};\n${code}\nreturn { RULES: RULES, makeIo: makeIo };`)(handlers, server, log);
    return { handlers, ...inner };
  }

  /** An in-memory player: CLOUT, owned trophies, the three user-data buckets, the clock. */
  export function fakeIo(now = 1_000_000) {
    const st = { t: now, clout: 0, owned: [] as string[], data: { ReadOnly: {}, Internal: {}, Public: {} } as Record<string, Record<string, unknown>>, ops: [] as unknown[], failWrites: false };
    const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
    const io = {
      userId: "U1",
      now: () => st.t,
      readData: (bucket: string, key: string) => (key in st.data[bucket]! ? copy(st.data[bucket]![key]) : null),
      writeData: (bucket: string, key: string, v: unknown) => {
        if (st.failWrites) return false;
        st.data[bucket]![key] = copy(v);
        return true;
      },
      clout: () => st.clout,
      ownedTrophies: () => [...st.owned],
      apply: (op: any) => {
        st.ops.push(copy(op));
        for (const e of op.Consume?.Standard?.Entries ?? []) if (e.CurrencyID === "CLOUT" && st.clout < e.Amount) return false;
        for (const e of op.Consume?.Standard?.Entries ?? []) if (e.CurrencyID === "CLOUT") st.clout -= e.Amount;
        for (const e of op.Grant?.Standard?.Entries ?? []) {
          if (e.Type === "VirtualCurrency" && e.CurrencyID === "CLOUT") st.clout += e.Amount;
          if (e.Type === "Item") st.owned.push(e.ItemID);
        }
        return true;
      },
    };
    return { io, st };
  }
  export type FakeIo = ReturnType<typeof fakeIo>;
  ```

- [ ] **Step 2: Write the failing tests** `cloudcode/casecremental.test.ts`:
  ```ts
  import { readFileSync } from "node:fs";
  import { beforeEach, describe, expect, it } from "vitest";
  import { cloutFor, perkCost } from "../src/modules/casecremental/sim/meta";
  import { maxPlausibleLog10, scoreFor } from "../src/modules/casecremental/meta/plausibility";
  import { fakeIo, loadCloud, type FakeIo } from "./load";

  const { RULES, handlers, makeIo } = loadCloud();
  let p: FakeIo;
  beforeEach(() => (p = fakeIo()));
  const meta = () => p.st.data.ReadOnly!.cc_meta as any;
  const end = (over: Record<string, unknown> = {}) =>
    RULES.endRun(p.io, { runId: "r1", lifetimeEarnings: 1.2e6, elapsedSec: 480, endedAt: p.st.t, finaleReached: true, trophy: "vault1", ...over });

  describe("loadMeta", () => {
    it("answers a fresh player and remembers when it first saw them", () => {
      expect(RULES.loadMeta(p.io, {})).toMatchObject({ ok: true, clout: 0, trophies: [], loops: 0, perks: { startCash: 0 } });
      expect((p.st.data.Internal!.cc_anti as any).firstSeen).toBe(p.st.t);
    });
  });

  describe("endRun", () => {
    it("pays the client's CLOUT rule, grants the vault legend, counts the loop and scores the run", () => {
      const r = end();
      expect(r).toMatchObject({ ok: true, gained: cloutFor(1.2e6), clout: cloutFor(1.2e6), loops: 1, score: scoreFor(1.2e6), capped: false });
      expect(p.st.owned).toEqual(["vault1_legend"]);
      expect(meta().stats.cloutEarned).toBe(cloutFor(1.2e6));
    });

    it("caps an implausible run and says so", () => {
      const r = end({ lifetimeEarnings: 1e40 });
      expect(r.capped).toBe(true);
      expect(r.score).toBe(scoreFor(10 ** maxPlausibleLog10(480, 0)));
    });

    it("pays a replayed endRun once", () => {
      end();
      const again = end();
      expect(again).toMatchObject({ ok: true, duplicate: true, loops: 1 });
      expect(p.st.clout).toBe(cloutFor(1.2e6));
    });

    it("two queued runs replayed back to back are both paid", () => {
      end({ runId: "ra", endedAt: p.st.t - 600, elapsedSec: 480 });
      const r = end({ runId: "rb", endedAt: p.st.t, elapsedSec: 500, trophy: "vault2", lifetimeEarnings: 2e9 });
      expect(r.capped).toBe(false);
      expect(r.loops).toBe(2);
    });

    it("bounds the claimed time by the time since the last run ended", () => {
      end({ runId: "ra" });
      p.st.t += 60;
      const r = end({ runId: "rb", elapsedSec: 99999, trophy: "vault2", lifetimeEarnings: 1e30 });
      expect(r.score).toBe(scoreFor(10 ** maxPlausibleLog10(60, 1)));
    });

    it("does not count a loop or grant a legend for the wrong vault", () => {
      const r = end({ trophy: "vault3" });
      expect(r.loops).toBe(0);
      expect(p.st.owned).toEqual([]);
    });

    it("refuses a malformed report", () => {
      expect(end({ lifetimeEarnings: "lots" })).toMatchObject({ ok: false, retry: false });
      expect(end({ runId: "" })).toMatchObject({ ok: false });
    });
  });

  describe("reportTrophy", () => {
    it("grants a case trophy once", () => {
      expect(RULES.reportTrophy(p.io, { skinId: "bc_knife", runId: "r1", elapsedSec: 100 })).toMatchObject({ ok: true, trophies: ["bc_knife"] });
      p.st.t += 10;
      RULES.reportTrophy(p.io, { skinId: "bc_knife", runId: "r1", elapsedSec: 110 });
      expect(p.st.owned).toEqual(["bc_knife"]);
    });

    it("refuses a vault legend, an unknown skin and a case not reached yet", () => {
      expect(RULES.reportTrophy(p.io, { skinId: "vault1_legend", runId: "r1", elapsedSec: 9 }).ok).toBe(false);
      expect(RULES.reportTrophy(p.io, { skinId: "nope", runId: "r1", elapsedSec: 9 }).ok).toBe(false);
      const late = Object.entries(JSON.parse(readFileSync(new URL("./data.json", import.meta.url), "utf8")).trophies).find(([, t]: any) => t.minLoops === 3)![0];
      expect(RULES.reportTrophy(p.io, { skinId: late, runId: "r1", elapsedSec: 9 })).toMatchObject({ ok: false, retry: false });
    });

    it("asks for a retry when reports come faster than one per 2 s", () => {
      RULES.reportTrophy(p.io, { skinId: "bc_knife", runId: "r1", elapsedSec: 100 });
      expect(RULES.reportTrophy(p.io, { skinId: "bc_warlord", runId: "r1", elapsedSec: 101 })).toMatchObject({ ok: false, retry: true });
    });
  });

  describe("buyPerk", () => {
    it("spends CLOUT at the client's price and raises the level", () => {
      p.st.clout = 100;
      const r = RULES.buyPerk(p.io, { perkId: "luck", level: 0 });
      expect(r).toMatchObject({ ok: true, perks: { luck: 1 }, clout: 100 - perkCost("luck", 0)! });
    });

    it("a stale buyPerk is not bought twice", () => {
      p.st.clout = 100;
      RULES.buyPerk(p.io, { perkId: "luck", level: 0 });
      const again = RULES.buyPerk(p.io, { perkId: "luck", level: 0 });
      expect(again).toMatchObject({ ok: true, stale: true, perks: { luck: 1 } });
      expect(p.st.clout).toBe(100 - perkCost("luck", 0)!);
    });

    it("refuses without enough CLOUT, past max level, and refunds when the save fails", () => {
      expect(RULES.buyPerk(p.io, { perkId: "luck", level: 0 })).toMatchObject({ ok: false, reason: "not enough CLOUT" });
      p.st.clout = 1e9;
      for (let lv = 0; perkCost("botAwake", lv) !== null; lv++) RULES.buyPerk(p.io, { perkId: "botAwake", level: lv });
      expect(RULES.buyPerk(p.io, { perkId: "botAwake" })).toMatchObject({ ok: false, reason: "max level" });
      const before = p.st.clout;
      p.st.failWrites = true;
      expect(RULES.buyPerk(p.io, { perkId: "luck", level: 0 })).toMatchObject({ ok: false, retry: true });
      expect(p.st.clout).toBe(before);
    });
  });

  describe("saveMeta", () => {
    it("keeps the larger stats, caps them by time, and checks the charm picks", () => {
      RULES.loadMeta(p.io, {});
      p.st.t += 1000;
      const r = RULES.saveMeta(p.io, { stats: { playSeconds: 900, opened: 5000, best: { skinId: "bc_knife", value: 1234 } }, picked: ["insider"] });
      expect(r.stats).toMatchObject({ playSeconds: 900, opened: 5000, best: { skinId: "bc_knife", value: 1234 } });
      expect(RULES.saveMeta(p.io, { stats: { playSeconds: 1e9, opened: 1 } }).stats.playSeconds).toBeLessThanOrEqual(1000 + 3600);
      expect(RULES.saveMeta(p.io, { stats: {}, picked: ["insider", "nope"] })).toMatchObject({ ok: false });
      expect(RULES.saveMeta(p.io, { stats: {}, picked: ["insider", "fever"] })).toMatchObject({ ok: false }); // one charm slot
    });
  });

  describe("handlers", () => {
    it("wrap the rules, turn a throw into a retryable refusal", () => {
      const thrower = { ReadUserData() { throw new Error("boom"); }, GetUserCustomData() { throw new Error("boom"); } };
      const h = loadCloud(thrower).handlers;
      expect(h.loadMeta!({}, { UserID: "U1" })).toMatchObject({ ok: false, retry: true });
      expect(Object.keys(handlers).sort()).toEqual(["buyPerk", "endRun", "loadMeta", "reportTrophy", "saveMeta"]);
    });

    it("makeIo speaks the server shapes the probe confirmed", () => {
      const calls: unknown[] = [];
      const server = {
        ReadUserData: () => ({ Success: true, Data: { InventoryV2: { VirtualCurrencies: { CLOUT: { Amount: 7 } }, UnstackableItems: { a: { ItemID: "bc_knife", CatalogID: "Trophies" }, b: { ItemID: "x", CatalogID: "Other" } } } } }),
        GetUserCustomData: (q: unknown) => (calls.push(q), { Success: true, Data: { ReadOnly: { cc_meta: { Value: "{\"loops\":2}" } } } }),
        SetUserCustomData: (q: unknown) => (calls.push(q), { Success: true }),
        ApplyResourceOperation: (q: unknown) => (calls.push(q), { Success: true }),
      };
      const io = makeIo(server, { UserID: "U1" });
      expect(io.clout()).toBe(7);
      expect(io.ownedTrophies()).toEqual(["bc_knife"]);
      expect(io.readData("ReadOnly", "cc_meta")).toEqual({ loops: 2 });
      expect(io.writeData("ReadOnly", "cc_meta", { loops: 3 })).toBe(true);
      expect(io.apply({ Grant: {} })).toBe(true);
      expect(calls).toHaveLength(3);
    });
  });
  ```
  (`"insider"` and `"fever"` are charm ids today; if F4/F6 renamed them, use two ids from `charmPool(LAST_RUN)`. The `makeIo` test's fake server must return exactly the shapes in the probe verdict — change both together.)

- [ ] **Step 3: Run them to see them fail.**
  Run: `npx vitest run cloudcode`
  Expected: FAIL — `casecremental.js` does not exist.

- [ ] **Step 4: Write `cloudcode/casecremental.js`.**
  ```js
  // Casecremental CloudCode (plan F7). The platform runs this with the globals `handlers`, `server` and `log`; each
  // handler is (args, context) and its return value is the client's FunctionResult. `DATA` (trophies, perks, caps,
  // charms) is prepended by tools/cloud/bundle.mjs from cloudcode/data.json, which is generated from the game's
  // content tables. No async, no imports, 10 s per call. The rules never touch `server`: they talk to the `io` that
  // makeIo builds, in the call shapes cloudcode/probe.js confirmed on ZVKC34TR-DEV — so Vitest runs them with a fake.
  // A handler never throws: it answers { ok: false, reason, retry } and the client's queue decides.

  var CATALOG = "Trophies";
  var CURRENCY = "CLOUT";
  var LEADERBOARD = "best_run";
  var META_KEY = "cc_meta";
  var ANTI_KEY = "cc_anti";
  var KEEP_RUNS = 20;
  /** Whether endRun moves best_run itself (leaderboard event tokens kept as BestScore — see the probe verdict). */
  var SERVER_SCORE = false;

  function fail(reason, retry) {
    return { ok: false, reason: reason, retry: !!retry };
  }
  function num(x) {
    return typeof x === "number" && isFinite(x) ? x : null;
  }
  function clamp(x, lo, hi) {
    return Math.min(Math.max(x, lo), hi);
  }

  // ---- the server API (only here) ----
  function makeIo(server, context) {
    function inventory() {
      var r = server.ReadUserData({ Fields: ["InventoryV2"] });
      return r && r.Success && r.Data && r.Data.InventoryV2 ? r.Data.InventoryV2 : {};
    }
    return {
      userId: context && context.UserID,
      now: function () {
        return Date.now() / 1000;
      },
      readData: function (bucket, key) {
        var r = server.GetUserCustomData({ Bucket: bucket, KeyIDs: [key] });
        var rec = r && r.Success && r.Data && r.Data[bucket] && r.Data[bucket][key];
        if (!rec || typeof rec.Value !== "string") return null;
        try {
          return JSON.parse(rec.Value);
        } catch (e) {
          return null;
        }
      },
      writeData: function (bucket, key, value) {
        var r = server.SetUserCustomData({ Bucket: bucket, KeyID: key, Value: typeof value === "string" ? value : JSON.stringify(value) });
        return !!(r && r.Success);
      },
      clout: function () {
        var c = (inventory().VirtualCurrencies || {})[CURRENCY];
        return c && typeof c.Amount === "number" ? c.Amount : 0;
      },
      ownedTrophies: function () {
        var items = inventory().UnstackableItems || {};
        var out = [];
        for (var k in items) if (items[k] && items[k].CatalogID === CATALOG && out.indexOf(items[k].ItemID) < 0) out.push(items[k].ItemID);
        return out;
      },
      apply: function (op) {
        var r = server.ApplyResourceOperation({ Operation: op, Source: "casecremental" });
        return !!(r && r.Success);
      },
    };
  }

  // ---- the game's rules (mirrors of sim/meta.ts and meta/plausibility.ts, tested against them) ----
  function maxPlausibleLog10(elapsedSec, loops) {
    var c = DATA.cap;
    return Math.min(c.ceilLog10, c.baseLog10 + c.perSqrtSecond * Math.sqrt(Math.max(0, elapsedSec)) + c.perLoop * Math.max(0, loops));
  }
  function scoreFor(e) {
    return e > 1 ? Math.floor(Math.log10(e) * 1000) : 0;
  }
  function cloutFor(e) {
    return Math.floor(Math.sqrt(Math.max(0, e)) / DATA.cloutDivisor);
  }
  function perkCost(id, level) {
    var p = DATA.perks[id];
    return level >= p.maxLevel ? null : Math.ceil(p.baseCost * Math.pow(p.growth, level));
  }
  function cloutEntry(n) {
    return { Type: "VirtualCurrency", CurrencyID: CURRENCY, Amount: n };
  }
  function itemEntry(id) {
    return { Type: "Item", CatalogID: CATALOG, ItemID: id, Amount: 1 };
  }

  function freshMeta() {
    var perks = {};
    for (var id in DATA.perks) perks[id] = 0;
    return { v: 1, perks: perks, loops: 0, stats: { playSeconds: 0, opened: 0, best: null, cloutEarned: 0 }, picked: [], runs: [] };
  }
  function readMeta(io) {
    var m = io.readData("ReadOnly", META_KEY);
    var f = freshMeta();
    if (!m || typeof m !== "object") return f;
    for (var id in f.perks) f.perks[id] = clamp(Math.floor(num(m.perks && m.perks[id]) || 0), 0, DATA.perks[id].maxLevel);
    f.loops = Math.max(0, Math.floor(num(m.loops) || 0));
    var s = m.stats || {};
    f.stats.playSeconds = Math.max(0, num(s.playSeconds) || 0);
    f.stats.opened = Math.max(0, num(s.opened) || 0);
    f.stats.cloutEarned = Math.max(0, num(s.cloutEarned) || 0);
    f.stats.best = s.best && typeof s.best.skinId === "string" && num(s.best.value) !== null ? { skinId: s.best.skinId, value: s.best.value } : null;
    f.picked = Array.isArray(m.picked) ? m.picked.filter(function (c) { return DATA.charms.indexOf(c) >= 0; }) : [];
    f.runs = Array.isArray(m.runs) ? m.runs.slice(-KEEP_RUNS) : [];
    return f;
  }
  function readAnti(io) {
    var a = io.readData("Internal", ANTI_KEY);
    if (!a || typeof a !== "object") return { firstSeen: io.now(), lastEndAt: null, trophyAt: 0, trophyRuns: {} };
    if (!a.trophyRuns || typeof a.trophyRuns !== "object") a.trophyRuns = {};
    return a;
  }
  function view(io, meta) {
    return { ok: true, clout: io.clout(), trophies: io.ownedTrophies(), perks: meta.perks, loops: meta.loops, stats: meta.stats, picked: meta.picked };
  }

  var RULES = {
    loadMeta: function (io) {
      var meta = readMeta(io);
      if (io.readData("Internal", ANTI_KEY) === null) io.writeData("Internal", ANTI_KEY, readAnti(io));
      return view(io, meta);
    },

    reportTrophy: function (io, a) {
      var t = DATA.trophies[a.skinId];
      if (!t || t.vault) return fail("not a trophy");
      var meta = readMeta(io);
      if (t.minLoops > meta.loops) return fail("case not reached yet");
      if (io.ownedTrophies().indexOf(a.skinId) >= 0) return view(io, meta);
      var anti = readAnti(io);
      var now = io.now();
      if (now - (num(anti.trophyAt) || 0) < DATA.trophyGapSec) return fail("too fast", true);
      var runId = typeof a.runId === "string" ? a.runId.slice(0, 40) : "?";
      var used = num(anti.trophyRuns[runId]) || 0;
      var allowed = Math.ceil(DATA.trophiesPerRunMinute * Math.max(1, (num(a.elapsedSec) || 0) / 60));
      if (used >= allowed) return fail("too many trophies this run");
      if (!io.apply({ Grant: { Standard: { Entries: [itemEntry(a.skinId)] } } })) return fail("grant failed", true);
      anti.trophyAt = now;
      anti.trophyRuns = {};
      anti.trophyRuns[runId] = used + 1; // only the current run is kept
      io.writeData("Internal", ANTI_KEY, anti);
      return view(io, meta);
    },

    endRun: function (io, a) {
      var runId = typeof a.runId === "string" && a.runId.length > 0 && a.runId.length <= 40 ? a.runId : null;
      var earnings = num(a.lifetimeEarnings);
      var elapsed = num(a.elapsedSec);
      if (runId === null || earnings === null || earnings < 0 || elapsed === null || elapsed < 0) return fail("bad run report");
      var meta = readMeta(io);
      if (meta.runs.indexOf(runId) >= 0) {
        var dup = view(io, meta);
        dup.duplicate = true;
        dup.gained = 0;
        dup.score = 0;
        dup.capped = false;
        dup.serverScore = SERVER_SCORE;
        return dup;
      }
      var anti = readAnti(io);
      var now = io.now();
      var last = num(anti.lastEndAt);
      var endedAt = clamp(num(a.endedAt) === null ? now : a.endedAt, last === null ? 0 : last, now);
      var window = last === null ? DATA.firstRunMaxSec : endedAt - last;
      var used = Math.min(elapsed, window);
      var capped = Math.min(earnings, Math.pow(10, maxPlausibleLog10(used, meta.loops)));
      var gain = cloutFor(capped);
      var score = scoreFor(capped);
      var vault = DATA.vaults[Math.min(meta.loops, DATA.vaults.length - 1)];
      var finale = a.finaleReached === true && a.trophy === vault.trophy;
      var grant = { Standard: { Entries: gain > 0 ? [cloutEntry(gain)] : [] } };
      if (finale && io.ownedTrophies().indexOf(vault.legend) < 0) grant.Standard.Entries.push(itemEntry(vault.legend));
      if (SERVER_SCORE && score > 0) grant.Standard.EventTokens = [{ Address: { Type: "Leaderboard", EntityID: LEADERBOARD }, Amount: score, Source: "casecremental:endRun" }];
      if ((grant.Standard.Entries.length > 0 || grant.Standard.EventTokens) && !io.apply({ Grant: grant })) return fail("grant failed", true);
      if (finale) meta.loops += 1;
      meta.stats.cloutEarned += gain;
      meta.runs.push(runId);
      meta.runs = meta.runs.slice(-KEEP_RUNS);
      anti.lastEndAt = endedAt;
      io.writeData("ReadOnly", META_KEY, meta);
      io.writeData("Internal", ANTI_KEY, anti);
      var out = view(io, meta);
      out.gained = gain;
      out.score = score;
      out.capped = capped < earnings;
      out.serverScore = SERVER_SCORE;
      return out;
    },

    buyPerk: function (io, a) {
      if (!DATA.perks[a.perkId]) return fail("unknown perk");
      var meta = readMeta(io);
      var level = meta.perks[a.perkId];
      if (num(a.level) !== null && a.level !== level) {
        var stale = view(io, meta);
        stale.stale = true;
        return stale;
      }
      var cost = perkCost(a.perkId, level);
      if (cost === null) return fail("max level");
      if (!io.apply({ Consume: { Standard: { Entries: [cloutEntry(cost)] } } })) return fail("not enough CLOUT");
      meta.perks[a.perkId] = level + 1;
      if (!io.writeData("ReadOnly", META_KEY, meta)) {
        io.apply({ Grant: { Standard: { Entries: [cloutEntry(cost)] } } }); // refund
        return fail("save failed", true);
      }
      return view(io, meta);
    },

    saveMeta: function (io, a) {
      var meta = readMeta(io);
      var anti = readAnti(io);
      var s = a.stats && typeof a.stats === "object" ? a.stats : {};
      var maxPlay = io.now() - (num(anti.firstSeen) || io.now()) + 3600;
      meta.stats.playSeconds = Math.max(meta.stats.playSeconds, clamp(num(s.playSeconds) || 0, 0, maxPlay));
      meta.stats.opened = Math.max(meta.stats.opened, clamp(Math.floor(num(s.opened) || 0), 0, meta.stats.playSeconds * DATA.maxOpensPerSecond));
      if (s.best && typeof s.best.skinId === "string" && num(s.best.value) !== null && s.best.value >= 0 && (!meta.stats.best || s.best.value > meta.stats.best.value))
        meta.stats.best = { skinId: s.best.skinId.slice(0, 40), value: s.best.value };
      if (a.picked !== undefined) {
        var picked = Array.isArray(a.picked) ? a.picked : null;
        var slots = 1 + (meta.perks.charmSlot || 0);
        if (picked === null || picked.length > slots) return fail("bad charms");
        for (var i = 0; i < picked.length; i++) if (DATA.charms.indexOf(picked[i]) < 0 || picked.indexOf(picked[i]) !== i) return fail("bad charms");
        meta.picked = picked.slice();
      }
      if (!io.writeData("ReadOnly", META_KEY, meta)) return fail("save failed", true);
      return view(io, meta);
    },
  };

  function wrap(name) {
    return function (args, context) {
      try {
        return RULES[name](makeIo(server, context), args && typeof args === "object" ? args : {});
      } catch (e) {
        log.Error(name + ": " + e);
        return fail("server error", true);
      }
    };
  }
  handlers.loadMeta = wrap("loadMeta");
  handlers.reportTrophy = wrap("reportTrophy");
  handlers.endRun = wrap("endRun");
  handlers.buyPerk = wrap("buyPerk");
  handlers.saveMeta = wrap("saveMeta");
  ```
  Then apply the probe verdict: change only `makeIo`'s call shapes (and the matching fake server in the `makeIo` test) to what Task 2 recorded, and set `SERVER_SCORE` to the verdict. If `charmSlot` is no longer a perk id after F4, use the perk that adds charm slots.

- [ ] **Step 5: Write the bundler** `tools/cloud/bundle.mjs` and add `"cloud": "node tools/cloud/bundle.mjs"` to `package.json` `scripts`:
  ```js
  // Joins cloudcode/data.json (generated from the content tables) and cloudcode/casecremental.js into the one script
  // the Title runs: cloudcode/casecremental.bundle.js. Publish that file's text with the idosgames MCP
  // (publish_cloud_code); never edit it by hand. `npm run cloud`.
  import { readFileSync, writeFileSync } from "node:fs";

  const dir = new URL("../../cloudcode/", import.meta.url);
  const data = readFileSync(new URL("data.json", dir), "utf8").trim();
  const code = readFileSync(new URL("casecremental.js", dir), "utf8");
  const out = `// Casecremental CloudCode — bundled by tools/cloud/bundle.mjs from cloudcode/data.json + cloudcode/casecremental.js.\nvar DATA = ${data};\n${code}`;
  writeFileSync(new URL("casecremental.bundle.js", dir), out);
  console.log(`cloudcode/casecremental.bundle.js: ${out.length} bytes`);
  ```
  Add to `cloudcode/casecremental.test.ts`:
  ```ts
  it("the committed bundle is data.json + casecremental.js (run `npm run cloud`)", () => {
    const dir = new URL("./", import.meta.url);
    const data = readFileSync(new URL("data.json", dir), "utf8").trim();
    const code = readFileSync(new URL("casecremental.js", dir), "utf8");
    expect(readFileSync(new URL("casecremental.bundle.js", dir), "utf8")).toBe(
      `// Casecremental CloudCode — bundled by tools/cloud/bundle.mjs from cloudcode/data.json + cloudcode/casecremental.js.\nvar DATA = ${data};\n${code}`,
    );
  });
  ```
  Prettier: `cloudcode/` is outside the folders `.prettierignore` lets through, so `npm run format` leaves it alone; keep the file in the 2-space style shown.

- [ ] **Step 6: Run the tests.**
  Run: `npm run cloud && npx vitest run cloudcode src/modules/casecremental/meta`
  Expected: PASS.

- [ ] **Step 7: Publish to DEV and smoke it.** `publish_cloud_code` (DEV): `code` = the text of `cloudcode/casecremental.bundle.js`, `comment` = "F7 server meta", `handlers` = `[{ "Name": "loadMeta" }, { "Name": "reportTrophy" }, { "Name": "endRun" }, { "Name": "buyPerk" }, { "Name": "saveMeta" }]` (the probe handler is gone with it). From the signed-in DEV page (Task 2 Step 6):
  ```js
  const x = async (n, a) => { const r = await idosClient.cloudCode.execute(n, a); return r.ok ? r.data.FunctionResult ?? r.data : r; };
  [await x("loadMeta", {}),
   await x("endRun", { runId: "rsmoke1", lifetimeEarnings: 1.2e6, elapsedSec: 480, endedAt: Date.now() / 1000, finaleReached: true, trophy: "vault1" }),
   await x("endRun", { runId: "rsmoke1", lifetimeEarnings: 1.2e6, elapsedSec: 480, endedAt: Date.now() / 1000, finaleReached: true, trophy: "vault1" }),
   await x("buyPerk", { perkId: "startCash", level: 0 }),
   await x("reportTrophy", { skinId: "bc_knife", runId: "rsmoke2", elapsedSec: 100 })]
  ```
  Expected: the first `endRun` pays `cloutFor(1.2e6)` CLOUT and returns `trophies` containing `vault1_legend`; the second answers `duplicate: true`; `buyPerk` lowers CLOUT by `perkCost("startCash", 0)`; `reportTrophy` returns `trophies` with `bc_knife`. Then `idosClient.data.user.getVirtualCurrencyAmount("CLOUT")` after `await idosClient.user.getUserState()` matches. If `FunctionResult` arrives as a JSON string, note it — Task 4's port parses both. If any call answers `server error`, read the execution log (`PersistExecutionLog` is on) and fix `makeIo`.

- [ ] **Step 8: Commit.**
  ```bash
  git add cloudcode/casecremental.js cloudcode/load.ts cloudcode/casecremental.test.ts cloudcode/casecremental.bundle.js tools/cloud/bundle.mjs package.json
  git commit -m "feat(meta): CloudCode reportTrophy, endRun, buyPerk, saveMeta and loadMeta with plausibility caps" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 4: The client bridge — queue, port, bridge, merge

**Files:**
- Create: `meta/queue.ts`, `meta/queue.test.ts`, `meta/bridge.ts`, `meta/bridge.test.ts`, `meta/merge.ts`, `meta/merge.test.ts`, `meta/clientPort.ts`

**Interfaces:**
- Consumes: the handler contract of Task 3.
- Produces:
  ```ts
  // meta/queue.ts
  export type CallName = "reportTrophy" | "endRun" | "buyPerk" | "saveMeta" | "submitScore";
  export interface QueuedCall { id: string; name: CallName; args: Record<string, unknown>; tries: number; nextAt: number }
  export const QUEUE_KEY = "casecremental.serverQueue";
  export class CallQueue {
    constructor(store: Pick<Storage, "getItem" | "setItem"> | null);
    get size(): number;
    push(call: { id: string; name: CallName; args: Record<string, unknown> }, now: number): void;
    head(now: number): QueuedCall | null;      // the first call when it is due
    done(id: string): void;
    retryLater(id: string, now: number): boolean; // true when it was dropped after MAX_TRIES
    hasWrites(): boolean;                      // an endRun or buyPerk still waiting
  }
  // meta/bridge.ts
  export type PortReply = { kind: "ok"; data: Record<string, unknown> } | { kind: "refused"; reason: string; retry: boolean } | { kind: "offline"; reason: string };
  export interface ServerPort { call(name: string, args: Record<string, unknown>): Promise<PortReply>; submitScore(score: number): Promise<PortReply> }
  export interface ServerDoc { clout: number; trophies: string[]; perks: Record<string, number>; loops: number;
    stats: { playSeconds: number; opened: number; best: { skinId: string; value: number } | null; cloutEarned: number }; picked: string[] }
  export type ServerStatus = "unknown" | "online" | "offline";
  export function parseDoc(data: Record<string, unknown>): ServerDoc | null;
  export class ServerMeta {
    constructor(port: ServerPort, queue: CallQueue, clock?: () => number);
    get status(): ServerStatus;
    get trophies(): ReadonlySet<string>;
    onDoc(l: (doc: ServerDoc) => void): () => void;
    onStatus(l: (s: ServerStatus) => void): () => void;
    load(): Promise<ServerDoc | null>;
    enqueue(name: CallName, args: Record<string, unknown>, id: string): void;
    pump(): Promise<void>;
    hasPendingWrites(): boolean;
  }
  // meta/merge.ts
  export function applyServerDoc(m: MetaState, doc: ServerDoc, pendingWrites: boolean): void;
  // meta/clientPort.ts
  export function clientPort(client: IDosGamesClient, timeoutMs?: number): ServerPort;
  ```

- [ ] **Step 1: Write the failing tests.**

  `meta/queue.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { CallQueue, MAX_TRIES, QUEUE_KEY } from "./queue";

  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };

  describe("CallQueue", () => {
    it("is first in, first out, and only hands out a due call", () => {
      const q = new CallQueue(memory());
      q.push({ id: "a", name: "endRun", args: {} }, 0);
      q.push({ id: "b", name: "buyPerk", args: {} }, 0);
      expect(q.head(0)!.id).toBe("a");
      q.retryLater("a", 0);
      expect(q.head(0)).toBeNull(); // b waits behind a
      expect(q.head(10)!.id).toBe("a");
      q.done("a");
      expect(q.head(10)!.id).toBe("b");
    });

    it("keeps one saveMeta (the newest) and ignores a duplicate id", () => {
      const q = new CallQueue(memory());
      q.push({ id: "m1", name: "saveMeta", args: { n: 1 } }, 0);
      q.push({ id: "t", name: "reportTrophy", args: {} }, 0);
      q.push({ id: "m2", name: "saveMeta", args: { n: 2 } }, 0);
      q.push({ id: "t", name: "reportTrophy", args: {} }, 0);
      expect(q.size).toBe(2);
      q.done("t");
      expect(q.head(0)!.args).toEqual({ n: 2 });
    });

    it("survives a reload and drops a call after MAX_TRIES", () => {
      const store = memory();
      new CallQueue(store).push({ id: "a", name: "endRun", args: { x: 1 } }, 0);
      const q = new CallQueue(store);
      expect(q.head(0)).toMatchObject({ id: "a", args: { x: 1 } });
      let dropped = false;
      for (let i = 0; i < MAX_TRIES; i++) dropped = q.retryLater("a", 1e9);
      expect(dropped).toBe(true);
      expect(q.size).toBe(0);
      store.setItem(QUEUE_KEY, "{broken");
      expect(new CallQueue(store).size).toBe(0);
    });
  });
  ```

  `meta/bridge.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { ServerMeta, type PortReply, type ServerPort } from "./bridge";
  import { CallQueue } from "./queue";

  const doc = (over = {}) => ({ ok: true, clout: 5, trophies: ["bc_knife"], perks: { luck: 1 }, loops: 1, stats: { playSeconds: 1, opened: 2, best: null, cloutEarned: 5 }, picked: [], ...over });
  function fakePort(replies: Record<string, PortReply[]>) {
    const calls: string[] = [];
    const port: ServerPort = {
      call: async (name) => (calls.push(name), replies[name]?.shift() ?? { kind: "offline", reason: "down" }),
      submitScore: async (score) => (calls.push(`score:${score}`), { kind: "ok", data: {} }),
    };
    return { port, calls };
  }
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

  describe("ServerMeta", () => {
    it("loads the doc, goes online and remembers the trophies", async () => {
      const { port } = fakePort({ loadMeta: [{ kind: "ok", data: doc() }] });
      const s = new ServerMeta(port, new CallQueue(null), () => 0);
      const seen: unknown[] = [];
      s.onDoc((d) => seen.push(d));
      expect(await s.load()).toMatchObject({ clout: 5, loops: 1 });
      expect(s.status).toBe("online");
      expect(s.trophies.has("bc_knife")).toBe(true);
      expect(seen).toHaveLength(1);
    });

    it("is offline, not broken, when the port fails", async () => {
      const { port } = fakePort({});
      const s = new ServerMeta(port, new CallQueue(null), () => 0);
      expect(await s.load()).toBeNull();
      expect(s.status).toBe("offline");
    });

    it("keeps calls across a reload and sends them when the port comes back", async () => {
      const store = memory();
      const down = fakePort({});
      const a = new ServerMeta(down.port, new CallQueue(store), () => 0);
      a.enqueue("endRun", { runId: "r1" }, "end-r1");
      await a.pump();
      expect(a.hasPendingWrites()).toBe(true);
      const up = fakePort({ endRun: [{ kind: "ok", data: doc({ score: 6079, serverScore: false }) }] });
      const b = new ServerMeta(up.port, new CallQueue(store), () => 1e6);
      await b.pump();
      expect(up.calls).toEqual(["endRun", "score:6079"]);
      expect(b.hasPendingWrites()).toBe(false);
    });

    it("drops a call the server refuses for good, retries one it asks to retry", async () => {
      const { port, calls } = fakePort({ reportTrophy: [{ kind: "refused", reason: "not a trophy", retry: false }], buyPerk: [{ kind: "refused", reason: "too fast", retry: true }] });
      const s = new ServerMeta(port, new CallQueue(null), () => 0);
      s.enqueue("reportTrophy", {}, "t");
      s.enqueue("buyPerk", {}, "p");
      await s.pump();
      expect(calls).toEqual(["reportTrophy", "buyPerk"]);
      expect(s.hasPendingWrites()).toBe(true); // buyPerk waits for its retry
    });

    it("does not submit the score when the server did", async () => {
      const { port, calls } = fakePort({ endRun: [{ kind: "ok", data: doc({ score: 6079, serverScore: true }) }] });
      const s = new ServerMeta(port, new CallQueue(null), () => 0);
      s.enqueue("endRun", {}, "e");
      await s.pump();
      expect(calls).toEqual(["endRun"]);
    });
  });
  ```

  `meta/merge.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { freshMeta } from "../sim/meta";
  import type { ServerDoc } from "./bridge";
  import { applyServerDoc } from "./merge";

  const doc = (over: Partial<ServerDoc> = {}): ServerDoc => ({ clout: 40, trophies: ["vault1_legend", "bc_knife"], perks: { startCash: 2, luck: 1 }, loops: 1, stats: { playSeconds: 900, opened: 800, best: null, cloutEarned: 50 }, picked: [], ...over });

  describe("applyServerDoc", () => {
    it("takes the server's CLOUT and perks when nothing is pending", () => {
      const m = freshMeta();
      m.clout = 999;
      m.perks.luck = 3;
      applyServerDoc(m, doc(), false);
      expect(m.clout).toBe(40);
      expect(m.perks).toMatchObject({ startCash: 2, luck: 1 });
    });

    it("keeps the local CLOUT and the larger perks while writes are pending", () => {
      const m = freshMeta();
      m.clout = 12;
      m.perks.luck = 3;
      applyServerDoc(m, doc(), true);
      expect(m.clout).toBe(12);
      expect(m.perks).toMatchObject({ startCash: 2, luck: 3 });
    });

    it("a fresh local meta gets the server's loops, perks and vault trophies", () => {
      const m = freshMeta();
      applyServerDoc(m, doc(), false);
      expect(m.loops).toBe(1);
      expect(m.trophies).toEqual(["vault1"]);
      expect(m.stats).toMatchObject({ playSeconds: 900, opened: 800, cloutEarned: 50 });
    });

    it("never lowers the local loops or stats", () => {
      const m = freshMeta();
      m.loops = 3;
      m.stats.opened = 5000;
      applyServerDoc(m, doc(), false);
      expect(m.loops).toBe(3);
      expect(m.stats.opened).toBe(5000);
    });
  });
  ```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/meta`
  Expected: FAIL — `queue`, `bridge`, `merge` do not exist.

- [ ] **Step 3: Write `meta/queue.ts`.**
  ```ts
  // The server call queue (plan F7). Every meta call to the Title goes through it, so a call made offline is kept — in
  // localStorage, across reloads — and retried with back-off. Strictly first in, first out: an endRun pays the CLOUT
  // a later buyPerk spends. A saveMeta replaces any saveMeta still waiting (only the newest stats matter). A broken
  // stored queue is dropped, never thrown.

  export type CallName = "reportTrophy" | "endRun" | "buyPerk" | "saveMeta" | "submitScore";

  export interface QueuedCall {
    id: string;
    name: CallName;
    args: Record<string, unknown>;
    tries: number;
    /** Unix seconds before which it is not sent again. */
    nextAt: number;
  }

  export const QUEUE_KEY = "casecremental.serverQueue";
  /** Seconds to wait after each failed try (the last value repeats). */
  export const BACKOFF_SECONDS = [2, 5, 15, 60, 300] as const;
  export const MAX_TRIES = 12;
  export const MAX_QUEUE = 200;

  type Store = Pick<Storage, "getItem" | "setItem">;

  function load(store: Store | null): QueuedCall[] {
    try {
      const raw = store?.getItem(QUEUE_KEY);
      const list: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((c): c is QueuedCall => typeof c?.id === "string" && typeof c?.name === "string") : [];
    } catch {
      return [];
    }
  }

  export class CallQueue {
    private items: QueuedCall[];

    constructor(private readonly store: Store | null) {
      this.items = load(store);
    }

    get size(): number {
      return this.items.length;
    }

    push(call: { id: string; name: CallName; args: Record<string, unknown> }, now: number): void {
      if (this.items.some((c) => c.id === call.id)) return;
      if (call.name === "saveMeta") this.items = this.items.filter((c) => c.name !== "saveMeta");
      this.items.push({ ...call, tries: 0, nextAt: now });
      if (this.items.length > MAX_QUEUE) this.items.splice(0, this.items.length - MAX_QUEUE);
      this.persist();
    }

    head(now: number): QueuedCall | null {
      const first = this.items[0];
      return first && first.nextAt <= now ? first : null;
    }

    done(id: string): void {
      this.items = this.items.filter((c) => c.id !== id);
      this.persist();
    }

    retryLater(id: string, now: number): boolean {
      const c = this.items.find((x) => x.id === id);
      if (!c) return false;
      c.tries += 1;
      if (c.tries >= MAX_TRIES) {
        console.warn(`[casecremental] gave up on the server call ${c.name} after ${c.tries} tries`);
        this.done(id);
        return true;
      }
      c.nextAt = now + BACKOFF_SECONDS[Math.min(c.tries - 1, BACKOFF_SECONDS.length - 1)]!;
      this.persist();
      return false;
    }

    hasWrites(): boolean {
      return this.items.some((c) => c.name === "endRun" || c.name === "buyPerk");
    }

    private persist(): void {
      try {
        this.store?.setItem(QUEUE_KEY, JSON.stringify(this.items));
      } catch {
        // storage full or blocked: the queue still works for this session
      }
    }
  }
  ```

- [ ] **Step 4: Write `meta/bridge.ts`.**
  ```ts
  import { CallQueue, type CallName } from "./queue";

  // The server side of the meta (plan F7): reads the player's meta from the Title and sends the queued calls, one at a
  // time, in order. Never throws and never blocks the game: a call that cannot go now stays in the queue. The port is
  // the only thing that talks to the SDK (meta/clientPort.ts), so the tests drive this with a fake.

  export type PortReply =
    | { kind: "ok"; data: Record<string, unknown> }
    | { kind: "refused"; reason: string; retry: boolean }
    | { kind: "offline"; reason: string };

  export interface ServerPort {
    call(name: string, args: Record<string, unknown>): Promise<PortReply>;
    submitScore(score: number): Promise<PortReply>;
  }

  export interface ServerDoc {
    clout: number;
    trophies: string[];
    perks: Record<string, number>;
    loops: number;
    stats: { playSeconds: number; opened: number; best: { skinId: string; value: number } | null; cloutEarned: number };
    picked: string[];
  }

  export type ServerStatus = "unknown" | "online" | "offline";

  const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
  const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

  /** A handler's view, or null when it is not one. */
  export function parseDoc(d: Record<string, unknown>): ServerDoc | null {
    if (d.ok !== true || !isNum(d.clout) || !Array.isArray(d.trophies) || !isObj(d.perks) || !isNum(d.loops) || !isObj(d.stats)) return null;
    const s = d.stats;
    const best = isObj(s.best) && typeof s.best.skinId === "string" && isNum(s.best.value) ? { skinId: s.best.skinId, value: s.best.value } : null;
    return {
      clout: d.clout,
      trophies: d.trophies.filter((t): t is string => typeof t === "string"),
      perks: Object.fromEntries(Object.entries(d.perks).filter(([, v]) => isNum(v))) as Record<string, number>,
      loops: d.loops,
      stats: { playSeconds: isNum(s.playSeconds) ? s.playSeconds : 0, opened: isNum(s.opened) ? s.opened : 0, best, cloutEarned: isNum(s.cloutEarned) ? s.cloutEarned : 0 },
      picked: Array.isArray(d.picked) ? d.picked.filter((c): c is string => typeof c === "string") : [],
    };
  }

  export class ServerMeta {
    private state: ServerStatus = "unknown";
    private owned = new Set<string>();
    private running: Promise<void> | null = null;
    private readonly docListeners = new Set<(doc: ServerDoc) => void>();
    private readonly statusListeners = new Set<(s: ServerStatus) => void>();

    constructor(
      private readonly port: ServerPort,
      private readonly queue: CallQueue,
      private readonly clock: () => number = () => Date.now() / 1000,
    ) {}

    get status(): ServerStatus {
      return this.state;
    }

    get trophies(): ReadonlySet<string> {
      return this.owned;
    }

    onDoc(l: (doc: ServerDoc) => void): () => void {
      this.docListeners.add(l);
      return () => this.docListeners.delete(l);
    }

    onStatus(l: (s: ServerStatus) => void): () => void {
      this.statusListeners.add(l);
      return () => this.statusListeners.delete(l);
    }

    hasPendingWrites(): boolean {
      return this.queue.hasWrites();
    }

    async load(): Promise<ServerDoc | null> {
      const r = await this.safe(() => this.port.call("loadMeta", {}));
      if (r.kind !== "ok") {
        this.setStatus("offline");
        return null;
      }
      this.setStatus("online");
      return this.take(r.data);
    }

    enqueue(name: CallName, args: Record<string, unknown>, id: string): void {
      this.queue.push({ id, name, args }, this.clock());
      void this.pump();
    }

    /** Sends the due calls in order. A second pump while one runs joins it (and the running one picks up new calls). */
    pump(): Promise<void> {
      if (!this.running) this.running = this.drain().finally(() => (this.running = null));
      return this.running;
    }

    private async drain(): Promise<void> {
      for (let call = this.queue.head(this.clock()); call; call = this.queue.head(this.clock())) {
        const c = call;
        const r = await this.safe(() => (c.name === "submitScore" ? this.port.submitScore(Number(c.args.score)) : this.port.call(c.name, c.args)));
        if (r.kind === "offline" || (r.kind === "refused" && r.retry)) {
          if (r.kind === "offline") this.setStatus("offline");
          this.queue.retryLater(c.id, this.clock());
          return;
        }
        this.setStatus("online");
        this.queue.done(c.id);
        if (r.kind === "refused") {
          console.warn(`[casecremental] the server refused ${c.name}: ${r.reason}`);
          continue;
        }
        this.take(r.data);
        const score = r.data.score;
        if (c.name === "endRun" && r.data.serverScore !== true && isNum(score) && score > 0)
          this.queue.push({ id: `score-${String(c.args.runId ?? c.id)}`, name: "submitScore", args: { score } }, this.clock());
      }
    }

    private take(data: Record<string, unknown>): ServerDoc | null {
      const doc = parseDoc(data);
      if (!doc) return null;
      this.owned = new Set(doc.trophies);
      for (const l of this.docListeners) l(doc);
      return doc;
    }

    private async safe(fn: () => Promise<PortReply>): Promise<PortReply> {
      try {
        return await fn();
      } catch (err) {
        return { kind: "offline", reason: String(err) };
      }
    }

    private setStatus(s: ServerStatus): void {
      if (s === this.state) return;
      this.state = s;
      for (const l of this.statusListeners) l(s);
    }
  }
  ```

- [ ] **Step 5: Write `meta/merge.ts`.**
  ```ts
  import { VAULTS } from "../sim/content/vaults";
  import { PERK_IDS, type MetaState } from "../sim/meta";
  import type { ServerDoc } from "./bridge";

  // A server answer merged into the local meta (plan F7). The server is the authority for CLOUT and perks — but only
  // once nothing the player did offline is still waiting to reach it (else its answer is older than the local truth).
  // Loops and campaign stats only grow. A vault legend in the inventory is that vault's trophy. The best drop stays
  // local (the server keeps only its skin and value).

  export function applyServerDoc(m: MetaState, doc: ServerDoc, pendingWrites: boolean): void {
    if (!pendingWrites) m.clout = doc.clout;
    for (const id of PERK_IDS) {
      const server = doc.perks[id];
      if (server === undefined) continue;
      m.perks[id] = pendingWrites ? Math.max(m.perks[id], server) : server;
    }
    m.loops = Math.max(m.loops, doc.loops);
    for (const v of VAULTS) if (doc.trophies.includes(v.legend.id) && !m.trophies.includes(v.trophy)) m.trophies.push(v.trophy);
    m.stats.playSeconds = Math.max(m.stats.playSeconds, doc.stats.playSeconds);
    m.stats.opened = Math.max(m.stats.opened, doc.stats.opened);
    m.stats.cloutEarned = Math.max(m.stats.cloutEarned, doc.stats.cloutEarned);
  }
  ```
  (`m.stats` is F6-A's `CampaignStats`. If the field names differ now, use them.)

- [ ] **Step 6: Write `meta/clientPort.ts`** — the one file that imports the SDK:
  ```ts
  import type { IDosGamesClient } from "@idosgames/core";
  import type { PortReply, ServerPort } from "./bridge";

  // The SDK side of the server port (plan F7): CloudCode handlers through client.cloudCode.execute and the best_run
  // score through client.leaderboard.submitScore. SDK calls answer OperationResult and do not throw; a call that
  // hangs is cut off after `timeoutMs` and counts as offline.

  export const LEADERBOARD_ID = "best_run";
  const RETRY_ERRORS = new Set(["RateLimited", "Timeout", "ApiCallLimitExceeded", "StatementCountExceeded"]);

  function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(fallback), ms);
      p.then(
        (v) => (clearTimeout(timer), resolve(v)),
        () => (clearTimeout(timer), resolve(fallback)),
      );
    });
  }

  function readResult(raw: unknown): Record<string, unknown> | null {
    let v = raw;
    if (typeof v === "string") {
      try {
        v = JSON.parse(v);
      } catch {
        return null;
      }
    }
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  }

  export function clientPort(client: IDosGamesClient, timeoutMs = 10_000): ServerPort {
    const offline: PortReply = { kind: "offline", reason: "timeout" };
    return {
      async call(name, args) {
        const r = await withTimeout(client.cloudCode.execute(name, args as never), timeoutMs, null);
        if (r === null) return offline;
        if (!r.ok) return r.reason === "server" ? { kind: "refused", reason: r.error, retry: true } : { kind: "offline", reason: r.error };
        const err = r.data.Error?.Error;
        if (err && err !== "None") return RETRY_ERRORS.has(err) ? { kind: "offline", reason: err } : { kind: "refused", reason: err, retry: false };
        const data = readResult(r.data.FunctionResult);
        if (!data) return { kind: "refused", reason: "no result", retry: false };
        if (data.ok === false) return { kind: "refused", reason: String(data.reason ?? "refused"), retry: data.retry === true };
        return { kind: "ok", data };
      },
      async submitScore(score) {
        const r = await withTimeout(client.leaderboard.submitScore(LEADERBOARD_ID, score), timeoutMs, null);
        if (r === null) return offline;
        return r.ok ? { kind: "ok", data: {} } : r.reason === "server" ? { kind: "refused", reason: r.error, retry: false } : { kind: "offline", reason: r.error };
      },
    };
  }
  ```
  (`args as never` because `execute` takes `JsonValue`; the handlers' args are plain JSON. If the typecheck prefers it, import `type JsonValue` from `@idosgames/core` only if the `.d.ts` exports it — check with `grep -n "JsonValue" node_modules/@idosgames/core/dist/index.d.ts`; otherwise keep the cast.)

- [ ] **Step 7: Run the tests and the typecheck.**
  Run: `npx vitest run src/modules/casecremental/meta && npm run typecheck`
  Expected: PASS.

- [ ] **Step 8: Commit.**
  ```bash
  git add src/modules/casecremental/meta
  git commit -m "feat(meta): the client bridge - a persistent FIFO call queue, the server port, the merge into the local meta" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 5: Wiring the game to the server

Sim events become queued calls; server answers are merged into the controller's meta. The game never waits for any of it.

**Files:**
- Create: `game/serverSync.ts`, `game/serverSync.test.ts`
- Modify: `sim/runTypes.ts` (`perkBought` carries `id` and `level`), `game/controller.ts` (emit them; `applyServerMeta`), `game/controller.test.ts`, `module.ts`

**Interfaces:**
- Consumes: `ServerMeta`, `CallQueue`, `clientPort`, `applyServerDoc`, `trophyDropsOf` (Tasks 1, 4).
- Produces:
  ```ts
  // sim/runTypes.ts: | { type: "perkBought"; id: PerkId; level: number }   (level = the new level)
  // game/controller.ts
  applyServerMeta(doc: ServerDoc, pendingWrites: boolean): void;
  // game/serverSync.ts
  export interface SyncTarget { readonly meta: MetaState; readonly run: { readonly seed: number; readonly state: { readonly time: number } };
    onEvent(l: (e: SimEvent) => void): () => void; applyServerMeta(doc: ServerDoc, pendingWrites: boolean): void }
  export const runIdOf: (seed: number) => string;   // "r" + seed.toString(36)
  export function connectServer(target: SyncTarget, server: ServerMeta, pumpEverySec?: number): () => void;
  ```

- [ ] **Step 1: Write the failing tests.**
  `game/serverSync.test.ts`:
  ```ts
  import { describe, expect, it, vi } from "vitest";
  import { ServerMeta, type ServerPort } from "../meta/bridge";
  import { CallQueue } from "../meta/queue";
  import { freshMeta } from "../sim/meta";
  import type { SimEvent } from "../sim/run";
  import type { Drop } from "../sim/types";
  import { connectServer, runIdOf, type SyncTarget } from "./serverSync";

  const knife: Drop = { id: 1, caseId: "bootcamp", skinId: "bc_knife", rarity: "gold", float: 0.1, wear: "FN", statTrak: false, value: 99 };

  function setup() {
    const sent: Array<[string, Record<string, unknown>]> = [];
    const port: ServerPort = { call: vi.fn(async (name, args) => (sent.push([name, args]), { kind: "offline" as const, reason: "test" })), submitScore: vi.fn() };
    let listener: (e: SimEvent) => void = () => {};
    const target: SyncTarget & { applied: number } = {
      meta: freshMeta(),
      run: { seed: 12345, state: { time: 300 } },
      onEvent: (l) => ((listener = l), () => {}),
      applied: 0,
      applyServerMeta() { this.applied++; },
    };
    const queue = new CallQueue(null);
    const server = new ServerMeta(port, queue, () => 0);
    const stop = connectServer(target, server, 0);
    return { fire: (e: SimEvent) => listener(e), sent, queue, target, stop, server };
  }

  describe("connectServer", () => {
    it("reports a trophy the player does not own yet, once", () => {
      const s = setup();
      s.fire({ type: "revealed", drops: [knife, knife] });
      s.fire({ type: "botRevealed", drops: [knife] });
      expect(s.queue.size).toBe(1);
      expect(s.sent.find(([n]) => n === "reportTrophy")![1]).toEqual({ skinId: "bc_knife", runId: runIdOf(12345), elapsedSec: 300 });
      s.stop();
    });

    it("ends the run on the vault and saves the campaign stats", () => {
      const s = setup();
      s.fire({ type: "vaultOpened", trophy: "vault1", drop: knife, lifetimeEarnings: 1.2e6 });
      const end = s.sent.find(([n]) => n === "endRun")![1];
      expect(end).toMatchObject({ runId: runIdOf(12345), lifetimeEarnings: 1.2e6, elapsedSec: 300, finaleReached: true, trophy: "vault1" });
      expect(typeof end.endedAt).toBe("number");
      expect(s.queue.size).toBe(2); // endRun waits (offline); saveMeta queued behind it
      s.stop();
    });

    it("buys a perk at the level it had before", () => {
      const s = setup();
      s.fire({ type: "perkBought", id: "luck", level: 2 });
      expect(s.sent.find(([n]) => n === "buyPerk")![1]).toEqual({ perkId: "luck", level: 1 });
      s.stop();
    });

    it("never waits for the server: the listener returns at once", () => {
      const s = setup();
      const t0 = performance.now();
      for (let i = 0; i < 200; i++) s.fire({ type: "revealed", drops: [knife] });
      expect(performance.now() - t0).toBeLessThan(50);
      s.stop();
    });
  });
  ```
  Add to `game/controller.test.ts`:
  ```ts
  it("emits perkBought with the perk and its new level", () => {
    const c = new GameController(1);
    c.meta.clout = 1e6;
    c.run.state.over = true; // perks are bought between runs
    const seen: unknown[] = [];
    c.onEvent((e) => seen.push(e));
    expect(c.act({ type: "buyPerk", id: "luck" }).ok).toBe(true);
    expect(seen).toContainEqual({ type: "perkBought", id: "luck", level: 1 });
  });

  it("merges a server answer into the meta and refreshes the view", () => {
    const c = new GameController(1);
    let refreshed = 0;
    c.subscribe(() => refreshed++);
    c.applyServerMeta({ clout: 77, trophies: ["vault1_legend"], perks: { luck: 2 }, loops: 1, stats: { playSeconds: 1, opened: 1, best: null, cloutEarned: 77 }, picked: [] }, false);
    expect(c.meta).toMatchObject({ clout: 77, loops: 1, trophies: ["vault1"] });
    expect(c.meta.perks.luck).toBe(2);
    expect(refreshed).toBeGreaterThan(0);
  });
  ```
  (If setting `state.over` directly is not how the existing controller tests reach the prestige screen, use their helper.)

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/game`
  Expected: FAIL.

- [ ] **Step 3: Change the event and the controller.**
  - `sim/runTypes.ts`: `| { type: "perkBought"; id: PerkId; level: number }` (import `type PerkId` from `./meta`; if that makes an import cycle the typecheck complains about, declare the field as `id: string` with a doc comment "a PerkId").
  - `game/controller.ts`, in `dispatch`, replace case `"buyPerk"` (the event's level must be read **after** the purchase, so `emitOnOk` does not fit):
    ```ts
    case "buyPerk": {
      if (!run.state.over) return { ok: false, reason: "perks are bought between runs" };
      const r = buyPerk(this.meta, a.id);
      if (r.ok) this.emit({ type: "perkBought", id: a.id, level: this.meta.perks[a.id] });
      return r;
    }
    ```
  - Add the method (and `import { applyServerDoc } from "../meta/merge"; import type { ServerDoc } from "../meta/bridge";`):
    ```ts
    /** A server answer (plan F7): merged into the meta, saved, shown. */
    applyServerMeta(doc: ServerDoc, pendingWrites: boolean): void {
      applyServerDoc(this.meta, doc, pendingWrites);
      this.save();
      this.refreshView();
    }
    ```
  - Fix anything else that builds a `perkBought` event (`grep -rn "perkBought" src/modules/casecremental`): the World and audio only read `type`.

- [ ] **Step 4: Write `game/serverSync.ts`.**
  ```ts
  import type { ServerDoc, ServerMeta } from "../meta/bridge";
  import { trophyDropsOf } from "../meta/trophies";
  import type { MetaState } from "../sim/meta";
  import type { SimEvent } from "../sim/run";

  // The game ↔ server seam (plan F7). Sim events become queued server calls — a new trophy, the vault (endRun and the
  // campaign stats), a perk, a charm pick — and every server answer is merged into the meta. Nothing here waits:
  // calls go through the queue, which retries on its own clock.

  export interface SyncTarget {
    readonly meta: MetaState;
    readonly run: { readonly seed: number; readonly state: { readonly time: number } };
    onEvent(l: (e: SimEvent) => void): () => void;
    applyServerMeta(doc: ServerDoc, pendingWrites: boolean): void;
  }

  /** One id per run: run seeds differ between runs (the controller derives each from the last). */
  export const runIdOf = (seed: number): string => `r${(seed >>> 0).toString(36)}`;

  function metaArgs(m: MetaState): Record<string, unknown> {
    const best = m.stats.best ? { skinId: m.stats.best.skinId, value: m.stats.best.value } : null;
    return { stats: { playSeconds: Math.floor(m.stats.playSeconds), opened: m.stats.opened, best }, picked: [...m.picked] };
  }

  export function connectServer(target: SyncTarget, server: ServerMeta, pumpEverySec = 5): () => void {
    const asked = new Set<string>();
    const offEvent = target.onEvent((e) => {
      const run = target.run;
      const runId = runIdOf(run.seed);
      for (const d of trophyDropsOf(e)) {
        if (asked.has(d.skinId) || server.trophies.has(d.skinId)) continue;
        asked.add(d.skinId);
        server.enqueue("reportTrophy", { skinId: d.skinId, runId, elapsedSec: Math.floor(run.state.time) }, `trophy-${d.skinId}`);
      }
      if (e.type === "vaultOpened") {
        server.enqueue(
          "endRun",
          { runId, lifetimeEarnings: e.lifetimeEarnings, elapsedSec: Math.floor(run.state.time), endedAt: Math.floor(Date.now() / 1000), finaleReached: true, trophy: e.trophy },
          `end-${runId}`,
        );
        server.enqueue("saveMeta", metaArgs(target.meta), `meta-${runId}`);
      }
      if (e.type === "perkBought") server.enqueue("buyPerk", { perkId: e.id, level: e.level - 1 }, `perk-${e.id}-${e.level}`);
      if (e.type === "charmPicked" || e.type === "runStarted") server.enqueue("saveMeta", metaArgs(target.meta), `meta-${Date.now()}`);
    });
    const offDoc = server.onDoc((doc) => target.applyServerMeta(doc, server.hasPendingWrites()));
    void server.load().then(() => server.pump());
    const timer = pumpEverySec > 0 ? setInterval(() => void server.pump(), pumpEverySec * 1000) : null;
    return () => {
      offEvent();
      offDoc();
      if (timer) clearInterval(timer);
    };
  }
  ```
  `charmPicked` fires only on a pick; an un-pick is saved with the next `saveMeta` (`runStarted`). That is enough: the picks matter only for the run being started.

- [ ] **Step 5: Wire it in `module.ts`.** After the controller is built:
  ```ts
  import { ServerMeta } from "./meta/bridge";
  import { clientPort } from "./meta/clientPort";
  import { CallQueue } from "./meta/queue";
  import { connectServer } from "./game/serverSync";
  // …in setup(ctx), after `const controller = …`:
  // The meta lives on the Title too (plan F7): CLOUT, perks, trophies, the leaderboard. Offline the game plays on
  // the local meta and the calls wait in the queue (localStorage).
  const server = new ServerMeta(clientPort(ctx.client), new CallQueue(safeStorage()));
  connectServer(controller, server);
  window.addEventListener("online", () => void server.pump());
  ```
  with, in the same file:
  ```ts
  /** localStorage, or none when the browser blocks it. */
  function safeStorage(): Storage | null {
    try {
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      return null;
    }
  }
  ```

- [ ] **Step 6: Run everything.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental cloudcode && npm run build`
  Expected: PASS.

- [ ] **Step 7: Commit.**
  ```bash
  git add src/modules/casecremental/sim/runTypes.ts src/modules/casecremental/game src/modules/casecremental/module.ts
  git commit -m "feat(meta): the game reports trophies, runs, perks and stats to the Title and merges what it answers" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 6: The Trophy Case and the Leaderboard lobby tabs

Two lobby tabs registered by the game module (`ctx.features.register`; the base lays them out as tabs, `src/base/lobby/Lobby.tsx`). Each screen is rendered inside the host's client provider, so it reads the SDK through `useUserState` / `useIDosGamesClient`.

**Files:**
- Create: `ui/lobby/lobbyRules.ts`, `ui/lobby/lobbyRules.test.ts`, `ui/lobby/TrophyCase.tsx`, `ui/lobby/Leaderboard.tsx`, `ui/lobby/features.ts`
- Modify: `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`, `module.ts`, `module.meta.json`

**Interfaces:**
- Consumes: `TROPHIES`, `TROPHY_CATALOG` (Task 1), `earningsFromScore` (Task 1), `LEADERBOARD_ID` (Task 4), `renderSkinFrame` (`fx/skins/motion.ts`), `formatCash` (`sim/format.ts`), `t` / `getLang` / `onLangChange` (`i18n/index.ts`).
- Produces:
  ```ts
  // ui/lobby/lobbyRules.ts
  export interface TrophyGroup { source: string; cells: Array<{ id: string; owned: boolean; rarity: "covert" | "gold"; vault: boolean }> }
  export function ownedTrophyIds(unstackable: Record<string, { ItemID: string; CatalogID?: string | null }> | null | undefined): Set<string>;
  export function trophyGroups(owned: ReadonlySet<string>): TrophyGroup[];
  export interface BoardEntry { UserID: string; Score?: number | null; Rank?: number | null; PublicProfile?: { Username?: string | null } | null }
  export interface BoardRow { rank: number; userId: string; name: string | null; wallet: string | null; earnings: number; me: boolean }
  export function boardRows(entries: readonly BoardEntry[], wallets: Readonly<Record<string, string>>, myId: string | null): BoardRow[];
  export const shortAddress: (address: string) => string;
  // ui/lobby/features.ts
  export function registerLobbyTabs(features: FeatureRegistry): () => void;
  ```
  F8 fills `wallets` (Public key `cc_wallet`); this task passes `{}` until then.

- [ ] **Step 1: Write the failing tests** `ui/lobby/lobbyRules.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { TROPHIES } from "../../meta/trophies";
  import { boardRows, ownedTrophyIds, shortAddress, trophyGroups } from "./lobbyRules";

  describe("trophy case", () => {
    it("reads the owned Trophies items, ignoring other catalogs", () => {
      expect([...ownedTrophyIds({ a: { ItemID: "bc_knife", CatalogID: "Trophies" }, b: { ItemID: "x", CatalogID: "Other" } })]).toEqual(["bc_knife"]);
      expect(ownedTrophyIds(undefined).size).toBe(0);
    });

    it("groups every trophy by case, then the vaults, in content order", () => {
      const groups = trophyGroups(new Set(["bc_knife"]));
      expect(groups.flatMap((g) => g.cells).length).toBe(TROPHIES.length);
      expect(groups[0]!.source).toBe("bootcamp");
      expect(groups[0]!.cells.find((c) => c.id === "bc_knife")!.owned).toBe(true);
      expect(groups[groups.length - 1]!.cells.every((c) => c.vault)).toBe(true);
    });
  });

  describe("leaderboard", () => {
    it("ranks rows, turns scores back into earnings, marks me, keeps names and wallets", () => {
      const rows = boardRows(
        [
          { UserID: "b", Score: 9000, Rank: 2, PublicProfile: { Username: "" } },
          { UserID: "a", Score: 12000, Rank: 1, PublicProfile: { Username: "neo" } },
        ],
        { b: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
        "b",
      );
      expect(rows.map((r) => r.userId)).toEqual(["a", "b"]);
      expect(rows[0]).toMatchObject({ rank: 1, name: "neo", wallet: null, me: false });
      expect(rows[0]!.earnings).toBeCloseTo(1e12, -6);
      expect(rows[1]).toMatchObject({ name: null, wallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", me: true });
    });

    it("shortens a wallet address", () => {
      expect(shortAddress("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBe("7xKX…gAsU");
      expect(shortAddress("short")).toBe("short");
    });

    it("copes with an empty board and missing fields", () => {
      expect(boardRows([], {}, null)).toEqual([]);
      expect(boardRows([{ UserID: "x" }], {}, null)[0]).toMatchObject({ rank: 1, earnings: 1 });
    });
  });
  ```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run src/modules/casecremental/ui/lobby`
  Expected: FAIL.

- [ ] **Step 3: Write `ui/lobby/lobbyRules.ts`.**
  ```ts
  import { earningsFromScore } from "../../meta/plausibility";
  import { TROPHIES, TROPHY_CATALOG } from "../../meta/trophies";

  // What the lobby's Trophy Case and Leaderboard show (plan F7), as pure rules over the SDK's data shapes.

  export interface TrophyGroup {
    source: string;
    cells: Array<{ id: string; owned: boolean; rarity: "covert" | "gold"; vault: boolean }>;
  }

  export function ownedTrophyIds(unstackable: Record<string, { ItemID: string; CatalogID?: string | null }> | null | undefined): Set<string> {
    const out = new Set<string>();
    for (const it of Object.values(unstackable ?? {})) if (it.CatalogID === TROPHY_CATALOG) out.add(it.ItemID);
    return out;
  }

  /** Every trophy, grouped by its case (content order), the vault legends last. */
  export function trophyGroups(owned: ReadonlySet<string>): TrophyGroup[] {
    const groups: TrophyGroup[] = [];
    for (const t of TROPHIES) {
      const key = t.vault ? "vaults" : t.source;
      let g = groups.find((x) => x.source === key);
      if (!g) groups.push((g = { source: key, cells: [] }));
      g.cells.push({ id: t.id, owned: owned.has(t.id), rarity: t.rarity, vault: t.vault });
    }
    return groups;
  }

  export interface BoardEntry {
    UserID: string;
    Score?: number | null;
    Rank?: number | null;
    PublicProfile?: { Username?: string | null } | null;
  }

  export interface BoardRow {
    rank: number;
    userId: string;
    /** The player's name, or null (the screen shows the wallet or "Player"). */
    name: string | null;
    wallet: string | null;
    earnings: number;
    me: boolean;
  }

  export const shortAddress = (address: string): string => (address.length > 10 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address);

  export function boardRows(entries: readonly BoardEntry[], wallets: Readonly<Record<string, string>>, myId: string | null): BoardRow[] {
    return [...entries]
      .sort((a, b) => (a.Rank ?? Infinity) - (b.Rank ?? Infinity) || (b.Score ?? 0) - (a.Score ?? 0))
      .map((e, i) => ({
        rank: e.Rank ?? i + 1,
        userId: e.UserID,
        name: e.PublicProfile?.Username?.trim() || null,
        wallet: wallets[e.UserID] ?? null,
        earnings: earningsFromScore(e.Score ?? 0),
        me: e.UserID === myId,
      }));
  }
  ```

- [ ] **Step 4: Add the strings.** `i18n/en.ts`:
  ```ts
  "lobby.trophies": "Trophies",
  "lobby.board": "Leaders",
  "lobby.count": "{n} / {total} found",
  "lobby.locked": "Not found yet",
  "lobby.vaults": "Vaults",
  "lobby.best": "Best run",
  "lobby.you": "You",
  "lobby.player": "Player",
  "lobby.offline": "Can't reach the server. Try again later.",
  "lobby.empty": "No runs yet. Open a vault to get on the board.",
  "lobby.loading": "Loading…",
  ```
  `i18n/ru.ts`:
  ```ts
  "lobby.trophies": "Трофеи",
  "lobby.board": "Лидеры",
  "lobby.count": "Найдено {n} из {total}",
  "lobby.locked": "Ещё не найден",
  "lobby.vaults": "Сейфы",
  "lobby.best": "Лучший забег",
  "lobby.you": "Вы",
  "lobby.player": "Игрок",
  "lobby.offline": "Нет связи с сервером. Попробуйте позже.",
  "lobby.empty": "Пока пусто. Откройте сейф, чтобы попасть в таблицу.",
  "lobby.loading": "Загрузка…",
  ```
  `i18n/budgets.ts`: add `["lobby.", 40],` to `BY_PREFIX` (the lobby screens are DOM text in the host's kit, not the pixel font's narrow columns; the tab labels themselves are short).

- [ ] **Step 5: Write the screens.**
  `ui/lobby/TrophyCase.tsx`:
  ```tsx
  import { useUserState } from "@idosgames/react";
  import { useEffect, useMemo, useRef, type ReactNode } from "react";
  import type { FeatureScreenProps } from "@idosgames/module-sdk";
  import { renderSkinFrame } from "../../fx/skins/motion";
  import { caseName, skinName } from "../../i18n/content";
  import { t } from "../../i18n/index";
  import { TROPHIES } from "../../meta/trophies";
  import { ownedTrophyIds, trophyGroups } from "./lobbyRules";

  // The lobby's Trophy Case (plan F7): every Covert and ★ trophy, found ones in their colours, the rest as shadows.
  // The server inventory is the source (the Trophies catalog); the art is the game's own skin renderer.

  const SKINS = new Map(TROPHIES.map((x) => [x.id, x.skin]));

  function SkinArt({ id, owned }: { id: string; owned: boolean }): ReactNode {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
      const skin = SKINS.get(id);
      const c = ref.current;
      if (!skin || !c) return;
      const img = renderSkinFrame(skin, 0);
      c.width = img.w;
      c.height = img.h;
      const g = c.getContext("2d");
      if (!g) return;
      const data = g.createImageData(img.w, img.h);
      data.data.set(img.data);
      g.putImageData(data, 0, 0);
    }, [id]);
    return <canvas ref={ref} style={{ width: "100%", imageRendering: "pixelated", filter: owned ? "none" : "brightness(0) opacity(0.35)" }} />;
  }

  export function TrophyCase(_: FeatureScreenProps): ReactNode {
    const state = useUserState();
    const owned = useMemo(() => ownedTrophyIds(state?.InventoryV2?.UnstackableItems), [state]);
    const groups = useMemo(() => trophyGroups(owned), [owned]);
    return (
      <div style={{ padding: 16, display: "grid", gap: 16 }}>
        <div style={{ fontWeight: 700 }}>{t("lobby.count", { n: owned.size, total: TROPHIES.length })}</div>
        {groups.map((g) => (
          <section key={g.source}>
            <h3 style={{ margin: "0 0 8px" }}>{g.source === "vaults" ? t("lobby.vaults") : caseName(g.source)}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
              {g.cells.map((c) => (
                <figure key={c.id} title={c.owned ? skinName(c.id) : t("lobby.locked")} style={{ margin: 0, padding: 6, borderRadius: 6, border: `2px solid ${c.rarity === "gold" ? "#ffd34d" : "#eb4b4b"}`, opacity: c.owned ? 1 : 0.6 }}>
                  <SkinArt id={c.id} owned={c.owned} />
                  <figcaption style={{ fontSize: 11, textAlign: "center" }}>{c.owned ? skinName(c.id) : "?"}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }
  ```
  `ui/lobby/Leaderboard.tsx`:
  ```tsx
  import { useIDosGamesClient } from "@idosgames/react";
  import { useEffect, useState, type ReactNode } from "react";
  import type { FeatureScreenProps } from "@idosgames/module-sdk";
  import { getLang, t } from "../../i18n/index";
  import { LEADERBOARD_ID } from "../../meta/clientPort";
  import { formatCash } from "../../sim/format";
  import { boardRows, shortAddress, type BoardRow } from "./lobbyRules";

  // The lobby's Leaderboard (plan F7): best_run, whose score is floor(log10(lifetime earnings) × 1000), shown as
  // money again. Read once when the tab opens; a failed read says so and nothing else breaks.

  type Load = { kind: "loading" } | { kind: "offline" } | { kind: "ok"; rows: BoardRow[] };

  export function Leaderboard(_: FeatureScreenProps): ReactNode {
    const client = useIDosGamesClient();
    const [load, setLoad] = useState<Load>({ kind: "loading" });
    useEffect(() => {
      let live = true;
      void (async () => {
        const r = await client.leaderboard.getLeaderboard(LEADERBOARD_ID);
        if (!live) return;
        if (!r.ok) return setLoad({ kind: "offline" });
        const top = r.data.TopUsers ?? [];
        const wallets: Record<string, string> = {}; // plan F8 fills these from the Public key cc_wallet
        setLoad({ kind: "ok", rows: boardRows(top, wallets, client.auth.context?.userID ?? null) });
      })();
      return () => {
        live = false;
      };
    }, [client]);
    if (load.kind === "loading") return <p style={{ padding: 16 }}>{t("lobby.loading")}</p>;
    if (load.kind === "offline") return <p style={{ padding: 16 }}>{t("lobby.offline")}</p>;
    if (load.rows.length === 0) return <p style={{ padding: 16 }}>{t("lobby.empty")}</p>;
    return (
      <ol style={{ listStyle: "none", margin: 0, padding: 16, display: "grid", gap: 6 }}>
        {load.rows.map((r) => (
          <li key={r.userId} style={{ display: "grid", gridTemplateColumns: "3em 1fr auto", gap: 8, fontWeight: r.me ? 700 : 400 }}>
            <span>#{r.rank}</span>
            <span>
              {r.me ? `${t("lobby.you")} · ` : ""}
              {r.name ?? (r.wallet ? `◎ ${shortAddress(r.wallet)}` : t("lobby.player"))}
            </span>
            <span title={t("lobby.best")}>{formatCash(r.earnings, getLang())}</span>
          </li>
        ))}
      </ol>
    );
  }
  ```
  `ui/lobby/features.ts`:
  ```ts
  import type { FeatureRegistry } from "@idosgames/module-sdk";
  import { onLangChange, t } from "../../i18n/index";
  import { Leaderboard } from "./Leaderboard";
  import { TrophyCase } from "./TrophyCase";

  // The game's two lobby tabs (plan F7): registered again when the language changes, so their labels follow it.

  export function registerLobbyTabs(features: FeatureRegistry): () => void {
    let off: Array<() => void> = [];
    const register = (): void => {
      for (const f of off) f();
      off = [
        features.register({ id: "casecremental-trophies", label: t("lobby.trophies"), icon: "🏆", group: "profile", order: 10, primary: true, Screen: TrophyCase }),
        features.register({ id: "casecremental-leaders", label: t("lobby.board"), icon: "📈", group: "social", order: 10, primary: true, Screen: Leaderboard }),
      ];
    };
    register();
    const offLang = onLangChange(register);
    return () => {
      offLang();
      for (const f of off) f();
    };
  }
  ```
  In `module.ts`, after the route: `registerLobbyTabs(ctx.features);`. In `module.meta.json` `provides`, add `"a Trophy Case lobby tab (server inventory)"` and `"a best-run leaderboard lobby tab"`.
  `formatCash`'s signature is `(n, lang)`; `client.auth.context?.userID` is in `AuthenticationService` (`get context(): AuthContext | null`).

- [ ] **Step 6: Run everything.**
  Run: `npm run typecheck && npx vitest run src/modules/casecremental cloudcode && npm run build`
  Expected: PASS, including `i18n.test.ts` (same keys in both languages, budgets).

- [ ] **Step 7: Commit.**
  ```bash
  git add src/modules/casecremental/ui/lobby src/modules/casecremental/i18n src/modules/casecremental/module.ts src/modules/casecremental/module.meta.json
  git commit -m "feat(meta): Trophy Case and Leaderboard lobby tabs" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 7: Verify against DEV with a real signed-in session, then write it down

**Files:**
- Modify: `docs/feature-history/casecremental-finish.md` (an F7 section), `docs/feature-history/README.md` (extend the finish line's gist only)

- [ ] **Step 1: Run the game on DEV.** `npm run dev` (background, port 5180; `.env.local` has `VITE_IDOS_ENV=dev`). `nslookup api.idosgames.com` first if it hangs. Open `http://localhost:5180` in a new browser tab (browser tools loaded in one `ToolSearch` call; or headless Chrome through `.superpowers/harness/cdp.mjs`), sign in as a guest. Say in the report which browser path you used.

- [ ] **Step 2: Walk the meta.** With `__IDOS_AGENT__.modules.casecremental` (the game's agent surface: `devStartRun`, `devAddCash`, `buyVault`, `turnVaultKey`, `buyPerk`, `startNextRun`) and the dev global `idosClient`:
  1. `await idosClient.cloudCode.execute("loadMeta", {})` → a view; the HUD's CLOUT equals `view.clout` within ~5 s of load.
  2. Add cash, buy and open cases until a Covert or ★ drops (or `devStartRun` to a later run and add cash). Within ~5 s the Trophies tab (lobby) shows it found; `await idosClient.user.getUserState()` then the inventory holds it.
  3. Buy the vault and turn the key; after the blackout: CLOUT on the prestige screen equals the server's (`getVirtualCurrencyAmount("CLOUT")` after `getUserState`), the vault legend is in the inventory, `await idosClient.leaderboard.getMyProgress("best_run")` shows the run's score, and the Leaders tab lists you.
  4. Buy a perk; read `getMyUserCustomData()` → `ReadOnly.cc_meta` has the new level.
  5. **Offline:** block `api.idosgames.com` (DevTools → Network → request blocking, or CDP `Network.setBlockedURLs` through `cdp.mjs`). Buy a perk and open cases: play goes on; `localStorage["casecremental.serverQueue"]` holds the calls. Unblock; within ~30 s the queue empties and CLOUT/perks match the server.
  6. **New device:** remove only the game's keys from localStorage (`casecremental.save`, `casecremental.serverQueue`) — the SDK's session keys stay, so it is the same account — and reload. CLOUT, perks, loops and the vault trophies come back from the server.
  7. EN and RU: switch the language in ⚙; the two tab labels and screens follow.
  Write down what you saw for each, with any fix you had to make (and commit fixes as `fix(meta): …`).

- [ ] **Step 3: Feature history.** Add a section `## F7 — server meta (iDosGames)` to `docs/feature-history/casecremental-finish.md` with the decisions the code does not show:
  - The run stays client-side; the Title holds CLOUT (currency `CLOUT`), the trophies (catalog `Trophies`, ids = skin ids, generated from the content tables), perks/loops/stats/charm picks (ReadOnly `cc_meta`, written only by CloudCode), plausibility state (Internal `cc_anti`) and `best_run` (BestScore, score = floor(log10 × 1000)).
  - Server authority and offline: the local meta is a cache; CLOUT and perks follow the server only when no `endRun`/`buyPerk` is waiting in the queue; loops and stats only grow. The queue is FIFO, persisted in `casecremental.serverQueue`, retried with back-off and dropped after 12 tries.
  - The plausibility curve and how it was calibrated (the numbers you ended with), the time bound (`endedAt` minus the last run's end, first run ≤ 6 h), idempotent `endRun` (runId = seed) and `buyPerk` (level before).
  - What the probe found about `server.*` shapes, and whether `best_run` is moved by the server (`SERVER_SCORE`) or by the client's `submitScore` — if the client, say plainly that the board can be forged through the raw API while CLOUT cannot.
  - Stock lobby modules could not be installed (catalog offline, `src/modules.ts` platform-owned), so the tabs live in the game module.
  - The DEV seed was removed (list), what is still on live.
  In `README.md`, extend the finish line's gist with "F7: CLOUT, trophies and best_run on the Title, offline queue".

- [ ] **Step 4: Commit.**
  ```bash
  git add docs/feature-history/casecremental-finish.md docs/feature-history/README.md
  git commit -m "docs(meta): F7 server meta in the feature history" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 8: Promote the config to the live Title `ZVKC34TR` (explicit, last)

Only after Task 7 passed **and the user said go**. The live Title has things DEV does not: the protected crypto currency `Main` (FOMO, Solana) with `Main_IOU`, and a Blockchain section. Never drop or change them. Whether to remove the idle-rpg seed from live is the user's call (ask once; default: leave it — players never see it).

**Files:** none changed (the payloads are the committed `cloudcode/config/*.json`, `cloudcode/config/trophies.items.json` and `cloudcode/casecremental.bundle.js`).

- [ ] **Step 1: Snapshot live.** `get_currency`, `get_item`, `get_leaderboard`, `get_user_custom_data`, `get_cloud_code` on `ZVKC34TR`; keep the outputs in the scratchpad (not the repo) as the rollback.

- [ ] **Step 2: Write live, one section at a time, reading each back.**
  - `save_currency` (live): the live section **as read** (with `Main`, `Main_IOU`, and `GOLD`/`GEMS` unless the user approved their removal) plus `VirtualCurrencies.CLOUT` = `currency.clout.json`. Read back: `Main` unchanged.
  - `save_item` (live): the live section as read plus `Catalogs.Trophies` from `trophies.items.json`.
  - `save_leaderboard` (live): `{ "Definitions": { "best_run": <leaderboard.json> } }`.
  - `save_user_custom_data` (live): `userCustomData.json`.
  - `save_cloud_code` (live): `cloudcode.policy.json`; then `publish_cloud_code` (live) with the bundle text and the five handlers.
  - Only if the user approved: remove the seed from live in Task 2 Step 2's order.

- [ ] **Step 3: Smoke live.** Build for production isn't needed: run `npm run dev` with `VITE_IDOS_ENV=prod` set for this one run (PowerShell: `$env:VITE_IDOS_ENV="prod"; npm run dev`), sign in as a guest, and run `loadMeta` and one `endRun` with a throwaway runId as in Task 3 Step 7 — expect a view and `duplicate: true` on the repeat. Then stop the server; `.env.local` stays `dev`.

- [ ] **Step 4: Note it.** Add one line to the F7 section of `docs/feature-history/casecremental-finish.md`: "Promoted to ZVKC34TR on <date>; live seed: <kept | removed>." Commit:
  ```bash
  git add docs/feature-history/casecremental-finish.md
  git commit -m "docs(meta): server meta promoted to the live Title" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```
