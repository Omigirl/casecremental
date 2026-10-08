# Casecremental M2b-C2 — The vault as a last-chance ticket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the self-running vault finale with the rework spec's cinematic: buying the vault takes the screen, a big vault slams into the centre, the player turns a devilish key by hand, the vault opens like a legendary chest (golden light, coins, fireworks, a fanfare, five stacked reels landing one by one, the fifth an animated legendary ★), then a smooth blackout, the prestige screen with its own music, and on the next run the workshop's lights come back one by one with flickers.

**Architecture:** The sim gets a vault phase (`key` → `opening` with a fixed timeline whose reel landings are events at fixed times → over), so the canvas syncs to it and a reload resumes. The canvas side lives in a new `fx/vault/` folder (World.ts is already past 400 lines): `VaultScene` (HD centre stage: the vault, the key, light, coins, fireworks), `StackedReels` (N reels in the pixel world — reused by multi-open in plan C3), pure schedules `vaultCues(t)` and `lightLevels(t)` with tests. The audio engine gains named tracks (suspense loop, fanfare one-shot with offset, prestige loop) that take over from the stage loops.

**Tech Stack:** TypeScript (strict), PixiJS 8, React 19, Vitest. `npx vitest run <path>`, `npm run typecheck`, `npm run build`, dev server http://localhost:5180.

**Spec:** `docs/superpowers/specs/2026-10-09-casecremental-m2b-rework-design.md` §3, §4, §8. Builds on plan M2b-C1 (the bot opener, the auto-seller, `SOUNDS` ids for the vault).

## Global Constraints

- The sim stays pure and deterministic; every timing and number lives in `sim/tuning.ts`.
- The canvas reads the sim's vault state each frame (a reload mid-key or mid-opening resumes exactly); sim events only trigger one-shot juice.
- While the vault is out (phase `key` or `opening`) and after the run, every action except turning the key and the prestige actions is refused, every panel and the HUD are hidden, and clicks on the table only add sparks.
- Vault art: `vault-case` (4 frames: locked, glowing, bursting, open) and `devil-key` (4-frame pulse) sprites, built from `art/source` by `npm run art`; until they exist the sprite library's placeholders are used (no crash).
- Music: `vault-suspense` loops while the key waits; `vault-fanfare` plays once from the turn of the key (offset-resumed after a reload); `prestige` loops on the prestige screen; the stage loops return after the next run's lights are up.
- Strings via `t()` in EN and RU within budgets.
- Commit trailers: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_013MA8Fp47Lkjiuq8tVoGPyt`.

## Review Focus

1. **Reload while the key waits** → the vault is back in the centre, the key waiting, the suspense loop playing; no money is charged twice. Pinned in Task 1 (snapshot) and Task 5 (scene restore).
2. **Reload mid-opening** → the reels already landed show their drops, the rest keep spinning to their times, the fanfare resumes at the right offset, nothing is paid twice. Pinned in Task 1 (each landing pays once across a snapshot) and Task 2 (fanfare offset).
3. **Dragging the key somewhere else, tapping it, or clicking wildly** → only a release on the lock (or a tap on the key) turns it; a click elsewhere only sparks; the key can't be turned twice. Pinned in Task 1 and Task 5.
4. **The prestige screen after a reload** → straight onto black with the prestige music, no blackout replay; START NEXT RUN always brings the lights back and the stage music. Pinned in Task 4 (`lightLevels` ends fully lit) and Task 6.
5. **Russian** → the new key hint and prestige strings fit. Pinned in Task 5 (budget tests).

---

## File Structure (paths relative to `src/modules/casecremental/`)

- Modify `sim/run.ts` (vault phases; the old `finale` field and `tickFinale` go), `sim/tuning.ts`, `sim/content/cases.ts` (the legendary skin), `sim/vault.test.ts`, `sim/snapshot.test.ts`, `sim/bot.ts` (the greedy player turns the key).
- Modify `game/controller.ts` (+ test), `game/view.ts` (+ test), `game/agent.ts`, `game/save.ts`.
- Modify `fx/audio/sounds.ts`, `fx/audio/AudioEngine.ts` (+ test).
- Create `fx/vault/stackedReels.ts` (+ test), `fx/vault/lights.ts` (+ test), `fx/vault/cues.ts` (+ test), `fx/vault/VaultScene.ts`.
- Modify `fx/World.ts` (remove the old finale; mount the vault scene, the blackout and the lights), `fx/hd/HdLayer.ts` (light levels), `fx/pixel/Room.ts` (light level).
- Delete `fx/finale.ts`, `fx/finale.test.ts`.
- Modify `ui/GamePanel.tsx`, `ui/prestigeRules.ts` (+ test), `i18n/en.ts`, `i18n/ru.ts`.
- Modify `docs/feature-history/casecremental-run1.md`.

---

### Task 1: The vault's phases in the sim

**Files:** Modify `sim/tuning.ts`, `sim/run.ts`, `sim/content/cases.ts`, `sim/vault.test.ts`, `sim/snapshot.test.ts`, `sim/bot.ts`.

**Interfaces:**
- Produces: `VaultState = { phase: "key" } | { phase: "opening"; t: number; drops: Drop[]; landed: number }`; `RunState.vault: VaultState | null` (replaces `finale`); `run.turnVaultKey(): ActionResult`; events `vaultKeyTurned { drops }`, `vaultReelLanded { index; drop; amount }`, `vaultOpened { trophy; drop; lifetimeEarnings }` (drop = the legendary); constants `VAULT_LAND_TIMES`, `VAULT_OPENING_SECONDS`, `VAULT_REEL_SHARES`, `VAULT_REEL_RARITIES`; content `VAULT_LEGEND: SkinDef` (id `vault1_legend`), `skinById` finds it. Removed: `RunState.finale`, `FINALE_SECONDS`.

- [ ] **Step 1: Tuning** — in `sim/tuning.ts` replace `FINALE_SECONDS` (and its comment line) with:

```ts
/** Vault Case I (rework spec §4): after the key turns, five reels land at these seconds (on the fanfare's
 *  beats); the scene ends here; each reel pays this share of the vault's price, rarer each time. */
export const VAULT_LAND_TIMES = [6, 9, 12, 15, 19] as const;
export const VAULT_OPENING_SECONDS = 24;
export const VAULT_REEL_SHARES = [0.03, 0.06, 0.08, 0.13, 0.3] as const;
export const VAULT_REEL_RARITIES = ["classified", "covert", "covert", "gold", "gold"] as const;
```

(keep `VAULT_GROWTH`, `VAULT_TROPHY`).

- [ ] **Step 2: The legendary skin** — in `sim/content/cases.ts`, after `KNIFE_MOTION`:

```ts
/** Vault Case I's legendary (rework spec §4): an animated texture — a flowing aurora — plus the knife's turn. */
export const VAULT_LEGEND: SkinDef = skin(
  "vault1_legend",
  "Event Horizon",
  "knife",
  "gold",
  p("lava", ["#12002a", "#5b2bd6", "#ff3fb4", "#ffd34d", "#fffbe0"], 7, 401),
  { pattern: "flow", weapon: "flip", frames: 16, fps: 8 },
);
```

and make `SKINS` include it: `const SKINS = new Map([...CASES.flatMap((c) => c.skins.map((s) => [s.id, s] as const)), [VAULT_LEGEND.id, VAULT_LEGEND] as const]);` (move the `SKINS` line below `VAULT_LEGEND` if needed). Add its names to `i18n/content.ts`'s `SKINS`: `vault1_legend: { en: "Event Horizon", ru: "Горизонт событий" },`.

- [ ] **Step 3: Write the failing tests** — replace `sim/vault.test.ts`'s finale tests (`"runs the finale, sells the tray into the earnings, and ends the run"`, `"holds the top stage through the whole finale…"`) with these, keeping the first two tests (shown/price, clear bench) and the Ricochet test (changing its `tickFor(run, 1)` to stay as is):

```ts
const openVault = (run: Run) => {
  allUnlocked(run);
  run.state.cash = 1e9;
  expect(run.buyVault().ok).toBe(true);
};

  it("waits for the key: nothing else can be done, and nothing happens on its own", () => {
    const run = new Run(1);
    openVault(run);
    expect(run.state.vault).toEqual({ phase: "key" });
    expect(run.locked()).toBe(true);
    expect(run.buyCase("bootcamp")).toEqual({ ok: false, reason: "the vault is open" });
    tickFor(run, 60);
    expect(run.state.vault).toEqual({ phase: "key" });
    expect(run.state.over).toBe(false);
  });

  it("turns the key once, rolls five drops rarer each time ending on the legendary, and lands them on time (Review Focus 3)", () => {
    const run = new Run(1);
    openVault(run);
    expect(run.turnVaultKey().ok).toBe(true);
    expect(run.turnVaultKey()).toEqual({ ok: false, reason: "the key has turned" });
    const v = run.state.vault;
    if (v?.phase !== "opening") throw new Error("expected opening");
    expect(v.drops.map((d) => d.rarity)).toEqual([...VAULT_REEL_RARITIES]);
    expect(v.drops[4]!.skinId).toBe(VAULT_LEGEND.id);
    expect(run.drainEvents().map((e) => e.type)).toContain("vaultKeyTurned");
    const landed: number[] = [];
    for (let t = 0; t < VAULT_OPENING_SECONDS + 1; t += DT) {
      run.tick(DT);
      for (const e of run.drainEvents()) if (e.type === "vaultReelLanded") landed.push(run.state.time);
    }
    expect(landed).toHaveLength(5);
    landed.forEach((at, i) => expect(at - landed[0]!).toBeCloseTo(VAULT_LAND_TIMES[i]! - VAULT_LAND_TIMES[0]!, 1));
  });

  it("pays each reel its share once, sells the tray, ends the run on the legendary trophy (Review Focus 2)", () => {
    const run = new Run(1);
    run.state.tray.push({ id: 99, caseId: "bootcamp", skinId: "bc_woodland", rarity: "covert", float: 0.2, wear: "FT", statTrak: false, value: 50 });
    openVault(run);
    const earned = run.state.lifetimeEarnings;
    run.turnVaultKey();
    tickFor(run, VAULT_LAND_TIMES[2]! + 0.1);
    // a reload in the middle: the landings so far are paid, the rest still to come
    const b = Run.fromSnapshot(JSON.parse(JSON.stringify(run.snapshot())));
    tickFor(b, VAULT_OPENING_SECONDS);
    const price = DEFAULT_SETUP.vaultPrice;
    const reels = VAULT_REEL_SHARES.reduce((a, s) => a + s * price, 0);
    expect(b.state.lifetimeEarnings - earned).toBeCloseTo(reels + b.payout(run.state.tray[0]!, false), 0);
    expect(b.state.over).toBe(true);
    expect(b.state.tray).toHaveLength(0);
    const opened = b.drainEvents().filter((e) => e.type === "vaultOpened");
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ trophy: VAULT_TROPHY, drop: { skinId: VAULT_LEGEND.id } });
  });

  it("holds the top stage from the purchase to the end", () => {
    const run = new Run(1);
    run.state.stage = 2;
    openVault(run);
    expect(run.state.stage).toBe(STAGE_NAMES.length);
    run.turnVaultKey();
    tickFor(run, VAULT_OPENING_SECONDS + 1);
    expect(run.state.stage).toBe(STAGE_NAMES.length);
  });
```

(imports: `VAULT_LAND_TIMES, VAULT_OPENING_SECONDS, VAULT_REEL_RARITIES, VAULT_REEL_SHARES, VAULT_TROPHY` from `./tuning`; `VAULT_LEGEND` from `./content/cases`; drop `FINALE_SECONDS`). In `sim/snapshot.test.ts` replace `"restores a finale in progress"` with:

```ts
  it("restores a vault waiting for its key, and one mid-opening (Review Focus 1)", () => {
    const a = new Run(2);
    a.state.unlocked = ["bootcamp", "wildwood", "bedrock"];
    a.state.cash = 1e9;
    a.buyVault();
    const waiting = Run.fromSnapshot(JSON.parse(JSON.stringify(a.snapshot())));
    expect(waiting.state.vault).toEqual({ phase: "key" });
    expect(waiting.state.cash).toBe(a.state.cash); // charged once
    a.turnVaultKey();
    tickFor(a, 7);
    const b = Run.fromSnapshot(a.snapshot());
    tickFor(b, 20);
    expect(b.state.over).toBe(true);
  });
```

- [ ] **Step 4: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/sim/vault src/modules/casecremental/sim/snapshot`
Expected: FAIL — `turnVaultKey` is not a function; `state.vault` undefined.

- [ ] **Step 5: Implement in `sim/run.ts`**
- export `type VaultState = { phase: "key" } | { phase: "opening"; t: number; drops: Drop[]; landed: number };`
- `RunState`: replace `finale: number | null` with `/** Vault Case I is out (rework spec §4), or null. */ vault: VaultState | null;` (constructor `vault: null,`);
- `SimEvent`: add `| { type: "vaultKeyTurned"; drops: Drop[] }` and `| { type: "vaultReelLanded"; index: number; drop: Drop; amount: number }`;
- `locked()`: `return this.state.vault !== null || this.state.over;`
- `buyVault()`: replace `s.finale = 0;` with `s.vault = { phase: "key" };` (the rest stays: pay, `vaultBought`, top stage);
- add:

```ts
  /** The player turns the devil key: five drops are rolled and the opening timeline starts. */
  turnVaultKey(): ActionResult {
    const s = this.state;
    if (!s.vault) return fail("no vault to open");
    if (s.vault.phase !== "key") return fail("the key has turned");
    const top = CASES[CASES.length - 1]!;
    const drops = VAULT_REEL_RARITIES.map((rarity, i) => {
      const d = rollDrop(top, priceOf(top.id), 0, this.rng, s.nextDropId++, rarity);
      const value = this.setup.vaultPrice * VAULT_REEL_SHARES[i]!;
      return i === VAULT_REEL_RARITIES.length - 1 ? { ...d, skinId: VAULT_LEGEND.id, caseId: "vault1", value } : { ...d, value };
    });
    s.vault = { phase: "opening", t: 0, drops, landed: 0 };
    this.events.push({ type: "vaultKeyTurned", drops });
    return OK;
  }
```

- replace `tickFinale` with:

```ts
  /** The vault's opening timeline: each reel lands (and pays) at its time; then the run ends. */
  private tickVault(dt: number): void {
    const s = this.state;
    const v = s.vault;
    if (v?.phase !== "opening") return;
    v.t += dt;
    while (v.landed < v.drops.length && v.t >= VAULT_LAND_TIMES[v.landed]!) {
      const drop = v.drops[v.landed]!;
      s.cash += drop.value;
      s.lifetimeEarnings += drop.value;
      this.events.push({ type: "vaultReelLanded", index: v.landed, drop, amount: drop.value });
      v.landed++;
    }
    if (v.t < VAULT_OPENING_SECONDS) return;
    for (const d of s.tray) {
      const amount = this.payout(d, false);
      s.cash += amount;
      s.lifetimeEarnings += amount;
    }
    s.tray = [];
    s.vault = null;
    s.over = true;
    this.events.push({ type: "vaultOpened", trophy: VAULT_TROPHY, drop: v.drops[v.drops.length - 1]!, lifetimeEarnings: s.lifetimeEarnings });
  }
```

  and in `tick` call `this.tickVault(dt);` where `tickFinale` was;
- the bot freezes while the vault is out (C1 final review): in `buyVault`, after paying the price, cash in what the bot holds — its waiting card and the drop of a spin in flight — as machine sales (`payout(d, false)`, a `sold` event with `source: "seller", from: "bot"` each), then `s.bot.card = null; s.bot.spin = null;`; and `tickBot` returns at once while `s.vault !== null`. Test (add to `sim/vault.test.ts`):

```ts
  it("cashes in the bot's card and its spin when the vault is bought, then freezes the bot", () => {
    const run = new Run(1, { ...DEFAULT_SETUP, botAwake: true });
    allUnlocked(run);
    run.state.cash = 1e9;
    for (let i = 0; i < 900 && !run.state.bot.card; i++) run.tick(DT);
    const card = run.state.bot.card!;
    const earned = run.state.lifetimeEarnings;
    expect(run.buyVault().ok).toBe(true);
    expect(run.state.bot.card).toBeNull();
    expect(run.state.bot.spin).toBeNull();
    expect(run.state.lifetimeEarnings - earned).toBeCloseTo(run.payout(card, false));
    tickFor(run, 10);
    expect(run.state.bot.spin).toBeNull(); // frozen
  });
```
- imports: the new tuning names, `VAULT_LEGEND` from `./content/cases`; remove `FINALE_SECONDS`.

  Note `locked()` stays true after the run because `over` is true.

`sim/bot.ts` (the greedy pacing player): right after `if (run.buyVault().ok) continue;` the vault is out — add at the top of the loop body, before the `busyUntil`/`locked` check: `if (run.state.vault?.phase === "key") run.turnVaultKey();`.

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental/sim`
Expected: PASS (pacing included — `vaultAt` is measured on `vaultBought`). Typecheck will be red in `game/`, `fx/` (Tasks 1b and 5).

- [ ] **Step 7: Game layer** — in the same task, update the users of `finale`:
- `game/view.ts`: `vault` view gains `phase: "key" | "opening" | null` and `progress: number` (opening `t / VAULT_OPENING_SECONDS`, else 0); `GameView.finale` becomes `opening: number | null` (the opening's progress, or null) — rename the field and update `ui/UpgradesBoard.tsx`'s `view.finale` uses to `view.vault.phase !== null`; `canBuy` for the vault requires `!run.locked()` as now;
- `game/controller.ts`: `Action` adds `{ type: "turnVaultKey" }` → `run.turnVaultKey()`; the flush's `vaultOpened` handling is unchanged; for `pickCharm` and `buyPerk` that succeed, emit `{ type: "charmPicked" }` / `{ type: "perkBought" }` (add both to `SimEvent` with the doc "Emitted by the controller (prestige screen)");
- `game/agent.ts`: action `turnVaultKey: () => run({ type: "turnVaultKey" })`, described `"Turn the devil key in Vault Case I's lock (opens it)."`; `state()` shows `vault: s.vault?.phase ?? null` instead of `finale`;
- `game/save.ts`: `normalize` adds nothing new; `isSave` unchanged (a v2 save from before this task has `finale` and no `vault` — treat a missing `vault` as `null`: in `normalize`, `state: { ...d.run.state, held: null, vault: d.run.state.vault ?? null }`);
- tests: `game/view.test.ts` — replace the finale expectation in `"makes the vault the goal once every case is unlocked, and shows the finale"` with `run.buyVault(); expect(buildView(run).vault.phase).toBe("key"); run.turnVaultKey(); run.tick(VAULT_OPENING_SECONDS / 4); expect(buildView(run).opening).toBeCloseTo(0.25, 1);` (imports adjusted); `game/controller.test.ts` — `openVault` turns the key after buying (`c.act({ type: "turnVaultKey" })`) and steps `VAULT_OPENING_SECONDS + 1` seconds; add `it("emits sounds' events for picking a charm and buying a perk", …)` asserting `charmPicked` and `perkBought` reach `onEvent` after a vault.

Run: `npx vitest run src/modules/casecremental/sim src/modules/casecremental/game`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A src/modules/casecremental/sim src/modules/casecremental/game src/modules/casecremental/i18n src/modules/casecremental/ui/UpgradesBoard.tsx
git commit -m "feat(sim): Vault Case I waits for its key, then opens on five timed reels ending on an animated legendary"
```

### Task 2: Music tracks in the audio engine

**Files:** Modify `fx/audio/sounds.ts`, `fx/audio/AudioEngine.ts`, `fx/audio/AudioEngine.test.ts`.

**Interfaces:**
- Produces: `AudioFiles.tracks: Map<TrackId, string>` with `TrackId = "vault-suspense" | "vault-fanfare" | "prestige"`; `indexAudio` maps `vault-suspense.mp3`, `vault-fanfare-1.mp3` (the first take; `-2` is a spare), `prestige.mp3`; `AudioEngine.setTrack(id: TrackId | null, opts?: { loop?: boolean; offset?: number })` — a track replaces the stage loop (fade 0.6 s); `null` brings the stage loop back.

- [ ] **Step 1: Write the failing test** — in `fx/audio/AudioEngine.test.ts` (reuse its fake context and deps):

```ts
it("indexes the vault and prestige tracks", () => {
  const files = indexAudio({
    "/a/vault-suspense.mp3": "s",
    "/a/vault-fanfare-1.mp3": "f1",
    "/a/vault-fanfare-2.mp3": "f2",
    "/a/prestige.mp3": "p",
    "/a/music-1.mp3": "m1",
  });
  expect(files.tracks.get("vault-suspense")).toBe("s");
  expect(files.tracks.get("vault-fanfare")).toBe("f1");
  expect(files.tracks.get("prestige")).toBe("p");
  expect(files.music.get(1)).toBe("m1");
});

it("a track takes over from the stage loop, starts at an offset, and hands back", async () => {
  // build the engine with the file's fake context; music on; tracks and music-1 decoded
  // assert: setTrack("vault-fanfare", { loop: false, offset: 4 }) starts a source with loop=false at offset 4,
  // the stage loop's gain ramps to 0; setTrack(null) starts the stage loop again.
});
```

Write the second test concretely against the file's existing fake `Ctx` (it records created sources, their `start` arguments and `loop` flags — extend the fake to record the `offset` argument of `start(when, offset)` if it does not yet).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/casecremental/fx/audio`
Expected: FAIL — `files.tracks` undefined, `setTrack` missing.

- [ ] **Step 3: Implement**
- `sounds.ts`: `export type TrackId = "vault-suspense" | "vault-fanfare" | "prestige";` `AudioFiles.tracks: Map<TrackId, string>`; in `indexAudio`, before the sfx branch: `const track = /^(vault-suspense|vault-fanfare|prestige)(?:-(\d+))?$/.exec(name); if (track) { const id = track[1] as TrackId; if (!tracks.has(id)) tracks.set(id, url); continue; }` (entries are sorted, so `-1` wins over `-2`).
- `AudioEngine.ts`: preload the tracks with the rest; add a `track: { id: TrackId; source: AudioBufferSourceNode; gain: GainNode } | null` field and

```ts
  /** A named track (the vault's suspense and fanfare, the prestige loop) replaces the stage loop; null
   *  hands back to it. A one-shot can start part-way (a reload mid-fanfare). */
  setTrack(id: TrackId | null, opts: { loop?: boolean; offset?: number } = {}): void {
    if ((this.track?.id ?? null) === id && id !== "vault-fanfare") return;
    this.wantTrack = id ? { id, loop: opts.loop ?? true, offset: opts.offset ?? 0 } : null;
    this.updateMusic();
  }
```

  and make `updateMusic` do: when `wantTrack` is set — stop the stage loop (`stopLoop(0.6)`) and, if the wanted track isn't the one playing, fade out any playing track and start the wanted one (`source.loop = loop; source.start(ctx.currentTime, offset % buffer.duration)` with a 0.3 s fade-in); when `wantTrack` is null — stop any track (0.6 s) and run the existing stage-loop logic. `setMusicOn(false)` stops both; `dispose` stops both. Keep every Web Audio call inside the existing try/catch style (music is optional).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/modules/casecremental/fx/audio && npm run typecheck`
Expected: PASS; typecheck clean for `fx/audio`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/fx/audio
git commit -m "feat(audio): named music tracks - the vault's suspense and fanfare, the prestige loop"
```

### Task 3: Stacked reels

**Files:** Create `fx/vault/stackedReels.ts`, `fx/vault/stackedReels.test.ts`.

**Interfaces:**
- Produces: `stackRects(area: Rect, n: number, maxH = 24, gap = 3): Rect[]` (pure, centred vertically in `area`, whole pixels); `class StackedReels extends Container { constructor(frameSet, skins, onTick); layout(rects: Rect[]); start(i, c: CaseDef, winner: SkinDef, rng); update(i, motion: ReelMotion | null); land(i) }` — a thin owner of N `Reel`s (from `fx/pixel/Reel.ts`).

- [ ] **Step 1: Write the failing test** — `fx/vault/stackedReels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { stackRects } from "./stackedReels";

describe("stacked reels", () => {
  it("stacks n whole-pixel reels in the area, centred, never overlapping", () => {
    const area = { x: 10, y: 20, w: 150, h: 140 };
    for (const n of [1, 2, 5]) {
      const rs = stackRects(area, n);
      expect(rs).toHaveLength(n);
      for (const r of rs) {
        expect(Number.isInteger(r.x) && Number.isInteger(r.y) && Number.isInteger(r.h)).toBe(true);
        expect(r.y).toBeGreaterThanOrEqual(area.y);
        expect(r.y + r.h).toBeLessThanOrEqual(area.y + area.h);
        expect(r.w).toBe(area.w);
      }
      for (let i = 1; i < n; i++) expect(rs[i]!.y).toBeGreaterThanOrEqual(rs[i - 1]!.y + rs[i - 1]!.h);
      const top = rs[0]!.y - area.y;
      const bottom = area.y + area.h - (rs[n - 1]!.y + rs[n - 1]!.h);
      expect(Math.abs(top - bottom)).toBeLessThanOrEqual(1);
    }
  });

  it("shrinks the reels to fit a short area", () => {
    const rs = stackRects({ x: 0, y: 0, w: 100, h: 60 }, 5);
    expect(rs[4]!.y + rs[4]!.h).toBeLessThanOrEqual(60);
    expect(rs[0]!.h).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/modules/casecremental/fx/vault` → FAIL (`Cannot find module`).

- [ ] **Step 3: Implement** — `fx/vault/stackedReels.ts`:

```ts
import { Container } from "pixi.js";
import type { CaseDef, SkinDef } from "../../sim/types";
import type { Rng } from "../../sim/rng";
import type { Rect } from "../pixel/layout";
import { Reel } from "../pixel/Reel";
import type { SpriteSet } from "../pixel/sprites";
import type { ReelMotion } from "../reel/motion";
import type { SkinTextures } from "../skins/pixelSkin";

// Several reels stacked in one window (rework spec §4, §5): the vault's five, and multi-open's two.

export function stackRects(area: Rect, n: number, maxH = 24, gap = 3): Rect[] {
  const h = Math.max(8, Math.min(maxH, Math.floor((area.h - gap * (n - 1)) / n)));
  const total = n * h + gap * (n - 1);
  const y0 = area.y + Math.floor((area.h - total) / 2);
  return Array.from({ length: n }, (_, i) => ({ x: Math.round(area.x), y: y0 + i * (h + gap), w: Math.round(area.w), h }));
}

export class StackedReels extends Container {
  private readonly reels: Reel[] = [];

  constructor(
    private readonly frameSet: SpriteSet,
    private readonly skins: SkinTextures,
    private readonly onTick: (i: number) => void,
  ) {
    super();
  }

  layout(rects: Rect[]): void {
    while (this.reels.length < rects.length) {
      const i = this.reels.length;
      const r = new Reel(this.frameSet, this.skins, () => this.onTick(i));
      this.reels.push(r);
      this.addChild(r);
    }
    this.reels.forEach((r, i) => {
      const rect = rects[i];
      r.visible = !!rect;
      if (rect) r.layout(rect);
    });
  }

  start(i: number, c: CaseDef, winner: SkinDef, rng: Rng): void {
    this.reels[i]?.start(c, winner, rng);
  }

  update(i: number, motion: ReelMotion | null): void {
    this.reels[i]?.update(motion);
  }

  get count(): number {
    return this.reels.length;
  }
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/modules/casecremental/fx/vault && npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/fx/vault
git commit -m "feat(fx): stacked reels - several reels in one window (the vault's five, multi-open's two)"
```

### Task 4: Blackout and the lights coming back

**Files:** Create `fx/vault/lights.ts`, `fx/vault/lights.test.ts`; Modify `fx/hd/HdLayer.ts`, `fx/pixel/Room.ts`.

**Interfaces:**
- Produces: `interface LightLevels { room: number; lamp: number; reels: number; bin: number; leds: number }` (0–1 each); `BLACKOUT_SECONDS = 2.5`, `LIGHTS_UP_SECONDS = 4.2`; `blackoutLevel(t)` (1 → 0 eased over the blackout), `lightLevels(t)` (the power-up from black: each source flickers on at its own time — lamp ~0.5 s, reels ~1.5 s, bin ~2.3 s, leds ~2.9 s, room fully up by 4.2 s — deterministic stutters, ends at all 1); `lightCues: Array<{ at: number; sound: "light-flicker" | "light-on" }>`; `HdLayer.setLights(l: LightLevels)` (scales the lamp cone, the bin glow, the LED and adds a black veil of `1 - room` over the scene); `Room.setLight(level)` (tints the room containers toward black).

- [ ] **Step 1: Write the failing test** — `fx/vault/lights.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BLACKOUT_SECONDS, blackoutLevel, LIGHTS_UP_SECONDS, lightCues, lightLevels } from "./lights";

describe("blackout and the lights coming back", () => {
  it("fades the scene smoothly to black", () => {
    expect(blackoutLevel(0)).toBe(1);
    expect(blackoutLevel(BLACKOUT_SECONDS)).toBe(0);
    let last = 1;
    for (let t = 0; t <= BLACKOUT_SECONDS; t += 0.05) {
      const v = blackoutLevel(t);
      expect(v).toBeLessThanOrEqual(last + 1e-9);
      last = v;
    }
  });

  it("brings the lights back one by one with flickers, ending fully lit (Review Focus 4)", () => {
    const at0 = lightLevels(0);
    expect(Object.values(at0).every((v) => v === 0)).toBe(true);
    const end = lightLevels(LIGHTS_UP_SECONDS);
    expect(Object.values(end).every((v) => v === 1)).toBe(true);
    // the lamp is first, the LEDs last
    const firstOn = (key: "lamp" | "reels" | "bin" | "leds") => {
      for (let t = 0; t <= LIGHTS_UP_SECONDS; t += 0.01) if (lightLevels(t)[key] > 0.5) return t;
      return Infinity;
    };
    expect(firstOn("lamp")).toBeLessThan(firstOn("reels"));
    expect(firstOn("reels")).toBeLessThan(firstOn("bin"));
    expect(firstOn("bin")).toBeLessThan(firstOn("leds"));
    // it flickers: the lamp goes off again at least once after first coming on
    let on = false;
    let flickered = false;
    for (let t = 0; t <= LIGHTS_UP_SECONDS; t += 0.01) {
      const v = lightLevels(t).lamp;
      if (v > 0.5) on = true;
      else if (on) flickered = true;
    }
    expect(flickered).toBe(true);
    expect(lightCues.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/modules/casecremental/fx/vault/lights` → FAIL.

- [ ] **Step 3: Implement** — `fx/vault/lights.ts`:

```ts
// The end of a run and the start of the next (rework spec §4): a smooth blackout, then an old workshop
// powering back up — each light source stutters on at its own moment.

export interface LightLevels {
  room: number;
  lamp: number;
  reels: number;
  bin: number;
  leds: number;
}

export const BLACKOUT_SECONDS = 2.5;
export const LIGHTS_UP_SECONDS = 4.2;

/** 1 (lit) → 0 (black), eased. */
export function blackoutLevel(t: number): number {
  const x = Math.min(1, Math.max(0, t / BLACKOUT_SECONDS));
  return 1 - x * x * (3 - 2 * x);
}

/** A source that stutters on from `start`: off/on blips over `flicker` seconds, then steady. */
function stutter(t: number, start: number, flicker: number): number {
  if (t < start) return 0;
  if (t >= start + flicker) return 1;
  const k = (t - start) / flicker;
  const blip = Math.floor(k * 9);
  return [1, 0, 1, 1, 0, 0, 1, 0, 1][blip] ?? 1;
}

export function lightLevels(t: number): LightLevels {
  if (t >= LIGHTS_UP_SECONDS) return { room: 1, lamp: 1, reels: 1, bin: 1, leds: 1 };
  return {
    lamp: stutter(t, 0.5, 0.9),
    reels: stutter(t, 1.5, 0.6),
    bin: stutter(t, 2.3, 0.5),
    leds: stutter(t, 2.9, 0.4),
    room: Math.min(1, Math.max(0, (t - 0.5) / (LIGHTS_UP_SECONDS - 0.5))) * (t < 1.4 ? 0.4 : 1),
  };
}

/** When the power-up's sounds play. */
export const lightCues: Array<{ at: number; sound: "light-flicker" | "light-on" }> = [
  { at: 0.2, sound: "light-on" },
  { at: 0.5, sound: "light-flicker" },
  { at: 1.5, sound: "light-flicker" },
  { at: 2.3, sound: "light-on" },
  { at: 2.9, sound: "light-flicker" },
];
```

`fx/hd/HdLayer.ts` — add a full-screen black `veil` Graphics as the first child of `overlay` (under the vignette and flash; sized in `layout`), a `lights: LightLevels` field defaulting to all 1, and:

```ts
  /** The blackout and the power-up drive these (rework spec §4). */
  setLights(l: LightLevels): void {
    this.lights = l;
  }
```

In `update`, multiply `this.lamp.alpha` by `this.lights.lamp`, `this.binGlow.alpha` target by `this.lights.bin`, `this.led.alpha` by `this.lights.leds`, and set `this.veil.alpha = 1 - this.lights.room`.

`fx/pixel/Room.ts` — `setLight(level: number)`: tint `this.back` and `this.front` with a grey of `Math.round(255 * (0.15 + 0.85 * level))` per channel (`0xRRGGBB` from it), and the bot reel frame with the same factor on top of its online/offline tint.

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/modules/casecremental/fx && npm run typecheck` → PASS (typecheck may still be red in `World.ts` until Task 5 — only `World.ts` errors are acceptable here).

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/fx
git commit -m "feat(fx): a smooth blackout and the workshop's lights stuttering back on"
```

### Task 5: The vault scene

**Files:** Create `fx/vault/cues.ts`, `fx/vault/cues.test.ts`, `fx/vault/VaultScene.ts`; Modify `fx/World.ts`, `ui/GamePanel.tsx`, `ui/prestigeRules.ts` (+ test), `i18n/en.ts`, `i18n/ru.ts`; Delete `fx/finale.ts`, `fx/finale.test.ts`.

**Interfaces:**
- Consumes: `RunState.vault`, events `vaultBought`, `vaultKeyTurned`, `vaultReelLanded`, `vaultOpened` (Task 1); `AudioEngine.setTrack` (Task 2); `StackedReels`, `stackRects` (Task 3); `blackoutLevel`, `lightLevels`, `lightCues`, `HdLayer.setLights`, `Room.setLight` (Task 4); the `vault-case` and `devil-key` sprites; `KnifeFlight` for the legendary's showcase.
- Produces: `vaultCues(t)` → `{ vaultFrame: 0|1|2|3; lockSpin: boolean; beam: number (0–1); fountain: boolean; reelsIn: number (0–1) }` and `VAULT_CUE_TIMES` (`chains` 1.5 s, `burst` 2.6 s, `open` 3.4 s, `reels` 4.0 s); `class VaultScene { root; layout(screen, l, k); show(phase, t, drops, landed); keyHit(p): boolean; keyRelease(p): "turn" | "none"; update(dt) }`; string `hint.vaultkey` ("Turn the key" / "Поверни ключ"); `PRESTIGE_DELAY_MS` becomes the blackout length (`BLACKOUT_SECONDS * 1000 + 300`).

- [ ] **Step 1: Write the failing tests** — `fx/vault/cues.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { VAULT_CUE_TIMES, vaultCues } from "./cues";

describe("the vault opening's cues", () => {
  it("spins the lock, bursts, opens, then brings the reels in", () => {
    expect(vaultCues(0)).toMatchObject({ vaultFrame: 1, lockSpin: true, beam: 0, fountain: false, reelsIn: 0 });
    expect(vaultCues(VAULT_CUE_TIMES.burst + 0.1).vaultFrame).toBe(2);
    expect(vaultCues(VAULT_CUE_TIMES.open + 0.1)).toMatchObject({ vaultFrame: 3, fountain: true });
    expect(vaultCues(VAULT_CUE_TIMES.open + 0.1).beam).toBeGreaterThan(0);
    expect(vaultCues(VAULT_CUE_TIMES.reels + 1).reelsIn).toBe(1);
    expect(vaultCues(VAULT_CUE_TIMES.reels - 0.1).reelsIn).toBe(0);
  });
});
```

and in `ui/prestigeRules.test.ts` change the delay test to: `expect(prestigeDelayMs(true)).toBe(PRESTIGE_DELAY_MS); expect(PRESTIGE_DELAY_MS).toBeGreaterThanOrEqual(BLACKOUT_SECONDS * 1000);` (import `BLACKOUT_SECONDS` from `../fx/vault/lights`).

- [ ] **Step 2: Run to verify they fail** — `npx vitest run src/modules/casecremental/fx/vault src/modules/casecremental/ui` → FAIL.

- [ ] **Step 3: Implement the cues** — `fx/vault/cues.ts`:

```ts
// The vault opening's beats (rework spec §4), seconds after the key turns: the lock spins, chains snap, light
// bursts through the cracks, the lid opens with a golden column and a coin fountain, then the five reels
// come in (their landings are sim events at VAULT_LAND_TIMES).

export const VAULT_CUE_TIMES = { chains: 1.5, burst: 2.6, open: 3.4, reels: 4.0 } as const;

export interface VaultCues {
  vaultFrame: 0 | 1 | 2 | 3;
  lockSpin: boolean;
  /** The golden column's strength, 0–1. */
  beam: number;
  fountain: boolean;
  /** The reels sliding in, 0–1. */
  reelsIn: number;
}

export function vaultCues(t: number): VaultCues {
  const T = VAULT_CUE_TIMES;
  return {
    vaultFrame: t < T.burst ? 1 : t < T.open ? 2 : 3,
    lockSpin: t < T.chains,
    beam: t < T.open ? 0 : Math.min(1, (t - T.open) / 0.8),
    fountain: t >= T.open,
    reelsIn: t < T.reels ? 0 : Math.min(1, (t - T.reels) / 0.6),
  };
}
```

and `ui/prestigeRules.ts`: `PRESTIGE_DELAY_MS = Math.round(BLACKOUT_SECONDS * 1000) + 300` (import from `../fx/vault/lights`; update its comment: "the blackout plus a beat").

- [ ] **Step 4: Implement the scene** — `fx/vault/VaultScene.ts`: a class owning an HD `root` Container (added by the World above the scene, under `hd.overlay`), drawn in screen px:
  - a full-screen dark `dim` (alpha 0.75 while the vault is out);
  - the `vault` sprite: `lib.get("vault-case", { w: 64, h: 64, frames: 4 }).frames[f]`, nearest-scaled to about 40 % of the screen height, centred; during `key` it breathes (scale ±2 %) and its seams glow (an additive soft sprite behind it, pulsing red); on `vaultBought` it slams in (drops from above over 0.35 s with a bounce, `vault-slam` + `vault-rumble`, shake 0.6);
  - the `key` sprite: `lib.get("devil-key", { w: 24, h: 24, frames: 4 })`, frames cycling at 6 fps, ~1/3 of the vault's height, floating left of the vault (bobbing ±4 px), a red additive glow and ember particles (`hd.particles.burst` 2/s, colour 0xff5a1f), `devil-key-whisper` every ~6 s and `devil-key-laugh` once when the vault lands; `keyHit(p)` starts a drag when `p` is on the key; while dragged it follows the pointer; `keyRelease(p)` returns `"turn"` when released within the lock's radius (the vault's centre ± 18 % of its size) or when the drag moved < 6 px (a tap), else `"none"` and the key floats back;
  - a `hint` Text with `t("hint.vaultkey")` under the vault while the key waits;
  - during `opening` (`show("opening", t, drops, landed)`), driven by `vaultCues(t)`: the vault frame; the lock spin (the key sprite, now in the lock, rotating fast, `vault-lock-spin` once); `chain-snap` at `chains`; at `burst` a white flash (`hd.flash(0xfff3b0, 0.8)`), `light-burst`; from `open`: an additive golden `beam` (a tall gradient sprite, alpha = cues.beam), a coin fountain (`hd.coins` or `hd.particles` bursting upward from the vault's mouth every 0.1 s), `coin-fountain` once, fireworks (`firework` + a rarity-coloured burst at a random point in the upper half) every ~1.2 s; the vault shrinks to 55 % and slides down as `reelsIn` rises; `legendary-choir` at the fifth landing;
  - `update(dt)` animates the key, the glow and the particles' emitters.
  The World owns the timing (it calls `show` from the sim state each frame) and the sounds that hang off sim events.

  `fx/World.ts`:
  - remove the old finale: `fx/finale.ts` import and `updateFinale`, `finalePhase/finaleRain/finaleFlash/finaleSpin`, the locked-click sparks branch stays (it now applies to the vault and to the prestige screen);
  - create `this.vault = new VaultScene(lib, this.hd, audio)` and add `this.vault.root` to `app.stage` between `this.scene` and `this.hd.overlay`; create `this.vaultReels = new StackedReels(this.reelFrame, skins, (i) => audio.play("reel-tick", { gain: 0.3, rate: 1 + i * 0.1 }))` in the pixel world (above the bench), hidden unless the vault is opening; lay it out with `stackRects({ x: table.x + 8, y: hudH + 4, w: table.w - 16, h: table.y + 40 - hudH }, 5)` (the panels are hidden during the vault, so the reels may use the table's width);
  - each frame: `const v = run.state.vault;` → `this.vault.show(v?.phase ?? null, v?.phase === "opening" ? v.t : 0, …)`; while opening, each reel `i < 5` spins from `VAULT_CUE_TIMES.reels` until `VAULT_LAND_TIMES[i]` (motion `{ elapsed: t - VAULT_CUE_TIMES.reels, fullDuration: VAULT_LAND_TIMES[i] - VAULT_CUE_TIMES.reels, crawl: i === 4 ? 2.5 : 0.8 }`), and stays landed after;
  - music: on `vaultBought` and on restore with `vault.phase === "key"` → `audio.setTrack("vault-suspense", { loop: true })`; on `vaultKeyTurned` → `audio.setTrack("vault-fanfare", { loop: false })`; on restore mid-opening → `audio.setTrack("vault-fanfare", { loop: false, offset: v.t })`;
  - `vaultKeyTurned`: start the five vault reels (`this.vaultReels.start(i, caseById("bedrock"), skinById(d.skinId), this.rng)` for each drop — the legendary's strip is the top case's skins ending on `VAULT_LEGEND`);
  - `vaultReelLanded`: `vault-reel-land` with `rate: 1 + e.index * 0.08`, a firework burst at the reel, `this.hd.coins.floatText(at, "+" + formatCash(e.amount, getLang()))`; for `e.index === 4` also `legendary-choir`, a gold flash, and the knife's showcase on the legendary (`this.knifeFlight.start(this.skins.frames(VAULT_LEGEND)[0]!, at, k, …)` — its texture animates in the flight);
  - `vaultOpened`: start the blackout: a `blackoutT` timer from 0; each frame `this.hd.setLights({ room: b, lamp: b, reels: b, bin: b, leds: b })` and `this.room.setLight(b)` with `b = blackoutLevel(blackoutT)`; `blackout` sound; after `BLACKOUT_SECONDS` → `audio.setTrack("prestige", { loop: true })`;
  - restore with `run.state.over` (a reload on the prestige screen): lights at 0 at once, `audio.setTrack("prestige", { loop: true })`;
  - `runStarted`: start the power-up: a `lightsT` timer from 0; each frame `this.hd.setLights(lightLevels(lightsT))`, `this.room.setLight(lightLevels(lightsT).room)`, play each `lightCues` entry once as `lightsT` crosses its `at`; `run-start` at 0; at `LIGHTS_UP_SECONDS` → `audio.setTrack(null)` (the stage loop returns);
  - pointer: while `run.state.vault?.phase === "key"`, `pointerdown` goes to `this.vault.keyHit(screenPt)` first; `pointerup` → if `this.vault.keyRelease(screenPt) === "turn"` then `this.controller.act({ type: "turnVaultKey" })`; other clicks spark as before;
  - `charmPicked` → `charm-pick`; `perkBought` → `perk-buy`.
  `ui/GamePanel.tsx`: hide the HUD, both panels and the phone drawer while `view.vault.phase !== null || view.over` — wrap them in a `div` with `opacity: hidden ? 0 : 1; transition: opacity .5s; pointer-events: hidden ? "none" : …` so they fade out.
  `i18n/en.ts` / `ru.ts`: `"hint.vaultkey": "Turn the key"` / `"Поверни ключ"`.
  Delete `fx/finale.ts` and `fx/finale.test.ts`.

- [ ] **Step 5: Run every check**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: all PASS.

- [ ] **Step 6: Browser check** — dev board: +$100K ×4 and UNLOCK ALL; buy the vault: every panel and the HUD fade away, the vault slams into the centre with a rumble, the devil key floats beside it whispering, the suspense loop plays; click elsewhere → sparks only; drag the key into the lock → the lock spins, chains snap, light bursts, the lid opens with a golden column and coins, the fanfare plays, five reels land one by one (rising sounds, fireworks, +$ texts), the fifth the animated legendary with its showcase; ~24 s after the turn, a smooth blackout; the prestige screen over black with its music. Reload while the key waits → back to the key; reload mid-opening → resumes. START NEXT RUN → the lights stutter back on one by one with flickers and breaker sounds, then the stage music. RU: the key hint fits.

- [ ] **Step 7: Commit**

```bash
git add -A src/modules/casecremental
git commit -m "feat(fx): the vault takes the screen - the devil key, a legendary-chest opening, blackout, lights back on"
```

### Task 6: Play it through, record it

**Files:** Modify `docs/feature-history/casecremental-run1.md`.

- [ ] **Step 1: Play it** — the browser check of Task 5 end to end in EN and RU, plus a lobby trip during the key wait and during the prestige screen. No console errors.

- [ ] **Step 2: Update the feature history** — replace the "The finale is a cinematic" bullet with:

```markdown
- **The vault is a last-chance ticket** (user, after the first finale felt "down to earth"): buying it takes
  the screen (UI hidden), the player turns a devilish key by hand, the vault opens like a legendary chest
  (fanfare, golden column, coins, fireworks, five reels landing on the fanfare's beats — the fifth is Vault I's
  own animated ★, "Event Horizon"), then a smooth blackout, the prestige screen over black with its own music,
  and the next run's lights stutter back on. The opening is a fixed sim timeline, so a reload resumes it.
```

- [ ] **Step 3: Run every check and commit**

Run: `npx vitest run && npm run typecheck && npm run build` → all PASS.

```bash
git add docs/feature-history
git commit -m "docs(feature-history): the vault as a last-chance ticket"
```
