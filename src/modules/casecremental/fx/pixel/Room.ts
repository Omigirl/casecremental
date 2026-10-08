import { Container, Graphics, NineSliceSprite, Sprite, TilingSprite } from "pixi.js";
import type { SpriteSet } from "./sprites";
import { Actor } from "./Actor";
import { Animated } from "./Animated";
import { ANIMS } from "./anims";
import type { TableLayout } from "./layout";
import type { SpriteLibrary } from "./sprites";

// The room and everything on the table that isn't your bench: the backdrop (wall, back layer,
// shelves — nudged 1–2 px with the pointer for parallax), the swaying lamp, the workbench, the felt
// mat, the claim tray, the powered-off auto-seller and the bot's dark reel (spec §3). The bot itself is
// drawn by BotSprite.

const WALL = 0x1b1418;
/** Depth: the far wall darkest, the shelves a step nearer — the room reads deeper than the art alone. */
const BACK_TINT = 0x6a6470;
const SHELF_TINT = 0x8e8894;
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
  private readonly botReel: NineSliceSprite;
  private l: TableLayout | null = null;

  constructor(lib: SpriteLibrary, reelFrame: SpriteSet) {
    // big backgrounds fall back to flat colour, not a placeholder checkerboard
    const optional = (id: string) => (lib.has(id) ? new Sprite(lib.get(id, { w: 1, h: 1 }).frames[0]) : null);
    this.backdrop = optional("room-back");
    this.shelves = optional("room-shelves");
    if (this.backdrop) this.backdrop.tint = BACK_TINT;
    if (this.shelves) this.shelves.tint = SHELF_TINT;
    this.lamp = new Animated(new Actor(lib.get("room-lamp", { w: 16, h: 40 })), ANIMS.lampSway);
    const table = lib.has("table") ? lib.get("table", { w: 1, h: 1 }).frames[0]! : null;
    this.tableTop = table ? new TilingSprite({ texture: table, width: 1, height: table.height }) : null;
    this.mat = optional("mat");
    this.tray = new Sprite(lib.get("tray", { w: 100, h: 18 }).frames[0]);
    this.seller = new Sprite(lib.get("auto-seller", { w: 24, h: 30 }).frames[0]);
    this.seller.tint = 0xa8a8b8; // powered off until M2b — dimmed, but still readable
    this.botReel = new NineSliceSprite({ texture: reelFrame.frames[0]!, leftWidth: 6, topHeight: 6, rightWidth: 6, bottomHeight: 6 });
    this.botReel.tint = 0x444455;
    for (const s of [this.wall, this.backdrop, this.shelves, this.lamp.actor, this.botReel]) if (s) this.back.addChild(s);
    for (const s of [this.tableBody, this.tableTop, this.matFallback, this.mat, this.tray, this.seller]) if (s) this.front.addChild(s);
  }

  layout(l: TableLayout): void {
    this.l = l;
    const t = l.table;
    this.wall.clear().rect(0, 0, l.worldW, l.worldH).fill({ color: WALL });
    this.lamp.actor.place(l.lamp.x, l.you.reel.y - 1); // the shade hangs just above the reels, not between them
    const topH = this.tableTop ? this.tableTop.height : 6;
    // the table is drawn edge to edge, under the side panels; props keep to l.table
    if (this.tableTop) {
      this.tableTop.position.set(0, t.y);
      this.tableTop.width = l.worldW;
    }
    this.tableBody
      .clear()
      .rect(0, t.y, l.worldW, topH)
      .fill({ color: WOOD })
      .rect(0, t.y + topH, l.worldW, l.worldH - t.y - topH)
      .fill({ color: WOOD_DARK });
    const m = l.you.mat;
    if (this.mat) this.mat.position.set(Math.round(m.x + (m.w - this.mat.width) / 2), m.y + m.h - this.mat.height);
    else this.matFallback.clear().rect(m.x, m.y, m.w, m.h).fill({ color: FELT });
    this.tray.position.set(
      Math.round(l.tray.x + (l.tray.w - this.tray.width) / 2),
      Math.round(l.tray.y + (l.tray.h - this.tray.height) / 2),
    );
    this.seller.position.set(Math.round(l.seller.x - this.seller.width / 2), l.seller.y - this.seller.height);
    this.botReel.visible = !!l.bot.reel;
    if (l.bot.reel) {
      this.botReel.position.set(l.bot.reel.x, l.bot.reel.y);
      this.botReel.width = l.bot.reel.w;
      this.botReel.height = l.bot.reel.h;
    }
    if (this.backdrop) this.backdrop.position.set(Math.round((l.worldW - this.backdrop.width) / 2), 0);
    if (this.shelves) this.shelves.position.set(Math.round((l.worldW - this.shelves.width) / 2), 6);
  }

  update(ms: number): void {
    this.lamp.update(ms);
  }
}
