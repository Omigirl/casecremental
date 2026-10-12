import { cameraPoint, type CameraState } from "../fx/camera";
import { ITEM_SIZE, revealSpots, type Rect, type TableLayout } from "../fx/pixel/layout";
import { toScreen } from "../fx/pixel/screen";
import type { TargetId } from "./tutorialRules";

// Finding the tutorial's target on the overlay (finish spec §4). A prop on the table is a world rect from the table
// layout, where fx/pixel/Bench.ts draws it, mapped like everything on the canvas: world px × the pixel scale
// (fx/pixel/screen.ts toScreen), then the camera's zoom and shake (fx/camera.ts cameraPoint, the transform the HUD and
// panels get through cameraCss). A DOM target is an element marked data-tut; its list scrolls to show it.

/** A prop drawn on the canvas (world:…), as against an element of the DOM panels (data-tut). */
export const isWorldTarget = (id: TargetId): boolean => id.startsWith("world:");

/** The prop a world target means, in world px: the case on your mat (its lock takes the key), the first bench card
 *  still waiting, or the sell bin's mouth (its drop circle). Null for a DOM target. */
export function worldTargetRect(id: TargetId, l: TableLayout, benchCards: readonly boolean[]): Rect | null {
  switch (id) {
    case "world:bench": {
      const c = l.you.caseSpot; // actors stand on their spot: the case's bottom centre
      const { w, h } = ITEM_SIZE.case;
      return { x: c.x - w / 2, y: c.y - h, w, h };
    }
    case "world:card": {
      const slot = Math.max(0, benchCards.indexOf(true));
      const p = revealSpots(l, Math.max(1, benchCards.length))[slot] ?? l.you.reveal;
      const { w, h } = ITEM_SIZE.reveal;
      return { x: p.x - w / 2, y: p.y - h / 2, w, h };
    }
    case "world:bin":
      return { x: l.bin.x - l.binR, y: l.bin.y - l.binR, w: 2 * l.binR, h: 2 * l.binR };
    default:
      return null;
  }
}

/** A world rect on the overlay (CSS px from its top-left), through the pixel scale and the camera. */
export function worldToOverlay(r: Rect, scale: number, cam: CameraState): Rect {
  const a = toScreen({ scale }, r.x, r.y);
  const b = toScreen({ scale }, r.x + r.w, r.y + r.h);
  const p = cameraPoint(cam, a);
  const q = cameraPoint(cam, b);
  return { x: p.x, y: p.y, w: q.x - p.x, h: q.y - p.y };
}

/** The first target on screen, deepest first: a row inside a closed tab is not rendered, so its tab is next. */
export function firstPresent(targets: readonly TargetId[], present: (id: TargetId) => boolean): TargetId | null {
  return targets.find(present) ?? null;
}

/** How far to scroll a list so a row shows whole (0 = it does; negative scrolls up). A row taller than the list
 *  brings its top to the list's top. */
export function scrollDelta(row: { top: number; bottom: number }, box: { top: number; bottom: number }): number {
  if (row.top < box.top) return row.top - box.top;
  if (row.bottom > box.bottom) return Math.min(row.bottom - box.bottom, row.top - box.top);
  return 0;
}
