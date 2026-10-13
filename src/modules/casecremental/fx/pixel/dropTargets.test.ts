import { describe, expect, it } from "vitest";
import { BIN_SLOP, dropTarget } from "./dropTargets";
import { tableLayout } from "./layout";
import { pixelViewport } from "./viewport";

describe("dropTarget", () => {
  for (const [w, h] of [
    [1920, 1080],
    [390, 844],
    [1084, 749],
  ] as const) {
    const l = tableLayout(pixelViewport(w, h));
    const lockerMid = { x: l.locker.x + l.locker.w / 2, y: l.locker.y + l.locker.h / 2 };

    it(`a card let go over the bin is sold (${w}×${h})`, () => {
      expect(dropTarget(l, l.bin, true)).toBe("bin");
      expect(dropTarget(l, { x: l.bin.x, y: l.bin.y - l.binR - BIN_SLOP }, false)).toBe("bin");
    });

    it(`a card let go over the locker is stored once it is on, and goes home while it is dark (${w}×${h})`, () => {
      expect(dropTarget(l, lockerMid, true)).toBe("locker");
      expect(dropTarget(l, lockerMid, false)).toBeNull(); // Review Focus 1: Run 1's dark cabinet takes nothing
    });

    it(`where the bin's reach and the locker's meet, the nearer centre wins (${w}×${h})`, () => {
      const edge = { x: l.locker.x + l.locker.w + 1, y: lockerMid.y };
      const dBin = Math.hypot(edge.x - l.bin.x, edge.y - l.bin.y);
      const dLocker = Math.hypot(edge.x - lockerMid.x, edge.y - lockerMid.y);
      expect(dropTarget(l, edge, true)).toBe(dLocker < dBin ? "locker" : "bin");
    });

    it(`a card let go between the locker and the bin goes to the nearer one, with no dead gap (${w}×${h})`, () => {
      const seen: (string | null)[] = [];
      for (let x = lockerMid.x; x <= l.bin.x; x += 0.5) {
        const t = dropTarget(l, { x, y: lockerMid.y }, true);
        if (seen.at(-1) !== t) seen.push(t);
      }
      expect(seen).toEqual(["locker", "bin"]); // one switch, never null
      const rimL = l.bin.x - l.binR;
      const cabinetR = l.locker.x + l.locker.w;
      expect(dropTarget(l, { x: cabinetR - 1, y: lockerMid.y }, true)).toBe("locker"); // on the cabinet: stored
      expect(dropTarget(l, { x: rimL + 1, y: lockerMid.y }, true)).toBe("bin"); // on the bin: sold
    });

    it(`the bin's tap-to-sell ring and the locker's tap-to-press face never overlap (${w}×${h})`, () => {
      const binTapLeft = l.bin.x - (l.binR + 2); // Bench.pointerDown's reach
      expect(l.locker.x + l.locker.w).toBeLessThan(binTapLeft);
    });

    it(`a card let go on the open table goes home (${w}×${h})`, () => {
      expect(dropTarget(l, { x: l.table.x + 2, y: l.table.y + 2 }, true)).toBeNull();
    });
  }
});
