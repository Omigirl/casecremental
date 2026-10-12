import type { Rect } from "../fx/pixel/layout";

// Where the tutorial's bubble and arrow go (finish spec §4): beside the target, never over it, inside the overlay
// where they fit; on portrait only above or below. Overlay CSS px throughout. Pure: Tutorial.tsx measures, this places.

/** A bubble's text is at most this many characters wide (Press Start 2P: a character is the font size wide), so every
 *  tutorial line wraps into 3 lines (i18n.test.ts); ui/styles.ts .cc-tut uses the same number. */
export const BUBBLE_CHARS = 24;

export type Side = "above" | "below" | "left" | "right";
export interface Size {
  w: number;
  h: number;
}
export interface PlaceOptions {
  /** Space between the bubble and its target; the arrow sits in it. */
  gap: number;
  /** The arrow's square box (smaller than the gap). */
  arrow: number;
  /** Kept clear at the overlay's edges. */
  margin: number;
  portrait: boolean;
}
export interface Placement {
  x: number;
  y: number;
  side: Side;
  /** The arrow box's top-left. */
  arrowX: number;
  arrowY: number;
}

/** v within [lo, hi]; lo when the range is empty (a bubble wider than the overlay keeps its margin). */
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Above, else below, else (landscape) left, else right: the first side where the bubble fits inside the overlay; if
 *  none fits, the side with the most room. The cross axis only slides, so the bubble never comes over the target. */
export function placeBubble(target: Rect, bubble: Size, area: Size, o: PlaceOptions): Placement {
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const across = (c: number, size: number, room: number) => clamp(c - size / 2, o.margin, room - o.margin - size);
  const at = (side: Side): { x: number; y: number } => {
    switch (side) {
      case "above":
        return { x: across(cx, bubble.w, area.w), y: target.y - o.gap - bubble.h };
      case "below":
        return { x: across(cx, bubble.w, area.w), y: target.y + target.h + o.gap };
      case "left":
        return { x: target.x - o.gap - bubble.w, y: across(cy, bubble.h, area.h) };
      case "right":
        return { x: target.x + target.w + o.gap, y: across(cy, bubble.h, area.h) };
    }
  };
  const fits = (q: { x: number; y: number }) =>
    q.x >= o.margin - 0.5 &&
    q.y >= o.margin - 0.5 &&
    q.x + bubble.w <= area.w - o.margin + 0.5 &&
    q.y + bubble.h <= area.h - o.margin + 0.5;
  const sides: Side[] = o.portrait ? ["above", "below"] : ["above", "below", "left", "right"];
  const room: Record<Side, number> = {
    above: target.y,
    below: area.h - target.y - target.h,
    left: target.x,
    right: area.w - target.x - target.w,
  };
  const side = sides.find((s) => fits(at(s))) ?? sides.reduce((a, b) => (room[b] > room[a] ? b : a));
  const p = at(side);
  const mid = (o.gap - o.arrow) / 2; // the arrow centred in the gap
  const along = (c: number, start: number, size: number) => clamp(c - o.arrow / 2, start, start + size - o.arrow);
  const arrow =
    side === "above"
      ? { arrowX: along(cx, p.x, bubble.w), arrowY: target.y - o.gap + mid }
      : side === "below"
        ? { arrowX: along(cx, p.x, bubble.w), arrowY: target.y + target.h + mid }
        : side === "left"
          ? { arrowX: target.x - o.gap + mid, arrowY: along(cy, p.y, bubble.h) }
          : { arrowX: target.x + target.w + mid, arrowY: along(cy, p.y, bubble.h) };
  return { ...p, side, ...arrow };
}

/** The arrow glyph points down: how each side turns it toward the target, and its bob (one world px, k CSS px, toward
 *  the target; motion only, no light change). */
export function arrowLook(side: Side, k: number): { rotate: string; bobX: number; bobY: number } {
  switch (side) {
    case "above":
      return { rotate: "0deg", bobX: 0, bobY: k };
    case "below":
      return { rotate: "180deg", bobX: 0, bobY: -k };
    case "left":
      return { rotate: "-90deg", bobX: k, bobY: 0 };
    case "right":
      return { rotate: "90deg", bobX: -k, bobY: 0 };
  }
}

/** Two placements that draw the same (to the whole pixel): the overlay re-renders only when one moved. */
export function samePlace(a: Placement | null, b: Placement | null): boolean {
  if (!a || !b) return a === b;
  const r = Math.round;
  return a.side === b.side && r(a.x) === r(b.x) && r(a.y) === r(b.y) && r(a.arrowX) === r(b.arrowX) && r(a.arrowY) === r(b.arrowY);
}
