import { SELLER_SPEED_LEVELS, sellerSpeedCost } from "../sim/autoSeller";
import { botSpeed, botSpeedCost, botSpeedLevels } from "../sim/botOpener";
import { capRaisedLater, runContent } from "../sim/campaign";
import { gridRateCost, gridSize, gridSizeCost, gridStalled } from "../sim/grid";
import { lockerCapacity, lockerCounts, lockerSizeCost, lockerWaiting, tradeUpRarity } from "../sim/locker";
import type { Run } from "../sim/run";
import { AUTO_CONTRACT_COST, BOT_MULTI_COST, BOT_WAKE_COST, GRID_COST, LOCKER_COST, SELLER_COST, TRADE_UP_SECONDS } from "../sim/tuning";
import type { Drop, RarityId } from "../sim/types";

// The machines' part of the view (the bot, the auto-seller, the locker, the auto-buyer grid) — derived from the
// run, never stored separately. buildView (view.ts) puts them in the GameView.

export interface TrayItemView {
  skinId: string;
  rarity: RarityId;
  /** What it pays sold by hand right now, before combo. */
  value: number;
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

export interface GridView {
  /** This run has the auto-buyer grid. */
  available: boolean;
  on: boolean;
  cost: number;
  canBuy: boolean;
  /** It can't be bought before the auto-seller (its drops need an output). */
  needsSeller: boolean;
  /** Cells on the board. */
  size: number;
  rateLevel: number;
  rateCost: number | null;
  canBuyRate: boolean;
  sizeLevel: number;
  sizeCost: number | null;
  canBuySize: boolean;
  /** The share of your cash it never spends. */
  reserve: number;
  ticks: string[];
  /** Each cell: its case, and once opened (a stalled cell) its drop's rarity; null = empty. */
  cells: Array<{ caseId: string; open: boolean; rarity: RarityId | null } | null>;
  /** A cell holds a drop the tray had no room for: it buys nothing until the tray has room. */
  stalled: boolean;
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

export function gridView(run: Run): GridView {
  const s = run.state;
  const open = !run.locked();
  const g = s.grid;
  const available = runContent(run.setup.run).grid;
  const rateCost = gridRateCost(g.rateLevel);
  const sizeCost = gridSizeCost(g.sizeLevel);
  return {
    available,
    on: g.on,
    cost: GRID_COST,
    canBuy: open && available && !g.on && s.seller.on && s.cash >= GRID_COST,
    needsSeller: !s.seller.on,
    size: gridSize(g.sizeLevel),
    rateLevel: g.rateLevel,
    rateCost,
    canBuyRate: open && g.on && rateCost !== null && s.cash >= rateCost,
    sizeLevel: g.sizeLevel,
    sizeCost,
    canBuySize: open && g.on && sizeCost !== null && s.cash >= sizeCost,
    reserve: g.reserve,
    ticks: [...g.ticks],
    cells: g.cells.map((c) => (c ? { caseId: c.caseId, open: c.drop !== null, rarity: c.drop?.rarity ?? null } : null)),
    stalled: gridStalled(g),
  };
}
