import { Container } from "pixi.js";
import type { Action } from "../../game/controller";
import { skinById } from "../../sim/content/cases";
import { RARITY_INFO } from "../../sim/rarity";
import type { Drop, RarityId } from "../../sim/types";
import { CardGlows } from "../hd/cardGlows";
import { KnifeFlight } from "../hd/knifeFlight";
import type { LiftInfo } from "../hd/Lifted";
import type { StationDeps } from "../stations/deps";
import { BenchCards, knifeSlot } from "./BenchCards";
import { DragTracker, type Grabbable } from "./drag";
import { dropTarget } from "./dropTargets";
import { ITEM_SIZE, type Pt, type TableLayout } from "./layout";

// A station's waiting cards (spec §4–§5: the bot's pair, the locker's contract results): side by side at their spots,
// each dragged to the SELL bin or the locker, or tapped to sell — hand actions, so they feed the combo — or left for
// the auto-seller. They follow the sim every frame (a reload redraws them); the reveal juice — sparks, a glow per
// card, the ★ knife's showcase — comes from the station's events.

export interface CardStationConfig {
  spot: "bot" | "locker";
  /** Where n cards sit (layout.ts). */
  spots: (l: TableLayout, n: number) => Pt[];
  /** The hand sale of one card. */
  sell: (slot: number) => Action;
  /** Sparks per card as it comes up. */
  burst: (rarity: RarityId) => { count: number; speed: number };
}

/** Glows: one per slot (a pair at most — a contract's Contract Killer double, the bot's ×2). */
const SLOTS = 2;

/** The slots on screen still match the sim's cards (by drop id). Allocates nothing: it runs every frame. */
export function sameIds(shown: readonly (number | null)[], cards: readonly (Drop | null)[]): boolean {
  if (shown.length !== cards.length) return false;
  for (let i = 0; i < cards.length; i++) if ((cards[i]?.id ?? null) !== shown[i]) return false;
  return true;
}

/** The slots to clear and to show so the cards on screen match the sim's. */
export function syncPlan(shown: readonly (number | null)[], cards: readonly (Drop | null)[]): { show: number[]; clear: number[] } {
  const show: number[] = [];
  const clear: number[] = [];
  for (let i = 0; i < Math.max(shown.length, cards.length); i++) {
    const want = cards[i]?.id ?? null;
    const have = shown[i] ?? null;
    if (want === have) continue;
    if (have !== null) clear.push(i);
    if (want !== null) show.push(i);
  }
  return { show, clear };
}

/** A drag id `bot:1` → slot 1. */
const slotOf = (id: string | null): number | null => (id === null ? null : Number(id.slice(id.indexOf(":") + 1)));

export class CardStation {
  readonly root: Container;
  /** Its glows and its knife's showcase (HD layer, screen px). */
  readonly hdRoot = new Container();
  private readonly cards: BenchCards;
  private readonly glows: CardGlows;
  private readonly knife: KnifeFlight;
  private readonly drag = new DragTracker();
  private shown: (number | null)[] = [];
  private last: readonly (Drop | null)[] = [];
  private l: TableLayout | null = null;
  private placedN = 0;
  private t = 0;

  constructor(
    private readonly cfg: CardStationConfig,
    private readonly d: StationDeps,
  ) {
    this.cards = new BenchCards(d.skins, d.bake);
    this.root = this.cards.root;
    this.glows = new CardGlows(d.juice.hd.glowTexture, SLOTS);
    this.hdRoot.addChild(this.glows.root);
    this.knife = new KnifeFlight(this.hdRoot);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.cancelKnife(); // the screen changed: a knife in the air goes straight back
    this.placedN = 0;
    this.place(Math.max(1, this.shown.length));
    this.refreshGlows();
  }

  /** Its ★ knife's showcase is in the air. */
  get knifeFlying(): boolean {
    return this.knife.flying;
  }

  /** World centre of one card (coins and sparks start here). */
  centre(slot: number): Pt {
    return this.cards.centre(slot);
  }

  /** Follow the sim: new cards appear (no juice — a reload, a quiet arrival), gone ones clear. */
  update(ms: number, dt: number, cards: readonly (Drop | null)[]): void {
    this.t += dt;
    this.knife.update(dt);
    this.sync(cards);
    this.cards.update(ms, slotOf(this.drag.dragging));
    this.glows.update(dt, this.t);
  }

  /** Cards just came up (the bot's reels landed, a contract's results popped): sparks per card, the ★ knife. */
  revealed(drops: readonly Drop[]): void {
    this.sync(drops);
    const hd = this.d.juice.hd;
    drops.forEach((drop, i) => {
      const b = this.cfg.burst(drop.rarity);
      hd.particles.burst(hd.toScreen(this.centre(i)), RARITY_INFO[drop.rarity].color, b.count, b.speed);
    });
    const k = knifeSlot(drops, (x) => skinById(x.skinId).motion?.weapon === "flip");
    if (k !== null) this.launchKnife(k, drops[k]!);
  }

  pointerDown(p: Pt): boolean {
    const items: Grabbable[] = [];
    // where cards overlap, the one drawn on top (the later slot) is grabbed first; a ★ is not, while its knife is out
    for (const slot of this.cards.waiting().reverse())
      if (this.cards.knifeOut !== slot) items.push({ id: `${this.cfg.spot}:${slot}`, rect: this.cards.rect(slot) });
    const slot = slotOf(this.drag.down(p, items));
    if (slot === null) return false;
    this.d.controller.act({ type: "holdCard", spot: this.cfg.spot, slot }); // the auto-seller leaves it be
    return true;
  }

  pointerMove(p: Pt): void {
    this.drag.move(p);
  }

  pointerUp(p: Pt): void {
    const slot = slotOf(this.drag.dragging);
    if (slot === null) return;
    const end = this.drag.up(p);
    const c = this.d.controller;
    if (end.kind === "tap") c.act(this.cfg.sell(slot));
    if (end.kind === "drop" && this.l) {
      const target = dropTarget(this.l, end.at, c.run.state.locker.on);
      if (target === "bin") c.act(this.cfg.sell(slot));
      if (target === "locker") c.act({ type: "storeCard", from: this.cfg.spot, slot });
    }
    c.act({ type: "holdCard", spot: null });
  }

  /** The card being dragged, for the HD layer to draw lifted. */
  lifted(): LiftInfo | null {
    const p = this.drag.exactPosition;
    const id = this.drag.dragging;
    const slot = slotOf(id);
    const texture = slot === null ? null : this.cards.texture(slot);
    if (!p || !id || !texture) return null;
    const { w, h } = ITEM_SIZE.reveal;
    return { id, texture, center: { x: p.x + w / 2, y: p.y + h / 2 } };
  }

  /** The viewport changed under a drag (or the vault slammed in): the card goes home and nothing fires. */
  cancelDrag(): void {
    if (this.drag.dragging) this.d.controller.act({ type: "holdCard", spot: null });
    this.drag.cancel();
  }

  cancelKnife(): void {
    if (!this.knife.flying) return;
    this.knife.cancel();
    this.cards.endKnifeFlight();
  }

  /** Every card leaves at once (a new run). */
  clearAll(): void {
    this.cancelKnife();
    this.drag.cancel();
    this.cards.clearAll();
    this.shown = [];
    this.last = [];
    this.glows.clear();
  }

  destroy(): void {
    this.cards.destroy();
  }

  private sync(cards: readonly (Drop | null)[]): void {
    this.last = cards;
    if (sameIds(this.shown, cards)) return;
    if (cards.length) this.place(cards.length);
    const { show, clear } = syncPlan(this.shown, cards);
    const held = slotOf(this.drag.dragging);
    for (const i of clear) {
      if (this.cards.knifeOut === i) this.cancelKnife();
      if (held === i) this.drag.cancel(); // the sim took it (the vault's cash-in): nothing to drop
      this.cards.clear(i);
    }
    for (const i of show) this.cards.show(i, skinById(cards[i]!.skinId), cards[i]!);
    this.shown = cards.map((x) => x?.id ?? null);
    this.refreshGlows();
  }

  private place(n: number): void {
    if (!this.l || n === this.placedN) return;
    this.placedN = n;
    this.cards.layout(this.cfg.spots(this.l, n));
  }

  private refreshGlows(): void {
    const hd = this.d.juice.hd;
    const size = 50 * this.d.scale();
    for (let i = 0; i < SLOTS; i++) {
      const drop = this.last[i] ?? null;
      this.glows.set(i, hd.toScreen(this.centre(i)), drop ? RARITY_INFO[drop.rarity].color : null, size);
    }
  }

  /** The ★ knife's b-roll shot out of its card and back (as on your bench). */
  private launchKnife(slot: number, drop: Drop): void {
    const { hd, shake, audio } = this.d.juice;
    const at = hd.toScreen(this.centre(slot));
    this.cards.beginKnifeFlight(slot);
    this.knife.start(this.d.skins.frames(skinById(drop.skinId))[0]!, at, this.d.scale(), () => {
      this.cards.endKnifeFlight();
      shake.add(0.3);
      audio.play("coin-clink", { rate: 0.75 });
      hd.particles.burst(at, 0xffd700, 50, (260 * this.d.scale()) / 6);
    });
  }
}
