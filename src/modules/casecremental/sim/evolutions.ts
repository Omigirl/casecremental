import { AUTOSPIN_DELAY_LEVELS } from "./autoSpin";
import { SELLER_SPEED_LEVELS } from "./autoSeller";
import { botSpeedLevels } from "./botOpener";
import { runContent } from "./campaign";
import { EVOLUTION_IDS, evolved, type EvolutionId } from "./evolved";
import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
import { EVOLUTION_COSTS, HOT_HAND_RECIPE_COMBO } from "./tuning";
import { upgradeCap, type UpgradeId } from "./upgrades";

// Evolutions (Run 4, finish spec §7.3): each unlocks when its recipe is complete (two upgrades at this run's cap,
// or Luck plus a hand combo of 50), then costs one purchase. Their effects are hooks in evolved.ts that the bench,
// the bot, the auto-seller and auto-spin call.

/** One line of a recipe: an upgrade at this run's cap, a machine's top level, or a hand combo reached this run. */
export type RecipePart =
  | { kind: "upgrade"; id: UpgradeId }
  | { kind: "botSpeed" }
  | { kind: "sellerSpeed" }
  | { kind: "autoSpinDelay" }
  | { kind: "combo"; n: number };

export const RECIPES: Readonly<Record<EvolutionId, readonly RecipePart[]>> = {
  slotMachine: [
    { kind: "upgrade", id: "quickHands" },
    { kind: "upgrade", id: "multiOpen" },
  ],
  cartel: [{ kind: "botSpeed" }, { kind: "upgrade", id: "luck" }],
  moneyPrinter: [{ kind: "upgrade", id: "appraiser" }, { kind: "sellerSpeed" }],
  assemblyLine: [{ kind: "autoSpinDelay" }, { kind: "upgrade", id: "multiOpen" }],
  hotHand: [
    { kind: "upgrade", id: "luck" },
    { kind: "combo", n: HOT_HAND_RECIPE_COMBO },
  ],
};

export function partDone(ctx: Pick<RunCtx, "state" | "setup">, p: RecipePart): boolean {
  const s = ctx.state;
  const run = ctx.setup.run;
  switch (p.kind) {
    case "upgrade":
      return s.upgrades[p.id] >= upgradeCap(p.id, run);
    case "botSpeed":
      return s.bot.speedLevel >= botSpeedLevels(run);
    case "sellerSpeed":
      return s.seller.speedLevel >= SELLER_SPEED_LEVELS;
    case "autoSpinDelay":
      return s.autoSpin.delayLevel >= AUTOSPIN_DELAY_LEVELS;
    case "combo":
      return s.evolutions.bestCombo >= p.n;
  }
}

export const recipeDone = (ctx: Pick<RunCtx, "state" | "setup">, id: EvolutionId): boolean => RECIPES[id].every((p) => partDone(ctx, p));

export function buyEvolution(ctx: RunCtx, id: EvolutionId): ActionResult {
  if (ctx.locked()) return fail("the vault is open");
  const s = ctx.state;
  if (!runContent(ctx.setup.run).evolutions) return fail("not in this run");
  if (!EVOLUTION_IDS.includes(id)) return fail(`unknown evolution: ${id}`);
  if (evolved(s, id)) return fail("already evolved");
  if (!recipeDone(ctx, id)) return fail("finish the recipe first");
  const cost = EVOLUTION_COSTS[id];
  if (s.cash < cost) return fail("not enough cash");
  s.cash -= cost;
  s.evolutions.owned.push(id);
  ctx.emit({ type: "evolved", id });
  return OK;
}

/** Remembers the run's best combo (Hot Hand's recipe). */
export function tickEvolutions(ctx: RunCtx): void {
  const e = ctx.state.evolutions;
  e.bestCombo = Math.max(e.bestCombo, ctx.state.combo);
}
