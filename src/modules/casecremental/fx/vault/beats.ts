import { VAULT_CUES } from "./cues";

// The opening's one-shot beats (spec 2026-10-09 §1): each fires once, on the frame the sim's t crosses it. A
// restore sets the previous t to the current one, so nothing before it replays. Pure functions of time.

export type VaultBeat = "keyTurn" | "impact" | "firework" | "celebrate" | "tick" | "countDone";

/** The count-up ticks this often while the total climbs (9.0-11.5). */
export const COUNT_TICK_SECONDS = 0.08;

const C = VAULT_CUES;
const TICKS = Math.floor((C.celebrateTo - C.celebrateFrom) / COUNT_TICK_SECONDS - 1e-9);

/** A beat and its time; a kick also carries its index in VAULT_CUES.fireworks (which spot it bursts at). */
export interface DueBeat {
  readonly at: number;
  readonly beat: VaultBeat;
  readonly kick?: number;
}

/** In time order; at the same time, in this order (the impact before its firework kick). */
const BEATS: readonly DueBeat[] = (
  [
    { at: 0, beat: "keyTurn" },
    { at: C.impact, beat: "impact" },
    ...C.fireworks.map((at, kick) => ({ at, beat: "firework" as const, kick })),
    { at: C.celebrateFrom, beat: "celebrate" },
    ...Array.from({ length: TICKS }, (_, i) => ({ at: C.celebrateFrom + COUNT_TICK_SECONDS * (i + 1), beat: "tick" as const })),
    { at: C.celebrateTo, beat: "countDone" },
  ] satisfies DueBeat[]
).sort((a, b) => a.at - b.at);

/** The beats crossed going from `prevT` to `t` (prevT < at ≤ t), in time order; the ticks a long frame crosses count
 *  once. Each is a shared, read-only entry of the schedule. */
export function dueBeats(prevT: number, t: number): DueBeat[] {
  const out: DueBeat[] = [];
  let ticked = false;
  for (const b of BEATS) {
    if (!(prevT < b.at && t >= b.at)) continue;
    if (b.beat === "tick") {
      if (ticked) continue;
      ticked = true;
    }
    out.push(b);
  }
  return out;
}

const QUIET_FROM = 3.5;
const QUIET_TO = 4.5;
const QUIET = 0.4;
const EDGE = 0.25;

/** The spin breathes: the particles are lighter at 3.5-4.5 than either side of it, so it is not constant noise. */
export function breath(t: number): number {
  const dip = Math.min(1, Math.max(0, Math.min(t - QUIET_FROM, QUIET_TO - t) / EDGE)); // eased over a quarter-second
  return 1 - (1 - QUIET) * dip;
}
