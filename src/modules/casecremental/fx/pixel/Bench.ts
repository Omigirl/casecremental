import { Container, type Texture } from "pixi.js";
import type { GameController } from "../../game/controller";
import type { Bench as BenchState } from "../../sim/run";
import type { Drop, SkinDef } from "../../sim/types";
import type { LiftInfo } from "../hd/Lifted";
import type { SkinTextures } from "../skins/pixelSkin";
import { Actor } from "./Actor";
import { Animated } from "./Animated";
import { ANIMS } from "./anims";
import { BenchCards, centreOf } from "./BenchCards";
import { cardGrabbable, DragTracker, type Grabbable } from "./drag";
import { ITEM_SIZE, revealSpots, type Pt, type Rect, type TableLayout } from "./layout";
import type { SpriteLibrary } from "./sprites";

// Your bench: the case on the mat, the key (drag it into the lock), the revealed skin cards (multi-open:
// side by side; drag each into the SELL bin) and the bin. Taps work too.
// Every change goes through controller.act — the one input path. A dragged item leaves the pixel
// world and is drawn lifted in the HD layer (lifted()) until it is let go.

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (r: Rect, p: Pt) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;
/** A card's drag id is `card<slot>`; the key's is "key". */
const cardSlot = (id: string | null): number | null => (id?.startsWith("card") ? Number(id.slice(4)) : null);
/** The card count of the current open (1 when the bench holds none). */
const cardCount = (b: BenchState): number =>
  b.phase === "revealed" ? b.cards.length : b.phase === "spinning" ? b.reels.length : b.phase === "locked" ? b.count : 1;

export class Bench {
  readonly root = new Container();
  private readonly cases = new Map<string, Animated>();
  private caseId: string | null = null;
  private readonly key: Animated;
  private readonly bin: Animated;
  private readonly cards: BenchCards;
  private readonly drag = new DragTracker();
  private keyAtLock = 0;
  private l: TableLayout | null = null;
  private phase: BenchState["phase"] = "empty";
  /** The layout and card count the cards were last placed for (placeCards runs every frame). */
  private placed: { l: TableLayout; n: number } | null = null;

  constructor(
    private readonly lib: SpriteLibrary,
    skins: SkinTextures,
    private readonly controller: GameController,
    /** Renders a container into a 1:1 nearest-sampled texture (the reveal cards). */
    bake: (c: Container) => Texture,
  ) {
    this.key = new Animated(new Actor(lib.get("key", { w: 20, h: 24, frames: 4 })), ANIMS.keyIdle);
    this.bin = new Animated(new Actor(lib.get("sell-bin", { w: 26, h: 38, frames: 4 })), ANIMS.binIdle);
    this.cards = new BenchCards(skins, bake);
    this.root.addChild(this.bin.actor, this.cards.root, this.key.actor);
  }

  layout(l: TableLayout): void {
    this.l = l;
    for (const c of this.cases.values()) c.actor.place(l.you.caseSpot.x, l.you.caseSpot.y);
    this.bin.actor.place(l.bin.x, l.bin.y + l.binR);
    this.homeItems();
  }

  /** World centre of the cards still waiting, or of the reveal spot (the camera pushes in here). */
  revealCentre(): Pt {
    const home = this.l ? this.l.you.reveal : { x: 0, y: 0 };
    return centreOf(
      this.cards.waiting().map((s) => this.cards.centre(s)),
      home,
    );
  }

  /** World centre of one card (coins and sparks start here). */
  cardCentre(slot: number): Pt {
    return this.cards.centre(slot);
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

  showReveal(slot: number, skin: SkinDef, drop: Drop): void {
    this.placeCards();
    this.cards.show(slot, skin, drop);
  }

  /** The ★ knife has left this card: show it empty, and keep it from being picked up until the knife lands. */
  beginKnifeFlight(slot: number): void {
    this.cards.beginKnifeFlight(slot);
  }

  /** The knife is back in its card: it spins there from its first frame. */
  endKnifeFlight(): void {
    this.cards.endKnifeFlight();
  }

  /** The slot whose ★ knife is out, or null. */
  get knifeOut(): number | null {
    return this.cards.knifeOut;
  }

  /** The bin swallows a card the bot or a tray claim sold. */
  swallow(): void {
    this.bin.play(ANIMS.binSwallow);
  }

  /** A card leaves; if it was sold the bin swallows it. The case goes with the last card. */
  clearReveal(slot: number, sold: boolean): void {
    this.cards.clear(slot);
    if (!this.cards.waiting().length) this.hideCase();
    if (sold) this.bin.play(ANIMS.binSwallow);
  }

  /** Every card leaves at once (a new run). */
  clearAll(): void {
    this.cards.clearAll();
    this.hideCase();
  }

  // ── input, in world px ──────────────────────────────────────────────────────────────────────

  pointerDown(p: Pt): boolean {
    const grabbed = this.drag.down(p, this.grabbables());
    const slot = cardSlot(grabbed);
    if (slot !== null) this.controller.act({ type: "holdCard", spot: "bench", slot }); // the auto-seller leaves it be
    if (grabbed) return true;
    if (this.phase === "revealed" && this.l && dist(p, this.l.bin) <= this.l.binR + 2)
      return this.controller.act({ type: "sell", slot: this.cards.waiting()[0] ?? 0 }).ok;
    return false;
  }

  pointerMove(p: Pt): void {
    this.drag.move(p);
  }

  pointerUp(p: Pt): void {
    const end = this.drag.up(p);
    const slot = end.kind === "none" ? null : cardSlot(end.id);
    const l = this.l;
    if (end.kind === "tap") this.controller.act(slot === null ? { type: "insertKey" } : { type: "sell", slot });
    if (end.kind === "drop" && l) {
      const lock = { x: l.you.caseSpot.x, y: l.you.caseSpot.y - 10 };
      if (end.id === "key" && (dist(end.at, lock) <= 18 || inside(l.you.mat, end.at))) this.controller.act({ type: "insertKey" });
      if (slot !== null && dist(end.at, l.bin) <= l.binR + 8) this.controller.act({ type: "sell", slot });
    }
    if (slot !== null) this.controller.act({ type: "holdCard", spot: null });
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
    const slot = cardSlot(id);
    const texture = slot === null ? null : this.cards.texture(slot);
    if (!texture) return null;
    const { w, h } = ITEM_SIZE.reveal;
    return { id, texture, center: { x: p.x + w / 2, y: p.y + h / 2 } };
  }

  /** The viewport changed under a drag: the item goes home and nothing fires. */
  cancelDrag(): void {
    if (cardSlot(this.drag.dragging) !== null) this.controller.act({ type: "holdCard", spot: null });
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
    this.placeCards();
    this.cards.update(ms, cardSlot(this.drag.dragging));
    for (const c of this.cases.values()) if (c.actor.visible) c.update(ms);
    this.key.update(ms);
    this.bin.update(ms);
    this.key.actor.alpha = b.phase === "locked" || this.keyAtLock > 0 ? 1 : 0.45;
  }

  private grabbables(): Grabbable[] {
    const out: Grabbable[] = [];
    if (this.phase === "locked" && this.keyAtLock <= 0) out.push({ id: "key", rect: this.key.actor.box() });
    // where cards overlap (portrait) the one drawn on top, the later slot, is grabbed first
    for (const slot of this.cards.waiting().reverse())
      if (cardGrabbable(this.phase, true, this.cards.knifeOut === slot)) out.push({ id: `card${slot}`, rect: this.cards.rect(slot) });
    return out;
  }

  destroy(): void {
    this.cards.destroy();
  }

  /** The cards sit side by side, as many spots as the current open has cases. */
  private placeCards(): void {
    const n = cardCount(this.controller.run.state.bench);
    if (!this.l || (this.placed?.l === this.l && this.placed.n === n)) return;
    this.placed = { l: this.l, n };
    this.cards.layout(revealSpots(this.l, n));
  }

  private homeItems(): void {
    const l = this.l;
    if (!l) return;
    if (this.keyAtLock > 0) this.key.actor.place(l.you.caseSpot.x + 2, l.you.caseSpot.y - 6);
    else this.key.actor.place(l.you.keyHome.x, l.you.keyHome.y + 5);
    this.placeCards();
  }
}
