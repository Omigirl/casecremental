import { Container, Sprite, type Texture } from "pixi.js";
import type { GameController } from "../../game/controller";
import { skinById } from "../../sim/content/cases";
import type { Drop } from "../../sim/types";
import type { LiftInfo } from "../hd/Lifted";
import type { SkinTextures } from "../skins/pixelSkin";
import { cardFace } from "./cardFace";
import { DragTracker } from "./drag";
import { ITEM_SIZE, type Pt, type TableLayout } from "./layout";

// The bot's card (rework spec §1): its drop waits at its station until you drag it to the SELL bin (or tap
// it) — a hand sale, so it feeds the combo — or the auto-seller takes it. It follows the sim's bot.card.

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export class BotCardView {
  readonly root = new Container();
  private readonly sprite = new Sprite();
  private readonly drag = new DragTracker();
  private tex: Texture | null = null;
  private shownId: number | null = null;
  private l: TableLayout | null = null;

  constructor(
    private readonly skins: SkinTextures,
    private readonly controller: GameController,
    private readonly bake: (c: Container) => Texture,
  ) {
    this.sprite.visible = false;
    this.root.addChild(this.sprite);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.place();
  }

  /** World centre of the bot's card (coins and sparks start here). */
  centre(): Pt {
    return this.l ? { ...this.l.bot.reveal } : { x: 0, y: 0 };
  }

  update(card: Drop | null): void {
    if ((card?.id ?? null) !== this.shownId) {
      this.shownId = card?.id ?? null;
      this.tex?.destroy(true);
      this.tex = null;
      if (card) {
        const face = cardFace(this.skins.frames(skinById(card.skinId))[0] ?? null, card);
        this.tex = this.bake(face);
        face.destroy({ children: true });
        this.sprite.texture = this.tex;
      }
      if (!card) this.drag.cancel();
    }
    this.sprite.visible = !!card;
    this.sprite.alpha = this.drag.dragging ? 0 : 1;
  }

  pointerDown(p: Pt): boolean {
    if (!this.sprite.visible) return false;
    const r = this.rect();
    if (!this.drag.down(p, [{ id: "botcard", rect: r }])) return false;
    this.controller.act({ type: "holdCard", spot: "bot" });
    return true;
  }

  pointerMove(p: Pt): void {
    this.drag.move(p);
  }

  pointerUp(p: Pt): void {
    if (!this.drag.dragging) return;
    const end = this.drag.up(p);
    const l = this.l;
    if (end.kind === "tap" || (end.kind === "drop" && l && dist(end.at, l.bin) <= l.binR + 8)) this.controller.act({ type: "sellBot" });
    this.controller.act({ type: "holdCard", spot: null });
  }

  cancelDrag(): void {
    if (this.drag.dragging) this.controller.act({ type: "holdCard", spot: null });
    this.drag.cancel();
  }

  lifted(): LiftInfo | null {
    const p = this.drag.exactPosition;
    if (!p || !this.drag.dragging || !this.tex) return null;
    const { w, h } = ITEM_SIZE.reveal;
    return { id: "botcard", texture: this.tex, center: { x: p.x + w / 2, y: p.y + h / 2 } };
  }

  destroy(): void {
    this.tex?.destroy(true);
    this.tex = null;
  }

  private rect() {
    const c = this.centre();
    const { w, h } = ITEM_SIZE.reveal;
    return { x: c.x - w / 2, y: c.y - h / 2, w, h };
  }

  private place(): void {
    const r = this.rect();
    this.sprite.position.set(r.x, r.y);
  }
}
