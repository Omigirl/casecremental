import { Container } from "pixi.js";
import type { CaseDef, SkinDef } from "../../sim/types";
import type { Rng } from "../../sim/rng";
import type { Tease } from "../../sim/tease";
import type { Rect } from "../pixel/layout";
import { Reel } from "../pixel/Reel";
import type { SpriteSet } from "../pixel/sprites";
import type { ReelMotion } from "../reel/motion";
import type { SkinTextures } from "../skins/pixelSkin";

// Several reels stacked in one window (rework spec §4, §5): the vault's five, and multi-open's two.

/** n reels stacked in `area`, centred, in whole pixels: at most maxH tall, at least 8 — a tiny area shrinks the gap
 *  first, then that floor, so the stack never leaves it. */
export function stackRects(area: Rect, n: number, maxH = 24, gap = 3): Rect[] {
  const top = Math.ceil(area.y);
  const areaH = Math.floor(area.y + area.h) - top;
  const floorH = Math.max(0, Math.min(8, Math.floor(areaH / n)));
  const g = n > 1 ? Math.max(0, Math.min(gap, Math.floor((areaH - n * floorH) / (n - 1)))) : 0;
  const h = Math.max(floorH, Math.min(maxH, Math.floor((areaH - g * (n - 1)) / n)));
  const y0 = top + Math.floor((areaH - (n * h + g * (n - 1))) / 2);
  const x = Math.round(area.x);
  const w = Math.round(area.x + area.w) - x;
  return Array.from({ length: n }, (_, i) => ({ x, y: y0 + i * (h + g), w, h }));
}

export class StackedReels extends Container {
  private readonly reels: Reel[] = [];

  constructor(
    private readonly frameSet: SpriteSet,
    private readonly skins: SkinTextures,
    private readonly onTick: (i: number) => void,
  ) {
    super();
  }

  layout(rects: Rect[]): void {
    while (this.reels.length < rects.length) {
      const i = this.reels.length;
      const r = new Reel(this.frameSet, this.skins, () => this.onTick(i));
      this.reels.push(r);
      this.addChild(r);
    }
    this.reels.forEach((r, i) => {
      const rect = rects[i];
      r.visible = !!rect;
      if (rect) r.layout(rect);
    });
  }

  /** Reel i's new spin, ending on `winner` (a fake tease plants its decoy beside it). */
  start(i: number, c: CaseDef, winner: SkinDef, rng: Rng, tease: Tease | null = null): void {
    this.reels[i]?.start(c, winner, rng, tease);
  }

  /** Reel i's window (null when it has none). */
  rect(i: number): Rect | null {
    const r = this.reels[i];
    return r?.visible ? r.window : null;
  }

  update(i: number, motion: ReelMotion | null): void {
    this.reels[i]?.update(motion);
  }

  /** Reel i stopped on its drop (its spin is over). */
  land(i: number): void {
    this.reels[i]?.land();
  }

  get count(): number {
    return this.reels.length;
  }
}
