import { Container, Graphics, NineSliceSprite, Sprite, TilingSprite } from "pixi.js";
import { Actor } from "./Actor";
import { Animated } from "./Animated";
import { ANIMS } from "./anims";
import type { TableLayout } from "./layout";
import type { SpriteLibrary } from "./sprites";

// The room and everything on the table that isn't your bench: the backdrop (wall, back layer,
// shelves — nudged 1–2 px with the pointer for parallax), the swaying lamp, the workbench, the felt
// mat, the claim tray, the powered-off auto-seller and the sleeping bot with its dark reel (spec §3).

const WALL = 0x1b1418;
const WOOD = 0x5a3a22;
const WOOD_DARK = 0x3a2416;
const FELT = 0x1f4d3a;

export class Room {
  readonly back = new Container();
  readonly front = new Container();
  private readonly wall = new Graphics();
  private readonly backdrop: Sprite | null;
  private readonly shelves: Sprite | null;
  private readonly lamp: Animated;
  private readonly tableTop: TilingSprite | null;
  private readonly tableBody = new Graphics();
  private readonly mat: Sprite | null;
  private readonly matFallback = new Graphics();
  private readonly tray: Sprite;
  private readonly seller: Sprite;
  private readonly bot: Animated;
  private readonly botReel: NineSliceSprite;
  private l: TableLayout | null = null;

  constructor(lib: SpriteLibrary) {
    // big backgrounds fall back to flat colour, not a placeholder checkerboard
    const optional = (id: string) => (lib.has(id) ? new Sprite(lib.get(id, { w: 1, h: 1 }).frames[0]) : null);
    this.backdrop = optional("room-back");
    this.shelves = optional("room-shelves");
    this.lamp = new Animated(new Actor(lib.get("room-lamp", { w: 16, h: 40 })), ANIMS.lampSway);
    const table = lib.has("table") ? lib.get("table", { w: 1, h: 1 }).frames[0]! : null;
    this.tableTop = table ? new TilingSprite({ texture: table, width: 1, height: table.height }) : null;
    this.mat = optional("mat");
    this.tray = new Sprite(lib.get("tray", { w: 100, h: 18 }).frames[0]);
    this.seller = new Sprite(lib.get("auto-seller", { w: 24, h: 30 }).frames[0]);
    this.seller.tint = 0x666677; // powered off until M2b
    this.bot = new Animated(new Actor(lib.get("bot-sleep", { w: 40, h: 48, frames: 4 })), ANIMS.botSleep);
    const reelFrame = lib.get("reel-frame", { w: 48, h: 24 }).frames[0]!;
    this.botReel = new NineSliceSprite({ texture: reelFrame, leftWidth: 6, topHeight: 6, rightWidth: 6, bottomHeight: 6 });
    this.botReel.tint = 0x444455;
    for (const s of [this.wall, this.backdrop, this.shelves, this.lamp.actor, this.botReel]) if (s) this.back.addChild(s);
    for (const s of [this.tableBody, this.tableTop, this.matFallback, this.mat, this.tray, this.seller, this.bot.actor])
      if (s) this.front.addChild(s);
  }

  layout(l: TableLayout): void {
    this.l = l;
    const t = l.table;
    this.wall.clear().rect(0, 0, l.worldW, l.worldH).fill({ color: WALL });
    this.lamp.actor.place(l.lamp.x, 40);
    const topH = this.tableTop ? this.tableTop.height : 6;
    if (this.tableTop) {
      this.tableTop.position.set(t.x, t.y);
      this.tableTop.width = t.w;
    }
    this.tableBody
      .clear()
      .rect(t.x, t.y, t.w, topH)
      .fill({ color: WOOD })
      .rect(t.x, t.y + topH, t.w, t.h - topH)
      .fill({ color: WOOD_DARK });
    const m = l.you.mat;
    if (this.mat) this.mat.position.set(Math.round(m.x + (m.w - this.mat.width) / 2), m.y + m.h - this.mat.height);
    else this.matFallback.clear().rect(m.x, m.y, m.w, m.h).fill({ color: FELT });
    this.tray.position.set(
      Math.round(l.tray.x + (l.tray.w - this.tray.width) / 2),
      Math.round(l.tray.y + (l.tray.h - this.tray.height) / 2),
    );
    this.seller.position.set(Math.round(l.seller.x - this.seller.width / 2), l.seller.y - this.seller.height);
    this.bot.actor.place(l.bot.spot.x, l.bot.spot.y);
    this.botReel.visible = !!l.bot.reel;
    if (l.bot.reel) {
      this.botReel.position.set(l.bot.reel.x, l.bot.reel.y);
      this.botReel.width = l.bot.reel.w;
      this.botReel.height = l.bot.reel.h;
    }
    this.parallax(0.5);
  }

  /** Back layers follow the pointer by a pixel or two (0 = left edge, 1 = right edge). */
  parallax(pointer01: number): void {
    const l = this.l;
    if (!l) return;
    const shift = (max: number) => Math.round((pointer01 - 0.5) * 2 * max);
    if (this.backdrop) this.backdrop.position.set(Math.round((l.worldW - this.backdrop.width) / 2) + shift(1), 0);
    if (this.shelves) this.shelves.position.set(Math.round((l.worldW - this.shelves.width) / 2) + shift(2), 0);
  }

  update(ms: number): void {
    this.lamp.update(ms);
    this.bot.update(ms);
  }
}
