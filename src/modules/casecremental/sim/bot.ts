import { sellerSpeedCost } from "./autoSeller";
import { autoSpinDelayCost } from "./autoSpin";
import { botSpeedCost, botWaiting } from "./botOpener";
import { runCaseIds, runContent } from "./campaign";
import { unlockCostOf } from "./content/cases";
import { VAULTS } from "./content/vaults";
import { lockerSizeCost, lockerWaiting, tradeUpRarity } from "./locker";
import { buyPerk, completeVault, freshMeta, PERK_IDS, perkCost, setupFor } from "./meta";
import { DEFAULT_SETUP, Run, type ActionResult, type RunSetup, type SimEvent } from "./run";
import { AUTO_CONTRACT_COST, AUTOSPIN_COST, BOT_MULTI_COST, BOT_WAKE_COST, LAST_RUN, LOCKER_COST, SELLER_COST } from "./tuning";
import { UPGRADE_IDS, upgradeCost } from "./upgrades";

// A greedy player at human speed, used by the pacing test to check how fast a run unfolds. It claims tray items as
// soon as it can, sells what lands on the bench, the bot's station and the locker, presses a trade-up when one is
// ready, unlocks the next case as soon as it can afford it plus one case, then — each when it has twice the price —
// wakes the bot, buys the auto-seller, then auto-spin (switched on: from then on it leaves the bench to the machine,
// picks each new case for it and shops whenever free), the locker (Run 2+, collecting Mil-Specs) and the bot's
// multi-open. It buys the cheapest remaining upgrade (bot and seller Speed, auto-spin's Delay, locker size, the auto
// contract included) when it costs at most a quarter of its cash, takes the day job when broke with the bench empty
// (auto-spin on or not), and buys the vault as soon as it can.
// Two timing profiles (finish spec §5): HUMAN is the GREEDY player, a perfect one who never pauses; CASUAL has a real
// player's slower hands and looks at the shop every 8 s (a due look comes before selling, and buys everything the
// quarter-of-cash rule allows, one row after another), never holding back the vault. `playCampaign` chains the runs
// and `playToFull` measures the 90 s rule's income.

export interface BotTimings {
  buy: number;
  key: number;
  sell: number;
  /** Seeing the card land before reaching for it. */
  reveal: number;
  /** Seconds between looks at the shop (unlocks, machines, upgrades); 0 = at every free moment. */
  shopEvery: number;
}

/** The GREEDY profile: a perfect player who never pauses (the pacing player of M1–M3). */
export const HUMAN: BotTimings = { buy: 0.3, key: 0.4, sell: 0.5, reveal: 0.25, shopEvery: 0 };
/** The CASUAL profile (finish spec §5): a real player's slower hands, and a look at the shop only every 8 s. It runs
 *  auto-spin once owned, like GREEDY. */
export const CASUAL: BotTimings = { buy: 0.8, key: 0.8, sell: 1.2, reveal: 0.8, shopEvery: 8 };

/** How long a pacing run plays at most (s). */
export const RUN_SECONDS = 900;
/** The 90 s rule's income window (s) after a run is fully bought: long enough that one knife doesn't decide it. */
export const INCOME_WINDOW = 60;
/** How long playToFull plays at most to get a run fully bought (s). */
export const PROBE_SECONDS = 3600;

export interface PlayOptions {
  /** Stop once the full-income window is measured (playToFull). */
  untilIncome?: boolean;
  /** Sees every sim event with its sim time (the shop-cadence test). */
  onEvent?: (e: SimEvent, time: number) => void;
  /** Sees every look at the shop with its sim time (the shop-cadence tests). */
  onLook?: (time: number) => void;
}

export interface PacingReport {
  caseUnlockedAt: Record<string, number>;
  stageReachedAt: Record<number, number>;
  botAwakeAt?: number;
  /** When the auto-seller was bought. */
  sellerAt?: number;
  /** When auto-spin was bought and switched on. */
  autoSpinAt?: number;
  allUnlockedAt?: number;
  /** When the last case of run N's shelf was unlocked (runCasesAt[1] = Bedrock). */
  runCasesAt: Record<number, number>;
  /** When the locker (Run 2+) was bought. */
  lockerAt?: number;
  vaultAt?: number;
  /** The highest stage reached before the vault (which holds the top stage by itself). */
  topStage: number;
  /** Trade-up contracts pressed (by hand or by the auto contract). */
  contracts: number;
  /** Longest stretch (s) the claim tray stayed full. */
  longestTrayFull: number;
  lifetimeEarnings: number;
  finalCash: number;
  /** When every case, upgrade and machine of the run was first bought, each at its run's cap (fullyBought). */
  fullAt?: number;
  /** Net cash per second over the INCOME_WINDOW after fullAt: the 90 s rule's income. Left out when a vault was bought
   *  inside the window (only playToFull, whose vault is out of reach, is sure to measure it). */
  fullIncome?: number;
  /** The run's vault price (playToFull reports the real one, not its out-of-reach stand-in). */
  vaultPrice: number;
  /** Sim seconds played. */
  endedAt: number;
}

const DT = 1 / 30;

export function playGreedy(
  seed: number,
  seconds: number,
  timings: BotTimings = HUMAN,
  setup: RunSetup = DEFAULT_SETUP,
  opts: PlayOptions = {},
): PacingReport {
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
    vaultPrice: setup.vaultPrice,
    endedAt: 0,
  };
  if (setup.botAwake) report.botAwakeAt = 0;
  let busyUntil = 0;
  let nextShop = 0;
  let fullCash = 0;
  /** A look at the shop when one is due (CASUAL every shopEvery s, GREEDY at every free moment); the vault is never
   *  part of it (Review Focus 3). */
  const shop = () => {
    if (run.state.time < nextShop) return;
    nextShop = run.state.time + timings.shopEvery;
    opts.onLook?.(run.state.time);
    // GREEDY buys one thing per free moment; a CASUAL look buys everything it can afford, as a player glancing at the
    // shop clicks several rows
    while (spend(run) && timings.shopEvery > 0);
    if (report.fullAt === undefined && fullyBought(run)) {
      report.fullAt = run.state.time;
      fullCash = run.state.cash;
    }
  };
  let fullFor = 0;

  while (run.state.time < seconds && !run.state.over && !(opts.untilIncome && report.fullIncome !== undefined)) {
    if (run.state.vault?.phase === "key") run.turnVaultKey();
    run.tick(DT);
    const s = run.state;
    for (const e of run.drainEvents()) {
      opts.onEvent?.(e, s.time);
      if (e.type === "caseUnlocked") {
        report.caseUnlockedAt[e.caseId] ??= s.time;
        run.setAutoSpinCase(e.caseId); // a player picks the new case for auto-spin
        if (run.vaultShown()) report.allUnlockedAt ??= s.time;
        for (let n = 1; n <= LAST_RUN; n++) if (runCaseIds(n).every((id) => s.unlocked.includes(id))) report.runCasesAt[n] ??= s.time;
      }
      if (e.type === "autoSpinToggled" && e.on) report.autoSpinAt ??= s.time;
      if (e.type === "stageChanged") {
        report.stageReachedAt[e.stage] ??= s.time;
        if (s.vault === null) report.topStage = Math.max(report.topStage, e.stage);
      }
      if (e.type === "revealed") busyUntil = Math.max(busyUntil, s.time + timings.reveal);
      if (e.type === "botWoke") report.botAwakeAt ??= s.time;
      if (e.type === "sellerBought") report.sellerAt ??= s.time;
      if (e.type === "lockerBought") report.lockerAt ??= s.time;
      if (e.type === "pressStarted") report.contracts++;
      if (e.type === "vaultBought") report.vaultAt ??= s.time;
    }
    fullFor = s.tray.length >= setup.trayCapacity ? fullFor + DT : 0;
    report.longestTrayFull = Math.max(report.longestTrayFull, fullFor);
    const since = report.fullAt === undefined ? null : s.time - report.fullAt;
    if (since !== null && since >= INCOME_WINDOW && report.fullIncome === undefined && report.vaultAt === undefined)
      report.fullIncome = (s.cash - fullCash) / INCOME_WINDOW;
    if (s.time < busyUntil || run.locked()) continue;
    const b = s.bench;
    if (b.phase === "empty" && run.buyVault().ok) continue; // the vault as soon as it can
    if (timings.shopEvery > 0 && s.time >= nextShop) {
      // a due look comes before selling (finish spec §5: "every 8 s"), else a fast bot's waiting cards keep CASUAL's
      // 1.2 s hands selling forever and the shop never gets its look
      shop();
      busyUntil = s.time + timings.buy;
      continue;
    }

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
    } else if (s.autoSpin.on) {
      shop(); // the bench is the machine's: shop whenever free
      run.startDayJob(); // broke with the bench empty: the day job, as without auto-spin (finish spec §3)
      busyUntil = s.time + timings.buy;
    } else if (b.phase === "locked") {
      run.insertKey();
      busyUntil = s.time + timings.key;
    } else if (b.phase === "empty") {
      shop();
      const target = [...s.unlocked].reverse().find((id) => run.casePrice(id) <= s.cash);
      if (target && run.buyCase(target).ok) busyUntil = s.time + timings.buy;
      else if (run.startDayJob().ok) busyUntil = s.time + timings.buy;
    }
  }
  report.lifetimeEarnings = run.state.lifetimeEarnings;
  report.finalCash = run.state.cash;
  report.endedAt = run.state.time;
  return report;
}

interface Purchase {
  buy: () => ActionResult;
  cost: number;
}

/** One purchase, the first that applies; false when nothing was bought. */
function spend(run: Run): boolean {
  const s = run.state;
  const content = runContent(run.setup.run);
  const nextId = run.runCases().find((id) => !s.unlocked.includes(id));
  if (nextId && s.cash >= unlockCostOf(nextId) + run.casePrice(nextId)) return run.unlockCase(nextId).ok;
  if (!s.bot.awake && s.cash >= BOT_WAKE_COST * 2) return run.wakeBot().ok;
  if (s.bot.awake && !s.seller.on && s.cash >= SELLER_COST * 2) return run.buySeller().ok;
  if (s.seller.on && !s.autoSpin.owned && s.cash >= AUTOSPIN_COST * 2) {
    if (!run.buyAutoSpin().ok) return false;
    run.setAutoSpin(true);
    return true;
  }
  if (content.locker && !s.locker.on && s.cash >= LOCKER_COST * 2) {
    if (!run.buyLocker().ok) return false;
    run.setCollect("milspec");
    return true;
  }
  if (s.bot.awake && s.bot.multiLevel === 0 && content.botMultiOpen > 1 && s.cash >= BOT_MULTI_COST * 2) return run.buyBotMulti().ok;
  const options: Purchase[] = [];
  const offer = (cost: number | null, buy: () => ActionResult) => {
    if (cost !== null) options.push({ buy, cost });
  };
  for (const id of UPGRADE_IDS) offer(upgradeCost(id, s.upgrades[id], run.setup.run), () => run.buyUpgrade(id));
  if (s.bot.awake) offer(botSpeedCost(s.bot.speedLevel, run.setup.run), () => run.buyBotSpeed());
  if (s.autoSpin.owned) offer(autoSpinDelayCost(s.autoSpin.delayLevel), () => run.buyAutoSpinDelay());
  if (s.seller.on) offer(sellerSpeedCost(s.seller.speedLevel), () => run.buySellerSpeed());
  if (s.locker.on) offer(lockerSizeCost(s.locker.sizeLevel), () => run.buyLockerSize());
  if (s.locker.on && content.autoContract && !s.locker.auto) offer(AUTO_CONTRACT_COST, () => run.buyAutoContract());
  const cheapest = options.reduce<Purchase | null>((best, o) => (best === null || o.cost < best.cost ? o : best), null);
  return cheapest !== null && cheapest.cost <= s.cash * 0.25 && cheapest.buy().ok;
}

/** Every case of the shelf unlocked and every upgrade and machine at this run's cap (finish spec §5's "every case and
 *  upgrade of a run is bought"; the Machines rows are upgrades too). The vault is not counted; F6-A adds the
 *  Upgrader; evolutions never count, since a recipe may never complete. */
export function fullyBought(run: Run): boolean {
  const s = run.state;
  const n = run.setup.run;
  const content = runContent(n);
  return (
    run.vaultShown() &&
    UPGRADE_IDS.every((id) => upgradeCost(id, s.upgrades[id], n) === null) &&
    s.bot.awake &&
    botSpeedCost(s.bot.speedLevel, n) === null &&
    (content.botMultiOpen <= 1 || s.bot.multiLevel > 0) &&
    s.seller.on &&
    sellerSpeedCost(s.seller.speedLevel) === null &&
    s.autoSpin.owned &&
    autoSpinDelayCost(s.autoSpin.delayLevel) === null &&
    (!content.locker || (s.locker.on && lockerSizeCost(s.locker.sizeLevel) === null)) &&
    (!content.autoContract || s.locker.auto)
  );
}

/** The 90 s rule's measure (finish spec §5): the same seed and setup with the vault out of reach, played until every
 *  case, upgrade and machine is bought and then INCOME_WINDOW seconds more. An unaffordable vault changes no
 *  decision, so this is the real run up to its vault, carried on. `fullIncome` is the run's net income once there is
 *  nothing left to buy; `vaultPrice` is the real price. */
export function playToFull(seed: number, timings: BotTimings, setup: RunSetup, seconds = PROBE_SECONDS): PacingReport {
  const report = playGreedy(seed, seconds, timings, { ...setup, vaultPrice: Number.POSITIVE_INFINITY }, { untilIncome: true });
  report.vaultPrice = setup.vaultPrice;
  return report;
}

/** One run of a campaign the pacing player played: its seed and setup (to probe it again) and what happened. */
export interface Leg {
  run: number;
  seed: number;
  setup: RunSetup;
  report: PacingReport;
}

/** Run 1, then the next run after each vault (in VAULTS order, so F6-A's Run 4 joins by itself), the last one a replay
 *  of LAST_RUN; the cheapest perk is bought after each vault. legs[0] is Run 1, legs[n - 1] Run n, the last leg the
 *  replay. */
export function playCampaign(seed: number, timings: BotTimings = HUMAN, seconds = RUN_SECONDS): Leg[] {
  const meta = freshMeta();
  const legs: Leg[] = [{ run: 1, seed, setup: DEFAULT_SETUP, report: playGreedy(seed, seconds, timings) }];
  for (const v of VAULTS) {
    completeVault(meta, legs.at(-1)!.report.lifetimeEarnings, v.trophy, seed);
    const cheapest = [...PERK_IDS].sort((a, b) => (perkCost(a, meta.perks[a]) ?? Infinity) - (perkCost(b, meta.perks[b]) ?? Infinity))[0]!;
    buyPerk(meta, cheapest);
    const setup = setupFor(meta);
    const legSeed = seed + 100 * meta.loops; // the seeds the M3 chain used, so medians stay comparable
    legs.push({ run: setup.run, seed: legSeed, setup, report: playGreedy(legSeed, seconds, timings, setup) });
  }
  return legs;
}
