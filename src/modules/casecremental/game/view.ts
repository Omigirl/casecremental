import { SELLER_SPEED_LEVELS, sellerSpeedCost } from "../sim/autoSeller";
import { botSpeed, botSpeedCost } from "../sim/botOpener";
import type { CharmId } from "../sim/charms";
import { CASES, unlockCostOf } from "../sim/content/cases";
import { STAGE_NAMES } from "../sim/intensity";
import { charmSlots, freshMeta, PERK_IDS, perkCost, type MetaState, type PerkId } from "../sim/meta";
import type { Bench, Run } from "../sim/run";
import { BOT_WAKE_COST, DAY_JOB_SECONDS, PERK_COSTS, SELLER_COST, UPGRADE_COSTS, VAULT_OPENING_SECONDS } from "../sim/tuning";
import type { Drop, RarityId } from "../sim/types";
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
  /** Cases this BUY opens (multi-open, as many as you can afford). */
  count: number;
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
  seller: SellerView;
  tray: { items: TrayItemView[]; capacity: number };
  dayJob: { available: boolean; working: boolean; progress: number };
  vault: { shown: boolean; price: number; canBuy: boolean; phase: "key" | "opening" | null; progress: number };
  /** The vault opening's progress 0–1, or null. */
  opening: number | null;
  over: boolean;
  prestige: PrestigeView | null;
}

export function buildView(run: Run, meta: MetaState = freshMeta()): GameView {
  const s = run.state;
  const benchFree = s.bench.phase === "empty";
  const open = !run.locked();
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
      count: run.openCount(c.id),
      canBuy: open && unlocked && benchFree && s.cash >= run.casePrice(c.id),
      canUnlock: open && !unlocked && previousUnlocked && s.cash >= unlockCostOf(c.id),
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
      canBuy: open && cost !== null && s.cash >= cost,
    };
  });
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
  const tray = {
    items: s.tray.map(item),
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
    phase: s.vault?.phase ?? null,
    progress: s.vault?.phase === "opening" ? Math.min(1, s.vault.t / VAULT_OPENING_SECONDS) : 0,
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
    seller,
    tray,
    dayJob,
    vault,
    opening: s.vault?.phase === "opening" ? Math.min(1, s.vault.t / VAULT_OPENING_SECONDS) : null,
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
