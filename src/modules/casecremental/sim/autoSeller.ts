import { takeBotCard, type CardSpot } from "./botOpener";
import { sellerMult } from "./evolved";
import { collectInto, takeLockerCard } from "./locker";
import { RARITY_ORDER } from "./rarity";
import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
import { SELLER_BIG_HOLD, SELLER_COST, SELLER_HOLD_SECONDS, SELLER_SPEED_COSTS } from "./tuning";
import type { Drop, RarityId } from "./types";

// The auto-seller machine (rework spec §1): once bought, any card left waiting — yours on the bench, the
// bot's at its station, a contract result on the locker — is taken after a short hold: sent to the locker if it is
// the Collect rarity (and there is room), else sold if it is at or below the threshold (no combo), else put in the
// claim tray. A held card is left alone; a full tray leaves the card where it is.

export interface SellerState {
  on: boolean;
  speedLevel: number;
  /** The rarest it sells; anything rarer goes to the claim tray. */
  threshold: RarityId;
}

export const freshSeller = (): SellerState => ({ on: false, speedLevel: 0, threshold: "classified" });

/** The Speed levels this run allows (Run 1: 4). */
export const SELLER_SPEED_LEVELS = SELLER_HOLD_SECONDS.length - 1;

export const sellsAt = (threshold: RarityId, rarity: RarityId): boolean => RARITY_ORDER.indexOf(rarity) <= RARITY_ORDER.indexOf(threshold);

/** How long a card waits before the machine takes it. */
export const sellerHold = (rarity: RarityId, level: number): number =>
  rarity === "covert" || rarity === "gold" ? SELLER_BIG_HOLD : SELLER_HOLD_SECONDS[Math.min(level, SELLER_SPEED_LEVELS)]!;

export function sellerSpeedCost(level: number): number | null {
  if (level >= SELLER_SPEED_LEVELS) return null;
  return Math.ceil(SELLER_SPEED_COSTS.baseCost * SELLER_SPEED_COSTS.growth ** level);
}

export function buySeller(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (s.seller.on) return fail("the auto-seller is already on");
  if (s.cash < SELLER_COST) return fail("not enough cash");
  s.cash -= SELLER_COST;
  s.seller.on = true;
  ctx.emit({ type: "sellerBought" });
  return OK;
}

export function buySellerSpeed(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!s.seller.on) return fail("buy the auto-seller first");
  const cost = sellerSpeedCost(s.seller.speedLevel);
  if (cost === null) return fail("max level for this run");
  if (s.cash < cost) return fail("not enough cash");
  s.cash -= cost;
  s.seller.speedLevel += 1;
  ctx.emit({ type: "sellerUpgraded", level: s.seller.speedLevel });
  return OK;
}

export function setSellerThreshold(ctx: RunCtx, rarity: RarityId): ActionResult {
  ctx.state.seller.threshold = rarity;
  return OK;
}

/** The auto-seller takes cards left waiting (rework spec §1). */
export function tickSeller(ctx: RunCtx): void {
  const s = ctx.state;
  const seller = s.seller;
  if (!seller.on || ctx.locked()) return;
  const b = s.bench;
  if (b.phase === "revealed")
    b.cards.forEach((d, slot) => {
      if (!d || (s.held === "bench" && s.heldSlot === slot)) return;
      if (s.time - s.revealedAt < sellerHold(d.rarity, seller.speedLevel)) return;
      if (autoTake(ctx, d, "bench", slot)) ctx.takeBenchCard(slot);
    });
  s.bot.cards.forEach((d, slot) => {
    if (!d || (s.held === "bot" && s.heldSlot === slot)) return;
    if (s.time - s.bot.cardAt < sellerHold(d.rarity, seller.speedLevel)) return;
    if (autoTake(ctx, d, "bot", slot)) takeBotCard(ctx, slot);
  });
  s.locker.cards.forEach((d, slot) => {
    if (!d || (s.held === "locker" && s.heldSlot === slot)) return;
    if (s.time - s.locker.cardAt < sellerHold(d.rarity, seller.speedLevel)) return;
    if (autoTake(ctx, d, "locker", slot)) takeLockerCard(ctx, slot);
  });
}

/** Collect it into the locker, sell it (at or below the threshold) or set it aside in the tray; false when the tray is full. */
export function autoTake(ctx: RunCtx, d: Drop, from: CardSpot, slot = 0): boolean {
  const s = ctx.state;
  if (collectInto(ctx, d, from, slot)) return true;
  if (sellsAt(s.seller.threshold, d.rarity)) {
    const amount = ctx.payout(d, false) * (d.upgraded ? 1 : sellerMult(s)); // Money Printer: x3, but not on an Upgrader win
    ctx.earn(amount);
    ctx.emit({ type: "sold", drop: d, amount, combo: s.combo, source: "seller", from, slot });
    return true;
  }
  if (s.tray.length >= ctx.setup.trayCapacity) return false;
  s.tray.push(d);
  ctx.emit({ type: "stored", drop: d, from, slot });
  return true;
}
