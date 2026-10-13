import type { AutoSpinStatus } from "../../sim/autoSpin";
import type { Pt, Rect } from "../pixel/layout";

// Auto-spin's arm (finish spec §3), as pure rules so a reload lands on the same picture: its frame from how long ago it
// last bought and turned the key, its lamp from the sim's status, and where a tap switches it.

/** How long the lever stays pulled after a buy, and the arm out after the key (seconds). */
export const ARM_PULL_SECONDS = 0.25;
export const ARM_TURN_SECONDS = 0.3;
export const LAMP_ON = 0x3ddc84;
export const LAMP_OFF = 0x5a1a1a;
export const LAMP_WAIT = 0xffb020;

/** The arm's frame from the seconds since its last buy and its last key turn (Infinity = not this session). */
export function armFrame(sincePull: number, sinceKey: number): 0 | 1 | 2 {
  const pulling = sincePull < ARM_PULL_SECONDS;
  const turning = sinceKey < ARM_TURN_SECONDS;
  if (pulling && turning) return sinceKey <= sincePull ? 2 : 1;
  return turning ? 2 : pulling ? 1 : 0;
}

/** Green at work, dark red when off, amber waiting for the vault, amber blinking at 2 Hz when BROKE (a 2 px lamp: far
 *  under the full-screen flash rule). */
export function lampColor(status: AutoSpinStatus, t: number): number {
  if (status === "on") return LAMP_ON;
  if (status === "off") return LAMP_OFF;
  if (status === "vault") return LAMP_WAIT;
  return Math.floor(t * 4) % 2 === 0 ? LAMP_WAIT : LAMP_OFF;
}

/** The HD glow's colour: the lamp's, except BROKE holds it steady amber (only the 2 px lamp blinks: a 60 px additive
 *  glow flipping amber/dark red at 2 Hz would swing the light by far more than 0.1 per beat). */
export const glowColor = (status: AutoSpinStatus, t: number): number => (status === "broke" ? LAMP_WAIT : lampColor(status, t));

/** A tap on the arm, or 1 px around it (it is small), switches it. */
export const armHit = (r: Rect, p: Pt): boolean => p.x >= r.x - 1 && p.y >= r.y - 1 && p.x < r.x + r.w + 1 && p.y < r.y + r.h + 1;
