import { runContent } from "./campaign";
import { CASES } from "./content/cases";
import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
import { BOT_SPEED_ANCHORS, BOT_SPEED_COSTS, BOT_SPIN_SECONDS, BOT_WAKE_COST, BOT_WAKE_SECONDS } from "./tuning";
import type { Drop } from "./types";

// The bot as an opener (rework spec §1): once woken it buys a case with your cash and spins it on its own
// reel; its drop waits at its station as a card until it is sold (by you, or by the auto-seller). It does not
// open again while its card waits. Speed makes its spin faster.

/** Where a revealed card waits: your bench or the bot's station. */
export type CardSpot = "bench" | "bot";

export interface BotSpin {
  caseId: string;
  drop: Drop;
  elapsed: number;
  duration: number;
}

export interface BotState {
  awake: boolean;
  speedLevel: number;
  /** The case it opens; null = the dearest one you can afford. */
  caseChoice: string | null;
  spin: BotSpin | null;
  /** Its drop, waiting at its station to be sold. */
  card: Drop | null;
  /** When that card landed. */
  cardAt: number;
  /** Seconds a just-woken bot still rests before its first spin. */
  wakeLeft: number;
}

export const freshBot = (awake: boolean): BotState => ({
  awake,
  speedLevel: 0,
  caseChoice: null,
  spin: null,
  card: null,
  cardAt: 0,
  wakeLeft: 0,
});

/** The bot's speed: geometric between BOT_SPEED_ANCHORS, flat past the last one. */
export function botSpeed(level: number): number {
  const last = BOT_SPEED_ANCHORS[BOT_SPEED_ANCHORS.length - 1]!;
  if (level >= last[0]) return last[1];
  let i = 1;
  while (BOT_SPEED_ANCHORS[i]![0] < level) i++;
  const [l0, s0] = BOT_SPEED_ANCHORS[i - 1]!;
  const [l1, s1] = BOT_SPEED_ANCHORS[i]!;
  return s0 * (s1 / s0) ** ((Math.max(level, 0) - l0) / (l1 - l0));
}

export const botSpeedLevels = (run: number): number => runContent(run).botSpeedLevels;

/** Price of the next Speed level, or null at this run's cap. */
export function botSpeedCost(level: number, run = 1): number | null {
  if (level >= botSpeedLevels(run)) return null;
  return Math.ceil(BOT_SPEED_COSTS.baseCost * BOT_SPEED_COSTS.growth ** level);
}

export const botSpinSeconds = (level: number): number => BOT_SPIN_SECONDS / botSpeed(level);

/** The case the bot opens next: its choice (when unlocked) if you can afford it, else the dearest one you can. */
export function botCaseFor(choice: string | null, unlocked: readonly string[], cash: number, price: (id: string) => number): string | null {
  if (choice && unlocked.includes(choice)) return cash >= price(choice) ? choice : null;
  let best: string | null = null;
  for (const id of unlocked) if (price(id) <= cash && (best === null || price(id) > price(best))) best = id;
  return best;
}

export function wakeBot(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (s.bot.awake) return fail("the bot is already awake");
  if (s.cash < BOT_WAKE_COST) return fail("not enough cash");
  s.cash -= BOT_WAKE_COST;
  s.bot.awake = true;
  s.bot.wakeLeft = BOT_WAKE_SECONDS;
  ctx.emit({ type: "botWoke" });
  return OK;
}

export function buyBotSpeed(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!s.bot.awake) return fail("wake the bot first");
  const cost = botSpeedCost(s.bot.speedLevel, ctx.setup.run);
  if (cost === null) return fail("max level for this run");
  if (s.cash < cost) return fail("not enough cash");
  s.cash -= cost;
  s.bot.speedLevel += 1;
  ctx.emit({ type: "botUpgraded", level: s.bot.speedLevel });
  return OK;
}

/** The case the bot opens (null = the dearest you can afford). */
export function setBotCase(ctx: RunCtx, caseId: string | null): ActionResult {
  if (caseId !== null && !CASES.some((c) => c.id === caseId)) return fail(`unknown case: ${caseId}`);
  ctx.state.bot.caseChoice = caseId;
  return OK;
}

/** Sell the bot's card by hand (feeds the combo). */
export function sellBotCard(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  const d = s.bot.card;
  if (!d) return fail("the bot has nothing to sell");
  ctx.bumpCombo();
  const amount = ctx.payout(d, true);
  ctx.earn(amount);
  s.bot.card = null;
  if (s.held === "bot") ctx.release();
  ctx.emit({ type: "sold", drop: d, amount, combo: s.combo, source: "bot", from: "bot", slot: 0 });
  return OK;
}

/** The bot's own reel (rework spec §1): finish a spin into its card, or start the next one. */
export function tickBot(ctx: RunCtx, dt: number): void {
  const s = ctx.state;
  const bot = s.bot;
  if (!bot.awake || s.vault !== null) return;
  if (bot.wakeLeft > 0) {
    bot.wakeLeft = Math.max(0, bot.wakeLeft - dt);
    return;
  }
  if (bot.spin) {
    bot.spin.elapsed += dt;
    if (bot.spin.elapsed < bot.spin.duration) return;
    const d = bot.spin.drop;
    bot.spin = null;
    bot.card = d;
    bot.cardAt = s.time;
    ctx.onReveal(d, "bot");
    ctx.countReveals(1);
    ctx.emit({ type: "botRevealed", drop: d });
    return;
  }
  if (bot.card || ctx.locked()) return;
  const caseId = botCaseFor(bot.caseChoice, s.unlocked, s.cash, (id) => ctx.casePrice(id));
  if (!caseId) return;
  s.cash -= ctx.casePrice(caseId);
  const drop = ctx.rollFor(caseId);
  const duration = botSpinSeconds(bot.speedLevel);
  bot.spin = { caseId, drop, elapsed: 0, duration };
  ctx.emit({ type: "botSpinStarted", caseId, drop, duration });
}
