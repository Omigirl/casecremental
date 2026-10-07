import { Container, Graphics, Sprite } from "pixi.js";
import { RARITY_INFO } from "../sim/rarity";
import type { Rng } from "../sim/rng";
import type { CaseDef, SkinDef } from "../sim/types";
import type { Rect } from "./layout";
import { reelFraction, type ReelMotion } from "./reel/motion";
import { buildStrip, WIN_INDEX } from "./reel/strip";
import { SKIN_TEX_H, SKIN_TEX_W, skinTexture } from "./skins/skinTexture";

// The CS-style reel: a strip of skin cards scrolling under a gold marker, landing on the rolled
// skin a random fraction off-center. onTick fires each time a card passes the marker.

const GAP = 6;

export function makeCard(skin: SkinDef, w: number, h: number): Container {
  const color = RARITY_INFO[skin.rarity].color;
  const card = new Container();
  card.addChild(new Graphics().roundRect(0, 0, w, h, 6).fill({ color: 0x1a1d27 }));
  card.addChild(new Graphics().roundRect(0, 0, w, h, 6).fill({ color, alpha: 0.14 }));
  const sprite = new Sprite(skinTexture(skin));
  sprite.anchor.set(0.5);
  sprite.scale.set(Math.min((w - 8) / SKIN_TEX_W, (h - 14) / SKIN_TEX_H));
  sprite.position.set(w / 2, (h - 5) / 2);
  card.addChild(sprite);
  card.addChild(new Graphics().rect(0, h - 5, w, 5).fill({ color }));
  return card;
}

export class ReelView extends Container {
  private readonly frame = new Graphics();
  private readonly strip = new Container();
  private readonly clip = new Graphics();
  private readonly marker = new Graphics();
  private rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private itemW = 100;
  private itemH = 75;
  private items: SkinDef[] = [];
  private jitter = 0;
  private fraction = 0;
  private lastIndex = -1;

  constructor(private readonly onTick: () => void) {
    super();
    this.addChild(this.frame, this.strip, this.clip, this.marker);
    this.strip.mask = this.clip;
  }

  layout(rect: Rect, itemW: number, itemH: number): void {
    this.rect = rect;
    this.itemW = itemW;
    this.itemH = itemH;
    this.position.set(rect.x, rect.y);
    this.frame.clear().roundRect(0, 0, rect.w, rect.h, 10).fill({ color: 0x0e1016 }).stroke({ width: 2, color: 0x2a2f3d });
    this.clip.clear().rect(4, 4, rect.w - 8, rect.h - 8).fill({ color: 0xffffff });
    this.marker.clear().rect(rect.w / 2 - 1.5, 2, 3, rect.h - 4).fill({ color: 0xffd34d });
    this.rebuild();
    this.place(this.fraction, false);
  }

  /** A new spin: a fresh strip that ends on `winner`. */
  start(c: CaseDef, winner: SkinDef, rng: Rng): void {
    this.items = buildStrip(c, winner, rng);
    this.jitter = (rng.next() - 0.5) * 0.7;
    this.fraction = 0;
    this.lastIndex = -1;
    this.rebuild();
    this.place(0, false);
  }

  update(motion: ReelMotion | null): void {
    if (!motion) return;
    this.fraction = reelFraction(motion);
    this.place(this.fraction, true);
  }

  private place(f: number, sound: boolean): void {
    const from = this.rect.w / 2; // first card flush with the left edge
    const to = WIN_INDEX * this.itemW + this.itemW / 2 + this.jitter * this.itemW;
    const p = from + f * (to - from);
    this.strip.x = this.rect.w / 2 - p;
    const index = Math.floor(p / this.itemW);
    if (index !== this.lastIndex) {
      if (sound && this.lastIndex >= 0) this.onTick();
      this.lastIndex = index;
    }
  }

  private rebuild(): void {
    for (const child of this.strip.removeChildren()) child.destroy({ children: true });
    this.items.forEach((skin, i) => {
      const card = makeCard(skin, this.itemW - GAP, this.itemH);
      card.position.set(i * this.itemW + GAP / 2, (this.rect.h - this.itemH) / 2);
      this.strip.addChild(card);
    });
  }
}
