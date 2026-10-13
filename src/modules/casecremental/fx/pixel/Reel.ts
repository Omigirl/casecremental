import { Container, Graphics, NineSliceSprite, Sprite } from "pixi.js";
import { RARITY_INFO } from "../../sim/rarity";
import type { Rng } from "../../sim/rng";
import type { Tease } from "../../sim/tease";
import type { CaseDef, SkinDef } from "../../sim/types";
import { reelFraction, type ReelMotion } from "../reel/motion";
import { buildStrip, landingJitter, WIN_INDEX } from "../reel/strip";
import { ART_CELL_W, cellLook, type CellLook } from "../reel/cellLook";
import type { SkinTextures } from "../skins/pixelSkin";
import { fitArt } from "../skins/thumb";
import type { Rect } from "./layout";
import type { SpriteSet } from "./sprites";

// The CS-style reel in the pixel world: a strip of skin cards scrolling under a gold marker in
// whole-pixel steps, landing on the rolled skin a random fraction off-centre. onTick fires each
// time a card passes the marker. Its cells follow its height (reel/cellLook.ts): the full art, the art shrunk, or plain
// rarity tiles, with a dark gap between cells; once landed, the winner is outlined and the rest dim.

export const CARD_W = ART_CELL_W;
const METAL = 0x3a4250;
const WINDOW = 0x07080c;
const GOLD = 0xffd34d;
/** The landed winner's 1-px outline. */
const WIN_EDGE = 0xfff6d5;
/** A landed reel dims every cell but the winner to this. */
const LANDED_DIM = 0.55;

/** Strip offset (whole px) and the card index under the marker at reel progress f (0 → 1). */
export function reelPosition(f: number, rectW: number, jitter: number, cardW = CARD_W): { x: number; index: number } {
  const from = rectW / 2;
  const to = WIN_INDEX * cardW + cardW / 2 + jitter * cardW;
  const p = from + f * (to - from);
  return { x: Math.round(rectW / 2 - p), index: Math.floor(p / cardW) };
}

/** One strip cell, `look.cellW - look.gap` wide and `h` tall: the skin's art fitted to the look's box on a rarity-tinted
 *  card with its bar, or — on a strip too short for art — a plain rarity tile. */
export function makeCell(skins: SkinTextures, skin: SkinDef, look: CellLook, h: number): Container {
  const color = RARITY_INFO[skin.rarity].color;
  const w = look.cellW - look.gap;
  const cell = new Container();
  const bg = new Graphics().rect(0, 0, w, h).fill({ color: 0x15161d });
  if (!look.artBox) {
    cell.addChild(bg.rect(0, 0, w, h).fill({ color, alpha: 0.85 }));
    return cell;
  }
  cell.addChild(bg.rect(0, 0, w, h).fill({ color, alpha: look.bar > 1 ? 0.16 : 0.3 }));
  const size = skins.size(skin);
  const fit = fitArt(size.w, size.h, look.artBox);
  const art = new Sprite(skins.thumb(skin, fit.w, fit.h));
  art.position.set(Math.floor((w - fit.w) / 2), Math.floor((h - look.bar - fit.h) / 2));
  cell.addChild(art, new Graphics().rect(0, h - look.bar, w, look.bar).fill({ color }));
  return cell;
}

export class Reel extends Container {
  private readonly frame: NineSliceSprite;
  private readonly strip = new Container();
  private readonly clip = new Graphics();
  private readonly marker = new Graphics();
  private readonly thin = new Graphics();
  private readonly back = new Graphics();
  private readonly winEdge = new Graphics();
  private look: CellLook = cellLook(26);
  private cells: Container[] = [];
  private landedShown = false;
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
    this.addChild(this.frame, this.thin, this.back, this.strip, this.clip, this.marker);
    this.strip.mask = this.clip;
  }

  /** Where the reel sits, in world px. */
  get window(): Rect {
    return this.rect;
  }

  layout(rect: Rect): void {
    this.rect = rect;
    this.look = cellLook(rect.h);
    const { inset } = this.look;
    this.position.set(rect.x, rect.y);
    const slice = this.look.frame === "slice";
    this.frame.visible = slice;
    this.frame.width = rect.w;
    this.frame.height = rect.h;
    this.thin.clear();
    if (!slice)
      this.thin
        .rect(0, 0, rect.w, rect.h)
        .fill({ color: METAL })
        .rect(1, 1, rect.w - 2, rect.h - 2)
        .fill({ color: WINDOW });
    // the window behind the cells: the gaps between them read dark, never the frame's metal
    this.back
      .clear()
      .rect(inset, inset, rect.w - 2 * inset, rect.h - 2 * inset)
      .fill({ color: WINDOW });
    this.clip
      .clear()
      .rect(inset, inset, rect.w - 2 * inset, rect.h - 2 * inset)
      .fill({ color: 0xffffff });
    this.drawMarker();
    this.rebuild();
    this.place(this.fraction, false);
  }

  /** The gold centre line over a dark 3-px backing (it reads on any tile, a gold one too), capped top and bottom: inside
   *  the nine-slice's metal, or on the thin frame's own edge rows. */
  private drawMarker(): void {
    const { w, h } = this.rect;
    const { inset } = this.look;
    const mx = Math.floor(w / 2);
    const g = this.marker
      .clear()
      .rect(mx - 1, inset, 3, h - 2 * inset)
      .fill({ color: 0x000000, alpha: 0.5 });
    if (this.look.frame === "slice")
      g.rect(mx, 2, 1, h - 4)
        .fill({ color: GOLD })
        .rect(mx - 1, 2, 3, 1)
        .fill({ color: GOLD })
        .rect(mx - 1, h - 3, 3, 1)
        .fill({ color: GOLD });
    else
      g.rect(mx, 0, 1, h)
        .fill({ color: GOLD })
        .rect(mx - 1, 0, 3, 1)
        .fill({ color: GOLD })
        .rect(mx - 1, h - 1, 3, 1)
        .fill({ color: GOLD });
  }

  /** A new spin: a fresh strip that ends on `winner` (a fake tease plants its decoy beside it). `landed`: shown
   *  already stopped on it (a reload while its drop waits). */
  start(c: CaseDef, winner: SkinDef, rng: Rng, tease: Tease | null = null, landed = false): void {
    const side = tease?.fake ? (rng.next() < 0.5 ? "short" : "over") : null;
    this.items = buildStrip(c, winner, rng, tease?.fake && side ? { rarity: tease.fake, side } : null);
    this.jitter = landingJitter(side, rng);
    this.fraction = landed ? 1 : 0;
    this.lastIndex = -1;
    this.rebuild();
    this.place(this.fraction, false);
  }

  /** Move the strip while spinning. Cards always show a skin's still frame — animated skins play only on
   *  the reveal card the player drags (user). */
  update(motion: ReelMotion | null): void {
    if (!motion) return;
    this.fraction = reelFraction(motion);
    this.place(this.fraction, true);
  }

  /** The spin is over: show the reel stopped on its drop, whatever fraction its last frame reached (silent). */
  land(): void {
    this.fraction = 1;
    this.place(1, false);
  }

  private place(f: number, sound: boolean): void {
    const { x, index } = reelPosition(f, this.rect.w, this.jitter, this.look.cellW);
    this.strip.x = x;
    if (index !== this.lastIndex) {
      if (sound && this.lastIndex >= 0) this.onTick();
      this.lastIndex = index;
    }
    if (f >= 1 !== this.landedShown) this.showLanded(f >= 1);
  }

  /** Landed: the winner outlined 1 px inside its card, every other cell dimmed (a one-time step, not a flash). */
  private showLanded(on: boolean): void {
    this.landedShown = on;
    this.cells.forEach((c, i) => (c.alpha = on && i !== WIN_INDEX ? LANDED_DIM : 1));
    this.winEdge.clear();
    const win = this.cells[WIN_INDEX];
    if (!on || !win) return;
    const w = this.look.cellW - this.look.gap;
    const h = this.rect.h - 2 * this.look.inset;
    const { x, y } = win.position;
    this.winEdge
      .rect(x, y, w, 1)
      .fill({ color: WIN_EDGE })
      .rect(x, y + h - 1, w, 1)
      .fill({ color: WIN_EDGE })
      .rect(x, y, 1, h)
      .fill({ color: WIN_EDGE })
      .rect(x + w - 1, y, 1, h)
      .fill({ color: WIN_EDGE });
  }

  private rebuild(): void {
    this.strip.removeChild(this.winEdge);
    for (const child of this.strip.removeChildren()) child.destroy({ children: true });
    const { cellW, gap, inset } = this.look;
    const h = this.rect.h - 2 * inset;
    this.cells = this.items.map((skin, i) => {
      const cell = makeCell(this.skins, skin, this.look, h);
      cell.position.set(i * cellW + gap / 2, inset);
      return this.strip.addChild(cell);
    });
    this.strip.addChild(this.winEdge);
    this.showLanded(false); // a new strip never keeps the last spin's outline; place() re-applies a landed look
  }
}
