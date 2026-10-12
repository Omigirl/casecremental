import type { Rect } from "../pixel/layout";

// Slot Machine's look (finish spec §7.3): its ten reels as five slot columns of two windows each, one skin a window,
// in whole pixels inside the reel area. The strips inside are ordinary reels (F1's cell look). Portrait's wide reel
// window gives each column a clean small cell; landscape's (~84 px) gives SLOT_MIN_W, so a window shows the middle of
// a card scrolling past, like a slot drum.

export const SLOT_COLUMNS = 5;
/** A window's tallest: a slot drum shows one skin, not a strip. */
const SLOT_MAX_H = 26;
/** The narrowest window worth closing the gaps for: below it the gaps shrink to 1 px first. */
export const SLOT_MIN_W = 16;

/** n windows (columns of SLOT_COLUMNS, left to right, then the next row), centred in `area`. */
export function slotRects(area: Rect, n: number, gap = 2): Rect[] {
  const rowsN = Math.max(1, Math.ceil(n / SLOT_COLUMNS));
  const x0 = Math.ceil(area.x);
  const y0 = Math.ceil(area.y);
  const areaW = Math.floor(area.x + area.w) - x0;
  const areaH = Math.floor(area.y + area.h) - y0;
  const colW = (g: number) => Math.floor((areaW - g * (SLOT_COLUMNS - 1)) / SLOT_COLUMNS);
  const g = colW(gap) < SLOT_MIN_W ? Math.min(gap, 1) : gap;
  const w = Math.max(1, colW(g));
  const h = Math.max(1, Math.min(SLOT_MAX_H, Math.floor((areaH - g * (rowsN - 1)) / rowsN)));
  const left = x0 + Math.floor((areaW - (SLOT_COLUMNS * w + g * (SLOT_COLUMNS - 1))) / 2);
  const top = y0 + Math.floor((areaH - (rowsN * h + g * (rowsN - 1))) / 2);
  return Array.from({ length: n }, (_, i) => ({
    x: left + (i % SLOT_COLUMNS) * (w + g),
    y: top + Math.floor(i / SLOT_COLUMNS) * (h + g),
    w,
    h,
  }));
}
