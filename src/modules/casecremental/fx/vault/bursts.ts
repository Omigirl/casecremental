import { RARITY_INFO } from "../../sim/rarity";
import type { Drop } from "../../sim/types";
import type { Pt } from "../pixel/layout";

// Where the vault's bursts go off on screen, and in which colour: each kick of VAULT_CUES.fireworks at its own
// spot, the corners and sides as well as the sky, and each of the intro's run-up hits (cues.ts INTRO_HITS) at a
// spot of its own, so the same burst lands in the same place live or after a reload (give or take a little
// jitter); coloured by what has landed so far, or festive.

/** The festive colours (a click's sparks, a burst before anything has landed). */
export const FIREWORK_COLORS: readonly number[] = [
  RARITY_INFO.covert.color,
  RARITY_INFO.gold.color,
  RARITY_INFO.classified.color,
  0xffffff,
  0x7affc1,
];

/** Shares of the screen: kick i bursts at spot i (wrapping). */
const SPOTS: readonly (readonly [number, number])[] = [
  [0.5, 0.14],
  [0.1, 0.12],
  [0.9, 0.16],
  [0.08, 0.52],
  [0.92, 0.46],
  [0.3, 0.3],
  [0.7, 0.26],
  [0.1, 0.86],
  [0.9, 0.84],
  [0.5, 0.4],
];
const JITTER = 0.06;
/** An intro hit walks the spots in steps of this many, so the run-up's bursts swing from side to side. */
const INTRO_STEP = 7;

/** Kick `index`'s spot on a `screen` (screen px), jittered by `random` (0-1). */
export function kickSpot(index: number, screen: { w: number; h: number }, random = Math.random): Pt {
  const [sx, sy] = SPOTS[index % SPOTS.length]!;
  const jitter = () => (random() - 0.5) * 2 * JITTER;
  return { x: screen.w * (sx + jitter()), y: screen.h * (sy + jitter()) };
}

/** Intro hit `index`'s spot (screen px): a different spot for each hit of the run-up. */
export function introSpot(index: number, screen: { w: number; h: number }, random = Math.random): Pt {
  return kickSpot(index * INTRO_STEP, screen, random);
}

/** How far along the spots a wilder vault's extra bursts on a kick go: across the screen from the kick's own. */
const EXTRA_STEPS = [5, 3, 7] as const;

/** Kick `index`'s bursts on a `screen` (screen px): `n` of them (vaultLooks burstsPerKick). The first two on the
 *  kick's own spot, as Vault I has always burst; any more each on a spot of its own across the screen. Points only:
 *  a burst is particles, never a flash or a sound (the kick plays its one sound). */
export function kickBursts(index: number, n: number, screen: { w: number; h: number }, random = Math.random): Pt[] {
  const own = kickSpot(index, screen, random);
  const out: Pt[] = n >= 2 ? [own, own] : n === 1 ? [own] : [];
  for (let e = 0; out.length < n; e++) out.push(kickSpot(index + EXTRA_STEPS[e % EXTRA_STEPS.length]!, screen, random));
  return out;
}

/** One of `xs` at random. */
export function pick<T>(xs: readonly T[], random = Math.random): T {
  return xs[Math.floor(random() * xs.length)]!;
}

/** A burst's colour: mostly a landed drop's rarity colour (the sky celebrates what came out), else a festive one. */
export function burstColor(landed: readonly Drop[], random = Math.random): number {
  if (landed.length && random() < 0.6) return RARITY_INFO[pick(landed, random).rarity].color;
  return pick(FIREWORK_COLORS, random);
}
