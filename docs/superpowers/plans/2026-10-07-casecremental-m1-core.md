# Casecremental — Milestone 1 (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable first slice of Casecremental on iDosGames: buy a case, drag the key in, watch (or brake) a CS-style reel, drag the skin to the sell bin, buy upgrades, unlock cases 1–3 — with juice and intensity stages Sober → Buzzed.

**Architecture:** iDosGames host scaffold (sign-in + lobby) + one game module `src/modules/casecremental/`. A pure-TypeScript simulation (`sim/`) runs at a fixed 30 Hz inside a `GameController` (`game/`); a PixiJS v8 scene (`fx/`) renders it and a React overlay (`ui/`) draws the HUD and shop. All input — player, panel, agent — goes through `controller.act(action)`.

**Tech Stack:** TypeScript 5.9, React 19, Vite 8, PixiJS 8.22 + pixi-filters 6.1, Vitest 5, `@idosgames/*` runtime packages.

**Spec:** `docs/superpowers/specs/2026-10-07-casecremental-design.md` (this plan covers §3, §4, §5 cases 1–3, §6 Luck/Appraiser/Quick Hands/case unlocks, §8.4, §9.1 stages 1–2, §9.2, §10.2, §13 unit + pacing tests for this slice). Later milestones get their own plans.

## Global Constraints

- Title: `IDOS_TITLE_ID = "ZVKC34TR"`; local dev talks to the DEV copy via `.env.local` `VITE_IDOS_ENV=dev`. Build/upload tools need the live id `ZVKC34TR`, never `-DEV`.
- Exact versions: `@idosgames/core 0.21.2`, `@idosgames/module-sdk 0.10.0`, `@idosgames/react 0.4.4`, `@idosgames/app-shell 0.12.0`, `@idosgames/wallet 0.6.2`, `react`/`react-dom 19.2.7`, `pixi.js 8.22.0`, `pixi-filters 6.1.5`, `vitest 5.0.3` (dev).
- `sim/` and `game/` import nothing from the DOM, Pixi or React — they must run under plain Node in Vitest.
- The module imports only its own files and npm packages — never host files (`src/base/…`) or other modules.
- Every balance number lives in `sim/tuning.ts`. When the pacing test fails, change numbers there, not logic.
- All names are original parodies. No Valve/CS names, logos or real skin names.
- Tests are `*.test.ts` next to the code; `tsconfig.json` already excludes them from the platform typecheck. Run with `npx vitest run`.
- No game state in `localStorage` (persistence arrives in milestone 4).
- A canvas module must publish `ctx.exposeToAgent(...)` and must not use Pointer Lock.
- Git identity for this repo is already set (`erasyl120902@gmail.com`). Commit after every task; end each commit message with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5
  ```

## Review Focus

1. **Tab hidden mid-spin, then shown again** → the first frame's huge delta must not fast-forward or break the reel; the controller clamps a frame to 0.25 s (test in Task 9).
2. **Double clicks / repeated intents** (buy twice, key twice, sell twice, brake twice) → second call is refused with no double spend (tests in Task 6).
3. **Phone-sized screen (360×640) and resize** → reel, bench, key and sell bin stay on screen, above the shop panel, with a 16 px gutter (test in Task 10).
4. **Huge / odd numbers** (1e40, 0.004, NaN, Infinity, negatives) → cash text never shows `NaN` or `Infinity` (test in Task 2).
5. **Brake pressed too early, twice, or after reveal** → ignored, and the reel position never jumps backwards (tests in Tasks 6 and 10).

---

## File Structure

```
.env.local                      VITE_IDOS_ENV=dev (git-ignored)
.gitignore
package.json                    + test script, pixi, vitest
src/idos.title.ts               IDOS_TITLE_ID = "ZVKC34TR"
src/app.config.ts               start: "casecremental"
src/modules.ts                  registers casecrementalModule
IDOS.md                         installed-modules line
docs/feature-history/casecremental-core.md + README line
src/modules/casecremental/
  index.ts, module.ts, module.meta.json
  sim/
    types.ts        shared types (RarityId, SkinDef, CaseDef, Drop…)
    tuning.ts       every balance number
    rng.ts          seeded RNG (mulberry32)
    format.ts       formatCash
    rarity.ts       rarity table + luck-adjusted weights
    wear.ts         float → wear
    content/weapons.ts   weapon display names
    content/cases.ts     cases 1–3 with 13 skins each + price helpers
    roll.ts         rollDrop
    upgrades.ts     upgrade defs, costs, effects
    intensity.ts    heat, intensity level, stage with hysteresis
    run.ts          Run: the run state machine + events
    bot.ts          greedy pacing bot
  game/
    controller.ts   GameController: fixed-step loop, act(), events, view store
    view.ts         buildView: the UI view model
    agent.ts        exposeToAgent surface
  fx/
    layout.ts       computeLayout (pure)
    reel/strip.ts   buildStrip with near-miss (pure)
    reel/motion.ts  reelFraction with brake (pure)
    skins/noise.ts  value noise, fbm, voronoi (pure)
    skins/patterns.ts  10 pattern kinds → RGBA pixels (pure)
    skins/silhouettes.ts  8 weapon polygons (pure data)
    skins/skinTexture.ts  canvas → Pixi texture (DOM)
    juice/timeScale.ts  hit-stop + slow-mo (pure)
    juice/shake.ts      screen shake (pure)
    juice/particles.ts  sprite particle pool (Pixi)
    juice/coins.ts      flying coins + floating text (Pixi)
    juice/stageLook.ts  stage filters (Pixi)
    audio.ts            WebAudio synth sfx
    drag.ts             makeDraggable (Pixi)
    ReelView.ts, BenchView.ts, World.ts, GameScene.ts
  ui/
    useGameView.ts, GamePanel.tsx, Hud.tsx, Shop.tsx
```

---

### Task 1: Project scaffold

**Files:**
- Create: everything from the host scaffold at the repo root; `.gitignore`; `.env.local`
- Modify: `package.json`, `src/idos.title.ts`, `src/app.config.ts`

**Interfaces:**
- Produces: a building, typechecking Vite project; `npm run test` runs Vitest.

- [ ] **Step 1: Write the host scaffold into the repo**

The scaffold (34 files) was already unpacked to the session scratchpad. Copy it:

```bash
cp -r "/c/Users/rainbow/AppData/Local/Temp/claude/C--Users-rainbow-dev-hackatons-solanaidos/0a902acf-dbcb-4a43-993c-2a7065244813/scratchpad/scaffold/." /c/Users/rainbow/dev/hackatons/solanaidos/
```

If that folder no longer exists, call the MCP tool `mcp__idosgames-registry__get_host_scaffold` and write each entry of its `files` array to `<repo>/<path>` with its `content` verbatim (the output is large; it gets saved to a file — parse it with Python `json.loads` and write the files).

Check: `ls src/base/lobby/Lobby.tsx src/main.tsx IDOS.md` lists all three.

- [ ] **Step 2: Bind the Title**

In `src/idos.title.ts` change only this line:

```ts
export const IDOS_TITLE_ID = "ZVKC34TR";
```

- [ ] **Step 3: Start in the game**

Replace the `start: "game",` line in `src/app.config.ts` with:

```ts
  // Casecremental is a full-screen game: sign-in → straight into it; the lobby is one tap away.
  start: "casecremental",
```

- [ ] **Step 4: package.json — name, scripts, dependencies**

Set `"name": "casecremental"`, add `"test": "vitest run"` to `scripts`, then install:

```bash
npm install
npm install --save-exact pixi.js@8.22.0 pixi-filters@6.1.5
npm install --save-exact --save-dev vitest@5.0.3
```

- [ ] **Step 5: .gitignore and .env.local**

`.gitignore`:

```
node_modules/
dist/
.env.local
*.zip
```

`.env.local`:

```
VITE_IDOS_ENV=dev
```

- [ ] **Step 6: Verify the scaffold builds**

Run: `npm run typecheck && npm run build`
Expected: both succeed (the lobby builds with no modules).

Run: `npx vitest run --passWithNoTests`
Expected: exits 0, "No test files found".

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold iDosGames host for Casecremental

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 2: Sim foundations — types, tuning, RNG, formatting

**Files:**
- Create: `src/modules/casecremental/sim/types.ts`, `sim/tuning.ts`, `sim/rng.ts`, `sim/format.ts`
- Test: `sim/rng.test.ts`, `sim/format.test.ts`

(All paths below are relative to `src/modules/casecremental/` unless they start with `src/` or the repo root.)

**Interfaces:**
- Produces:
  - types `RarityId`, `WearId`, `WeaponId`, `PatternKind`, `PatternSpec`, `SkinDef`, `CaseDef`, `Drop`
  - `createRng(seed: number): Rng` with `next(): number` in [0,1), `int(min, maxExclusive)`, `pick<T>(items: readonly T[]): T`
  - `formatCash(n: number): string`
  - all constants in `tuning.ts` (names below are used by later tasks verbatim)

- [ ] **Step 1: Write `sim/types.ts`**

```ts
// Shared vocabulary of the simulation. Pure data — no DOM, Pixi or React anywhere under sim/.

export type RarityId = "milspec" | "restricted" | "classified" | "covert" | "gold";
export type WearId = "FN" | "MW" | "FT" | "WW" | "BS";
export type WeaponId =
  | "rifle"
  | "sniper"
  | "pistol"
  | "heavyPistol"
  | "smg"
  | "shotgun"
  | "mg"
  | "knife";
export type PatternKind =
  | "camo"
  | "digital"
  | "tiger"
  | "leaves"
  | "bark"
  | "moss"
  | "marble"
  | "granite"
  | "crystal"
  | "lava";

export interface PatternSpec {
  kind: PatternKind;
  /** '#rrggbb' colors, darkest first. */
  palette: readonly string[];
  /** Feature density: higher = smaller blobs. */
  scale: number;
  seed: number;
}

export interface SkinDef {
  id: string;
  /** Finish name, shown as "<weapon> | <name>". */
  name: string;
  weapon: WeaponId;
  rarity: RarityId;
  pattern: PatternSpec;
}

export interface CaseDef {
  id: string;
  name: string;
  theme: string;
  /** 1-based position in the case ladder. */
  tier: number;
  /** Case body color, '#rrggbb'. */
  color: string;
  skins: readonly SkinDef[];
}

export interface Drop {
  id: number;
  caseId: string;
  skinId: string;
  rarity: RarityId;
  float: number;
  wear: WearId;
  statTrak: boolean;
  /** Base value before sell multipliers (Appraiser, combo). */
  value: number;
}
```

- [ ] **Step 2: Write `sim/tuning.ts`**

```ts
import type { RarityId, WearId } from "./types";

// Every balance number of a run. sim/pacing.test.ts checks the result: when it fails, tune these
// numbers — never the logic.

export const START_CASH = 6;

/** Price and one-time unlock cost per case id, in ladder order. */
export const CASE_ECONOMY: Readonly<
  Record<string, { price: number; unlockCost: number }>
> = {
  bootcamp: { price: 2, unlockCost: 0 },
  wildwood: { price: 15, unlockCost: 60 },
  bedrock: { price: 150, unlockCost: 900 },
};

export const RARITY_BASE_WEIGHT: Readonly<Record<RarityId, number>> = {
  milspec: 79.92,
  restricted: 15.98,
  classified: 3.2,
  covert: 0.64,
  gold: 0.26,
};

/** A skin's base value as a multiple of its case's price. */
export const RARITY_VALUE_MULT: Readonly<Record<RarityId, number>> = {
  milspec: 0.55,
  restricted: 2.2,
  classified: 8,
  covert: 40,
  gold: 200,
};

/** Each Luck level multiplies the weight of every rarity above Mil-Spec by (1 + this). */
export const LUCK_PER_LEVEL = 0.15;

export const WEAR_TABLE: ReadonlyArray<{
  id: WearId;
  name: string;
  /** Exclusive upper bound of the float range. */
  maxFloat: number;
  mult: number;
}> = [
  { id: "FN", name: "Factory New", maxFloat: 0.07, mult: 1.5 },
  { id: "MW", name: "Minimal Wear", maxFloat: 0.15, mult: 1.2 },
  { id: "FT", name: "Field-Tested", maxFloat: 0.38, mult: 1 },
  { id: "WW", name: "Well-Worn", maxFloat: 0.45, mult: 0.85 },
  { id: "BS", name: "Battle-Scarred", maxFloat: Number.POSITIVE_INFINITY, mult: 0.7 },
];

export const STATTRAK_CHANCE = 0.1;
export const STATTRAK_MULT = 2;

export const SPIN_BASE_SECONDS = 6;
export const SPIN_MIN_SECONDS = 0.6;
/** Each Quick Hands level multiplies the spin duration by this. */
export const QUICK_HANDS_FACTOR = 0.8;
/** The brake works once this fraction of the full spin has passed. */
export const BRAKE_AFTER_FRACTION = 0.25;
/** How long the reel takes to stop once braked. */
export const BRAKE_SECONDS = 0.35;

export const APPRAISER_PER_LEVEL = 0.25;

export const UPGRADE_COSTS = {
  luck: { baseCost: 15, growth: 1.6, maxLevel: 25 },
  appraiser: { baseCost: 10, growth: 1.55, maxLevel: 25 },
  quickHands: { baseCost: 8, growth: 1.7, maxLevel: 10 },
} as const;

/** Sells closer together than this keep the combo going. */
export const COMBO_WINDOW_SECONDS = 4;
/** Sell multiplier per combo step: 1 + COMBO_STEP × min(combo, COMBO_CAP). */
export const COMBO_STEP = 0.02;
export const COMBO_CAP = 50;

/** Broke with an empty bench → a free first-tier case after this long. */
export const FREE_CASE_SECONDS = 10;

/** Heat = exponential moving average of reveals per second, with this time constant. */
export const HEAT_TAU_SECONDS = 10;
/** Intensity bonus per case tier above the first. */
export const TIER_HEAT_BONUS = 0.5;
/** Combo adds combo / this to intensity. */
export const COMBO_HEAT_DIVISOR = 25;
/** Intensity needed for stages 2, 3, 4, 5. */
export const STAGE_THRESHOLDS = [0.8, 3, 10, 40] as const;
/** A stage is kept until intensity falls below its threshold × this. */
export const STAGE_HYSTERESIS = 0.8;
```

- [ ] **Step 3: Write the failing tests**

`sim/rng.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("createRng", () => {
  it("is deterministic for a seed", () => {
    const a = createRng(123);
    const b = createRng(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("differs between seeds", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it("stays in [0, 1) and averages near 0.5", () => {
    const r = createRng(7);
    let sum = 0;
    for (let i = 0; i < 100_000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 100_000).toBeCloseTo(0.5, 2);
  });

  it("int covers [min, max) only", () => {
    const r = createRng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i++) seen.add(r.int(3, 7));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it("pick refuses an empty list", () => {
    expect(() => createRng(1).pick([])).toThrow(/empty/);
  });
});
```

`sim/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatCash } from "./format";

describe("formatCash", () => {
  it.each([
    [0, "$0.00"],
    [0.004, "$0.00"],
    [1.5, "$1.50"],
    [9.999, "$10.00"],
    [12.4, "$12"],
    [999, "$999"],
    [1_000, "$1.00K"],
    [12_345, "$12.3K"],
    [999_499, "$999K"],
    [1_500_000, "$1.50M"],
    [2.5e9, "$2.50B"],
    [7.25e12, "$7.25T"],
    [1e33, "$1.00Dc"],
    [1e36, "$1.00e36"],
    [-12.4, "-$12"],
  ])("formats %s as %s", (n, text) => {
    expect(formatCash(n)).toBe(text);
  });

  it.each([NaN, Infinity, -Infinity])("never prints %s", (n) => {
    const text = formatCash(n);
    expect(text).not.toMatch(/NaN|Infinity/);
  });
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim`
Expected: FAIL — cannot resolve `./rng` / `./format`.

- [ ] **Step 5: Write `sim/rng.ts`**

```ts
// Seeded RNG (mulberry32): the whole run is reproducible from one seed, which the tests and the
// pacing bot rely on.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [min, maxExclusive). */
  int(min: number, maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, maxExclusive) => min + Math.floor(next() * (maxExclusive - min)),
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("pick from an empty list");
      return items[Math.floor(next() * items.length)] as T;
    },
  };
}
```

- [ ] **Step 6: Write `sim/format.ts`**

```ts
// Money text for the HUD: two decimals under $10, whole dollars under $1000, then suffixes,
// then scientific notation. Never prints NaN or Infinity.

const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

export function formatCash(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? "$∞" : n < 0 ? "-$∞" : "$0.00";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a < 10) return `${sign}$${a.toFixed(2)}`;
  if (a < 1000) return `${sign}$${Math.round(a)}`;
  const group = Math.floor(Math.log10(a) / 3);
  if (group >= SUFFIXES.length) {
    const exp = Math.floor(Math.log10(a));
    return `${sign}$${(a / 10 ** exp).toFixed(2)}e${exp}`;
  }
  const scaled = a / 1000 ** group;
  const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  return `${sign}$${scaled.toFixed(digits)}${SUFFIXES[group]}`;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/modules/casecremental/sim`
Expected: PASS (all rng and format tests).

- [ ] **Step 8: Commit**

```bash
git add src/modules/casecremental/sim
git commit -m "feat(sim): types, tuning table, seeded RNG, cash formatting

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 3: Rarity, wear and the first three cases

**Files:**
- Create: `sim/rarity.ts`, `sim/wear.ts`, `sim/content/weapons.ts`, `sim/content/cases.ts`
- Test: `sim/rarity.test.ts`, `sim/content/cases.test.ts`

**Interfaces:**
- Consumes: `tuning.ts` constants, `types.ts`.
- Produces:
  - `RARITY_ORDER: readonly RarityId[]`, `RARITY_INFO: Record<RarityId, { name: string; color: number }>`
  - `rarityWeights(luckLevel: number): Record<RarityId, number>` (sums to 1)
  - `wearOf(float: number): { id: WearId; name: string; mult: number }`
  - `WEAPON_NAMES: Record<WeaponId, string>`
  - `CASES: readonly CaseDef[]`, `caseById(id): CaseDef`, `skinById(id): SkinDef`, `priceOf(caseId): number`, `unlockCostOf(caseId): number`, `skinDisplayName(skin): string`

- [ ] **Step 1: Write the failing tests**

`sim/rarity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RARITY_ORDER, rarityWeights } from "./rarity";
import { wearOf } from "./wear";

const sum = (w: Record<string, number>) =>
  Object.values(w).reduce((a, b) => a + b, 0);

describe("rarityWeights", () => {
  it("matches CS odds at luck 0", () => {
    const w = rarityWeights(0);
    expect(sum(w)).toBeCloseTo(1, 10);
    expect(w.milspec).toBeCloseTo(0.7992, 4);
    expect(w.gold).toBeCloseTo(0.0026, 4);
  });

  it("moves weight upward with luck", () => {
    const w0 = rarityWeights(0);
    const w5 = rarityWeights(5);
    expect(sum(w5)).toBeCloseTo(1, 10);
    expect(w5.milspec).toBeLessThan(w0.milspec);
    for (const r of RARITY_ORDER.slice(1)) expect(w5[r]).toBeGreaterThan(w0[r]);
  });
});

describe("wearOf", () => {
  it.each([
    [0, "FN"],
    [0.0699, "FN"],
    [0.07, "MW"],
    [0.2, "FT"],
    [0.4, "WW"],
    [0.45, "BS"],
    [0.999, "BS"],
  ])("float %s is %s", (f, id) => {
    expect(wearOf(f).id).toBe(id);
  });
});
```

`sim/content/cases.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CASES, caseById, priceOf, skinById, unlockCostOf } from "./cases";

describe("cases", () => {
  it("has the first three cases in ladder order", () => {
    expect(CASES.map((c) => c.id)).toEqual(["bootcamp", "wildwood", "bedrock"]);
    CASES.forEach((c, i) => expect(c.tier).toBe(i + 1));
  });

  it("gets pricier up the ladder", () => {
    for (let i = 1; i < CASES.length; i++) {
      expect(priceOf(CASES[i]!.id)).toBeGreaterThan(priceOf(CASES[i - 1]!.id));
      expect(unlockCostOf(CASES[i]!.id)).toBeGreaterThan(unlockCostOf(CASES[i - 1]!.id));
    }
  });

  it.each(CASES.map((c) => [c.id, c] as const))(
    "%s has 5 / 3 / 2 / 2 / 1 skins by rarity",
    (_id, c) => {
      const count = (r: string) => c.skins.filter((s) => s.rarity === r).length;
      expect([
        count("milspec"),
        count("restricted"),
        count("classified"),
        count("covert"),
        count("gold"),
      ]).toEqual([5, 3, 2, 2, 1]);
      expect(c.skins.find((s) => s.rarity === "gold")?.weapon).toBe("knife");
    },
  );

  it("uses globally unique skin ids and valid palettes", () => {
    const ids = CASES.flatMap((c) => c.skins.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CASES)
      for (const s of c.skins) {
        expect(s.pattern.palette.length).toBeGreaterThanOrEqual(2);
        for (const hex of s.pattern.palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      }
  });

  it("looks up by id and refuses unknown ids", () => {
    expect(caseById("wildwood").name).toBe("Wildwood Case");
    expect(skinById(CASES[0]!.skins[0]!.id)).toBe(CASES[0]!.skins[0]);
    expect(() => caseById("nope")).toThrow(/nope/);
    expect(() => priceOf("nope")).toThrow(/nope/);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim`
Expected: FAIL — cannot resolve `./rarity`, `./wear`, `./cases`.

- [ ] **Step 3: Write `sim/rarity.ts`**

```ts
import { LUCK_PER_LEVEL, RARITY_BASE_WEIGHT } from "./tuning";
import type { RarityId } from "./types";

export const RARITY_ORDER: readonly RarityId[] = [
  "milspec",
  "restricted",
  "classified",
  "covert",
  "gold",
];

export const RARITY_INFO: Readonly<Record<RarityId, { name: string; color: number }>> = {
  milspec: { name: "Mil-Spec", color: 0x4b69ff },
  restricted: { name: "Restricted", color: 0x8847ff },
  classified: { name: "Classified", color: 0xd32ce6 },
  covert: { name: "Covert", color: 0xeb4b4b },
  gold: { name: "★ Rare Special", color: 0xffd700 },
};

/** Normalized drop weights: Luck multiplies everything above Mil-Spec, then they sum to 1. */
export function rarityWeights(luckLevel: number): Record<RarityId, number> {
  const boost = 1 + LUCK_PER_LEVEL * Math.max(0, luckLevel);
  const raw = Object.fromEntries(
    RARITY_ORDER.map((r) => [r, RARITY_BASE_WEIGHT[r] * (r === "milspec" ? 1 : boost)]),
  ) as Record<RarityId, number>;
  const total = RARITY_ORDER.reduce((a, r) => a + raw[r], 0);
  for (const r of RARITY_ORDER) raw[r] /= total;
  return raw;
}
```

- [ ] **Step 4: Write `sim/wear.ts`**

```ts
import { WEAR_TABLE } from "./tuning";
import type { WearId } from "./types";

export function wearOf(float: number): { id: WearId; name: string; mult: number } {
  const row = WEAR_TABLE.find((w) => float < w.maxFloat) ?? WEAR_TABLE[WEAR_TABLE.length - 1]!;
  return { id: row.id, name: row.name, mult: row.mult };
}
```

- [ ] **Step 5: Write `sim/content/weapons.ts`**

```ts
import type { WeaponId } from "../types";

// Original parody weapon names — never real ones.
export const WEAPON_NAMES: Readonly<Record<WeaponId, string>> = {
  rifle: "AK-Pew",
  sniper: "Longshot",
  pistol: "Peashooter",
  heavyPistol: "Desert Hawk",
  smg: "Buzzsaw",
  shotgun: "Boomstick",
  mg: "Lawnmower",
  knife: "★ Hookblade",
};
```

- [ ] **Step 6: Write `sim/content/cases.ts`**

```ts
import { CASE_ECONOMY } from "../tuning";
import type { CaseDef, PatternSpec, RarityId, SkinDef, WeaponId } from "../types";
import { WEAPON_NAMES } from "./weapons";

// The case ladder. Each later case uses a richer pattern technique than the one before it, so its
// cheapest skins already outshine the previous case's best (spec §4.3, §5). Milestone 1: cases 1–3.

const skin = (
  id: string,
  name: string,
  weapon: WeaponId,
  rarity: RarityId,
  pattern: PatternSpec,
): SkinDef => ({ id, name, weapon, rarity, pattern });

const p = (
  kind: PatternSpec["kind"],
  palette: string[],
  scale: number,
  seed: number,
): PatternSpec => ({ kind, palette, scale, seed });

const bootcamp: CaseDef = {
  id: "bootcamp",
  name: "Boot Camp Case",
  theme: "army",
  tier: 1,
  color: "#4b5320",
  skins: [
    skin("bc_woodland", "Woodland Drill", "rifle", "milspec", p("camo", ["#2f3a1f", "#4b5320", "#6b7a3a", "#8a7f5a"], 4, 11)),
    skin("bc_desert", "Sandstorm", "pistol", "milspec", p("camo", ["#8b7355", "#b39b6b", "#d2c08f"], 3, 12)),
    skin("bc_urban", "Concrete Jungle", "smg", "milspec", p("camo", ["#3d3d3d", "#6e6e6e", "#a0a0a0"], 5, 13)),
    skin("bc_olive", "Olive Drab", "shotgun", "milspec", p("camo", ["#3b4a2a", "#55663a", "#2a2f1f"], 3, 14)),
    skin("bc_snow", "Whiteout", "mg", "milspec", p("camo", ["#c9d1d9", "#eef2f5", "#9aa5b1"], 4, 15)),
    skin("bc_digital", "Pixel Patrol", "rifle", "restricted", p("digital", ["#283618", "#606c38", "#a3b18a", "#dda15e"], 6, 21)),
    skin("bc_tiger", "Jungle Cat", "smg", "restricted", p("tiger", ["#d4a017", "#1b1b1b", "#8b5a00"], 3, 22)),
    skin("bc_navy", "Deep Ops", "heavyPistol", "restricted", p("digital", ["#0b1d3a", "#1f3b73", "#4a6fa5"], 7, 23)),
    skin("bc_redalert", "Red Alert", "sniper", "classified", p("tiger", ["#2b0000", "#b3001b", "#ff4d4d"], 4, 31)),
    skin("bc_hunter", "Blaze Hunter", "shotgun", "classified", p("digital", ["#1a1a1a", "#ff6a00", "#ffd000"], 8, 32)),
    skin("bc_commander", "Commander's Pride", "rifle", "covert", p("camo", ["#111111", "#c9a227", "#f2e394", "#4b5320"], 5, 41)),
    skin("bc_warlord", "Warlord", "sniper", "covert", p("tiger", ["#0d0d0d", "#e10600", "#f5f5f5"], 5, 42)),
    skin("bc_knife", "Field Marshal", "knife", "gold", p("digital", ["#3a2f0b", "#c9a227", "#ffe08a", "#fff6d5"], 9, 51)),
  ],
};

const wildwood: CaseDef = {
  id: "wildwood",
  name: "Wildwood Case",
  theme: "forest",
  tier: 2,
  color: "#2d5a27",
  skins: [
    skin("ww_fern", "Fernlight", "pistol", "milspec", p("leaves", ["#1b4332", "#2d6a4f", "#52b788"], 4, 111)),
    skin("ww_bark", "Old Bark", "rifle", "milspec", p("bark", ["#3e2723", "#5d4037", "#8d6e63"], 4, 112)),
    skin("ww_moss", "Mossback", "smg", "milspec", p("moss", ["#1e3d1a", "#4f772d", "#90a955"], 5, 113)),
    skin("ww_pine", "Pine Needle", "shotgun", "milspec", p("leaves", ["#0b2e1f", "#1a4d2e", "#4f6f52"], 6, 114)),
    skin("ww_birch", "Birchwood", "mg", "milspec", p("bark", ["#d8d3c4", "#f3efe0", "#2b2b2b"], 3, 115)),
    skin("ww_autumn", "Autumn Fall", "rifle", "restricted", p("leaves", ["#6a040f", "#d00000", "#f48c06", "#ffba08"], 5, 121)),
    skin("ww_lichen", "Lichen", "heavyPistol", "restricted", p("moss", ["#2f3e46", "#84a98c", "#cad2c5"], 7, 122)),
    skin("ww_redwood", "Redwood", "sniper", "restricted", p("bark", ["#4a1c0f", "#8c3b1e", "#c0582c"], 5, 123)),
    skin("ww_glade", "Emerald Glade", "smg", "classified", p("moss", ["#003d2e", "#00a86b", "#7fffd4"], 6, 131)),
    skin("ww_canopy", "Canopy", "shotgun", "classified", p("leaves", ["#081c15", "#2d6a4f", "#b7e4c7", "#fefae0"], 7, 132)),
    skin("ww_spirit", "Forest Spirit", "rifle", "covert", p("moss", ["#03045e", "#00b4d8", "#90e0ef", "#caf0f8"], 6, 141)),
    skin("ww_elder", "Elder Oak", "sniper", "covert", p("bark", ["#1a0f00", "#7f5539", "#ddb892", "#ffe8a3"], 6, 142)),
    skin("ww_knife", "Heartwood", "knife", "gold", p("leaves", ["#3d2b00", "#b8860b", "#ffd700", "#fff8dc"], 8, 151)),
  ],
};

const bedrock: CaseDef = {
  id: "bedrock",
  name: "Bedrock Case",
  theme: "rocks",
  tier: 3,
  color: "#5a5a66",
  skins: [
    skin("br_granite", "Granite", "rifle", "milspec", p("granite", ["#3c3c3c", "#6b6b6b", "#a9a9a9", "#d4d4d4"], 6, 211)),
    skin("br_slate", "Slate", "pistol", "milspec", p("marble", ["#2f3640", "#57606f", "#a4b0be"], 3, 212)),
    skin("br_sandstone", "Sandstone", "smg", "milspec", p("granite", ["#a0522d", "#cd853f", "#deb887"], 5, 213)),
    skin("br_basalt", "Basalt", "shotgun", "milspec", p("crystal", ["#121212", "#2b2b2b", "#444444"], 5, 214)),
    skin("br_quarry", "Quarry", "mg", "milspec", p("granite", ["#5c5346", "#8e8572", "#c2b8a3"], 4, 215)),
    skin("br_marble", "Carrara", "rifle", "restricted", p("marble", ["#e8e8e8", "#ffffff", "#7a7a7a"], 3, 221)),
    skin("br_amethyst", "Amethyst", "heavyPistol", "restricted", p("crystal", ["#2e1065", "#6d28d9", "#c4b5fd"], 6, 222)),
    skin("br_jade", "Jade", "sniper", "restricted", p("marble", ["#064e3b", "#10b981", "#d1fae5"], 4, 223)),
    skin("br_obsidian", "Obsidian Edge", "smg", "classified", p("crystal", ["#030303", "#1f1f2e", "#7c3aed"], 7, 231)),
    skin("br_sapphire", "Sapphire Vein", "shotgun", "classified", p("marble", ["#020617", "#1d4ed8", "#93c5fd"], 5, 232)),
    skin("br_magma", "Magma Core", "rifle", "covert", p("lava", ["#120400", "#3a0f00", "#ff4500", "#ffd000"], 5, 241)),
    skin("br_diamond", "Diamond Hands", "sniper", "covert", p("crystal", ["#0f172a", "#38bdf8", "#e0f2fe", "#ffffff"], 8, 242)),
    skin("br_knife", "Molten Crown", "knife", "gold", p("lava", ["#1a0a00", "#7a3b00", "#ffb000", "#fff3b0"], 6, 251)),
  ],
};

export const CASES: readonly CaseDef[] = [bootcamp, wildwood, bedrock];

const SKINS = new Map(CASES.flatMap((c) => c.skins.map((s) => [s.id, s] as const)));

export function caseById(id: string): CaseDef {
  const c = CASES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown case: ${id}`);
  return c;
}

export function skinById(id: string): SkinDef {
  const s = SKINS.get(id);
  if (!s) throw new Error(`unknown skin: ${id}`);
  return s;
}

function economy(caseId: string): { price: number; unlockCost: number } {
  const e = CASE_ECONOMY[caseId];
  if (!e) throw new Error(`no economy for case: ${caseId}`);
  return e;
}

export const priceOf = (caseId: string): number => economy(caseId).price;
export const unlockCostOf = (caseId: string): number => economy(caseId).unlockCost;

export const skinDisplayName = (s: SkinDef): string => `${WEAPON_NAMES[s.weapon]} | ${s.name}`;
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/modules/casecremental/sim`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/casecremental/sim
git commit -m "feat(sim): rarity odds, wear, cases 1-3 with 39 skins

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 4: Rolling a drop

**Files:**
- Create: `sim/roll.ts`
- Test: `sim/roll.test.ts`

**Interfaces:**
- Consumes: `rarityWeights`, `RARITY_ORDER`, `wearOf`, `CaseDef`, `Rng`, tuning `RARITY_VALUE_MULT`, `STATTRAK_CHANCE`, `STATTRAK_MULT`.
- Produces: `rollDrop(c: CaseDef, price: number, luckLevel: number, rng: Rng, id: number): Drop`; `pickRarity(weights: Record<RarityId, number>, roll: number): RarityId`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { caseById } from "./content/cases";
import { createRng } from "./rng";
import { pickRarity, rollDrop } from "./roll";
import { rarityWeights } from "./rarity";
import type { RarityId } from "./types";

const bootcamp = caseById("bootcamp");

function histogram(luck: number, n: number, seed = 1) {
  const rng = createRng(seed);
  const h: Record<RarityId, number> = { milspec: 0, restricted: 0, classified: 0, covert: 0, gold: 0 };
  for (let i = 0; i < n; i++) h[rollDrop(bootcamp, 2, luck, rng, i).rarity]++;
  return h;
}

describe("pickRarity", () => {
  it("maps the roll onto cumulative weights", () => {
    const w = rarityWeights(0);
    expect(pickRarity(w, 0)).toBe("milspec");
    expect(pickRarity(w, 0.79)).toBe("milspec");
    expect(pickRarity(w, 0.8)).toBe("restricted");
    expect(pickRarity(w, 0.9999)).toBe("gold");
  });
});

describe("rollDrop", () => {
  it("follows CS odds within tolerance over 200k rolls", () => {
    const n = 200_000;
    const h = histogram(0, n);
    expect(h.milspec / n).toBeCloseTo(0.7992, 2);
    expect(h.restricted / n).toBeCloseTo(0.1598, 2);
    expect(h.classified / n).toBeCloseTo(0.032, 2);
    expect(h.covert / n).toBeGreaterThan(0.0050);
    expect(h.covert / n).toBeLessThan(0.0078);
    expect(h.gold / n).toBeGreaterThan(0.0018);
    expect(h.gold / n).toBeLessThan(0.0034);
  });

  it("drops more coverts with luck", () => {
    expect(histogram(10, 100_000).covert).toBeGreaterThan(histogram(0, 100_000).covert * 1.5);
  });

  it("returns a skin of the rolled rarity from that case, with consistent value", () => {
    const rng = createRng(5);
    for (let i = 0; i < 2000; i++) {
      const d = rollDrop(bootcamp, 2, 0, rng, i);
      const s = bootcamp.skins.find((x) => x.id === d.skinId);
      expect(s?.rarity).toBe(d.rarity);
      expect(d.caseId).toBe("bootcamp");
      expect(d.id).toBe(i);
      expect(d.float).toBeGreaterThanOrEqual(0);
      expect(d.float).toBeLessThan(1);
      expect(d.value).toBeGreaterThan(0);
    }
  });

  it("is reproducible from the seed", () => {
    const a = rollDrop(bootcamp, 2, 3, createRng(77), 1);
    const b = rollDrop(bootcamp, 2, 3, createRng(77), 1);
    expect(a).toEqual(b);
  });

  it("StatTrak shows up about 10% of the time and doubles value", () => {
    const rng = createRng(3);
    let st = 0;
    for (let i = 0; i < 20_000; i++) if (rollDrop(bootcamp, 2, 0, rng, i).statTrak) st++;
    expect(st / 20_000).toBeCloseTo(0.1, 1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/casecremental/sim/roll.test.ts`
Expected: FAIL — cannot resolve `./roll`.

- [ ] **Step 3: Write `sim/roll.ts`**

```ts
import { RARITY_ORDER, rarityWeights } from "./rarity";
import type { Rng } from "./rng";
import { RARITY_VALUE_MULT, STATTRAK_CHANCE, STATTRAK_MULT } from "./tuning";
import type { CaseDef, Drop, RarityId } from "./types";
import { wearOf } from "./wear";

/** The rarity whose cumulative weight band contains `roll` (in [0, 1)). */
export function pickRarity(weights: Record<RarityId, number>, roll: number): RarityId {
  let acc = 0;
  for (const r of RARITY_ORDER) {
    acc += weights[r];
    if (roll < acc) return r;
  }
  return RARITY_ORDER[RARITY_ORDER.length - 1]!;
}

/** Rolls one case: rarity (luck-adjusted), skin, float/wear, StatTrak, base value. */
export function rollDrop(
  c: CaseDef,
  price: number,
  luckLevel: number,
  rng: Rng,
  id: number,
): Drop {
  const rarity = pickRarity(rarityWeights(luckLevel), rng.next());
  const skin = rng.pick(c.skins.filter((s) => s.rarity === rarity));
  const float = rng.next();
  const wear = wearOf(float);
  const statTrak = rng.next() < STATTRAK_CHANCE;
  const value = price * RARITY_VALUE_MULT[rarity] * wear.mult * (statTrak ? STATTRAK_MULT : 1);
  return { id, caseId: c.id, skinId: skin.id, rarity, float, wear: wear.id, statTrak, value };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/casecremental/sim/roll.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/sim
git commit -m "feat(sim): roll drops with luck, wear and StatTrak

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 5: Upgrades and intensity

**Files:**
- Create: `sim/upgrades.ts`, `sim/intensity.ts`
- Test: `sim/upgrades.test.ts`, `sim/intensity.test.ts`

**Interfaces:**
- Produces:
  - `type UpgradeId = "luck" | "appraiser" | "quickHands"`; `UPGRADE_IDS: readonly UpgradeId[]`
  - `UPGRADE_INFO: Record<UpgradeId, { name: string; description: string }>`
  - `upgradeCost(id: UpgradeId, level: number): number | null` (null at max level)
  - `interface Effects { luckLevel: number; sellMult: number; spinSeconds: number }`; `effectsOf(levels: Record<UpgradeId, number>): Effects`
  - `updateHeat(heat: number, reveals: number, dt: number): number`
  - `intensityLevel(heat: number, tier: number, combo: number): number`
  - `nextStage(current: number, level: number): number` (1–5)
  - `STAGE_NAMES: readonly string[]` (index 0 = stage 1)

- [ ] **Step 1: Write the failing tests**

`sim/upgrades.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { effectsOf, upgradeCost, UPGRADE_IDS } from "./upgrades";

const zero = { luck: 0, appraiser: 0, quickHands: 0 };

describe("upgradeCost", () => {
  it("grows geometrically from the base cost", () => {
    expect(upgradeCost("luck", 0)).toBe(15);
    expect(upgradeCost("luck", 1)).toBe(24);
    expect(upgradeCost("appraiser", 2)!).toBeGreaterThan(upgradeCost("appraiser", 1)!);
  });

  it("is null at max level", () => {
    expect(upgradeCost("quickHands", 10)).toBeNull();
  });

  it("covers every upgrade", () => {
    for (const id of UPGRADE_IDS) expect(upgradeCost(id, 0)).toBeGreaterThan(0);
  });
});

describe("effectsOf", () => {
  it("starts at the base values", () => {
    expect(effectsOf(zero)).toEqual({ luckLevel: 0, sellMult: 1, spinSeconds: 6 });
  });

  it("applies each upgrade", () => {
    const e = effectsOf({ luck: 3, appraiser: 2, quickHands: 1 });
    expect(e.luckLevel).toBe(3);
    expect(e.sellMult).toBeCloseTo(1.5);
    expect(e.spinSeconds).toBeCloseTo(4.8);
  });

  it("never spins faster than the minimum", () => {
    expect(effectsOf({ ...zero, quickHands: 10 }).spinSeconds).toBeGreaterThanOrEqual(0.6);
  });
});
```

`sim/intensity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { intensityLevel, nextStage, updateHeat } from "./intensity";

describe("updateHeat", () => {
  it("converges to the reveal rate", () => {
    let heat = 0;
    // one reveal every 2 s for 2 minutes, ticking at 30 Hz
    for (let t = 0; t < 3600; t++) heat = updateHeat(heat, t % 60 === 0 ? 1 : 0, 1 / 30);
    expect(heat).toBeGreaterThan(0.4);
    expect(heat).toBeLessThan(0.6);
  });

  it("decays without reveals and ignores dt <= 0", () => {
    expect(updateHeat(1, 0, 10)).toBeLessThan(0.5);
    expect(updateHeat(1, 5, 0)).toBe(1);
  });
});

describe("intensityLevel", () => {
  it("rises with heat, tier and combo", () => {
    expect(intensityLevel(1, 2, 0)).toBeGreaterThan(intensityLevel(1, 1, 0));
    expect(intensityLevel(1, 1, 25)).toBeCloseTo(2);
  });
});

describe("nextStage", () => {
  it("climbs to the highest reached threshold", () => {
    expect(nextStage(1, 0)).toBe(1);
    expect(nextStage(1, 0.8)).toBe(2);
    expect(nextStage(1, 12)).toBe(4);
    expect(nextStage(1, 1000)).toBe(5);
  });

  it("holds a stage until intensity falls 20% under its threshold", () => {
    expect(nextStage(2, 0.7)).toBe(2);
    expect(nextStage(2, 0.63)).toBe(1);
    expect(nextStage(3, 2.5)).toBe(3);
    expect(nextStage(3, 2)).toBe(2);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim`
Expected: FAIL — cannot resolve `./upgrades`, `./intensity`.

- [ ] **Step 3: Write `sim/upgrades.ts`**

```ts
import {
  APPRAISER_PER_LEVEL,
  QUICK_HANDS_FACTOR,
  SPIN_BASE_SECONDS,
  SPIN_MIN_SECONDS,
  UPGRADE_COSTS,
} from "./tuning";

export type UpgradeId = keyof typeof UPGRADE_COSTS;
export const UPGRADE_IDS: readonly UpgradeId[] = ["luck", "appraiser", "quickHands"];

export const UPGRADE_INFO: Readonly<Record<UpgradeId, { name: string; description: string }>> = {
  luck: { name: "Luck", description: "Better rarities drop more often" },
  appraiser: { name: "Appraiser", description: "+25% sell value per level" },
  quickHands: { name: "Quick Hands", description: "The reel spins faster" },
};

/** Price of the next level, or null when maxed. */
export function upgradeCost(id: UpgradeId, level: number): number | null {
  const c = UPGRADE_COSTS[id];
  if (level >= c.maxLevel) return null;
  return Math.ceil(c.baseCost * c.growth ** level);
}

export interface Effects {
  luckLevel: number;
  sellMult: number;
  spinSeconds: number;
}

export function effectsOf(levels: Record<UpgradeId, number>): Effects {
  return {
    luckLevel: levels.luck,
    sellMult: 1 + APPRAISER_PER_LEVEL * levels.appraiser,
    spinSeconds: Math.max(SPIN_MIN_SECONDS, SPIN_BASE_SECONDS * QUICK_HANDS_FACTOR ** levels.quickHands),
  };
}
```

- [ ] **Step 4: Write `sim/intensity.ts`**

```ts
import {
  COMBO_HEAT_DIVISOR,
  HEAT_TAU_SECONDS,
  STAGE_HYSTERESIS,
  STAGE_THRESHOLDS,
  TIER_HEAT_BONUS,
} from "./tuning";

// Intensity drives the escalation from "Sober" to "Cyberpsychosis" (spec §9.1).

export const STAGE_NAMES: readonly string[] = [
  "Sober",
  "Buzzed",
  "High",
  "Tripping",
  "Cyberpsychosis",
];

/** Exponential moving average of reveals per second. */
export function updateHeat(heat: number, reveals: number, dt: number): number {
  if (dt <= 0) return heat;
  const alpha = 1 - Math.exp(-dt / HEAT_TAU_SECONDS);
  return heat + alpha * (reveals / dt - heat);
}

export function intensityLevel(heat: number, tier: number, combo: number): number {
  return heat * (1 + TIER_HEAT_BONUS * (tier - 1)) + combo / COMBO_HEAT_DIVISOR;
}

/** Stage 1–5 for this intensity; going down needs a 20% margin so stages don't flicker. */
export function nextStage(current: number, level: number): number {
  let reached = 1;
  STAGE_THRESHOLDS.forEach((t, i) => {
    if (level >= t) reached = i + 2;
  });
  if (reached >= current) return reached;
  const keep = STAGE_THRESHOLDS[current - 2]! * STAGE_HYSTERESIS;
  return level >= keep ? current : reached;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/modules/casecremental/sim`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/casecremental/sim
git commit -m "feat(sim): upgrades with cost curves, heat and intensity stages

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 6: The run state machine

**Files:**
- Create: `sim/run.ts`
- Test: `sim/run.test.ts`

**Interfaces:**
- Consumes: `CASES`, `caseById`, `priceOf`, `unlockCostOf`, `rollDrop`, `createRng`, `effectsOf`, `upgradeCost`, `UpgradeId`, `updateHeat`, `intensityLevel`, `nextStage`, tuning constants.
- Produces:
  - `type Bench` = `{ phase: "empty" }` | `{ phase: "locked"; caseId; free }` | `{ phase: "spinning"; caseId; drop; elapsed; fullDuration; endsAt; brakedAt: number | null }` | `{ phase: "revealed"; caseId; drop }`
  - `type SimEvent` (union below), `type ActionResult = { ok: true } | { ok: false; reason: string }`
  - `interface RunState` (fields below), `class Run` with `state`, `drainEvents()`, `effects()`, `comboMultiplier()`, `intensity()`, `canBrake()`, `buyCase(caseId)`, `insertKey()`, `brake()`, `sell()`, `unlockCase(caseId)`, `buyUpgrade(id)`, `tick(dt)`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { priceOf } from "./content/cases";
import { Run, type SimEvent } from "./run";
import { BRAKE_SECONDS, FREE_CASE_SECONDS, START_CASH } from "./tuning";

const DT = 1 / 30;
function tickFor(run: Run, seconds: number) {
  for (let t = 0; t < seconds; t += DT) run.tick(DT);
}
function revealOne(run: Run, caseId = "bootcamp") {
  expect(run.buyCase(caseId).ok).toBe(true);
  expect(run.insertKey().ok).toBe(true);
  tickFor(run, 6.1);
  const b = run.state.bench;
  if (b.phase !== "revealed") throw new Error(`expected revealed, got ${b.phase}`);
  return b.drop;
}
const types = (events: SimEvent[]) => events.map((e) => e.type);

describe("Run", () => {
  it("starts with cash, the first case unlocked and an empty bench", () => {
    const run = new Run(1);
    expect(run.state.cash).toBe(START_CASH);
    expect(run.state.unlocked).toEqual(["bootcamp"]);
    expect(run.state.bench.phase).toBe("empty");
  });

  it("buys a case once — a second buy on a busy bench is refused", () => {
    const run = new Run(1);
    expect(run.buyCase("bootcamp")).toEqual({ ok: true });
    expect(run.buyCase("bootcamp")).toEqual({ ok: false, reason: "bench is busy" });
    expect(run.state.cash).toBe(START_CASH - priceOf("bootcamp"));
    expect(run.state.bench).toEqual({ phase: "locked", caseId: "bootcamp", free: false });
  });

  it("refuses locked cases and empty wallets", () => {
    const run = new Run(1);
    expect(run.buyCase("wildwood").ok).toBe(false);
    run.state.cash = 0;
    expect(run.buyCase("bootcamp")).toEqual({ ok: false, reason: "not enough cash" });
  });

  it("insertKey rolls the drop and spins; a second key is refused", () => {
    const run = new Run(1);
    expect(run.insertKey().ok).toBe(false);
    run.buyCase("bootcamp");
    expect(run.insertKey().ok).toBe(true);
    expect(run.insertKey().ok).toBe(false);
    const b = run.state.bench;
    expect(b.phase).toBe("spinning");
    if (b.phase === "spinning") {
      expect(b.fullDuration).toBe(6);
      expect(b.drop.caseId).toBe("bootcamp");
    }
  });

  it("reveals after the full spin", () => {
    const run = new Run(1);
    run.buyCase("bootcamp");
    run.insertKey();
    tickFor(run, 5.9);
    expect(run.state.bench.phase).toBe("spinning");
    tickFor(run, 0.2);
    expect(run.state.bench.phase).toBe("revealed");
    expect(types(run.drainEvents())).toEqual(["caseBought", "spinStarted", "revealed"]);
  });

  it("brakes only after 25% of the spin, once, and stops BRAKE_SECONDS later", () => {
    const run = new Run(1);
    run.buyCase("bootcamp");
    run.insertKey();
    tickFor(run, 1);
    expect(run.canBrake()).toBe(false);
    expect(run.brake()).toEqual({ ok: false, reason: "too early to brake" });
    tickFor(run, 0.6);
    expect(run.canBrake()).toBe(true);
    expect(run.brake().ok).toBe(true);
    expect(run.brake()).toEqual({ ok: false, reason: "already braking" });
    tickFor(run, BRAKE_SECONDS + 0.05);
    expect(run.state.bench.phase).toBe("revealed");
    expect(run.brake()).toEqual({ ok: false, reason: "nothing is spinning" });
  });

  it("sells once, paying value × appraiser × combo", () => {
    const run = new Run(2);
    const drop = revealOne(run);
    const before = run.state.cash;
    expect(run.sell().ok).toBe(true);
    expect(run.sell()).toEqual({ ok: false, reason: "nothing to sell" });
    expect(run.state.combo).toBe(1);
    expect(run.state.cash - before).toBeCloseTo(drop.value * 1.02, 6);
    expect(run.state.lifetimeEarnings).toBeCloseTo(drop.value * 1.02, 6);
  });

  it("grows the combo for quick sells and drops it after the window", () => {
    const run = new Run(3);
    run.state.cash = 1000;
    for (let i = 0; i < 3; i++) {
      run.buyCase("bootcamp");
      run.insertKey();
      tickFor(run, 1.6);
      run.brake();
      tickFor(run, 0.4);
      run.sell();
    }
    expect(run.state.combo).toBe(3);
    tickFor(run, 4.5);
    expect(run.state.combo).toBe(0);
  });

  it("unlocks cases in ladder order, once", () => {
    const run = new Run(1);
    run.state.cash = 10_000;
    expect(run.unlockCase("bedrock")).toEqual({ ok: false, reason: "unlock the previous case first" });
    expect(run.unlockCase("wildwood").ok).toBe(true);
    expect(run.unlockCase("wildwood")).toEqual({ ok: false, reason: "already unlocked" });
    expect(run.unlockCase("bedrock").ok).toBe(true);
    expect(run.unlockCase("nope").ok).toBe(false);
    expect(run.state.unlocked).toEqual(["bootcamp", "wildwood", "bedrock"]);
  });

  it("buys upgrade levels until max", () => {
    const run = new Run(1);
    run.state.cash = 1e9;
    for (let i = 0; i < 10; i++) expect(run.buyUpgrade("quickHands").ok).toBe(true);
    expect(run.buyUpgrade("quickHands")).toEqual({ ok: false, reason: "max level" });
    expect(run.state.upgrades.quickHands).toBe(10);
    expect(run.effects().spinSeconds).toBeLessThan(1);
  });

  it("gives a free case when broke with an empty bench", () => {
    const run = new Run(1);
    run.state.cash = 0;
    tickFor(run, FREE_CASE_SECONDS - 0.5);
    expect(run.state.bench.phase).toBe("empty");
    tickFor(run, 1);
    expect(run.state.bench).toEqual({ phase: "locked", caseId: "bootcamp", free: true });
  });

  it("does not give free cases to a player who can pay", () => {
    const run = new Run(1);
    tickFor(run, FREE_CASE_SECONDS * 2);
    expect(run.state.bench.phase).toBe("empty");
  });

  it("climbs to stage 2 with fast, combo-heavy play", () => {
    const run = new Run(4);
    run.state.cash = 1e6;
    const seen: SimEvent[] = [];
    for (let i = 0; i < 25; i++) {
      run.buyCase("bootcamp");
      run.insertKey();
      tickFor(run, 1.6);
      run.brake();
      tickFor(run, 0.4);
      run.sell();
      seen.push(...run.drainEvents());
    }
    expect(run.state.stage).toBeGreaterThanOrEqual(2);
    expect(seen.some((e) => e.type === "stageChanged" && e.stage === 2)).toBe(true);
  });

  it("is reproducible from the seed", () => {
    const a = new Run(99);
    const b = new Run(99);
    expect(revealOne(a)).toEqual(revealOne(b));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/casecremental/sim/run.test.ts`
Expected: FAIL — cannot resolve `./run`.

- [ ] **Step 3: Write `sim/run.ts`**

```ts
import { CASES, caseById, priceOf, unlockCostOf } from "./content/cases";
import { intensityLevel, nextStage, updateHeat } from "./intensity";
import { createRng, type Rng } from "./rng";
import { rollDrop } from "./roll";
import {
  BRAKE_AFTER_FRACTION,
  BRAKE_SECONDS,
  COMBO_CAP,
  COMBO_STEP,
  COMBO_WINDOW_SECONDS,
  FREE_CASE_SECONDS,
  START_CASH,
} from "./tuning";
import type { Drop } from "./types";
import { effectsOf, upgradeCost, type Effects, type UpgradeId } from "./upgrades";

// One run of the game: cash, the bench (where a case is bought → keyed → spun → revealed → sold),
// upgrades, combo and intensity. Pure and deterministic from its seed; the renderer and the UI read
// `state` and consume `drainEvents()`. Milestone 1 has one bench; later milestones add more.

export type Bench =
  | { phase: "empty" }
  | { phase: "locked"; caseId: string; free: boolean }
  | {
      phase: "spinning";
      caseId: string;
      drop: Drop;
      elapsed: number;
      fullDuration: number;
      /** When the reel stops: fullDuration, or sooner once braked. */
      endsAt: number;
      brakedAt: number | null;
    }
  | { phase: "revealed"; caseId: string; drop: Drop };

export type SimEvent =
  | { type: "caseBought"; caseId: string; free: boolean }
  | { type: "spinStarted"; caseId: string; drop: Drop; fullDuration: number }
  | { type: "braked"; at: number; endsAt: number }
  | { type: "revealed"; drop: Drop }
  | { type: "sold"; drop: Drop; amount: number; combo: number }
  | { type: "caseUnlocked"; caseId: string }
  | { type: "upgradeBought"; id: UpgradeId; level: number }
  | { type: "stageChanged"; stage: number };

export type ActionResult = { ok: true } | { ok: false; reason: string };

export interface RunState {
  time: number;
  cash: number;
  lifetimeEarnings: number;
  unlocked: string[];
  upgrades: Record<UpgradeId, number>;
  bench: Bench;
  combo: number;
  lastSellAt: number;
  freeCaseTimer: number;
  heat: number;
  lastTier: number;
  stage: number;
  nextDropId: number;
  opened: number;
}

const OK: ActionResult = { ok: true };
const fail = (reason: string): ActionResult => ({ ok: false, reason });

export class Run {
  readonly state: RunState;
  private readonly rng: Rng;
  private events: SimEvent[] = [];
  private revealsThisTick = 0;

  constructor(seed: number) {
    this.rng = createRng(seed);
    this.state = {
      time: 0,
      cash: START_CASH,
      lifetimeEarnings: 0,
      unlocked: [CASES[0]!.id],
      upgrades: { luck: 0, appraiser: 0, quickHands: 0 },
      bench: { phase: "empty" },
      combo: 0,
      lastSellAt: -1e9,
      freeCaseTimer: 0,
      heat: 0,
      lastTier: 1,
      stage: 1,
      nextDropId: 1,
      opened: 0,
    };
  }

  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  effects(): Effects {
    return effectsOf(this.state.upgrades);
  }

  comboMultiplier(): number {
    return 1 + COMBO_STEP * Math.min(this.state.combo, COMBO_CAP);
  }

  intensity(): number {
    return intensityLevel(this.state.heat, this.state.lastTier, this.state.combo);
  }

  canBrake(): boolean {
    const b = this.state.bench;
    return (
      b.phase === "spinning" &&
      b.brakedAt === null &&
      b.elapsed >= b.fullDuration * BRAKE_AFTER_FRACTION
    );
  }

  buyCase(caseId: string): ActionResult {
    const s = this.state;
    if (s.bench.phase !== "empty") return fail("bench is busy");
    if (!s.unlocked.includes(caseId)) return fail(`case ${caseId} is locked`);
    const price = priceOf(caseId);
    if (s.cash < price) return fail("not enough cash");
    s.cash -= price;
    s.bench = { phase: "locked", caseId, free: false };
    s.freeCaseTimer = 0;
    this.events.push({ type: "caseBought", caseId, free: false });
    return OK;
  }

  insertKey(): ActionResult {
    const s = this.state;
    const b = s.bench;
    if (b.phase !== "locked") return fail("no locked case on the bench");
    const c = caseById(b.caseId);
    const fx = this.effects();
    const drop = rollDrop(c, priceOf(c.id), fx.luckLevel, this.rng, s.nextDropId++);
    s.bench = {
      phase: "spinning",
      caseId: c.id,
      drop,
      elapsed: 0,
      fullDuration: fx.spinSeconds,
      endsAt: fx.spinSeconds,
      brakedAt: null,
    };
    s.lastTier = c.tier;
    s.opened++;
    this.events.push({ type: "spinStarted", caseId: c.id, drop, fullDuration: fx.spinSeconds });
    return OK;
  }

  brake(): ActionResult {
    const b = this.state.bench;
    if (b.phase !== "spinning") return fail("nothing is spinning");
    if (b.brakedAt !== null) return fail("already braking");
    if (b.elapsed < b.fullDuration * BRAKE_AFTER_FRACTION) return fail("too early to brake");
    b.brakedAt = b.elapsed;
    b.endsAt = Math.min(b.endsAt, b.elapsed + BRAKE_SECONDS);
    this.events.push({ type: "braked", at: b.elapsed, endsAt: b.endsAt });
    return OK;
  }

  sell(): ActionResult {
    const s = this.state;
    const b = s.bench;
    if (b.phase !== "revealed") return fail("nothing to sell");
    s.combo = s.time - s.lastSellAt <= COMBO_WINDOW_SECONDS ? s.combo + 1 : 1;
    s.lastSellAt = s.time;
    const amount = b.drop.value * this.effects().sellMult * this.comboMultiplier();
    s.cash += amount;
    s.lifetimeEarnings += amount;
    s.bench = { phase: "empty" };
    this.events.push({ type: "sold", drop: b.drop, amount, combo: s.combo });
    return OK;
  }

  unlockCase(caseId: string): ActionResult {
    const s = this.state;
    const index = CASES.findIndex((c) => c.id === caseId);
    if (index < 0) return fail(`unknown case: ${caseId}`);
    if (s.unlocked.includes(caseId)) return fail("already unlocked");
    if (!s.unlocked.includes(CASES[index - 1]!.id)) return fail("unlock the previous case first");
    const cost = unlockCostOf(caseId);
    if (s.cash < cost) return fail("not enough cash");
    s.cash -= cost;
    s.unlocked.push(caseId);
    this.events.push({ type: "caseUnlocked", caseId });
    return OK;
  }

  buyUpgrade(id: UpgradeId): ActionResult {
    const s = this.state;
    const cost = upgradeCost(id, s.upgrades[id]);
    if (cost === null) return fail("max level");
    if (s.cash < cost) return fail("not enough cash");
    s.cash -= cost;
    s.upgrades[id] += 1;
    this.events.push({ type: "upgradeBought", id, level: s.upgrades[id] });
    return OK;
  }

  tick(dt: number): void {
    const s = this.state;
    s.time += dt;

    const b = s.bench;
    if (b.phase === "spinning") {
      b.elapsed += dt;
      if (b.elapsed >= b.endsAt) {
        s.bench = { phase: "revealed", caseId: b.caseId, drop: b.drop };
        this.revealsThisTick++;
        this.events.push({ type: "revealed", drop: b.drop });
      }
    }

    if (s.combo > 0 && s.time - s.lastSellAt > COMBO_WINDOW_SECONDS) s.combo = 0;

    // Anti-softlock: broke with nothing on the bench → a free first-tier case.
    const cheapest = Math.min(...s.unlocked.map(priceOf));
    if (s.bench.phase === "empty" && s.cash < cheapest) {
      s.freeCaseTimer += dt;
      if (s.freeCaseTimer >= FREE_CASE_SECONDS) {
        s.freeCaseTimer = 0;
        const caseId = CASES[0]!.id;
        s.bench = { phase: "locked", caseId, free: true };
        this.events.push({ type: "caseBought", caseId, free: true });
      }
    } else {
      s.freeCaseTimer = 0;
    }

    s.heat = updateHeat(s.heat, this.revealsThisTick, dt);
    this.revealsThisTick = 0;
    const stage = nextStage(s.stage, this.intensity());
    if (stage !== s.stage) {
      s.stage = stage;
      this.events.push({ type: "stageChanged", stage });
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/casecremental/sim/run.test.ts`
Expected: PASS. If "climbs to stage 2" fails, the run is too calm for its thresholds: lower `STAGE_THRESHOLDS[0]` or `COMBO_HEAT_DIVISOR` in `tuning.ts` until it passes, then re-run the whole `sim` folder (update the literal thresholds in `intensity.test.ts` to match).

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/sim
git commit -m "feat(sim): run state machine - buy, key, spin, brake, reveal, sell

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 7: Greedy pacing bot and the pacing test

**Files:**
- Create: `sim/bot.ts`
- Test: `sim/pacing.test.ts`

**Interfaces:**
- Consumes: `Run`, `CASES`, `priceOf`, `unlockCostOf`, `UPGRADE_IDS`, `upgradeCost`, `BRAKE_AFTER_FRACTION`.
- Produces: `interface BotTimings { buy; key; brakeReaction; sell }`, `HUMAN: BotTimings`, `interface PacingReport { caseUnlockedAt: Record<string, number>; stageReachedAt: Record<number, number>; finalCash: number }`, `playGreedy(seed: number, seconds: number, timings?: BotTimings): PacingReport`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { playGreedy } from "./bot";

// Spec §9.6 targets for milestone 1's slice (cases 1–3). Median of five seeds so one lucky knife
// doesn't decide the result. When this fails, tune sim/tuning.ts — never the bot or the logic.

const SEEDS = [1, 2, 3, 4, 5];
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

describe("pacing (greedy bot, human-speed actions)", () => {
  const reports = SEEDS.map((s) => playGreedy(s, 600));
  const at = (pick: (r: (typeof reports)[number]) => number | undefined) =>
    median(reports.map((r) => pick(r) ?? Number.POSITIVE_INFINITY));

  it("unlocks Wildwood in about 1–2.5 minutes", () => {
    const t = at((r) => r.caseUnlockedAt.wildwood);
    expect(t).toBeGreaterThan(45);
    expect(t).toBeLessThan(150);
  });

  it("unlocks Bedrock in about 2.5–6.5 minutes", () => {
    const t = at((r) => r.caseUnlockedAt.bedrock);
    expect(t).toBeGreaterThan(150);
    expect(t).toBeLessThan(400);
  });

  it("reaches stage 2 (Buzzed) within 20 s – 2 min", () => {
    const t = at((r) => r.stageReachedAt[2]);
    expect(t).toBeGreaterThan(20);
    expect(t).toBeLessThan(120);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/casecremental/sim/pacing.test.ts`
Expected: FAIL — cannot resolve `./bot`.

- [ ] **Step 3: Write `sim/bot.ts`**

```ts
import { CASES, priceOf, unlockCostOf } from "./content/cases";
import { Run } from "./run";
import { BRAKE_AFTER_FRACTION } from "./tuning";
import { UPGRADE_IDS, upgradeCost, type UpgradeId } from "./upgrades";

// A greedy player at human speed, used by the pacing test to check how fast a run unfolds.
// It brakes every spin, sells everything, unlocks the next case as soon as it can afford it plus
// one case, and buys the cheapest upgrade when it costs at most a quarter of its cash.

export interface BotTimings {
  buy: number;
  key: number;
  brakeReaction: number;
  sell: number;
}

export const HUMAN: BotTimings = { buy: 0.3, key: 0.4, brakeReaction: 0.15, sell: 0.5 };

export interface PacingReport {
  caseUnlockedAt: Record<string, number>;
  stageReachedAt: Record<number, number>;
  finalCash: number;
}

const DT = 1 / 30;

export function playGreedy(seed: number, seconds: number, timings: BotTimings = HUMAN): PacingReport {
  const run = new Run(seed);
  const report: PacingReport = { caseUnlockedAt: {}, stageReachedAt: {}, finalCash: 0 };
  let busyUntil = 0;

  while (run.state.time < seconds) {
    run.tick(DT);
    for (const e of run.drainEvents()) {
      if (e.type === "caseUnlocked") report.caseUnlockedAt[e.caseId] ??= run.state.time;
      if (e.type === "stageChanged") report.stageReachedAt[e.stage] ??= run.state.time;
    }
    const s = run.state;
    if (s.time < busyUntil) continue;
    const b = s.bench;

    if (b.phase === "revealed") {
      run.sell();
      busyUntil = s.time + timings.sell;
    } else if (b.phase === "locked") {
      run.insertKey();
      busyUntil = s.time + timings.key;
    } else if (b.phase === "spinning") {
      if (b.elapsed >= b.fullDuration * BRAKE_AFTER_FRACTION + timings.brakeReaction) run.brake();
    } else {
      spend(run);
      const target = [...s.unlocked].reverse().find((id) => priceOf(id) <= s.cash);
      if (target && run.buyCase(target).ok) busyUntil = s.time + timings.buy;
    }
  }
  report.finalCash = run.state.cash;
  return report;
}

function spend(run: Run): void {
  const s = run.state;
  const next = CASES.find((c) => !s.unlocked.includes(c.id));
  if (next && s.cash >= unlockCostOf(next.id) + priceOf(next.id)) {
    run.unlockCase(next.id);
    return;
  }
  let cheapest: { id: UpgradeId; cost: number } | null = null;
  for (const id of UPGRADE_IDS) {
    const cost = upgradeCost(id, s.upgrades[id]);
    if (cost !== null && (cheapest === null || cost < cheapest.cost)) cheapest = { id, cost };
  }
  if (cheapest && cheapest.cost <= s.cash * 0.25) run.buyUpgrade(cheapest.id);
}
```

- [ ] **Step 4: Run the test and tune until it passes**

Run: `npx vitest run src/modules/casecremental/sim/pacing.test.ts`
Expected: PASS. If a bound fails, print the medians (temporarily `console.log(reports)`), then adjust only `sim/tuning.ts`: unlock too slow → lower that case's `unlockCost` or raise `RARITY_VALUE_MULT`; too fast → the reverse; stage 2 too early/late → `STAGE_THRESHOLDS[0]` or `COMBO_HEAT_DIVISOR`. Then re-run `npx vitest run src/modules/casecremental/sim` — every earlier test must still pass; where an earlier test pins a tuned literal (Task 5 pins `luck` base cost 15 / growth 1.6 and the stage thresholds), update that literal to the new number.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/sim
git commit -m "test(sim): greedy pacing bot checks the first-run timeline

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 8: The UI view model

**Files:**
- Create: `game/view.ts`
- Test: `game/view.test.ts`

**Interfaces:**
- Consumes: `Run`, `Bench`, `CASES`, `priceOf`, `unlockCostOf`, `STAGE_NAMES`, `UPGRADE_IDS`, `UPGRADE_INFO`, `UPGRADE_COSTS`, `upgradeCost`.
- Produces:
  - `interface CaseView { id; name; theme; color; price; unlocked; unlockCost; canBuy; canUnlock }`
  - `interface UpgradeView { id: UpgradeId; name; description; level; maxLevel; cost: number | null; canBuy }`
  - `interface GameView { cash; combo; comboMult; stage; stageName; phase: Bench["phase"]; canBrake; cases: CaseView[]; upgrades: UpgradeView[]; nextGoal: { label: string; progress: number } | null }`
  - `buildView(run: Run): GameView`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { unlockCostOf } from "../sim/content/cases";
import { Run } from "../sim/run";
import { START_CASH } from "../sim/tuning";
import { buildView } from "./view";

describe("buildView", () => {
  it("shows a fresh run", () => {
    const v = buildView(new Run(1));
    expect(v.cash).toBe(START_CASH);
    expect(v.phase).toBe("empty");
    expect(v.stageName).toBe("Sober");
    expect(v.cases.map((c) => [c.id, c.unlocked, c.canBuy])).toEqual([
      ["bootcamp", true, true],
      ["wildwood", false, false],
      ["bedrock", false, false],
    ]);
    expect(v.upgrades.map((u) => u.id)).toEqual(["luck", "appraiser", "quickHands"]);
    expect(v.nextGoal).toEqual({
      label: "Unlock Wildwood Case",
      progress: START_CASH / unlockCostOf("wildwood"),
    });
  });

  it("can't buy while the bench is busy", () => {
    const run = new Run(1);
    run.buyCase("bootcamp");
    expect(buildView(run).cases[0]!.canBuy).toBe(false);
  });

  it("only offers the next case in the ladder to unlock", () => {
    const run = new Run(1);
    run.state.cash = 100_000;
    const v = buildView(run);
    expect(v.cases[1]!.canUnlock).toBe(true);
    expect(v.cases[2]!.canUnlock).toBe(false);
    expect(v.nextGoal!.progress).toBe(1);
  });

  it("has no goal once everything is unlocked, and maxed upgrades can't be bought", () => {
    const run = new Run(1);
    run.state.cash = 1e12;
    run.unlockCase("wildwood");
    run.unlockCase("bedrock");
    while (run.buyUpgrade("quickHands").ok) {}
    const v = buildView(run);
    expect(v.nextGoal).toBeNull();
    const qh = v.upgrades.find((u) => u.id === "quickHands")!;
    expect(qh.cost).toBeNull();
    expect(qh.canBuy).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/casecremental/game/view.test.ts`
Expected: FAIL — cannot resolve `./view`.

- [ ] **Step 3: Write `game/view.ts`**

```ts
import { CASES, priceOf, unlockCostOf } from "../sim/content/cases";
import { STAGE_NAMES } from "../sim/intensity";
import type { Bench, Run } from "../sim/run";
import { UPGRADE_COSTS } from "../sim/tuning";
import { UPGRADE_IDS, UPGRADE_INFO, upgradeCost, type UpgradeId } from "../sim/upgrades";

// What the React overlay shows — derived from the run, never stored separately.

export interface CaseView {
  id: string;
  name: string;
  theme: string;
  color: string;
  price: number;
  unlocked: boolean;
  unlockCost: number;
  canBuy: boolean;
  canUnlock: boolean;
}

export interface UpgradeView {
  id: UpgradeId;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  cost: number | null;
  canBuy: boolean;
}

export interface GameView {
  cash: number;
  combo: number;
  comboMult: number;
  stage: number;
  stageName: string;
  phase: Bench["phase"];
  canBrake: boolean;
  cases: CaseView[];
  upgrades: UpgradeView[];
  nextGoal: { label: string; progress: number } | null;
}

export function buildView(run: Run): GameView {
  const s = run.state;
  const benchFree = s.bench.phase === "empty";
  const cases = CASES.map((c, i): CaseView => {
    const unlocked = s.unlocked.includes(c.id);
    const previousUnlocked = i === 0 || s.unlocked.includes(CASES[i - 1]!.id);
    return {
      id: c.id,
      name: c.name,
      theme: c.theme,
      color: c.color,
      price: priceOf(c.id),
      unlocked,
      unlockCost: unlockCostOf(c.id),
      canBuy: unlocked && benchFree && s.cash >= priceOf(c.id),
      canUnlock: !unlocked && previousUnlocked && s.cash >= unlockCostOf(c.id),
    };
  });
  const upgrades = UPGRADE_IDS.map((id): UpgradeView => {
    const cost = upgradeCost(id, s.upgrades[id]);
    return {
      id,
      ...UPGRADE_INFO[id],
      level: s.upgrades[id],
      maxLevel: UPGRADE_COSTS[id].maxLevel,
      cost,
      canBuy: cost !== null && s.cash >= cost,
    };
  });
  const next = cases.find((c) => !c.unlocked);
  return {
    cash: s.cash,
    combo: s.combo,
    comboMult: run.comboMultiplier(),
    stage: s.stage,
    stageName: STAGE_NAMES[s.stage - 1] ?? "",
    phase: s.bench.phase,
    canBrake: run.canBrake(),
    cases,
    upgrades,
    nextGoal: next
      ? { label: `Unlock ${next.name}`, progress: Math.min(1, Math.max(0, s.cash / next.unlockCost)) }
      : null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/casecremental/game/view.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/game
git commit -m "feat(game): UI view model

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 9: Game controller and the agent surface

**Files:**
- Create: `game/controller.ts`, `game/agent.ts`
- Test: `game/controller.test.ts`, `game/agent.test.ts`

**Interfaces:**
- Consumes: `Run`, `SimEvent`, `ActionResult`, `buildView`, `GameView`, `UPGRADE_IDS`, `UpgradeId`, `skinById`, `skinDisplayName`, `ModuleAgentApi` (type, from `@idosgames/module-sdk`).
- Produces:
  - `type Action = { type: "buyCase"; caseId: string } | { type: "insertKey" } | { type: "brake" } | { type: "sell" } | { type: "unlockCase"; caseId: string } | { type: "buyUpgrade"; id: UpgradeId }`
  - `SIM_STEP = 1/30`, `MAX_FRAME_SECONDS = 0.25`
  - `class GameController` with `run`, `timeScale` (default 1), `mounted`, `running`, `step(realSeconds)`, `act(action): ActionResult`, `onEvent(listener): () => void`, `subscribe(listener): () => void` and `getView(): GameView` (both stable arrow-function properties, for `useSyncExternalStore`)
  - `createAgentApi(c: GameController): ModuleAgentApi`

- [ ] **Step 1: Write the failing tests**

`game/controller.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SimEvent } from "../sim/run";
import { GameController, MAX_FRAME_SECONDS } from "./controller";

describe("GameController", () => {
  it("advances the sim in fixed steps", () => {
    const c = new GameController(1);
    for (let i = 0; i < 60; i++) c.step(1 / 60);
    expect(c.run.state.time).toBeGreaterThan(0.95);
    expect(c.run.state.time).toBeLessThan(1.05);
  });

  it("clamps a huge frame (tab was hidden) to MAX_FRAME_SECONDS", () => {
    const c = new GameController(1);
    c.act({ type: "buyCase", caseId: "bootcamp" });
    c.act({ type: "insertKey" });
    c.step(30);
    expect(c.run.state.time).toBeLessThanOrEqual(MAX_FRAME_SECONDS);
    expect(c.run.state.bench.phase).toBe("spinning");
  });

  it("freezes the sim at timeScale 0 (hit-stop)", () => {
    const c = new GameController(1);
    c.timeScale = 0;
    c.step(0.1);
    expect(c.run.state.time).toBe(0);
  });

  it("routes actions to the run and events to listeners", () => {
    const c = new GameController(1);
    const seen: SimEvent[] = [];
    const off = c.onEvent((e) => seen.push(e));
    expect(c.act({ type: "buyCase", caseId: "bootcamp" }).ok).toBe(true);
    expect(c.act({ type: "sell" }).ok).toBe(false);
    off();
    c.act({ type: "insertKey" });
    expect(seen.map((e) => e.type)).toEqual(["caseBought"]);
  });

  it("refreshes the view and notifies subscribers on act", () => {
    const c = new GameController(1);
    let calls = 0;
    c.subscribe(() => calls++);
    const before = c.getView();
    c.act({ type: "buyCase", caseId: "bootcamp" });
    expect(calls).toBe(1);
    expect(c.getView()).not.toBe(before);
    expect(c.getView().phase).toBe("locked");
  });
});
```

`game/agent.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { START_CASH } from "../sim/tuning";
import { createAgentApi } from "./agent";
import { GameController } from "./controller";

describe("agent surface", () => {
  it("publishes a cheap JSON state with the running flags", () => {
    const c = new GameController(1);
    const api = createAgentApi(c);
    const state = api.state() as Record<string, unknown>;
    expect(state).toMatchObject({ mounted: false, playing: false, cash: START_CASH, stage: 1 });
    expect(() => JSON.stringify(state)).not.toThrow();
  });

  it("drives the game through the controller", async () => {
    const c = new GameController(1);
    const api = createAgentApi(c);
    await api.actions!.buyCase!({ caseId: "bootcamp" });
    await api.actions!.insertKey!({});
    expect(c.run.state.bench.phase).toBe("spinning");
    const state = api.state() as { bench: { phase: string } };
    expect(state.bench.phase).toBe("spinning");
  });

  it("rejects unknown upgrade ids with the valid list", async () => {
    const api = createAgentApi(new GameController(1));
    await expect(api.actions!.buyUpgrade!({ id: "wings" })).rejects.toThrow(
      /luck, appraiser, quickHands/,
    );
  });

  it("documents every action", () => {
    const api = createAgentApi(new GameController(1));
    expect(Object.keys(api.describeActions ?? {}).sort()).toEqual(
      Object.keys(api.actions ?? {}).sort(),
    );
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/game`
Expected: FAIL — cannot resolve `./controller`, `./agent`.

- [ ] **Step 3: Write `game/controller.ts`**

```ts
import { Run, type ActionResult, type SimEvent } from "../sim/run";
import type { UpgradeId } from "../sim/upgrades";
import { buildView, type GameView } from "./view";

// Owns the run. The scene calls step() every frame; the player, the React panel and the agent all
// change the game through act() — the one input path.

export type Action =
  | { type: "buyCase"; caseId: string }
  | { type: "insertKey" }
  | { type: "brake" }
  | { type: "sell" }
  | { type: "unlockCase"; caseId: string }
  | { type: "buyUpgrade"; id: UpgradeId };

export const SIM_STEP = 1 / 30;
/** A frame longer than this (tab was hidden, debugger pause) is clamped. */
export const MAX_FRAME_SECONDS = 0.25;
const VIEW_REFRESH_SECONDS = 0.1;

export class GameController {
  readonly run: Run;
  /** Set each frame by the scene: 0 = hit-stop, <1 = slow-mo. */
  timeScale = 1;
  mounted = false;
  running = false;

  private acc = 0;
  private viewAge = 0;
  private view: GameView;
  private readonly eventListeners = new Set<(e: SimEvent) => void>();
  private readonly viewListeners = new Set<() => void>();

  constructor(seed: number = Date.now() >>> 0) {
    this.run = new Run(seed);
    this.view = buildView(this.run);
  }

  step(realSeconds: number): void {
    const frame = Math.min(Math.max(realSeconds, 0), MAX_FRAME_SECONDS);
    this.acc += frame * this.timeScale;
    while (this.acc >= SIM_STEP) {
      this.run.tick(SIM_STEP);
      this.acc -= SIM_STEP;
    }
    this.flush();
    this.viewAge += frame;
    if (this.viewAge >= VIEW_REFRESH_SECONDS) {
      this.viewAge = 0;
      this.refreshView();
    }
  }

  act(action: Action): ActionResult {
    const r = this.dispatch(action);
    this.flush();
    this.refreshView();
    return r;
  }

  onEvent(listener: (e: SimEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.viewListeners.add(listener);
    return () => this.viewListeners.delete(listener);
  };

  readonly getView = (): GameView => this.view;

  private dispatch(a: Action): ActionResult {
    switch (a.type) {
      case "buyCase":
        return this.run.buyCase(a.caseId);
      case "insertKey":
        return this.run.insertKey();
      case "brake":
        return this.run.brake();
      case "sell":
        return this.run.sell();
      case "unlockCase":
        return this.run.unlockCase(a.caseId);
      case "buyUpgrade":
        return this.run.buyUpgrade(a.id);
    }
  }

  private flush(): void {
    for (const e of this.run.drainEvents()) for (const l of this.eventListeners) l(e);
  }

  private refreshView(): void {
    this.view = buildView(this.run);
    for (const l of this.viewListeners) l();
  }
}
```

- [ ] **Step 4: Check the agent API type**

Run: `grep -rn "ModuleAgentApi" -A 20 node_modules/@idosgames/module-sdk/dist/*.d.ts | head -40`
Expected: `state(): unknown`, `actions?: Record<string, (args?: …) => Promise<unknown>>`, `describeActions?: Record<string, string>`. If the argument type differs from `Record<string, unknown> | undefined`, change only the `Args` alias below to match.

- [ ] **Step 5: Write `game/agent.ts`**

```ts
import type { ModuleAgentApi } from "@idosgames/module-sdk";
import { skinById, skinDisplayName } from "../sim/content/cases";
import type { ActionResult } from "../sim/run";
import { UPGRADE_IDS, type UpgradeId } from "../sim/upgrades";
import type { Action, GameController } from "./controller";

// What the AI Coder's agent (and a human in the preview) can see and do inside the canvas.
// Actions go through controller.act — the same path as the player's input.

type Args = Record<string, unknown> | undefined;
const cents = (n: number) => Math.round(n * 100) / 100;

export function createAgentApi(c: GameController): ModuleAgentApi {
  const run = async (action: Action): Promise<ActionResult> => c.act(action);
  return {
    state() {
      const s = c.run.state;
      const b = s.bench;
      return {
        mounted: c.mounted,
        playing: c.running,
        time: Math.round(s.time * 10) / 10,
        cash: cents(s.cash),
        lifetimeEarnings: cents(s.lifetimeEarnings),
        stage: s.stage,
        combo: s.combo,
        timeScale: c.timeScale,
        unlocked: [...s.unlocked],
        upgrades: { ...s.upgrades },
        bench:
          b.phase === "spinning"
            ? { phase: b.phase, caseId: b.caseId, elapsed: b.elapsed, endsAt: b.endsAt, braking: b.brakedAt !== null }
            : b.phase === "revealed"
              ? {
                  phase: b.phase,
                  caseId: b.caseId,
                  skin: skinDisplayName(skinById(b.drop.skinId)),
                  rarity: b.drop.rarity,
                  wear: b.drop.wear,
                  statTrak: b.drop.statTrak,
                  value: cents(b.drop.value),
                }
              : { ...b },
      };
    },
    actions: {
      buyCase: (args: Args) => run({ type: "buyCase", caseId: String(args?.caseId ?? "") }),
      insertKey: () => run({ type: "insertKey" }),
      brake: () => run({ type: "brake" }),
      sell: () => run({ type: "sell" }),
      unlockCase: (args: Args) => run({ type: "unlockCase", caseId: String(args?.caseId ?? "") }),
      buyUpgrade: async (args: Args) => {
        const id = String(args?.id ?? "");
        if (!UPGRADE_IDS.includes(id as UpgradeId))
          throw new Error(`unknown upgrade "${id}"; valid: ${UPGRADE_IDS.join(", ")}`);
        return c.act({ type: "buyUpgrade", id: id as UpgradeId });
      },
    },
    describeActions: {
      buyCase: "Buy a case onto the empty bench: { caseId: bootcamp|wildwood|bedrock }.",
      insertKey: "Turn the key of the case on the bench; the reel starts spinning.",
      brake: "Slam the brakes on the spinning reel (works after 25% of the spin).",
      sell: "Sell the revealed skin.",
      unlockCase: "Unlock the next case in the ladder: { caseId }.",
      buyUpgrade: "Buy one level: { id: luck|appraiser|quickHands }.",
    },
  };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/modules/casecremental/game`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/casecremental/game
git commit -m "feat(game): fixed-step controller and agent debug surface

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 10: Layout, reel strip and reel motion (pure)

**Files:**
- Create: `fx/layout.ts`, `fx/reel/strip.ts`, `fx/reel/motion.ts`
- Test: `fx/layout.test.ts`, `fx/reel/strip.test.ts`, `fx/reel/motion.test.ts`

**Interfaces:**
- Consumes: `rarityWeights`, `pickRarity`, `Rng`, `CaseDef`, `SkinDef`.
- Produces:
  - `interface Point { x; y }`, `interface Rect { x; y; w; h }`
  - `HUD_HEIGHT = 96`, `SHOP_FRACTION = 0.36`, `GUTTER = 16`, `KEY_RADIUS = 28`
  - `interface Layout { width; height; playBottom; itemW; itemH; reel: Rect; bench: Point; caseSize: { w; h }; revealSize: { w; h }; lock: Point; keyHome: Point; sellBin: Point & { r: number }; cashTarget: Point }`; `computeLayout(width, height): Layout`
  - `STRIP_LENGTH = 48`, `WIN_INDEX = 40`, `NEAR_MISS_CHANCE = 0.35`, `buildStrip(c: CaseDef, winner: SkinDef, rng: Rng): SkinDef[]`
  - `interface ReelMotion { elapsed; fullDuration; endsAt; brakedAt: number | null }` (the spinning `Bench` satisfies it), `easeOutQuart(t)`, `reelFraction(m: ReelMotion): number` in [0, 1]

- [ ] **Step 1: Write the failing tests**

`fx/layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeLayout, GUTTER, HUD_HEIGHT, KEY_RADIUS } from "./layout";

const SIZES = [
  [360, 640],
  [640, 360],
  [800, 600],
  [1920, 1080],
] as const;

describe.each(SIZES)("computeLayout(%i × %i)", (w, h) => {
  const l = computeLayout(w, h);

  it("keeps the reel inside the gutters, below the HUD", () => {
    expect(l.reel.x).toBeGreaterThanOrEqual(GUTTER);
    expect(l.reel.x + l.reel.w).toBeLessThanOrEqual(w - GUTTER);
    expect(l.reel.y).toBeGreaterThanOrEqual(HUD_HEIGHT);
  });

  it("keeps the case and the reveal card between the reel and the shop panel", () => {
    for (const size of [l.caseSize, l.revealSize]) {
      expect(l.bench.y - size.h / 2).toBeGreaterThanOrEqual(l.reel.y + l.reel.h);
      expect(l.bench.y + size.h / 2).toBeLessThanOrEqual(l.playBottom);
    }
  });

  it("puts the key left and the sell bin right, on screen and clear of the card", () => {
    const half = Math.max(l.caseSize.w, l.revealSize.w) / 2;
    expect(l.keyHome.x - KEY_RADIUS).toBeGreaterThanOrEqual(GUTTER);
    expect(l.keyHome.x + KEY_RADIUS).toBeLessThan(l.bench.x - half);
    expect(l.sellBin.x - l.sellBin.r).toBeGreaterThan(l.bench.x + half);
    expect(l.sellBin.x + l.sellBin.r).toBeLessThanOrEqual(w - GUTTER);
  });
});
```

`fx/reel/strip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { caseById } from "../../sim/content/cases";
import { createRng } from "../../sim/rng";
import { buildStrip, STRIP_LENGTH, WIN_INDEX } from "./strip";

const c = caseById("bootcamp");
const milspec = c.skins.find((s) => s.rarity === "milspec")!;
const knife = c.skins.find((s) => s.rarity === "gold")!;

describe("buildStrip", () => {
  it("places the winner at WIN_INDEX among skins of the same case", () => {
    const strip = buildStrip(c, milspec, createRng(1));
    expect(strip).toHaveLength(STRIP_LENGTH);
    expect(strip[WIN_INDEX]).toBe(milspec);
    for (const s of strip) expect(c.skins).toContain(s);
  });

  it("teases a near miss (knife one slot past) about 35% of the time", () => {
    const rng = createRng(2);
    let teases = 0;
    for (let i = 0; i < 4000; i++) if (buildStrip(c, milspec, rng)[WIN_INDEX + 1] === knife) teases++;
    expect(teases / 4000).toBeGreaterThan(0.3);
    expect(teases / 4000).toBeLessThan(0.4);
  });

  it("never changes the winner, even for a knife", () => {
    expect(buildStrip(c, knife, createRng(3))[WIN_INDEX]).toBe(knife);
  });
});
```

`fx/reel/motion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { reelFraction, type ReelMotion } from "./motion";

const spin = (elapsed: number, brakedAt: number | null = null, endsAt = 6): ReelMotion => ({
  elapsed,
  fullDuration: 6,
  endsAt,
  brakedAt,
});

describe("reelFraction", () => {
  it("runs 0 → 1 over the full spin", () => {
    expect(reelFraction(spin(0))).toBe(0);
    expect(reelFraction(spin(6))).toBe(1);
    expect(reelFraction(spin(9))).toBe(1);
  });

  it("is continuous at the moment of braking and ends at 1", () => {
    const free = reelFraction(spin(2));
    expect(reelFraction(spin(2, 2, 2.35))).toBeCloseTo(free, 10);
    expect(reelFraction(spin(2.35, 2, 2.35))).toBe(1);
  });

  it("never moves backwards, braked or not", () => {
    for (const brakeAt of [null, 1.5, 3]) {
      let prev = -1;
      for (let t = 0; t <= 6; t += 0.01) {
        const braked = brakeAt !== null && t >= brakeAt;
        const f = reelFraction(
          spin(t, braked ? brakeAt : null, braked ? brakeAt + 0.35 : 6),
        );
        expect(f).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = f;
      }
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx`
Expected: FAIL — cannot resolve `./layout`, `./strip`, `./motion`.

- [ ] **Step 3: Write `fx/layout.ts`**

```ts
// Where everything sits on the canvas, for any screen size. The React HUD covers the top
// HUD_HEIGHT pixels and the shop panel the bottom SHOP_FRACTION of the screen; the play area is
// what is left between them.

export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const HUD_HEIGHT = 96;
export const SHOP_FRACTION = 0.36;
export const GUTTER = 16;
export const KEY_RADIUS = 28;

export interface Layout {
  width: number;
  height: number;
  playBottom: number;
  itemW: number;
  itemH: number;
  reel: Rect;
  bench: Point;
  caseSize: { w: number; h: number };
  revealSize: { w: number; h: number };
  lock: Point;
  keyHome: Point;
  sellBin: Point & { r: number };
  cashTarget: Point;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function computeLayout(width: number, height: number): Layout {
  const playBottom = height * (1 - SHOP_FRACTION);
  const playH = playBottom - HUD_HEIGHT;

  const itemW = clamp(Math.min((width - 2 * GUTTER) / 5, (playH * 0.35) / 0.75), 72, 150);
  const itemH = Math.round(itemW * 0.75);
  const reelW = Math.min(width - 2 * GUTTER, itemW * 7);
  const reel: Rect = { x: (width - reelW) / 2, y: HUD_HEIGHT + 8, w: reelW, h: itemH + 16 };
  const reelBottom = reel.y + reel.h;

  const below = playBottom - reelBottom;
  const caseW = clamp(Math.min(width * 0.22, (below * 0.7) / 0.62), 60, 180);
  const caseSize = { w: caseW, h: caseW * 0.62 };
  const revealSize = { w: caseW * 1.6, h: caseSize.h * 1.4 };
  const bench = { x: width / 2, y: reelBottom + below / 2 };

  const sellR = clamp(width * 0.06, 32, 56);
  const side = Math.min(width / 2 - GUTTER - sellR - 4, revealSize.w / 2 + 110);

  return {
    width,
    height,
    playBottom,
    itemW,
    itemH,
    reel,
    bench,
    caseSize,
    revealSize,
    lock: { x: bench.x, y: bench.y - caseSize.h * 0.1 },
    keyHome: { x: bench.x - side, y: bench.y },
    sellBin: { x: bench.x + side, y: bench.y, r: sellR },
    cashTarget: { x: width / 2, y: 30 },
  };
}
```

- [ ] **Step 4: Write `fx/reel/strip.ts`**

```ts
import { rarityWeights } from "../../sim/rarity";
import type { Rng } from "../../sim/rng";
import { pickRarity } from "../../sim/roll";
import type { CaseDef, SkinDef } from "../../sim/types";

// The strip of skins that scrolls past the marker. The outcome is already rolled by the sim; the
// strip only decides what the player SEES around it — including the near miss: the case's knife
// one slot past the winner, so the reel creeps past it (spec §9.2). Visual only.

export const STRIP_LENGTH = 48;
export const WIN_INDEX = 40;
export const NEAR_MISS_CHANCE = 0.35;

export function buildStrip(c: CaseDef, winner: SkinDef, rng: Rng): SkinDef[] {
  const weights = rarityWeights(0);
  const strip: SkinDef[] = [];
  for (let i = 0; i < STRIP_LENGTH; i++) {
    const r = pickRarity(weights, rng.next());
    strip.push(rng.pick(c.skins.filter((s) => s.rarity === r)));
  }
  strip[WIN_INDEX] = winner;
  if (winner.rarity !== "gold" && rng.next() < NEAR_MISS_CHANCE) {
    const knife = c.skins.find((s) => s.rarity === "gold");
    if (knife) strip[WIN_INDEX + 1] = knife;
  }
  return strip;
}
```

- [ ] **Step 5: Write `fx/reel/motion.ts`**

```ts
// How far along its path the reel is (0 → 1). Free spin: ease-out over the full duration.
// Braked: from wherever it was, a fast ease-out to the end over the remaining brake time —
// continuous at the moment of braking, never backwards.

export interface ReelMotion {
  elapsed: number;
  fullDuration: number;
  endsAt: number;
  brakedAt: number | null;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function easeOutQuart(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u * u;
}

export function reelFraction(m: ReelMotion): number {
  if (m.brakedAt === null) return easeOutQuart(m.elapsed / m.fullDuration);
  const from = easeOutQuart(m.brakedAt / m.fullDuration);
  const span = m.endsAt - m.brakedAt;
  if (span <= 0) return 1;
  const u = clamp01((m.elapsed - m.brakedAt) / span);
  return from + (1 - from) * (1 - (1 - u) * (1 - u));
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/modules/casecremental/fx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/casecremental/fx
git commit -m "feat(fx): responsive layout, reel strip with near miss, brake-aware reel motion

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 11: Procedural skin patterns and weapon silhouettes (pure)

**Files:**
- Create: `fx/skins/noise.ts`, `fx/skins/patterns.ts`, `fx/skins/silhouettes.ts`
- Test: `fx/skins/noise.test.ts`, `fx/skins/patterns.test.ts`, `fx/skins/silhouettes.test.ts`

**Interfaces:**
- Consumes: `PatternSpec`, `PatternKind`, `WeaponId`, `CASES`.
- Produces:
  - `hash2(x, y, seed): number` in [0,1), `valueNoise(x, y, seed)`, `fbm(x, y, seed, octaves = 4)` in [0,1], `voronoi(x, y, seed): { f1; f2; cell }`
  - `type Rgb = readonly [number, number, number]`, `hexToRgb(hex): Rgb`, `patternColor(spec, palette: readonly Rgb[], u, v): Rgb`, `renderPattern(spec, w, h): Uint8ClampedArray<ArrayBuffer>` (RGBA)
  - `SILHOUETTE_BOX = { w: 100, h: 40 }`, `SILHOUETTES: Record<WeaponId, readonly (readonly [number, number])[]>`

- [ ] **Step 1: Write the failing tests**

`fx/skins/noise.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fbm, hash2, valueNoise, voronoi } from "./noise";

describe("noise", () => {
  it("hash2 is deterministic and in [0, 1)", () => {
    expect(hash2(3, 4, 5)).toBe(hash2(3, 4, 5));
    expect(hash2(3, 4, 5)).not.toBe(hash2(4, 3, 5));
    for (let i = 0; i < 1000; i++) {
      const h = hash2(i, -i, 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it("valueNoise and fbm stay in [0, 1] and are smooth", () => {
    for (let i = 0; i < 500; i++) {
      const x = i * 0.137;
      const y = i * 0.071;
      for (const n of [valueNoise(x, y, 1), fbm(x, y, 1)]) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(valueNoise(x, y, 1) - valueNoise(x + 0.001, y, 1))).toBeLessThan(0.01);
    }
  });

  it("voronoi gives f1 <= f2", () => {
    for (let i = 0; i < 200; i++) {
      const v = voronoi(i * 0.31, i * 0.17, 3);
      expect(v.f1).toBeGreaterThanOrEqual(0);
      expect(v.f1).toBeLessThanOrEqual(v.f2);
    }
  });
});
```

`fx/skins/patterns.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CASES } from "../../sim/content/cases";
import type { PatternKind, PatternSpec } from "../../sim/types";
import { hexToRgb, renderPattern } from "./patterns";

const KINDS: PatternKind[] = ["camo", "digital", "tiger", "leaves", "bark", "moss", "marble", "granite", "crystal", "lava"];
const PALETTE = ["#101010", "#808080", "#f0f0f0", "#ff0000"];
const spec = (kind: PatternKind, seed = 1): PatternSpec => ({ kind, palette: PALETTE, scale: 4, seed });

function colors(px: Uint8ClampedArray): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < px.length; i += 4) out.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
  return out;
}

describe("patterns", () => {
  it("hexToRgb parses #rrggbb", () => {
    expect(hexToRgb("#ff8000")).toEqual([255, 128, 0]);
  });

  it("renders opaque RGBA of the requested size", () => {
    const px = renderPattern(spec("camo"), 64, 32);
    expect(px).toHaveLength(64 * 32 * 4);
    for (let i = 3; i < px.length; i += 4) expect(px[i]).toBe(255);
  });

  it.each(KINDS)("%s is deterministic and not a flat color", (kind) => {
    const a = renderPattern(spec(kind), 64, 32);
    expect(renderPattern(spec(kind), 64, 32)).toEqual(a);
    expect(colors(a).size).toBeGreaterThanOrEqual(2);
  });

  it.each(["camo", "digital", "tiger", "leaves", "granite", "crystal"] as PatternKind[])(
    "%s uses only palette colors",
    (kind) => {
      const allowed = new Set(PALETTE.map((h) => hexToRgb(h).join(",")));
      for (const c of colors(renderPattern(spec(kind), 64, 32))) expect(allowed).toContain(c);
    },
  );

  it("changes with the seed", () => {
    expect(renderPattern(spec("camo", 1), 32, 16)).not.toEqual(renderPattern(spec("camo", 2), 32, 16));
  });

  it("renders every skin of every case", () => {
    for (const c of CASES) for (const s of c.skins) expect(() => renderPattern(s.pattern, 40, 16)).not.toThrow();
  });
});
```

`fx/skins/silhouettes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { WeaponId } from "../../sim/types";
import { SILHOUETTE_BOX, SILHOUETTES } from "./silhouettes";

const WEAPONS: WeaponId[] = ["rifle", "sniper", "pistol", "heavyPistol", "smg", "shotgun", "mg", "knife"];

const area = (pts: readonly (readonly [number, number])[]) =>
  Math.abs(pts.reduce((a, [x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length]!;
    return a + x * ny - nx * y;
  }, 0)) / 2;

describe.each(WEAPONS)("silhouette %s", (weapon) => {
  const pts = SILHOUETTES[weapon];

  it("is a real polygon inside the 100 × 40 box", () => {
    expect(pts.length).toBeGreaterThanOrEqual(6);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(SILHOUETTE_BOX.w);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(SILHOUETTE_BOX.h);
    }
    expect(area(pts)).toBeGreaterThan(150);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx/skins`
Expected: FAIL — cannot resolve `./noise`, `./patterns`, `./silhouettes`.

- [ ] **Step 3: Write `fx/skins/noise.ts`**

```ts
// Small deterministic noise toolkit for the skin patterns: integer hash, value noise, fractal
// noise (fbm) and voronoi cells. Pure functions — same input, same pixels.

export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Distance to the nearest (f1) and second-nearest (f2) cell point, and the nearest cell's id. */
export function voronoi(x: number, y: number, seed: number): { f1: number; f2: number; cell: number } {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = Number.POSITIVE_INFINITY;
  let f2 = Number.POSITIVE_INFINITY;
  let cell = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx;
      const cy = yi + dy;
      const d = Math.hypot(cx + hash2(cx, cy, seed) - x, cy + hash2(cx, cy, seed + 7) - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        cell = hash2(cx, cy, seed + 13);
      } else if (d < f2) {
        f2 = d;
      }
    }
  return { f1, f2, cell };
}
```

- [ ] **Step 4: Write `fx/skins/patterns.ts`**

```ts
import type { PatternSpec } from "../../sim/types";
import { fbm, hash2, voronoi } from "./noise";

// Ten procedural finishes for the first three cases: army (camo, digital, tiger), forest (leaves,
// bark, moss) and rocks (marble, granite, crystal, lava). Each maps a point of the texture to a
// color from the skin's palette. Later cases add shader-based, animated finishes (milestone 2).

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** fbm bunches around 0.5 — spread it over the whole 0..1 range. */
const spread = (n: number) => clamp01((n - 0.25) / 0.5);

const pick = (pal: readonly Rgb[], t: number): Rgb =>
  pal[Math.min(pal.length - 1, Math.floor(clamp01(t) * pal.length))]!;

function ramp(pal: readonly Rgb[], t: number): Rgb {
  if (pal.length === 1) return pal[0]!;
  const x = clamp01(t) * (pal.length - 1);
  const i = Math.min(pal.length - 2, Math.floor(x));
  const f = x - i;
  const a = pal[i]!;
  const b = pal[i + 1]!;
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/** Color at (u, v) ∈ [0,1)² of a 2.5 : 1 texture. */
export function patternColor(spec: PatternSpec, pal: readonly Rgb[], u: number, v: number): Rgb {
  const x = u * spec.scale * 2.5;
  const y = v * spec.scale;
  const seed = spec.seed;
  switch (spec.kind) {
    case "camo":
      return pick(pal, spread(fbm(x, y, seed)));
    case "digital": {
      const q = 3;
      return pick(pal, spread(fbm(Math.floor(x * q) / q, Math.floor(y * q) / q, seed)));
    }
    case "tiger": {
      const t = Math.sin((x * 1.6 + fbm(x * 0.5, y * 0.5, seed, 3) * 4) * Math.PI);
      if (t > 0.45) return pal[1]!;
      if (t < -0.85 && pal.length > 2) return pal[2]!;
      return pal[0]!;
    }
    case "leaves":
      return pick(pal, spread(fbm(x, y * 0.6, seed) + 0.12 * Math.sin(x * 6 + y * 2)));
    case "bark":
      return ramp(pal, spread(fbm(x * 0.25, y * 3, seed, 5)));
    case "moss":
      return ramp(pal, spread(fbm(x * 2, y * 2, seed, 6)));
    case "marble": {
      const t = Math.abs(Math.sin((x * 0.5 + fbm(x * 0.6, y * 0.6, seed, 5) * 6) * Math.PI));
      if (t < 0.06 && pal.length > 2) return pal[2]!;
      return ramp([pal[0]!, pal[1]!], t ** 0.4);
    }
    case "granite":
      return pick(pal, hash2(Math.floor(x * 6), Math.floor(y * 6), seed));
    case "crystal": {
      const { f1, f2, cell } = voronoi(x * 1.2, y * 1.2, seed);
      if (f2 - f1 < 0.06) return pal[pal.length - 1]!;
      return pick(pal.slice(0, Math.max(1, pal.length - 1)), cell);
    }
    case "lava": {
      const half = Math.max(1, Math.floor(pal.length / 2));
      const { f1, f2 } = voronoi(x * 1.1, y * 1.1, seed);
      const crack = f2 - f1;
      if (crack < 0.08) return ramp(pal.slice(half), 1 - crack / 0.08);
      return pick(pal.slice(0, half), fbm(x, y, seed));
    }
  }
}

export function renderPattern(spec: PatternSpec, w: number, h: number): Uint8ClampedArray<ArrayBuffer> {
  const pal = spec.palette.map(hexToRgb);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const c = patternColor(spec, pal, i / w, j / h);
      const o = (j * w + i) * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  return out;
}
```

- [ ] **Step 5: Write `fx/skins/silhouettes.ts`**

```ts
import type { WeaponId } from "../../sim/types";

// Weapon outlines as polygons in a 100 × 40 box, drawn as the mask of each skin. Stylized and
// original — not traced from any real game's art.

export const SILHOUETTE_BOX = { w: 100, h: 40 } as const;

type Poly = readonly (readonly [number, number])[];

export const SILHOUETTES: Readonly<Record<WeaponId, Poly>> = {
  rifle: [[0, 14], [14, 11], [24, 12], [70, 12], [70, 14], [100, 14], [100, 17], [70, 17], [66, 19], [46, 19], [42, 34], [36, 33], [38, 19], [32, 19], [30, 29], [25, 29], [26, 20], [14, 22], [0, 26]],
  sniper: [[0, 16], [16, 13], [28, 13], [36, 12], [38, 6], [58, 6], [60, 12], [72, 12], [72, 15], [100, 15], [100, 17], [72, 17], [68, 19], [46, 19], [44, 26], [39, 26], [40, 19], [34, 19], [30, 28], [25, 28], [26, 20], [14, 23], [0, 27]],
  pistol: [[22, 8], [78, 8], [78, 16], [50, 16], [48, 20], [44, 36], [30, 36], [34, 20], [32, 16], [22, 16]],
  heavyPistol: [[14, 6], [86, 6], [86, 17], [52, 17], [50, 21], [46, 38], [28, 38], [32, 21], [30, 17], [14, 17]],
  smg: [[6, 12], [70, 12], [70, 15], [90, 15], [90, 18], [70, 18], [64, 20], [50, 20], [48, 34], [42, 34], [44, 20], [34, 20], [32, 30], [26, 30], [28, 20], [18, 20], [6, 24]],
  shotgun: [[0, 15], [18, 12], [30, 13], [96, 13], [96, 17], [60, 17], [60, 20], [36, 20], [34, 28], [28, 28], [30, 20], [18, 21], [0, 26]],
  mg: [[0, 13], [16, 10], [28, 11], [78, 11], [78, 14], [100, 14], [100, 17], [78, 17], [74, 22], [60, 22], [58, 34], [40, 34], [42, 22], [34, 22], [32, 30], [26, 30], [27, 21], [16, 22], [0, 25]],
  knife: [[4, 22], [34, 18], [40, 16], [60, 10], [80, 6], [96, 8], [84, 14], [66, 20], [46, 26], [36, 28], [4, 30]],
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/modules/casecremental/fx/skins`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/casecremental/fx/skins
git commit -m "feat(fx): procedural skin patterns and weapon silhouettes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 12: Time scale and screen shake (pure juice)

**Files:**
- Create: `fx/juice/timeScale.ts`, `fx/juice/shake.ts`
- Test: `fx/juice/timeScale.test.ts`, `fx/juice/shake.test.ts`

**Interfaces:**
- Produces:
  - `class TimeScale { hitStop(seconds); slowMo(scale, seconds, rampSeconds); update(realSeconds): number; get active(): boolean }`
  - `class Shake { constructor(rng?: () => number, maxOffset = 18, decayPerSecond = 1.6); add(amount); update(seconds): Point; get level(): number }`

- [ ] **Step 1: Write the failing tests**

`fx/juice/timeScale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TimeScale } from "./timeScale";

describe("TimeScale", () => {
  it("is 1 when nothing happens", () => {
    const t = new TimeScale();
    expect(t.update(0.016)).toBe(1);
    expect(t.active).toBe(false);
  });

  it("freezes for a hit-stop, then resumes", () => {
    const t = new TimeScale();
    t.hitStop(0.08);
    expect(t.update(0.05)).toBe(0);
    expect(t.update(0.05)).toBe(0);
    expect(t.update(0.05)).toBe(1);
  });

  it("slows down, ramps back, then ends", () => {
    const t = new TimeScale();
    t.slowMo(0.2, 2, 0.5);
    expect(t.update(0.1)).toBeCloseTo(0.2);
    expect(t.active).toBe(true);
    expect(t.update(1.6)).toBeCloseTo(0.52);
    expect(t.update(0.5)).toBe(1);
    expect(t.active).toBe(false);
  });

  it("lets a hit-stop win over slow-mo", () => {
    const t = new TimeScale();
    t.slowMo(0.2, 2, 0.5);
    t.hitStop(0.1);
    expect(t.update(0.05)).toBe(0);
  });
});
```

`fx/juice/shake.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Shake } from "./shake";

describe("Shake", () => {
  it("does nothing without trauma", () => {
    const s = new Shake(() => 1);
    const o = s.update(0.016);
    expect(Math.abs(o.x)).toBe(0);
    expect(Math.abs(o.y)).toBe(0);
  });

  it("offsets by maxOffset × trauma², then decays to rest", () => {
    const s = new Shake(() => 1, 18, 1.6);
    s.add(0.5);
    expect(s.update(0).x).toBeCloseTo(4.5);
    s.update(1); // this frame still uses the old trauma, then decays it to 0
    expect(Math.abs(s.update(0).x)).toBe(0);
    expect(s.level).toBe(0);
  });

  it("caps trauma at 1", () => {
    const s = new Shake(() => 1);
    s.add(5);
    expect(s.level).toBe(1);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx/juice`
Expected: FAIL — cannot resolve `./timeScale`, `./shake`.

- [ ] **Step 3: Write `fx/juice/timeScale.ts`**

```ts
// Game-time scale for juice: a hit-stop freezes the world for a few frames (Covert drops), a
// slow-mo stretches a moment (★ drops) and ramps back to normal speed at its end.

export class TimeScale {
  private hitStopLeft = 0;
  private slow: { scale: number; left: number; ramp: number } | null = null;

  hitStop(seconds: number): void {
    this.hitStopLeft = Math.max(this.hitStopLeft, seconds);
  }

  slowMo(scale: number, seconds: number, rampSeconds: number): void {
    this.slow = { scale, left: seconds, ramp: rampSeconds };
  }

  get active(): boolean {
    return this.hitStopLeft > 0 || this.slow !== null;
  }

  /** Advances by real seconds and returns this frame's scale. */
  update(realSeconds: number): number {
    if (this.slow) this.slow.left -= realSeconds;
    if (this.hitStopLeft > 0) {
      this.hitStopLeft -= realSeconds;
      return 0;
    }
    if (!this.slow) return 1;
    if (this.slow.left <= 0) {
      this.slow = null;
      return 1;
    }
    if (this.slow.left < this.slow.ramp) {
      const k = this.slow.left / this.slow.ramp;
      return 1 + (this.slow.scale - 1) * k;
    }
    return this.slow.scale;
  }
}
```

- [ ] **Step 4: Write `fx/juice/shake.ts`**

```ts
import type { Point } from "../layout";

// Trauma-based screen shake: events add trauma (0..1), the offset grows with trauma² and the
// trauma decays linearly — small hits barely move, big ones rattle.

export class Shake {
  private trauma = 0;

  constructor(
    private readonly rng: () => number = Math.random,
    private readonly maxOffset = 18,
    private readonly decayPerSecond = 1.6,
  ) {}

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  get level(): number {
    return this.trauma;
  }

  update(seconds: number): Point {
    const k = this.maxOffset * this.trauma * this.trauma;
    this.trauma = Math.max(0, this.trauma - this.decayPerSecond * seconds);
    return { x: (this.rng() * 2 - 1) * k, y: (this.rng() * 2 - 1) * k };
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/modules/casecremental/fx/juice`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/casecremental/fx/juice
git commit -m "feat(fx): hit-stop/slow-mo time scale and trauma screen shake

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 13: Module wiring and the first visible scene

This is the integration spike: Pixi inside the iDosGames host. Stop and report if the canvas does not show up after Step 9 — the spec's fallback (§15) is Phaser.

**Files:**
- Create: `index.ts`, `module.ts`, `module.meta.json`, `fx/GameScene.ts`, `fx/World.ts` (minimal), `ui/useGameView.ts`, `ui/GamePanel.tsx` (minimal)
- Modify: `src/modules.ts`

**Interfaces:**
- Consumes: `GameController`, `createAgentApi`, `computeLayout`, `formatCash`, `GameView`; from `@idosgames/module-sdk`: `defineModule`, `Module`, `EngineScene`, `SceneMountContext`; from `@idosgames/react/ui`: `outlined`, `v`.
- Produces:
  - `casecrementalModule: Module` (route id `"casecremental"`)
  - `createGameScene(controller): EngineScene` — calls `world.timeScale(sec)`, `controller.step(sec)`, `world.update(sec, scale)` each frame
  - `class World { constructor(app: Application, controller: GameController); timeScale(realSeconds): number; update(realSeconds, scale): void; destroy(): void }`
  - `useGameView(controller): GameView`, `makeGamePanel(controller): ComponentType`

- [ ] **Step 1: Check the SDK types this task relies on**

```bash
grep -rn "interface SceneMountContext" -A 12 node_modules/@idosgames/module-sdk/dist/*.d.ts
grep -rn "engine" node_modules/@idosgames/module-sdk/dist/*.d.ts | head
grep -rn "capture\|ready" node_modules/@idosgames/module-sdk/dist/*.d.ts | head
```

Expected: `SceneMountContext` has `host: HTMLElement`; `EngineScene` has optional `ready?(): Promise<void>` and `capture?(): Promise<Blob | null>`; `meta.engine` is a union. In Step 5 use `engine: "pixi"` if the union allows it, otherwise `"dom"` (the scene still renders — `engine` is catalog metadata) and keep the comment.

- [ ] **Step 2: Write `ui/useGameView.ts`**

```ts
import { useSyncExternalStore } from "react";
import type { GameController } from "../game/controller";
import type { GameView } from "../game/view";

export function useGameView(controller: GameController): GameView {
  return useSyncExternalStore(controller.subscribe, controller.getView);
}
```

- [ ] **Step 3: Write a minimal `ui/GamePanel.tsx`** (replaced in Task 15)

```tsx
import type { ComponentType, ReactNode } from "react";
import { outlined, v } from "@idosgames/react/ui";
import type { GameController } from "../game/controller";
import { formatCash } from "../sim/format";
import { useGameView } from "./useGameView";

export function makeGamePanel(controller: GameController): ComponentType {
  return function GamePanel(): ReactNode {
    const view = useGameView(controller);
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: v.font, color: v.text }}>
        <div style={{ position: "absolute", top: 8, left: 0, right: 0, textAlign: "center", ...outlined, fontSize: 30, color: v.gold }}>
          {formatCash(view.cash)}
        </div>
      </div>
    );
  };
}
```

- [ ] **Step 4: Write a minimal `fx/World.ts`** (replaced in Tasks 14 and 16)

```ts
import { Application, Container, Graphics } from "pixi.js";
import type { GameController } from "../game/controller";
import { computeLayout, type Layout } from "./layout";

// Everything drawn on the canvas. Milestone 1 grows this in three steps: background (Task 13),
// reel + bench (Task 14), juice (Task 16).

export class World {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private layout: Layout;

  constructor(
    private readonly app: Application,
    private readonly controller: GameController,
  ) {
    this.root.addChild(this.bg);
    app.stage.addChild(this.root);
    this.layout = computeLayout(app.screen.width, app.screen.height);
    this.applyLayout();
  }

  timeScale(_realSeconds: number): number {
    return 1;
  }

  update(_realSeconds: number, _scale: number): void {
    const { width, height } = this.app.screen;
    if (width !== this.layout.width || height !== this.layout.height) {
      this.layout = computeLayout(width, height);
      this.applyLayout();
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  private applyLayout(): void {
    const l = this.layout;
    this.bg.clear().rect(0, 0, l.width, l.height).fill({ color: 0x07080c });
    this.bg.rect(l.reel.x, l.reel.y, l.reel.w, l.reel.h).fill({ color: 0x14161f });
  }
}
```

- [ ] **Step 5: Write `fx/GameScene.ts`**

```ts
import { Application, type Ticker } from "pixi.js";
import type { EngineScene, SceneMountContext } from "@idosgames/module-sdk";
import type { GameController } from "../game/controller";
import { World } from "./World";

// The Pixi scene the host's Mode Router drives: created on mount, ticking only while active
// (suspend stops the ticker), destroyed for good on destroy.

export function createGameScene(controller: GameController): EngineScene {
  let app: Application | null = null;
  let world: World | null = null;
  let ready: Promise<void> = Promise.resolve();
  let running = false;

  const tick = (ticker: Ticker): void => {
    if (!world) return;
    const seconds = ticker.deltaMS / 1000;
    const scale = world.timeScale(seconds);
    controller.timeScale = scale;
    controller.step(seconds);
    world.update(seconds, scale);
  };

  return {
    surface: "fullbleed-canvas",
    mount(ctx: SceneMountContext) {
      const host = ctx.host;
      const a = new Application();
      app = a;
      ready = a
        .init({
          resizeTo: host,
          background: "#07080c",
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        })
        .then(() => {
          if (app !== a) {
            a.destroy(true);
            return;
          }
          host.appendChild(a.canvas);
          world = new World(a, controller);
          a.ticker.add(tick);
          if (!running) a.ticker.stop();
          controller.mounted = true;
        });
    },
    ready: () => ready,
    activate() {
      running = true;
      controller.running = true;
      app?.ticker?.start();
    },
    suspend() {
      running = false;
      controller.running = false;
      app?.ticker?.stop();
    },
    destroy() {
      world?.destroy();
      world = null;
      app?.destroy(true, { children: true });
      app = null;
      controller.mounted = false;
      controller.running = false;
    },
    capture() {
      return new Promise<Blob | null>((resolve) => {
        const a = app;
        if (!a || !world) return resolve(null);
        const timer = setTimeout(() => resolve(null), 1500);
        try {
          a.renderer.render(a.stage); // draw and read in the same tick (WebGL clears afterwards)
          (a.canvas as HTMLCanvasElement).toBlob((blob) => {
            clearTimeout(timer);
            resolve(blob);
          }, "image/png");
        } catch {
          clearTimeout(timer);
          resolve(null);
        }
      });
    },
  };
}
```

- [ ] **Step 6: Write `module.ts`, `index.ts`, `module.meta.json`**

`module.ts`:

```ts
import { defineModule, type Module } from "@idosgames/module-sdk";
import { createAgentApi } from "./game/agent";
import { GameController } from "./game/controller";
import { createGameScene } from "./fx/GameScene";
import { makeGamePanel } from "./ui/GamePanel";

// Casecremental: a Scritchy Scratchy-style incremental where the scratch ticket is a weapon case.
// One controller for the session; the Pixi scene renders it, the React panel draws HUD and shop,
// and the agent surface exposes it — all three go through controller.act().
export const casecrementalModule: Module = defineModule({
  id: "casecremental",
  meta: {
    name: "Casecremental",
    type: "game",
    genre: "incremental",
    // Pixi renders through the scene; use "pixi" here if the SDK's engine union has it (Task 13, Step 1).
    engine: "dom",
  },
  setup(ctx) {
    const controller = new GameController();
    ctx.registerScene(createGameScene(controller));
    ctx.registerPanel({ id: "game", slot: "overlay", component: makeGamePanel(controller) });
    ctx.registerRoute({ id: "casecremental", label: "Casecremental", icon: "📦" });
    ctx.exposeToAgent(createAgentApi(controller));
  },
});
```

`index.ts`:

```ts
export { casecrementalModule } from "./module";
```

`module.meta.json`:

```json
{
  "id": "casecremental",
  "type": "template",
  "summary": "Incremental case opener: open CS-style cases by hand, sell the skins, automate everything, and escalate from calm to casino-on-drugs.",
  "description": "A Scritchy Scratchy-style incremental game with weapon cases instead of scratch tickets. Buy a case, drag the key in, watch or brake the reel, drag the skin to the sell bin; upgrades and new cases unlock as you go, and the screen escalates from sober to cyberpsychosis.",
  "provides": [
    "case opening with a CS-style reel and near misses",
    "skins with rarity, wear and StatTrak",
    "upgrades and a case ladder",
    "intensity stages that escalate the visuals"
  ],
  "tags": ["incremental", "idle", "cases", "skins", "pixi"],
  "author": { "name": "Yerassyl Omirtay" },
  "version": "0.1.0"
}
```

- [ ] **Step 7: Register the module in `src/modules.ts`**

Replace the last line (`export const modules: Module[] = [];`) and add the import:

```ts
import type { Module } from "@idosgames/module-sdk";
import { casecrementalModule } from "./modules/casecremental";
```

```ts
export const modules: Module[] = [casecrementalModule];
```

(Keep the file's explanatory comment between the imports and the array.)

- [ ] **Step 8: Typecheck, build, test**

Run: `npm run typecheck && npm run build && npx vitest run`
Expected: all green. Fix type errors against the real SDK types (e.g. a missing `surface` value or `ready` name) by following the `.d.ts` from Step 1.

- [ ] **Step 9: See it in a browser**

Run `npm run dev` in the background, open `http://localhost:5180` (use the claude-in-chrome skill if available; otherwise ask the user to open it and describe what they see). Sign in as a guest.
Expected: after sign-in the app goes straight to Casecremental: a near-black canvas with a dark reel band near the top and `$6.00` in gold at the top center; the base's small "to the lobby" button top-left. No errors in the browser console. Resize the window: the band stays centered.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: casecremental module with Pixi scene, HUD stub and agent surface

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 14: The reel and the bench — playable by hand

**Files:**
- Create: `fx/skins/skinTexture.ts`, `fx/drag.ts`, `fx/ReelView.ts`, `fx/BenchView.ts`
- Modify: `fx/World.ts` (full replacement)

**Interfaces:**
- Consumes: `renderPattern`, `SILHOUETTES`, `SILHOUETTE_BOX`, `buildStrip`, `WIN_INDEX`, `reelFraction`, `ReelMotion`, `Layout`, `Point`, `Rect`, `KEY_RADIUS`, `RARITY_INFO`, `skinDisplayName`, `caseById`, `skinById`, `wearOf`, `formatCash`, `GameController`, `Bench`, `SimEvent`.
- Produces:
  - `SKIN_TEX_W = 200`, `SKIN_TEX_H = 80`, `skinCanvas(skin)`, `skinTexture(skin): Texture` (cached), `clearSkinTextures()`
  - `makeDraggable(target: Container, opts: { home(): Point; onDrop(p: Point): boolean; onTap?(): void }): () => void`
  - `class ReelView extends Container { constructor(onTick: () => void); layout(rect, itemW, itemH); start(c, winner, rng); update(motion: ReelMotion | null) }`, `makeCard(skin, w, h): Container`
  - `class BenchView extends Container { constructor(controller); layout(l); showCase(c); showReveal(skin, drop); clearReveal(); update(bench, dt) }`

- [ ] **Step 1: Write `fx/skins/skinTexture.ts`**

```ts
import { Texture } from "pixi.js";
import type { SkinDef } from "../../sim/types";
import { renderPattern } from "./patterns";
import { SILHOUETTE_BOX, SILHOUETTES } from "./silhouettes";

// A skin = its pattern clipped to its weapon's silhouette, with a dark outline. Rendered once per
// skin on a 2D canvas and cached as a Pixi texture.

export const SKIN_TEX_W = 200;
export const SKIN_TEX_H = 80;
const PAD = 4;
const cache = new Map<string, Texture>();

function weaponPath(skin: SkinDef): Path2D {
  const sx = (SKIN_TEX_W - PAD * 2) / SILHOUETTE_BOX.w;
  const sy = (SKIN_TEX_H - PAD * 2) / SILHOUETTE_BOX.h;
  const path = new Path2D();
  SILHOUETTES[skin.weapon].forEach(([x, y], i) => {
    if (i === 0) path.moveTo(PAD + x * sx, PAD + y * sy);
    else path.lineTo(PAD + x * sx, PAD + y * sy);
  });
  path.closePath();
  return path;
}

export function skinCanvas(skin: SkinDef): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SKIN_TEX_W;
  canvas.height = SKIN_TEX_H;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  g.putImageData(new ImageData(renderPattern(skin.pattern, SKIN_TEX_W, SKIN_TEX_H), SKIN_TEX_W, SKIN_TEX_H), 0, 0);
  const path = weaponPath(skin);
  g.globalCompositeOperation = "destination-in";
  g.fill(path);
  g.globalCompositeOperation = "source-over";
  g.lineWidth = 2;
  g.strokeStyle = "rgba(0,0,0,0.85)";
  g.stroke(path);
  return canvas;
}

export function skinTexture(skin: SkinDef): Texture {
  let t = cache.get(skin.id);
  if (!t) {
    t = Texture.from(skinCanvas(skin));
    cache.set(skin.id, t);
  }
  return t;
}

export function clearSkinTextures(): void {
  for (const t of cache.values()) t.destroy(true);
  cache.clear();
}
```

- [ ] **Step 2: Write `fx/drag.ts`**

```ts
import type { Container, FederatedPointerEvent } from "pixi.js";
import type { Point } from "./layout";

// Drag-and-drop for the tactile chores (the key into the lock, the skin into the sell bin).
// A press that barely moves counts as a tap — the fallback for phones and quick players. After
// release the target always returns home; an accepted drop has already changed the game.

export interface DragOptions {
  home(): Point;
  /** Position in the target's parent space; return true if the drop did something. */
  onDrop(p: Point): boolean;
  onTap?(): void;
}

const TAP_SLOP = 6;

export function makeDraggable(target: Container, opts: DragOptions): () => void {
  let dragging = false;
  let moved = 0;
  let start: Point = { x: 0, y: 0 };
  let grab: Point = { x: 0, y: 0 };
  const local = (e: FederatedPointerEvent): Point => {
    const p = (target.parent ?? target).toLocal(e.global);
    return { x: p.x, y: p.y };
  };

  const down = (e: FederatedPointerEvent) => {
    dragging = true;
    moved = 0;
    start = local(e);
    grab = { x: start.x - target.x, y: start.y - target.y };
    target.cursor = "grabbing";
    e.stopPropagation();
  };
  const move = (e: FederatedPointerEvent) => {
    if (!dragging) return;
    const p = local(e);
    moved = Math.max(moved, Math.hypot(p.x - start.x, p.y - start.y));
    target.position.set(p.x - grab.x, p.y - grab.y);
  };
  const up = (e: FederatedPointerEvent) => {
    if (!dragging) return;
    dragging = false;
    target.cursor = "grab";
    if (moved < TAP_SLOP) opts.onTap?.();
    else opts.onDrop(local(e));
    const h = opts.home();
    target.position.set(h.x, h.y);
  };

  target.eventMode = "static";
  target.cursor = "grab";
  target.on("pointerdown", down);
  target.on("globalpointermove", move);
  target.on("pointerup", up);
  target.on("pointerupoutside", up);
  return () => {
    target.off("pointerdown", down);
    target.off("globalpointermove", move);
    target.off("pointerup", up);
    target.off("pointerupoutside", up);
  };
}
```

- [ ] **Step 3: Write `fx/ReelView.ts`**

```ts
import { Container, Graphics, Sprite } from "pixi.js";
import { RARITY_INFO } from "../sim/rarity";
import type { Rng } from "../sim/rng";
import type { CaseDef, SkinDef } from "../sim/types";
import type { Rect } from "./layout";
import { reelFraction, type ReelMotion } from "./reel/motion";
import { buildStrip, WIN_INDEX } from "./reel/strip";
import { SKIN_TEX_H, SKIN_TEX_W, skinTexture } from "./skins/skinTexture";

// The CS-style reel: a strip of skin cards scrolling under a gold marker, landing on the rolled
// skin a random fraction off-center. onTick fires each time a card passes the marker.

const GAP = 6;

export function makeCard(skin: SkinDef, w: number, h: number): Container {
  const color = RARITY_INFO[skin.rarity].color;
  const card = new Container();
  card.addChild(new Graphics().roundRect(0, 0, w, h, 6).fill({ color: 0x1a1d27 }));
  card.addChild(new Graphics().roundRect(0, 0, w, h, 6).fill({ color, alpha: 0.14 }));
  const sprite = new Sprite(skinTexture(skin));
  sprite.anchor.set(0.5);
  sprite.scale.set(Math.min((w - 8) / SKIN_TEX_W, (h - 14) / SKIN_TEX_H));
  sprite.position.set(w / 2, (h - 5) / 2);
  card.addChild(sprite);
  card.addChild(new Graphics().rect(0, h - 5, w, 5).fill({ color }));
  return card;
}

export class ReelView extends Container {
  private readonly frame = new Graphics();
  private readonly strip = new Container();
  private readonly clip = new Graphics();
  private readonly marker = new Graphics();
  private rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private itemW = 100;
  private itemH = 75;
  private items: SkinDef[] = [];
  private jitter = 0;
  private fraction = 0;
  private lastIndex = -1;

  constructor(private readonly onTick: () => void) {
    super();
    this.addChild(this.frame, this.strip, this.clip, this.marker);
    this.strip.mask = this.clip;
  }

  layout(rect: Rect, itemW: number, itemH: number): void {
    this.rect = rect;
    this.itemW = itemW;
    this.itemH = itemH;
    this.position.set(rect.x, rect.y);
    this.frame.clear().roundRect(0, 0, rect.w, rect.h, 10).fill({ color: 0x0e1016 }).stroke({ width: 2, color: 0x2a2f3d });
    this.clip.clear().rect(4, 4, rect.w - 8, rect.h - 8).fill({ color: 0xffffff });
    this.marker.clear().rect(rect.w / 2 - 1.5, 2, 3, rect.h - 4).fill({ color: 0xffd34d });
    this.rebuild();
    this.place(this.fraction, false);
  }

  /** A new spin: a fresh strip that ends on `winner`. */
  start(c: CaseDef, winner: SkinDef, rng: Rng): void {
    this.items = buildStrip(c, winner, rng);
    this.jitter = (rng.next() - 0.5) * 0.7;
    this.fraction = 0;
    this.lastIndex = -1;
    this.rebuild();
    this.place(0, false);
  }

  update(motion: ReelMotion | null): void {
    if (!motion) return;
    this.fraction = reelFraction(motion);
    this.place(this.fraction, true);
  }

  private place(f: number, sound: boolean): void {
    const from = this.itemW * 2.5;
    const to = WIN_INDEX * this.itemW + this.itemW / 2 + this.jitter * this.itemW;
    const p = from + f * (to - from);
    this.strip.x = this.rect.w / 2 - p;
    const index = Math.floor(p / this.itemW);
    if (index !== this.lastIndex) {
      if (sound && this.lastIndex >= 0) this.onTick();
      this.lastIndex = index;
    }
  }

  private rebuild(): void {
    for (const child of this.strip.removeChildren()) child.destroy({ children: true });
    this.items.forEach((skin, i) => {
      const card = makeCard(skin, this.itemW - GAP, this.itemH);
      card.position.set(i * this.itemW + GAP / 2, (this.rect.h - this.itemH) / 2);
      this.strip.addChild(card);
    });
  }
}
```

- [ ] **Step 4: Write `fx/BenchView.ts`**

```ts
import { Circle, Container, Graphics, Text, type FederatedPointerEvent } from "pixi.js";
import type { GameController } from "../game/controller";
import { skinDisplayName } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import { RARITY_INFO } from "../sim/rarity";
import type { Bench } from "../sim/run";
import type { CaseDef, Drop, SkinDef } from "../sim/types";
import { wearOf } from "../sim/wear";
import { makeDraggable } from "./drag";
import { KEY_RADIUS, type Layout, type Point } from "./layout";
import { makeCard } from "./ReelView";

// The bench: the bought case with its lock, the key (drag it into the lock), the revealed skin
// (drag it into the sell bin) and the sell bin. Taps work too. All changes go through controller.act.

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function hintFor(b: Bench, canBrake: boolean): string {
  switch (b.phase) {
    case "empty":
      return "Buy a case below ↓";
    case "locked":
      return "Drag the key into the lock";
    case "spinning":
      return canBrake ? "Click to slam the brakes!" : "";
    case "revealed":
      return "Drag it to SELL →";
  }
}

export class BenchView extends Container {
  private readonly caseBox = new Container();
  private readonly caseBody = new Graphics();
  private readonly caseLabel = new Text({ text: "", style: { fontFamily: FONT, fontSize: 13, fontWeight: "700", fill: 0xffffff } });
  private readonly lock = new Graphics();
  private readonly key = new Graphics();
  private readonly bin = new Container();
  private readonly binBody = new Graphics();
  private readonly binLabel = new Text({ text: "SELL", style: { fontFamily: FONT, fontSize: 16, fontWeight: "900", fill: 0x0b0d12 } });
  private readonly reveal = new Container();
  private readonly hint = new Text({ text: "", style: { fontFamily: FONT, fontSize: 13, fill: 0xc8cbd6 } });
  private l: Layout | null = null;
  private caseColor = 0x4b5320;
  private caseName = "";
  private pop = 1;
  private clock = 0;

  constructor(private readonly controller: GameController) {
    super();
    this.caseLabel.anchor.set(0.5);
    this.binLabel.anchor.set(0.5);
    this.hint.anchor.set(0.5, 0);
    this.caseBox.addChild(this.caseBody, this.caseLabel, this.lock);
    this.bin.addChild(this.binBody, this.binLabel);
    this.addChild(this.caseBox, this.bin, this.reveal, this.key, this.hint);

    this.key
      .circle(-12, 0, 11).fill({ color: 0xffd34d }).stroke({ width: 2, color: 0x8a6d1a })
      .rect(-2, -3, 28, 6).fill({ color: 0xffd34d })
      .rect(18, 3, 4, 6).fill({ color: 0xffd34d })
      .rect(24, 3, 3, 4).fill({ color: 0xffd34d });
    this.key.hitArea = new Circle(0, 0, KEY_RADIUS);

    makeDraggable(this.key, {
      home: () => this.l?.keyHome ?? { x: 0, y: 0 },
      onTap: () => void this.controller.act({ type: "insertKey" }),
      onDrop: (p) => !!this.l && dist(p, this.l.lock) < 70 && this.controller.act({ type: "insertKey" }).ok,
    });
    makeDraggable(this.reveal, {
      home: () => this.l?.bench ?? { x: 0, y: 0 },
      onTap: () => void this.controller.act({ type: "sell" }),
      onDrop: (p) => !!this.l && dist(p, this.l.sellBin) < this.l.sellBin.r + 60 && this.controller.act({ type: "sell" }).ok,
    });
    this.bin.eventMode = "static";
    this.bin.cursor = "pointer";
    this.bin.on("pointertap", (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.controller.act({ type: "sell" });
    });
  }

  layout(l: Layout): void {
    this.l = l;
    this.caseBox.position.set(l.bench.x, l.bench.y);
    this.drawCase();
    this.key.position.set(l.keyHome.x, l.keyHome.y);
    this.bin.position.set(l.sellBin.x, l.sellBin.y);
    this.binBody.clear().circle(0, 0, l.sellBin.r).fill({ color: 0x3ddc84 }).stroke({ width: 3, color: 0x1f8f52 });
    this.reveal.position.set(l.bench.x, l.bench.y);
    this.hint.position.set(l.bench.x, l.reel.y + l.reel.h + 4);
  }

  showCase(c: CaseDef): void {
    this.caseColor = Number.parseInt(c.color.slice(1), 16);
    this.caseName = c.name;
    this.drawCase();
    this.pop = 0.6;
  }

  showReveal(skin: SkinDef, drop: Drop): void {
    this.clearReveal();
    if (!this.l) return;
    const { w, h } = this.l.revealSize;
    const card = makeCard(skin, w, h * 0.7);
    card.position.set(-w / 2, -h / 2);
    const name = new Text({
      text: skinDisplayName(skin),
      style: { fontFamily: FONT, fontSize: Math.max(11, w * 0.075), fontWeight: "800", fill: 0xffffff },
    });
    name.anchor.set(0.5, 0);
    name.position.set(0, -h / 2 + h * 0.71);
    const info = new Text({
      text: `${wearOf(drop.float).name}${drop.statTrak ? " · StatTrak™" : ""} · ${formatCash(drop.value)}`,
      style: { fontFamily: FONT, fontSize: Math.max(10, w * 0.06), fill: RARITY_INFO[drop.rarity].color },
    });
    info.anchor.set(0.5, 0);
    info.position.set(0, -h / 2 + h * 0.86);
    this.reveal.addChild(card, name, info);
    this.reveal.position.set(this.l.bench.x, this.l.bench.y);
    this.pop = 0.5;
  }

  clearReveal(): void {
    for (const child of this.reveal.removeChildren()) child.destroy({ children: true });
  }

  update(b: Bench, dt: number): void {
    this.clock += dt;
    const locked = b.phase === "locked";
    this.caseBox.visible = locked || b.phase === "spinning";
    this.caseBox.alpha = b.phase === "spinning" ? 0.45 : 1;
    this.pop += (1 - this.pop) * Math.min(1, dt * 10);
    this.caseBox.scale.set(this.pop);
    this.reveal.scale.set(this.pop);
    this.reveal.visible = b.phase === "revealed";
    this.key.eventMode = locked ? "static" : "none";
    this.key.alpha = locked ? 1 : 0.35;
    this.key.scale.set(locked ? 1 + 0.06 * Math.sin(this.clock * 6) : 1);
    this.bin.scale.set(b.phase === "revealed" ? 1 + 0.05 * Math.sin(this.clock * 8) : 1);
    const hint = hintFor(b, this.controller.run.canBrake());
    if (this.hint.text !== hint) this.hint.text = hint;
  }

  private drawCase(): void {
    if (!this.l) return;
    const { w, h } = this.l.caseSize;
    this.caseBody
      .clear()
      .roundRect(-w / 2, -h / 2, w, h, 8).fill({ color: this.caseColor }).stroke({ width: 3, color: 0x000000, alpha: 0.5 })
      .rect(-w / 2, -h * 0.1, w, h * 0.2).fill({ color: 0x000000, alpha: 0.25 });
    this.caseLabel.text = this.caseName;
    this.caseLabel.style.fontSize = Math.max(10, w * 0.1);
    this.caseLabel.position.set(0, h * 0.3);
    const r = Math.min(14, h * 0.2);
    this.lock
      .clear()
      .circle(0, -h * 0.1, r).fill({ color: 0xffd34d }).stroke({ width: 2, color: 0x8a6d1a })
      .rect(-2, -h * 0.1 - r * 0.4, 4, r * 0.8).fill({ color: 0x3a2c05 });
  }
}
```

- [ ] **Step 5: Replace `fx/World.ts`**

```ts
import { Application, Container, Graphics } from "pixi.js";
import type { GameController } from "../game/controller";
import { caseById, skinById } from "../sim/content/cases";
import { createRng } from "../sim/rng";
import type { SimEvent } from "../sim/run";
import { BenchView } from "./BenchView";
import { computeLayout, type Layout } from "./layout";
import { ReelView } from "./ReelView";
import { clearSkinTextures } from "./skins/skinTexture";

// Everything drawn on the canvas: background, reel, bench. Juice arrives in Task 16.

export class World {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly reel: ReelView;
  private readonly bench: BenchView;
  /** Visual-only randomness (strip filler, landing jitter) — never the outcome. */
  private readonly rng = createRng(0x5eed);
  private layout: Layout;
  private readonly off: () => void;

  constructor(
    private readonly app: Application,
    private readonly controller: GameController,
  ) {
    this.reel = new ReelView(() => {});
    this.bench = new BenchView(controller);
    this.root.addChild(this.bg, this.reel, this.bench);
    app.stage.addChild(this.root);
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointerdown", () => {
      if (controller.run.state.bench.phase === "spinning") controller.act({ type: "brake" });
    });
    this.off = controller.onEvent((e) => this.onEvent(e));
    const first = caseById("bootcamp");
    this.reel.start(first, this.rng.pick(first.skins), this.rng);
    this.layout = computeLayout(app.screen.width, app.screen.height);
    this.applyLayout();
  }

  timeScale(_realSeconds: number): number {
    return 1;
  }

  update(realSeconds: number, scale: number): void {
    const { width, height } = this.app.screen;
    if (width !== this.layout.width || height !== this.layout.height) {
      this.layout = computeLayout(width, height);
      this.applyLayout();
    }
    const b = this.controller.run.state.bench;
    this.reel.update(b.phase === "spinning" ? b : null);
    this.bench.update(b, realSeconds * scale);
  }

  destroy(): void {
    this.off();
    this.app.stage.removeAllListeners();
    this.root.destroy({ children: true });
    clearSkinTextures();
  }

  private applyLayout(): void {
    const l = this.layout;
    this.bg.clear().rect(0, 0, l.width, l.height).fill({ color: 0x07080c });
    this.reel.layout(l.reel, l.itemW, l.itemH);
    this.bench.layout(l);
  }

  private onEvent(e: SimEvent): void {
    switch (e.type) {
      case "caseBought":
        this.bench.showCase(caseById(e.caseId));
        break;
      case "spinStarted":
        this.reel.start(caseById(e.caseId), skinById(e.drop.skinId), this.rng);
        break;
      case "revealed":
        this.bench.showReveal(skinById(e.drop.skinId), e.drop);
        break;
      case "sold":
        this.bench.clearReveal();
        break;
      default:
        break;
    }
  }
}
```

- [ ] **Step 6: Typecheck, build, test**

Run: `npm run typecheck && npm run build && npx vitest run`
Expected: all green.

- [ ] **Step 7: Play it in the browser**

With `npm run dev` running, open the game (sign in as guest). The shop arrives in Task 15, so buy cases from the console for this check: in `module.ts` `setup`, add for this check only `(globalThis as Record<string, unknown>).cc = controller;`, reload, then in the console run `cc.act({type:"buyCase", caseId:"bootcamp"})`. Expected:
1. A Boot Camp case pops onto the bench; the hint reads "Drag the key into the lock".
2. Dragging the gold key onto the lock (or tapping it) starts the reel: skins scroll and slow down over ~6 s.
3. Clicking anywhere after ~1.5 s brakes: the reel snaps to a stop within ~0.35 s.
4. The revealed skin card shows name, wear and value; dragging it onto the green SELL bin (or tapping it) sells it; cash rises.
Remove the `globalThis.cc` line afterwards.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(fx): playable reel and bench - drag key, brake, drag skin to sell

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 15: HUD and shop panel

**Files:**
- Create: `ui/Hud.tsx`, `ui/Shop.tsx`
- Modify: `ui/GamePanel.tsx` (full replacement)

**Interfaces:**
- Consumes: `GameView`, `CaseView`, `UpgradeView`, `Action`, `GameController`, `formatCash`, `HUD_HEIGHT`, `SHOP_FRACTION`; from `@idosgames/react/ui`: `Button`, `outlined`, `v`.
- Produces: `Hud({ view })`, `Shop({ view, act })`, final `makeGamePanel(controller)`.

- [ ] **Step 1: Check the kit's Button props**

Run: `grep -rn "function Button\|ButtonProps" -A 15 node_modules/@idosgames/react/dist/ui/*.d.ts | head -40`
Expected: `tone?` (includes `"grey"` and `"blue"`), `size?` (`"sm" | "lg" | …`), and standard button attributes (`disabled`, `onClick`). If `disabled` is missing, pass `style={{ opacity: 0.45, pointerEvents: "none" }}` instead wherever the code below sets `disabled`.

- [ ] **Step 2: Write `ui/Hud.tsx`**

```tsx
import type { ReactNode } from "react";
import { outlined, v } from "@idosgames/react/ui";
import type { GameView } from "../game/view";
import { formatCash } from "../sim/format";
import { HUD_HEIGHT } from "../fx/layout";

// Top of the screen: cash, the intensity stage, the combo and the next goal — always visible
// (spec §9.2: a goal is always on screen).

export function Hud({ view }: { view: GameView }): ReactNode {
  return (
    <div style={{ position: "absolute", top: 6, left: 0, right: 0, height: HUD_HEIGHT - 6, display: "grid", justifyItems: "center", alignContent: "start", gap: 4 }}>
      <div style={{ ...outlined, fontSize: 30, lineHeight: 1.1, color: v.gold }}>{formatCash(view.cash)}</div>
      <div style={{ display: "flex", gap: 12, ...outlined, fontSize: 13 }}>
        <span style={{ color: view.stage >= 2 ? "#ff7ad9" : v.textDim }}>{view.stageName}</span>
        {view.combo > 1 ? <span style={{ color: "#7affc1" }}>COMBO ×{view.comboMult.toFixed(2)}</span> : null}
      </div>
      {view.nextGoal ? (
        <div style={{ width: "min(320px, 80vw)", display: "grid", gap: 2 }}>
          <div style={{ ...outlined, fontSize: 11, color: v.textDim, textAlign: "center" }}>{view.nextGoal.label}</div>
          <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
            <div style={{ width: `${Math.round(view.nextGoal.progress * 100)}%`, height: "100%", background: view.nextGoal.progress >= 1 ? "#3ddc84" : v.gold, transition: "width .2s" }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Write `ui/Shop.tsx`**

```tsx
import { useState, type ReactNode } from "react";
import { Button, outlined, v } from "@idosgames/react/ui";
import type { Action } from "../game/controller";
import type { CaseView, GameView, UpgradeView } from "../game/view";
import { formatCash } from "../sim/format";
import { SHOP_FRACTION } from "../fx/layout";

// Bottom panel: buy and unlock cases, buy upgrades. Every button sends an Action through the
// controller — the same path as the canvas and the agent.

type Tab = "cases" | "upgrades";
type Act = (a: Action) => void;

const card = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
} as const;

function CaseCard({ c, act }: { c: CaseView; act: Act }): ReactNode {
  return (
    <div style={card}>
      <div style={{ width: 34, height: 24, borderRadius: 4, background: c.color, opacity: c.unlocked ? 1 : 0.35 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ ...outlined, fontSize: 14 }}>{c.name}</div>
        <div style={{ fontSize: 11, color: v.textDim }}>{c.theme}</div>
      </div>
      {c.unlocked ? (
        <Button size="sm" disabled={!c.canBuy} onClick={() => act({ type: "buyCase", caseId: c.id })}>
          Buy {formatCash(c.price)}
        </Button>
      ) : (
        <Button size="sm" tone="blue" disabled={!c.canUnlock} onClick={() => act({ type: "unlockCase", caseId: c.id })}>
          Unlock {formatCash(c.unlockCost)}
        </Button>
      )}
    </div>
  );
}

function UpgradeRow({ u, act }: { u: UpgradeView; act: Act }): ReactNode {
  return (
    <div style={card}>
      <div style={{ ...outlined, fontSize: 12, color: v.gold, minWidth: 44 }}>
        Lv {u.level}/{u.maxLevel}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...outlined, fontSize: 14 }}>{u.name}</div>
        <div style={{ fontSize: 11, color: v.textDim }}>{u.description}</div>
      </div>
      {u.cost === null ? (
        <Button size="sm" tone="grey" disabled>
          MAX
        </Button>
      ) : (
        <Button size="sm" disabled={!u.canBuy} onClick={() => act({ type: "buyUpgrade", id: u.id })}>
          {formatCash(u.cost)}
        </Button>
      )}
    </div>
  );
}

export function Shop({ view, act }: { view: GameView; act: Act }): ReactNode {
  const [tab, setTab] = useState<Tab>("cases");
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: `${SHOP_FRACTION * 100}%`,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, rgba(10,12,18,0.92), rgba(6,7,11,0.98))",
        borderTop: "1px solid #2a2f3d",
        paddingBottom: "var(--idos-safe-bottom, 0px)",
      }}
    >
      <div style={{ display: "flex", gap: 8, padding: "8px 12px" }}>
        <Button size="sm" tone={tab === "cases" ? undefined : "grey"} onClick={() => setTab("cases")}>
          Cases
        </Button>
        <Button size="sm" tone={tab === "upgrades" ? undefined : "grey"} onClick={() => setTab("upgrades")}>
          Upgrades
        </Button>
      </div>
      <div
        className="idos-scroll"
        style={{ overflowY: "auto", padding: "0 12px 12px", display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", alignContent: "start" }}
      >
        {tab === "cases"
          ? view.cases.map((c) => <CaseCard key={c.id} c={c} act={act} />)
          : view.upgrades.map((u) => <UpgradeRow key={u.id} u={u} act={act} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace `ui/GamePanel.tsx`**

```tsx
import type { ComponentType, ReactNode } from "react";
import { v } from "@idosgames/react/ui";
import type { GameController } from "../game/controller";
import { Hud } from "./Hud";
import { Shop } from "./Shop";
import { useGameView } from "./useGameView";

// The overlay over the canvas. The layer itself lets pointer events through to the canvas (drag
// the key, brake, drag the skin); only the HUD's and the shop's controls take them.

export function makeGamePanel(controller: GameController): ComponentType {
  const act = (a: Parameters<GameController["act"]>[0]) => void controller.act(a);
  return function GamePanel(): ReactNode {
    const view = useGameView(controller);
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: v.font, color: v.text }}>
        <Hud view={view} />
        <Shop view={view} act={act} />
      </div>
    );
  };
}
```

- [ ] **Step 5: Typecheck, build, test**

Run: `npm run typecheck && npm run build && npx vitest run`
Expected: all green.

- [ ] **Step 6: Play it in the browser**

Reload the game. Expected:
1. Top: cash, "Sober", and an "Unlock Wildwood Case" bar filling with cash.
2. Bottom panel, "Cases" tab: Boot Camp with "Buy $2.00"; Wildwood and Bedrock with disabled "Unlock" buttons. "Upgrades" tab: Luck, Appraiser, Quick Hands with prices.
3. Full loop by hand: Buy → drag key → brake → drag skin to SELL → cash and combo rise; buy Appraiser; keep going until "Unlock Wildwood" lights up, unlock it, buy a Wildwood case — its skins have leaf/bark/moss finishes.
4. Phone check: DevTools device toolbar at 360 × 640 — nothing overlaps or scrolls sideways; the shop scrolls inside its panel.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): HUD with next-goal bar and shop panel for cases and upgrades

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 16: Juice — particles, coins, sound, stage look, hit-stop and slow-mo

**Files:**
- Create: `fx/juice/particles.ts`, `fx/juice/coins.ts`, `fx/juice/stageLook.ts`, `fx/audio.ts`
- Modify: `fx/World.ts` (full replacement)

**Interfaces:**
- Consumes: `TimeScale`, `Shake`, `RARITY_INFO`, `RARITY_ORDER`, `formatCash`, `Layout`, `Point`, `ColorMatrixFilter` (pixi.js), `AdvancedBloomFilter` (pixi-filters).
- Produces:
  - `class Particles { container; constructor(texture, max = 1500); burst(at, color, count, speed); update(dt) }`
  - `class Coins { container; constructor(coinTexture); burst(from, to, amount); floatText(at, text, color?); update(dt) }`
  - `class StageLook { constructor(target: Container); setStage(stage); update(dt) }`
  - `class Sfx { unlock(); tick(combo); click(); thump(strength); coin(combo); reveal(rarityIndex); jackpot(); stageUp(); dispose() }`
  - final `World`

- [ ] **Step 1: Write `fx/juice/particles.ts`**

```ts
import { Container, Sprite, type Texture } from "pixi.js";
import type { Point } from "../layout";

// Pooled sprite sparks: bursts on reveals, tinted by rarity, falling with gravity and fading out.

interface Spark {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  age: number;
}

const GRAVITY = 600;

export class Particles {
  readonly container = new Container();
  private readonly pool: Sprite[] = [];
  private live: Spark[] = [];

  constructor(
    private readonly texture: Texture,
    private readonly max = 1500,
  ) {}

  burst(at: Point, color: number, count: number, speed: number): void {
    for (let i = 0; i < count && this.live.length < this.max; i++) {
      const s = this.pool.pop() ?? new Sprite(this.texture);
      s.anchor.set(0.5);
      s.tint = color;
      s.alpha = 1;
      s.position.set(at.x, at.y);
      s.scale.set(0.4 + Math.random() * 0.8);
      this.container.addChild(s);
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      this.live.push({ s, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 0.6 + Math.random() * 0.6, age: 0 });
    }
  }

  update(dt: number): void {
    this.live = this.live.filter((p) => {
      p.age += dt;
      if (p.age >= p.life) {
        this.container.removeChild(p.s);
        this.pool.push(p.s);
        return false;
      }
      p.vy += GRAVITY * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.alpha = 1 - p.age / p.life;
      return true;
    });
  }
}
```

- [ ] **Step 2: Write `fx/juice/coins.ts`**

```ts
import { Container, Sprite, Text, type Texture } from "pixi.js";
import type { Point } from "../layout";

// Money you can see: coins arc from the sold skin to the cash counter, and the amount floats up.

interface Flight {
  s: Sprite;
  from: Point;
  ctrl: Point;
  to: Point;
  delay: number;
  dur: number;
  age: number;
}
interface Floater {
  t: Text;
  age: number;
  y0: number;
}

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

export class Coins {
  readonly container = new Container();
  private flights: Flight[] = [];
  private floaters: Floater[] = [];

  constructor(private readonly coinTexture: Texture) {}

  burst(from: Point, to: Point, amount: number): void {
    const n = Math.min(24, Math.max(1, Math.round(Math.log10(amount + 1) * 4)));
    for (let i = 0; i < n; i++) {
      const s = new Sprite(this.coinTexture);
      s.anchor.set(0.5);
      s.visible = false;
      this.container.addChild(s);
      this.flights.push({
        s,
        from: { x: from.x + (Math.random() - 0.5) * 30, y: from.y + (Math.random() - 0.5) * 30 },
        ctrl: { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 120, y: Math.min(from.y, to.y) - 40 - Math.random() * 120 },
        to,
        delay: i * 0.025,
        dur: 0.55 + Math.random() * 0.25,
        age: 0,
      });
    }
  }

  floatText(at: Point, text: string, color = 0xffe27a): void {
    const t = new Text({ text, style: { fontFamily: FONT, fontSize: 22, fontWeight: "900", fill: color, stroke: { color: 0x000000, width: 4 } } });
    t.anchor.set(0.5);
    t.position.set(at.x, at.y);
    this.container.addChild(t);
    this.floaters.push({ t, age: 0, y0: at.y });
  }

  update(dt: number): void {
    this.flights = this.flights.filter((f) => {
      f.age += dt;
      const t = (f.age - f.delay) / f.dur;
      if (t < 0) return true;
      if (t >= 1) {
        f.s.destroy();
        return false;
      }
      const u = 1 - t;
      f.s.visible = true;
      f.s.x = u * u * f.from.x + 2 * u * t * f.ctrl.x + t * t * f.to.x;
      f.s.y = u * u * f.from.y + 2 * u * t * f.ctrl.y + t * t * f.to.y;
      f.s.scale.set(1 - 0.4 * t);
      return true;
    });
    this.floaters = this.floaters.filter((f) => {
      f.age += dt;
      const k = f.age / 0.9;
      if (k >= 1) {
        f.t.destroy();
        return false;
      }
      f.t.y = f.y0 - 60 * k;
      f.t.alpha = 1 - k * k;
      return true;
    });
  }
}
```

- [ ] **Step 3: Write `fx/juice/stageLook.ts`**

```ts
import { ColorMatrixFilter, type Container } from "pixi.js";
import { AdvancedBloomFilter } from "pixi-filters";

// The look of each intensity stage, eased over ~1 s. Stage 1 (Sober): muted colors, no glow.
// Stage 2 (Buzzed): full color and bloom. Stages 3–5 arrive in milestone 2.

export class StageLook {
  private readonly color = new ColorMatrixFilter();
  private readonly bloom = new AdvancedBloomFilter({ threshold: 0.45, bloomScale: 0, brightness: 1, blur: 6, quality: 4 });
  private sat = -0.35;
  private satTarget = -0.35;
  private bloomTarget = 0;

  constructor(target: Container) {
    target.filters = [this.color, this.bloom];
    this.apply();
  }

  setStage(stage: number): void {
    this.satTarget = stage >= 2 ? 0.15 : -0.35;
    this.bloomTarget = stage >= 2 ? 0.9 : 0;
  }

  update(dt: number): void {
    const k = Math.min(1, dt * 2);
    this.sat += (this.satTarget - this.sat) * k;
    this.bloom.bloomScale += (this.bloomTarget - this.bloom.bloomScale) * k;
    this.apply();
  }

  private apply(): void {
    this.color.reset();
    this.color.saturate(this.sat, false);
  }
}
```

- [ ] **Step 4: Write `fx/audio.ts`**

```ts
// Synthesized sound effects (WebAudio, no files). Browsers start audio suspended until a user
// gesture, so the World calls unlock() on the first pointerdown anywhere on the page.

type Webkit = { webkitAudioContext?: typeof AudioContext };

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  volume = 0.5;

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as Webkit).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  tick(combo: number): void {
    this.tone(900 + Math.min(combo, 50) * 12, 0.03, "square", 0.05);
  }

  click(): void {
    this.tone(500, 0.05, "triangle", 0.08);
  }

  thump(strength: number): void {
    this.tone(90, 0.35, "sine", 0.5 * strength, 40);
  }

  coin(combo: number): void {
    const f = 1200 * (1 + Math.min(combo, 50) * 0.02);
    this.tone(f, 0.08, "triangle", 0.12);
    setTimeout(() => this.tone(f * 1.5, 0.12, "triangle", 0.1), 60);
  }

  /** 0 = Mil-Spec … 4 = ★: higher rarities ring higher and longer. */
  reveal(rarityIndex: number): void {
    const base = 440 * 2 ** (rarityIndex / 4);
    [0, 4, 7].slice(0, 1 + Math.min(2, rarityIndex)).forEach((semi, i) =>
      setTimeout(() => this.tone(base * 2 ** (semi / 12), 0.25, "triangle", 0.12), i * 70),
    );
  }

  jackpot(): void {
    [0, 4, 7, 12, 16, 19, 24].forEach((semi, i) =>
      setTimeout(() => this.tone(523 * 2 ** (semi / 12), 0.4, "sawtooth", 0.08), i * 90),
    );
    this.thump(1);
  }

  stageUp(): void {
    this.tone(220, 0.6, "sawtooth", 0.1, 880);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number): void {
    const c = this.ctx;
    const m = this.master;
    if (!c || !m || c.state !== "running") return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(m);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }
}
```

- [ ] **Step 5: Replace `fx/World.ts`**

```ts
import { Application, Container, Graphics, type Texture } from "pixi.js";
import type { GameController } from "../game/controller";
import { caseById, skinById } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import { RARITY_INFO, RARITY_ORDER } from "../sim/rarity";
import { createRng } from "../sim/rng";
import type { SimEvent } from "../sim/run";
import type { Drop } from "../sim/types";
import { Sfx } from "./audio";
import { BenchView } from "./BenchView";
import { Coins } from "./juice/coins";
import { Particles } from "./juice/particles";
import { Shake } from "./juice/shake";
import { StageLook } from "./juice/stageLook";
import { TimeScale } from "./juice/timeScale";
import { computeLayout, type Layout } from "./layout";
import { ReelView } from "./ReelView";
import { clearSkinTextures } from "./skins/skinTexture";

// Everything drawn on the canvas: background, reel, bench and the juice — sparks, coins, sound,
// screen shake, hit-stop on Covert, slow-mo + zoom on ★, and the look of the intensity stage.

export class World {
  private readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly reel: ReelView;
  private readonly bench: BenchView;
  private readonly particles: Particles;
  private readonly coins: Coins;
  private readonly look: StageLook;
  private readonly shake = new Shake();
  private readonly time = new TimeScale();
  private readonly sfx = new Sfx();
  /** Visual-only randomness (strip filler, landing jitter) — never the outcome. */
  private readonly rng = createRng(0x5eed);
  private readonly textures: Texture[];
  private layout: Layout;
  private zoom = 1;
  private zoomTarget = 1;
  private lastStage = 1;
  private readonly off: () => void;
  private readonly unlockAudio = () => this.sfx.unlock();

  constructor(
    private readonly app: Application,
    private readonly controller: GameController,
  ) {
    const dot = app.renderer.generateTexture(new Graphics().circle(0, 0, 6).fill({ color: 0xffffff }));
    const coin = app.renderer.generateTexture(
      new Graphics().circle(0, 0, 8).fill({ color: 0xffd34d }).stroke({ width: 2, color: 0xa87b12 }),
    );
    this.textures = [dot, coin];
    this.reel = new ReelView(() => this.sfx.tick(controller.run.state.combo));
    this.bench = new BenchView(controller);
    this.particles = new Particles(dot);
    this.coins = new Coins(coin);
    this.root.addChild(this.bg, this.reel, this.bench, this.particles.container, this.coins.container);
    this.look = new StageLook(this.root);
    app.stage.addChild(this.root);
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;
    app.stage.on("pointerdown", () => {
      if (controller.run.state.bench.phase === "spinning") controller.act({ type: "brake" });
    });
    window.addEventListener("pointerdown", this.unlockAudio);
    this.off = controller.onEvent((e) => this.onEvent(e));
    const first = caseById("bootcamp");
    this.reel.start(first, this.rng.pick(first.skins), this.rng);
    this.layout = computeLayout(app.screen.width, app.screen.height);
    this.applyLayout();
  }

  /** Real seconds → this frame's game-time scale (0 during hit-stop, <1 in slow-mo). */
  timeScale(realSeconds: number): number {
    return this.time.update(realSeconds);
  }

  update(realSeconds: number, scale: number): void {
    const { width, height } = this.app.screen;
    if (width !== this.layout.width || height !== this.layout.height) {
      this.layout = computeLayout(width, height);
      this.applyLayout();
    }
    const game = realSeconds * scale;
    const b = this.controller.run.state.bench;
    this.reel.update(b.phase === "spinning" ? b : null);
    this.bench.update(b, game);
    this.particles.update(game);
    this.coins.update(realSeconds);
    this.look.update(realSeconds);

    if (!this.time.active) this.zoomTarget = 1;
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, realSeconds * 6);
    const s = this.shake.update(realSeconds);
    const cx = this.layout.width / 2;
    const cy = this.layout.bench.y;
    this.root.pivot.set(cx, cy);
    this.root.position.set(cx + s.x, cy + s.y);
    this.root.scale.set(this.zoom);
  }

  destroy(): void {
    this.off();
    window.removeEventListener("pointerdown", this.unlockAudio);
    this.app.stage.removeAllListeners();
    this.root.destroy({ children: true });
    for (const t of this.textures) t.destroy(true);
    clearSkinTextures();
    this.sfx.dispose();
  }

  private applyLayout(): void {
    const l = this.layout;
    this.bg.clear().rect(-l.width, -l.height, l.width * 3, l.height * 3).fill({ color: 0x07080c });
    this.reel.layout(l.reel, l.itemW, l.itemH);
    this.bench.layout(l);
  }

  private onEvent(e: SimEvent): void {
    switch (e.type) {
      case "caseBought":
        this.bench.showCase(caseById(e.caseId));
        this.sfx.click();
        break;
      case "spinStarted":
        this.reel.start(caseById(e.caseId), skinById(e.drop.skinId), this.rng);
        this.sfx.click();
        break;
      case "braked":
        this.shake.add(0.12);
        this.sfx.thump(0.35);
        break;
      case "revealed":
        this.onReveal(e.drop);
        break;
      case "sold": {
        const at = this.layout.bench;
        this.coins.burst(at, this.layout.cashTarget, e.amount);
        this.coins.floatText({ x: at.x, y: at.y - 30 }, `+${formatCash(e.amount)}`);
        this.sfx.coin(e.combo);
        this.bench.clearReveal();
        break;
      }
      case "caseUnlocked":
      case "upgradeBought":
        this.sfx.click();
        break;
      case "stageChanged":
        this.look.setStage(e.stage);
        if (e.stage > this.lastStage) {
          this.shake.add(0.3);
          this.sfx.stageUp();
        }
        this.lastStage = e.stage;
        break;
    }
  }

  private onReveal(d: Drop): void {
    this.bench.showReveal(skinById(d.skinId), d);
    const at = this.layout.bench;
    const color = RARITY_INFO[d.rarity].color;
    this.sfx.reveal(RARITY_ORDER.indexOf(d.rarity));
    switch (d.rarity) {
      case "milspec":
        this.particles.burst(at, color, 10, 140);
        break;
      case "restricted":
        this.particles.burst(at, color, 24, 220);
        break;
      case "classified":
        this.particles.burst(at, color, 45, 300);
        this.shake.add(0.2);
        break;
      case "covert":
        this.time.hitStop(0.08);
        this.shake.add(0.55);
        this.sfx.thump(1);
        this.particles.burst(at, color, 90, 420);
        break;
      case "gold":
        this.time.slowMo(0.2, 2.2, 0.7);
        this.zoomTarget = 1.25;
        this.shake.add(0.8);
        this.sfx.jackpot();
        this.particles.burst(at, color, 220, 520);
        break;
    }
  }
}
```

- [ ] **Step 6: Typecheck, build, test**

Run: `npm run typecheck && npm run build && npx vitest run`
Expected: all green.

- [ ] **Step 7: Feel it in the browser**

Expected while playing:
1. Stage 1: colors look slightly muted; ticks sound as cards pass the marker.
2. Selling: coins arc to the cash counter, "+$…" floats up, a coin chime rises in pitch with the combo.
3. After ~30–60 s of fast play: the stage label turns "Buzzed", a rising whoosh plays, colors saturate and the reel glows.
4. Rare drops (to see them quickly, temporarily set `RARITY_BASE_WEIGHT.covert`/`gold` high in `tuning.ts`, then restore it and re-run the tests): Covert freezes for a blink with a bass hit and a red burst; ★ slows the world, zooms in, plays the jackpot arpeggio and showers gold.
5. Frame rate stays smooth (DevTools Performance: no long frames while bursting).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(fx): juice - sparks, flying coins, synth sfx, stage look, hit-stop and slow-mo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

---

### Task 17: Project docs and final verification

**Files:**
- Create: `docs/feature-history/casecremental-core.md`
- Modify: `docs/feature-history/README.md`, `IDOS.md`

- [ ] **Step 1: Write `docs/feature-history/casecremental-core.md`**

```markdown
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
```

- [ ] **Step 2: Add the index line and the installed-module line**

Append to `docs/feature-history/README.md`:

```markdown
- [Casecremental core loop](casecremental-core.md) — milestone 1: sim, reel, bench, upgrades, juice, stages 1–2
```

In `IDOS.md`, replace `_None yet._` between `<!-- idos:modules:start -->` and `<!-- idos:modules:end -->` with:

```markdown
- `casecremental` (0.1.0) — src/modules/casecremental/
```

- [ ] **Step 3: Full verification**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: every test passes; typecheck and build succeed. Paste the Vitest summary line into the task report.

- [ ] **Step 4: Final browser playthrough (first-run feel)**

Fresh reload, play ~5 minutes the way a judge would, and check off:
- [ ] Sign-in → straight into the game.
- [ ] First case bought, keyed, braked and sold within ~15 s without reading anything (the hints suffice).
- [ ] Wildwood unlocked within ~2.5 min; Bedrock within ~6.5 min.
- [ ] "Buzzed" reached and visibly different from "Sober".
- [ ] Resize to 360 × 640 and back mid-spin: nothing breaks; the reel keeps spinning in place.
- [ ] Switch tabs for 30 s mid-spin and come back: the reel continues normally (no jump to the end).
- [ ] No console errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: feature history and installed-module entry for Casecremental core

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013TAGJaKtBMyJfAaap7E3W5"
```

- [ ] **Step 6 (only with the user's go-ahead): upload a test build**

Uploading publishes files to the platform, so ask the user first. If they agree:
1. Call `mcp__idosgames__begin_build_upload { title_id: "ZVKC34TR" }` → `build_id`, `upload_url`, `asset_base`.
2. `npx vite build --base=<asset_base>`
3. `python -I -c "import shutil; shutil.make_archive('build', 'zip', 'dist')"`
4. `curl -T build.zip "<upload_url>"`
5. `mcp__idosgames__finish_build_upload { title_id: "ZVKC34TR", build_id, deploy: false }` → share the `TestUrl` with the user. Do **not** pass `deploy: true` — going live is milestone 5.
