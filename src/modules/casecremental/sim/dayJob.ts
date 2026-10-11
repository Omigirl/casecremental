import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
import { DAY_JOB_PAY, DAY_JOB_PAY_CHANCE, DAY_JOB_SECONDS } from "./tuning";

// The day job (campaign spec §6.1): the way out when you are broke with an empty bench.

/** Broke with an empty bench and not already working. `cheapest` is the cheapest unlocked case's price. */
export function dayJobAvailable(ctx: RunCtx, cheapest: number): boolean {
  const s = ctx.state;
  return s.dayJob === null && s.bench.phase === "empty" && s.cash < cheapest;
}

export function startDayJob(ctx: RunCtx, cheapest: number): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  if (ctx.state.dayJob !== null) return fail("already working");
  if (!dayJobAvailable(ctx, cheapest)) return fail("no day job: you can afford a case or the bench is busy");
  ctx.state.dayJob = 0;
  ctx.emit({ type: "dayJobStarted" });
  return OK;
}

export function tickDayJob(ctx: RunCtx, dt: number): void {
  const s = ctx.state;
  if (s.dayJob === null) return;
  s.dayJob += dt;
  if (s.dayJob < DAY_JOB_SECONDS) return;
  s.dayJob = null;
  const amount = ctx.rng.next() < DAY_JOB_PAY_CHANCE ? DAY_JOB_PAY : 0;
  ctx.earn(amount);
  ctx.emit({ type: "dayJobDone", amount });
}
