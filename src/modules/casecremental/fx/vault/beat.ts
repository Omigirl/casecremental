import { VAULT_CUES } from "./cues";

// The fanfare's clock (plans M2b-C6, C8): the chiptune fanfare's drop lands on the impact and runs at 120 BPM, so
// every pulse in the vault's chaos is locked to it. Silent through the intro (its hits are cues.ts INTRO_HITS).
// Pure functions of the sim's t, so a reload lands on the same beat.

export const VAULT_BPM = 120;
/** How much each light throbs on the beat (alpha 0–1). Each stays under 0.1 so a beat is never a flash, whatever
 *  the tempo (WCAG 2.3.1; a sustained throb is a flash sequence, and 120 BPM is 2 pulses a second). */
export const BEAT_LIGHT_AMPLITUDES = { chestGlow: 0.09, mouthLight: 0.09, starburst: 0.08 } as const;
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
