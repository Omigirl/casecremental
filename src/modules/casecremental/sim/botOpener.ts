import { runCaseIds, runContent } from "./campaign";
import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
import { BOT_MULTI_COST, BOT_SPEED_ANCHORS, BOT_SPEED_COSTS, BOT_SPIN_SECONDS, BOT_WAKE_COST, BOT_WAKE_SECONDS } from "./tuning";
import type { Drop } from "./types";

// The bot as an opener (rework spec §1): once woken it buys a case with your cash and spins it on its own
// reel; its drops wait at its station as cards until they are sold (by you, or by the auto-seller). It does not
// open again while a card waits. In Run 2 and later its multi-open upgrade opens two cases per spin on stacked reels. Speed makes its spin faster.

/** Where a revealed card waits: your bench, the bot's station, or on top of the locker (contract results). */
export type CardSpot = "bench" | "bot" | "locker";

export interface BotSpin {
  caseId: string;
  drops: Drop[];
  elapsed: number;
  duration: number;
}

export interface BotState {
  awake: boolean;
  speedLevel: number;
  /** Bot multi-open bought (0/1): one spin opens up to runContent.botMultiOpen cases. */
  multiLevel: number;
  /** The case it opens; null = the dearest one you can afford. */
  caseChoice: string | null;
  spin: BotSpin | null;
  /** Its drops, side by side at its station; null once sold or taken. Empty when none wait. */
  cards: (Drop | null)[];
  /** When those cards landed. */
  cardAt: number;
  /** Seconds a just-woken bot still rests before its first spin. */
  wakeLeft: number;
}

export const freshBot = (awake: boolean): BotState => ({
  awake,
  speedLevel: 0,
  multiLevel: 0,
  caseChoice: null,
  spin: null,
  cards: [],
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

/** A card waits at the bot's station. */
export const botWaiting = (bot: Pick<BotState, "cards">): boolean => bot.cards.some((d) => d !== null);

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

export function buyBotMulti(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!s.bot.awake) return fail("wake the bot first");
  if (runContent(ctx.setup.run).botMultiOpen <= 1) return fail("not in this run");
  if (s.bot.multiLevel >= 1) return fail("already bought");
  if (s.cash < BOT_MULTI_COST) return fail("not enough cash");
  s.cash -= BOT_MULTI_COST;
  s.bot.multiLevel = 1;
  ctx.emit({ type: "botMultiBought" });
  return OK;
}

/** The case the bot opens (null = the dearest you can afford). */
export function setBotCase(ctx: RunCtx, caseId: string | null): ActionResult {
  if (caseId !== null && !runCaseIds(ctx.setup.run).includes(caseId)) return fail(`unknown case: ${caseId}`);
  ctx.state.bot.caseChoice = caseId;
  return OK;
}

/** Sell one of the bot's cards by hand (feeds the combo). */
export function sellBotCard(ctx: RunCtx, slot = 0): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  const d = s.bot.cards[slot];
  if (!d) return fail("the bot has nothing to sell");
  ctx.bumpCombo();
  const amount = ctx.payout(d, true);
  ctx.earn(amount);
  takeBotCard(ctx, slot);
  ctx.emit({ type: "sold", drop: d, amount, combo: s.combo, source: "bot", from: "bot", slot });
  return OK;
}

/** A bot card leaves (sold or taken); the station empties with the last one. */
export function takeBotCard(ctx: RunCtx, slot: number): void {
  const s = ctx.state;
  s.bot.cards[slot] = null;
  if (s.held === "bot" && s.heldSlot === slot) ctx.release();
  if (s.bot.cards.every((d) => d === null)) s.bot.cards = [];
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
    const drops = bot.spin.drops;
    bot.spin = null;
    bot.cards = [...drops];
    bot.cardAt = s.time;
    for (const d of drops) ctx.onReveal(d, "bot");
    ctx.countReveals(drops.length);
    ctx.emit({ type: "botRevealed", drops });
    return;
  }
  if (botWaiting(bot) || ctx.locked()) return;
  const caseId = botCaseFor(bot.caseChoice, s.unlocked, s.cash, (id) => ctx.casePrice(id));
  if (!caseId) return;
  const price = ctx.casePrice(caseId);
  const count = Math.max(1, Math.min(1 + bot.multiLevel * (runContent(ctx.setup.run).botMultiOpen - 1), Math.floor(s.cash / price)));
  s.cash -= price * count;
  const drops: Drop[] = [];
  for (let i = 0; i < count; i++) drops.push(ctx.rollFor(caseId));
  const duration = botSpinSeconds(bot.speedLevel);
  bot.spin = { caseId, drops, elapsed: 0, duration };
  ctx.emit({ type: "botSpinStarted", caseId, drops, duration });
}
