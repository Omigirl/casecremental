import type { Pt, Rect } from "./layout";

// Drag-and-drop in world pixels for the tactile chores (the key into the lock, the skin into the
// bin). A press that barely moves is a tap — the fallback for phones and quick players. The World
// cancels a drag when the viewport changes under it (resize, phone rotation): the item goes home
// and nothing fires (Review Focus 3).

export interface Grabbable {
  id: string;
  rect: Rect;
}

export type DragEnd =
  | { kind: "tap"; id: string }
  | { kind: "drop"; id: string; at: Pt }
  | { kind: "cancel"; id: string }
  | { kind: "none" };

/** World px a press may wander and still count as a tap (≈ 8–16 CSS px). */
export const TAP_SLOP = 2;

const hit = (r: Rect, p: Pt) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

export class DragTracker {
  private active: { id: string; start: Pt; grab: Pt; moved: number; exact: Pt } | null = null;

  get dragging(): string | null {
    return this.active?.id ?? null;
  }

  /** Where the dragged item's top-left goes, in whole world px. */
  get position(): Pt | null {
    const a = this.active;
    return a ? { x: Math.round(a.exact.x), y: Math.round(a.exact.y) } : null;
  }

  /** The same, unrounded — for an item lifted into the HD layer, which moves smoothly. */
  get exactPosition(): Pt | null {
    return this.active ? { ...this.active.exact } : null;
  }

  /** Grab the first item under the pointer (items are in priority order). */
  down(p: Pt, items: readonly Grabbable[]): string | null {
    const item = items.find((i) => hit(i.rect, p));
    if (!item) return null;
    this.active = { id: item.id, start: p, grab: { x: p.x - item.rect.x, y: p.y - item.rect.y }, moved: 0, exact: { x: item.rect.x, y: item.rect.y } };
    return item.id;
  }

  move(p: Pt): void {
    const a = this.active;
    if (!a) return;
    a.moved = Math.max(a.moved, Math.hypot(p.x - a.start.x, p.y - a.start.y));
    a.exact = { x: p.x - a.grab.x, y: p.y - a.grab.y };
  }

  up(p: Pt): DragEnd {
    const a = this.active;
    if (!a) return { kind: "none" };
    this.active = null;
    return a.moved <= TAP_SLOP ? { kind: "tap", id: a.id } : { kind: "drop", id: a.id, at: p };
  }

  cancel(): DragEnd {
    const a = this.active;
    this.active = null;
    return a ? { kind: "cancel", id: a.id } : { kind: "none" };
  }
}
