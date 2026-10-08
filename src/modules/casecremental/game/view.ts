import { botSpeed, botSpeedCost, type BotStep } from "../sim/botSeller";
import type { CharmId } from "../sim/charms";
import { CASES, unlockCostOf } from "../sim/content/cases";
import { STAGE_NAMES } from "../sim/intensity";
import { charmSlots, freshMeta, PERK_IDS, perkCost, type MetaState, type PerkId } from "../sim/meta";
import type { Bench, Run } from "../sim/run";
import { BOT_WAKE_COST, DAY_JOB_SECONDS, FINALE_SECONDS, PERK_COSTS, UPGRADE_COSTS } from "../sim/tuning";
import type { RarityId } from "../sim/types";
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

export interface GameView {
  cash: number;
  combo: number;
  comboMult: number;
  stage: number;
  stageName: string;
  phase: Bench["phase"];
  cases: CaseView[];
  upgrades: UpgradeView[];
  nextGoal:
    | { kind: "unlock"; caseId: string; progress: number }
    | { kind: "upgrade"; upgradeId: UpgradeId; level: number; progress: number }
    | { kind: "vault"; progress: number }
    | null;
  bot: BotView;
  tray: { items: TrayItemView[]; capacity: number };
  dayJob: { available: boolean; working: boolean; progress: number };
  vault: { shown: boolean; price: number; canBuy: boolean };
  /** Finale progress 0–1, or null. */
  finale: number | null;
  over: boolean;
  prestige: PrestigeView | null;
}

export function buildView(run: Run, meta: MetaState = freshMeta()): GameView {
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
      price: run.casePrice(c.id),
      unlocked,
      unlockCost: unlockCostOf(c.id),
      canBuy: unlocked && benchFree && s.cash >= run.casePrice(c.id),
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
  const vault = {
    shown: run.vaultShown(),
    price: run.setup.vaultPrice,
    canBuy: run.vaultShown() && benchFree && s.cash >= run.setup.vaultPrice && !run.locked(),
  };
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
  return {
    cash: s.cash,
    combo: s.combo,
    comboMult: run.comboMultiplier(),
    stage: s.stage,
    stageName: STAGE_NAMES[s.stage - 1] ?? "",
    phase: s.bench.phase,
    cases,
    upgrades,
    nextGoal: nextGoal(s.cash, cases, upgrades, vault),
    bot,
    tray,
    dayJob,
    vault,
    finale: s.finale === null ? null : Math.min(1, s.finale / FINALE_SECONDS),
    over: s.over,
    prestige,
  };
}

/** A goal is always on screen (spec §9.2): the next case to unlock, else the vault (M2b spec §7), else the cheapest upgrade left. */
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
