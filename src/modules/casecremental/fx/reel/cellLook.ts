import { SKIN_H } from "../skins/motion";

// How a reel draws its cells at a given height (F1). The full art when it fits; the art shrunk (skins/thumb.ts) on a
// short stacked strip; clean rarity tiles where even that would not read. A short reel swaps the 6-px nine-slice frame
// (squashed into noise below 16 px) for a 1-px drawn one. Cells always have a dark 2-px gap between them.

export type ReelFrameKind = "slice" | "thin";

export interface CellLook {
  frame: ReelFrameKind;
  /** px from the reel's edge to its window (the clip). */
  inset: number;
  /** One cell's pitch: the card plus the gap after it. */
  cellW: number;
  gap: number;
  /** The rarity bar under the art (0 on a tile). */
  bar: number;
  /** The box the art is fitted into, or null for a plain rarity tile. */
  artBox: { w: number; h: number } | null;
}

/** Below this height a reel draws the thin frame. */
export const SLICE_MIN_H = 16;
/** The full-size card's pitch (the single reel's, unchanged since M1). */
export const ART_CELL_W = 30;
/** The pitch on a short strip: still wide enough that a fake tease's sliver (0.43 of a card) lands on the card. */
export const SMALL_CELL_W = 24;
export const CELL_GAP = 2;
/** The shortest art that still reads as a weapon: half the skin's height. */
const MIN_ART_H = Math.ceil(SKIN_H / 2);

export function cellLook(reelH: number): CellLook {
  const frame: ReelFrameKind = reelH >= SLICE_MIN_H ? "slice" : "thin";
  const inset = frame === "slice" ? 3 : 1;
  const inner = Math.max(0, reelH - 2 * inset);
  if (inner >= SKIN_H + 2)
    return { frame, inset, cellW: ART_CELL_W, gap: CELL_GAP, bar: 2, artBox: { w: ART_CELL_W - CELL_GAP, h: inner - 2 } };
  if (inner >= MIN_ART_H + 1)
    return { frame, inset, cellW: SMALL_CELL_W, gap: CELL_GAP, bar: 1, artBox: { w: SMALL_CELL_W - CELL_GAP, h: inner - 1 } };
  return { frame, inset, cellW: SMALL_CELL_W, gap: CELL_GAP, bar: 0, artBox: null };
}
