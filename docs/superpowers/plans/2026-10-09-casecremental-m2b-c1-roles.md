# Casecremental M2b-C1 — The bot opens, the auto-seller sells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework Run 1's roles per the rework spec: the bot opens its own cases on its own reel (you sell its card by hand), the auto-seller machine is unlocked in Run 1 and sells any waiting card (yours or the bot's) or sets the good ones aside in the claim tray; stage 5 is renamed; the new sounds are wired.

**Architecture:** The bot's walking seller state machine (`sim/botSeller.ts`, `fx/pixel/botPath.ts`) is replaced by `sim/botOpener.ts` (the bot's own spin and its waiting card) and `sim/autoSeller.ts` (the machine's routing rules). `Run` keeps orchestrating (it ticks both) and shares its drop roll between your key and the bot. The canvas reads the new state each frame: a second `Reel` on the bot's station, a `BotCardView` for the bot's card, the machine lit when on. Save version 2.

**Tech Stack:** TypeScript (strict), React 19, PixiJS 8, Vitest. `npx vitest run <path>`, `npm run typecheck`, `npm run build`, dev server http://localhost:5180.

**Spec:** `docs/superpowers/specs/2026-10-09-casecremental-m2b-rework-design.md` §1, §2, §3, §6, §7 (and the Run 1 spec it amends: `docs/superpowers/specs/2026-10-08-casecremental-m2b-run1-design.md`).

## Global Constraints

- The sim stays pure and deterministic; every balance number lives in `sim/tuning.ts`; pacing failures are fixed by tuning numbers only.
- Every player-visible string goes through `t()` / `i18n/content.ts` in EN and RU within its budget (buttons ≤ 8).
- The canvas reads `controller.run.state` each frame; sim events only trigger one-shot juice.
- Hand sales (your bench card, the bot's card, tray claims) feed the combo; auto-seller sales never do.
- Run 1 caps: bot Speed ×1 → ×8 over 5 levels; auto-seller Speed 4 levels; claim tray 12 (+4 per perk level).
- Sounds that have no files yet stay silent (the audio is being generated in parallel; `SOUNDS` must list every id).
- Commit trailers: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_013MA8Fp47Lkjiuq8tVoGPyt`.

## Review Focus

1. **The bot spends your cash** → it never leaves you unable to act: you can always sell what is on the bench and the bot's card; the day job still appears when broke with an empty bench, whatever the bot holds. Pinned in Task 1.
2. **Two cards waiting at once (yours and the bot's) with the auto-seller on and the tray filling up** → each is sold or stored exactly once; a full tray leaves the rest where they are, still sellable by hand. Pinned in Task 2.
3. **Grabbing a card while the auto-seller is about to take it** → it never vanishes from your hand; letting go hands it back to the auto-seller. Pinned in Task 2.
4. **An M2b save (version 1) or a reload mid-spin** → v1 starts fresh with a warning; a v2 reload resumes the bot's spin and its waiting card exactly. Pinned in Task 3.
5. **Russian** → every new string fits its budget. Pinned in Task 5 (the budget tests run over every key).

---

## File Structure (paths relative to `src/modules/casecremental/`)

- Delete `sim/botSeller.ts`, `sim/botSeller.test.ts`, `fx/pixel/botPath.ts`, `fx/pixel/botPath.test.ts`.
- Create `sim/botOpener.ts` (+ test), `sim/autoSeller.ts` (+ test), `fx/pixel/BotCard.ts`.
- Modify `sim/run.ts`, `sim/tuning.ts`, `sim/snapshot.test.ts`, `sim/bot.ts`, `sim/pacing.test.ts`, `sim/intensity.ts`.
- Modify `game/controller.ts` (+ test), `game/view.ts` (+ test), `game/agent.ts`, `game/save.ts` (+ test).
- Modify `ui/UpgradesBoard.tsx`, `ui/botBoard.ts` (+ test), `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`, `i18n/content.ts`.
- Modify `fx/pixel/layout.ts` (+ test), `fx/pixel/BotSprite.ts`, `fx/pixel/anims.ts`, `fx/pixel/Room.ts`, `fx/pixel/Bench.ts`, `fx/hd/HdLayer.ts`, `fx/World.ts`, `fx/audio/sounds.ts`.
- Modify `docs/feature-history/casecremental-run1.md`.

---

### Task 1: The bot opens its own cases (sim)

**Files:** Create `sim/botOpener.ts`, `sim/botOpener.test.ts`; Modify `sim/tuning.ts`, `sim/run.ts`, `sim/snapshot.test.ts`; Delete `sim/botSeller.ts`, `sim/botSeller.test.ts`.

**Interfaces:**
- Produces: `CardSpot = "bench" | "bot"`; `BotSpin { caseId; drop; elapsed; duration }`; `BotState { awake; speedLevel; caseChoice: string | null; spin: BotSpin | null; card: Drop | null; cardAt: number }`; `freshBot(awake)`, `botSpeed(level)`, `botSpeedCost(level)`, `botSpinSeconds(level)`, `botCaseFor(choice, unlocked, cash, price)`; `SaleSource = "bench" | "bot" | "tray" | "seller"`; `sold` events gain `from: CardSpot | null`; events `botSpinStarted { caseId; drop; duration }`, `botRevealed { drop }`; `RunState.held: CardSpot | null`; Run methods `sellBotCard()`, `setBotCase(caseId | null)`, `setHeld(spot: CardSpot | null)`. Removed: `setBotThreshold`, events `botPickedUp`, `botWaiting`, constants `BOT_STEP_SECONDS`, `BOT_REVEAL_HOLD`, `BOT_BIG_REVEAL_HOLD`.

- [ ] **Step 1: Tuning** — in `sim/tuning.ts` replace the three constants `BOT_STEP_SECONDS`, `BOT_REVEAL_HOLD`, `BOT_BIG_REVEAL_HOLD` and their comments with:

```ts
/** The bot opens its own cases (rework spec §1): one spin on its reel takes this long at Speed ×1. */
export const BOT_SPIN_SECONDS = 4;
```

(keep `BOT_WAKE_COST`, `BOT_SPEED_LEVELS`, `BOT_MAX_SPEED`, `BOT_SPEED_COSTS`; update the section comment to "The bot as an opener (rework spec §1)").

- [ ] **Step 2: Write the failing test** — `sim/botOpener.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { botCaseFor, botSpeed, botSpeedCost, botSpinSeconds } from "./botOpener";
import { priceOf } from "./content/cases";
import { DEFAULT_SETUP, Run } from "./run";
import { BOT_SPIN_SECONDS, BOT_WAKE_COST } from "./tuning";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};
const awake = () => new Run(1, { ...DEFAULT_SETUP, botAwake: true });
const untilCard = (run: Run) => {
  for (let i = 0; i < 900 && !run.state.bot.card; i++) run.tick(DT);
  expect(run.state.bot.card).not.toBeNull();
};

describe("bot opener helpers", () => {
  it("speeds up ×1 → ×8 over five levels; a spin shrinks with it", () => {
    expect(botSpeed(0)).toBe(1);
    expect(botSpeed(5)).toBeCloseTo(8);
    expect(botSpinSeconds(5)).toBeCloseTo(BOT_SPIN_SECONDS / 8);
    expect(botSpeedCost(5)).toBeNull();
  });

  it("opens the dearest case you can afford, or its chosen one when you can", () => {
    const price = priceOf;
    expect(botCaseFor(null, ["bootcamp", "wildwood"], 20, price)).toBe("wildwood");
    expect(botCaseFor(null, ["bootcamp", "wildwood"], 5, price)).toBe("bootcamp");
    expect(botCaseFor(null, ["bootcamp"], 1, price)).toBeNull();
    expect(botCaseFor("bootcamp", ["bootcamp", "wildwood"], 20, price)).toBe("bootcamp");
    expect(botCaseFor("wildwood", ["bootcamp", "wildwood"], 5, price)).toBeNull(); // waits for its case
    expect(botCaseFor("bedrock", ["bootcamp"], 1e6, price)).toBe("bootcamp"); // not unlocked: back to the best
  });
});

describe("the bot opens its own cases", () => {
  it("sleeps until woken, and waking costs once", () => {
    const run = new Run(1);
    tickFor(run, 5);
    expect(run.state.bot.spin).toBeNull();
    run.state.cash = 100;
    expect(run.wakeBot().ok).toBe(true);
    expect(run.state.cash).toBe(100 - BOT_WAKE_COST);
    expect(run.wakeBot()).toEqual({ ok: false, reason: "the bot is already awake" });
  });

  it("buys a case with your cash and spins it on its own reel, leaving your bench alone", () => {
    const run = awake();
    run.state.cash = 20;
    run.state.unlocked = ["bootcamp", "wildwood"];
    run.tick(DT);
    expect(run.state.bot.spin?.caseId).toBe("wildwood");
    expect(run.state.cash).toBe(20 - priceOf("wildwood"));
    expect(run.state.bench.phase).toBe("empty");
    expect(run.drainEvents().map((e) => e.type)).toContain("botSpinStarted");
  });

  it("lands its drop at its station and waits for you to sell it, then opens again", () => {
    const run = awake();
    run.state.cash = 1e6;
    untilCard(run);
    expect(run.drainEvents().map((e) => e.type)).toContain("botRevealed");
    tickFor(run, 10);
    expect(run.state.bot.spin).toBeNull(); // waits while its card waits
    const d = run.state.bot.card!;
    const cash = run.state.cash;
    expect(run.sellBotCard().ok).toBe(true);
    expect(run.state.cash - cash).toBeCloseTo(run.payout(d, false) * 1.02); // a hand sale: combo
    const sold = run.drainEvents().find((e) => e.type === "sold");
    expect(sold).toMatchObject({ source: "bot", from: "bot" });
    expect(run.sellBotCard()).toEqual({ ok: false, reason: "the bot has nothing to sell" });
    run.tick(DT);
    expect(run.state.bot.spin).not.toBeNull();
  });

  it("opens its chosen case, and waits while you can't afford it", () => {
    const run = awake();
    run.state.unlocked = ["bootcamp", "wildwood"];
    expect(run.setBotCase("wildwood").ok).toBe(true);
    expect(run.setBotCase("nope")).toEqual({ ok: false, reason: "unknown case: nope" });
    run.state.cash = 5;
    tickFor(run, 1);
    expect(run.state.bot.spin).toBeNull();
    run.state.cash = 20;
    run.tick(DT);
    expect(run.state.bot.spin?.caseId).toBe("wildwood");
    expect(run.setBotCase(null).ok).toBe(true);
  });

  it("gets faster with Speed", () => {
    const run = awake();
    run.state.cash = 1e9;
    for (let i = 0; i < 5; i++) expect(run.buyBotSpeed().ok).toBe(true);
    expect(run.buyBotSpeed()).toEqual({ ok: false, reason: "max level for this run" });
    run.tick(DT);
    expect(run.state.bot.spin?.duration).toBeCloseTo(BOT_SPIN_SECONDS / 8);
  });

  it("never stops you: broke with an empty bench, the day job still comes, whatever the bot holds (Review Focus 1)", () => {
    const run = awake();
    run.state.cash = 2;
    untilCard(run); // spent your last $2
    run.state.cash = 0;
    expect(run.dayJobAvailable()).toBe(true);
    expect(run.sellBotCard().ok).toBe(true);
  });

  it("counts its opens (Lucky Seven) and its reveals heat the room", () => {
    const run = awake();
    run.state.cash = 1e6;
    untilCard(run);
    expect(run.state.opened).toBe(1);
    expect(run.state.heat).toBeGreaterThan(0);
  });
});
```

and in `sim/snapshot.test.ts` replace the first test's set-up (the bot carrying a card) with a bot mid-spin plus a waiting card:

```ts
  it("restores a run mid-way — the bot mid-spin, your card waiting — and continues identically", () => {
    const a = new Run(5, { ...DEFAULT_SETUP, botAwake: true, charms: ["doubleTap"] });
    a.state.cash = 1e6;
    a.buyCase("bootcamp");
    a.insertKey();
    for (let i = 0; i < 900 && !(a.state.bot.card && a.state.bench.phase === "revealed"); i++) a.tick(DT);
    a.sellBotCard();
    a.tick(DT); // the bot starts its next spin
    expect(a.state.bot.spin).not.toBeNull();
    const snap = JSON.parse(JSON.stringify(a.snapshot())) as ReturnType<Run["snapshot"]>;
    const b = Run.fromSnapshot(snap);
    expect(b.state).toEqual(a.state);
    expect(b.setup).toEqual(a.setup);
    for (const r of [a, b]) {
      r.drainEvents();
      tickFor(r, 5);
      r.sell();
      r.sellBotCard();
      r.buyCase("bootcamp");
      r.insertKey();
      tickFor(r, 4);
    }
    expect(b.state).toEqual(a.state);
  });
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim/botOpener src/modules/casecremental/sim/snapshot`
Expected: FAIL — `Cannot find module './botOpener'`; the snapshot test fails on `sellBotCard`.

- [ ] **Step 4: Write `sim/botOpener.ts`**

```ts
import { BOT_MAX_SPEED, BOT_SPEED_COSTS, BOT_SPEED_LEVELS, BOT_SPIN_SECONDS } from "./tuning";
import type { Drop } from "./types";

// The bot as an opener (rework spec §1): once woken it buys a case with your cash and spins it on its own
// reel; its drop waits at its station as a card until it is sold (by you, or by the auto-seller). It does not
// open again while its card waits. Speed makes its spin faster.

/** Where a revealed card waits: your bench or the bot's station. */
export type CardSpot = "bench" | "bot";

export interface BotSpin {
  caseId: string;
  drop: Drop;
  elapsed: number;
  duration: number;
}

export interface BotState {
  awake: boolean;
  speedLevel: number;
  /** The case it opens; null = the dearest one you can afford. */
  caseChoice: string | null;
  spin: BotSpin | null;
  /** Its drop, waiting at its station to be sold. */
  card: Drop | null;
  /** When that card landed. */
  cardAt: number;
}

export const freshBot = (awake: boolean): BotState => ({ awake, speedLevel: 0, caseChoice: null, spin: null, card: null, cardAt: 0 });

/** ×1 at level 0 up to ×BOT_MAX_SPEED at the run's last level, geometric in between. */
export const botSpeed = (level: number): number => BOT_MAX_SPEED ** (Math.min(level, BOT_SPEED_LEVELS) / BOT_SPEED_LEVELS);

/** Price of the next Speed level, or null at this run's cap. */
export function botSpeedCost(level: number): number | null {
  if (level >= BOT_SPEED_LEVELS) return null;
  return Math.ceil(BOT_SPEED_COSTS.baseCost * BOT_SPEED_COSTS.growth ** level);
}

export const botSpinSeconds = (level: number): number => BOT_SPIN_SECONDS / botSpeed(level);

/** The case the bot opens next: its choice (when unlocked) if you can afford it, else the dearest one you can. */
export function botCaseFor(choice: string | null, unlocked: readonly string[], cash: number, price: (id: string) => number): string | null {
  if (choice && unlocked.includes(choice)) return cash >= price(choice) ? choice : null;
  let best: string | null = null;
  for (const id of unlocked) if (price(id) <= cash && (best === null || price(id) > price(best))) best = id;
  return best;
}
```

- [ ] **Step 5: Rework `sim/run.ts`**

1. Imports: replace the `./botSeller` import with
   `import { botCaseFor, botSpeedCost, botSpinSeconds, freshBot, type BotState, type CardSpot } from "./botOpener";`
   and re-export the spot type for consumers: `export type { CardSpot } from "./botOpener";`.
2. `export type SaleSource = "bench" | "bot" | "tray" | "seller";`
3. `SimEvent`: the `sold` member becomes
   `| { type: "sold"; drop: Drop; amount: number; combo: number; source: SaleSource; from: CardSpot | null }`;
   remove `botPickedUp` and `botWaiting`; add
   `| { type: "botSpinStarted"; caseId: string; drop: Drop; duration: number }` and `| { type: "botRevealed"; drop: Drop }`.
4. `RunState`: replace the `held` field with
   ```ts
     /** The card the player is dragging, if any: machines leave it alone. */
     held: CardSpot | null;
   ```
   and the tray comment with `/** Drops the auto-seller set aside for the player to claim (above its threshold). */`; constructor `held: null,`.
5. Add the shared roll (used by your key and the bot) and make `insertKey` use it:
   ```ts
     /** Roll one case's drop with Luck, Pity, the Golden Hour and the charms; counts the open. */
     private rollFor(caseId: string): Drop {
       const s = this.state;
       const c = caseById(caseId);
       s.opened++;
       const luck = this.effects().luckLevel + this.setup.luckBonus + s.pity * PITY_LUCK_LEVELS;
       const drop = rollDrop(c, priceOf(c.id), luck, this.rng, s.nextDropId++, this.forcedRarity, {
         luckMult: s.time < s.goldenHourUntil ? GOLDEN_HOUR_LUCK : 1,
         statTrakChance: charmStatTrakChance(this.setup.charms),
         minRarity: charmMinRarity(this.setup.charms, s.opened),
       });
       this.forcedRarity = null;
       return drop;
     }
   ```
   `insertKey` body after the phase check:
   ```ts
       const c = caseById(b.caseId);
       const fx = this.effects();
       const drop = this.rollFor(c.id);
       const topTier = Math.max(...s.unlocked.map((id) => caseById(id).tier));
       const tease = rollTease(drop.rarity, c.tier, topTier, fx.spinSeconds, this.rng, this.forcedFake);
       this.forcedFake = false;
       const fullDuration = fx.spinSeconds + (tease?.extraSeconds ?? 0);
       s.lastSellAt += fullDuration; // the spin (tease crawl included) never counts against the combo
       s.bench = { phase: "spinning", caseId: c.id, drop, elapsed: 0, fullDuration, tease };
       s.lastTier = c.tier;
       this.events.push({ type: "spinStarted", caseId: c.id, drop, fullDuration, tease });
       return OK;
   ```
   (the `s.opened++` line at the end is gone — `rollFor` counts it).
6. `sell()`: `s.held = null;` (was `false`) and the event `source: "bench", from: "bench"`; `claim()`: event `source: "tray", from: null`.
7. Replace `setHeld` and `setBotThreshold` with:
   ```ts
     /** The player picks a waiting card up (bench or bot) or lets go (null): machines leave a held card alone. */
     setHeld(spot: CardSpot | null): ActionResult {
       const s = this.state;
       const waiting = spot === "bench" ? s.bench.phase === "revealed" : spot === "bot" ? s.bot.card !== null : true;
       s.held = waiting ? spot : null;
       return OK;
     }

     /** The case the bot opens (null = the dearest you can afford). */
     setBotCase(caseId: string | null): ActionResult {
       if (caseId !== null && !CASES.some((c) => c.id === caseId)) return fail(`unknown case: ${caseId}`);
       this.state.bot.caseChoice = caseId;
       return OK;
     }

     /** Sell the bot's card by hand (feeds the combo). */
     sellBotCard(): ActionResult {
       if (this.locked()) return fail("the vault is open");
       const s = this.state;
       const d = s.bot.card;
       if (!d) return fail("the bot has nothing to sell");
       this.bumpCombo();
       const amount = this.payout(d, true);
       s.cash += amount;
       s.lifetimeEarnings += amount;
       s.bot.card = null;
       if (s.held === "bot") s.held = null;
       this.events.push({ type: "sold", drop: d, amount, combo: s.combo, source: "bot", from: "bot" });
       return OK;
     }
   ```
8. Replace the whole `tickBot` with:
   ```ts
     /** The bot's own reel (rework spec §1): finish a spin into its card, or start the next one. */
     private tickBot(dt: number): void {
       const s = this.state;
       const bot = s.bot;
       if (!bot.awake) return;
       if (bot.spin) {
         bot.spin.elapsed += dt;
         if (bot.spin.elapsed < bot.spin.duration) return;
         const d = bot.spin.drop;
         bot.spin = null;
         bot.card = d;
         bot.cardAt = s.time;
         this.onReveal(d, "bot");
         this.revealsThisTick++;
         this.events.push({ type: "botRevealed", drop: d });
         return;
       }
       if (bot.card || this.locked()) return;
       const caseId = botCaseFor(bot.caseChoice, s.unlocked, s.cash, (id) => this.casePrice(id));
       if (!caseId) return;
       s.cash -= this.casePrice(caseId);
       const drop = this.rollFor(caseId);
       const duration = botSpinSeconds(bot.speedLevel);
       bot.spin = { caseId, drop, elapsed: 0, duration };
       this.events.push({ type: "botSpinStarted", caseId, drop, duration });
     }
   ```
9. `onReveal(d: Drop, spot: CardSpot)`: replace its first two lines with
   ```ts
       if (spot === "bench") s.revealedAt = s.time;
       if (s.held === spot) s.held = null;
   ```
   and the bench reveal in `tick` calls `this.onReveal(b.drop, "bench");`.
10. `buyBotSpeed` stays. Delete `sim/botSeller.ts` and `sim/botSeller.test.ts`.

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental/sim`
Expected: PASS for `botOpener`, `snapshot` and the rest of the sim **except** `pacing` (its greedy player still calls the removed bot API — fixed in Task 4; if `pacing` fails only on the bot-awake/vault timings or imports, that is expected here). Typecheck is not clean yet (game/, fx/, ui/ still use the old API — Tasks 3–7).

- [ ] **Step 7: Commit**

```bash
git add -A src/modules/casecremental/sim
git commit -m "feat(sim): the bot opens its own cases on its own reel; you sell its card by hand"
```

### Task 2: The auto-seller (sim)

**Files:** Create `sim/autoSeller.ts`, `sim/autoSeller.test.ts`; Modify `sim/tuning.ts`, `sim/run.ts`.

**Interfaces:**
- Consumes: `CardSpot`, `RunState.held`, `payout`, `tray` (Task 1).
- Produces: `SellerState { on; speedLevel; threshold: RarityId }`, `freshSeller()`, `sellerHold(rarity, level)`, `sellerSpeedCost(level)`, `sellsAt(threshold, rarity)`; `RunState.seller`; Run methods `buySeller()`, `buySellerSpeed()`, `setSellerThreshold(r)`; events `sellerBought`, `sellerUpgraded { level }`, `stored { drop; from: CardSpot }`; auto sales are `sold` with `source: "seller"`.

- [ ] **Step 1: Tuning** — append to `sim/tuning.ts`:

```ts
/** The auto-seller machine (rework spec §1): unlocked in Run 1, then it takes any waiting card. */
export const SELLER_COST = 150;
/** Seconds a card waits before the machine takes it, per Speed level (Run 1: 4 levels). */
export const SELLER_HOLD_SECONDS = [2.5, 1.8, 1.2, 0.8, 0.5] as const;
/** A Covert or ★ waits this long, so its reveal (the knife's showcase) plays first. */
export const SELLER_BIG_HOLD = 2.6;
export const SELLER_SPEED_COSTS = { baseCost: 120, growth: 2.4 } as const;
```

- [ ] **Step 2: Write the failing test** — `sim/autoSeller.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sellerHold, sellerSpeedCost, sellsAt } from "./autoSeller";
import { DEFAULT_SETUP, Run, type RunSetup } from "./run";
import { SELLER_BIG_HOLD, SELLER_COST, SELLER_HOLD_SECONDS } from "./tuning";
import type { RarityId } from "./types";

const DT = 1 / 30;
const tickFor = (run: Run, s: number) => {
  for (let t = 0; t < s; t += DT) run.tick(DT);
};
const withSeller = (over: Partial<RunSetup> = {}) => {
  const run = new Run(1, { ...DEFAULT_SETUP, ...over });
  run.state.cash = 1e6;
  expect(run.buySeller().ok).toBe(true);
  run.drainEvents();
  return run;
};
function revealOnBench(run: Run, rarity: RarityId) {
  run.forceNextRarity(rarity);
  run.buyCase("bootcamp");
  run.insertKey();
  for (let i = 0; i < 900 && run.state.bench.phase !== "revealed"; i++) run.tick(DT);
  run.drainEvents();
}

describe("auto-seller helpers", () => {
  it("routes by threshold, waits longer for a Covert or ★, and gets faster with Speed", () => {
    expect(sellsAt("classified", "restricted")).toBe(true);
    expect(sellsAt("classified", "covert")).toBe(false);
    expect(sellerHold("milspec", 0)).toBe(SELLER_HOLD_SECONDS[0]);
    expect(sellerHold("milspec", 4)).toBe(SELLER_HOLD_SECONDS[4]);
    expect(sellerHold("gold", 4)).toBe(SELLER_BIG_HOLD);
    expect(sellerSpeedCost(4)).toBeNull();
  });
});

describe("the auto-seller", () => {
  it("is bought once, then sells a card left waiting on your bench, without combo", () => {
    const run = new Run(1);
    run.state.cash = SELLER_COST;
    expect(run.buySeller().ok).toBe(true);
    expect(run.state.cash).toBe(0);
    expect(run.buySeller()).toEqual({ ok: false, reason: "the auto-seller is already on" });
    run.state.cash = 1e6;
    revealOnBench(run, "milspec");
    const b = run.state.bench;
    const d = b.phase === "revealed" ? b.drop : null;
    const cash = run.state.cash;
    tickFor(run, SELLER_HOLD_SECONDS[0] + 0.1);
    expect(run.state.bench.phase).toBe("empty");
    expect(run.state.cash - cash).toBeCloseTo(run.payout(d!, false));
    expect(run.drainEvents().find((e) => e.type === "sold")).toMatchObject({ source: "seller", from: "bench" });
    expect(run.state.combo).toBe(0);
  });

  it("sells the bot's card too", () => {
    const run = withSeller({ botAwake: true });
    for (let i = 0; i < 900 && !run.state.bot.card; i++) run.tick(DT);
    run.drainEvents();
    tickFor(run, SELLER_HOLD_SECONDS[0] + 0.1);
    expect(run.state.bot.card).toBeNull();
    expect(run.drainEvents().find((e) => e.type === "sold")).toMatchObject({ source: "seller", from: "bot" });
  });

  it("sets a card above its threshold aside in the tray; a full tray leaves it, still sellable by hand (Review Focus 2)", () => {
    const run = withSeller({ trayCapacity: 1 });
    revealOnBench(run, "covert");
    tickFor(run, SELLER_BIG_HOLD + 0.1);
    expect(run.state.tray).toHaveLength(1);
    expect(run.drainEvents().find((e) => e.type === "stored")).toMatchObject({ from: "bench" });
    revealOnBench(run, "covert");
    tickFor(run, SELLER_BIG_HOLD + 2);
    expect(run.state.bench.phase).toBe("revealed"); // the tray is full
    expect(run.sell().ok).toBe(true);
  });

  it("takes each of two waiting cards exactly once", () => {
    const run = withSeller({ botAwake: true });
    revealOnBench(run, "milspec");
    for (let i = 0; i < 900 && !run.state.bot.card; i++) run.tick(DT);
    const events: string[] = [];
    for (let i = 0; i < 300; i++) {
      run.tick(DT);
      for (const e of run.drainEvents()) if (e.type === "sold" && e.source === "seller") events.push(e.from ?? "");
    }
    expect(events.filter((f) => f === "bench")).toHaveLength(1);
    expect(events.filter((f) => f === "bot").length).toBeGreaterThanOrEqual(1); // the bot keeps opening
  });

  it("leaves a card you are holding, and takes it after you let go (Review Focus 3)", () => {
    const run = withSeller();
    revealOnBench(run, "milspec");
    expect(run.setHeld("bench").ok).toBe(true);
    tickFor(run, SELLER_HOLD_SECONDS[0] + 1);
    expect(run.state.bench.phase).toBe("revealed");
    run.setHeld(null);
    run.tick(DT);
    expect(run.state.bench.phase).toBe("empty");
  });

  it("waits longer for a Covert so its reveal plays", () => {
    const run = withSeller();
    revealOnBench(run, "covert");
    tickFor(run, SELLER_HOLD_SECONDS[0] + 0.1);
    expect(run.state.bench.phase).toBe("revealed");
  });

  it("gets faster with Speed and obeys a new threshold", () => {
    const run = withSeller();
    for (let i = 0; i < 4; i++) expect(run.buySellerSpeed().ok).toBe(true);
    expect(run.buySellerSpeed()).toEqual({ ok: false, reason: "max level for this run" });
    expect(run.setSellerThreshold("covert").ok).toBe(true);
    revealOnBench(run, "covert");
    tickFor(run, SELLER_BIG_HOLD + 0.1);
    expect(run.state.tray).toHaveLength(0); // sold, not stored
  });

  it("a claim takes the card at its slot even after another is stored", () => {
    const run = withSeller();
    revealOnBench(run, "covert");
    tickFor(run, SELLER_BIG_HOLD + 0.1);
    const first = run.state.tray[0]!;
    revealOnBench(run, "gold");
    tickFor(run, SELLER_BIG_HOLD + 0.1);
    expect(run.state.tray).toHaveLength(2);
    const cash = run.state.cash;
    run.claim(0);
    expect(run.state.cash - cash).toBeCloseTo(run.payout(first, false) * 1.02);
    expect(run.state.tray[0]!.rarity).toBe("gold");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/modules/casecremental/sim/autoSeller`
Expected: FAIL — `Cannot find module './autoSeller'`.

- [ ] **Step 4: Write `sim/autoSeller.ts`**

```ts
import { RARITY_ORDER } from "./rarity";
import { SELLER_BIG_HOLD, SELLER_HOLD_SECONDS, SELLER_SPEED_COSTS } from "./tuning";
import type { RarityId } from "./types";

// The auto-seller machine (rework spec §1): once bought, any card left waiting — yours on the bench or the
// bot's at its station — is taken after a short hold: sold if it is at or below the threshold (no combo),
// else put in the claim tray. A held card is left alone; a full tray leaves the card where it is.

export interface SellerState {
  on: boolean;
  speedLevel: number;
  /** The rarest it sells; anything rarer goes to the claim tray. */
  threshold: RarityId;
}

export const freshSeller = (): SellerState => ({ on: false, speedLevel: 0, threshold: "classified" });

/** The Speed levels this run allows (Run 1: 4). */
export const SELLER_SPEED_LEVELS = SELLER_HOLD_SECONDS.length - 1;

export const sellsAt = (threshold: RarityId, rarity: RarityId): boolean => RARITY_ORDER.indexOf(rarity) <= RARITY_ORDER.indexOf(threshold);

/** How long a card waits before the machine takes it. */
export const sellerHold = (rarity: RarityId, level: number): number =>
  rarity === "covert" || rarity === "gold" ? SELLER_BIG_HOLD : SELLER_HOLD_SECONDS[Math.min(level, SELLER_SPEED_LEVELS)]!;

export function sellerSpeedCost(level: number): number | null {
  if (level >= SELLER_SPEED_LEVELS) return null;
  return Math.ceil(SELLER_SPEED_COSTS.baseCost * SELLER_SPEED_COSTS.growth ** level);
}
```

- [ ] **Step 5: Wire it into `sim/run.ts`**
- imports: `import { freshSeller, sellerHold, sellerSpeedCost, sellsAt, type SellerState } from "./autoSeller";` and `SELLER_COST` from tuning;
- `SimEvent`: the `stored` member becomes `| { type: "stored"; drop: Drop; from: CardSpot }`; add `| { type: "sellerBought" }` and `| { type: "sellerUpgraded"; level: number }`;
- `RunState`: `seller: SellerState;` (constructor `seller: freshSeller(),`);
- methods:

```ts
  buySeller(): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    if (s.seller.on) return fail("the auto-seller is already on");
    if (s.cash < SELLER_COST) return fail("not enough cash");
    s.cash -= SELLER_COST;
    s.seller.on = true;
    this.events.push({ type: "sellerBought" });
    return OK;
  }

  buySellerSpeed(): ActionResult {
    if (this.locked()) return fail("the vault is open");
    const s = this.state;
    if (!s.seller.on) return fail("buy the auto-seller first");
    const cost = sellerSpeedCost(s.seller.speedLevel);
    if (cost === null) return fail("max level for this run");
    if (s.cash < cost) return fail("not enough cash");
    s.cash -= cost;
    s.seller.speedLevel += 1;
    this.events.push({ type: "sellerUpgraded", level: s.seller.speedLevel });
    return OK;
  }

  setSellerThreshold(rarity: RarityId): ActionResult {
    this.state.seller.threshold = rarity;
    return OK;
  }

  /** The auto-seller takes cards left waiting (rework spec §1). */
  private tickSeller(): void {
    const s = this.state;
    const seller = s.seller;
    if (!seller.on || this.locked()) return;
    const b = s.bench;
    if (b.phase === "revealed" && s.held !== "bench" && s.time - s.revealedAt >= sellerHold(b.drop.rarity, seller.speedLevel))
      if (this.autoTake(b.drop, "bench")) s.bench = { phase: "empty" };
    const d = s.bot.card;
    if (d && s.held !== "bot" && s.time - s.bot.cardAt >= sellerHold(d.rarity, seller.speedLevel))
      if (this.autoTake(d, "bot")) s.bot.card = null;
  }

  /** Sell it (at or below the threshold) or set it aside in the tray; false when the tray is full. */
  private autoTake(d: Drop, from: CardSpot): boolean {
    const s = this.state;
    if (sellsAt(s.seller.threshold, d.rarity)) {
      const amount = this.payout(d, false);
      s.cash += amount;
      s.lifetimeEarnings += amount;
      this.events.push({ type: "sold", drop: d, amount, combo: s.combo, source: "seller", from });
      return true;
    }
    if (s.tray.length >= this.setup.trayCapacity) return false;
    s.tray.push(d);
    this.events.push({ type: "stored", drop: d, from });
    return true;
  }
```

- `tick`: call `this.tickSeller();` right after `this.tickBot(dt);`.

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental/sim`
Expected: PASS except `pacing` (Task 4).

- [ ] **Step 7: Commit**

```bash
git add -A src/modules/casecremental/sim
git commit -m "feat(sim): the auto-seller sells waiting cards (yours and the bot's) or sets good ones aside"
```

### Task 3: Controller, view, agent and the v2 save

**Files:** Modify `game/controller.ts`, `game/controller.test.ts`, `game/view.ts`, `game/view.test.ts`, `game/agent.ts`, `game/save.ts`, `game/save.test.ts`, `fx/pixel/Bench.ts` (one action shape).

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `Action` adds `sellBot`, `setBotCase { caseId: string | null }`, `buySeller`, `buySellerSpeed`, `setSellerThreshold { rarity }`; `holdCard` becomes `{ type: "holdCard"; spot: CardSpot | null }`; removes `setBotThreshold`. `BotView { awake; wakeCost; canWake; speed; speedLevel; speedCost; canBuySpeed; caseChoice: string | null; spinning: boolean; card: TrayItemView | null }`; `SellerView { on; cost; canBuy; speedLevel; maxLevel; speedCost; canBuySpeed; threshold }`; `GameView.seller`. `SAVE_VERSION = 2`.

- [ ] **Step 1: Write the failing tests**

`game/controller.test.ts` — replace the body of `"routes the new actions"` with:

```ts
    const c = new GameController(1);
    c.run.state.cash = 1e6;
    expect(c.act({ type: "wakeBot" }).ok).toBe(true);
    expect(c.act({ type: "buyBotSpeed" }).ok).toBe(true);
    expect(c.act({ type: "setBotCase", caseId: "bootcamp" }).ok).toBe(true);
    expect(c.act({ type: "sellBot" }).ok).toBe(false); // nothing landed yet
    expect(c.act({ type: "buySeller" }).ok).toBe(true);
    expect(c.act({ type: "buySellerSpeed" }).ok).toBe(true);
    expect(c.act({ type: "setSellerThreshold", rarity: "covert" }).ok).toBe(true);
    expect(c.act({ type: "holdCard", spot: null }).ok).toBe(true);
    expect(c.act({ type: "claim", index: 0 }).ok).toBe(false);
    expect(c.act({ type: "startDayJob" }).ok).toBe(false);
```

`game/view.test.ts` — replace `"shows the bot asleep and wakeable"` with:

```ts
  it("shows the bot asleep and wakeable, then spinning and its card", () => {
    const run = new Run(1);
    run.state.cash = BOT_WAKE_COST;
    let v = buildView(run);
    expect(v.bot).toMatchObject({ awake: false, canWake: true, wakeCost: BOT_WAKE_COST, speed: 1, spinning: false, card: null, caseChoice: null });
    run.state.cash = 1e6;
    run.wakeBot();
    run.tick(1 / 30);
    expect(buildView(run).bot.spinning).toBe(true);
    for (let i = 0; i < 900 && !run.state.bot.card; i++) run.tick(1 / 30);
    v = buildView(run);
    expect(v.bot.card).toMatchObject({ skinId: run.state.bot.card!.skinId });
  });

  it("shows the auto-seller to buy, then its speed and threshold", () => {
    const run = new Run(1);
    run.state.cash = SELLER_COST;
    let v = buildView(run);
    expect(v.seller).toMatchObject({ on: false, cost: SELLER_COST, canBuy: true });
    run.buySeller();
    run.state.cash = 1e6;
    v = buildView(run);
    expect(v.seller).toMatchObject({ on: true, canBuy: false, speedLevel: 0, canBuySpeed: true, threshold: "classified" });
  });
```

(add `SELLER_COST` to the `../sim/tuning` import).

`game/save.test.ts` — add inside the save describe:

```ts
  it("drops a version-1 save (the M2b bot) with a warning (Review Focus 4)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(decodeSave(JSON.stringify({ ...data(), v: 1 }))).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
```

and in the existing `"fills in what an older or partial save leaves out…"` test change `d.run.state.held = true;` to `d.run.state.held = "bench";` and the expectation to `expect(loaded.run.state.held).toBeNull();`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/game`
Expected: FAIL — unknown actions, `v.seller` undefined, the v1 save still accepted.

- [ ] **Step 3: Implement**

`game/controller.ts`:
- imports: `import type { CardSpot } from "../sim/run";` (with the other run imports);
- `Action`: remove `setBotThreshold`; change `holdCard` to `| { type: "holdCard"; spot: CardSpot | null }`; add
  `| { type: "sellBot" } | { type: "setBotCase"; caseId: string | null } | { type: "buySeller" } | { type: "buySellerSpeed" } | { type: "setSellerThreshold"; rarity: RarityId }`;
- `dispatch`: remove the `setBotThreshold` case; `case "holdCard": return run.setHeld(a.spot);` and add
  ```ts
        case "sellBot":
          return run.sellBotCard();
        case "setBotCase":
          return run.setBotCase(a.caseId);
        case "buySeller":
          return run.buySeller();
        case "buySellerSpeed":
          return run.buySellerSpeed();
        case "setSellerThreshold":
          return run.setSellerThreshold(a.rarity);
  ```

`fx/pixel/Bench.ts` — the three `holdCard` actions become `{ type: "holdCard", spot: "bench" }` (on grab) and `{ type: "holdCard", spot: null }` (on release and in `cancelDrag`).

`game/save.ts` — `export const SAVE_VERSION = 2;`; in `isSave` add `isObj(s.seller)` to the state check; in `normalize` the state spread ends with `held: null` (was `false`); update the header comment: `Version 2 (rework): the bot opens, the auto-seller sells; a version-1 save starts fresh.`

`game/view.ts`:
- imports: `botSpeed, botSpeedCost` from `../sim/botOpener` (replacing the `botSeller` import and the `BotStep` type); `SELLER_SPEED_LEVELS, sellerSpeedCost` from `../sim/autoSeller`; `SELLER_COST` from `../sim/tuning`;
- replace `BotView` with:
  ```ts
  export interface BotView {
    awake: boolean;
    wakeCost: number;
    canWake: boolean;
    speed: number;
    speedLevel: number;
    speedCost: number | null;
    canBuySpeed: boolean;
    /** The case it opens; null = the dearest you can afford. */
    caseChoice: string | null;
    spinning: boolean;
    /** Its card waiting at its station. */
    card: TrayItemView | null;
  }

  export interface SellerView {
    on: boolean;
    cost: number;
    canBuy: boolean;
    speedLevel: number;
    maxLevel: number;
    speedCost: number | null;
    canBuySpeed: boolean;
    threshold: RarityId;
  }
  ```
- `GameView`: add `seller: SellerView;`;
- in `buildView` the bot block becomes:
  ```ts
    const b = s.bot;
    const speedCost = botSpeedCost(b.speedLevel);
    const item = (d: Drop) => ({ skinId: d.skinId, rarity: d.rarity, value: run.payout(d, false) });
    const bot: BotView = {
      awake: b.awake,
      wakeCost: BOT_WAKE_COST,
      canWake: open && !b.awake && s.cash >= BOT_WAKE_COST,
      speed: botSpeed(b.speedLevel),
      speedLevel: b.speedLevel,
      speedCost,
      canBuySpeed: open && b.awake && speedCost !== null && s.cash >= speedCost,
      caseChoice: b.caseChoice,
      spinning: b.spin !== null,
      card: b.card ? item(b.card) : null,
    };
    const sc = sellerSpeedCost(s.seller.speedLevel);
    const seller: SellerView = {
      on: s.seller.on,
      cost: SELLER_COST,
      canBuy: open && !s.seller.on && s.cash >= SELLER_COST,
      speedLevel: s.seller.speedLevel,
      maxLevel: SELLER_SPEED_LEVELS,
      speedCost: sc,
      canBuySpeed: open && s.seller.on && sc !== null && s.cash >= sc,
      threshold: s.seller.threshold,
    };
  ```
  (`open` is the existing `const open = !run.locked();`; the tray items use `item` too: `items: s.tray.map(item)`; import `type Drop` from `../sim/types`), and the returned object gains `seller,`.

`game/agent.ts`:
- `state()`: `bot: { awake: s.bot.awake, speedLevel: s.bot.speedLevel, caseChoice: s.bot.caseChoice, spinning: s.bot.spin !== null, card: s.bot.card?.rarity ?? null }, seller: { ...s.seller },`;
- actions: remove `setBotThreshold`; add
  ```ts
        sellBot: () => run({ type: "sellBot" }),
        setBotCase: (args: Args) => run({ type: "setBotCase", caseId: args?.caseId == null ? null : String(args.caseId) }),
        buySeller: () => run({ type: "buySeller" }),
        buySellerSpeed: () => run({ type: "buySellerSpeed" }),
        setSellerThreshold: async (args: Args) => {
          const r = String(args?.rarity ?? "");
          if (!RARITY_ORDER.includes(r as RarityId)) throw new Error(`unknown rarity "${r}"; valid: ${RARITY_ORDER.join(", ")}`);
          return c.act({ type: "setSellerThreshold", rarity: r as RarityId });
        },
  ```
- `describeActions`: remove `setBotThreshold`; change `wakeBot` to `"Wake the bot: it then opens its own cases with your cash."`; add
  ```ts
        sellBot: "Sell the bot's waiting card by hand.",
        setBotCase: "The case the bot opens: { caseId } or { caseId: null } for the dearest you can afford.",
        buySeller: "Buy the auto-seller (sells waiting cards, sets good ones aside in the tray).",
        buySellerSpeed: "Buy one auto-seller Speed level.",
        setSellerThreshold: "The rarest drop the auto-seller sells: { rarity: milspec|restricted|classified|covert|gold }.",
  ```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental/game src/modules/casecremental/sim`
Expected: PASS except `pacing`. Typecheck: `npm run typecheck` still reports errors in `fx/` and `ui/` only (fixed in Tasks 5–7) — check that none are in `game/` or `sim/` (except `sim/bot.ts`, Task 4).

- [ ] **Step 5: Commit**

```bash
git add -A src/modules/casecremental/game src/modules/casecremental/fx/pixel/Bench.ts
git commit -m "feat(game): actions, view and agent for the bot opener and the auto-seller; save v2"
```

### Task 4: Pacing with the new roles

**Files:** Modify `sim/bot.ts`, `sim/pacing.test.ts`, `sim/tuning.ts` (numbers only).

**Interfaces:**
- Produces: `PacingReport.sellerAt?: number` (when the auto-seller was bought).

- [ ] **Step 1: Write the failing test** — in `sim/pacing.test.ts`'s Run 1 describe add:

```ts
  it("buys the auto-seller at about 3–5 minutes", () => {
    const t = med((r) => r.sellerAt);
    expect(t).toBeGreaterThan(150);
    expect(t).toBeLessThan(330);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/casecremental/sim/pacing`
Expected: FAIL (import/compile errors in `sim/bot.ts`, then `sellerAt` undefined).

- [ ] **Step 3: Update the greedy player** — `sim/bot.ts`:
- imports: `botSpeedCost` from `./botOpener`, `sellerSpeedCost` from `./autoSeller`, `BOT_WAKE_COST, SELLER_COST` from `./tuning`;
- header comment: replace "sells what lands on the bench (unless the bot got there first)" with "sells what lands on the bench and the bot's card", and "wakes the bot when it has twice the price" with "wakes the bot, then buys the auto-seller, each when it has twice the price";
- `PacingReport`: add `sellerAt?: number;` (doc: `/** When the auto-seller was bought. */`);
- in the event loop: `if (e.type === "sellerBought") report.sellerAt ??= s.time;`;
- in the action chain, insert after the tray claim branch and before the bench `revealed` branch:

```ts
    } else if (s.bot.card) {
      run.sellBotCard();
      busyUntil = s.time + timings.sell;
```

- in `spend`, after the wake-bot block:

```ts
  if (s.bot.awake && !s.seller.on && s.cash >= SELLER_COST * 2) {
    run.buySeller();
    return;
  }
```

  and add the seller's Speed to the cheapest-upgrade pool next to the bot's:

```ts
  const sellerSpeed = s.seller.on ? sellerSpeedCost(s.seller.speedLevel) : null;
  if (sellerSpeed !== null && (cheapest === null || sellerSpeed < cheapest.cost)) cheapest = { buy: () => run.buySellerSpeed(), cost: sellerSpeed };
```

- [ ] **Step 4: Run, then tune until green**

Run: `npx vitest run src/modules/casecremental/sim/pacing`
Tune **only** `sim/tuning.ts`, re-running after each change, in this order: `BOT_SPIN_SECONDS` and `BOT_WAKE_COST` (bot awake < 150 s, Wildwood/Bedrock windows), `SELLER_COST` (150–330 s), `VAULT_BASE_PRICE` (first vault 360–600 s, aim ~480), `CATCH_UP_PER_VAULT` / `VAULT_GROWTH` (second run: all unlocked 60–120 s, vault 300–420 s), `CLOUT_DIVISOR` (a first vault ≈ 12–16 CLOUT). Never change the greedy rules. Expected finally: PASS — every pacing test.

- [ ] **Step 5: Commit** (the message lists each tuned value and its measured median)

```bash
git add src/modules/casecremental/sim
git commit -m "test(pacing): Run 1 with the bot opener and the auto-seller; tuned"
```

### Task 5: The Bot and Machines tabs, the stage rename

**Files:** Modify `ui/UpgradesBoard.tsx`, `ui/botBoard.ts`, `ui/botBoard.test.ts`, `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`, `i18n/content.ts`, `i18n/content.test.ts`, `sim/intensity.ts`.

**Interfaces:**
- Consumes: `GameView.bot`, `GameView.seller`, actions (Task 3).
- Produces: `nextBotCase(choice, unlocked)`; strings `bot.opens`, `bot.best`, `seller.name`, `seller.desc`, `seller.sells`, `seller.speed`; `bot.awake` text changes; `bot.sells`, `bot.waiting` removed.

- [ ] **Step 1: Write the failing tests** — `ui/botBoard.test.ts` add:

```ts
  it("cycles the bot's case: the best affordable, then each unlocked case, then back", () => {
    const unlocked = ["bootcamp", "wildwood"];
    expect(nextBotCase(null, unlocked)).toBe("bootcamp");
    expect(nextBotCase("bootcamp", unlocked)).toBe("wildwood");
    expect(nextBotCase("wildwood", unlocked)).toBeNull();
    expect(nextBotCase("bedrock", unlocked)).toBeNull();
  });
```

(import `nextBotCase`), and in `i18n/content.test.ts` change the stage-name expectations: `expect(stageName(5)).toBe("Unhinged");` and after `setLang("ru")` `expect(stageName(5)).toBe("Без тормозов");` (add both lines to the "follows the current language" test).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/ui src/modules/casecremental/i18n`
Expected: FAIL — `nextBotCase` missing; the stage-5 name is still the old one.

- [ ] **Step 3: Implement**

`ui/botBoard.ts` — add (and update the header comment to "the bot's case and the auto-seller's threshold cycle through their options"):

```ts
/** The bot's case choice cycles: the best affordable (null), then each unlocked case, then back. */
export function nextBotCase(choice: string | null, unlocked: readonly string[]): string | null {
  if (choice === null) return unlocked[0] ?? null;
  const i = unlocked.indexOf(choice);
  return i < 0 || i === unlocked.length - 1 ? null : unlocked[i + 1]!;
}
```

`sim/intensity.ts` — `STAGE_NAMES` last entry `"Unhinged"` and the header comment `from "Sober" to "Unhinged"`; `i18n/content.ts` — the last `STAGES` entry `{ en: "Unhinged", ru: "Без тормозов" }`.

`i18n/budgets.ts` — add `["seller.", 20],` next to `["bot.", 20],`.

`i18n/en.ts` — remove `"bot.sells"` and `"bot.waiting"`; set `"bot.awake": "Opens cases for you",`; add:

```ts
  "bot.opens": "Opens:",
  "bot.best": "Best affordable",
  "seller.name": "Auto-seller",
  "seller.desc": "Sells waiting drops",
  "seller.sells": "Sells up to:",
  "seller.speed": "Speed LV {n}",
```

`i18n/ru.ts` — the same keys:

```ts
  "bot.awake": "Открывает за тебя",
  "bot.opens": "Открывает:",
  "bot.best": "Лучший по карману",
  "seller.name": "Автопродавец",
  "seller.desc": "Продаёт дропы",
  "seller.sells": "Продаёт до:",
  "seller.speed": "Скорость УР {n}",
```

`ui/UpgradesBoard.tsx`:
- imports: `caseName` (with `rarityName, upgradeDesc, upgradeName`) from `../i18n/content`; `nextBotCase` with the other `./botBoard` helpers;
- header comment: `Tabs You / Bot / Machines: the bot opens its own cases (rework spec §1); the Machines tab holds the auto-seller.`;
- `BotPanel` (awake branch) — the Speed row stays; replace the "Sells up to" row and the waiting line with:

```tsx
      <div className="cc-row">
        <div>{t("bot.opens")}</div>
        <div className="cc-dim">{b.caseChoice === null ? t("bot.best") : caseName(b.caseChoice)}</div>
        <PxButton disabled={!open} onClick={() => act({ type: "setBotCase", caseId: nextBotCase(b.caseChoice, unlocked) })}>
          {t("btn.change")}
        </PxButton>
      </div>
```

  where `const open = view.finale === null && !view.over;` and `const unlocked = view.cases.filter((c) => c.unlocked).map((c) => c.id);` are declared at the top of `BotPanel`;
- a new panel:

```tsx
function SellerPanel({ view, act }: { view: GameView; act: Act }): ReactNode {
  const s = view.seller;
  const lang = getLang();
  const open = view.finale === null && !view.over;
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
        <PxButton disabled={!open} onClick={() => act({ type: "setSellerThreshold", rarity: nextThreshold(s.threshold) })}>
          {t("btn.change")}
        </PxButton>
      </div>
    </>
  );
}
```

- tabs: none disabled any more (remove `disabled`/`title` from the tab buttons); body: `tab === "machines" ? <SellerPanel view={view} act={act} /> : …`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental/ui src/modules/casecremental/i18n src/modules/casecremental/sim/intensity`
Expected: PASS — including every budget test.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/ui src/modules/casecremental/i18n src/modules/casecremental/sim/intensity.ts
git commit -m "feat(ui): Bot tab picks the bot's case; Machines tab buys and tunes the auto-seller; stage 5 is Unhinged"
```

### Task 6: The bot's station on the table — its reel, its card

**Files:** Modify `fx/pixel/layout.ts`, `fx/pixel/layout.test.ts`, `fx/pixel/BotSprite.ts`, `fx/pixel/anims.ts`, `fx/pixel/Room.ts`, `fx/World.ts`; Create `fx/pixel/BotCard.ts`; Delete `fx/pixel/botPath.ts`, `fx/pixel/botPath.test.ts`.

**Interfaces:**
- Consumes: `RunState.bot` (Task 1), actions `sellBot`, `holdCard { spot }` (Task 3).
- Produces: `TableLayout.bot.reveal: Pt`; `BotSprite.open()`; `Room.setBotOnline(on)`; `class BotCardView { root; layout(l); update(card: Drop | null); pointerDown(p): boolean; pointerMove(p); pointerUp(p); cancelDrag(); lifted(): LiftInfo | null; centre(): Pt; destroy() }`.

- [ ] **Step 1: Write the failing test** — in `fx/pixel/layout.test.ts` add (using the file's `SIZES` and imports):

```ts
  it.each(SIZES)("puts the bot's card on the table, clear of your reveal card, at %ix%i", (w, h) => {
    const l = tableLayout(pixelViewport(w, h));
    const r = l.bot.reveal;
    const { w: cw, h: ch } = ITEM_SIZE.reveal;
    expect(r.x - cw / 2).toBeGreaterThanOrEqual(l.table.x);
    expect(r.x + cw / 2).toBeLessThanOrEqual(l.table.x + l.table.w);
    expect(Math.abs(r.x - l.you.reveal.x)).toBeGreaterThanOrEqual(cw); // the two cards don't overlap
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/casecremental/fx/pixel/layout`
Expected: FAIL — `l.bot.reveal` is undefined.

- [ ] **Step 3: Implement**

`fx/pixel/layout.ts` — `bot: { reel: Rect | null; spot: Pt; reveal: Pt };` (doc: `/** Where the bot's card waits. */`); landscape:
`bot: { reel: {…as before…}, spot: {…as before…}, reveal: { x: table.x + half + 4 + r((table.w - half - 8) / 2), y: 72 } },`
(the centre of the bot's reel, at your card's height); portrait: `bot: { reel: null, spot: { x: r(W * 0.76), y: 112 }, reveal: { x: r(W * 0.76), y: 66 } },`. Run the test; if a portrait size fails the overlap or table-edge check, move the portrait `reveal.x` to `Math.min(r(W * 0.76), W - 4 - 23)` and re-run.

`fx/pixel/anims.ts` — add the open-a-case animation (the sheet's own purpose) after `botWake`:

```ts
  botOpen: [
    { frame: 1, ms: 90 },
    { frame: 2, ms: 80 },
    { frame: 3, ms: 80, dy: -1 },
    { frame: 4, ms: 90, dy: -2 },
    { frame: 5, ms: 90, dy: -1 },
    { frame: 6, ms: 80 },
    { frame: 7, ms: 120, eyes: "happy" },
    { frame: 0, ms: 120 },
  ],
```

and `botOpen: "bot-open",` in `ANIM_SPRITE`.

`fx/pixel/BotSprite.ts` — the bot stays at its station: remove the `botPath` import and the walking (`x`, `facing`, `walkMs`, `stepToward`, `botTarget`, the carried-card `Graphics`, `head()`, `mirror()`); keep `sleep`, `awake`, `wake()`, `setFrenzy()`; `layout(l)` places both actors at `l.bot.spot`; `update(ms, bot)` shows the sleeping or the awake actor and updates the visible one; add:

```ts
  /** It opens a case on its reel: the crouch-and-hop. */
  open(): void {
    this.awake.play(ANIMS.botOpen);
  }
```

Update its header comment: `The bot at its station (rework spec §1): asleep until woken; awake, it hops each time it opens a case on its reel.` Delete `fx/pixel/botPath.ts` and `fx/pixel/botPath.test.ts`.

`fx/pixel/Room.ts` — add:

```ts
  /** The bot's reel window lights up once the bot is awake (its reel is online). */
  setBotOnline(on: boolean): void {
    this.botReel.tint = on ? 0xffffff : 0x444455;
  }
```

`fx/pixel/BotCard.ts`:

```ts
import { Container, Sprite, type Texture } from "pixi.js";
import type { GameController } from "../../game/controller";
import { skinById } from "../../sim/content/cases";
import type { Drop } from "../../sim/types";
import type { LiftInfo } from "../hd/Lifted";
import type { SkinTextures } from "../skins/pixelSkin";
import { cardFace } from "./cardFace";
import { DragTracker } from "./drag";
import { ITEM_SIZE, type Pt, type TableLayout } from "./layout";

// The bot's card (rework spec §1): its drop waits at its station until you drag it to the SELL bin (or tap
// it) — a hand sale, so it feeds the combo — or the auto-seller takes it. It follows the sim's bot.card.

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export class BotCardView {
  readonly root = new Container();
  private readonly sprite = new Sprite();
  private readonly drag = new DragTracker();
  private tex: Texture | null = null;
  private shownId: number | null = null;
  private l: TableLayout | null = null;

  constructor(
    private readonly skins: SkinTextures,
    private readonly controller: GameController,
    private readonly bake: (c: Container) => Texture,
  ) {
    this.sprite.visible = false;
    this.root.addChild(this.sprite);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.place();
  }

  /** World centre of the bot's card (coins and sparks start here). */
  centre(): Pt {
    return this.l ? { ...this.l.bot.reveal } : { x: 0, y: 0 };
  }

  update(card: Drop | null): void {
    if ((card?.id ?? null) !== this.shownId) {
      this.shownId = card?.id ?? null;
      this.tex?.destroy(true);
      this.tex = null;
      if (card) {
        const face = cardFace(this.skins.frames(skinById(card.skinId))[0] ?? null, card);
        this.tex = this.bake(face);
        face.destroy({ children: true });
        this.sprite.texture = this.tex;
      }
      if (!card) this.drag.cancel();
    }
    this.sprite.visible = !!card;
    this.sprite.alpha = this.drag.dragging ? 0 : 1;
  }

  pointerDown(p: Pt): boolean {
    if (!this.sprite.visible) return false;
    const r = this.rect();
    if (!this.drag.down(p, [{ id: "botcard", rect: r }])) return false;
    this.controller.act({ type: "holdCard", spot: "bot" });
    return true;
  }

  pointerMove(p: Pt): void {
    this.drag.move(p);
  }

  pointerUp(p: Pt): void {
    if (!this.drag.dragging) return;
    const end = this.drag.up(p);
    const l = this.l;
    if (end.kind === "tap" || (end.kind === "drop" && l && dist(end.at, l.bin) <= l.binR + 8)) this.controller.act({ type: "sellBot" });
    this.controller.act({ type: "holdCard", spot: null });
  }

  cancelDrag(): void {
    if (this.drag.dragging) this.controller.act({ type: "holdCard", spot: null });
    this.drag.cancel();
  }

  lifted(): LiftInfo | null {
    const p = this.drag.exactPosition;
    if (!p || !this.drag.dragging || !this.tex) return null;
    const { w, h } = ITEM_SIZE.reveal;
    return { id: "botcard", texture: this.tex, center: { x: p.x + w / 2, y: p.y + h / 2 } };
  }

  destroy(): void {
    this.tex?.destroy(true);
    this.tex = null;
  }

  private rect() {
    const c = this.centre();
    const { w, h } = ITEM_SIZE.reveal;
    return { x: c.x - w / 2, y: c.y - h / 2, w, h };
  }

  private place(): void {
    const r = this.rect();
    this.sprite.position.set(r.x, r.y);
  }
}
```

`fx/World.ts`:
- imports: `BotCardView` from `./pixel/BotCard`; remove anything only the walking bot used;
- fields: `private readonly botReel: Reel;` and `private readonly botCard: BotCardView;`; remove `botText` and all its uses (constructor lists, `applyLayout`, `updateText`);
- constructor: `this.botReel = new Reel(this.reelFrame, skins, () => audio.play("reel-tick", { gain: 0.35, rate: 1.2 }));` and `this.botCard = new BotCardView(skins, controller, bake);`; the pixel world becomes `addChild(this.room.back, this.room.front, this.tray.root, this.reel, this.botReel, this.bench.root, this.botCard.root, this.bot.root)`; seed the bot reel like yours: `this.botReel.start(first, this.rng.pick(first.skins), this.rng);`;
- `applyLayout`: `if (this.l.bot.reel) this.botReel.layout(this.l.bot.reel); this.botReel.visible = !!this.l.bot.reel; this.botCard.layout(this.l);`; the resize branch in `update` also calls `this.botCard.cancelDrag();`;
- `update`, after the bot sprite update:

```ts
    const spin = bot.spin;
    this.botReel.update(spin ? { elapsed: spin.elapsed, fullDuration: spin.duration, crawl: 0 } : null);
    this.botCard.update(bot.card);
    this.room.setBotOnline(bot.awake);
    this.offline.visible = !!this.l.bot.reel && !bot.awake;
```

  and the lifted line: `this.tray.lifted() ?? this.botCard.lifted() ?? this.bench.lifted()`;
- pointer routing: `pointerDown` tries `this.tray.pointerDown(p)`, then `this.botCard.pointerDown(p)`, then the bench; `pointerMove`/`pointerUp` call the bot card's too;
- `restore()`: if the bot is mid-spin, put that spin on its reel: `const sp = this.controller.run.state.bot.spin; if (sp) this.botReel.start(caseById(sp.caseId), skinById(sp.drop.skinId), this.rng);`;
- `onEvent`:
  - remove the `botPickedUp` and `botWaiting` cases;
  - `case "botSpinStarted": this.bot.open(); this.botReel.start(caseById(e.caseId), skinById(e.drop.skinId), this.rng); this.audio.play("bot-reel-spin"); break;`
  - `case "botRevealed": { const at = this.screenPt(this.botCard.centre()); this.hd.particles.burst(at, RARITY_INFO[e.drop.rarity].color, 18, 160 * (this.vp.scale / 6)); this.audio.play("reveal-chime", { gain: 0.5, rate: 2 ** (RARITY_ORDER.indexOf(e.drop.rarity) / 6) }); break; }`
  - `case "sold"`: the coin source becomes `e.from === "bench" && e.source === "bench" ? this.bench.revealCentre() : e.source === "bot" ? this.botCard.centre() : e.source === "seller" ? this.l.seller : this.l.bin`; `fromBench` becomes `e.from === "bench"` (a bench card sold by hand or by the machine clears the bench card; only a hand sale plays the bin swallow: `this.bench.clearReveal(e.source === "bench")`); when `e.source === "tray" || e.source === "bot"` call `this.bench.swallow()`; when `e.source === "seller"` play `this.audio.play("seller-sell")` instead of `cash-register`;
  - `case "stored": if (e.from === "bench") { this.knifeFlight.cancel(); this.bench.clearReveal(false); this.hd.setGlow(null); } this.audio.play("tray-store"); break;`
  - `case "runStarted"` and `case "vaultBought"`: also `this.botCard.cancelDrag();`;
- `destroy`: `this.botCard.destroy();`.

- [ ] **Step 4: Run every check**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS (anims tests check `botOpen` against the 8-frame sheet); typecheck clean except anything Task 7 still owns (`HdLayer`/`sounds` ids such as `"bot-reel-spin"`, `"seller-sell"`, `"tray-store"` — if typecheck rejects those ids, do Task 7 Step 3's `SOUNDS` additions now and note it).

- [ ] **Step 5: Browser check** — wake the bot: its reel window lights up, OFFLINE goes; it hops and its reel spins a case (your cash drops by the case price); its card lands under its reel. Drag it to the bin → sold with combo; tap the next one → sold. While its card waits it doesn't open again. Reload mid-spin → its reel resumes.

- [ ] **Step 6: Commit**

```bash
git add -A src/modules/casecremental/fx
git commit -m "feat(fx): the bot's station - its reel spins its own cases, its card waits to be sold"
```

### Task 7: The auto-seller on the table, the new sounds, stage-up

**Files:** Modify `fx/pixel/Room.ts`, `fx/hd/HdLayer.ts`, `fx/audio/sounds.ts`, `fx/audio/sounds.test.ts` (if it lists ids), `fx/World.ts`.

**Interfaces:**
- Produces: `Room.setSellerOn(on)`, `HdLayer.setSellerOn(on)`; `SOUNDS` gains every rework id.

- [ ] **Step 1: Write the failing test** — in `fx/audio/AudioEngine.test.ts` (or a new `fx/audio/sounds.test.ts` if none fits), add:

```ts
import { SOUNDS } from "./sounds";

it("lists every sound the rework uses", () => {
  for (const id of [
    "bot-reel-spin", "bot-wake", "seller-power-on", "seller-sell", "dayjob-work", "dayjob-pay", "dayjob-nopay",
    "tray-store", "stage-up", "vault-slam", "vault-rumble", "devil-key-whisper", "devil-key-laugh", "vault-lock-spin",
    "chain-snap", "light-burst", "coin-fountain", "firework", "vault-reel-land", "legendary-choir", "blackout",
    "light-flicker", "light-on", "charm-pick", "perk-buy", "run-start", "reel-spinup",
  ])
    expect(SOUNDS).toHaveProperty(id);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/casecremental/fx/audio`
Expected: FAIL — the new ids are missing.

- [ ] **Step 3: Implement**

`fx/audio/sounds.ts` — add to `SOUNDS` (levels relative to the existing ones):

```ts
  "bot-reel-spin": { bus: "sfx", gain: 0.45 },
  "bot-wake": { bus: "sfx", gain: 0.7 },
  "seller-power-on": { bus: "sfx", gain: 0.8 },
  "seller-sell": { bus: "sfx", gain: 0.6 },
  "dayjob-work": { bus: "sfx", gain: 0.6 },
  "dayjob-pay": { bus: "sfx", gain: 0.7 },
  "dayjob-nopay": { bus: "sfx", gain: 0.7 },
  "tray-store": { bus: "sfx", gain: 0.6 },
  "stage-up": { bus: "sfx", gain: 0.85 },
  "vault-slam": { bus: "sfx", gain: 1 },
  "vault-rumble": { bus: "sfx", gain: 0.9 },
  "devil-key-whisper": { bus: "sfx", gain: 0.6 },
  "devil-key-laugh": { bus: "sfx", gain: 0.8 },
  "vault-lock-spin": { bus: "sfx", gain: 0.9 },
  "chain-snap": { bus: "sfx", gain: 0.9 },
  "light-burst": { bus: "sfx", gain: 1 },
  "coin-fountain": { bus: "sfx", gain: 0.8 },
  firework: { bus: "sfx", gain: 0.7 },
  "vault-reel-land": { bus: "sfx", gain: 0.9 },
  "legendary-choir": { bus: "sfx", gain: 1 },
  blackout: { bus: "sfx", gain: 0.9 },
  "light-flicker": { bus: "sfx", gain: 0.6 },
  "light-on": { bus: "sfx", gain: 0.7 },
  "charm-pick": { bus: "ui", gain: 0.7 },
  "perk-buy": { bus: "ui", gain: 0.7 },
  "run-start": { bus: "sfx", gain: 0.8 },
  "reel-spinup": { bus: "sfx", gain: 0.6 },
```

`fx/pixel/Room.ts`:

```ts
  /** The auto-seller powers on when bought (rework spec §1). */
  setSellerOn(on: boolean): void {
    this.seller.tint = on ? 0xffffff : 0xa8a8b8;
  }
```

(and drop the "powered off until M2b" comment on the tint line: `// dimmed until bought`).

`fx/hd/HdLayer.ts` — field `private sellerOn = false;`, method

```ts
  /** The auto-seller's LED: blinking red on standby, steady green once it is on. */
  setSellerOn(on: boolean): void {
    if (on === this.sellerOn) return;
    this.sellerOn = on;
    const k = this.vp?.scale ?? 1;
    this.led.clear().circle(0, 0, Math.max(1.5, k * 0.6)).fill({ color: on ? 0x3ddc84 : 0xff3b30 });
  }
```

in `layout` draw the LED with `on ? 0x3ddc84 : 0xff3b30` using `this.sellerOn`, and in `update` `this.led.alpha = this.sellerOn ? 1 : Math.sin(this.t * Math.PI) > 0 ? 1 : 0.15;`.

`fx/World.ts`:
- `update`: `this.room.setSellerOn(run.state.seller.on); this.hd.setSellerOn(run.state.seller.on);`;
- `onEvent`:
  - `case "sellerBought": this.hd.flash(0x3ddc84, 0.2); this.audio.play("seller-power-on"); break;`
  - `case "sellerUpgraded": this.audio.play("seller-power-on", { rate: 1.3, gain: 0.5 }); break;`
  - `botWoke`: replace the two bot sounds with `this.audio.play("bot-wake");`;
  - `case "dayJobStarted": this.audio.play("dayjob-work"); break;` and in `dayJobDone` play `e.amount > 0 ? "dayjob-pay" : "dayjob-nopay"` (instead of `coin-clink`);
  - `stageChanged`: when the stage rises play `"stage-up"` (instead of `"stage-whoosh"`); keep `"stage-whoosh"` registered (still used nowhere else — leave it for the dev board).

- [ ] **Step 4: Run every check**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS; typecheck clean; build succeeds.

- [ ] **Step 5: Browser check** — Machines tab: BUY the auto-seller → the machine lights up, its LED turns steady green, a power-on sound (if generated). Leave a Mil-Spec on the bench → after ~2.5 s it is sold (coins from the machine); a Covert → into the tray. Grab a card and hold it past the hold → it stays in your hand. RU: the Bot and Machines tabs fit; the stage reads «Без тормозов» at stage 5.

- [ ] **Step 6: Commit**

```bash
git add src/modules/casecremental/fx
git commit -m "feat(fx): the auto-seller powers on and sells; sounds for the bot, the machine, the day job, the tray and stage-ups"
```

### Task 8: Play it through, record it

**Files:** Modify `docs/feature-history/casecremental-run1.md`.

- [ ] **Step 1: Play it** — RESET PROGRESS (DEV); open and sell by hand; wake the bot; watch it open and sell its card by hand; buy the auto-seller (dev +$100K if needed) and watch it take both cards and fill the tray; claim from the tray; reload mid-spin; switch to RU. No console errors.

- [ ] **Step 2: Update the feature history** — in `docs/feature-history/casecremental-run1.md` replace the "The bot is the seller" bullet with:

```markdown
- **Roles (rework, user after playing M2b):** the bot opens its own cases on its own reel with your cash; you
  sell its card by hand. The auto-seller machine (bought in Run 1) takes any waiting card after a short hold:
  sells it up to its threshold (no combo) or sets it aside in the claim tray. Hand sales are the only combo.
  The first M2b had the bot walking over to sell — it read wrong next to the bot's own reel, so it was replaced.
- **Stage 5 is "Unhinged"** (was "Cyberpsychosis" — it didn't fit the game).
```

and update the loop paragraph and the tuning bullet with Task 4's measured numbers.

- [ ] **Step 3: Run every check and commit**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all PASS.

```bash
git add docs/feature-history
git commit -m "docs(feature-history): Run 1 roles - the bot opens, the auto-seller sells"
```
