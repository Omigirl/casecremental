import { describe, expect, it } from "vitest";
import { tableLayout } from "./layout";
import { slotAt, traySlots } from "./traySlots";
import { pixelViewport } from "./viewport";

const SIZES: Array<[number, number]> = [
  [1920, 1080],
  [1280, 720],
  [1024, 768],
  [1000, 1000],
  [390, 844],
  [360, 640],
];

describe("claim tray slots", () => {
  it.each(SIZES)("fit inside the tray without overlapping at %ix%i, up to 24 slots (Review Focus 3)", (w, h) => {
    const r = tableLayout(pixelViewport(w, h)).tray;
    for (const capacity of [12, 16, 24]) {
      const slots = traySlots(r, capacity);
      expect(slots).toHaveLength(capacity);
      for (const s of slots) {
        expect(s.w).toBeGreaterThanOrEqual(3);
        expect(s.x).toBeGreaterThanOrEqual(r.x);
        expect(s.y).toBeGreaterThanOrEqual(r.y);
        expect(s.x + s.w).toBeLessThanOrEqual(r.x + r.w);
        expect(s.y + s.h).toBeLessThanOrEqual(r.y + r.h);
      }
      for (let i = 0; i < slots.length; i++)
        for (let j = i + 1; j < slots.length; j++) {
          const a = slots[i]!,
            b = slots[j]!;
          const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
          expect(apart).toBe(true);
        }
    }
  });

  it("finds the slot under the pointer", () => {
    const slots = traySlots({ x: 0, y: 0, w: 80, h: 18 }, 12);
    const s = slots[7]!;
    expect(slotAt(slots, { x: s.x + 1, y: s.y + 1 })).toBe(7);
    expect(slotAt(slots, { x: -5, y: -5 })).toBe(-1);
  });
});
