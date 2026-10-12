import { describe, expect, it } from "vitest";
import { GRID_SIZES } from "../../sim/tuning";
import {
  BOARD_IN_FRAME,
  boardRect,
  CELL_EMPTY,
  CELL_FILLED,
  CELL_FLICKER,
  CELL_STALLED,
  cellKind,
  FLICKER_SECONDS,
  GRID_COLS,
  GRID_MAX_CELLS,
  gridCells,
  lighten,
} from "./gridRules";

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("the auto-buyer's board", () => {
  const board = { x: 10, y: 20, w: BOARD_IN_FRAME.w, h: BOARD_IN_FRAME.h };

  it("holds the largest grid", () => {
    expect(GRID_MAX_CELLS).toBe(Math.max(...GRID_SIZES));
  });

  it.each([...GRID_SIZES])("lays %i cells in rows of ten inside the board, none overlapping", (n) => {
    const cells = gridCells(board, n);
    expect(cells).toHaveLength(n);
    for (const c of cells) {
      expect(c.w).toBeGreaterThanOrEqual(1);
      expect(c.h).toBeGreaterThanOrEqual(1);
      expect(c.x).toBeGreaterThanOrEqual(board.x);
      expect(c.y).toBeGreaterThanOrEqual(board.y);
      expect(c.x + c.w).toBeLessThanOrEqual(board.x + board.w);
      expect(c.y + c.h).toBeLessThanOrEqual(board.y + board.h);
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlap(cells[i]!, cells[j]!)).toBe(false);
    expect(cells.slice(0, GRID_COLS).every((c) => c.y === cells[0]!.y)).toBe(true);
    if (n > GRID_COLS) expect(cells[GRID_COLS]!.y).toBeGreaterThan(cells[0]!.y);
  });

  it("puts the board inside the machine's frame (the pigeonholes right of the hopper)", () => {
    const g = { x: 100, y: 120, w: 54, h: 18 };
    const b = boardRect(g, { frameW: 57, ground: 30 });
    const frame = { x: g.x + g.w / 2 - 28, y: g.y + g.h - 30, w: 57, h: 32 };
    expect(b.x).toBeGreaterThanOrEqual(frame.x);
    expect(b.y).toBeGreaterThanOrEqual(frame.y);
    expect(b.x + b.w).toBeLessThanOrEqual(frame.x + frame.w);
    expect(b.y + b.h).toBeLessThanOrEqual(g.y + g.h);
  });

  it("knows a cell's look: an empty socket, its case, a flicker just before it opens, a stalled drop", () => {
    expect(cellKind(null, 1.5)).toBe(CELL_EMPTY);
    expect(cellKind({ caseId: "bootcamp", t: 0.2, drop: null }, 1.5)).toBe(CELL_FILLED);
    expect(cellKind({ caseId: "bootcamp", t: 1.5 - FLICKER_SECONDS, drop: null }, 1.5)).toBe(CELL_FLICKER);
    const drop = {
      id: 1,
      caseId: "bootcamp",
      skinId: "bc_warlord",
      rarity: "covert" as const,
      float: 0.2,
      wear: "FT" as const,
      statTrak: false,
      value: 1,
    };
    expect(cellKind({ caseId: "bootcamp", t: 2, drop }, 1.5)).toBe(CELL_STALLED);
  });

  it("lightens a case's dark colour so its tiny cell reads on the dark board", () => {
    expect(lighten(0x000000, 0.5)).toBe(0x808080);
    expect(lighten(0xffffff, 0.5)).toBe(0xffffff);
    expect(lighten(0x204060, 0)).toBe(0x204060);
  });
});
