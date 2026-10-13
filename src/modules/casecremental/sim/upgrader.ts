import { runContent } from "./campaign";
import type { CharmId } from "./charms";
import { caseById } from "./content/cases";
import { lockerWaiting } from "./locker";
import { RARITY_ORDER } from "./rarity";
import type { Rng } from "./rng";
import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
import {
  LOADED_DICE_MULT,
  UPGRADER_COST,
  UPGRADER_MAX_CHANCE,
  UPGRADER_MULTS,
  UPGRADER_RARITY_STEPS,
  UPGRADER_SPIN_SECONDS,
  UPGRADER_WIN_BASE,
} from "./tuning";
import type { Drop, RarityId } from "./types";
import { wearOf } from "./wear";

// The Upgrader (Run 4, finish spec §7.2): a machine on the locker. Pick a rarity stack from the locker as the
// stake, a multiplier, and press GO: the whole stack leaves, and the dial spins on the locker's press. The outcome
// and a win's skin are rolled at GO, so a reload mid-spin ends the same way. A win's skin waits on top of the
// locker like a contract result; a loss is just gone. While it spins the press is busy (locker.ts).

export interface UpgraderSpin {
  rarity: RarityId;
  inputs: Drop[];
  mult: number;
  chance: number;
  /** Rolled at GO in [0, 1): a win when below `chance`. The dial's needle lands here. */
  roll: number;
  /** The skin a win pays (rolled at GO too); null on a loss. */
  result: Drop | null;
  elapsed: number;
}

export interface UpgraderState {
  on: boolean;
  /** The locker rarity staked at GO; null = none picked. It stays picked across spins. */
  stake: RarityId | null;
  /** Index into UPGRADER_MULTS. */
  target: number;
  spin: UpgraderSpin | null;
}

export const freshUpgrader = (): UpgraderState => ({ on: false, stake: null, target: 0, spin: null });

/** 0.9 / multiplier, x1.1 with Loaded Dice (0.99 / multiplier: the EV never passes 1), never past 0.95. */
export function upgraderChance(mult: number, charms: readonly CharmId[]): number {
  const dice = charms.includes("loadedDice") ? LOADED_DICE_MULT : 1;
  return Math.min(UPGRADER_MAX_CHANCE, (UPGRADER_WIN_BASE / mult) * dice);
}

/** How many rarities above the stake's a win pays at this multiplier. */
export function rarityStepsFor(mult: number): number {
  return (UPGRADER_RARITY_STEPS.find(([max]) => mult <= max) ?? UPGRADER_RARITY_STEPS[UPGRADER_RARITY_STEPS.length - 1]!)[1];
}

/** A win's skin: `rarityStepsFor` above the stake's (up to ★), from a case drawn from the inputs weighted by count,
 *  the inputs' mean float, StatTrak only if all were; worth the inputs' summed value × the multiplier. */
export function upgraderResult(inputs: readonly Drop[], mult: number, rng: Rng, nextId: () => number): Drop {
  const from = RARITY_ORDER.indexOf(inputs[0]!.rarity);
  const rarity = RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, from + rarityStepsFor(mult))]!;
  const caseId = rng.pick(inputs).caseId; // a random input: weighted by count
  const skin = rng.pick(caseById(caseId).skins.filter((s) => s.rarity === rarity));
  const float = inputs.reduce((a, d) => a + d.float, 0) / inputs.length;
  const statTrak = inputs.every((d) => d.statTrak);
  const value = inputs.reduce((a, d) => a + d.value, 0) * mult;
  return { id: nextId(), caseId, skinId: skin.id, rarity, float, wear: wearOf(float).id, statTrak, value, upgraded: true };
}

/** The locker items GO would stake now (all of the stake rarity; none when no stake is picked). */
export const stakeItems = (ctx: RunCtx): Drop[] => {
  const stake = ctx.state.upgrader.stake;
  return stake ? ctx.state.locker.items.filter((d) => d.rarity === stake) : [];
};

export function buyUpgrader(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!runContent(ctx.setup.run).upgrader) return fail("not in this run");
  if (!s.locker.on) return fail("buy the locker first");
  if (s.upgrader.on) return fail("the upgrader is already bought");
  if (s.cash < UPGRADER_COST) return fail("not enough cash");
  s.cash -= UPGRADER_COST;
  s.upgrader.on = true;
  ctx.emit({ type: "upgraderBought" });
  return OK;
}

/** The rarity stack to stake (null = none). Any rarity; GO checks the locker holds some. */
export function setUpgraderStake(ctx: RunCtx, r: RarityId | null): ActionResult {
  ctx.state.upgrader.stake = r;
  return OK;
}

/** The target multiplier, as an index into UPGRADER_MULTS. */
export function setUpgraderTarget(ctx: RunCtx, index: number): ActionResult {
  if (!Number.isInteger(index) || index < 0 || index >= UPGRADER_MULTS.length) return fail("unknown target");
  ctx.state.upgrader.target = index;
  return OK;
}

export function upgraderGo(ctx: RunCtx): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  const u = s.upgrader;
  if (!u.on) return fail("buy the upgrader first");
  if (u.spin) return fail("the upgrader is spinning");
  if (s.locker.press) return fail("the press is busy");
  if (lockerWaiting(s.locker)) return fail("take the results first");
  if (!u.stake) return fail("pick a stake first");
  const inputs = stakeItems(ctx);
  if (inputs.length === 0) return fail("nothing to stake");
  const rarity = u.stake;
  s.locker.items = s.locker.items.filter((d) => d.rarity !== rarity);
  const mult = UPGRADER_MULTS[u.target]!;
  const chance = upgraderChance(mult, ctx.setup.charms);
  const roll = ctx.rng.next();
  const result = roll < chance ? upgraderResult(inputs, mult, ctx.rng, () => s.nextDropId++) : null;
  u.spin = { rarity, inputs, mult, chance, roll, result, elapsed: 0 };
  ctx.emit({ type: "upgraderStarted", rarity, inputs, mult, chance, roll, win: result !== null });
  return OK;
}

/** The vault was bought mid-spin: a win's skin is cashed in at once (like the locker's waiting results), a loss
 *  is gone. */
export function settleUpgrader(ctx: RunCtx): void {
  const s = ctx.state;
  const spin = s.upgrader.spin;
  if (!spin) return;
  s.upgrader.spin = null;
  if (!spin.result) return;
  const amount = ctx.payout(spin.result, false);
  ctx.earn(amount);
  ctx.emit({ type: "sold", drop: spin.result, amount, combo: s.combo, source: "locker", from: "locker", slot: 0 });
}

/** The dial: a win's skin pops onto the locker when the spin ends. */
export function tickUpgrader(ctx: RunCtx, dt: number): void {
  const s = ctx.state;
  const spin = s.upgrader.spin;
  if (!spin || ctx.locked()) return;
  spin.elapsed += dt;
  if (spin.elapsed < UPGRADER_SPIN_SECONDS) return;
  s.upgrader.spin = null;
  if (spin.result) {
    s.locker.cards = [spin.result];
    s.locker.cardAt = s.time;
    ctx.onReveal(spin.result, "locker");
    ctx.countReveals(1);
  }
  ctx.emit({ type: "upgraderDone", win: spin.result !== null, result: spin.result, inputs: spin.inputs });
}
