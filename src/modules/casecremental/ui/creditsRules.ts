import { rarityName, skinName, weaponName } from "../i18n/content";
import { t, type Lang } from "../i18n/index";
import { skinById } from "../sim/content/cases";
import { formatCash } from "../sim/format";
import type { CampaignStats } from "../sim/meta";
import { RARITY_INFO } from "../sim/rarity";

// The credits after The Last Case (finish spec §7.4): the lines of the scroll, how far it has scrolled, when it can be
// skipped and when it ends. Pure, so the overlay (Credits.tsx) only draws.

export const GAME_NAME = "CASECREMENTAL";
/** The game's maker: the git author of the project. */
export const MADE_BY = "Yerassyl Omirtay";
/** What the game was built with (names, never translated). */
export const TOOLS: readonly string[] = ["iDosGames", "PixiJS", "ElevenLabs", "Claude"];
/** The scroll's length: the last line leaves the screen and the prestige screen follows. */
export const CREDITS_SECONDS = 70;
/** SKIP shows (and works) only after this long. */
export const SKIP_AFTER_SECONDS = 5;

export type CreditLine = { kind: "title" | "head" | "name" | "stat" | "gap"; text: string; color?: string };

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** Whole minutes, with hours from 60 min ("1h 2m", «1 ч 2 мин»), in the current language. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  return m >= 60 ? t("credits.hm", { h: Math.floor(m / 60), m: m % 60 }) : t("credits.m", { m });
}

/** The scroll, top to bottom: the game, its maker, its tools, the thanks, then the campaign's stats. */
export function creditLines(stats: CampaignStats, lang: Lang): CreditLine[] {
  const gap: CreditLine = { kind: "gap", text: "" };
  const lines: CreditLine[] = [
    { kind: "title", text: GAME_NAME, color: "#ffd34d" },
    gap,
    { kind: "head", text: t("credits.madeby") },
    { kind: "name", text: MADE_BY },
    gap,
    { kind: "head", text: t("credits.tools") },
    ...TOOLS.map((text): CreditLine => ({ kind: "name", text })),
    gap,
    { kind: "head", text: t("credits.thanks") },
    gap,
    { kind: "head", text: t("credits.stats") },
    { kind: "stat", text: t("credits.time", { t: formatDuration(stats.playSeconds) }) },
    { kind: "stat", text: t("credits.opened", { n: stats.opened.toLocaleString(lang === "ru" ? "ru-RU" : "en-US") }) },
  ];
  const best = stats.best;
  if (best) {
    const s = skinById(best.skinId);
    lines.push(
      { kind: "stat", text: t("credits.best") },
      { kind: "name", text: `${weaponName(s.weapon)} | ${skinName(s.id)}`, color: hex(RARITY_INFO[best.rarity].color) },
      { kind: "name", text: `${rarityName(best.rarity)} · ${formatCash(best.value, lang)}` },
    );
  }
  lines.push({ kind: "stat", text: t("credits.clout", { n: stats.cloutEarned }) });
  return lines;
}

export const canSkip = (elapsed: number): boolean => elapsed >= SKIP_AFTER_SECONDS;
export const creditsOver = (elapsed: number): boolean => elapsed >= CREDITS_SECONDS;

/** The column's top, px from the screen's top: just below the screen at 0, the last line gone at CREDITS_SECONDS. */
export function scrollY(elapsed: number, contentH: number, viewH: number): number {
  const k = Math.min(1, Math.max(0, elapsed / CREDITS_SECONDS));
  return viewH - (viewH + contentH) * k;
}
