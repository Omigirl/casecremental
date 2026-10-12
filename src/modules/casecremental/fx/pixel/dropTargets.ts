import type { Pt, TableLayout } from "./layout";

// Where a dragged card lands when it is let go (spec §5: any waiting card — yours, the bot's, a tray item, a locker
// result — can be dropped on the SELL bin or, once it is on, the locker). Nowhere: it goes back to its spot.

export type DropTarget = "bin" | "locker";

/** How far past the bin's rim a card still drops in (world px). */
export const BIN_SLOP = 8;
/** And around the locker's cabinet. */
export const LOCKER_SLOP = 3;

/** The target under `at`: the bin, the locker (only when it is on), or null. Where both reach, the nearer centre wins. */
export function dropTarget(l: Pick<TableLayout, "bin" | "binR" | "locker">, at: Pt, lockerOn: boolean): DropTarget | null {
  const dBin = Math.hypot(at.x - l.bin.x, at.y - l.bin.y);
  const onBin = dBin <= l.binR + BIN_SLOP;
  const r = l.locker;
  const onLocker =
    lockerOn && at.x >= r.x - LOCKER_SLOP && at.x < r.x + r.w + LOCKER_SLOP && at.y >= r.y - LOCKER_SLOP && at.y < r.y + r.h + LOCKER_SLOP;
  if (onBin && onLocker) return Math.hypot(at.x - (r.x + r.w / 2), at.y - (r.y + r.h / 2)) < dBin ? "locker" : "bin";
  return onBin ? "bin" : onLocker ? "locker" : null;
}
