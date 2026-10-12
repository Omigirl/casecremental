import { sellerSpeedCost } from "./autoSeller";
import { botSpeedCost, botWaiting } from "./botOpener";
import { runCaseIds, runContent } from "./campaign";
import { unlockCostOf } from "./content/cases";
import { gridRateCost, gridSizeCost } from "./grid";
import { lockerSizeCost, lockerWaiting, tradeUpRarity } from "./locker";
import { DEFAULT_SETUP, Run, type RunSetup } from "./run";
import { AUTO_CONTRACT_COST, BOT_MULTI_COST, BOT_WAKE_COST, GRID_COST, LAST_RUN, LOCKER_COST, SELLER_COST } from "./tuning";
import { UPGRADE_IDS, upgradeCost } from "./upgrades";

// A greedy player at human speed, used by the pacing test to check how fast a run unfolds. It claims tray
// items as soon as it can, sells what lands on the bench, the bot's station and the locker, presses a trade-up
// when one is ready, unlocks the next case as soon as it can afford it plus one case, then — each when it has
// twice the price — wakes the bot, buys the auto-seller, the locker (Run 2+, collecting Mil-Specs), the bot's
// multi-open and the grid (Run 3+, every unlocked case ticked); it buys the cheapest remaining upgrade (bot and
// seller Speed, locker size, grid rate and size, the auto contract included) when it costs at most a quarter of
// its cash, takes the day job when broke, and buys the vault as soon as it can.

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
  /** When the auto-seller was bought. */
  sellerAt?: number;
  allUnlockedAt?: number;
  /** When the last case of run N's shelf was unlocked (runCasesAt[1] = Bedrock). */
  runCasesAt: Record<number, number>;
  /** When the locker (Run 2+) was bought. */
  lockerAt?: number;
  /** When the grid (Run 3+) was bought. */
  gridAt?: number;
  vaultAt?: number;
  /** The highest stage reached before the vault (which holds the top stage by itself). */
  topStage: number;
  /** Trade-up contracts pressed (by hand or by the auto contract). */
  contracts: number;
  /** Longest stretch (s) the claim tray stayed full. */
  longestTrayFull: number;
  lifetimeEarnings: number;
  finalCash: number;
}

const DT = 1 / 30;

export function playGreedy(seed: number, seconds: number, timings: BotTimings = HUMAN, setup: RunSetup = DEFAULT_SETUP): PacingReport {
  const run = new Run(seed, setup);
  const report: PacingReport = {
    caseUnlockedAt: {},
    stageReachedAt: {},
    runCasesAt: {},
    topStage: 1,
    contracts: 0,
    longestTrayFull: 0,
    lifetimeEarnings: 0,
    finalCash: 0,
  };
  if (setup.botAwake) report.botAwakeAt = 0;
  let busyUntil = 0;
  let fullFor = 0;

  while (run.state.time < seconds && !run.state.over) {
    if (run.state.vault?.phase === "key") run.turnVaultKey();
    run.tick(DT);
    const s = run.state;
    for (const e of run.drainEvents()) {
      if (e.type === "caseUnlocked") {
        report.caseUnlockedAt[e.caseId] ??= s.time;
        if (run.vaultShown()) report.allUnlockedAt ??= s.time;
        for (let n = 1; n <= LAST_RUN; n++) if (runCaseIds(n).every((id) => s.unlocked.includes(id))) report.runCasesAt[n] ??= s.time;
        if (s.grid.on && !s.grid.ticks.includes(e.caseId)) run.toggleGridTick(e.caseId);
      }
      if (e.type === "stageChanged") {
        report.stageReachedAt[e.stage] ??= s.time;
        if (s.vault === null) report.topStage = Math.max(report.topStage, e.stage);
      }
      if (e.type === "revealed") busyUntil = Math.max(busyUntil, s.time + timings.reveal);
      if (e.type === "botWoke") report.botAwakeAt ??= s.time;
      if (e.type === "sellerBought") report.sellerAt ??= s.time;
      if (e.type === "lockerBought") report.lockerAt ??= s.time;
      if (e.type === "gridBought") report.gridAt ??= s.time;
      if (e.type === "pressStarted") report.contracts++;
      if (e.type === "vaultBought") report.vaultAt ??= s.time;
    }
    fullFor = s.tray.length >= setup.trayCapacity ? fullFor + DT : 0;
    report.longestTrayFull = Math.max(report.longestTrayFull, fullFor);
    if (s.time < busyUntil || run.locked()) continue;
    const b = s.bench;
    if (b.phase === "empty" && run.buyVault().ok) continue; // the vault as soon as it can

    if (s.tray.length > 0) {
      run.claim(0);
      busyUntil = s.time + timings.sell;
    } else if (botWaiting(s.bot)) {
      run.sellBotCard(s.bot.cards.findIndex((d) => d !== null));
      busyUntil = s.time + timings.sell;
    } else if (lockerWaiting(s.locker)) {
      run.sellLockerCard();
      busyUntil = s.time + timings.sell;
    } else if (b.phase === "revealed") {
      run.sell(b.cards.findIndex((d) => d !== null));
      busyUntil = s.time + timings.sell;
    } else if (s.locker.on && tradeUpRarity(s.locker.items) && run.tradeUp().ok) {
      busyUntil = s.time + timings.sell;
    } else if (b.phase === "locked") {
      run.insertKey();
      busyUntil = s.time + timings.key;
    } else if (b.phase === "empty") {
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

interface Purchase {
  buy: () => void;
  cost: number;
}

function spend(run: Run): void {
  const s = run.state;
  const content = runContent(run.setup.run);
  const nextId = run.runCases().find((id) => !s.unlocked.includes(id));
  if (nextId && s.cash >= unlockCostOf(nextId) + run.casePrice(nextId)) {
    run.unlockCase(nextId);
    return;
  }
  if (!s.bot.awake && s.cash >= BOT_WAKE_COST * 2) {
    run.wakeBot();
    return;
  }
  if (s.bot.awake && !s.seller.on && s.cash >= SELLER_COST * 2) {
    run.buySeller();
    return;
  }
  if (content.locker && !s.locker.on && s.cash >= LOCKER_COST * 2) {
    run.buyLocker();
    run.setCollect("milspec");
    return;
  }
  if (s.bot.awake && s.bot.multiLevel === 0 && content.botMultiOpen > 1 && s.cash >= BOT_MULTI_COST * 2) {
    run.buyBotMulti();
    return;
  }
  if (content.grid && s.seller.on && !s.grid.on && s.cash >= GRID_COST * 2) {
    run.buyGrid();
    for (const id of run.runCases()) if (s.unlocked.includes(id)) run.toggleGridTick(id);
    return;
  }
  const options: Purchase[] = [];
  const offer = (cost: number | null, buy: () => void) => {
    if (cost !== null) options.push({ buy, cost });
  };
  for (const id of UPGRADE_IDS) offer(upgradeCost(id, s.upgrades[id], run.setup.run), () => run.buyUpgrade(id));
  if (s.bot.awake) offer(botSpeedCost(s.bot.speedLevel, run.setup.run), () => run.buyBotSpeed());
  if (s.seller.on) offer(sellerSpeedCost(s.seller.speedLevel), () => run.buySellerSpeed());
  if (s.locker.on) offer(lockerSizeCost(s.locker.sizeLevel), () => run.buyLockerSize());
  if (s.locker.on && content.autoContract && !s.locker.auto) offer(AUTO_CONTRACT_COST, () => run.buyAutoContract());
  if (s.grid.on) offer(gridRateCost(s.grid.rateLevel), () => run.buyGridRate());
  if (s.grid.on) offer(gridSizeCost(s.grid.sizeLevel), () => run.buyGridSize());
  const cheapest = options.reduce<Purchase | null>((best, o) => (best === null || o.cost < best.cost ? o : best), null);
  if (cheapest && cheapest.cost <= s.cash * 0.25) cheapest.buy();
}
