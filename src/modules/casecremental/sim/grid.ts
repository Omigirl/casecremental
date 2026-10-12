import { autoTake } from "./autoSeller";
import { botCaseFor } from "./botOpener";
import { runCaseIds, runContent } from "./campaign";
import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
import { GRID_BUY_INTERVALS, GRID_COST, GRID_OPEN_SECONDS, GRID_RATE_COSTS, GRID_RESERVES, GRID_SIZE_COSTS, GRID_SIZES } from "./tuning";
import type { Drop } from "./types";

// The auto-buyer grid (Run 3, spec §6): every interval it buys a ticked case (round-robin; none ticked → the
// dearest it may) into an empty cell, but only while the case costs at most (1 − reserve) × cash. A cell opens
// GRID_OPEN_SECONDS after filling (Luck and charms, no tease) and its drop goes straight through the auto-seller's
// rules. A full tray leaves the drop in its cell — the grid is stalled and buys nothing until the tray has room.
// Grid drops count as reveals for heat but never feed the combo.

export interface GridCell {
  caseId: string;
  /** Seconds since it was filled. */
  t: number;
  /** Rolled when it opens; kept here while the tray is full (a stalled cell). */
  drop: Drop | null;
}

export interface GridState {
  on: boolean;
  rateLevel: number;
  sizeLevel: number;
  /** The share of your cash it never spends: 0.25 | 0.5 | 0.75. */
  reserve: number;
  /** Case ids ticked on the shelf; empty = the dearest it may buy. */
  ticks: string[];
  /** length = gridSize(sizeLevel) */
  cells: (GridCell | null)[];
  buyClock: number;
  /** Round-robin position in ticks. */
  next: number;
}

export const gridSize = (sizeLevel: number): number => GRID_SIZES[Math.min(Math.max(sizeLevel, 0), GRID_SIZES.length - 1)]!;

export const freshGrid = (): GridState => ({
  on: false,
  rateLevel: 0,
  sizeLevel: 0,
  reserve: 0.5,
  ticks: [],
  cells: Array.from({ length: gridSize(0) }, () => null),
  buyClock: 0,
  next: 0,
});

/** Some cell holds a drop the tray had no room for. */
export const gridStalled = (g: Pick<GridState, "cells">): boolean => g.cells.some((c) => c?.drop != null);

export const GRID_RATE_LEVELS = GRID_BUY_INTERVALS.length - 1;
export const GRID_SIZE_LEVELS = GRID_SIZES.length - 1;

/** Price of the next Rate level, or null at the last. */
export function gridRateCost(level: number): number | null {
  if (level >= GRID_RATE_LEVELS) return null;
  return Math.ceil(GRID_RATE_COSTS.baseCost * GRID_RATE_COSTS.growth ** level);
}

/** Price of the next Size level, or null at the last. */
export function gridSizeCost(level: number): number | null {
  if (level >= GRID_SIZE_LEVELS) return null;
  return Math.ceil(GRID_SIZE_COSTS.baseCost * GRID_SIZE_COSTS.growth ** level);
}

export function buyGrid(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!runContent(ctx.setup.run).grid) return fail("not in this run");
  if (s.grid.on) return fail("the auto-buyer is already bought");
  if (!s.seller.on) return fail("buy the auto-seller first");
  if (s.cash < GRID_COST) return fail("not enough cash");
  s.cash -= GRID_COST;
  s.grid.on = true;
  ctx.emit({ type: "gridBought" });
  return OK;
}

export function buyGridRate(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!s.grid.on) return fail("buy the auto-buyer first");
  const cost = gridRateCost(s.grid.rateLevel);
  if (cost === null) return fail("max level");
  if (s.cash < cost) return fail("not enough cash");
  s.cash -= cost;
  s.grid.rateLevel += 1;
  ctx.emit({ type: "gridUpgraded", what: "rate", level: s.grid.rateLevel });
  return OK;
}

/** More cells (rows of ten); the filled ones stay where they are. */
export function buyGridSize(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  const g = s.grid;
  if (!g.on) return fail("buy the auto-buyer first");
  const cost = gridSizeCost(g.sizeLevel);
  if (cost === null) return fail("max level");
  if (s.cash < cost) return fail("not enough cash");
  s.cash -= cost;
  g.sizeLevel += 1;
  while (g.cells.length < gridSize(g.sizeLevel)) g.cells.push(null);
  ctx.emit({ type: "gridUpgraded", what: "size", level: g.sizeLevel });
  return OK;
}

export function setGridReserve(ctx: RunCtx, reserve: number): ActionResult {
  if (!(GRID_RESERVES as readonly number[]).includes(reserve)) return fail(`reserve must be one of ${GRID_RESERVES.join(", ")}`);
  ctx.state.grid.reserve = reserve;
  return OK;
}

/** Tick or untick a case on the shelf for the grid to buy. */
export function toggleGridTick(ctx: RunCtx, caseId: string): ActionResult {
  const s = ctx.state;
  if (!runCaseIds(ctx.setup.run).includes(caseId)) return fail("not in this run");
  if (!s.unlocked.includes(caseId)) return fail(`case ${caseId} is locked`);
  const ticks = s.grid.ticks;
  const i = ticks.indexOf(caseId);
  if (i >= 0) ticks.splice(i, 1);
  else ticks.push(caseId);
  return OK;
}

/** The cases ticked for the grid that it may buy now (on this run's shelf and unlocked). */
const tickedCases = (ctx: RunCtx): string[] => {
  const shelf = runCaseIds(ctx.setup.run);
  return ctx.state.grid.ticks.filter((id) => shelf.includes(id) && ctx.state.unlocked.includes(id));
};

/** The vault comes out: unopened cells are refunded (not earnings), stalled drops cashed in; the board empties. */
export function cashInGrid(ctx: RunCtx): void {
  const s = ctx.state;
  s.grid.cells.forEach((c, cell) => {
    if (!c) return;
    if (!c.drop) {
      s.cash += ctx.casePrice(c.caseId);
      return;
    }
    const amount = ctx.payout(c.drop, false);
    ctx.earn(amount);
    ctx.emit({ type: "sold", drop: c.drop, amount, combo: s.combo, source: "grid", from: "grid", slot: cell });
  });
  s.grid.cells = s.grid.cells.map(() => null);
}

export function tickGrid(ctx: RunCtx, dt: number): void {
  const s = ctx.state;
  const g = s.grid;
  if (!g.on || ctx.locked()) return;
  // open the cells that are due; deliver (or retry) their drops through the auto-seller's rules
  g.cells.forEach((c, cell) => {
    if (!c) return;
    if (!c.drop) {
      c.t += dt;
      if (c.t < GRID_OPEN_SECONDS) return;
      c.drop = ctx.rollFor(c.caseId);
      ctx.onReveal(c.drop, "grid");
      ctx.countReveals(1);
      ctx.emit({ type: "gridOpened", cell, drop: c.drop });
    }
    if (autoTake(ctx, c.drop, "grid", cell)) g.cells[cell] = null;
  });
  // one purchase per interval; while it waits the clock banks at most one
  const interval = GRID_BUY_INTERVALS[Math.min(g.rateLevel, GRID_RATE_LEVELS)]!;
  g.buyClock += dt;
  if (g.buyClock >= interval && buyNext(ctx)) g.buyClock -= interval;
  g.buyClock = Math.min(g.buyClock, interval);
}

/** Fill the first empty cell with the next case, if the grid is not stalled and the budget allows; true if it bought. */
function buyNext(ctx: RunCtx): boolean {
  const s = ctx.state;
  const g = s.grid;
  if (gridStalled(g)) return false;
  const cell = g.cells.indexOf(null);
  if (cell < 0) return false;
  const budget = (1 - g.reserve) * s.cash;
  const price = (id: string) => ctx.casePrice(id);
  const ticked = tickedCases(ctx);
  // round-robin over the ticked cases (waiting on one it can't afford yet); none ticked → the dearest it may
  const caseId = ticked.length > 0 ? ticked[g.next % ticked.length]! : botCaseFor(null, s.unlocked, budget, price);
  if (!caseId || price(caseId) > budget) return false;
  s.cash -= price(caseId);
  g.cells[cell] = { caseId, t: 0, drop: null };
  if (ticked.length > 0) g.next = (g.next + 1) % ticked.length;
  ctx.emit({ type: "gridFilled", cell, caseId });
  return true;
}
