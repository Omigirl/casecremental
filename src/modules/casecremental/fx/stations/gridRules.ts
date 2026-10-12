import { caseById } from "../../sim/content/cases";
import type { GridCell } from "../../sim/grid";
import { GRID_SIZES } from "../../sim/tuning";
import type { Rect } from "../pixel/layout";

// The auto-buyer grid's look (spec §6), pure: its board of tiny code-drawn case cells in rows of ten over the
// machine's pigeonholes, and each cell's state.

export const GRID_COLS = 10;
export const GRID_MAX_CELLS = Math.max(...GRID_SIZES);
/** The cells' board inside the auto-buyer's frame (frame px): its pigeonholes, right of the hopper — measured from
 *  the built art (assets/sprites/auto-buyer.png). Re-measure if the art is rebuilt. */
export const BOARD_IN_FRAME = { x: 15, y: 17, w: 37, h: 13 } as const;
/** A filled cell flickers this long before it opens. */
export const FLICKER_SECONDS = 0.4;
/** The power-on lights the columns left to right, this far apart. */
export const SWEEP_STEP = 0.05;

export const CELL_EMPTY = 0;
export const CELL_FILLED = 1;
export const CELL_FLICKER = 2;
export const CELL_STALLED = 3;

/** The board in world px, for the machine's footprint `g` (layout.grid; the frame is placed by its ground). */
export function boardRect(g: Rect, frame: { frameW: number; ground: number }): Rect {
  const left = g.x + g.w / 2 - Math.floor(frame.frameW / 2);
  const top = g.y + g.h - frame.ground;
  const w = Math.min(BOARD_IN_FRAME.w, frame.frameW - BOARD_IN_FRAME.x);
  return { x: left + BOARD_IN_FRAME.x, y: top + BOARD_IN_FRAME.y, w, h: BOARD_IN_FRAME.h };
}

/** n cells in rows of ten, left to right then top to bottom, as big as the board allows (at most 3 px each way, 1 px
 *  apart), centred on it. */
export function gridCells(board: Rect, n: number): Rect[] {
  const rows = Math.max(1, Math.ceil(n / GRID_COLS));
  const w = Math.max(1, Math.min(3, Math.floor((board.w + 1) / GRID_COLS) - 1));
  const h = Math.max(1, Math.min(3, Math.floor((board.h + 1) / rows) - 1));
  const x0 = board.x + Math.floor((board.w - (GRID_COLS * (w + 1) - 1)) / 2);
  const y0 = board.y + Math.floor((board.h - (rows * (h + 1) - 1)) / 2);
  return Array.from({ length: n }, (_, i) => ({ x: x0 + (i % GRID_COLS) * (w + 1), y: y0 + Math.floor(i / GRID_COLS) * (h + 1), w, h }));
}

/** A cell's look: an empty socket, filled with its case, flickering just before it opens, or stalled — still lit,
 *  holding a drop the full tray can't take. */
export function cellKind(c: GridCell | null, openSeconds: number): 0 | 1 | 2 | 3 {
  if (!c) return CELL_EMPTY;
  if (c.drop) return CELL_STALLED;
  return c.t >= openSeconds - FLICKER_SECONDS ? CELL_FLICKER : CELL_FILLED;
}

/** Mix each channel toward white by `t` (0–1). */
export function lighten(color: number, t: number): number {
  const ch = (shift: number) => {
    const v = (color >> shift) & 0xff;
    return Math.round(v + (255 - v) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const colors = new Map<string, number>();
/** A case's cell colour: its (dark) box colour, lightened so a 2-px cell reads on the board. */
export function caseColor(caseId: string): number {
  let c = colors.get(caseId);
  if (c === undefined) {
    c = lighten(Number.parseInt(caseById(caseId).color.slice(1), 16), 0.45);
    colors.set(caseId, c);
  }
  return c;
}
