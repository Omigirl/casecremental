import { Container } from "pixi.js";
import type { CaseDef, SkinDef } from "../../sim/types";
import type { Rng } from "../../sim/rng";
import type { Rect } from "../pixel/layout";
import { Reel } from "../pixel/Reel";
import type { SpriteSet } from "../pixel/sprites";
import type { ReelMotion } from "../reel/motion";
import type { SkinTextures } from "../skins/pixelSkin";

// Several reels stacked in one window (rework spec §4, §5): the vault's five, and multi-open's two.

export function stackRects(area: Rect, n: number, maxH = 24, gap = 3): Rect[] {
  const h = Math.max(8, Math.min(maxH, Math.floor((area.h - gap * (n - 1)) / n)));
  const total = n * h + gap * (n - 1);
  const y0 = area.y + Math.floor((area.h - total) / 2);
  return Array.from({ length: n }, (_, i) => ({ x: Math.round(area.x), y: y0 + i * (h + gap), w: Math.round(area.w), h }));
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

  start(i: number, c: CaseDef, winner: SkinDef, rng: Rng): void {
    this.reels[i]?.start(c, winner, rng);
  }

  update(i: number, motion: ReelMotion | null): void {
    this.reels[i]?.update(motion);
  }

  get count(): number {
    return this.reels.length;
  }
}
