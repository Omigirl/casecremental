import { Container, Sprite, type Texture } from "pixi.js";
import type { GameController } from "../../game/controller";
import type { Bench as BenchState } from "../../sim/run";
import type { Drop, SkinDef } from "../../sim/types";
import type { LiftInfo } from "../hd/Lifted";
import { SkinPlayer } from "../skins/player";
import type { SkinTextures } from "../skins/pixelSkin";
import { Actor } from "./Actor";
import { cardFace } from "./cardFace";
import { Animated } from "./Animated";
import { ANIMS } from "./anims";
import { cardGrabbable, DragTracker, type Grabbable } from "./drag";
import { ITEM_SIZE, type Pt, type Rect, type TableLayout } from "./layout";
import type { SpriteLibrary } from "./sprites";

// Your bench: the case on the mat, the key (drag it into the lock), the revealed skin card (drag
// it into the SELL bin) and the bin. Taps work too.
// Every change goes through controller.act — the one input path. A dragged item leaves the pixel
// world and is drawn lifted in the HD layer (lifted()) until it is let go.

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (r: Rect, p: Pt) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

export class Bench {
  readonly root = new Container();
  private readonly cases = new Map<string, Animated>();
  private caseId: string | null = null;
  private readonly key: Animated;
  private readonly bin: Animated;
  private readonly card = new Sprite();
  /** The reveal card, baked once per frame of the skin's loop (one frame for a still skin). */
  private cardFrames: Texture[] = [];
  private cardPlayer: SkinPlayer<Texture> | null = null;
  /** The card without its art, shown while a ★ knife is out of it. */
  private cardEmpty: Texture | null = null;
  private knifeFlying = false;
  private readonly drag = new DragTracker();
  private keyAtLock = 0;
  private l: TableLayout | null = null;
  private phase: BenchState["phase"] = "empty";

  constructor(
    private readonly lib: SpriteLibrary,
    private readonly skins: SkinTextures,
    private readonly controller: GameController,
    /** Renders a container into a 1:1 nearest-sampled texture (the reveal card). */
    private readonly bake: (c: Container) => Texture,
  ) {
    this.key = new Animated(new Actor(lib.get("key", { w: 20, h: 24, frames: 4 })), ANIMS.keyIdle);
    this.bin = new Animated(new Actor(lib.get("sell-bin", { w: 26, h: 38, frames: 4 })), ANIMS.binIdle);
    this.card.visible = false;
    this.root.addChild(this.bin.actor, this.card, this.key.actor);
  }

  layout(l: TableLayout): void {
    this.l = l;
    for (const c of this.cases.values()) c.actor.place(l.you.caseSpot.x, l.you.caseSpot.y);
    this.bin.actor.place(l.bin.x, l.bin.y + l.binR);
    this.homeItems();
  }

  /** World centre of the reveal card (coins and sparks start here). */
  revealCentre(): Pt {
    return this.l ? { ...this.l.you.reveal } : { x: 0, y: 0 };
  }

  showCase(caseId: string, dropIn: boolean): void {
    this.hideCase();
    let a = this.cases.get(caseId);
    if (!a) {
      a = new Animated(new Actor(this.lib.get(`case-${caseId}`, { w: 26, h: 34, frames: 4 })), ANIMS.caseIdle);
      this.cases.set(caseId, a);
      this.root.addChildAt(a.actor, 0);
    }
    a.setIdle(ANIMS.caseIdle);
    if (this.l) a.actor.place(this.l.you.caseSpot.x, this.l.you.caseSpot.y);
    a.actor.visible = true;
    if (dropIn) a.play(ANIMS.caseDrop);
    this.caseId = caseId;
  }

  /** The key turns in the lock and the lid lifts (spinStarted). */
  openCase(): void {
    const c = this.caseId ? this.cases.get(this.caseId) : null;
    c?.setIdle(ANIMS.caseOpenIdle);
    c?.play(ANIMS.caseOpen);
    this.keyAtLock = 450; // ms the key stays in the lock
    this.key.play(ANIMS.keyTurn);
    this.homeItems();
  }

  hideCase(): void {
    for (const c of this.cases.values()) c.actor.visible = false;
    this.caseId = null;
  }

  showReveal(skin: SkinDef, drop: Drop): void {
    for (const t of this.cardFrames) t.destroy(true);
    this.cardFrames = this.skins.frames(skin).map((tex) => {
      const face = cardFace(tex, drop);
      const baked = this.bake(face);
      face.destroy({ children: true });
      return baked;
    });
    this.cardEmpty?.destroy(true);
    const empty = cardFace(null, drop);
    this.cardEmpty = this.bake(empty);
    empty.destroy({ children: true });
    this.knifeFlying = false;
    this.cardPlayer = new SkinPlayer(this.cardFrames, this.skins.fps(skin));
    this.card.texture = this.cardPlayer.frame;
    this.card.visible = true;
    this.homeItems();
  }

  /** The ★ knife has left the card: show it empty, and keep it from being picked up until the knife lands. */
  beginKnifeFlight(): void {
    this.knifeFlying = true;
    if (this.cardEmpty) this.card.texture = this.cardEmpty;
  }

  /** The knife is back in the card: it spins there from its first frame. */
  endKnifeFlight(): void {
    this.knifeFlying = false;
    this.cardPlayer?.reset();
    if (this.cardPlayer && this.card.visible) this.card.texture = this.cardPlayer.frame;
  }

  /** The bin swallows a card the bot or a tray claim sold. */
  swallow(): void {
    this.bin.play(ANIMS.binSwallow);
  }

  /** The card leaves; if it was sold the bin swallows it. */
  clearReveal(sold: boolean): void {
    this.knifeFlying = false;
    this.card.visible = false;
    this.hideCase();
    if (sold) this.bin.play(ANIMS.binSwallow);
  }

  // ── input, in world px ──────────────────────────────────────────────────────────────────────

  pointerDown(p: Pt): boolean {
    const grabbed = this.drag.down(p, this.grabbables());
    if (grabbed === "card") this.controller.act({ type: "holdCard", held: true }); // the bot turns back (spec §3)
    if (grabbed) return true;
    if (this.phase === "revealed" && this.l && dist(p, this.l.bin) <= this.l.binR + 2) return this.controller.act({ type: "sell" }).ok;
    return false;
  }

  pointerMove(p: Pt): void {
    this.drag.move(p);
  }

  pointerUp(p: Pt): void {
    const wasCard = this.drag.dragging === "card";
    const end = this.drag.up(p);
    const l = this.l;
    if (end.kind === "tap") this.controller.act(end.id === "key" ? { type: "insertKey" } : { type: "sell" });
    if (end.kind === "drop" && l) {
      const lock = { x: l.you.caseSpot.x, y: l.you.caseSpot.y - 10 };
      if (end.id === "key" && (dist(end.at, lock) <= 18 || inside(l.you.mat, end.at))) this.controller.act({ type: "insertKey" });
      if (end.id === "card" && dist(end.at, l.bin) <= l.binR + 8) this.controller.act({ type: "sell" });
    }
    if (wasCard) this.controller.act({ type: "holdCard", held: false });
    this.homeItems();
  }

  /** The item being dragged, for the HD layer to draw lifted (null when nothing is held). */
  lifted(): LiftInfo | null {
    const p = this.drag.exactPosition;
    const id = this.drag.dragging;
    if (!p || !id) return null;
    if (id === "key") {
      const m = this.key.actor.meta;
      return { id, texture: this.key.actor.set.frames[0]!, center: { x: p.x + m.frameW / 2, y: p.y + m.frameH / 2 } };
    }
    if (!this.cardFrames.length) return null;
    const { w, h } = ITEM_SIZE.reveal;
    return { id, texture: this.card.texture, center: { x: p.x + w / 2, y: p.y + h / 2 } };
  }

  /** The viewport changed under a drag: the item goes home and nothing fires. */
  cancelDrag(): void {
    if (this.drag.dragging === "card") this.controller.act({ type: "holdCard", held: false });
    this.drag.cancel();
    this.homeItems();
  }

  update(ms: number, b: BenchState): void {
    this.phase = b.phase;
    if (this.keyAtLock > 0 && (this.keyAtLock -= ms) <= 0) this.homeItems();
    this.key.setIdle(b.phase === "locked" ? ANIMS.keyReady : ANIMS.keyIdle);
    this.bin.setIdle(b.phase === "revealed" ? ANIMS.binHungry : ANIMS.binIdle);
    // the held item is drawn lifted in the HD layer instead
    this.key.actor.visible = this.drag.dragging !== "key";
    this.card.alpha = this.drag.dragging === "card" ? 0 : 1;
    for (const c of this.cases.values()) if (c.actor.visible) c.update(ms);
    this.key.update(ms);
    this.bin.update(ms);
    if (this.card.visible && !this.knifeFlying && this.cardPlayer?.moving) this.card.texture = this.cardPlayer.advance(ms);
    this.key.actor.alpha = b.phase === "locked" || this.keyAtLock > 0 ? 1 : 0.45;
  }

  private grabbables(): Grabbable[] {
    const out: Grabbable[] = [];
    if (this.phase === "locked" && this.keyAtLock <= 0) out.push({ id: "key", rect: this.key.actor.box() });
    if (cardGrabbable(this.phase, this.card.visible, this.knifeFlying)) out.push({ id: "card", rect: this.cardRect() });
    return out;
  }

  private cardRect(): Rect {
    const r = this.revealCentre();
    const { w, h } = ITEM_SIZE.reveal;
    return { x: r.x - w / 2, y: r.y - h / 2, w, h };
  }

  destroy(): void {
    for (const t of this.cardFrames) t.destroy(true);
    this.cardFrames = [];
    this.cardPlayer = null;
    this.cardEmpty?.destroy(true);
    this.cardEmpty = null;
  }

  private homeItems(): void {
    const l = this.l;
    if (!l) return;
    if (this.keyAtLock > 0) this.key.actor.place(l.you.caseSpot.x + 2, l.you.caseSpot.y - 6);
    else this.key.actor.place(l.you.keyHome.x, l.you.keyHome.y + 5);
    const c = this.cardRect();
    this.card.position.set(c.x, c.y);
  }
}
