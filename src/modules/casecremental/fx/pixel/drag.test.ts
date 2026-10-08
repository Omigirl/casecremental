import { describe, expect, it } from "vitest";
import { DragTracker } from "./drag";

const KEY = { id: "key", rect: { x: 10, y: 10, w: 10, h: 6 } };
const CARD = { id: "card", rect: { x: 40, y: 10, w: 44, h: 30 } };

describe("DragTracker", () => {
  it("grabs only what is under the pointer, first item first", () => {
    const d = new DragTracker();
    expect(d.down({ x: 5, y: 5 }, [KEY, CARD])).toBeNull();
    expect(d.down({ x: 12, y: 12 }, [KEY, CARD])).toBe("key");
    expect(d.dragging).toBe("key");
  });

  it("treats a press that barely moves as a tap", () => {
    const d = new DragTracker();
    d.down({ x: 12, y: 12 }, [KEY]);
    d.move({ x: 13, y: 13 });
    expect(d.up({ x: 13, y: 13 })).toEqual({ kind: "tap", id: "key" });
    expect(d.dragging).toBeNull();
  });

  it("drags in whole world pixels and drops where released", () => {
    const d = new DragTracker();
    d.down({ x: 12, y: 12 }, [KEY]);
    d.move({ x: 30.6, y: 40.2 });
    expect(d.position).toEqual({ x: 29, y: 38 });
    expect(d.exactPosition!.x).toBeCloseTo(28.6);
    expect(d.exactPosition!.y).toBeCloseTo(38.2);
    expect(d.up({ x: 31, y: 40 })).toEqual({ kind: "drop", id: "key", at: { x: 31, y: 40 } });
  });

  it("cancels mid-drag (viewport resized or rotated): nothing fires on release", () => {
    const d = new DragTracker();
    d.down({ x: 50, y: 20 }, [KEY, CARD]);
    d.move({ x: 90, y: 60 });
    expect(d.cancel()).toEqual({ kind: "cancel", id: "card" });
    expect(d.position).toBeNull();
    expect(d.up({ x: 90, y: 60 })).toEqual({ kind: "none" });
  });
});
