import { AUTOSPIN_DELAY_LEVELS, autoSpinDelay, autoSpinDelayCost, autoSpinStatus, type AutoSpinStatus } from "../sim/autoSpin";
import { SELLER_SPEED_LEVELS, sellerSpeedCost } from "../sim/autoSeller";
import { botSpeed, botSpeedCost, botSpeedLevels } from "../sim/botOpener";
import { capRaisedLater, runContent } from "../sim/campaign";
import { lockerCapacity, lockerCounts, lockerSizeCost, lockerWaiting, tradeUpRarity } from "../sim/locker";
import type { Run } from "../sim/run";
import {
  AUTO_CONTRACT_COST,
  AUTOSPIN_COST,
  BOT_MULTI_COST,
  BOT_WAKE_COST,
  LOCKER_COST,
  SELLER_COST,
  TRADE_UP_SECONDS,
} from "../sim/tuning";
import type { Drop, RarityId } from "../sim/types";

// The machines' part of the view (the bot, the auto-seller, the auto-spin, the locker) — derived from the
// run, never stored separately. buildView (view.ts) puts them in the GameView.

export interface TrayItemView {
  skinId: string;
  rarity: RarityId;
  /** What it pays sold by hand right now, before combo. */
  value: number;
}

export interface AutoSpinView {
  owned: boolean;
  cost: number;
  canBuy: boolean;
  /** Auto-spin needs the auto-seller bought first. */
  needsSeller: boolean;
  /** The player's switch. */
  on: boolean;
  /** The switch can be flipped now (owned, and no vault opening in progress). */
  canToggle: boolean;
  status: AutoSpinStatus;
  /** Seconds it waits after the bench empties before buying. */
  delay: number;
  delayLevel: number;
  maxLevel: number;
  delayCost: number | null;
  canBuyDelay: boolean;
  /** The case it buys; null = the dearest it can afford. */
  pick: string | null;
}

export interface BotView {
  awake: boolean;
  wakeCost: number;
  canWake: boolean;
  speed: number;
  speedLevel: number;
  speedCost: number | null;
  /** At this run's last Speed level, but a later run adds more. */
  speedNextRun: boolean;
  canBuySpeed: boolean;
  /** The case it opens; null = the dearest you can afford. */
  caseChoice: string | null;
  spinning: boolean;
  /** Its cards waiting at its station, side by side; null once sold or taken. */
  cards: (TrayItemView | null)[];
  /** This run lets it open several cases per spin. */
  multiAvailable: boolean;
  multiLevel: number;
  multiCost: number;
  canBuyMulti: boolean;
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

export interface LockerView {
  /** This run has the locker. */
  available: boolean;
  on: boolean;
  cost: number;
  canBuy: boolean;
  count: number;
  capacity: number;
  counts: Record<RarityId, number>;
  sizeLevel: number;
  sizeCost: number | null;
  canBuySize: boolean;
  /** The rarity the auto-seller sends here; null = off. */
  collect: RarityId | null;
  pressing: boolean;
  /** The press's progress 0–1. */
  pressProgress: number;
  /** Contract results waiting on top of the locker; null once sold or taken. */
  cards: (TrayItemView | null)[];
  /** The rarity a press would take now, or null. */
  tradeUp: RarityId | null;
  canTradeUp: boolean;
  /** This run has the auto contract. */
  autoAvailable: boolean;
  auto: boolean;
  autoCost: number;
  canBuyAuto: boolean;
}

export const trayItem = (run: Run, d: Drop): TrayItemView => ({ skinId: d.skinId, rarity: d.rarity, value: run.payout(d, false) });

export function botView(run: Run): BotView {
  const s = run.state;
  const open = !run.locked();
  const r = run.setup.run;
  const b = s.bot;
  const speedCost = botSpeedCost(b.speedLevel, r);
  return {
    awake: b.awake,
    wakeCost: BOT_WAKE_COST,
    canWake: open && !b.awake && s.cash >= BOT_WAKE_COST,
    speed: botSpeed(b.speedLevel),
    speedLevel: b.speedLevel,
    speedCost,
    speedNextRun: speedCost === null && capRaisedLater((x) => botSpeedLevels(x), b.speedLevel, r),
    canBuySpeed: open && b.awake && speedCost !== null && s.cash >= speedCost,
    caseChoice: b.caseChoice,
    spinning: b.spin !== null,
    cards: b.cards.map((d) => (d ? trayItem(run, d) : null)),
    multiAvailable: runContent(r).botMultiOpen > 1,
    multiLevel: b.multiLevel,
    multiCost: BOT_MULTI_COST,
    canBuyMulti: open && b.awake && runContent(r).botMultiOpen > 1 && b.multiLevel === 0 && s.cash >= BOT_MULTI_COST,
  };
}

export function sellerView(run: Run): SellerView {
  const s = run.state;
  const open = !run.locked();
  const sc = sellerSpeedCost(s.seller.speedLevel);
  return {
    on: s.seller.on,
    cost: SELLER_COST,
    canBuy: open && !s.seller.on && s.cash >= SELLER_COST,
    speedLevel: s.seller.speedLevel,
    maxLevel: SELLER_SPEED_LEVELS,
    speedCost: sc,
    canBuySpeed: open && s.seller.on && sc !== null && s.cash >= sc,
    threshold: s.seller.threshold,
  };
}

export function lockerView(run: Run): LockerView {
  const s = run.state;
  const open = !run.locked();
  const r = run.setup.run;
  const lk = s.locker;
  const available = runContent(r).locker;
  const sizeCost = lockerSizeCost(lk.sizeLevel);
  const ready = tradeUpRarity(lk.items);
  const autoAvailable = runContent(r).autoContract;
  return {
    available,
    on: lk.on,
    cost: LOCKER_COST,
    canBuy: open && available && !lk.on && s.cash >= LOCKER_COST,
    count: lk.items.length,
    capacity: lockerCapacity(lk.sizeLevel),
    counts: lockerCounts(lk.items),
    sizeLevel: lk.sizeLevel,
    sizeCost,
    canBuySize: open && lk.on && sizeCost !== null && s.cash >= sizeCost,
    collect: lk.collect,
    pressing: lk.press !== null,
    pressProgress: lk.press ? Math.min(1, lk.press.elapsed / TRADE_UP_SECONDS) : 0,
    cards: lk.cards.map((d) => (d ? trayItem(run, d) : null)),
    tradeUp: ready,
    canTradeUp: open && lk.on && ready !== null && lk.press === null && !lockerWaiting(lk),
    autoAvailable,
    auto: lk.auto,
    autoCost: AUTO_CONTRACT_COST,
    canBuyAuto: open && autoAvailable && lk.on && !lk.auto && s.cash >= AUTO_CONTRACT_COST,
  };
}

export function autoSpinView(run: Run): AutoSpinView {
  const s = run.state;
  const open = !run.locked();
  const a = s.autoSpin;
  const delayCost = autoSpinDelayCost(a.delayLevel);
  return {
    owned: a.owned,
    cost: AUTOSPIN_COST,
    canBuy: open && !a.owned && s.seller.on && s.cash >= AUTOSPIN_COST,
    needsSeller: !s.seller.on,
    on: a.on,
    canToggle: open && a.owned,
    status: autoSpinStatus(run),
    delay: autoSpinDelay(a.delayLevel),
    delayLevel: a.delayLevel,
    maxLevel: AUTOSPIN_DELAY_LEVELS,
    delayCost,
    canBuyDelay: open && a.owned && delayCost !== null && s.cash >= delayCost,
    pick: a.pick,
  };
}
