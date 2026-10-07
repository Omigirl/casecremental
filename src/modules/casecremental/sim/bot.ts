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
