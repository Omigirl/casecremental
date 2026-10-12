import { botCaseFor } from "./botOpener";
import { runCaseIds } from "./campaign";
import { assemblyFree, evolved, placeFreeCase } from "./evolved";
import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
import { AUTOSPIN_COST, AUTOSPIN_DELAY_COSTS, AUTOSPIN_DELAYS, AUTOSPIN_KEY_SECONDS } from "./tuning";
import { vaultShown } from "./vault";

// Auto-spin (finish spec §3): a machine for your own bench, bought on the Machines tab once the auto-seller is on, then
// switched ON/OFF (off after purchase; it keeps its state for the run). While it is on, nobody holds a card and the vault
// is not out, it buys the case you picked last (the last one you bought by hand or picked on the shelf; the dearest you
// can afford when that one is too dear) at your full multi-open width once the bench has stood empty for its delay, and
// turns the key of any case left locked on the bench after a short beat. It never sells, so it never builds combo. With
// nothing affordable it waits ON ("BROKE": the day job is yours); with the vault affordable it buys nothing, so it never
// spends the vault's cash or keeps the bench busy under the vault's BUY. With Assembly Line (Run 4) it has no delay, and
// every 25th buy is a free case one tier up.

export interface AutoSpinState {
  owned: boolean;
  on: boolean;
  delayLevel: number;
  /** The case it buys: the last one you bought by hand or picked on the shelf (null = the dearest you can afford). */
  pick: string | null;
  /** Seconds the bench has stood empty (toward the delay) or locked (toward the key beat). */
  clock: number;
  /** Switched on before this run: only the first switch-on is the machine's power-on. */
  powered: boolean;
}

/** What it is doing, for its rows and its lamp: off, at work, broke, or waiting for you to buy the vault. */
export type AutoSpinStatus = "off" | "on" | "broke" | "vault";

export const freshAutoSpin = (): AutoSpinState => ({ owned: false, on: false, delayLevel: 0, pick: null, clock: 0, powered: false });

/** The Delay levels after the first. */
export const AUTOSPIN_DELAY_LEVELS = AUTOSPIN_DELAYS.length - 1;

/** Seconds the bench stands empty before it buys, at this Delay level. */
export const autoSpinDelay = (level: number): number => AUTOSPIN_DELAYS[Math.min(Math.max(level, 0), AUTOSPIN_DELAY_LEVELS)]!;

/** Price of the next Delay level, or null at the last. */
export function autoSpinDelayCost(level: number): number | null {
  if (level >= AUTOSPIN_DELAY_LEVELS) return null;
  return Math.ceil(AUTOSPIN_DELAY_COSTS.baseCost * AUTOSPIN_DELAY_COSTS.growth ** level);
}

export function buyAutoSpin(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (s.autoSpin.owned) return fail("auto-spin is already bought");
  if (!s.seller.on) return fail("buy the auto-seller first");
  if (s.cash < AUTOSPIN_COST) return fail("not enough cash");
  s.cash -= AUTOSPIN_COST;
  s.autoSpin.owned = true;
  ctx.emit({ type: "autoSpinBought" });
  return OK;
}

export function buyAutoSpinDelay(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!s.autoSpin.owned) return fail("buy auto-spin first");
  const cost = autoSpinDelayCost(s.autoSpin.delayLevel);
  if (cost === null) return fail("max level");
  if (s.cash < cost) return fail("not enough cash");
  s.cash -= cost;
  s.autoSpin.delayLevel += 1;
  ctx.emit({ type: "autoSpinUpgraded", level: s.autoSpin.delayLevel });
  return OK;
}

/** The switch (on the bench beside BUY and on its Machines row); the same value changes nothing. */
export function setAutoSpin(ctx: RunCtx, on: boolean): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const a = ctx.state.autoSpin;
  if (!a.owned) return fail("buy auto-spin first");
  if (a.on === on) return OK;
  a.on = on;
  a.clock = 0;
  const first = on && !a.powered;
  if (on) a.powered = true;
  ctx.emit({ type: "autoSpinToggled", on, first });
  return OK;
}

/** Pick the case it buys from the shelf: an unlocked case on this run's shelf (buying one by hand picks it too). */
export function setAutoSpinCase(ctx: RunCtx, caseId: string): ActionResult {
  if (!runCaseIds(ctx.setup.run).includes(caseId)) return fail("not in this run");
  if (!ctx.state.unlocked.includes(caseId)) return fail(`case ${caseId} is locked`);
  ctx.state.autoSpin.pick = caseId;
  return OK;
}

/** The vault is out on the shelf and you can pay for it: auto-spin leaves the cash and the bench to you. */
const vaultReady = (ctx: RunCtx): boolean => vaultShown(ctx) && ctx.state.cash >= ctx.setup.vaultPrice;

/** The case it would buy now: the pick when it is on this shelf, unlocked and affordable, else the dearest it can
 *  afford; null when it can afford none. */
export function autoSpinCase(ctx: RunCtx): string | null {
  const s = ctx.state;
  const shelf = runCaseIds(ctx.setup.run).filter((id) => s.unlocked.includes(id));
  const price = (id: string) => ctx.casePrice(id);
  const pick = s.autoSpin.pick;
  if (pick && shelf.includes(pick) && price(pick) <= s.cash) return pick;
  return botCaseFor(null, shelf, s.cash, price);
}

export function autoSpinStatus(ctx: RunCtx): AutoSpinStatus {
  const a = ctx.state.autoSpin;
  if (!a.owned || !a.on) return "off";
  if (vaultReady(ctx)) return "vault";
  if (ctx.state.bench.phase === "empty" && autoSpinCase(ctx) === null) return "broke";
  return "on";
}

export function tickAutoSpin(ctx: RunCtx, dt: number): void {
  const s = ctx.state;
  const a = s.autoSpin;
  if (!a.owned || !a.on || ctx.locked() || s.held !== null) return;
  const b = s.bench;
  if (b.phase === "locked") {
    a.clock += dt;
    if (a.clock >= AUTOSPIN_KEY_SECONDS && ctx.insertKey().ok) {
      a.clock = 0;
      ctx.emit({ type: "autoSpinKeyed" });
    }
    return;
  }
  if (b.phase !== "empty") {
    a.clock = 0;
    return;
  }
  if (vaultReady(ctx)) return;
  const delay = evolved(s, "assemblyLine") ? 0 : autoSpinDelay(a.delayLevel); // Assembly Line: no delay
  a.clock = Math.min(a.clock + dt, delay); // broke, it stays due: it buys the moment it can afford a case
  if (a.clock < delay) return;
  const caseId = autoSpinCase(ctx);
  if (!caseId) return;
  a.clock = 0;
  const free = assemblyFree(ctx, caseId); // Assembly Line: every 25th buy is a free case one tier up
  if (free) {
    placeFreeCase(ctx, free);
    ctx.emit({ type: "autoSpinPulled", caseId: free, count: 1 });
    return;
  }
  const count = ctx.placeCase(caseId);
  ctx.emit({ type: "autoSpinPulled", caseId, count });
}
