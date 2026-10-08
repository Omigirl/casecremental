import { botSpeedCost } from "./botSeller";
import { CASES, unlockCostOf } from "./content/cases";
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
