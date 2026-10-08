import { Container, Graphics, type Texture } from "pixi.js";
import type { GameController } from "../../game/controller";
import { skinById } from "../../sim/content/cases";
import { RARITY_INFO } from "../../sim/rarity";
import type { Drop } from "../../sim/types";
import type { LiftInfo } from "../hd/Lifted";
import type { SkinTextures } from "../skins/pixelSkin";
import { cardFace } from "./cardFace";
import { DragTracker } from "./drag";
import type { Pt, Rect, TableLayout } from "./layout";
import { slotAt, traySlots } from "./traySlots";

// The claim tray (M2b spec §4): the good drops the bot set aside, one small card per slot. Drag one to
// the SELL bin (or tap it) to claim it — a sale by hand, so it feeds the combo. Dragged, it lifts at
// full card size.

export class TrayView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly drag = new DragTracker();
  private slots: Rect[] = [];
  private items: readonly Drop[] = [];
  private l: TableLayout | null = null;
  private drawn = "";
  private liftTex: Texture | null = null;

  constructor(
    private readonly skins: SkinTextures,
    private readonly controller: GameController,
    private readonly bake: (c: Container) => Texture,
  ) {
    this.root.addChild(this.g);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.drawn = "";
  }

  update(items: readonly Drop[], capacity: number): void {
    const l = this.l;
    if (!l) return;
    this.items = items;
    const dragging = this.drag.dragging;
    const key = `${capacity}|${items.map((d) => d.id).join(",")}|${dragging ?? ""}`;
    if (key === this.drawn) return;
    this.drawn = key;
    this.slots = traySlots(l.tray, capacity);
    this.g.clear();
    this.slots.forEach((r, i) => {
      const d = items[i];
      if (!d || dragging === `tray:${i}`) {
        this.g.rect(r.x, r.y, r.w, r.h).fill({ color: 0x120e10, alpha: 0.35 });
        return;
      }
      this.g
        .rect(r.x, r.y, r.w, r.h)
        .fill({ color: 0x120e10 })
        .rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2)
        .fill({ color: RARITY_INFO[d.rarity].color });
      if (r.w > 4 && r.h > 4) this.g.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4).fill({ color: 0x15161d });
    });
  }

  pointerDown(p: Pt): boolean {
    const i = slotAt(this.slots, p);
    const d = i >= 0 ? this.items[i] : undefined;
    if (!d) return false;
    this.drag.down(p, [{ id: `tray:${i}`, rect: this.slots[i]! }]);
    this.liftTex?.destroy(true);
    const face = cardFace(this.skins.frames(skinById(d.skinId))[0] ?? null, d);
    this.liftTex = this.bake(face);
    face.destroy({ children: true });
    return true;
  }

  pointerMove(p: Pt): void {
    this.drag.move(p);
  }

  pointerUp(p: Pt): void {
    const id = this.drag.dragging;
    const end = this.drag.up(p);
    const l = this.l;
    if (!id || !l) return;
    const index = Number(id.slice("tray:".length));
    const onBin = end.kind === "drop" && Math.hypot(end.at.x - l.bin.x, end.at.y - l.bin.y) <= l.binR + 8;
    if (end.kind === "tap" || onBin) this.controller.act({ type: "claim", index });
  }

  cancelDrag(): void {
    this.drag.cancel();
  }

  lifted(): LiftInfo | null {
    const p = this.drag.exactPosition;
    const id = this.drag.dragging;
    const r = id ? this.slots[Number(id.slice("tray:".length))] : undefined;
    if (!p || !id || !r || !this.liftTex) return null;
    return { id, texture: this.liftTex, center: { x: p.x + r.w / 2, y: p.y + r.h / 2 } };
  }

  destroy(): void {
    this.liftTex?.destroy(true);
    this.liftTex = null;
  }
}
