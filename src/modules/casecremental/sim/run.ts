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
