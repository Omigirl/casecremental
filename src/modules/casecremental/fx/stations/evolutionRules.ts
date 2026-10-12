import type { Bench } from "../../sim/run";
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
