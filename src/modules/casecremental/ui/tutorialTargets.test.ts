import { describe, expect, it } from "vitest";
import { ITEM_SIZE, revealSpots, tableLayout, type Pt } from "../fx/pixel/layout";
import { pixelViewport } from "../fx/pixel/viewport";
import { firstPresent, isWorldTarget, scrollDelta, worldTargetRect, worldToOverlay } from "./tutorialTargets";
import type { TargetId } from "./tutorialRules";

const VIEWS: Array<[number, number]> = [
  [1920, 1080],
  [1280, 720],
  [1024, 768],
  [390, 844],
  [360, 640],
  [820, 1180],
];
const cardAt = (p: Pt) => ({
  x: p.x - ITEM_SIZE.reveal.w / 2,
  y: p.y - ITEM_SIZE.reveal.h / 2,
  w: ITEM_SIZE.reveal.w,
  h: ITEM_SIZE.reveal.h,
});

describe("world targets", () => {
  it.each(VIEWS)("sit on the table's props at %ix%i", (W, H) => {
    const l = tableLayout(pixelViewport(W, H));
    const c = l.you.caseSpot;
    expect(worldTargetRect("world:bench", l, [])).toEqual({
      x: c.x - ITEM_SIZE.case.w / 2,
      y: c.y - ITEM_SIZE.case.h,
      w: ITEM_SIZE.case.w,
      h: ITEM_SIZE.case.h,
    });
    expect(worldTargetRect("world:card", l, [])).toEqual(cardAt(l.you.reveal));
    expect(worldTargetRect("world:card", l, [true])).toEqual(cardAt(revealSpots(l, 1)[0]!));
    expect(worldTargetRect("world:card", l, [false, true])).toEqual(cardAt(revealSpots(l, 2)[1]!)); // the first card still waiting
    expect(worldTargetRect("world:bin", l, [])).toEqual({ x: l.bin.x - l.binR, y: l.bin.y - l.binR, w: 2 * l.binR, h: 2 * l.binR });
    expect(worldTargetRect("vault", l, [])).toBeNull();
  });

  it("tells world targets from DOM ones", () => {
    expect(isWorldTarget("world:bin")).toBe(true);
    expect(isWorldTarget("tab:you")).toBe(false);
  });

  it("maps a world rect onto the overlay through the pixel scale and the camera", () => {
    const r = { x: 10, y: 20, w: 4, h: 6 };
    expect(worldToOverlay(r, 6, { focusX: 0, focusY: 0, dx: 0, dy: 0, zoom: 1 })).toEqual({ x: 60, y: 120, w: 24, h: 36 });
    expect(worldToOverlay(r, 6, { focusX: 60, focusY: 120, dx: 3, dy: 0, zoom: 2 })).toEqual({ x: 63, y: 120, w: 48, h: 72 });
  });
});

describe("the target chain", () => {
  const chain: TargetId[] = ["upgrade:luck", "tab:you", "drawer:upgrades"];

  it("points at the deepest target on screen: the row, else its tab, else the drawer's tab (Review Focus 4)", () => {
    expect(firstPresent(chain, () => true)).toBe("upgrade:luck"); // the YOU tab is open
    expect(firstPresent(chain, (id) => id.startsWith("tab:"))).toBe("tab:you"); // desktop, the BOT tab open
    expect(firstPresent(chain, (id) => id === "drawer:upgrades")).toBe("drawer:upgrades"); // portrait, the CASES tab open
    expect(firstPresent(chain, () => false)).toBeNull();
  });
});

describe("scrollDelta", () => {
  it("scrolls a list just enough to show a row whole (Review Focus 5)", () => {
    const box = { top: 100, bottom: 300 };
    expect(scrollDelta({ top: 120, bottom: 160 }, box)).toBe(0);
    expect(scrollDelta({ top: 60, bottom: 100 }, box)).toBe(-40);
    expect(scrollDelta({ top: 290, bottom: 330 }, box)).toBe(30);
    expect(scrollDelta({ top: 250, bottom: 500 }, box)).toBe(150); // taller than the list: its top comes to the list's top
  });
});
