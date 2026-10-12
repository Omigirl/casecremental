import type { Pt, Rect } from "../pixel/layout";

// The locker's look, as pure functions of the sim's state (spec §5), so a reload mid-press resumes the same picture.
// Cabinet frames: 0 dark (before it is bought), 1 lit, 2 press down, 3 door open.

/** The door stays open this long after a card goes in. */
export const DOOR_OPEN_SECONDS = 0.35;
/** The power-on lights the five lamps one after another, this far apart. */
export const POWER_LAMP_STEP = 0.1;

/** The press (TRADE_UP_SECONDS long): the ten cards fly in over the first 0.9 s, staggered; it stamps down at 1.0 s
 *  and stays down to 1.6 s; then it hums until the result pops (pressDone). */
export const PRESS = { flyIn: 0.9, chipFlight: 0.45, stampAt: 1.0, liftAt: 1.6 } as const;

export const pressStamped = (elapsed: number): boolean => elapsed >= PRESS.stampAt && elapsed < PRESS.liftAt;

export function lockerFrame(on: boolean, pressElapsed: number | null, doorLeft: number): 0 | 1 | 2 | 3 {
  if (!on) return 0;
  if (pressElapsed !== null && pressStamped(pressElapsed)) return 2;
  return doorLeft > 0 ? 3 : 1;
}

/** The built art's door-open frame (3) is drawn 3 px left of the others (its door swings out to the right): it is
 *  shifted back so the cabinet stays put when the door opens. */
export const lockerFrameDx = (frame: number): number => (frame === 3 ? 3 : 0);

/** Card i's (of `count`) flight from the cabinet's door into the press, 0–1, at `elapsed` into the press. */
export function chipProgress(i: number, count: number, elapsed: number): number {
  const stagger = count > 1 ? (PRESS.flyIn - PRESS.chipFlight) / (count - 1) : 0;
  return Math.min(1, Math.max(0, (elapsed - i * stagger) / PRESS.chipFlight));
}

/** The stamp landed between two frames (its sound and shake fire once). `from` null = the first frame after a
 *  reload or a new World: nothing fires. */
export const stampCrossed = (from: number | null, to: number): boolean => from !== null && from < PRESS.stampAt && to >= PRESS.stampAt;

/** The five lamp rows on the cabinet's face (world px), Mil-Spec at the top to ★ at the bottom: a lamp, then its count. */
export function lampRows(r: Rect): Array<{ lamp: Pt; text: Pt }> {
  const rowH = Math.floor((r.h - 2) / 5);
  return Array.from({ length: 5 }, (_, i) => {
    const y = r.y + 1 + i * rowH + rowH / 2;
    return { lamp: { x: r.x + 4, y }, text: { x: r.x + 7, y } };
  });
}

/** The counts' text size (CSS px, a multiple of 8): one lamp row tall at most. */
export const lampFontSize = (scale: number): number => 8 * Math.max(1, Math.floor((scale * 7) / 16));

/** A card the auto-seller's Collect sends in flies this long from its spot into the door (one dragged in by hand
 *  was let go over the cabinet: it just goes in). It lands while the door it opened is still open. */
export const STORE_FLIGHT_SECONDS = 0.3;

/** The cabinet's door (world px): where stored cards go in. */
export const lockerDoor = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + Math.round(r.h * 0.7) });

/** A stored card's place `t` seconds into its flight from `from` into the door `to`, arcing up on the way; null
 *  once it is in. */
export function storeFlightAt(from: Pt, to: Pt, t: number): Pt | null {
  if (t >= STORE_FLIGHT_SECONDS) return null;
  const p = Math.max(0, t / STORE_FLIGHT_SECONDS);
  return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p - 6 * Math.sin(Math.PI * p) };
}
