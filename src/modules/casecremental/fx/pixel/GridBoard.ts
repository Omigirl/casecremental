import { Container, Sprite, type Texture } from "pixi.js";
import { RARITY_INFO } from "../../sim/rarity";
import type { GridCell } from "../../sim/grid";
import { GRID_OPEN_SECONDS } from "../../sim/tuning";
import { CELL_EMPTY, CELL_FLICKER, CELL_STALLED, cellKind, GRID_COLS, GRID_MAX_CELLS, SWEEP_STEP } from "../stations/gridRules";
import type { Rect } from "./layout";

// The grid's cells (pixel world) and their flashes (HD): one sprite each, made once for the largest grid, so a busy
// grid costs no allocation per frame (spec §6, Review Focus 3). A cell shows its case's colour, flickers before it
// opens, and keeps a stalled drop's rarity colour; an opened cell flashes in its drop's colour (bigger for Classified).

const SOCKET = 0x2a2226;
const DROP_IN_SECONDS = 0.12;
const FLASH_FADE = 3;

export class GridBoard {
  /** Pixel world. */
  readonly cells = new Container();
  /** HD layer. */
  readonly flashes = new Container();
  private readonly cellSprites: Sprite[] = [];
  private readonly flashSprites: Sprite[] = [];
  private readonly tints = new Int32Array(GRID_MAX_CELLS).fill(-1);
  private readonly dropIn = new Float32Array(GRID_MAX_CELLS);
  private readonly flash = new Float32Array(GRID_MAX_CELLS);
  private rects: Rect[] = [];
  private scale = 1;

  constructor(cellTexture: Texture, glowTexture: Texture) {
    for (let i = 0; i < GRID_MAX_CELLS; i++) {
      const c = new Sprite(cellTexture);
      c.visible = false;
      this.cellSprites.push(c);
      this.cells.addChild(c);
      const f = new Sprite({ texture: glowTexture, anchor: 0.5, blendMode: "add" });
      f.visible = false;
      this.flashSprites.push(f);
      this.flashes.addChild(f);
    }
  }

  /** The cells' rects (world px) at pixel scale `scale`. */
  layout(rects: Rect[], scale: number): void {
    this.rects = rects;
    this.scale = scale;
    this.cellSprites.forEach((s, i) => {
      const r = rects[i];
      if (!r) return;
      s.position.set(r.x, r.y);
      s.width = r.w;
      s.height = r.h;
      this.flashSprites[i]!.position.set((r.x + r.w / 2) * scale, (r.y + r.h / 2) * scale);
    });
  }

  /** A case dropped into cell i: it lands with a 1-px hop. */
  filled(i: number): void {
    if (i < GRID_MAX_CELLS) this.dropIn[i] = DROP_IN_SECONDS;
  }

  /** Cell i opened: a flash in its drop's colour (`big` for a Classified, or a breakout that waited too long). */
  opened(i: number, color: number, big: boolean): void {
    const f = this.flashSprites[i];
    if (!f) return;
    this.flash[i] = 1;
    f.tint = color;
    f.width = f.height = (big ? 18 : 9) * this.scale;
  }

  /** `sweep`: seconds since it powered on (Infinity once done). Allocates nothing. */
  update(dt: number, cells: readonly (GridCell | null)[], on: boolean, sweep: number, colorOf: (caseId: string) => number): void {
    for (let i = 0; i < GRID_MAX_CELLS; i++) {
      const s = this.cellSprites[i]!;
      const r = this.rects[i];
      this.dropIn[i] = Math.max(0, this.dropIn[i]! - dt);
      if (!r || i >= cells.length || !on || sweep < (i % GRID_COLS) * SWEEP_STEP) s.visible = false;
      else {
        const c = cells[i] ?? null;
        const kind = cellKind(c, GRID_OPEN_SECONDS);
        const tint = kind === CELL_EMPTY ? SOCKET : kind === CELL_STALLED ? RARITY_INFO[c!.drop!.rarity].color : colorOf(c!.caseId);
        if (this.tints[i] !== tint) {
          this.tints[i] = tint;
          s.tint = tint;
        }
        s.alpha = kind === CELL_FLICKER && Math.floor(c!.t * 20) % 2 === 1 ? 0.35 : 1;
        s.y = r.y - (this.dropIn[i]! > DROP_IN_SECONDS / 2 ? 1 : 0);
        s.visible = true;
      }
      const f = (this.flash[i] = Math.max(0, this.flash[i]! - dt * FLASH_FADE));
      const fs = this.flashSprites[i]!;
      fs.visible = f > 0;
      fs.alpha = f;
    }
  }

  /** A new run: every timer back to rest. */
  clear(): void {
    this.dropIn.fill(0);
    this.flash.fill(0);
  }
}
