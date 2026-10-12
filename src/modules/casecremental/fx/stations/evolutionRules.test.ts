import { describe, expect, it } from "vitest";
import botOpen from "../../assets/sprites/bot-open.json";
import { benchReelArea, tableLayout } from "../pixel/layout";
import { pixelViewport } from "../pixel/viewport";
import {
  BELT_RIDE_SECONDS,
  beltRect,
  BILLS_MAX,
  BILLS_PER_SALE,
  billsToLaunch,
  chainRect,
  FLAMES_MAX,
  FLAMES_PER_SECOND,
  flamesToEmit,
  hotHand,
  rideAt,
  shadesRect,
  slotFrameRect,
  SLOT_FRAME_PAD,
} from "./evolutionRules";

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

describe("the machines' and the hand's evolutions", () => {
  it("caps the bills and the flames (Review Focus 4)", () => {
    expect(billsToLaunch(0, 1)).toBe(BILLS_PER_SALE);
    expect(billsToLaunch(BILLS_MAX - 2, 5)).toBe(2);
    expect(billsToLaunch(BILLS_MAX, 50)).toBe(0);
    let carry = 0;
    let alive = 0;
    for (let i = 0; i < 600; i++) {
      const r = flamesToEmit(alive, 1 / 60, carry);
      carry = r.carry;
      alive = Math.min(FLAMES_MAX, alive + r.n);
      expect(alive).toBeLessThanOrEqual(FLAMES_MAX);
    }
    expect(flamesToEmit(0, 1, 0).n).toBe(Math.min(FLAMES_MAX, FLAMES_PER_SECOND));
    expect(flamesToEmit(FLAMES_MAX, 1, 0).n).toBe(0);
  });

  it("Hot Hand burns only while owned and the combo is 25 or more", () => {
    const s = (owned: boolean, combo: number) => ({
      evolutions: { owned: owned ? ["hotHand" as const] : [], bestCombo: 0, pulls: 0 },
      combo,
    });
    expect(hotHand(s(true, 25))).toBe(true);
    expect(hotHand(s(true, 24))).toBe(false);
    expect(hotHand(s(false, 50))).toBe(false);
  });

  it("puts the shades over both eyes and the chain under them, inside the bot's frame, on every frame of its art", () => {
    for (const eyes of botOpen.eyes) {
      const pts = eyes.map(([x, y]) => ({ x: x!, y: y! }));
      const sh = shadesRect(pts)!;
      const ch = chainRect(pts)!;
      for (const e of pts) {
        expect(e.x).toBeGreaterThanOrEqual(sh.x);
        expect(e.x).toBeLessThan(sh.x + sh.w);
        expect(e.y).toBeGreaterThanOrEqual(sh.y);
        expect(e.y).toBeLessThan(sh.y + sh.h);
      }
      expect(ch.y).toBeGreaterThan(sh.y + sh.h);
      for (const r of [sh, ch]) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(botOpen.frameW);
        expect(r.y + r.h).toBeLessThanOrEqual(botOpen.ground);
      }
    }
    expect(shadesRect([])).toBeNull();
    expect(chainRect([])).toBeNull();
  });
});
