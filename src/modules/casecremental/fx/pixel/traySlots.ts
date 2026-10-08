import type { Pt, Rect } from "./layout";

// The claim tray's slots (M2b spec §4): two rows of small cards centred in the tray, as wide as the
// capacity allows (12 base, up to 24 with perks).

export function traySlots(r: Rect, capacity: number): Rect[] {
  const cols = Math.max(1, Math.ceil(capacity / 2));
  const cw = Math.max(3, Math.min(10, Math.floor((r.w - 4) / cols) - 1));
  const ch = Math.max(3, Math.min(7, Math.floor((r.h - 3) / 2)));
  const x0 = Math.round(r.x + (r.w - (cols * cw + (cols - 1))) / 2);
  const y0 = Math.round(r.y + (r.h - (2 * ch + 1)) / 2);
  const out: Rect[] = [];
  for (let i = 0; i < capacity; i++) out.push({ x: x0 + (i % cols) * (cw + 1), y: y0 + Math.floor(i / cols) * (ch + 1), w: cw, h: ch });
  return out;
}

export const slotAt = (slots: readonly Rect[], p: Pt): number =>
  slots.findIndex((s) => p.x >= s.x && p.y >= s.y && p.x < s.x + s.w && p.y < s.y + s.h);
