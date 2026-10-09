import type { Pt } from "../pixel/layout";
import { BEAM_END_SHARE, BEAM_MOUTH_SHARE, type Beam } from "./beams";

// The stream along one of the vault's beams (spec 2026-10-09 §5): which items are out of the chest and on the
// beam, where each sits across it, which are coins, and how big an icon is drawn. Pure, so the pool's bound and
// the stream's shape are tested without Pixi. Distances are screen px from the mouth (see itemDistance).

/** The most items a beam reaching `reach` px can show at once, `spacing` px apart: the pool's size. */
export const maxVisibleItems = (reach: number, spacing: number): number => Math.floor(Math.max(0, reach) / spacing) + 1;

/** The first item of the stream: every item from here on is still inside the chest before the spin, so the
 *  beam starts empty and the items pour out of the mouth. */
export const firstItem = (spotDist: number, spacing: number): number => Math.floor(spotDist / spacing) + 1;

/** The outermost item on the beam (distance ≤ reach) when the strip is at p, but none before `first`. */
export const firstVisible = (p: number, spotDist: number, reach: number, spacing: number, first: number): number =>
  Math.max(first, Math.ceil(p + (spotDist - reach) / spacing));

/** The innermost item out of the chest (distance ≥ 0) when the strip is at p. */
export const lastVisible = (p: number, spotDist: number, spacing: number): number => Math.floor(p + spotDist / spacing);

/** Item j's fixed sideways offset across its beam, in [-1, 1] (a share of a third of the beam's width there):
 *  a hash of the opening's seed and j, so an item keeps its lane as it flies and a reload keeps the scatter. */
export function itemJitter(seed: number, j: number): number {
  let h = (seed ^ Math.imul(j | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return (h / 4294967295) * 2 - 1;
}

/** One item in three is a gold coin; the reward never is. */
export const isCoin = (j: number, target: number): boolean => j !== target && ((j % 3) + 3) % 3 === 2;

/** A whole-number scale (1..k) that fits a w×h texture in a `box`-px icon box: crisp pixels, never bigger than
 *  the world's own scale. */
export const iconScale = (w: number, h: number, box: number, k: number): number =>
  Math.max(1, Math.min(k, Math.floor(box / Math.max(w, h, 1))));

/** The beam's width `d` px from the mouth: narrow at the chest, widening out past the screen edge. */
export const beamWidthAt = (beam: Pick<Beam, "width" | "length">, d: number): number =>
  beam.width * (BEAM_MOUTH_SHARE + ((BEAM_END_SHARE - BEAM_MOUTH_SHARE) * d) / beam.length);

/** Items stream this share of an icon box apart. */
export const STREAM_SPACING = 0.45;
/** Icon boxes per second an item travels along its beam while it spins: 1.5× the calm stream (10 items a second,
 *  0.6 of a box apart), so the denser chaos stream still reads faster. */
export const STREAM_BOXES_PER_SECOND = 9;
/** Items per second past the spot while a beam spins; each beam's exact speed follows from its start, landing and
 *  target (columnMotion). */
export const STREAM_ITEMS_PER_SECOND = STREAM_BOXES_PER_SECOND / STREAM_SPACING;

/** A Pixi layer's transform (a Container's): maps p to position + rotation · scale · (p − pivot). */
interface Layer {
  readonly pivot: { set(x: number, y: number): void };
  readonly position: { set(x: number, y: number): void };
  readonly scale: { set(x: number, y: number): void };
  rotation: number;
}

/** Puts `layer`, in a slot (at `slot`, a plain offset beside the camera under the same parent), on `share` (0-1) of
 *  the beams' camera `cam`: at 1 it draws exactly where the camera draws the beams, at 0 it stays put in its
 *  slot. Nothing is allocated, so it runs every frame. */
export function followCamera(layer: Layer, cam: { pivot: Pt; position: Pt; scale: Pt; rotation: number }, slot: Pt, share: number): void {
  layer.pivot.set(cam.pivot.x, cam.pivot.y);
  layer.position.set(
    cam.pivot.x + share * (cam.position.x - slot.x - cam.pivot.x),
    cam.pivot.y + share * (cam.position.y - slot.y - cam.pivot.y),
  );
  layer.scale.set(1 + share * (cam.scale.x - 1), 1 + share * (cam.scale.y - 1));
  layer.rotation = share * cam.rotation;
}
