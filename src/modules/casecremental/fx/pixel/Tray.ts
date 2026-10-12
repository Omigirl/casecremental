import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import type { GameController } from "../../game/controller";
import { skinById } from "../../sim/content/cases";
import { RARITY_INFO } from "../../sim/rarity";
import type { Drop } from "../../sim/types";
import type { LiftInfo } from "../hd/Lifted";
import type { SkinTextures } from "../skins/pixelSkin";
import { fitArt } from "../skins/thumb";
import { Throttle } from "../throttle";
import { cardFace } from "./cardFace";
import { DragTracker } from "./drag";
import { dropTarget } from "./dropTargets";
import type { Pt, Rect, TableLayout } from "./layout";
import { glows, popLook, slideAt, slotArtBox, throb, TRAY_LOOK, TrayMotion } from "./trayRules";
import { slotAt, traySlots } from "./traySlots";

// The claim tray (M2b spec §4): the good drops the bot set aside, one small card per slot — the skin's art on its rarity
// colour. Drag one to the SELL bin (or tap it) to claim it — a sale by hand, so it feeds the combo — or onto the locker
// to keep it. Dragged, it lifts at full card size. Since F1 it moves (trayRules.ts): a stored card slides in from its
// spot and hops onto its slot (the store sound as it lands), a claimed one pops out, Covert and ★ glow, and a full
// tray pulses its frame red.

export interface TrayDeps {
  /** The pixel scale now (glows and pops are HD). */
  scale: () => number;
  /** A sliding card reached its slot (the World plays tray-store). */
  onLand: () => void;
}

/** Lifted's LIFT: a dragged card's pop starts at its lifted size. */
const LIFT = 1.15;
const FULL_RED = 0xff3b3b;

/** A tray card w×h: a dark edge, its rarity colour, the skin's still frame fitted inside. */
export function miniCard(skins: SkinTextures, drop: Drop, w: number, h: number): Container {
  const skin = skinById(drop.skinId);
  const card = new Container();
  card.addChild(
    new Graphics()
      .rect(0, 0, w, h)
      .fill({ color: 0x120e10 })
      .rect(1, 1, w - 2, h - 2)
      .fill({ color: 0x15161d })
      .rect(1, 1, w - 2, h - 2)
      .fill({ color: RARITY_INFO[drop.rarity].color, alpha: 0.6 }),
  );
  const box = slotArtBox({ x: 0, y: 0, w, h });
  if (box.w > 0 && box.h > 0) {
    const size = skins.size(skin);
    const fit = fitArt(size.w, size.h, box);
    const art = new Sprite(skins.thumb(skin, fit.w, fit.h));
    art.position.set(Math.floor((w - fit.w) / 2), Math.floor((h - fit.h) / 2));
    card.addChild(art);
  }
  return card;
}

export class TrayView {
  /** Slots, settled cards and the full frame (pixel world, in the room's front). */
  readonly root = new Container();
  /** Cards sliding in (pixel world, over the bench). */
  readonly over = new Container();
  /** Covert/★ glows and claimed cards popping out (HD). */
  readonly hd = new Container();
  private readonly bg = new Graphics();
  private readonly cards = new Container();
  private readonly fullFrame = new Graphics();
  private readonly glow = new Graphics();
  private readonly drag = new DragTracker();
  private readonly motion = new TrayMotion();
  private readonly flying = new Map<number, Container>();
  private readonly popping = new Map<number, { sprite: Sprite; tex: Texture }>();
  /** Cards let go over the bin: where (centre, world px) and their lifted face, for their pop. */
  private readonly dropped = new Map<number, { at: Pt; tex: Texture }>();
  /** Last frame's drops by id (a claimed card is gone from the sim when it pops). */
  private known = new Map<number, Drop>();
  private readonly landSound = new Throttle(0.1);
  private slots: Rect[] = [];
  private items: readonly Drop[] = [];
  private l: TableLayout | null = null;
  private drawn = "";
  private liftTex: Texture | null = null;
  private t = 0;

  constructor(
    private readonly skins: SkinTextures,
    private readonly controller: GameController,
    private readonly bake: (c: Container) => Texture,
    private readonly deps: TrayDeps,
  ) {
    this.glow.blendMode = "add";
    this.root.addChild(this.bg, this.cards, this.fullFrame);
    this.hd.addChild(this.glow);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.drawn = "";
    this.motion.settle(); // Review Focus 3: a resize mid-slide or mid-pop settles at once
    this.clearMotion();
    const r = l.tray;
    const [x, y, w, h] = [r.x - 2, r.y - 2, r.w + 4, r.h + 4]; // just outside the tray art (which overhangs 1 px)
    this.fullFrame
      .clear()
      .rect(x, y, w, 1)
      .fill({ color: FULL_RED })
      .rect(x, y + h - 1, w, 1)
      .fill({ color: FULL_RED })
      .rect(x, y, 1, h)
      .fill({ color: FULL_RED })
      .rect(x + w - 1, y, 1, h)
      .fill({ color: FULL_RED });
    this.fullFrame.alpha = 0;
  }

  /** A card the sim just stored, from its spot (centre, world px): it slides in. */
  arriving(id: number, from: Pt): void {
    this.motion.arriving(id, from);
  }

  /** A card claimed (sold by hand): it pops out where it was dropped over the bin, else at its slot. Returns that point
   *  (world px) — the sale's coins start there. */
  claimed(id: number): Pt {
    const at = this.dropped.get(id)?.at ?? null;
    this.motion.claimed(id, at);
    if (at) return at;
    const i = [...this.known.keys()].indexOf(id); // last frame's order: the sim has already spliced a claimed card out of `items`
    if (i >= 0 && this.slots[i]) return this.slotCentre(i);
    const r = this.l?.tray ?? { x: 0, y: 0, w: 0, h: 0 };
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  update(items: readonly Drop[], capacity: number, dt: number, full: boolean): void {
    const l = this.l;
    if (!l) return;
    this.t += dt;
    this.items = items;
    this.slots = traySlots(l.tray, capacity);
    const landed = this.motion.update(
      items.map((d) => d.id),
      dt,
      (i) => this.slotCentre(i),
    );
    if (landed.length && this.landSound.ready(this.t)) this.deps.onLand(); // one store sound for cards landing together
    this.drawSlides(items);
    this.drawPops();
    for (const [id, d] of this.dropped) {
      if (this.popping.has(id)) continue;
      d.tex.destroy(true); // a refused claim
      this.dropped.delete(id);
    }
    this.known = new Map(items.map((d) => [d.id, d]));
    const k = this.deps.scale();
    const dragging = this.drag.dragging;
    const key = `${capacity}|${items.map((d) => d.id).join(",")}|${dragging ?? ""}|${[...this.motion.slides.keys()].join(",")}|${k}`;
    if (key !== this.drawn) {
      this.drawn = key;
      this.redraw(items, dragging, k);
    }
    this.glow.alpha = throb(this.t, TRAY_LOOK.glow);
    this.fullFrame.alpha = full ? throb(this.t, TRAY_LOOK.full) : 0;
  }

  pointerDown(p: Pt): boolean {
    const i = slotAt(this.slots, p);
    const d = i >= 0 ? this.items[i] : undefined;
    if (!d || this.motion.flying(d.id)) return false; // Review Focus 4: a card still sliding in cannot be grabbed
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
    const lift = this.lifted();
    const end = this.drag.up(p);
    const l = this.l;
    if (!id || !l) return;
    const index = Number(id.slice("tray:".length));
    const target = end.kind === "drop" ? dropTarget(l, end.at, this.controller.run.state.locker.on) : null;
    const d = this.items[index];
    if (target === "bin" && d && lift && this.liftTex) {
      this.dropped.set(d.id, { at: lift.center, tex: this.liftTex }); // its pop takes the lifted face
      this.liftTex = null;
    }
    if (end.kind === "tap" || target === "bin") this.controller.act({ type: "claim", index });
    if (target === "locker") this.controller.act({ type: "storeCard", from: "tray", slot: index });
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
    this.clearMotion();
  }

  private slotCentre(i: number): Pt {
    const r = this.slots[i]!;
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  /** Empty slots, the settled cards (a card being dragged or still sliding leaves its slot empty), and the glows. */
  private redraw(items: readonly Drop[], dragging: string | null, k: number): void {
    this.bg.clear();
    for (const c of this.cards.removeChildren()) c.destroy({ children: true });
    this.glow.clear();
    this.slots.forEach((r, i) => {
      const d = items[i];
      if (!d || dragging === `tray:${i}` || this.motion.flying(d.id)) {
        this.bg.rect(r.x, r.y, r.w, r.h).fill({ color: 0x120e10, alpha: 0.35 });
        return;
      }
      const card = miniCard(this.skins, d, r.w, r.h);
      card.position.set(r.x, r.y);
      this.cards.addChild(card);
      if (glows(d.rarity))
        this.glow.rect((r.x - 1) * k, (r.y - 1) * k, (r.w + 2) * k, (r.h + 2) * k).fill({ color: RARITY_INFO[d.rarity].color });
    });
  }

  /** Cards sliding in, drawn over the bench at their place on the slide. */
  private drawSlides(items: readonly Drop[]): void {
    for (const [id, c] of this.flying)
      if (!this.motion.flying(id)) {
        c.destroy({ children: true });
        this.flying.delete(id);
      }
    items.forEach((d, i) => {
      const s = this.motion.slides.get(d.id);
      const r = this.slots[i];
      if (!s || !r) return;
      let c = this.flying.get(d.id);
      if (!c) {
        c = miniCard(this.skins, d, r.w, r.h);
        this.over.addChild(c);
        this.flying.set(d.id, c);
      }
      const at = slideAt({ x: Math.round(s.from.x - r.w / 2), y: Math.round(s.from.y - r.h / 2) }, { x: r.x, y: r.y }, s.t);
      if (at) c.position.set(at.x, at.y);
    });
  }

  /** Claimed cards popping out (HD): a dragged one at its lifted size where it was dropped, a tapped one at its slot. */
  private drawPops(): void {
    const k = this.deps.scale();
    const live = new Set(this.motion.pops.map((p) => p.id));
    for (const [id, p] of this.popping)
      if (!live.has(id)) {
        p.sprite.destroy();
        p.tex.destroy(true);
        this.popping.delete(id);
      }
    for (const pop of this.motion.pops) {
      let p = this.popping.get(pop.id);
      if (!p) {
        const dropped = this.dropped.get(pop.id);
        const drop = this.known.get(pop.id);
        const r = this.slots[0];
        let tex: Texture | null = null;
        if (pop.dragged && dropped) {
          tex = dropped.tex;
          this.dropped.delete(pop.id);
        } else if (drop && r) {
          const face = miniCard(this.skins, drop, r.w, r.h);
          tex = this.bake(face);
          face.destroy({ children: true });
        }
        if (!tex) continue;
        p = { sprite: new Sprite({ texture: tex, anchor: 0.5 }), tex };
        this.hd.addChild(p.sprite);
        this.popping.set(pop.id, p);
      }
      const look = popLook(pop.t);
      if (!look) continue;
      p.sprite.position.set(pop.at.x * k, pop.at.y * k);
      p.sprite.scale.set(k * (pop.dragged ? LIFT : 1) * look.scale);
      p.sprite.alpha = look.alpha;
    }
  }

  /** Drop every sliding card, pop and dropped face (a resize, or the scene going away). */
  private clearMotion(): void {
    for (const c of this.flying.values()) c.destroy({ children: true });
    this.flying.clear();
    for (const p of this.popping.values()) {
      p.sprite.destroy();
      p.tex.destroy(true);
    }
    this.popping.clear();
    for (const d of this.dropped.values()) d.tex.destroy(true);
    this.dropped.clear();
  }
}
