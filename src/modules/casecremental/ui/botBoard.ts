import type { Lang } from "../i18n/index";
import { RARITY_ORDER } from "../sim/rarity";
import type { RarityId } from "../sim/types";

// Small helpers for the Bot tab: the bot's case and the auto-seller's threshold cycle through their options, the speed reads "x1.5".

export const SELL_THRESHOLDS: readonly RarityId[] = RARITY_ORDER;

export function nextThreshold(r: RarityId): RarityId {
  const i = SELL_THRESHOLDS.indexOf(r);
  return SELL_THRESHOLDS[(i + 1) % SELL_THRESHOLDS.length]!;
}

/** The bot's case choice cycles: the best affordable (null), then each unlocked case, then back. */
export function nextBotCase(choice: string | null, unlocked: readonly string[]): string | null {
  if (choice === null) return unlocked[0] ?? null;
  const i = unlocked.indexOf(choice);
  return i < 0 || i === unlocked.length - 1 ? null : unlocked[i + 1]!;
}

export function formatSpeed(speed: number, lang: Lang): string {
  const s = String(Math.round(speed * 10) / 10);
  return lang === "ru" ? s.replace(".", ",") : s;
}

export const cssColor = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
