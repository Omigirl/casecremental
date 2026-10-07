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
