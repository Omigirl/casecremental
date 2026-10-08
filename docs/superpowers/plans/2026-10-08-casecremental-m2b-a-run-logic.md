# Casecremental M2b-A — Run 1 logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything Run 1 needs underneath the visuals — charms, the day job, the bot as a seller with the claim tray, Vault Case I with its finale timer, prestige meta (CLOUT, perks, charm offers, catch-up), a local save, and the controller/view/agent surface — deterministic and pacing-tested.

**Architecture:** The pure sim (`sim/`) grows: `Run` takes a `RunSetup` from the prestige meta, applies charm rules (`sim/charms.ts`), ticks a bot state machine (`sim/botSeller.ts`), a day-job timer and the vault finale timer, and can snapshot/restore itself (RNG state included). `sim/meta.ts` holds what outlives a run. `game/controller.ts` owns `meta` + the current `Run`, swaps runs at prestige, autosaves through `game/save.ts`. Plan M2b-B (written after this one runs) draws all of it; here the World only gets the minimal event wiring so the game stays coherent.

**Not in this plan (→ Plan M2b-B):** multi-open ×2 (spec §5) — its bench model (two drops at once) and its stacked reels change together, so both land in Plan B along with every visual and UI piece. Spec §3's "tray full → the bot puts the card back" is implemented as "the bot waits by the bench before picking it up": the card never leaves the bench, which is the same outcome for the player.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vitest. Commands: `npx vitest run <path>`, `npm run typecheck`, `npm run build`. The pre-commit hook formats staged code with Prettier.

**Spec:** `docs/superpowers/specs/2026-10-08-casecremental-m2b-run1-design.md` (plus the campaign amendment §6.1 for the day job).

## Global Constraints

- The sim stays pure and deterministic from its seed (no DOM, no `Math.random`, no `Date`).
- Every balance number lives in `sim/tuning.ts`; when a pacing test fails, tune numbers there — never the logic or the greedy bot's decision rules.
- Run 1 caps: bot Speed ×1 → ×8 over 5 levels; claim tray 12 (+4 per perk level); charm slots 1 (+1 with the perk, max 2).
- Bot sales never feed the combo; only the player's own sales and claims do.
- The day job replaces the free-case anti-softlock: ≈3 s shift, 90 % +$2, 10 % $0.
- Vault Case I: available once every case is unlocked; price `VAULT_BASE_PRICE × VAULT_GROWTH^loops`; finale 20 s; then the run is over; tray items are auto-sold into the run's earnings.
- Prestige: CLOUT from lifetime earnings; offer 3 charms from the 8-charm Run 1 pool, pick up to the slot count; perks: startCash, luck, charmSlot, botAwake, biggerTray; catch-up `valueBoost = CATCH_UP_PER_VAULT^loops`.
- Save: one localStorage key, versioned; a missing/broken/other-version save starts fresh with a console warning; storage errors never stop the game.
- Commit trailers: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_013MA8Fp47Lkjiuq8tVoGPyt`.

## Review Focus

1. **Reload in the middle of things** (bot mid-walk carrying a card, the vault finale running, the prestige screen open) → the game resumes exactly there: the carried card is not lost or duplicated, the finale continues, the prestige offer is the same. Pinned in Task 7 (snapshot round-trip with a bot job and a finale) and Task 8 (controller restore during prestige).
2. **A broken, old or hand-edited save** → the game starts fresh and never throws. Pinned in Task 7.
3. **The player sells the card while the bot is on its way** → exactly one sale, no ghost card in the bot's hands. Pinned in Task 4.
4. **Broke with a full tray and the bot waiting** → never a softlock: the card on the bench can still be sold by hand, and the day job is offered when the bench is empty. Pinned in Task 4.
5. **The vault pays out once** → CLOUT, the trophy and the loop count are granted exactly once per vault, even if events are flushed twice or the game reloads during prestige. Pinned in Task 8.

---

## File Structure

- Modify `sim/rng.ts` (resumable state), `sim/rarity.ts` (luck multiplier), `sim/roll.ts` (roll options).
- Create `sim/charms.ts` (+ test) — the 8 Run 1 charm rules.
- Modify `sim/run.ts` — setup, payout, charm effects, day job, tray, bot ticking, vault/finale, snapshot.
- Create `sim/botSeller.ts` (+ test) — bot types, speed/cost/routing helpers.
- Create `sim/meta.ts` (+ test) — CLOUT, perks, charm offers, setup for the next run.
- Modify `sim/tuning.ts` — new constants; remove `FREE_CASE_SECONDS`.
- Create `game/save.ts` (+ test) — versioned local save.
- Modify `game/controller.ts`, `game/view.ts`, `game/agent.ts` (+ tests).
- Modify `fx/World.ts` (event wiring), `module.ts` (save slot).
- Modify `sim/bot.ts` (greedy pacing player) and `sim/pacing.test.ts`.
- New sim tests: `sim/runSetup.test.ts`, `sim/dayJob.test.ts`, `sim/vault.test.ts`, `sim/snapshot.test.ts`.

All paths below are relative to `src/modules/casecremental/` unless they start with `docs/`.

---

### Task 1: Resumable RNG, luck multiplier, roll options

**Files:** Modify `sim/rng.ts`, `sim/rarity.ts`, `sim/roll.ts`; Test `sim/rng.test.ts`, `sim/roll.test.ts`.

**Interfaces:**
- Produces: `Rng.state(): number`; `createRng(seed: number, resume?: number): Rng`; `rarityWeights(luckLevel: number, luckMult = 1)`; `interface RollOptions { luckMult?: number; statTrakChance?: number; minRarity?: RarityId | null }`; `rollDrop(c, price, luckLevel, rng, id, forced = null, opts: RollOptions = {})`.

- [ ] **Step 1: Write the failing tests** — append to `sim/rng.test.ts` inside its top `describe`:

```ts
  it("resumes from a saved state exactly where it left off", () => {
    const a = createRng(7);
    for (let i = 0; i < 5; i++) a.next();
    const saved = a.state();
    const b = createRng(7, saved);
    expect([b.next(), b.next(), b.next()]).toEqual([a.next(), a.next(), a.next()]);
  });
```

and append to `sim/roll.test.ts` inside `describe("rollDrop", …)`:

```ts
  it("takes options: a luck multiplier, a StatTrak chance and a minimum rarity", () => {
    const rng = createRng(11);
    let covertPlain = 0;
    let covertBoosted = 0;
    for (let i = 0; i < 20_000; i++) if (rollDrop(bootcamp, 2, 0, rng, i).rarity === "covert") covertPlain++;
    for (let i = 0; i < 20_000; i++) if (rollDrop(bootcamp, 2, 0, rng, i, null, { luckMult: 3 }).rarity === "covert") covertBoosted++;
    expect(covertBoosted).toBeGreaterThan(covertPlain * 2);
    for (let i = 0; i < 200; i++) {
      const d = rollDrop(bootcamp, 2, 0, rng, i, null, { statTrakChance: 1, minRarity: "classified" });
      expect(d.statTrak).toBe(true);
      expect(["classified", "covert", "gold"]).toContain(d.rarity);
    }
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim/rng src/modules/casecremental/sim/roll`
Expected: FAIL — `a.state is not a function`; the options test fails on StatTrak/minimum rarity.

- [ ] **Step 3: Implement**

`sim/rng.ts` — add to the `Rng` interface:

```ts
  /** The generator's internal state, for saving (resume with createRng(seed, state)). */
  state(): number;
```

and change `createRng`:

```ts
export function createRng(seed: number, resume?: number): Rng {
  let s = (resume ?? seed) >>> 0;
```

adding `state: () => s,` to the returned object.

`sim/rarity.ts` — replace `rarityWeights`:

```ts
/** Normalized drop weights: Luck multiplies everything above Mil-Spec (× luckMult, the Golden Hour), then they sum to 1. */
export function rarityWeights(luckLevel: number, luckMult = 1): Record<RarityId, number> {
  const boost = (1 + LUCK_PER_LEVEL * Math.max(0, luckLevel)) * luckMult;
```

(the rest of the function unchanged).

`sim/roll.ts` — import `RARITY_ORDER` from `./rarity` (with `rarityWeights`), and replace `rollDrop`:

```ts
export interface RollOptions {
  /** Multiplies Luck's boost (Gold Rush's Golden Hour). */
  luckMult?: number;
  statTrakChance?: number;
  /** A lower roll is raised to this rarity (Lucky Seven). */
  minRarity?: RarityId | null;
}

/** Rolls one case: rarity (luck-adjusted), skin, float/wear, StatTrak, base value. */
export function rollDrop(
  c: CaseDef,
  price: number,
  luckLevel: number,
  rng: Rng,
  id: number,
  forced: RarityId | null = null,
  opts: RollOptions = {},
): Drop {
  const roll = rng.next(); // drawn either way, so a forced drop leaves the rest of the run unchanged
  let rarity = forced ?? pickRarity(rarityWeights(luckLevel, opts.luckMult ?? 1), roll);
  if (opts.minRarity && RARITY_ORDER.indexOf(rarity) < RARITY_ORDER.indexOf(opts.minRarity)) rarity = opts.minRarity;
  const skin = rng.pick(c.skins.filter((s) => s.rarity === rarity));
  const float = rng.next();
  const wear = wearOf(float);
  const statTrak = rng.next() < (opts.statTrakChance ?? STATTRAK_CHANCE);
  const value = price * valueMultOf(c.id, rarity) * wear.mult * (statTrak ? STATTRAK_MULT : 1);
  return { id, caseId: c.id, skinId: skin.id, rarity, float, wear: wear.id, statTrak, value };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental/sim && npm run typecheck`
Expected: PASS (all sim tests, pacing included); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/sim/rng.ts src/modules/casecremental/sim/rarity.ts src/modules/casecremental/sim/roll.ts src/modules/casecremental/sim/rng.test.ts src/modules/casecremental/sim/roll.test.ts
git commit -m "feat(sim): resumable RNG, a luck multiplier and roll options for charms"
```

### Task 2: Run setup, payout and the eight Run 1 charms

**Files:** Create `sim/charms.ts`, `sim/charms.test.ts`, `sim/runSetup.test.ts`; Modify `sim/tuning.ts`, `sim/run.ts`.

**Interfaces:**
- Consumes: Task 1 (`RollOptions`).
- Produces: `CharmId`, `RUN1_CHARMS`, `charmValueMult(charms, drop)`, `charmPriceMult(charms)`, `charmStatTrakChance(charms)`, `charmMinRarity(charms, opened)`; in `run.ts`: `interface RunSetup { startCash; luckBonus; charms: CharmId[]; botAwake; trayCapacity; valueBoost; vaultPrice }`, `DEFAULT_SETUP`, `type SaleSource = "bench" | "tray" | "bot"`, `Run(seed, setup = DEFAULT_SETUP)`, `run.seed`, `run.setup`, `run.casePrice(caseId)`, `run.cheapestPrice()`, `run.payout(drop, byHand)`; `sold` events carry `source`; `RunState` gains `revealedAt`, `pity`, `goldenHourUntil`, `freeCases`.

- [ ] **Step 1: Add the tuning constants** — append to `sim/tuning.ts`:

```ts
// ── M2b: charms, the bot, the tray, the day job, the vault, prestige ─────────────────────────────

export const GOLD_RUSH_MULT = 10;
export const GOLDEN_HOUR_SECONDS = 5;
export const GOLDEN_HOUR_LUCK = 3;
/** Pity Jar: Luck levels added per Mil-Spec since the last Covert or ★ (+1 % Luck each). */
export const PITY_LUCK_LEVELS = 1 / 15;
export const INSIDER_PRICE_MULT = 0.7;
export const DOUBLE_TAP_MULT = 3;
export const LUCKY_SEVEN_EVERY = 7;
export const MANIAC_MILSPEC_MULT = 4;
export const MANIAC_OTHER_MULT = 0.5;

export const TRAY_BASE_CAPACITY = 12;
export const VAULT_BASE_PRICE = 20_000;
```

- [ ] **Step 2: Write the failing tests**

`sim/charms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { charmMinRarity, charmPriceMult, charmStatTrakChance, charmValueMult, RUN1_CHARMS } from "./charms";
import { STATTRAK_CHANCE } from "./tuning";
import type { Drop } from "./types";

const drop = (over: Partial<Drop>): Drop => ({
  id: 1,
  caseId: "bootcamp",
  skinId: "bc_woodland",
  rarity: "milspec",
  float: 0.2,
  wear: "FT",
  statTrak: false,
  value: 1,
  ...over,
});

describe("Run 1 charms", () => {
  it("has the eight charms that work with Run 1's systems", () => {
    expect([...RUN1_CHARMS].sort()).toEqual(
      ["doubleTap", "goldRush", "insider", "luckySeven", "milSpecManiac", "pityJar", "ricochet", "rustBucket"].sort(),
    );
  });

  it("Rust Bucket pays Battle-Scarred at Factory New price", () => {
    expect(charmValueMult(["rustBucket"], drop({ wear: "BS" }))).toBeCloseTo(1.5 / 0.7);
    expect(charmValueMult(["rustBucket"], drop({ wear: "FT" }))).toBe(1);
  });

  it("Gold Rush pays ★ ×10; Mil-Spec Maniac ×4 Mil-Spec and ×0.5 everything else", () => {
    expect(charmValueMult(["goldRush"], drop({ rarity: "gold" }))).toBe(10);
    expect(charmValueMult(["milSpecManiac"], drop({ rarity: "milspec" }))).toBe(4);
    expect(charmValueMult(["milSpecManiac"], drop({ rarity: "covert" }))).toBe(0.5);
    expect(charmValueMult([], drop({ rarity: "gold" }))).toBe(1);
  });

  it("Insider, Double Tap and Lucky Seven", () => {
    expect(charmPriceMult(["insider"])).toBe(0.7);
    expect(charmPriceMult([])).toBe(1);
    expect(charmStatTrakChance(["doubleTap"])).toBeCloseTo(STATTRAK_CHANCE * 3);
    expect(charmMinRarity(["luckySeven"], 7)).toBe("classified");
    expect(charmMinRarity(["luckySeven"], 8)).toBeNull();
    expect(charmMinRarity([], 7)).toBeNull();
  });
});
```

`sim/runSetup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { priceOf } from "./content/cases";
import { DEFAULT_SETUP, Run, type RunSetup } from "./run";
import type { RarityId } from "./types";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};
const setup = (over: Partial<RunSetup>): RunSetup => ({ ...DEFAULT_SETUP, ...over });
function reveal(run: Run, rarity: RarityId | null = null) {
  run.state.cash = Math.max(run.state.cash, 1e6);
  if (rarity) run.forceNextRarity(rarity);
  expect(run.buyCase("bootcamp").ok).toBe(true);
  expect(run.insertKey().ok).toBe(true);
  const b = run.state.bench;
  tickFor(run, (b.phase === "spinning" ? b.fullDuration : 0) + 0.1);
  const r = run.state.bench;
  if (r.phase !== "revealed") throw new Error("expected revealed");
  return r.drop;
}

describe("run setup", () => {
  it("starts from the setup's cash and keeps its own copy of the charm list", () => {
    const charms = ["insider" as const];
    const run = new Run(1, setup({ startCash: 50, charms }));
    charms.length = 0;
    expect(run.state.cash).toBe(50);
    expect(run.setup.charms).toEqual(["insider"]);
  });

  it("pays a drop: value × Appraiser × charms × catch-up, and × combo only by hand", () => {
    const run = new Run(1, setup({ valueBoost: 6 }));
    const d = reveal(run, "milspec");
    expect(run.payout(d, false)).toBeCloseTo(d.value * 6);
    const before = run.state.cash;
    run.sell();
    expect(run.state.cash - before).toBeCloseTo(d.value * 6 * 1.02);
  });

  it("Insider makes cases 30 % cheaper", () => {
    const run = new Run(1, setup({ charms: ["insider"] }));
    expect(run.casePrice("bootcamp")).toBeCloseTo(priceOf("bootcamp") * 0.7);
    const before = run.state.cash;
    run.buyCase("bootcamp");
    expect(before - run.state.cash).toBeCloseTo(priceOf("bootcamp") * 0.7);
  });

  it("Lucky Seven makes every 7th case at least Classified", () => {
    const run = new Run(3, setup({ charms: ["luckySeven"] }));
    for (let i = 1; i <= 21; i++) {
      const d = reveal(run);
      run.sell();
      if (i % 7 === 0) expect(["classified", "covert", "gold"]).toContain(d.rarity);
    }
  });

  it("Pity Jar counts Mil-Specs and resets on a Covert", () => {
    const run = new Run(1, setup({ charms: ["pityJar"] }));
    reveal(run, "milspec");
    run.sell();
    reveal(run, "milspec");
    run.sell();
    expect(run.state.pity).toBe(2);
    reveal(run, "covert");
    expect(run.state.pity).toBe(0);
  });

  it("Ricochet: a Covert puts a free case of the same type on the bench once it is clear", () => {
    const run = new Run(1, setup({ charms: ["ricochet"] }));
    reveal(run, "covert");
    run.sell();
    run.tick(DT);
    expect(run.state.bench).toEqual({ phase: "locked", caseId: "bootcamp", free: true });
  });

  it("Gold Rush starts a Golden Hour on a ★", () => {
    const run = new Run(1, setup({ charms: ["goldRush"] }));
    reveal(run, "gold");
    expect(run.state.goldenHourUntil).toBeCloseTo(run.state.revealedAt + 5);
  });

  it("a sale says where it came from", () => {
    const run = new Run(1);
    reveal(run, "milspec");
    run.drainEvents();
    run.sell();
    expect(run.drainEvents().find((e) => e.type === "sold")).toMatchObject({ source: "bench" });
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim/charms src/modules/casecremental/sim/runSetup`
Expected: FAIL — `Cannot find module './charms'`; `runSetup` fails on `DEFAULT_SETUP` / `payout` / `casePrice`.

- [ ] **Step 4: Write `sim/charms.ts`**

```ts
import { RARITY_ORDER } from "./rarity";
import {
  DOUBLE_TAP_MULT,
  GOLD_RUSH_MULT,
  INSIDER_PRICE_MULT,
  LUCKY_SEVEN_EVERY,
  MANIAC_MILSPEC_MULT,
  MANIAC_OTHER_MULT,
  STATTRAK_CHANCE,
  WEAR_TABLE,
} from "./tuning";
import type { Drop, RarityId, WearId } from "./types";

// Charms (base spec §8.1, M2b spec §8): rules that bend a run, picked on the prestige screen for the next
// run only. Run 1's pool is the eight that work with Run 1's systems; the rest come with later runs.

export type CharmId = "luckySeven" | "rustBucket" | "pityJar" | "doubleTap" | "ricochet" | "goldRush" | "insider" | "milSpecManiac";

export const RUN1_CHARMS: readonly CharmId[] = [
  "luckySeven",
  "rustBucket",
  "pityJar",
  "doubleTap",
  "ricochet",
  "goldRush",
  "insider",
  "milSpecManiac",
];

const wearMult = (id: WearId) => WEAR_TABLE.find((w) => w.id === id)!.mult;

/** The value multiplier a run's charms give one drop. */
export function charmValueMult(charms: readonly CharmId[], d: Drop): number {
  let m = 1;
  if (charms.includes("rustBucket") && d.wear === "BS") m *= wearMult("FN") / wearMult("BS");
  if (charms.includes("goldRush") && d.rarity === "gold") m *= GOLD_RUSH_MULT;
  if (charms.includes("milSpecManiac")) m *= d.rarity === "milspec" ? MANIAC_MILSPEC_MULT : MANIAC_OTHER_MULT;
  return m;
}

export const charmPriceMult = (charms: readonly CharmId[]): number => (charms.includes("insider") ? INSIDER_PRICE_MULT : 1);

export const charmStatTrakChance = (charms: readonly CharmId[]): number =>
  STATTRAK_CHANCE * (charms.includes("doubleTap") ? DOUBLE_TAP_MULT : 1);

/** Lucky Seven: every 7th case opened is at least Classified (`opened` counts this one). */
export const charmMinRarity = (charms: readonly CharmId[], opened: number): RarityId | null =>
  charms.includes("luckySeven") && opened % LUCKY_SEVEN_EVERY === 0 ? "classified" : null;

export const isBigRarity = (r: RarityId): boolean => RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf("covert");
```

- [ ] **Step 5: Update `sim/run.ts`**

Imports: add

```ts
import { charmMinRarity, charmPriceMult, charmStatTrakChance, charmValueMult, isBigRarity, type CharmId } from "./charms";
```

and extend the tuning import with `GOLDEN_HOUR_LUCK, GOLDEN_HOUR_SECONDS, PITY_LUCK_LEVELS, TRAY_BASE_CAPACITY, VAULT_BASE_PRICE`.

Replace the `sold` member of `SimEvent` with:

```ts
  | { type: "sold"; drop: Drop; amount: number; combo: number; source: SaleSource }
```

and add above `SimEvent`:

```ts
export type SaleSource = "bench" | "tray" | "bot";

/** What the prestige meta hands a new run (M2b spec §8). */
export interface RunSetup {
  startCash: number;
  /** Extra Luck levels (meta perk). */
  luckBonus: number;
  /** Charms picked on the prestige screen for this run. */
  charms: CharmId[];
  botAwake: boolean;
  trayCapacity: number;
  /** Catch-up boost: every sale is multiplied by this. */
  valueBoost: number;
  vaultPrice: number;
}

export const DEFAULT_SETUP: RunSetup = {
  startCash: START_CASH,
  luckBonus: 0,
  charms: [],
  botAwake: false,
  trayCapacity: TRAY_BASE_CAPACITY,
  valueBoost: 1,
  vaultPrice: VAULT_BASE_PRICE,
};
```

Add to `RunState` (after `opened`):

```ts
  /** When the card on the bench was revealed. */
  revealedAt: number;
  /** Pity Jar: Mil-Specs since the last Covert or ★. */
  pity: number;
  /** Gold Rush: the Golden Hour lasts until this time. */
  goldenHourUntil: number;
  /** Ricochet: free cases waiting for the bench. */
  freeCases: string[];
```

Replace the class head and constructor:

```ts
export class Run {
  readonly state: RunState;
  readonly seed: number;
  readonly setup: RunSetup;
  private readonly rng: Rng;
  private events: SimEvent[] = [];
  private revealsThisTick = 0;
  private forcedRarity: RarityId | null = null;
  private forcedFake = false;

  constructor(seed: number, setup: RunSetup = DEFAULT_SETUP) {
    this.seed = seed;
    this.setup = { ...setup, charms: [...setup.charms] };
    this.rng = createRng(seed);
    this.state = {
      time: 0,
      cash: this.setup.startCash,
      lifetimeEarnings: 0,
      unlocked: [CASES[0]!.id],
      upgrades: { luck: 0, appraiser: 0, quickHands: 0 },
      bench: { phase: "empty" },
      combo: 0,
      comboHeat: 0,
      lastSellAt: -1e9,
      freeCaseTimer: 0,
      heat: 0,
      lastTier: 1,
      stage: 1,
      nextDropId: 1,
      opened: 0,
      revealedAt: 0,
      pity: 0,
      goldenHourUntil: -1,
      freeCases: [],
    };
  }
```

Add these methods after `intensity()`:

```ts
  /** A case's price this run (Insider). */
  casePrice(caseId: string): number {
    return priceOf(caseId) * charmPriceMult(this.setup.charms);
  }

  cheapestPrice(): number {
    return Math.min(...this.state.unlocked.map((id) => this.casePrice(id)));
  }

  /** What a drop pays: value × Appraiser × charms × catch-up, and × combo when sold by hand. */
  payout(d: Drop, byHand: boolean): number {
    const combo = byHand ? this.comboMultiplier() : 1;
    return d.value * this.effects().sellMult * charmValueMult(this.setup.charms, d) * this.setup.valueBoost * combo;
  }

  private bumpCombo(): void {
    const s = this.state;
    s.combo = s.time - s.lastSellAt <= COMBO_WINDOW_SECONDS ? s.combo + 1 : 1;
    s.lastSellAt = s.time;
  }
```

In `buyCase`, replace `const price = priceOf(caseId);` with `const price = this.casePrice(caseId);`.

In `insertKey`, replace the `rollDrop(...)` line with:

```ts
    const opened = s.opened + 1;
    const luck = fx.luckLevel + this.setup.luckBonus + s.pity * PITY_LUCK_LEVELS;
    const drop = rollDrop(c, priceOf(c.id), luck, this.rng, s.nextDropId++, this.forcedRarity, {
      luckMult: s.time < s.goldenHourUntil ? GOLDEN_HOUR_LUCK : 1,
      statTrakChance: charmStatTrakChance(this.setup.charms),
      minRarity: charmMinRarity(this.setup.charms, opened),
    });
```

Replace the body of `sell()` after the phase check with:

```ts
    this.bumpCombo();
    const amount = this.payout(b.drop, true);
    s.cash += amount;
    s.lifetimeEarnings += amount;
    s.bench = { phase: "empty" };
    this.events.push({ type: "sold", drop: b.drop, amount, combo: s.combo, source: "bench" });
    return OK;
```

In `tick`, replace the reveal block with:

```ts
    const b = s.bench;
    if (b.phase === "spinning") {
      b.elapsed += dt;
      if (b.elapsed >= b.fullDuration) {
        s.bench = { phase: "revealed", caseId: b.caseId, drop: b.drop };
        this.onReveal(b.drop);
        this.revealsThisTick++;
        this.events.push({ type: "revealed", drop: b.drop });
      }
    }

    // a Ricochet case takes the bench as soon as it is clear
    if (s.bench.phase === "empty" && s.freeCases.length > 0) {
      const caseId = s.freeCases.shift()!;
      s.bench = { phase: "locked", caseId, free: true };
      this.events.push({ type: "caseBought", caseId, free: true });
    }
```

and add the private method:

```ts
  /** The charms that react to what was just revealed. */
  private onReveal(d: Drop): void {
    const s = this.state;
    const charms = this.setup.charms;
    s.revealedAt = s.time;
    if (charms.includes("pityJar")) s.pity = d.rarity === "milspec" ? s.pity + 1 : isBigRarity(d.rarity) ? 0 : s.pity;
    if (charms.includes("ricochet") && d.rarity === "covert") s.freeCases.push(d.caseId);
    if (charms.includes("goldRush") && d.rarity === "gold") s.goldenHourUntil = s.time + GOLDEN_HOUR_SECONDS;
  }
```

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS (all module tests); typecheck clean. (`fx/World.ts` reads `sold` events without `source` — it still compiles.)

- [ ] **Step 7: Commit**

```bash
git add src/modules/casecremental/sim
git commit -m "feat(sim): run setup from the prestige meta, payout pipeline and the eight Run 1 charms"
```

### Task 3: The day job replaces the free case

**Files:** Modify `sim/tuning.ts`, `sim/run.ts`, `sim/run.test.ts`, `sim/bot.ts`; Create `sim/dayJob.test.ts`.

**Interfaces:**
- Produces: `RunState.dayJob: number | null` (elapsed shift seconds); `run.dayJobAvailable(): boolean`; `run.startDayJob(): ActionResult`; events `{ type: "dayJobStarted" }`, `{ type: "dayJobDone"; amount: number }`. Removes `freeCaseTimer` and `FREE_CASE_SECONDS`.

- [ ] **Step 1: Write the failing tests** — `sim/dayJob.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Run } from "./run";
import { DAY_JOB_PAY, DAY_JOB_SECONDS } from "./tuning";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};

describe("the day job", () => {
  it("is offered only when broke with an empty bench, once at a time", () => {
    const run = new Run(1);
    expect(run.dayJobAvailable()).toBe(false); // can afford a case
    expect(run.startDayJob().ok).toBe(false);
    run.state.cash = 0;
    expect(run.dayJobAvailable()).toBe(true);
    expect(run.startDayJob().ok).toBe(true);
    expect(run.startDayJob()).toEqual({ ok: false, reason: "already working" });
    expect(run.dayJobAvailable()).toBe(false);
  });

  it("pays $2 nine times in ten after a ~3 s shift", () => {
    let paid = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const run = new Run(seed);
      run.state.cash = 0;
      run.startDayJob();
      tickFor(run, DAY_JOB_SECONDS - 0.1);
      expect(run.state.dayJob).not.toBeNull();
      tickFor(run, 0.2);
      expect(run.state.dayJob).toBeNull();
      const done = run.drainEvents().find((e) => e.type === "dayJobDone");
      expect(done && done.type === "dayJobDone" && [0, DAY_JOB_PAY].includes(done.amount)).toBe(true);
      if (run.state.cash === DAY_JOB_PAY) paid++;
    }
    expect(paid / 400).toBeGreaterThan(0.85);
    expect(paid / 400).toBeLessThan(0.95);
  });

  it("never hands out free cases any more", () => {
    const run = new Run(1);
    run.state.cash = 0;
    tickFor(run, 30);
    expect(run.state.bench.phase).toBe("empty");
  });
});
```

In `sim/run.test.ts`, delete the two tests "gives a free case when broke with an empty bench" and "does not give free cases to a player who can pay", and remove `FREE_CASE_SECONDS` from its tuning import.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim/dayJob`
Expected: FAIL — `DAY_JOB_PAY` is undefined / `run.dayJobAvailable is not a function`.

- [ ] **Step 3: Implement**

`sim/tuning.ts`: delete the `FREE_CASE_SECONDS` constant and its comment; append:

```ts
/** Broke with an empty bench: a day job (campaign spec §6.1). */
export const DAY_JOB_SECONDS = 3;
export const DAY_JOB_PAY = 2;
export const DAY_JOB_PAY_CHANCE = 0.9;
```

`sim/run.ts`:
- tuning import: remove `FREE_CASE_SECONDS`, add `DAY_JOB_PAY, DAY_JOB_PAY_CHANCE, DAY_JOB_SECONDS`.
- `SimEvent`: add `| { type: "dayJobStarted" }` and `| { type: "dayJobDone"; amount: number }`.
- `RunState`: replace `freeCaseTimer: number;` with `/** Seconds into a day-job shift, or null when not working. */ dayJob: number | null;`; in the constructor replace `freeCaseTimer: 0,` with `dayJob: null,`.
- `buyCase`: delete the line `s.freeCaseTimer = 0;`.
- Add methods:

```ts
  /** Broke with an empty bench and not already working (campaign spec §6.1). */
  dayJobAvailable(): boolean {
    const s = this.state;
    return s.dayJob === null && s.bench.phase === "empty" && s.cash < this.cheapestPrice();
  }

  startDayJob(): ActionResult {
    if (this.state.dayJob !== null) return fail("already working");
    if (!this.dayJobAvailable()) return fail("no day job: you can afford a case or the bench is busy");
    this.state.dayJob = 0;
    this.events.push({ type: "dayJobStarted" });
    return OK;
  }

  private tickDayJob(dt: number): void {
    const s = this.state;
    if (s.dayJob === null) return;
    s.dayJob += dt;
    if (s.dayJob < DAY_JOB_SECONDS) return;
    s.dayJob = null;
    const amount = this.rng.next() < DAY_JOB_PAY_CHANCE ? DAY_JOB_PAY : 0;
    s.cash += amount;
    s.lifetimeEarnings += amount;
    this.events.push({ type: "dayJobDone", amount });
  }
```

- In `tick`, delete the whole anti-softlock block (from `// Anti-softlock` through its `else { s.freeCaseTimer = 0; }`) and call `this.tickDayJob(dt);` in its place.

`sim/bot.ts` (the greedy pacing player): in the `b.phase === "empty"` branch, after the `buyCase` attempt, add the day job:

```ts
    } else if (b.phase === "empty") {
      spend(run);
      const target = [...s.unlocked].reverse().find((id) => run.casePrice(id) <= s.cash);
      if (target && run.buyCase(target).ok) busyUntil = s.time + timings.buy;
      else if (run.startDayJob().ok) busyUntil = s.time + timings.buy;
    }
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS (pacing included); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/sim
git commit -m "feat(sim): the day job replaces the free-case anti-softlock"
```

### Task 4: The claim tray and the bot as a seller

**Files:** Create `sim/botSeller.ts`, `sim/botSeller.test.ts`; Modify `sim/tuning.ts`, `sim/run.ts`.

**Interfaces:**
- Consumes: `RunSetup.botAwake/trayCapacity`, `run.payout`, `bumpCombo` (Task 2).
- Produces: `botSeller.ts`: `BotStep`, `BotJob { step; t; drop: Drop | null; dest: "bin" | "tray" | null }`, `BotState { awake; speedLevel; threshold: RarityId; job: BotJob | null }`, `freshBot(awake)`, `botSpeed(level)`, `botSpeedCost(level): number | null`, `sellsAt(threshold, rarity)`, `revealHold(rarity, speed)`, `BOT_STEP_SECONDS`. `RunState.tray: Drop[]`, `RunState.bot: BotState`. Run methods: `wakeBot()`, `buyBotSpeed()`, `setBotThreshold(r)`, `claim(index)`. Events: `botWoke`, `botUpgraded { level }`, `botPickedUp { drop; dest }`, `botWaiting`, `stored { drop }`; bot sales are `sold` with `source: "bot"`, claims `source: "tray"`.

- [ ] **Step 1: Add the tuning constants** — append to `sim/tuning.ts`:

```ts
/** The bot as a seller (M2b spec §3): seconds per step at speed ×1. */
export const BOT_STEP_SECONDS = { toBench: 1.2, pickUp: 0.4, carry: 1.2, drop: 0.3, back: 1.0 } as const;
/** A revealed card is left alone this long (÷ speed) before the bot comes for it… */
export const BOT_REVEAL_HOLD = 0.6;
/** …and a Covert or ★ this long (its reveal — the knife's showcase — plays first). */
export const BOT_BIG_REVEAL_HOLD = 2.6;
export const BOT_WAKE_COST = 80;
/** Run 1's cap: Speed levels and the speed at the last one. */
export const BOT_SPEED_LEVELS = 5;
export const BOT_MAX_SPEED = 8;
export const BOT_SPEED_COSTS = { baseCost: 60, growth: 2.3 } as const;
```

- [ ] **Step 2: Write the failing tests** — `sim/botSeller.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { botSpeed, botSpeedCost, revealHold, sellsAt } from "./botSeller";
import { DEFAULT_SETUP, Run, type RunSetup } from "./run";
import { BOT_REVEAL_HOLD, BOT_STEP_SECONDS, BOT_WAKE_COST } from "./tuning";
import type { RarityId } from "./types";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};
const awake = (over: Partial<RunSetup> = {}) => new Run(1, { ...DEFAULT_SETUP, botAwake: true, ...over });
function reveal(run: Run, rarity: RarityId) {
  run.state.cash = Math.max(run.state.cash, 1e6);
  run.forceNextRarity(rarity);
  run.buyCase("bootcamp");
  run.insertKey();
  const b = run.state.bench;
  tickFor(run, (b.phase === "spinning" ? b.fullDuration : 0) + DT);
  expect(run.state.bench.phase).toBe("revealed");
  run.drainEvents();
}
const S = BOT_STEP_SECONDS;

describe("bot helpers", () => {
  it("speeds up ×1 → ×8 over five levels, then caps", () => {
    expect(botSpeed(0)).toBe(1);
    expect(botSpeed(5)).toBeCloseTo(8);
    expect(botSpeed(9)).toBeCloseTo(8);
    expect(botSpeedCost(0)).toBe(60);
    expect(botSpeedCost(5)).toBeNull();
  });

  it("routes by threshold and lets big reveals play first", () => {
    expect(sellsAt("classified", "restricted")).toBe(true);
    expect(sellsAt("classified", "covert")).toBe(false);
    expect(revealHold("milspec", 2)).toBeCloseTo(BOT_REVEAL_HOLD / 2);
    expect(revealHold("gold", 8)).toBeGreaterThan(2);
  });
});

describe("the bot as a seller", () => {
  it("sleeps until woken, and waking costs once", () => {
    const run = new Run(1);
    reveal(run, "milspec");
    tickFor(run, 10);
    expect(run.state.bench.phase).toBe("revealed");
    run.state.cash = 100;
    expect(run.wakeBot().ok).toBe(true);
    expect(run.state.cash).toBe(100 - BOT_WAKE_COST);
    expect(run.wakeBot()).toEqual({ ok: false, reason: "the bot is already awake" });
  });

  it("walks over, picks the card up, sells it without combo, and walks back", () => {
    const run = awake();
    reveal(run, "milspec");
    const b = run.state.bench;
    const drop = b.phase === "revealed" ? b.drop : null;
    tickFor(run, BOT_REVEAL_HOLD + S.toBench + S.pickUp + 0.1);
    expect(run.state.bench.phase).toBe("empty");
    expect(run.drainEvents().map((e) => e.type)).toContain("botPickedUp");
    const cash = run.state.cash;
    tickFor(run, S.carry + S.drop + 0.1);
    const sold = run.drainEvents().find((e) => e.type === "sold");
    expect(sold).toMatchObject({ source: "bot" });
    expect(run.state.cash - cash).toBeCloseTo(run.payout(drop!, false));
    expect(run.state.combo).toBe(0);
    tickFor(run, S.back + 0.1);
    expect(run.state.bot.job).toBeNull();
  });

  it("goes back empty-handed when the player sells first — one sale only", () => {
    const run = awake();
    reveal(run, "milspec");
    tickFor(run, BOT_REVEAL_HOLD + 0.5); // on its way
    run.sell();
    tickFor(run, 6);
    const sales = run.drainEvents().filter((e) => e.type === "sold");
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({ source: "bench" });
    expect(run.state.bot.job).toBeNull();
  });

  it("carries anything above its threshold to the claim tray; a claim sells it with combo", () => {
    const run = awake();
    reveal(run, "covert");
    tickFor(run, 10);
    expect(run.state.tray).toHaveLength(1);
    expect(run.drainEvents().map((e) => e.type)).toContain("stored");
    const d = run.state.tray[0]!;
    const cash = run.state.cash;
    expect(run.claim(0).ok).toBe(true);
    expect(run.state.cash - cash).toBeCloseTo(run.payout(d, false) * 1.02);
    expect(run.state.tray).toHaveLength(0);
    expect(run.claim(0)).toEqual({ ok: false, reason: "nothing in that tray slot" });
  });

  it("waits by a full tray — the card stays sellable by hand, and the day job still comes when broke", () => {
    const run = awake({ trayCapacity: 1 });
    reveal(run, "covert");
    tickFor(run, 10);
    reveal(run, "covert");
    tickFor(run, 10);
    expect(run.state.bench.phase).toBe("revealed"); // it waited
    expect(run.state.bot.job?.step).toBe("wait");
    run.state.cash = 0;
    expect(run.sell().ok).toBe(true);
    run.state.cash = 0; // still broke after the sale
    tickFor(run, 4);
    expect(run.dayJobAvailable()).toBe(true);
  });

  it("picks the waiting card up once a tray slot frees", () => {
    const run = awake({ trayCapacity: 1 });
    reveal(run, "covert");
    tickFor(run, 10);
    reveal(run, "covert");
    tickFor(run, 10);
    run.claim(0);
    tickFor(run, 6);
    expect(run.state.bench.phase).toBe("empty");
    expect(run.state.tray).toHaveLength(1);
  });

  it("gets faster with Speed and obeys a new threshold", () => {
    const run = awake();
    run.state.cash = 1e9;
    for (let i = 0; i < 5; i++) expect(run.buyBotSpeed().ok).toBe(true);
    expect(run.buyBotSpeed()).toEqual({ ok: false, reason: "max level for this run" });
    expect(run.setBotThreshold("covert").ok).toBe(true);
    reveal(run, "covert");
    tickFor(run, 2.6 + (S.toBench + S.pickUp + S.carry + S.drop) / 8 + 0.2);
    expect(run.drainEvents().find((e) => e.type === "sold")).toMatchObject({ source: "bot" });
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim/botSeller`
Expected: FAIL — `Cannot find module './botSeller'`.

- [ ] **Step 4: Write `sim/botSeller.ts`**

```ts
import { RARITY_ORDER } from "./rarity";
import { BOT_BIG_REVEAL_HOLD, BOT_MAX_SPEED, BOT_REVEAL_HOLD, BOT_SPEED_COSTS, BOT_SPEED_LEVELS, BOT_STEP_SECONDS } from "./tuning";
import type { Drop, RarityId } from "./types";

// The bot as a seller (M2b spec §3): a small state machine the run ticks. Asleep until woken; then it walks
// to the bench once a revealed card has waited a moment, picks it up and either sells it at the bin or
// carries it to the claim tray. Step times are seconds at speed ×1, divided by its speed.

export { BOT_STEP_SECONDS };

export type BotStep = "toBench" | "wait" | "pickUp" | "carry" | "drop" | "back";

export interface BotJob {
  step: BotStep;
  /** Progress through the step, in speed-scaled seconds. */
  t: number;
  drop: Drop | null;
  dest: "bin" | "tray" | null;
}

export interface BotState {
  awake: boolean;
  speedLevel: number;
  /** The rarest it may sell; anything rarer goes to the claim tray. */
  threshold: RarityId;
  job: BotJob | null;
}

export const freshBot = (awake: boolean): BotState => ({ awake, speedLevel: 0, threshold: "classified", job: null });

/** ×1 at level 0 up to ×BOT_MAX_SPEED at the run's last level, geometric in between. */
export const botSpeed = (level: number): number => BOT_MAX_SPEED ** (Math.min(level, BOT_SPEED_LEVELS) / BOT_SPEED_LEVELS);

/** Price of the next Speed level, or null at this run's cap. */
export function botSpeedCost(level: number): number | null {
  if (level >= BOT_SPEED_LEVELS) return null;
  return Math.ceil(BOT_SPEED_COSTS.baseCost * BOT_SPEED_COSTS.growth ** level);
}

/** May it sell this rarity (else it goes to the tray)? */
export const sellsAt = (threshold: RarityId, rarity: RarityId): boolean => RARITY_ORDER.indexOf(rarity) <= RARITY_ORDER.indexOf(threshold);

/** How long a revealed card is left alone first: big reveals play out; others shrink with speed. */
export const revealHold = (rarity: RarityId, speed: number): number =>
  rarity === "covert" || rarity === "gold" ? BOT_BIG_REVEAL_HOLD : BOT_REVEAL_HOLD / speed;
```

- [ ] **Step 5: Wire it into `sim/run.ts`**

Imports: add `import { botSpeed, botSpeedCost, BOT_STEP_SECONDS, freshBot, revealHold, sellsAt, type BotState } from "./botSeller";` and `BOT_WAKE_COST` to the tuning import.

`SimEvent` — add:

```ts
  | { type: "stored"; drop: Drop }
  | { type: "botWoke" }
  | { type: "botUpgraded"; level: number }
  | { type: "botPickedUp"; drop: Drop; dest: "bin" | "tray" }
  | { type: "botWaiting" }
```

`RunState` — add:

```ts
  /** Drops the bot set aside for the player to claim (above its threshold). */
  tray: Drop[];
  bot: BotState;
```

and in the constructor `tray: [],` and `bot: freshBot(this.setup.botAwake),`.

Methods (after `startDayJob`):

```ts
  wakeBot(): ActionResult {
    const s = this.state;
    if (s.bot.awake) return fail("the bot is already awake");
    if (s.cash < BOT_WAKE_COST) return fail("not enough cash");
    s.cash -= BOT_WAKE_COST;
    s.bot.awake = true;
    this.events.push({ type: "botWoke" });
    return OK;
  }

  buyBotSpeed(): ActionResult {
    const s = this.state;
    if (!s.bot.awake) return fail("wake the bot first");
    const cost = botSpeedCost(s.bot.speedLevel);
    if (cost === null) return fail("max level for this run");
    if (s.cash < cost) return fail("not enough cash");
    s.cash -= cost;
    s.bot.speedLevel += 1;
    this.events.push({ type: "botUpgraded", level: s.bot.speedLevel });
    return OK;
  }

  setBotThreshold(rarity: RarityId): ActionResult {
    this.state.bot.threshold = rarity;
    return OK;
  }

  /** Sell a tray item by hand (feeds the combo). */
  claim(index: number): ActionResult {
    const s = this.state;
    const d = s.tray[index];
    if (!d) return fail("nothing in that tray slot");
    s.tray.splice(index, 1);
    this.bumpCombo();
    const amount = this.payout(d, true);
    s.cash += amount;
    s.lifetimeEarnings += amount;
    this.events.push({ type: "sold", drop: d, amount, combo: s.combo, source: "tray" });
    return OK;
  }

  /** The bot's job loop (M2b spec §3). */
  private tickBot(dt: number): void {
    const s = this.state;
    const bot = s.bot;
    if (!bot.awake) return;
    const speed = botSpeed(bot.speedLevel);
    if (!bot.job) {
      const b = s.bench;
      if (b.phase === "revealed" && s.time - s.revealedAt >= revealHold(b.drop.rarity, speed))
        bot.job = { step: "toBench", t: 0, drop: null, dest: null };
      return;
    }
    const job = bot.job;
    if (job.step === "wait") {
      if (s.bench.phase !== "revealed") Object.assign(job, { step: "back", t: 0 });
      else if (s.tray.length < this.setup.trayCapacity) Object.assign(job, { step: "pickUp", t: 0 });
      return;
    }
    job.t += dt * speed;
    if (job.t < BOT_STEP_SECONDS[job.step]) return;
    job.t = 0;
    switch (job.step) {
      case "toBench": {
        const b = s.bench;
        if (b.phase !== "revealed") {
          job.step = "back";
          break;
        }
        job.dest = sellsAt(bot.threshold, b.drop.rarity) ? "bin" : "tray";
        if (job.dest === "tray" && s.tray.length >= this.setup.trayCapacity) {
          job.step = "wait";
          this.events.push({ type: "botWaiting" });
        } else job.step = "pickUp";
        break;
      }
      case "pickUp": {
        const b = s.bench;
        if (b.phase !== "revealed") {
          job.step = "back";
          break;
        }
        job.drop = b.drop;
        s.bench = { phase: "empty" };
        this.events.push({ type: "botPickedUp", drop: b.drop, dest: job.dest! });
        job.step = "carry";
        break;
      }
      case "carry":
        job.step = "drop";
        break;
      case "drop": {
        const d = job.drop!;
        if (job.dest === "bin") {
          const amount = this.payout(d, false);
          s.cash += amount;
          s.lifetimeEarnings += amount;
          this.events.push({ type: "sold", drop: d, amount, combo: s.combo, source: "bot" });
        } else {
          s.tray.push(d);
          this.events.push({ type: "stored", drop: d });
        }
        job.drop = null;
        job.step = "back";
        break;
      }
      case "back":
        bot.job = null;
        break;
    }
  }
```

In `tick`, call `this.tickBot(dt);` right after the Ricochet block (before `this.tickDayJob(dt);`).

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS (pacing unchanged: the greedy player never wakes the bot yet); typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/modules/casecremental/sim
git commit -m "feat(sim): the bot sells drops for you and sets the good ones aside in the claim tray"
```

### Task 5: Vault Case I and its finale

**Files:** Modify `sim/tuning.ts`, `sim/run.ts`; Create `sim/vault.test.ts`.

**Interfaces:**
- Produces: `RunState.finale: number | null` (seconds into the finale), `RunState.over: boolean`; `run.vaultShown(): boolean`; `run.buyVault(): ActionResult`; `run.locked(): boolean`; events `{ type: "vaultBought"; price }`, `{ type: "vaultOpened"; trophy: string; lifetimeEarnings: number }`; constants `FINALE_SECONDS`, `VAULT_TROPHY`, `VAULT_GROWTH`.

- [ ] **Step 1: Add the tuning constants** — append to `sim/tuning.ts`:

```ts
/** Vault Case I: its price grows this much per completed loop; the finale lasts this long. */
export const VAULT_GROWTH = 6;
export const FINALE_SECONDS = 20;
export const VAULT_TROPHY = "vault1";
```

- [ ] **Step 2: Write the failing tests** — `sim/vault.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CASES } from "./content/cases";
import { DEFAULT_SETUP, Run } from "./run";
import { FINALE_SECONDS, VAULT_TROPHY } from "./tuning";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};
const allUnlocked = (run: Run) => {
  run.state.unlocked = CASES.map((c) => c.id);
};

describe("Vault Case I", () => {
  it("shows once every case is unlocked, and costs the setup's vault price", () => {
    const run = new Run(1);
    run.state.cash = 1e9;
    expect(run.vaultShown()).toBe(false);
    expect(run.buyVault()).toEqual({ ok: false, reason: "unlock every case first" });
    allUnlocked(run);
    expect(run.vaultShown()).toBe(true);
    const cash = run.state.cash;
    expect(run.buyVault().ok).toBe(true);
    expect(cash - run.state.cash).toBe(DEFAULT_SETUP.vaultPrice);
    expect(run.drainEvents().map((e) => e.type)).toContain("vaultBought");
  });

  it("needs a clear bench and the cash", () => {
    const run = new Run(1);
    allUnlocked(run);
    run.state.cash = 10;
    expect(run.buyVault()).toEqual({ ok: false, reason: "not enough cash" });
    run.state.cash = 1e9;
    run.buyCase("bootcamp");
    expect(run.buyVault()).toEqual({ ok: false, reason: "bench is busy" });
  });

  it("runs the finale, sells the tray into the earnings, and ends the run", () => {
    const run = new Run(1);
    allUnlocked(run);
    run.state.cash = 1e9;
    run.state.tray.push({ id: 99, caseId: "bootcamp", skinId: "bc_woodland", rarity: "covert", float: 0.2, wear: "FT", statTrak: false, value: 50 });
    run.buyVault();
    expect(run.locked()).toBe(true);
    expect(run.buyCase("bootcamp")).toEqual({ ok: false, reason: "the vault is open" });
    tickFor(run, FINALE_SECONDS - 0.5);
    expect(run.state.over).toBe(false);
    const earned = run.state.lifetimeEarnings;
    tickFor(run, 1);
    expect(run.state.over).toBe(true);
    expect(run.state.tray).toHaveLength(0);
    expect(run.state.lifetimeEarnings).toBeGreaterThan(earned);
    const opened = run.drainEvents().filter((e) => e.type === "vaultOpened");
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ trophy: VAULT_TROPHY });
    const legendary = opened[0]!.type === "vaultOpened" ? opened[0]!.drop : null;
    expect(legendary?.rarity).toBe("gold"); // exactly one legendary drop, the trophy's showcase
    tickFor(run, 5);
    expect(run.drainEvents()).toHaveLength(0); // an ended run stays still
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim/vault`
Expected: FAIL — `run.vaultShown is not a function`.

- [ ] **Step 4: Implement in `sim/run.ts`**

Tuning import: add `FINALE_SECONDS, VAULT_TROPHY`.

`SimEvent`: add `| { type: "vaultBought"; price: number }` and `| { type: "vaultOpened"; trophy: string; drop: Drop; lifetimeEarnings: number }` (`drop` is the one legendary the vault opens on — shown, never sold).

`RunState`: add `/** Seconds into the vault finale, or null. */ finale: number | null;` and `/** The vault has opened: the run is over. */ over: boolean;`; constructor: `finale: null,` and `over: false,`.

Methods:

```ts
  /** The vault is open (finale running) or the run has ended: nothing else can be done. */
  locked(): boolean {
    return this.state.finale !== null || this.state.over;
  }

  vaultShown(): boolean {
    return CASES.every((c) => this.state.unlocked.includes(c.id));
  }

  buyVault(): ActionResult {
    const s = this.state;
    if (this.locked()) return fail("the vault is open");
    if (!this.vaultShown()) return fail("unlock every case first");
    if (s.bench.phase !== "empty") return fail("bench is busy");
    if (s.cash < this.setup.vaultPrice) return fail("not enough cash");
    s.cash -= this.setup.vaultPrice;
    s.finale = 0;
    this.events.push({ type: "vaultBought", price: this.setup.vaultPrice });
    return OK;
  }

  private tickFinale(dt: number): void {
    const s = this.state;
    if (s.finale === null) return;
    s.finale += dt;
    if (s.finale < FINALE_SECONDS) return;
    for (const d of s.tray) {
      const amount = this.payout(d, false);
      s.cash += amount;
      s.lifetimeEarnings += amount;
    }
    s.tray = [];
    s.over = true;
    const top = CASES[CASES.length - 1]!;
    const drop = rollDrop(top, priceOf(top.id), 0, this.rng, s.nextDropId++, "gold");
    this.events.push({ type: "vaultOpened", trophy: VAULT_TROPHY, drop, lifetimeEarnings: s.lifetimeEarnings });
  }
```

Guard every player action against a locked run — at the top of `buyCase`, `insertKey`, `sell`, `unlockCase`, `buyUpgrade`, `startDayJob`, `wakeBot`, `buyBotSpeed`, `claim` add:

```ts
    if (this.locked()) return fail("the vault is open");
```

In `tick`, right after `s.time += dt;` add `if (s.over) return;` and call `this.tickFinale(dt);` after `this.tickDayJob(dt);`.

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/modules/casecremental/sim
git commit -m "feat(sim): Vault Case I - bought once every case is unlocked, a 20 s finale, then the run ends"
```

### Task 6: Prestige meta — CLOUT, perks, charm offers, the next run's setup

**Files:** Create `sim/meta.ts`, `sim/meta.test.ts`; Modify `sim/tuning.ts`.

**Interfaces:**
- Consumes: `CharmId`, `RUN1_CHARMS` (Task 2); `RunSetup`, `ActionResult` (run.ts, type-only).
- Produces: `PerkId`, `PERK_IDS`, `MetaState { clout; perks; trophies; loops; lastGain; offer: CharmId[] | null; picked: CharmId[] }`, `freshMeta()`, `cloutFor(earnings)`, `perkCost(id, level)`, `charmSlots(meta)`, `offerCharms(seed, loops)`, `completeVault(meta, earnings, trophy, seed)`, `buyPerk(meta, id)`, `pickCharm(meta, id)`, `setupFor(meta)`.

- [ ] **Step 1: Add the tuning constants** — append to `sim/tuning.ts`:

```ts
/** CLOUT = floor(√(lifetime earnings) / this). */
export const CLOUT_DIVISOR = 10;
/** Each opened vault multiplies every later sale by this (the catch-up boost). */
export const CATCH_UP_PER_VAULT = 6;
export const CHARM_OFFER_SIZE = 3;
export const PERK_START_CASH = 20;
export const TRAY_PER_PERK = 4;
/** Meta perks, bought with CLOUT on the prestige screen. */
export const PERK_COSTS = {
  startCash: { baseCost: 3, growth: 1.8, maxLevel: 5 },
  luck: { baseCost: 5, growth: 2, maxLevel: 5 },
  charmSlot: { baseCost: 15, growth: 1, maxLevel: 1 },
  botAwake: { baseCost: 8, growth: 1, maxLevel: 1 },
  biggerTray: { baseCost: 4, growth: 2, maxLevel: 3 },
} as const;
```

- [ ] **Step 2: Write the failing tests** — `sim/meta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RUN1_CHARMS } from "./charms";
import { buyPerk, charmSlots, cloutFor, completeVault, freshMeta, offerCharms, perkCost, pickCharm, setupFor } from "./meta";
import { CATCH_UP_PER_VAULT, PERK_START_CASH, START_CASH, TRAY_BASE_CAPACITY, TRAY_PER_PERK, VAULT_BASE_PRICE, VAULT_GROWTH } from "./tuning";

describe("prestige meta", () => {
  it("pays CLOUT by the run's earnings", () => {
    expect(cloutFor(0)).toBe(0);
    expect(cloutFor(10_000)).toBe(10);
    expect(cloutFor(40_000)).toBeGreaterThan(cloutFor(10_000));
  });

  it("completes a vault once per call: CLOUT, the trophy (kept once), the loop, a 3-charm offer", () => {
    const m = freshMeta();
    completeVault(m, 10_000, "vault1", 42);
    completeVault(m, 10_000, "vault1", 42);
    expect(m.clout).toBe(20);
    expect(m.lastGain).toBe(10);
    expect(m.loops).toBe(2);
    expect(m.trophies).toEqual(["vault1"]);
    expect(m.offer).toHaveLength(3);
    expect(new Set(m.offer).size).toBe(3);
    for (const c of m.offer!) expect(RUN1_CHARMS).toContain(c);
    expect(offerCharms(42, 2)).toEqual(m.offer); // same seed and loop → same offer
  });

  it("picks charms up to the slot count; picking again un-picks", () => {
    const m = freshMeta();
    completeVault(m, 0, "vault1", 1);
    const [a, b] = m.offer!;
    expect(pickCharm(m, a!).ok).toBe(true);
    expect(pickCharm(m, b!)).toEqual({ ok: false, reason: "no free charm slot" });
    m.perks.charmSlot = 1;
    expect(charmSlots(m)).toBe(2);
    expect(pickCharm(m, b!).ok).toBe(true);
    expect(pickCharm(m, a!).ok).toBe(true);
    expect(m.picked).toEqual([b]);
    const outside = RUN1_CHARMS.find((c) => !m.offer!.includes(c))!;
    expect(pickCharm(m, outside)).toEqual({ ok: false, reason: "not offered" });
  });

  it("buys perks with CLOUT up to their max", () => {
    const m = freshMeta();
    m.clout = 100;
    expect(buyPerk(m, "botAwake").ok).toBe(true);
    expect(buyPerk(m, "botAwake")).toEqual({ ok: false, reason: "max level" });
    expect(m.clout).toBe(100 - perkCost("botAwake", 0)!);
    m.clout = 0;
    expect(buyPerk(m, "luck")).toEqual({ ok: false, reason: "not enough CLOUT" });
  });

  it("sets up the next run from perks, picked charms and loops", () => {
    const m = freshMeta();
    m.perks = { startCash: 2, luck: 3, charmSlot: 0, botAwake: 1, biggerTray: 1 };
    m.loops = 2;
    m.offer = ["insider", "doubleTap", "ricochet"];
    m.picked = ["insider"];
    expect(setupFor(m)).toEqual({
      startCash: START_CASH + 2 * PERK_START_CASH,
      luckBonus: 3,
      charms: ["insider"],
      botAwake: true,
      trayCapacity: TRAY_BASE_CAPACITY + TRAY_PER_PERK,
      valueBoost: CATCH_UP_PER_VAULT ** 2,
      vaultPrice: VAULT_BASE_PRICE * VAULT_GROWTH ** 2,
    });
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim/meta`
Expected: FAIL — `Cannot find module './meta'`.

- [ ] **Step 4: Write `sim/meta.ts`**

```ts
import { RUN1_CHARMS, type CharmId } from "./charms";
import { createRng } from "./rng";
import type { ActionResult, RunSetup } from "./run";
import {
  CATCH_UP_PER_VAULT,
  CHARM_OFFER_SIZE,
  CLOUT_DIVISOR,
  PERK_COSTS,
  PERK_START_CASH,
  START_CASH,
  TRAY_BASE_CAPACITY,
  TRAY_PER_PERK,
  VAULT_BASE_PRICE,
  VAULT_GROWTH,
} from "./tuning";

// What outlives a run (M2b spec §8): CLOUT, the perks bought with it, trophies, how many vaults have been
// opened, and the charms offered and picked for the next run. Plain data plus the rules; the controller
// owns one and saves it.

export type PerkId = keyof typeof PERK_COSTS;
export const PERK_IDS: readonly PerkId[] = ["startCash", "luck", "charmSlot", "botAwake", "biggerTray"];

export interface MetaState {
  clout: number;
  perks: Record<PerkId, number>;
  trophies: string[];
  /** Vaults opened — completed runs. */
  loops: number;
  /** CLOUT the last vault paid (for the prestige screen). */
  lastGain: number;
  /** Charms offered for the next run; null when not on the prestige screen. */
  offer: CharmId[] | null;
  picked: CharmId[];
}

export const freshMeta = (): MetaState => ({
  clout: 0,
  perks: { startCash: 0, luck: 0, charmSlot: 0, botAwake: 0, biggerTray: 0 },
  trophies: [],
  loops: 0,
  lastGain: 0,
  offer: null,
  picked: [],
});

const OK: ActionResult = { ok: true };
const fail = (reason: string): ActionResult => ({ ok: false, reason });

export const cloutFor = (lifetimeEarnings: number): number => Math.floor(Math.sqrt(Math.max(0, lifetimeEarnings)) / CLOUT_DIVISOR);

export function perkCost(id: PerkId, level: number): number | null {
  const c = PERK_COSTS[id];
  if (level >= c.maxLevel) return null;
  return Math.ceil(c.baseCost * c.growth ** level);
}

export const charmSlots = (m: MetaState): number => 1 + m.perks.charmSlot;

/** Three distinct charms from the run's pool — the same for the same seed and loop. */
export function offerCharms(seed: number, loops: number): CharmId[] {
  const rng = createRng((seed ^ Math.imul(loops + 1, 0x9e3779b1)) >>> 0);
  const pool = [...RUN1_CHARMS];
  const out: CharmId[] = [];
  while (out.length < CHARM_OFFER_SIZE && pool.length > 0) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!);
  return out;
}

/** A vault opened: pay CLOUT, keep the trophy, count the loop, offer the next run's charms. */
export function completeVault(m: MetaState, lifetimeEarnings: number, trophy: string, seed: number): void {
  const gain = cloutFor(lifetimeEarnings);
  m.clout += gain;
  m.lastGain = gain;
  m.loops += 1;
  if (!m.trophies.includes(trophy)) m.trophies.push(trophy);
  m.offer = offerCharms(seed, m.loops);
  m.picked = [];
}

export function buyPerk(m: MetaState, id: PerkId): ActionResult {
  const cost = perkCost(id, m.perks[id]);
  if (cost === null) return fail("max level");
  if (m.clout < cost) return fail("not enough CLOUT");
  m.clout -= cost;
  m.perks[id] += 1;
  return OK;
}

/** Toggle a charm for the next run (at most charmSlots). */
export function pickCharm(m: MetaState, id: CharmId): ActionResult {
  if (!m.offer) return fail("no charms on offer");
  if (!m.offer.includes(id)) return fail("not offered");
  const i = m.picked.indexOf(id);
  if (i >= 0) {
    m.picked.splice(i, 1);
    return OK;
  }
  if (m.picked.length >= charmSlots(m)) return fail("no free charm slot");
  m.picked.push(id);
  return OK;
}

export function setupFor(m: MetaState): RunSetup {
  return {
    startCash: START_CASH + PERK_START_CASH * m.perks.startCash,
    luckBonus: m.perks.luck,
    charms: [...m.picked],
    botAwake: m.perks.botAwake > 0,
    trayCapacity: TRAY_BASE_CAPACITY + TRAY_PER_PERK * m.perks.biggerTray,
    valueBoost: CATCH_UP_PER_VAULT ** m.loops,
    vaultPrice: VAULT_BASE_PRICE * VAULT_GROWTH ** m.loops,
  };
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental/sim && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/modules/casecremental/sim
git commit -m "feat(sim): prestige meta - CLOUT, perks, charm offers and the next run's setup"
```

### Task 7: Snapshots and the local save

**Files:** Modify `sim/run.ts`; Create `sim/snapshot.test.ts`, `game/save.ts`, `game/save.test.ts`.

**Interfaces:**
- Consumes: `createRng(seed, resume)`, `Rng.state()` (Task 1); `MetaState` (Task 6).
- Produces: `interface RunSnapshot { seed; rng: number; setup: RunSetup; state: RunState }`; `run.snapshot(): RunSnapshot`; `Run.fromSnapshot(snap): Run`; `game/save.ts`: `SAVE_KEY`, `SAVE_VERSION = 1`, `SaveData { v; meta; run }`, `SaveStore`, `decodeSave(raw)`, `encodeSave(data)`, `class SaveSlot { load(); save(data); clear() }`, `browserSlot()`.

- [ ] **Step 1: Write the failing tests**

`sim/snapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETUP, Run } from "./run";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};

describe("run snapshots", () => {
  it("restores a run mid-way — the bot carrying a card — and continues identically", () => {
    const a = new Run(5, { ...DEFAULT_SETUP, botAwake: true, charms: ["doubleTap"] });
    a.state.cash = 1e6;
    a.buyCase("bootcamp");
    a.insertKey();
    for (let i = 0; i < 600 && a.state.bot.job?.step !== "carry"; i++) a.tick(DT); // revealed, picked up, in hand
    expect(a.state.bot.job?.drop).not.toBeNull();
    const snap = JSON.parse(JSON.stringify(a.snapshot())) as ReturnType<Run["snapshot"]>;
    const b = Run.fromSnapshot(snap);
    expect(b.state).toEqual(a.state);
    expect(b.setup).toEqual(a.setup);
    for (const r of [a, b]) {
      r.drainEvents();
      tickFor(r, 5);
      r.buyCase("bootcamp");
      r.insertKey();
      tickFor(r, 4);
    }
    expect(b.state).toEqual(a.state);
  });

  it("restores a finale in progress", () => {
    const a = new Run(2);
    a.state.unlocked = ["bootcamp", "wildwood", "bedrock"];
    a.state.cash = 1e9;
    a.buyVault();
    tickFor(a, 7);
    const b = Run.fromSnapshot(a.snapshot());
    tickFor(b, 14);
    expect(b.state.over).toBe(true);
  });
});
```

`game/save.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { freshMeta } from "../sim/meta";
import { Run } from "../sim/run";
import { decodeSave, encodeSave, SAVE_KEY, SAVE_VERSION, SaveSlot, type SaveData } from "./save";

afterEach(() => vi.restoreAllMocks());

const data = (): SaveData => ({ v: SAVE_VERSION, meta: freshMeta(), run: new Run(3).snapshot() });
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe("the local save", () => {
  it("round-trips the meta and the run", () => {
    const d = data();
    d.meta.clout = 12;
    expect(decodeSave(encodeSave(d))).toEqual(d);
  });

  it("drops a missing, broken, foreign or old save — with a warning, never a throw", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(decodeSave(null)).toBeNull();
    expect(decodeSave("{not json")).toBeNull();
    expect(decodeSave(JSON.stringify({ hello: 1 }))).toBeNull();
    expect(decodeSave(JSON.stringify({ ...data(), v: 0 }))).toBeNull();
    const noTray = data() as unknown as { run: { state: Record<string, unknown> } };
    delete noTray.run.state.tray;
    expect(decodeSave(JSON.stringify(noTray))).toBeNull();
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it("saves, loads and clears through a slot; a broken store never throws", () => {
    const store = memory();
    const slot = new SaveSlot(store);
    slot.save(data());
    expect(store.m.has(SAVE_KEY)).toBe(true);
    expect(slot.load()).toEqual(data());
    slot.clear();
    expect(slot.load()).toBeNull();
    const broken = new SaveSlot({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(() => broken.save(data())).not.toThrow();
    expect(broken.load()).toBeNull();
    expect(() => broken.clear()).not.toThrow();
    expect(new SaveSlot(null).load()).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim/snapshot src/modules/casecremental/game/save`
Expected: FAIL — `a.snapshot is not a function`; `Cannot find module './save'`.

- [ ] **Step 3: Implement**

`sim/run.ts` — add after `DEFAULT_SETUP`:

```ts
/** Everything needed to rebuild a run exactly (the local save, M2b spec §9). */
export interface RunSnapshot {
  seed: number;
  rng: number;
  setup: RunSetup;
  state: RunState;
}
```

change the constructor signature and its first lines to:

```ts
  constructor(seed: number, setup: RunSetup = DEFAULT_SETUP, resume?: RunSnapshot) {
    this.seed = seed;
    this.setup = { ...setup, charms: [...setup.charms] };
    this.rng = createRng(seed, resume?.rng);
    if (resume) {
      this.state = structuredClone(resume.state);
      return;
    }
```

(the fresh-state assignment follows unchanged), and add:

```ts
  static fromSnapshot(snap: RunSnapshot): Run {
    return new Run(snap.seed, snap.setup, snap);
  }

  snapshot(): RunSnapshot {
    return { seed: this.seed, rng: this.rng.state(), setup: structuredClone(this.setup), state: structuredClone(this.state) };
  }
```

`game/save.ts`:

```ts
import type { MetaState } from "../sim/meta";
import type { RunSnapshot } from "../sim/run";

// The local save (M2b spec §9): the meta and the run in progress under one localStorage key, versioned.
// A save that is missing, broken or from another version never stops the game — it is dropped with a
// warning and a fresh run starts; storage errors are swallowed. M4 moves the same data to the server.

export const SAVE_KEY = "casecremental.save";
export const SAVE_VERSION = 1;

export interface SaveData {
  v: typeof SAVE_VERSION;
  meta: MetaState;
  run: RunSnapshot;
}

export type SaveStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function isSave(d: unknown): d is SaveData {
  if (!isObj(d) || d.v !== SAVE_VERSION || !isObj(d.meta) || !isObj(d.run)) return false;
  const m = d.meta;
  const r = d.run;
  if (!isNum(m.clout) || !isObj(m.perks) || !Array.isArray(m.trophies) || !isNum(m.loops) || !Array.isArray(m.picked)) return false;
  if (!isNum(r.seed) || !isNum(r.rng) || !isObj(r.setup) || !isObj(r.state)) return false;
  const s = r.state;
  return isNum(s.cash) && isNum(s.time) && isObj(s.bench) && Array.isArray(s.tray) && isObj(s.bot) && Array.isArray(s.unlocked);
}

export const encodeSave = (data: SaveData): string => JSON.stringify(data);

export function decodeSave(raw: string | null): SaveData | null {
  if (raw === null) return null;
  try {
    const d: unknown = JSON.parse(raw);
    if (isSave(d)) return d;
  } catch {
    // fall through to the warning
  }
  console.warn("[casecremental] the saved game could not be read — starting fresh");
  return null;
}

export class SaveSlot {
  constructor(private readonly store: SaveStore | null) {}

  load(): SaveData | null {
    let raw: string | null = null;
    try {
      raw = this.store?.getItem(SAVE_KEY) ?? null;
    } catch {
      return null;
    }
    return decodeSave(raw);
  }

  save(data: SaveData): void {
    try {
      this.store?.setItem(SAVE_KEY, encodeSave(data));
    } catch {
      // storage full or blocked: keep playing
    }
  }

  clear(): void {
    try {
      this.store?.removeItem(SAVE_KEY);
    } catch {
      // nothing to clear
    }
  }
}

/** The browser's localStorage, or no storage at all when it is blocked. */
export function browserSlot(): SaveSlot {
  try {
    return new SaveSlot(typeof localStorage === "undefined" ? null : localStorage);
  } catch {
    return new SaveSlot(null);
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/sim src/modules/casecremental/game/save.ts src/modules/casecremental/game/save.test.ts
git commit -m "feat(save): run snapshots (RNG included) and a versioned local save that never breaks the game"
```

### Task 8: The controller runs the campaign — meta, prestige, autosave, agent

**Files:** Modify `game/controller.ts`, `game/controller.test.ts`, `game/agent.ts`, `sim/run.ts` (one event type).

**Interfaces:**
- Consumes: Tasks 2–7.
- Produces: `Action` adds `claim { index }`, `wakeBot`, `buyBotSpeed`, `setBotThreshold { rarity }`, `startDayJob`, `buyVault`, `buyPerk { id }`, `pickCharm { id }`, `startNextRun`; `new GameController(seed?, slot: SaveSlot | null = null)`; `controller.run` (getter; a new `Run` after prestige); `controller.meta`; `controller.resetProgress(seed?)`; `SimEvent` adds `{ type: "runStarted" }` (emitted by the controller).

- [ ] **Step 1: Write the failing tests** — append to `game/controller.test.ts` (add imports `import { CASES } from "../sim/content/cases";`, `import { FINALE_SECONDS } from "../sim/tuning";`, `import { SaveSlot } from "./save";`):

```ts
const memorySlot = () => {
  const m = new Map<string, string>();
  return new SaveSlot({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) });
};
function openVault(c: GameController) {
  c.run.state.unlocked = CASES.map((x) => x.id);
  c.run.state.cash = 1e9;
  expect(c.act({ type: "buyVault" }).ok).toBe(true);
  for (let t = 0; t < FINALE_SECONDS + 1; t += 0.2) c.step(0.2);
}

describe("GameController — the campaign", () => {
  it("routes the new actions", () => {
    const c = new GameController(1);
    c.run.state.cash = 1e6;
    expect(c.act({ type: "wakeBot" }).ok).toBe(true);
    expect(c.act({ type: "buyBotSpeed" }).ok).toBe(true);
    expect(c.act({ type: "setBotThreshold", rarity: "covert" }).ok).toBe(true);
    expect(c.act({ type: "claim", index: 0 }).ok).toBe(false);
    expect(c.act({ type: "startDayJob" }).ok).toBe(false);
  });

  it("pays the vault into the meta exactly once, then prestiges into a fresh boosted run", () => {
    const c = new GameController(1);
    const events: string[] = [];
    c.onEvent((e) => events.push(e.type));
    openVault(c);
    c.step(1);
    expect(c.meta.loops).toBe(1);
    expect(c.meta.trophies).toEqual(["vault1"]);
    expect(c.meta.offer).toHaveLength(3);
    expect(c.act({ type: "pickCharm", id: c.meta.offer![0]! }).ok).toBe(true);
    c.meta.clout = 50;
    expect(c.act({ type: "buyPerk", id: "botAwake" }).ok).toBe(true);
    const old = c.run;
    expect(c.act({ type: "startNextRun" }).ok).toBe(true);
    expect(c.run).not.toBe(old);
    expect(c.run.state.over).toBe(false);
    expect(c.run.state.bot.awake).toBe(true);
    expect(c.run.setup.charms).toHaveLength(1);
    expect(c.run.setup.valueBoost).toBeGreaterThan(1);
    expect(c.meta.offer).toBeNull();
    expect(events).toContain("runStarted");
    expect(c.act({ type: "startNextRun" })).toEqual({ ok: false, reason: "the run is still going" });
    expect(c.meta.loops).toBe(1);
  });

  it("refuses perks during a run", () => {
    const c = new GameController(1);
    c.meta.clout = 50;
    expect(c.act({ type: "buyPerk", id: "luck" })).toEqual({ ok: false, reason: "perks are bought between runs" });
  });

  it("saves and restores the run and the meta — prestige included — through its slot", () => {
    const slot = memorySlot();
    const a = new GameController(1, slot);
    a.act({ type: "buyCase", caseId: "bootcamp" });
    openVaultAfterUnlock(a);
    const b = new GameController(999, slot);
    expect(b.meta.loops).toBe(1);
    expect(b.meta.offer).toEqual(a.meta.offer);
    expect(b.run.state.over).toBe(true);
    expect(b.run.state.cash).toBeCloseTo(a.run.state.cash);
  });

  it("starts fresh when the save is broken, and resetProgress forgets everything", () => {
    const slot = memorySlot();
    slot.save({ v: 1, meta: { clout: 5 } as never, run: {} as never });
    const c = new GameController(1, slot);
    expect(c.meta.clout).toBe(0);
    c.meta.clout = 9;
    c.resetProgress(2);
    expect(c.meta.clout).toBe(0);
    expect(new GameController(3, slot).meta.clout).toBe(0);
  });
});

function openVaultAfterUnlock(c: GameController) {
  c.run.state.bench = { phase: "empty" };
  openVault(c);
  c.step(1);
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/game/controller`
Expected: FAIL — unknown action types / `c.meta` undefined.

- [ ] **Step 3: Implement**

`sim/run.ts` — add to `SimEvent`: `| { type: "runStarted" } // emitted by the controller when a new run begins`.

`game/controller.ts` — replace the file:

```ts
import type { CharmId } from "../sim/charms";
import { buyPerk, completeVault, freshMeta, pickCharm, setupFor, type MetaState, type PerkId } from "../sim/meta";
import { Run, type ActionResult, type SimEvent } from "../sim/run";
import type { RarityId } from "../sim/types";
import type { UpgradeId } from "../sim/upgrades";
import { SAVE_VERSION, type SaveSlot } from "./save";
import { buildView, type GameView } from "./view";

// Owns the campaign: the prestige meta and the current run. The scene calls step() every frame; the
// player, the React panel and the agent all change the game through act() — the one input path. After a
// vault the meta is paid once; startNextRun swaps in a fresh run built from the meta. Everything is saved
// to the slot about once a second and after every successful action.

export type Action =
  | { type: "buyCase"; caseId: string }
  | { type: "insertKey" }
  | { type: "sell" }
  | { type: "unlockCase"; caseId: string }
  | { type: "buyUpgrade"; id: UpgradeId }
  | { type: "claim"; index: number }
  | { type: "wakeBot" }
  | { type: "buyBotSpeed" }
  | { type: "setBotThreshold"; rarity: RarityId }
  | { type: "startDayJob" }
  | { type: "buyVault" }
  | { type: "buyPerk"; id: PerkId }
  | { type: "pickCharm"; id: CharmId }
  | { type: "startNextRun" };

export const SIM_STEP = 1 / 30;
/** A frame longer than this (tab was hidden, debugger pause) is clamped. */
export const MAX_FRAME_SECONDS = 0.25;
const VIEW_REFRESH_SECONDS = 0.1;
const AUTOSAVE_SECONDS = 1;

export class GameController {
  readonly meta: MetaState;
  /** Set each frame by the scene: 0 = hit-stop, <1 = slow-mo. */
  timeScale = 1;
  mounted = false;
  running = false;

  private current: Run;
  private acc = 0;
  private viewAge = 0;
  private saveAge = 0;
  private view: GameView;
  private readonly eventListeners = new Set<(e: SimEvent) => void>();
  private readonly viewListeners = new Set<() => void>();

  constructor(
    seed: number = Date.now() >>> 0,
    private readonly slot: SaveSlot | null = null,
  ) {
    const saved = slot?.load() ?? null;
    this.meta = saved ? saved.meta : freshMeta();
    this.current = saved ? Run.fromSnapshot(saved.run) : new Run(seed);
    this.view = buildView(this.current, this.meta);
  }

  get run(): Run {
    return this.current;
  }

  step(realSeconds: number): void {
    const frame = Math.min(Math.max(realSeconds, 0), MAX_FRAME_SECONDS);
    this.acc += frame * this.timeScale;
    while (this.acc >= SIM_STEP) {
      this.current.tick(SIM_STEP);
      this.acc -= SIM_STEP;
    }
    this.flush();
    this.viewAge += frame;
    if (this.viewAge >= VIEW_REFRESH_SECONDS) {
      this.viewAge = 0;
      this.refreshView();
    }
    this.saveAge += frame;
    if (this.saveAge >= AUTOSAVE_SECONDS) {
      this.saveAge = 0;
      this.save();
    }
  }

  act(action: Action): ActionResult {
    const r = this.dispatch(action);
    this.flush();
    if (r.ok) this.save();
    this.refreshView();
    return r;
  }

  /** Dev: forget the save and start a fresh campaign. */
  resetProgress(seed: number = Date.now() >>> 0): void {
    this.slot?.clear();
    Object.assign(this.meta, freshMeta());
    this.current = new Run(seed);
    this.emit({ type: "runStarted" });
    this.refreshView();
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
    const run = this.current;
    switch (a.type) {
      case "buyCase":
        return run.buyCase(a.caseId);
      case "insertKey":
        return run.insertKey();
      case "sell":
        return run.sell();
      case "unlockCase":
        return run.unlockCase(a.caseId);
      case "buyUpgrade":
        return run.buyUpgrade(a.id);
      case "claim":
        return run.claim(a.index);
      case "wakeBot":
        return run.wakeBot();
      case "buyBotSpeed":
        return run.buyBotSpeed();
      case "setBotThreshold":
        return run.setBotThreshold(a.rarity);
      case "startDayJob":
        return run.startDayJob();
      case "buyVault":
        return run.buyVault();
      case "buyPerk":
        return run.state.over ? buyPerk(this.meta, a.id) : { ok: false, reason: "perks are bought between runs" };
      case "pickCharm":
        return pickCharm(this.meta, a.id);
      case "startNextRun":
        return this.startNextRun();
    }
  }

  private startNextRun(): ActionResult {
    if (!this.current.state.over) return { ok: false, reason: "the run is still going" };
    const seed = (this.current.seed + Math.imul(this.meta.loops, 0x9e3779b1)) >>> 0;
    this.current = new Run(seed, setupFor(this.meta));
    this.meta.offer = null;
    this.meta.picked = [];
    this.emit({ type: "runStarted" });
    return { ok: true };
  }

  private flush(): void {
    for (const e of this.current.drainEvents()) {
      if (e.type === "vaultOpened") {
        completeVault(this.meta, e.lifetimeEarnings, e.trophy, this.current.seed);
        this.save();
      }
      this.emit(e);
    }
  }

  private emit(e: SimEvent): void {
    for (const l of this.eventListeners) l(e);
  }

  private save(): void {
    this.slot?.save({ v: SAVE_VERSION, meta: this.meta, run: this.current.snapshot() });
  }

  private refreshView(): void {
    this.view = buildView(this.current, this.meta);
    for (const l of this.viewListeners) l();
  }
}
```

`game/view.ts` — for now only widen the signature so the controller compiles (Task 9 fills it in): `export function buildView(run: Run, meta: MetaState = freshMeta()): GameView {` with `import { freshMeta, type MetaState } from "../sim/meta";` (add `void meta;` as the first line of the body until Task 9 uses it).

`game/agent.ts` — add to `actions` (before the closing brace):

```ts
      claim: (args: Args) => run({ type: "claim", index: Number(args?.index ?? 0) }),
      wakeBot: () => run({ type: "wakeBot" }),
      buyBotSpeed: () => run({ type: "buyBotSpeed" }),
      setBotThreshold: async (args: Args) => {
        const r = String(args?.rarity ?? "");
        if (!RARITY_ORDER.includes(r as RarityId)) throw new Error(`unknown rarity "${r}"; valid: ${RARITY_ORDER.join(", ")}`);
        return c.act({ type: "setBotThreshold", rarity: r as RarityId });
      },
      startDayJob: () => run({ type: "startDayJob" }),
      buyVault: () => run({ type: "buyVault" }),
      buyPerk: async (args: Args) => {
        const id = String(args?.id ?? "");
        if (!PERK_IDS.includes(id as PerkId)) throw new Error(`unknown perk "${id}"; valid: ${PERK_IDS.join(", ")}`);
        return c.act({ type: "buyPerk", id: id as PerkId });
      },
      pickCharm: (args: Args) => run({ type: "pickCharm", id: String(args?.id ?? "") as CharmId }),
      startNextRun: () => run({ type: "startNextRun" }),
```

to `describeActions`:

```ts
      claim: "Sell a claim-tray item by hand: { index }.",
      wakeBot: "Wake the bot (it then carries drops to the bin or the tray).",
      buyBotSpeed: "Buy one bot Speed level.",
      setBotThreshold: "The rarest drop the bot may sell: { rarity: milspec|restricted|classified|covert|gold }.",
      startDayJob: "Broke with an empty bench: take a ~3 s day job.",
      buyVault: "Buy Vault Case I (all cases unlocked); its finale ends the run.",
      buyPerk: "Between runs: buy a perk with CLOUT: { id: startCash|luck|charmSlot|botAwake|biggerTray }.",
      pickCharm: "Between runs: toggle an offered charm for the next run: { id }.",
      startNextRun: "Between runs: start the next run.",
```

and to `state()`'s returned object: `tray: s.tray.length, bot: { awake: s.bot.awake, speedLevel: s.bot.speedLevel, threshold: s.bot.threshold, step: s.bot.job?.step ?? null }, dayJob: s.dayJob, finale: s.finale, over: s.over, meta: { clout: c.meta.clout, loops: c.meta.loops, offer: c.meta.offer, picked: c.meta.picked },`. Imports: `RARITY_ORDER` from `../sim/rarity`, `type RarityId` from `../sim/types`, `PERK_IDS, type PerkId` from `../sim/meta`, `type CharmId` from `../sim/charms`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental
git commit -m "feat(game): the controller runs the campaign - meta, prestige, autosave, new actions"
```

### Task 9: The view model shows the bot, tray, day job, vault, finale and prestige

**Files:** Modify `game/view.ts`, `game/view.test.ts`.

**Interfaces:**
- Consumes: everything above.
- Produces (added to `GameView`): `bot: BotView`, `tray: { items: TrayItemView[]; capacity }`, `dayJob: { available; working; progress }`, `vault: { shown; price; canBuy }`, `finale: number | null` (0–1), `over: boolean`, `prestige: PrestigeView | null`; `nextGoal` gains `{ kind: "vault"; progress }`; case prices use `run.casePrice`.

- [ ] **Step 1: Write the failing tests** — append to `game/view.test.ts` (imports: `CASES` from `../sim/content/cases`, `completeVault, freshMeta` from `../sim/meta`, `DEFAULT_SETUP` from `../sim/run`, `BOT_WAKE_COST, DAY_JOB_SECONDS` from `../sim/tuning`):

```ts
describe("buildView — M2b", () => {
  it("shows the bot asleep and wakeable", () => {
    const run = new Run(1);
    run.state.cash = BOT_WAKE_COST;
    const v = buildView(run);
    expect(v.bot).toMatchObject({ awake: false, canWake: true, wakeCost: BOT_WAKE_COST, speed: 1, step: null, waiting: false });
  });

  it("shows the tray and the day job", () => {
    const run = new Run(1, { ...DEFAULT_SETUP, trayCapacity: 12 });
    run.state.tray.push({ id: 1, caseId: "bootcamp", skinId: "bc_woodland", rarity: "covert", float: 0.2, wear: "FT", statTrak: false, value: 40 });
    run.state.cash = 0;
    let v = buildView(run);
    expect(v.tray.capacity).toBe(12);
    expect(v.tray.items[0]).toMatchObject({ skinId: "bc_woodland", rarity: "covert" });
    expect(v.dayJob).toEqual({ available: true, working: false, progress: 0 });
    run.startDayJob();
    run.tick(DAY_JOB_SECONDS / 2);
    v = buildView(run);
    expect(v.dayJob.working).toBe(true);
    expect(v.dayJob.progress).toBeCloseTo(0.5, 1);
  });

  it("makes the vault the goal once every case is unlocked, and shows the finale", () => {
    const run = new Run(1);
    run.state.unlocked = CASES.map((c) => c.id);
    run.state.cash = DEFAULT_SETUP.vaultPrice / 2;
    let v = buildView(run);
    expect(v.vault).toEqual({ shown: true, price: DEFAULT_SETUP.vaultPrice, canBuy: false });
    expect(v.nextGoal).toEqual({ kind: "vault", progress: 0.5 });
    run.state.cash = DEFAULT_SETUP.vaultPrice;
    run.buyVault();
    run.tick(5);
    v = buildView(run);
    expect(v.finale).toBeCloseTo(0.25);
  });

  it("shows the prestige screen once the run is over", () => {
    const run = new Run(1);
    run.state.over = true;
    const meta = freshMeta();
    completeVault(meta, 10_000, "vault1", 1);
    const v = buildView(run, meta);
    expect(v.over).toBe(true);
    expect(v.prestige).toMatchObject({ clout: 10, gained: 10, loops: 1, slots: 1, picked: [] });
    expect(v.prestige!.offer).toHaveLength(3);
    expect(v.prestige!.perks.map((p) => p.id)).toEqual(["startCash", "luck", "charmSlot", "botAwake", "biggerTray"]);
    expect(buildView(new Run(1)).prestige).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/game/view`
Expected: FAIL — `v.bot` undefined.

- [ ] **Step 3: Implement** — in `game/view.ts`:

Imports: add `import type { BotStep } from "../sim/botSeller";`, `import { botSpeed, botSpeedCost } from "../sim/botSeller";`, `import type { CharmId } from "../sim/charms";`, `import { charmSlots, freshMeta, PERK_IDS, perkCost, type MetaState, type PerkId } from "../sim/meta";`, `import type { RarityId } from "../sim/types";`, `import { BOT_WAKE_COST, DAY_JOB_SECONDS, FINALE_SECONDS, PERK_COSTS } from "../sim/tuning";`.

Add interfaces:

```ts
export interface BotView {
  awake: boolean;
  wakeCost: number;
  canWake: boolean;
  speed: number;
  speedLevel: number;
  speedCost: number | null;
  canBuySpeed: boolean;
  threshold: RarityId;
  step: BotStep | null;
  /** Standing by a full tray. */
  waiting: boolean;
}

export interface TrayItemView {
  skinId: string;
  rarity: RarityId;
  /** What it pays sold by hand right now, before combo. */
  value: number;
}

export interface PerkView {
  id: PerkId;
  level: number;
  maxLevel: number;
  cost: number | null;
  canBuy: boolean;
}

export interface PrestigeView {
  clout: number;
  gained: number;
  loops: number;
  perks: PerkView[];
  offer: CharmId[];
  picked: CharmId[];
  slots: number;
}
```

`GameView` — add fields:

```ts
  bot: BotView;
  tray: { items: TrayItemView[]; capacity: number };
  dayJob: { available: boolean; working: boolean; progress: number };
  vault: { shown: boolean; price: number; canBuy: boolean };
  /** Finale progress 0–1, or null. */
  finale: number | null;
  over: boolean;
  prestige: PrestigeView | null;
```

and widen `nextGoal` with `| { kind: "vault"; progress: number }`.

`buildView` — replace the signature line with `export function buildView(run: Run, meta: MetaState = freshMeta()): GameView {` (drop the temporary `void meta;`); in the case mapping use `run.casePrice(c.id)` for `price` and `canBuy`; and build the new parts before `return`:

```ts
  const b = s.bot;
  const speedCost = botSpeedCost(b.speedLevel);
  const bot: BotView = {
    awake: b.awake,
    wakeCost: BOT_WAKE_COST,
    canWake: !b.awake && s.cash >= BOT_WAKE_COST && !run.locked(),
    speed: botSpeed(b.speedLevel),
    speedLevel: b.speedLevel,
    speedCost,
    canBuySpeed: b.awake && speedCost !== null && s.cash >= speedCost && !run.locked(),
    threshold: b.threshold,
    step: b.job?.step ?? null,
    waiting: b.job?.step === "wait",
  };
  const tray = {
    items: s.tray.map((d) => ({ skinId: d.skinId, rarity: d.rarity, value: run.payout(d, false) })),
    capacity: run.setup.trayCapacity,
  };
  const dayJob = {
    available: run.dayJobAvailable() && !run.locked(),
    working: s.dayJob !== null,
    progress: s.dayJob === null ? 0 : Math.min(1, s.dayJob / DAY_JOB_SECONDS),
  };
  const vault = { shown: run.vaultShown(), price: run.setup.vaultPrice, canBuy: run.vaultShown() && benchFree && s.cash >= run.setup.vaultPrice && !run.locked() };
  const prestige: PrestigeView | null = s.over
    ? {
        clout: meta.clout,
        gained: meta.lastGain,
        loops: meta.loops,
        perks: PERK_IDS.map((id) => {
          const cost = perkCost(id, meta.perks[id]);
          return { id, level: meta.perks[id], maxLevel: PERK_COSTS[id].maxLevel, cost, canBuy: cost !== null && meta.clout >= cost };
        }),
        offer: meta.offer ?? [],
        picked: [...meta.picked],
        slots: charmSlots(meta),
      }
    : null;
```

and add `bot, tray, dayJob, vault, finale: s.finale === null ? null : Math.min(1, s.finale / FINALE_SECONDS), over: s.over, prestige,` to the returned object; change the `nextGoal` call to `nextGoal(s.cash, cases, upgrades, vault)` and update the function:

```ts
function nextGoal(cash: number, cases: CaseView[], upgrades: UpgradeView[], vault: GameView["vault"]): GameView["nextGoal"] {
  const progress = (cost: number) => Math.min(1, Math.max(0, cash / cost));
  const next = cases.find((c) => !c.unlocked);
  if (next) return { kind: "unlock", caseId: next.id, progress: progress(next.unlockCost) };
  if (vault.shown) return { kind: "vault", progress: progress(vault.price) };
  let cheapest: UpgradeView | null = null;
  for (const u of upgrades) if (u.cost !== null && (cheapest === null || u.cost < (cheapest.cost ?? Infinity))) cheapest = u;
  if (!cheapest || cheapest.cost === null) return null;
  return { kind: "upgrade", upgradeId: cheapest.id, level: cheapest.level + 1, progress: progress(cheapest.cost) };
}
```

If an existing `view.test.ts` case asserts an "upgrade" goal with every case unlocked, change its expectation to `{ kind: "vault", … }` — the vault is now the goal there (spec §7).

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS; typecheck clean (the HUD's `goalName` must accept the new `vault` kind — if typecheck flags `ui/Hud.tsx`, add `goal.kind === "vault" ? "VAULT" :` as a temporary label; Plan M2b-B localises it).

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental
git commit -m "feat(game): the view shows the bot, the tray, the day job, the vault, the finale and prestige"
```

### Task 10: Keep the canvas coherent, and save in the browser

**Files:** Modify `fx/World.ts`, `module.ts`.

**Interfaces:**
- Consumes: the events of Tasks 2–8; `browserSlot()` (Task 7).
- Produces: nothing new for later code (Plan M2b-B replaces these minimal reactions with the real visuals).

- [ ] **Step 1: React to the new events in `fx/World.ts`**

In `onEvent`, replace the `case "sold": {` block's first lines so only bench sales clear the card; bot and tray sales burst coins from the bin:

```ts
      case "sold": {
        const fromBench = e.source === "bench";
        const at = this.screenPt(fromBench ? this.bench.revealCentre() : this.l.bin);
        if (fromBench) this.knifeFlight.cancel();
        this.hd.coins.burst(at, { x: this.screen.w / 2, y: (this.l.hudH / 2) * this.vp.scale }, e.amount);
        this.hd.coins.floatText({ x: at.x, y: at.y - 10 * this.vp.scale }, `+${formatCash(e.amount, getLang())}`);
        if (fromBench) this.hd.setGlow(null);
        this.audio.play("cash-register");
        this.audio.play("coin-clink", { rate: comboPitch(e.combo), delay: 0.05 });
        if (e.amount >= 100) this.audio.play("coin-cascade", { delay: 0.1 });
        if (fromBench) this.bench.clearReveal(true);
        break;
      }
      case "botPickedUp":
        this.knifeFlight.cancel();
        this.bench.clearReveal(false);
        this.hd.setGlow(null);
        break;
      case "stored":
        this.audio.play("coin-clink", { rate: 0.8 });
        break;
      case "vaultBought":
        this.hd.flash(0xffd700, 0.5);
        this.audio.play("jackpot-swell");
        break;
      case "runStarted":
        this.knifeFlight.cancel();
        this.bench.clearReveal(false);
        this.bench.hideCase();
        this.hd.setGlow(null);
        this.restore(); // the fresh run's stage 1, look and music
        break;
```

- [ ] **Step 2: Save in the browser** — in `module.ts`, import `browserSlot` from `./game/save` and replace `const controller = new GameController();` with:

```ts
    const controller = new GameController(undefined, browserSlot()); // the run and the meta survive a reload
```

- [ ] **Step 3: Run every check**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS; typecheck clean; build succeeds.

- [ ] **Step 4: Browser check**

`npm run dev`, open the game: buy and open a case, sell it; note the cash; reload the page → the same cash, unlocked cases and upgrades are back. Open the dev board and confirm no console errors. (Bot, tray, day job, vault and prestige have no UI until Plan M2b-B; they are exercised through tests and the agent API.)

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/fx/World.ts src/modules/casecremental/module.ts
git commit -m "feat(fx): keep the canvas coherent with bot and tray sales and a new run; save in the browser"
```

### Task 11: Pacing for the whole of Run 1, and a boosted second run

**Files:** Modify `sim/bot.ts`, `sim/pacing.test.ts`, `sim/tuning.ts` (numbers only).

**Interfaces:**
- Consumes: everything above.
- Produces: `playGreedy(seed, seconds, timings = HUMAN, setup = DEFAULT_SETUP): PacingReport` with `PacingReport` adding `botAwakeAt?: number`, `allUnlockedAt?: number`, `vaultAt?: number`, `longestTrayFull: number`, `lifetimeEarnings: number`.

- [ ] **Step 1: Write the failing tests** — append to `sim/pacing.test.ts` (imports: `completeVault, freshMeta, PERK_IDS, buyPerk, perkCost, setupFor` from `./meta`; `HUMAN` from `./bot`):

```ts
describe("pacing — the whole of Run 1 and a boosted second run", () => {
  const first = SEEDS.map((s) => playGreedy(s, 900));
  const med = (pick: (r: (typeof first)[number]) => number | undefined, rs = first) =>
    median(rs.map((r) => pick(r) ?? Number.POSITIVE_INFINITY));

  it("wakes the bot by about two and a half minutes", () => {
    expect(med((r) => r.botAwakeAt)).toBeLessThan(150);
  });

  it("buys Vault Case I at 6–10 minutes", () => {
    const t = med((r) => r.vaultAt);
    expect(t).toBeGreaterThan(360);
    expect(t).toBeLessThan(600);
  });

  it("never leaves the tray stuck full for long", () => {
    for (const r of first) expect(r.longestTrayFull).toBeLessThan(10);
  });

  it("a boosted second run (one vault, cheapest perk) catches up in 1–2 min and vaults again by 5–7 min", () => {
    const second = SEEDS.map((s, i) => {
      const meta = freshMeta();
      completeVault(meta, first[i]!.lifetimeEarnings, "vault1", s);
      const cheapest = [...PERK_IDS].sort((a, b) => (perkCost(a, 0) ?? Infinity) - (perkCost(b, 0) ?? Infinity))[0]!;
      buyPerk(meta, cheapest);
      return playGreedy(s + 100, 900, HUMAN, setupFor(meta));
    });
    const caughtUp = med((r) => r.allUnlockedAt, second);
    expect(caughtUp).toBeGreaterThan(60);
    expect(caughtUp).toBeLessThan(120);
    const again = med((r) => r.vaultAt, second);
    expect(again).toBeGreaterThan(300);
    expect(again).toBeLessThan(420);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim/pacing`
Expected: FAIL — the report has no `vaultAt` / `botAwakeAt` (the greedy player never wakes the bot or buys the vault).

- [ ] **Step 3: Rewrite the greedy player** — `sim/bot.ts`:

```ts
import { CASES, unlockCostOf } from "./content/cases";
import { botSpeedCost } from "./botSeller";
import { DEFAULT_SETUP, Run, type RunSetup } from "./run";
import { BOT_WAKE_COST } from "./tuning";
import { UPGRADE_IDS, upgradeCost } from "./upgrades";

// A greedy player at human speed, used by the pacing test to check how fast a run unfolds. It claims tray
// items as soon as it can, sells what lands on the bench (unless the bot got there first), unlocks the next
// case as soon as it can afford it plus one case, wakes the bot when it has twice the price, buys the
// cheapest upgrade (bot Speed included) when it costs at most a quarter of its cash, takes the day job when
// broke, and buys the vault as soon as it can.

export interface BotTimings {
  buy: number;
  key: number;
  sell: number;
  /** Seeing the card land before reaching for it. */
  reveal: number;
}

export const HUMAN: BotTimings = { buy: 0.3, key: 0.4, sell: 0.5, reveal: 0.25 };

export interface PacingReport {
  caseUnlockedAt: Record<string, number>;
  stageReachedAt: Record<number, number>;
  botAwakeAt?: number;
  allUnlockedAt?: number;
  vaultAt?: number;
  /** Longest stretch (s) the claim tray stayed full. */
  longestTrayFull: number;
  lifetimeEarnings: number;
  finalCash: number;
}

const DT = 1 / 30;

export function playGreedy(seed: number, seconds: number, timings: BotTimings = HUMAN, setup: RunSetup = DEFAULT_SETUP): PacingReport {
  const run = new Run(seed, setup);
  const report: PacingReport = { caseUnlockedAt: {}, stageReachedAt: {}, longestTrayFull: 0, lifetimeEarnings: 0, finalCash: 0 };
  if (setup.botAwake) report.botAwakeAt = 0;
  let busyUntil = 0;
  let fullFor = 0;

  while (run.state.time < seconds && !run.state.over) {
    run.tick(DT);
    const s = run.state;
    for (const e of run.drainEvents()) {
      if (e.type === "caseUnlocked") {
        report.caseUnlockedAt[e.caseId] ??= s.time;
        if (run.vaultShown()) report.allUnlockedAt ??= s.time;
      }
      if (e.type === "stageChanged") report.stageReachedAt[e.stage] ??= s.time;
      if (e.type === "revealed") busyUntil = Math.max(busyUntil, s.time + timings.reveal);
      if (e.type === "botWoke") report.botAwakeAt ??= s.time;
      if (e.type === "vaultBought") report.vaultAt ??= s.time;
    }
    fullFor = s.tray.length >= setup.trayCapacity ? fullFor + DT : 0;
    report.longestTrayFull = Math.max(report.longestTrayFull, fullFor);
    if (s.time < busyUntil || run.locked()) continue;
    const b = s.bench;

    if (s.tray.length > 0) {
      run.claim(0);
      busyUntil = s.time + timings.sell;
    } else if (b.phase === "revealed") {
      run.sell();
      busyUntil = s.time + timings.sell;
    } else if (b.phase === "locked") {
      run.insertKey();
      busyUntil = s.time + timings.key;
    } else if (b.phase === "empty") {
      if (run.buyVault().ok) continue;
      spend(run);
      const target = [...s.unlocked].reverse().find((id) => run.casePrice(id) <= s.cash);
      if (target && run.buyCase(target).ok) busyUntil = s.time + timings.buy;
      else if (run.startDayJob().ok) busyUntil = s.time + timings.buy;
    }
  }
  report.lifetimeEarnings = run.state.lifetimeEarnings;
  report.finalCash = run.state.cash;
  return report;
}

function spend(run: Run): void {
  const s = run.state;
  const next = CASES.find((c) => !s.unlocked.includes(c.id));
  if (next && s.cash >= unlockCostOf(next.id) + run.casePrice(next.id)) {
    run.unlockCase(next.id);
    return;
  }
  if (!s.bot.awake && s.cash >= BOT_WAKE_COST * 2) {
    run.wakeBot();
    return;
  }
  let cheapest: { buy: () => void; cost: number } | null = null;
  for (const id of UPGRADE_IDS) {
    const cost = upgradeCost(id, s.upgrades[id]);
    if (cost !== null && (cheapest === null || cost < cheapest.cost)) cheapest = { buy: () => run.buyUpgrade(id), cost };
  }
  const speed = s.bot.awake ? botSpeedCost(s.bot.speedLevel) : null;
  if (speed !== null && (cheapest === null || speed < cheapest.cost)) cheapest = { buy: () => run.buyBotSpeed(), cost: speed };
  if (cheapest && cheapest.cost <= s.cash * 0.25) cheapest.buy();
}
```

- [ ] **Step 4: Run, then tune until green**

Run: `npx vitest run src/modules/casecremental/sim/pacing`
Expected at first: some timing assertions fail. Tune **only** `sim/tuning.ts` numbers — in this order, re-running after each change: `VAULT_BASE_PRICE` (vault time), `BOT_WAKE_COST` (bot time), `CATCH_UP_PER_VAULT` and `VAULT_GROWTH` (the second run), `CLOUT_DIVISOR` (a first vault should buy 1–2 perk levels). Never change the greedy player's rules or the run logic. Record the final values and each tested range in the commit message.

Expected finally: PASS — all pacing tests, including the three earlier ones (Wildwood, Bedrock, stage 2).

- [ ] **Step 5: Run every check and commit**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all PASS.

```bash
git add src/modules/casecremental/sim
git commit -m "test(pacing): the whole of Run 1 (bot, vault) and a boosted second run; tuned"
```
