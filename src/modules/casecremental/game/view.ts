import { autoSpinCase } from "../sim/autoSpin";
import { capRaisedLater, runNumber } from "../sim/campaign";
import type { CharmId } from "../sim/charms";
import { caseById, unlockCostOf } from "../sim/content/cases";
import { vaultFor, type VaultDef } from "../sim/content/vaults";
import { STAGE_NAMES } from "../sim/intensity";
import { charmSlots, freshMeta, PERK_IDS, perkCost, type MetaState, type PerkId } from "../sim/meta";
import type { Bench, CardSpot, Run } from "../sim/run";
import { DAY_JOB_SECONDS, LAST_RUN, PERK_COSTS, VAULT_OPENING_SECONDS } from "../sim/tuning";
import { UPGRADE_IDS, UPGRADE_INFO, upgradeCap, upgradeCost, type UpgradeId } from "../sim/upgrades";
import {
  autoSpinView,
  botView,
  lockerView,
  sellerView,
  trayItem,
  type AutoSpinView,
  type BotView,
  type LockerView,
  type SellerView,
  type TrayItemView,
} from "./viewMachines";

export type { AutoSpinView, BotView, LockerView, SellerView, TrayItemView } from "./viewMachines";

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
  /** Auto-spin buys this one: the case you bought last or picked on the shelf. */
  picked: boolean;
  /** Auto-spin would buy this one now: the pick when affordable, else the dearest it can afford. */
  buys: boolean;
}

export interface UpgradeView {
  id: UpgradeId;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  cost: number | null;
  /** At this run's cap, but a later run lifts it: the UI says NEXT RUN, not MAX. */
  nextRun: boolean;
  canBuy: boolean;
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
  /** The run that starts next. */
  nextRun: number;
  /** The next run repeats the last one. */
  replay: boolean;
  perks: PerkView[];
  offer: CharmId[];
  picked: CharmId[];
  slots: number;
}

export interface GameView {
  /** The campaign run this is. */
  run: number;
  cash: number;
  combo: number;
  comboMult: number;
  stage: number;
  stageName: string;
  phase: Bench["phase"];
  /** The card the player holds (picked up to drag), or null. */
  held: CardSpot | null;
  /** Your bench's card slots while revealed: true = a card waits there. [] otherwise. */
  benchCards: boolean[];
  cases: CaseView[];
  upgrades: UpgradeView[];
  nextGoal:
    | { kind: "unlock"; caseId: string; progress: number }
    | { kind: "upgrade"; upgradeId: UpgradeId; level: number; progress: number }
    | { kind: "vault"; progress: number }
    | null;
  bot: BotView;
  seller: SellerView;
  autoSpin: AutoSpinView;
  locker: LockerView;
  tray: { items: TrayItemView[]; capacity: number };
  dayJob: { available: boolean; working: boolean; progress: number };
  vault: {
    id: VaultDef["id"];
    shown: boolean;
    price: number;
    canBuy: boolean;
    /** Why an affordable vault can't be bought yet: a card is waiting on the bench. */
    blockedBy: "bench" | null;
    phase: "key" | "opening" | null;
    /** The opening's progress 0–1 (0 before the key turns). */
    progress: number;
  };
  over: boolean;
  prestige: PrestigeView | null;
}

export function buildView(run: Run, meta: MetaState = freshMeta()): GameView {
  const s = run.state;
  const benchFree = s.bench.phase === "empty";
  const open = !run.locked();
  const r = run.setup.run;
  const buys = autoSpinCase(run);
  const cases = run.runCases().map((id, i, ids): CaseView => {
    const c = caseById(id);
    const unlocked = s.unlocked.includes(c.id);
    const previousUnlocked = i === 0 || s.unlocked.includes(ids[i - 1]!);
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
      picked: s.autoSpin.pick === c.id,
      buys: s.autoSpin.owned && s.autoSpin.on && buys === c.id,
    };
  });
  const upgrades = UPGRADE_IDS.map((id): UpgradeView => {
    const cost = upgradeCost(id, s.upgrades[id], r);
    return {
      id,
      ...UPGRADE_INFO[id],
      level: s.upgrades[id],
      maxLevel: upgradeCap(id, r),
      cost,
      nextRun: cost === null && capRaisedLater((x) => upgradeCap(id, x), s.upgrades[id], r),
      canBuy: open && cost !== null && s.cash >= cost,
    };
  });
  const tray = {
    items: s.tray.map((d) => trayItem(run, d)),
    capacity: run.setup.trayCapacity,
  };
  const dayJob = {
    available: run.dayJobAvailable() && !run.locked(),
    working: s.dayJob !== null,
    progress: s.dayJob === null ? 0 : Math.min(1, s.dayJob / DAY_JOB_SECONDS),
  };
  const vaultShown = run.vaultShown();
  const vaultAffordable = vaultShown && s.cash >= run.setup.vaultPrice && !run.locked();
  const vault: GameView["vault"] = {
    id: vaultFor(r).id,
    shown: vaultShown,
    price: run.setup.vaultPrice,
    canBuy: vaultAffordable && benchFree,
    blockedBy: vaultAffordable && !benchFree ? "bench" : null,
    phase: s.vault?.phase ?? null,
    progress: s.vault?.phase === "opening" ? Math.min(1, s.vault.t / VAULT_OPENING_SECONDS) : 0,
  };
  const prestige: PrestigeView | null = s.over
    ? {
        clout: meta.clout,
        gained: meta.lastGain,
        loops: meta.loops,
        nextRun: runNumber(meta.loops),
        replay: meta.loops >= LAST_RUN,
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
    run: r,
    cash: s.cash,
    combo: s.combo,
    comboMult: run.comboMultiplier(),
    stage: s.stage,
    stageName: STAGE_NAMES[s.stage - 1] ?? "",
    phase: s.bench.phase,
    held: s.held,
    benchCards: s.bench.phase === "revealed" ? s.bench.cards.map((c) => c !== null) : [],
    cases,
    upgrades,
    nextGoal: nextGoal(s.cash, cases, upgrades, vault),
    bot: botView(run),
    seller: sellerView(run),
    autoSpin: autoSpinView(run),
    locker: lockerView(run),
    tray,
    dayJob,
    vault,
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
