# Casecremental M2b-C3 — Multi-open ×2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Multi-open" upgrade on the You tab (Run 1 cap ×2): one BUY buys and opens two cases together on your
bench, on two stacked reels that each land their own drop with their own tease. The two cards pop up side by side,
and each one is sold, dragged or taken by the auto-seller on its own.

**Architecture:** The sim's bench holds a list. `locked` has a `count`, `spinning` has one `BenchReel` per case,
and `revealed` has `cards: (Drop | null)[]`, where a slot goes null once its card is sold or taken. Selling and
holding take a `slot`. The game layer passes the slot through, shows `×2` on the shelf and migrates version-2
saves to version 3. The renderer swaps your single `Reel` for the `StackedReels` built in C2: the window grows tall
while the reels spin and settles back to compact when they land. A new `BenchCards` holds the N cards; drag, the
knife flight, the glow and the coin bursts work per card.

**Tech Stack:** TypeScript strict, Vitest, PixiJS 8, React 19 (all already in the module).

**Spec:**
- `docs/superpowers/specs/2026-10-08-casecremental-m2b-run1-design.md` §5. Its "the bot carries them off" is
  superseded by the rework: the auto-seller takes cards.
- `docs/superpowers/specs/2026-10-09-casecremental-m2b-rework-design.md` §1 (roles), §2 (multi-open ×2 / ×3 /
  ×5 by run) and §5.

## Global Constraints

- Multi-open: Run 1 cap ×2. One purchase buys and opens 2 cases together. Price of an open = price × count. It
  never applies to the vault.
- Each reel lands its own drop with its own tease. The cards pop up side by side.
- Only hand sales feed the combo. The auto-seller takes any waiting card after its hold (rework §1).
- Change numbers only in `sim/tuning.ts`.
- Every input goes through `controller.act`, the single input path.
- The sim stays pure and deterministic. A count-1 open must consume the RNG exactly as before, so existing seeded
  tests keep their numbers.
- English and Russian for every new string. Russian fits `i18n/budgets.ts`.
- No new dependencies. A file that grows past ~400 lines with a new responsibility gets split.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013MA8Fp47Lkjiuq8tVoGPyt
  ```
  An implementer on another model uses its own model name in the first line. Stage files by path.

## Review Focus

1. **Multi-open bought, cash for only one case.** BUY opens one case and charges one price. The player is never
   stuck, i.e. left with no BUY and no day job. Pinned in Task 1.
2. **Holding one card while the auto-seller takes the other.** The held card stays; the other one goes. The bench
   empties only when both are gone, and the glow stays until then. Pinned in Task 1 (sim) and Task 3 (glow).
3. **Reload mid-spin with two reels, or with one card sold and one waiting.** The reels resume with their own
   teases. The remaining card is in its own spot. A version-2 save loads into version 3. Pinned in Tasks 1 and 2
   (snapshot, migration) and Task 3 (restore).
4. **A ★ on the second card, or two big drops at once.** One knife flight, from the right card. The big effects
   play once. Both cards end up sellable. Pinned in Task 3.
5. **Portrait phone and Russian.** Two cards fit on the table without covering the bot's card. "Мультиоткрытие"
   fits the upgrades board. Pinned in Task 3 (layout tests) and Task 2 (budgets).

---

## File Structure (paths relative to `src/modules/casecremental/`)

| File | Change |
|---|---|
| `sim/tuning.ts` | `UPGRADE_COSTS.multiOpen` |
| `sim/upgrades.ts` | `multiOpen` in `UPGRADE_IDS` / `UPGRADE_INFO`; `Effects.openCount` |
| `sim/run.ts` | bench with lists (`BenchReel`, `count`, `cards`), `openCount`, `sell(slot)`, `setHeld(spot, slot)`, `heldSlot`, seller per card, `slot` on `sold` / `stored` |
| `sim/bot.ts` | the greedy player sells each bench card |
| `game/controller.ts` | `sell { slot? }`, `holdCard { spot, slot? }` |
| `game/view.ts` | `CaseView.count` |
| `game/save.ts` | `SAVE_VERSION` 3, migrates a version-2 save |
| `game/agent.ts` | describes the bench cards; `sell { slot? }`; `multiOpen` in the upgrade ids |
| `i18n/content.ts` | the `multiOpen` name and description |
| `ui/CaseShelf.tsx` | BUY ×2 at the total price |
| `fx/pixel/layout.ts` | `benchReelArea(l, n, tall)`, `revealSpots(l, n)` |
| `fx/pixel/BenchCards.ts` (new) | the N cards: bake, animate, knife-empty, place |
| `fx/pixel/Bench.ts` | uses `BenchCards`; drag ids `card0`…; per-slot sell and hold |
| `fx/restore.ts` | the reels and cards to redraw |
| `fx/World.ts` | `StackedReels` for your bench, per-card reveal and sale effects, label of the best card |
| `docs/feature-history/casecremental-run1.md` | multi-open notes |

---

### Task 1: The sim — multi-open and a bench with several cases

**Files:**
- Modify: `sim/tuning.ts`, `sim/upgrades.ts`, `sim/run.ts`, `sim/bot.ts`
- Test: `sim/upgrades.test.ts`, `sim/run.test.ts` (new `describe("multi-open")`), `sim/snapshot.test.ts`,
  `sim/pacing.test.ts` (run only)
- Update every existing test that reads `bench.drop`, the `spinStarted` event's `drop` / `tease`, or the `revealed`
  event's `drop` to the new shapes. This is a mechanical rename with no behaviour change.

**Interfaces:**
- Produces:
  - `UpgradeId` now includes `"multiOpen"`. `Effects.openCount: number` (1 + level).
  - `Run.openCount(caseId: string): number`.
  - `BenchReel { drop: Drop; tease: Tease | null; duration: number }`.
  - The bench:
    - `{ phase: "locked"; caseId; free; count }`
    - `{ phase: "spinning"; caseId; reels: BenchReel[]; elapsed; fullDuration }`
    - `{ phase: "revealed"; caseId; cards: (Drop | null)[] }`
  - `Run.sell(slot = 0)` and `Run.setHeld(spot, slot = 0)`. `RunState.heldSlot: number`.
  - Events:
    - `caseBought { caseId, free, count }`
    - `spinStarted { caseId, reels, fullDuration }`
    - `revealed { drops: Drop[] }`
    - `sold { …, slot: number }` and `stored { drop, from, slot }`. `slot` is 0 for anything that is not a bench
      card.

- [ ] **Step 1: Write the failing tests**

In `sim/upgrades.test.ts`:
- `zero` gains `multiOpen: 0`.
- The "starts at the base values" expectation gains `openCount: 1`.
- Add:

```ts
  it("multi-open opens two cases at level 1, and Run 1 caps it there", () => {
    expect(effectsOf({ ...zero, multiOpen: 1 }).openCount).toBe(2);
    expect(upgradeCost("multiOpen", 1)).toBeNull();
  });
```

In `sim/run.test.ts`, add this block. Reuse the file's existing tick helper if there is one; otherwise define
`tickFor` as in `snapshot.test.ts`.

```ts
describe("multi-open", () => {
  const multi = () => {
    const run = new Run(11);
    run.state.upgrades.multiOpen = 1;
    run.state.cash = 1000;
    return run;
  };
  const spinToReveal = (run: Run) => {
    for (let i = 0; i < 2000 && run.state.bench.phase !== "revealed"; i++) run.tick(1 / 30);
  };

  it("one BUY buys and opens two cases at twice the price, each reel with its own drop and tease", () => {
    const run = multi();
    const price = run.casePrice("bootcamp");
    expect(run.buyCase("bootcamp").ok).toBe(true);
    expect(run.state.cash).toBeCloseTo(1000 - 2 * price);
    expect(run.state.bench).toMatchObject({ phase: "locked", count: 2 });
    run.insertKey();
    const b = run.state.bench;
    if (b.phase !== "spinning") throw new Error("not spinning");
    expect(b.reels).toHaveLength(2);
    expect(b.reels[0]!.drop.id).not.toBe(b.reels[1]!.drop.id);
    expect(b.fullDuration).toBe(Math.max(...b.reels.map((r) => r.duration)));
    spinToReveal(run);
    const r = run.state.bench;
    expect(r.phase === "revealed" && r.cards.map((d) => d?.id)).toEqual(b.reels.map((x) => x.drop.id));
  });

  it("opens one case at one price when only one is affordable — never stuck (Review Focus 1)", () => {
    const run = multi();
    run.state.cash = run.casePrice("bootcamp") * 1.5;
    expect(run.openCount("bootcamp")).toBe(1);
    run.buyCase("bootcamp");
    expect(run.state.bench).toMatchObject({ phase: "locked", count: 1 });
    expect(run.state.cash).toBeCloseTo(run.casePrice("bootcamp") * 0.5);
  });

  it("sells each card on its own; the bench empties with the last one; each hand sale bumps the combo", () => {
    const run = multi();
    run.buyCase("bootcamp");
    run.insertKey();
    spinToReveal(run);
    run.drainEvents();
    expect(run.sell(1).ok).toBe(true);
    expect(run.state.bench).toMatchObject({ phase: "revealed" });
    expect(run.sell(1).ok).toBe(false); // already gone
    expect(run.sell(0).ok).toBe(true);
    expect(run.state.bench.phase).toBe("empty");
    const sold = run.drainEvents().filter((e) => e.type === "sold");
    expect(sold.map((e) => e.type === "sold" && e.slot)).toEqual([1, 0]);
    expect(run.state.combo).toBe(2);
  });

  it("the auto-seller takes the card you are not holding and leaves the held one (Review Focus 2)", () => {
    const run = multi();
    run.state.seller.on = true;
    run.state.seller.threshold = "covert";
    run.buyCase("bootcamp");
    run.insertKey();
    spinToReveal(run);
    run.setHeld("bench", 0);
    for (let i = 0; i < 30 * 5; i++) run.tick(1 / 30);
    const b = run.state.bench;
    expect(b.phase).toBe("revealed");
    expect(b.phase === "revealed" && b.cards[1]).toBeNull();
    expect(b.phase === "revealed" && b.cards[0]).not.toBeNull();
    run.setHeld(null);
    for (let i = 0; i < 30 * 5; i++) run.tick(1 / 30);
    expect(run.state.bench.phase).toBe("empty");
  });

  it("a free Ricochet case and the vault are never multiplied", () => {
    const run = multi();
    run.state.freeCases.push("bootcamp");
    run.tick(1 / 30);
    expect(run.state.bench).toMatchObject({ phase: "locked", free: true, count: 1 });
  });
});
```

In `sim/snapshot.test.ts`, add:

```ts
  it("restores a two-reel spin and a half-sold pair identically (Review Focus 3)", () => {
    const a = new Run(9);
    a.state.upgrades.multiOpen = 1;
    a.state.cash = 1000;
    a.buyCase("bootcamp");
    a.insertKey();
    tickFor(a, 1);
    const mid = Run.fromSnapshot(JSON.parse(JSON.stringify(a.snapshot())));
    expect(mid.state).toEqual(a.state);
    for (const r of [a, mid]) tickFor(r, 12);
    expect(mid.state).toEqual(a.state);
    a.sell(0);
    const half = Run.fromSnapshot(JSON.parse(JSON.stringify(a.snapshot())));
    expect(half.state.bench).toEqual(a.state.bench);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim`
Expected: FAIL on the type and shape changes, for example `multiOpen` missing, `count` undefined, `reels` undefined.

- [ ] **Step 3: Implement**

`sim/tuning.ts`: in `UPGRADE_COSTS`, add

```ts
  /** Run 1 cap ×2 (rework spec §2): one level. */
  multiOpen: { baseCost: 500, growth: 1, maxLevel: 1 },
```

`sim/upgrades.ts`:
- `UPGRADE_IDS` gets `"multiOpen"` appended.
- `UPGRADE_INFO.multiOpen = { name: "Multi-open", description: "One BUY opens 2 cases" }`.
- `Effects` gets `/** Cases one BUY opens. */ openCount: number`.
- `effectsOf` returns `openCount: 1 + levels.multiOpen`.

`sim/run.ts`:

1. Types. Export these; keep the comment style:
   ```ts
   /** One of your bench's reels: its drop, its own tease, and how long it runs (its crawl included). */
   export interface BenchReel {
     drop: Drop;
     tease: Tease | null;
     duration: number;
   }

   export type Bench =
     | { phase: "empty" }
     | { phase: "locked"; caseId: string; free: boolean; /** Cases this open holds (multi-open). */ count: number }
     | {
         phase: "spinning";
         caseId: string;
         reels: BenchReel[];
         elapsed: number;
         /** The longest reel: the cards come up when it lands. There is no brake. */
         fullDuration: number;
       }
     | { phase: "revealed"; caseId: string; /** Side by side, left to right; null once sold or taken. */ cards: (Drop | null)[] };
   ```

2. `RunState` gains `/** Which bench card is held (when held is "bench"). */ heldSlot: number`. Initialise it to
   0. `upgrades` initialises `multiOpen: 0`.

3. Events (in the `SimEvent` union):
   - `caseBought { caseId; free; count: number }`
   - `spinStarted { caseId; reels: BenchReel[]; fullDuration }`
   - `revealed { drops: Drop[] }`
   - `sold { …; slot: number }`
   - `stored { drop; from; slot: number }`

   Every existing push site passes `slot: 0`, except the bench sites below.

4. Methods:
   ```ts
   /** How many cases one BUY opens: the Multi-open level, but only as many as you can afford (never 0 — the
    *  shelf only offers BUY at one price). Multi-open never applies to the vault. */
   openCount(caseId: string): number {
     const price = this.casePrice(caseId);
     return Math.max(1, Math.min(this.effects().openCount, Math.floor(this.state.cash / price)));
   }
   ```

   `buyCase`:
   - after the cash check, `const count = this.openCount(caseId); s.cash -= price * count;`
   - `s.bench = { phase: "locked", caseId, free: false, count }`
   - the event carries `count`.

   The Ricochet free case in `tick` uses `count: 1`.

   `insertKey`: replace the single roll with one roll per case. Keep the per-reel order "roll, then its tease" so
   that a count-1 open consumes the RNG exactly as before:
   ```ts
   const topTier = Math.max(...s.unlocked.map((id) => caseById(id).tier));
   const reels: BenchReel[] = [];
   for (let i = 0; i < b.count; i++) {
     const drop = this.rollFor(c.id);
     const tease = rollTease(drop.rarity, c.tier, topTier, fx.spinSeconds, this.rng, this.forcedFake);
     this.forcedFake = false;
     reels.push({ drop, tease, duration: fx.spinSeconds + (tease?.extraSeconds ?? 0) });
   }
   const fullDuration = Math.max(...reels.map((r) => r.duration));
   s.lastSellAt += fullDuration; // the spin (tease crawls included) never counts against the combo
   s.bench = { phase: "spinning", caseId: c.id, reels, elapsed: 0, fullDuration };
   s.lastTier = c.tier;
   this.events.push({ type: "spinStarted", caseId: c.id, reels, fullDuration });
   ```

   `tick`, on landing:
   ```ts
   const drops = b.reels.map((r) => r.drop);
   s.bench = { phase: "revealed", caseId: b.caseId, cards: [...drops] };
   for (const d of drops) this.onReveal(d, "bench");
   this.revealsThisTick += drops.length;
   this.events.push({ type: "revealed", drops });
   ```

   A private helper:
   ```ts
   /** A bench card leaves (sold or taken); the bench empties with the last one. */
   private takeBenchCard(slot: number): void {
     const s = this.state;
     const b = s.bench;
     if (b.phase !== "revealed") return;
     b.cards[slot] = null;
     if (s.held === "bench" && s.heldSlot === slot) s.held = null;
     if (b.cards.every((d) => d === null)) s.bench = { phase: "empty" };
   }
   ```

   `sell(slot = 0)`:
   - `if (b.phase !== "revealed") return fail("nothing to sell"); const d = b.cards[slot]; if (!d) return fail("nothing in that spot");`
   - bump the combo, pay, then `this.takeBenchCard(slot)`;
   - the event: `{ type: "sold", drop: d, amount, combo: s.combo, source: "bench", from: "bench", slot }`.

   `setHeld(spot, slot = 0)`:
   ```ts
   const b = s.bench;
   const waiting = spot === "bench" ? b.phase === "revealed" && !!b.cards[slot] : spot === "bot" ? s.bot.card !== null : true;
   s.held = waiting ? spot : null;
   s.heldSlot = waiting && spot === "bench" ? slot : 0;
   ```

   `tickSeller`, the bench part, per card. `revealedAt` is shared, because the cards come up together:
   ```ts
   const b = s.bench;
   if (b.phase === "revealed")
     b.cards.forEach((d, slot) => {
       if (!d || (s.held === "bench" && s.heldSlot === slot)) return;
       if (s.time - s.revealedAt < sellerHold(d.rarity, seller.speedLevel)) return;
       if (this.autoTake(d, "bench", slot)) this.takeBenchCard(slot);
     });
   ```
   `autoTake(d, from, slot = 0)` passes `slot` into its `sold` / `stored` events. The bot call passes 0.

   `onReveal`'s `if (s.held === spot) s.held = null;` stays.

5. `sim/bot.ts`: the `revealed` branch becomes
   ```ts
   } else if (b.phase === "revealed") {
     run.sell(b.cards.findIndex((d) => d !== null));
     busyUntil = s.time + timings.sell;
   ```
   The greedy `spend()` already buys the cheapest upgrade, so it picks up `multiOpen` with no further change.

6. Update the existing tests that use the old shapes:
   - `bench.drop` → `bench.reels[0].drop` or `bench.cards[0]`;
   - the `revealed` event's `drop` → `drops[0]`;
   - the `spinStarted` event's `drop` / `tease` → `reels[0].drop` / `reels[0].tease`.

- [ ] **Step 4: Run the sim tests, including pacing**

Run: `npx vitest run src/modules/casecremental/sim`
Expected: PASS. If a pacing window breaks because multi-open speeds up the run, change only
`UPGRADE_COSTS.multiOpen.baseCost` in `tuning.ts` until it passes. Record the value and the reason in the
report; the windows themselves do not change.

- [ ] **Step 5: Typecheck the sim, then commit**

`npm run typecheck` will fail in `game/`, `fx/` and `ui/` until Tasks 2–3 are done. Do not edit them here.
Note the failing files in the report.

```bash
git add src/modules/casecremental/sim
git commit -m "feat(sim): multi-open - one BUY opens two cases, each card sold or taken on its own"
```

---

### Task 2: The game layer, the shelf and saves

**Files:**
- Modify: `game/controller.ts`, `game/view.ts`, `game/save.ts`, `game/agent.ts`, `i18n/content.ts`,
  `ui/CaseShelf.tsx`
- Test: `game/controller.test.ts`, `game/view.test.ts`, `game/save.test.ts`, `game/agent.test.ts`,
  `i18n/*.test.ts` (run only)

**Interfaces:**
- Consumes: Task 1's shapes, `Run.openCount`, `Run.sell(slot)`, `Run.setHeld(spot, slot)`.
- Produces:
  - `Action`:
    - `{ type: "sell"; slot?: number }` and `{ type: "holdCard"; spot: CardSpot | null; slot?: number }`;
    - `holdCard` keeps its existing shape for `spot`.
  - `CaseView.count: number`, the number of cases this BUY opens.
  - `SAVE_VERSION` 3.

- [ ] **Step 1: Write the failing tests**

`game/controller.test.ts`:
```ts
  it("sells and holds a bench card by its slot", () => {
    const c = new GameController(/* construct as the file's other tests do */);
    c.run.state.upgrades.multiOpen = 1;
    c.run.state.cash = 1000;
    c.act({ type: "buyCase", caseId: "bootcamp" });
    c.act({ type: "insertKey" });
    for (let i = 0; i < 2000 && c.run.state.bench.phase !== "revealed"; i++) c.run.tick(1 / 30);
    c.act({ type: "holdCard", spot: "bench", slot: 1 });
    expect(c.run.state.heldSlot).toBe(1);
    expect(c.act({ type: "sell", slot: 1 }).ok).toBe(true);
    expect(c.act({ type: "sell" }).ok).toBe(true); // slot 0 by default
    expect(c.run.state.bench.phase).toBe("empty");
  });
```

`game/view.test.ts`:
```ts
  it("shows how many cases a BUY opens", () => {
    const run = new Run(3);
    run.state.upgrades.multiOpen = 1;
    run.state.cash = 1000;
    expect(buildView(run).cases[0]!.count).toBe(2);
    run.state.cash = run.casePrice("bootcamp");
    expect(buildView(run).cases[0]!.count).toBe(1);
  });
```

`game/save.test.ts`: version-2 saves migrate. Build the save with the file's existing helpers, then overwrite the
bench:
```ts
  it("migrates a version-2 save: a single card, a single reel, no multi-open (Review Focus 3)", () => {
    const v3 = /* a valid save from the file's helper */;
    const drop = { id: 1, skinId: "bootcamp_0", caseId: "bootcamp", rarity: "milspec", float: 0.2, statTrak: false, value: 1 };
    const v2 = (bench: unknown) => {
      const d = JSON.parse(encodeSave(v3));
      d.v = 2;
      d.run.state.bench = bench;
      delete d.run.state.heldSlot;
      delete d.run.state.upgrades.multiOpen;
      return JSON.stringify(d);
    };
    const revealed = decodeSave(v2({ phase: "revealed", caseId: "bootcamp", drop }))!;
    expect(revealed.v).toBe(3);
    expect(revealed.run.state.bench).toEqual({ phase: "revealed", caseId: "bootcamp", cards: [drop] });
    expect(revealed.run.state.upgrades.multiOpen).toBe(0);
    expect(revealed.run.state.heldSlot).toBe(0);
    const spinning = decodeSave(v2({ phase: "spinning", caseId: "bootcamp", drop, elapsed: 1, fullDuration: 3, tease: null }))!;
    expect(spinning.run.state.bench).toEqual({
      phase: "spinning", caseId: "bootcamp", elapsed: 1, fullDuration: 3, reels: [{ drop, tease: null, duration: 3 }],
    });
    expect(decodeSave(v2({ phase: "locked", caseId: "bootcamp", free: false }))!.run.state.bench).toMatchObject({ count: 1 });
  });
```
The skin id above is a placeholder; take a real one from `CASES[0].skins[0].id`. The version-1 "drops a save"
test stays as it is. The "drops a save whose bench it cannot draw" test is updated to the new shapes: a `revealed`
bench without `cards`, or a `spinning` bench without `reels`, is dropped.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/game`
Expected: FAIL (`slot` is ignored, `count` is undefined, `v` is still 2).

- [ ] **Step 3: Implement**

- `game/controller.ts`:
  - `case "sell": return run.sell(a.slot ?? 0);`
  - `case "holdCard": return run.setHeld(a.spot, a.slot ?? 0);`
  - Keep whatever else the `holdCard` case did.
- `game/view.ts`: `CaseView` gets `/** Cases this BUY opens (multi-open, as many as you can afford). */ count: number`,
  filled from `run.openCount(c.id)`. `canBuy` is unchanged: one price is enough.
- `game/save.ts`:
  - Set `SAVE_VERSION = 3` and update the header comment: "Version 3: the bench holds several cases (multi-open);
    a version-2 save is migrated".
  - `isBench` checks the new shapes:
    - `spinning` needs `Array.isArray(b.reels)` and a non-empty list whose items have an object `drop` and a numeric
      `duration`, plus numeric `elapsed` and `fullDuration`;
    - `revealed` needs a non-empty array `cards`;
    - `locked` needs a numeric `count` (≥ 1).
  - Add `migrateV2(d)`, called in `decodeSave` before `isSave` when `d.v === 2`. It returns `d` with `v: 3` and
    `heldSlot: 0`, and maps the bench:
    - `locked` → `count: 1`;
    - `spinning { drop, tease, fullDuration, … }` → `reels: [{ drop, tease: tease ?? null, duration: fullDuration }]`,
      without `drop` / `tease`;
    - `revealed { drop }` → `cards: [drop]`.
  - `normalize` fills `upgrades` from a zero record (`{ luck: 0, appraiser: 0, quickHands: 0, multiOpen: 0, ...d.run.state.upgrades }`)
    and sets `heldSlot: 0` next to `held: null`.
- `game/agent.ts`:
  - The bench description lists each waiting card: slot, skin, rarity, wear, StatTrak and value, keeping the
    existing fields per card.
  - The action docs: `sell` takes `{ slot? }`, and `buyUpgrade` lists `luck|appraiser|quickHands|multiOpen`.
  - Update `agent.test.ts` to match.
- `i18n/content.ts`: add to `UPGRADES`:
  `multiOpen: { name: { en: "Multi-open", ru: "Мультиоткрытие" }, desc: { en: "BUY opens 2 cases", ru: "2 кейса за раз" } }`.
  Run the i18n tests; if a budget fails, shorten the Russian, never the budget.
- `ui/CaseShelf.tsx`, in `CaseRow`'s BUY button:
  ```tsx
  {t("btn.buy")}
  {c.count > 1 ? ` ×${c.count}` : ""}
  <span className="cc-btn-sub">{formatCash(c.price * c.count, getLang())}</span>
  ```

- [ ] **Step 4: Run everything**

Run: `npx vitest run src/modules/casecremental/game src/modules/casecremental/i18n src/modules/casecremental/ui`
Expected: PASS. `npm run typecheck` may still fail only in `fx/`, which Task 3 handles.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/game src/modules/casecremental/i18n src/modules/casecremental/ui
git commit -m "feat(game): multi-open through the controller, BUY ×2 on the shelf, version-3 saves"
```

---

### Task 3: On screen — stacked reels on your bench, cards side by side

**Files:**
- Create: `fx/pixel/BenchCards.ts`
- Modify: `fx/pixel/layout.ts`, `fx/pixel/Bench.ts`, `fx/pixel/drag.ts` (if `cardGrabbable` needs a slot),
  `fx/restore.ts`, `fx/World.ts`, `fx/labels.ts` (only if needed)
- Test: `fx/pixel/layout.test.ts`, `fx/restore.test.ts`, plus a `fx/pixel/benchCards.test.ts` for any pure helper
  you extract (for example "the best waiting card" and "the knife's slot")

**Interfaces:**
- Consumes: Task 1's bench shapes and events (`slot` on `sold` / `stored`), Task 2's `sell { slot }` and
  `holdCard { spot, slot }`.
- Consumes: C2's `StackedReels` and `stackRects` (`fx/vault/stackedReels.ts`). `StackedReels` has
  `layout(rects)`, `start(i, case, winner, rng)` and `update(i, motion)`. Its constructor takes
  `(frameSet, skins, onTick(i))`.
- Produces (layout):
  ```ts
  /** Your reel window: one reel's window, or — for n > 1 while the reels spin — a tall window reaching down to
   *  just above the mat (the cards are not up yet). Landed, it settles back to the one-reel height. */
  export function benchReelArea(l: TableLayout, n: number, tall: boolean): Rect
  /** Where n bench cards sit, side by side around you.reveal, left to right. */
  export function revealSpots(l: TableLayout, n: number): Pt[]
  ```

- [ ] **Step 1: Write the failing layout and restore tests**

`fx/pixel/layout.test.ts`. Use the viewports the file already tests: a landscape desktop and a portrait phone.

```ts
describe("multi-open on the table", () => {
  for (const vp of [/* the file's landscape viewport */, /* the file's portrait viewport */]) {
    const l = tableLayout(vp);
    it(`one card sits on you.reveal (${vp.portrait ? "portrait" : "landscape"})`, () => {
      expect(revealSpots(l, 1)).toEqual([l.you.reveal]);
      expect(benchReelArea(l, 1, true)).toEqual(l.you.reel);
    });
    it(`two cards stay on the table, left of the bot's card (Review Focus 5)`, () => {
      const [a, b] = revealSpots(l, 2) as [Pt, Pt];
      const w = ITEM_SIZE.reveal.w;
      expect(a.x).toBeLessThan(b.x);
      expect(a.x - w / 2).toBeGreaterThanOrEqual(l.table.x);
      expect(b.x + w / 2).toBeLessThanOrEqual(l.bot.reveal.x - w / 2);
    });
    it("the tall window spans the reel's top to above the mat and never covers the case", () => {
      const tall = benchReelArea(l, 2, true);
      expect(tall.y).toBe(l.you.reel.y);
      expect(tall.h).toBeGreaterThan(l.you.reel.h);
      expect(tall.y + tall.h).toBeLessThanOrEqual(l.you.mat.y - 1);
      const compact = benchReelArea(l, 2, false);
      expect(compact.y + compact.h).toBeLessThanOrEqual(l.you.reveal.y - ITEM_SIZE.reveal.h / 2);
    });
  }
});
```

`fx/restore.test.ts`: the plan carries every reel and every remaining card.
```ts
  it("restores a two-reel spin and a half-sold pair", () => {
    // a spinning bench with two reels → plan.spinning has both, with their teases and durations
    // a revealed bench with cards [null, d] → plan.revealed is [null, d]
  });
```
Write it concretely against your `RestorePlan`:
- `spinning: BenchReel[] | null`, and also carry `elapsed` / `fullDuration` if the World needs them;
- `revealed: (Drop | null)[] | null`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx`
Expected: FAIL (`revealSpots` and `benchReelArea` are not exported; the plan has the old shape).

- [ ] **Step 3: Implement the layout**

`revealSpots(l, n)`:
- For n = 1, return `[l.you.reveal]`.
- Otherwise space the cards `ITEM_SIZE.reveal.w + 2` apart, centred on `you.reveal.x`.
- Clamp the group so the leftmost card's left edge is ≥ `table.x + 1` and the rightmost card's right edge is ≤
  `bot.reveal.x − w/2 − 1`.
- If the space is too narrow (portrait), shrink the spacing so the cards overlap rather than cross those limits.
- y is `you.reveal.y` for every card.

`benchReelArea(l, n, tall)`:
- For n = 1, return `l.you.reel`.
- tall → `{ ...l.you.reel, h: l.you.mat.y - 1 - l.you.reel.y }`.
- compact → `{ ...l.you.reel, h: Math.max(l.you.reel.h, l.you.reveal.y - ITEM_SIZE.reveal.h / 2 - 2 - l.you.reel.y) }`.

- [ ] **Step 4: `BenchCards` and `Bench`**

Move the card handling out of `Bench.ts` into `fx/pixel/BenchCards.ts`. It holds N slots. Each slot has its own
`Sprite`, baked frames, `SkinPlayer` and empty-card texture, all baked through the same `bake` callback as today.
Methods:
- `show(slot, skin, drop)`, `clear(slot)`, `clearAll()`
- `layout(spots: Pt[])`, `centre(slot)`, `rect(slot)`
- `visible(slot)`, `waiting(): number[]`
- `beginKnifeFlight(slot)`, `endKnifeFlight()`
- `update(ms, draggingSlot | null)`, `texture(slot)`, `destroy()`

A ★ card shows its empty face while its knife flies; only one knife flies at a time.

`Bench.ts`:
- Uses `BenchCards`, with the same drag tracker. The grabbable ids are `"key"` and `card${slot}` for each visible,
  knife-free card while the phase is `revealed`.
- On grab: `act({ type: "holdCard", spot: "bench", slot })`. On release: `holdCard null`.
- A tap on a card → `sell { slot }`. A drop on the bin → `sell { slot }`.
- A tap on the bin → `sell { slot: first waiting }`.
- `lifted()` draws the held slot's texture.
- `showReveal(slot, skin, drop)` and `clearReveal(slot, sold)`.
- `hideCase()` happens when the last card leaves.
- `revealCentre()` returns the centre of the waiting cards (or `you.reveal`); `cardCentre(slot)` returns one card's
  centre.
- Each frame, `layout` calls `cards.layout(revealSpots(l, n))`, where n is the card count of the current open
  (Task 1's `cards.length`, or 1).

- [ ] **Step 5: `World`**

- Replace `this.reel: Reel` with `this.benchReels = new StackedReels(this.reelFrame, skins, (i) => audio.play("reel-tick", { rate: comboPitch(...), gain: i === 0 ? 1 : 0.5 }))`.
  The other reel ticks more quietly so two reels never sound like a doubled click.
- Lay the reels out with `stackRects(benchReelArea(l, n, tall), n, 26)`:
  - n is the current open's count;
  - `tall` is true while spinning with n > 1;
  - on landing the window settles back to compact. Glide it over ~0.25 s if `Reel.layout` is cheap enough to
    call every frame; otherwise snap at the landing. Record which you chose in the report.
- `spinStarted`: lay out for `e.reels.length` (tall), then `start(i, case, skinById(r.drop.skinId), rng)` for each
  reel. The tease look stays with the reel. If the old `Reel.start` took a tease argument, extend `StackedReels.start`
  with an optional `tease` and pass each reel's own.
- Per frame, for each reel:
  `update(i, { elapsed: Math.min(b.elapsed, r.duration), fullDuration: r.duration, crawl: crawlSeconds(r.tease, r.duration) })`.
  The camera lean uses the reel with the strongest tease, at its own crawl start.
- `revealed { drops }`, for each card:
  - `bench.showReveal(i, skin, d)`;
  - a particle burst at its own centre, sized by rarity as today.
- The once-only effects play once, for the best drop (highest rarity, then value): the glow colour, the chime,
  hit-stop, zoom, shake, `covert-impact`, ducking, and the gold sequence.
- The knife flight launches from the first card whose skin flips. `endKnifeFlight` returns it to that slot.
- `sold` / `stored` from the bench: burst coins from `bench.cardCentre(e.slot)` and clear that slot. Clear the glow
  and cancel the knife flight only when no bench card remains (`run.state.bench.phase !== "revealed"`), or when
  the slot that left is the knife's own.
- The label lines show the best waiting card, placed under that card's centre. They are rebuilt every frame as
  today.
- `restore()` redraws every reel (started at its drop, with its tease) and every remaining card in its own slot.
- `vaultBought`, `runStarted`, `destroy` and the resize cancel apply to every card and every reel.
- `this.reel`'s tint in the lights code applies to `benchReels`.

- [ ] **Step 6: Run everything**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/modules/casecremental/fx
git commit -m "feat(fx): multi-open on screen - stacked reels on your bench, cards side by side"
```

---

### Task 4: Play it, write it down

**Files:** `docs/feature-history/casecremental-run1.md`

- [ ] **Step 1: Browser check.** The controller does this with the dev board. Check:
  - Buy Multi-open, then BUY ×2: the window grows, two reels land, two cards come up and settle back.
  - Drag one card into the bin while the auto-seller takes the other.
  - A forced ★: one knife, from the right card.
  - Reload mid-spin and with one card left.
  - Portrait.
  - Russian.
- [ ] **Step 2: Feature history.** In `docs/feature-history/casecremental-run1.md`, line 4's "Multi-open ×2 is
  plan M2b-C" becomes "Multi-open ×2 is plan M2b-C3". Add a decisions bullet:
  > - **Multi-open ×2** (Run 1 cap; spec §5): one BUY opens up to two cases — only as many as you can afford, so
  >   it never locks you out of BUY or the day job. Each reel lands its own drop and tease; the reel window grows
  >   tall while they spin and settles when they land; the cards sit side by side and are sold, held or taken by
  >   the auto-seller one by one (each hand sale feeds the combo). The big reveal effects play once, for the best
  >   card. Saves went to version 3 (a version-2 save is migrated).
- [ ] **Step 3: Commit**

```bash
git add docs/feature-history/casecremental-run1.md
git commit -m "docs(feature-history): multi-open ×2"
```
