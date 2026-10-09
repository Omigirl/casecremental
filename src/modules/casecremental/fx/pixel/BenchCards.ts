import { Container, Sprite, Texture } from "pixi.js";
import { RARITY_ORDER } from "../../sim/rarity";
import type { Drop, SkinDef } from "../../sim/types";
import { SkinPlayer } from "../skins/player";
import type { SkinTextures } from "../skins/pixelSkin";
import { cardFace } from "./cardFace";
import { ITEM_SIZE, type Pt, type Rect } from "./layout";

// Your bench's revealed cards (multi-open: side by side, left to right). Each slot bakes its own card — one
// texture per frame of the skin's loop, plus an empty face shown while its ★ knife is out — and plays its own
// loop. Only one knife flies at a time.

/** The best card still waiting: the highest rarity, then the highest value (a tie keeps the left one). */
export function bestSlot(cards: readonly (Drop | null)[]): number | null {
  let best: number | null = null;
  cards.forEach((d, i) => {
    if (!d) return;
    const b = best === null ? null : cards[best]!;
    const rank = (x: Drop) => RARITY_ORDER.indexOf(x.rarity);
    if (!b || rank(d) > rank(b) || (rank(d) === rank(b) && d.value > b.value)) best = i;
  });
  return best;
}

/** The first card whose skin flips (a ★ knife): the knife flight launches from it. */
export function knifeSlot(cards: readonly (Drop | null)[], flips: (d: Drop) => boolean): number | null {
  const i = cards.findIndex((d) => !!d && flips(d));
  return i < 0 ? null : i;
}

/** The middle of the points, or `fallback` when there are none. */
export function centreOf(points: readonly Pt[], fallback: Pt): Pt {
  if (!points.length) return { ...fallback };
  const sum = points.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

interface Slot {
  readonly sprite: Sprite;
  frames: Texture[];
  player: SkinPlayer<Texture> | null;
  /** The card without its art, shown while a ★ knife is out of it. */
  empty: Texture | null;
}

export class BenchCards {
  readonly root = new Container();
  private readonly slots: Slot[] = [];
  private spots: Pt[] = [];
  /** The slot whose knife is out, or null. */
  private knife: number | null = null;

  constructor(
    private readonly skins: SkinTextures,
    /** Renders a container into a 1:1 nearest-sampled texture. */
    private readonly bake: (c: Container) => Texture,
  ) {}

  show(slot: number, skin: SkinDef, drop: Drop): void {
    const s = this.slot(slot);
    this.release(s);
    s.frames = this.skins.frames(skin).map((tex) => this.bakeFace(tex, drop));
    s.empty = this.bakeFace(null, drop);
    if (this.knife === slot) this.knife = null;
    s.player = new SkinPlayer(s.frames, this.skins.fps(skin));
    s.sprite.texture = s.player.frame;
    s.sprite.visible = true;
    this.place(slot);
  }

  /** The card leaves, and its baked textures with it. */
  clear(slot: number): void {
    const s = this.slots[slot];
    if (s) {
      s.sprite.visible = false;
      this.release(s);
    }
    if (this.knife === slot) this.knife = null;
  }

  clearAll(): void {
    this.slots.forEach((_, i) => this.clear(i));
  }

  layout(spots: readonly Pt[]): void {
    this.spots = [...spots];
    this.slots.forEach((_, i) => this.place(i));
  }

  /** World centre of a card. */
  centre(slot: number): Pt {
    return { ...(this.spots[slot] ?? this.spots[0] ?? { x: 0, y: 0 }) };
  }

  rect(slot: number): Rect {
    const c = this.centre(slot);
    const { w, h } = ITEM_SIZE.reveal;
    return { x: c.x - w / 2, y: c.y - h / 2, w, h };
  }

  visible(slot: number): boolean {
    return !!this.slots[slot]?.sprite.visible;
  }

  /** The slots with a card up, left to right. */
  waiting(): number[] {
    return this.slots.flatMap((s, i) => (s.sprite.visible ? [i] : []));
  }

  /** The slot whose ★ knife is out, or null. */
  get knifeOut(): number | null {
    return this.knife;
  }

  /** The ★ knife has left this card: show it empty, and keep it from being picked up until the knife lands. */
  beginKnifeFlight(slot: number): void {
    const s = this.slots[slot];
    if (!s) return;
    this.knife = slot;
    if (s.empty) s.sprite.texture = s.empty;
  }

  /** The knife is back in its card: it spins there from its first frame. */
  endKnifeFlight(): void {
    const s = this.knife === null ? null : this.slots[this.knife];
    this.knife = null;
    if (!s?.player) return;
    s.player.reset();
    if (s.sprite.visible) s.sprite.texture = s.player.frame;
  }

  /** Advance every card's loop; the held card is drawn lifted in the HD layer instead. */
  update(ms: number, draggingSlot: number | null): void {
    this.slots.forEach((s, i) => {
      s.sprite.alpha = draggingSlot === i ? 0 : 1;
      if (s.sprite.visible && this.knife !== i && s.player?.moving) s.sprite.texture = s.player.advance(ms);
    });
  }

  /** The card as it looks now (a lifted card draws this), or null when the slot was never shown. */
  texture(slot: number): Texture | null {
    const s = this.slots[slot];
    return s?.frames.length ? s.sprite.texture : null;
  }

  destroy(): void {
    for (const s of this.slots) this.release(s);
  }

  private slot(i: number): Slot {
    while (this.slots.length <= i) {
      const sprite = new Sprite();
      sprite.visible = false;
      this.slots.push({ sprite, frames: [], player: null, empty: null });
      this.root.addChild(sprite); // later slots draw over earlier ones where they overlap
    }
    return this.slots[i]!;
  }

  private place(i: number): void {
    const r = this.rect(i);
    this.slots[i]?.sprite.position.set(r.x, r.y);
  }

  private bakeFace(art: Texture | null, drop: Drop): Texture {
    const face = cardFace(art, drop);
    const baked = this.bake(face);
    face.destroy({ children: true });
    return baked;
  }

  private release(s: Slot): void {
    s.sprite.texture = Texture.EMPTY; // never left pointing at a destroyed texture
    for (const t of s.frames) t.destroy(true);
    s.frames = [];
    s.player = null;
    s.empty?.destroy(true);
    s.empty = null;
  }
}
