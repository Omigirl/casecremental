import type { RarityId } from "../../sim/types";
import type { Pt, Rect } from "./layout";

// The claim tray's motion (F1), as pure functions and a small state machine fed the tray's ids each frame, so a
// reload, a resize and a claim mid-flight all come out right. A stored card slides in from where it waited (the bench,
// the bot, the locker), arcing up, and hops onto its slot; a claimed card pops out (grows and fades, in the HD layer);
// Covert and ★ glow, and a full tray's frame pulses red — both swinging under 0.1 (photosensitivity, as
// BEAT_LIGHT_AMPLITUDES).

export const TRAY_LOOK = {
  /** Seconds a stored card slides from its spot to its slot (ease-out), arcing this many px up on the way. */
  slide: 0.3,
  arc: 6,
  /** Then it hops this many px on the slot, over this long. */
  bounce: 0.15,
  hop: 2,
  /** A claimed card pops out over this long, growing by this much (×1.6 at the end) as it fades. */
  pop: 0.25,
  popGrow: 0.6,
  /** The Covert/★ glow's alpha: base, peak-to-peak swing, period (s). */
  glow: { base: 0.35, swing: 0.09, period: 1.2 },
  /** The full tray's red frame. */
  full: { base: 0.75, swing: 0.09, period: 1.0 },
} as const;

export interface Throb {
  base: number;
  swing: number;
  period: number;
}

/** A light that throbs around `base`, `swing` from peak to peak. */
export const throb = (t: number, p: Throb): number => p.base + (p.swing / 2) * Math.sin((2 * Math.PI * t) / p.period);

/** Covert and ★ glow in the tray. */
export const glows = (r: RarityId): boolean => r === "covert" || r === "gold";

/** Where a slot's art goes: inside its 1-px dark edge. */
export const slotArtBox = (r: Rect): { w: number; h: number } => ({ w: Math.max(0, r.w - 2), h: Math.max(0, r.h - 2) });

/** A stored card's top-left `t` s into its slide from `from` to its slot's top-left `to` (world px, whole): an ease-out
 *  arc, then a 2-px hop on the slot; null once it has settled. */
export function slideAt(from: Pt, to: Pt, t: number): Pt | null {
  const { slide, bounce, arc, hop } = TRAY_LOOK;
  if (t >= slide + bounce) return null;
  if (t < slide) {
    const p = Math.max(0, t / slide);
    const e = 1 - (1 - p) ** 3;
    return { x: Math.round(from.x + (to.x - from.x) * e), y: Math.round(from.y + (to.y - from.y) * e - arc * Math.sin(Math.PI * p)) };
  }
  return { x: to.x, y: Math.round(to.y - hop * Math.sin((Math.PI * (t - slide)) / bounce)) };
}

/** A claimed card's look `t` s into its pop (scale × its start size, alpha); null once it is gone. */
export function popLook(t: number): { scale: number; alpha: number } | null {
  if (t >= TRAY_LOOK.pop) return null;
  const u = Math.max(0, t / TRAY_LOOK.pop);
  return { scale: 1 + TRAY_LOOK.popGrow * (1 - (1 - u) ** 2), alpha: 1 - u };
}

export interface Slide {
  readonly id: number;
  /** The card's centre where it waited (world px). */
  readonly from: Pt;
  t: number;
}

export interface Pop {
  readonly id: number;
  /** Its centre (world px): its slot, or where it was dropped over the bin. */
  readonly at: Pt;
  /** Dragged to the bin (it pops at its lifted full size), else tapped (the slot's mini card). */
  readonly dragged: boolean;
  t: number;
}

/** The tray's slides and pops, fed the sim's tray each frame. The World tells it where a stored card came from
 *  (`arriving`) and which card was claimed (`claimed`) during the sim step; `update` turns those into motion. */
export class TrayMotion {
  readonly slides = new Map<number, Slide>();
  pops: Pop[] = [];
  private prev: number[] | null = null;
  private readonly origins = new Map<number, Pt>();
  private readonly claims = new Map<number, Pt | null>();

  /** A card the sim just stored, from its spot `from` (its centre, world px). */
  arriving(id: number, from: Pt): void {
    this.origins.set(id, from);
  }

  /** A card claimed: it pops at `at` (dropped over the bin), else at its slot. */
  claimed(id: number, at: Pt | null): void {
    this.claims.set(id, at);
  }

  /** Still sliding in (it cannot be grabbed yet). */
  flying(id: number): boolean {
    return this.slides.has(id);
  }

  /** The tray's ids this frame, in slot order, after `dt` s; `slotCentre(i)`: slot i's centre (world px). Returns the
   *  ids whose slide reached its slot this frame, each once (the store sound). The first frame animates nothing. */
  update(ids: readonly number[], dt: number, slotCentre: (i: number) => Pt): number[] {
    const landed: number[] = [];
    for (const s of this.slides.values()) {
      const was = s.t;
      s.t += dt;
      if (was < TRAY_LOOK.slide && s.t >= TRAY_LOOK.slide) landed.push(s.id);
      if (s.t >= TRAY_LOOK.slide + TRAY_LOOK.bounce) this.slides.delete(s.id);
    }
    this.pops = this.pops.filter((p) => (p.t += dt) < TRAY_LOOK.pop);
    if (this.prev) {
      const now = new Set(ids);
      this.prev.forEach((id, i) => {
        if (now.has(id)) return;
        this.slides.delete(id);
        if (!this.claims.has(id)) return; // stored away (the locker) or cashed in: it just goes
        const at = this.claims.get(id) ?? null;
        this.pops.push({ id, at: at ?? slotCentre(i), dragged: at !== null, t: 0 });
      });
      const before = new Set(this.prev);
      for (const id of ids) {
        const from = this.origins.get(id);
        if (!before.has(id) && from) this.slides.set(id, { id, from, t: 0 });
      }
    }
    this.prev = [...ids];
    this.origins.clear();
    this.claims.clear();
    return landed;
  }

  /** The screen changed: every slide lands and every pop ends at once (silently). */
  settle(): void {
    this.slides.clear();
    this.pops = [];
    this.origins.clear();
    this.claims.clear();
  }
}
