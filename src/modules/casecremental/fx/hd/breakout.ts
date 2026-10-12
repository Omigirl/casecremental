import { Container, Sprite, Texture } from "pixi.js";
import type { Drop, RarityId } from "../../sim/types";
import { ITEM_SIZE, type Pt, type TableLayout } from "../pixel/layout";
import { FLIGHT_SECONDS, KnifeFlight } from "./knifeFlight";

// Covert and ★ grid drops break out (spec §6): a full-size card pops out of its cell to a spot over the table, holds
// there with the big reveal's juice (a ★ plays its knife showcase), then shrinks away to where the drop went. At most
// one plays at a time; the others wait their turn but never longer than BREAKOUT_MAX_WAIT — past that they show as a
// big flash in their cell. One breakout every 2 s at most keeps their full-screen ★ flashes far under 3 a second.

export const BREAKOUT_MAX_WAIT = 3;
export const POP_SECONDS = 0.25;
export const AWAY_SECONDS = 0.35;
const COVERT_HOLD = 1.4;

export const breakoutSeconds = (rarity: RarityId): number =>
  POP_SECONDS + (rarity === "gold" ? FLIGHT_SECONDS : COVERT_HOLD) + AWAY_SECONDS;

export interface Waiting {
  drop: Drop;
  cell: number;
  /** When it opened (the station's clock, seconds). */
  at: number;
}

export class BreakoutQueue {
  private queue: Waiting[] = [];
  private busyUntil = -Infinity;

  push(w: Waiting): void {
    this.queue.push(w);
  }

  /** At `now`: the ones that waited too long (show them as flashes), and the next to play if none is playing. */
  step(now: number): { start: Waiting | null; expired: Waiting[] } {
    const expired: Waiting[] = [];
    while (this.queue.length && now - this.queue[0]!.at > BREAKOUT_MAX_WAIT) expired.push(this.queue.shift()!);
    let start: Waiting | null = null;
    if (now >= this.busyUntil && this.queue.length) {
      start = this.queue.shift()!;
      this.busyUntil = now + breakoutSeconds(start.drop.rarity);
    }
    return { start, expired };
  }

  clear(): void {
    this.queue = [];
    this.busyUntil = -Infinity;
  }
}

const backOut = (u: number): number => {
  const c = 1.70158;
  return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2;
};

/** Where the card is at `t` of `total`: popping out of its cell toward the peak (leg 0), holding at the peak (1), then
 *  shrinking away to its target (2). `mix` 0–1 along the leg; `scale` of the card's own size. */
export function breakoutPose(t: number, total: number): { leg: 0 | 1 | 2; mix: number; scale: number } {
  if (t < POP_SECONDS) {
    const u = Math.max(0, t) / POP_SECONDS;
    return { leg: 0, mix: 1 - (1 - u) ** 3, scale: 0.2 + 0.8 * backOut(u) };
  }
  if (t < total - AWAY_SECONDS) return { leg: 1, mix: 1, scale: 1 };
  const u = Math.min(1, (t - (total - AWAY_SECONDS)) / AWAY_SECONDS);
  return { leg: 2, mix: u * u, scale: 1 - 0.8 * u };
}

/** The spot over the table where a breakout holds: just above the grid's machine (world px). */
export const breakoutPeak = (l: Pick<TableLayout, "grid">): Pt => ({
  x: l.grid.x + l.grid.w / 2,
  y: l.grid.y - ITEM_SIZE.reveal.h / 2 - 2,
});

/** Where the drop went (world px; `cellPt` is its cell): the tray, the locker (Collect), still in its cell (a stalled
 *  grid), else the seller (sold). */
export function breakoutTarget(
  s: { tray: readonly Drop[]; locker: { items: readonly Drop[] }; grid: { cells: readonly ({ drop: Drop | null } | null)[] } },
  dropId: number,
  cell: number,
  l: Pick<TableLayout, "tray" | "locker" | "seller">,
  cellPt: Pt,
): Pt {
  if (s.tray.some((d) => d.id === dropId)) return { x: l.tray.x + l.tray.w / 2, y: l.tray.y + l.tray.h / 2 };
  if (s.locker.items.some((d) => d.id === dropId)) return { x: l.locker.x + l.locker.w / 2, y: l.locker.y + 6 };
  if (s.grid.cells[cell]?.drop?.id === dropId) return cellPt;
  return { x: l.seller.x, y: l.seller.y - 15 };
}

export interface BreakoutShow {
  /** The card with its art, and (★) without it while the knife is out. Owned: destroyed when it ends. */
  full: Texture;
  empty: Texture | null;
  /** The ★'s knife frame for its showcase, or null. */
  knife: Texture | null;
  color: number;
  /** Screen px. */
  from: Pt;
  peak: Pt;
  to: Pt;
  total: number;
  /** The pixel scale. */
  scale: number;
}

/** One breakout on screen (HD layer). */
export class BreakoutCard {
  readonly root = new Container();
  private readonly glow: Sprite;
  private readonly card = new Sprite({ anchor: 0.5 });
  private readonly knife: KnifeFlight;
  private show: BreakoutShow | null = null;
  private t = 0;
  private knifeOut = false;

  constructor(glowTexture: Texture) {
    this.glow = new Sprite({ texture: glowTexture, anchor: 0.5, blendMode: "add", alpha: 0.8 });
    this.root.addChild(this.glow, this.card);
    this.knife = new KnifeFlight(this.root);
    this.root.visible = false;
  }

  get playing(): boolean {
    return this.show !== null;
  }

  start(s: BreakoutShow): void {
    this.stop();
    this.show = s;
    this.t = 0;
    this.knifeOut = false;
    this.card.texture = s.empty ?? s.full;
    this.glow.tint = s.color;
    this.root.visible = true;
    this.place(s);
  }

  update(dt: number): void {
    const s = this.show;
    if (!s) return;
    this.t += dt;
    this.knife.update(dt);
    if (!this.knifeOut && s.knife && this.t >= POP_SECONDS) {
      this.knifeOut = true;
      this.knife.start(s.knife, s.peak, s.scale, () => (this.card.texture = s.full));
    }
    if (this.t >= s.total) return this.stop();
    this.place(s);
  }

  /** It ends (or the screen changed, the vault slammed in): gone at once, its textures with it. */
  stop(): void {
    const s = this.show;
    this.show = null;
    this.knife.cancel();
    this.root.visible = false;
    this.card.texture = Texture.EMPTY; // never left pointing at a destroyed texture
    s?.full.destroy(true);
    s?.empty?.destroy(true);
  }

  private place(s: BreakoutShow): void {
    const p = breakoutPose(this.t, s.total);
    const [a, b] = p.leg === 2 ? [s.peak, s.to] : [s.from, s.peak];
    const x = a.x + (b.x - a.x) * p.mix;
    const y = a.y + (b.y - a.y) * p.mix;
    this.card.position.set(x, y);
    this.card.scale.set(s.scale * 1.15 * p.scale);
    this.glow.position.set(x, y);
    this.glow.width = this.glow.height = 60 * s.scale * p.scale;
  }
}
