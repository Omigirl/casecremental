import type { Lang } from "../../i18n/index";
import { UPGRADER_SPIN_SECONDS } from "../../sim/tuning";
import type { UpgraderSpin } from "../../sim/upgrader";
import type { Pt, Rect } from "../pixel/layout";

// The Upgrader's dial (finish spec §7.2) as pure functions of the sim's spin: the needle turns DIAL_TURNS times and
// eases onto the roll, measured clockwise from the top as a share of the circle; the win arc runs from the top for
// `chance` of it, so the needle lands inside the arc exactly when the roll won. A reload resumes at the same angle.

export const DIAL_TURNS = 3;
export const DIAL_SECTORS = 24;
export const DIAL_FADE_SECONDS = 0.6;
/** A win fades the dial this fast: the won skin pops out on the locker right under it. */
export const DIAL_WIN_FADE_SECONDS = 0.15;
/** The needle's tick sound, at most this many a second however fast it passes the sector lines. */
export const DIAL_TICKS_PER_SECOND = 20;
/** The dial's radius and its lift above the cabinet, world px. */
export const DIAL_R = 13;
const DIAL_LIFT = 18;
const TAU = Math.PI * 2;

const easeOutCubic = (k: number): number => 1 - (1 - k) ** 3;

/** Radians clockwise from the top. */
export function needleAngle(spin: Pick<UpgraderSpin, "roll" | "elapsed">): number {
  const k = Math.min(1, Math.max(0, spin.elapsed / UPGRADER_SPIN_SECONDS));
  return (DIAL_TURNS + spin.roll) * TAU * easeOutCubic(k);
}

export const winArc = (chance: number): { from: number; to: number } => ({ from: 0, to: chance * TAU });

export const landsInArc = (roll: number, chance: number): boolean => roll < chance;

/** Sector lines the needle passed between two frames (its tick sound); `from` null = a reload's first frame: none. */
export function ticksCrossed(from: number | null, to: number): number {
  if (from === null) return 0;
  const step = TAU / DIAL_SECTORS;
  return Math.max(0, Math.floor(to / step + 1e-9) - Math.floor(from / step + 1e-9));
}

export const dialCentre = (locker: Rect): Pt => ({ x: locker.x + locker.w / 2, y: locker.y - DIAL_LIFT });

/** The dial's opacity: full while it spins, then a linear fade after it lands (`sinceDone`) — DIAL_FADE_SECONDS, or
 *  DIAL_WIN_FADE_SECONDS on a win so the won card shows — hidden otherwise. It never pulses. */
export function dialAlpha(spinning: boolean, sinceDone: number, won = false): number {
  if (spinning) return 1;
  return Math.max(0, 1 - sinceDone / (won ? DIAL_WIN_FADE_SECONDS : DIAL_FADE_SECONDS));
}

/** The needle crossed `crossed` sector lines this frame and the last tick sounded `sinceTick` s ago: tick now? */
export const tickDue = (crossed: number, sinceTick: number): boolean => crossed > 0 && sinceTick >= 1 / DIAL_TICKS_PER_SECOND;

/** A number with two significant digits at most, a decimal comma in Russian. */
const short = (n: number, lang: Lang): string => {
  const s = String(Number(n.toPrecision(2)));
  return lang === "ru" ? s.replace(".", ",") : s;
};

/** The labels under the dial: the target ("x10") and the win chance ("9%"). */
export const dialTexts = (mult: number, chance: number, lang: Lang): { mult: string; chance: string } => ({
  mult: `x${lang === "ru" ? String(mult).replace(".", ",") : String(mult)}`,
  chance: `${short(chance * 100, lang)}%`,
});
