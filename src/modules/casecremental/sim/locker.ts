import { takeBotCard, type CardSpot } from "./botOpener";
import { runContent } from "./campaign";
import { caseById, priceOf } from "./content/cases";
import { RARITY_ORDER } from "./rarity";
import type { Rng } from "./rng";
import { valueMultOf } from "./roll";
import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
import {
  AUTO_CONTRACT_COST,
  CONTRACT_KILLER_CHANCE,
  LOCKER_BASE_CAPACITY,
  LOCKER_COST,
  LOCKER_SIZE_COSTS,
  LOCKER_SIZE_LEVELS,
  LOCKER_SIZE_STEP,
  STATTRAK_MULT,
  TRADE_UP_BONUS,
  TRADE_UP_COUNT,
  TRADE_UP_SECONDS,
} from "./tuning";
import type { Drop, RarityId } from "./types";
import { wearOf } from "./wear";

// The locker (Run 2, spec §5): it keeps skins — dragged in by hand (feeding the combo) or sent by the auto-seller's
// Collect setting — and presses ten of a rarity into one of the next (CS trade-up rules). The results wait on top
// of the locker like the bot's cards. In Run 3 the auto contract presses on its own.

export interface PressState {
  rarity: RarityId;
  inputs: Drop[];
  /** Rolled when the press starts, so a save mid-press ends the same way. */
  results: Drop[];
  elapsed: number;
}

export interface LockerState {
  on: boolean;
  /** Oldest first. */
  items: Drop[];
  sizeLevel: number;
  /** The rarity the auto-seller sends here instead of selling; null = off. */
  collect: RarityId | null;
  press: PressState | null;
  /** Contract results waiting on top of the locker (like the bot's cards). */
  cards: (Drop | null)[];
  cardAt: number;
  /** Run 3: presses on its own. */
  auto: boolean;
}

export const freshLocker = (): LockerState => ({
  on: false,
  items: [],
  sizeLevel: 0,
  collect: null,
  press: null,
  cards: [],
  cardAt: 0,
  auto: false,
});

export const lockerCapacity = (sizeLevel: number): number => LOCKER_BASE_CAPACITY + LOCKER_SIZE_STEP * sizeLevel;

/** Price of the next Size level, or null at the last. */
export function lockerSizeCost(level: number): number | null {
  if (level >= LOCKER_SIZE_LEVELS) return null;
  return Math.ceil(LOCKER_SIZE_COSTS.baseCost * LOCKER_SIZE_COSTS.growth ** level);
}

/** A contract result waits on top of the locker. */
export const lockerWaiting = (locker: Pick<LockerState, "cards">): boolean => locker.cards.some((d) => d !== null);

export function lockerCounts(items: readonly Drop[]): Record<RarityId, number> {
  const counts = Object.fromEntries(RARITY_ORDER.map((r) => [r, 0])) as Record<RarityId, number>;
  for (const d of items) counts[d.rarity]++;
  return counts;
}

/** The rarity a press would take now: the lowest (below ★) with TRADE_UP_COUNT in, or null. */
export function tradeUpRarity(items: readonly Drop[]): RarityId | null {
  const counts = lockerCounts(items);
  return RARITY_ORDER.slice(0, -1).find((r) => counts[r] >= TRADE_UP_COUNT) ?? null;
}

const nextRarity = (r: RarityId): RarityId => RARITY_ORDER[Math.min(RARITY_ORDER.indexOf(r) + 1, RARITY_ORDER.length - 1)]!;

/** CS rules: the case drawn from the inputs weighted by count, a skin of the next rarity from it, the mean float,
 *  StatTrak only if all ten were; value × TRADE_UP_BONUS[input rarity]. `two` = Contract Killer's double. */
export function contractResults(inputs: readonly Drop[], rng: Rng, nextId: () => number, two: boolean): Drop[] {
  const input = inputs[0]!.rarity as Exclude<RarityId, "gold">;
  const rarity = nextRarity(input);
  const caseCounts = new Map<string, number>();
  for (const d of inputs) caseCounts.set(d.caseId, (caseCounts.get(d.caseId) ?? 0) + 1);
  const float = inputs.reduce((a, d) => a + d.float, 0) / inputs.length;
  const wear = wearOf(float);
  const statTrak = inputs.every((d) => d.statTrak);
  const one = (): Drop => {
    let roll = rng.next() * inputs.length;
    let caseId = inputs[0]!.caseId;
    for (const [id, n] of caseCounts) {
      caseId = id;
      if (roll < n) break;
      roll -= n;
    }
    const skin = rng.pick(caseById(caseId).skins.filter((s) => s.rarity === rarity));
    const value = priceOf(caseId) * valueMultOf(caseId, rarity) * wear.mult * (statTrak ? STATTRAK_MULT : 1) * TRADE_UP_BONUS[input];
    return { id: nextId(), caseId, skinId: skin.id, rarity, float, wear: wear.id, statTrak, value };
  };
  return two ? [one(), one()] : [one()];
}

export function buyLocker(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!runContent(ctx.setup.run).locker) return fail("not in this run");
  if (s.locker.on) return fail("the locker is already bought");
  if (s.cash < LOCKER_COST) return fail("not enough cash");
  s.cash -= LOCKER_COST;
  s.locker.on = true;
  ctx.emit({ type: "lockerBought" });
  return OK;
}

export function buyLockerSize(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!s.locker.on) return fail("buy the locker first");
  const cost = lockerSizeCost(s.locker.sizeLevel);
  if (cost === null) return fail("max level");
  if (s.cash < cost) return fail("not enough cash");
  s.cash -= cost;
  s.locker.sizeLevel += 1;
  ctx.emit({ type: "lockerUpgraded", level: s.locker.sizeLevel });
  return OK;
}

/** The rarity the auto-seller sends to the locker (null = off). Never ★: no contract goes past it. */
export function setCollect(ctx: RunCtx, r: RarityId | null): ActionResult {
  if (r === "gold") return fail("no contract goes past ★");
  ctx.state.locker.collect = r;
  return OK;
}

const hasRoom = (ctx: RunCtx): boolean => ctx.state.locker.items.length < lockerCapacity(ctx.state.locker.sizeLevel);

/** A contract result leaves (sold, stored or taken); the top of the locker empties with the last one. */
export function takeLockerCard(ctx: RunCtx, slot: number): void {
  const s = ctx.state;
  s.locker.cards[slot] = null;
  if (s.held === "locker" && s.heldSlot === slot) ctx.release();
  if (s.locker.cards.every((d) => d === null)) s.locker.cards = [];
}

/** The player drags a waiting card (bench, bot, a contract result) or a tray item into the locker: feeds the combo. */
export function storeCard(ctx: RunCtx, from: CardSpot | "tray", slot: number): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!s.locker.on) return fail("buy the locker first");
  const b = s.bench;
  const d =
    from === "bench"
      ? b.phase === "revealed"
        ? b.cards[slot]
        : null
      : from === "bot"
        ? s.bot.cards[slot]
        : from === "locker"
          ? s.locker.cards[slot]
          : s.tray[slot];
  if (!d) return fail("nothing in that spot");
  if (!hasRoom(ctx)) return fail("the locker is full");
  if (from === "bench") ctx.takeBenchCard(slot);
  else if (from === "bot") takeBotCard(ctx, slot);
  else if (from === "locker") takeLockerCard(ctx, slot);
  else s.tray.splice(slot, 1);
  s.locker.items.push(d);
  ctx.bumpCombo();
  ctx.emit({ type: "lockerStored", drop: d, from, slot, byHand: true });
  return OK;
}

/** Collect routing for the auto-seller: true when it stored the drop (exactly the Collect rarity, locker on, room). */
export function collectInto(ctx: RunCtx, d: Drop, from: CardSpot, slot: number): boolean {
  const locker = ctx.state.locker;
  if (!locker.on || locker.collect !== d.rarity || !hasRoom(ctx)) return false;
  locker.items.push(d);
  ctx.emit({ type: "lockerStored", drop: d, from, slot, byHand: false });
  return true;
}

/** Why the press can't start now, or null. */
function pressBlocked(ctx: RunCtx): string | null {
  const locker = ctx.state.locker;
  if (!locker.on) return "buy the locker first";
  if (locker.press) return "the press is busy";
  if (lockerWaiting(locker)) return "take the results first";
  return null;
}

/** The press takes the oldest TRADE_UP_COUNT of `rarity`; its results are rolled now. */
function startPress(ctx: RunCtx, rarity: RarityId): void {
  const s = ctx.state;
  const inputs: Drop[] = [];
  const kept: Drop[] = [];
  for (const d of s.locker.items) (d.rarity === rarity && inputs.length < TRADE_UP_COUNT ? inputs : kept).push(d);
  s.locker.items = kept;
  const two = ctx.setup.charms.includes("contractKiller") && ctx.rng.next() < CONTRACT_KILLER_CHANCE;
  const results = contractResults(inputs, ctx.rng, () => s.nextDropId++, two);
  s.locker.press = { rarity, inputs, results, elapsed: 0 };
  ctx.emit({ type: "pressStarted", rarity, inputs, results });
}

export function tradeUp(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const blocked = pressBlocked(ctx);
  if (blocked) return fail(blocked);
  const rarity = tradeUpRarity(ctx.state.locker.items);
  if (!rarity) return fail(`needs ${TRADE_UP_COUNT} of one rarity`);
  startPress(ctx, rarity);
  return OK;
}

/** Sell one of the contract results by hand (feeds the combo). */
export function sellLockerCard(ctx: RunCtx, slot?: number): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  slot ??= Math.max(
    0,
    s.locker.cards.findIndex((c) => c !== null),
  ); // Contract Killer: slot 0 may already be gone
  const d = s.locker.cards[slot];
  if (!d) return fail("nothing waits on the locker");
  ctx.bumpCombo();
  const amount = ctx.payout(d, true);
  ctx.earn(amount);
  takeLockerCard(ctx, slot);
  ctx.emit({ type: "sold", drop: d, amount, combo: s.combo, source: "locker", from: "locker", slot });
  return OK;
}

export function buyAutoContract(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!runContent(ctx.setup.run).autoContract) return fail("not in this run");
  if (!s.locker.on) return fail("buy the locker first");
  if (s.locker.auto) return fail("the auto contract is already bought");
  if (s.cash < AUTO_CONTRACT_COST) return fail("not enough cash");
  s.cash -= AUTO_CONTRACT_COST;
  s.locker.auto = true;
  ctx.emit({ type: "autoContractBought" });
  return OK;
}

/** The rarity the auto contract presses: the Collect rarity only (if none is set, the lowest ready). */
function autoRarity(locker: LockerState): RarityId | null {
  if (locker.collect === null) return tradeUpRarity(locker.items);
  return lockerCounts(locker.items)[locker.collect] >= TRADE_UP_COUNT ? locker.collect : null;
}

/** The press: finish into waiting results; the auto contract starts the next one. */
export function tickLocker(ctx: RunCtx, dt: number): void {
  const s = ctx.state;
  const locker = s.locker;
  if (!locker.on || ctx.locked()) return;
  const press = locker.press;
  if (press) {
    press.elapsed += dt;
    if (press.elapsed < TRADE_UP_SECONDS) return;
    locker.press = null;
    locker.cards = [...press.results];
    locker.cardAt = s.time;
    for (const d of press.results) ctx.onReveal(d, "locker");
    ctx.countReveals(press.results.length);
    ctx.emit({ type: "pressDone", results: press.results });
    return;
  }
  if (!locker.auto || pressBlocked(ctx)) return;
  const rarity = autoRarity(locker);
  if (rarity) startPress(ctx, rarity);
}
