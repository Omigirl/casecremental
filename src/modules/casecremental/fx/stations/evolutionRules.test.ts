import { describe, expect, it } from "vitest";
import { benchReelArea, tableLayout } from "../pixel/layout";
import { pixelViewport } from "../pixel/viewport";
import { BELT_RIDE_SECONDS, beltRect, rideAt, slotFrameRect, SLOT_FRAME_PAD } from "./evolutionRules";

const VIEWPORTS: Array<[number, number]> = [
  [1920, 1080],
  [1280, 720],
  [820, 1180],
  [390, 844],
  [360, 640],
];

describe("the bench's evolutions", () => {
  it("frames the reel window: the one-reel window at rest, the tall one while ten reels spin", () => {
    const l = tableLayout(pixelViewport(1920, 1080));
    const rest = slotFrameRect(l, { phase: "empty" });
    expect(rest).toEqual({
      x: l.you.reel.x - SLOT_FRAME_PAD,
      y: l.you.reel.y - SLOT_FRAME_PAD,
      w: l.you.reel.w + 2 * SLOT_FRAME_PAD,
      h: l.you.reel.h + 2 * SLOT_FRAME_PAD,
    });
    const reels = Array.from({ length: 10 }, () => ({ drop: {} as never, tease: null, duration: 1 }));
    const spin = slotFrameRect(l, { phase: "spinning", caseId: "bootcamp", reels, elapsed: 0, fullDuration: 1 });
    expect(spin.h).toBe(benchReelArea(l, 10, true).h + 2 * SLOT_FRAME_PAD);
  });

  it.each(VIEWPORTS)("lays the belt on the table, left of the case, clear of the arm (%ix%i)", (w, h) => {
    const l = tableLayout(pixelViewport(w, h));
    const b = beltRect(l);
    expect(b).not.toBeNull(); // every supported viewport has room for one
    if (!b) return;
    expect(b.x).toBeGreaterThanOrEqual(l.table.x);
    expect(b.x + b.w).toBeLessThanOrEqual(l.you.caseSpot.x);
    const arm = l.you.arm;
    expect(b.x + b.w <= arm.x || arm.x + arm.w <= b.x || b.y + b.h <= arm.y || arm.y + arm.h <= b.y).toBe(true);
  });

  it("rides a case from the belt's start into the case spot in 0.4 s, then is gone", () => {
    const belt = { x: 10, y: 50, w: 60, h: 4 };
    const to = { x: 90, y: 48 };
    expect(rideAt(belt, to, 0)).toEqual({ x: 10, y: 48 });
    expect(rideAt(belt, to, BELT_RIDE_SECONDS / 2)!.x).toBeGreaterThan(10);
    expect(rideAt(belt, to, BELT_RIDE_SECONDS)).toBeNull();
  });
});
