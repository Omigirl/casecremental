import { Container, Graphics, NineSliceSprite, Sprite } from "pixi.js";
import { RARITY_INFO } from "../../sim/rarity";
import type { Rng } from "../../sim/rng";
import type { Tease } from "../../sim/tease";
import type { CaseDef, SkinDef } from "../../sim/types";
import { reelFraction, type ReelMotion } from "../reel/motion";
import { buildStrip, landingJitter, WIN_INDEX } from "../reel/strip";
import type { SkinTextures } from "../skins/pixelSkin";
import type { Rect } from "./layout";
import type { SpriteSet } from "./sprites";

// The CS-style reel in the pixel world: a strip of skin cards scrolling under a gold marker in
// whole-pixel steps, landing on the rolled skin a random fraction off-centre. onTick fires each
// time a card passes the marker.

export const CARD_W = 30;
const GAP = 2;

/** Strip offset (whole px) and the card index under the marker at reel progress f (0 → 1). */
export function reelPosition(f: number, rectW: number, jitter: number, cardW = CARD_W): { x: number; index: number } {
  const from = rectW / 2;
  const to = WIN_INDEX * cardW + cardW / 2 + jitter * cardW;
  const p = from + f * (to - from);
  return { x: Math.round(rectW / 2 - p), index: Math.floor(p / cardW) };
}

export function makeCard(skins: SkinTextures, skin: SkinDef, w: number, h: number): Container {
  const color = RARITY_INFO[skin.rarity].color;
  const card = new Container();
  card.addChild(new Graphics().rect(0, 0, w, h).fill({ color: 0x15161d }).rect(0, 0, w, h).fill({ color, alpha: 0.16 }));
  const art = new Sprite(skins.texture(skin));
  art.position.set(Math.floor((w - art.width) / 2), Math.floor((h - 2 - art.height) / 2));
  card.addChild(art, new Graphics().rect(0, h - 2, w, 2).fill({ color }));
  return card;
}

export class Reel extends Container {
  private readonly frame: NineSliceSprite;
  private readonly strip = new Container();
  private readonly clip = new Graphics();
  private readonly marker = new Graphics();
  private rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private items: SkinDef[] = [];
  private jitter = 0;
  private fraction = 0;
  private lastIndex = -1;

  constructor(
    frameSet: SpriteSet,
    private readonly skins: SkinTextures,
    private readonly onTick: () => void,
  ) {
    super();
    this.frame = new NineSliceSprite({ texture: frameSet.frames[0]!, leftWidth: 6, topHeight: 6, rightWidth: 6, bottomHeight: 6 });
    this.addChild(this.frame, this.strip, this.clip, this.marker);
    this.strip.mask = this.clip;
  }

  layout(rect: Rect): void {
    this.rect = rect;
    this.position.set(rect.x, rect.y);
    this.frame.width = rect.w;
    this.frame.height = rect.h;
    this.clip
      .clear()
      .rect(3, 3, rect.w - 6, rect.h - 6)
      .fill({ color: 0xffffff });
    const mx = Math.floor(rect.w / 2);
    this.marker
      .clear()
      .rect(mx, 2, 1, rect.h - 4)
      .fill({ color: 0xffd34d })
      .rect(mx - 1, 2, 3, 1)
      .fill({ color: 0xffd34d })
      .rect(mx - 1, rect.h - 3, 3, 1)
      .fill({ color: 0xffd34d });
    this.rebuild();
    this.place(this.fraction, false);
  }

  /** A new spin: a fresh strip that ends on `winner` (a fake tease plants its decoy beside it). */
  start(c: CaseDef, winner: SkinDef, rng: Rng, tease: Tease | null = null): void {
    const side = tease?.fake ? (rng.next() < 0.5 ? "short" : "over") : null;
    this.items = buildStrip(c, winner, rng, tease?.fake && side ? { rarity: tease.fake, side } : null);
    this.jitter = landingJitter(side, rng);
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
    const { x, index } = reelPosition(f, this.rect.w, this.jitter);
    this.strip.x = x;
    if (index !== this.lastIndex) {
      if (sound && this.lastIndex >= 0) this.onTick();
      this.lastIndex = index;
    }
  }

  private rebuild(): void {
    for (const child of this.strip.removeChildren()) child.destroy({ children: true });
    const h = this.rect.h - 6;
    this.items.forEach((skin, i) => {
      const card = makeCard(this.skins, skin, CARD_W - GAP, h);
      card.position.set(i * CARD_W + GAP / 2, 3);
      this.strip.addChild(card);
    });
  }
}
