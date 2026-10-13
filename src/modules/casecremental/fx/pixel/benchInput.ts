import type { Bench as BenchState } from "../../sim/run";
import type { DragEnd, Grabbable } from "./drag";
import type { Pt, Rect, TableLayout } from "./layout";
import { caseRect } from "./layout";

// What a press on your bench picks up, and when a release turns the key — pure, so it is testable without Pixi.
// The locked case is a tap target as well as the key: the tutorial says "turn the key — or tap the case".

const inside = (r: Rect, p: Pt) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

export interface BenchPress {
  phase: BenchState["phase"];
  /** The key is still in the lock from the last turn. */
  keyBusy: boolean;
  key: Rect;
  layout: Pick<TableLayout, "you">;
  /** The waiting cards, the one drawn on top first. */
  cards: readonly { slot: number; rect: Rect; grabbable: boolean }[];
}

/** What a press can grab, in priority order: the key, then the case it unlocks, then the cards. */
export function benchGrabbables(b: BenchPress): Grabbable[] {
  const out: Grabbable[] = [];
  if (b.phase === "locked" && !b.keyBusy) {
    out.push({ id: "key", rect: b.key });
    out.push({ id: "case", rect: caseRect(b.layout) });
  }
  for (const c of b.cards) if (c.grabbable) out.push({ id: `card${c.slot}`, rect: c.rect });
  return out;
}

/** The release turns the key: a tap on the key or the case, a press on the case that wobbled (the case never moves),
 *  or the key let go on the lock or the mat. */
export function releaseTurnsKey(end: DragEnd, l: Pick<TableLayout, "you">): boolean {
  if (end.kind === "tap") return end.id === "key" || end.id === "case";
  if (end.kind !== "drop") return false;
  if (end.id === "case") return true;
  const lock = { x: l.you.caseSpot.x, y: l.you.caseSpot.y - 10 };
  return end.id === "key" && (Math.hypot(end.at.x - lock.x, end.at.y - lock.y) <= 18 || inside(l.you.mat, end.at));
}
