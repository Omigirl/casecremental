import { evolved } from "../../sim/evolved";
import type { Bench, RunState } from "../../sim/run";
import { HOT_HAND_MIN_COMBO } from "../../sim/tuning";
import { benchReelArea, ITEM_SIZE, type Pt, type Rect, type TableLayout } from "../pixel/layout";

// The evolutions' looks on the table (finish spec §7.3), as pure functions of the layout and the sim's state, so a
// reload draws the same picture: Slot Machine's gold frame, Assembly Line's belt; Cartel's shades, Money Printer's
// bills, Hot Hand's flames.

/** World px the gold frame stands out around the reel window. */
export const SLOT_FRAME_PAD = 3;

/** Slot Machine's frame: around the one-reel window, or the tall window while more than one reel spins. */
export function slotFrameRect(l: TableLayout, b: Bench): Rect {
  const n = b.phase === "spinning" ? b.reels.length : 1;
  const r = benchReelArea(l, n, n > 1);
  return { x: r.x - SLOT_FRAME_PAD, y: r.y - SLOT_FRAME_PAD, w: r.w + 2 * SLOT_FRAME_PAD, h: r.h + 2 * SLOT_FRAME_PAD };
}

/** The belt's thickness, world px; a belt shorter than BELT_MIN_W is not drawn. */
export const BELT_H = 4;
const BELT_MIN_W = 16;
/** The rollers' stripes slide this fast (world px / s) while auto-spin is on. */
export const BELT_SPEED = 14;
/** A roller stripe every this many world px. */
export const BELT_STRIPE = 4;
export const BELT_RIDE_SECONDS = 0.4;

/** Assembly Line's belt: under the case's floor line, from the table's left end to just left of the case; null when
 *  the table leaves no room. */
export function beltRect(l: TableLayout): Rect | null {
  const right = Math.floor(l.you.caseSpot.x - ITEM_SIZE.case.w / 2) - 1;
  const left = l.table.x + 2;
  if (right - left < BELT_MIN_W) return null;
  return { x: left, y: Math.round(l.you.caseSpot.y) - BELT_H, w: right - left, h: BELT_H };
}

/** A case riding the belt `t` s after the buy: from its start into the case spot (ease-out); null once it is in. */
export function rideAt(belt: Rect, to: Pt, t: number): Pt | null {
  if (t >= BELT_RIDE_SECONDS) return null;
  const k = 1 - (1 - Math.max(0, t / BELT_RIDE_SECONDS)) ** 2;
  return { x: belt.x + (to.x - belt.x) * k, y: to.y };
}

/** Cartel's shades: a 3-px bar over the bot's eyes (an open eye is 3 px tall) (its art's per-frame eye points, so they follow every pose),
 *  SHADES_MARGIN px past each eye; null when no eyes show (asleep). In the eyes' coordinates. */
const SHADES_MARGIN = 4;
export function shadesRect(eyes: readonly Pt[]): Rect | null {
  if (!eyes.length) return null;
  const xs = eyes.map((e) => e.x);
  const y = Math.min(...eyes.map((e) => e.y));
  const x = Math.min(...xs) - SHADES_MARGIN;
  return { x, y: y - 1, w: Math.max(...xs) + SHADES_MARGIN + 1 - x, h: 3 };
}

/** Cartel's chain: a 1-px gold arc CHAIN_W wide hanging CHAIN_DROP px under the eyes, centred a little left of them
 *  (the visor sits right of the bot's body), sagging CHAIN_SAG px to a 2 × 2 medallion. The box it fills. */
export const CHAIN_W = 13;
export const CHAIN_SAG = 3;
const CHAIN_DROP = 6;
const CHAIN_DX = -3;
export function chainRect(eyes: readonly Pt[]): Rect | null {
  if (!eyes.length) return null;
  const mid = eyes.reduce((a, e) => a + e.x, 0) / eyes.length;
  const y = Math.max(...eyes.map((e) => e.y)) + CHAIN_DROP;
  return { x: Math.round(mid + CHAIN_DX - CHAIN_W / 2), y, w: CHAIN_W, h: CHAIN_SAG + 2 };
}

/** Money Printer's bills: at most BILLS_MAX in the air, BILLS_PER_SALE per seller sale while there is room. */
export const BILLS_MAX = 40;
export const BILLS_PER_SALE = 3;
export const BILL_FLIGHT_SECONDS = 0.7;
export const billsToLaunch = (alive: number, sales: number): number => Math.max(0, Math.min(BILLS_MAX - alive, sales * BILLS_PER_SALE));

/** Hot Hand's flames: FLAME_TONGUES tongues of fire standing on the pointer (a fixed set of sprites, never more), each
 *  swaying and stretching on its own phase. Their opacity holds within FLAME_ALPHA ± FLAME_FLICKER / 2 — a span under
 *  0.1 (photosensitivity) — and under reduced motion (`still`) they stand still. Offsets in world px from the
 *  pointer; scales of the baked flame. */
export const FLAME_TONGUES = 5;
export const FLAME_ALPHA = 0.9;
export const FLAME_FLICKER = 0.06;
/** Each tongue's place beside the pointer (world px) and size; the biggest stands on it. */
const TONGUES: ReadonlyArray<{ dx: number; size: number }> = [
  { dx: -6, size: 0.5 },
  { dx: 6, size: 0.55 },
  { dx: -3, size: 0.75 },
  { dx: 3, size: 0.7 },
  { dx: 0, size: 1 },
];
export interface Tongue {
  dx: number;
  sx: number;
  sy: number;
  alpha: number;
}
export function flameTongues(t: number, still: boolean): Tongue[] {
  return TONGUES.map((g, i) => {
    const ph = still ? 0 : t * (5 + i) + i * 1.7; // radians: about one sway a second, no two tongues in step
    return {
      dx: g.dx + 0.6 * Math.sin(ph * 0.7),
      sx: g.size * (1 + 0.08 * Math.sin(ph)),
      sy: g.size * (1 + 0.18 * Math.sin(ph * 1.3)),
      alpha: FLAME_ALPHA + (FLAME_FLICKER / 2) * Math.sin(ph * 0.9),
    };
  });
}

/** Hot Hand burns: owned, and the combo at least HOT_HAND_MIN_COMBO. */
export const hotHand = (s: Pick<RunState, "evolutions" | "combo">): boolean => evolved(s, "hotHand") && s.combo >= HOT_HAND_MIN_COMBO;
