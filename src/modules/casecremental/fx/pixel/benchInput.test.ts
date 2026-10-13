import { describe, expect, it } from "vitest";
import { worldTargetRect } from "../../ui/tutorialTargets";
import { benchGrabbables, releaseTurnsKey, type BenchPress } from "./benchInput";
import { DragTracker } from "./drag";
import { caseRect, tableLayout } from "./layout";
import { pixelViewport } from "./viewport";

// Tutorial step 2 says "turn the key — or tap the case": a tap on the locked case turns the key like a tap on the key
// (the same insertKey, so the same key turn and lid), and the tutorial's arrow points at that same case.

const l = tableLayout(pixelViewport(1920, 1080));
const KEY = { x: l.you.keyHome.x - 10, y: l.you.keyHome.y - 19, w: 20, h: 24 };
const press = (over: Partial<BenchPress> = {}): BenchPress => ({
  phase: "locked",
  keyBusy: false,
  key: KEY,
  layout: l,
  cards: [],
  ...over,
});
const centre = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

describe("tapping the case on the bench", () => {
  it("grabs the locked case where the tutorial points", () => {
    const c = caseRect(l);
    expect(worldTargetRect("world:bench", l, [])).toEqual(c);
    const d = new DragTracker();
    expect(d.down(centre(c), benchGrabbables(press()))).toBe("case");
    expect(releaseTurnsKey(d.up(centre(c)), l)).toBe(true);
  });

  it("turns the key on a tap of the case or the key, or a wobbly press on the case", () => {
    expect(releaseTurnsKey({ kind: "tap", id: "case" }, l)).toBe(true);
    expect(releaseTurnsKey({ kind: "tap", id: "key" }, l)).toBe(true);
    expect(releaseTurnsKey({ kind: "drop", id: "case", at: { x: 0, y: 0 } }, l)).toBe(true);
    expect(releaseTurnsKey({ kind: "tap", id: "card0" }, l)).toBe(false);
    expect(releaseTurnsKey({ kind: "cancel", id: "case" }, l)).toBe(false);
    expect(releaseTurnsKey({ kind: "none" }, l)).toBe(false);
  });

  it("still turns the key dragged to the lock or the mat, and not dropped elsewhere", () => {
    const lock = { x: l.you.caseSpot.x, y: l.you.caseSpot.y - 10 };
    expect(releaseTurnsKey({ kind: "drop", id: "key", at: lock }, l)).toBe(true);
    expect(releaseTurnsKey({ kind: "drop", id: "key", at: centre(l.you.mat) }, l)).toBe(true);
    expect(releaseTurnsKey({ kind: "drop", id: "key", at: { x: l.bin.x, y: l.bin.y } }, l)).toBe(false);
  });

  it("offers the case only while it is locked and the key is free; the key comes first", () => {
    expect(benchGrabbables(press()).map((g) => g.id)).toEqual(["key", "case"]);
    expect(benchGrabbables(press({ keyBusy: true }))).toEqual([]);
    for (const phase of ["empty", "spinning", "revealed"] as const)
      expect(benchGrabbables(press({ phase })).map((g) => g.id)).not.toContain("case");
  });

  it("keeps the cards grabbable in their order", () => {
    const rect = { x: 0, y: 0, w: 4, h: 4 };
    const cards = [
      { slot: 1, rect, grabbable: true },
      { slot: 0, rect, grabbable: false },
    ];
    expect(benchGrabbables(press({ phase: "revealed", cards })).map((g) => g.id)).toEqual(["card1"]);
  });
});
