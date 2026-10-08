import type { Lang } from "../i18n/index";
import { RARITY_ORDER } from "../sim/rarity";
import type { RarityId } from "../sim/types";

// Small helpers for the Bot tab: the sell threshold cycles through the rarities, the speed reads "x1.5".

export const SELL_THRESHOLDS: readonly RarityId[] = RARITY_ORDER;

export function nextThreshold(r: RarityId): RarityId {
  const i = SELL_THRESHOLDS.indexOf(r);
  return SELL_THRESHOLDS[(i + 1) % SELL_THRESHOLDS.length]!;
}

export function formatSpeed(speed: number, lang: Lang): string {
  const s = String(Math.round(speed * 10) / 10);
  return lang === "ru" ? s.replace(".", ",") : s;
}

export const cssColor = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
