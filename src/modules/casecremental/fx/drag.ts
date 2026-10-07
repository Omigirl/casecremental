import type { Container, FederatedPointerEvent } from "pixi.js";
import type { Point } from "./layout";

// Drag-and-drop for the tactile chores (the key into the lock, the skin into the sell bin).
// A press that barely moves counts as a tap — the fallback for phones and quick players. After
// release the target always returns home; an accepted drop has already changed the game.

export interface DragOptions {
  home(): Point;
  /** Position in the target's parent space; return true if the drop did something. */
  onDrop(p: Point): boolean;
  onTap?(): void;
}

const TAP_SLOP = 6;

export function makeDraggable(target: Container, opts: DragOptions): () => void {
  let dragging = false;
  let moved = 0;
  let start: Point = { x: 0, y: 0 };
  let grab: Point = { x: 0, y: 0 };
  const local = (e: FederatedPointerEvent): Point => {
    const p = (target.parent ?? target).toLocal(e.global);
    return { x: p.x, y: p.y };
  };

  const down = (e: FederatedPointerEvent) => {
    dragging = true;
    moved = 0;
    start = local(e);
    grab = { x: start.x - target.x, y: start.y - target.y };
    target.cursor = "grabbing";
    e.stopPropagation();
  };
  const move = (e: FederatedPointerEvent) => {
    if (!dragging) return;
    const p = local(e);
    moved = Math.max(moved, Math.hypot(p.x - start.x, p.y - start.y));
    target.position.set(p.x - grab.x, p.y - grab.y);
  };
  const up = (e: FederatedPointerEvent) => {
    if (!dragging) return;
    dragging = false;
    target.cursor = "grab";
    if (moved < TAP_SLOP) opts.onTap?.();
    else opts.onDrop(local(e));
    const h = opts.home();
    target.position.set(h.x, h.y);
  };

  target.eventMode = "static";
  target.cursor = "grab";
  target.on("pointerdown", down);
  target.on("globalpointermove", move);
  target.on("pointerup", up);
  target.on("pointerupoutside", up);
  return () => {
    target.off("pointerdown", down);
    target.off("globalpointermove", move);
    target.off("pointerup", up);
    target.off("pointerupoutside", up);
  };
}
