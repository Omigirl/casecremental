import { upgradeName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import type { RecipePart } from "../sim/evolutions";
import { RARITY_ORDER } from "../sim/rarity";
import { UPGRADER_MULTS } from "../sim/tuning";
import type { RarityId } from "../sim/types";

// Run 4's Machines rows (finish spec §7.2, §7.3), as pure rules: what CHANGE picks next, how a chance and a recipe
// line are written.

/** The next stake: the next rarity up that the locker holds, then none, then the lowest again. */
export function nextStake(stakes: readonly RarityId[], current: RarityId | null): RarityId | null {
  if (current === null) return stakes[0] ?? null;
  const from = RARITY_ORDER.indexOf(current);
  return stakes.find((r) => RARITY_ORDER.indexOf(r) > from) ?? null;
}

export const nextTarget = (target: number): number => (target + 1) % UPGRADER_MULTS.length;

/** A chance as a percentage with two significant digits at most ("60", "11", "0.9"). */
export const percent = (chance: number): string => String(Number((chance * 100).toPrecision(2)));

/** `percent` in the player's language (a decimal comma in Russian), for the GO button. */
export const percentText = (chance: number): string => (getLang() === "ru" ? percent(chance).replace(".", ",") : percent(chance));

/** One recipe line ("Quick Hands MAX", "Hand combo 31/50"). */
export function partText(p: RecipePart, have: number | null): string {
  if (p.kind === "combo") return t("evo.part.combo", { n: Math.min(have ?? 0, p.n), max: p.n });
  const name = p.kind === "upgrade" ? upgradeName(p.id) : t(`evo.part.${p.kind}` as const);
  return t("evo.part.max", { name });
}
