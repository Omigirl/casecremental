import { Texture, TextureSource } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { GridCell } from "../../sim/grid";
import { GRID_MAX_CELLS, gridCells } from "../stations/gridRules";
import { GridBoard } from "./GridBoard";

// The grid's frame budget (spec §6, Review Focus 3): every cell and every flash comes from pools made once, so a busy
// Run 3 grid (ten opens a second, flashes, fills) adds nothing to the scene while it runs.

const tex = () => new Texture({ source: new TextureSource({ width: 4, height: 4 }) });
const cell = (t: number, drop: GridCell["drop"] = null): GridCell => ({ caseId: "bootcamp", t, drop });

describe("GridBoard", () => {
  it("draws a busy minute from pools made once", () => {
    const b = new GridBoard(tex(), tex());
    b.layout(gridCells({ x: 0, y: 0, w: 37, h: 13 }, GRID_MAX_CELLS), 6);
    const sizes = () => [b.cells.children.length, b.flashes.children.length];
    expect(sizes()).toEqual([GRID_MAX_CELLS, GRID_MAX_CELLS]);
    const cells: (GridCell | null)[] = Array.from({ length: GRID_MAX_CELLS }, () => null);
    for (let f = 0; f < 3600; f++) {
      const i = f % GRID_MAX_CELLS;
      cells[i] = f % 7 === 0 ? null : cell((f % 90) / 60);
      if (f % 4 === 0) b.filled(i);
      if (f % 5 === 0) b.opened(i, 0xeb4b4b, f % 10 === 0);
      b.update(1 / 60, cells, true, Infinity, () => 0xffffff);
    }
    expect(sizes()).toEqual([GRID_MAX_CELLS, GRID_MAX_CELLS]);
  });

  it("shows only the grid's own cells, and none while it is off", () => {
    const b = new GridBoard(tex(), tex());
    b.layout(gridCells({ x: 0, y: 0, w: 37, h: 13 }, 10), 2);
    const cells: (GridCell | null)[] = Array.from({ length: 10 }, (_, i) => (i < 3 ? cell(0.1) : null));
    b.update(0.016, cells, true, Infinity, () => 0x123456);
    expect(b.cells.children.filter((c) => c.visible)).toHaveLength(10); // 3 cases + 7 empty sockets
    b.update(0.016, cells, false, Infinity, () => 0x123456);
    expect(b.cells.children.filter((c) => c.visible)).toHaveLength(0);
  });

  it("sweeps on from left to right when it powers on", () => {
    const b = new GridBoard(tex(), tex());
    b.layout(gridCells({ x: 0, y: 0, w: 37, h: 13 }, 10), 2);
    const cells: (GridCell | null)[] = Array.from({ length: 10 }, () => null);
    b.update(0.016, cells, true, 0.12, () => 0);
    const lit = b.cells.children.slice(0, 10).map((c) => c.visible);
    expect(lit.slice(0, 3)).toEqual([true, true, true]);
    expect(lit.slice(3).every((v) => !v)).toBe(true);
  });
});
