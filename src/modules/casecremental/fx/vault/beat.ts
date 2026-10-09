import { VAULT_CUES } from "./cues";

// The fanfare's clock (plan M2b-C6): the drum-and-bass drop lands on the impact and runs at 174 BPM, so every
// pulse in the vault's chaos is locked to it. Pure functions of the sim's t, so a reload lands on the same beat.

export const VAULT_BPM = 174;
const BEAT_SECONDS = 60 / VAULT_BPM;
const BEATS_PER_BAR = 4;
/** How hard a pulse falls away after its hit: (1 − phase)^this. */
const BEAT_DECAY = 3;
const BAR_DECAY = 2.5;

/** Beat index (float) since the impact; negative before it. */
export function beatAt(t: number): number {
  return (t - VAULT_CUES.impact) / BEAT_SECONDS;
}

/** 1 on the hit, decaying to 0 by the next; 0 before the first. */
function pulse(count: number, decay: number): number {
  if (count < 0) return 0;
  return (1 - (count - Math.floor(count))) ** decay;
}

/** 1 at each beat, decaying to 0 by the next (pow curve); 0 before the impact. */
export function beatPulse(t: number): number {
  return pulse(beatAt(t), BEAT_DECAY);
}

/** The same for bars (4 beats). */
export function barPulse(t: number): number {
  return pulse(beatAt(t) / BEATS_PER_BAR, BAR_DECAY);
}
