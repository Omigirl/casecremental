import { beatPulse } from "./beat";
import { INTRO_HITS, introHit, VAULT_CUES } from "./cues";

// How wild the vault gets, second by second (plans M2b-C6, C8): still through the intro (only its run-up punches
// in), everything at full tilt from the drop through the spin and the lock-ins, easing off through the count-up
// into the hold. Each channel is an envelope (0-1) that the chaos layer multiplies with the beat's pulses. Pure
// functions of the sim's t, so a reload or a lobby trip lands on the same chaos with nothing replayed.

export interface ChaosLevels {
  /** The camera's beat-locked shake and sway. */
  shake: number;
  /** The kicks' zoom punches and the beams' width pulse. */
  zoom: number;
  /** How far the colours cycle. */
  hue: number;
  /** Coins, stars and confetti falling across the screen. */
  rain: number;
  /** Side sparks from the screen edges on the bars. */
  sparks: number;
  /** The rewards' bob, the labels' and the total's wobble (kept tiny by the layer). */
  wobble: number;
  /** The stripes, the starburst and the room behind. */
  background: number;
}

const C = VAULT_CUES;
/** The drop's surge settles into full tilt by the spin. */
const SURGE_FROM = 0.75;
/** The count-up softens the chaos to here, and the hold to here. */
const COUNTED = 0.55;
const HOLD = 0.25;
const HOLD_BY = C.impact + 12;
/** The rain needs a moment to reach the floor. */
const RAIN_IN_SECONDS = 0.5;
/** A kick's zoom punch dies away over this long (under the volley's 0.35 s gap). */
const KICK_SECONDS = 0.3;
/** Photosensitivity: at most this many full-screen flashes in any 1-second window. */
const FLASHES_PER_SECOND = 3;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
const smooth = (x: number) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};

/** The shared envelope: 0 before the impact, surging to 1 by the spin, held through the lock-ins, then easing. */
function envelope(t: number): number {
  if (t < C.impact) return 0;
  if (t < C.spinFrom) return SURGE_FROM + (1 - SURGE_FROM) * easeOut((t - C.impact) / (C.spinFrom - C.impact));
  if (t < C.celebrateFrom) return 1;
  if (t < C.celebrateTo) return 1 - (1 - COUNTED) * smooth((t - C.celebrateFrom) / (C.celebrateTo - C.celebrateFrom));
  return COUNTED - (COUNTED - HOLD) * smooth((t - C.celebrateTo) / (HOLD_BY - C.celebrateTo));
}

export function chaosLevels(t: number): ChaosLevels {
  const e = envelope(t);
  const rain = e * easeOut((t - C.impact) / RAIN_IN_SECONDS);
  return { shake: e, zoom: e, hue: e, rain, sparks: e, wobble: e, background: e };
}

/** The drop's beat at the chaos's strength (0-1): what the chest bounces to, the starburst and the total pulse
 *  to. A function of t alone, so the chest reads this frame's beat before the chaos layer has moved. */
export function chaosBeat(t: number): number {
  return beatPulse(t) * envelope(t);
}

/** 1 on each kick (VAULT_CUES.fireworks), dying away over 0.3 s; 0 between and before the first. */
export function kickPulse(t: number): number {
  let last = -Infinity;
  for (const at of C.fireworks) if (at <= t) last = at;
  const u = (t - last) / KICK_SECONDS;
  return u < 1 ? (1 - u) ** 2 : 0;
}

/** 1 on each of the intro's run-up hits, dying away like the hit (cues.ts); 0 on the build, in the pause and from
 *  the impact on. The chaos layer's zoom punch before the drop. */
export function introPunch(t: number): number {
  const { index, pulse } = introHit(t);
  return index >= 0 && INTRO_HITS[index]!.kind === "run" ? pulse : 0;
}

/** The intro's one full-screen flash: its last run-up hit, just before the impact (within the budget below). */
const INTRO_FLASH = INTRO_HITS[INTRO_HITS.length - 1]!.at;

/** Every full-screen flash of the opening: the intro's last hit, then the kicks; each flashes unless it would be the
 *  4th within a second. The rest of the run-up (0.30-0.35 s apart) jolts and punches instead. */
const FLASHES: readonly number[] = [INTRO_FLASH, ...C.fireworks].reduce<number[]>((out, at) => {
  const back = out[out.length - FLASHES_PER_SECOND];
  if (back === undefined || at - back > 1) out.push(at);
  return out;
}, []);

/** The scheduled full-screen flashes after `from`, up to and including `to`, in time order. */
export function flashTimes(from: number, to: number): number[] {
  return FLASHES.filter((at) => from < at && at <= to);
}

/** The last flash crossed going from `from` to `to` (from < at ≤ to), or null: the per-frame check, allocation-free. */
export function flashCrossed(from: number, to: number): number | null {
  let hit: number | null = null;
  for (const at of FLASHES) if (from < at && at <= to) hit = at;
  return hit;
}
